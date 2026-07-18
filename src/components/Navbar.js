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
  const dropdownRef = useRef(null);

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
            padding: "10px 15px",
            textAlign: "center",
            fontSize: "0.85rem",
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
          <span>⚠️ Tài khoản của bạn chưa cập nhật Số điện thoại! Vui lòng nhấp vào đây để bổ sung ngay. 📲</span>
          <button 
            type="button"
            onClick={handleDismissPhoneBanner}
            style={{
              background: "rgba(0,0,0,0.15)",
              color: "white",
              border: "none",
              borderRadius: "50%",
              width: "20px",
              height: "20px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "0.8rem",
              fontWeight: "bold",
              cursor: "pointer",
              marginLeft: "10px"
            }}
            title="Tắt thông báo hôm nay"
          >
            &times;
          </button>
          <style jsx>{`
            @keyframes pulseBanner {
              0% { opacity: 0.95; }
              50% { opacity: 1; }
              100% { opacity: 0.95; }
            }
          `}</style>
        </div>
      )}
      <nav className="navbar">
      <div className="navbar-container">
        
        {/* Brand Area */}
        <Link href="/" style={{ display: "flex", alignItems: "center", gap: "8px", textDecoration: "none", cursor: "pointer" }}>
          <div className="navbar-brand-logo">
            {/* New Premium SVG Graduation Cap Logo */}
            <svg style={{ width: "18px", height: "18px" }} fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 14l9-5-9-5-9 5 9 5z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 12v7m-9-7v7" />
            </svg>
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <span className="brand-title" style={{ 
              fontSize: "1.15rem", 
              fontWeight: "800", 
              background: "linear-gradient(135deg, var(--primary) 0%, var(--secondary) 100%)", 
              WebkitBackgroundClip: "text", 
              WebkitTextFillColor: "transparent", 
              letterSpacing: "-0.5px",
              lineHeight: "1.2"
            }}>
              Thuê Học Pro
            </span>
            <span className="brand-sublabel" style={{ fontSize: "0.6rem", color: "var(--text-secondary)", fontWeight: "600", letterSpacing: "1px", textTransform: "uppercase" }}>
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
                  href="/doi-ngu" 
                  style={{ 
                    fontWeight: pathname === "/doi-ngu" ? "700" : "500", 
                    color: pathname === "/doi-ngu" ? "var(--primary)" : "var(--text-secondary)",
                    textDecoration: "none",
                    transition: "all 0.2s",
                    position: "relative"
                  }}
                >
                  Đội ngũ CTV 👥
                  {pathname === "/doi-ngu" && (
                    <span style={{ position: "absolute", bottom: "-6px", left: "0", width: "100%", height: "3px", borderRadius: "3px", background: "linear-gradient(90deg, var(--primary), var(--secondary))" }}></span>
                  )}
                </Link>

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

                {!isAdmin && (
                  <Link 
                    href="/tuyen-ctv" 
                    style={{ 
                      fontWeight: pathname === "/tuyen-ctv" ? "700" : "500", 
                      color: pathname === "/tuyen-ctv" ? "var(--primary)" : "var(--text-secondary)",
                      textDecoration: "none",
                      transition: "all 0.2s",
                      position: "relative"
                    }}
                  >
                    Tuyển CTV 🎓
                    {pathname === "/tuyen-ctv" && (
                      <span style={{ position: "absolute", bottom: "-6px", left: "0", width: "100%", height: "3px", borderRadius: "3px", background: "linear-gradient(90deg, var(--primary), var(--secondary))" }}></span>
                    )}
                  </Link>
                )}
              </div>
              
              <div className="nav-divider" />

              {/* User Profile */}
              <div className="nav-user-area">
                {user && (
                  <div ref={dropdownRef} style={{ position: "relative", display: "flex", alignItems: "center" }}>
                    <button 
                      onClick={() => setShowDropdown(!showDropdown)}
                      style={{
                        background: "none", border: "none", cursor: "pointer", color: "var(--text-secondary)", position: "relative", display: "flex", alignItems: "center", padding: "6px", borderRadius: "50%", transition: "all 0.2s"
                      }}
                      onMouseOver={e => e.currentTarget.style.background = "#f1f5f9"}
                      onMouseOut={e => e.currentTarget.style.background = "none"}
                    >
                      <svg style={{ width: "20px", height: "20px" }} fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                      </svg>
                      {unreadCount > 0 && (
                        <span style={{
                          position: "absolute", top: "0px", right: "0px", background: "#ef4444", color: "white", borderRadius: "50%", minWidth: "15px", height: "15px", fontSize: "0.6rem", fontWeight: "700", display: "flex", alignItems: "center", justifyContent: "center", padding: "2px"
                        }}>
                          {unreadCount}
                        </span>
                      )}
                    </button>

                    {showDropdown && (
                      <div className="notifications-dropdown">
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "5px 15px 10px 15px", borderBottom: "1px solid #f1f5f9" }}>
                          <span style={{ fontWeight: "700", fontSize: "0.9rem", color: "var(--text-primary)" }}>Thông báo</span>
                          <div style={{ display: "flex", gap: "10px" }}>
                            {unreadCount > 0 && (
                              <span onClick={handleMarkAllRead} style={{ fontSize: "0.75rem", color: "var(--primary)", cursor: "pointer", fontWeight: "600", textDecoration: "underline" }}>Đọc hết</span>
                            )}
                            {notifications.length > 0 && (
                              <span onClick={handleClearNotifications} style={{ fontSize: "0.75rem", color: "var(--danger)", cursor: "pointer", fontWeight: "600", textDecoration: "underline" }}>Xóa hết</span>
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
                                padding: "10px 15px", borderBottom: "1px solid #f8fafc", cursor: "pointer", background: notif.read ? "transparent" : "rgba(22, 163, 74, 0.03)", transition: "all 0.15s", textAlign: "left"
                              }}
                              onMouseOver={e => e.currentTarget.style.background = "#f8fafc"}
                              onMouseOut={e => e.currentTarget.style.background = notif.read ? "transparent" : "rgba(22, 163, 74, 0.03)"}
                            >
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "4px" }}>
                                <span style={{ fontWeight: notif.read ? "600" : "800", fontSize: "0.82rem", color: notif.read ? "var(--text-secondary)" : "var(--text-primary)" }}>{notif.title}</span>
                                {!notif.read && <span style={{ width: "6px", height: "6px", background: "#ef4444", borderRadius: "50%" }}></span>}
                              </div>
                              <p style={{ margin: 0, fontSize: "0.78rem", color: "var(--text-secondary)", lineHeight: "1.4" }}>{notif.message}</p>
                              <span style={{ fontSize: "0.68rem", color: "#a1a1aa", display: "block", marginTop: "4px" }}>
                                {notif.createdAt ? new Date(notif.createdAt.toDate()).toLocaleString("vi-VN") : ""}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
                <div className="nav-user-info" style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
                  <span style={{ fontSize: "0.82rem", fontWeight: "700", color: "var(--text-primary)" }}>
                    {user.displayName || user.email.split('@')[0]}
                  </span>
                  {isAdmin ? (
                    <span style={{ 
                      fontSize: "0.58rem", 
                      padding: "2px 6px", 
                      background: "linear-gradient(135deg, #f59e0b, #ef4444)", 
                      color: "white", 
                      borderRadius: "10px", 
                      fontWeight: "800", 
                      letterSpacing: "0.5px", 
                      boxShadow: "0 2px 6px rgba(239, 68, 68, 0.25)",
                      marginTop: "2px"
                    }}>
                      ADMIN TỐI CAO
                    </span>
                  ) : (
                    <span style={{ fontSize: "0.68rem", color: "var(--text-secondary)", fontWeight: "500", marginTop: "2px" }}>Khách thuê</span>
                  )}
                </div>
                
                {user.photoURL ? (
                  <img src={user.photoURL} alt="Avatar" style={{ width: "32px", height: "32px", borderRadius: "50%", border: "1.5px solid white", boxShadow: "0 4px 10px rgba(0,0,0,0.1)", objectFit: "cover" }} />
                ) : (
                  <div style={{ width: "32px", height: "32px", borderRadius: "50%", background: "linear-gradient(135deg, var(--primary), var(--secondary))", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontWeight: "bold", fontSize: "0.95rem", boxShadow: "0 4px 10px rgba(0,0,0,0.1)", border: "1.5px solid white" }}>
                    {user.email[0].toUpperCase()}
                  </div>
                )}
                
                <button 
                  onClick={logout} 
                  style={{ 
                    background: "rgba(239, 68, 68, 0.1)", 
                    color: "var(--danger)", 
                    border: "none",
                    borderRadius: "6px",
                    padding: "6px", 
                    marginLeft: "0.25rem", 
                    cursor: "pointer",
                    transition: "all 0.2s"
                  }} 
                  title="Đăng xuất"
                  onMouseOver={(e) => { e.currentTarget.style.background = "rgba(239, 68, 68, 0.2)" }}
                  onMouseOut={(e) => { e.currentTarget.style.background = "rgba(239, 68, 68, 0.1)" }}
                >
                  <svg style={{ width: "16px", height: "16px" }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"></path></svg>
                </button>
              </div>
            </>
          ) : (
            <div className="nav-menu-links" style={{ display: "flex", gap: "20px" }}>
              <Link 
                href="/doi-ngu" 
                style={{ 
                  fontWeight: pathname === "/doi-ngu" ? "700" : "500", 
                  color: pathname === "/doi-ngu" ? "var(--primary)" : "var(--text-secondary)",
                  textDecoration: "none",
                  transition: "all 0.2s",
                  position: "relative"
                }}
              >
                Đội ngũ CTV 👥
                {pathname === "/doi-ngu" && (
                  <span style={{ position: "absolute", bottom: "-6px", left: "0", width: "100%", height: "3px", borderRadius: "3px", background: "linear-gradient(90deg, var(--primary), var(--secondary))" }}></span>
                )}
              </Link>
              <Link 
                href="/huong-dan" 
                style={{ 
                  fontWeight: pathname === "/huong-dan" ? "700" : "500", 
                  color: pathname === "/huong-dan" ? "var(--primary)" : "var(--text-secondary)",
                  textDecoration: "none",
                  transition: "all 0.2s",
                  position: "relative"
                }}
              >
                Hướng dẫn 📖
                {pathname === "/huong-dan" && (
                  <span style={{ position: "absolute", bottom: "-6px", left: "0", width: "100%", height: "3px", borderRadius: "3px", background: "linear-gradient(90deg, var(--primary), var(--secondary))" }}></span>
                )}
              </Link>
              <Link 
                href="/dieu-khoan" 
                style={{ 
                  fontWeight: pathname === "/dieu-khoan" ? "700" : "500", 
                  color: pathname === "/dieu-khoan" ? "var(--primary)" : "var(--text-secondary)",
                  textDecoration: "none",
                  transition: "all 0.2s",
                  position: "relative"
                }}
              >
                Điều khoản ⚖️
                {pathname === "/dieu-khoan" && (
                  <span style={{ position: "absolute", bottom: "-6px", left: "0", width: "100%", height: "3px", borderRadius: "3px", background: "linear-gradient(90deg, var(--primary), var(--secondary))" }}></span>
                )}
              </Link>
            </div>
          )}
        </div>
      </div>
    </nav>
    </>
  );
}
