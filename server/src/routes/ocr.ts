import { Router, Request, Response } from 'express';
import { GoogleGenAI, Type, HarmCategory, HarmBlockThreshold } from '@google/genai';
import { prisma } from '../lib/prisma';
import { authMiddleware, AuthRequest } from '../auth/authMiddleware';
import { SYSTEM_PROMPT_DEFAULT } from '../constants/defaultPrompt';

const router = Router();

// OCR yêu cầu đăng nhập — branchId được lấy từ token
router.post('/analyze', authMiddleware as any, async (req: AuthRequest, res: Response) => {
  const { base64Images, fileName, fileSize, period } = req.body;

  if (!base64Images || !Array.isArray(base64Images) || base64Images.length === 0) {
    return res.status(400).json({ error: 'base64Images array is required and must not be empty.' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'PASTE_YOUR_REAL_API_KEY_HERE') {
    return res.status(500).json({ error: 'Server configuration error: API key not set.' });
  }

  // Lấy settings của branch — system prompt + model
  const branchId   = req.user!.branchId;
  let systemPrompt = SYSTEM_PROMPT_DEFAULT;
  let model        = 'gemini-3-pro-preview';

  if (branchId) {
    const branchSettings = await prisma.branchSettings.findUnique({ where: { branchId } });
    if (branchSettings?.systemPrompt) systemPrompt = branchSettings.systemPrompt;
    if (branchSettings?.geminiModel)  model        = branchSettings.geminiModel;
  }

  // Ghi nhận document đang xử lý
  const docRecord = await prisma.ocrDocument.create({
    data: {
      branchId:     branchId ?? 1,
      uploadedById: req.user!.id,
      fileName:     fileName ?? 'document.pdf',
      fileSize:     fileSize ?? 0,
      period:       period ?? null,
      status:       'processing',
      geminiModel:  model,
      result:       '[]'
    }
  });

  // ── Gọi Gemini API ──────────────────────────────────────────────────────────
  const ai    = new GoogleGenAI({ apiKey });
  const parts: any[] = base64Images.map((img: string) => ({
    inlineData: { mimeType: 'image/jpeg', data: img }
  }));
  parts.push({ text: 'ANALYZE ALL PAGES. Extract strictly the 39 line items. Return a JSON Array of exactly 39 objects.' });

  const maxRetries = 3;
  let attempt  = 0;
  let response: any;

  while (attempt < maxRetries) {
    try {
      response = await ai.models.generateContent({
        model,
        contents: { parts },
        config: {
          systemInstruction: systemPrompt,
          temperature:       0.0,
          maxOutputTokens:   65536,
          responseMimeType:  'application/json',
          responseSchema: {
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
                      subQuantity: { type: Type.NUMBER }
                    }
                  }
                }
              },
              required: ['lineCode', 'description', 'totalAmount', 'noteSource']
            }
          },
          safetySettings: [
            { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,       threshold: HarmBlockThreshold.BLOCK_NONE },
            { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,  threshold: HarmBlockThreshold.BLOCK_NONE },
            { category: HarmCategory.HARM_CATEGORY_HARASSMENT,         threshold: HarmBlockThreshold.BLOCK_NONE },
            { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,  threshold: HarmBlockThreshold.BLOCK_NONE }
          ]
        }
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
      if (isQuota) return res.status(429).json({ error: `Gemini API Quota Exceeded (429) — model: ${model}`, isQuotaError: true });
      return res.status(500).json({ error: error.message ?? 'Unexpected error.' });
    }
  }

  let responseText: string = response?.text ?? '';
  if (!responseText) {
    await prisma.ocrDocument.update({ where: { id: docRecord.id }, data: { status: 'error' } });
    return res.status(500).json({ error: 'AI trả về rỗng.' });
  }

  responseText = responseText.replace(/```json/g, '').replace(/```/g, '').trim();

  // Parse + repair
  let items: any[] | null = null;
  try {
    items = JSON.parse(responseText);
  } catch {
    try { items = JSON.parse(responseText + '}]'); } catch {}
    if (!items) try { items = JSON.parse(responseText + ']'); } catch {}
  }

  if (!items || !Array.isArray(items)) {
    await prisma.ocrDocument.update({ where: { id: docRecord.id }, data: { status: 'error' } });
    return res.status(500).json({ error: 'Không parse được response từ AI.' });
  }

  // Ước tính token + chi phí (Gemini Pro: ~$0.00125/1K input tokens, $0.005/1K output)
  const estimatedTokens = Math.round(JSON.stringify(items).length / 4);
  const estimatedCost   = parseFloat((estimatedTokens / 1000 * 0.00125).toFixed(6));

  // Cập nhật document record thành completed
  await prisma.ocrDocument.update({
    where: { id: docRecord.id },
    data: {
      status:     'completed',
      result:     JSON.stringify(items),
      tokensUsed: estimatedTokens,
      costUsd:    estimatedCost
    }
  });

  return res.json({ items, documentId: docRecord.id });
});

export default router;
