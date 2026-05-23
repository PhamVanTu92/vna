import React, { ChangeEvent } from 'react';
import { UploadCloud, FileText, Loader2, Play, X, FileCheck } from 'lucide-react';

interface FileUploadProps {
  onFileSelect: (file: File) => void;
  selectedFile: File | null;
  onProcess: () => void;
  onClear: () => void;
  isProcessing: boolean;
  statusMessage: string;
}

const FileUpload: React.FC<FileUploadProps> = ({ 
  onFileSelect, 
  selectedFile, 
  onProcess, 
  onClear, 
  isProcessing, 
  statusMessage 
}) => {
  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      onFileSelect(e.target.files[0]);
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto mb-8">
      {/* 
        Condition 1: Processing State 
        Shows loader and status message
      */}
      {isProcessing && (
        <div className="relative border-2 border-indigo-300 bg-indigo-50 rounded-xl p-8 flex flex-col items-center justify-center text-center transition-colors">
          <Loader2 className="w-12 h-12 text-indigo-600 animate-spin mb-4" />
          <p className="text-lg font-medium text-indigo-700">{statusMessage}</p>
          <p className="text-sm text-indigo-500 mt-2">This usually takes 3-5 minutes</p>
        </div>
      )}

      {/* 
        Condition 2: File Selected (Ready to Process)
        Shows file name and Process button
      */}
      {!isProcessing && selectedFile && (
        <div className="bg-white border-2 border-indigo-500 rounded-xl p-6 shadow-md animate-fade-in">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="bg-indigo-100 p-3 rounded-lg">
                 <FileCheck className="w-6 h-6 text-indigo-700" />
              </div>
              <div>
                <p className="text-xs text-slate-500 uppercase font-semibold tracking-wider">Selected File</p>
                <h3 className="text-lg font-bold text-slate-800 truncate max-w-[250px] sm:max-w-md">
                  {selectedFile.name}
                </h3>
                <p className="text-xs text-slate-400">
                  {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                </p>
              </div>
            </div>
            <button 
              onClick={onClear}
              className="text-slate-400 hover:text-red-500 hover:bg-red-50 p-2 rounded-full transition-colors"
              title="Remove File"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex gap-3">
            <button
              onClick={onProcess}
              className="flex-1 flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-xl font-bold transition-all transform hover:scale-[1.02] shadow-sm"
            >
              <Play className="w-5 h-5 fill-current" />
              Process Invoice
            </button>
          </div>
        </div>
      )}

      {/* 
        Condition 3: Idle (No file selected)
        Shows dropzone
      */}
      {!isProcessing && !selectedFile && (
        <div className="relative border-2 border-dashed border-slate-300 hover:border-indigo-500 hover:bg-slate-50 rounded-xl p-8 transition-colors group">
          <input
            type="file"
            accept="application/pdf"
            onChange={handleFileChange}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          />
          
          <div className="flex flex-col items-center justify-center text-center pointer-events-none">
            <div className="bg-indigo-50 group-hover:bg-indigo-100 p-4 rounded-full mb-4 transition-colors">
              <UploadCloud className="w-8 h-8 text-indigo-600" />
            </div>
            <h3 className="text-xl font-semibold text-slate-900 mb-2">
              Upload Monthly Invoice PDF
            </h3>
            <p className="text-slate-500 mb-4 max-w-md">
              Drag and drop or click to select the "Hồ sơ thanh toán tháng".
              <br/>
              <span className="text-sm">You can review and process the file in the next step.</span>
            </p>
            <div className="flex items-center gap-2 text-xs text-slate-400 bg-slate-100 px-3 py-1 rounded-full">
              <FileText className="w-3 h-3" />
              <span>Supports multi-page PDFs</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FileUpload;