import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { startExam } from '../api';
import LoadingOverlay from '../components/LoadingOverlay';
import PageLayout from '../components/PageLayout';
import { MessageCircle, X } from 'lucide-react';

const Home = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [showServiceModal, setShowServiceModal] = useState(false);

  const handleStart = async () => {
    setLoading(true);
    try {
      const data = await startExam();
      navigate(`/exam?sessionId=${data.session_id}`);
    } catch (e) {
      alert('Failed to start exam');
    } finally {
      setLoading(false);
    }
  };

  return (
    <PageLayout className="h-screen overflow-y-auto no-scrollbar">
      <div className="relative flex flex-col items-center justify-center min-h-full pt-4 pb-32 text-center w-full max-w-[1200px] mx-auto overflow-hidden">
        <LoadingOverlay visible={loading} message="正在智能组卷中..." />
        
        <div className="mb-6 md:mb-10 animate-fadeInDown w-full">
          <div className="inline-block bg-white/90 backdrop-blur-[10px] px-4 py-2 md:px-6 md:py-[10px] rounded-[24px] text-xs md:text-[14px] font-semibold text-[#00838f] border-2 border-[#00838f]/20 shadow-[0_4px_15px_rgba(0,131,143,0.15)] mb-4 tracking-[1px]">
            系统架构设计师 · 软考高级
          </div>
          <h1 className="text-3xl md:text-[52px] font-extrabold mb-4 md:mb-6 tracking-[2px] text-gradient filter drop-shadow-[2px_2px_4px_rgba(0,0,0,0.1)] leading-tight">
            AI 智能学习测评
          </h1>
          <p className="text-base md:text-[18px] text-[#00695c] font-medium tracking-[2px]">
            拒绝题海战术 · AI 助力精准通关
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-[30px] w-full mb-6 md:mb-10">
          <FeatureCard 
            icon={
              <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" className="w-[48px] h-[48px] fill-white">
                <path d="M19 2H5C3.9 2 3 2.9 3 4V20C3 21.1 3.9 22 5 22H19C20.1 22 21 21.1 21 20V4C21 2.9 20.1 2 19 2ZM19 20H5V4H19V20Z"/>
                <path d="M7 6H17V8H7V6Z"/>
                <path d="M7 10H17V12H7V10Z"/>
                <path d="M7 14H14V16H7V14Z"/>
              </svg>
            }
            title="真题实战"
            desc="告别死记硬背，AI 基于考纲权重动态组卷，每次测评都是一场真实的模拟考试。"
            delay="0.1s"
            color="linear-gradient(135deg, #00acc1 0%, #0097a7 100%)"
            shadow="rgba(0, 172, 193, 0.3)"
            hoverColor="#00acc1"
          />
          <FeatureCard 
            icon={
              <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" className="w-[48px] h-[48px] fill-white">
                <path d="M12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2ZM12 20C7.59 20 4 16.41 4 12C4 7.59 7.59 4 12 4C16.41 4 20 7.59 20 12C20 16.41 16.41 20 12 20Z"/>
                <path d="M16.59 7.58L10 14.17L7.41 11.59L6 13L10 17L18 9L16.59 7.58Z"/>
              </svg>
            }
            title="智能诊断"
            desc="不只是分数，AI 深度分析您的答题数据，精准定位知识盲区，生成专属能力画像。"
            delay="0.2s"
            color="linear-gradient(135deg, #26c6da 0%, #00acc1 100%)"
            shadow="rgba(38, 198, 218, 0.3)"
            hoverColor="#26c6da"
          />
          <FeatureCard 
            icon={
              <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" className="w-[48px] h-[48px] fill-white">
                <path d="M19 3H5C3.9 3 3 3.9 3 5V19C3 20.1 3.9 21 5 21H19C20.1 21 21 20.1 21 19V5C21 3.9 20.1 3 19 3ZM19 19H5V5H19V19Z"/>
                <path d="M7 12H9V17H7V12Z"/>
                <path d="M11 10H13V17H11V10Z"/>
                <path d="M15 7H17V17H15V7Z"/>
              </svg>
            }
            title="科学提分"
            desc="拒绝盲目刷题，基于测评结果，为您量身定制复习策略与提升建议，让备考事半功倍。"
            delay="0.3s"
            color="linear-gradient(135deg, #4dd0e1 0%, #26c6da 100%)"
            shadow="rgba(77, 208, 225, 0.3)"
            hoverColor="#4dd0e1"
          />
        </div>

        <div className="animate-fadeInUp" style={{ animationDelay: '0.4s', animationFillMode: 'both' }}>
          <button
            onClick={handleStart}
            disabled={loading}
            className="group relative px-8 md:px-[75px] py-[20px] text-[20px] font-bold text-white rounded-[50px] shadow-md transition-all duration-300 hover:-translate-y-[4px] hover:scale-105 hover:shadow-lg hover:pr-[85px] active:translate-y-[-2px] active:scale-[1.03] overflow-hidden disabled:opacity-50 disabled:cursor-not-allowed tracking-[1px]"
            style={{
                background: 'linear-gradient(135deg, #00acc1 0%, #0097a7 100%)'
            }}
          >
            {/* Hover shine effect */}
            <div className="absolute top-0 left-[-100%] w-full h-full bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.3),transparent)] transition-[left] duration-600 ease-out group-hover:left-[100%]"></div>
            
            <span className="relative z-10">开始测评</span>
            
            {/* Arrow icon */}
            <span className="absolute right-[30px] top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 group-hover:right-[35px] transition-all duration-300 text-[24px]">→</span>
          </button>
        </div>

        {/* Footer Info */}
        <div className="fixed bottom-0 left-0 right-0 py-4 bg-white/5 backdrop-blur-[2px] text-center text-[#546e7a] text-xs md:text-sm animate-fadeInUp z-10" style={{ animationDelay: '0.6s' }}>
          <div className="flex flex-col md:flex-row items-center justify-center space-y-1 md:space-y-0 md:space-x-4 px-4">
            <span>© 2025 <a href="https://www.yuejxt.cn/" target="_blank" rel="noopener noreferrer" className="hover:text-[#00838f] transition-colors">跃界星图</a>. 保留所有权利.</span>
            <span className="hidden md:inline">|</span>
            <a href="https://beian.miit.gov.cn/" target="_blank" rel="noopener noreferrer" className="hover:text-[#00838f] transition-colors">
              湘ICP备2025122944号
            </a>
            <span className="hidden md:inline">|</span>
            <span>增值电信业务经营许可证：湘B2-20251020</span>
          </div>
        </div>

        {/* Customer Service Floating Button */}
        <button 
          onClick={() => setShowServiceModal(true)}
          className="fixed bottom-28 right-6 md:bottom-24 md:right-10 w-14 h-14 bg-white rounded-full shadow-[0_4px_20px_rgba(0,131,143,0.25)] flex items-center justify-center text-[#00838f] hover:scale-110 hover:shadow-[0_8px_30px_rgba(0,131,143,0.35)] transition-all duration-300 z-50 group"
          title="联系客服"
        >
          <MessageCircle className="w-7 h-7 group-hover:rotate-12 transition-transform" />
          <span className="absolute -top-2 -right-2 w-4 h-4 bg-red-500 rounded-full animate-ping opacity-75"></span>
          <span className="absolute -top-2 -right-2 w-4 h-4 bg-red-500 rounded-full border-2 border-white"></span>
        </button>

        {/* Service Modal */}
        {showServiceModal && (
          <div className="fixed inset-0 bg-[#006064]/30 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setShowServiceModal(false)}>
            <div className="glass-card p-8 rounded-2xl max-w-sm w-full text-center animate-fadeInUp" onClick={e => e.stopPropagation()}>
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold text-[#00695c]">联系客服</h3>
                <button onClick={() => setShowServiceModal(false)} className="text-[#546e7a] hover:text-[#00838f] transition-colors">
                  <X className="w-6 h-6" />
                </button>
              </div>
              <div className="bg-white p-4 rounded-xl border border-[#b2ebf2] shadow-inner mb-4 inline-block">
                <img src="/images/customer_service.png" alt="客服二维码" className="w-48 h-48 object-contain" />
              </div>
              <p className="text-[#546e7a] text-sm">扫码添加企业微信客服<br/>获取更多备考资料</p>
            </div>
          </div>
        )}
      </div>
    </PageLayout>
  );
};

