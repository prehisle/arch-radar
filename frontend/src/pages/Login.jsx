import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import CryptoJS from 'crypto-js';
import { buildApiUrl } from '../utils/apiBase';

const ADMIN_PATH = import.meta.env.VITE_ADMIN_PATH || '/admin-secret';

const SECRET_KEY = "your-secret-key-please-change-it";

function Login() {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [captchaCode, setCaptchaCode] = useState('');
  const [captchaId, setCaptchaId] = useState('');
  const [captchaImage, setCaptchaImage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const fetchCaptcha = async () => {
    try {
      // Clean up previous captcha image URL
      if (captchaImage) {
        URL.revokeObjectURL(captchaImage);
      }

      const res = await axios.get(buildApiUrl('/api/auth/captcha'), {
        responseType: 'blob'
      });
      // Axios headers are lowercase
      const id = res.headers['x-captcha-id'];
      console.log('Captcha Headers:', res.headers);
      console.log('Got Captcha ID:', id);
      
      if (!id) {
          console.error("Captcha ID missing in response headers");
          // Fallback check for different casing if axios didn't normalize
          const rawId = res.headers['X-Captcha-ID'];
          if (rawId) {
              setCaptchaId(rawId);
              console.log('Got Captcha ID (Case Sensitive):', rawId);
          }
      } else {
          setCaptchaId(id);
      }
      
      const url = URL.createObjectURL(res.data);
      setCaptchaImage(url);
    } catch (e) {
      console.error("Failed to load captcha", e);
    }
  };

  useEffect(() => {
    fetchCaptcha();
    // Clean up
    return () => {
      if (captchaImage) URL.revokeObjectURL(captchaImage);
    };
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    console.log("Starting login process...");
    setError('');
    setLoading(true);

    try {
      console.log("Preparing encryption key...");
      // Encrypt password
      const keyStr = SECRET_KEY.substring(0, 16).padEnd(16, '\0');
      const key = CryptoJS.enc.Utf8.parse(keyStr);
      console.log("Encrypting password...");
      const encryptedPassword = CryptoJS.AES.encrypt(password, key, {
          mode: CryptoJS.mode.ECB,
          padding: CryptoJS.pad.Pkcs7
      }).toString();
      console.log("Password encrypted.");

      console.log("Sending login request...");
      const res = await axios.post(buildApiUrl('/api/auth/login'), {
        username,
        password: encryptedPassword,
        captcha_code: captchaCode,
        captcha_id: captchaId
      });
      
      console.log("Login successful.");
      const { access_token } = res.data;
      localStorage.setItem('admin_token', access_token);
      navigate(ADMIN_PATH);
    } catch (err) {
      console.error("Login failed:", err);
      let errorMsg = '登录失败，请重试';
      if (err.response) {
          errorMsg = err.response.data.detail || errorMsg;
      } else if (err.message) {
          errorMsg = err.message;
      }
      setError(errorMsg);
      fetchCaptcha(); // Refresh captcha on error
      setCaptchaCode('');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center">
      <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-md">
        <h2 className="text-2xl font-bold mb-6 text-center text-gray-800">系统管理登录</h2>
        
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-gray-700 text-sm font-bold mb-2">用户名</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
              required
            />
          </div>

          <div>
            <label className="block text-gray-700 text-sm font-bold mb-2">密码</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
              required
            />
          </div>

          <div>
            <label className="block text-gray-700 text-sm font-bold mb-2">验证码</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={captchaCode}
                onChange={(e) => setCaptchaCode(e.target.value)}
                className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                placeholder="输入验证码"
                required
              />
              {captchaImage && (
                <img 
                  src={captchaImage} 
                  alt="Captcha" 
                  className="h-10 cursor-pointer border rounded"
                  onClick={fetchCaptcha}
                  title="点击刷新"
                />
              )}
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className={`w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline transition duration-150 ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            {loading ? '登录中...' : '登录'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default Login;
