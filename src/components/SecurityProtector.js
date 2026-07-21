"use client";

import { useEffect, useState } from "react";

export default function SecurityProtector() {
  const [isOnline, setIsOnline] = useState(true);
  const [showToast, setShowToast] = useState(false);
  const [toastType, setToastType] = useState("online"); // "online" or "offline"

  useEffect(() => {
    // 1. Network Status Listeners
    if (typeof window !== "undefined") {
      setIsOnline(navigator.onLine);

      const handleOnline = () => {
        setIsOnline(true);
        setToastType("online");
        setShowToast(true);
        setTimeout(() => setShowToast(false), 5000);
      };

      const handleOffline = () => {
        setIsOnline(false);
        setToastType("offline");
        setShowToast(true);
      };

      window.addEventListener("online", handleOnline);
      window.addEventListener("offline", handleOffline);

      // 2. Source Code & Inspection Prevention
      const handleContextMenu = (e) => {
        // Prevent right click menu
        e.preventDefault();
      };

      const handleKeyDown = (e) => {
        // Prevent F12, Ctrl+Shift+I, Ctrl+Shift+J, Ctrl+Shift+C, Ctrl+U
        if (
          e.key === "F12" ||
          (e.ctrlKey && e.shiftKey && (e.key === "I" || e.key === "J" || e.key === "C" || e.key === "K" || e.keyCode === 73 || e.keyCode === 74 || e.keyCode === 67)) ||
          (e.ctrlKey && (e.key === "u" || e.keyCode === 85))
        ) {
          e.preventDefault();
          return false;
        }
      };

      document.addEventListener("contextmenu", handleContextMenu);
      document.addEventListener("keydown", handleKeyDown);

      return () => {
        window.removeEventListener("online", handleOnline);
        window.removeEventListener("offline", handleOffline);
        document.removeEventListener("contextmenu", handleContextMenu);
        document.removeEventListener("keydown", handleKeyDown);
      };
    }
  }, []);

  if (!showToast && isOnline) return null;

  return (
    <div
      style={{
        position: "fixed",
        bottom: "24px",
        right: "24px",
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        gap: "12px",
        padding: "14px 20px",
        borderRadius: "16px",
        background: toastType === "offline" ? "rgba(239, 68, 68, 0.9)" : "rgba(16, 185, 129, 0.9)",
        backdropFilter: "blur(12px)",
        boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.3)",
        border: toastType === "offline" ? "1px solid rgba(239, 68, 68, 0.2)" : "1px solid rgba(16, 185, 129, 0.2)",
        color: "white",
        fontFamily: "var(--font-plus-jakarta), sans-serif",
        fontSize: "0.88rem",
        fontWeight: "700",
        transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
        animation: "slideIn 0.3s ease-out"
      }}
    >
      {toastType === "offline" ? (
        <>
          <span style={{ fontSize: "1.2rem" }}>⚠️</span>
          <div>
            <div style={{ margin: 0, fontWeight: "800" }}>Mất kết nối mạng!</div>
            <div style={{ margin: 0, fontSize: "0.78rem", fontWeight: "500", opacity: 0.9 }}>Bản nháp đang nhập sẽ tự lưu trên thiết bị.</div>
          </div>
        </>
      ) : (
        <>
          <span style={{ fontSize: "1.2rem" }}>🟢</span>
          <div>
            <div style={{ margin: 0, fontWeight: "800" }}>Đã kết nối lại!</div>
            <div style={{ margin: 0, fontSize: "0.78rem", fontWeight: "500", opacity: 0.9 }}>Đang đồng bộ dữ liệu lên hệ thống.</div>
          </div>
        </>
      )}

      {/* Animation styles */}
      <style jsx global>{`
        @keyframes slideIn {
          from {
            transform: translateY(20px) scale(0.95);
            opacity: 0;
          }
          to {
            transform: translateY(0) scale(1);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
}
