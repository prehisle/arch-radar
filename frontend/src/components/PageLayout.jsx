import React from 'react';
import clsx from 'clsx';

const PageLayout = ({ children, className }) => {
  return (
    <div className={clsx("relative min-h-screen w-full overflow-x-hidden", className)}>
      {/* Floating Background Elements */}
      <div className="fixed -top-[150px] -right-[150px] w-[500px] h-[500px] rounded-full bg-[radial-gradient(circle,rgba(255,255,255,0.4)_0%,transparent_70%)] animate-float pointer-events-none z-0"></div>
      <div className="fixed -bottom-[100px] -left-[100px] w-[400px] h-[400px] rounded-full bg-[radial-gradient(circle,rgba(255,255,255,0.3)_0%,transparent_70%)] animate-float-reverse pointer-events-none z-0"></div>
      
      {/* Content Container */}
      <div className="relative z-10 w-full max-w-[1200px] mx-auto px-[20px] py-[40px]">
        {children}
      </div>
    </div>
  );
};

export default PageLayout;
