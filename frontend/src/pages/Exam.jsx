import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { getSession, syncAnswers, submitExam } from '../api';
import { Clock, CheckSquare, List, HelpCircle } from 'lucide-react';
import clsx from 'clsx';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeKatex from 'rehype-katex';
import remarkMath from 'remark-math';
import 'katex/dist/katex.min.css';
import LoadingOverlay from '../components/LoadingOverlay';
import rehypeRaw from 'rehype-raw';
import PageLayout from '../components/PageLayout';

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
    
    processed = processed.replace(/\(\s*\d+\s*\)/g, '( )');
    processed = processed.replace(/(\d+(?:\.\d+)?)\s*[\*x]\s*10\^(\-?\d+)/g, '$$$1 \\times 10^{$2}$$');
    return processed;
};

const Exam = () => {
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get('sessionId');
  const navigate = useNavigate();

  const [sessionData, setSessionData] = useState(null);
  const [currentQIndex, setCurrentQIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [timeLeft, setTimeLeft] = useState(9000); // 150 mins
  const [submitting, setSubmitting] = useState(false);
  const [showSubmitModal, setShowSubmitModal] = useState(false);

  useEffect(() => {
    if (!sessionId) return;
    // Debounce or check if already loading?
    // React Strict Mode might call this twice.
    // We can use a ref to track if called.
    
    // Actually, the issue might be that we call getSession(sessionId) which calls /start again.
    // If we just navigated here from Home, Home called /start, got ID, pushed to URL.
    // Then Exam mounts, calls /start AGAIN via getSession.
    // This is the double call.
    
    // If we have state passed via router state, we could use that.
    // But for now, just load it.
    
    loadSession();
  }, [sessionId]);

  useEffect(() => {
    if (!sessionData) return;
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 0) {
          // Time is up, auto submit or show modal? 
          // For now, let's just trigger the modal as per original logic flow, 
          // or ideally auto-submit. Let's auto-submit to be safe.
          confirmSubmit();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [sessionData]);

  const loadSession = async () => {
    try {
      const data = await getSession(sessionId);
      setSessionData(data);
      setAnswers(data.user_answers || {});
      // Support both duration_left (new) and remaining_seconds (legacy/backup)
      const left = data.duration_left !== undefined ? data.duration_left : data.remaining_seconds;
      setTimeLeft(typeof left === 'number' ? left : 9000);
    } catch (e) {
      alert('Error loading session');
    }
  };

  const handleAnswer = async (option) => {
    const q = sessionData.questions[currentQIndex];
    const ansKey = option.split('.')[0]; // "A. xxx" -> "A"
    
    const newAnswers = { ...answers, [q.id]: ansKey };
    setAnswers(newAnswers);
    
    // Optimistic update, sync in background
    await syncAnswers(sessionId, newAnswers);
  };

  const handleSubmit = () => {
    setShowSubmitModal(true);
  };

  const confirmSubmit = async () => {
    if (submitting) return;
    setShowSubmitModal(false);
    
    setSubmitting(true);
    try {
      await submitExam(sessionId);
      navigate(`/report/${sessionId}`);
    } catch (e) {
      alert('提交失败');
      setSubmitting(false);
    }
  };

  if (!sessionData) return <div className="p-8 text-center">Loading...</div>;

  // Handle empty questions array (no questions in database)
  if (!sessionData.questions || sessionData.questions.length === 0) {
    return (
      <PageLayout>
        <div className="flex items-center justify-center h-[calc(100vh-80px)]">
          <div className="glass-card p-12 rounded-2xl max-w-md text-center">
            <div className="w-20 h-20 bg-[#e0f7fa] rounded-full flex items-center justify-center mx-auto mb-6">
              <HelpCircle className="w-10 h-10 text-[#00838f]" />
            </div>
            <h2 className="text-2xl font-bold text-[#00695c] mb-4">暂无题目</h2>
            <p className="text-[#546e7a] mb-8 leading-relaxed">
              数据库中还没有题目数据。<br/>
              请联系管理员上传题目后再开始考试。
            </p>
            <button
              onClick={() => navigate('/')}
              className="px-8 py-3 rounded-xl bg-gradient-to-r from-[#00acc1] to-[#0097a7] text-white font-bold shadow-lg hover:shadow-xl transition-all"
            >
              返回首页
            </button>
          </div>
        </div>
      </PageLayout>
    );
  }

  const currentQ = sessionData.questions[currentQIndex];
  const formatTime = (s) => {
    if (typeof s !== 'number' || isNaN(s)) return "00:00:00";
    const totalSeconds = Math.floor(s);
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const sec = totalSeconds % 60;
    return `${h < 10 ? '0' + h : h}:${m < 10 ? '0' + m : m}:${sec < 10 ? '0' + sec : sec}`;
  };

  return (
    <PageLayout>
      {/* 
         Simplified Layout for Mobile:
         Remove fixed height constraint on mobile to allow natural scrolling.
         Only enforce fixed height on MD screens and up.
      */}
      <div className="flex flex-col md:flex-row md:h-[calc(100vh-80px)] gap-6">
        <LoadingOverlay visible={submitting} message="正在智能阅卷与生成分析报告..." />
        
        {/* Left: Question Area */}
        {/* On mobile: min-h-[500px] to ensure visibility, h-auto to expand */}
        <div className="flex-1 flex flex-col min-w-0 min-h-[60vh] md:h-full md:overflow-hidden">
          {/* Header */}
          <div className="glass-card flex justify-between items-center mb-6 p-6 rounded-2xl">
            <div>
              <span className="text-sm font-semibold text-[#00838f] tracking-wider block mb-1">题目</span>
              <div className="text-3xl font-extrabold text-[#00695c]">
                {currentQIndex + 1} <span className="text-[#b2ebf2] text-xl font-normal">/ {sessionData.questions.length}</span>
              </div>
            </div>
            <div className="flex items-center space-x-2 text-[#00838f] bg-white/50 backdrop-blur px-4 py-2 rounded-xl border border-[#00838f]/20 font-mono text-xl font-bold shadow-sm">
              <Clock className="w-5 h-5" />
              <span>{formatTime(timeLeft)}</span>
            </div>
          </div>

          {/* Question Card - Using flex-col to separate stem and options for scrolling */}
          <div className="glass-card rounded-2xl flex-1 overflow-hidden flex flex-col relative">
            {/* Scrollable Content Area */}
            <div className="flex-1 overflow-y-auto p-4 md:p-8 [&::-webkit-scrollbar]:hidden [scrollbar-width:none] [-ms-overflow-style:none]">
               {/* Question Stem - Sticky at top if needed, or just part of flow. 
                   User request: "See stem while scrolling options". 
                   So we should make stem sticky? Or split view?
                   "See options but can't see stem" implies options are long and stem scrolls out of view.
                   Let's make the stem sticky at the top of this container.
               */}
               <div className="bg-white/95 pb-4 mb-4 border-b border-gray-100 shadow-sm transition-all">
                  <div className="prose max-w-none text-[#37474f] font-medium leading-loose text-lg">
                    <ReactMarkdown 
                        remarkPlugins={[remarkGfm, remarkMath]} 
                        rehypePlugins={[rehypeKatex, rehypeRaw]}
                    >
                      {processContent(currentQ.content)}
                    </ReactMarkdown>
                  </div>
               </div>

              <div className="space-y-3 md:space-y-8 pb-32 md:pb-8">
                {/* Check if options is array of arrays (Multi-blank) */}
                {currentQ.options && Array.isArray(currentQ.options[0]) ? (
                  currentQ.options.map((optionGroup, groupIdx) => (
                    <div key={groupIdx} className="bg-white/40 p-6 rounded-2xl border border-white/50">
                    <h4 className="font-bold text-[#00838f] mb-4 flex items-center">
                        <span className="w-8 h-8 rounded-full bg-[#e0f7fa] flex items-center justify-center mr-2 text-sm border border-[#b2ebf2]">{groupIdx + 1}</span>
                        第 {groupIdx + 1} 空
                    </h4>
                    <div className="space-y-3">
                        {optionGroup.map((opt, idx) => {
                            const optKey = opt.split('.')[0]; // "A"
                            // User answer for this group: "A,B" -> split by comma -> [groupIdx]
                            const currentAnswers = (answers[currentQ.id] || "").split(',');
                            const isSelected = currentAnswers[groupIdx] === optKey;
                            
                            const optText = opt.substring(opt.indexOf('.') + 1).trim();

                            return (
                                <button
                                    key={idx}
                                    onClick={() => {
                                        const newAnsArr = [...currentAnswers];
                                        // Ensure array has enough slots
                                        while(newAnsArr.length <= groupIdx) newAnsArr.push("");
                                        newAnsArr[groupIdx] = optKey;
                                        handleAnswer(newAnsArr.join(',')); // Store as "A,B"
                                    }}
                                    className={clsx(
                                    "w-full text-left p-3 md:p-4 rounded-xl border-2 transition-all duration-300 flex items-start space-x-3 md:space-x-4 group",
                                    isSelected 
                                        ? "bg-[#00acc1]/10 border-[#00acc1] shadow-sm" 
                                        : "bg-white/60 border-transparent hover:bg-white hover:border-[#b2ebf2]"
                                    )}
                                >
                                    <span className={clsx(
                                    "flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center border-2 mt-0.5 text-sm font-bold transition-all",
                                    isSelected 
                                        ? "bg-[#00acc1] text-white border-[#00acc1]" 
                                        : "bg-white text-[#546e7a] border-[#cfd8dc] group-hover:border-[#00acc1] group-hover:text-[#00acc1]"
                                    )}>
                                    {optKey}
                                    </span>
                                    <div className={clsx("flex-1 pt-0.5 text-base", isSelected ? "text-[#00695c] font-semibold" : "text-[#546e7a]")}>
                                        <ReactMarkdown 
                                            remarkPlugins={[remarkGfm, remarkMath]}
                                            rehypePlugins={[rehypeKatex, rehypeRaw]}
                                            components={{
                                                p: ({node, ...props}) => <span {...props} />
                                            }}
                                        >
                                            {processContent(optText)}
                                        </ReactMarkdown>
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                  </div>
                ))
              ) : (
                // Single Choice (Standard)
                (currentQ.options || []).map((opt, idx) => {
                    const optKey = opt.split('.')[0];
                    const isSelected = answers[currentQ.id] === optKey;
                    // Extract text part after "A. "
                    const optText = opt.substring(opt.indexOf('.') + 1).trim();
                    
                    return (
                    <button
                        key={idx}
                        onClick={() => handleAnswer(optKey)} // Pass key directly
                        className={clsx(
                        "w-full text-left p-3 md:p-5 rounded-xl border-2 transition-all duration-300 flex items-start space-x-3 md:space-x-4 group",
                        isSelected 
                            ? "bg-[#00acc1]/10 border-[#00acc1] shadow-[0_4px_12px_rgba(0,172,193,0.2)]" 
                            : "bg-white/60 border-transparent hover:bg-white hover:border-[#b2ebf2] hover:shadow-md"
                        )}
                    >
                        <span className={clsx(
                        "flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center border-2 mt-0.5 font-bold transition-all",
                        isSelected 
                            ? "bg-[#00acc1] text-white border-[#00acc1]" 
                            : "bg-white text-[#546e7a] border-[#cfd8dc] group-hover:border-[#00acc1] group-hover:text-[#00acc1]"
                        )}>
                        {optKey}
                        </span>
                        <div className={clsx("flex-1 pt-1 text-lg", isSelected ? "text-[#00695c] font-semibold" : "text-[#546e7a]")}>
                        <ReactMarkdown 
                            remarkPlugins={[remarkGfm, remarkMath]}
                            rehypePlugins={[rehypeKatex, rehypeRaw]}
                            components={{
                                p: ({node, ...props}) => <span {...props} />
                            }}
                        >
                            {processContent(optText)}
                        </ReactMarkdown>
                        </div>
                    </button>
                    );
                })
              )}
            </div>
            </div>
          </div>

          {/* Navigation */}
          <div className="mt-6 md:mt-6 md:static fixed bottom-0 left-0 right-0 p-4 bg-white/95 backdrop-blur-md border-t border-gray-100 flex justify-between z-20 md:bg-transparent md:border-none md:p-0 shadow-[0_-4px_20px_rgba(0,0,0,0.05)] md:shadow-none">
            <button
              onClick={() => setCurrentQIndex(Math.max(0, currentQIndex - 1))}
              disabled={currentQIndex === 0}
              className="px-6 md:px-8 py-3 rounded-xl bg-white/80 border border-white text-[#00695c] font-semibold shadow-sm hover:bg-white hover:shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed text-sm md:text-base"
            >
              上一题
            </button>
            
            {currentQIndex === sessionData.questions.length - 1 ? (
              <button
                onClick={handleSubmit}
                className="px-6 md:px-8 py-3 rounded-xl bg-gradient-to-r from-[#00acc1] to-[#0097a7] text-white font-bold shadow-[0_8px_20px_rgba(0,172,193,0.3)] hover:shadow-[0_12px_25px_rgba(0,172,193,0.4)] hover:-translate-y-1 transition-all text-sm md:text-base"
              >
                提交试卷
              </button>
            ) : (
              <button
                onClick={() => setCurrentQIndex(Math.min(sessionData.questions.length - 1, currentQIndex + 1))}
                className="px-6 md:px-8 py-3 rounded-xl bg-white/80 border border-white text-[#00695c] font-semibold shadow-sm hover:bg-white hover:shadow-md transition-all text-sm md:text-base"
              >
                下一题
              </button>
            )}
          </div>
        </div>

        {/* Right: Answer Sheet */}
        <div className="hidden md:block w-80 glass-card p-6 rounded-2xl overflow-y-auto [&::-webkit-scrollbar]:hidden [scrollbar-width:none] [-ms-overflow-style:none]">
          <h3 className="text-lg font-bold mb-6 flex items-center text-[#00695c]">
            <List className="w-5 h-5 mr-2" /> 答题卡
          </h3>
          <div className="grid grid-cols-5 gap-3">
            {sessionData.questions.map((q, idx) => (
              <button
                key={q.id}
                onClick={() => setCurrentQIndex(idx)}
                className={clsx(
                  "w-10 h-10 rounded-lg text-sm font-bold transition-all duration-300",
                  currentQIndex === idx ? "ring-2 ring-[#00acc1] ring-offset-2 scale-110" : "",
                  answers[q.id] 
                    ? "bg-[#00acc1] text-white shadow-[0_2px_8px_rgba(0,172,193,0.3)]" 
                    : "bg-white/50 text-[#546e7a] hover:bg-white hover:text-[#00838f]"
                )}
              >
                {idx + 1}
              </button>
            ))}
          </div>
        </div>
      </div>
      {/* Submit Confirmation Modal */}
      {showSubmitModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-8 animate-fadeInUp">
            <div className="flex flex-col items-center text-center">
              <div className="w-16 h-16 bg-[#e0f7fa] rounded-full flex items-center justify-center mb-6 text-[#00838f]">
                 <HelpCircle className="w-8 h-8" />
              </div>
              <h3 className="text-2xl font-bold text-[#00695c] mb-3">确定要提交试卷吗？</h3>
              <p className="text-[#546e7a] mb-8 leading-relaxed">
                您已完成 <span className="font-bold text-[#00838f]">{Object.keys(answers).length}</span> / {sessionData.questions.length} 道题目。
                <br/>
                提交后将无法修改答案，请确认。
              </p>
              <div className="flex space-x-4 w-full">
                <button 
                  onClick={() => setShowSubmitModal(false)}
                  className="flex-1 py-3.5 rounded-xl border-2 border-[#b2ebf2] text-[#00838f] font-bold hover:bg-[#e0f7fa] transition-colors"
                >
                  再检查下
                </button>
                <button 
                  onClick={confirmSubmit}
                  className="flex-1 py-3.5 rounded-xl bg-gradient-to-r from-[#00acc1] to-[#0097a7] text-white font-bold shadow-lg hover:shadow-[0_8px_20px_rgba(0,172,193,0.3)] hover:-translate-y-0.5 transition-all"
                >
                  确认提交
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </PageLayout>
  );
};

export default Exam;
