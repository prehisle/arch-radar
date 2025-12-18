import React, { forwardRef } from 'react';
import { Trophy, TrendingUp, AlertTriangle, CheckCircle, Clock, Target } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Cell } from 'recharts';

const PrintableReport = forwardRef(({ data, sessionId }, ref) => {
  if (!data) return null;
  const { ai_report: report } = data;
  const title = report.evaluation?.level || report.title || "软考考生";
  const predictionText = typeof report.prediction === 'string' ? report.prediction : (report.prediction?.advice || "");
  const strongPoints = report.knowledge_profile?.strengths || report.strong_points || [];
  const weakPoints = report.knowledge_profile?.weaknesses || report.weak_points || [];

  return (
    <div ref={ref} className="w-full bg-white text-black print-container">
      <style>{`
        @media print {
          @page { 
            size: A4; 
            margin: 0; 
          }
          body { 
            -webkit-print-color-adjust: exact; 
            print-color-adjust: exact; 
          }
          .page-break { 
            page-break-after: always; 
          }
          .print-container {
            font-family: 'SimSun', 'Songti SC', serif; /* Use serif for a formal report look */
          }
        }
      `}</style>

      {/* --- Cover Page --- */}
      <div className="w-[210mm] h-[297mm] relative flex flex-col items-center justify-between p-20 bg-gradient-to-br from-cyan-50 to-white page-break overflow-hidden">
        {/* Decorative Circles */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-cyan-100 rounded-bl-full opacity-50"></div>
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-cyan-50 rounded-tr-full opacity-50"></div>

        <div className="z-10 w-full text-center mt-20">
            <div className="inline-block p-8 rounded-full bg-cyan-50 mb-12 border-4 border-cyan-100">
                <Trophy className="w-32 h-32 text-cyan-700" strokeWidth={1.5} />
            </div>
            <h1 className="text-6xl font-bold text-cyan-900 mb-6 tracking-widest">智能测评报告</h1>
            <p className="text-2xl text-cyan-600 uppercase tracking-[0.5em] font-light">Assessment Report</p>
        </div>

        <div className="z-10 w-full max-w-2xl space-y-8 bg-white/80 p-12 rounded-3xl border border-cyan-100 shadow-sm backdrop-blur-sm">
            <div className="flex justify-between items-end border-b-2 border-cyan-100 pb-4">
                <span className="text-gray-500 text-lg">测评编号</span>
                <span className="text-gray-800 font-mono text-xl">{sessionId?.slice(0, 8).toUpperCase()}</span>
            </div>
            <div className="flex justify-between items-end border-b-2 border-cyan-100 pb-4">
                <span className="text-gray-500 text-lg">生成日期</span>
                <span className="text-gray-800 text-xl">{new Date().toLocaleDateString()}</span>
            </div>
            <div className="flex justify-between items-end border-b-2 border-cyan-100 pb-4">
                <span className="text-gray-500 text-lg">考生评级</span>
                <span className="text-cyan-800 text-3xl font-bold">{title}</span>
            </div>
            <div className="flex justify-between items-end pt-4">
                <span className="text-gray-500 text-lg">综合得分</span>
                <span className="text-6xl font-bold text-cyan-700">{report.score}</span>
            </div>
        </div>

        <div className="z-10 mb-12 text-center text-gray-400 text-sm">
            <p>Powered by Zhineng Test System</p>
        </div>
      </div>

      {/* --- Content Page --- */}
      <div className="w-[210mm] min-h-[297mm] p-16 bg-white relative">
        {/* Header */}
        <div className="flex items-center justify-between border-b-2 border-cyan-100 pb-6 mb-12">
            <div>
                <h2 className="text-3xl font-bold text-cyan-900">测评详情分析</h2>
                <p className="text-gray-400 text-sm mt-1">Detailed Analysis</p>
            </div>
            <div className="text-right">
                <span className="block text-4xl font-bold text-cyan-700">{report.score}<span className="text-lg text-gray-400 font-normal">/75</span></span>
                <span className="text-sm text-cyan-600">总体评分</span>
            </div>
        </div>

        {/* 3 Metrics Grid */}
        <div className="grid grid-cols-3 gap-8 mb-12">
            <div className="p-6 bg-cyan-50 rounded-2xl border border-cyan-100">
                <div className="flex items-center text-cyan-800 mb-2">
                    <Target className="w-5 h-5 mr-2" />
                    <span className="font-bold">正确率</span>
                </div>
                <p className="text-3xl font-bold text-cyan-900">{report.accuracy}%</p>
            </div>
            <div className="p-6 bg-cyan-50 rounded-2xl border border-cyan-100">
                <div className="flex items-center text-cyan-800 mb-2">
                    <Clock className="w-5 h-5 mr-2" />
                    <span className="font-bold">用时</span>
                </div>
                <p className="text-3xl font-bold text-cyan-900">{report.duration_minutes} <span className="text-sm font-normal">分</span></p>
            </div>
            <div className="p-6 bg-cyan-50 rounded-2xl border border-cyan-100">
                <div className="flex items-center text-cyan-800 mb-2">
                    <Trophy className="w-5 h-5 mr-2" />
                    <span className="font-bold">评级</span>
                </div>
                <p className="text-3xl font-bold text-cyan-900">{title}</p>
            </div>
        </div>

        {/* Prediction Section */}
        <div className="mb-12">
            <h3 className="text-xl font-bold text-cyan-900 mb-4 flex items-center">
                <TrendingUp className="w-6 h-6 mr-2 text-cyan-600" /> 考试预测与建议
            </h3>
            <div className="bg-gray-50 p-6 rounded-xl border border-gray-100 text-gray-700 leading-relaxed text-justify">
                {predictionText}
            </div>
        </div>

        {/* Radar/Knowledge Chart (Represented as Progress Bars for Print Safety) */}
        <div className="mb-12">
            <h3 className="text-xl font-bold text-cyan-900 mb-6 flex items-center">
                <Target className="w-6 h-6 mr-2 text-cyan-600" /> 知识点掌握情况
            </h3>
            <div className="space-y-4">
                {report.radar_data && report.radar_data.map((item, idx) => (
                    <div key={idx} className="flex items-center">
                        <span className="w-32 text-sm font-bold text-gray-600 truncate mr-4" title={item.subject}>{item.subject}</span>
                        <div className="flex-1 h-3 bg-gray-100 rounded-full overflow-hidden">
                            <div 
                                className="h-full bg-cyan-500 print:bg-cyan-600" 
                                style={{ width: `${item.A}%` }}
                            ></div>
                        </div>
                        <span className="w-12 text-right text-sm font-bold text-cyan-700 ml-4">{item.A}%</span>
                    </div>
                ))}
            </div>
        </div>

        {/* Strong & Weak Points */}
        <div className="grid grid-cols-2 gap-12 mb-12">
            <div>
                <h3 className="text-lg font-bold text-cyan-900 mb-4 border-b border-gray-200 pb-2">优势领域</h3>
                <div className="flex flex-wrap gap-2">
                    {strongPoints.length > 0 ? strongPoints.map((pt, i) => (
                        <span key={i} className="px-3 py-1 bg-green-50 text-green-700 border border-green-100 rounded text-sm font-medium">
                            {pt}
                        </span>
                    )) : <span className="text-gray-400 text-sm">暂无明显优势</span>}
                </div>
            </div>
            <div>
                <h3 className="text-lg font-bold text-cyan-900 mb-4 border-b border-gray-200 pb-2">薄弱环节</h3>
                <div className="flex flex-wrap gap-2">
                    {weakPoints.length > 0 ? weakPoints.map((pt, i) => (
                        <span key={i} className="px-3 py-1 bg-red-50 text-red-700 border border-red-100 rounded text-sm font-medium">
                            {pt}
                        </span>
                    )) : <span className="text-gray-400 text-sm">无明显短板</span>}
                </div>
            </div>
        </div>

        {/* Learning Path */}
        <div>
            <h3 className="text-xl font-bold text-cyan-900 mb-6 flex items-center">
                <CheckCircle className="w-6 h-6 mr-2 text-cyan-600" /> 推荐学习路径
            </h3>
            <div className="space-y-3">
                {report.learning_path.map((step, idx) => (
                    <div key={idx} className="flex items-start">
                        <span className="flex-shrink-0 w-6 h-6 rounded-full bg-cyan-100 text-cyan-700 flex items-center justify-center text-xs font-bold mr-3 mt-0.5">
                            {idx + 1}
                        </span>
                        <p className="text-gray-700 text-sm leading-relaxed">{step}</p>
                    </div>
                ))}
            </div>
        </div>

        {/* Footer */}
        <div className="mt-20 pt-8 border-t border-gray-100 text-center text-gray-400 text-xs">
            <p>此报告由智能系统自动生成，仅供参考。</p>
        </div>
      </div>
    </div>
  );
});

export default PrintableReport;
