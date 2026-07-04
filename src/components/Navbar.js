"use client";

import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { usePathname } from "next/navigation";

export default function Navbar() {
  const { user, isAdmin, logout } = useAuth();
  const pathname = usePathname();

  return (
    <nav className="navbar" style={{ 
      position: "sticky", 
      top: 0, 
      zIndex: 100, 
      background: "rgba(255, 255, 255, 0.85)",
      backdropFilter: "blur(24px)", 
      WebkitBackdropFilter: "blur(24px)",
      borderBottom: "1px solid rgba(226, 232, 240, 0.8)",
      boxShadow: "0 4px 30px rgba(0, 0, 0, 0.03)"
    }}>
      <div className="container" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "1rem 2rem" }}>
        
        {/* Brand Area */}
        <Link href="/" style={{ display: "flex", alignItems: "center", gap: "12px", textDecoration: "none", cursor: "pointer" }}>
          <div style={{
            width: "42px", 
            height: "42px", 
            borderRadius: "12px", 
            overflow: "hidden", 
            boxShadow: "0 4px 12px rgba(22, 163, 74, 0.2)",
            background: "linear-gradient(135deg, var(--primary) 0%, var(--primary-hover) 100%)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "white",
            fontWeight: "900",
            fontSize: "1.5rem"
          }}>
            L
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <span style={{ 
              fontSize: "1.4rem", 
              fontWeight: "800", 
              background: "linear-gradient(135deg, var(--primary) 0%, var(--secondary) 100%)", 
              WebkitBackgroundClip: "text", 
              WebkitTextFillColor: "transparent", 
              letterSpacing: "-0.5px",
              lineHeight: "1.2"
            }}>
              Thuê Học Pro
            </span>
            <span style={{ fontSize: "0.7rem", color: "var(--text-secondary)", fontWeight: "600", letterSpacing: "1px", textTransform: "uppercase" }}>
              Hệ thống quản lý
            </span>
          </div>
        </Link>
        
        {/* Navigation & User Area */}
        <div className="nav-links" style={{ display: "flex", alignItems: "center", gap: "2rem" }}>
          {user ? (
            <>
              {/* Menu Links */}
              <div style={{ display: "flex", gap: "1.5rem" }}>
                {!isAdmin && (
                  <Link 
                    href="/dashboard" 
                    style={{ 
                      fontWeight: pathname === "/dashboard" ? "700" : "500", 
                      color: pathname === "/dashboard" ? "var(--primary)" : "var(--text-secondary)",
                      textDecoration: "none",
                      transition: "all 0.2s",
                      position: "relative"
                    }}
                  >
                    Lịch của tôi
                    {pathname === "/dashboard" && (
                      <span style={{ position: "absolute", bottom: "-6px", left: "0", width: "100%", height: "3px", borderRadius: "3px", background: "linear-gradient(90deg, #4f46e5, #9333ea)" }}></span>
                    )}
                  </Link>
                )}
                
                {isAdmin && (
                  <Link 
                    href="/admin" 
                    style={{ 
                      fontWeight: pathname.includes("/admin") ? "700" : "500", 
                      color: pathname.includes("/admin") ? "var(--primary)" : "var(--text-secondary)",
                      textDecoration: "none",
                      transition: "all 0.2s",
                      position: "relative"
                    }}
                  >
                    Bảng Quản Trị
                    {pathname.includes("/admin") && (
                      <span style={{ position: "absolute", bottom: "-6px", left: "0", width: "100%", height: "3px", borderRadius: "3px", background: "linear-gradient(90deg, #4f46e5, #9333ea)" }}></span>
                    )}
                  </Link>
                )}
              </div>

              {/* User Profile */}
              <div className="nav-user" style={{ display: "flex", alignItems: "center", gap: "1rem", borderLeft: "2px solid #E5E7EB", paddingLeft: "2rem" }}>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
                  <span style={{ fontSize: "0.9rem", fontWeight: "700", color: "var(--text-primary)" }}>
                    {user.displayName || user.email.split('@')[0]}
                  </span>
                  {isAdmin ? (
                    <span style={{ 
                      fontSize: "0.65rem", 
                      padding: "3px 8px", 
                      background: "linear-gradient(135deg, #f59e0b, #ef4444)", 
                      color: "white", 
                      borderRadius: "12px", 
                      fontWeight: "800", 
                      letterSpacing: "0.5px", 
                      boxShadow: "0 2px 8px rgba(239, 68, 68, 0.3)",
                      marginTop: "2px"
                    }}>
                      ADMIN TỐI CAO
                    </span>
                  ) : (
                    <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)", fontWeight: "500", marginTop: "2px" }}>Khách thuê</span>
                  )}
                </div>
                
                {user.photoURL ? (
                  <img src={user.photoURL} alt="Avatar" style={{ width: "42px", height: "42px", borderRadius: "50%", border: "2px solid white", boxShadow: "0 4px 12px rgba(0,0,0,0.1)", objectFit: "cover" }} />
                ) : (
                  <div style={{ width: "42px", height: "42px", borderRadius: "50%", background: "linear-gradient(135deg, #4f46e5, #9333ea)", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontWeight: "bold", fontSize: "1.2rem", boxShadow: "0 4px 12px rgba(0,0,0,0.15)", border: "2px solid white" }}>
                    {user.email[0].toUpperCase()}
                  </div>
                )}
                
                <button 
                  onClick={logout} 
                  style={{ 
                    background: "rgba(239, 68, 68, 0.1)", 
                    color: "var(--danger)", 
                    border: "none",
                    borderRadius: "8px",
                    padding: "0.5rem", 
                    marginLeft: "0.5rem", 
                    cursor: "pointer",
                    transition: "all 0.2s"
                  }} 
                  title="Đăng xuất"
                  onMouseOver={(e) => { e.currentTarget.style.background = "rgba(239, 68, 68, 0.2)" }}
                  onMouseOut={(e) => { e.currentTarget.style.background = "rgba(239, 68, 68, 0.1)" }}
                >
                  <svg style={{ width: "20px", height: "20px" }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"></path></svg>
                </button>
              </div>
            </>
          ) : (
            <div style={{ fontSize: "0.95rem", color: "var(--text-secondary)", fontWeight: "600", letterSpacing: "0.5px" }}>
              VERSION 2.0
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
