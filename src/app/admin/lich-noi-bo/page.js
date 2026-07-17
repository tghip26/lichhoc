"use client";

import { useState, useEffect, Suspense } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { db } from "@/lib/firebase";
import { 
  collection, addDoc, doc, updateDoc, deleteDoc, 
  onSnapshot, query, orderBy, serverTimestamp, increment
} from "firebase/firestore";
import toast from "react-hot-toast";

function InternalSchedulesManager() {
  const { user, loading, isAdmin } = useAuth();
  const router = useRouter();

  // Route security guard
  useEffect(() => {
    if (!loading && (!user || !isAdmin)) {
      router.push("/");
    }
  }, [user, loading, isAdmin, router]);

  // Data state
  const [schedules, setSchedules] = useState([]);
  const [helpers, setHelpers] = useState([]);
  const [users, setUsers] = useState([]);
  const [loadingData, setLoadingData] = useState(true);

  // Filter & Navigation states
  const [viewMode, setViewMode] = useState("grid"); // "grid", "table" or "analytics"
  const [currentWeekStart, setCurrentWeekStart] = useState(() => {
    const d = new Date();
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust for Sunday
    const startOfWeek = new Date(d.setDate(diff));
    startOfWeek.setHours(0, 0, 0, 0);
    return startOfWeek;
  });

  // Table filters
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStudyStatus, setFilterStudyStatus] = useState("all");
  const [filterPaymentStatus, setFilterPaymentStatus] = useState("all");

  const getStatusBadgeStyle = (statusText) => {
    const text = (statusText || "").toLowerCase();
    if (text.includes("chưa") || text.includes("chua")) {
      return { background: "#fee2e2", color: "#b91c1c" };
    }
    if (text.includes("đã") || text.includes("da")) {
      return { background: "#dcfce7", color: "#166534" };
    }
    return { background: "#f1f5f9", color: "#475569" };
  };

  const getHelperShiftStatus = (helperEmail) => {
    if (!helperEmail) return false;
    const matchedUser = users.find(u => u.email?.toLowerCase() === helperEmail.toLowerCase());
    return matchedUser?.shiftStatus === "online";
  };

  // Form Modal states
  const [showModal, setShowModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState(null);

  // Form Fields
  const [formData, setFormData] = useState({
    studentName: "",
    subject: "",
    classDate: "",
    classroom: "",
    lecturer: "",
    helperName: "",
    checkinStatus: "not_checked_in", // "checked_in" or "not_checked_in"
    studyStatus: "chua_hoc",
    rentAmount: "",
    tipAmount: "",
    paymentStatus: "ChưaTT",
    salaryAmount: "",
    salaryStatus: "ChưaTL",
    staffTipAmount: "",
    period: "chieu", // "sang", "chieu", "toi"
    timeSlot: ""
  });

  // Responsive states
  const [isMobile, setIsMobile] = useState(false);
  const [selectedMobileDayOffset, setSelectedMobileDayOffset] = useState(0);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Load Firestore Data
  useEffect(() => {
    if (!user || !isAdmin) return;

    // Load Internal Schedules
    const qSchedules = query(
      collection(db, "internal_schedules"),
      orderBy("createdAt", "desc")
    );
    const unsubscribeSchedules = onSnapshot(qSchedules, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setSchedules(data);
      setLoadingData(false);
    }, (err) => {
      console.error("Lỗi tải lịch học nội bộ:", err);
      toast.error("Không thể tải lịch học nội bộ!");
      setLoadingData(false);
    });

    // Load Helpers (for dropdown selection)
    const qHelpers = query(collection(db, "helpers"));
    const unsubscribeHelpers = onSnapshot(qHelpers, (snapshot) => {
      const data = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter(h => h.status === "approved" || h.isApproved);
      setHelpers(data);
    }, (err) => {
      console.error("Lỗi tải CTV:", err);
    });

    // Load Users (to get shift status)
    const qUsers = query(collection(db, "users"));
    const unsubscribeUsers = onSnapshot(qUsers, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setUsers(data);
    }, (err) => {
      console.error("Lỗi tải thành viên:", err);
    });

    return () => {
      unsubscribeSchedules();
      unsubscribeHelpers();
      unsubscribeUsers();
    };
  }, [user, isAdmin]);

  if (loading || loadingData || !user || !isAdmin) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "100vh", background: "#f8fafc", color: "var(--text-secondary)" }}>
        Đang tải cấu hình quản lý lịch...
      </div>
    );
  }

  // Study Status Config Mapping (matching image 2 aesthetics)
  const studyStatuses = {
    chua_hoc: { label: "Chưa học", bg: "#f1f5f9", text: "#475569", border: "#cbd5e1" },
    dang_hoc: { label: "Đang học", bg: "#fef08a", text: "#854d0e", border: "#facc15" },
    da_hoc: { label: "Đã học", bg: "#dcfce7", text: "#166534", border: "#4ade80" },
    truc_trac: { label: "Trục trặc", bg: "#ffedd5", text: "#c2410c", border: "#fb923c" },
    huy: { label: "Bị hủy", bg: "#fee2e2", text: "#991b1b", border: "#f87171" },
    dang_xep: { label: "Đang xếp", bg: "#f3e8ff", text: "#6b21a8", border: "#c084fc" },
    dang_chot: { label: "Đang chốt", bg: "#ccfbf1", text: "#115e59", border: "#2dd4bf" },
    zero_hoc: { label: "0 học", bg: "#ffe4e6", text: "#9f1239", border: "#f43f5e" },
    sp_thi: { label: "SP Thi", bg: "#e0f2fe", text: "#075985", border: "#38bdf8" },
    online: { label: "Online", bg: "#f0fdf4", text: "#15803d", border: "#86efac" }
  };

  // Auto-calculate weekday and adjust period on date change
  const handleDateChange = (e) => {
    const dateVal = e.target.value;
    if (!dateVal) return;
    const dateObj = new Date(dateVal);
    const days = ["Chủ Nhật", "Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy"];
    const weekdayName = days[dateObj.getDay()];
    setFormData(prev => ({
      ...prev,
      classDate: dateVal,
      weekday: weekdayName
    }));
  };

  // Week Navigator functions
  const nextWeek = () => {
    setCurrentWeekStart(prev => {
      const next = new Date(prev);
      next.setDate(next.getDate() + 7);
      return next;
    });
  };

  const prevWeek = () => {
    setCurrentWeekStart(prev => {
      const next = new Date(prev);
      next.setDate(next.getDate() - 7);
      return next;
    });
  };

  const setThisWeek = () => {
    const d = new Date();
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    const startOfWeek = new Date(d.setDate(diff));
    startOfWeek.setHours(0, 0, 0, 0);
    setCurrentWeekStart(startOfWeek);
  };

  // Get date for specific weekday in the current week view
  const getDateOfWeekday = (daysOffset) => {
    const d = new Date(currentWeekStart);
    d.setDate(d.getDate() + daysOffset);
    return d;
  };

  const formatLocalDate = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  // Get active schedule cards for a weekday and slot period (sang, chieu, toi)
  const getSchedulesForCell = (dateString, period) => {
    return schedules.filter(s => s.classDate === dateString && s.period === period);
  };

  // CRUD actions
  const openAddModal = (dateStr = "", defaultPeriod = "chieu") => {
    let weekdayStr = "";
    if (dateStr) {
      const dateObj = new Date(dateStr);
      const days = ["Chủ Nhật", "Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy"];
      weekdayStr = days[dateObj.getDay()];
    }

    setFormData({
      studentName: "",
      subject: "",
      classDate: dateStr,
      weekday: weekdayStr,
      classroom: "",
      lecturer: "",
      helperName: "",
      checkinStatus: "not_checked_in",
      studyStatus: "chua_hoc",
      rentAmount: "",
      tipAmount: "",
      paymentStatus: "ChưaTT",
      salaryAmount: "",
      salaryStatus: "ChưaTL",
      staffTipAmount: "",
      period: defaultPeriod,
      timeSlot: ""
    });
    setIsEditing(false);
    setShowModal(true);
  };

  const openEditModal = (item) => {
    setFormData({
      studentName: item.studentName || "",
      subject: item.subject || "",
      classDate: item.classDate || "",
      weekday: item.weekday || "",
      classroom: item.classroom || "",
      lecturer: item.lecturer || "",
      helperName: item.helperName || "",
      checkinStatus: item.checkinStatus || "not_checked_in",
      studyStatus: item.studyStatus || "chua_hoc",
      rentAmount: item.rentAmount !== undefined ? String(item.rentAmount) : "",
      tipAmount: item.tipAmount !== undefined ? String(item.tipAmount) : "",
      paymentStatus: item.paymentStatus || "ChưaTT",
      salaryAmount: item.salaryAmount !== undefined ? String(item.salaryAmount) : "",
      salaryStatus: item.salaryStatus || "ChưaTL",
      staffTipAmount: item.staffTipAmount !== undefined ? String(item.staffTipAmount) : "",
      period: item.period || "chieu",
      timeSlot: item.timeSlot || ""
    });
    setEditingId(item.id);
    setIsEditing(true);
    setShowModal(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    const formattedData = {
      ...formData,
      rentAmount: formData.rentAmount ? Number(String(formData.rentAmount).replace(/\D/g, "")) : 0,
      tipAmount: formData.tipAmount ? Number(String(formData.tipAmount).replace(/\D/g, "")) : 0,
      salaryAmount: formData.salaryAmount ? Number(String(formData.salaryAmount).replace(/\D/g, "")) : 0,
      staffTipAmount: formData.staffTipAmount ? Number(String(formData.staffTipAmount).replace(/\D/g, "")) : 0,
      updatedAt: serverTimestamp()
    };

    // Tự động kiểm tra và lưu người đi học (CTV) mới vào danh sách helpers
    const helperNameEntered = (formData.helperName || "").trim();
    if (helperNameEntered) {
      const helperExists = helpers.some(h => 
        (h.alias || "").trim().toLowerCase() === helperNameEntered.toLowerCase() ||
        (h.name || "").trim().toLowerCase() === helperNameEntered.toLowerCase()
      );
      if (!helperExists) {
        try {
          await addDoc(collection(db, "helpers"), {
            name: helperNameEntered,
            alias: helperNameEntered,
            school: "Tự thêm bởi Admin",
            status: "approved",
            isApproved: true,
            isManual: true, // Phân biệt: CTV do admin tự thêm
            bio: "Cộng tác viên được Admin thêm thủ công khi lên lịch nội bộ.",
            createdAt: serverTimestamp()
          });
          toast.success(`Đã tự động lưu CTV mới: ${helperNameEntered}`);
        } catch (saveHelperErr) {
          console.error("Lỗi tự động lưu CTV mới:", saveHelperErr);
        }
      }
    }

    // Sanitize to avoid Firestore crash
    const sanitizedData = {};
    Object.keys(formattedData).forEach(key => {
      const val = formattedData[key];
      if (val === undefined) {
        sanitizedData[key] = "";
      } else if (typeof val === "number" && isNaN(val)) {
        sanitizedData[key] = 0;
      } else {
        sanitizedData[key] = val;
      }
    });

    // Check payout logic
    let payoutCompleted = false;
    if (isEditing && editingId) {
      const prevDoc = schedules.find(s => s.id === editingId);
      if (sanitizedData.salaryStatus === "Đã trả lương" && (!prevDoc || !prevDoc.payoutDone)) {
        payoutCompleted = true;
      }
    } else if (!isEditing) {
      if (sanitizedData.salaryStatus === "Đã trả lương") {
        payoutCompleted = true;
      }
    }

    if (payoutCompleted) {
      sanitizedData.payoutDone = true;
    } else {
      if (isEditing && editingId) {
        const prevDoc = schedules.find(s => s.id === editingId);
        if (sanitizedData.salaryStatus === "ChưaTL" && prevDoc && prevDoc.payoutDone) {
          sanitizedData.payoutDone = false;
        }
      }
    }

    try {
      if (isEditing) {
        await updateDoc(doc(db, "internal_schedules", editingId), sanitizedData);
        toast.success("Đã cập nhật lịch học nội bộ!");
      } else {
        sanitizedData.createdAt = serverTimestamp();
        await addDoc(collection(db, "internal_schedules"), sanitizedData);
        toast.success("Đã thêm lịch học nội bộ mới!");
      }

      // Trigger auto payout if marked completed
      if (payoutCompleted) {
        const helperNameClean = (sanitizedData.helperName || "").trim().toLowerCase();
        if (helperNameClean) {
          const helperObj = helpers.find(h => 
            !h.isManual && 
            ((h.alias && h.alias.trim().toLowerCase() === helperNameClean) ||
             (h.name && h.name.trim().toLowerCase() === helperNameClean))
          );

          if (helperObj && helperObj.userId) {
            const payoutVal = (Number(sanitizedData.salaryAmount) || 0) + (Number(sanitizedData.staffTipAmount) || 0);
            if (payoutVal > 0) {
              try {
                // 1. Update wallet balance
                await updateDoc(doc(db, "users", helperObj.userId), {
                  helperBalance: increment(payoutVal)
                });

                // 2. Add transaction record
                await addDoc(collection(db, "transactions"), {
                  userId: helperObj.userId,
                  userEmail: helperObj.email || helperObj.name || "ctv",
                  amount: payoutVal,
                  type: "payout_earn",
                  status: "completed",
                  message: `Nhận thù lao trực lớp nội bộ ${sanitizedData.subject} ngày ${new Date(sanitizedData.classDate).toLocaleDateString("vi-VN")}`,
                  createdAt: serverTimestamp()
                });

                // 3. Send Notification
                await addDoc(collection(db, "notifications"), {
                  userId: helperObj.userId,
                  title: "Nhận thù lao lịch nội bộ 💰",
                  message: `Ví thù lao CTV của bạn đã được cộng +${payoutVal.toLocaleString("vi-VN")} đ cho ca trực nội bộ môn ${sanitizedData.subject}.`,
                  read: false,
                  link: "/dashboard",
                  createdAt: serverTimestamp()
                });

                toast.info(`Đã tự động cộng +${payoutVal.toLocaleString("vi-VN")} đ thù lao vào ví CTV của ${helperObj.name}!`);
              } catch (payoutErr) {
                console.error("Lỗi tự động cộng tiền CTV:", payoutErr);
              }
            }
          }
        }
      }

      setShowModal(false);
    } catch (err) {
      console.error("Lỗi lưu lịch:", err);
      toast.error("Không thể lưu lịch học!");
    }
  };

  const handleDelete = async (id) => {
    if (confirm("Bạn có chắc chắn muốn xóa lịch học nội bộ này?")) {
      try {
        await deleteDoc(doc(db, "internal_schedules", id));
        toast.success("Đã xóa lịch học!");
        setShowModal(false);
      } catch (err) {
        console.error("Lỗi xóa:", err);
        toast.error("Không thể xóa lịch học!");
      }
    }
  };

  const handleDeleteManualHelper = async (id, name) => {
    if (!confirm(`Bạn có chắc chắn muốn xóa CTV "${name}" khỏi danh sách tự thêm không?`)) {
      return;
    }
    try {
      toast.loading("Đang xóa...", { id: "delete-manual-helper" });
      await deleteDoc(doc(db, "helpers", id));
      toast.success(`Đã xóa CTV "${name}" thành công!`, { id: "delete-manual-helper" });
      if (formData.helperName === name) {
        setFormData(prev => ({ ...prev, helperName: "" }));
      }
    } catch (err) {
      console.error("Lỗi xóa CTV tự thêm:", err);
      toast.error("Không thể xóa CTV: " + err.message, { id: "delete-manual-helper" });
    }
  };

  const handleEditManualHelper = async (id, currentName, currentAlias) => {
    const newName = prompt("Nhập Tên mới cho CTV:", currentName || "");
    if (newName === null) return;
    const newAlias = prompt("Nhập Biệt danh (Tên gợi nhớ) mới cho CTV:", currentAlias || newName);
    if (newAlias === null) return;

    if (!newName.trim()) {
      toast.error("Tên CTV không được để trống!");
      return;
    }

    try {
      toast.loading("Đang cập nhật...", { id: "edit-manual-helper" });
      await updateDoc(doc(db, "helpers", id), {
        name: newName.trim(),
        alias: newAlias.trim()
      });
      toast.success("Cập nhật thông tin CTV thành công!", { id: "edit-manual-helper" });
      if (formData.helperName === currentAlias || formData.helperName === currentName) {
        setFormData(prev => ({ ...prev, helperName: newAlias.trim() }));
      }
    } catch (err) {
      console.error("Lỗi cập nhật CTV tự thêm:", err);
      toast.error("Không thể cập nhật CTV: " + err.message, { id: "edit-manual-helper" });
    }
  };

  const handleDuplicateToNextWeek = async () => {
    if (!formData.classDate) {
      toast.error("Không có ngày học để nhân bản!");
      return;
    }
    try {
      const currentDate = new Date(formData.classDate);
      currentDate.setDate(currentDate.getDate() + 7);
      
      const newDateStr = formatLocalDate(currentDate);
      const days = ["Chủ Nhật", "Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy"];
      const newWeekday = days[currentDate.getDay()];

      const duplicatedData = {
        ...formData,
        classDate: newDateStr,
        weekday: newWeekday,
        rentAmount: formData.rentAmount ? Number(String(formData.rentAmount).replace(/\D/g, "")) : 0,
        tipAmount: formData.tipAmount ? Number(String(formData.tipAmount).replace(/\D/g, "")) : 0,
        salaryAmount: formData.salaryAmount ? Number(String(formData.salaryAmount).replace(/\D/g, "")) : 0,
        staffTipAmount: formData.staffTipAmount ? Number(String(formData.staffTipAmount).replace(/\D/g, "")) : 0,
        checkinStatus: "not_checked_in", // Reset checkin for next week
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      // Sanitize
      const sanitizedData = {};
      Object.keys(duplicatedData).forEach(key => {
        const val = duplicatedData[key];
        if (val === undefined) {
          sanitizedData[key] = "";
        } else if (typeof val === "number" && isNaN(val)) {
          sanitizedData[key] = 0;
        } else {
          sanitizedData[key] = val;
        }
      });

      await addDoc(collection(db, "internal_schedules"), sanitizedData);
      toast.success(`Đã nhân bản ca học sang tuần sau (${newWeekday} ngày ${currentDate.toLocaleDateString("vi-VN")})!`);
      setShowModal(false);
    } catch (err) {
      console.error("Lỗi nhân bản:", err);
      toast.error("Không thể nhân bản lịch học!");
    }
  };

  const renderAnalyticsView = () => {
    // 1. Calculate debt amounts across ALL schedules
    const unpaidCustomerTotal = schedules
      .filter(s => !s.paymentStatus?.toLowerCase().includes("đã") && s.paymentStatus !== "Đã thanh toán")
      .reduce((sum, s) => sum + Number(s.rentAmount || 0) + Number(s.tipAmount || 0), 0);

    const unpaidHelperSalaryTotal = schedules
      .filter(s => !s.salaryStatus?.toLowerCase().includes("đã") && s.salaryStatus !== "Đã trả lương")
      .reduce((sum, s) => sum + Number(s.salaryAmount || 0) + Number(s.staffTipAmount || 0), 0);

    // 2. Guest stats (sorted high to low)
    const guestStats = {};
    schedules.forEach(s => {
      const name = s.studentName ? s.studentName.trim() : "Khách ẩn danh";
      if (!guestStats[name]) {
        guestStats[name] = { name, total: 0, paid: 0, unpaid: 0, count: 0 };
      }
      const amt = Number(s.rentAmount || 0) + Number(s.tipAmount || 0);
      guestStats[name].total += amt;
      if (s.paymentStatus?.toLowerCase().includes("đã") || s.paymentStatus === "Đã thanh toán") {
        guestStats[name].paid += amt;
      } else {
        guestStats[name].unpaid += amt;
      }
      guestStats[name].count += 1;
    });
    const sortedGuests = Object.values(guestStats).sort((a, b) => b.total - a.total);

    // 3. CTV stats (salary paid/unpaid and count of finished classes)
    const ctvStats = {};
    schedules.forEach(s => {
      const name = s.helperName ? s.helperName.trim() : "";
      if (!name || name === "(Chưa giao CTV)") return;
      if (!ctvStats[name]) {
        ctvStats[name] = { name, totalEarned: 0, paid: 0, unpaid: 0, totalClasses: 0, finishedClasses: 0 };
      }
      const payout = Number(s.salaryAmount || 0) + Number(s.staffTipAmount || 0);
      const isFinished = s.studyStatus === "da_hoc" || s.studyStatus === "online";
      ctvStats[name].totalEarned += payout;
      if (s.salaryStatus?.toLowerCase().includes("đã") || s.salaryStatus === "Đã trả lương") {
        ctvStats[name].paid += payout;
      } else {
        ctvStats[name].unpaid += payout;
      }
      ctvStats[name].totalClasses += 1;
      if (isFinished) {
        ctvStats[name].finishedClasses += 1;
      }
    });
    const sortedCtvs = Object.values(ctvStats).sort((a, b) => b.totalEarned - a.totalEarned);

    // 4. Calculate weekly revenues of selected month
    const selectedMonth = currentWeekStart.getMonth(); // 0-11
    const selectedYear = currentWeekStart.getFullYear();
    const monthName = currentWeekStart.toLocaleString("vi-VN", { month: "long" });

    const monthSchedules = schedules.filter(s => {
      if (!s.classDate) return false;
      const d = new Date(s.classDate);
      return d.getMonth() === selectedMonth && d.getFullYear() === selectedYear;
    });

    const weeklyRevenue = [0, 0, 0, 0];
    monthSchedules.forEach(s => {
      const day = new Date(s.classDate).getDate();
      const amt = Number(s.rentAmount || 0) + Number(s.tipAmount || 0);
      if (day <= 7) weeklyRevenue[0] += amt;
      else if (day <= 14) weeklyRevenue[1] += amt;
      else if (day <= 21) weeklyRevenue[2] += amt;
      else weeklyRevenue[3] += amt;
    });

    const maxWeeklyRev = Math.max(...weeklyRevenue, 1);

    // Month navigation helpers
    const changeMonth = (increment) => {
      const newDate = new Date(currentWeekStart);
      newDate.setMonth(newDate.getMonth() + increment);
      setCurrentWeekStart(newDate);
    };

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
        
        {/* Header month navigator */}
        <div className="glass-panel" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "1rem 1.5rem", flexWrap: "wrap", gap: "12px" }}>
          <h3 style={{ margin: 0, fontSize: "1.1rem", fontWeight: "800", color: "var(--text-primary)" }}>
            📊 Phân tích tài chính - {monthName} / {selectedYear}
          </h3>
          <div style={{ display: "flex", gap: "10px" }}>
            <button onClick={() => changeMonth(-1)} className="btn" style={{ padding: "6px 12px", background: "white", border: "1px solid #cbd5e1", fontSize: "0.82rem" }}>◀ Tháng trước</button>
            <button onClick={() => { setCurrentWeekStart(new Date()); }} className="btn" style={{ padding: "6px 12px", background: "white", border: "1px solid #cbd5e1", fontWeight: "700", fontSize: "0.82rem" }}>Tháng này</button>
            <button onClick={() => changeMonth(1)} className="btn" style={{ padding: "6px 12px", background: "white", border: "1px solid #cbd5e1", fontSize: "0.82rem" }}>Tháng sau ▶</button>
          </div>
        </div>

        {/* 4 Financial Indicator Mini Cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "1rem" }}>
          
          <div className="glass-panel" style={{ padding: "1.25rem", borderLeft: "5px solid var(--danger)", background: "linear-gradient(135deg, rgba(239, 68, 68, 0.05) 0%, white 100%)" }}>
            <span style={{ fontSize: "0.75rem", fontWeight: "700", color: "#b91c1c", textTransform: "uppercase" }}>
              Khách chưa thanh toán (Công nợ)
            </span>
            <h3 style={{ margin: "6px 0 2px 0", fontSize: "1.5rem", fontWeight: "850", color: "var(--danger)" }}>
              {unpaidCustomerTotal.toLocaleString("vi-VN")} đ
            </h3>
            <span style={{ fontSize: "0.68rem", color: "var(--text-secondary)" }}>
              Tổng tiền thu từ các đơn hàng chưa thanh toán
            </span>
          </div>

          <div className="glass-panel" style={{ padding: "1.25rem", borderLeft: "5px solid #d97706", background: "linear-gradient(135deg, rgba(217, 119, 6, 0.05) 0%, white 100%)" }}>
            <span style={{ fontSize: "0.75rem", fontWeight: "700", color: "#b45309", textTransform: "uppercase" }}>
              Lương CTV chưa trả
            </span>
            <h3 style={{ margin: "6px 0 2px 0", fontSize: "1.5rem", fontWeight: "850", color: "#d97706" }}>
              {unpaidHelperSalaryTotal.toLocaleString("vi-VN")} đ
            </h3>
            <span style={{ fontSize: "0.68rem", color: "var(--text-secondary)" }}>
              Tổng tiền lương chưa chi trả cho Cộng tác viên
            </span>
          </div>

          <div className="glass-panel" style={{ padding: "1.25rem", borderLeft: "5px solid var(--primary)", background: "linear-gradient(135deg, rgba(22, 163, 74, 0.05) 0%, white 100%)" }}>
            <span style={{ fontSize: "0.75rem", fontWeight: "700", color: "var(--primary)", textTransform: "uppercase" }}>
              Doanh thu trong tháng
            </span>
            <h3 style={{ margin: "6px 0 2px 0", fontSize: "1.5rem", fontWeight: "850", color: "var(--primary)" }}>
              {monthSchedules.reduce((acc, s) => acc + Number(s.rentAmount || 0) + Number(s.tipAmount || 0), 0).toLocaleString("vi-VN")} đ
            </h3>
            <span style={{ fontSize: "0.68rem", color: "var(--text-secondary)" }}>
              Tổng tiền thu dự kiến trong tháng ({monthSchedules.length} ca)
            </span>
          </div>

          <div className="glass-panel" style={{ padding: "1.25rem", borderLeft: "5px solid #4f46e5", background: "linear-gradient(135deg, rgba(79, 70, 229, 0.05) 0%, white 100%)" }}>
            <span style={{ fontSize: "0.75rem", fontWeight: "700", color: "#4338ca", textTransform: "uppercase" }}>
              Lợi nhuận ròng tháng
            </span>
            <h3 style={{ margin: "6px 0 2px 0", fontSize: "1.5rem", fontWeight: "850", color: "#4f46e5" }}>
              {(
                monthSchedules.reduce((acc, s) => acc + Number(s.rentAmount || 0) + Number(s.tipAmount || 0), 0) - 
                monthSchedules.reduce((acc, s) => acc + Number(s.salaryAmount || 0) + Number(s.staffTipAmount || 0), 0)
              ).toLocaleString("vi-VN")} đ
            </h3>
            <span style={{ fontSize: "0.68rem", color: "var(--text-secondary)" }}>
              Lợi nhuận sau khi khấu trừ lương & tip CTV
            </span>
          </div>

        </div>

        {/* 2-Column Dashboard Layout */}
        <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: "1.5rem", alignItems: "start" }} className="form-grid">
          
          {/* Left Column: Weekly Bar Chart & Guest Ranking */}
          <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
            
            {/* Weekly Revenue Bar Chart */}
            <div className="glass-panel" style={{ padding: "1.5rem" }}>
              <h4 style={{ margin: "0 0 1.25rem 0", color: "var(--text-primary)", fontWeight: "800", fontSize: "0.95rem" }}>
                📈 Biểu đồ cột doanh thu của từng tuần (Trong tháng)
              </h4>
              <div style={{ display: "flex", justifyContent: "space-around", alignItems: "flex-end", height: "180px", padding: "10px 10px 0 10px", borderBottom: "2px solid #e2e8f0" }}>
                {weeklyRevenue.map((rev, idx) => {
                  const pct = Math.max(8, Math.min(100, Math.round((rev / maxWeeklyRev) * 100)));
                  return (
                    <div key={idx} style={{ display: "flex", flexDirection: "column", alignItems: "center", width: "15%" }}>
                      <span style={{ fontSize: "0.72rem", fontWeight: "750", color: "var(--text-primary)", marginBottom: "6px" }}>
                        {rev > 0 ? `${(rev / 1000).toLocaleString("vi-VN")}k` : "0"}
                      </span>
                      <div style={{
                        width: "100%",
                        height: `${pct * 1.3}px`,
                        background: "linear-gradient(180deg, var(--primary) 0%, #10B981 100%)",
                        borderRadius: "6px 6px 0 0",
                        boxShadow: "0 4px 12px rgba(22, 163, 74, 0.2)",
                        transition: "all 0.3s ease-in-out"
                      }} />
                      <span style={{ fontSize: "0.75rem", fontWeight: "700", color: "var(--text-secondary)", marginTop: "8px", whiteSpace: "nowrap" }}>
                        Tuần {idx + 1}
                      </span>
                    </div>
                  );
                })}
              </div>
              <div style={{ display: "flex", justifyContent: "center", gap: "15px", marginTop: "12px", fontSize: "0.7rem", color: "var(--text-secondary)", fontWeight: "600", flexWrap: "wrap" }}>
                <span>📅 T1: Ngày 1-7</span>
                <span>📅 T2: Ngày 8-14</span>
                <span>📅 T3: Ngày 15-21</span>
                <span>📅 T4: Ngày 22-Hết</span>
              </div>
            </div>

            {/* Guest Ranking Table */}
            <div className="glass-panel" style={{ padding: "1.5rem" }}>
              <h4 style={{ margin: "0 0 1rem 0", color: "var(--text-primary)", fontWeight: "800", fontSize: "0.95rem" }}>
                🏆 Chi phí thuê của từng khách thuê (Xếp từ cao đến thấp)
              </h4>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.82rem", textAlign: "left" }}>
                  <thead>
                    <tr style={{ borderBottom: "2px solid #e2e8f0", color: "#64748b" }}>
                      <th style={{ padding: "8px 4px" }}>Khách hàng</th>
                      <th style={{ padding: "8px 4px", textAlign: "center" }}>Số ca</th>
                      <th style={{ padding: "8px 4px", textAlign: "right" }}>Đã trả</th>
                      <th style={{ padding: "8px 4px", textAlign: "right" }}>Chưa trả</th>
                      <th style={{ padding: "8px 4px", textAlign: "right" }}>Tổng chi tiêu</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedGuests.length === 0 ? (
                      <tr>
                        <td colSpan="5" style={{ padding: "20px", textAlign: "center", color: "var(--text-secondary)" }}>Chưa có dữ liệu khách hàng.</td>
                      </tr>
                    ) : (
                      sortedGuests.map((g, idx) => (
                        <tr key={idx} style={{ borderBottom: "1px solid #f1f5f9" }}>
                          <td style={{ padding: "10px 4px", fontWeight: "700", color: "var(--text-primary)" }}>{g.name}</td>
                          <td style={{ padding: "10px 4px", textAlign: "center", fontWeight: "600" }}>{g.count}</td>
                          <td style={{ padding: "10px 4px", textAlign: "right", color: "var(--success)", fontWeight: "600" }}>{g.paid.toLocaleString("vi-VN")}đ</td>
                          <td style={{ padding: "10px 4px", textAlign: "right", color: g.unpaid > 0 ? "var(--danger)" : "var(--text-secondary)", fontWeight: "600" }}>
                            {g.unpaid > 0 ? `${g.unpaid.toLocaleString("vi-VN")}đ` : "-"}
                          </td>
                          <td style={{ padding: "10px 4px", textAlign: "right", fontWeight: "800", color: "var(--primary)" }}>{g.total.toLocaleString("vi-VN")}đ</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

          </div>

          {/* Right Column: Helper Stats Table */}
          <div className="glass-panel" style={{ padding: "1.5rem" }}>
            <h4 style={{ margin: "0 0 1rem 0", color: "var(--text-primary)", fontWeight: "800", fontSize: "0.95rem" }}>
              👥 Thống kê lương & Số buổi đã đi học của CTV
            </h4>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.82rem", textAlign: "left" }}>
                <thead>
                  <tr style={{ borderBottom: "2px solid #e2e8f0", color: "#64748b" }}>
                    <th style={{ padding: "8px 4px" }}>Cộng tác viên</th>
                    <th style={{ padding: "8px 4px", textAlign: "center" }}>Số ca nhận</th>
                    <th style={{ padding: "8px 4px", textAlign: "center" }}>Đã học</th>
                    <th style={{ padding: "8px 4px", textAlign: "right" }}>Đã nhận</th>
                    <th style={{ padding: "8px 4px", textAlign: "right" }}>Chưa nhận</th>
                    <th style={{ padding: "8px 4px", textAlign: "right" }}>Tổng lương</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedCtvs.length === 0 ? (
                    <tr>
                      <td colSpan="6" style={{ padding: "20px", textAlign: "center", color: "var(--text-secondary)" }}>Chưa có dữ liệu Cộng tác viên.</td>
                    </tr>
                  ) : (
                    sortedCtvs.map((c, idx) => (
                      <tr key={idx} style={{ borderBottom: "1px solid #f1f5f9" }}>
                        <td style={{ padding: "10px 4px", fontWeight: "700", color: "#4f46e5" }}>{c.name}</td>
                        <td style={{ padding: "10px 4px", textAlign: "center", fontWeight: "600" }}>{c.totalClasses}</td>
                        <td style={{ padding: "10px 4px", textAlign: "center", color: "var(--success)", fontWeight: "750" }}>{c.finishedClasses} ca</td>
                        <td style={{ padding: "10px 4px", textAlign: "right", color: "var(--text-secondary)", fontWeight: "600" }}>{c.paid.toLocaleString("vi-VN")}đ</td>
                        <td style={{ padding: "10px 4px", textAlign: "right", color: c.unpaid > 0 ? "#d97706" : "var(--text-secondary)", fontWeight: "600" }}>
                          {c.unpaid > 0 ? `${c.unpaid.toLocaleString("vi-VN")}đ` : "-"}
                        </td>
                        <td style={{ padding: "10px 4px", textAlign: "right", fontWeight: "800", color: "var(--primary)" }}>{c.totalEarned.toLocaleString("vi-VN")}đ</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>

      </div>
    );
  };

  const renderMobileGridView = () => {
    const activeDateStr = formatLocalDate(getDateOfWeekday(selectedMobileDayOffset));
    const morningJobs = getSchedulesForCell(activeDateStr, "sang");
    const afternoonJobs = getSchedulesForCell(activeDateStr, "chieu");
    const eveningJobs = getSchedulesForCell(activeDateStr, "toi");

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        {/* Horizontal scrollable Day selector tabs */}
        <div 
          className="hide-scrollbar" 
          style={{ 
            display: "flex", 
            gap: "8px", 
            overflowX: "auto", 
            paddingBottom: "8px", 
            marginBottom: "8px",
            WebkitOverflowScrolling: "touch"
          }}
        >
          {weekdaysConfig.map((day, idx) => {
            const dayDate = getDateOfWeekday(day.offset);
            const isSelected = selectedMobileDayOffset === day.offset;
            const isToday = new Date().toDateString() === dayDate.toDateString();
            return (
              <button
                key={idx}
                type="button"
                onClick={() => setSelectedMobileDayOffset(day.offset)}
                style={{
                  flexShrink: 0, 
                  padding: "8px 12px", 
                  borderRadius: "10px", 
                  border: "1px solid",
                  borderColor: isSelected ? "var(--primary)" : isToday ? "rgba(79,70,229,0.3)" : "#cbd5e1",
                  background: isSelected ? "var(--primary)" : "white",
                  color: isSelected ? "white" : isToday ? "var(--primary)" : "var(--text-primary)",
                  fontWeight: "750", 
                  cursor: "pointer", 
                  fontSize: "0.78rem",
                  textAlign: "center"
                }}
              >
                <div>{day.name}</div>
                <div style={{ fontSize: "0.65rem", opacity: isSelected ? "0.9" : "0.55", fontWeight: "600", marginTop: "2px" }}>
                  {dayDate.toLocaleDateString("vi-VN", { day: "numeric", month: "numeric" })}
                </div>
              </button>
            );
          })}
        </div>

        {/* Ca Sáng */}
        <div style={{ background: "white", borderRadius: "14px", padding: "12px", border: "1px solid #e2e8f0", boxShadow: "0 1px 3px rgba(0,0,0,0.02)" }}>
          <h4 style={{ margin: "0 0 10px 0", color: "#475569", fontWeight: "800", fontSize: "0.85rem" }}>
            🌅 CA SÁNG ({morningJobs.length})
          </h4>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {morningJobs.map(job => renderGridCard(job))}
            <button
              type="button"
              onClick={() => openAddModal(activeDateStr, "sang")}
              style={{
                width: "100%", padding: "8px", border: "2px dashed #cbd5e1", borderRadius: "8px",
                background: "none", color: "#94a3b8", fontSize: "0.72rem", cursor: "pointer", fontWeight: "700"
              }}
            >
              + Thêm ca sáng
            </button>
          </div>
        </div>

        {/* Ca Chiều */}
        <div style={{ background: "white", borderRadius: "14px", padding: "12px", border: "1px solid #e2e8f0", boxShadow: "0 1px 3px rgba(0,0,0,0.02)" }}>
          <h4 style={{ margin: "0 0 10px 0", color: "#475569", fontWeight: "800", fontSize: "0.85rem" }}>
            ☀️ CA CHIỀU ({afternoonJobs.length})
          </h4>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {afternoonJobs.map(job => renderGridCard(job))}
            <button
              type="button"
              onClick={() => openAddModal(activeDateStr, "chieu")}
              style={{
                width: "100%", padding: "8px", border: "2px dashed #cbd5e1", borderRadius: "8px",
                background: "none", color: "#94a3b8", fontSize: "0.72rem", cursor: "pointer", fontWeight: "700"
              }}
            >
              + Thêm ca chiều
            </button>
          </div>
        </div>

        {/* Ca Tối */}
        <div style={{ background: "white", borderRadius: "14px", padding: "12px", border: "1px solid #e2e8f0", boxShadow: "0 1px 3px rgba(0,0,0,0.02)" }}>
          <h4 style={{ margin: "0 0 10px 0", color: "#475569", fontWeight: "800", fontSize: "0.85rem" }}>
            🌙 CA TỐI ({eveningJobs.length})
          </h4>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {eveningJobs.map(job => renderGridCard(job))}
            <button
              type="button"
              onClick={() => openAddModal(activeDateStr, "toi")}
              style={{
                width: "100%", padding: "8px", border: "2px dashed #cbd5e1", borderRadius: "8px",
                background: "none", color: "#94a3b8", fontSize: "0.72rem", cursor: "pointer", fontWeight: "700"
              }}
            >
              + Thêm ca tối
            </button>
          </div>
        </div>
      </div>
    );
  };

  // CSV Export helper
  const handleExportCSV = () => {
    if (schedules.length === 0) {
      toast.error("Không có dữ liệu lịch để xuất!");
      return;
    }
    const headers = [
      "Tên người học", "Môn học", "Ngày học", "Thứ", "Phòng", "Giảng viên",
      "Người đi học", "Checkin", "Trạng thái học", "Buổi", "Giờ học",
      "Tiền thuê học", "Tiền tip", "Trạng thái gửi tiền người thuê",
      "Tiền trả lương", "Trạng thái trả lương", "Tiền tip nhân viên"
    ];
    const rows = schedules.map(s => [
      s.studentName, s.subject, s.classDate, s.weekday, s.classroom, s.lecturer,
      s.helperName, s.checkinStatus === "checked_in" ? "Đã checkin" : "Chưa checkin",
      studyStatuses[s.studyStatus]?.label || s.studyStatus, s.period === "sang" ? "Sáng" : s.period === "chieu" ? "Chiều" : "Tối",
      s.timeSlot, s.rentAmount, s.tipAmount, s.paymentStatus,
      s.salaryAmount, s.salaryStatus, s.staffTipAmount
    ]);

    let csvContent = "data:text/csv;charset=utf-8,\uFEFF";
    csvContent += headers.join(",") + "\n";
    rows.forEach(row => {
      const sanitizedRow = row.map(val => {
        const str = String(val !== undefined ? val : "").replace(/"/g, '""');
        return str.includes(",") || str.includes("\n") || str.includes('"') ? `"${str}"` : str;
      });
      csvContent += sanitizedRow.join(",") + "\n";
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Lich_Hoc_Noi_Bo_${new Date().toLocaleDateString("vi-VN")}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Filtered list for Spreadsheet mode
  const filteredTableList = schedules.filter(item => {
    const matchText = 
      (item.studentName || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.subject || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.classroom || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.helperName || "").toLowerCase().includes(searchTerm.toLowerCase());

    const matchStudy = filterStudyStatus === "all" || item.studyStatus === filterStudyStatus;
    const matchPay = filterPaymentStatus === "all" || 
                     (filterPaymentStatus === "paid" && item.paymentStatus?.toLowerCase().includes("đã")) ||
                     (filterPaymentStatus === "unpaid" && item.paymentStatus?.toLowerCase().includes("chưa"));

    return matchText && matchStudy && matchPay;
  });

  // Extract unique past values for autocomplete datalists
  const uniqueSubjects = Array.from(new Set(schedules.map(s => s.subject).filter(Boolean)));
  const uniqueClassrooms = Array.from(new Set(schedules.map(s => s.classroom).filter(Boolean)));
  const uniqueLecturers = Array.from(new Set(schedules.map(s => s.lecturer).filter(Boolean)));

  // Financial summary computation
  const startStr = formatLocalDate(currentWeekStart);
  const endStr = formatLocalDate(getDateOfWeekday(6));
  const weeklySchedules = schedules.filter(s => s.classDate >= startStr && s.classDate <= endStr);
  const selectedSchedules = viewMode === "grid" ? weeklySchedules : filteredTableList;

  const totalTenantIncome = selectedSchedules.reduce((acc, s) => acc + Number(s.rentAmount || 0) + Number(s.tipAmount || 0), 0);
  const totalHelperPayout = selectedSchedules.reduce((acc, s) => acc + Number(s.salaryAmount || 0) + Number(s.staffTipAmount || 0), 0);
  const netProfit = totalTenantIncome - totalHelperPayout;
  const totalClassesCount = selectedSchedules.length;
  const checkedInCount = selectedSchedules.filter(s => s.checkinStatus === "checked_in").length;
  const completedCount = selectedSchedules.filter(s => s.studyStatus === "da_hoc" || s.studyStatus === "online").length;
  const issueCount = selectedSchedules.filter(s => s.studyStatus === "truc_trac" || s.studyStatus === "huy" || s.studyStatus === "zero_hoc").length;

  // Static weekday layout configuration (Monday to Sunday)
  const weekdaysConfig = [
    { name: "Thứ Hai", offset: 0 },
    { name: "Thứ Ba", offset: 1 },
    { name: "Thứ Tư", offset: 2 },
    { name: "Thứ Năm", offset: 3 },
    { name: "Thứ Sáu", offset: 4 },
    { name: "Thứ Bảy", offset: 5 },
    { name: "Chủ Nhật", offset: 6 }
  ];

  // RENDER COLORFUL STUDY STATUS PILL
  const renderStatusPill = (statusKey) => {
    const config = studyStatuses[statusKey] || studyStatuses.chua_hoc;
    return (
      <span style={{
        fontSize: "0.68rem", padding: "1px 6px", borderRadius: "4px", fontWeight: "750",
        background: config.bg, color: config.text, border: `1px solid ${config.border}`
      }}>
        {config.label}
      </span>
    );
  };

  // RENDER THE GRID CARD COMPONENT
  const renderGridCard = (item) => {
    const borderLeftColor = studyStatuses[item.studyStatus]?.border || "#cbd5e1";
    
    return (
      <div 
        key={item.id}
        onClick={() => openEditModal(item)}
        style={{
          background: "white", borderRadius: "10px", padding: "10px",
          boxShadow: "0 2px 4px rgba(0,0,0,0.03)", border: "1px solid #e2e8f0",
          borderLeft: `5px solid ${borderLeftColor}`, cursor: "pointer",
          transition: "transform 0.15s, box-shadow 0.15s",
          display: "flex", flexDirection: "column", gap: "5px",
          textAlign: "left", fontSize: "0.78rem"
        }}
        onMouseEnter={e => {
          e.currentTarget.style.transform = "translateY(-1px)";
          e.currentTarget.style.boxShadow = "0 4px 8px rgba(0,0,0,0.06)";
        }}
        onMouseLeave={e => {
          e.currentTarget.style.transform = "none";
          e.currentTarget.style.boxShadow = "0 2px 4px rgba(0,0,0,0.03)";
        }}
      >
        {/* Header / Student Name (Occupies entire line) */}
        <div style={{ fontWeight: "800", color: "#1e293b", fontSize: "0.85rem", wordBreak: "break-word", lineHeight: "1.3" }}>
          {item.studentName}
        </div>
        
        {/* Time Slot (Below the name) */}
        <div style={{ fontSize: "0.72rem", color: "#64748b", fontWeight: "600", display: "flex", alignItems: "center", gap: "4px", margin: "1px 0" }}>
          ⏱️ {item.timeSlot || ""}
        </div>
        
        <div style={{ opacity: 0.85, color: "#334155", lineHeight: "1.4" }}>
          <b>Môn:</b> {item.subject}<br/>
          {item.classroom && <><b>Phòng:</b> {item.classroom}<br/></>}
          {item.lecturer && <><b>GV:</b> {item.lecturer}<br/></>}
          <span style={{ color: "#4f46e5", fontWeight: "700" }}>
            👤 {item.helperName || "(Chưa giao CTV)"}
          </span>
          {item.proofImage && (
            <div style={{ marginTop: "5px" }}>
              <span style={{ fontSize: "0.68rem", color: "var(--text-secondary)", display: "block", marginBottom: "2px" }}>📸 Minh chứng:</span>
              <img 
                src={item.proofImage} 
                alt="Minh chứng" 
                style={{ width: "100%", height: "60px", objectFit: "cover", borderRadius: "6px", cursor: "pointer", border: "1px solid #cbd5e1" }}
                onClick={() => setLightboxImage(item.proofImage)}
              />
            </div>
          )}
        </div>

        {/* Render sub-info badges matching the spreadsheet view */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: "3px", marginTop: "3px", borderTop: "1px dashed #f1f5f9", paddingTop: "5px" }}>
          {/* Study Status */}
          {renderStatusPill(item.studyStatus)}

          {/* Checkin Status */}
          <span style={{
            fontSize: "0.68rem", padding: "1px 5px", borderRadius: "4px", fontWeight: "700",
            background: item.checkinStatus === "checked_in" ? "#dcfce7" : "#fee2e2",
            color: item.checkinStatus === "checked_in" ? "#166534" : "#b91c1c"
          }}>
            {item.checkinStatus === "checked_in" ? "Checkin" : "Chưa CK"}
          </span>

          {/* Payment Status (Tenant) */}
          <span style={{
            fontSize: "0.68rem", padding: "1px 5px", borderRadius: "4px", fontWeight: "700",
            ...getStatusBadgeStyle(item.paymentStatus)
          }}>
            {item.paymentStatus}{item.rentAmount > 0 ? ` | +${Number(item.rentAmount).toLocaleString("vi-VN")}đ` : ""}
          </span>

          {/* Salary Status */}
          <span style={{
            fontSize: "0.68rem", padding: "1px 5px", borderRadius: "4px", fontWeight: "700",
            ...getStatusBadgeStyle(item.salaryStatus)
          }}>
            {item.salaryStatus}{item.salaryAmount > 0 ? ` | -${Number(item.salaryAmount).toLocaleString("vi-VN")}đ` : ""}
          </span>

          {/* Tip / Extra tip for Staff if present */}
          {item.staffTipAmount > 0 && (
            <span style={{
              fontSize: "0.68rem", padding: "1px 5px", borderRadius: "4px", fontWeight: "700",
              background: "#e0f2fe", color: "#0369a1"
            }}>
              +{Number(item.staffTipAmount).toLocaleString("vi-VN")}đ Tip Staff
            </span>
          )}

          {/* Tip / Extra tip from Customer if present */}
          {item.tipAmount > 0 && (
            <span style={{
              fontSize: "0.68rem", padding: "1px 5px", borderRadius: "4px", fontWeight: "700",
              background: "#fef3c7", color: "#b45309"
            }}>
              +{Number(item.tipAmount).toLocaleString("vi-VN")}đ Tip KT
            </span>
          )}
        </div>
      </div>
    );
  };

  return (
    <div style={{ padding: "2rem", minHeight: "100vh", background: "#f8fafc" }}>
      {/* HEADER SECTION */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "2rem", flexWrap: "wrap", gap: "15px" }}>
        <div>
          <h2 style={{ margin: 0, fontSize: "1.75rem", fontWeight: "850", color: "var(--text-primary)" }}>
            📅 Quản Lý Lịch Học Nội Bộ (Tự Thêm)
          </h2>
          <p style={{ margin: "5px 0 0 0", fontSize: "0.85rem", color: "var(--text-secondary)" }}>
            Giao diện lập lịch, kiểm soát check-in, chi phí, lương CTV và tình trạng các buổi trực học hộ nội bộ.
          </p>
        </div>

        <div style={{ display: "flex", gap: "10px" }}>
          <button 
            onClick={() => openAddModal()} 
            className="btn btn-primary"
            style={{ padding: "0.6rem 1.2rem", borderRadius: "10px", fontWeight: "700" }}
          >
            ➕ Thêm Lịch Học
          </button>
          <button 
            onClick={handleExportCSV} 
            className="btn"
            style={{ background: "white", color: "var(--text-primary)", border: "1px solid #cbd5e1", padding: "0.6rem 1.2rem", borderRadius: "10px" }}
          >
            📥 Xuất CSV
          </button>
          <button 
            onClick={() => router.push("/admin")} 
            className="btn"
            style={{ background: "#475569", color: "white", padding: "0.6rem 1.2rem", borderRadius: "10px" }}
          >
             Quay lại Admin
          </button>
        </div>
      </div>

      {/* BẢNG TỔNG HỢP TÀI CHÍNH TỰ ĐỘNG */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
        gap: "1rem",
        marginBottom: "1.5rem"
      }}>
        <div style={{ padding: "1rem", background: "linear-gradient(135deg, #eff6ff, #dbeafe)", border: "1px solid #bfdbfe", borderRadius: "14px", display: "flex", flexDirection: "column", gap: "4px" }}>
          <span style={{ fontSize: "0.72rem", color: "#1e3a8a", fontWeight: "800", textTransform: "uppercase", letterSpacing: "0.5px" }}>💵 Tổng Thu Khách</span>
          <span style={{ fontSize: "1.3rem", fontWeight: "900", color: "#1d4ed8" }}>{totalTenantIncome.toLocaleString("vi-VN")} đ</span>
          <span style={{ fontSize: "0.68rem", opacity: 0.8, color: "#1e3a8a" }}>{viewMode === "grid" ? "Tuần đang xem" : "Bộ lọc hiện tại"} ({totalClassesCount} ca)</span>
        </div>

        <div style={{ padding: "1rem", background: "linear-gradient(135deg, #fffbeb, #fef3c7)", border: "1px solid #fde68a", borderRadius: "14px", display: "flex", flexDirection: "column", gap: "4px" }}>
          <span style={{ fontSize: "0.72rem", color: "#78350f", fontWeight: "800", textTransform: "uppercase", letterSpacing: "0.5px" }}>💸 Tổng Chi CTV</span>
          <span style={{ fontSize: "1.3rem", fontWeight: "900", color: "#b45309" }}>{totalHelperPayout.toLocaleString("vi-VN")} đ</span>
          <span style={{ fontSize: "0.68rem", opacity: 0.8, color: "#78350f" }}>Gồm Lương và Tip cộng tác viên</span>
        </div>

        <div style={{ padding: "1rem", background: netProfit >= 0 ? "linear-gradient(135deg, #f0fdf4, #dcfce7)" : "linear-gradient(135deg, #fdf2f2, #fee2e2)", border: netProfit >= 0 ? "1px solid #bbf7d0" : "1px solid #fecaca", borderRadius: "14px", display: "flex", flexDirection: "column", gap: "4px" }}>
          <span style={{ fontSize: "0.72rem", color: netProfit >= 0 ? "#14532d" : "#7f1d1d", fontWeight: "800", textTransform: "uppercase", letterSpacing: "0.5px" }}>📈 Lợi Nhuận Ròng</span>
          <span style={{ fontSize: "1.3rem", fontWeight: "900", color: netProfit >= 0 ? "#15803d" : "#b91c1c" }}>{netProfit.toLocaleString("vi-VN")} đ</span>
          <span style={{ fontSize: "0.68rem", opacity: 0.8, color: netProfit >= 0 ? "#14532d" : "#7f1d1d" }}>Tỷ suất lợi nhuận: {totalTenantIncome > 0 ? Math.round((netProfit / totalTenantIncome) * 100) : 0}%</span>
        </div>

        <div style={{ padding: "1rem", background: "white", border: "1px solid #e2e8f0", borderRadius: "14px", display: "flex", flexDirection: "column", gap: "4px" }}>
          <span style={{ fontSize: "0.72rem", color: "#475569", fontWeight: "800", textTransform: "uppercase", letterSpacing: "0.5px" }}>📊 Chỉ Số Trực Lớp</span>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "2px" }}>
            <div>
              <div style={{ fontSize: "0.9rem", fontWeight: "800", color: "#334155" }}>Checkin: {checkedInCount}/{totalClassesCount}</div>
              <div style={{ fontSize: "0.68rem", opacity: 0.6 }}>Tỷ lệ: {totalClassesCount > 0 ? Math.round((checkedInCount / totalClassesCount) * 100) : 0}%</div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: "0.9rem", fontWeight: "800", color: "#16a34a" }}>Đã học: {completedCount} ca</div>
              {issueCount > 0 && <div style={{ fontSize: "0.68rem", color: "#ef4444", fontWeight: "700" }}>Trục trặc/Hủy: {issueCount}</div>}
            </div>
          </div>
        </div>
      </div>

      {/* VIEW SELECTOR & NAV */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "white", padding: "12px 1.5rem", borderRadius: "16px", boxShadow: "0 1px 3px rgba(0,0,0,0.05)", marginBottom: "1.5rem", flexWrap: "wrap", gap: "15px" }}>
        {/* Toggle Grid/Table View */}
        <div style={{ display: "flex", background: "#f1f5f9", padding: "4px", borderRadius: "10px", flexWrap: "wrap", gap: "2px" }}>
          <button
            onClick={() => setViewMode("grid")}
            style={{
              padding: "6px 16px", borderRadius: "8px", border: "none", fontSize: "0.85rem", fontWeight: "700", cursor: "pointer",
              background: viewMode === "grid" ? "white" : "transparent",
              color: viewMode === "grid" ? "var(--text-primary)" : "var(--text-secondary)",
              boxShadow: viewMode === "grid" ? "0 2px 4px rgba(0,0,0,0.05)" : "none",
              transition: "all 0.15s"
            }}
          >
            📅 Giao diện Lịch Tuần
          </button>
          <button
            onClick={() => setViewMode("table")}
            style={{
              padding: "6px 16px", borderRadius: "8px", border: "none", fontSize: "0.85rem", fontWeight: "700", cursor: "pointer",
              background: viewMode === "table" ? "white" : "transparent",
              color: viewMode === "table" ? "var(--text-primary)" : "var(--text-secondary)",
              boxShadow: viewMode === "table" ? "0 2px 4px rgba(0,0,0,0.05)" : "none",
              transition: "all 0.15s"
            }}
          >
            📊 Giao diện Bảng Tính
          </button>
          <button
            onClick={() => setViewMode("analytics")}
            style={{
              padding: "6px 16px", borderRadius: "8px", border: "none", fontSize: "0.85rem", fontWeight: "700", cursor: "pointer",
              background: viewMode === "analytics" ? "white" : "transparent",
              color: viewMode === "analytics" ? "var(--text-primary)" : "var(--text-secondary)",
              boxShadow: viewMode === "analytics" ? "0 2px 4px rgba(0,0,0,0.05)" : "none",
              transition: "all 0.15s"
            }}
          >
            📈 Phân tích tài chính 📊
          </button>
        </div>

        {/* Week Switcher (Only visible in grid view) */}
        {viewMode === "grid" && (
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <button onClick={prevWeek} className="btn" style={{ padding: "6px 12px", background: "white", border: "1px solid #cbd5e1" }}>◀ Tuần trước</button>
            <button onClick={setThisWeek} className="btn" style={{ padding: "6px 12px", background: "white", border: "1px solid #cbd5e1", fontWeight: "700" }}>Tuần này</button>
            <span style={{ fontSize: "0.88rem", fontWeight: "700", color: "var(--text-primary)" }}>
              Từ {getDateOfWeekday(0).toLocaleDateString("vi-VN")} đến {getDateOfWeekday(6).toLocaleDateString("vi-VN")}
            </span>
            <button onClick={nextWeek} className="btn" style={{ padding: "6px 12px", background: "white", border: "1px solid #cbd5e1" }}>Tuần sau ▶</button>
          </div>
        )}

        {/* Filters (Only visible in table view) */}
        {viewMode === "table" && (
          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "center" }}>
            <input 
              type="text"
              placeholder="Tìm kiếm nhanh..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              style={{ padding: "6px 12px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "0.82rem", width: "180px" }}
            />
            <select
              value={filterStudyStatus}
              onChange={e => setFilterStudyStatus(e.target.value)}
              style={{ padding: "6px 12px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "0.82rem", background: "white" }}
            >
              <option value="all">-- Trạng thái học --</option>
              {Object.keys(studyStatuses).map(k => (
                <option key={k} value={k}>{studyStatuses[k].label}</option>
              ))}
            </select>
            <select
              value={filterPaymentStatus}
              onChange={e => setFilterPaymentStatus(e.target.value)}
              style={{ padding: "6px 12px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "0.82rem", background: "white" }}
            >
              <option value="all">-- Tiền khách gửi --</option>
              <option value="paid">Đã đóng tiền</option>
              <option value="unpaid">Chưa đóng tiền</option>
            </select>
          </div>
        )}
      </div>

      {/* RENDER GRID VIEW (Weekly Timetable) */}
      {viewMode === "grid" && (
        isMobile ? renderMobileGridView() : (
          <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: "6px", minWidth: "1000px" }}>
            <thead>
              <tr>
                <th style={{ width: "80px", background: "#cbd5e1", color: "#334155", padding: "12px", borderRadius: "8px", fontSize: "0.85rem", fontWeight: "750" }}>
                  BUỔI
                </th>
                {weekdaysConfig.map((day, idx) => {
                  const dayDate = getDateOfWeekday(day.offset);
                  const isToday = new Date().toDateString() === dayDate.toDateString();
                  return (
                    <th 
                      key={idx}
                      style={{
                        background: isToday ? "var(--primary)" : "white",
                        color: isToday ? "white" : "var(--text-primary)",
                        padding: "10px",
                        borderRadius: "8px",
                        boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
                        fontSize: "0.88rem",
                        width: "14%"
                      }}
                    >
                      <div style={{ fontWeight: "800" }}>{day.name}</div>
                      <div style={{ fontSize: "0.72rem", opacity: isToday ? "0.9" : "0.55", fontWeight: "600", marginTop: "2px" }}>
                        {dayDate.toLocaleDateString("vi-VN")}
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {/* MORNING SLOT */}
              <tr style={{ minHeight: "150px" }}>
                <td style={{ background: "#f1f5f9", color: "#475569", fontWeight: "800", fontSize: "0.82rem", padding: "15px", textAlign: "center", borderRadius: "8px", verticalAlign: "middle" }}>
                  SÁNG
                </td>
                {weekdaysConfig.map((day, idx) => {
                  const dateStr = formatLocalDate(getDateOfWeekday(day.offset));
                  const cellJobs = getSchedulesForCell(dateStr, "sang");
                  return (
                    <td key={idx} style={{ verticalAlign: "top", background: "#f8fafc", borderRadius: "8px", padding: "4px" }}>
                      <div style={{ display: "flex", flexDirection: "column", gap: "6px", minHeight: "130px" }}>
                        {cellJobs.map(job => renderGridCard(job))}
                        <div 
                          onClick={() => openAddModal(dateStr, "sang")}
                          style={{
                            flex: 1, minHeight: "40px", border: "2px dashed #cbd5e1", borderRadius: "8px",
                            display: "flex", justifyContent: "center", alignItems: "center", cursor: "pointer",
                            color: "#94a3b8", fontSize: "0.75rem", transition: "all 0.15s", background: "rgba(255,255,255,0.4)"
                          }}
                          onMouseEnter={e => e.currentTarget.style.borderColor = "var(--primary)"}
                          onMouseLeave={e => e.currentTarget.style.borderColor = "#cbd5e1"}
                        >
                          + Thêm ca sáng
                        </div>
                      </div>
                    </td>
                  );
                })}
              </tr>

              {/* AFTERNOON SLOT */}
              <tr style={{ minHeight: "150px" }}>
                <td style={{ background: "#f1f5f9", color: "#475569", fontWeight: "800", fontSize: "0.82rem", padding: "15px", textAlign: "center", borderRadius: "8px", verticalAlign: "middle" }}>
                  CHIỀU
                </td>
                {weekdaysConfig.map((day, idx) => {
                  const dateStr = formatLocalDate(getDateOfWeekday(day.offset));
                  const cellJobs = getSchedulesForCell(dateStr, "chieu");
                  return (
                    <td key={idx} style={{ verticalAlign: "top", background: "#f8fafc", borderRadius: "8px", padding: "4px" }}>
                      <div style={{ display: "flex", flexDirection: "column", gap: "6px", minHeight: "130px" }}>
                        {cellJobs.map(job => renderGridCard(job))}
                        <div 
                          onClick={() => openAddModal(dateStr, "chieu")}
                          style={{
                            flex: 1, minHeight: "40px", border: "2px dashed #cbd5e1", borderRadius: "8px",
                            display: "flex", justifyContent: "center", alignItems: "center", cursor: "pointer",
                            color: "#94a3b8", fontSize: "0.75rem", transition: "all 0.15s", background: "rgba(255,255,255,0.4)"
                          }}
                          onMouseEnter={e => e.currentTarget.style.borderColor = "var(--primary)"}
                          onMouseLeave={e => e.currentTarget.style.borderColor = "#cbd5e1"}
                        >
                          + Thêm ca chiều
                        </div>
                      </div>
                    </td>
                  );
                })}
              </tr>

              {/* EVENING SLOT */}
              <tr style={{ minHeight: "150px" }}>
                <td style={{ background: "#f1f5f9", color: "#475569", fontWeight: "800", fontSize: "0.82rem", padding: "15px", textAlign: "center", borderRadius: "8px", verticalAlign: "middle" }}>
                  TỐI
                </td>
                {weekdaysConfig.map((day, idx) => {
                  const dateStr = formatLocalDate(getDateOfWeekday(day.offset));
                  const cellJobs = getSchedulesForCell(dateStr, "toi");
                  return (
                    <td key={idx} style={{ verticalAlign: "top", background: "#f8fafc", borderRadius: "8px", padding: "4px" }}>
                      <div style={{ display: "flex", flexDirection: "column", gap: "6px", minHeight: "130px" }}>
                        {cellJobs.map(job => renderGridCard(job))}
                        <div 
                          onClick={() => openAddModal(dateStr, "toi")}
                          style={{
                            flex: 1, minHeight: "40px", border: "2px dashed #cbd5e1", borderRadius: "8px",
                            display: "flex", justifyContent: "center", alignItems: "center", cursor: "pointer",
                            color: "#94a3b8", fontSize: "0.75rem", transition: "all 0.15s", background: "rgba(255,255,255,0.4)"
                          }}
                          onMouseEnter={e => e.currentTarget.style.borderColor = "var(--primary)"}
                          onMouseLeave={e => e.currentTarget.style.borderColor = "#cbd5e1"}
                        >
                          + Thêm ca tối
                        </div>
                      </div>
                    </td>
                  );
                })}
              </tr>
            </tbody>
          </table>
        </div>
        )
      )}

      {/* RENDER TABLE VIEW (Spreadsheet style) */}
      {viewMode === "table" && (
        <div style={{ background: "white", borderRadius: "16px", boxShadow: "0 4px 6px -1px rgba(0,0,0,0.05)", overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "1200px" }}>
            <thead>
              <tr style={{ background: "#f8fafc", borderBottom: "2px solid #e2e8f0", textAlign: "left" }}>
                <th style={{ padding: "12px 1rem", fontSize: "0.8rem", color: "#64748b" }}>Học Viên</th>
                <th style={{ padding: "12px 1rem", fontSize: "0.8rem", color: "#64748b" }}>Môn Học</th>
                <th style={{ padding: "12px 1rem", fontSize: "0.8rem", color: "#64748b" }}>Thời Gian</th>
                <th style={{ padding: "12px 1rem", fontSize: "0.8rem", color: "#64748b" }}>Phòng / GV</th>
                <th style={{ padding: "12px 1rem", fontSize: "0.8rem", color: "#64748b" }}>Người Đi</th>
                <th style={{ padding: "12px 1rem", fontSize: "0.8rem", color: "#64748b", textAlign: "center" }}>Checkin</th>
                <th style={{ padding: "12px 1rem", fontSize: "0.8rem", color: "#64748b", textAlign: "center" }}>Trạng Thái Học</th>
                <th style={{ padding: "12px 1rem", fontSize: "0.8rem", color: "#64748b" }}>Tiền Thuê (Tip)</th>
                <th style={{ padding: "12px 1rem", fontSize: "0.8rem", color: "#64748b" }}>Gửi Tiền</th>
                <th style={{ padding: "12px 1rem", fontSize: "0.8rem", color: "#64748b" }}>Trả Lương CTV</th>
                <th style={{ padding: "12px 1rem", fontSize: "0.8rem", color: "#64748b", textAlign: "center" }}>Thao Tác</th>
              </tr>
            </thead>
            <tbody>
              {filteredTableList.length === 0 ? (
                <tr>
                  <td colSpan="11" style={{ padding: "3rem", textAlign: "center", color: "var(--text-secondary)" }}>
                    Không tìm thấy lịch học nội bộ phù hợp bộ lọc.
                  </td>
                </tr>
              ) : (
                filteredTableList.map(s => (
                  <tr key={s.id} style={{ borderBottom: "1px solid #e2e8f0" }}>
                    <td style={{ padding: "1rem", fontWeight: "700" }}>{s.studentName}</td>
                    <td style={{ padding: "1rem" }}>{s.subject}</td>
                    <td style={{ padding: "1rem", fontSize: "0.82rem" }}>
                      <div><b>{s.classDate ? new Date(s.classDate).toLocaleDateString("vi-VN") : ""}</b></div>
                      <div style={{ opacity: 0.6, fontSize: "0.75rem" }}>{s.weekday} | Ca {s.period === "sang" ? "Sáng" : s.period === "chieu" ? "Chiều" : "Tối"} ({s.timeSlot || "N/A"})</div>
                    </td>
                    <td style={{ padding: "1rem", fontSize: "0.82rem" }}>
                      <div>Phòng: <b>{s.classroom || "N/A"}</b></div>
                      <div style={{ opacity: 0.6 }}>GV: {s.lecturer || "N/A"}</div>
                    </td>
                    <td style={{ padding: "1rem", fontWeight: "600", color: "#4f46e5" }}>{s.helperName || "Chưa giao"}</td>
                    <td style={{ padding: "1rem", textAlign: "center" }}>
                      <span style={{
                        fontSize: "0.72rem", padding: "4px 8px", borderRadius: "6px", fontWeight: "700",
                        background: s.checkinStatus === "checked_in" ? "#dcfce7" : "#fee2e2",
                        color: s.checkinStatus === "checked_in" ? "#166534" : "#991b1b"
                      }}>
                        {s.checkinStatus === "checked_in" ? "✓ Đã Checkin" : "✗ Chưa"}
                      </span>
                      {s.proofImage && (
                        <div style={{ marginTop: "4px" }}>
                          <span 
                            onClick={() => setLightboxImage(s.proofImage)}
                            style={{ fontSize: "0.72rem", color: "var(--primary)", cursor: "pointer", textDecoration: "underline", fontWeight: "600" }}
                          >
                            📷 Xem ảnh
                          </span>
                        </div>
                      )}
                    </td>
                    <td style={{ padding: "1rem", textAlign: "center" }}>
                      {renderStatusPill(s.studyStatus)}
                    </td>
                    <td style={{ padding: "1rem", fontSize: "0.82rem" }}>
                      <div>{(s.rentAmount || 0).toLocaleString("vi-VN")}đ</div>
                      {s.tipAmount > 0 && <div style={{ color: "#d97706", fontSize: "0.75rem" }}>+Tip: {s.tipAmount.toLocaleString("vi-VN")}đ</div>}
                    </td>
                    <td style={{ padding: "1rem" }}>
                      <span style={{
                        fontSize: "0.72rem", padding: "4px 8px", borderRadius: "6px", fontWeight: "700",
                        ...getStatusBadgeStyle(s.paymentStatus)
                      }}>
                        {s.paymentStatus}
                      </span>
                    </td>
                    <td style={{ padding: "1rem", fontSize: "0.82rem" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                        <span>{(s.salaryAmount || 0).toLocaleString("vi-VN")}đ</span>
                        <span style={{
                          fontSize: "0.72rem", padding: "2px 6px", borderRadius: "6px", fontWeight: "700",
                          ...getStatusBadgeStyle(s.salaryStatus)
                        }}>
                          {s.salaryStatus}
                        </span>
                      </div>
                      {s.staffTipAmount > 0 && <div style={{ color: "#059669", fontSize: "0.75rem", marginTop: "4px" }}>+Tip CTV: {s.staffTipAmount.toLocaleString("vi-VN")}đ</div>}
                    </td>
                    <td style={{ padding: "1rem", textAlign: "center" }}>
                      <div style={{ display: "flex", gap: "6px", justifyContent: "center" }}>
                        <button 
                          onClick={() => openEditModal(s)}
                          style={{ padding: "4px 8px", fontSize: "0.75rem", background: "#f1f5f9", color: "#475569", border: "1px solid #cbd5e1", borderRadius: "6px", cursor: "pointer" }}
                        >
                          Sửa
                        </button>
                        <button 
                          onClick={() => handleDelete(s.id)}
                          style={{ padding: "4px 8px", fontSize: "0.75rem", background: "#fee2e2", color: "#991b1b", border: "1px solid #fca5a5", borderRadius: "6px", cursor: "pointer" }}
                        >
                          Xóa
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* RENDER ANALYTICS VIEW (Financial reports) */}
      {viewMode === "analytics" && (
        renderAnalyticsView()
      )}

      {/* Helper functions are now declared above the return block */}

      {/* FORM MODAL (Add / Edit) */}
      {showModal && (
        <div 
          style={{
            position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
            background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)",
            display: "flex", alignItems: "center", justifyContent: "center",
            zIndex: 1005, padding: "1rem"
          }}
          onClick={() => setShowModal(false)}
        >
          <form 
            onSubmit={handleSave}
            style={{
              background: "white", borderRadius: isMobile ? "16px" : "24px", padding: isMobile ? "1.25rem" : "2rem",
              maxWidth: "680px", width: "100%", maxHeight: "90vh", overflowY: "auto",
              boxShadow: "0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)"
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
              <h3 style={{ margin: 0, fontSize: "1.25rem", fontWeight: "800", color: "var(--text-primary)" }}>
                {isEditing ? "📝 Chỉnh sửa Lịch học Nội Bộ" : "➕ Thêm Lịch học Nội Bộ Mới"}
              </h3>
              <button type="button" onClick={() => setShowModal(false)} style={{ background: "none", border: "none", fontSize: "1.5rem", cursor: "pointer", color: "#64748b" }}>&times;</button>
            </div>

            {/* FORM CONTAINER WITH 2 COLUMNS - RESPONSIVE */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "15px", marginBottom: "1.5rem" }}>
              
              {/* Column 1 */}
              <div>
                <div className="form-group" style={{ marginBottom: "1rem" }}>
                  <label className="form-label" style={{ fontWeight: "700" }}>Tên người học</label>
                  <input
                    type="text"
                    value={formData.studentName}
                    onChange={e => setFormData({ ...formData, studentName: e.target.value })}
                    required
                    placeholder="Ví dụ: Hoàng Xuân Tùng"
                    className="form-input"
                  />
                </div>

                <div className="form-group" style={{ marginBottom: "1rem" }}>
                  <label className="form-label" style={{ fontWeight: "700" }}>Môn học</label>
                  <input
                    type="text"
                    value={formData.subject}
                    onChange={e => setFormData({ ...formData, subject: e.target.value })}
                    required
                    placeholder="Toán cao cấp 3"
                    className="form-input"
                    list="subjects-list"
                  />
                </div>

                <div className="form-group" style={{ marginBottom: "1rem" }}>
                  <label className="form-label" style={{ fontWeight: "700" }}>Ngày học</label>
                  <input
                    type="date"
                    value={formData.classDate}
                    onChange={handleDateChange}
                    required
                    className="form-input"
                  />
                </div>

                <div className="form-group" style={{ marginBottom: "1rem" }}>
                  <label className="form-label" style={{ fontWeight: "700" }}>Thứ trong tuần (Auto)</label>
                  <input
                    type="text"
                    value={formData.weekday || ""}
                    disabled
                    className="form-input"
                    style={{ background: "#f1f5f9" }}
                  />
                </div>

                <div className="form-group" style={{ marginBottom: "1rem" }}>
                  <label className="form-label" style={{ fontWeight: "700" }}>Buổi học (Phân ca lưới)</label>
                  <select
                    value={formData.period}
                    onChange={e => setFormData({ ...formData, period: e.target.value })}
                    className="form-input"
                    style={{ background: "white" }}
                  >
                    <option value="sang">Sáng</option>
                    <option value="chieu">Chiều</option>
                    <option value="toi">Tối</option>
                  </select>
                </div>

                <div className="form-group" style={{ marginBottom: "1rem" }}>
                  <label className="form-label" style={{ fontWeight: "700" }}>Giờ học cụ thể (timeSlot)</label>
                  <input
                    type="text"
                    value={formData.timeSlot}
                    onChange={e => setFormData({ ...formData, timeSlot: e.target.value })}
                    placeholder="Time: 1 - 3 hoặc 07:00 - 11:30"
                    className="form-input"
                  />
                </div>

                <div className="form-group" style={{ marginBottom: "1rem" }}>
                  <label className="form-label" style={{ fontWeight: "700" }}>Phòng học</label>
                  <input
                    type="text"
                    value={formData.classroom}
                    onChange={e => setFormData({ ...formData, classroom: e.target.value })}
                    placeholder="E201"
                    className="form-input"
                    list="classrooms-list"
                  />
                </div>

                <div className="form-group" style={{ marginBottom: "1rem" }}>
                  <label className="form-label" style={{ fontWeight: "700" }}>Giảng viên</label>
                  <input
                    type="text"
                    value={formData.lecturer}
                    onChange={e => setFormData({ ...formData, lecturer: e.target.value })}
                    placeholder="Đặng Thành Trung"
                    className="form-input"
                    list="lecturers-list"
                  />
                </div>
              </div>

              {/* Column 2 */}
              <div>
                <div className="form-group" style={{ marginBottom: "1rem" }}>
                  <label className="form-label" style={{ fontWeight: "700" }}>Người đi học (CTV)</label>
                  <select
                    value={formData.helperName}
                    onChange={e => setFormData({ ...formData, helperName: e.target.value })}
                    className="form-input"
                    style={{ background: "white" }}
                  >
                    <option value="">-- Tự nhập / Chọn CTV --</option>
                    {helpers.map(h => {
                      const isOnline = getHelperShiftStatus(h.email);
                      const typeLabel = h.isManual ? "✍️ [Tự thêm]" : "🛡️ [Đăng ký]";
                      return (
                        <option key={h.id} value={h.alias || h.name}>
                          {isOnline ? "🟢 " : "⚪ "} {typeLabel} {h.alias ? `${h.alias} (${h.name})` : h.name} {isOnline ? "(Đang trực ca)" : ""}
                        </option>
                      );
                    })}
                  </select>
                  {/* Text Input backup if they want to enter a custom helper name */}
                  <input
                    type="text"
                    value={formData.helperName}
                    onChange={e => setFormData({ ...formData, helperName: e.target.value })}
                    placeholder="Nhập/gõ để tìm hoặc thêm CTV mới..."
                    className="form-input"
                    style={{ marginTop: "5px" }}
                    list="helpers-datalist"
                  />
                  <datalist id="helpers-datalist">
                    {helpers.map(h => (
                      <option 
                        key={h.id} 
                        value={h.alias || h.name}
                      >
                        {h.isManual ? "✍️ [Admin tự thêm]" : "🛡️ [Đăng ký]"}
                      </option>
                    ))}
                  </datalist>

                  {/* Manually added CTV chips with X delete buttons */}
                  {helpers.filter(h => h.isManual).length > 0 && (
                    <div style={{ marginTop: "8px" }}>
                      <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)", fontWeight: "600", marginBottom: "4px" }}>
                        📌 Danh sách CTV tự thêm (Click để chọn nhanh, click đúp để sửa, bấm x để xóa):
                      </div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                        {helpers.filter(h => h.isManual).map(h => (
                          <div 
                            key={h.id}
                            onDoubleClick={() => handleEditManualHelper(h.id, h.name, h.alias)}
                            onClick={() => setFormData(prev => ({ ...prev, helperName: h.alias || h.name }))}
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "5px",
                              background: "#f3e8ff",
                              color: "#6b21a8",
                              fontSize: "0.78rem",
                              fontWeight: "700",
                              padding: "4px 10px",
                              borderRadius: "20px",
                              border: "1px solid #e9d5ff",
                              cursor: "pointer",
                              transition: "all 0.2s"
                            }}
                            title="Nhấp đúp để chỉnh sửa tên CTV này"
                          >
                            <span>{h.alias || h.name}</span>
                            <span 
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteManualHelper(h.id, h.alias || h.name);
                              }}
                              style={{
                                color: "#b91c1c",
                                fontWeight: "800",
                                fontSize: "0.9rem",
                                padding: "0 2px",
                                cursor: "pointer",
                                marginLeft: "2px"
                              }}
                              title="Xóa CTV này"
                            >
                              &times;
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="form-group" style={{ marginBottom: "1rem" }}>
                  <label className="form-label" style={{ fontWeight: "700" }}>Trạng thái checkin</label>
                  <select
                    value={formData.checkinStatus}
                    onChange={e => setFormData({ ...formData, checkinStatus: e.target.value })}
                    className="form-input"
                    style={{ background: "white" }}
                  >
                    <option value="not_checked_in">Chưa checkin</option>
                    <option value="checked_in">Đã checkin ✓</option>
                  </select>
                </div>

                <div className="form-group" style={{ marginBottom: "1rem" }}>
                  <label className="form-label" style={{ fontWeight: "700" }}>Trạng thái học (studyStatus)</label>
                  <select
                    value={formData.studyStatus}
                    onChange={e => setFormData({ ...formData, studyStatus: e.target.value })}
                    className="form-input"
                    style={{ background: "white" }}
                  >
                    {Object.keys(studyStatuses).map(k => (
                      <option key={k} value={k}>{studyStatuses[k].label}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group" style={{ marginBottom: "1rem" }}>
                  <label className="form-label" style={{ fontWeight: "700" }}>Tiền thuê học (rentAmount)</label>
                  <input
                    type="text"
                    value={formData.rentAmount}
                    onChange={e => setFormData({ ...formData, rentAmount: e.target.value.replace(/\D/g, "") })}
                    placeholder="Ví dụ: 100000"
                    className="form-input"
                  />
                  {formData.rentAmount && (
                    <div style={{ fontSize: "0.75rem", color: "var(--success)", marginTop: "4px", fontWeight: "600" }}>
                      Hiển thị: {Number(formData.rentAmount).toLocaleString("vi-VN")}đ
                    </div>
                  )}
                </div>

                <div className="form-group" style={{ marginBottom: "1rem" }}>
                  <label className="form-label" style={{ fontWeight: "700" }}>Tiền tip kiểm tra/thuyết trình (tipAmount)</label>
                  <input
                    type="text"
                    value={formData.tipAmount}
                    onChange={e => setFormData({ ...formData, tipAmount: e.target.value.replace(/\D/g, "") })}
                    placeholder="Ví dụ: 30000"
                    className="form-input"
                  />
                  {formData.tipAmount && (
                    <div style={{ fontSize: "0.75rem", color: "var(--success)", marginTop: "4px", fontWeight: "600" }}>
                      Hiển thị: {Number(formData.tipAmount).toLocaleString("vi-VN")}đ
                    </div>
                  )}
                </div>

                <div className="form-group" style={{ marginBottom: "1rem" }}>
                  <label className="form-label" style={{ fontWeight: "700" }}>Trạng thái gửi tiền người thuê</label>
                  <select
                    value={formData.paymentStatus}
                    onChange={e => setFormData({ ...formData, paymentStatus: e.target.value })}
                    className="form-input"
                    style={{ background: "white" }}
                  >
                    <option value="ChưaTT">Chưa thanh toán</option>
                    <option value="Đã thanh toán">Đã thanh toán ✓</option>
                  </select>
                </div>

                <div className="form-group" style={{ marginBottom: "1rem" }}>
                  <label className="form-label" style={{ fontWeight: "700" }}>Tiền trả lương CTV</label>
                  <input
                    type="text"
                    value={formData.salaryAmount}
                    onChange={e => setFormData({ ...formData, salaryAmount: e.target.value.replace(/\D/g, "") })}
                    placeholder="Ví dụ: 75000"
                    className="form-input"
                  />
                  {formData.salaryAmount && (
                    <div style={{ fontSize: "0.75rem", color: "var(--success)", marginTop: "4px", fontWeight: "600" }}>
                      Hiển thị: {Number(formData.salaryAmount).toLocaleString("vi-VN")}đ
                    </div>
                  )}
                </div>

                <div className="form-group" style={{ marginBottom: "1rem" }}>
                  <label className="form-label" style={{ fontWeight: "700" }}>Trạng thái trả lương CTV</label>
                  <select
                    value={formData.salaryStatus}
                    onChange={e => setFormData({ ...formData, salaryStatus: e.target.value })}
                    className="form-input"
                    style={{ background: "white" }}
                  >
                    <option value="ChưaTL">Chưa trả lương</option>
                    <option value="Đã trả lương">Đã trả lương ✓</option>
                  </select>
                </div>

                <div className="form-group" style={{ marginBottom: "1rem" }}>
                  <label className="form-label" style={{ fontWeight: "700" }}>Tiền tip cho nhân viên/CTV</label>
                  <input
                    type="text"
                    value={formData.staffTipAmount}
                    onChange={e => setFormData({ ...formData, staffTipAmount: e.target.value.replace(/\D/g, "") })}
                    placeholder="Ví dụ: 15000"
                    className="form-input"
                  />
                  {formData.staffTipAmount && (
                    <div style={{ fontSize: "0.75rem", color: "var(--success)", marginTop: "4px", fontWeight: "600" }}>
                      Hiển thị: {Number(formData.staffTipAmount).toLocaleString("vi-VN")}đ
                    </div>
                  )}
                </div>
              </div>

            </div>

            {/* Form footer actions */}
            <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end", borderTop: "1px solid #e2e8f0", paddingTop: "1.25rem" }}>
              <button 
                type="button" 
                onClick={() => setShowModal(false)}
                className="btn"
                style={{ background: "#f1f5f9", color: "var(--text-secondary)", border: "1px solid #cbd5e1" }}
              >
                Hủy bỏ
              </button>
              {isEditing && (
                <>
                  <button 
                    type="button"
                    onClick={handleDuplicateToNextWeek}
                    className="btn"
                    style={{ background: "#4f46e5", color: "white", fontWeight: "700" }}
                  >
                    👯 Nhân bản ca tuần sau
                  </button>
                  <button 
                    type="button"
                    onClick={() => handleDelete(editingId)}
                    className="btn btn-danger"
                    style={{ background: "#ef4444", color: "white" }}
                  >
                    Xóa Lịch Học
                  </button>
                </>
              )}
              <button 
                type="submit"
                className="btn btn-primary"
              >
                Lưu Thay Đổi
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Autocomplete Datalists gợi ý nhập liệu */}
      <datalist id="subjects-list">
        {uniqueSubjects.map((s, idx) => <option key={idx} value={s} />)}
      </datalist>
      <datalist id="classrooms-list">
        {uniqueClassrooms.map((c, idx) => <option key={idx} value={c} />)}
      </datalist>
      <datalist id="lecturers-list">
        {uniqueLecturers.map((l, idx) => <option key={idx} value={l} />)}
      </datalist>
    </div>
  );
}

export default function InternalSchedulesPage() {
  return (
    <Suspense fallback={
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "100vh", background: "#f8fafc" }}>
        Đang tải trang quản lý lịch...
      </div>
    }>
      <InternalSchedulesManager />
    </Suspense>
  );
}
