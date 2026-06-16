"use client";

import { useEffect, useState } from "react";
import AdminGuard from "@/components/AdminGuard";
import { db } from "@/lib/firebase";
import { collection, query, orderBy, onSnapshot } from "firebase/firestore";
import Link from "next/link";

export default function AdminDashboard() {
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(true);

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

  return (
    <AdminGuard>
      <div className="glass-panel" style={{ marginTop: "2rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "2rem" }}>
          <h2 className="page-title" style={{ margin: 0, fontSize: "1.8rem" }}>Quản lý lịch học khách thuê</h2>
          <span style={{ background: "var(--primary)", color: "white", padding: "0.5rem 1rem", borderRadius: "20px", fontSize: "0.9rem", fontWeight: "600" }}>
            Tổng số: {schedules.length}
          </span>
        </div>

        {loading ? (
          <div className="loader"></div>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Họ và Tên</th>
                  <th>Lớp</th>
                  <th>Mã sinh viên</th>
                  <th>Trường</th>
                  <th>Email</th>
                  <th>Ảnh lịch</th>
                  <th>Ngày nộp</th>
                  <th>Hành động</th>
                </tr>
              </thead>
              <tbody>
                {schedules.length === 0 ? (
                  <tr>
                    <td colSpan="8" style={{ textAlign: "center", padding: "2rem", color: "var(--text-secondary)" }}>Chưa có lịch học nào được nộp.</td>
                  </tr>
                ) : (
                  schedules.map((item) => (
                    <tr key={item.id}>
                      <td style={{ fontWeight: 600 }}>{item.name}</td>
                      <td>{item.className}</td>
                      <td>{item.studentId}</td>
                      <td>{item.school}</td>
                      <td style={{ fontSize: "0.9rem", color: "var(--text-secondary)" }}>{item.userEmail}</td>
                      <td>
                        <a href={item.imageUrl} target="_blank" rel="noopener noreferrer" style={{ color: "var(--primary)", textDecoration: "underline", fontSize: "0.9rem", fontWeight: "500" }}>
                          Xem ảnh
                        </a>
                      </td>
                      <td style={{ fontSize: "0.9rem", color: "var(--text-secondary)" }}>
                        {item.createdAt ? new Date(item.createdAt.toDate()).toLocaleDateString("vi-VN") : "Đang cập nhật"}
                      </td>
                      <td>
                        <Link href={`/admin/edit/${item.id}`} className="btn" style={{ background: "#E5E7EB", color: "var(--text-primary)", padding: "0.4rem 0.8rem", fontSize: "0.85rem", boxShadow: "none" }}>
                          Chỉnh sửa
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
    </AdminGuard>
  );
}
