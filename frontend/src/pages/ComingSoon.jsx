import React from 'react';
import { useNavigate } from 'react-router-dom';
import PageLayout from '../components/PageLayout';
import { Helmet } from 'react-helmet-async';
import { Rocket, ArrowLeft, Star } from 'lucide-react';

const ComingSoon = () => {
  const navigate = useNavigate();

  return (
    <PageLayout className="h-screen overflow-hidden bg-gradient-to-br from-slate-50 to-slate-100">
      <Helmet>
        <title>敬请期待 - 智能测评系统</title>
        <meta name="robots" content="noindex" />
      </Helmet>
      
      <div className="flex flex-col items-center justify-center min-h-full px-4 text-center">
        {/* Animated Icon Container */}
        <div className="relative mb-10 animate-float">
          <div className="absolute inset-0 bg-[#00acc1] blur-[40px] opacity-20 rounded-full animate-pulse-slow"></div>
          <div className="relative bg-white p-8 rounded-[32px] shadow-[0_20px_50px_rgba(0,131,143,0.15)]">
            <Rocket className="w-20 h-20 text-[#00838f]" />
            <Star className="absolute -top-2 -right-2 w-8 h-8 text-[#ffd740] animate-spin-slow fill-[#ffd740]" />
            <Star className="absolute bottom-2 -left-4 w-6 h-6 text-[#ffab40] animate-bounce fill-[#ffab40]" style={{ animationDelay: '0.5s' }} />
          </div>
        </div>

        {/* Text Content */}
        <h1 className="text-4xl md:text-5xl font-extrabold text-slate-800 mb-6 tracking-tight">
          即将<span className="text-[#00838f]">上线</span>
        </h1>
        
        <p className="text-lg md:text-xl text-slate-600 mb-8 max-w-lg leading-relaxed">
          该科目测评功能正在紧锣密鼓地开发中。
          <br />
          我们将为您带来更精准的智能分析体验。
        </p>

        {/* Feature Preview Pills */}
        <div className="flex flex-wrap justify-center gap-3 mb-10">
          {['专属题库', 'AI 深度解析', '备考路径规划'].map((feature, i) => (
            <span 
              key={i}
              className="px-4 py-2 bg-white rounded-full text-sm font-medium text-[#00838f] shadow-sm border border-[#00838f]/10"
            >
              {feature}
            </span>
          ))}
        </div>

        {/* Back Button */}
        <button
          onClick={() => navigate('/')}
          className="group flex items-center gap-2 px-8 py-3 bg-slate-800 text-white rounded-full hover:bg-[#00838f] transition-all duration-300 shadow-lg hover:shadow-xl hover:-translate-y-1"
        >
          <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
          <span>返回首页</span>
        </button>

        {/* Decorative Elements */}
        <div className="fixed top-20 left-10 w-4 h-4 rounded-full bg-[#26c6da] opacity-20 animate-ping"></div>
        <div className="fixed bottom-20 right-10 w-6 h-6 rounded-full bg-[#ffab40] opacity-20 animate-pulse"></div>
      </div>
    </PageLayout>
  );
};

export default ComingSoon;
