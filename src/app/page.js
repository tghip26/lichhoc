"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";

export default function Home() {
  const { user, loading, isAdmin, loginWithGoogle, loginWithEmail, registerWithEmail } = useAuth();
  const router = useRouter();
  
  const [isLoginMode, setIsLoginMode] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    if (user && !loading) {
      if (isAdmin) {
        router.push("/admin");
      } else {
        router.push("/dashboard");
      }
    }
  }, [user, loading, isAdmin, router]);

  if (loading) {
    return <div className="loader"></div>;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setAuthError("");
    setProcessing(true);
    try {
      if (isLoginMode) {
        await loginWithEmail(email, password);
      } else {
        await registerWithEmail(email, password);
      }
    } catch (err) {
      console.error(err);
      if (err.code === "auth/invalid-credential" || err.code === "auth/wrong-password" || err.code === "auth/user-not-found") {
        setAuthError("Email hoặc mật khẩu không chính xác.");
      } else if (err.code === "auth/email-already-in-use") {
        setAuthError("Email này đã được sử dụng. Vui lòng đăng nhập.");
      } else if (err.code === "auth/weak-password") {
        setAuthError("Mật khẩu quá yếu. Vui lòng chọn mật khẩu từ 6 ký tự trở lên.");
      } else {
        setAuthError("Có lỗi xảy ra: " + err.message);
      }
    } finally {
      setProcessing(false);
    }
  };

  const handleGoogleLogin = async () => {
    setAuthError("");
    try {
      await loginWithGoogle();
    } catch (err) {
      setAuthError("Không thể đăng nhập bằng Google: " + err.message);
    }
  };

  return (
    <div style={{ maxWidth: "800px", margin: "4rem auto", padding: "0 1rem" }}>
      <div style={{ textAlign: "center", marginBottom: "2.5rem" }}>
        <h1 className="page-title" style={{ fontSize: "2.2rem", color: "var(--primary)" }}>Hệ Thống Thuê Học Pro</h1>
        <p style={{ color: "var(--text-secondary)", fontSize: "1.1rem", maxWidth: "600px", margin: "0 auto", lineHeight: "1.6" }}>
          Giải pháp kết nối sinh viên và người học hộ nhanh chóng, an toàn và bảo mật tuyệt đối. Gửi đơn thuê học chỉ trong 1 phút!
        </p>
      </div>

      {!user && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "2rem" }}>
          
          {/* CỘT ĐĂNG NHẬP (Dành cho Khách Cũ) */}
          <div className="glass-panel" style={{ padding: "2.5rem 2rem", borderTop: "5px solid var(--primary)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "1.5rem" }}>
              <div style={{ background: "var(--primary-light)", padding: "10px", borderRadius: "12px", color: "var(--primary)" }}>
                <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1"></path></svg>
              </div>
              <h2 style={{ fontSize: "1.4rem", margin: 0 }}>Đăng Nhập</h2>
            </div>
            
            <p style={{ color: "var(--text-secondary)", fontSize: "0.9rem", marginBottom: "1.5rem" }}>Dành cho người dùng đã có tài khoản.</p>

            {authError && isLoginMode && (
              <div style={{ padding: "10px", backgroundColor: "rgba(239, 68, 68, 0.1)", color: "var(--danger)", borderRadius: "8px", marginBottom: "1.5rem", fontSize: "0.85rem", border: "1px solid rgba(239, 68, 68, 0.3)" }}>
                {authError}
              </div>
            )}

            <form onSubmit={(e) => { setIsLoginMode(true); handleSubmit(e); }} style={{ marginBottom: "1.5rem" }}>
              <div className="form-group">
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="form-input" placeholder="Email của bạn" style={{ background: "rgba(255,255,255,0.7)" }} />
              </div>
              <div className="form-group">
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required className="form-input" placeholder="Mật khẩu" style={{ background: "rgba(255,255,255,0.7)" }} />
              </div>
              <button type="submit" className="btn btn-primary" style={{ width: "100%", padding: "0.8rem", fontSize: "1rem" }} disabled={processing}>
                {processing && isLoginMode ? "Đang xử lý..." : "Đăng Nhập Ngay"}
              </button>
            </form>

            <div style={{ display: "flex", alignItems: "center", margin: "1.5rem 0" }}>
              <div style={{ flex: 1, height: "1px", background: "#E5E7EB" }}></div>
              <span style={{ padding: "0 10px", color: "#9CA3AF", fontSize: "0.8rem" }}>HOẶC</span>
              <div style={{ flex: 1, height: "1px", background: "#E5E7EB" }}></div>
            </div>

            <button onClick={handleGoogleLogin} className="btn" style={{ width: "100%", background: "white", border: "1px solid #D1D5DB", color: "var(--text-primary)", boxShadow: "0 2px 5px rgba(0,0,0,0.02)" }}>
              <svg style={{ width: "18px", height: "18px", marginRight: "10px" }} viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
              </svg>
              Google
            </button>
          </div>

          {/* CỘT ĐĂNG KÝ (Dành cho Khách Mới) */}
          <div className="glass-panel" style={{ padding: "2.5rem 2rem", borderTop: "5px solid #F59E0B" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "1.5rem" }}>
              <div style={{ background: "rgba(245, 158, 11, 0.15)", padding: "10px", borderRadius: "12px", color: "#D97706" }}>
                <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"></path></svg>
              </div>
              <h2 style={{ fontSize: "1.4rem", margin: 0, color: "#D97706" }}>Đăng Ký Mới</h2>
            </div>
            
            <p style={{ color: "var(--text-secondary)", fontSize: "0.9rem", marginBottom: "1.5rem" }}>Lần đầu đến với hệ thống? Đăng ký ngay để trải nghiệm.</p>

            {authError && !isLoginMode && (
              <div style={{ padding: "10px", backgroundColor: "rgba(239, 68, 68, 0.1)", color: "var(--danger)", borderRadius: "8px", marginBottom: "1.5rem", fontSize: "0.85rem", border: "1px solid rgba(239, 68, 68, 0.3)" }}>
                {authError}
              </div>
            )}

            <form onSubmit={(e) => { setIsLoginMode(false); handleSubmit(e); }}>
              <div className="form-group">
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="form-input" placeholder="Nhập Email mới" style={{ background: "rgba(255,255,255,0.7)", border: "1px solid #FCD34D" }} />
              </div>
              <div className="form-group">
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required className="form-input" placeholder="Tạo Mật khẩu (Từ 6 ký tự)" minLength={6} style={{ background: "rgba(255,255,255,0.7)", border: "1px solid #FCD34D" }} />
              </div>
              <button type="submit" className="btn" style={{ width: "100%", padding: "0.8rem", fontSize: "1rem", background: "#F59E0B", color: "white", boxShadow: "0 4px 14px rgba(245, 158, 11, 0.3)" }} disabled={processing}>
                {processing && !isLoginMode ? "Đang xử lý..." : "Tạo Tài Khoản"}
              </button>
            </form>
            
            <div style={{ marginTop: "1.5rem", padding: "1rem", background: "rgba(245, 158, 11, 0.05)", borderRadius: "8px", border: "1px dashed #FCD34D", color: "#92400E", fontSize: "0.85rem", display: "flex", gap: "10px" }}>
              <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" style={{ flexShrink: 0 }}><path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
              Việc tạo tài khoản hoàn toàn miễn phí. Dữ liệu của bạn được bảo mật tuyệt đối.
            </div>
          </div>

        </div>
      )}
    </div>
  );
}
