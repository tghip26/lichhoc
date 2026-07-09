"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import AdminGuard from "@/components/AdminGuard";
import { db } from "@/lib/firebase";
import { collection, query, orderBy, onSnapshot, doc, updateDoc, deleteDoc, setDoc, increment, addDoc, serverTimestamp } from "firebase/firestore";
import Link from "next/link";
import toast from "react-hot-toast";
import { useAuth } from "@/context/AuthContext";

function AdminDashboard() {
  const { systemSettings, sendTelegramAlert } = useAuth();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab");

  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [transFilterStatus, setTransFilterStatus] = useState("all");
  const [helperFilterStatus, setHelperFilterStatus] = useState("all");
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
    if (tabParam) {
      setActiveTab(tabParam);
    }
  }, [tabParam]);

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

    // Lấy dữ liệu giao dịch nạp ví (Sắp xếp thời gian mới nhất trực tiếp trên máy chủ)
    const qTrans = query(collection(db, "transactions"), orderBy("createdAt", "desc"));
    const unsubscribeTrans = onSnapshot(qTrans, (snapshot) => {
      const tData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setTransactions(tData);
    }, (err) => console.error("Lỗi lấy transactions:", err));

    return () => { unsubscribeSchedules(); unsubscribeUsers(); unsubscribeHelpers(); unsubscribeTrans(); };
  }, []);

  const handleUpdateStatus = async (id, newStatus) => {
    let statusText = "thay đổi trạng thái";
    if (newStatus === "accepted") statusText = "DUYỆT lịch học (Sắp học)";
    if (newStatus === "completed") statusText = "đánh dấu HOÀN THÀNH lịch học";
    if (newStatus === "rejected") statusText = "TỪ CHỐI lịch học";
    if (newStatus === "in_progress") statusText = "chuyển sang Đang học";
    if (newStatus === "paid") statusText = "xác nhận Đã thanh toán";

    if (!confirm(`Bạn có chắc chắn muốn ${statusText}?`)) {
      return;
    }
    try {
      const schedule = schedules.find(s => s.id === id);
      await updateDoc(doc(db, "schedules", id), { status: newStatus });
      toast.success("Cập nhật trạng thái thành công");

      // Tự động chuyển thù lao vào ví CTV khi đơn hoàn thành
      if (newStatus === "completed" && schedule && schedule.helperId) {
        const priceNum = schedule.price ? Number(String(schedule.price).replace(/\./g, "")) : 0;
        const payoutVal = schedule.payoutAmount !== undefined ? Number(schedule.payoutAmount) : Math.floor(priceNum * 0.75);

        // Cộng thù lao vào ví CTV (helperBalance)
        await updateDoc(doc(db, "users", schedule.helperId), {
          helperBalance: increment(payoutVal)
        });

        // Tạo lịch sử giao dịch payout_earn
        await addDoc(collection(db, "transactions"), {
          userId: schedule.helperId,
          userEmail: schedule.assignedTo || "ctv",
          amount: payoutVal,
          type: "payout_earn",
          status: "completed",
          message: `Nhận thù lao trực lớp ${schedule.className} ngày ${new Date(schedule.classDate).toLocaleDateString("vi-VN")}`,
          createdAt: serverTimestamp()
        });

        // Tạo thông báo cho CTV
        await addDoc(collection(db, "notifications"), {
          userId: schedule.helperId,
          title: "Nhận thù lao trực lớp thành công 💰",
          message: `Ví thù lao CTV của bạn đã được cộng +${payoutVal.toLocaleString("vi-VN")} đ cho ca trực môn ${schedule.className}.`,
          read: false,
          link: "/dashboard",
          createdAt: serverTimestamp()
        });

        toast.info(`Đã tự động chuyển +${payoutVal.toLocaleString("vi-VN")} đ thù lao vào ví CTV ${schedule.assignedTo}!`);

        // Gửi thông báo Telegram cho Admin
        try {
          await sendTelegramAlert(`✅ <b>ĐÃ DUYỆT HOÀN THÀNH & PHÁT THÙ LAO CTV!</b>\n\n` +
            `• <b>Lớp học:</b> ${schedule.className}\n` +
            `• <b>CTV phụ trách:</b> ${schedule.assignedTo}\n` +
            `• <b>Thù lao đã cộng:</b> +${payoutVal.toLocaleString("vi-VN")} đ`);
        } catch (tgErr) {
          console.warn("Lỗi gửi thông báo Telegram:", tgErr);
        }
      }

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
            link: `/dashboard?tab=schedules`,
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

  const handleSetUserAlias = async (uid, alias) => {
    try {
      await updateDoc(doc(db, "users", uid), { alias: alias.trim() });
      toast.success("Đã cập nhật tên gợi nhớ!");
    } catch (err) {
      console.error("Lỗi cập nhật biệt danh:", err);
      toast.error("Không thể cập nhật tên gợi nhớ.");
    }
  };

  const handleSetHelperAlias = async (id, alias) => {
    try {
      await updateDoc(doc(db, "helpers", id), { alias: alias.trim() });
      toast.success("Đã cập nhật tên gợi nhớ cho CTV!");
    } catch (err) {
      console.error("Lỗi cập nhật biệt danh CTV:", err);
      toast.error("Không thể cập nhật tên gợi nhớ cho CTV.");
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
    const actionText = newStatus === "approved" ? "PHÊ DUYỆT" : "TỪ CHỐI";
    if (!confirm(`Bạn có chắc chắn muốn ${actionText} cộng tác viên này không?`)) {
      return;
    }
    try {
      await updateDoc(doc(db, "helpers", id), {
        status: newStatus,
        isApproved: newStatus === "approved"
      });

      // Tự động đồng bộ quyền người dùng trong collection 'users'
      const helperDoc = helpers.find(h => h.id === id);
      if (helperDoc && helperDoc.email) {
        const matchedUser = users.find(u => u.email?.toLowerCase() === helperDoc.email.toLowerCase());
        if (matchedUser) {
          await updateDoc(doc(db, "users", matchedUser.id), {
            role: newStatus === "approved" ? "helper" : "user"
          });
        }
      }

      toast.success("Đã cập nhật trạng thái CTV & Đồng bộ quyền!");
    } catch (err) {
      console.error("Lỗi cập nhật CTV:", err);
      toast.error("Không thể cập nhật CTV");
    }
  };

  const handleDeleteHelper = async (id) => {
    if (confirm("Chắc chắn muốn xóa hồ sơ CTV này?")) {
      try {
        const helperDoc = helpers.find(h => h.id === id);
        if (helperDoc && helperDoc.email) {
          const matchedUser = users.find(u => u.email?.toLowerCase() === helperDoc.email.toLowerCase());
          if (matchedUser) {
            await updateDoc(doc(db, "users", matchedUser.id), {
              role: "user"
            });
          }
        }
        await deleteDoc(doc(db, "helpers", id));
        toast.success("Đã xóa hồ sơ CTV và hoàn trả quyền!");
      } catch (err) {
        console.error("Lỗi xóa hồ sơ CTV:", err);
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
        link: "/dashboard?tab=wallet",
        createdAt: serverTimestamp()
      });
    } catch (err) {
      console.error("Lỗi điều chỉnh ví:", err);
      toast.error("Không thể điều chỉnh ví.");
    }
  };

  const handleApproveTransaction = async (trans) => {
    const isPayout = trans.type === "payout_request";
    const actionName = isPayout ? "duyệt RÚT THÙ LAO" : "DUYỆT nạp";
    if (!confirm(`Bạn chắc chắn muốn ${actionName} số tiền ${trans.amount.toLocaleString("vi-VN")} đ cho tài khoản ${trans.userEmail}?`)) {
      return;
    }
    try {
      await updateDoc(doc(db, "transactions", trans.id), { status: "completed" });
      
      if (isPayout) {
        await addDoc(collection(db, "notifications"), {
          userId: trans.userId,
          title: "Rút thù lao thành công 💰",
          message: `Yêu cầu rút thù lao ${trans.amount.toLocaleString("vi-VN")} đ đã được chuyển khoản và duyệt thành công.`,
          read: false,
          link: "/dashboard",
          createdAt: serverTimestamp()
        });
        toast.success("Đã duyệt yêu cầu rút thù lao!");

        try {
          await sendTelegramAlert(`✅ <b>ĐÃ DUYỆT RÚT THÙ LAO CTV!</b>\n\n• <b>Tài khoản:</b> ${trans.userEmail}\n• <b>Số tiền:</b> ${trans.amount.toLocaleString("vi-VN")} đ\n• <b>Trạng thái:</b> Thành công (Đã chuyển khoản)`);
        } catch (tgErr) {
          console.warn("Lỗi gửi thông báo Telegram:", tgErr);
        }
      } else {
        await updateDoc(doc(db, "users", trans.userId), {
          balance: increment(trans.amount)
        });

        await addDoc(collection(db, "notifications"), {
          userId: trans.userId,
          title: "Nạp tiền ví thành công",
          message: `Yêu cầu nạp ví ${trans.amount.toLocaleString("vi-VN")} đ của bạn đã được duyệt thành công.`,
          read: false,
          link: "/dashboard?tab=wallet",
          createdAt: serverTimestamp()
        });
        toast.success("Đã phê duyệt và cộng tiền ví thành công!");
      }
    } catch (err) {
      console.error("Lỗi duyệt giao dịch:", err);
      toast.error("Không thể duyệt giao dịch.");
    }
  };

  const handleRejectTransaction = async (trans) => {
    const isPayout = trans.type === "payout_request";
    const actionName = isPayout ? "từ chối RÚT THÙ LAO" : "TỪ CHỐI nạp";
    if (!confirm(`Bạn chắc chắn muốn ${actionName} số tiền ${trans.amount.toLocaleString("vi-VN")} đ của tài khoản ${trans.userEmail}?`)) {
      return;
    }
    try {
      await updateDoc(doc(db, "transactions", trans.id), { status: "rejected" });

      if (isPayout) {
        await updateDoc(doc(db, "users", trans.userId), {
          helperBalance: increment(trans.amount)
        });

        await addDoc(collection(db, "notifications"), {
          userId: trans.userId,
          title: "Yêu cầu rút thù lao bị từ chối ❌",
          message: `Yêu cầu rút thù lao ${trans.amount.toLocaleString("vi-VN")} đ đã bị từ chối. Số tiền đã hoàn lại ví thù lao của bạn.`,
          read: false,
          link: "/dashboard",
          createdAt: serverTimestamp()
        });
        toast.success("Đã từ chối và hoàn tiền thù lao về ví CTV!");

        try {
          await sendTelegramAlert(`❌ <b>ĐÃ TỪ CHỐI RÚT THÙ LAO CTV!</b>\n\n• <b>Tài khoản:</b> ${trans.userEmail}\n• <b>Số tiền:</b> ${trans.amount.toLocaleString("vi-VN")} đ\n• <b>Trạng thái:</b> Đã từ chối & hoàn thù lao về ví`);
        } catch (tgErr) {
          console.warn("Lỗi gửi thông báo Telegram:", tgErr);
        }
      } else {
        await addDoc(collection(db, "notifications"), {
          userId: trans.userId,
          title: "Yêu cầu nạp ví bị từ chối",
          message: `Yêu cầu nạp ví ${trans.amount.toLocaleString("vi-VN")} đ đã bị từ chối do không khớp sao kê ngân hàng.`,
          read: false,
          link: "/dashboard?tab=wallet",
          createdAt: serverTimestamp()
        });
        toast.success("Đã từ chối yêu cầu nạp tiền.");
      }
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

  const handleExportUsersCSV = () => {
    if (users.length === 0) {
      toast.error("Không có dữ liệu người dùng để xuất");
      return;
    }
    const headers = ["Email", "Tên hiển thị", "Tên gợi nhớ (Biệt danh)", "Số điện thoại", "Số dư Ví (VNĐ)", "Quyền hạn", "Hoạt động cuối"];
    const csvContent = [
      headers.join(","),
      ...users.map(u => {
        const lastLoginStr = u.lastLogin ? new Date(u.lastLogin.toDate()).toLocaleString("vi-VN") : "Chưa rõ";
        return [
          `"${u.email || ""}"`,
          `"${u.displayName || ""}"`,
          `"${u.alias || ""}"`,
          `"${u.phone || ""}"`,
          `"${u.balance || 0}"`,
          `"${u.role === "admin" ? "Quản trị viên" : "Khách hàng"}"`,
          `"${lastLoginStr}"`
        ].join(",");
      })
    ].join("\n");

    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `danh_sach_thanh_vien_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportHelpersCSV = () => {
    if (helpers.length === 0) {
      toast.error("Không có dữ liệu CTV để xuất");
      return;
    }
    const headers = ["Họ và Tên", "MSSV", "Trường", "Lớp", "Email", "Số điện thoại", "Giờ rảnh", "Trạng thái hồ sơ"];
    const csvContent = [
      headers.join(","),
      ...helpers.map(h => {
        const statusStr = h.status === "approved" ? "Đã duyệt" : (h.status === "rejected" ? "Từ chối" : "Chờ duyệt");
        return [
          `"${h.name || ""}"`,
          `"${h.studentId || ""}"`,
          `"${h.school || ""}"`,
          `"${h.className || ""}"`,
          `"${h.email || ""}"`,
          `"${h.phone || ""}"`,
          `"${h.availability || ""}"`,
          `"${statusStr}"`
        ].join(",");
      })
    ].join("\n");

    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `danh_sach_ctv_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportTransactionsCSV = () => {
    if (transactions.length === 0) {
      toast.error("Không có dữ liệu giao dịch để xuất");
      return;
    }
    const headers = ["Khách hàng", "Số tiền (VNĐ)", "Loại giao dịch", "Nội dung", "Thời gian", "Trạng thái"];
    const csvContent = [
      headers.join(","),
      ...transactions.map(t => {
        const typeStr = t.type === "payment" ? "Thanh toán đơn" : "Nạp tiền";
        const statusStr = t.status === "pending" ? "Chờ duyệt" : (t.status === "completed" ? "Thành công" : "Đã từ chối");
        const dateStr = t.createdAt ? new Date(t.createdAt.toDate()).toLocaleString("vi-VN") : "";
        return [
          `"${t.userEmail || ""}"`,
          `"${t.amount || 0}"`,
          `"${typeStr}"`,
          `"${t.message || ""}"`,
          `"${dateStr}"`,
          `"${statusStr}"`
        ].join(",");
      })
    ].join("\n");

    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `lich_su_giao_dich_${new Date().toISOString().split("T")[0]}.csv`);
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

  const filteredUsers = users.filter(u => {
    const query = searchQuery.toLowerCase();
    return (
      (u.email && u.email.toLowerCase().includes(query)) ||
      (u.displayName && u.displayName.toLowerCase().includes(query)) ||
      (u.phone && u.phone.includes(query)) ||
      (u.alias && u.alias.toLowerCase().includes(query))
    );
  });

  const filteredTransactions = transactions.filter(t => {
    const query = searchQuery.toLowerCase();
    const matchesSearch = 
      (t.userEmail && t.userEmail.toLowerCase().includes(query)) || 
      (t.message && t.message.toLowerCase().includes(query)) ||
      (t.userId && t.userId.toLowerCase().includes(query));
    const matchesStatus = transFilterStatus === "all" || t.status === transFilterStatus;
    return matchesSearch && matchesStatus;
  });

  const filteredHelpers = helpers.filter(h => {
    const query = searchQuery.toLowerCase();
    const matchesSearch = 
      (h.name && h.name.toLowerCase().includes(query)) ||
      (h.alias && h.alias.toLowerCase().includes(query)) ||
      (h.email && h.email.toLowerCase().includes(query)) ||
      (h.phone && h.phone.includes(query)) ||
      (h.school && h.school.toLowerCase().includes(query)) ||
      (h.className && h.className.toLowerCase().includes(query));
    const matchesStatus = helperFilterStatus === "all" || 
                          (helperFilterStatus === "pending" && h.status !== "approved" && h.status !== "rejected") ||
                          h.status === helperFilterStatus;
    return matchesSearch && matchesStatus;
  });

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
            <svg style={{ width: "18px", height: "18px", inlineSize: "18px", verticalAlign: "middle", marginRight: "6px" }} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M12 16v1m4 2H8a2 2 0 01-2-2V8a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 012 2z"></path></svg>
            Duyệt Nạp Ví
          </button>
          <button 
            onClick={() => setActiveTab("settings")}
            style={{ flexShrink: 0, padding: "0.6rem 1.5rem", border: "none", background: activeTab === "settings" ? "var(--primary)" : "transparent", color: activeTab === "settings" ? "white" : "var(--text-secondary)", borderRadius: "8px", fontWeight: "600", cursor: "pointer", transition: "all 0.2s", boxShadow: activeTab === "settings" ? "0 4px 12px rgba(22, 163, 74, 0.3)" : "none" }}
          >
            <svg style={{ width: "18px", height: "18px", inlineSize: "18px", verticalAlign: "middle", marginRight: "6px" }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path><circle cx="12" cy="12" r="3" strokeWidth="2"></circle></svg>
            Cấu hình hệ thống
          </button>
          
          <Link 
            href="/admin/thong-ke"
            style={{ 
              flexShrink: 0, padding: "0.6rem 1.5rem", border: "1px solid var(--primary)", background: "transparent", color: "var(--primary)", borderRadius: "8px", fontWeight: "700", cursor: "pointer", transition: "all 0.2s", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: "6px"
            }}
            onMouseOver={e => { e.currentTarget.style.background = "var(--primary)"; e.currentTarget.style.color = "white"; }}
            onMouseOut={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--primary)"; }}
          >
            📊 Thống kê tài chính
          </Link>
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
                <option value="proof_submitted">Chờ duyệt minh chứng</option>
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
                  style={{ background: viewMode === "grid" ? "var(--primary-light)" : "transparent", color: viewMode === "grid" ? "var(--primary)" : "var(--text-secondary)", border: "none", padding: "0.5rem 1.25rem", borderRadius: "6px", cursor: "pointer", fontWeight: "600", transition: "all 0.2s" }}
                >
                  Lưới
                </button>
                <button 
                  onClick={() => setViewMode("list")}
                  style={{ background: viewMode === "list" ? "var(--primary-light)" : "transparent", color: viewMode === "list" ? "var(--primary)" : "var(--text-secondary)", border: "none", padding: "0.5rem 1.25rem", borderRadius: "6px", cursor: "pointer", fontWeight: "600", transition: "all 0.2s" }}
                >
                  Danh sách
                </button>
                <button 
                  onClick={() => setViewMode("calendar")}
                  style={{ background: viewMode === "calendar" ? "var(--primary-light)" : "transparent", color: viewMode === "calendar" ? "var(--primary)" : "var(--text-secondary)", border: "none", padding: "0.5rem 1.25rem", borderRadius: "6px", cursor: "pointer", fontWeight: "600", transition: "all 0.2s" }}
                >
                  Lịch tháng
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
                      background: item.status === "completed" ? "rgba(139, 92, 246, 0.15)" : item.status === "proof_submitted" ? "rgba(217, 119, 6, 0.15)" : item.status === "in_progress" ? "rgba(59, 130, 246, 0.15)" : item.status === "accepted" ? "rgba(16, 185, 129, 0.15)" : item.status === "rejected" ? "rgba(239, 68, 68, 0.15)" : item.status === "paid" ? "rgba(236, 72, 153, 0.15)" : "rgba(245, 158, 11, 0.15)",
                      color: item.status === "completed" ? "#8B5CF6" : item.status === "proof_submitted" ? "#D97706" : item.status === "in_progress" ? "#3B82F6" : item.status === "accepted" ? "var(--success)" : item.status === "rejected" ? "var(--danger)" : item.status === "paid" ? "#EC4899" : "#D97706",
                      boxShadow: "0 2px 4px rgba(0,0,0,0.05)"
                    }}
                  >
                    <option value="pending" style={{color: "black"}}>Chờ nhận đơn</option>
                    <option value="paid" style={{color: "black"}}>Đã thanh toán</option>
                    <option value="accepted" style={{color: "black"}}>Sắp học</option>
                    <option value="in_progress" style={{color: "black"}}>Đang học</option>
                    <option value="proof_submitted" style={{color: "black"}}>Chờ duyệt minh chứng</option>
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
                  
                  {item.helperProofImage && (
                    <div style={{ marginTop: "10px", background: "rgba(79,70,229,0.05)", padding: "8px", borderRadius: "10px", border: "1px solid rgba(79,70,229,0.1)", textAlign: "left" }}>
                      <span style={{ fontSize: "0.72rem", color: "#4F46E5", fontWeight: "700", display: "block", marginBottom: "4px" }}>📸 Minh chứng hoàn thành từ CTV:</span>
                      <img 
                        src={item.helperProofImage} 
                        alt="Ảnh minh chứng hoàn thành" 
                        style={{ width: "100%", height: "80px", objectFit: "cover", borderRadius: "8px", cursor: "pointer", border: "1px solid #cbd5e1" }}
                        onClick={() => setLightboxImage(item.helperProofImage)}
                      />
                      {item.status === "proof_submitted" && (
                        <button
                          type="button"
                          onClick={() => handleUpdateStatus(item.id, "completed")}
                          className="btn"
                          style={{ width: "100%", padding: "4px 8px", fontSize: "0.72rem", borderRadius: "6px", background: "var(--success)", border: "none", color: "white", fontWeight: "700", marginTop: "6px", cursor: "pointer" }}
                        >
                          ✓ Duyệt & Trả Thù Lao
                        </button>
                      )}
                    </div>
                  )}
                  
                  <div style={{ marginTop: "10px", borderTop: "1px dashed rgba(0,0,0,0.05)", paddingTop: "8px" }}>
                    <label style={{ fontSize: "0.72rem", fontWeight: "700", color: "#8B5CF6", display: "block", marginBottom: "4px" }}>GIAO LỊCH HỌC HỘ:</label>
                    <select
                      value={item.assignedTo || ""}
                      onChange={(e) => handleAssignHelper(item.id, e.target.value)}
                      className="form-input"
                      style={{ padding: "4px 8px", fontSize: "0.8rem", height: "auto", background: "white", cursor: "pointer", borderRadius: "8px", border: "1px solid #cbd5e1" }}
                    >
                      <option value="">-- Chưa giao việc --</option>
                      {helpers.filter(h => h.status === 'approved').map(h => (
                        <option key={h.id} value={h.name}>{h.alias ? `${h.alias} (${h.name})` : h.name} ({h.school})</option>
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
        ) : viewMode === "list" ? (
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
                        <span style={{color: "var(--primary)", fontWeight: "600"}}>{item.userEmail || "Không xác định"}</span>
                        {(() => {
                          const userDoc = users.find(u => u.id === item.userId);
                          return userDoc?.alias ? (
                            <div style={{ fontSize: "0.78rem", color: "#8B5CF6", fontWeight: "700", marginTop: "2px", marginBottom: "4px" }}>
                              🏷️ Tên gợi nhớ: {userDoc.alias}
                            </div>
                          ) : null;
                        })()}<br/>
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
                               <option key={h.id} value={h.name}>{h.alias ? `${h.alias} (${h.name})` : h.name}</option>
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
                          background: item.status === "completed" ? "rgba(139, 92, 246, 0.15)" : item.status === "proof_submitted" ? "rgba(217, 119, 6, 0.15)" : item.status === "in_progress" ? "rgba(59, 130, 246, 0.15)" : item.status === "accepted" ? "rgba(16, 185, 129, 0.15)" : item.status === "rejected" ? "rgba(239, 68, 68, 0.15)" : item.status === "paid" ? "rgba(236, 72, 153, 0.15)" : "rgba(245, 158, 11, 0.15)",
                          color: item.status === "completed" ? "#8B5CF6" : item.status === "proof_submitted" ? "#D97706" : item.status === "in_progress" ? "#3B82F6" : item.status === "accepted" ? "var(--success)" : item.status === "rejected" ? "var(--danger)" : item.status === "paid" ? "#EC4899" : "#D97706"
                        }}
                      >
                        <option value="pending" style={{color: "black"}}>Chờ nhận</option>
                        <option value="paid" style={{color: "black"}}>Đã thanh toán</option>
                        <option value="accepted" style={{color: "black"}}>Sắp học</option>
                        <option value="in_progress" style={{color: "black"}}>Đang học</option>
                        <option value="proof_submitted" style={{color: "black"}}>Chờ duyệt minh chứng</option>
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
        ) : (
          /* CALENDAR VIEW */
          <AdminCalendarView 
            schedules={sortedSchedules} 
            users={users} 
            handleUpdateStatus={handleUpdateStatus} 
            handleAssignHelper={handleAssignHelper} 
            helpers={helpers} 
            setLightboxImage={setLightboxImage} 
          />
        )}
        </>
        )}

        {/* BẢNG QUẢN LÝ NGƯỜI DÙNG */}
        {activeTab === "users" && (
          <>
            {/* Toolbar cho Users */}
            <div className="glass-panel" style={{ padding: "1.5rem", marginBottom: "2rem" }}>
              <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center" }}>
                <input 
                  type="text" 
                  placeholder="Tìm email, tên, biệt danh hoặc SĐT..." 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="form-input"
                  style={{ flex: 1, maxWidth: "400px", background: "white" }}
                />
                <button onClick={handleExportUsersCSV} className="btn" style={{ background: "white", color: "var(--success)", border: "1px solid var(--success)", padding: "0.6rem 1.2rem", boxShadow: "none" }}>
                  📥 Xuất Excel
                </button>
              </div>
            </div>

            {/* Thống kê Users */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "1.5rem", marginBottom: "2rem" }}>
              <div className="glass-panel" style={{ display: "flex", alignItems: "center", gap: "1rem", padding: "1.5rem", borderLeft: "4px solid var(--primary)", background: "white", borderRadius: "16px" }}>
                <div style={{ fontSize: "2rem", color: "var(--primary)" }}>👥</div>
                <div style={{ textAlign: "left" }}>
                  <div style={{ fontSize: "0.85rem", color: "var(--text-secondary)", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.5px" }}>Tổng số tài khoản</div>
                  <div style={{ fontSize: "1.5rem", fontWeight: "800", color: "var(--text-primary)", marginTop: "4px" }}>
                    {users.length} <span style={{ fontSize: "0.9rem", fontWeight: "500", color: "var(--text-secondary)" }}>tài khoản</span>
                  </div>
                </div>
              </div>
              <div className="glass-panel" style={{ display: "flex", alignItems: "center", gap: "1rem", padding: "1.5rem", borderLeft: "4px solid #10B981", background: "white", borderRadius: "16px" }}>
                <div style={{ fontSize: "2rem", color: "#10B981" }}>💰</div>
                <div style={{ textAlign: "left" }}>
                  <div style={{ fontSize: "0.85rem", color: "var(--text-secondary)", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.5px" }}>Tổng số dư ví</div>
                  <div style={{ fontSize: "1.5rem", fontWeight: "800", color: "#10B981", marginTop: "4px" }}>
                    {users.reduce((sum, u) => sum + (u.balance || 0), 0).toLocaleString("vi-VN")} <span style={{ fontSize: "0.9rem", fontWeight: "500", color: "var(--text-secondary)" }}>VNĐ</span>
                  </div>
                </div>
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
                          <div style={{ display: "flex", flexDirection: "column" }}>
                            <div style={{ fontWeight: 700, color: "var(--text-primary)" }}>
                              {u.displayName || "Khách"}
                            </div>
                            {u.alias && (
                              <div style={{ fontSize: "0.78rem", color: "#8B5CF6", fontWeight: "600", marginTop: "2px" }}>
                                🏷️ {u.alias}
                              </div>
                            )}
                            <button 
                              onClick={() => {
                                const newAlias = prompt(`Nhập tên gợi nhớ (biệt danh) cho tài khoản ${u.displayName || u.email}:`, u.alias || "");
                                if (newAlias !== null) {
                                  handleSetUserAlias(u.id, newAlias);
                                }
                              }}
                              style={{ background: "none", border: "none", color: "var(--primary)", fontSize: "0.72rem", cursor: "pointer", textDecoration: "underline", padding: 0, width: "fit-content", textAlign: "left", marginTop: "4px" }}
                            >
                              {u.alias ? "Sửa tên gợi nhớ" : "Đặt tên gợi nhớ"}
                            </button>
                          </div>
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
            {/* Toolbar cho CTV */}
            <div className="glass-panel" style={{ padding: "1.5rem", marginBottom: "2rem" }}>
              <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ display: "flex", gap: "1rem", flex: 1, minWidth: "250px" }}>
                  <input 
                    type="text" 
                    placeholder="Tìm tên, trường, email, SĐT..." 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="form-input"
                    style={{ flex: 1, minWidth: "200px", background: "white" }}
                  />
                  <select
                    value={helperFilterStatus}
                    onChange={(e) => setHelperFilterStatus(e.target.value)}
                    className="form-input"
                    style={{ width: "180px", background: "white" }}
                  >
                    <option value="all">Tất cả CTV</option>
                    <option value="pending">Chờ phê duyệt</option>
                    <option value="approved">Đã duyệt</option>
                    <option value="rejected">Từ chối</option>
                  </select>
                </div>
                <button onClick={handleExportHelpersCSV} className="btn" style={{ background: "white", color: "var(--success)", border: "1px solid var(--success)", padding: "0.6rem 1.2rem", boxShadow: "none" }}>
                  📥 Xuất Excel
                </button>
              </div>
            </div>

            {/* Thống kê CTV */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "1.25rem", marginBottom: "2rem" }}>
              <div className="glass-panel" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "1.25rem", borderLeft: "4px solid var(--primary)", background: "white", borderRadius: "16px" }}>
                <div style={{ textAlign: "left" }}>
                  <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.5px" }}>Tổng hồ sơ ứng tuyển</div>
                  <div style={{ fontSize: "1.5rem", fontWeight: "850", color: "var(--text-primary)", marginTop: "4px" }}>{helpers.length}</div>
                </div>
                <div style={{ background: "rgba(22, 163, 74, 0.1)", color: "var(--primary)", padding: "8px", borderRadius: "8px" }}>📁</div>
              </div>
              <div className="glass-panel" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "1.25rem", borderLeft: "4px solid #10B981", background: "white", borderRadius: "16px" }}>
                <div style={{ textAlign: "left" }}>
                  <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.5px" }}>Cộng tác viên chính thức</div>
                  <div style={{ fontSize: "1.5rem", fontWeight: "850", color: "#10B981", marginTop: "4px" }}>
                    {helpers.filter(h => h.status === "approved").length}
                  </div>
                </div>
                <div style={{ background: "rgba(16, 185, 129, 0.1)", color: "#10B981", padding: "8px", borderRadius: "8px" }}>🎓</div>
              </div>
              <div className="glass-panel" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "1.25rem", borderLeft: "4px solid #D97706", background: "white", borderRadius: "16px" }}>
                <div style={{ textAlign: "left" }}>
                  <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.5px" }}>Hồ sơ chờ duyệt</div>
                  <div style={{ fontSize: "1.5rem", fontWeight: "850", color: "#D97706", marginTop: "4px" }}>
                    {helpers.filter(h => h.status !== "approved" && h.status !== "rejected").length}
                  </div>
                </div>
                <div style={{ background: "rgba(217, 119, 6, 0.1)", color: "#D97706", padding: "8px", borderRadius: "8px" }}>⏳</div>
              </div>
            </div>

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
                  {filteredHelpers.length === 0 ? (
                    <tr><td colSpan="7" style={{textAlign:"center", padding:"2rem", color:"var(--text-secondary)"}}>Không tìm thấy hồ sơ cộng tác viên nào.</td></tr>
                  ) : filteredHelpers.map((h) => (
                    <tr key={h.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                      <td style={{ padding: "1rem 1.5rem" }}>
                        <div style={{ fontWeight: 700, color: "var(--text-primary)" }}>
                          {h.name} {h.alias && <span style={{ color: "var(--primary)", fontWeight: "600", fontSize: "0.85rem" }}>({h.alias})</span>}
                        </div>
                        <div style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>MSSV: {h.studentId}</div>
                        <button
                          type="button"
                          onClick={() => {
                            const newAlias = prompt(`Nhập tên gợi nhớ (biệt danh) cho CTV ${h.name}:`, h.alias || "");
                            if (newAlias !== null) {
                              handleSetHelperAlias(h.id, newAlias);
                            }
                          }}
                          style={{ background: "none", border: "none", color: "var(--primary)", fontSize: "0.72rem", cursor: "pointer", textDecoration: "underline", padding: 0, width: "fit-content", textAlign: "left", marginTop: "4px" }}
                        >
                          {h.alias ? "Sửa tên gợi nhớ" : "Đặt tên gợi nhớ"}
                        </button>
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
            {/* Toolbar cho Transactions */}
            <div className="glass-panel" style={{ padding: "1.5rem", marginBottom: "2rem" }}>
              <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ display: "flex", gap: "1rem", flex: 1, minWidth: "250px" }}>
                  <input 
                    type="text" 
                    placeholder="Tìm email hoặc nội dung giao dịch..." 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="form-input"
                    style={{ flex: 1, minWidth: "200px", background: "white" }}
                  />
                  <select
                    value={transFilterStatus}
                    onChange={(e) => setTransFilterStatus(e.target.value)}
                    className="form-input"
                    style={{ width: "180px", background: "white" }}
                  >
                    <option value="all">Tất cả giao dịch</option>
                    <option value="pending">Chờ duyệt nạp</option>
                    <option value="completed">Nạp thành công</option>
                    <option value="rejected">Đã từ chối</option>
                  </select>
                </div>
                <button onClick={handleExportTransactionsCSV} className="btn" style={{ background: "white", color: "var(--success)", border: "1px solid var(--success)", padding: "0.6rem 1.2rem", boxShadow: "none" }}>
                  📥 Xuất Excel
                </button>
              </div>
            </div>

            {/* Thống kê Giao dịch */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "1.25rem", marginBottom: "2rem" }}>
              <div className="glass-panel" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "1.25rem", borderLeft: "4px solid var(--primary)", background: "white", borderRadius: "16px" }}>
                <div style={{ textAlign: "left" }}>
                  <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.5px" }}>Tổng giao dịch</div>
                  <div style={{ fontSize: "1.5rem", fontWeight: "850", color: "var(--text-primary)", marginTop: "4px" }}>{transactions.length}</div>
                </div>
                <div style={{ background: "rgba(22, 163, 74, 0.1)", color: "var(--primary)", padding: "8px", borderRadius: "8px" }}>📊</div>
              </div>
              <div className="glass-panel" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "1.25rem", borderLeft: "4px solid #10B981", background: "white", borderRadius: "16px" }}>
                <div style={{ textAlign: "left" }}>
                  <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.5px" }}>Đã nạp thành công</div>
                  <div style={{ fontSize: "1.3rem", fontWeight: "850", color: "#10B981", marginTop: "4px" }}>
                    {transactions.filter(t => t.status === "completed" && t.type === "deposit").reduce((sum, t) => sum + (t.amount || 0), 0).toLocaleString("vi-VN")} đ
                  </div>
                </div>
                <div style={{ background: "rgba(16, 185, 129, 0.1)", color: "#10B981", padding: "8px", borderRadius: "8px" }}>💰</div>
              </div>
              <div className="glass-panel" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "1.25rem", borderLeft: "4px solid #D97706", background: "white", borderRadius: "16px" }}>
                <div style={{ textAlign: "left" }}>
                  <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.5px" }}>Giao dịch chờ duyệt</div>
                  <div style={{ fontSize: "1.5rem", fontWeight: "850", color: "#D97706", marginTop: "4px" }}>
                    {transactions.filter(t => t.status === "pending").length}
                  </div>
                </div>
                <div style={{ background: "rgba(217, 119, 6, 0.1)", color: "#D97706", padding: "8px", borderRadius: "8px" }}>⏳</div>
              </div>
            </div>

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
                  {filteredTransactions.length === 0 ? (
                    <tr><td colSpan="6" style={{textAlign:"center", padding:"2rem", color:"var(--text-secondary)"}}>Không tìm thấy giao dịch nạp tiền nào.</td></tr>
                  ) : filteredTransactions.map((t) => (
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

// 📅 Component Lịch Tháng tương tác dành cho Admin (Tối ưu hóa di động)
function AdminCalendarView({ schedules, users, handleUpdateStatus, handleAssignHelper, helpers, setLightboxImage }) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedItem, setSelectedItem] = useState(null);
  const [isMobile, setIsMobile] = useState(false);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const firstDayIndex = new Date(year, month, 1).getDay();
  const startDayOffset = firstDayIndex === 0 ? 6 : firstDayIndex - 1;
  const totalDays = new Date(year, month + 1, 0).getDate();

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const prevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const dayCells = [];
  for (let i = 0; i < startDayOffset; i++) {
    dayCells.push(null);
  }
  for (let d = 1; d <= totalDays; d++) {
    dayCells.push(new Date(year, month, d));
  }

  const getLocalDateString = (date) => {
    if (!date) return "";
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  };

  const getStatusColor = (status) => {
    const map = {
      completed: { bg: "rgba(139, 92, 246, 0.12)", text: "#8B5CF6", label: "Hoàn thành" },
      in_progress: { bg: "rgba(59, 130, 246, 0.12)", text: "#3B82F6", label: "Đang học" },
      accepted: { bg: "rgba(16, 185, 129, 0.12)", text: "var(--success)", label: "Sắp học" },
      rejected: { bg: "rgba(239, 68, 68, 0.12)", text: "var(--danger)", label: "Từ chối" },
      paid: { bg: "rgba(236, 72, 153, 0.12)", text: "#EC4899", label: "Đã thanh toán" },
      pending: { bg: "rgba(245, 158, 11, 0.12)", text: "#D97706", label: "Chờ nhận" }
    };
    return map[status] || map.pending;
  };

  return (
    <div className="glass-panel" style={{ padding: isMobile ? "0.8rem" : "1.5rem", borderRadius: "16px", background: "white", marginBottom: "2rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem", flexWrap: "wrap", gap: "10px" }}>
        <h3 style={{ fontSize: isMobile ? "1.1rem" : "1.25rem", fontWeight: "800", color: "var(--text-primary)", margin: 0, textAlign: "left" }}>
          📅 Lịch Trực Học Hộ Tháng {month + 1} / {year}
        </h3>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <button onClick={prevMonth} className="btn" style={{ padding: "0.4rem 0.6rem", background: "#f1f5f9", color: "var(--text-primary)", fontSize: "0.78rem", boxShadow: "none", border: "1px solid #cbd5e1" }}>
            ◀ Tháng trước
          </button>
          <button onClick={nextMonth} className="btn" style={{ padding: "0.4rem 0.6rem", background: "#f1f5f9", color: "var(--text-primary)", fontSize: "0.78rem", boxShadow: "none", border: "1px solid #cbd5e1" }}>
            Tháng sau ▶
          </button>
        </div>
      </div>

      {/* Tên các ngày thứ */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "5px", textAlign: "center", fontWeight: "700", fontSize: "0.78rem", color: "var(--text-secondary)", marginBottom: "8px", borderBottom: "1px solid #e2e8f0", paddingBottom: "6px" }}>
        <div>T2</div>
        <div>T3</div>
        <div>T4</div>
        <div>T5</div>
        <div>T6</div>
        <div>T7</div>
        <div style={{ color: "var(--danger)" }}>CN</div>
      </div>

      {/* Lưới các ô ngày */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: isMobile ? "3px" : "6px", minHeight: isMobile ? "280px" : "450px" }}>
        {dayCells.map((cellDate, idx) => {
          if (!cellDate) {
            return <div key={`empty-${idx}`} style={{ background: "#f8fafc", borderRadius: "8px", border: "1px solid #f1f5f9" }} />;
          }

          const cellDateStr = getLocalDateString(cellDate);
          const daySchedules = schedules.filter(s => s.classDate === cellDateStr);
          const isToday = getLocalDateString(new Date()) === cellDateStr;
          const isSelected = getLocalDateString(selectedDate) === cellDateStr;

          return (
            <div 
              key={cellDateStr} 
              onClick={() => setSelectedDate(cellDate)}
              style={{
                background: isSelected ? "rgba(22, 163, 74, 0.08)" : (isToday ? "rgba(59, 130, 246, 0.04)" : "white"),
                borderRadius: "10px",
                border: isSelected ? "2px solid var(--primary)" : (isToday ? "2px solid #93C5FD" : "1px solid #e2e8f0"),
                padding: isMobile ? "4px" : "8px",
                minHeight: isMobile ? "55px" : "105px",
                display: "flex",
                flexDirection: "column",
                alignItems: "stretch",
                cursor: "pointer",
                boxShadow: isSelected ? "0 4px 12px rgba(22, 163, 74, 0.12)" : "none"
              }}
            >
              <div style={{ fontWeight: "800", fontSize: "0.85rem", color: isSelected ? "var(--primary)" : (isToday ? "#2563EB" : "var(--text-secondary)"), marginBottom: "4px", alignSelf: "flex-end" }}>
                {cellDate.getDate()}
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "4px", flex: 1 }} className="hide-scrollbar">
                {!isMobile ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: "4px", overflowY: "auto", maxHeight: "75px" }} className="hide-scrollbar">
                    {daySchedules.map(item => {
                      const styleColors = getStatusColor(item.status);
                      const userDoc = users.find(u => u.id === item.userId);
                      const nameDisplay = userDoc?.alias || item.name || "Khách";
                      
                      return (
                        <div 
                          key={item.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedItem(item);
                          }}
                          style={{
                            background: styleColors.bg,
                            color: styleColors.text,
                            fontSize: "0.7rem",
                            fontWeight: "750",
                            padding: "4px 6px",
                            borderRadius: "6px",
                            cursor: "pointer",
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            textAlign: "left",
                            border: `1px solid ${styleColors.text}22`
                          }}
                          title={`${item.startTime} - ${item.className} (${nameDisplay})`}
                        >
                          {item.startTime?.substring(0, 5) || ""} {item.className}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  daySchedules.length > 0 && (
                    <div style={{ display: "flex", justifyContent: "center", gap: "3px", flexWrap: "wrap", marginTop: "auto" }}>
                      {daySchedules.slice(0, 3).map(item => {
                        const colors = getStatusColor(item.status);
                        return (
                          <span 
                            key={item.id} 
                            style={{ width: "6px", height: "6px", borderRadius: "50%", background: colors.text, display: "inline-block" }} 
                          />
                        );
                      })}
                      {daySchedules.length > 3 && (
                        <span style={{ fontSize: "0.6rem", fontWeight: "900", color: "var(--text-secondary)", lineHeight: 1 }}>+</span>
                      )}
                    </div>
                  )
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Danh sách lịch học hiển thị bên dưới grid trên mobile */}
      {isMobile && (
        <div style={{ marginTop: "1.5rem", borderTop: "1px solid #e2e8f0", paddingTop: "1rem", textAlign: "left" }}>
          <h4 style={{ fontSize: "0.9rem", fontWeight: "800", color: "var(--text-primary)", marginBottom: "0.75rem" }}>
            📅 Lịch ngày {selectedDate.toLocaleDateString("vi-VN")}:
          </h4>
          {schedules.filter(s => s.classDate === getLocalDateString(selectedDate)).length === 0 ? (
            <p style={{ fontSize: "0.8rem", color: "var(--text-secondary)", fontStyle: "italic", textAlign: "center", padding: "1rem" }}>Không có lịch học nào trong ngày này.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {schedules.filter(s => s.classDate === getLocalDateString(selectedDate)).map(item => {
                const styleColors = getStatusColor(item.status);
                const userDoc = users.find(u => u.id === item.userId);
                const nameDisplay = userDoc?.alias || item.name || "Khách";

                return (
                  <div 
                    key={item.id}
                    onClick={() => setSelectedItem(item)}
                    style={{
                      background: "white",
                      border: `1px solid #e2e8f0`,
                      borderLeft: `4px solid ${styleColors.text}`,
                      padding: "10px 12px",
                      borderRadius: "10px",
                      cursor: "pointer",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center"
                    }}
                  >
                    <div style={{ flex: 1, marginRight: "10px" }}>
                      <div style={{ fontSize: "0.82rem", fontWeight: "700", color: "var(--text-primary)" }}>{item.className}</div>
                      <div style={{ fontSize: "0.72rem", color: "var(--text-secondary)", marginTop: "2px" }}>
                        🕒 {item.startTime} - {item.endTime} • {nameDisplay}
                      </div>
                    </div>
                    <span style={{
                      fontSize: "0.68rem",
                      fontWeight: "700",
                      background: styleColors.bg,
                      color: styleColors.text,
                      padding: "3px 6px",
                      borderRadius: "6px",
                      whiteSpace: "nowrap"
                    }}>
                      {styleColors.label}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Hộp thoại chi tiết lịch học khi click */}
      {selectedItem && (
        <div style={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)", zIndex: 1100, display: "flex", justifyContent: "center", alignItems: "center" }}>
          <div className="glass-panel" style={{ width: "92%", maxWidth: "480px", background: "white", padding: "1.5rem", borderRadius: "20px", boxShadow: "0 20px 40px rgba(0,0,0,0.2)", position: "relative", textAlign: "left" }}>
            <button 
              onClick={() => setSelectedItem(null)} 
              style={{ position: "absolute", top: "15px", right: "15px", background: "none", border: "none", fontSize: "1.5rem", cursor: "pointer", color: "var(--text-secondary)" }}
            >
              ×
            </button>
            <h3 style={{ fontSize: "1.2rem", fontWeight: "800", color: "var(--text-primary)", marginBottom: "1rem", borderBottom: "1px solid #f1f5f9", paddingBottom: "10px" }}>
              📝 Chi tiết Lịch Học
            </h3>

            <div style={{ display: "flex", flexDirection: "column", gap: "8px", maxHeight: "400px", overflowY: "auto" }} className="hide-scrollbar">
              <div>
                <strong>Học viên:</strong> {selectedItem.name}
                {(() => {
                  const userDoc = users.find(u => u.id === selectedItem.userId);
                  return userDoc?.alias ? <span style={{ color: "#8B5CF6", fontWeight: "700", marginLeft: "6px" }}>(🏷️ {userDoc.alias})</span> : null;
                })()}
              </div>
              <div><strong>Môn học:</strong> {selectedItem.className}</div>
              <div><strong>Mã đơn VietQR:</strong> <span style={{ fontFamily: "monospace", color: "var(--primary)", fontWeight: "700" }}>{selectedItem.id.substring(0, 8).toUpperCase()}</span></div>
              <div><strong>Trường:</strong> {selectedItem.school} • Lớp: {selectedItem.className}</div>
              <div><strong>Thời gian:</strong> {selectedItem.weekday} ({new Date(selectedItem.classDate).toLocaleDateString("vi-VN")})</div>
              <div><strong>Giờ học:</strong> {selectedItem.startTime} - {selectedItem.endTime}</div>
              <div><strong>Học phí:</strong> <span style={{ color: "var(--primary)", fontWeight: "700" }}>{Number(selectedItem.price || 0).toLocaleString("vi-VN")} đ</span></div>
              
              {selectedItem.phone && (
                <div>
                  <strong>Liên hệ:</strong> <a href={`https://zalo.me/${selectedItem.phone}`} target="_blank" rel="noopener noreferrer" style={{ color: "var(--primary)", textDecoration: "underline", fontWeight: "700" }}>{selectedItem.phone} 💬</a>
                </div>
              )}
              {selectedItem.notes && <div><strong>Ghi chú:</strong> <i style={{ color: "var(--primary)" }}>{selectedItem.notes}</i></div>}

              {selectedItem.imageUrl && (
                <div style={{ marginTop: "8px" }}>
                  <strong>Ảnh lịch học:</strong>
                  <img 
                    src={selectedItem.imageUrl} 
                    alt="Lịch học" 
                    style={{ width: "100%", height: "140px", objectFit: "cover", borderRadius: "8px", marginTop: "4px", cursor: "pointer", border: "1px solid #cbd5e1" }}
                    onClick={() => {
                      setLightboxImage(selectedItem.imageUrl);
                    }}
                  />
                </div>
              )}

              <div style={{ marginTop: "12px", borderTop: "1px solid #f1f5f9", paddingTop: "12px" }}>
                <label style={{ fontWeight: "700", display: "block", marginBottom: "6px", fontSize: "0.85rem" }}>Cập nhật trạng thái:</label>
                <select
                  value={selectedItem.status || "pending"}
                  onChange={(e) => {
                    handleUpdateStatus(selectedItem.id, e.target.value);
                    setSelectedItem(prev => ({ ...prev, status: e.target.value }));
                  }}
                  className="form-input"
                  style={{ background: "white", cursor: "pointer", fontWeight: "700" }}
                >
                  <option value="pending">Chờ nhận</option>
                  <option value="paid">Đã thanh toán</option>
                  <option value="accepted">Sắp học</option>
                  <option value="in_progress">Đang học</option>
                  <option value="completed">Hoàn thành</option>
                  <option value="rejected">Từ chối</option>
                </select>
              </div>

              <div style={{ marginTop: "8px" }}>
                <label style={{ fontWeight: "700", display: "block", marginBottom: "6px", fontSize: "0.85rem" }}>Giao việc CTV:</label>
                <select
                  value={selectedItem.assignedTo || ""}
                  onChange={(e) => {
                    handleAssignHelper(selectedItem.id, e.target.value);
                    setSelectedItem(prev => ({ ...prev, assignedTo: e.target.value }));
                  }}
                  className="form-input"
                  style={{ background: "white", cursor: "pointer" }}
                >
                  <option value="">-- Chưa giao --</option>
                  {helpers.filter(h => h.isApproved).map(h => (
                    <option key={h.id} value={h.name}>{h.alias ? `${h.alias} (${h.name})` : h.name}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AdminDashboardPage() {
  return (
    <Suspense fallback={
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "100vh", background: "#f8fafc", color: "var(--text-secondary)" }}>
        Đang tải trang quản trị...
      </div>
    }>
      <AdminDashboard />
    </Suspense>
  );
}
