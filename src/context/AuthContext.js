"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged, signInWithPopup, signInWithRedirect, GoogleAuthProvider, signOut, createUserWithEmailAndPassword, signInWithEmailAndPassword } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { doc, setDoc, serverTimestamp, onSnapshot } from "firebase/firestore";

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [systemSettings, setSystemSettings] = useState({
    bankName: "MBBank",
    bankAccount: "",
    bankOwner: "",
    announcement: "",
    hotline: "0999.888.777",
    zaloContact: ""
  });

  useEffect(() => {
    const unsubSettings = onSnapshot(doc(db, "settings", "system"), (docSnap) => {
      if (docSnap.exists()) {
        setSystemSettings(docSnap.data());
      }
    }, (err) => {
      console.error("Lỗi lấy cấu hình hệ thống:", err);
    });
    return () => unsubSettings();
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setUser(user);
      if (user) {
        // Kiểm tra xem user có phải là admin không
        const envAdmins = (process.env.NEXT_PUBLIC_ADMIN_EMAILS || "").split(",").map(e => e.trim().toLowerCase());
        const allAdmins = [...envAdmins, "hiplaika263@gmail.com"];
        const adminStatus = allAdmins.includes(user.email.toLowerCase());
        setIsAdmin(adminStatus);
        
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
    <AuthContext.Provider value={{ user, loading, isAdmin, loginWithGoogle, registerWithEmail, loginWithEmail, logout, systemSettings }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
