"use client";

import { useEffect, useState } from "react";
import AdminGuard from "@/components/AdminGuard";
import { db } from "@/lib/firebase";
import { collection, query, orderBy, onSnapshot, doc, updateDoc, deleteDoc, setDoc, increment, addDoc, serverTimestamp } from "firebase/firestore";
import Link from "next/link";
import toast from "react-hot-toast";
import { useAuth } from "@/context/AuthContext";

export default function AdminDashboard() {
  const { systemSettings } = useAuth();

  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [lightboxImage, setLightboxImage] = useState(null);
  const [viewMode, setViewMode] = useState("grid"); // "grid" or "list"
  const [sortBy, setSortBy] = useState("newest"); // "newest", "oldest", "dateNearest", "priceHigh", "priceLow"

  const [activeTab, setActiveTab] = useState("schedules"); // "schedules" or "users" or "helpers"
  const [users, setUsers] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [helpers, setHelpers] = useState([]);

  const [settingsForm, setSettingsForm] = useState({
    bankName: "MBBank",
    bankAccount: "",
    bankOwner: "",
    announcement: "",
    hotline: "0999.888.777",
    zaloContact: "",
    telegramBotToken: "",
    telegramChatId: ""
  });
  const [savingSettings, setSavingSettings] = useState(false);

  useEffect(() => {
    if (systemSettings) {
      setSettingsForm({
        bankName: systemSettings.bankName || "MBBank",
        bankAccount: systemSettings.bankAccount || "",
        bankOwner: systemSettings.bankOwner || "",
        announcement: systemSettings.announcement || "",
        hotline: systemSettings.hotline || "0999.888.777",
        zaloContact: systemSettings.zaloContact || "",
        telegramBotToken: systemSettings.telegramBotToken || "",
        telegramChatId: systemSettings.telegramChatId || ""
      });
    }
  }, [systemSettings]);

  useEffect(() => {
    // Lấy dữ liệu Thuê Học
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

    // Lấy dữ liệu Cộng Tác Viên
    const qHelpers = query(collection(db, "helpers"), orderBy("createdAt", "desc"));
    const unsubscribeHelpers = onSnapshot(qHelpers, (snapshot) => {
      const hData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setHelpers(hData);
    });

    // Lấy dữ liệu giao dịch nạp ví
    const qTrans = query(collection(db, "transactions"));
    const unsubscribeTrans = onSnapshot(qTrans, (snapshot) => {
      const tData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      tData.sort((a, b) => {
        const timeA = a.createdAt ? a.createdAt.toMillis() : 0;
        const timeB = b.createdAt ? b.createdAt.toMillis() : 0;
        return timeB - timeA;
      });
      setTransactions(tData);
    }, (err) => console.error("Lỗi lấy transactions:", err));

    return () => { unsubscribeSchedules(); unsubscribeUsers(); unsubscribeHelpers(); unsubscribeTrans(); };
  }, []);

  const handleUpdateStatus = async (id, newStatus) => {
    try {
      const schedule = schedules.find(s => s.id === id);
      await updateDoc(doc(db, "schedules", id), { status: newStatus });
      toast.success("Cập nhật trạng thái thành công");

      if (schedule && schedule.userId) {
        let statusText = "";
        if (newStatus === "accepted") statusText = "đã được chấp nhận (Sắp học)";
        if (newStatus === "completed") statusText = "đã hoàn thành (Vui lòng đánh giá)";
        if (newStatus === "rejected") statusText = "đã bị từ chối";
        if (newStatus === "in_progress") statusText = "đang học";
        if (newStatus === "paid") statusText = "đã được xác nhận thanh toán";

        if (statusText) {
          await addDoc(collection(db, "notifications"), {
            userId: schedule.userId,
            title: "Cập nhật lịch học hộ",
            message: `Lịch học môn ${schedule.className} ngày ${new Date(schedule.classDate).toLocaleDateString("vi-VN")} của bạn ${statusText}.`,
            read: false,
            link: "/dashboard",
            createdAt: serverTimestamp()
          });
        }
      }
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

  const handleSaveSettings = async (e) => {
    e.preventDefault();
    setSavingSettings(true);
    try {
      await setDoc(doc(db, "settings", "system"), settingsForm);
      toast.success("Cập nhật cấu hình hệ thống thành công!");
    } catch (err) {
      console.error(err);
      toast.error("Lỗi khi lưu cấu hình!");
    } finally {
      setSavingSettings(false);
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

  const handleAssignHelper = async (scheduleId, helperName) => {
    try {
      await updateDoc(doc(db, "schedules", scheduleId), { assignedTo: helperName });
      toast.success("Đã giao việc thành công!");
    } catch (error) {
      console.error("Lỗi giao việc:", error);
      toast.error("Giao việc thất bại!");
    }
  };

  const handleUpdateHelperStatus = async (id, newStatus) => {
    try {
      await updateDoc(doc(db, "helpers", id), { 
        status: newStatus,
        isApproved: newStatus === "approved"
      });
      toast.success("Đã cập nhật trạng thái CTV!");
    } catch (err) {
      console.error("Lỗi cập nhật CTV:", err);
      toast.error("Không thể cập nhật CTV");
    }
  };

  const handleDeleteHelper = async (id) => {
    if (confirm("Chắc chắn muốn xóa hồ sơ CTV này?")) {
      try {
        await deleteDoc(doc(db, "helpers", id));
        toast.success("Đã xóa hồ sơ CTV!");
      } catch (err) {
        toast.error("Lỗi xóa hồ sơ CTV");
      }
    }
  };

  const handleAdjustBalance = async (uid, amount) => {
    try {
      await updateDoc(doc(db, "users", uid), {
        balance: increment(amount)
      });
      toast.success("Đã điều chỉnh số dư Ví thành công!");

      await addDoc(collection(db, "notifications"), {
        userId: uid,
        title: amount > 0 ? "Nạp tiền ví thành công" : "Biến động số dư ví",
        message: amount > 0 
          ? `Tài khoản của bạn đã được cộng ${amount.toLocaleString("vi-VN")} đ vào số dư ví.` 
          : `Số dư ví của bạn đã thay đổi ${amount.toLocaleString("vi-VN")} đ.`,
        read: false,
        link: "/dashboard",
        createdAt: serverTimestamp()
      });
    } catch (err) {
      console.error("Lỗi điều chỉnh ví:", err);
      toast.error("Không thể điều chỉnh ví.");
    }
  };

  const handleApproveTransaction = async (trans) => {
    try {
      await updateDoc(doc(db, "transactions", trans.id), { status: "completed" });
      await updateDoc(doc(db, "users", trans.userId), {
        balance: increment(trans.amount)
      });

      // Tạo thông báo cho khách hàng
      await addDoc(collection(db, "notifications"), {
        userId: trans.userId,
        title: "Nạp tiền ví thành công",
        message: `Yêu cầu nạp ví ${trans.amount.toLocaleString("vi-VN")} đ của bạn đã được duyệt thành công.`,
        read: false,
        link: "/dashboard",
        createdAt: serverTimestamp()
      });

      toast.success("Đã phê duyệt và cộng tiền ví thành công!");
    } catch (err) {
      console.error("Lỗi duyệt nạp tiền:", err);
      toast.error("Không thể duyệt giao dịch.");
    }
  };

  const handleRejectTransaction = async (trans) => {
    try {
      await updateDoc(doc(db, "transactions", trans.id), { status: "rejected" });

      // Tạo thông báo cho khách hàng
      await addDoc(collection(db, "notifications"), {
        userId: trans.userId,
        title: "Yêu cầu nạp ví bị từ chối",
        message: `Yêu cầu nạp ví ${trans.amount.toLocaleString("vi-VN")} đ đã bị từ chối do không khớp sao kê ngân hàng.`,
        read: false,
        link: "/dashboard",
        createdAt: serverTimestamp()
      });

      toast.success("Đã từ chối giao dịch!");
    } catch (err) {
      console.error("Lỗi từ chối giao dịch:", err);
      toast.error("Không thể từ chối giao dịch.");
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
      (s.className && s.className.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (s.id && s.id.toLowerCase().includes(searchQuery.toLowerCase()));
    
    const matchesStatus = filterStatus === "all" || (s.status || "pending") === filterStatus;
    
    return matchesSearch && matchesStatus;
  });

  const sortedSchedules = [...filteredSchedules].sort((a, b) => {
    if (sortBy === "newest") {
      const tA = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : 0;
      const tB = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : 0;
      return tB - tA;
    }
    if (sortBy === "oldest") {
      const tA = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : 0;
      const tB = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : 0;
      return tA - tB;
    }
    if (sortBy === "dateNearest") {
      const tA = a.classDate ? new Date(a.classDate).getTime() : 0;
      const tB = b.classDate ? new Date(b.classDate).getTime() : 0;
      return tA - tB;
    }
    if (sortBy === "priceHigh") {
      return (Number(b.price) || 0) - (Number(a.price) || 0);
    }
    if (sortBy === "priceLow") {
      return (Number(a.price) || 0) - (Number(b.price) || 0);
    }
    return 0;
  });

  const filteredUsers = users.filter(u => 
    (u.email && u.email.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (u.displayName && u.displayName.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <AdminGuard>
      <div style={{ marginTop: "2rem" }}>
        
        {/* Tabs Navigation */}
        <div 
          className="hide-scrollbar" 
          style={{ 
            display: "flex", 
            gap: "1rem", 
            marginBottom: "1.5rem", 
            borderBottom: "2px solid rgba(0,0,0,0.05)", 
            paddingBottom: "1rem",
            overflowX: "auto",
            whiteSpace: "nowrap",
            WebkitOverflowScrolling: "touch"
          }}
        >
          <button 
            onClick={() => setActiveTab("schedules")}
            style={{ flexShrink: 0, padding: "0.6rem 1.5rem", border: "none", background: activeTab === "schedules" ? "var(--primary)" : "transparent", color: activeTab === "schedules" ? "white" : "var(--text-secondary)", borderRadius: "8px", fontWeight: "600", cursor: "pointer", transition: "all 0.2s", boxShadow: activeTab === "schedules" ? "0 4px 12px rgba(22, 163, 74, 0.3)" : "none" }}
          >
            <svg style={{ width: "18px", height: "18px", inlineSize: "18px", verticalAlign: "middle", marginRight: "6px" }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
            Quản lý Đơn Thuê Học
          </button>
          <button 
            onClick={() => setActiveTab("users")}
            style={{ flexShrink: 0, padding: "0.6rem 1.5rem", border: "none", background: activeTab === "users" ? "var(--primary)" : "transparent", color: activeTab === "users" ? "white" : "var(--text-secondary)", borderRadius: "8px", fontWeight: "600", cursor: "pointer", transition: "all 0.2s", boxShadow: activeTab === "users" ? "0 4px 12px rgba(22, 163, 74, 0.3)" : "none" }}
          >
            <svg style={{ width: "18px", height: "18px", inlineSize: "18px", verticalAlign: "middle", marginRight: "6px" }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"></path></svg>
            Quản lý Tài Khoản
          </button>
          <button 
            onClick={() => setActiveTab("helpers")}
            style={{ flexShrink: 0, padding: "0.6rem 1.5rem", border: "none", background: activeTab === "helpers" ? "var(--primary)" : "transparent", color: activeTab === "helpers" ? "white" : "var(--text-secondary)", borderRadius: "8px", fontWeight: "600", cursor: "pointer", transition: "all 0.2s", boxShadow: activeTab === "helpers" ? "0 4px 12px rgba(22, 163, 74, 0.3)" : "none" }}
          >
            <svg style={{ width: "18px", height: "18px", inlineSize: "18px", verticalAlign: "middle", marginRight: "6px" }} fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 14l9-5-9-5-9 5 9 5z"></path><path strokeLinecap="round" strokeLinejoin="round" d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z"></path></svg>
            Quản lý CTV
          </button>
          <button 
            onClick={() => setActiveTab("transactions")}
            style={{ flexShrink: 0, padding: "0.6rem 1.5rem", border: "none", background: activeTab === "transactions" ? "var(--primary)" : "transparent", color: activeTab === "transactions" ? "white" : "var(--text-secondary)", borderRadius: "8px", fontWeight: "600", cursor: "pointer", transition: "all 0.2s", boxShadow: activeTab === "transactions" ? "0 4px 12px rgba(22, 163, 74, 0.3)" : "none" }}
          >
            <svg style={{ width: "18px", height: "18px", inlineSize: "18px", verticalAlign: "middle", marginRight: "6px" }} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M12 16v1m4 2H8a2 2 0 01-2-2V8a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2z"></path></svg>
            Duyệt Nạp Ví
          </button>
          <button 
            onClick={() => setActiveTab("settings")}
            style={{ flexShrink: 0, padding: "0.6rem 1.5rem", border: "none", background: activeTab === "settings" ? "var(--primary)" : "transparent", color: activeTab === "settings" ? "white" : "var(--text-secondary)", borderRadius: "8px", fontWeight: "600", cursor: "pointer", transition: "all 0.2s", boxShadow: activeTab === "settings" ? "0 4px 12px rgba(22, 163, 74, 0.3)" : "none" }}
          >
            <svg style={{ width: "18px", height: "18px", inlineSize: "18px", verticalAlign: "middle", marginRight: "6px" }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path><circle cx="12" cy="12" r="3" strokeWidth="2"></circle></svg>
            Cấu hình hệ thống
          </button>
        </div>

        {activeTab === "schedules" && (
          <>
            {/* Statistics Cards */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "1rem", marginBottom: "1.5rem" }}>
              <div className="glass-panel" style={{ padding: "1rem", display: "flex", alignItems: "center", justifyContent: "space-between", borderLeft: "4px solid var(--primary)", borderTop: "none", borderRadius: "16px" }}>
                <div style={{ textAlign: "left" }}>
                  <p style={{ margin: 0, fontSize: "0.72rem", color: "var(--text-secondary)", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.5px" }}>Tổng đơn</p>
                  <h4 style={{ margin: "2px 0 0 0", fontSize: "1.6rem", fontWeight: "800", color: "var(--text-primary)" }}>{schedules.length}</h4>
                </div>
                <div style={{ background: "rgba(22, 163, 74, 0.1)", color: "var(--primary)", padding: "6px 8px", borderRadius: "8px" }}>
                  <svg style={{ width: "16px", height: "16px" }} fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"></path></svg>
                </div>
              </div>
              <div className="glass-panel" style={{ padding: "1rem", display: "flex", alignItems: "center", justifyContent: "space-between", borderLeft: "4px solid #8B5CF6", borderTop: "none", borderRadius: "16px" }}>
                <div style={{ textAlign: "left" }}>
                  <p style={{ margin: 0, fontSize: "0.72rem", color: "var(--text-secondary)", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.5px" }}>DT dự kiến</p>
                  <h4 style={{ margin: "2px 0 0 0", fontSize: "1.4rem", fontWeight: "800", color: "#8B5CF6" }}>
                    {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(schedules.filter(s => s.status === "completed").reduce((sum, s) => sum + (Number(s.price) || 0), 0))}
                  </h4>
                </div>
                <div style={{ background: "rgba(139, 92, 246, 0.1)", color: "#8B5CF6", padding: "6px 8px", borderRadius: "8px" }}>
                  <svg style={{ width: "16px", height: "16px" }} fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M12 16v1"></path></svg>
                </div>
              </div>
              <div className="glass-panel" style={{ padding: "1rem", display: "flex", alignItems: "center", justifyContent: "space-between", borderLeft: "4px solid #EC4899", borderTop: "none", borderRadius: "16px" }}>
                <div style={{ textAlign: "left" }}>
                  <p style={{ margin: 0, fontSize: "0.72rem", color: "var(--text-secondary)", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.5px" }}>Đã thanh toán</p>
                  <h4 style={{ margin: "2px 0 0 0", fontSize: "1.6rem", fontWeight: "800", color: "#EC4899" }}>{schedules.filter(s => s.status === "paid").length}</h4>
                </div>
                <div style={{ background: "rgba(236, 72, 153, 0.1)", color: "#EC4899", padding: "6px 8px", borderRadius: "8px" }}>
                  <svg style={{ width: "16px", height: "16px" }} fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                </div>
              </div>
              <div className="glass-panel" style={{ padding: "1rem", display: "flex", alignItems: "center", justifyContent: "space-between", borderLeft: "4px solid #D97706", borderTop: "none", borderRadius: "16px" }}>
                <div style={{ textAlign: "left" }}>
                  <p style={{ margin: 0, fontSize: "0.72rem", color: "var(--text-secondary)", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.5px" }}>Chờ duyệt</p>
                  <h4 style={{ margin: "2px 0 0 0", fontSize: "1.6rem", fontWeight: "800", color: "#D97706" }}>{schedules.filter(s => (s.status || "pending") === "pending").length}</h4>
                </div>
                <div style={{ background: "rgba(217, 119, 6, 0.1)", color: "#D97706", padding: "6px 8px", borderRadius: "8px" }}>
                  <svg style={{ width: "16px", height: "16px" }} fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                </div>
              </div>
              <div className="glass-panel" style={{ padding: "1rem", display: "flex", alignItems: "center", justifyContent: "space-between", borderLeft: "4px solid var(--success)", borderTop: "none", borderRadius: "16px" }}>
                <div style={{ textAlign: "left" }}>
                  <p style={{ margin: 0, fontSize: "0.72rem", color: "var(--text-secondary)", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.5px" }}>Đã duyệt</p>
                  <h4 style={{ margin: "2px 0 0 0", fontSize: "1.6rem", fontWeight: "800", color: "var(--success)" }}>{schedules.filter(s => s.status === "approved" || s.status === "accepted").length}</h4>
                </div>
                <div style={{ background: "rgba(16, 185, 129, 0.1)", color: "var(--success)", padding: "6px 8px", borderRadius: "8px" }}>
                  <svg style={{ width: "16px", height: "16px" }} fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"></path></svg>
                </div>
              </div>
            </div>

        {/* Toolbar */}
        <div className="glass-panel" style={{ padding: "1rem 1.5rem", marginBottom: "1.5rem" }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ display: "flex", gap: "0.75rem", flex: 1, minWidth: "300px" }}>
              <input 
                type="text" 
                placeholder="Tìm tên, mã SV, lớp..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="form-input"
                style={{ flex: 1, maxWidth: "280px", background: "white" }}
              />
              <select 
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="form-input"
                style={{ width: "auto", background: "white", cursor: "pointer" }}
              >
                <option value="all">Tất cả trạng thái</option>
                <option value="pending">Chờ nhận đơn</option>
                <option value="paid">Đã thanh toán</option>
                <option value="accepted">Sắp học</option>
                <option value="in_progress">Đang học</option>
                <option value="completed">Hoàn thành</option>
                <option value="rejected">Từ chối</option>
              </select>
              <select 
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="form-input"
                style={{ width: "auto", background: "white", cursor: "pointer" }}
              >
                <option value="newest">Mới nhất (Nộp đơn)</option>
                <option value="oldest">Cũ nhất (Nộp đơn)</option>
                <option value="dateNearest">Ngày học (Gần nhất)</option>
                <option value="priceHigh">Giá (Cao ➔ Thấp)</option>
                <option value="priceLow">Giá (Thấp ➔ Cao)</option>
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
          <div className="grid-container">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="grid-card skeleton-pulse" style={{ minHeight: "380px", borderRadius: "16px", background: "rgba(255,255,255,0.4)" }} />
            ))}
          </div>
        ) : sortedSchedules.length === 0 ? (
          <div className="glass-panel" style={{ textAlign: "center", padding: "4rem", color: "var(--text-secondary)" }}>
            <svg style={{ width: "64px", height: "64px", margin: "0 auto 1rem auto", opacity: 0.5 }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
            <h3 style={{ fontSize: "1.2rem", fontWeight: "600" }}>Không tìm thấy dữ liệu</h3>
            <p>Vui lòng thử thay đổi bộ lọc hoặc từ khóa tìm kiếm.</p>
          </div>
        ) : viewMode === "grid" ? (
          /* GRID VIEW */
          <div className="grid-container">
            {sortedSchedules.map((item) => (
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
                      background: item.status === "completed" ? "rgba(139, 92, 246, 0.15)" : item.status === "in_progress" ? "rgba(59, 130, 246, 0.15)" : item.status === "accepted" ? "rgba(16, 185, 129, 0.15)" : item.status === "rejected" ? "rgba(239, 68, 68, 0.15)" : item.status === "paid" ? "rgba(236, 72, 153, 0.15)" : "rgba(245, 158, 11, 0.15)",
                      color: item.status === "completed" ? "#8B5CF6" : item.status === "in_progress" ? "#3B82F6" : item.status === "accepted" ? "var(--success)" : item.status === "rejected" ? "var(--danger)" : item.status === "paid" ? "#EC4899" : "#D97706",
                      boxShadow: "0 2px 4px rgba(0,0,0,0.05)"
                    }}
                  >
                    <option value="pending" style={{color: "black"}}>Chờ nhận đơn</option>
                    <option value="paid" style={{color: "black"}}>Đã thanh toán</option>
                    <option value="accepted" style={{color: "black"}}>Sắp học</option>
                    <option value="in_progress" style={{color: "black"}}>Đang học</option>
                    <option value="completed" style={{color: "black"}}>Hoàn thành</option>
                    <option value="rejected" style={{color: "black"}}>Từ chối</option>
                  </select>
                </div>
                
                <img 
                  src={item.imageUrl} 
                  alt="Lịch" 
                  className="grid-card-image"
                  onClick={() => setLightboxImage(item.imageUrl)}
                />
                
                <div style={{ fontSize: "0.85rem", color: "var(--text-secondary)", marginBottom: "1rem", lineHeight: "1.6" }}>
                  <strong>Mã đơn (VietQR):</strong> <span style={{fontWeight: "700", color: "var(--primary)", fontFamily: "monospace"}}>{item.id.substring(0, 8).toUpperCase()}</span><br/>
                  <strong>Tên người thuê:</strong> <span style={{fontWeight: "600", color: "var(--text-primary)"}}>{item.name}</span><br/>
                  <strong>Mã sinh viên:</strong> <span style={{fontWeight: "600", color: "var(--text-primary)"}}>{item.studentId}</span><br/>
                  <strong>Lớp:</strong> <span style={{fontWeight: "600", color: "var(--text-primary)"}}>{item.className}</span><br/>
                  <strong>Tài khoản:</strong> <span style={{color: "var(--primary)", fontWeight: "600"}}>{item.userEmail || "Không xác định"}</span><br/>
                  <strong>Trường:</strong> {item.school}<br/>
                  {item.price && <><span style={{color: "var(--primary)"}}>Giá đề xuất:</span> {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(item.price)}<br/></>}
                  {item.phone && <><span style={{color: "var(--primary)"}}>SĐT:</span> {item.phone}<br/></>}
                  {item.dob && <><span style={{color: "var(--primary)"}}>Tuổi/NS:</span> {new Date(item.dob).toLocaleDateString("vi-VN")}<br/></>}
                  {item.classDate && <><span style={{color: "var(--primary)"}}>Học:</span> {item.weekday ? `${item.weekday} ` : ''}({new Date(item.classDate).toLocaleDateString("vi-VN")})<br/></>}
                  {item.startTime && item.endTime && <><span style={{color: "var(--primary)"}}>Giờ:</span> {item.startTime} - {item.endTime}<br/></>}
                  {item.notes && <><span style={{color: "var(--primary)"}}>Ghi chú:</span> {item.notes}<br/></>}
                  {item.adminNote && <><span style={{color: "#8B5CF6"}}>Note Admin:</span> {item.adminNote}<br/></>}
                  <strong>Ngày nộp:</strong> {item.createdAt ? new Date(item.createdAt.toDate()).toLocaleDateString("vi-VN") : ""}
                  
                  <div style={{ marginTop: "10px", borderTop: "1px dashed rgba(0,0,0,0.05)", paddingTop: "8px" }}>
                    <label style={{ fontSize: "0.72rem", fontWeight: "700", color: "#8B5CF6", display: "block", marginBottom: "4px" }}>GIAO LỊCH HỌC HỘ:</label>
                    <select
                      value={item.assignedTo || ""}
                      onChange={(e) => handleAssignHelper(item.id, e.target.value)}
                      className="form-input"
                      style={{ padding: "4px 8px", fontSize: "0.8rem", height: "auto", background: "white", cursor: "pointer", borderRadius: "8px", border: "1px solid #cbd5e1" }}
                    >
                      <option value="">-- Chưa giao việc --</option>
                      {helpers.filter(h => h.isApproved).map(h => (
                        <option key={h.id} value={h.name}>{h.name} ({h.school})</option>
                      ))}
                    </select>
                  </div>

                  {item.status === "paid" && (
                    <button
                      onClick={() => handleUpdateStatus(item.id, "accepted")}
                      className="btn btn-primary"
                      style={{
                        width: "100%",
                        marginTop: "1.25rem",
                        padding: "0.6rem",
                        background: "var(--success)",
                        boxShadow: "0 4px 12px rgba(16, 185, 129, 0.2)",
                        fontSize: "0.85rem",
                        fontWeight: "700"
                      }}
                    >
                      🏦 Xác nhận đã nhận tiền
                    </button>
                  )}
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
                {sortedSchedules.map((item) => (
                  <tr key={item.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                    <td style={{ padding: "1rem 1.5rem", verticalAlign: "top" }}>
                      <div style={{ fontWeight: 700, color: "var(--text-primary)" }}>{item.name}</div>
                      <div style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>
                        Mã đơn: <strong style={{color: "var(--primary)", fontFamily: "monospace"}}>{item.id.substring(0, 8).toUpperCase()}</strong><br/>
                        <span style={{color: "var(--primary)", fontWeight: "600"}}>{item.userEmail || "Không xác định"}</span><br/>
                        {item.studentId} • {item.createdAt ? new Date(item.createdAt.toDate()).toLocaleDateString("vi-VN") : ""}
                        {item.phone && <><br/>SĐT: <strong>{item.phone}</strong></>}
                        {item.dob && <><br/>NS: {new Date(item.dob).toLocaleDateString("vi-VN")}</>}
                      </div>
                    </td>
                    <td style={{ verticalAlign: "top", paddingTop: "1rem" }}>
                      <div style={{ fontWeight: 600 }}>{item.school}</div>
                      <div style={{ fontSize: "0.85rem", color: "var(--text-secondary)", lineHeight: "1.5" }}>
                        Lớp: {item.className}
                        {item.classDate && <><br/>Học: {item.weekday} ({new Date(item.classDate).toLocaleDateString("vi-VN")})</>}
                        {item.startTime && item.endTime && <><br/>Giờ: {item.startTime} - {item.endTime}</>}
                        {item.price && <><br/>Giá: <strong style={{color: "var(--primary)"}}>{new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(item.price)}</strong></>}
                        {item.notes && <><br/><i style={{ color: "var(--primary)" }}>Ghi chú: {item.notes}</i></>}
                        
                        <div style={{ marginTop: "6px", maxWidth: "160px" }}>
                          <span style={{ fontSize: "0.72rem", fontWeight: "700", color: "#8B5CF6" }}>Giao việc:</span>
                          <select
                            value={item.assignedTo || ""}
                            onChange={(e) => handleAssignHelper(item.id, e.target.value)}
                            className="form-input"
                            style={{ padding: "2px 4px", fontSize: "0.75rem", height: "auto", background: "white", cursor: "pointer", borderRadius: "6px", width: "100%", marginTop: "2px", border: "1px solid #cbd5e1" }}
                          >
                            <option value="">-- Chưa giao --</option>
                            {helpers.filter(h => h.isApproved).map(h => (
                              <option key={h.id} value={h.name}>{h.name}</option>
                            ))}
                          </select>
                        </div>
                      </div>
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
                          background: item.status === "completed" ? "rgba(139, 92, 246, 0.15)" : item.status === "in_progress" ? "rgba(59, 130, 246, 0.15)" : item.status === "accepted" ? "rgba(16, 185, 129, 0.15)" : item.status === "rejected" ? "rgba(239, 68, 68, 0.15)" : item.status === "paid" ? "rgba(236, 72, 153, 0.15)" : "rgba(245, 158, 11, 0.15)",
                          color: item.status === "completed" ? "#8B5CF6" : item.status === "in_progress" ? "#3B82F6" : item.status === "accepted" ? "var(--success)" : item.status === "rejected" ? "var(--danger)" : item.status === "paid" ? "#EC4899" : "#D97706"
                        }}
                      >
                        <option value="pending" style={{color: "black"}}>Chờ nhận</option>
                        <option value="paid" style={{color: "black"}}>Đã thanh toán</option>
                        <option value="accepted" style={{color: "black"}}>Sắp học</option>
                        <option value="in_progress" style={{color: "black"}}>Đang học</option>
                        <option value="completed" style={{color: "black"}}>Hoàn thành</option>
                        <option value="rejected" style={{color: "black"}}>Từ chối</option>
                      </select>
                      {item.status === "paid" && (
                        <button
                          onClick={() => handleUpdateStatus(item.id, "accepted")}
                          style={{
                            display: "block",
                            marginTop: "6px",
                            padding: "4px 8px",
                            background: "var(--success)",
                            color: "white",
                            border: "none",
                            borderRadius: "6px",
                            fontSize: "0.75rem",
                            fontWeight: "700",
                            cursor: "pointer",
                            boxShadow: "0 2px 6px rgba(16, 185, 129, 0.2)"
                          }}
                        >
                          🏦 Xác nhận tiền
                        </button>
                      )}
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
                    <th>Số điện thoại</th>
                    <th>Ngày hoạt động cuối</th>
                    <th>Số dư Ví</th>
                    <th>Quyền (Role)</th>
                    <th style={{ padding: "1.5rem", borderTopRightRadius: "16px" }}>Hành động</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.length === 0 ? (
                    <tr><td colSpan="7" style={{textAlign:"center", padding:"2rem", color:"var(--text-secondary)"}}>Không tìm thấy tài khoản nào.</td></tr>
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
                        <div style={{ fontWeight: 600, color: "var(--primary)" }}>
                          {u.phone ? (
                            <a href={`https://zalo.me/${u.phone}`} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "underline", color: "var(--primary)" }}>
                              {u.phone} 💬
                            </a>
                          ) : (
                            <span style={{ color: "var(--text-secondary)", fontStyle: "italic", fontSize: "0.85rem" }}>Chưa cập nhật</span>
                          )}
                        </div>
                      </td>
                      <td>
                        <div style={{ fontSize: "0.9rem", color: "var(--text-secondary)" }}>
                          {u.lastLogin ? new Date(u.lastLogin.toDate()).toLocaleString("vi-VN") : "Chưa rõ"}
                        </div>
                      </td>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                          <strong style={{ color: "var(--primary)", fontSize: "0.95rem" }}>{(u.balance || 0).toLocaleString("vi-VN")} đ</strong>
                          <button 
                            onClick={() => {
                              const amount = prompt(`Nhập số tiền muốn nạp cho ${u.displayName || u.email} (Ví dụ: 100000 để cộng, -50000 để trừ):`);
                              if (amount && !isNaN(amount)) {
                                handleAdjustBalance(u.id, Number(amount));
                              }
                            }}
                            style={{ padding: "4px 8px", background: "var(--primary)", color: "white", border: "none", borderRadius: "6px", fontSize: "0.75rem", fontWeight: "700", cursor: "pointer" }}
                          >
                            ± Nạp ví
                          </button>
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
                        <button 
                          onClick={() => handleDeleteUser(u.id)} 
                          style={{ background: "rgba(239, 68, 68, 0.1)", border: "none", color: "var(--danger)", cursor: "pointer", fontWeight: "600", padding: "8px 12px", borderRadius: "8px", transition: "all 0.2s" }} 
                          onMouseOver={(e) => { e.target.style.background = "var(--danger)"; e.target.style.color = "white"; }} 
                          onMouseOut={(e) => { e.target.style.background = "rgba(239, 68, 68, 0.1)"; e.target.style.color = "var(--danger)"; }}
                        >
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

        {/* BẢNG QUẢN LÝ CTV */}
        {activeTab === "helpers" && (
          <>
            <div className="table-container glass-panel" style={{ padding: "0" }}>
              <table style={{ width: "100%" }}>
                <thead>
                  <tr>
                    <th style={{ padding: "1.5rem", borderTopLeftRadius: "16px" }}>Cộng tác viên</th>
                    <th>Trường / Lớp</th>
                    <th>Liên hệ</th>
                    <th>Năng lực & Giờ rảnh</th>
                    <th>Ảnh chân dung/Thẻ SV</th>
                    <th>Trạng thái</th>
                    <th style={{ padding: "1.5rem", borderTopRightRadius: "16px" }}>Hành động</th>
                  </tr>
                </thead>
                <tbody>
                  {helpers.length === 0 ? (
                    <tr><td colSpan="7" style={{textAlign:"center", padding:"2rem", color:"var(--text-secondary)"}}>Không có hồ sơ ứng tuyển nào.</td></tr>
                  ) : helpers.map((h) => (
                    <tr key={h.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                      <td style={{ padding: "1rem 1.5rem" }}>
                        <div style={{ fontWeight: 700, color: "var(--text-primary)" }}>{h.name}</div>
                        <div style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>MSSV: {h.studentId}</div>
                      </td>
                      <td>
                        <div style={{ fontWeight: 600 }}>{h.school}</div>
                        <div style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>Lớp: {h.className}</div>
                      </td>
                      <td>
                        <div style={{ fontWeight: 600 }}>{h.email}</div>
                        <div style={{ fontSize: "0.85rem", color: "var(--primary)" }}>
                          SĐT: <a href={`https://zalo.me/${h.phone}`} target="_blank" rel="noopener noreferrer" style={{ fontWeight: "700", textDecoration: "underline", color: "var(--primary)" }}>{h.phone} 💬</a>
                        </div>
                      </td>
                      <td style={{ maxWidth: "250px", fontSize: "0.85rem", lineHeight: "1.4" }}>
                        <strong>Rảnh:</strong> {h.availability}<br/>
                        <strong style={{ color: "var(--primary)" }}>Giới thiệu:</strong> {h.bio}
                      </td>
                      <td>
                        {h.imageUrl && (
                          <img 
                            src={h.imageUrl} 
                            alt="Thẻ SV" 
                            style={{ width: "80px", height: "50px", objectFit: "cover", borderRadius: "6px", cursor: "pointer", border: "1px solid #E5E7EB" }} 
                            onClick={() => setLightboxImage(h.imageUrl)}
                          />
                        )}
                      </td>
                      <td>
                        {h.status === "approved" ? (
                          <span style={{ background: "rgba(16, 185, 129, 0.15)", color: "var(--success)", padding: "4px 10px", borderRadius: "12px", fontSize: "0.8rem", fontWeight: "700" }}>Đã duyệt</span>
                        ) : h.status === "rejected" ? (
                          <span style={{ background: "rgba(239, 68, 68, 0.15)", color: "var(--danger)", padding: "4px 10px", borderRadius: "12px", fontSize: "0.8rem", fontWeight: "700" }}>Từ chối</span>
                        ) : (
                          <span style={{ background: "rgba(245, 158, 11, 0.15)", color: "#D97706", padding: "4px 10px", borderRadius: "12px", fontSize: "0.8rem", fontWeight: "700" }}>Chờ duyệt</span>
                        )}
                      </td>
                      <td style={{ padding: "1rem 1.5rem" }}>
                        <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
                          {h.status !== "approved" && (
                            <button 
                              onClick={() => handleUpdateHelperStatus(h.id, "approved")} 
                              className="btn" 
                              style={{ padding: "4px 8px", background: "var(--success)", color: "white", fontSize: "0.75rem", borderRadius: "6px" }}
                            >
                              Phê duyệt
                            </button>
                          )}
                          {h.status !== "rejected" && (
                            <button 
                              onClick={() => handleUpdateHelperStatus(h.id, "rejected")} 
                              className="btn" 
                              style={{ padding: "4px 8px", background: "#f59e0b", color: "white", fontSize: "0.75rem", borderRadius: "6px" }}
                            >
                              Từ chối
                            </button>
                          )}
                          <button 
                            onClick={() => handleDeleteHelper(h.id)} 
                            className="btn" 
                            style={{ padding: "4px 8px", background: "rgba(239, 68, 68, 0.1)", color: "var(--danger)", fontSize: "0.75rem", borderRadius: "6px" }}
                          >
                            Xóa hồ sơ
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* BẢNG DUYỆT NẠP VÍ */}
        {activeTab === "transactions" && (
          <>
            <div className="table-container glass-panel" style={{ padding: "0" }}>
              <table style={{ width: "100%" }}>
                <thead>
                  <tr>
                    <th style={{ padding: "1.5rem", borderTopLeftRadius: "16px" }}>Khách hàng</th>
                    <th>Số tiền</th>
                    <th>Nội dung giao dịch</th>
                    <th>Thời gian</th>
                    <th>Trạng thái</th>
                    <th style={{ padding: "1.5rem", borderTopRightRadius: "16px" }}>Hành động</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.length === 0 ? (
                    <tr><td colSpan="6" style={{textAlign:"center", padding:"2rem", color:"var(--text-secondary)"}}>Không có giao dịch nạp tiền nào.</td></tr>
                  ) : transactions.map((t) => (
                    <tr key={t.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                      <td style={{ padding: "1rem 1.5rem" }}>
                        <div style={{ fontWeight: 700, color: "var(--text-primary)", textAlign: "left" }}>{t.userEmail}</div>
                        <div style={{ fontSize: "0.85rem", color: "var(--text-secondary)", textAlign: "left" }}>UID: {t.userId.substring(0, 8).toUpperCase()}</div>
                      </td>
                      <td>
                        <strong style={{ color: t.type === "payment" ? "var(--danger)" : "var(--success)", fontSize: "0.95rem" }}>
                          {t.type === "payment" ? "-" : "+"}{Number(t.amount || 0).toLocaleString("vi-VN")} đ
                        </strong>
                      </td>
                      <td>
                        <div style={{ fontWeight: 600, textAlign: "left" }}>{t.message}</div>
                        <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)", textAlign: "left" }}>Loại: {t.type === "payment" ? "Thanh toán đơn" : "Nạp tiền"}</div>
                      </td>
                      <td style={{ fontSize: "0.85rem" }}>
                        {t.createdAt ? new Date(t.createdAt.toDate()).toLocaleString("vi-VN") : ""}
                      </td>
                      <td>
                        <span style={{ 
                          padding: "4px 8px", 
                          borderRadius: "10px", 
                          fontSize: "0.75rem", 
                          fontWeight: "700",
                          background: t.status === "pending" ? "rgba(245, 158, 11, 0.12)" : (t.status === "completed" ? "rgba(16, 185, 129, 0.12)" : "rgba(239, 68, 68, 0.12)"),
                          color: t.status === "pending" ? "#d97706" : (t.status === "completed" ? "var(--success)" : "var(--danger)")
                        }}>
                          {t.status === "pending" ? "Chờ duyệt" : (t.status === "completed" ? "Thành công" : "Đã từ chối")}
                        </span>
                      </td>
                      <td style={{ padding: "1rem 1.5rem" }}>
                        {t.status === "pending" ? (
                          <div style={{ display: "flex", gap: "6px" }}>
                            <button 
                              onClick={() => handleApproveTransaction(t)} 
                              className="btn btn-primary"
                              style={{ padding: "4px 8px", fontSize: "0.75rem", borderRadius: "6px", background: "var(--success)", color: "white", border: "none" }}
                            >
                              ✓ Duyệt nạp
                            </button>
                            <button 
                              onClick={() => handleRejectTransaction(t)} 
                              style={{ padding: "4px 8px", fontSize: "0.75rem", borderRadius: "6px", background: "var(--danger)", color: "white", border: "none", cursor: "pointer" }}
                            >
                              ✗ Từ chối
                            </button>
                          </div>
                        ) : (
                          <span style={{ fontSize: "0.8rem", color: "var(--text-secondary)", fontStyle: "italic" }}>Đã xử lý</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* BẢNG CẤU HÌNH HỆ THỐNG */}
        {activeTab === "settings" && (
          <div className="glass-panel" style={{ padding: "2.5rem", maxWidth: "600px", margin: "0 auto" }}>
            <h2 style={{ fontSize: "1.4rem", marginBottom: "1.5rem", display: "flex", alignItems: "center", gap: "10px", color: "var(--primary)" }}>
              <svg style={{ width: "24px", height: "24px" }} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path><circle cx="12" cy="12" r="3" strokeWidth="2"></circle></svg>
              Cài đặt cấu hình hệ thống
            </h2>

            <form onSubmit={handleSaveSettings}>
              <h3 style={{ fontSize: "1.05rem", fontWeight: "700", marginBottom: "1rem", color: "var(--text-primary)", borderBottom: "1px solid #e2e8f0", paddingBottom: "5px" }}>🏦 Tài khoản nhận tiền (VietQR)</h3>
              <div className="form-group">
                <label className="form-label">Tên Ngân hàng</label>
                <input 
                  type="text" 
                  value={settingsForm.bankName} 
                  onChange={(e) => setSettingsForm({ ...settingsForm, bankName: e.target.value })} 
                  required 
                  className="form-input" 
                  placeholder="Ví dụ: MBBank, Techcombank, VietinBank..." 
                />
              </div>
              <div className="form-group">
                <label className="form-label">Số tài khoản</label>
                <input 
                  type="text" 
                  value={settingsForm.bankAccount} 
                  onChange={(e) => setSettingsForm({ ...settingsForm, bankAccount: e.target.value })} 
                  required 
                  className="form-input" 
                  placeholder="Nhập số tài khoản" 
                />
              </div>
              <div className="form-group">
                <label className="form-label">Tên chủ tài khoản (Không dấu)</label>
                <input 
                  type="text" 
                  value={settingsForm.bankOwner} 
                  onChange={(e) => setSettingsForm({ ...settingsForm, bankOwner: e.target.value })} 
                  required 
                  className="form-input" 
                  placeholder="Ví dụ: NGUYEN VAN A" 
                />
              </div>

              <h3 style={{ fontSize: "1.05rem", fontWeight: "700", margin: "2rem 0 1rem 0", color: "var(--text-primary)", borderBottom: "1px solid #e2e8f0", paddingBottom: "5px" }}>📢 Thông tin & Thông báo</h3>
              <div className="form-group">
                <label className="form-label">Hotline hệ thống</label>
                <input 
                  type="text" 
                  value={settingsForm.hotline} 
                  onChange={(e) => setSettingsForm({ ...settingsForm, hotline: e.target.value })} 
                  required 
                  className="form-input" 
                  placeholder="Ví dụ: 0999.888.777" 
                />
              </div>
              <div className="form-group">
                <label className="form-label">Link liên hệ Zalo</label>
                <input 
                  type="text" 
                  value={settingsForm.zaloContact} 
                  onChange={(e) => setSettingsForm({ ...settingsForm, zaloContact: e.target.value })} 
                  className="form-input" 
                  placeholder="Ví dụ: https://zalo.me/..." 
                />
              </div>
              <div className="form-group">
                <label className="form-label">Dòng chạy chữ Thông báo hệ thống</label>
                <textarea 
                  value={settingsForm.announcement} 
                  onChange={(e) => setSettingsForm({ ...settingsForm, announcement: e.target.value })} 
                  className="form-input" 
                  rows="3" 
                  placeholder="Nội dung thông báo hiển thị trên đầu trang..."
                ></textarea>
              </div>

              <h3 style={{ fontSize: "1.05rem", fontWeight: "700", margin: "2rem 0 1rem 0", color: "var(--text-primary)", borderBottom: "1px solid #e2e8f0", paddingBottom: "5px" }}>🤖 Cấu hình Telegram Alerts</h3>
              <p style={{ fontSize: "0.8rem", color: "var(--text-secondary)", marginBottom: "1rem", lineHeight: "1.4" }}>
                ⚠️ <b>LƯU Ý BẢO MẬT:</b> Để tránh hacker chiếm đoạt Bot Telegram, các trường Token và Chat ID dưới đây sẽ được gửi qua API route bảo mật của máy chủ. Khuyến khích cấu hình trực tiếp qua biến môi trường <code>TELEGRAM_BOT_TOKEN</code> và <code>TELEGRAM_CHAT_ID</code> trên Vercel để đảm bảo an toàn tuyệt đối.
              </p>
              <div className="form-group">
                <label className="form-label">Telegram Bot Token</label>
                <input 
                  type="text" 
                  value={settingsForm.telegramBotToken} 
                  onChange={(e) => setSettingsForm({ ...settingsForm, telegramBotToken: e.target.value })} 
                  className="form-input" 
                  placeholder="Ví dụ: 123456789:ABCdefGhI..." 
                />
              </div>
              <div className="form-group">
                <label className="form-label">Telegram Chat ID (Nhóm hoặc Cá nhân)</label>
                <input 
                  type="text" 
                  value={settingsForm.telegramChatId} 
                  onChange={(e) => setSettingsForm({ ...settingsForm, telegramChatId: e.target.value })} 
                  className="form-input" 
                  placeholder="Ví dụ: -100123456789 hoặc 987654321" 
                />
              </div>

              <button 
                type="submit" 
                className="btn btn-primary" 
                style={{ width: "100%", padding: "1rem", marginTop: "1rem" }}
                disabled={savingSettings}
              >
                {savingSettings ? "Đang lưu..." : "Lưu cấu hình"}
              </button>
            </form>
          </div>
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
