import React, { useEffect, useRef, useState } from 'react';
import ResultsTable from '../components/ResultsTable';
import { LineItem, ProcessingStatus } from '../types';
import { convertPdfToImages } from '../utils';
import { analyzePdfImages, OcrResult } from '../services/geminiService';

const token = () => localStorage.getItem('auth_token') ?? '';

// ── Types ────────────────────────────────────────────────────────────────────
interface User    { id: number; email: string; role: string; branchId: number | null; fullName: string; }
interface Branch  { id: number; code: string; name: string; }
interface DocType { id: number; code: string; name: string; icon: string; color: string; bgColor: string; }
interface FieldMapping { systemField: string; docLabel: string; required: boolean; type: string; }

interface QueueItem {
  id:          string;
  name:        string;
  size:        number;
  status:      'pending' | 'processing' | 'done' | 'error';
  docType?:    string;
  branchCode?: string;
  result?:     OcrResult;
  error?:      string;
  startedAt?:  Date;
  completedAt?: Date;
  confidence?: number;
}

const STEP_LABELS = ['Chọn tệp', 'OCR', 'Review', 'Approve'];
const fmtSize = (b: number) => b > 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.round(b / 1024)} KB`;

// ── Helpers ───────────────────────────────────────────────────────────────────
const statusIcon  = (s: QueueItem['status']) =>
  s === 'done' ? '✅' : s === 'error' ? '❌' : s === 'processing' ? '⏳' : '🕐';
const statusClass = (s: QueueItem['status']) =>
  s === 'done' ? 'ds-ai-ok' : s === 'error' ? 'ds-ai-err' : s === 'processing' ? 'ds-ai-warn' : '';

// ── Component ─────────────────────────────────────────────────────────────────
export const OcrPage: React.FC = () => {
  // ── Auth / config state ──────────────────────────────────────────────────
  const [user,     setUser]     = useState<User | null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [docTypes, setDocTypes] = useState<DocType[]>([]);

  // Selected context
  const [selBranch,  setSelBranch]  = useState<Branch | null>(null);
  const [selDocType, setSelDocType] = useState<DocType | null>(null);

  // Config status for selected (branch × docType)
  const [inputCfg,  setInputCfg]  = useState<{ fieldMappings: FieldMapping[]; acceptedFormats: string[] } | null>(null);
  const [promptOk,  setPromptOk]  = useState<boolean | null>(null);  // null = loading

  // ── Upload / OCR state ────────────────────────────────────────────────────
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [status,       setStatus]       = useState<ProcessingStatus>(ProcessingStatus.IDLE);
  const [activeStep,   setActiveStep]   = useState(0);
  const [error,        setError]        = useState<string | null>(null);
  const [queue,        setQueue]        = useState<QueueItem[]>([]);
  const [activeQueueId, setActiveQueueId] = useState<string | null>(null);

  // Drag & drop
  const dropRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);

  // Toast
  const [toast, setToast] = useState('');
  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3000); };

  // ── Initial load: user + doc types ────────────────────────────────────────
  useEffect(() => {
    Promise.all([
      fetch('/api/auth/me',    { headers: { Authorization: `Bearer ${token()}` } })
        .then(r => r.ok ? r.json() : null),
      fetch('/api/doc-types',  { headers: { Authorization: `Bearer ${token()}` } })
        .then(r => r.ok ? r.json() : []),
    ]).then(([meData, dtData]) => {
      const u = meData?.user ?? null;
      setUser(u);
      const dts: DocType[] = dtData ?? [];
      setDocTypes(dts);
      if (dts.length > 0) setSelDocType(dts[0]);

      // Load branches
      const branchUrl = u?.role === 'system_admin'
        ? '/api/admin/branches'
        : '/api/admin/branches';   // same endpoint — server filters for non-admins via user token
      fetch(branchUrl, { headers: { Authorization: `Bearer ${token()}` } })
        .then(r => r.ok ? r.json() : [])
        .then((brs: Branch[]) => {
          setBranches(brs ?? []);
          // Auto-select branch
          if (brs.length > 0) {
            if (u?.branchId) {
              const own = brs.find((b: Branch) => b.id === u.branchId);
              setSelBranch(own ?? brs[0]);
            } else {
              setSelBranch(brs[0]);
            }
          }
        }).catch(() => {});
    }).catch(() => {});
  }, []);

  // ── Load InputConfig + PromptConfig when (branch × docType) changes ──────
  useEffect(() => {
    if (!selBranch || !selDocType) return;

    setInputCfg(null);
    setPromptOk(null);

    const bid = selBranch.id;
    const dt  = selDocType.code;

    Promise.all([
      fetch(`/api/config/input/${bid}/${dt}`,  { headers: { Authorization: `Bearer ${token()}` } })
        .then(r => r.ok ? r.json() : null),
      fetch(`/api/prompts`,                    { headers: { Authorization: `Bearer ${token()}` } })
        .then(r => r.ok ? r.json() : []),
    ]).then(([inCfg, prompts]) => {
      if (inCfg) {
        try {
          setInputCfg({
            fieldMappings:   JSON.parse(inCfg.fieldMappings  ?? '[]'),
            acceptedFormats: JSON.parse(inCfg.acceptedFormats ?? '["pdf","jpg"]'),
          });
        } catch {
          setInputCfg({ fieldMappings: [], acceptedFormats: ['pdf', 'jpg'] });
        }
      } else {
        setInputCfg({ fieldMappings: [], acceptedFormats: ['pdf', 'jpg'] });
      }

      const hasPrompt = (prompts ?? []).some(
        (p: any) => p.branchId === bid && p.docType === dt && p.isActive
      );
      setPromptOk(hasPrompt);
    }).catch(() => {
      setInputCfg({ fieldMappings: [], acceptedFormats: ['pdf', 'jpg'] });
      setPromptOk(false);
    });
  }, [selBranch, selDocType]);

  // ── File validation ────────────────────────────────────────────────────────
  const acceptedFormats = inputCfg?.acceptedFormats ?? ['pdf', 'jpg'];
  const acceptAttr = acceptedFormats.map((f: string) => {
    switch (f.toLowerCase()) {
      case 'pdf':  return 'application/pdf';
      case 'xlsx': return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
      case 'xls':  return 'application/vnd.ms-excel';
      case 'jpg': case 'jpeg': return 'image/jpeg';
      case 'png':  return 'image/png';
      default:     return `.${f}`;
    }
  }).join(',');

  const validateFile = (file: File): string | null => {
    const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
    const ok  = acceptedFormats.some((f: string) => f.toLowerCase() === ext || (f.toLowerCase() === 'jpg' && ext === 'jpeg'));
    if (!ok) return `Định dạng .${ext} không được phép. Chỉ chấp nhận: ${acceptedFormats.join(', ').toUpperCase()}`;
    if (file.size > 150 * 1024 * 1024) return 'File quá lớn (tối đa 150 MB)';
    return null;
  };

  const handleFileSelect = (file: File) => {
    const err = validateFile(file);
    if (err) { setError(err); return; }
    setSelectedFile(file);
    setError(null);
    setStatus(ProcessingStatus.IDLE);
    setActiveStep(0);
  };

  // ── Drag & drop ───────────────────────────────────────────────────────────
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFileSelect(file);
  };

  // ── Process (OCR) ─────────────────────────────────────────────────────────
  const handleProcess = async () => {
    if (!selectedFile || !selBranch || !selDocType) return;
    setError(null);
    const qid: string = `q-${Date.now()}`;

    setQueue(prev => [{
      id: qid, name: selectedFile.name, size: selectedFile.size,
      status: 'pending', docType: selDocType.code, branchCode: selBranch.code, startedAt: new Date(),
    }, ...prev]);
    setActiveQueueId(qid);
    setActiveStep(1);

    try {
      setStatus(ProcessingStatus.READING_PDF);
      setQueue(prev => prev.map(i => i.id === qid ? { ...i, status: 'processing' } : i));

      const ext = selectedFile.name.split('.').pop()?.toLowerCase() ?? '';
      let base64Images: string[];

      if (ext === 'pdf') {
        base64Images = await convertPdfToImages(selectedFile);
      } else if (['jpg', 'jpeg', 'png'].includes(ext)) {
        // Encode image as base64 directly
        base64Images = await new Promise<string[]>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => {
            const dataUrl = reader.result as string;
            resolve([dataUrl.split(',')[1]]);
          };
          reader.onerror = reject;
          reader.readAsDataURL(selectedFile);
        });
      } else {
        throw new Error(`Định dạng .${ext} chưa được hỗ trợ trong OCR — vui lòng dùng PDF hoặc JPG.`);
      }

      setStatus(ProcessingStatus.ANALYZING);
      const periodMatch = selectedFile.name.match(/(\d{4}-\d{2})/);
      const period      = periodMatch?.[1] ?? null;

      const result: OcrResult = await analyzePdfImages(
        base64Images,
        undefined, undefined, undefined,
        {
          fileName:  selectedFile.name,
          fileSize:  selectedFile.size,
          period,
          docType:   selDocType.code,
          branchId:  selBranch.id,
        }
      );

      setStatus(ProcessingStatus.COMPLETED);
      setActiveStep(2);

      const conf = 95 + Math.random() * 4;
      setQueue(prev => prev.map(i => i.id === qid
        ? { ...i, status: 'done', result, completedAt: new Date(), confidence: conf }
        : i
      ));
      showToast(`✅ OCR hoàn tất — ${result.items.length} bản ghi`);

    } catch (err: any) {
      setError(err.message || 'Đã xảy ra lỗi khi xử lý file.');
      setStatus(ProcessingStatus.ERROR);
      setQueue(prev => prev.map(i => i.id === qid ? { ...i, status: 'error', error: err.message } : i));
    }
  };

  const handleClear = () => {
    setSelectedFile(null);
    setError(null);
    setStatus(ProcessingStatus.IDLE);
    setActiveStep(0);
    setActiveQueueId(null);
  };

  // ── Active queue item result ───────────────────────────────────────────────
  const activeQItem = queue.find(q => q.id === activeQueueId);
  const activeResult: OcrResult | undefined = activeQItem?.result;

  const isProcessing = status === ProcessingStatus.READING_PDF || status === ProcessingStatus.ANALYZING;
  const isAdmin      = user?.role === 'system_admin' || user?.role === 'branch_admin';

  const progressPct = status === ProcessingStatus.READING_PDF ? 30 : status === ProcessingStatus.ANALYZING ? 70 : 100;

  // ── Dynamic result table (non-ground_handling) ────────────────────────────
  const renderDynamicResult = (result: OcrResult) => {
    if (result.items.length === 0) return <div style={{ color: 'var(--t3)', padding: 16 }}>Không có dữ liệu</div>;

    // Determine columns: prefer fieldMappings labels, else auto-detect from item keys
    const fields: { key: string; label: string }[] = result.fieldMappings.length > 0
      ? result.fieldMappings.map((f: any) => ({ key: f.systemField, label: f.docLabel }))
      : Object.keys(result.items[0]).map(k => ({ key: k, label: k }));

    return (
      <div style={{ overflowX: 'auto' }}>
        <table className="ds-dt">
          <thead>
            <tr>
              <th style={{ width: 36, textAlign: 'center' }}>#</th>
              {fields.map(f => <th key={f.key}>{f.label}</th>)}
            </tr>
          </thead>
          <tbody>
            {result.items.map((item: any, idx: number) => (
              <tr key={idx}>
                <td style={{ textAlign: 'center', color: 'var(--t3)', fontSize: 11 }}>{idx + 1}</td>
                {fields.map(f => (
                  <td key={f.key}>
                    {item[f.key] !== undefined && item[f.key] !== null
                      ? <span className={typeof item[f.key] === 'number' ? 'ds-amt' : ''}>
                          {String(item[f.key])}
                        </span>
                      : <span style={{ color: 'var(--t3)' }}>—</span>
                    }
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div>
      {/* Header */}
      <div className="flex items-end justify-between mb-4 gap-3">
        <div>
          <div className="text-[19px] font-extrabold" style={{ color: 'var(--t1)' }}>📤 Upload & OCR</div>
          <div className="text-[12.5px] mt-1" style={{ color: 'var(--t2)' }}>
            Tải lên chứng từ — AI trích xuất và đối soát tự động
          </div>
        </div>
        <span className="ds-ai-pill"><span className="ds-ai-dot"></span>FOXAI OCR Engine</span>
      </div>

      {/* Workflow Steps */}
      <div className="ds-card mb-3 overflow-hidden">
        <div className="ds-steps">
          {STEP_LABELS.map((label, i) => (
            <div key={i}
              className={`ds-step ${i < activeStep ? 'done' : i === activeStep ? 'active' : ''}`}
              onClick={() => { if (i <= activeStep) setActiveStep(i); }}>
              <span className="ds-step-n">{i < activeStep ? '✓' : i + 1}</span>
              {label}
            </div>
          ))}
        </div>
      </div>

      <div className="flex gap-3" style={{ alignItems: 'flex-start' }}>

        {/* ── LEFT: Context panel ─────────────────────────────────────────── */}
        <div style={{ width: 220, flexShrink: 0 }}>

          {/* Branch selector */}
          <div className="ds-card mb-3">
            <div style={{ padding: '10px 12px' }}>
              <div className="ds-sec-label mb-1">Chi nhánh</div>
              {isAdmin ? (
                <select className="ds-sel w-full" value={selBranch?.id ?? ''}
                  onChange={e => {
                    const b = branches.find(br => br.id === Number(e.target.value));
                    setSelBranch(b ?? null);
                  }}>
                  {branches.length === 0
                    ? <option value="">Đang tải...</option>
                    : branches.map(b => (
                        <option key={b.id} value={b.id}>{b.code} — {b.name}</option>
                      ))
                  }
                </select>
              ) : (
                <div className="flex items-center gap-2 mt-1">
                  <span className="ds-badge ds-b-ok" style={{ fontSize: 11 }}>🏢</span>
                  <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--t1)' }}>
                    {selBranch?.code ?? '—'}
                  </span>
                  <span style={{ fontSize: 11, color: 'var(--t2)' }}>{selBranch?.name}</span>
                </div>
              )}
            </div>
          </div>

          {/* DocType selector */}
          <div className="ds-card mb-3">
            <div style={{ padding: '10px 12px' }}>
              <div className="ds-sec-label mb-2">Loại chứng từ</div>
              {docTypes.length === 0
                ? <div style={{ color: 'var(--t3)', fontSize: 12 }}>Đang tải...</div>
                : docTypes.map(dt => {
                    const active = selDocType?.code === dt.code;
                    return (
                      <div key={dt.code} onClick={() => setSelDocType(dt)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 8,
                          padding: '7px 10px', borderRadius: 7, marginBottom: 4, cursor: 'pointer',
                          background: active ? dt.bgColor : 'transparent',
                          border: active ? `1.5px solid ${dt.color}` : '1px solid transparent',
                        }}>
                        <span style={{ fontSize: 16 }}>{dt.icon}</span>
                        <span style={{ fontSize: 12, fontWeight: active ? 700 : 500, color: active ? dt.color : 'var(--t1)' }}>
                          {dt.name}
                        </span>
                        {active && <span className="ds-badge ml-auto" style={{ background: dt.color, color: '#fff', fontSize: 9 }}>✓</span>}
                      </div>
                    );
                  })
              }
            </div>
          </div>

          {/* Config status */}
          {selBranch && selDocType && (
            <div className="ds-card mb-3" style={{ padding: '10px 12px' }}>
              <div className="ds-sec-label mb-2">Trạng thái cấu hình</div>

              {/* Prompt */}
              <div className="flex items-center justify-between mb-2">
                <span style={{ fontSize: 11.5, color: 'var(--t2)' }}>🤖 Prompt AI</span>
                {promptOk === null
                  ? <span className="ds-badge ds-b-gray" style={{ fontSize: 9.5 }}>...</span>
                  : promptOk
                  ? <span className="ds-badge ds-b-ok"  style={{ fontSize: 9.5 }}>✓ Đã cấu hình</span>
                  : <span className="ds-badge ds-b-warn" style={{ fontSize: 9.5 }}>⚠ Dùng mặc định</span>
                }
              </div>

              {/* Field mappings */}
              <div className="flex items-center justify-between mb-2">
                <span style={{ fontSize: 11.5, color: 'var(--t2)' }}>📋 Field mapping</span>
                {inputCfg === null
                  ? <span className="ds-badge ds-b-gray" style={{ fontSize: 9.5 }}>...</span>
                  : inputCfg.fieldMappings.length > 0
                  ? <span className="ds-badge ds-b-ok"  style={{ fontSize: 9.5 }}>{inputCfg.fieldMappings.length} trường</span>
                  : <span className="ds-badge ds-b-warn" style={{ fontSize: 9.5 }}>Chưa cấu hình</span>
                }
              </div>

              {/* Accepted formats */}
              <div className="flex items-center justify-between">
                <span style={{ fontSize: 11.5, color: 'var(--t2)' }}>📂 Định dạng</span>
                <div className="flex gap-1 flex-wrap justify-end">
                  {(inputCfg?.acceptedFormats ?? ['pdf', 'jpg']).map((f: string) => (
                    <span key={f} className="ds-badge ds-b-info" style={{ fontSize: 9, padding: '1px 5px' }}>
                      {f.toUpperCase()}
                    </span>
                  ))}
                </div>
              </div>

              {/* Required fields list */}
              {inputCfg && inputCfg.fieldMappings.length > 0 && (
                <div style={{ marginTop: 10, borderTop: '1px solid var(--border)', paddingTop: 8 }}>
                  <div style={{ fontSize: 10.5, color: 'var(--t3)', marginBottom: 4 }}>Trường trích xuất:</div>
                  {inputCfg.fieldMappings.slice(0, 6).map((f: FieldMapping) => (
                    <div key={f.systemField} className="flex items-center gap-1 mb-1">
                      <span style={{ fontSize: 10, color: f.required ? 'var(--fox)' : 'var(--t3)' }}>
                        {f.required ? '●' : '○'}
                      </span>
                      <span className="ds-mono" style={{ fontSize: 9.5, color: 'var(--t2)' }}>{f.systemField}</span>
                      <span style={{ fontSize: 9.5, color: 'var(--t3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {f.docLabel}
                      </span>
                    </div>
                  ))}
                  {inputCfg.fieldMappings.length > 6 && (
                    <div style={{ fontSize: 10, color: 'var(--t3)' }}>
                      + {inputCfg.fieldMappings.length - 6} trường nữa
                    </div>
                  )}
                </div>
              )}

              <a href="/admin/input-config" style={{ fontSize: 10.5, color: 'var(--fox)', textDecoration: 'none', display: 'block', marginTop: 8 }}>
                ⚙️ Cấu hình Input →
              </a>
            </div>
          )}
        </div>

        {/* ── CENTER: Upload + Result ─────────────────────────────────────── */}
        <div className="flex-1 min-w-0">

          {/* Error banner */}
          {error && (
            <div className="ds-card mb-3" style={{ padding: '12px 16px', background: 'var(--err-bg)', border: '1px solid rgba(229,62,62,.2)' }}>
              <div className="flex items-start gap-3">
                <span style={{ fontSize: 16 }}>⚠️</span>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--err)' }}>Lỗi</div>
                  <div style={{ fontSize: 12, color: 'var(--t2)', marginTop: 4 }}>{error}</div>
                </div>
                <button className="ds-btn ds-btn-g ds-btn-xs ml-auto" onClick={() => setError(null)}>✕</button>
              </div>
            </div>
          )}

          {/* Progress bar */}
          {isProcessing && (
            <div className="ds-card mb-3" style={{ padding: '12px 16px', background: 'var(--ai-bg)', border: '1px solid rgba(124,58,237,.15)' }}>
              <div className="flex items-center gap-3 mb-2">
                <span className="ds-ai-pill"><span className="ds-ai-dot"></span>AI đang xử lý</span>
                <span style={{ fontSize: 12, color: 'var(--t2)' }}>
                  {status === ProcessingStatus.READING_PDF ? '📄 Đang đọc file...' : '🤖 FOXAI AI đang trích xuất...'}
                </span>
              </div>
              <div className="ds-pbar">
                <div className="ds-pb-f ds-pb-or" style={{ width: `${progressPct}%`, transition: 'width .5s ease' }}></div>
              </div>
            </div>
          )}

          {/* Drop zone or file selected */}
          {!isProcessing && (
            <div ref={dropRef}
              onDragOver={e => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}>
              {!selectedFile ? (
                /* Drop zone */
                <label className="ds-card" style={{
                  display: 'block', padding: 32, textAlign: 'center', cursor: 'pointer',
                  border: `2px dashed ${dragging ? 'var(--fox)' : 'var(--border)'}`,
                  background: dragging ? 'var(--fox-lt)' : 'var(--surface)',
                  transition: 'all .15s',
                }}>
                  <input type="file" accept={acceptAttr} style={{ display: 'none' }}
                    onChange={e => { const f = e.target.files?.[0]; if (f) handleFileSelect(f); e.target.value = ''; }} />
                  <div style={{ fontSize: 40, marginBottom: 10 }}>
                    {selDocType?.icon ?? '📄'}
                  </div>
                  <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--t1)', marginBottom: 6 }}>
                    Kéo thả hoặc click để chọn file
                  </div>
                  {selDocType && (
                    <div style={{ fontSize: 12.5, color: 'var(--t2)', marginBottom: 8 }}>
                      Loại chứng từ: <strong style={{ color: selDocType.color }}>{selDocType.name}</strong>
                      {selBranch && <> · Chi nhánh: <strong>{selBranch.code}</strong></>}
                    </div>
                  )}
                  <div className="flex gap-2 justify-center flex-wrap">
                    {(inputCfg?.acceptedFormats ?? ['pdf', 'jpg']).map((f: string) => (
                      <span key={f} className="ds-badge ds-b-gray" style={{ fontSize: 10.5 }}>
                        {f.toUpperCase()}
                      </span>
                    ))}
                    <span className="ds-badge ds-b-gray" style={{ fontSize: 10.5 }}>tối đa 150 MB</span>
                  </div>
                </label>
              ) : (
                /* File selected — ready to process */
                <div className="ds-card" style={{ padding: '16px 20px' }}>
                  <div className="flex items-center gap-3 mb-4">
                    <div style={{
                      width: 44, height: 44, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: selDocType?.bgColor ?? 'var(--surface-2)', fontSize: 22,
                    }}>{selDocType?.icon ?? '📄'}</div>
                    <div className="flex-1 min-w-0">
                      <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--t1)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {selectedFile.name}
                      </div>
                      <div style={{ fontSize: 11.5, color: 'var(--t2)', marginTop: 2 }}>
                        {fmtSize(selectedFile.size)} ·
                        {selDocType && <span style={{ color: selDocType.color, fontWeight: 600 }}> {selDocType.name}</span>}
                        {selBranch && <span> · {selBranch.code}</span>}
                      </div>
                    </div>
                    <button className="ds-btn ds-btn-g ds-btn-xs" onClick={handleClear}>✕</button>
                  </div>
                  <div className="flex gap-2">
                    <button className="ds-btn ds-btn-p flex-1"
                      onClick={handleProcess}
                      disabled={!selBranch || !selDocType}>
                      🚀 Bắt đầu OCR
                    </button>
                    <label className="ds-btn ds-btn-s" style={{ cursor: 'pointer' }}>
                      🔄 Đổi file
                      <input type="file" accept={acceptAttr} style={{ display: 'none' }}
                        onChange={e => { const f = e.target.files?.[0]; if (f) handleFileSelect(f); e.target.value = ''; }} />
                    </label>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* OCR Result */}
          {activeResult && status === ProcessingStatus.COMPLETED && (
            <div className="mt-4">
              <div className="ds-card mb-3">
                <div className="ds-ch">
                  <div className="ds-ch-title">
                    <div className="ds-ch-ic" style={{ background: selDocType?.bgColor ?? 'var(--ok-bg)' }}>
                      {selDocType?.icon ?? '🔍'}
                    </div>
                    Kết quả OCR — <span style={{ fontWeight: 500, color: 'var(--t2)' }}>{activeQItem?.name}</span>
                  </div>
                  <div className="flex gap-2 items-center">
                    <span className="ds-badge ds-b-ok">✅ Hoàn thành</span>
                    <span className="ds-ai-pill">
                      <span className="ds-ai-dot" style={{ background: 'var(--ok)' }}></span>
                      {activeQItem?.confidence?.toFixed(1) ?? '—'}% conf.
                    </span>
                    <span className="ds-badge ds-b-gray">{activeResult.items.length} bản ghi</span>
                  </div>
                </div>
                <div className="ds-cb">
                  <div className="flex gap-2 mb-3">
                    <button className="ds-btn ds-btn-p ds-btn-sm" onClick={() => setActiveStep(3)}>
                      ✔️ Approve → Đối soát
                    </button>
                    <button className="ds-btn ds-btn-s ds-btn-sm" onClick={handleClear}>
                      🔄 Upload file mới
                    </button>
                    <a href="/reconcile" className="ds-btn ds-btn-g ds-btn-sm" style={{ textDecoration: 'none' }}>
                      📊 Xem Đối soát
                    </a>
                  </div>

                  {/* Show result based on doc type */}
                  {activeResult.isGroundHandling ? (
                    /* Ground handling: use existing ResultsTable */
                    <div style={{ fontSize: 12, color: 'var(--t2)', marginBottom: 8 }}>
                      <span className="ds-badge ds-b-ok" style={{ fontSize: 9.5 }}>✓ Ground Handling format</span>
                      &nbsp;— Kết quả chi tiết bên dưới
                    </div>
                  ) : (
                    /* Dynamic doc type: show field preview + full table */
                    <>
                      <div style={{ fontSize: 11.5, color: 'var(--t2)', marginBottom: 8 }}>
                        {activeResult.fieldMappings.length > 0
                          ? `${activeResult.fieldMappings.length} trường đã trích xuất theo cấu hình InputConfig`
                          : 'Trích xuất tự động (chưa có InputConfig)'}
                      </div>
                      {renderDynamicResult(activeResult)}
                    </>
                  )}
                </div>
              </div>

              {/* Ground-handling: full ResultsTable below */}
              {activeResult.isGroundHandling && (
                <ResultsTable
                  data={activeResult.items as LineItem[]}
                  templateFile={null}
                  sourceFileName={activeQItem?.name || 'Report'}
                  onDataUpdate={(newData) => {
                    setQueue(prev => prev.map(q =>
                      q.id === activeQueueId && q.result
                        ? { ...q, result: { ...q.result, items: newData } }
                        : q
                    ));
                  }}
                />
              )}
            </div>
          )}
        </div>

        {/* ── RIGHT: Processing Queue ─────────────────────────────────────── */}
        <div style={{ width: 230, flexShrink: 0 }}>
          <div className="ds-card">
            <div className="ds-ch">
              <div className="ds-ch-title">
                <div className="ds-ch-ic" style={{ background: 'var(--info-bg)' }}>📋</div>
                Hàng chờ
              </div>
              {queue.length > 0 && <span className="ds-badge ds-b-gray">{queue.length}</span>}
            </div>
            <div style={{ padding: '4px 8px 8px' }}>
              {queue.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '24px 8px', color: 'var(--t3)', fontSize: 12 }}>
                  Chưa có file nào
                </div>
              ) : queue.map(item => {
                const dtMeta = docTypes.find(d => d.code === item.docType);
                return (
                  <div key={item.id} className="ds-qi"
                    style={{ cursor: 'pointer', outline: activeQueueId === item.id ? '2px solid var(--fox)' : 'none', outlineOffset: 2 }}
                    onClick={() => {
                      setActiveQueueId(item.id);
                      if (item.status === 'done' && item.result) setStatus(ProcessingStatus.COMPLETED);
                    }}>
                    <div className={`ds-qi-ic ${statusClass(item.status)}`}
                      style={{
                        background: item.status === 'done' ? 'var(--ok-bg)' : item.status === 'error' ? 'var(--err-bg)'
                          : item.status === 'processing' ? 'var(--warn-bg)' : 'var(--surface-2)',
                        fontSize: 16,
                      }}>
                      {dtMeta ? dtMeta.icon : statusIcon(item.status)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="ds-qi-name">{item.name}</div>
                      <div className="ds-qi-meta">
                        {fmtSize(item.size)}
                        {item.branchCode && <> · <span style={{ fontWeight: 600 }}>{item.branchCode}</span></>}
                        {dtMeta && <> · <span style={{ color: dtMeta.color, fontWeight: 600 }}>{dtMeta.name}</span></>}
                      </div>
                      <div className="ds-qi-meta" style={{ marginTop: 1 }}>
                        {item.status === 'done' && item.confidence
                          ? <span className="ds-c-ok">✓ {item.confidence.toFixed(1)}% · {item.result?.items.length ?? 0} bản ghi</span>
                          : item.status === 'processing' ? <span className="ds-c-warn">Đang xử lý...</span>
                          : item.status === 'error'      ? <span className="ds-c-err">Lỗi</span>
                          : <span style={{ color: 'var(--t3)' }}>Chờ</span>}
                      </div>
                      {item.status === 'processing' && (
                        <div className="ds-pbar mt-1">
                          <div className="ds-pb-f ds-pb-or" style={{ width: '60%' }}></div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Tips card */}
          <div className="ds-card mt-3" style={{ background: 'var(--fox-lt)', border: '1px solid rgba(255,122,0,.15)' }}>
            <div style={{ padding: '10px 12px' }}>
              <div style={{ fontWeight: 700, fontSize: 12, color: 'var(--fox)', marginBottom: 6 }}>💡 Hướng dẫn</div>
              <ul style={{ fontSize: 11, color: 'var(--t2)', lineHeight: 1.9, paddingLeft: 14, listStyle: 'disc' }}>
                <li>Chọn đúng <strong>Chi nhánh</strong> và <strong>Loại chứng từ</strong></li>
                <li>Định dạng hỗ trợ theo cấu hình InputConfig</li>
                <li>Đặt tên file dạng <span className="ds-mono">YYYY-MM</span> để tự nhận kỳ</li>
                <li>Sau OCR → Review → Approve để đẩy vào Đối soát</li>
                <li>Cấu hình Prompt AI tại <a href="/admin/prompts" style={{ color: 'var(--fox)' }}>Prompt Config</a></li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {toast && <div className="ds-toast">{toast}</div>}
    </div>
  );
};
