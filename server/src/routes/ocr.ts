import { Router, Response } from 'express';
import { GoogleGenAI, Type, HarmCategory, HarmBlockThreshold } from '@google/genai';
import { prisma } from '../lib/prisma';
import { authMiddleware, AuthRequest } from '../auth/authMiddleware';
import { SYSTEM_PROMPT_DEFAULT } from '../constants/defaultPrompt';

const router = Router();

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Build a Gemini responseSchema from InputConfig.fieldMappings */
function buildDynamicSchema(fieldMappings: any[]) {
  const properties: Record<string, any> = {};
  const requiredFields: string[] = [];
  for (const f of fieldMappings) {
    const name = f.systemField as string;
    if (!name) continue;
    properties[name] = { type: f.type === 'number' ? Type.NUMBER : Type.STRING };
    if (f.required) requiredFields.push(name);
  }
  return {
    type: Type.ARRAY,
    items: {
      type: Type.OBJECT,
      properties,
      ...(requiredFields.length > 0 ? { required: requiredFields } : {}),
    },
  };
}

/** Fallback schema — matches the classic 39-line ground-handling document */
const DEFAULT_SCHEMA = {
  type: Type.ARRAY,
  items: {
    type: Type.OBJECT,
    properties: {
      lineCode:    { type: Type.STRING },
      description: { type: Type.STRING },
      quantity:    { type: Type.NUMBER },
      unitPrice:   { type: Type.NUMBER },
      totalAmount: { type: Type.NUMBER },
      taxRefund:   { type: Type.NUMBER },
      noteSource:  { type: Type.STRING },
      details: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            reference:   { type: Type.STRING },
            subQuantity: { type: Type.NUMBER },
          },
        },
      },
    },
    required: ['lineCode', 'description', 'totalAmount', 'noteSource'],
  },
};

