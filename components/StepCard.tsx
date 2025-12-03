import React from 'react';
import { Check, Circle } from 'lucide-react';

interface StepCardProps {
  title: string;
  stepNumber: number;
  isActive: boolean;
  isCompleted: boolean;
  children: React.ReactNode;
  statusBadge?: React.ReactNode;
}

export const StepCard: React.FC<StepCardProps> = ({ 
  title, 
  stepNumber, 
  isActive, 
  isCompleted, 
  children,
  statusBadge 
}) => {
  return (
    <div 
      id={`step-${stepNumber}`}
      className={`
        relative transition-all duration-500 rounded-xl border
        ${isActive 
          ? 'bg-white border-blue-500/30 shadow-xl shadow-blue-500/5 ring-1 ring-blue-500/20 translate-y-0 opacity-100 z-10' 
          : isCompleted 
            ? 'bg-white border-emerald-500/30 shadow-sm opacity-90' 
            : 'bg-slate-50 border-slate-200 opacity-60 pointer-events-none grayscale-[0.3]'
        }
      `}
    >
      {/* Decorative gradient for active state */}
      {isActive && (
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-t-xl" />
      )}
      
      <div className="p-6">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-4">
             <div className={`
                w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shadow-sm transition-colors
                ${isCompleted ? 'bg-emerald-100 text-emerald-600' : isActive ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-500'}
             `}>
                {isCompleted ? <Check size={20} strokeWidth={3} /> : <span>{stepNumber}</span>}
             </div>
             <div>
               <h2 className={`text-lg font-bold tracking-tight ${isActive ? 'text-slate-800' : isCompleted ? 'text-slate-700' : 'text-slate-500'}`}>
                 {title}
               </h2>
               {isActive && <p className="text-xs text-blue-500 font-medium mt-0.5">当前步骤</p>}
             </div>
          </div>
          {statusBadge}
        </div>
        
        <div className={`transition-all duration-500 ease-in-out ${isActive ? 'block opacity-100 translate-y-0' : 'hidden opacity-0 -translate-y-2'}`}>
          {children}
        </div>
        
        {!isActive && isCompleted && (
           <div className="text-sm text-slate-500 italic pl-14 border-l-2 border-emerald-100 py-1">
             <span className="text-emerald-600 font-medium">✓ 已完成</span>
           </div>
        )}
      </div>
    </div>
  );
};