"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { usePathname, useRouter } from "next/navigation";
import { db } from "@/lib/firebase";
import { collection, query, where, orderBy, limit, onSnapshot, doc, updateDoc, deleteDoc } from "firebase/firestore";
import toast from "react-hot-toast";

export default function Navbar() {
  const { user, userProfile, isAdmin, logout } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [notifications, setNotifications] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [hidePhoneBanner, setHidePhoneBanner] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (user && userProfile && !userProfile.phone) {
      const today = new Date().toDateString();
      const hideDate = localStorage.getItem("hidePhoneBannerDate");
      if (hideDate !== today) {
        setHidePhoneBanner(false);
      }
    } else {
      setHidePhoneBanner(true);
    }
  }, [user, userProfile]);

  useEffect(() => {
    if (!user) {
      setNotifications([]);
      return;
    }

    const q = query(
      collection(db, "notifications"),
      where("userId", "==", isAdmin ? "admin" : user.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      data.sort((a, b) => {
        const timeA = a.createdAt ? a.createdAt.toMillis() : 0;
        const timeB = b.createdAt ? b.createdAt.toMillis() : 0;
        return timeB - timeA;
      });
      setNotifications(data.slice(0, 20));
    }, (err) => console.error("Error loading notifications:", err));

    return () => unsubscribe();
  }, [user, isAdmin]);

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [dropdownRef]);

  const unreadCount = notifications.filter(n => !n.read).length;

  const handleReadNotification = async (notif) => {
    if (!notif.read) {
      try {
        await updateDoc(doc(db, "notifications", notif.id), { read: true });
      } catch (err) {
        console.error(err);
      }
    }
    setShowDropdown(false);
    if (notif.link) {
      router.push(notif.link);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      const unreadList = notifications.filter(n => !n.read);
      const promises = unreadList.map(n => updateDoc(doc(db, "notifications", n.id), { read: true }));
      await Promise.all(promises);
      toast.success("Đã đọc tất cả!");
    } catch (err) {
      console.error(err);
    }
  };

  const handleClearNotifications = async () => {
    if (confirm("Xóa toàn bộ thông báo?")) {
      try {
        const promises = notifications.map(n => deleteDoc(doc(db, "notifications", n.id)));
        await Promise.all(promises);
        toast.success("Đã xóa tất cả thông báo!");
      } catch (err) {
        console.error(err);
      }
    }
  };

  const handleDismissPhoneBanner = (e) => {
    e.stopPropagation();
    e.preventDefault();
    localStorage.setItem("hidePhoneBannerDate", new Date().toDateString());
    setHidePhoneBanner(true);
  };

  return (
    <>
      {/* PHONE NUMBER ALERT BANNER */}
      {!hidePhoneBanner && (
        <div 
          onClick={() => router.push("/tai-khoan")}
          style={{
            background: "linear-gradient(90deg, #ef4444 0%, #f59e0b 100%)",
            color: "white",
            padding: "8px 12px",
            textAlign: "center",
            fontSize: "0.82rem",
            fontWeight: "750",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "10px",
            position: "relative",
            zIndex: 1002,
            boxShadow: "0 4px 10px rgba(239, 68, 68, 0.2)",
            animation: "pulseBanner 2s infinite"
          }}
        >
          <span>⚠️ Chưa cập nhật Số điện thoại! Nhấp để bổ sung ngay. 📲</span>
          <button 
            type="button"
            onClick={handleDismissPhoneBanner}
            style={{
              background: "rgba(0,0,0,0.15)", color: "white", border: "none", borderRadius: "50%",
              width: "20px", height: "20px", display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: "0.8rem", fontWeight: "bold", cursor: "pointer"
            }}
          >
            &times;
          </button>
        </div>
      )}
      
      <nav className="navbar" style={{
        position: "sticky",
        top: 0,
        zIndex: 1000,
        background: "rgba(255, 255, 255, 0.88)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        borderBottom: "1px solid rgba(226, 232, 240, 0.8)",
        boxShadow: "0 4px 25px -5px rgba(0, 0, 0, 0.04)",
        transition: "all 0.3s ease"
      }}>
        <div className="navbar-container" style={{
          maxWidth: "1200px",
          margin: "0 auto",
          padding: "0.55rem 1.25rem",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between"
        }}>
          
          {/* Brand Area */}
          <Link href="/" style={{ display: "flex", alignItems: "center", gap: "10px", textDecoration: "none", cursor: "pointer" }}>
            <div className="navbar-brand-logo" style={{
              width: "36px",
              height: "36px",
              borderRadius: "11px",
              background: "linear-gradient(135deg, #16a34a 0%, #10b981 100%)",
              color: "white",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 4px 12px rgba(22, 163, 74, 0.3)",
              transition: "transform 0.2s"
            }}>
              <svg style={{ width: "20px", height: "20px" }} fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 14l9-5-9-5-9 5 9 5z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 12v7m-9-7v7" />
              </svg>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <span className="brand-title" style={{ 
                fontSize: "1.15rem", 
                fontWeight: "850", 
                background: "linear-gradient(135deg, #16a34a 0%, #059669 100%)", 
                WebkitBackgroundClip: "text", 
                WebkitTextFillColor: "transparent", 
                letterSpacing: "-0.5px",
                lineHeight: "1.2"
              }}>
                Thuê Học
              </span>
              <span style={{
                background: "rgba(22, 163, 74, 0.1)",
                color: "var(--primary)",
                fontSize: "0.68rem",
                fontWeight: "800",
                padding: "2px 6px",
                borderRadius: "6px",
                border: "1px solid rgba(22, 163, 74, 0.2)"
              }}>
                PRO
              </span>
            </div>
          </Link>
          
          {/* Navigation & User Area */}
          <div className="nav-links-wrapper" style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
            {user ? (
              <>
                {/* Desktop Pill Menu Links */}
                <div className="nav-menu-links nav-menu-desktop" style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  {!isAdmin && (
                    <Link href="/dashboard" style={{
                      padding: "6px 14px",
                      borderRadius: "20px",
                      fontSize: "0.85rem",
                      fontWeight: pathname === "/dashboard" ? "800" : "600",
                      color: pathname === "/dashboard" ? "var(--primary)" : "#475569",
                      background: pathname === "/dashboard" ? "rgba(22, 163, 74, 0.1)" : "transparent",
                      border: pathname === "/dashboard" ? "1px solid rgba(22, 163, 74, 0.25)" : "1px solid transparent",
                      textDecoration: "none",
                      transition: "all 0.2s"
                    }}>
                      📅 Lịch của tôi
                    </Link>
                  )}
                  {isAdmin && (
                    <Link href="/admin" style={{
                      padding: "6px 14px",
                      borderRadius: "20px",
                      fontSize: "0.85rem",
                      fontWeight: pathname.includes("/admin") ? "800" : "600",
                      color: pathname.includes("/admin") ? "var(--primary)" : "#475569",
                      background: pathname.includes("/admin") ? "rgba(22, 163, 74, 0.1)" : "transparent",
                      border: pathname.includes("/admin") ? "1px solid rgba(22, 163, 74, 0.25)" : "1px solid transparent",
                      textDecoration: "none",
                      transition: "all 0.2s"
                    }}>
                      📊 Bảng Quản Trị
                    </Link>
                  )}
                  <Link href="/doi-ngu" style={{
                    padding: "6px 14px",
                    borderRadius: "20px",
                    fontSize: "0.85rem",
                    fontWeight: pathname === "/doi-ngu" ? "800" : "600",
                    color: pathname === "/doi-ngu" ? "var(--primary)" : "#475569",
                    background: pathname === "/doi-ngu" ? "rgba(22, 163, 74, 0.1)" : "transparent",
                    border: pathname === "/doi-ngu" ? "1px solid rgba(22, 163, 74, 0.25)" : "1px solid transparent",
                    textDecoration: "none",
                    transition: "all 0.2s"
                  }}>
                    👥 Đội ngũ CTV
                  </Link>
                  <Link href="/tai-khoan" style={{
                    padding: "6px 14px",
                    borderRadius: "20px",
                    fontSize: "0.85rem",
                    fontWeight: pathname === "/tai-khoan" ? "800" : "600",
                    color: pathname === "/tai-khoan" ? "var(--primary)" : "#475569",
                    background: pathname === "/tai-khoan" ? "rgba(22, 163, 74, 0.1)" : "transparent",
                    border: pathname === "/tai-khoan" ? "1px solid rgba(22, 163, 74, 0.25)" : "1px solid transparent",
                    textDecoration: "none",
                    transition: "all 0.2s"
                  }}>
                    👤 Tài khoản
                  </Link>
                  {!isAdmin && (
                    <Link href="/tuyen-ctv" style={{
                      padding: "6px 14px",
                      borderRadius: "20px",
                      fontSize: "0.85rem",
                      fontWeight: pathname === "/tuyen-ctv" ? "800" : "600",
                      color: pathname === "/tuyen-ctv" ? "var(--primary)" : "#475569",
                      background: pathname === "/tuyen-ctv" ? "rgba(22, 163, 74, 0.1)" : "transparent",
                      border: pathname === "/tuyen-ctv" ? "1px solid rgba(22, 163, 74, 0.25)" : "1px solid transparent",
                      textDecoration: "none",
                      transition: "all 0.2s"
                    }}>
                      🎓 Tuyển CTV
                    </Link>
                  )}
                </div>

                {/* Logged in User Controls */}
                <div className="nav-user-area" style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  {/* Notification Bell Dropdown */}
                  <div ref={dropdownRef} style={{ position: "relative", display: "flex", alignItems: "center" }}>
                    <button 
                      onClick={() => setShowDropdown(!showDropdown)}
                      style={{
                        background: showDropdown ? "rgba(22, 163, 74, 0.1)" : "#f8fafc",
                        border: "1px solid #cbd5e1",
                        cursor: "pointer",
                        color: "var(--text-primary)",
                        position: "relative",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        width: "36px",
                        height: "36px",
                        borderRadius: "50%",
                        transition: "all 0.2s"
                      }}
                      title="Thông báo"
                    >
                      <svg style={{ width: "19px", height: "19px" }} fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                      </svg>
                      {unreadCount > 0 && (
                        <span style={{
                          position: "absolute", top: "-2px", right: "-2px", background: "#ef4444", color: "white", borderRadius: "50%", minWidth: "16px", height: "16px", fontSize: "0.62rem", fontWeight: "800", display: "flex", alignItems: "center", justifyContent: "center", border: "2px solid white"
                        }}>
                          {unreadCount}
                        </span>
                      )}
                    </button>

                    {showDropdown && (
                      <div className="notifications-dropdown modal-pop-in">
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 15px", borderBottom: "1px solid #f1f5f9" }}>
                          <span style={{ fontWeight: "800", fontSize: "0.9rem", color: "var(--text-primary)" }}>🔔 Thông báo</span>
                          <div style={{ display: "flex", gap: "10px" }}>
                            {unreadCount > 0 && (
                              <span onClick={handleMarkAllRead} style={{ fontSize: "0.75rem", color: "var(--primary)", cursor: "pointer", fontWeight: "700", textDecoration: "underline" }}>Đọc hết</span>
                            )}
                            {notifications.length > 0 && (
                              <span onClick={handleClearNotifications} style={{ fontSize: "0.75rem", color: "var(--danger)", cursor: "pointer", fontWeight: "700", textDecoration: "underline" }}>Xóa hết</span>
                            )}
                          </div>
                        </div>

                        <div style={{ maxHeight: "280px", overflowY: "auto" }}>
                          {notifications.length === 0 ? (
                            <div style={{ padding: "20px", textAlign: "center", color: "var(--text-secondary)", fontSize: "0.85rem" }}>Không có thông báo mới.</div>
                          ) : notifications.map(notif => (
                            <div 
                              key={notif.id}
                              onClick={() => handleReadNotification(notif)}
                              style={{
                                padding: "10px 15px", borderBottom: "1px solid #f8fafc", cursor: "pointer", background: notif.read ? "transparent" : "rgba(22, 163, 74, 0.04)", transition: "all 0.15s", textAlign: "left"
                              }}
                            >
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "4px" }}>
                                <span style={{ fontWeight: notif.read ? "600" : "800", fontSize: "0.82rem", color: notif.read ? "var(--text-secondary)" : "var(--text-primary)" }}>{notif.title}</span>
                                {!notif.read && <span style={{ width: "6px", height: "6px", background: "#ef4444", borderRadius: "50%" }}></span>}
                              </div>
                              <p style={{ margin: 0, fontSize: "0.78rem", color: "var(--text-secondary)", lineHeight: "1.4" }}>{notif.message}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Desktop User Avatar & Name Chip */}
                  <div className="nav-user-info" style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    background: "#f8fafc",
                    border: "1px solid #e2e8f0",
                    padding: "4px 10px 4px 6px",
                    borderRadius: "20px"
                  }}>
                    <div style={{
                      width: "26px", height: "26px", borderRadius: "50%",
                      background: isAdmin ? "linear-gradient(135deg, #f59e0b, #d97706)" : "linear-gradient(135deg, #16a34a, #10b981)",
                      color: "white", display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: "0.75rem", fontWeight: "800"
                    }}>
                      {isAdmin ? "👑" : (user.displayName ? user.displayName.charAt(0).toUpperCase() : "👤")}
                    </div>
                    <span style={{ fontSize: "0.82rem", fontWeight: "750", color: "var(--text-primary)" }}>
                      {user.displayName || user.email.split('@')[0]}
                    </span>
                  </div>
                  
                  {/* Logout Button */}
                  <button 
                    onClick={logout} 
                    style={{ 
                      background: "rgba(239, 68, 68, 0.08)", color: "var(--danger)", border: "1px solid rgba(239, 68, 68, 0.2)", borderRadius: "10px", width: "34px", height: "34px", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer"
                    }} 
                    title="Đăng xuất"
                  >
                    <svg style={{ width: "16px", height: "16px" }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"></path></svg>
                  </button>

                  {/* Mobile Hamburger Toggle Button */}
                  <button
                    type="button"
                    onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                    style={{
                      background: mobileMenuOpen ? "rgba(22, 163, 74, 0.15)" : "#f8fafc",
                      border: mobileMenuOpen ? "1px solid var(--primary)" : "1px solid #cbd5e1",
                      borderRadius: "10px",
                      width: "36px",
                      height: "36px",
                      cursor: "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: mobileMenuOpen ? "var(--primary)" : "#334155",
                      transition: "all 0.25s cubic-bezier(0.16, 1, 0.3, 1)",
                      transform: mobileMenuOpen ? "rotate(90deg)" : "none"
                    }}
                    className="mobile-menu-toggle"
                    title="Menu"
                  >
                    <svg style={{ width: "20px", height: "20px" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      {mobileMenuOpen ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" d="M6 18L18 6M6 6l12 12" /> : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" d="M4 6h16M4 12h16M4 18h16" />}
                    </svg>
                  </button>
                </div>
              </>
            ) : (
              /* GIAO DIỆN CHƯA ĐĂNG NHẬP (LANDING HEADER) */
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                {/* Desktop Menu Links */}
                <div className="nav-menu-links nav-menu-desktop" style={{ display: "flex", gap: "8px", alignItems: "center", marginRight: "6px" }}>
                  <Link href="/doi-ngu" style={{
                    padding: "6px 12px", borderRadius: "18px", fontSize: "0.84rem", fontWeight: pathname === "/doi-ngu" ? "800" : "600",
                    color: pathname === "/doi-ngu" ? "var(--primary)" : "#475569", textDecoration: "none"
                  }}>
                    👥 Đội ngũ CTV
                  </Link>
                  <Link href="/huong-dan" style={{
                    padding: "6px 12px", borderRadius: "18px", fontSize: "0.84rem", fontWeight: pathname === "/huong-dan" ? "800" : "600",
                    color: pathname === "/huong-dan" ? "var(--primary)" : "#475569", textDecoration: "none"
                  }}>
                    📖 Hướng dẫn
                  </Link>
                  <Link href="/dieu-khoan" style={{
                    padding: "6px 12px", borderRadius: "18px", fontSize: "0.84rem", fontWeight: pathname === "/dieu-khoan" ? "800" : "600",
                    color: pathname === "/dieu-khoan" ? "var(--primary)" : "#475569", textDecoration: "none"
                  }}>
                    ⚖️ Điều khoản
                  </Link>
                </div>

                {/* HIGH-IMPACT FOCUSED LOGIN CTA BUTTON */}
                <Link 
                  href="/" 
                  onClick={(e) => {
                    if (pathname === "/") {
                      e.preventDefault();
                      const loginForm = document.getElementById("auth-form-card");
                      if (loginForm) {
                        loginForm.scrollIntoView({ behavior: "smooth", block: "center" });
                      }
                    }
                  }}
                  style={{ 
                    fontWeight: "850", 
                    color: "white",
                    background: "linear-gradient(135deg, #16a34a 0%, #15803d 100%)",
                    padding: "7px 16px",
                    borderRadius: "20px",
                    textDecoration: "none",
                    fontSize: "0.84rem",
                    boxShadow: "0 4px 14px rgba(22, 163, 74, 0.35)",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                    whiteSpace: "nowrap",
                    transition: "all 0.2s"
                  }}
                >
                  <span>🔑</span> Đăng Nhập
                </Link>

                {/* Mobile Hamburger Toggle Button */}
                <button
                  type="button"
                  onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                  style={{
                    background: mobileMenuOpen ? "rgba(22, 163, 74, 0.15)" : "#f8fafc",
                    border: mobileMenuOpen ? "1px solid var(--primary)" : "1px solid #cbd5e1",
                    borderRadius: "10px",
                    width: "36px",
                    height: "36px",
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: mobileMenuOpen ? "var(--primary)" : "#334155",
                    transition: "all 0.25s cubic-bezier(0.16, 1, 0.3, 1)",
                    transform: mobileMenuOpen ? "rotate(90deg)" : "none"
                  }}
                  className="mobile-menu-toggle"
                  title="Menu"
                >
                  <svg style={{ width: "20px", height: "20px" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    {mobileMenuOpen ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" d="M6 18L18 6M6 6l12 12" /> : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" d="M4 6h16M4 12h16M4 18h16" />}
                  </svg>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Mobile Dropdown Menu Modal Sheet */}
        {mobileMenuOpen && (
          <div 
            className="mobile-nav-dropdown"
            style={{
              background: "rgba(255, 255, 255, 0.98)",
              backdropFilter: "blur(20px)",
              borderBottom: "2px solid #e2e8f0", 
              padding: "0.85rem 1.25rem", 
              display: "flex", 
              flexDirection: "column", 
              gap: "8px", 
              boxShadow: "0 16px 35px rgba(0,0,0,0.08)"
            }}
          >
            {user ? (
              <>
                {!isAdmin && <Link href="/dashboard" onClick={() => setMobileMenuOpen(false)} style={{ color: "var(--text-primary)", textDecoration: "none", fontWeight: "750", fontSize: "0.9rem", padding: "8px 12px", borderRadius: "10px", background: pathname === "/dashboard" ? "#f0fdf4" : "transparent" }}>📅 Lịch của tôi</Link>}
                {isAdmin && <Link href="/admin" onClick={() => setMobileMenuOpen(false)} style={{ color: "var(--text-primary)", textDecoration: "none", fontWeight: "750", fontSize: "0.9rem", padding: "8px 12px", borderRadius: "10px", background: pathname.includes("/admin") ? "#f0fdf4" : "transparent" }}>📊 Bảng Quản Trị</Link>}
                <Link href="/doi-ngu" onClick={() => setMobileMenuOpen(false)} style={{ color: "var(--text-primary)", textDecoration: "none", fontWeight: "750", fontSize: "0.9rem", padding: "8px 12px", borderRadius: "10px", background: pathname === "/doi-ngu" ? "#f0fdf4" : "transparent" }}>👥 Đội ngũ CTV</Link>
                <Link href="/tai-khoan" onClick={() => setMobileMenuOpen(false)} style={{ color: "var(--text-primary)", textDecoration: "none", fontWeight: "750", fontSize: "0.9rem", padding: "8px 12px", borderRadius: "10px", background: pathname === "/tai-khoan" ? "#f0fdf4" : "transparent" }}>👤 Tài khoản</Link>
                {!isAdmin && <Link href="/tuyen-ctv" onClick={() => setMobileMenuOpen(false)} style={{ color: "var(--primary)", textDecoration: "none", fontWeight: "750", fontSize: "0.9rem", padding: "8px 12px", borderRadius: "10px", background: pathname === "/tuyen-ctv" ? "#f0fdf4" : "transparent" }}>🎓 Tuyển CTV</Link>}
              </>
            ) : (
              <>
                <Link href="/doi-ngu" onClick={() => setMobileMenuOpen(false)} style={{ color: "var(--text-primary)", textDecoration: "none", fontWeight: "750", fontSize: "0.9rem", padding: "8px 12px", borderRadius: "10px", background: pathname === "/doi-ngu" ? "#f0fdf4" : "transparent" }}>👥 Đội ngũ CTV</Link>
                <Link href="/huong-dan" onClick={() => setMobileMenuOpen(false)} style={{ color: "var(--text-primary)", textDecoration: "none", fontWeight: "750", fontSize: "0.9rem", padding: "8px 12px", borderRadius: "10px", background: pathname === "/huong-dan" ? "#f0fdf4" : "transparent" }}>📖 Hướng dẫn sử dụng</Link>
                <Link href="/dieu-khoan" onClick={() => setMobileMenuOpen(false)} style={{ color: "var(--text-primary)", textDecoration: "none", fontWeight: "750", fontSize: "0.9rem", padding: "8px 12px", borderRadius: "10px", background: pathname === "/dieu-khoan" ? "#f0fdf4" : "transparent" }}>⚖️ Điều khoản dịch vụ</Link>
                <Link href="/tuyen-ctv" onClick={() => setMobileMenuOpen(false)} style={{ color: "var(--primary)", textDecoration: "none", fontWeight: "750", fontSize: "0.9rem", padding: "8px 12px", borderRadius: "10px", background: pathname === "/tuyen-ctv" ? "#f0fdf4" : "transparent" }}>🎓 Tuyển CTV</Link>
              </>
            )}
          </div>
        )}
      </nav>
    </>
  );
}