// ── POST /api/ocr/analyze ─────────────────────────────────────────────────────
router.post('/analyze', authMiddleware as any, async (req: AuthRequest, res: Response) => {
  const {
    base64Images,
    fileName,
    fileSize,
    period,
    docType,
    branchId: reqBranchId,   // supplied by frontend (admin may pick a branch)
  } = req.body;

  if (!base64Images || !Array.isArray(base64Images) || base64Images.length === 0) {
    return res.status(400).json({ error: 'base64Images array is required and must not be empty.' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'PASTE_YOUR_REAL_API_KEY_HERE') {
    return res.status(500).json({ error: 'Server configuration error: API key not set.' });
  }

  // ── RBAC — determine effective branchId ───────────────────────────────────
  const userRole     = req.user!.role;
  const userBranchId = req.user!.branchId;
  let branchId: number;

  if (userRole === 'system_admin') {
    // system_admin may upload for any branch
    branchId = reqBranchId ? parseInt(reqBranchId) : (userBranchId ?? 1);
  } else {
    // operator / branch_admin must stay within their assigned branch
    if (!userBranchId) {
      return res.status(403).json({
        error:   'FORBIDDEN',
        message: 'Tài khoản chưa được gán chi nhánh. Liên hệ quản trị viên.',
      });
    }
    if (reqBranchId && parseInt(reqBranchId) !== userBranchId) {
      return res.status(403).json({
        error:   'FORBIDDEN',
        message: 'Bạn chỉ có thể upload cho chi nhánh được phân công.',
      });
    }
    branchId = userBranchId;
  }

  // ── Load PromptConfig → system prompt ─────────────────────────────────────
  let systemPrompt     = SYSTEM_PROMPT_DEFAULT;
  let promptSource     = 'default';

  if (docType) {
    const promptCfg = await prisma.promptConfig.findUnique({
      where: { branchId_docType: { branchId, docType } },
    });
    if (promptCfg?.isActive && promptCfg.promptText) {
      systemPrompt = promptCfg.promptText;
      promptSource = `PromptConfig#${promptCfg.id}`;
    }
  }

  // Fallback to legacy BranchSettings.systemPrompt
  if (promptSource === 'default') {
    const branchSettings = await prisma.branchSettings.findUnique({ where: { branchId } });
    if (branchSettings?.systemPrompt) {
      systemPrompt = branchSettings.systemPrompt;
      promptSource = 'branch_settings';
    }
  }

  const geminiModel = (() => {
    // Model from branchSettings if available (only used as hint)
    return 'gemini-2.0-flash';
  })();

  // ── Load InputConfig → field mappings + accepted formats ──────────────────
  let fieldMappings: any[]    = [];
  let acceptedFormats: string[] = ['pdf', 'xlsx', 'jpg'];

  if (docType) {
    const inputCfg = await prisma.inputConfig.findUnique({
      where: { branchId_docType: { branchId, docType } },
    });
    if (inputCfg) {
      try { fieldMappings    = JSON.parse(inputCfg.fieldMappings); }   catch {}
      try { acceptedFormats  = JSON.parse(inputCfg.acceptedFormats); } catch {}
    }
  }

  // Build dynamic or default response schema
  const responseSchema = fieldMappings.length > 0
    ? buildDynamicSchema(fieldMappings)
    : DEFAULT_SCHEMA;

  // Inject field-extraction hint into user message
  const fieldHint = fieldMappings.length > 0
    ? `Trích xuất chính xác các trường sau: ${fieldMappings.map((f: any) => `${f.systemField} (${f.docLabel})`).join(', ')}.`
    : 'ANALYZE ALL PAGES. Extract strictly the 39 line items. Return a JSON Array of exactly 39 objects.';

  // ── Create OcrDocument record (status: processing) ────────────────────────
  const docRecord = await prisma.ocrDocument.create({
    data: {
      branchId,
      uploadedById: req.user!.id,
      fileName:     fileName  ?? 'document.pdf',
      fileSize:     fileSize  ?? 0,
      period:       period    ?? null,
      docType:      docType   ?? null,
      status:       'processing',
      geminiModel:  geminiModel,
      result:       '[]',
    },
  });

  // ── Call Gemini ───────────────────────────────────────────────────────────
  const ai    = new GoogleGenAI({ apiKey });
  const parts: any[] = [
    ...base64Images.map((img: string) => ({ inlineData: { mimeType: 'image/jpeg', data: img } })),
    { text: fieldHint },
  ];

  const maxRetries = 3;
  let attempt  = 0;
  let response: any;

  while (attempt < maxRetries) {
    try {
      response = await ai.models.generateContent({
        model:    geminiModel,
        contents: { parts },
        config: {
          systemInstruction: systemPrompt,
          temperature:       0.0,
          maxOutputTokens:   65536,
          responseMimeType:  'application/json',
          responseSchema,
          safetySettings: [
            { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,       threshold: HarmBlockThreshold.BLOCK_NONE },
            { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,  threshold: HarmBlockThreshold.BLOCK_NONE },
            { category: HarmCategory.HARM_CATEGORY_HARASSMENT,         threshold: HarmBlockThreshold.BLOCK_NONE },
            { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,  threshold: HarmBlockThreshold.BLOCK_NONE },
          ],
        },
      });
      break;
    } catch (error: any) {
      attempt++;
      if (error.message?.includes('error code: 6')) {
        await prisma.ocrDocument.update({ where: { id: docRecord.id }, data: { status: 'error' } });
        return res.status(413).json({ error: 'PDF quá lớn. Vui lòng chia nhỏ file.' });
      }
      const isQuota = error.status === 429 || error.message?.includes('429') || error.message?.includes('RESOURCE_EXHAUSTED');
      if (isQuota && attempt < maxRetries) {
        await new Promise(r => setTimeout(r, Math.pow(2, attempt) * 2000));
        continue;
      }
      await prisma.ocrDocument.update({ where: { id: docRecord.id }, data: { status: 'error' } });
      if (isQuota) return res.status(429).json({ error: `Gemini API Quota Exceeded (429) — model: ${geminiModel}`, isQuotaError: true });
      return res.status(500).json({ error: error.message ?? 'Unexpected error.' });
    }
  }

  let responseText = response?.text ?? '';
  if (!responseText) {
    await prisma.ocrDocument.update({ where: { id: docRecord.id }, data: { status: 'error' } });
    return res.status(500).json({ error: 'AI trả về rỗng.' });
  }

  responseText = responseText.replace(/```json/g, '').replace(/```/g, '').trim();

  let items: any[] | null = null;
  try { items = JSON.parse(responseText); } catch {}
  if (!items) try { items = JSON.parse(responseText + '}]'); } catch {}
  if (!items) try { items = JSON.parse(responseText + ']');  } catch {}

  if (!items || !Array.isArray(items)) {
    await prisma.ocrDocument.update({ where: { id: docRecord.id }, data: { status: 'error' } });
    return res.status(500).json({ error: 'Không parse được response từ AI.' });
  }

  // Total amount — works for both ground_handling (totalAmount) and custom fields
  const totalOcrAmount = items.reduce((sum: number, item: any) => {
    // Try common field names
    return sum + (item.totalAmount ?? item.total_amount ?? item.amount ?? 0);
  }, 0);

  const estimatedTokens = Math.round(JSON.stringify(items).length / 4);
  const estimatedCost   = parseFloat((estimatedTokens / 1000 * 0.00125).toFixed(6));

  // ── Update document → completed ───────────────────────────────────────────
  await prisma.ocrDocument.update({
    where: { id: docRecord.id },
    data: {
      status:     'completed',
      result:     JSON.stringify(items),
      tokensUsed: estimatedTokens,
      costUsd:    estimatedCost,
    },
  });

  // ── AuditLog ──────────────────────────────────────────────────────────────
  await prisma.auditLog.create({
    data: {
      action:    'OCR_COMPLETED',
      userId:    req.user!.id,
      branchId,
      detail:    `OCR ${fileName ?? 'document.pdf'} · ${docType ?? 'unknown'} · prompt: ${promptSource} · ${estimatedTokens} tokens · ${items.length} items`,
      ipAddress: req.ip,
    },
  });

  // ── Create ReconcileResult (pending) ─────────────────────────────────────
  await prisma.reconcileResult.create({
    data: {
      documentId:   docRecord.id,
      branchId,
      ocrAmount:    totalOcrAmount,
      status:       'not_found',
      aiConfidence: 0,
      difference:   0,
    },
  });

  return res.json({
    items,
    documentId: docRecord.id,
    docType:    docType ?? null,
    branchId,
    promptSource,
    fieldMappings,   // returned so frontend knows field names for display
    acceptedFormats,
  });
});

export default router;
