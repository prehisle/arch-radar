import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Home from './pages/Home';
import Exam from './pages/Exam';
import Report from './pages/Report';
import Admin from './pages/Admin';
import Login from './pages/Login';
import PrivateRoute from './components/PrivateRoute';

const ADMIN_PATH = import.meta.env.VITE_ADMIN_PATH || '/admin-secret';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/exam" element={<Exam />} />
        <Route path="/report/:sessionId" element={<Report />} />
        
        {/* Admin Routes */}
        <Route path={`${ADMIN_PATH}/login`} element={<Login />} />
        <Route 
          path={ADMIN_PATH} 
          element={
            <PrivateRoute>
              <Admin />
            </PrivateRoute>
          } 
        />
        {/* Redirect old admin to 404 or home to avoid guessing */}
        <Route path="/admin" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
