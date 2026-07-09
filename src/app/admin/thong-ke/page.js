"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { db } from "@/lib/firebase";
import { collection, query, onSnapshot } from "firebase/firestore";
import Link from "next/link";

export default function ThongKePage() {
  const { user, loading, isAdmin } = useAuth();
  const router = useRouter();

  const [schedules, setSchedules] = useState([]);
  const [users, setUsers] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [loadingData, setLoadingData] = useState(true);

  // Phân quyền bảo vệ trang Admin
  useEffect(() => {
    if (!loading && (!user || !isAdmin)) {
      router.push("/");
    }
  }, [user, loading, isAdmin, router]);

  useEffect(() => {
    if (!user || !isAdmin) return;

    // Lắng nghe dữ liệu
    const unsubscribeSchedules = onSnapshot(collection(db, "schedules"), (snapshot) => {
      const sData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setSchedules(sData);
    });

    const unsubscribeUsers = onSnapshot(collection(db, "users"), (snapshot) => {
      const uData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setUsers(uData);
    });

    const unsubscribeTrans = onSnapshot(collection(db, "transactions"), (snapshot) => {
      const tData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setTransactions(tData);
    });

    setLoadingData(false);

    return () => {
      unsubscribeSchedules();
      unsubscribeUsers();
      unsubscribeTrans();
    };
  }, [user, isAdmin]);

  if (loading || loadingData || !user || !isAdmin) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "80vh", color: "var(--text-secondary)" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ border: "4px solid #f3f3f3", borderTop: "4px solid var(--primary)", borderRadius: "50%", width: "40px", height: "40px", animation: "spin 1s linear infinite", margin: "0 auto 1rem auto" }}></div>
          <p>Đang tải dữ liệu báo cáo thống kê...</p>
          <style dangerouslySetInnerHTML={{ __html: `@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }` }} />
        </div>
      </div>
    );
  }

  // 1. TÍNH TOÁN CÁC CHỈ SỐ TÀI CHÍNH
  const completedSchedules = schedules.filter(s => s.status === "completed");
  
  // Doanh thu gộp (Tổng tiền khách đặt của các đơn đã hoàn thành)
  const totalRevenue = completedSchedules.reduce((acc, curr) => {
    const priceNum = curr.price ? Number(String(curr.price).replace(/\./g, "")) : 0;
    return acc + priceNum;
  }, 0);

  // Chi phí thù lao CTV thực tế (Dựa trên payoutAmount của đơn đã hoàn thành, nếu chưa gán thì mặc định 75%)
  const totalPayout = completedSchedules.reduce((acc, curr) => {
    if (curr.payoutAmount !== undefined) return acc + Number(curr.payoutAmount);
    const priceNum = curr.price ? Number(String(curr.price).replace(/\./g, "")) : 0;
    return acc + Math.floor(priceNum * 0.75);
  }, 0);

  // Lợi nhuận thực tế của Admin (Doanh thu - Chi phí CTV)
  const netProfit = totalRevenue - totalPayout;

  // Tổng số dư ví thù lao tích lũy hiện có của toàn bộ CTV
  const totalHelperBalances = users
    .filter(u => u.role === "helper")
    .reduce((acc, curr) => acc + (curr.helperBalance || 0), 0);

  // 2. PHÂN TÍCH ĐƠN HÀNG
  const totalOrdersCount = schedules.length;
  const statusCounts = {
    pending: schedules.filter(s => s.status === "pending").length,
    accepted: schedules.filter(s => s.status === "accepted").length,
    in_progress: schedules.filter(s => s.status === "in_progress").length,
    proof_submitted: schedules.filter(s => s.status === "proof_submitted").length,
    completed: completedSchedules.length,
    rejected: schedules.filter(s => s.status === "rejected").length,
  };

  // 3. THỐNG KÊ DOANH THU 7 NGÀY GẦN NHẤT (Vẽ biểu đồ SVG)
  const getLast7DaysData = () => {
    const daysData = [];
    const today = new Date();
    
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(today.getDate() - i);
      const dateStr = d.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" });
      const dStart = new Date(d.setHours(0, 0, 0, 0)).getTime();
      const dEnd = new Date(d.setHours(23, 59, 59, 999)).getTime();

      // Tính doanh thu ngày đó
      const revForDay = completedSchedules
        .filter(s => {
          if (!s.createdAt) return false;
          const sTime = s.createdAt.toMillis ? s.createdAt.toMillis() : new Date(s.createdAt).getTime();
          return sTime >= dStart && sTime <= dEnd;
        })
        .reduce((acc, curr) => {
          const priceNum = curr.price ? Number(String(curr.price).replace(/\./g, "")) : 0;
          return acc + priceNum;
        }, 0);

      daysData.push({ label: dateStr, value: revForDay });
    }
    return daysData;
  };

  const chartData = getLast7DaysData();
  const maxChartValue = Math.max(...chartData.map(d => d.value), 100000);

  // 4. BẢNG XẾP HẠNG TOP CTV (Helpers)
  const helperRankings = users
    .filter(u => u.role === "helper")
    .map(helper => {
      // Số đơn hoàn thành của helper này
      const completedCount = completedSchedules.filter(s => s.assignedTo === helper.name).length;
      // Tổng thù lao đã kiếm
      const totalEarned = completedSchedules
        .filter(s => s.assignedTo === helper.name)
        .reduce((acc, curr) => {
          if (curr.payoutAmount !== undefined) return acc + Number(curr.payoutAmount);
          const priceNum = curr.price ? Number(String(curr.price).replace(/\./g, "")) : 0;
          return acc + Math.floor(priceNum * 0.75);
        }, 0);

      return {
        name: helper.name,
        alias: helper.alias,
        email: helper.email,
        completedCount,
        totalEarned
      };
    })
    .sort((a, b) => b.completedCount - a.completedCount)
    .slice(0, 5); // Lấy top 5

  return (
    <div style={{ padding: "2rem 0", maxWidth: "1200px", margin: "0 auto" }}>
      
      {/* Header điều hướng */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "2rem" }}>
        <div>
          <h1 className="page-title" style={{ fontSize: "2rem", margin: 0, display: "flex", alignItems: "center", gap: "10px" }}>
            📊 Thống Kê Doanh Thu & Tài Chính
          </h1>
          <p style={{ margin: "5px 0 0 0", color: "var(--text-secondary)", fontSize: "0.9rem" }}>Báo cáo hiệu quả kinh doanh và hoạt động của Cộng tác viên</p>
        </div>
        <Link href="/admin" className="btn" style={{ background: "white", color: "var(--primary)", border: "1px solid var(--primary)", padding: "0.6rem 1.2rem", borderRadius: "10px", textDecoration: "none", fontWeight: "600", fontSize: "0.9rem" }}>
          ⬅️ Quay lại Admin Panel
        </Link>
      </div>

      {/* Grid thẻ thông số tài chính */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "1.5rem", marginBottom: "2rem" }}>
        
        {/* Doanh thu */}
        <div className="glass-panel" style={{ padding: "1.5rem", background: "linear-gradient(135deg, rgba(22,163,74,0.03) 0%, rgba(255,255,255,1) 100%)", borderLeft: "5px solid var(--primary)" }}>
          <span style={{ fontSize: "0.85rem", color: "var(--text-secondary)", fontWeight: "600" }}>TỔNG DOANH THU GỘP</span>
          <h2 style={{ fontSize: "1.8rem", color: "var(--primary)", fontWeight: "850", margin: "8px 0 0 0" }}>{totalRevenue.toLocaleString("vi-VN")} đ</h2>
          <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)", display: "block", marginTop: "8px" }}>Từ {completedSchedules.length} đơn đã hoàn thành</span>
        </div>

        {/* Thù lao CTV */}
        <div className="glass-panel" style={{ padding: "1.5rem", background: "linear-gradient(135deg, rgba(79,70,229,0.03) 0%, rgba(255,255,255,1) 100%)", borderLeft: "5px solid #4F46E5" }}>
          <span style={{ fontSize: "0.85rem", color: "#4F46E5", fontWeight: "600" }}>TỔNG CHI THÙ LAO CTV</span>
          <h2 style={{ fontSize: "1.8rem", color: "#4F46E5", fontWeight: "850", margin: "8px 0 0 0" }}>{totalPayout.toLocaleString("vi-VN")} đ</h2>
          <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)", display: "block", marginTop: "8px" }}>Khoản chi trả thực tế cho CTV trực lớp</span>
        </div>

        {/* Lợi nhuận Admin */}
        <div className="glass-panel" style={{ padding: "1.5rem", background: "linear-gradient(135deg, rgba(139,92,246,0.03) 0%, rgba(255,255,255,1) 100%)", borderLeft: "5px solid #8B5CF6" }}>
          <span style={{ fontSize: "0.85rem", color: "#8B5CF6", fontWeight: "600" }}>LỢI NHUẬN THỰC TẾ (ADMIN)</span>
          <h2 style={{ fontSize: "1.8rem", color: "#8B5CF6", fontWeight: "850", margin: "8px 0 0 0" }}>{netProfit.toLocaleString("vi-VN")} đ</h2>
          <span style={{ fontSize: "0.75rem", color: "var(--success)", display: "block", marginTop: "8px", fontWeight: "600" }}>
            📈 Đạt {totalRevenue > 0 ? ((netProfit / totalRevenue) * 100).toFixed(1) : 0}% biên lợi nhuận
          </span>
        </div>

        {/* Quỹ thù lao CTV */}
        <div className="glass-panel" style={{ padding: "1.5rem", background: "linear-gradient(135deg, rgba(217,119,6,0.03) 0%, rgba(255,255,255,1) 100%)", borderLeft: "5px solid #D97706" }}>
          <span style={{ fontSize: "0.85rem", color: "#D97706", fontWeight: "600" }}>QUỸ VÍ CTV TÍCH LŨY</span>
          <h2 style={{ fontSize: "1.8rem", color: "#D97706", fontWeight: "850", margin: "8px 0 0 0" }}>{totalHelperBalances.toLocaleString("vi-VN")} đ</h2>
          <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)", display: "block", marginTop: "8px" }}>Số thù lao CTV tích lũy chưa thực hiện rút</span>
        </div>

      </div>

      {/* Phần 2: Biểu đồ và Phân tích trạng thái đơn */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))", gap: "2rem", marginBottom: "2rem" }}>
        
        {/* Biểu đồ cột SVG Doanh thu 7 ngày */}
        <div className="glass-panel" style={{ padding: "2rem" }}>
          <h3 style={{ margin: "0 0 1.5rem 0", fontSize: "1.1rem", fontWeight: "800", color: "var(--text-primary)" }}>
            📈 Biểu đồ Doanh thu 7 ngày qua
          </h3>
          
          {/* Lưới vẽ cột */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", height: "200px", borderBottom: "2px solid #e2e8f0", paddingBottom: "10px", position: "relative" }}>
            {chartData.map((day, idx) => {
              // Tính tỉ lệ phần trăm chiều cao cột
              const pctHeight = (day.value / maxChartValue) * 100;
              return (
                <div key={idx} style={{ display: "flex", flexDirection: "column", alignItems: "center", flex: 1 }}>
                  {/* Tooltip giá trị trên đầu cột */}
                  <span style={{ fontSize: "0.7rem", fontWeight: "700", color: "var(--primary)", marginBottom: "4px" }}>
                    {day.value > 0 ? `${(day.value / 1000).toFixed(0)}k` : ""}
                  </span>
                  
                  {/* Cột màu xanh lá */}
                  <div 
                    style={{
                      width: "30px",
                      height: `${Math.max(pctHeight * 1.5, 4)}px`, // Giới hạn chiều cao hiển thị
                      maxHeight: "150px",
                      background: "linear-gradient(180deg, var(--primary) 0%, var(--primary-light) 100%)",
                      borderRadius: "6px 6px 0 0",
                      transition: "all 0.5s ease-out",
                      boxShadow: "0 4px 10px rgba(22, 163, 74, 0.2)"
                    }}
                  />
                  
                  {/* Nhãn ngày */}
                  <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)", marginTop: "8px", fontWeight: "600" }}>
                    {day.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Thống kê chi tiết trạng thái đơn */}
        <div className="glass-panel" style={{ padding: "2rem" }}>
          <h3 style={{ margin: "0 0 1.5rem 0", fontSize: "1.1rem", fontWeight: "800", color: "var(--text-primary)" }}>
            📋 Phân tích trạng thái đơn thuê học ({totalOrdersCount} đơn)
          </h3>
          
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            
            {/* Hoàn thành */}
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem", fontWeight: "600", marginBottom: "4px" }}>
                <span>Hoàn thành đơn học</span>
                <span style={{ color: "var(--success)" }}>{statusCounts.completed} ({totalOrdersCount > 0 ? ((statusCounts.completed / totalOrdersCount) * 100).toFixed(0) : 0}%)</span>
              </div>
              <div style={{ width: "100%", height: "8px", background: "#f1f5f9", borderRadius: "4px", overflow: "hidden" }}>
                <div style={{ width: `${totalOrdersCount > 0 ? (statusCounts.completed / totalOrdersCount) * 100 : 0}%`, height: "100%", background: "var(--success)" }}></div>
              </div>
            </div>

            {/* Đang học / Đã nhận */}
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem", fontWeight: "600", marginBottom: "4px" }}>
                <span>Đang xử lý / Sắp học</span>
                <span style={{ color: "#4F46E5" }}>{statusCounts.accepted + statusCounts.in_progress} ({totalOrdersCount > 0 ? (((statusCounts.accepted + statusCounts.in_progress) / totalOrdersCount) * 100).toFixed(0) : 0}%)</span>
              </div>
              <div style={{ width: "100%", height: "8px", background: "#f1f5f9", borderRadius: "4px", overflow: "hidden" }}>
                <div style={{ width: `${totalOrdersCount > 0 ? ((statusCounts.accepted + statusCounts.in_progress) / totalOrdersCount) * 100 : 0}%`, height: "100%", background: "#4F46E5" }}></div>
              </div>
            </div>

            {/* Chờ duyệt minh chứng */}
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem", fontWeight: "600", marginBottom: "4px" }}>
                <span>Chờ duyệt báo cáo (Proof submitted)</span>
                <span style={{ color: "#D97706" }}>{statusCounts.proof_submitted} ({totalOrdersCount > 0 ? ((statusCounts.proof_submitted / totalOrdersCount) * 100).toFixed(0) : 0}%)</span>
              </div>
              <div style={{ width: "100%", height: "8px", background: "#f1f5f9", borderRadius: "4px", overflow: "hidden" }}>
                <div style={{ width: `${totalOrdersCount > 0 ? (statusCounts.proof_submitted / totalOrdersCount) * 100 : 0}%`, height: "100%", background: "#D97706" }}></div>
              </div>
            </div>

            {/* Chờ học viên thanh toán */}
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem", fontWeight: "600", marginBottom: "4px" }}>
                <span>Chờ thanh toán (Mới nộp)</span>
                <span style={{ color: "#64748B" }}>{statusCounts.pending} ({totalOrdersCount > 0 ? ((statusCounts.pending / totalOrdersCount) * 100).toFixed(0) : 0}%)</span>
              </div>
              <div style={{ width: "100%", height: "8px", background: "#f1f5f9", borderRadius: "4px", overflow: "hidden" }}>
                <div style={{ width: `${totalOrdersCount > 0 ? (statusCounts.pending / totalOrdersCount) * 100 : 0}%`, height: "100%", background: "#64748B" }}></div>
              </div>
            </div>

          </div>
        </div>

      </div>

      {/* Bảng xếp hạng Cộng tác viên */}
      <div className="glass-panel" style={{ padding: "2rem", marginBottom: "2rem" }}>
        <h3 style={{ margin: "0 0 1.5rem 0", fontSize: "1.1rem", fontWeight: "800", color: "var(--text-primary)" }}>
          🏆 Bảng xếp hạng CTV tích cực nhất (Top Hoạt Động)
        </h3>
        
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
            <thead>
              <tr style={{ borderBottom: "2px solid #e2e8f0", color: "var(--text-secondary)", fontSize: "0.85rem" }}>
                <th style={{ padding: "0.8rem 1.5rem" }}>Tên CTV / Email</th>
                <th>Số đơn hoàn thành</th>
                <th>Tổng thù lao đã kiếm</th>
                <th>Hiệu suất đóng góp</th>
              </tr>
            </thead>
            <tbody>
              {helperRankings.length === 0 ? (
                <tr>
                  <td colSpan="4" style={{ textAlign: "center", padding: "2rem", color: "var(--text-secondary)" }}>
                    Chưa ghi nhận CTV nào có đơn hoàn thành.
                  </td>
                </tr>
              ) : (
                helperRankings.map((h, index) => (
                  <tr key={index} style={{ borderBottom: "1px solid #f1f5f9" }}>
                    <td style={{ padding: "1rem 1.5rem" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        <div style={{ width: "24px", height: "24px", borderRadius: "50%", background: index === 0 ? "gold" : index === 1 ? "silver" : index === 2 ? "#CD7F32" : "#f1f5f9", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.75rem", fontWeight: "800", color: index < 3 ? "white" : "var(--text-secondary)" }}>
                          {index + 1}
                        </div>
                        <div>
                          <div style={{ fontWeight: "700", color: "var(--text-primary)" }}>
                            {h.name} {h.alias && <span style={{ color: "var(--primary)", fontSize: "0.8rem", fontWeight: "500" }}>({h.alias})</span>}
                          </div>
                          <div style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>{h.email}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ fontWeight: "700" }}>{h.completedCount} đơn</td>
                    <td style={{ color: "var(--primary)", fontWeight: "700" }}>{h.totalEarned.toLocaleString("vi-VN")} VNĐ</td>
                    <td>
                      <div style={{ display: "inline-block", background: "rgba(22, 163, 74, 0.08)", color: "var(--primary)", padding: "4px 8px", borderRadius: "12px", fontSize: "0.8rem", fontWeight: "700" }}>
                        🔥 Top {index + 1}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
