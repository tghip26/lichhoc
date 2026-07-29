"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { db } from "@/lib/firebase";
import { collection, query, orderBy, onSnapshot, limit } from "firebase/firestore";

export default function Home() {
  const { user, loading, isAdmin, loginWithGoogle, loginWithEmail, registerWithEmail, systemSettings } = useAuth();
  const router = useRouter();
  
  const [isLoginMode, setIsLoginMode] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [authError, setAuthError] = useState("");
  const [processing, setProcessing] = useState(false);
  const [isInAppBrowser, setIsInAppBrowser] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [reviews, setReviews] = useState([]);

  useEffect(() => {
    // Lấy tối đa 50 đánh giá mới nhất rồi sắp xếp ở phía máy khách
    const qReviews = query(collection(db, "reviews"), limit(50));
    const unsubscribeReviews = onSnapshot(qReviews, (snapshot) => {
      const rData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      rData.sort((a, b) => {
        const timeA = a.createdAt ? (a.createdAt.toMillis ? a.createdAt.toMillis() : new Date(a.createdAt).getTime()) : 0;
        const timeB = b.createdAt ? (b.createdAt.toMillis ? b.createdAt.toMillis() : new Date(b.createdAt).getTime()) : 0;
        return timeB - timeA;
      });
      setReviews(rData.slice(0, 6));
    }, (err) => console.error("Lỗi tải reviews:", err));

    return () => unsubscribeReviews();
  }, []);

  useEffect(() => {
    if (user && !loading) {
      if (isAdmin) {
        router.push("/admin");
      } else {
        router.push("/dashboard");
      }
    }
  }, [user, loading, isAdmin, router]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const ua = navigator.userAgent || navigator.vendor || window.opera;
      const isZalo = ua.indexOf("Zalo") > -1;
      const isMessenger = ua.indexOf("Messenger") > -1 || ua.indexOf("FBAN") > -1 || ua.indexOf("FBAV") > -1;
      
      if (isZalo || isMessenger) {
        setIsInAppBrowser(true);
        const ios = /iPad|iPhone|iPod/.test(ua) && !window.MSStream;
        setIsIOS(ios);

        // Nếu là Android, tự động dùng cơ chế Intent để ép mở bằng Chrome
        if (!ios) {
          const cleanUrl = window.location.href.replace(/^https?:\/\//, "");
          window.location.href = `intent://${cleanUrl}#Intent;scheme=https;package=com.android.chrome;end`;
        }
      }
    }
  }, []);

  if (isInAppBrowser) {
    return (
      <div style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: "#0f172a",
        color: "white",
        zIndex: 99999,
        padding: "2rem",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        fontFamily: "system-ui, -apple-system, sans-serif"
      }}>
        {/* Mũi tên động nhấp nháy chỉ lên góc trên bên phải trên iPhone */}
        {isIOS && (
          <div style={{
            position: "absolute",
            top: "20px",
            right: "20px",
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-end",
            animation: "bounce 1.5s infinite"
          }}>
            <svg style={{ width: "40px", height: "40px", color: "#f59e0b", transform: "rotate(-45deg)" }} fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
            <span style={{ fontSize: "0.85rem", color: "#f59e0b", fontWeight: "700", marginTop: "5px" }}>Ấn vào dấu 3 chấm ở đây!</span>
          </div>
        )}

        <div style={{
          background: "rgba(255,255,255,0.05)",
          padding: "2rem",
          borderRadius: "24px",
          border: "1px solid rgba(255,255,255,0.1)",
          maxWidth: "400px",
          width: "100%",
          boxShadow: "0 25px 50px -12px rgba(0,0,0,0.5)"
        }}>
          <div style={{
            width: "70px",
            height: "70px",
            background: "rgba(239, 68, 68, 0.15)",
            borderRadius: "50%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#ef4444",
            margin: "0 auto 1.5rem auto"
          }}>
            <svg style={{ width: "36px", height: "36px" }} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>

          <h2 style={{ fontSize: "1.4rem", fontWeight: "800", marginBottom: "1rem", color: "#f59e0b" }}>Hạn Chế Trình Duyệt Nhúng</h2>
          
          <p style={{ fontSize: "0.95rem", color: "#94a3b8", lineHeight: "1.6", marginBottom: "1.5rem" }}>
            Google đã chặn tính năng đăng nhập trên trình duyệt của Zalo / Messenger để bảo mật tài khoản.
          </p>

          {isIOS ? (
            <div style={{ textAlign: "left", background: "rgba(255,255,255,0.03)", padding: "1.25rem", borderRadius: "16px", border: "1px solid rgba(255,255,255,0.05)", fontSize: "0.9rem" }}>
              <span style={{ fontWeight: "700", color: "#f59e0b", display: "block", marginBottom: "8px" }}>👉 Để đăng nhập bằng Google:</span>
              1. Bấm vào biểu tượng <strong>Ba Chấm (...)</strong> ở góc trên bên phải màn hình.<br/><br/>
              2. Chọn <strong>"Mở bằng trình duyệt"</strong> (hoặc <strong>"Mở bằng Safari"</strong>).
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <a 
                href={`intent://${window.location.href.replace(/^https?:\/\//, "")}#Intent;scheme=https;package=com.android.chrome;end`}
                style={{
                  background: "var(--primary)",
                  color: "white",
                  padding: "0.8rem",
                  borderRadius: "12px",
                  fontWeight: "600",
                  textDecoration: "none",
                  display: "inline-block",
                  boxShadow: "0 4px 12px rgba(22, 163, 74, 0.3)"
                }}
              >
                Mở bằng Google Chrome
              </a>
              <p style={{ fontSize: "0.8rem", color: "#64748b", marginTop: "10px" }}>
                Nếu không tự chuyển, vui lòng ấn vào dấu ba chấm ở góc trên bên phải và chọn "Mở bằng trình duyệt".
              </p>
            </div>
          )}
        </div>

        {/* Keyframe hiệu ứng nhấp nháy cho mũi tên */}
        <style dangerouslySetInnerHTML={{__html: `
          @keyframes bounce {
            0%, 100% { transform: translateY(0) rotate(-45deg); }
            50% { transform: translateY(-10px) rotate(-45deg); }
          }
        `}} />
      </div>
    );
  }

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
        await registerWithEmail(email, password, phone);
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
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      {systemSettings?.announcement && (
        <div style={{
          background: "linear-gradient(90deg, #d97706, #f59e0b)",
          color: "white",
          padding: "4px 8px",
          textAlign: "center",
          fontSize: "0.78rem",
          fontWeight: "600",
          boxShadow: "0 2px 4px rgba(0,0,0,0.05)"
        }}>
          <marquee scrollamount="5" style={{ verticalAlign: "middle" }}>📢 {systemSettings.announcement}</marquee>
        </div>
      )}
      <div style={{ maxWidth: "1200px", margin: "1.5rem auto 3rem auto", padding: "0 1.25rem", flex: 1, position: "relative" }}>
        
        {/* Soft Background Ambient Glows */}
        <div style={{ position: "absolute", top: "-50px", left: "10%", width: "300px", height: "300px", background: "radial-gradient(circle, rgba(22, 163, 74, 0.08) 0%, transparent 70%)", pointerEvents: "none", zIndex: 0 }}></div>
        <div style={{ position: "absolute", top: "100px", right: "5%", width: "350px", height: "350px", background: "radial-gradient(circle, rgba(16, 185, 129, 0.08) 0%, transparent 70%)", pointerEvents: "none", zIndex: 0 }}></div>

        <div style={{ 
          display: "grid", 
          gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", 
          gap: "2.5rem", 
          alignItems: "center", 
          marginBottom: "3.5rem",
          position: "relative",
          zIndex: 1
        }}>
          {/* Left Column: Ultra-Luxury Modern SaaS Intro */}
          <div style={{ textAlign: "left" }}>
            <div style={{ 
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              background: "linear-gradient(135deg, rgba(22, 163, 74, 0.1) 0%, rgba(16, 185, 129, 0.05) 100%)", 
              color: "var(--primary)", 
              fontSize: "0.78rem", 
              padding: "6px 14px", 
              borderRadius: "30px", 
              fontWeight: "800",
              letterSpacing: "0.5px",
              textTransform: "uppercase",
              border: "1px solid rgba(22, 163, 74, 0.25)",
              boxShadow: "0 2px 10px rgba(22, 163, 74, 0.05)",
              marginBottom: "1rem"
            }}>
              <span style={{ fontSize: "0.9rem" }}>✨</span> HỆ THỐNG TRỰC LỚP & ĐẶT LỊCH HỌC HỘ UY TÍN
            </div>
            
            <h1 className="page-title" style={{ fontSize: "2.55rem", color: "var(--foreground)", lineHeight: "1.22", fontWeight: "850", letterSpacing: "-0.5px" }}>
              Nền Tảng Trực Lớp & Học Tập <span style={{ background: "linear-gradient(135deg, #16a34a 0%, #10b981 50%, #059669 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>Chuyên Nghiệp & Bảo Mật 100%</span>
            </h1>
            
            <p style={{ color: "var(--text-secondary)", fontSize: "0.98rem", marginTop: "0.85rem", marginBottom: "1.75rem", lineHeight: "1.65", maxWidth: "540px" }}>
              Giải pháp kết nối học viên và đội ngũ Cộng tác viên sinh viên uy tín từ các trường ĐH hàng đầu. Đặt ca học chỉ 1 phút, nhận báo giá minh bạch và thanh toán VietQR tự động 24/7.
            </p>

            {/* Luxury 4 Pillar Cards */}
            <div style={{ 
              display: "grid", 
              gridTemplateColumns: "repeat(2, 1fr)", 
              gap: "12px", 
              marginBottom: "1.75rem" 
            }}>
              {[
                { icon: "🛡️", title: "Bảo mật tuyệt đối", desc: "Che 100% thông tin sinh viên" },
                { icon: "⚡", title: "Đặt ca siêu tốc", desc: "Tự động điền hồ sơ ca học" },
                { icon: "🎓", title: "CTV Tuyển Chọn", desc: "SV khá giỏi Bách Khoa, ĐHQG..." },
                { icon: "💳", title: "Ví QR 24/7", desc: "Nạp tiền tự động & đối soát" }
              ].map((f, idx) => (
                <div key={idx} style={{ 
                  background: "rgba(255, 255, 255, 0.9)", 
                  backdropFilter: "blur(12px)",
                  border: "1px solid rgba(226, 232, 240, 0.85)", 
                  borderRadius: "16px", 
                  padding: "12px 14px", 
                  display: "flex", 
                  alignItems: "center", 
                  gap: "12px",
                  boxShadow: "0 4px 15px rgba(0,0,0,0.02)",
                  transition: "all 0.25s cubic-bezier(0.16, 1, 0.3, 1)"
                }}>
                  <div style={{ 
                    width: "38px", height: "38px", borderRadius: "10px", 
                    background: "rgba(22, 163, 74, 0.08)", color: "var(--primary)",
                    display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.2rem", flexShrink: 0
                  }}>
                    {f.icon}
                  </div>
                  <div>
                    <div style={{ fontSize: "0.85rem", fontWeight: "800", color: "var(--text-primary)", lineHeight: "1.3" }}>{f.title}</div>
                    <div style={{ fontSize: "0.72rem", color: "var(--text-secondary)", marginTop: "2px" }}>{f.desc}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* Interactive 3-Step Process Pipeline */}
            <div style={{ 
              background: "linear-gradient(135deg, rgba(22, 163, 74, 0.05) 0%, rgba(16, 185, 129, 0.03) 100%)",
              border: "1px solid rgba(22, 163, 74, 0.2)",
              borderRadius: "18px",
              padding: "14px 16px",
              boxShadow: "0 4px 20px rgba(22, 163, 74, 0.04)"
            }}>
              <div style={{ fontSize: "0.75rem", fontWeight: "850", color: "var(--primary)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "10px" }}>
                🚀 Quy trình 3 bước trải nghiệm siêu nhanh:
              </div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "6px", flexWrap: "wrap" }}>
                <div style={{ fontSize: "0.78rem", fontWeight: "750", color: "#1e293b", background: "white", padding: "6px 12px", borderRadius: "10px", border: "1px solid #e2e8f0", boxShadow: "0 2px 4px rgba(0,0,0,0.02)" }}>
                  1. 📝 Đăng ca học
                </div>
                <span style={{ color: "var(--primary)", fontWeight: "800", fontSize: "0.85rem" }}>➔</span>
                <div style={{ fontSize: "0.78rem", fontWeight: "750", color: "#1e293b", background: "white", padding: "6px 12px", borderRadius: "10px", border: "1px solid #e2e8f0", boxShadow: "0 2px 4px rgba(0,0,0,0.02)" }}>
                  2. 💰 Admin báo giá
                </div>
                <span style={{ color: "var(--primary)", fontWeight: "800", fontSize: "0.85rem" }}>➔</span>
                <div style={{ fontSize: "0.78rem", fontWeight: "800", color: "#16a34a", background: "#dcfce7", padding: "6px 12px", borderRadius: "10px", border: "1px solid #86efac", boxShadow: "0 2px 6px rgba(22, 163, 74, 0.15)" }}>
                  3. 🎓 Duyệt & Xếp CTV
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Ultra-Luxury Card Authentication */}
          {!user && (
            <div id="auth-form-card" style={{ maxWidth: "440px", width: "100%", justifySelf: "center" }}>
              <div className="glass-panel modal-pop-in" style={{ padding: "2.25rem 2rem", borderTop: isLoginMode ? "5px solid var(--primary)" : "5px solid #F59E0B", borderRadius: "24px", background: "rgba(255, 255, 255, 0.95)", backdropFilter: "blur(24px)", boxShadow: "0 20px 45px -10px rgba(0,0,0,0.06), 0 0 0 1px rgba(255,255,255,0.8) inset" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "10px", marginBottom: "1.25rem" }}>
                  {isLoginMode ? (
                    <>
                      <div style={{ background: "rgba(22, 163, 74, 0.1)", padding: "10px", borderRadius: "14px", color: "var(--primary)" }}>
                        <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1"></path></svg>
                      </div>
                      <h2 style={{ fontSize: "1.45rem", margin: 0, fontWeight: "850", color: "var(--text-primary)" }}>Đăng Nhập</h2>
                    </>
                  ) : (
                    <>
                      <div style={{ background: "rgba(245, 158, 11, 0.15)", padding: "10px", borderRadius: "14px", color: "#D97706" }}>
                        <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"></path></svg>
                      </div>
                      <h2 style={{ fontSize: "1.45rem", margin: 0, fontWeight: "850", color: "#D97706" }}>Đăng Ký Mới</h2>
                    </>
                  )}
                </div>
                
                <p style={{ color: "var(--text-secondary)", fontSize: "0.88rem", marginBottom: "1.4rem", textAlign: "center", lineHeight: "1.5" }}>
                  {isLoginMode ? "Chào mừng trở lại! Vui lòng đăng nhập tài khoản hệ thống." : "Đăng ký nhanh tài khoản mới để trải nghiệm dịch vụ."}
                </p>

                {authError && (
                  <div style={{ padding: "10px 14px", backgroundColor: "rgba(239, 68, 68, 0.08)", color: "var(--danger)", borderRadius: "12px", marginBottom: "1.25rem", fontSize: "0.85rem", border: "1px solid rgba(239, 68, 68, 0.25)" }}>
                    {authError}
                  </div>
                )}

                <form onSubmit={handleSubmit} style={{ marginBottom: "1.25rem" }}>
                  <div className="form-group" style={{ marginBottom: "1rem" }}>
                    <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="form-input" placeholder="Email của bạn" style={{ background: "white", border: isLoginMode ? "1.5px solid #cbd5e1" : "1.5px solid #fde68a" }} />
                  </div>
                  {!isLoginMode && (
                    <div className="form-group" style={{ marginBottom: "1rem" }}>
                      <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} required className="form-input" placeholder="Số điện thoại của bạn" style={{ background: "white", border: "1.5px solid #fde68a" }} />
                    </div>
                  )}
                  <div className="form-group" style={{ marginBottom: "1.25rem" }}>
                    <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required className="form-input" placeholder={isLoginMode ? "Mật khẩu" : "Tạo Mật khẩu (Từ 6 ký tự)"} minLength={isLoginMode ? 1 : 6} style={{ background: "white", border: isLoginMode ? "1.5px solid #cbd5e1" : "1.5px solid #fde68a" }} />
                  </div>
                  <button type="submit" className="btn" style={{ width: "100%", padding: "0.85rem", fontSize: "1rem", fontWeight: "850", background: isLoginMode ? "linear-gradient(135deg, #16a34a 0%, #15803d 100%)" : "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)", color: "white", boxShadow: isLoginMode ? "0 6px 20px rgba(22, 163, 74, 0.3)" : "0 6px 20px rgba(245, 158, 11, 0.3)", border: "none", borderRadius: "14px" }} disabled={processing}>
                    {processing ? "Đang xử lý..." : (isLoginMode ? "🚀 Đăng Nhập Ngay" : "✨ Tạo Tài Khoản Mới")}
                  </button>
                </form>

                <div style={{ textAlign: "center", fontSize: "0.9rem", color: "var(--text-secondary)" }}>
                  {isLoginMode ? (
                    <>Chưa có tài khoản? <span onClick={() => { setIsLoginMode(false); setAuthError(""); setEmail(""); setPassword(""); setPhone(""); }} style={{ color: "var(--primary)", fontWeight: "750", cursor: "pointer", textDecoration: "underline" }}>Đăng ký ngay</span></>
                  ) : (
                    <>Đã có tài khoản? <span onClick={() => { setIsLoginMode(true); setAuthError(""); setEmail(""); setPassword(""); setPhone(""); }} style={{ color: "#D97706", fontWeight: "750", cursor: "pointer", textDecoration: "underline" }}>Đăng nhập</span></>
                  )}
                </div>

                {isLoginMode && (
                  <>
                    <div style={{ display: "flex", alignItems: "center", margin: "1.25rem 0" }}>
                      <div style={{ flex: 1, height: "1px", background: "#e2e8f0" }}></div>
                      <span style={{ padding: "0 10px", color: "#94a3b8", fontSize: "0.78rem", fontWeight: "700" }}>HOẶC</span>
                      <div style={{ flex: 1, height: "1px", background: "#e2e8f0" }}></div>
                    </div>

                    <button onClick={handleGoogleLogin} className="btn" style={{ width: "100%", background: "white", border: "1.5px solid #cbd5e1", color: "var(--text-primary)", boxShadow: "0 2px 6px rgba(0,0,0,0.03)", borderRadius: "14px", padding: "0.75rem", fontSize: "0.9rem", fontWeight: "750" }}>
                      <svg style={{ width: "18px", height: "18px", marginRight: "10px" }} viewBox="0 0 24 24">
                        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                      </svg>
                      Đăng nhập với Google
                    </button>
                  </>
                )}
              </div>
            </div>
          )}
        </div>

        {/* REVIEWS SECTION */}
        <div style={{ marginTop: "3.5rem", borderTop: "1px solid rgba(0,0,0,0.06)", paddingTop: "2.5rem", width: "100%" }}>
          <div style={{ textAlign: "center", marginBottom: "2rem" }}>
            <span style={{ background: "rgba(22, 163, 74, 0.08)", color: "var(--primary)", padding: "4px 12px", borderRadius: "20px", fontSize: "0.78rem", fontWeight: "800", textTransform: "uppercase", letterSpacing: "0.5px" }}>
              ⭐ ĐÁNH GIÁ TỪ HỌC VIÊN
            </span>
            <h2 style={{ fontSize: "1.75rem", color: "var(--text-primary)", margin: "0.5rem 0 0.4rem 0", fontWeight: "850" }}>
              Trải nghiệm thực tế từ người dùng
            </h2>
            <p style={{ color: "var(--text-secondary)", fontSize: "0.92rem", maxWidth: "600px", margin: "0 auto" }}>
              Sự tin tưởng và hài lòng từ các bạn là động lực để Thuê Học Pro không ngừng nâng cao chất lượng dịch vụ.
            </p>
          </div>
          
          {reviews.length === 0 ? (
            <div style={{ textAlign: "center", color: "var(--text-secondary)", fontStyle: "italic", fontSize: "0.9rem", padding: "2rem", background: "white", borderRadius: "18px", border: "1px solid #e2e8f0" }}>
              Chưa có lượt đánh giá nào. Hãy là người đầu tiên trải nghiệm dịch vụ!
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "1.25rem" }}>
              {reviews.map((r) => (
                <div key={r.id} style={{ padding: "1.35rem", borderRadius: "20px", display: "flex", flexDirection: "column", justifyContent: "space-between", background: "white", border: "1px solid #e2e8f0", boxShadow: "0 6px 20px rgba(0,0,0,0.02)", transition: "transform 0.2s" }}>
                  <div>
                    <div style={{ color: "#FBBC05", fontSize: "1.1rem", marginBottom: "0.6rem" }}>
                      {"★".repeat(r.rating)}{"☆".repeat(5 - r.rating)}
                    </div>
                    <p style={{ color: "var(--text-primary)", fontSize: "0.9rem", fontStyle: "italic", margin: "0 0 1rem 0", lineHeight: "1.6" }}>
                      "{r.comment}"
                    </p>
                  </div>
                  <div style={{ borderTop: "1px dashed #f1f5f9", paddingTop: "0.8rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontWeight: "800", color: "var(--text-primary)", fontSize: "0.82rem" }}>{r.userName}</span>
                    <span style={{ background: "rgba(22, 163, 74, 0.08)", color: "var(--primary)", padding: "3px 10px", borderRadius: "10px", fontSize: "0.72rem", fontWeight: "800" }}>{r.school}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
