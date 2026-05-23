import React, { useState } from 'react';
import { AlertCircle } from 'lucide-react';
import FileUpload from '../components/FileUpload';
import ResultsTable from '../components/ResultsTable';
import { LineItem, ProcessingStatus } from '../types';
import { convertPdfToImages } from '../utils';
import { analyzePdfImages } from '../services/geminiService';

interface Props { branchId?: number | null; }

export const OcrPage: React.FC<Props> = ({ branchId }) => {
  const [status, setStatus]       = useState<ProcessingStatus>(ProcessingStatus.IDLE);
  const [data, setData]           = useState<LineItem[] | null>(null);
  const [error, setError]         = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [templateFile, setTemplateFile] = useState<File | null>(null);

  const handleFileSelect = (file: File) => {
    setSelectedFile(file);
    setData(null);
    setError(null);
    setStatus(ProcessingStatus.IDLE);
  };

  const handleProcess = async () => {
    if (!selectedFile) return;
    setError(null);
    setData(null);

    try {
      setStatus(ProcessingStatus.READING_PDF);
      const images = await convertPdfToImages(selectedFile);

      setStatus(ProcessingStatus.ANALYZING);

      // Lấy period từ tên file nếu có (VD: "CV2006_2025-04.pdf")
      const periodMatch = selectedFile.name.match(/(\d{4}-\d{2})/);
      const period = periodMatch?.[1] ?? null;

      const result = await analyzePdfImages(
        images,
        '',          // systemPrompt lấy từ branch settings trên server
        undefined,   // deprecated apiKey
        '',          // model lấy từ branch settings trên server
        { fileName: selectedFile.name, fileSize: selectedFile.size, period }
      );

      setData(result);
      setStatus(ProcessingStatus.COMPLETED);
    } catch (err: any) {
      setError(err.message || 'Đã xảy ra lỗi khi xử lý file.');
      setStatus(ProcessingStatus.ERROR);
    }
  };

  const getStatusMessage = () => {
    switch (status) {
      case ProcessingStatus.READING_PDF: return 'Đang đọc PDF...';
      case ProcessingStatus.ANALYZING:   return 'FOXAI Native đang trích xuất dữ liệu...';
      case ProcessingStatus.COMPLETED:   return 'Phân tích hoàn tất';
      default: return '';
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-20">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-slate-800">OCR Processing</h1>
        <p className="text-sm text-slate-500 mt-1">Tải lên file PDF hóa đơn để trích xuất dữ liệu CV2006 tự động.</p>
      </div>

      {error && (
        <div className="mb-6 bg-red-50 border-l-4 border-red-500 p-4 rounded-r-lg flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-red-800 font-semibold text-sm">Xử lý thất bại</p>
            <p className="text-red-700 text-sm mt-1">{error}</p>
          </div>
        </div>
      )}

      <FileUpload
        onFileSelect={handleFileSelect}
        selectedFile={selectedFile}
        onProcess={handleProcess}
        onClear={() => { setSelectedFile(null); setData(null); setError(null); setStatus(ProcessingStatus.IDLE); }}
        isProcessing={status === ProcessingStatus.READING_PDF || status === ProcessingStatus.ANALYZING}
        statusMessage={getStatusMessage()}
      />

      {data && status === ProcessingStatus.COMPLETED && (
        <div className="mt-8 animate-fade-in-up">
          <ResultsTable
            data={data}
            templateFile={templateFile}
            sourceFileName={selectedFile?.name || 'Report'}
            onDataUpdate={setData}
          />
        </div>
      )}
    </div>
  );
};
