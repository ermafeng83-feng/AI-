import React from 'react';
import { Loader2 } from 'lucide-react';

interface LoadingOverlayProps {
  isLoading: boolean;
  message?: string;
}

export const LoadingOverlay: React.FC<LoadingOverlayProps> = ({ isLoading, message = "正在处理数据..." }) => {
  if (!isLoading) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/20 backdrop-blur-sm z-[100] flex items-center justify-center animate-fade-in">
      <div className="bg-white rounded-xl shadow-2xl p-8 flex flex-col items-center gap-4 border border-slate-100 max-w-sm w-full mx-4">
        <div className="relative">
          <div className="w-12 h-12 rounded-full border-4 border-slate-100 border-t-blue-600 animate-spin"></div>
          <div className="absolute inset-0 flex items-center justify-center">
             <div className="w-2 h-2 bg-blue-600 rounded-full animate-pulse"></div>
          </div>
        </div>
        <div className="text-center">
          <h3 className="text-lg font-bold text-slate-800">处理中</h3>
          <p className="text-slate-500 text-sm mt-1">{message}</p>
        </div>
      </div>
    </div>
  );
};