"use client";

import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { usePathname } from "next/navigation";

export default function Navbar() {
  const { user, isAdmin, logout } = useAuth();
  const pathname = usePathname();

  return (
    <nav className="navbar">
      <div className="navbar-container">
        
        {/* Brand Area */}
        <Link href="/" style={{ display: "flex", alignItems: "center", gap: "12px", textDecoration: "none", cursor: "pointer" }}>
          <div className="navbar-brand-logo">
            {/* New Premium SVG Graduation Cap Logo */}
            <svg style={{ width: "24px", height: "24px" }} fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 14l9-5-9-5-9 5 9 5z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 12v7m-9-7v7" />
            </svg>
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
        <div className="nav-links-wrapper">
          {user ? (
            <>
              {/* Menu Links */}
              <div className="nav-menu-links">
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
                      <span style={{ position: "absolute", bottom: "-6px", left: "0", width: "100%", height: "3px", borderRadius: "3px", background: "linear-gradient(90deg, var(--primary), var(--secondary))" }}></span>
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
                      <span style={{ position: "absolute", bottom: "-6px", left: "0", width: "100%", height: "3px", borderRadius: "3px", background: "linear-gradient(90deg, var(--primary), var(--secondary))" }}></span>
                    )}
                  </Link>
                )}

                <Link 
                  href="/tai-khoan" 
                  style={{ 
                    fontWeight: pathname === "/tai-khoan" ? "700" : "500", 
                    color: pathname === "/tai-khoan" ? "var(--primary)" : "var(--text-secondary)",
                    textDecoration: "none",
                    transition: "all 0.2s",
                    position: "relative"
                  }}
                >
                  Tài khoản
                  {pathname === "/tai-khoan" && (
                    <span style={{ position: "absolute", bottom: "-6px", left: "0", width: "100%", height: "3px", borderRadius: "3px", background: "linear-gradient(90deg, var(--primary), var(--secondary))" }}></span>
                  )}
                </Link>
              </div>

              {/* User Profile */}
              <div className="nav-user-area">
                <div className="nav-user-info" style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
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
                  <div style={{ width: "42px", height: "42px", borderRadius: "50%", background: "linear-gradient(135deg, var(--primary), var(--secondary))", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontWeight: "bold", fontSize: "1.2rem", boxShadow: "0 4px 12px rgba(0,0,0,0.15)", border: "2px solid white" }}>
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
