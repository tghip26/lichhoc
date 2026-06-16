"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged, signInWithPopup, GoogleAuthProvider, signOut, createUserWithEmailAndPassword, signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "@/lib/firebase";

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      if (user) {
        // Kiểm tra xem user có phải là admin không
        const envAdmins = (process.env.NEXT_PUBLIC_ADMIN_EMAILS || "").split(",").map(e => e.trim().toLowerCase());
        const allAdmins = [...envAdmins, "hiplaika263@gmail.com"];
        setIsAdmin(allAdmins.includes(user.email.toLowerCase()));
      } else {
        setIsAdmin(false);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const loginWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error("Lỗi đăng nhập:", error);
      throw error;
    }
  };

  const registerWithEmail = async (email, password) => {
    return createUserWithEmailAndPassword(auth, email, password);
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
    <AuthContext.Provider value={{ user, loading, isAdmin, loginWithGoogle, registerWithEmail, loginWithEmail, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
