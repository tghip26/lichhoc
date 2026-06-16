"use client";

import { Toaster } from "react-hot-toast";

export default function ToastProvider() {
  return (
    <Toaster 
      position="top-right" 
      toastOptions={{
        style: {
          background: 'rgba(255, 255, 255, 0.9)',
          backdropFilter: 'blur(10px)',
          color: 'var(--text-primary)',
          boxShadow: 'var(--glass-shadow)',
          borderRadius: '12px',
          padding: '16px',
          border: '1px solid rgba(255, 255, 255, 0.4)',
        },
        success: {
          iconTheme: {
            primary: 'var(--success)',
            secondary: 'white',
          },
        },
        error: {
          iconTheme: {
            primary: 'var(--danger)',
            secondary: 'white',
          },
        },
      }} 
    />
  );
}
