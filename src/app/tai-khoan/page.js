"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { db } from "@/lib/firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { EmailAuthProvider, reauthenticateWithCredential, updatePassword, updateProfile } from "firebase/auth";
import toast from "react-hot-toast";

export default function TaiKhoan() {
  const { user, loading } = useAuth();
  const router = useRouter();

  const [displayName, setDisplayName] = useState("");
  const [phone, setPhone] = useState("");
  
  // Password state
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [updatingProfile, setUpdatingProfile] = useState(false);
  const [updatingPassword, setUpdatingPassword] = useState(false);

  // Kiểm tra xem người dùng có đăng nhập bằng Google hay không
  const isGoogleUser = user?.providerData?.some(prov => prov.providerId === "google.com");

  useEffect(() => {
    if (!loading && !user) {
      router.push("/");
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (user) {
      setDisplayName(user.displayName || user.email.split('@')[0]);
      
      const fetchUserData = async () => {
        try {
          const userDoc = await getDoc(doc(db, "users", user.uid));
          if (userDoc.exists()) {
            setPhone(userDoc.data().phone || "");
          }
        } catch (err) {
          console.error("Lỗi lấy thông tin người dùng từ Firestore:", err);
        }
      };
      
      fetchUserData();
    }
  }, [user]);

  if (loading || !user) {
    return <div className="loader"></div>;
  }

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setUpdatingProfile(true);
    const toastId = toast.loading("Đang cập nhật thông tin...");
    try {
      // 1. Cập nhật trên Firebase Auth Profile
      await updateProfile(user, {
        displayName: displayName
      });

      // 2. Cập nhật trên Firestore
      await setDoc(doc(db, "users", user.uid), {
        displayName: displayName,
        phone: phone
      }, { merge: true });

      toast.success("Cập nhật thông tin thành công!", { id: toastId });
    } catch (err) {
      console.error(err);
      toast.error("Có lỗi xảy ra: " + err.message, { id: toastId });
    } finally {
      setUpdatingProfile(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      toast.error("Mật khẩu mới phải từ 6 ký tự trở lên!");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("Xác nhận mật khẩu mới không trùng khớp!");
      return;
    }

    setUpdatingPassword(true);
    const toastId = toast.loading("Đang xác thực và đổi mật khẩu...");
    try {
      // 1. Xác thực lại bằng mật khẩu cũ
      const credential = EmailAuthProvider.credential(user.email, oldPassword);
      await reauthenticateWithCredential(user, credential);

      // 2. Đổi sang mật khẩu mới
      await updatePassword(user, newPassword);

      toast.success("Thay đổi mật khẩu thành công!", { id: toastId });
      setOldPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      console.error(err);
      if (err.code === "auth/wrong-password" || err.code === "auth/invalid-credential") {
        toast.error("Mật khẩu cũ không chính xác!", { id: toastId });
      } else {
        toast.error("Lỗi: " + err.message, { id: toastId });
      }
    } finally {
      setUpdatingPassword(false);
    }
  };

  return (
    <div className="container" style={{ padding: "2rem 1rem", maxWidth: "1000px" }}>
      <div style={{ marginBottom: "2rem" }}>
        <h1 className="page-title" style={{ fontSize: "2rem", margin: 0 }}>Cài đặt tài khoản</h1>
        <p style={{ color: "var(--text-secondary)", marginTop: "0.5rem" }}>
          Quản lý thông tin hồ sơ cá nhân và cài đặt bảo mật cho tài khoản của bạn.
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(380px, 1fr))", gap: "2rem" }}>
        
        {/* PANEL 1: CẬP NHẬT THÔNG TIN HỒ SƠ */}
        <div className="glass-panel" style={{ padding: "2rem" }}>
          <h2 style={{ fontSize: "1.25rem", fontWeight: "700", display: "flex", alignItems: "center", gap: "10px", color: "var(--text-primary)", marginBottom: "1.5rem" }}>
            <svg style={{ width: "22px", height: "22px", color: "var(--primary)" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            Thông tin cá nhân
          </h2>

          <form onSubmit={handleUpdateProfile}>
            <div className="form-group">
              <label className="form-label">Địa chỉ Email (Không thể thay đổi)</label>
              <input 
                type="email" 
                value={user.email} 
                disabled 
                className="form-input" 
                style={{ background: "#f1f5f9", cursor: "not-allowed" }}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Họ và Tên hiển thị</label>
              <input 
                type="text" 
                value={displayName} 
                onChange={(e) => setDisplayName(e.target.value)} 
                required 
                className="form-input" 
                placeholder="Nhập họ tên của bạn"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Số điện thoại</label>
              <input 
                type="tel" 
                value={phone} 
                onChange={(e) => setPhone(e.target.value)} 
                className="form-input" 
                placeholder="Ví dụ: 0912345678"
              />
            </div>

            <button 
              type="submit" 
              className="btn btn-primary" 
              style={{ width: "100%", marginTop: "1rem", padding: "0.8rem" }}
              disabled={updatingProfile}
            >
              {updatingProfile ? "Đang lưu..." : "Lưu thay đổi"}
            </button>
          </form>
        </div>

        {/* PANEL 2: ĐỔI MẬT KHẨU */}
        <div className="glass-panel" style={{ padding: "2rem" }}>
          <h2 style={{ fontSize: "1.25rem", fontWeight: "700", display: "flex", alignItems: "center", gap: "10px", color: "var(--text-primary)", marginBottom: "1.5rem" }}>
            <svg style={{ width: "22px", height: "22px", color: "#8b5cf6" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            Bảo mật & Mật khẩu
          </h2>

          {isGoogleUser ? (
            <div style={{
              background: "rgba(139, 92, 246, 0.05)",
              border: "1px dashed rgba(139, 92, 246, 0.3)",
              borderRadius: "16px",
              padding: "1.5rem",
              textAlign: "center",
              color: "var(--text-secondary)",
              fontSize: "0.9rem",
              lineHeight: "1.6"
            }}>
              <svg style={{ width: "40px", height: "40px", color: "#8b5cf6", margin: "0 auto 10px auto", display: "block" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Tài khoản của bạn được liên kết và đăng nhập bằng <strong>Google OAuth</strong>. 
              Bạn không cần đặt mật khẩu hoặc thay đổi mật khẩu tại đây.
            </div>
          ) : (
            <form onSubmit={handleChangePassword}>
              <div className="form-group">
                <label className="form-label">Mật khẩu cũ (Mật khẩu hiện tại)</label>
                <input 
                  type="password" 
                  value={oldPassword} 
                  onChange={(e) => setOldPassword(e.target.value)} 
                  required 
                  className="form-input" 
                  placeholder="••••••••"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Mật khẩu mới (Tối thiểu 6 ký tự)</label>
                <input 
                  type="password" 
                  value={newPassword} 
                  onChange={(e) => setNewPassword(e.target.value)} 
                  required 
                  className="form-input" 
                  placeholder="••••••••"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Xác nhận mật khẩu mới</label>
                <input 
                  type="password" 
                  value={confirmPassword} 
                  onChange={(e) => setConfirmPassword(e.target.value)} 
                  required 
                  className="form-input" 
                  placeholder="••••••••"
                />
              </div>

              <button 
                type="submit" 
                className="btn" 
                style={{ 
                  width: "100%", 
                  marginTop: "1rem", 
                  padding: "0.8rem", 
                  background: "#8b5cf6", 
                  color: "white" 
                }}
                disabled={updatingPassword}
                onMouseOver={e => e.currentTarget.style.background="#7c3aed"}
                onMouseOut={e => e.currentTarget.style.background="#8b5cf6"}
              >
                {updatingPassword ? "Đang đổi mật khẩu..." : "Thay đổi mật khẩu"}
              </button>
            </form>
          )}
        </div>

      </div>
    </div>
  );
}
