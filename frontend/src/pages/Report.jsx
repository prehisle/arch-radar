import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getReport, getShareContent, downloadReportPDF, downloadReportYAML } from '../api';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer 
} from 'recharts';
import { Share2, ArrowLeft, Trophy, AlertTriangle, TrendingUp, X, Copy, Download, CheckCircle, XCircle, List, ChevronUp, MessageSquare, FileText } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeKatex from 'rehype-katex';
import remarkMath from 'remark-math';
import rehypeRaw from 'rehype-raw';
import 'katex/dist/katex.min.css';
import clsx from 'clsx';
import PageLayout from '../components/PageLayout';
import { Helmet } from 'react-helmet-async';

const processContent = (text) => {
    if (!text) return "";
    let processed = text;
    // Escape special markdown characters that are standalone options (like "-", "*")
    if (/^[\-\*\+]$/.test(processed.trim())) {
        processed = '\\' + processed;
    }
    // Fix relative image paths
    processed = processed.replace(/\]\(images\//g, '](/images/');
    processed = processed.replace(/src="images\//g, 'src="/images/');

    // Fix tables: Ensure tables are surrounded by newlines
    // Look for a line that starts with | (header) followed by a line starting with | and containing --- (separator)
    // Ensure there are two newlines before the header
    processed = processed.replace(/(^|[^\n])\n(\s*\|.*?\|\s*)\n(\s*\|[\s\-:|]+\|\s*)(?=\n|$)/g, '$1\n\n$2\n$3');

    // Bold syntax fix: ensure ** has spaces if stuck to chinese? No, usually standard MD works.
    // But sometimes '1.**text**' needs space '1. **text**' or similar. 
    // The issue in screenshot is "1. **xxxx**" not bolding.
    // This is often due to remark-gfm list parsing interference or lack of rehype-raw if HTML is mixed.
    // Let's ensure rehype-raw is used.

    // Fix Tilde Strikethrough issue: Escape ~ used for ranges (e.g. +3~4) to prevent strikethrough
    // We look for ~ that is surrounded by numbers or spaces, not ~~ (which is standard strikethrough)
    // Actually GFM uses ~ for strikethrough sometimes or ~~. remark-gfm enables it.
    // If we want to prevent it, we can escape it.
    processed = processed.replace(/~/g, '\\~');

    processed = processed.replace(/(\d+(?:\.\d+)?)\s*[\*x]\s*10\^(\-?\d+)/g, '$$$1 \\times 10^{$2}$$');
    return processed;
};

const Report = () => {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [shareContent, setShareContent] = useState(null);
  const [loadingShare, setLoadingShare] = useState(false);
  const [showQuestionNav, setShowQuestionNav] = useState(false);
  const reportRef = useRef(null);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const scrollToQuestion = (index) => {
    const el = document.getElementById(`question-${index}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setShowQuestionNav(false);
    }
  };

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  useEffect(() => {
    const load = async () => {
      try {
        const res = await getReport(sessionId);
        if (res && res.ai_report) {
            setData(res);
        } else {
            console.error("Invalid report data structure:", res);
            alert('Report data is invalid');
        }
      } catch (e) {
        console.error("Failed to load report:", e);
        alert('Failed to load report');
      }
    };
    load();
  }, [sessionId]);

  const handleShareClick = async () => {
    setShareModalOpen(true);
    if (!shareContent) {
      setLoadingShare(true);
      try {
        const data = await getShareContent(sessionId);
        setShareContent(data);
      } catch (e) {
        alert("生成分享内容失败，请稍后重试");
        setShareModalOpen(false);
      } finally {
        setLoadingShare(false);
      }
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    alert("已复制到剪贴板");
  };

  const handleExportPDF = async () => {
    try {
      const btn = document.getElementById('export-btn');
      if (btn) {
          const originalContent = btn.innerHTML;
          btn.innerText = '下载中...';
          btn.disabled = true;
          
          await downloadReportPDF(sessionId);
          
          btn.innerHTML = originalContent;
          btn.disabled = false;
      } else {
          await downloadReportPDF(sessionId);
      }
    } catch (e) {
      console.error("Failed to download PDF:", e);
      alert("PDF生成失败，请稍后重试");
      const btn = document.getElementById('export-btn');
      if (btn) {
          btn.innerHTML = '<svg class="w-5 h-5 mr-2" ...>...</svg> 导出 PDF'; // Reset icon is hard here, just text
          btn.innerText = '导出 PDF';
          btn.disabled = false;
      }
    }
  };

  const handleExportYAML = async () => {
    try {
        await downloadReportYAML(sessionId);
    } catch (e) {
        console.error("Failed to download YAML:", e);
        alert("YAML导出失败，请稍后重试");
    }
  };

  if (!data) return <div className="p-8 text-center text-[#00838f] font-medium">生成报告中...</div>;

  const { ai_report: report, questions } = data;
  const isPass = report.score >= 45;
  
  const title = report.evaluation?.level || report.title || "软考考生";
  const predictionText = typeof report.prediction === 'string' ? report.prediction : (report.prediction?.advice || "");
  const strongPoints = report.knowledge_profile?.strengths || report.strong_points || [];
  const weakPoints = report.knowledge_profile?.weaknesses || report.weak_points || [];

  return (
    <PageLayout>
      <Helmet>
        <title>{`测评报告 - ${isPass ? '通过' : '未通过'} - ${report.score}分 - 智能测评系统`}</title>
        <meta name="description" content={`本次测评得分${report.score}分。查看详细的知识点分析和AI备考建议。涵盖系统架构设计师、信息系统项目管理师等软考高级科目。`} />
        <meta name="keywords" content="软考高级测评报告, 智能备考分析, 软考成绩预测, 系统架构设计师真题解析, 信息系统项目管理师备考建议" />
      </Helmet>
      <div className="space-y-8 pb-12" ref={reportRef}>
        {/* Header / Score Card */}
        <div className="glass-card p-5 md:p-8 rounded-2xl flex flex-col md:flex-row justify-between items-center relative overflow-hidden">
          <div className="z-10 text-center md:text-left">
            {data.subject_name && (
               <div className="inline-block px-3 py-1 bg-[#00838f]/10 text-[#00838f] text-sm font-bold rounded-full mb-3 border border-[#00838f]/20">
                   {data.subject_name}
               </div>
            )}
            <h1 className="text-3xl md:text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-[#00838f] to-[#00acc1] mb-2">测评完成！</h1>
            <p className="text-[#546e7a] text-lg">您的当前评级：<span className="font-bold text-[#00838f] text-xl">{title}</span></p>
            <p className="text-[#90a4ae] text-xs mt-1">本服务为AI生成内容，结果仅供参考</p>
          </div>
          
          <div className="flex items-center justify-center w-full md:w-auto space-x-3 md:space-x-8 z-10 mt-6 md:mt-0">
            <div className="text-center">
              <span className="text-sm text-[#00838f] font-semibold block uppercase tracking-wider mb-1">总分</span>
              <span className={clsx("text-5xl md:text-6xl font-extrabold", isPass ? 'text-[#00695c]' : 'text-[#ff7043]')}>{report.score}</span>
              <span className="text-[#b2ebf2] text-lg md:text-xl font-medium">/75</span>
            </div>
            <div className="h-12 md:h-16 w-px bg-[#b2ebf2]"></div>
            <div className="text-center">
               <span className="text-sm text-[#00838f] font-semibold block uppercase tracking-wider mb-1">正确率</span>
               <span className="text-2xl md:text-3xl font-bold text-[#37474f]">{report.accuracy}%</span>
            </div>
            <div className="h-12 md:h-16 w-px bg-[#b2ebf2]"></div>
            <div className="text-center">
               <span className="text-sm text-[#00838f] font-semibold block uppercase tracking-wider mb-1">用时</span>
               <span className="text-2xl md:text-3xl font-bold text-[#37474f]">{report.duration_minutes}</span>
               <span className="text-[#b2ebf2] text-xs md:text-sm font-medium">分</span>
            </div>
          </div>

          {/* Decorative background circle */}
          <div className={clsx("absolute -right-20 -top-20 w-80 h-80 rounded-full opacity-10 blur-3xl", isPass ? 'bg-[#00acc1]' : 'bg-[#ff7043]')}></div>
        </div>

        {/* AI Comprehensive Comment */}
        {report.evaluation?.comment && (
          <div className="glass-card p-6 rounded-2xl relative overflow-hidden group hover:scale-[1.02] transition-transform duration-300">
             <div className="absolute top-0 right-0 w-24 h-24 bg-[#00acc1] opacity-5 rounded-bl-full"></div>
             <h3 className="text-xl font-bold text-[#00695c] mb-4 flex items-center">
               <MessageSquare className="w-7 h-7 mr-2 text-[#00acc1]" /> AI 综合点评
             </h3>
             <div className="prose max-w-none text-[#37474f] font-medium leading-loose bg-[#e0f7fa]/30 p-4 rounded-xl border border-[#b2ebf2]/50">
               <ReactMarkdown 
                   remarkPlugins={[remarkGfm, remarkMath]} 
                   rehypePlugins={[rehypeKatex, rehypeRaw]}
               >
                   {processContent(report.evaluation.comment)}
               </ReactMarkdown>
             </div>
          </div>
        )}

        <div className="grid md:grid-cols-2 gap-8">
          {/* Radar Chart */}
          <div className="glass-card p-3 md:p-6 rounded-2xl min-h-[400px]">
            <h3 className="text-xl font-bold text-[#00695c] mb-6 border-b border-[#b2ebf2] pb-2 px-3 md:px-0">各章节知识点掌握程度</h3>
            <div className="h-[600px] md:h-[800px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  layout="vertical"
                  data={report.radar_data}
                  margin={{ top: 5, right: 10, left: isMobile ? -30 : 40, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e0f7fa" />
                  <XAxis type="number" domain={[0, 100]} tick={{fill: '#546e7a'}} axisLine={{stroke: '#b2ebf2'}} />
                  <YAxis 
                    dataKey="subject" 
                    type="category" 
                    width={isMobile ? 180 : 180} 
                    tick={{fontSize: isMobile ? 8 : 12, fill: '#37474f'}} 
                    axisLine={{stroke: '#b2ebf2'}} 
                  />
                  <Tooltip 
                    contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)'}}
                  />
                  <Bar dataKey="A" fill="url(#colorGradient)" name="得分率" radius={[0, 4, 4, 0]} barSize={20} isAnimationActive={false}>
                  </Bar>
                  <defs>
                    <linearGradient id="colorGradient" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="#26c6da" />
                      <stop offset="100%" stopColor="#00838f" />
                    </linearGradient>
                  </defs>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Prediction & Path */}
          <div className="space-y-8">
            {/* Prediction */}
            <div className="glass-card p-6 rounded-2xl relative overflow-hidden group hover:scale-[1.02] transition-transform duration-300">
              <div className="absolute top-0 right-0 w-24 h-24 bg-[#00acc1] opacity-5 rounded-bl-full"></div>
              <h3 className="text-xl font-bold text-[#00695c] mb-4 flex items-center">
                <TrendingUp className="w-6 h-6 mr-2 text-[#00acc1]" /> 真实考试预测
              </h3>
              <div className="prose max-w-none text-[#37474f] leading-loose font-medium">
                <ReactMarkdown 
                    remarkPlugins={[remarkGfm, remarkMath]} 
                    rehypePlugins={[rehypeKatex, rehypeRaw]}
                >
                    {processContent(predictionText)}
                </ReactMarkdown>
              </div>
            </div>

            {/* Learning Path */}
            <div className="glass-card p-6 rounded-2xl">
               <h3 className="text-xl font-bold text-[#00695c] mb-4 border-b border-[#b2ebf2] pb-2">个性化学习建议</h3>
               <ul className="space-y-4">
                 {(report.learning_path || []).map((step, idx) => (
                   <li key={idx} className="flex items-start group">
                     <span className="flex-shrink-0 w-8 h-8 rounded-full bg-[#e0f7fa] text-[#00838f] border border-[#b2ebf2] flex items-center justify-center text-sm font-bold mt-0.5 mr-4 group-hover:bg-[#00acc1] group-hover:text-white transition-colors">
                       {idx + 1}
                     </span>
                     <div className="text-[#546e7a] font-medium leading-relaxed group-hover:text-[#37474f] transition-colors flex-1">
                        <ReactMarkdown 
                            remarkPlugins={[remarkGfm, remarkMath]} 
                            rehypePlugins={[rehypeKatex, rehypeRaw]}
                            components={{p: ({node, ...props}) => <span {...props} />}}
                        >
                            {processContent(step)}
                        </ReactMarkdown>
                     </div>
                   </li>
                 ))}
               </ul>
            </div>
          </div>
        </div>

        {/* Weak & Strong Points */}
        <div className="grid md:grid-cols-2 gap-8">
          <div className="glass-card p-6 rounded-2xl">
            <h3 className="text-xl font-bold text-[#00695c] mb-4 flex items-center">
              <Trophy className="w-6 h-6 mr-2 text-[#fdd835]" /> 优势领域
            </h3>
            <div className="flex flex-wrap gap-3">
              {strongPoints.length > 0 ? (
                strongPoints.map((pt, i) => (
                  <span key={i} className="px-4 py-2 bg-[#e0f2f1] text-[#00695c] rounded-xl text-sm font-semibold border border-[#b2dfdb]">
                    {pt}
                  </span>
                ))
              ) : (
                <span className="text-[#90a4ae]">暂无明显优势，继续加油！</span>
              )}
            </div>
          </div>

          <div className="glass-card p-6 rounded-2xl">
            <h3 className="text-xl font-bold text-[#00695c] mb-4 flex items-center">
              <AlertTriangle className="w-6 h-6 mr-2 text-[#ff7043]" /> 薄弱环节
            </h3>
            <div className="flex flex-wrap gap-3">
               {weakPoints.length > 0 ? (
                 weakPoints.map((pt, i) => (
                  <span key={i} className="px-4 py-2 bg-[#fbe9e7] text-[#d84315] rounded-xl text-sm font-semibold border border-[#ffccbc]">
                    {pt}
                  </span>
                 ))
               ) : (
                 <span className="text-[#90a4ae]">太棒了，没有明显短板！</span>
               )}
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col md:flex-row justify-center space-y-4 md:space-y-0 md:space-x-6 pt-8">
          <button 
            onClick={() => navigate('/')}
            className="px-8 py-4 rounded-xl bg-white/80 border border-white text-[#00695c] font-bold shadow-sm hover:bg-white hover:shadow-md transition-all flex items-center justify-center"
          >
            <ArrowLeft className="w-5 h-5 mr-2" /> 返回首页
          </button>
          <button 
            id="export-btn"
            onClick={handleExportPDF}
            className="px-8 py-4 rounded-xl bg-white border border-[#00acc1] text-[#00838f] font-bold shadow-sm hover:bg-[#e0f7fa] transition-all flex items-center justify-center"
          >
            <Download className="w-5 h-5 mr-2" /> 导出 PDF
          </button>
          <button 
            onClick={handleExportYAML}
            className="px-8 py-4 rounded-xl bg-white border border-[#00acc1] text-[#00838f] font-bold shadow-sm hover:bg-[#e0f7fa] transition-all flex items-center justify-center"
          >
            <FileText className="w-5 h-5 mr-2" /> 导出 YAML
          </button>
          <button 
            onClick={handleShareClick}
            className="px-8 py-4 rounded-xl bg-gradient-to-r from-[#00acc1] to-[#0097a7] text-white font-bold shadow-[0_8px_20px_rgba(0,172,193,0.3)] hover:shadow-[0_12px_25px_rgba(0,172,193,0.4)] hover:-translate-y-1 transition-all flex items-center justify-center"
          >
            <Share2 className="w-5 h-5 mr-2" /> 分享成绩单
          </button>
        </div>

        {/* Question Review Section */}
        {questions && questions.length > 0 && (
          <div className="mt-12 glass-card rounded-2xl overflow-hidden">
              <div className="p-6 border-b border-[#b2ebf2] bg-[#e0f7fa]/30 flex justify-between items-center">
                  <h3 className="text-2xl font-bold text-[#00695c]">试题回顾</h3>
                  <button 
                    onClick={() => setShowQuestionNav(true)}
                    className="flex items-center space-x-2 px-4 py-2 bg-white rounded-lg shadow-sm text-[#00838f] font-semibold hover:bg-[#e0f7fa] transition-colors md:hidden"
                  >
                    <List className="w-5 h-5" />
                    <span>选题</span>
                  </button>
              </div>
              <div className="divide-y divide-[#b2ebf2]">
                  {questions.map((q, idx) => {
                      if (!q) return null; // Safety check
                      const isCorrect = q.user_answer === q.answer;
                      return (
                          <div key={q.id || idx} id={`question-${idx}`} className={clsx("hover:bg-white/40 transition-colors", isMobile ? "p-4" : "p-8")}>
                              <div className="flex items-start mb-4">
                                  <span className={clsx(
                                      "flex-shrink-0 rounded-full flex items-center justify-center text-white font-bold shadow-sm",
                                      isMobile ? "w-8 h-8 mr-3 text-sm" : "w-10 h-10 mr-6",
                                      isCorrect ? "bg-[#26a69a]" : "bg-[#ff7043]"
                                  )}>
                                      {idx + 1}
                                  </span>
                                  <div className="flex-1 min-w-0">
                                      <div className={clsx("prose max-w-none text-[#37474f] mb-6 font-medium leading-relaxed", isMobile ? "text-base" : "text-lg")}>
                                          <ReactMarkdown 
                                              remarkPlugins={[remarkGfm, remarkMath]} 
                                              rehypePlugins={[rehypeKatex, rehypeRaw]}
                                          >
                                              {processContent(q.content || "")}
                                          </ReactMarkdown>
                                      </div>
                                      
                                      <div className="space-y-3 mb-8">
                                          {q.options && Array.isArray(q.options) && Array.isArray(q.options[0]) ? (
                                              // Multi-blank display
                                              q.options.map((optionGroup, groupIdx) => {
                                                  const userAnsArr = (q.user_answer || "").split(',');
                                                  const correctAnsArr = (q.answer || "").split(',');
                                                  const userSelection = userAnsArr[groupIdx] || "";
                                                  const correctSelection = correctAnsArr[groupIdx] || "";
                                                  
                                                  return (
                                                      <div key={groupIdx} className="mb-4 bg-white/40 p-4 rounded-xl border border-[#b2ebf2]">
                                                          <h5 className="font-bold text-[#00838f] mb-2 text-sm">第 {groupIdx + 1} 空</h5>
                                                          <div className="space-y-2">
                                                              {optionGroup.map((opt, i) => {
                                                                  if (!opt) return null;
                                                                  const optKey = opt.split('.')[0];
                                                                  const optText = opt.substring(opt.indexOf('.') + 1).trim();
                                                                  
                                                                  const isUserSelected = userSelection === optKey;
                                                                  const isRightAnswer = correctSelection === optKey;
                                                                  
                                                                  let btnClass = "border-transparent bg-white/60 text-[#546e7a]";
                                                                  if (isRightAnswer) btnClass = "border-[#26a69a] bg-[#e0f2f1] text-[#00695c] font-bold shadow-sm";
                                                                  else if (isUserSelected && !isRightAnswer) btnClass = "border-[#ff7043] bg-[#fbe9e7] text-[#d84315] font-semibold";
                                                                  else if (isUserSelected) btnClass = "border-[#26a69a] bg-[#e0f2f1] text-[#00695c] font-bold"; // Correct user selection

                                                                  return (
                                                                      <div key={i} className={clsx("p-3 rounded-lg border flex items-start transition-all text-sm", btnClass)}>
                                                                          <span className="font-bold mr-2">{optKey}.</span>
                                                                          <div className="flex-1">
                                                                              <ReactMarkdown 
                                                  remarkPlugins={[remarkGfm, remarkMath]} 
                                                  rehypePlugins={[rehypeKatex, rehypeRaw]}
                                                  components={{p: ({node, ...props}) => <span {...props} />}}
                                              >
                                                  {processContent(optText)}
                                              </ReactMarkdown>
                                                                          </div>
                                                                          {isRightAnswer && <CheckCircle className="w-5 h-5 text-[#26a69a] ml-2" />}
                                                                          {isUserSelected && !isRightAnswer && <XCircle className="w-5 h-5 text-[#ff7043] ml-2" />}
                                                                      </div>
                                                                  )
                                                              })}
                                                          </div>
                                                      </div>
                                                  );
                                              })
                                          ) : (
                                              // Single Choice
                                              (q.options || []).map((opt, i) => {
                                                  if (!opt) return null;
                                                  const optKey = opt.split('.')[0];
                                                  const optText = opt.substring(opt.indexOf('.') + 1).trim();
                                                  const isUserSelected = q.user_answer === optKey;
                                                  const isRightAnswer = q.answer === optKey;
                                                  
                                                  let btnClass = "border-transparent bg-white/60 text-[#546e7a]";
                                                  if (isRightAnswer) btnClass = "border-[#26a69a] bg-[#e0f2f1] text-[#00695c] font-bold shadow-sm";
                                                  else if (isUserSelected && !isCorrect) btnClass = "border-[#ff7043] bg-[#fbe9e7] text-[#d84315] font-semibold";
                                                  
                                                  return (
                                                      <div key={i} className={clsx("p-4 rounded-xl border flex items-start transition-all", btnClass)}>
                                                          <span className="font-bold mr-3">{optKey}.</span>
                                                          <div className="flex-1">
                                                              <ReactMarkdown 
                                                                  remarkPlugins={[remarkGfm, remarkMath]} 
                                                                  rehypePlugins={[rehypeKatex, rehypeRaw]}
                                                                  components={{p: ({node, ...props}) => <span {...props} />}}
                                                              >
                                                                  {processContent(optText)}
                                                              </ReactMarkdown>
                                                          </div>
                                                          {isRightAnswer && <CheckCircle className="w-6 h-6 text-[#26a69a] ml-3" />}
                                                          {isUserSelected && !isRightAnswer && <XCircle className="w-6 h-6 text-[#ff7043] ml-3" />}
                                                      </div>
                                                  )
                                              })
                                          )}
                                      </div>
                                      
                                      <div className="bg-[#e0f7fa]/50 p-6 rounded-xl border border-[#b2ebf2]">
                                          <h4 className="font-bold text-[#00838f] mb-3 flex items-center">
                                            <span className="w-1 h-6 bg-[#00acc1] rounded-full mr-2"></span>
                                            解析：
                                          </h4>
                                          <div className="prose max-w-none text-[#006064] text-base leading-relaxed">
                                              <ReactMarkdown 
                                                  remarkPlugins={[remarkGfm, remarkMath]} 
                                                  rehypePlugins={[rehypeKatex, rehypeRaw]}
                                              >
                                                  {processContent(q.explanation || "暂无解析")}
                                              </ReactMarkdown>
                                          </div>
                                      </div>
                                  </div>
                              </div>
                          </div>
                      );
                  })}
              </div>
          </div>
        )}

        {/* Share Modal */}
        {shareModalOpen && (
          <div className="fixed inset-0 bg-[#006064]/30 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className={clsx("glass-card w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl shadow-2xl no-scrollbar", !isMobile && "animate-float")}>
              <div className="flex justify-between items-center p-6 border-b border-[#b2ebf2]">
                <h3 className="text-2xl font-bold text-[#00695c]">分享你的成就</h3>
                <button onClick={() => setShareModalOpen(false)} className="text-[#546e7a] hover:text-[#00838f] transition-colors">
                  <X className="w-7 h-7" />
                </button>
              </div>
              
              <div className="p-8">
                {loadingShare ? (
                  <div className="flex flex-col items-center justify-center py-12">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#00acc1] mb-4"></div>
                    <p className="text-[#546e7a]">AI 正在为你生成专属战报...</p>
                  </div>
                ) : shareContent ? (
                  <div className="space-y-8">
                    {/* Moments Copy */}
                    <div className="bg-[#e8f5e9] p-6 rounded-xl border border-[#c8e6c9]">
                      <div className="flex justify-between items-start mb-3">
                        <h4 className="font-bold text-[#2e7d32]">朋友圈文案</h4>
                        <button onClick={() => copyToClipboard(shareContent.moments_copy)} className="text-[#43a047] hover:text-[#1b5e20] text-sm flex items-center font-semibold">
                          <Copy className="w-4 h-4 mr-1" /> 复制
                        </button>
                      </div>
                      <p className="text-[#1b5e20] whitespace-pre-wrap leading-relaxed">{shareContent.moments_copy}</p>
                    </div>

                    {/* Xiaohongshu Copy */}
                    <div className="bg-[#fce4ec] p-6 rounded-xl border border-[#f8bbd0]">
                      <div className="flex justify-between items-start mb-3">
                        <h4 className="font-bold text-[#c2185b]">小红书文案</h4>
                        <button 
                          onClick={() => {
                              const contentObj = shareContent.xiaohongshu_copy;
                              const title = contentObj.title || "";
                              const body = contentObj.content || contentObj.body || "";
                              const text = typeof contentObj === 'string' 
                                  ? contentObj 
                                  : `${title}\n\n${body}`;
                              copyToClipboard(text);
                          }} 
                          className="text-[#e91e63] hover:text-[#880e4f] text-sm flex items-center font-semibold"
                        >
                          <Copy className="w-4 h-4 mr-1" /> 复制
                        </button>
                      </div>
                      {typeof shareContent.xiaohongshu_copy === 'string' ? (
                          <p className="text-[#880e4f] whitespace-pre-wrap text-sm leading-relaxed">{shareContent.xiaohongshu_copy}</p>
                      ) : (
                          <div className="text-[#880e4f] text-sm leading-relaxed">
                              <p className="font-bold mb-2 text-base">{shareContent.xiaohongshu_copy.title}</p>
                              <p className="whitespace-pre-wrap">{shareContent.xiaohongshu_copy.content || shareContent.xiaohongshu_copy.body}</p>
                          </div>
                      )}
                    </div>

                    {/* Image Text */}
                    <div className="bg-gradient-to-br from-[#263238] to-[#37474f] p-8 rounded-xl text-center text-white relative overflow-hidden shadow-lg">
                      <div className="absolute top-0 left-0 w-full h-full bg-[url('/images/cubes.png')] opacity-30 bg-repeat"></div>
                      <h4 className="text-[#b0bec5] text-sm uppercase tracking-[0.2em] mb-6 relative z-10">分享图金句</h4>
                      <p className="text-2xl font-serif italic relative z-10 leading-relaxed text-[#e0f7fa]">“{shareContent.image_text}”</p>
                    </div>
                  </div>
                ) : (
                  <div className="text-center text-[#ff7043] font-medium">生成失败，请重试</div>
                )}
              </div>
            </div>
          </div>
        )}
        {/* Question Navigation Modal/Sidebar */}
        {/* Mobile Drawer */}
        {showQuestionNav && (
          <div className="fixed inset-0 z-50 flex items-end md:hidden">
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowQuestionNav(false)}></div>
            <div className="relative w-full bg-white rounded-t-2xl p-6 max-h-[70vh] overflow-y-auto animate-fadeInUp">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold text-[#00695c]">题目导航</h3>
                <button onClick={() => setShowQuestionNav(false)} className="text-[#546e7a]">
                  <X className="w-6 h-6" />
                </button>
              </div>
              <div className="grid grid-cols-5 gap-3">
                {questions.map((q, idx) => {
                  const isCorrect = q.user_answer === q.answer;
                  return (
                    <button
                      key={q.id}
                      onClick={() => scrollToQuestion(idx)}
                      className={clsx(
                        "h-10 w-10 rounded-full flex items-center justify-center text-sm font-bold transition-all mx-auto",
                        isCorrect 
                          ? "bg-[#e0f2f1] text-[#00695c] border border-[#26a69a]" 
                          : "bg-[#fbe9e7] text-[#d84315] border border-[#ff7043]"
                      )}
                    >
                      {idx + 1}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Desktop Sticky Sidebar */}
        <div className="hidden md:block fixed right-8 top-1/2 -translate-y-1/2 z-40">
           <div className="bg-white/90 backdrop-blur-md p-4 rounded-2xl shadow-[0_4px_20px_rgba(0,131,143,0.15)] border border-[#b2ebf2] max-h-[80vh] overflow-y-auto w-24 no-scrollbar">
              <div className="flex flex-col space-y-2">
                 <button onClick={scrollToTop} className="mb-2 p-2 rounded-full bg-[#00acc1] text-white hover:bg-[#0097a7] transition-colors flex justify-center" title="回到顶部">
                    <ChevronUp className="w-5 h-5" />
                 </button>
                 <div className="h-px bg-[#b2ebf2] my-2"></div>
                 {questions && questions.map((q, idx) => {
                    const isCorrect = q.user_answer === q.answer;
                    return (
                      <button
                        key={q.id}
                        onClick={() => scrollToQuestion(idx)}
                        className={clsx(
                          "w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold transition-all mx-auto hover:scale-110",
                          isCorrect 
                            ? "bg-[#e0f2f1] text-[#00695c] border border-[#26a69a]" 
                            : "bg-[#fbe9e7] text-[#d84315] border border-[#ff7043]"
                        )}
                      >
                        {idx + 1}
                      </button>
                    );
                 })}
              </div>
           </div>
        </div>

      </div>
    </PageLayout>
  );
};

export default Report;