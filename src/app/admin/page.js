"use client";

import { useEffect, useState } from "react";
import AdminGuard from "@/components/AdminGuard";
import { db } from "@/lib/firebase";
import { collection, query, orderBy, onSnapshot, doc, updateDoc, deleteDoc } from "firebase/firestore";
import Link from "next/link";
import toast from "react-hot-toast";

export default function AdminDashboard() {
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [lightboxImage, setLightboxImage] = useState(null);
  const [viewMode, setViewMode] = useState("grid"); // "grid" or "list"

  const [activeTab, setActiveTab] = useState("schedules"); // "schedules" or "users"
  const [users, setUsers] = useState([]);

  useEffect(() => {
    // Lấy dữ liệu Lịch Học
    const q = query(collection(db, "schedules"), orderBy("createdAt", "desc"));
    const unsubscribeSchedules = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setSchedules(data);
      setLoading(false);
    });

    // Lấy dữ liệu Người Dùng
    const qUsers = query(collection(db, "users"), orderBy("lastLogin", "desc"));
    const unsubscribeUsers = onSnapshot(qUsers, (snapshot) => {
      const uData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setUsers(uData);
    });

    return () => { unsubscribeSchedules(); unsubscribeUsers(); };
  }, []);

  const handleUpdateStatus = async (id, newStatus) => {
    try {
      await updateDoc(doc(db, "schedules", id), { status: newStatus });
      toast.success("Cập nhật trạng thái thành công");
    } catch (error) {
      console.error("Lỗi cập nhật trạng thái:", error);
      toast.error("Không thể cập nhật trạng thái");
    }
  };

  const handleDelete = async (id) => {
    if (confirm("Chắc chắn xóa lịch này vĩnh viễn?")) {
      try {
        await deleteDoc(doc(db, "schedules", id));
        toast.success("Đã xóa thành công");
      } catch (error) {
        toast.error("Không thể xóa");
      }
    }
  };

  const handleUpdateUserRole = async (uid, newRole) => {
    try {
      await updateDoc(doc(db, "users", uid), { role: newRole });
      toast.success("Đã cập nhật quyền người dùng");
    } catch (err) {
      toast.error("Lỗi phân quyền!");
    }
  };

  const handleDeleteUser = async (uid) => {
    if (confirm("Xác nhận xóa hồ sơ người dùng này khỏi hệ thống?")) {
      try {
        await deleteDoc(doc(db, "users", uid));
        toast.success("Đã xóa người dùng");
      } catch (err) {
        toast.error("Không thể xóa người dùng");
      }
    }
  };

  const handleExportCSV = () => {
    if (schedules.length === 0) {
      toast.error("Không có dữ liệu để xuất");
      return;
    }

    const headers = ["Họ và Tên", "Lớp", "Mã SV", "Trường", "Email", "Trạng thái", "Ngày nộp", "Link Ảnh"];
    const csvContent = [
      headers.join(","),
      ...schedules.map(s => {
        const date = s.createdAt ? new Date(s.createdAt.toDate()).toLocaleDateString("vi-VN") : "";
        const statusMap = { "approved": "Đã duyệt", "rejected": "Từ chối", "pending": "Chờ duyệt" };
        return [
          `"${s.name || ""}"`,
          `"${s.className || ""}"`,
          `"${s.studentId || ""}"`,
          `"${s.school || ""}"`,
          `"${s.userEmail || ""}"`,
          `"${statusMap[s.status] || "Chờ duyệt"}"`,
          `"${date}"`,
          `"${s.imageUrl || ""}"`
        ].join(",");
      })
    ].join("\n");

    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" }); 
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `lich_hoc_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filteredSchedules = schedules.filter(s => {
    const matchesSearch = 
      (s.name && s.name.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (s.studentId && s.studentId.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (s.className && s.className.toLowerCase().includes(searchQuery.toLowerCase()));
    
    const matchesStatus = filterStatus === "all" || (s.status || "pending") === filterStatus;
    
    return matchesSearch && matchesStatus;
  });

  const filteredUsers = users.filter(u => 
    (u.email && u.email.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (u.displayName && u.displayName.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <AdminGuard>
      <div style={{ marginTop: "2rem" }}>
        
        {/* Tabs Navigation */}
        <div style={{ display: "flex", gap: "1rem", marginBottom: "1.5rem", borderBottom: "2px solid rgba(0,0,0,0.05)", paddingBottom: "1rem" }}>
          <button 
            onClick={() => setActiveTab("schedules")}
            style={{ padding: "0.6rem 1.5rem", border: "none", background: activeTab === "schedules" ? "var(--primary)" : "transparent", color: activeTab === "schedules" ? "white" : "var(--text-secondary)", borderRadius: "8px", fontWeight: "600", cursor: "pointer", transition: "all 0.2s", boxShadow: activeTab === "schedules" ? "0 4px 12px rgba(22, 163, 74, 0.3)" : "none" }}
          >
            <svg style={{ width: "18px", height: "18px", inlineSize: "18px", verticalAlign: "middle", marginRight: "6px" }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
            Quản lý Lịch Học
          </button>
          <button 
            onClick={() => setActiveTab("users")}
            style={{ padding: "0.6rem 1.5rem", border: "none", background: activeTab === "users" ? "var(--primary)" : "transparent", color: activeTab === "users" ? "white" : "var(--text-secondary)", borderRadius: "8px", fontWeight: "600", cursor: "pointer", transition: "all 0.2s", boxShadow: activeTab === "users" ? "0 4px 12px rgba(22, 163, 74, 0.3)" : "none" }}
          >
            <svg style={{ width: "18px", height: "18px", inlineSize: "18px", verticalAlign: "middle", marginRight: "6px" }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"></path></svg>
            Quản lý Tài Khoản
          </button>
        </div>

        {activeTab === "schedules" && (
          <>
            {/* Statistics Cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "1.5rem", marginBottom: "2rem" }}>
          <div className="glass-panel" style={{ padding: "1.5rem", textAlign: "center", borderTop: "4px solid var(--primary)" }}>
            <h3 style={{ margin: "0 0 0.5rem 0", fontSize: "1rem", color: "var(--text-secondary)", fontWeight: "600", textTransform: "uppercase", letterSpacing: "1px" }}>Tổng số lịch học</h3>
            <p style={{ margin: 0, fontSize: "2.5rem", fontWeight: "800", background: "linear-gradient(135deg, var(--primary), var(--secondary))", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>{schedules.length}</p>
          </div>
          <div className="glass-panel" style={{ padding: "1.5rem", textAlign: "center", borderTop: "4px solid #D97706" }}>
            <h3 style={{ margin: "0 0 0.5rem 0", fontSize: "1rem", color: "var(--text-secondary)", fontWeight: "600", textTransform: "uppercase", letterSpacing: "1px" }}>Chờ duyệt</h3>
            <p style={{ margin: 0, fontSize: "2.5rem", fontWeight: "800", color: "#D97706" }}>
              {schedules.filter(s => (s.status || "pending") === "pending").length}
            </p>
          </div>
          <div className="glass-panel" style={{ padding: "1.5rem", textAlign: "center", borderTop: "4px solid var(--success)" }}>
            <h3 style={{ margin: "0 0 0.5rem 0", fontSize: "1rem", color: "var(--text-secondary)", fontWeight: "600", textTransform: "uppercase", letterSpacing: "1px" }}>Đã duyệt</h3>
            <p style={{ margin: 0, fontSize: "2.5rem", fontWeight: "800", color: "var(--success)" }}>
              {schedules.filter(s => s.status === "approved").length}
            </p>
          </div>
        </div>

        {/* Toolbar */}
        <div className="glass-panel" style={{ padding: "1.5rem", marginBottom: "2rem" }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "1rem", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ display: "flex", gap: "1rem", flex: 1, minWidth: "300px" }}>
              <input 
                type="text" 
                placeholder="Tìm tên, mã SV, lớp..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="form-input"
                style={{ flex: 1, maxWidth: "350px", background: "white" }}
              />
              <select 
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="form-input"
                style={{ width: "auto", background: "white", cursor: "pointer" }}
              >
                <option value="all">Tất cả trạng thái</option>
                <option value="pending">Chờ duyệt</option>
                <option value="approved">Đã duyệt</option>
                <option value="rejected">Từ chối</option>
              </select>
            </div>
            
            <div style={{ display: "flex", gap: "1rem" }}>
              {/* Toggle View Mode */}
              <div style={{ display: "flex", background: "white", padding: "0.2rem", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
                <button 
                  onClick={() => setViewMode("grid")}
                  style={{ background: viewMode === "grid" ? "var(--primary-light)" : "transparent", color: viewMode === "grid" ? "var(--primary)" : "var(--text-secondary)", border: "none", padding: "0.5rem 1rem", borderRadius: "6px", cursor: "pointer", fontWeight: "600", transition: "all 0.2s" }}
                >
                  Lưới
                </button>
                <button 
                  onClick={() => setViewMode("list")}
                  style={{ background: viewMode === "list" ? "var(--primary-light)" : "transparent", color: viewMode === "list" ? "var(--primary)" : "var(--text-secondary)", border: "none", padding: "0.5rem 1rem", borderRadius: "6px", cursor: "pointer", fontWeight: "600", transition: "all 0.2s" }}
                >
                  Danh sách
                </button>
              </div>

              <button onClick={handleExportCSV} className="btn" style={{ background: "white", color: "var(--success)", border: "1px solid var(--success)", padding: "0.6rem 1.2rem", boxShadow: "none" }}>
                <svg style={{ width: "20px", height: "20px", marginRight: "8px" }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
                Xuất Excel
              </button>
            </div>
          </div>
        </div>

        {/* Content Area */}
        {loading ? (
          <div className="loader"></div>
        ) : filteredSchedules.length === 0 ? (
          <div className="glass-panel" style={{ textAlign: "center", padding: "4rem", color: "var(--text-secondary)" }}>
            <svg style={{ width: "64px", height: "64px", margin: "0 auto 1rem auto", opacity: 0.5 }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
            <h3 style={{ fontSize: "1.2rem", fontWeight: "600" }}>Không tìm thấy dữ liệu</h3>
            <p>Vui lòng thử thay đổi bộ lọc hoặc từ khóa tìm kiếm.</p>
          </div>
        ) : viewMode === "grid" ? (
          /* GRID VIEW */
          <div className="grid-container">
            {filteredSchedules.map((item) => (
              <div key={item.id} className="grid-card">
                <div className="grid-card-header">
                  <div>
                    <h3 className="grid-card-title">{item.name}</h3>
                    <p className="grid-card-subtitle">{item.studentId} • {item.className}</p>
                  </div>
                  <select 
                    value={item.status || "pending"} 
                    onChange={(e) => handleUpdateStatus(item.id, e.target.value)}
                    style={{
                      padding: "4px 10px", borderRadius: "20px", fontSize: "0.8rem", fontWeight: "700", border: "none", outline: "none", cursor: "pointer",
                      background: item.status === "approved" ? "rgba(16, 185, 129, 0.15)" : item.status === "rejected" ? "rgba(239, 68, 68, 0.15)" : "rgba(245, 158, 11, 0.15)",
                      color: item.status === "approved" ? "var(--success)" : item.status === "rejected" ? "var(--danger)" : "#D97706",
                      boxShadow: "0 2px 4px rgba(0,0,0,0.05)"
                    }}
                  >
                    <option value="pending" style={{color: "black"}}>Chờ duyệt</option>
                    <option value="approved" style={{color: "black"}}>Đã duyệt</option>
                    <option value="rejected" style={{color: "black"}}>Từ chối</option>
                  </select>
                </div>
                
                <img 
                  src={item.imageUrl} 
                  alt="Lịch" 
                  className="grid-card-image"
                  onClick={() => setLightboxImage(item.imageUrl)}
                />
                
                <div style={{ fontSize: "0.85rem", color: "var(--text-secondary)", marginBottom: "1rem" }}>
                  <strong>Trường:</strong> {item.school}<br/>
                  <strong>Ngày nộp:</strong> {item.createdAt ? new Date(item.createdAt.toDate()).toLocaleDateString("vi-VN") : ""}
                </div>

                <div className="grid-card-footer">
                  <Link href={`/admin/edit/${item.id}`} style={{ color: "var(--primary)", fontSize: "0.9rem", fontWeight: "600", textDecoration: "none", display: "flex", alignItems: "center", gap: "0.3rem" }}>
                    <svg style={{ width: "16px", height: "16px" }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg>
                    Sửa
                  </Link>
                  <button onClick={() => handleDelete(item.id)} style={{ background: "none", border: "none", color: "var(--danger)", cursor: "pointer", display: "flex", alignItems: "center" }}>
                    <svg style={{ width: "18px", height: "18px" }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* LIST VIEW */
          <div className="table-container glass-panel" style={{ padding: "0" }}>
            <table style={{ width: "100%" }}>
              <thead>
                <tr>
                  <th style={{ padding: "1.5rem", borderTopLeftRadius: "16px" }}>Sinh viên</th>
                  <th>Trường / Lớp</th>
                  <th>Ảnh lịch</th>
                  <th>Trạng thái</th>
                  <th style={{ padding: "1.5rem", borderTopRightRadius: "16px" }}>Hành động</th>
                </tr>
              </thead>
              <tbody>
                {filteredSchedules.map((item) => (
                  <tr key={item.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                    <td style={{ padding: "1rem 1.5rem" }}>
                      <div style={{ fontWeight: 700, color: "var(--text-primary)" }}>{item.name}</div>
                      <div style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>{item.studentId} • {item.createdAt ? new Date(item.createdAt.toDate()).toLocaleDateString("vi-VN") : ""}</div>
                    </td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{item.school}</div>
                      <div style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>Lớp: {item.className}</div>
                    </td>
                    <td>
                      <img 
                        src={item.imageUrl} 
                        alt="Lịch" 
                        style={{ width: "80px", height: "50px", objectFit: "cover", borderRadius: "6px", cursor: "pointer", border: "1px solid #E5E7EB", transition: "transform 0.2s" }} 
                        onClick={() => setLightboxImage(item.imageUrl)}
                        onMouseOver={e => e.currentTarget.style.transform = "scale(1.1)"}
                        onMouseOut={e => e.currentTarget.style.transform = "scale(1)"}
                      />
                    </td>
                    <td>
                      <select 
                        value={item.status || "pending"} 
                        onChange={(e) => handleUpdateStatus(item.id, e.target.value)}
                        style={{
                          padding: "6px 12px", borderRadius: "20px", fontSize: "0.85rem", fontWeight: "700", border: "none", outline: "none", cursor: "pointer",
                          background: item.status === "approved" ? "rgba(16, 185, 129, 0.15)" : item.status === "rejected" ? "rgba(239, 68, 68, 0.15)" : "rgba(245, 158, 11, 0.15)",
                          color: item.status === "approved" ? "var(--success)" : item.status === "rejected" ? "var(--danger)" : "#D97706"
                        }}
                      >
                        <option value="pending" style={{color: "black"}}>Chờ duyệt</option>
                        <option value="approved" style={{color: "black"}}>Đã duyệt</option>
                        <option value="rejected" style={{color: "black"}}>Từ chối</option>
                      </select>
                    </td>
                    <td style={{ padding: "1rem 1.5rem" }}>
                      <div style={{ display: "flex", gap: "1rem" }}>
                        <Link href={`/admin/edit/${item.id}`} style={{ color: "var(--primary)", fontWeight: "600", textDecoration: "none" }}>Sửa</Link>
                        <button onClick={() => handleDelete(item.id)} style={{ background: "none", border: "none", color: "var(--danger)", cursor: "pointer", fontWeight: "600" }}>Xóa</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        </>
        )}

        {/* BẢNG QUẢN LÝ NGƯỜI DÙNG */}
        {activeTab === "users" && (
          <>
            {/* Toolbar cho Users */}
            <div className="glass-panel" style={{ padding: "1.5rem", marginBottom: "2rem" }}>
              <div style={{ display: "flex", gap: "1rem", flex: 1, minWidth: "300px" }}>
                <input 
                  type="text" 
                  placeholder="Tìm email hoặc tên người dùng..." 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="form-input"
                  style={{ flex: 1, maxWidth: "400px", background: "white" }}
                />
              </div>
            </div>

            <div className="table-container glass-panel" style={{ padding: "0" }}>
              <table style={{ width: "100%" }}>
                <thead>
                  <tr>
                    <th style={{ padding: "1.5rem", borderTopLeftRadius: "16px" }}>Tài khoản</th>
                    <th>Email</th>
                    <th>Ngày hoạt động cuối</th>
                    <th>Quyền (Role)</th>
                    <th style={{ padding: "1.5rem", borderTopRightRadius: "16px" }}>Hành động</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.length === 0 ? (
                    <tr><td colSpan="5" style={{textAlign:"center", padding:"2rem", color:"var(--text-secondary)"}}>Không tìm thấy tài khoản nào.</td></tr>
                  ) : filteredUsers.map((u) => (
                    <tr key={u.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                      <td style={{ padding: "1rem 1.5rem" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                          <img src={u.photoURL || `https://ui-avatars.com/api/?name=${u.displayName || 'U'}&background=random`} alt="Avatar" style={{ width: "40px", height: "40px", borderRadius: "50%" }} />
                          <div style={{ fontWeight: 700, color: "var(--text-primary)" }}>{u.displayName || "Khách"}</div>
                        </div>
                      </td>
                      <td>
                        <div style={{ fontWeight: 600 }}>{u.email}</div>
                      </td>
                      <td>
                        <div style={{ fontSize: "0.9rem", color: "var(--text-secondary)" }}>
                          {u.lastLogin ? new Date(u.lastLogin.toDate()).toLocaleString("vi-VN") : "Chưa rõ"}
                        </div>
                      </td>
                      <td>
                        <select 
                          value={u.role || "user"} 
                          onChange={(e) => handleUpdateUserRole(u.id, e.target.value)}
                          style={{
                            padding: "6px 12px", borderRadius: "20px", fontSize: "0.85rem", fontWeight: "700", border: "none", outline: "none", cursor: "pointer",
                            background: u.role === "admin" ? "rgba(22, 163, 74, 0.15)" : "rgba(100, 116, 139, 0.15)",
                            color: u.role === "admin" ? "var(--primary)" : "var(--text-secondary)"
                          }}
                        >
                          <option value="user" style={{color: "black"}}>Khách hàng</option>
                          <option value="admin" style={{color: "black"}}>Quản trị viên</option>
                        </select>
                      </td>
                      <td style={{ padding: "1rem 1.5rem" }}>
                        <button onClick={() => handleDeleteUser(u.id)} style={{ background: "rgba(239, 68, 68, 0.1)", border: "none", color: "var(--danger)", cursor: "pointer", fontWeight: "600", padding: "8px 12px", borderRadius: "8px", transition: "all 0.2s" }} onMouseOver={(e) => e.target.style.background = "var(--danger)", e.target.style.color = "white"} onMouseOut={(e) => e.target.style.background = "rgba(239, 68, 68, 0.1)", e.target.style.color = "var(--danger)"}>
                          Khóa/Xóa
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* Lightbox Modal */}
      {lightboxImage && (
        <div 
          style={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", background: "rgba(0,0,0,0.85)", backdropFilter: "blur(10px)", zIndex: 1000, display: "flex", justifyContent: "center", alignItems: "center", cursor: "zoom-out" }}
          onClick={() => setLightboxImage(null)}
        >
          <img src={lightboxImage} alt="Phóng to" style={{ maxWidth: "90%", maxHeight: "90%", borderRadius: "12px", objectFit: "contain", boxShadow: "0 20px 50px rgba(0,0,0,0.5)" }} />
        </div>
      )}
    </AdminGuard>
  );
}
