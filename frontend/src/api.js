import axios from 'axios';
import { getApiBaseUrl } from './utils/apiBase';

const api = axios.create({
  baseURL: getApiBaseUrl(),
  timeout: 120000, // Increased to 120s for AI generation
});

// Request interceptor to add token
api.interceptors.request.use(config => {
  const token = localStorage.getItem('admin_token');
  const url = config.url || '';

  if (token && (url.includes('/admin') || url.includes('/dashboard'))) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor to handle 401
api.interceptors.response.use(
  response => response,
  error => {
    if (error.response && error.response.status === 401) {
       // Only redirect if we are in an admin context to avoid disrupting normal users
       if (window.location.pathname.includes(import.meta.env.VITE_ADMIN_PATH)) {
           localStorage.removeItem('admin_token');
           window.location.href = `${import.meta.env.VITE_ADMIN_PATH}/login`;
       }
    }
    return Promise.reject(error);
  }
);

// Mock fingerprint
const getFingerprint = () => {
  let fp = localStorage.getItem('fingerprint');
  if (!fp) {
    fp = 'user-' + Math.random().toString(36).substring(2, 15);
    localStorage.setItem('fingerprint', fp);
  }
  return fp;
};

export const getSubjects = async () => {
    const res = await api.get('/api/subjects');
    return res.data;
};

export const startExam = async (subjectId = 1) => {
  const fp = getFingerprint();
  const res = await api.post('/api/exam/start', { 
      user_fingerprint: fp,
      subject_id: subjectId
  });
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

export const getDashboardUsers = async (limit = 20, subjectId = null) => {
  const params = { limit };
  if (subjectId) params.subject_id = subjectId;
  const res = await api.get('/api/dashboard/users', { params });
  return res.data;
};

export const getDashboardStats = async () => {
  const res = await api.get('/api/dashboard/stats');
  return res.data;
};

export const getMaterialStats = async (subjectId = null) => {
  const params = {};
  if (subjectId) params.subject_id = subjectId;
  const res = await api.get('/api/dashboard/materials', { params });
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

export const getAdminData = async (type, page = 0, limit = 20, search = '', subjectId = null) => {
  const endpoint = type === 'kps' ? 'knowledge_points' : 'questions';
  const params = { skip: page * limit, limit, search };
  if (subjectId) params.subject_id = subjectId;
  const res = await api.get(`/api/admin/${endpoint}`, { params });
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

