import axios from 'axios';

const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

const api = axios.create({
  baseURL: BASE_URL,
});

// Mock fingerprint
const getFingerprint = () => {
  let fp = localStorage.getItem('fingerprint');
  if (!fp) {
    fp = 'user-' + Math.random().toString(36).substring(2, 15);
    localStorage.setItem('fingerprint', fp);
  }
  return fp;
};

export const startExam = async () => {
  const fp = getFingerprint();
  const res = await api.post('/api/exam/start', { user_fingerprint: fp });
  return res.data;
};

export const getSession = async (sessionId) => {
  // Use dedicated GET endpoint to avoid triggering new exam generation
  try {
      const res = await api.get(`/api/exam/session/${sessionId}`);
      return res.data;
  } catch (e) {
      // Fallback if not found (maybe session expired or invalid ID)
      // Or maybe we should redirect to start?
      throw e;
  }
};

export const syncAnswers = async (sessionId, answers) => {
    await api.post('/api/exam/sync', { session_id: sessionId, answers });
}

export const submitExam = async (sessionId) => {
  const res = await api.post('/api/exam/submit', { session_id: sessionId });
  return res.data;
};

export const getReport = async (sessionId) => {
  const res = await api.get(`/api/exam/report/${sessionId}`);
  return res.data;
};

export const getShareContent = async (sessionId) => {
  const res = await api.post('/api/exam/share', { session_id: sessionId });
  return res.data;
};

export const downloadReportPDF = async (sessionId) => {
    // 1. Download File
    const response = await api.get(`/api/exam/report/${sessionId}/pdf`, {
        responseType: 'blob', // Important for handling binary files
    });
    
    // Create a link element, hide it, click it, and then remove it
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    
    // Try to extract filename from content-disposition header
    const contentDisposition = response.headers['content-disposition'];
    let fileName = `Smart_Assessment_Report_${sessionId.substring(0,8)}.pdf`;
    if (contentDisposition) {
        const fileNameMatch = contentDisposition.match(/filename="?(.+)"?/);
        if (fileNameMatch && fileNameMatch.length === 2)
            fileName = fileNameMatch[1];
    }
    
    link.setAttribute('download', fileName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);

    // 2. Track Event
    try {
        await api.post('/api/exam/download-event', { session_id: sessionId });
    } catch (e) {
        console.warn("Failed to track download event", e);
    }
};

// --- Dashboard APIs ---

export const getDashboardUsers = async (limit = 20) => {
  const res = await api.get('/api/dashboard/users', { params: { limit } });
  return res.data;
};

export const getDashboardStats = async () => {
  const res = await api.get('/api/dashboard/stats');
  return res.data;
};

export const getMaterialStats = async () => {
  const res = await api.get('/api/dashboard/materials');
  return res.data;
};

// --- Admin APIs ---

export const uploadAdminFile = async (endpoint, file, extraParams = {}) => {
  const formData = new FormData();
  formData.append('file', file);
  
  const res = await api.post(`/api/admin/upload/${endpoint}`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    params: extraParams
  });
  return res.data;
};

export const getAdminData = async (type, page = 0, limit = 20, search = '') => {
  const endpoint = type === 'kps' ? 'knowledge_points' : 'questions';
  const res = await api.get(`/api/admin/${endpoint}`, {
    params: { skip: page * limit, limit, search }
  });
  return res.data;
};

export const deleteAdminData = async (type, id) => {
  const endpoint = type === 'kps' ? 'knowledge_points' : 'questions';
  const res = await api.delete(`/api/admin/${endpoint}/${id}`);
  return res.data;
};

export const updateAdminData = async (type, id, data) => {
  const endpoint = type === 'kps' ? 'knowledge_points' : 'questions';
  const res = await api.put(`/api/admin/${endpoint}/${id}`, data);
  return res.data;
};

export const getAIConfig = async () => {
  const res = await api.get('/api/admin/config');
  return res.data;
};

export const updateAIConfig = async (config) => {
  const res = await api.post('/api/admin/config', config);
  return res.data;
};

