"use client";

import Link from "next/link";
import { useAuth } from "@/context/AuthContext";

export default function Navbar() {
  const { user, isAdmin, loginWithGoogle, logout } = useAuth();

  return (
    <nav className="navbar">
      <Link href="/" className="nav-brand">
        Lịch Học
      </Link>
      
      <div className="nav-links">
        {user ? (
          <>
            <Link href="/dashboard" className="btn" style={{ padding: "0.5rem 1rem", fontSize: "0.9rem" }}>
              Upload Lịch
            </Link>
            {isAdmin && (
              <Link href="/admin" className="btn btn-primary" style={{ padding: "0.5rem 1rem", fontSize: "0.9rem" }}>
                Admin
              </Link>
            )}
            <div className="nav-user">
              {user.photoURL && <img src={user.photoURL} alt="Avatar" className="avatar" />}
              <button onClick={logout} className="btn btn-danger" style={{ padding: "0.5rem 1rem", fontSize: "0.9rem" }}>
                Đăng xuất
              </button>
            </div>
          </>
        ) : (
          <button onClick={loginWithGoogle} className="btn btn-primary" style={{ padding: "0.5rem 1rem", fontSize: "0.9rem" }}>
            Đăng nhập
          </button>
        )}
      </div>
    </nav>
  );
}
