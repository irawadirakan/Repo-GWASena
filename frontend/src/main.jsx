import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './styles.css';
import { useThemeStore } from './store/useThemeStore';

// Inisialisasi tema Dark/Light saat aplikasi pertama kali dimuat
useThemeStore.getState().initTheme();

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
