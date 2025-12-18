import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Upload, Database, Settings, Trash2, Edit2, Search, Save, X, FileText, LayoutDashboard, LogOut } from 'lucide-react';
import axios from 'axios';
import Dashboard from '../components/Dashboard';
import { 
  uploadAdminFile, getAdminData, deleteAdminData, updateAdminData, 
  getAIConfig, updateAIConfig 
} from '../api';

const ADMIN_PATH = import.meta.env.VITE_ADMIN_PATH || '/admin-secret';

const Admin = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [message, setMessage] = useState('');

  const showMessage = (msg, type = 'success') => {
    setMessage({ text: msg, type });
    setTimeout(() => setMessage(''), 5000);
  };

  const handleLogout = async () => {
    if (confirm('确定要退出登录吗？')) {
      try {
          console.log("Logging out...");
          const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
          await axios.post(`${baseUrl}/api/auth/logout`, {}, {
              headers: {
                  'Authorization': `Bearer ${localStorage.getItem('admin_token')}`
              }
          });
          console.log("Logout API called.");
      } catch (e) {
          console.warn("Logout failed on server:", e);
      } finally {
          localStorage.removeItem('admin_token');
          navigate(`${ADMIN_PATH}/login`);
      }
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900">后台管理系统</h1>
            <button 
                onClick={handleLogout}
                className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            >
                <LogOut className="w-4 h-4" />
                退出登录
            </button>
        </div>

        {/* Tabs */}
        <div className="flex space-x-4 mb-6 border-b border-gray-200 overflow-x-auto">
          <TabButton 
            active={activeTab === 'dashboard'} 
            onClick={() => setActiveTab('dashboard')} 
            icon={<LayoutDashboard className="w-4 h-4 mr-2" />}
            label="仪表盘" 
          />
          <TabButton 
            active={activeTab === 'upload'} 
            onClick={() => setActiveTab('upload')} 
            icon={<Upload className="w-4 h-4 mr-2" />}
            label="数据录入" 
          />
          <TabButton 
            active={activeTab === 'data'} 
            onClick={() => setActiveTab('data')} 
            icon={<Database className="w-4 h-4 mr-2" />}
            label="数据管理" 
          />
          <TabButton 
            active={activeTab === 'ai'} 
            onClick={() => setActiveTab('ai')} 
            icon={<Settings className="w-4 h-4 mr-2" />}
            label="AI 配置" 
          />
        </div>

        {/* Message Banner */}
        {message && (
          <div className={`mb-6 p-4 rounded-lg ${message.type === 'error' ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
            {message.text}
          </div>
        )}

        {/* Content */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 min-h-[500px] p-6">
          {activeTab === 'dashboard' && <Dashboard />}
          {activeTab === 'upload' && <UploadSection showMessage={showMessage} />}
          {activeTab === 'data' && <DataManagementSection showMessage={showMessage} />}
          {activeTab === 'ai' && <AIConfigSection showMessage={showMessage} />}
        </div>
      </div>
    </div>
  );
};

const TabButton = ({ active, onClick, icon, label }) => (
  <button
    onClick={onClick}
    className={`flex items-center px-6 py-3 font-medium transition-colors border-b-2 ${
      active 
        ? 'border-blue-600 text-blue-600' 
        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
    }`}
  >
    {icon}
    {label}
  </button>
);

// --- 1. Upload Section ---
const UploadSection = ({ showMessage }) => {
  const [loading, setLoading] = useState(false);

  const handleUpload = async (endpoint, file, extraParams = {}) => {
    if (!file) {
      showMessage("请选择文件", "error");
      return;
    }

    setLoading(true);
    try {
      const res = await uploadAdminFile(endpoint, file, extraParams);
      showMessage(res.message);
    } catch (err) {
      showMessage("上传失败: " + (err.response?.data?.detail || err.message), "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid md:grid-cols-2 gap-8">
      <UploadCard 
        title="1. 考试大纲 (Syllabus)" 
        desc="上传 Markdown 格式的考试大纲，构建知识点树状结构。"
        accept=".md"
        onUpload={(f) => handleUpload('syllabus', f)}
        loading={loading}
        color="blue"
        icon={<FileText className="w-6 h-6" />}
      />
      <UploadCard 
        title="2. 知识点权重表" 
        desc="上传包含权重的 Markdown 表格，关联知识点与重要性。"
        accept=".md"
        onUpload={(f) => handleUpload('weights', f)}
        loading={loading}
        color="indigo"
        icon={<FileText className="w-6 h-6" />}
      />
      <UploadCard 
        title="3. 历年真题" 
        desc="上传历年真题 Markdown 文件，系统将自动关联知识点。"
        accept=".md"
        onUpload={(f) => handleUpload('questions', f, { source_type: 'past_paper' })}
        loading={loading}
        color="green"
        icon={<FileText className="w-6 h-6" />}
      />
      <UploadCard 
        title="4. 知识点练习题" 
        desc="上传知识点专项练习题。"
        accept=".md"
        onUpload={(f) => handleUpload('questions', f, { source_type: 'exercise' })}
        loading={loading}
        color="purple"
        icon={<FileText className="w-6 h-6" />}
      />
    </div>
  );
};

const UploadCard = ({ title, desc, accept, onUpload, loading, color, icon }) => {
    const [file, setFile] = useState(null);
    const colorClasses = {
        blue: "bg-blue-50 text-blue-700 border-blue-200",
        indigo: "bg-indigo-50 text-indigo-700 border-indigo-200",
        green: "bg-green-50 text-green-700 border-green-200",
        purple: "bg-purple-50 text-purple-700 border-purple-200",
    };
    const btnClasses = {
        blue: "bg-blue-600 hover:bg-blue-700",
        indigo: "bg-indigo-600 hover:bg-indigo-700",
        green: "bg-green-600 hover:bg-green-700",
        purple: "bg-purple-600 hover:bg-purple-700",
    };

    return (
        <div className={`p-6 rounded-xl border ${colorClasses[color]} bg-opacity-30`}>
            <div className="flex items-center mb-4">
                <div className={`p-2 rounded-lg ${colorClasses[color]} bg-white bg-opacity-50 mr-3`}>
                    {icon}
                </div>
                <h3 className="font-bold text-lg">{title}</h3>
            </div>
            <p className="text-sm opacity-80 mb-4 min-h-[40px]">{desc}</p>
            <div className="flex flex-col space-y-3">
                <input 
                    type="file" 
                    accept={accept}
                    onChange={(e) => setFile(e.target.files[0])}
                    className="block w-full text-sm file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-white file:text-gray-700 hover:file:bg-gray-100"
                />
                <button
                    onClick={() => onUpload(file)}
                    disabled={loading || !file}
                    className={`w-full py-2 px-4 rounded-lg text-white font-medium transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed ${btnClasses[color]}`}
                >
                    {loading ? '上传中...' : '点击上传'}
                </button>
            </div>
        </div>
    );
};

// --- 2. Data Management Section ---
const DataManagementSection = ({ showMessage }) => {
    const [subTab, setSubTab] = useState('kps'); // 'kps' or 'questions'
    const [data, setData] = useState([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(0);
    const [search, setSearch] = useState('');
    const [editing, setEditing] = useState(null); // Item being edited

    useEffect(() => {
        fetchData();
    }, [subTab, page, search]); // Re-fetch on change

    const fetchData = async () => {
        try {
            const res = await getAdminData(subTab, page, 20, search);
            setData(res.data);
            setTotal(res.total);
        } catch (e) {
            console.error(e);
            showMessage("加载数据失败", "error");
        }
    };

    const handleDelete = async (id) => {
        if (!confirm("确定要删除此项吗？")) return;
        try {
            await deleteAdminData(subTab, id);
            showMessage("删除成功");
            fetchData();
        } catch (e) {
            showMessage("删除失败", "error");
        }
    };

    const handleSave = async (id, newData) => {
        try {
            await updateAdminData(subTab, id, newData);
            showMessage("更新成功");
            setEditing(null);
            fetchData();
        } catch (e) {
            showMessage("更新失败", "error");
        }
    };

    return (
        <div>
            {/* Sub Tabs */}
            <div className="flex space-x-2 mb-6 bg-gray-100 p-1 rounded-lg inline-flex">
                <button
                    onClick={() => { setSubTab('kps'); setPage(0); }}
                    className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${subTab === 'kps' ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
                >
                    知识点管理
                </button>
                <button
                    onClick={() => { setSubTab('questions'); setPage(0); }}
                    className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${subTab === 'questions' ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
                >
                    题目管理
                </button>
            </div>

            {/* Search */}
            <div className="flex mb-4">
                <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                    <input 
                        type="text"
                        placeholder="搜索..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto border rounded-lg">
                <table className="w-full text-sm text-left">
                    <thead className="bg-gray-50 text-gray-500 font-medium">
                        <tr>
                            <th className="p-3">ID</th>
                            {subTab === 'kps' ? (
                                <>
                                    <th className="p-3">章节</th>
                                    <th className="p-3">知识点名称</th>
                                    <th className="p-3">权重</th>
                                </>
                            ) : (
                                <>
                                    <th className="p-3">内容预览</th>
                                    <th className="p-3">类型</th>
                                    <th className="p-3">知识点</th>
                                    <th className="p-3">答案</th>
                                </>
                            )}
                            <th className="p-3 text-right">操作</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                        {data.map(item => (
                            <tr key={item.id} className="hover:bg-gray-50">
                                <td className="p-3 text-gray-500">#{item.id}</td>
                                {subTab === 'kps' ? (
                                    <>
                                        <td className="p-3">{item.chapter}</td>
                                        <td className="p-3 font-medium">{item.name}</td>
                                        <td className="p-3">
                                            <span className={`px-2 py-1 rounded text-xs ${
                                                item.weight_level === '核心' ? 'bg-red-100 text-red-700' : 
                                                item.weight_level === '重要' ? 'bg-yellow-100 text-yellow-700' : 
                                                'bg-gray-100 text-gray-600'
                                            }`}>
                                                {item.weight_level} ({item.weight_score})
                                            </span>
                                        </td>
                                    </>
                                ) : (
                                    <>
                                        <td className="p-3 max-w-xs truncate" title={item.content}>{item.content}</td>
                                        <td className="p-3">
                                            <span className="px-2 py-1 bg-blue-50 text-blue-600 rounded text-xs">{item.source_type}</span>
                                        </td>
                                        <td className="p-3 text-sm">
                                            {item.knowledge_point ? (
                                                <div className="flex flex-col">
                                                    <span className="font-medium text-gray-900">{item.knowledge_point.name}</span>
                                                    <span className="text-xs text-gray-500 truncate max-w-[150px]" title={item.knowledge_point.chapter}>
                                                        {item.knowledge_point.chapter}
                                                    </span>
                                                </div>
                                            ) : (
                                                <span className="text-gray-400">-</span>
                                            )}
                                        </td>
                                        <td className="p-3 font-mono">{item.answer}</td>
                                    </>
                                )}
                                <td className="p-3 text-right space-x-2">
                                    <button onClick={() => setEditing(item)} className="p-1 text-blue-600 hover:bg-blue-50 rounded">
                                        <Edit2 className="w-4 h-4" />
                                    </button>
                                    <button onClick={() => handleDelete(item.id)} className="p-1 text-red-600 hover:bg-red-50 rounded">
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Pagination */}
            <div className="flex justify-between items-center mt-4 text-sm text-gray-500">
                <span>显示 {data.length} / {total} 项</span>
                <div className="space-x-2">
                    <button 
                        disabled={page === 0}
                        onClick={() => setPage(p => p - 1)}
                        className="px-3 py-1 border rounded hover:bg-gray-50 disabled:opacity-50"
                    >
                        上一页
                    </button>
                    <button 
                        disabled={(page + 1) * 20 >= total}
                        onClick={() => setPage(p => p + 1)}
                        className="px-3 py-1 border rounded hover:bg-gray-50 disabled:opacity-50"
                    >
                        下一页
                    </button>
                </div>
            </div>

            {/* Edit Modal */}
            {editing && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-bold">编辑项目 #{editing.id}</h3>
                            <button onClick={() => setEditing(null)} className="text-gray-400 hover:text-gray-600">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        
                        <EditForm 
                            item={editing} 
                            type={subTab} 
                            onSave={(newData) => handleSave(editing.id, newData)}
                        />
                    </div>
                </div>
            )}
        </div>
    );
};

const EditForm = ({ item, type, onSave }) => {
    const [formData, setFormData] = useState({ ...item });

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    return (
        <div className="space-y-4">
            {type === 'kps' ? (
                <>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">章节</label>
                        <input name="chapter" value={formData.chapter} onChange={handleChange} className="w-full border p-2 rounded" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">名称</label>
                        <input name="name" value={formData.name} onChange={handleChange} className="w-full border p-2 rounded" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700">权重等级</label>
                            <select name="weight_level" value={formData.weight_level} onChange={handleChange} className="w-full border p-2 rounded">
                                <option>核心</option>
                                <option>重要</option>
                                <option>一般</option>
                                <option>冷门</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">分数</label>
                            <input type="number" name="weight_score" value={formData.weight_score} onChange={handleChange} className="w-full border p-2 rounded" />
                        </div>
                    </div>
                </>
            ) : (
                <>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">题目内容</label>
                        <textarea name="content" value={formData.content} onChange={handleChange} rows={4} className="w-full border p-2 rounded" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">答案</label>
                        <select name="answer" value={formData.answer} onChange={handleChange} className="w-full border p-2 rounded">
                            <option>A</option>
                            <option>B</option>
                            <option>C</option>
                            <option>D</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">解析</label>
                        <textarea name="explanation" value={formData.explanation} onChange={handleChange} rows={3} className="w-full border p-2 rounded" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">关联知识点ID (可选)</label>
                        <div className="flex items-center space-x-2">
                            <input type="number" name="knowledge_point_id" value={formData.knowledge_point_id || ''} onChange={handleChange} className="w-24 border p-2 rounded" />
                            {item.knowledge_point && (
                                <div className="text-sm bg-gray-50 px-2 py-1 rounded border border-gray-200">
                                    <span className="font-bold text-gray-700">{item.knowledge_point.name}</span>
                                    <span className="text-gray-500 ml-1 text-xs">({item.knowledge_point.chapter})</span>
                                </div>
                            )}
                        </div>
                        <p className="text-xs text-gray-500 mt-1">输入知识点ID进行关联修正</p>
                    </div>
                </>
            )}
            
            <div className="pt-4 flex justify-end space-x-3">
                <button className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700" onClick={() => {
                    // Strip complex objects before saving
                    const { knowledge_point, ...payload } = formData;
                    onSave(payload);
                }}>
                    保存更改
                </button>
            </div>
        </div>
    );
};

// --- 3. AI Config Section ---
const AIConfigSection = ({ showMessage }) => {
    const [config, setConfig] = useState({});
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        loadConfig();
    }, []);

    const loadConfig = async () => {
        try {
            const data = await getAIConfig();
            setConfig(data);
        } catch (e) {
            console.error(e);
        }
    };

    const handleSave = async () => {
        setLoading(true);
        try {
            await updateAIConfig(config);
            showMessage("配置已保存");
        } catch (e) {
            showMessage("保存失败", "error");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-2xl">
            <h2 className="text-lg font-bold mb-6">AI 服务配置</h2>
            
            <div className="space-y-6">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Gemini API Key</label>
                    <input 
                        type="password" 
                        value={config.gemini_api_key || ''} 
                        onChange={(e) => setConfig({ ...config, gemini_api_key: e.target.value })}
                        className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-blue-500 outline-none"
                        placeholder="请输入 Google Gemini API Key"
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">模型接口地址 (可选)</label>
                    <input 
                        type="text" 
                        value={config.gemini_endpoint || ''} 
                        onChange={(e) => setConfig({ ...config, gemini_endpoint: e.target.value })}
                        className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-blue-500 outline-none"
                        placeholder="默认: https://generativelanguage.googleapis.com"
                    />
                </div>

                <div className="pt-4 border-t">
                    <h3 className="text-md font-semibold mb-3">提示词模板 (Prompt Templates)</h3>
                    
                    <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 mb-1">报告生成提示词</label>
                        <textarea 
                            value={config.prompt_report || ''} 
                            onChange={(e) => setConfig({ ...config, prompt_report: e.target.value })}
                            rows={4}
                            className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-blue-500 outline-none font-mono text-sm"
                            placeholder="用于生成分析报告的系统提示词..."
                        />
                    </div>
                    
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">社交分享提示词</label>
                        <textarea 
                            value={config.prompt_share || ''} 
                            onChange={(e) => setConfig({ ...config, prompt_share: e.target.value })}
                            rows={3}
                            className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-blue-500 outline-none font-mono text-sm"
                            placeholder="用于生成分享文案的系统提示词..."
                        />
                    </div>
                </div>

                <div className="pt-4">
                    <button 
                        onClick={handleSave}
                        disabled={loading}
                        className="px-6 py-3 bg-blue-600 text-white rounded-lg shadow hover:bg-blue-700 flex items-center justify-center min-w-[120px]"
                    >
                        {loading ? '保存中...' : <><Save className="w-4 h-4 mr-2" /> 保存配置</>}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default Admin;
