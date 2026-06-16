"use client";

import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function Home() {
  const { user, loading, loginWithGoogle } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (user && !loading) {
      router.push("/dashboard");
    }
  }, [user, loading, router]);

  if (loading) {
    return <div className="loader"></div>;
  }

  return (
    <div className="glass-panel" style={{ maxWidth: "600px", margin: "4rem auto", textAlign: "center" }}>
      <h1 className="page-title" style={{ marginBottom: "1rem", fontSize: "2rem" }}>Hệ Thống Quản Lý Lịch Học</h1>
      <p style={{ color: "var(--text-secondary)", marginBottom: "2rem", lineHeight: "1.6" }}>
        Chào mừng bạn đến với hệ thống. Vui lòng đăng nhập bằng tài khoản Google để tải lên và quản lý lịch học của bạn.
      </p>
      
      {!user && (
        <button onClick={loginWithGoogle} className="btn btn-primary" style={{ padding: "0.8rem 1.5rem", fontSize: "1.1rem" }}>
          Đăng nhập bằng Google
        </button>
      )}
    </div>
  );
}
