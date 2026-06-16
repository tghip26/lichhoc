"use client";

import { useEffect, useState } from "react";
import AdminGuard from "@/components/AdminGuard";
import { db } from "@/lib/firebase";
import { collection, query, orderBy, onSnapshot, doc, updateDoc } from "firebase/firestore";
import Link from "next/link";
import toast from "react-hot-toast";

export default function AdminDashboard() {
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [lightboxImage, setLightboxImage] = useState(null);

  useEffect(() => {
    const q = query(collection(db, "schedules"), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setSchedules(data);
      setLoading(false);
    });

    return () => unsubscribe();
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

    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" }); // \uFEFF for Excel UTF-8 BOM
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `lich_hoc_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Filter data
  const filteredSchedules = schedules.filter(s => {
    const matchesSearch = 
      (s.name && s.name.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (s.studentId && s.studentId.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (s.className && s.className.toLowerCase().includes(searchQuery.toLowerCase()));
    
    const matchesStatus = filterStatus === "all" || (s.status || "pending") === filterStatus;
    
    return matchesSearch && matchesStatus;
  });

  return (
    <AdminGuard>
      <div className="glass-panel" style={{ marginTop: "2rem" }}>
        
        {/* Statistics Cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "1rem", marginBottom: "2rem" }}>
          <div style={{ background: "rgba(255, 255, 255, 0.5)", padding: "1.5rem", borderRadius: "12px", border: "1px solid rgba(255,255,255,0.8)", textAlign: "center" }}>
            <h3 style={{ margin: "0 0 0.5rem 0", fontSize: "1rem", color: "var(--text-secondary)" }}>Tổng số lịch học</h3>
            <p style={{ margin: 0, fontSize: "2rem", fontWeight: "700", color: "var(--primary)" }}>{schedules.length}</p>
          </div>
          <div style={{ background: "rgba(255, 255, 255, 0.5)", padding: "1.5rem", borderRadius: "12px", border: "1px solid rgba(255,255,255,0.8)", textAlign: "center" }}>
            <h3 style={{ margin: "0 0 0.5rem 0", fontSize: "1rem", color: "var(--text-secondary)" }}>Chờ duyệt</h3>
            <p style={{ margin: 0, fontSize: "2rem", fontWeight: "700", color: "#D97706" }}>
              {schedules.filter(s => (s.status || "pending") === "pending").length}
            </p>
          </div>
          <div style={{ background: "rgba(255, 255, 255, 0.5)", padding: "1.5rem", borderRadius: "12px", border: "1px solid rgba(255,255,255,0.8)", textAlign: "center" }}>
            <h3 style={{ margin: "0 0 0.5rem 0", fontSize: "1rem", color: "var(--text-secondary)" }}>Đã duyệt</h3>
            <p style={{ margin: 0, fontSize: "2rem", fontWeight: "700", color: "var(--success)" }}>
              {schedules.filter(s => s.status === "approved").length}
            </p>
          </div>
        </div>

        {/* Toolbar */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: "1rem", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
          <div style={{ display: "flex", gap: "1rem", flex: 1, minWidth: "300px" }}>
            <input 
              type="text" 
              placeholder="Tìm tên, mã SV, lớp..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="form-input"
              style={{ flex: 1, maxWidth: "300px" }}
            />
            <select 
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="form-input"
              style={{ width: "auto" }}
            >
              <option value="all">Tất cả trạng thái</option>
              <option value="pending">Chờ duyệt</option>
              <option value="approved">Đã duyệt</option>
              <option value="rejected">Từ chối</option>
            </select>
          </div>
          <button onClick={handleExportCSV} className="btn" style={{ background: "var(--success)", color: "white", padding: "0.6rem 1.2rem", boxShadow: "0 4px 6px rgba(16, 185, 129, 0.2)" }}>
            Xuất file CSV
          </button>
        </div>

        {/* Table */}
        {loading ? (
          <div className="loader"></div>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Sinh viên</th>
                  <th>Trường / Lớp</th>
                  <th>Ảnh lịch</th>
                  <th>Ngày nộp</th>
                  <th>Trạng thái</th>
                  <th>Hành động</th>
                </tr>
              </thead>
              <tbody>
                {filteredSchedules.length === 0 ? (
                  <tr>
                    <td colSpan="6" style={{ textAlign: "center", padding: "3rem", color: "var(--text-secondary)" }}>Không tìm thấy dữ liệu.</td>
                  </tr>
                ) : (
                  filteredSchedules.map((item) => (
                    <tr key={item.id}>
                      <td>
                        <div style={{ fontWeight: 600 }}>{item.name}</div>
                        <div style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>{item.studentId}</div>
                      </td>
                      <td>
                        <div style={{ fontWeight: 500 }}>{item.school}</div>
                        <div style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>Lớp: {item.className}</div>
                      </td>
                      <td>
                        <img 
                          src={item.imageUrl} 
                          alt="Lịch" 
                          style={{ width: "60px", height: "40px", objectFit: "cover", borderRadius: "4px", cursor: "pointer", border: "1px solid #E5E7EB" }} 
                          onClick={() => setLightboxImage(item.imageUrl)}
                        />
                      </td>
                      <td style={{ fontSize: "0.9rem", color: "var(--text-secondary)" }}>
                        {item.createdAt ? new Date(item.createdAt.toDate()).toLocaleDateString("vi-VN") : ""}
                      </td>
                      <td>
                        <select 
                          value={item.status || "pending"} 
                          onChange={(e) => handleUpdateStatus(item.id, e.target.value)}
                          style={{
                            padding: "4px 8px", borderRadius: "12px", fontSize: "0.85rem", fontWeight: "600", border: "none", outline: "none", cursor: "pointer",
                            background: item.status === "approved" ? "rgba(16, 185, 129, 0.15)" : item.status === "rejected" ? "rgba(239, 68, 68, 0.15)" : "rgba(245, 158, 11, 0.15)",
                            color: item.status === "approved" ? "var(--success)" : item.status === "rejected" ? "var(--danger)" : "#D97706"
                          }}
                        >
                          <option value="pending" style={{color: "black"}}>Chờ duyệt</option>
                          <option value="approved" style={{color: "black"}}>Đã duyệt</option>
                          <option value="rejected" style={{color: "black"}}>Từ chối</option>
                        </select>
                      </td>
                      <td>
                        <Link href={`/admin/edit/${item.id}`} className="btn" style={{ background: "#E5E7EB", color: "var(--text-primary)", padding: "0.4rem 0.8rem", fontSize: "0.85rem", boxShadow: "none" }}>
                          Sửa
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Lightbox Modal */}
      {lightboxImage && (
        <div 
          style={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", background: "rgba(0,0,0,0.8)", zIndex: 1000, display: "flex", justifyContent: "center", alignItems: "center", cursor: "zoom-out" }}
          onClick={() => setLightboxImage(null)}
        >
          <img src={lightboxImage} alt="Phóng to" style={{ maxWidth: "90%", maxHeight: "90%", borderRadius: "8px", objectFit: "contain", boxShadow: "0 10px 25px rgba(0,0,0,0.5)" }} />
        </div>
      )}
    </AdminGuard>
  );
}
