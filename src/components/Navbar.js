"use client";

import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { usePathname } from "next/navigation";

export default function Navbar() {
  const { user, isAdmin, logout } = useAuth();
  const pathname = usePathname();

  return (
    <nav className="navbar" style={{ position: "sticky", top: 0, zIndex: 100, backdropFilter: "blur(20px)", background: "rgba(255,255,255,0.7)" }}>
      <div className="container" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "1rem 0" }}>
        
        <Link href="/" className="nav-brand" style={{ fontSize: "1.5rem", fontWeight: "800", background: "linear-gradient(135deg, #4f46e5, #9333ea)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", letterSpacing: "-0.5px" }}>
          Lịch Học Pro
        </Link>
        
        <div className="nav-links" style={{ display: "flex", alignItems: "center", gap: "1.5rem" }}>
          {user ? (
            <>
              {/* Nếu không phải Admin, cho phép xem lịch */}
              {!isAdmin && (
                <Link 
                  href="/dashboard" 
                  style={{ 
                    fontWeight: pathname === "/dashboard" ? "600" : "500", 
                    color: pathname === "/dashboard" ? "var(--primary)" : "var(--text-secondary)",
                    textDecoration: "none",
                    transition: "all 0.2s"
                  }}
                >
                  Lịch của tôi
                </Link>
              )}
              
              {isAdmin && (
                <Link 
                  href="/admin" 
                  style={{ 
                    fontWeight: pathname.includes("/admin") ? "600" : "500", 
                    color: pathname.includes("/admin") ? "var(--primary)" : "var(--text-secondary)",
                    textDecoration: "none",
                    transition: "all 0.2s"
                  }}
                >
                  Bảng Quản Trị
                </Link>
              )}

              <div className="nav-user" style={{ display: "flex", alignItems: "center", gap: "1rem", borderLeft: "1px solid #E5E7EB", paddingLeft: "1.5rem" }}>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
                  <span style={{ fontSize: "0.85rem", fontWeight: "600", color: "var(--text-primary)" }}>
                    {user.displayName || user.email.split('@')[0]}
                  </span>
                  {isAdmin ? (
                    <span style={{ fontSize: "0.65rem", padding: "2px 6px", background: "linear-gradient(135deg, #f59e0b, #ef4444)", color: "white", borderRadius: "10px", fontWeight: "700", letterSpacing: "0.5px", boxShadow: "0 2px 4px rgba(239, 68, 68, 0.2)" }}>
                      ADMIN TỐI CAO
                    </span>
                  ) : (
                    <span style={{ fontSize: "0.7rem", color: "var(--text-secondary)" }}>Khách thuê</span>
                  )}
                </div>
                
                {user.photoURL ? (
                  <img src={user.photoURL} alt="Avatar" style={{ width: "38px", height: "38px", borderRadius: "50%", border: "2px solid white", boxShadow: "0 2px 8px rgba(0,0,0,0.1)" }} />
                ) : (
                  <div style={{ width: "38px", height: "38px", borderRadius: "50%", background: "linear-gradient(135deg, #4f46e5, #9333ea)", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontWeight: "bold", fontSize: "1.2rem", boxShadow: "0 2px 8px rgba(0,0,0,0.1)" }}>
                    {user.email[0].toUpperCase()}
                  </div>
                )}
                
                <button onClick={logout} className="btn" style={{ background: "transparent", color: "var(--danger)", padding: "0.4rem", marginLeft: "0.5rem", boxShadow: "none" }} title="Đăng xuất">
                  <svg style={{ width: "20px", height: "20px" }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"></path></svg>
                </button>
              </div>
            </>
          ) : (
            <div style={{ fontSize: "0.9rem", color: "var(--text-secondary)" }}>Hệ thống Quản lý</div>
          )}
        </div>
      </div>
    </nav>
  );
}
