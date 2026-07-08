"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged, signInWithPopup, signInWithRedirect, GoogleAuthProvider, signOut, createUserWithEmailAndPassword, signInWithEmailAndPassword } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { doc, setDoc, getDoc, serverTimestamp, onSnapshot } from "firebase/firestore";

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [systemSettings, setSystemSettings] = useState(() => {
    // Thử đọc từ bộ nhớ đệm để cấu hình load lập tức
    if (typeof window !== "undefined") {
      const cached = localStorage.getItem("systemSettings");
      if (cached) {
        try {
          return JSON.parse(cached);
        } catch (e) {
          console.error("Lỗi parse cấu hình cache:", e);
        }
      }
    }
    // Giá trị cấu hình mặc định dự phòng chuẩn xác của bạn
    return {
      bankName: "MBBank",
      bankAccount: "2637979279",
      bankOwner: "TRUONG HOANG HIEP",
      announcement: "Đặt lịch học hộ -> Chờ thông báo xác nhận lịch qua Zalo theo SĐT đã đăng kí",
      hotline: "0852866856",
      zaloContact: "https://zalo.me/0852866856",
      telegramBotToken: "8987058324:AAGROX1cy0wWbausiuTKLYQ70AUoyiLEt4Q",
      telegramChatId: "5484109031"
    };
  });

  const sendTelegramAlert = async (text) => {
    try {
      const res = await fetch("/api/telegram", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ text })
      });
      if (!res.ok) {
        console.warn("Lỗi gửi Telegram từ Server API:", await res.text());
      }
    } catch (error) {
      console.error("Lỗi gửi tin nhắn Telegram:", error);
    }
  };

  useEffect(() => {
    const unsubSettings = onSnapshot(doc(db, "settings", "system"), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setSystemSettings(data);
        if (typeof window !== "undefined") {
          localStorage.setItem("systemSettings", JSON.stringify(data));
        }
      }
    }, (err) => {
      console.warn("Lỗi lấy cấu hình hệ thống (bình thường nếu khách chưa đăng nhập và chưa up rules):", err.message);
    });
    return () => unsubSettings();
  }, [user]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setUser(user);
      if (user) {
        // Kiểm tra xem user có phải là admin không
        const envAdmins = (process.env.NEXT_PUBLIC_ADMIN_EMAILS || "").split(",").map(e => e.trim().toLowerCase());
        const allAdmins = [...envAdmins, "hiplaika263@gmail.com"];
        const adminStatus = allAdmins.includes(user.email.toLowerCase());
        setIsAdmin(adminStatus);
        
        // Kiểm tra xem có phải đăng ký mới (chưa có tài liệu trên Firestore)
        try {
          const userDocRef = doc(db, "users", user.uid);
          const userDocSnap = await getDoc(userDocRef);
          if (!userDocSnap.exists()) {
            // Báo Telegram người dùng Google/Redirect mới
            sendTelegramAlert(`👤 <b>CÓ TÀI KHOẢN ĐĂNG KÝ MỚI!</b>\n\n• <b>Tên hiển thị:</b> ${user.displayName || user.email.split('@')[0]}\n• <b>Email:</b> ${user.email}\n• <b>Hình thức:</b> Liên kết ngoài (Google)\n• <b>Thời gian:</b> ${new Date().toLocaleString("vi-VN")}`);
          }
        } catch (err) {
          console.error("Lỗi kiểm tra người dùng mới:", err);
        }

        // Lưu/Cập nhật thông tin người dùng vào CSDL để quản lý
        try {
          await setDoc(doc(db, "users", user.uid), {
            uid: user.uid,
            email: user.email,
            displayName: user.displayName || user.email.split('@')[0],
            photoURL: user.photoURL || "",
            role: adminStatus ? "admin" : "user",
            lastLogin: serverTimestamp()
          }, { merge: true });
        } catch (err) {
          console.error("Không thể lưu user info:", err);
        }
      } else {
        setIsAdmin(false);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const loginWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    
    // Thuật toán phát hiện trình duyệt ẩn (In-app browsers) của Zalo, Messenger, FB, Tiktok...
    const ua = navigator.userAgent || navigator.vendor || window.opera;
    const isInAppBrowser = (ua.indexOf("FBAN") > -1) || (ua.indexOf("FBAV") > -1) || (ua.indexOf("Zalo") > -1) || (ua.indexOf("Instagram") > -1) || (ua.indexOf("TikTok") > -1) || (ua.indexOf("Messenger") > -1);

    try {
      if (isInAppBrowser) {
        // Bắt buộc dùng Redirect để phá vỡ lớp chặn Popup của Zalo/Mess
        await signInWithRedirect(auth, provider);
      } else {
        // Dùng Popup cho Chrome/Safari thông thường
        await signInWithPopup(auth, provider);
      }
    } catch (error) {
      console.error("Lỗi đăng nhập Google:", error);
      // Nếu Popup bị chặn (ngay cả trên trình duyệt thường), tự động chuyển sang Redirect
      if (error.code === 'auth/popup-blocked' || error.code === 'auth/popup-closed-by-user') {
        await signInWithRedirect(auth, provider);
      } else {
        throw error;
      }
    }
  };

  const registerWithEmail = async (email, password, phone) => {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    if (phone) {
      try {
        await setDoc(doc(db, "users", userCredential.user.uid), {
          phone: phone
        }, { merge: true });
      } catch (err) {
        console.error("Lỗi lưu số điện thoại:", err);
      }
    }
    
    // Gửi thông báo đăng ký tài khoản mới thủ công
    const phoneStr = phone ? `\n• <b>Số điện thoại:</b> ${phone}` : "";
    sendTelegramAlert(`👤 <b>CÓ TÀI KHOẢN ĐĂNG KÝ MỚI!</b>\n\n• <b>Email:</b> ${email}${phoneStr}\n• <b>Hình thức:</b> Tạo bằng Email\n• <b>Thời gian:</b> ${new Date().toLocaleString("vi-VN")}`);

    return userCredential;
  };

  const loginWithEmail = async (email, password) => {
    return signInWithEmailAndPassword(auth, email, password);
  };

  const logout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Lỗi đăng xuất:", error);
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, isAdmin, loginWithGoogle, registerWithEmail, loginWithEmail, logout, systemSettings, sendTelegramAlert }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