const FeatureCard = ({ icon, title, desc, delay, color, shadow, hoverColor }) => (
  <div 
    className="glass-card p-[45px_35px] rounded-[24px] flex flex-col items-center text-center transition-all duration-700 ease-in-out group relative overflow-hidden animate-fadeInUp hover:-translate-y-[12px] hover:shadow-[0_20px_50px_rgba(0,172,193,0.25)] hover:border-[#00acc1]/30"
    style={{ animationDelay: delay }}
  >
    {/* Top border gradient on hover */}
    <div 
        className="absolute top-0 left-0 right-0 h-[4px] origin-left scale-x-0 group-hover:scale-x-100 transition-transform duration-700 ease-in-out"
        style={{ background: 'linear-gradient(90deg, #00acc1, #26c6da, #4dd0e1)' }}
    ></div>

    <div 
      className="w-[90px] h-[90px] mb-[28px] rounded-[22px] flex items-center justify-center transition-transform duration-700 ease-in-out group-hover:scale-110 group-hover:[transform:scale(1.1)_rotateY(360deg)]"
      style={{ 
          background: color,
          boxShadow: `0 10px 30px ${shadow}` 
      }}
    >
      {icon}
    </div>
    <h3 className="text-[24px] font-bold text-[#00695c] mb-[20px]">{title}</h3>
    <p className="text-[15px] leading-[1.9] text-[#546e7a]">{desc}</p>
  </div>
);

export default Home;