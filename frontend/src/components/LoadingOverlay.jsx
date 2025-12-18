import React from 'react';

const LoadingOverlay = ({ visible, message = "处理中..." }) => {
  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-white bg-opacity-90 backdrop-blur-sm transition-opacity duration-300">
      <div className="relative">
        {/* Outer Ring */}
        <div className="w-24 h-24 rounded-full border-4 border-slate-100"></div>
        {/* Inner Spinner */}
        <div className="absolute top-0 left-0 w-24 h-24 rounded-full border-4 border-t-serene border-r-transparent border-b-transparent border-l-transparent animate-spin"></div>
        {/* Icon */}
        <div className="absolute top-0 left-0 w-24 h-24 flex items-center justify-center">
            <div className="w-3 h-3 bg-serene rounded-full animate-pulse"></div>
        </div>
      </div>
      
      <div className="mt-8 text-center space-y-2">
        <h3 className="text-xl font-bold text-charcoal tracking-wide animate-pulse">{message}</h3>
        <p className="text-slate-500 text-sm">AI 正在全力运算，请稍候片刻</p>
      </div>
    </div>
  );
};

export default LoadingOverlay;
