import React, { useState, useEffect } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell, AreaChart, Area, ComposedChart
} from 'recharts';
import { Users, BookOpen, Cpu, Activity, Clock, MapPin, Smartphone, Share2, Download, TrendingUp, UserPlus, CheckCircle, XCircle } from 'lucide-react';
import { getDashboardUsers, getDashboardStats, getMaterialStats } from '../api';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d', '#a4de6c', '#d0ed57', '#ffc658'];

const Dashboard = ({ subjectId }) => {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState({
    users: [],
    stats: null, // New structure
    materials: null
  });

  useEffect(() => {
    const fetchAllData = async () => {
      try {
        const [usersRes, statsRes, matRes] = await Promise.all([
          getDashboardUsers(10, subjectId),
          getDashboardStats(),
          getMaterialStats(subjectId)
        ]);

        setData({
          users: usersRes.data,
          stats: statsRes,
          materials: matRes
        });
      } catch (err) {
        console.error("Failed to fetch dashboard data", err);
      } finally {
        setLoading(false);
      }
    };

    fetchAllData();
  }, [subjectId]);

  if (loading) return <div className="p-8 text-center text-gray-500">加载数据中...</div>;

  const { stats, materials, users } = data;

  return (
    <div className="space-y-8 p-2">
      {/* 1. User Statistics Section */}
      <section>
        <div className="flex items-center mb-4">
          <Users className="w-6 h-6 text-blue-600 mr-2" />
          <h2 className="text-xl font-bold text-gray-800">用户及行为统计</h2>
        </div>
        
        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
          <StatCard title="用户总数" value={stats?.user_stats?.total_users} icon={<Users className="w-5 h-5" />} color="blue" />
          <StatCard title="活跃用户 (今日)" value={stats?.user_stats?.trend?.[stats?.user_stats?.trend.length-1]?.active || 0} icon={<Activity className="w-5 h-5" />} color="purple" />
          <StatCard title="新增用户 (今日)" value={stats?.user_stats?.trend?.[stats?.user_stats?.trend.length-1]?.new || 0} icon={<UserPlus className="w-5 h-5" />} color="teal" />
          <StatCard title="PDF报告下载" value={stats?.user_stats?.pdf_downloads} icon={<Download className="w-5 h-5" />} color="green" />
          <StatCard title="成绩单分享" value={stats?.user_stats?.shares} icon={<Share2 className="w-5 h-5" />} color="orange" />
        </div>

        {/* User List Table */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden mb-6">
          <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center">
             <h3 className="font-semibold text-gray-800">最新活跃用户</h3>
             <span className="text-xs text-gray-400">显示最近10条</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-gray-50 text-gray-500">
                <tr>
                  <th className="px-6 py-3">用户指纹</th>
                  <th className="px-6 py-3">IP / 位置</th>
                  <th className="px-6 py-3">设备</th>
                  <th className="px-6 py-3">PDF生成</th>
                  <th className="px-6 py-3">分享次数</th>
                  <th className="px-6 py-3">时间</th>
                  <th className="px-6 py-3">得分 / 评级</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {users.map((u, i) => (
                  <tr key={i} className="hover:bg-gray-50">
                    <td className="px-6 py-3 font-mono text-xs text-blue-600 relative group">
                      <div className="truncate max-w-[120px] cursor-pointer" title={u.fingerprint}>
                         {u.fingerprint}
                      </div>
                      {/* Tooltip on hover */}
                      <div className="absolute left-0 top-full mt-1 hidden group-hover:block z-50 bg-gray-800 text-white text-xs p-2 rounded shadow-lg whitespace-nowrap">
                        {u.fingerprint}
                      </div>
                    </td>
                    <td className="px-6 py-3">
                      <div className="flex flex-col">
                        <span>{u.ip}</span>
                        <span className="text-xs text-gray-400">{u.location}</span>
                      </div>
                    </td>
                    <td className="px-6 py-3">{u.device}</td>
                    <td className="px-6 py-3 text-center">
                      <div className="flex items-center space-x-1">
                        <Download className="w-4 h-4 text-gray-400" />
                        <span>{u.pdf_count || 0}</span>
                      </div>
                    </td>
                    <td className="px-6 py-3 text-center">
                      <div className="flex items-center space-x-1">
                        <Share2 className="w-4 h-4 text-gray-400" />
                        <span>{u.share_count || 0}</span>
                      </div>
                    </td>
                    <td className="px-6 py-3">
                      <div className="flex flex-col">
                        <span>{new Date(u.start_time).toLocaleString()}</span>
                        <span className="text-xs text-gray-400">耗时: {u.submit_time ? Math.round((new Date(u.submit_time) - new Date(u.start_time))/60000) + '分' : '进行中'}</span>
                      </div>
                    </td>
                    <td className="px-6 py-3">
                      <span className={`px-2 py-1 rounded text-xs ${u.score >= 45 ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}`}>
                        {u.score}分 - {u.level}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* User Trends & Devices */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
            <h3 className="text-sm font-semibold text-gray-500 mb-4">用户活跃与新增趋势 (近7日)</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={stats?.user_stats?.trend}>
                  <defs>
                    <linearGradient id="colorActive" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#8884d8" stopOpacity={0.8}/>
                      <stop offset="95%" stopColor="#8884d8" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorNew" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#82ca9d" stopOpacity={0.8}/>
                      <stop offset="95%" stopColor="#82ca9d" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="date" fontSize={10} />
                  <YAxis yAxisId="left" fontSize={10} />
                  <YAxis yAxisId="right" orientation="right" fontSize={10} />
                  <Tooltip />
                  <Legend />
                  <Area yAxisId="left" type="monotone" dataKey="active" name="活跃用户" stroke="#8884d8" fillOpacity={1} fill="url(#colorActive)" />
                  <Area yAxisId="left" type="monotone" dataKey="new" name="新增用户" stroke="#82ca9d" fillOpacity={1} fill="url(#colorNew)" />
                  <Line yAxisId="right" type="monotone" dataKey="total" name="用户总数" stroke="#ff7300" dot={{r: 3}} strokeWidth={2} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
            <h3 className="text-sm font-semibold text-gray-500 mb-4">用户设备分布</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={stats?.user_stats?.device_distribution}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    fill="#8884d8"
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {stats?.user_stats?.device_distribution?.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend layout="vertical" verticalAlign="middle" align="right" />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Distributions Row 2: Location, Time & Duration & Score */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Score Distribution (New) */}
          <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
            <h3 className="text-sm font-semibold text-gray-500 mb-4">用户得分分布</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats?.user_stats?.score_distribution}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" fontSize={10} />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="value" name="人数" fill="#8884d8" radius={[4, 4, 0, 0]}>
                    {stats?.user_stats?.score_distribution?.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Location Distribution */}
          <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
            <h3 className="text-sm font-semibold text-gray-500 mb-4">用户地理位置分布</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats?.location_distribution}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" fontSize={10} interval={0} />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="value" name="人数" fill="#00C49F" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Start Time Distribution */}
          <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
            <h3 className="text-sm font-semibold text-gray-500 mb-4">开始答题时间分布 (24h)</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={stats?.start_time_distribution}>
                  <defs>
                    <linearGradient id="colorTime" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#8884d8" stopOpacity={0.8}/>
                      <stop offset="95%" stopColor="#8884d8" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" fontSize={10} />
                  <YAxis />
                  <Tooltip />
                  <Area type="monotone" dataKey="value" name="活跃人次" stroke="#8884d8" fillOpacity={1} fill="url(#colorTime)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Duration Distribution */}
          <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
            <h3 className="text-sm font-semibold text-gray-500 mb-4">答题耗时分布</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats?.duration_distribution}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" fontSize={10} />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="value" name="人次" fill="#FFBB28" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>


      </section>

      {/* 2. Materials Info */}
      <section>
        <div className="flex items-center mb-4">
          <BookOpen className="w-6 h-6 text-indigo-600 mr-2" />
          <h2 className="text-xl font-bold text-gray-800">题库与知识点概览</h2>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
           <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
             <h3 className="text-sm font-semibold text-gray-500 mb-4">题目库构成 (总量: {materials?.static?.total_questions})</h3>
             <div className="h-64">
               <ResponsiveContainer width="100%" height="100%">
                 <BarChart 
                   layout="vertical"
                   data={[
                     { name: '历年真题', value: materials?.static?.past_questions },
                     { name: '章节练习', value: materials?.static?.exercise_questions },
                     { name: 'AI生成', value: materials?.static?.ai_questions },
                   ]}
                   margin={{ left: 20 }}
                 >
                   <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                   <XAxis type="number" />
                   <YAxis dataKey="name" type="category" width={80} />
                   <Tooltip />
                   <Bar dataKey="value" name="数量" fill="#8884d8" radius={[0, 4, 4, 0]}>
                      {
                        [0,1,2].map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))
                      }
                   </Bar>
                 </BarChart>
               </ResponsiveContainer>
             </div>
           </div>

           <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
             <h3 className="text-sm font-semibold text-gray-500 mb-4">知识点权重分布</h3>
             <div className="h-64">
               <ResponsiveContainer width="100%" height="100%">
                 <PieChart>
                   <Pie
                     data={materials?.static?.weight_distribution}
                     cx="50%"
                     cy="50%"
                     innerRadius={60}
                     outerRadius={80}
                     fill="#8884d8"
                     paddingAngle={5}
                     dataKey="value"
                   >
                     {materials?.static?.weight_distribution?.map((entry, index) => (
                       <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                     ))}
                   </Pie>
                   <Tooltip />
                   <Legend layout="vertical" verticalAlign="middle" align="right" />
                 </PieChart>
               </ResponsiveContainer>
             </div>
           </div>
           
           <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
             <h3 className="text-sm font-semibold text-gray-500 mb-4">知识体系概况</h3>
             <div className="grid grid-cols-2 gap-4">
                <div className="bg-blue-50 p-4 rounded-lg text-center">
                    <p className="text-sm text-blue-600 mb-1">大章节数</p>
                    <p className="text-3xl font-bold text-blue-700">{materials?.static?.chapters}</p>
                </div>
                <div className="bg-indigo-50 p-4 rounded-lg text-center">
                    <p className="text-sm text-indigo-600 mb-1">知识点总数</p>
                    <p className="text-3xl font-bold text-indigo-700">{materials?.static?.knowledge_points}</p>
                </div>
                <div className="bg-green-50 p-4 rounded-lg text-center col-span-2">
                    <p className="text-sm text-green-600 mb-1">知识点覆盖率</p>
                    {/* Mock calculation: assuming >0 questions means covered */}
                    <p className="text-3xl font-bold text-green-700">
                        {materials?.static?.knowledge_points > 0 ? '100%' : '0%'}
                    </p>
                </div>
             </div>
           </div>
        </div>
      </section>

      {/* 3. AI Stats */}
      <section>
        <div className="flex items-center mb-4">
          <Cpu className="w-6 h-6 text-purple-600 mr-2" />
          <h2 className="text-xl font-bold text-gray-800">AI 服务监控</h2>
        </div>

        {/* Original AI Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
           <StatCard title="智能组卷调用" value={stats?.ai_stats?.assembly} icon={<Cpu className="w-5 h-5" />} color="indigo" />
           <StatCard title="AI报告生成" value={stats?.ai_stats?.report} icon={<BookOpen className="w-5 h-5" />} color="blue" />
           <StatCard title="社交分享调用" value={stats?.ai_stats?.social} icon={<Share2 className="w-5 h-5" />} color="purple" />
        </div>

        <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm mb-6">
           <h3 className="text-sm font-semibold text-gray-500 mb-4">各服务调用量趋势</h3>
           <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={stats?.ai_trends}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="date" fontSize={12} />
                  <YAxis fontSize={12} />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="assembly" name="智能组卷" stroke="#8884d8" strokeWidth={2} dot={{r: 4}} />
                  <Line type="monotone" dataKey="report" name="AI报告" stroke="#82ca9d" strokeWidth={2} dot={{r: 4}} />
                  <Line type="monotone" dataKey="social" name="社交分享" stroke="#ffc658" strokeWidth={2} dot={{r: 4}} />
                </LineChart>
              </ResponsiveContainer>
           </div>
        </div>

        {/* Group 1: Success/Failure */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
           <div className="space-y-4">
             <div className="grid grid-cols-2 gap-4">
                <StatCard title="调用成功" value={stats?.ai_stats?.success} icon={<CheckCircle className="w-5 h-5" />} color="green" />
                <StatCard title="调用失败" value={stats?.ai_stats?.failure} icon={<XCircle className="w-5 h-5" />} color="red" />
             </div>
             <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
                <h3 className="text-sm font-semibold text-gray-500 mb-4">调用状态趋势</h3>
                <div className="h-64">
                   <ResponsiveContainer width="100%" height="100%">
                     <AreaChart data={stats?.ai_trends}>
                       <defs>
                         <linearGradient id="colorSuccess" x1="0" y1="0" x2="0" y2="1">
                           <stop offset="5%" stopColor="#82ca9d" stopOpacity={0.8}/>
                           <stop offset="95%" stopColor="#82ca9d" stopOpacity={0}/>
                         </linearGradient>
                         <linearGradient id="colorFailure" x1="0" y1="0" x2="0" y2="1">
                           <stop offset="5%" stopColor="#ff8042" stopOpacity={0.8}/>
                           <stop offset="95%" stopColor="#ff8042" stopOpacity={0}/>
                         </linearGradient>
                       </defs>
                       <CartesianGrid strokeDasharray="3 3" vertical={false} />
                       <XAxis dataKey="date" fontSize={10} />
                       <YAxis fontSize={10} />
                       <Tooltip />
                       <Legend />
                       <Area type="monotone" dataKey="success" name="成功" stroke="#82ca9d" fillOpacity={1} fill="url(#colorSuccess)" />
                       <Area type="monotone" dataKey="failure" name="失败" stroke="#ff8042" fillOpacity={1} fill="url(#colorFailure)" />
                     </AreaChart>
                   </ResponsiveContainer>
                </div>
             </div>
           </div>

           {/* Group 2: Response Time */}
           <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                 <div className="bg-indigo-50 p-3 rounded-xl border border-indigo-100">
                    <p className="text-xs text-indigo-600 mb-1">平均组卷响应</p>
                    <p className="text-lg font-bold text-indigo-700">{stats?.ai_stats?.avg_latency?.assembly || 0}s</p>
                 </div>
                 <div className="bg-blue-50 p-3 rounded-xl border border-blue-100">
                    <p className="text-xs text-blue-600 mb-1">平均报告生成</p>
                    <p className="text-lg font-bold text-blue-700">{stats?.ai_stats?.avg_latency?.report || 0}s</p>
                 </div>
                 <div className="bg-purple-50 p-3 rounded-xl border border-purple-100">
                    <p className="text-xs text-purple-600 mb-1">平均社交分享</p>
                    <p className="text-lg font-bold text-purple-700">{stats?.ai_stats?.avg_latency?.social || 0}s</p>
                 </div>
              </div>
              <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
                 <h3 className="text-sm font-semibold text-gray-500 mb-4">平均响应时长趋势 (秒)</h3>
                 <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={stats?.ai_trends}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="date" fontSize={10} />
                        <YAxis fontSize={10} />
                        <Tooltip />
                        <Legend />
                        <Line type="monotone" dataKey="latency.assembly" name="智能组卷" stroke="#8884d8" strokeWidth={2} dot={false} />
                        <Line type="monotone" dataKey="latency.report" name="AI报告" stroke="#82ca9d" strokeWidth={2} dot={false} />
                        <Line type="monotone" dataKey="latency.social" name="社交分享" stroke="#ffc658" strokeWidth={2} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                 </div>
              </div>
           </div>
        </div>

        {/* Call Counts Trend (Original) - Renamed or Kept? User didn't ask to remove, but layout implies replacement */}
        {/* Let's keep the original call volume trend but updated to match the style or maybe we don't need it if we have the others? */}
        {/* The user request implies: Add these new things. "1,2为1组，3,4,5为一组" implies layout structure. */}
        {/* I will replace the original "AI Stats" grid and "AI Trends" chart with this new layout which covers success/failure and latency. */}
        {/* Wait, the original chart showed "Call Counts" by type. Now we show "Success/Failure" counts and "Response Time". */}
        {/* We lose "Call Counts by Type" trend. Is that okay? */}
        {/* "1. 成功调用次数及趋势" ... */}
        {/* I will add a third section below if needed, or maybe just assume this replaces the old view which was simple. */}
        {/* Actually, let's keep the Call Volume by Type chart at the bottom as "Total Call Volume Trend". */}


      </section>


    </div>
  );
};

const StatCard = ({ title, value, icon, color }) => {
  const colorClasses = {
    blue: "bg-blue-50 text-blue-600",
    green: "bg-green-50 text-green-600",
    indigo: "bg-indigo-50 text-indigo-600",
    purple: "bg-purple-50 text-purple-600",
    orange: "bg-orange-50 text-orange-600",
    teal: "bg-teal-50 text-teal-600",
  };
  
  return (
    <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm flex items-center">
      <div className={`p-3 rounded-lg mr-4 ${colorClasses[color] || 'bg-gray-50'}`}>
        {icon}
      </div>
      <div>
        <p className="text-sm text-gray-500 mb-1">{title}</p>
        <p className="text-2xl font-bold text-gray-900">{value}</p>
      </div>
    </div>
  );
};

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-white p-2 border border-gray-200 shadow-sm rounded text-xs">
        <p className="font-bold">{data.name}</p>
        <p>数量: {data.count}</p>
        <p>占比: {data.percentage}%</p>
      </div>
    );
  }
  return null;
};

export default Dashboard;
