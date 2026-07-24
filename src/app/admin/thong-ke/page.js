"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { db } from "@/lib/firebase";
import { collection, query, onSnapshot, doc, updateDoc } from "firebase/firestore";
import Link from "next/link";
import toast from "react-hot-toast";

export default function ThongKePage() {
  const { user, loading, isAdmin } = useAuth();
  const router = useRouter();

  const [schedules, setSchedules] = useState([]);
  const [internalSchedules, setInternalSchedules] = useState([]);
  const [users, setUsers] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [loadingData, setLoadingData] = useState(true);
  const [reportType, setReportType] = useState("customer"); // "customer" or "internal"

  // Trạng thái cho Bảng thống kê công nợ & nợ lương
  const [debtTab, setDebtTab] = useState("customer"); // "customer" or "helper"
  const [debtSearch, setDebtSearch] = useState("");
  const [debtFilter, setDebtFilter] = useState("all"); // "all", "rent", "tip"

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

    const unsubscribeInternalSchedules = onSnapshot(collection(db, "internal_schedules"), (snapshot) => {
      const isData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setInternalSchedules(isData);
    });

    setLoadingData(false);

    return () => {
      unsubscribeSchedules();
      unsubscribeUsers();
      unsubscribeTrans();
      unsubscribeInternalSchedules();
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
  const isCustomer = reportType === "customer";

  const completedSchedules = isCustomer
    ? schedules.filter(s => s.status === "completed")
    : internalSchedules.filter(s => s.studyStatus === "da_hoc" || s.studyStatus === "online");
  
  // Doanh thu gộp (Tổng tiền khách đặt hoặc tiền thuê học + tip)
  const totalRevenue = isCustomer
    ? completedSchedules.reduce((acc, curr) => {
        const priceNum = curr.price ? Number(String(curr.price).replace(/\./g, "")) : 0;
        return acc + priceNum;
      }, 0)
    : completedSchedules.reduce((acc, curr) => {
        return acc + Number(curr.rentAmount || 0) + Number(curr.tipAmount || 0);
      }, 0);

  // Chi phí thù lao CTV thực tế
  const totalPayout = isCustomer
    ? completedSchedules.reduce((acc, curr) => {
        if (curr.payoutAmount !== undefined) return acc + Number(curr.payoutAmount);
        const priceNum = curr.price ? Number(String(curr.price).replace(/\./g, "")) : 0;
        return acc + Math.floor(priceNum * 0.75);
      }, 0)
    : completedSchedules.reduce((acc, curr) => {
        return acc + Number(curr.salaryAmount || 0) + Number(curr.staffTipAmount || 0);
      }, 0);

  // Lợi nhuận thực tế của Admin (Doanh thu - Chi phí CTV)
  const netProfit = totalRevenue - totalPayout;

  // Tổng số dư ví thù lao tích lũy hiện có của toàn bộ CTV
  const totalHelperBalances = users
    .filter(u => u.role === "helper")
    .reduce((acc, curr) => acc + (curr.helperBalance || 0), 0);

  // 2. PHÂN TÍCH ĐƠN HÀNG
  const totalOrdersCount = isCustomer ? schedules.length : internalSchedules.length;
  
  const statusCounts = isCustomer ? {
    pending: schedules.filter(s => s.status === "pending").length,
    accepted: schedules.filter(s => s.status === "accepted").length,
    in_progress: schedules.filter(s => s.status === "in_progress").length,
    proof_submitted: schedules.filter(s => s.status === "proof_submitted").length,
    completed: completedSchedules.length,
    rejected: schedules.filter(s => s.status === "rejected").length,
  } : {
    pending: internalSchedules.filter(s => s.studyStatus === "chua_hoc" || s.studyStatus === "dang_chot").length,
    accepted: internalSchedules.filter(s => s.studyStatus === "sp_thi").length,
    in_progress: internalSchedules.filter(s => s.studyStatus === "online" || s.studyStatus === "da_hoc").length,
    proof_submitted: internalSchedules.filter(s => s.checkinStatus === "checked_in").length,
    completed: completedSchedules.length,
    rejected: internalSchedules.filter(s => s.studyStatus === "huy" || s.studyStatus === "zero_hoc" || s.studyStatus === "truc_trac").length,
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
          if (isCustomer) {
            if (!s.createdAt) return false;
            const sTime = s.createdAt.toMillis ? s.createdAt.toMillis() : new Date(s.createdAt).getTime();
            return sTime >= dStart && sTime <= dEnd;
          } else {
            if (!s.classDate) return false;
            const sTime = new Date(s.classDate).getTime();
            return sTime >= dStart && sTime <= dEnd;
          }
        })
        .reduce((acc, curr) => {
          if (isCustomer) {
            const priceNum = curr.price ? Number(String(curr.price).replace(/\./g, "")) : 0;
            return acc + priceNum;
          } else {
            return acc + Number(curr.rentAmount || 0) + Number(curr.tipAmount || 0);
          }
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
      const completedCount = isCustomer
        ? completedSchedules.filter(s => s.assignedTo === helper.name).length
        : completedSchedules.filter(s => s.helperName === helper.name || s.helperName === helper.alias).length;

      // Tổng thù lao đã kiếm
      const totalEarned = isCustomer
        ? completedSchedules
            .filter(s => s.assignedTo === helper.name)
            .reduce((acc, curr) => {
              if (curr.payoutAmount !== undefined) return acc + Number(curr.payoutAmount);
              const priceNum = curr.price ? Number(String(curr.price).replace(/\./g, "")) : 0;
              return acc + Math.floor(priceNum * 0.75);
            }, 0)
        : completedSchedules
            .filter(s => s.helperName === helper.name || s.helperName === helper.alias)
            .reduce((acc, curr) => {
              return acc + Number(curr.salaryAmount || 0) + Number(curr.staffTipAmount || 0);
            }, 0);

      return {
        name: helper.name,
        alias: helper.alias,
        email: helper.email,
        completedCount,
        totalEarned
      };
    })
  // -------------------------------------------------------------
  // THỐNG KÊ CÔNG NỢ KHÁCH HÀNG & NỢ LƯƠNG CTV (UNPAID DEBTS)
  // -------------------------------------------------------------

  // 1. Danh sách Khách hàng chưa thanh toán (Tiền thuê / Tip)
  const customerUnpaidList = [];

  // Từ Lịch nội bộ (internalSchedules)
  internalSchedules.forEach(item => {
    const rentVal = Number(item.rentAmount || 0);
    const tipVal = Number(item.tipAmount || 0);
    const isRentUnpaid = item.paymentStatus !== "Đã thanh toán" && rentVal > 0;
    const isTipUnpaid = item.tipStatus !== "Đã gửi" && tipVal > 0;

    if (isRentUnpaid || isTipUnpaid) {
      customerUnpaidList.push({
        id: item.id,
        className: item.className || item.subject || "N/A",
        studentName: item.studentName || item.name || "Khách nội bộ",
        school: item.school || "N/A",
        classDate: item.classDate,
        timeSlot: item.timeSlot || `${item.startTime || ''} - ${item.endTime || ''}`,
        rentVal: isRentUnpaid ? rentVal : 0,
        paymentStatus: item.paymentStatus || "ChưaTT",
        tipVal: isTipUnpaid ? tipVal : 0,
        tipStatus: item.tipStatus || "Chưa gửi",
        totalDebt: (isRentUnpaid ? rentVal : 0) + (isTipUnpaid ? tipVal : 0),
        isRentUnpaid,
        isTipUnpaid,
        collectionName: "internal_schedules"
      });
    }
  });

  // Từ Đơn khách đặt (schedules)
  schedules.forEach(item => {
    const priceNum = item.price ? Number(String(item.price).replace(/\./g, "")) : 0;
    const rentVal = item.rentAmount !== undefined ? Number(item.rentAmount) : priceNum;
    const tipVal = Number(item.tipAmount || 0);

    const isRentUnpaid = item.status !== "completed" && item.paymentStatus !== "Đã thanh toán" && rentVal > 0;
    const isTipUnpaid = item.tipStatus !== "Đã gửi" && tipVal > 0;

    if (isRentUnpaid || isTipUnpaid) {
      customerUnpaidList.push({
        id: item.id,
        className: item.className || item.subject || "N/A",
        studentName: item.name || item.studentName || item.userEmail || "Khách hàng",
        school: item.school || "N/A",
        classDate: item.classDate,
        timeSlot: `${item.startTime || ''} - ${item.endTime || ''}`,
        rentVal: isRentUnpaid ? rentVal : 0,
        paymentStatus: item.paymentStatus || "Chưa thanh toán",
        tipVal: isTipUnpaid ? tipVal : 0,
        tipStatus: item.tipStatus || "Chưa gửi",
        totalDebt: (isRentUnpaid ? rentVal : 0) + (isTipUnpaid ? tipVal : 0),
        isRentUnpaid,
        isTipUnpaid,
        collectionName: "schedules"
      });
    }
  });

  // 2. Danh sách CTV chưa nhận thù lao / tip (Lương / Staff Tip)
  const helperUnpaidList = [];

  // Từ Lịch nội bộ (internalSchedules)
  internalSchedules.forEach(item => {
    const salVal = Number(item.salaryAmount || 0);
    const staffTipVal = Number(item.staffTipAmount || 0);

    const isSalUnpaid = item.salaryStatus !== "Đã trả lương" && salVal > 0;
    const isStaffTipUnpaid = item.staffTipStatus !== "Đã gửi" && staffTipVal > 0;

    if (isSalUnpaid || isStaffTipUnpaid) {
      helperUnpaidList.push({
        id: item.id,
        className: item.className || item.subject || "N/A",
        helperName: item.helperName || item.assignedTo || "Chưa gán CTV",
        school: item.school || "N/A",
        classDate: item.classDate,
        timeSlot: item.timeSlot || `${item.startTime || ''} - ${item.endTime || ''}`,
        salaryVal: isSalUnpaid ? salVal : 0,
        salaryStatus: item.salaryStatus || "ChưaTL",
        staffTipVal: isStaffTipUnpaid ? staffTipVal : 0,
        staffTipStatus: item.staffTipStatus || "Chưa gửi",
        totalDebt: (isSalUnpaid ? salVal : 0) + (isStaffTipUnpaid ? staffTipVal : 0),
        isSalUnpaid,
        isStaffTipUnpaid,
        collectionName: "internal_schedules"
      });
    }
  });

  // Từ Đơn khách đặt (schedules)
  schedules.forEach(item => {
    const salVal = item.salaryAmount !== undefined ? Number(item.salaryAmount) : (item.payoutAmount !== undefined ? Number(item.payoutAmount) : 0);
    const staffTipVal = Number(item.staffTipAmount || 0);

    const isSalUnpaid = !item.payoutPaid && item.salaryStatus !== "Đã trả lương" && (salVal > 0 || item.helperId);
    const isStaffTipUnpaid = item.staffTipStatus !== "Đã gửi" && staffTipVal > 0;

    if ((isSalUnpaid && item.assignedTo) || isStaffTipUnpaid) {
      helperUnpaidList.push({
        id: item.id,
        className: item.className || item.subject || "N/A",
        helperName: item.assignedTo || item.helperName || "CTV",
        school: item.school || "N/A",
        classDate: item.classDate,
        timeSlot: `${item.startTime || ''} - ${item.endTime || ''}`,
        salaryVal: isSalUnpaid ? salVal : 0,
        salaryStatus: item.salaryStatus || "Chưa trả lương",
        staffTipVal: isStaffTipUnpaid ? staffTipVal : 0,
        staffTipStatus: item.staffTipStatus || "Chưa gửi",
        totalDebt: (isSalUnpaid ? salVal : 0) + (isStaffTipUnpaid ? staffTipVal : 0),
        isSalUnpaid,
        isStaffTipUnpaid,
        collectionName: "schedules"
      });
    }
  });

  // Tổng hợp chỉ số
  const totalCustomerUnpaidSum = customerUnpaidList.reduce((sum, i) => sum + i.totalDebt, 0);
  const totalHelperUnpaidSum = helperUnpaidList.reduce((sum, i) => sum + i.totalDebt, 0);
  const netUnpaidReceivable = totalCustomerUnpaidSum - totalHelperUnpaidSum;

  // Lọc danh sách theo tìm kiếm và loại nợ
  const filteredCustomerUnpaid = customerUnpaidList.filter(item => {
    const matchesSearch = !debtSearch || 
      item.studentName.toLowerCase().includes(debtSearch.toLowerCase()) ||
      item.className.toLowerCase().includes(debtSearch.toLowerCase()) ||
      item.school.toLowerCase().includes(debtSearch.toLowerCase());
    
    if (debtFilter === "rent") return matchesSearch && item.isRentUnpaid;
    if (debtFilter === "tip") return matchesSearch && item.isTipUnpaid;
    return matchesSearch;
  });

  const filteredHelperUnpaid = helperUnpaidList.filter(item => {
    const matchesSearch = !debtSearch || 
      item.helperName.toLowerCase().includes(debtSearch.toLowerCase()) ||
      item.className.toLowerCase().includes(debtSearch.toLowerCase()) ||
      item.school.toLowerCase().includes(debtSearch.toLowerCase());
    
    if (debtFilter === "rent") return matchesSearch && item.isSalUnpaid;
    if (debtFilter === "tip") return matchesSearch && item.isStaffTipUnpaid;
    return matchesSearch;
  });

  // Xử lý cập nhật nhanh trạng thái khách thanh toán
  const handleMarkCustomerPaid = async (item, type) => {
    const updateFields = {};
    if (type === "rent" || type === "all") updateFields.paymentStatus = "Đã thanh toán";
    if (type === "tip" || type === "all") updateFields.tipStatus = "Đã gửi";

    try {
      await updateDoc(doc(db, item.collectionName, item.id), updateFields);
      toast.success(`Đã cập nhật trạng thái thanh toán cho môn ${item.className}!`);
    } catch (err) {
      console.error("Lỗi cập nhật:", err);
      toast.error("Không thể cập nhật trạng thái thanh toán");
    }
  };

  // Xử lý cập nhật nhanh trạng thái trả lương CTV
  const handleMarkHelperPaid = async (item, type) => {
    const updateFields = {};
    if (type === "salary" || type === "all") {
      updateFields.salaryStatus = "Đã trả lương";
      updateFields.payoutPaid = true;
    }
    if (type === "tip" || type === "all") updateFields.staffTipStatus = "Đã gửi";

    try {
      await updateDoc(doc(db, item.collectionName, item.id), updateFields);
      toast.success(`Đã cập nhật phát thù lao cho CTV ${item.helperName}!`);
    } catch (err) {
      console.error("Lỗi cập nhật:", err);
      toast.error("Không thể cập nhật thù lao CTV");
    }
  };

  // Xuất file CSV
  const exportDebtCSV = () => {
    const isCustTab = debtTab === "customer";
    const dataList = isCustTab ? filteredCustomerUnpaid : filteredHelperUnpaid;
    
    if (dataList.length === 0) {
      toast.error("Không có dữ liệu công nợ để xuất file CSV!");
      return;
    }

    let csvContent = "\uFEFF"; // UTF-8 BOM cho Excel
    if (isCustTab) {
      csvContent += "Mã ca,Tên Môn Học,Học Viên / Khách Hàng,Trường,Ngày Học,Tiền Thuê (VNĐ),Trạng Thái Thuê,Tiền Tip (VNĐ),Trạng Thái Tip,Tổng Tiền Nợ (VNĐ)\n";
      dataList.forEach(item => {
        csvContent += `"${item.id}","${item.className}","${item.studentName}","${item.school}","${item.classDate ? new Date(item.classDate).toLocaleDateString('vi-VN') : ''}",${item.rentVal},"${item.paymentStatus}",${item.tipVal},"${item.tipStatus}",${item.totalDebt}\n`;
      });
    } else {
      csvContent += "Mã ca,Tên Môn Học,CTV Phụ Trách,Trường,Ngày Học,Thù Lao (VNĐ),Trạng Thái Lương,Tip CTV (VNĐ),Trạng Thái Tip CTV,Tổng Lương Chưa Trả (VNĐ)\n";
      dataList.forEach(item => {
        csvContent += `"${item.id}","${item.className}","${item.helperName}","${item.school}","${item.classDate ? new Date(item.classDate).toLocaleDateString('vi-VN') : ''}",${item.salaryVal},"${item.salaryStatus}",${item.staffTipVal},"${item.staffTipStatus}",${item.totalDebt}\n`;
      });
    }

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `baocao_congno_${isCustTab ? 'khachhang' : 'ctv'}_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Đã tải xuống tệp báo cáo công nợ CSV thành công!");
  };

  return (
    <div style={{ padding: "2rem 1.5rem", maxWidth: "1200px", margin: "0 auto" }}>
      
      {/* Header điều hướng */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "2.5rem", flexWrap: "wrap", gap: "15px" }}>
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

      {/* Tab chuyển đổi loại báo cáo */}
      <div style={{ display: "flex", gap: "10px", marginBottom: "2rem", flexWrap: "wrap" }}>
        <button
          onClick={() => setReportType("customer")}
          style={{
            padding: "0.6rem 1.5rem", borderRadius: "10px",
            background: reportType === "customer" ? "var(--primary)" : "white",
            color: reportType === "customer" ? "white" : "var(--text-secondary)",
            fontWeight: "700", cursor: "pointer", fontSize: "0.85rem",
            boxShadow: reportType === "customer" ? "0 4px 12px rgba(22, 163, 74, 0.2)" : "0 2px 4px rgba(0,0,0,0.03)",
            border: reportType === "customer" ? "none" : "1px solid #cbd5e1",
            transition: "all 0.2s"
          }}
        >
          👥 Thống kê Đơn Khách Đặt
        </button>
        <button
          onClick={() => setReportType("internal")}
          style={{
            padding: "0.6rem 1.5rem", borderRadius: "10px",
            background: reportType === "internal" ? "var(--primary)" : "white",
            color: reportType === "internal" ? "white" : "var(--text-secondary)",
            fontWeight: "700", cursor: "pointer", fontSize: "0.85rem",
            boxShadow: reportType === "internal" ? "0 4px 12px rgba(22, 163, 74, 0.2)" : "0 2px 4px rgba(0,0,0,0.03)",
            border: reportType === "internal" ? "none" : "1px solid #cbd5e1",
            transition: "all 0.2s"
          }}
        >
          🏢 Thống kê Lịch Nội Bộ
        </button>
      </div>

      {/* Grid thẻ thông số tài chính */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "1.5rem", marginBottom: "2rem" }}>
        
        {/* Doanh thu */}
        <div className="glass-panel" style={{ padding: "1.5rem", background: "linear-gradient(135deg, rgba(22,163,74,0.03) 0%, rgba(255,255,255,1) 100%)", borderLeft: "5px solid var(--primary)" }}>
          <span style={{ fontSize: "0.85rem", color: "var(--text-secondary)", fontWeight: "600" }}>TỔNG DOANH THU GỘP</span>
          <h2 style={{ fontSize: "1.8rem", color: "var(--primary)", fontWeight: "850", margin: "8px 0 0 0" }}>{totalRevenue.toLocaleString("vi-VN")} đ</h2>
          <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)", display: "block", marginTop: "8px" }}>Từ {completedSchedules.length} ca đã hoàn thành</span>
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
            📋 {isCustomer ? `Phân tích trạng thái đơn thuê học (${totalOrdersCount} đơn)` : `Phân tích trạng thái lịch nội bộ (${totalOrdersCount} ca)`}
          </h3>
          
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            
            {/* Hoàn thành */}
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem", fontWeight: "600", marginBottom: "4px" }}>
                <span>{isCustomer ? "Hoàn thành đơn học" : "Ca học hoàn thành (Đã học / Online)"}</span>
                <span style={{ color: "var(--success)" }}>{statusCounts.completed} ({totalOrdersCount > 0 ? ((statusCounts.completed / totalOrdersCount) * 100).toFixed(0) : 0}%)</span>
              </div>
              <div style={{ width: "100%", height: "8px", background: "#f1f5f9", borderRadius: "4px", overflow: "hidden" }}>
                <div style={{ width: `${totalOrdersCount > 0 ? (statusCounts.completed / totalOrdersCount) * 100 : 0}%`, height: "100%", background: "var(--success)" }}></div>
              </div>
            </div>

            {/* Đang học / Đã nhận */}
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem", fontWeight: "600", marginBottom: "4px" }}>
                <span>{isCustomer ? "Đang xử lý / Sắp học" : "Ca học đặc biệt (SP Thi)"}</span>
                <span style={{ color: "#4F46E5" }}>{isCustomer ? (statusCounts.accepted + statusCounts.in_progress) : statusCounts.accepted} ({totalOrdersCount > 0 ? (((isCustomer ? (statusCounts.accepted + statusCounts.in_progress) : statusCounts.accepted) / totalOrdersCount) * 100).toFixed(0) : 0}%)</span>
              </div>
              <div style={{ width: "100%", height: "8px", background: "#f1f5f9", borderRadius: "4px", overflow: "hidden" }}>
                <div style={{ width: `${totalOrdersCount > 0 ? ((isCustomer ? (statusCounts.accepted + statusCounts.in_progress) : statusCounts.accepted) / totalOrdersCount) * 100 : 0}%`, height: "100%", background: "#4F46E5" }}></div>
              </div>
            </div>

            {/* Chờ duyệt minh chứng */}
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem", fontWeight: "600", marginBottom: "4px" }}>
                <span>{isCustomer ? "Chờ duyệt báo cáo (Proof submitted)" : "Ca đã check-in thực tế"}</span>
                <span style={{ color: "#D97706" }}>{statusCounts.proof_submitted} ({totalOrdersCount > 0 ? ((statusCounts.proof_submitted / totalOrdersCount) * 100).toFixed(0) : 0}%)</span>
              </div>
              <div style={{ width: "100%", height: "8px", background: "#f1f5f9", borderRadius: "4px", overflow: "hidden" }}>
                <div style={{ width: `${totalOrdersCount > 0 ? (statusCounts.proof_submitted / totalOrdersCount) * 100 : 0}%`, height: "100%", background: "#D97706" }}></div>
              </div>
            </div>

            {/* Chờ học viên thanh toán */}
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem", fontWeight: "600", marginBottom: "4px" }}>
                <span>{isCustomer ? "Chờ thanh toán (Mới nộp)" : "Ca đang chốt / Chưa học"}</span>
                <span style={{ color: "#64748B" }}>{statusCounts.pending} ({totalOrdersCount > 0 ? ((statusCounts.pending / totalOrdersCount) * 100).toFixed(0) : 0}%)</span>
              </div>
              <div style={{ width: "100%", height: "8px", background: "#f1f5f9", borderRadius: "4px", overflow: "hidden" }}>
                <div style={{ width: `${totalOrdersCount > 0 ? (statusCounts.pending / totalOrdersCount) * 100 : 0}%`, height: "100%", background: "#64748B" }}></div>
              </div>
            </div>

          </div>
        </div>

      </div>

      {/* ============================================================ */}
      {/* 💸 BẢNG THỐNG KÊ CÔNG NỢ KHÁCH HÀNG & NỢ LƯƠNG CTV           */}
      {/* ============================================================ */}
      <div className="glass-panel" style={{ padding: "2rem", marginBottom: "2.5rem", borderRadius: "16px", border: "1px solid #cbd5e1" }}>
        
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem", flexWrap: "wrap", gap: "15px" }}>
          <div>
            <h3 style={{ margin: 0, fontSize: "1.3rem", fontWeight: "800", color: "var(--text-primary)", display: "flex", alignItems: "center", gap: "8px" }}>
              <span>💸</span> Bảng Thống Kê Công Nợ & Nợ Lương Tài Chính
            </h3>
            <p style={{ margin: "4px 0 0 0", fontSize: "0.85rem", color: "var(--text-secondary)" }}>
              Theo dõi toàn bộ tiền chưa thanh toán của Khách hàng và thù lao chưa chi trả cho CTV
            </p>
          </div>

          <button
            type="button"
            onClick={exportDebtCSV}
            className="btn"
            style={{ background: "#166534", color: "white", padding: "0.55rem 1.1rem", borderRadius: "10px", fontWeight: "700", fontSize: "0.85rem", display: "flex", alignItems: "center", gap: "6px", cursor: "pointer", border: "none" }}
          >
            📥 Xuất Báo Cáo Công Nợ (CSV)
          </button>
        </div>

        {/* 3 THẺ KPI CÔNG NỢ TỔNG QUAN */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: "1.2rem", marginBottom: "1.8rem" }}>
          
          {/* Nợ khách hàng */}
          <div style={{ background: "linear-gradient(135deg, #fef2f2 0%, #ffe4e6 100%)", border: "1px solid #fca5a5", borderRadius: "14px", padding: "1.2rem" }}>
            <span style={{ fontSize: "0.8rem", color: "#991b1b", fontWeight: "700", textTransform: "uppercase" }}>🔴 Khách hàng chưa thanh toán</span>
            <h3 style={{ fontSize: "1.6rem", color: "#b91c1c", fontWeight: "850", margin: "6px 0 4px 0" }}>
              {totalCustomerUnpaidSum.toLocaleString("vi-VN")} đ
            </h3>
            <span style={{ fontSize: "0.78rem", color: "#7f1d1d", fontWeight: "600" }}>
              Gồm {customerUnpaidList.length} khoản đọng (Thuê & Tip)
            </span>
          </div>

          {/* Nợ CTV */}
          <div style={{ background: "linear-gradient(135deg, #f5f3ff 0%, #ede9fe 100%)", border: "1px solid #ddd6fe", borderRadius: "14px", padding: "1.2rem" }}>
            <span style={{ fontSize: "0.8rem", color: "#5b21b6", fontWeight: "700", textTransform: "uppercase" }}>🟣 Thù lao CTV chưa chi trả</span>
            <h3 style={{ fontSize: "1.6rem", color: "#6d28d9", fontWeight: "850", margin: "6px 0 4px 0" }}>
              {totalHelperUnpaidSum.toLocaleString("vi-VN")} đ
            </h3>
            <span style={{ fontSize: "0.78rem", color: "#4c1d95", fontWeight: "600" }}>
              Gồm {helperUnpaidList.length} khoản thù lao & tip chưa phát
            </span>
          </div>

          {/* Dư nợ thu thực tế */}
          <div style={{ background: "linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)", border: "1px solid #bbf7d0", borderRadius: "14px", padding: "1.2rem" }}>
            <span style={{ fontSize: "0.8rem", color: "#166534", fontWeight: "700", textTransform: "uppercase" }}>🟩 Cân đối thực thu dự kiến</span>
            <h3 style={{ fontSize: "1.6rem", color: "#15803d", fontWeight: "850", margin: "6px 0 4px 0" }}>
              {netUnpaidReceivable.toLocaleString("vi-VN")} đ
            </h3>
            <span style={{ fontSize: "0.78rem", color: "#14532d", fontWeight: "600" }}>
              (Tổng nợ khách - Tổng nợ CTV)
            </span>
          </div>

        </div>

        {/* BỘ LỌC VÀ TÌM KIẾM CÔNG NỢ */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.2rem", flexWrap: "wrap", gap: "12px", background: "#f8fafc", padding: "1rem", borderRadius: "12px", border: "1px solid #e2e8f0" }}>
          
          {/* TAB CHỌN KHÁCH / CTV */}
          <div style={{ display: "flex", gap: "8px" }}>
            <button
              type="button"
              onClick={() => setDebtTab("customer")}
              style={{
                padding: "0.5rem 1.2rem", borderRadius: "8px", fontWeight: "750", fontSize: "0.85rem", cursor: "pointer",
                background: debtTab === "customer" ? "#b91c1c" : "white",
                color: debtTab === "customer" ? "white" : "#64748b",
                border: debtTab === "customer" ? "none" : "1px solid #cbd5e1"
              }}
            >
              🔴 Khách nợ thanh toán ({customerUnpaidList.length})
            </button>
            <button
              type="button"
              onClick={() => setDebtTab("helper")}
              style={{
                padding: "0.5rem 1.2rem", borderRadius: "8px", fontWeight: "750", fontSize: "0.85rem", cursor: "pointer",
                background: debtTab === "helper" ? "#6d28d9" : "white",
                color: debtTab === "helper" ? "white" : "#64748b",
                border: debtTab === "helper" ? "none" : "1px solid #cbd5e1"
              }}
            >
              🟣 CTV chưa trả lương ({helperUnpaidList.length})
            </button>
          </div>

          {/* TÌM KIẾM & BỘ LỌC LOẠI TIỀN */}
          <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
            <input
              type="text"
              value={debtSearch}
              onChange={e => setDebtSearch(e.target.value)}
              placeholder="🔍 Tìm theo Tên, Môn học, Trường..."
              style={{ padding: "0.45rem 0.9rem", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "0.85rem", width: "220px" }}
            />

            <select
              value={debtFilter}
              onChange={e => setDebtFilter(e.target.value)}
              style={{ padding: "0.45rem 0.9rem", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "0.85rem", background: "white", fontWeight: "600" }}
            >
              <option value="all">Tất cả khoản nợ</option>
              <option value="rent">{debtTab === "customer" ? "Chỉ tiền thuê học" : "Chỉ lương CTV"}</option>
              <option value="tip">{debtTab === "customer" ? "Chỉ tiền tip khách" : "Chỉ tip CTV"}</option>
            </select>
          </div>

        </div>

        {/* BẢNG DỮ LIỆU HIỂN THỊ */}
        <div style={{ overflowX: "auto" }}>
          {debtTab === "customer" ? (
            /* TAB 1: BẢNG KHÁCH HÀNG NỢ */
            <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
              <thead>
                <tr style={{ borderBottom: "2px solid #e2e8f0", color: "var(--text-secondary)", fontSize: "0.82rem", background: "#f1f5f9" }}>
                  <th style={{ padding: "0.8rem 1rem" }}>Khách Hàng / Môn Học</th>
                  <th style={{ padding: "0.8rem 1rem" }}>Trường & Ngày Học</th>
                  <th style={{ padding: "0.8rem 1rem" }}>Tiền Thuê (rentAmount)</th>
                  <th style={{ padding: "0.8rem 1rem" }}>Tiền Tip (tipAmount)</th>
                  <th style={{ padding: "0.8rem 1rem" }}>Tổng Tiền Đọng</th>
                  <th style={{ padding: "0.8rem 1rem", textAlign: "right" }}>Thao Tác Duyệt Nhanh</th>
                </tr>
              </thead>
              <tbody>
                {filteredCustomerUnpaid.length === 0 ? (
                  <tr>
                    <td colSpan="6" style={{ textAlign: "center", padding: "2.5rem", color: "var(--text-secondary)", fontWeight: "600" }}>
                      🎉 Không có khoản công nợ khách hàng nào chưa thanh toán!
                    </td>
                  </tr>
                ) : (
                  filteredCustomerUnpaid.map(item => (
                    <tr key={item.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                      <td style={{ padding: "0.9rem 1rem" }}>
                        <div style={{ fontWeight: "750", color: "var(--text-primary)" }}>{item.studentName}</div>
                        <div style={{ fontSize: "0.8rem", color: "var(--primary)", fontWeight: "600" }}>📚 {item.className}</div>
                      </td>
                      <td style={{ padding: "0.9rem 1rem", fontSize: "0.82rem" }}>
                        <div>🏫 {item.school}</div>
                        <div style={{ color: "var(--text-secondary)" }}>📅 {item.classDate ? new Date(item.classDate).toLocaleDateString("vi-VN") : "N/A"} ({item.timeSlot})</div>
                      </td>
                      <td style={{ padding: "0.9rem 1rem" }}>
                        <div style={{ fontWeight: "750", color: item.rentVal > 0 ? "#b91c1c" : "var(--text-secondary)" }}>
                          {item.rentVal.toLocaleString("vi-VN")} đ
                        </div>
                        <span style={{ fontSize: "0.72rem", padding: "2px 6px", borderRadius: "6px", background: item.paymentStatus === "Đã thanh toán" ? "rgba(22,163,74,0.1)" : "rgba(239,68,68,0.1)", color: item.paymentStatus === "Đã thanh toán" ? "var(--success)" : "var(--danger)", fontWeight: "700" }}>
                          {item.paymentStatus || "ChưaTT"}
                        </span>
                      </td>
                      <td style={{ padding: "0.9rem 1rem" }}>
                        <div style={{ fontWeight: "750", color: item.tipVal > 0 ? "#b91c1c" : "var(--text-secondary)" }}>
                          {item.tipVal.toLocaleString("vi-VN")} đ
                        </div>
                        <span style={{ fontSize: "0.72rem", padding: "2px 6px", borderRadius: "6px", background: item.tipStatus === "Đã gửi" ? "rgba(22,163,74,0.1)" : "rgba(239,68,68,0.1)", color: item.tipStatus === "Đã gửi" ? "var(--success)" : "var(--danger)", fontWeight: "700" }}>
                          {item.tipStatus || "Chưa gửi"}
                        </span>
                      </td>
                      <td style={{ padding: "0.9rem 1rem", fontWeight: "850", color: "#b91c1c", fontSize: "0.95rem" }}>
                        {item.totalDebt.toLocaleString("vi-VN")} đ
                      </td>
                      <td style={{ padding: "0.9rem 1rem", textAlign: "right" }}>
                        <button
                          type="button"
                          onClick={() => handleMarkCustomerPaid(item, "all")}
                          className="btn"
                          style={{ background: "#16a34a", color: "white", padding: "4px 10px", borderRadius: "6px", fontSize: "0.78rem", fontWeight: "750", border: "none", cursor: "pointer" }}
                        >
                          ✓ Đã Thu Đủ
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          ) : (
            /* TAB 2: BẢNG CTV NỢ LƯƠNG */
            <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
              <thead>
                <tr style={{ borderBottom: "2px solid #e2e8f0", color: "var(--text-secondary)", fontSize: "0.82rem", background: "#f1f5f9" }}>
                  <th style={{ padding: "0.8rem 1rem" }}>CTV Phụ Trách / Môn Học</th>
                  <th style={{ padding: "0.8rem 1rem" }}>Trường & Ngày Học</th>
                  <th style={{ padding: "0.8rem 1rem" }}>Lương CTV (salaryAmount)</th>
                  <th style={{ padding: "0.8rem 1rem" }}>Tip CTV (staffTipAmount)</th>
                  <th style={{ padding: "0.8rem 1rem" }}>Tổng Thù Lao Nợ</th>
                  <th style={{ padding: "0.8rem 1rem", textAlign: "right" }}>Thao Tác Chi Trả Nhanh</th>
                </tr>
              </thead>
              <tbody>
                {filteredHelperUnpaid.length === 0 ? (
                  <tr>
                    <td colSpan="6" style={{ textAlign: "center", padding: "2.5rem", color: "var(--text-secondary)", fontWeight: "600" }}>
                      🎉 Không có khoản thù lao hoặc tip CTV nào chưa chi trả!
                    </td>
                  </tr>
                ) : (
                  filteredHelperUnpaid.map(item => (
                    <tr key={item.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                      <td style={{ padding: "0.9rem 1rem" }}>
                        <div style={{ fontWeight: "750", color: "var(--text-primary)" }}>{item.helperName}</div>
                        <div style={{ fontSize: "0.8rem", color: "#4F46E5", fontWeight: "600" }}>📚 {item.className}</div>
                      </td>
                      <td style={{ padding: "0.9rem 1rem", fontSize: "0.82rem" }}>
                        <div>🏫 {item.school}</div>
                        <div style={{ color: "var(--text-secondary)" }}>📅 {item.classDate ? new Date(item.classDate).toLocaleDateString("vi-VN") : "N/A"} ({item.timeSlot})</div>
                      </td>
                      <td style={{ padding: "0.9rem 1rem" }}>
                        <div style={{ fontWeight: "750", color: item.salaryVal > 0 ? "#6d28d9" : "var(--text-secondary)" }}>
                          {item.salaryVal.toLocaleString("vi-VN")} đ
                        </div>
                        <span style={{ fontSize: "0.72rem", padding: "2px 6px", borderRadius: "6px", background: item.salaryStatus === "Đã trả lương" ? "rgba(22,163,74,0.1)" : "rgba(109,40,217,0.1)", color: item.salaryStatus === "Đã trả lương" ? "var(--success)" : "#6d28d9", fontWeight: "700" }}>
                          {item.salaryStatus || "ChưaTL"}
                        </span>
                      </td>
                      <td style={{ padding: "0.9rem 1rem" }}>
                        <div style={{ fontWeight: "750", color: item.staffTipVal > 0 ? "#6d28d9" : "var(--text-secondary)" }}>
                          {item.staffTipVal.toLocaleString("vi-VN")} đ
                        </div>
                        <span style={{ fontSize: "0.72rem", padding: "2px 6px", borderRadius: "6px", background: item.staffTipStatus === "Đã gửi" ? "rgba(22,163,74,0.1)" : "rgba(109,40,217,0.1)", color: item.staffTipStatus === "Đã gửi" ? "var(--success)" : "#6d28d9", fontWeight: "700" }}>
                          {item.staffTipStatus || "Chưa gửi"}
                        </span>
                      </td>
                      <td style={{ padding: "0.9rem 1rem", fontWeight: "850", color: "#6d28d9", fontSize: "0.95rem" }}>
                        {item.totalDebt.toLocaleString("vi-VN")} đ
                      </td>
                      <td style={{ padding: "0.9rem 1rem", textAlign: "right" }}>
                        <button
                          type="button"
                          onClick={() => handleMarkHelperPaid(item, "all")}
                          className="btn"
                          style={{ background: "#6d28d9", color: "white", padding: "4px 10px", borderRadius: "6px", fontSize: "0.78rem", fontWeight: "750", border: "none", cursor: "pointer" }}
                        >
                          ✓ Trả Đủ Lương
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
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
