"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { db, storage } from "@/lib/firebase";
import { collection, addDoc, serverTimestamp, query, where, orderBy, onSnapshot, doc, deleteDoc, updateDoc, increment, setDoc } from "firebase/firestore";
import { ref, uploadString, getDownloadURL } from "firebase/storage";
import toast from "react-hot-toast";
import imageCompression from "browser-image-compression";

export default function Dashboard() {
  const { user, loading, systemSettings, sendTelegramAlert } = useAuth();
  const router = useRouter();

  const [formData, setFormData] = useState({
    name: "",
    className: "",
    studentId: "",
    school: "",
    classDate: "",
    startTime: "",
    endTime: "",
    dob: "",
    notes: "",
    phone: "",
    price: ""
  });
  const [weekday, setWeekday] = useState("");
  const [file, setFile] = useState(null); // Now stores Base64 string
  const [fileName, setFileName] = useState("");
  const [filePreview, setFilePreview] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [history, setHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedItem, setSelectedItem] = useState(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [newOrderInfo, setNewOrderInfo] = useState(null);
  const [minDate, setMinDate] = useState("");
  const [userProfile, setUserProfile] = useState(null);
  const [showWalletModal, setShowWalletModal] = useState(false);
  const [topupAmount, setTopupAmount] = useState("100000");
  const [paymentMethod, setPaymentMethod] = useState("qr"); // "qr" or "wallet"
  const [historyView, setHistoryView] = useState("list"); // "list" or "calendar"
  const [currentDate, setCurrentDate] = useState(new Date());
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [reviewItem, setReviewItem] = useState(null);
  const [rating, setRating] = useState(5);
  const [reviewText, setReviewText] = useState("");
  const [submittingReview, setSubmittingReview] = useState(false);
  const [activeTab, setActiveTab] = useState("schedules"); // "schedules" or "wallet"
  const [transactions, setTransactions] = useState([]);
  const [loadingTransactions, setLoadingTransactions] = useState(true);

  useEffect(() => {
    if (!loading && !user) {
      router.push("/");
    }
  }, [user, loading, router]);

  useEffect(() => {
    // Đặt ngày học mặc định là ngày hôm nay trên client
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, "0");
    const day = String(today.getDate()).padStart(2, "0");
    const todayStr = `${year}-${month}-${day}`;
    
    setMinDate(todayStr);
    setFormData(prev => ({ ...prev, classDate: todayStr }));
    
    // Tính toán thứ cho ngày hôm nay
    const daysOfWeek = ["Chủ nhật", "Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy"];
    setWeekday(daysOfWeek[today.getDay()]);
  }, []);

  useEffect(() => {
    if (user) {
      const q = query(
        collection(db, "schedules"), 
        where("userId", "==", user.uid)
      );
      
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const data = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        
        // Sắp xếp giảm dần theo thời gian tạo (Client-side sort để tránh lỗi Missing Index)
        data.sort((a, b) => {
          const timeA = a.createdAt ? a.createdAt.toMillis() : 0;
          const timeB = b.createdAt ? b.createdAt.toMillis() : 0;
          return timeB - timeA;
        });

        setHistory(data);
        setLoadingHistory(false);
      }, (error) => {
        console.error("Lỗi tải lịch sử:", error);
        setLoadingHistory(false);
      });

      // Lắng nghe số dư ví thời gian thực
      const docRef = doc(db, "users", user.uid);
      const unsubscribeProfile = onSnapshot(docRef, (docSnap) => {
        if (docSnap.exists()) {
          setUserProfile(docSnap.data());
        }
      });

      // Lắng nghe lịch sử giao dịch ví số dư thời gian thực (không cần index nhờ sort client)
      const qTrans = query(
        collection(db, "transactions"),
        where("userId", "==", user.uid)
      );
      const unsubscribeTrans = onSnapshot(qTrans, (snapshot) => {
        const tData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        tData.sort((a, b) => {
          const timeA = a.createdAt ? a.createdAt.toMillis() : 0;
          const timeB = b.createdAt ? b.createdAt.toMillis() : 0;
          return timeB - timeA;
        });
        setTransactions(tData);
        setLoadingTransactions(false);
      }, (err) => {
        console.error("Lỗi tải lịch sử giao dịch ví:", err);
        setLoadingTransactions(false);
      });

      return () => { unsubscribe(); unsubscribeProfile(); unsubscribeTrans(); };
    }
  }, [user]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    
    if (name === "price") {
      // Bỏ đi các ký tự không phải số
      const numericValue = value.replace(/\D/g, "");
      // Định dạng kiểu 100.000
      const formattedValue = numericValue.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
      setFormData({ ...formData, [name]: formattedValue });
    } else {
      setFormData({ ...formData, [name]: value });
    }
    
    // Tự động tính Thứ trong tuần khi chọn ngày học
    if (name === "classDate" && value) {
      const dateObj = new Date(value);
      const days = ["Chủ Nhật", "Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy"];
      if (!isNaN(dateObj.getTime())) {
        setWeekday(days[dateObj.getDay()]);
      } else {
        setWeekday("");
      }
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      
      // 1. Tạo ảnh xem trước (Preview)
      const reader = new FileReader();
      reader.onloadend = () => {
        setFilePreview(reader.result);
      };
      reader.readAsDataURL(selectedFile);

      // 2. Nén ảnh SIÊU TỐC ngay lúc chọn file (dùng Canvas)
      const img = new Image();
      img.src = URL.createObjectURL(selectedFile);
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const MAX_WIDTH = 1280;
        const MAX_HEIGHT = 1280;
        let width = img.width;
        let height = img.height;

        // Tính toán tỷ lệ thu nhỏ
        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);

        // Xuất ra chuỗi Base64 siêu an toàn, không bao giờ bị kẹt mạng
        const base64String = canvas.toDataURL("image/jpeg", 0.7);
        setFile(base64String);
        setFileName(selectedFile.name.replace(/\.[^/.]+$/, "") + ".jpg");
        console.log("Đã nén thành chuỗi Base64 an toàn tuyệt đối.");
      };
    }
  };

  // Tính năng Dán ảnh (Ctrl + V)
  useEffect(() => {
    const handlePaste = (e) => {
      if (e.clipboardData && e.clipboardData.files.length > 0) {
        const pastedFile = e.clipboardData.files[0];
        if (pastedFile.type.startsWith("image/")) {
          // Gắn tên ảo nếu file dán từ clipboard không có tên cụ thể
          const f = new File([pastedFile], pastedFile.name === "image.png" ? `anh_dan_${Date.now()}.png` : pastedFile.name, { type: pastedFile.type });
          handleFileChange({ target: { files: [f] } });
          toast.success("Đã nhận ảnh từ Clipboard!");
        }
      }
    };
    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, []);

  if (loading || !user) {
    return <div className="loader"></div>;
  }





  const handleSubmit = async (e) => {
    e.preventDefault();
    const timeRegex = /^(0[0-9]|1[0-9]|2[0-3]):[0-5][0-9]$/;
    if (formData.startTime && !timeRegex.test(formData.startTime)) {
      toast.error("Vui lòng nhập đúng định dạng giờ bắt đầu 24h (Ví dụ: 08:30 hoặc 14:00)");
      return;
    }
    if (formData.endTime && !timeRegex.test(formData.endTime)) {
      toast.error("Vui lòng nhập đúng định dạng giờ kết thúc 24h (Ví dụ: 11:30 hoặc 17:00)");
      return;
    }

    // Kiểm tra ngày học không được ở quá khứ
    if (formData.classDate) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const selectedDate = new Date(formData.classDate);
      selectedDate.setHours(0, 0, 0, 0);
      if (selectedDate < today) {
        toast.error("Ngày học không được chọn ở quá khứ!");
        return;
      }
    }

    const priceNumeric = formData.price ? Number(formData.price.replace(/\./g, "")) : 0;

    if (paymentMethod === "wallet") {
      if ((userProfile?.balance || 0) < priceNumeric) {
        toast.error("Số dư ví không đủ! Vui lòng nạp thêm tiền hoặc chọn quét QR.");
        return;
      }
    }

    if (!file) {
      toast.error("Vui lòng đợi ảnh tải xong hoặc chọn ảnh khác!");
      return;
    }

    setUploading(true);
    setProgress(30);
    toast.loading("Đang đẩy dữ liệu lên máy chủ...", { id: "upload" });

    // GIAI ĐOẠN ĐỘT PHÁ: Lưu thẳng chuỗi văn bản ảnh vào CSDL Firestore (Không cần Storage)
    try {
      // 1. Trừ tiền ví trước nếu chọn thanh toán bằng ví
      if (paymentMethod === "wallet") {
        await updateDoc(doc(db, "users", user.uid), {
          balance: increment(-priceNumeric)
        });
        
        // Ghi nhận lịch sử thanh toán ví
        await addDoc(collection(db, "transactions"), {
          userId: user.uid,
          userEmail: user.email,
          amount: priceNumeric,
          type: "payment",
          status: "completed",
          message: `Thanh toán đơn thuê học môn ${formData.className}`,
          createdAt: serverTimestamp()
        });
      }

      const docRef = await addDoc(collection(db, "schedules"), {
        userId: user.uid,
        userEmail: user.email || "No Email",
        name: formData.name,
        className: formData.className,
        studentId: formData.studentId,
        school: formData.school,
        classDate: formData.classDate,
        startTime: formData.startTime,
        endTime: formData.endTime,
        dob: formData.dob,
        notes: formData.notes,
        phone: formData.phone,
        price: formData.price ? formData.price.replace(/\./g, "") : "",
        weekday: weekday,
        imageUrl: file, // Lưu trực tiếp chuỗi Base64
        status: paymentMethod === "wallet" ? "paid" : "pending",
        paymentMethod: paymentMethod,
        createdAt: serverTimestamp()
      });

      // Báo Telegram đơn hàng mới cho Admin
      const orderIdSub = docRef.id.substring(0, 8).toUpperCase();
      const formatPrice = Number(formData.price ? formData.price.replace(/\./g, "") : 0).toLocaleString("vi-VN");
      const timeAlert = formData.startTime && formData.endTime ? ` Khung giờ: ${formData.startTime} - ${formData.endTime}` : "";
      
      const paymentInfo = paymentMethod === "wallet" 
        ? `💰 <b>THANH TOÁN BẰNG VÍ</b> (Hệ thống đã tự trừ số dư)` 
        : `📸 <b>CHUYỂN KHOẢN TRỰC TIẾP</b> (Chờ quét QR)`;

      const telegramText = `📝 <b>CÓ ĐƠN ĐĂNG KÝ THUÊ HỌC MỚI!</b>\n\n` +
        `• <b>Mã đơn (VietQR):</b> <code>${orderIdSub}</code>\n` +
        `• <b>Họ tên sinh viên:</b> ${formData.name}\n` +
        `• <b>Mã số sinh viên:</b> ${formData.studentId}\n` +
        `• <b>Lớp học:</b> ${formData.className}\n` +
        `• <b>Trường học:</b> ${formData.school}\n` +
        `• <b>Ngày học:</b> ${weekday} (${new Date(formData.classDate).toLocaleDateString("vi-VN")})${timeAlert}\n` +
        `• <b>Số điện thoại:</b> ${formData.phone}\n` +
        `• <b>Giá thuê:</b> ${formatPrice} VNĐ\n` +
        `• <b>Phương thức:</b> ${paymentInfo}\n\n` +
        `<i>Vui lòng truy cập Bảng quản trị để phê duyệt lịch!</i>`;

      sendTelegramAlert(telegramText);

      // Tạo thông báo cho Admin
      await addDoc(collection(db, "notifications"), {
        userId: "admin",
        title: paymentMethod === "wallet" ? "Đơn thanh toán qua Ví" : "Đơn thuê học mới",
        message: `Sinh viên ${formData.name} đăng ký học môn ${formData.className} (${formatPrice} đ).`,
        read: false,
        link: "/admin",
        createdAt: serverTimestamp()
      });

      setProgress(100);

      if (paymentMethod === "wallet") {
        toast.success("Thành công! Đã thanh toán đơn hàng bằng ví tài khoản.", { id: "upload" });
      } else {
        toast.success("Thành công! Đơn thuê học đã được nộp.", { id: "upload" });
        setNewOrderInfo({
          id: docRef.id,
          name: formData.name,
          studentId: formData.studentId,
          className: formData.className,
          price: formData.price ? formData.price.replace(/\./g, "") : "0",
          classDate: formData.classDate,
          weekday: weekday
        });
        setShowPaymentModal(true);
      }
      
      // Reset form
      const today = new Date();
      const year = today.getFullYear();
      const month = String(today.getMonth() + 1).padStart(2, "0");
      const day = String(today.getDate()).padStart(2, "0");
      const todayStr = `${year}-${month}-${day}`;

      setFormData({ 
        name: "", className: "", studentId: "", school: "", 
        classDate: todayStr, startTime: "", endTime: "", dob: "", notes: "", phone: "", price: "" 
      });
      
      const daysOfWeek = ["Chủ nhật", "Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy"];
      setWeekday(daysOfWeek[today.getDay()]);
      setFile(null);
      setFilePreview(null);
      setTimeout(() => setProgress(0), 1000);
      document.getElementById('file-input').value = "";

    } catch (error) {
      console.error("Lỗi Database:", error);
      toast.error(`Lỗi Database: ${error.message}`, { id: "upload", duration: 8000 });
      setProgress(0);
    } finally {
      setUploading(false);
    }
  };

  const renderCalendar = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDayIndex = new Date(year, month, 1).getDay(); // 0 là Chủ nhật, 6 là Thứ 7

    const monthNames = [
      "Tháng 1", "Tháng 2", "Tháng 3", "Tháng 4", "Tháng 5", "Tháng 6",
      "Tháng 7", "Tháng 8", "Tháng 9", "Tháng 10", "Tháng 11", "Tháng 12"
    ];

    const handlePrevMonth = () => {
      setCurrentDate(new Date(year, month - 1, 1));
    };

    const handleNextMonth = () => {
      setCurrentDate(new Date(year, month + 1, 1));
    };

    const daysGrid = [];
    for (let i = 0; i < firstDayIndex; i++) {
      daysGrid.push(null);
    }
    for (let d = 1; d <= daysInMonth; d++) {
      daysGrid.push(new Date(year, month, d));
    }

    return (
      <div style={{ background: "white", padding: "1.25rem", borderRadius: "16px", border: "1px solid #e2e8f0" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
          <h3 style={{ margin: 0, fontSize: "1.1rem", fontWeight: "700", color: "var(--text-primary)" }}>{monthNames[month]} - {year}</h3>
          <div style={{ display: "flex", gap: "5px" }}>
            <button type="button" onClick={handlePrevMonth} className="btn" style={{ padding: "4px 10px", background: "#f1f5f9", fontSize: "0.8rem", border: "none", cursor: "pointer", borderRadius: "6px", color: "var(--text-primary)" }}>◀</button>
            <button type="button" onClick={handleNextMonth} className="btn" style={{ padding: "4px 10px", background: "#f1f5f9", fontSize: "0.8rem", border: "none", cursor: "pointer", borderRadius: "6px", color: "var(--text-primary)" }}>▶</button>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "5px", textAlign: "center", fontWeight: "700", fontSize: "0.75rem", color: "var(--text-secondary)", marginBottom: "8px" }}>
          <span style={{ color: "#ef4444" }}>CN</span><span>T2</span><span>T3</span><span>T4</span><span>T5</span><span>T6</span><span>T7</span>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "6px" }}>
          {daysGrid.map((day, idx) => {
            if (!day) return <div key={`empty-${idx}`} style={{ minHeight: "55px", background: "#f8fafc", borderRadius: "8px", opacity: 0.3 }} />;
            
            const dateString = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}-${String(day.getDate()).padStart(2, "0")}`;
            const daySchedules = history.filter(item => item.classDate === dateString);

            return (
              <div 
                key={dateString} 
                style={{ 
                  minHeight: "55px", 
                  background: daySchedules.length > 0 ? "rgba(22, 163, 74, 0.05)" : "#f8fafc", 
                  border: daySchedules.length > 0 ? "1px solid var(--primary)" : "1px solid #e2e8f0", 
                  borderRadius: "8px", 
                  padding: "4px",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  cursor: daySchedules.length > 0 ? "pointer" : "default",
                  transition: "all 0.1s"
                }}
                onClick={() => {
                  if (daySchedules.length > 0) {
                    setSelectedItem(daySchedules[0]);
                  }
                }}
              >
                <span style={{ fontSize: "0.8rem", fontWeight: "700", color: daySchedules.length > 0 ? "var(--primary)" : "var(--text-primary)" }}>{day.getDate()}</span>
                {daySchedules.length > 0 && (
                  <div style={{ display: "flex", gap: "3px", flexWrap: "wrap", justifyContent: "flex-end" }}>
                    {daySchedules.map(item => {
                      let dotColor = "#D97706";
                      if (item.status === "approved" || item.status === "accepted" || item.status === "in_progress") dotColor = "var(--success)";
                      if (item.status === "completed") dotColor = "#8B5CF6";
                      if (item.status === "rejected") dotColor = "var(--danger)";
                      return (
                        <span 
                          key={item.id} 
                          title={`${item.name} - ${item.className}`}
                          style={{ width: "6px", height: "6px", borderRadius: "50%", background: dotColor }} 
                        />
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const handleDelete = async (id) => {
    if (confirm("Bạn có chắc chắn muốn xóa đơn thuê học này không?")) {
      try {
        await deleteDoc(doc(db, "schedules", id));
        toast.success("Đã xóa đơn thuê học");
      } catch (error) {
        console.error("Lỗi xóa đơn thuê học:", error);
        toast.error("Lỗi khi xóa đơn thuê học");
      }
    }
  };

  const handleTopupRequest = async () => {
    if (!topupAmount || Number(topupAmount) <= 0) {
      toast.error("Vui lòng nhập số tiền nạp hợp lệ!");
      return;
    }
    toast.loading("Đang gửi yêu cầu nạp tiền...", { id: "topup" });
    try {
      const topupText = `💳 <b>YÊU CẦU NẠP TIỀN VÍ MỚI!</b>\n\n` +
        `• <b>Tài khoản khách:</b> ${user.email}\n` +
        `• <b>Số tiền nạp ví:</b> ${Number(topupAmount).toLocaleString("vi-VN")} VNĐ\n` +
        `• <b>Nội dung CK chuyển khoản:</b> <code>THUENAP ${user.uid.substring(0, 6).toUpperCase()}</code>\n` +
        `• <b>Trạng thái:</b> Chờ Admin đối soát và duyệt cộng tiền.`;
      
      await sendTelegramAlert(topupText);

      // Tạo thông báo cho Admin
      await addDoc(collection(db, "notifications"), {
        userId: "admin",
        title: "Yêu cầu nạp Ví",
        message: `Tài khoản ${user.email} yêu cầu nạp ${Number(topupAmount).toLocaleString("vi-VN")} đ vào ví.`,
        read: false,
        link: "/admin",
        createdAt: serverTimestamp()
      });

      // Ghi lịch sử giao dịch chờ duyệt
      await addDoc(collection(db, "transactions"), {
        userId: user.uid,
        userEmail: user.email,
        amount: Number(topupAmount),
        type: "deposit",
        status: "pending",
        message: "Nạp tiền vào ví (Quét QR MBBank)",
        createdAt: serverTimestamp()
      });

      toast.success("Đã gửi yêu cầu nạp ví thành công! Vui lòng chuyển khoản.", { id: "topup" });
      setShowWalletModal(false);
    } catch (err) {
      toast.error("Gửi yêu cầu thất bại!", { id: "topup" });
    }
  };

  const handleSubmitReview = async (e) => {
    e.preventDefault();
    if (!reviewText.trim()) {
      toast.error("Vui lòng điền nội dung nhận xét!");
      return;
    }
    setSubmittingReview(true);
    toast.loading("Đang gửi nhận xét đánh giá...", { id: "review" });
    try {
      await addDoc(collection(db, "reviews"), {
        userId: user.uid,
        userEmail: user.email,
        userName: userProfile?.displayName || user.email.split('@')[0],
        scheduleId: reviewItem.id,
        className: reviewItem.className,
        school: reviewItem.school,
        rating: rating,
        comment: reviewText,
        createdAt: serverTimestamp()
      });
      
      // Đánh dấu đơn đã được đánh giá
      await updateDoc(doc(db, "schedules", reviewItem.id), { reviewed: true });
      
      // Đồng bộ state selectedItem nếu đang xem
      setSelectedItem(prev => prev && prev.id === reviewItem.id ? { ...prev, reviewed: true } : prev);
      
      toast.success("Cảm ơn bạn đã gửi đánh giá dịch vụ!", { id: "review" });
      setShowReviewModal(false);
      setReviewText("");
    } catch (err) {
      console.error("Lỗi gửi đánh giá:", err);
      toast.error("Không thể gửi đánh giá lúc này!", { id: "review" });
    } finally {
      setSubmittingReview(false);
    }
  };

  const handleConfirmPayment = async (orderId, orderName, orderPrice) => {
    try {
      const docRef = doc(db, "schedules", orderId);
      await setDoc(docRef, { status: "paid" }, { merge: true });
      
      // Báo Telegram
      const orderIdSub = orderId.substring(0, 8).toUpperCase();
      const telegramText = `💳 <b>KHÁCH BÁO ĐÃ CHUYỂN TIỀN!</b>\n\n` +
        `• <b>Mã đơn (VietQR):</b> <code>${orderIdSub}</code>\n` +
        `• <b>Họ tên sinh viên:</b> ${orderName}\n` +
        `• <b>Số tiền chuyển:</b> ${Number(orderPrice).toLocaleString("vi-VN")} VNĐ\n` +
        `• <b>Tài khoản gửi:</b> ${user.email}\n` +
        `• <b>Trạng thái:</b> Đang chờ Admin đối soát ngân hàng.`;
      
      sendTelegramAlert(telegramText);

      // Tạo thông báo cho Admin
      await addDoc(collection(db, "notifications"), {
        userId: "admin",
        title: "Báo chuyển khoản",
        message: `Khách hàng báo đã chuyển khoản ${Number(orderPrice).toLocaleString("vi-VN")} đ cho mã đơn ${orderIdSub}.`,
        read: false,
        link: "/admin",
        createdAt: serverTimestamp()
      });

      toast.success("Đã gửi báo cáo chuyển tiền đến Admin!");
      setShowPaymentModal(false);
      
      // Đồng bộ state selectedItem nếu đang mở
      setSelectedItem(prev => prev && prev.id === orderId ? { ...prev, status: "paid" } : prev);
    } catch (err) {
      console.error("Lỗi báo chuyển tiền:", err);
      toast.error("Không thể gửi báo cáo chuyển tiền!");
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case "approved":
      case "accepted":
        return <span style={{ background: "rgba(16, 185, 129, 0.15)", color: "var(--success)", padding: "4px 10px", borderRadius: "12px", fontSize: "0.8rem", fontWeight: "700" }}>Sắp học</span>;
      case "paid":
        return <span style={{ background: "rgba(245, 158, 11, 0.15)", color: "#D97706", padding: "4px 10px", borderRadius: "12px", fontSize: "0.8rem", fontWeight: "700" }}>Chờ duyệt</span>;
      case "in_progress":
        return <span style={{ background: "rgba(59, 130, 246, 0.15)", color: "#3B82F6", padding: "4px 10px", borderRadius: "12px", fontSize: "0.8rem", fontWeight: "700" }}>Đang học</span>;
      case "completed":
        return <span style={{ background: "rgba(139, 92, 246, 0.15)", color: "#8B5CF6", padding: "4px 10px", borderRadius: "12px", fontSize: "0.8rem", fontWeight: "700" }}>Hoàn thành</span>;
      case "rejected":
        return <span style={{ background: "rgba(239, 68, 68, 0.15)", color: "var(--danger)", padding: "4px 10px", borderRadius: "12px", fontSize: "0.8rem", fontWeight: "700" }}>Từ chối</span>;
      default:
        return <span style={{ background: "rgba(245, 158, 11, 0.15)", color: "#D97706", padding: "4px 10px", borderRadius: "12px", fontSize: "0.8rem", fontWeight: "700" }}>Chờ nhận đơn</span>;
    }
  };

  const getPaymentStatusBadge = (status) => {
    switch (status) {
      case "paid":
        return <span style={{ background: "rgba(236, 72, 153, 0.12)", color: "#EC4899", padding: "3px 8px", borderRadius: "10px", fontSize: "0.75rem", fontWeight: "700", border: "1px solid rgba(236, 72, 153, 0.2)" }}>Đã báo chuyển tiền</span>;
      case "approved":
      case "accepted":
      case "in_progress":
      case "completed":
        return <span style={{ background: "rgba(16, 185, 129, 0.12)", color: "var(--success)", padding: "3px 8px", borderRadius: "10px", fontSize: "0.75rem", fontWeight: "700", border: "1px solid rgba(16, 185, 129, 0.2)" }}>Đã thanh toán</span>;
      case "rejected":
        return <span style={{ background: "rgba(100, 116, 139, 0.12)", color: "#64748b", padding: "3px 8px", borderRadius: "10px", fontSize: "0.75rem", fontWeight: "700", border: "1px solid rgba(100, 116, 139, 0.2)" }}>Đã hủy</span>;
      case "pending":
      default:
        return <span style={{ background: "rgba(239, 68, 68, 0.12)", color: "var(--danger)", padding: "3px 8px", borderRadius: "10px", fontSize: "0.75rem", fontWeight: "700", border: "1px solid rgba(239, 68, 68, 0.2)" }}>Chưa thanh toán</span>;
    }
  };

  // Tính các chỉ số thống kê động
  const stats = {
    total: history.length,
    pending: history.filter(item => item.status === "pending" || !item.status).length,
    inProgress: history.filter(item => item.status === "in_progress").length,
    completed: history.filter(item => item.status === "completed").length,
    totalSpent: history
      .filter(item => item.status === "completed" || item.status === "approved" || item.status === "in_progress")
      .reduce((sum, item) => sum + Number(item.price || 0), 0)
  };

  // Xuất file CSV báo cáo cho khách hàng
  const exportToCSV = () => {
    const headers = ["Ho va Ten", "MSSV", "Lop", "Truong", "Ngay hoc", "Gio hoc", "SDT", "Gia de xuat (VND)", "Trang thai", "Ghi chu"];
    const rows = history.map(item => [
      item.name,
      item.studentId,
      item.className,
      item.school,
      item.classDate,
      `${item.startTime} - ${item.endTime}`,
      item.phone,
      item.price,
      item.status === "pending" ? "Cho nhan don" : item.status === "approved" ? "Sap hoc" : item.status === "in_progress" ? "Dang hoc" : item.status === "completed" ? "Hoan thanh" : "Tu choi",
      item.notes
    ]);

    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" 
      + [headers.join(","), ...rows.map(e => e.map(val => `"${(val || "").toString().replace(/"/g, '""')}"`).join(","))].join("\n");
      
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `lich_su_thue_hoc_${user.email.split('@')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Đã xuất file báo cáo CSV!");
  };

  // Lọc danh sách lịch sử dựa trên từ khoá tìm kiếm & bộ lọc trạng thái
  const filteredHistory = history.filter(item => {
    const matchesSearch = 
      (item.name || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.className || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.studentId || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.school || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.notes || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.phone || "").toLowerCase().includes(searchTerm.toLowerCase());
      
    const matchesStatus = statusFilter === "all" || item.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      {systemSettings?.announcement && (
        <div style={{
          background: "linear-gradient(90deg, #d97706, #f59e0b)",
          color: "white",
          padding: "8px 15px",
          borderRadius: "12px",
          fontSize: "0.85rem",
          fontWeight: "600",
          boxShadow: "0 4px 6px -1px rgba(0,0,0,0.05)"
        }}>
          <marquee scrollamount="5" style={{ verticalAlign: "middle" }}>📢 {systemSettings.announcement}</marquee>
        </div>
      )}

      {/* TABS SELECTOR */}
      <div 
        className="hide-scrollbar" 
        style={{ 
          display: "flex", 
          gap: "10px", 
          borderBottom: "1px solid #e2e8f0", 
          paddingBottom: "10px",
          overflowX: "auto",
          whiteSpace: "nowrap",
          WebkitOverflowScrolling: "touch"
        }}
      >
        <button 
          onClick={() => setActiveTab("schedules")}
          style={{
            flexShrink: 0,
            background: activeTab === "schedules" ? "var(--primary)" : "white",
            color: activeTab === "schedules" ? "white" : "var(--text-secondary)",
            border: "1px solid #cbd5e1",
            borderRadius: "10px",
            padding: "8px 16px",
            fontWeight: "700",
            fontSize: "0.9rem",
            cursor: "pointer",
            boxShadow: activeTab === "schedules" ? "0 4px 10px rgba(22, 163, 74, 0.15)" : "none",
            transition: "all 0.2s"
          }}
        >
          📅 Đăng đơn & Lịch học
        </button>
        <button 
          onClick={() => setActiveTab("wallet")}
          style={{
            flexShrink: 0,
            background: activeTab === "wallet" ? "var(--primary)" : "white",
            color: activeTab === "wallet" ? "white" : "var(--text-secondary)",
            border: "1px solid #cbd5e1",
            borderRadius: "10px",
            padding: "8px 16px",
            fontWeight: "700",
            fontSize: "0.9rem",
            cursor: "pointer",
            boxShadow: activeTab === "wallet" ? "0 4px 10px rgba(22, 163, 74, 0.15)" : "none",
            transition: "all 0.2s"
          }}
        >
          💰 Ví số dư & Cổng nạp tiền
        </button>
      </div>

      {activeTab === "schedules" ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(380px, 1fr))", gap: "2.5rem" }}>
      
      {/* LEFT COLUMN: Upload Form */}
      <div className="glass-panel dashboard-panel">
        <div style={{ marginBottom: "2rem" }}>
          <h2 className="page-title" style={{ fontSize: "1.6rem", margin: 0, display: "flex", alignItems: "center", gap: "10px" }}>
            <svg style={{ width: "24px", height: "24px", color: "var(--primary)" }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"></path></svg>
            Tạo đơn thuê học mới
          </h2>
          <p style={{ color: "var(--text-secondary)", fontSize: "0.9rem", marginTop: "0.5rem" }}>
            Vui lòng điền thông tin và đính kèm ảnh chụp lịch cần học hộ rõ nét.
          </p>
        </div>
        
        <form onSubmit={handleSubmit}>
          <div className="form-grid">
            <div className="form-group" style={{ gridColumn: "1 / -1" }}>
              <label className="form-label">Họ và Tên</label>
              <input type="text" name="name" value={formData.name} onChange={handleChange} required className="form-input" placeholder="Ví dụ: Nguyễn Văn A" />
            </div>
            
            <div className="form-group">
              <label className="form-label">Mã sinh viên</label>
              <input type="text" name="studentId" value={formData.studentId} onChange={handleChange} required className="form-input" placeholder="SV123456" />
            </div>

            <div className="form-group">
              <label className="form-label">Lớp</label>
              <input type="text" name="className" value={formData.className} onChange={handleChange} required className="form-input" placeholder="IT1" />
            </div>

            <div className="form-group" style={{ gridColumn: "1 / -1" }}>
              <label className="form-label">Trường</label>
              <input type="text" name="school" value={formData.school} onChange={handleChange} required className="form-input" placeholder="Ví dụ: Đại học Công nghệ" />
            </div>

            <div className="form-group">
              <label className="form-label">Ngày sinh</label>
              <input type="date" name="dob" value={formData.dob} onChange={handleChange} className="form-input" />
            </div>

            <div className="form-group">
              <label className="form-label">Số điện thoại</label>
              <input type="tel" name="phone" value={formData.phone} onChange={handleChange} className="form-input" placeholder="Ví dụ: 0912345678" />
            </div>

            <div className="form-group">
              <label className="form-label">
                Ngày học
                {weekday && <span style={{ marginLeft: "10px", color: "var(--primary)", fontSize: "0.85rem", fontWeight: "bold" }}>({weekday})</span>}
              </label>
              <input type="date" name="classDate" value={formData.classDate} onChange={handleChange} className="form-input" min={minDate} />
            </div>

            <div className="form-group">
              <label className="form-label">Từ mấy giờ</label>
              <input 
                type="text" 
                name="startTime" 
                value={formData.startTime} 
                onChange={(e) => {
                  let val = e.target.value.replace(/[^0-9:]/g, "");
                  if (val.length === 2 && !val.includes(":")) {
                    val += ":";
                  }
                  if (val.length <= 5) {
                    setFormData({ ...formData, startTime: val });
                  }
                }} 
                onBlur={(e) => {
                  const regex = /^(0[0-9]|1[0-9]|2[0-3]):[0-5][0-9]$/;
                  if (e.target.value && !regex.test(e.target.value)) {
                    toast.error("Giờ bắt đầu phải đúng định dạng 24h (Ví dụ: 08:30 hoặc 14:00)");
                  }
                }}
                className="form-input" 
                placeholder="Ví dụ: 14:30" 
              />
            </div>

            <div className="form-group">
              <label className="form-label">Đến mấy giờ</label>
              <input 
                type="text" 
                name="endTime" 
                value={formData.endTime} 
                onChange={(e) => {
                  let val = e.target.value.replace(/[^0-9:]/g, "");
                  if (val.length === 2 && !val.includes(":")) {
                    val += ":";
                  }
                  if (val.length <= 5) {
                    setFormData({ ...formData, endTime: val });
                  }
                }} 
                onBlur={(e) => {
                  const regex = /^(0[0-9]|1[0-9]|2[0-3]):[0-5][0-9]$/;
                  if (e.target.value && !regex.test(e.target.value)) {
                    toast.error("Giờ kết thúc phải đúng định dạng 24h (Ví dụ: 17:30 hoặc 20:00)");
                  }
                }}
                className="form-input" 
                placeholder="Ví dụ: 17:00" 
              />
            </div>

            <div className="form-group" style={{ gridColumn: "1 / -1" }}>
              <label className="form-label">Mức giá đề xuất (VNĐ)</label>
              <input type="text" name="price" value={formData.price} onChange={handleChange} className="form-input" placeholder="Ví dụ: 50.000" />
            </div>

            <div className="form-group" style={{ gridColumn: "1 / -1" }}>
              <label className="form-label">Ghi chú (Không bắt buộc)</label>
              <textarea name="notes" value={formData.notes} onChange={handleChange} className="form-input" rows="3" placeholder="Ghi chú thêm (VD: mang theo thẻ sinh viên...)" style={{ resize: "vertical" }}></textarea>
            </div>
          </div>

          <div className="form-group" style={{ marginTop: "0.5rem" }}>
            <label className="form-label">Ảnh lịch cần học hộ</label>
            <label 
              htmlFor="file-input" 
              className="file-input" 
              style={{ 
                padding: filePreview ? "0.5rem" : "2.5rem 1rem", 
                border: filePreview ? "2px solid var(--primary-light)" : "2px dashed #cbd5e1",
                display: "flex", 
                flexDirection: "column", 
                alignItems: "center", 
                justifyContent: "center",
                gap: "10px",
                position: "relative",
                overflow: "hidden"
              }}
            >
              {filePreview ? (
                <div style={{ position: "relative", width: "100%" }}>
                  <img src={filePreview} alt="Preview" style={{ width: "100%", height: "200px", objectFit: "cover", borderRadius: "8px" }} />
                  <div style={{ position: "absolute", bottom: "10px", left: "10px", right: "10px", background: "rgba(0,0,0,0.6)", color: "white", padding: "5px 10px", borderRadius: "6px", fontSize: "0.85rem", backdropFilter: "blur(4px)" }}>
                    {fileName || "Đang xử lý ảnh..."}
                  </div>
                </div>
              ) : (
                <>
                  <div style={{ width: "50px", height: "50px", background: "var(--primary-light)", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--primary)", marginBottom: "8px" }}>
                    <svg style={{ width: "24px", height: "24px" }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"></path></svg>
                  </div>
                  <div style={{ color: "var(--text-secondary)", fontSize: "0.95rem", fontWeight: "600", marginBottom: "4px" }}>
                    Nhấn chọn ảnh hoặc <kbd style={{ padding: "3px 8px", background: "#f1f5f9", borderRadius: "4px", border: "1px solid #cbd5e1", fontSize: "0.85rem", color: "var(--primary)", fontFamily: "monospace", margin: "0 4px", boxShadow: "0 2px 0 #cbd5e1" }}>Ctrl + V</kbd> để dán
                  </div>
                  <div style={{ color: "#9CA3AF", fontSize: "0.8rem" }}>
                    Hỗ trợ JPG, PNG (tự động nén siêu tốc)
                  </div>
                </>
              )}
              <input type="file" id="file-input" accept="image/*" onChange={handleFileChange} required style={{ display: "none" }} />
            </label>
          </div>
          
          <div className="form-group" style={{ marginBottom: "1.5rem" }}>
            <label className="form-label" style={{ fontWeight: "700", display: "block", marginBottom: "6px" }}>Phương thức thanh toán</label>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
              <div 
                onClick={() => setPaymentMethod("qr")}
                style={{ 
                  padding: "10px 15px", border: paymentMethod === "qr" ? "2px solid var(--primary)" : "2px solid #e2e8f0", borderRadius: "12px", cursor: "pointer", background: paymentMethod === "qr" ? "rgba(22, 163, 74, 0.03)" : "white", display: "flex", flexDirection: "column", gap: "4px", transition: "all 0.2s"
                }}
              >
                <span style={{ fontSize: "0.85rem", fontWeight: "700", color: paymentMethod === "qr" ? "var(--primary)" : "var(--text-primary)" }}>📸 Chuyển khoản QR</span>
                <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>Nhận VietQR sau khi tạo đơn</span>
              </div>
              <div 
                onClick={() => {
                  const priceNumeric = formData.price ? Number(formData.price.replace(/\./g, "")) : 0;
                  if ((userProfile?.balance || 0) < priceNumeric) {
                    toast.error("Số dư tài khoản không đủ để thanh toán. Vui lòng nạp thêm tiền!");
                    return;
                  }
                  setPaymentMethod("wallet");
                }}
                style={{ 
                  padding: "10px 15px", border: paymentMethod === "wallet" ? "2px solid var(--primary)" : "2px solid #e2e8f0", borderRadius: "12px", cursor: "pointer", background: paymentMethod === "wallet" ? "rgba(22, 163, 74, 0.03)" : "white", display: "flex", flexDirection: "column", gap: "4px", transition: "all 0.2s", opacity: (userProfile?.balance || 0) <= 0 ? 0.5 : 1
                }}
              >
                <span style={{ fontSize: "0.85rem", fontWeight: "700", color: paymentMethod === "wallet" ? "var(--primary)" : "var(--text-primary)" }}>💳 Ví tài khoản (Trừ tiền)</span>
                <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>Số dư hiện có: {(userProfile?.balance || 0).toLocaleString("vi-VN")} đ</span>
              </div>
            </div>
          </div>
          
          {uploading && (
            <div style={{ marginBottom: "1.5rem", background: "#f8fafc", padding: "1rem", borderRadius: "12px", border: "1px solid #e2e8f0" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.5rem", fontSize: "0.85rem", fontWeight: "600", color: "var(--primary)" }}>
                <span>Đang xử lý và tải lên...</span>
                <span>{Math.round(progress)}%</span>
              </div>
              <div style={{ height: "8px", background: "#E5E7EB", borderRadius: "4px", overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${progress}%`, background: "linear-gradient(90deg, var(--primary), var(--secondary))", transition: "width 0.2s" }}></div>
              </div>
            </div>
          )}

          <button type="submit" className="btn btn-primary" style={{ width: "100%", padding: "1rem", fontSize: "1.05rem", borderRadius: "12px" }} disabled={uploading}>
            {uploading ? (
              <span style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <svg className="animate-spin" style={{ width: "20px", height: "20px", animation: "spin 1s linear infinite" }} fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" style={{ opacity: 0.25 }}></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" style={{ opacity: 0.75 }}></path></svg>
                Hệ thống đang xử lý...
              </span>
            ) : "Gửi đơn thuê học"}
          </button>
        </form>
      </div>

      {/* RIGHT COLUMN: History */}
      <div className="glass-panel dashboard-panel" style={{ display: "flex", flexDirection: "column" }}>
        
        {/* Tiêu đề & Xuất CSV */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
          <h2 className="page-title" style={{ fontSize: "1.6rem", margin: 0 }}>Lịch sử của bạn</h2>
          <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
            {history.length > 0 && (
              <button 
                onClick={exportToCSV}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  background: "var(--primary-light)",
                  color: "var(--primary)",
                  border: "none",
                  padding: "0.4rem 0.8rem",
                  borderRadius: "8px",
                  fontSize: "0.85rem",
                  fontWeight: "600",
                  cursor: "pointer"
                }}
              >
                <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
                Xuất Excel/CSV
              </button>
            )}
            <span style={{ background: "var(--primary-light)", color: "var(--primary)", padding: "0.3rem 0.8rem", borderRadius: "20px", fontSize: "0.85rem", fontWeight: "700" }}>
              {history.length} mục
            </span>
          </div>
        </div>

        {/* Ô BÁO CÁO THỐNG KÊ ĐỘNG */}
        {history.length > 0 && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "10px", marginBottom: "1.5rem" }}>
            <div style={{ background: "#f8fafc", padding: "10px", borderRadius: "12px", textAlign: "center", border: "1px solid #e2e8f0" }}>
              <div style={{ fontSize: "1.2rem", fontWeight: "800", color: "var(--text-primary)" }}>{stats.total}</div>
              <div style={{ fontSize: "0.7rem", color: "var(--text-secondary)", fontWeight: "600", marginTop: "2px" }}>Tổng đơn</div>
            </div>
            <div style={{ background: "rgba(245, 158, 11, 0.05)", padding: "10px", borderRadius: "12px", textAlign: "center", border: "1px solid rgba(245, 158, 11, 0.2)" }}>
              <div style={{ fontSize: "1.2rem", fontWeight: "800", color: "#D97706" }}>{stats.pending}</div>
              <div style={{ fontSize: "0.7rem", color: "#D97706", fontWeight: "600", marginTop: "2px" }}>Chờ duyệt</div>
            </div>
            <div style={{ background: "rgba(59, 130, 246, 0.05)", padding: "10px", borderRadius: "12px", textAlign: "center", border: "1px solid rgba(59, 130, 246, 0.2)" }}>
              <div style={{ fontSize: "1.2rem", fontWeight: "800", color: "#3B82F6" }}>{stats.inProgress}</div>
              <div style={{ fontSize: "0.7rem", color: "#3B82F6", fontWeight: "600", marginTop: "2px" }}>Đang học</div>
            </div>
            <div style={{ background: "rgba(16, 185, 129, 0.05)", padding: "10px", borderRadius: "12px", textAlign: "center", border: "1px solid rgba(16, 185, 129, 0.2)" }}>
              <div style={{ fontSize: "1.2rem", fontWeight: "800", color: "var(--success)" }}>{stats.completed}</div>
              <div style={{ fontSize: "0.7rem", color: "var(--success)", fontWeight: "600", marginTop: "2px" }}>Hoàn thành</div>
            </div>
            <div style={{ gridColumn: "1 / -1", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
              <div style={{ background: "rgba(139, 92, 246, 0.05)", padding: "10px", borderRadius: "12px", display: "flex", justifyContent: "space-between", alignItems: "center", border: "1px solid rgba(139, 92, 246, 0.2)", paddingLeft: "12px", paddingRight: "12px" }}>
                <span style={{ fontSize: "0.75rem", color: "#8B5CF6", fontWeight: "700" }}>💸 Đã chi:</span>
                <span style={{ fontSize: "0.9rem", fontWeight: "800", color: "#8B5CF6" }}>{stats.totalSpent.toLocaleString("vi-VN")} đ</span>
              </div>
              <div style={{ background: "rgba(22, 163, 74, 0.05)", padding: "10px", borderRadius: "12px", display: "flex", justifyContent: "space-between", alignItems: "center", border: "1px solid rgba(22, 163, 74, 0.2)", paddingLeft: "12px", paddingRight: "12px" }}>
                <span style={{ fontSize: "0.75rem", color: "var(--primary)", fontWeight: "700" }}>💰 Số dư Ví:</span>
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <span style={{ fontSize: "0.9rem", fontWeight: "800", color: "var(--primary)" }}>{(userProfile?.balance || 0).toLocaleString("vi-VN")} đ</span>
                  <button 
                    type="button"
                    onClick={() => setShowWalletModal(true)} 
                    style={{ background: "var(--primary)", color: "white", border: "none", borderRadius: "6px", padding: "2px 6px", fontSize: "0.65rem", fontWeight: "700", cursor: "pointer" }}
                  >
                    Nạp
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* THANH TÌM KIẾM & LỌC TRẠNG THÁI */}
        {history.length > 0 && (
          <div style={{ display: "flex", gap: "10px", marginBottom: "1.5rem" }}>
            <div style={{ flex: 1, position: "relative" }}>
              <input 
                type="text" 
                placeholder="Tìm môn học, lớp, MSSV, SĐT..." 
                value={searchTerm} 
                onChange={(e) => setSearchTerm(e.target.value)} 
                style={{
                  width: "100%",
                  padding: "0.6rem 0.8rem",
                  borderRadius: "10px",
                  border: "1px solid #cbd5e1",
                  fontSize: "0.85rem",
                  background: "rgba(255,255,255,0.8)"
                }}
              />
            </div>
            <select 
              value={statusFilter} 
              onChange={(e) => setStatusFilter(e.target.value)}
              style={{
                padding: "0.6rem 0.8rem",
                borderRadius: "10px",
                border: "1px solid #cbd5e1",
                fontSize: "0.85rem",
                background: "white",
                fontWeight: "600",
                color: "var(--text-primary)",
                cursor: "pointer"
              }}
            >
              <option value="all">Tất cả trạng thái</option>
              <option value="pending">Chờ nhận đơn</option>
              <option value="approved">Sắp học</option>
              <option value="in_progress">Đang học</option>
              <option value="completed">Hoàn thành</option>
              <option value="rejected">Từ chối</option>
            </select>
            <div style={{ display: "flex", gap: "2px", background: "#f1f5f9", padding: "4px", borderRadius: "10px" }}>
              <button 
                type="button"
                onClick={() => setHistoryView("list")}
                style={{
                  border: "none",
                  background: historyView === "list" ? "white" : "transparent",
                  color: historyView === "list" ? "var(--primary)" : "var(--text-secondary)",
                  padding: "6px 12px",
                  borderRadius: "8px",
                  fontSize: "0.8rem",
                  fontWeight: "700",
                  cursor: "pointer",
                  boxShadow: historyView === "list" ? "0 2px 5px rgba(0,0,0,0.05)" : "none",
                  transition: "all 0.2s"
                }}
              >
                Danh sách
              </button>
              <button 
                type="button"
                onClick={() => setHistoryView("calendar")}
                style={{
                  border: "none",
                  background: historyView === "calendar" ? "white" : "transparent",
                  color: historyView === "calendar" ? "var(--primary)" : "var(--text-secondary)",
                  padding: "6px 12px",
                  borderRadius: "8px",
                  fontSize: "0.8rem",
                  fontWeight: "700",
                  cursor: "pointer",
                  boxShadow: historyView === "calendar" ? "0 2px 5px rgba(0,0,0,0.05)" : "none",
                  transition: "all 0.2s"
                }}
              >
                Lịch biểu
              </button>
            </div>
          </div>
        )}
        
        {loadingHistory ? (
          <div className="loader"></div>
        ) : historyView === "calendar" ? (
          renderCalendar()
        ) : filteredHistory.length === 0 ? (
          /* EMPTY STATE */
          <div style={{ textAlign: "center", padding: "4rem 1rem", flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
            <div style={{ width: "120px", height: "120px", background: "white", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "1.5rem", boxShadow: "0 10px 25px rgba(0,0,0,0.05)" }}>
              <svg style={{ width: "60px", height: "60px", color: "#cbd5e1" }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path></svg>
            </div>
            <h3 style={{ fontSize: "1.2rem", fontWeight: "700", color: "var(--text-primary)", marginBottom: "0.5rem" }}>
              {history.length > 0 ? "Không tìm thấy kết quả" : "Chưa có dữ liệu nào"}
            </h3>
            <p style={{ color: "var(--text-secondary)", fontSize: "0.95rem", maxWidth: "80%" }}>
              {history.length > 0 ? "Thử nhập từ khóa tìm kiếm hoặc đổi bộ lọc trạng thái khác xem sao." : "Trông có vẻ trống vắng quá! Hãy sử dụng biểu mẫu bên trái để tạo đơn thuê học đầu tiên của mình nhé."}
            </p>
          </div>
        ) : (
          /* Lịch sử List */
          <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem", overflowY: "auto", maxHeight: "550px", paddingRight: "0.5rem" }}>
            {filteredHistory.map(item => (
              <div 
                key={item.id} 
                onClick={() => setSelectedItem(item)}
                className="history-card" 
                onMouseOver={e => {e.currentTarget.style.transform="translateY(-2px)"; e.currentTarget.style.boxShadow="0 8px 20px rgba(0,0,0,0.05)"}} 
                onMouseOut={e => {e.currentTarget.style.transform="translateY(0)"; e.currentTarget.style.boxShadow="none"}}
              >
                <div style={{ position: "relative" }}>
                  <img src={item.imageUrl} alt="Lịch" style={{ width: "90px", height: "90px", objectFit: "cover", borderRadius: "10px", border: "1px solid #f1f5f9" }} />
                </div>
                
                <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.4rem", flexWrap: "wrap", gap: "6px" }}>
                    <h4 style={{ margin: 0, fontSize: "1.05rem", fontWeight: "700", color: "var(--text-primary)" }}>{item.name}</h4>
                    <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                      {getStatusBadge(item.status)}
                      {getPaymentStatusBadge(item.status)}
                    </div>
                  </div>
                  
                  <div style={{ fontSize: "0.85rem", color: "var(--text-secondary)", display: "flex", alignItems: "center", gap: "6px", marginBottom: "0.4rem" }}>
                    <svg style={{ width: "14px", height: "14px" }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"></path></svg>
                    {item.school} • {item.className}
                  </div>
 
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "auto" }}>
                    <p style={{ margin: 0, fontSize: "0.8rem", color: "#9CA3AF", fontWeight: "500" }}>
                      Ngày học: {item.classDate ? new Date(item.classDate).toLocaleDateString("vi-VN") : "Chưa chọn"}
                    </p>
                    
                    {item.status !== "approved" && item.status !== "in_progress" && item.status !== "completed" && (
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(item.id);
                        }}
                        style={{ display: "flex", alignItems: "center", gap: "4px", background: "rgba(239, 68, 68, 0.1)", border: "none", color: "var(--danger)", cursor: "pointer", padding: "0.4rem 0.6rem", borderRadius: "8px", fontSize: "0.8rem", fontWeight: "600", transition: "all 0.2s" }}
                        title="Xóa lịch này"
                        onMouseOver={e => e.currentTarget.style.background="rgba(239, 68, 68, 0.2)"}
                        onMouseOut={e => e.currentTarget.style.background="rgba(239, 68, 68, 0.1)"}
                      >
                        <svg style={{ width: "14px", height: "14px" }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                        Hủy bỏ
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      </div>
      ) : (
        /* WALLET & TRANSACTION HISTORY TAB VIEW */
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(380px, 1fr))", gap: "2.5rem" }}>
          {/* Cổng nạp tiền */}
          <div className="glass-panel" style={{ padding: "2rem" }}>
            <h2 style={{ fontSize: "1.5rem", fontWeight: "800", color: "var(--text-primary)", display: "flex", alignItems: "center", gap: "10px", marginBottom: "1rem" }}>
              💸 Cổng nạp tiền Ví
            </h2>
            <p style={{ color: "var(--text-secondary)", fontSize: "0.9rem", marginBottom: "1.5rem" }}>
              Nạp tiền vào ví số dư để thanh toán đơn thuê học nhanh chóng và tự động (Admin duyệt tức thì).
            </p>

            <div style={{ background: "rgba(22, 163, 74, 0.05)", padding: "1.5rem", borderRadius: "16px", display: "flex", justifyContent: "space-between", alignItems: "center", border: "1px solid rgba(22, 163, 74, 0.2)", marginBottom: "1.5rem" }}>
              <div>
                <span style={{ fontSize: "0.85rem", color: "var(--text-secondary)", fontWeight: "600" }}>Số dư hiện tại:</span>
                <h3 style={{ fontSize: "1.8rem", color: "var(--primary)", fontWeight: "800", margin: "5px 0 0 0" }}>{(userProfile?.balance || 0).toLocaleString("vi-VN")} đ</h3>
              </div>
              <div style={{ background: "var(--primary)", color: "white", padding: "10px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"></path></svg>
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: "1.25rem" }}>
              <label className="form-label" style={{ fontWeight: "700" }}>Chọn số tiền muốn nạp</label>
              <select 
                value={topupAmount} 
                onChange={(e) => setTopupAmount(e.target.value)}
                className="form-input"
                style={{ background: "white" }}
              >
                <option value="50000">50.000 VNĐ</option>
                <option value="100000">100.000 VNĐ</option>
                <option value="200000">200.000 VNĐ</option>
                <option value="500000">500.000 VNĐ</option>
                <option value="1000000">1.000.000 VNĐ</option>
              </select>
            </div>

            {systemSettings?.bankAccount && (
              <div style={{ background: "rgba(22, 163, 74, 0.02)", padding: "1.25rem", borderRadius: "16px", border: "1px dashed var(--primary)", marginBottom: "1.5rem", textAlign: "center" }}>
                <strong style={{ color: "var(--primary)", fontSize: "0.9rem", display: "block", marginBottom: "8px" }}>QUÉT MÃ QR BẰNG APP NGÂN HÀNG</strong>
                
                <div style={{ display: "flex", justifyContent: "center", marginBottom: "12px" }}>
                  <img 
                    src={`https://img.vietqr.io/image/${systemSettings.bankName}-${systemSettings.bankAccount}-compact.png?amount=${topupAmount}&addInfo=THUENAP%20${user.uid.substring(0, 6).toUpperCase()}&accountName=${encodeURIComponent(systemSettings.bankOwner)}`} 
                    alt="VietQR Topup" 
                    style={{ width: "180px", height: "180px", objectFit: "contain", border: "1px solid #cbd5e1", borderRadius: "12px", padding: "5px", background: "white" }} 
                  />
                </div>

                <div style={{ fontSize: "0.85rem", textAlign: "left", background: "white", padding: "10px 12px", borderRadius: "10px", border: "1px solid #e2e8f0", boxSizing: "border-box" }}>
                  <strong>Ngân hàng:</strong> {systemSettings.bankName}<br/>
                  <strong>Số tài khoản:</strong> {systemSettings.bankAccount}<br/>
                  <strong>Chủ tài khoản:</strong> {systemSettings.bankOwner}<br/>
                  <strong>Nội dung CK:</strong> <span style={{ fontWeight: "800", color: "var(--primary)", fontFamily: "monospace" }}>THUENAP {user.uid.substring(0, 6).toUpperCase()}</span>
                </div>
                <span style={{ fontSize: "0.72rem", color: "var(--danger)", fontWeight: "600", display: "block", marginTop: "8px" }}>⚠️ Chuyển khoản đúng nội dung trên để hệ thống tự ghi nhận ví!</span>
              </div>
            )}

            <button 
              type="button" 
              onClick={handleTopupRequest}
              className="btn btn-primary"
              style={{ width: "100%", padding: "0.8rem", borderRadius: "12px" }}
            >
              Tôi đã chuyển tiền nạp ví
            </button>
          </div>

          {/* Lịch sử giao dịch ví */}
          <div className="glass-panel" style={{ padding: "2rem", display: "flex", flexDirection: "column" }}>
            <h2 style={{ fontSize: "1.5rem", fontWeight: "800", color: "var(--text-primary)", display: "flex", alignItems: "center", gap: "10px", marginBottom: "1rem" }}>
              ⏳ Lịch sử biến động số dư
            </h2>
            <p style={{ color: "var(--text-secondary)", fontSize: "0.9rem", marginBottom: "1.5rem" }}>
              Danh sách chi tiêu từ ví và các giao dịch nạp tiền của bạn.
            </p>

            <div style={{ flex: 1, maxHeight: "500px", overflowY: "auto" }}>
              {loadingTransactions ? (
                <div style={{ textAlign: "center", padding: "2rem" }} className="loader"></div>
              ) : transactions.length === 0 ? (
                <div style={{ textAlign: "center", padding: "4rem 1rem", color: "var(--text-secondary)", fontSize: "0.9rem", fontStyle: "italic" }}>
                  Chưa có giao dịch ví nào được thực hiện.
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  {transactions.map(t => {
                    const isPayment = t.type === "payment";
                    const isPending = t.status === "pending";
                    return (
                      <div 
                        key={t.id} 
                        style={{
                          padding: "1rem", 
                          borderRadius: "16px", 
                          border: "1px solid #cbd5e1", 
                          background: isPending ? "rgba(245, 158, 11, 0.02)" : "white",
                          display: "flex", 
                          justifyContent: "space-between", 
                          alignItems: "center"
                        }}
                      >
                        <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                          <strong style={{ fontSize: "0.88rem", color: "var(--text-primary)", textAlign: "left" }}>{t.message}</strong>
                          <span style={{ fontSize: "0.72rem", color: "var(--text-secondary)", textAlign: "left" }}>
                            {t.createdAt ? new Date(t.createdAt.toDate()).toLocaleString("vi-VN") : ""}
                          </span>
                          <span style={{ 
                            fontSize: "0.72rem", 
                            fontWeight: "700",
                            textAlign: "left",
                            color: isPending ? "#d97706" : (t.status === "completed" ? "var(--success)" : "var(--danger)")
                          }}>
                            {isPending ? "⏳ Đang đối soát" : (t.status === "completed" ? "✓ Đã thành công" : "✗ Từ chối")}
                          </span>
                        </div>
                        <div style={{
                          fontWeight: "800",
                          fontSize: "1rem",
                          color: isPayment ? "var(--danger)" : "var(--success)"
                        }}>
                          {isPayment ? "-" : "+"}{Number(t.amount).toLocaleString("vi-VN")} đ
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* OVERLAY MODAL: HIỂN THỊ CHI TIẾT ĐƠN HÀNG */}
      {selectedItem && (
        <div 
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0,0,0,0.5)",
            backdropFilter: "blur(6px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: "1.5rem",
            animation: "fadeIn 0.2s ease"
          }} 
          onClick={() => setSelectedItem(null)}
        >
          <div 
            style={{
              background: "white",
              borderRadius: "24px",
              padding: "2rem",
              maxWidth: "600px",
              width: "100%",
              maxHeight: "90vh",
              overflowY: "auto",
              boxShadow: "0 25px 50px -12px rgba(0,0,0,0.25)",
              border: "1px solid #e2e8f0"
            }} 
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem", borderBottom: "1px solid #f1f5f9", paddingBottom: "1rem" }}>
              <h3 style={{ margin: 0, fontSize: "1.4rem", fontWeight: "800", color: "var(--text-primary)" }}>Chi tiết đơn thuê học</h3>
              <button 
                onClick={() => setSelectedItem(null)} 
                style={{ 
                  background: "rgba(0,0,0,0.05)", 
                  border: "none", 
                  fontSize: "1.2rem", 
                  cursor: "pointer", 
                  color: "#64748b",
                  width: "32px",
                  height: "32px",
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center"
                }}
              >
                &times;
              </button>
            </div>
            
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.2rem", marginBottom: "1.5rem", fontSize: "0.95rem" }}>
              <div style={{ borderBottom: "1px dashed #f1f5f9", paddingBottom: "8px" }}>
                <strong style={{ color: "var(--text-secondary)", fontSize: "0.8rem", display: "block" }}>HỌ TÊN SINH VIÊN</strong>
                <span style={{ fontWeight: "700" }}>{selectedItem.name}</span>
              </div>
              <div style={{ borderBottom: "1px dashed #f1f5f9", paddingBottom: "8px" }}>
                <strong style={{ color: "var(--text-secondary)", fontSize: "0.8rem", display: "block" }}>MÃ SINH VIÊN</strong>
                <span style={{ fontWeight: "700" }}>{selectedItem.studentId}</span>
              </div>
              <div style={{ borderBottom: "1px dashed #f1f5f9", paddingBottom: "8px" }}>
                <strong style={{ color: "var(--text-secondary)", fontSize: "0.8rem", display: "block" }}>LỚP HỌC</strong>
                <span>{selectedItem.className}</span>
              </div>
              <div style={{ borderBottom: "1px dashed #f1f5f9", paddingBottom: "8px" }}>
                <strong style={{ color: "var(--text-secondary)", fontSize: "0.8rem", display: "block" }}>TRƯỜNG HỌC</strong>
                <span>{selectedItem.school}</span>
              </div>
              <div style={{ borderBottom: "1px dashed #f1f5f9", paddingBottom: "8px" }}>
                <strong style={{ color: "var(--text-secondary)", fontSize: "0.8rem", display: "block" }}>SỐ ĐIỆN THOẠI</strong>
                <span>{selectedItem.phone || "Không cung cấp"}</span>
              </div>
              <div style={{ borderBottom: "1px dashed #f1f5f9", paddingBottom: "8px" }}>
                <strong style={{ color: "var(--text-secondary)", fontSize: "0.8rem", display: "block" }}>NGÀY SINH</strong>
                <span>{selectedItem.dob ? new Date(selectedItem.dob).toLocaleDateString("vi-VN") : "Không cung cấp"}</span>
              </div>
              <div style={{ borderBottom: "1px dashed #f1f5f9", paddingBottom: "8px" }}>
                <strong style={{ color: "var(--text-secondary)", fontSize: "0.8rem", display: "block" }}>LỊCH HỌC</strong>
                <span style={{ fontWeight: "700", color: "var(--primary)" }}>{selectedItem.classDate ? new Date(selectedItem.classDate).toLocaleDateString("vi-VN") : ""} ({selectedItem.weekday})</span>
              </div>
              <div style={{ borderBottom: "1px dashed #f1f5f9", paddingBottom: "8px" }}>
                <strong style={{ color: "var(--text-secondary)", fontSize: "0.8rem", display: "block" }}>KHUNG GIỜ</strong>
                <span style={{ fontWeight: "700" }}>⏱️ {selectedItem.startTime} - {selectedItem.endTime}</span>
              </div>
              <div style={{ borderBottom: "1px dashed #f1f5f9", paddingBottom: "8px" }}>
                <strong style={{ color: "var(--text-secondary)", fontSize: "0.8rem", display: "block" }}>MỨC GIÁ ĐỀ XUẤT</strong>
                <span style={{ fontWeight: "800", color: "#8B5CF6" }}>{selectedItem.price ? `${Number(selectedItem.price).toLocaleString("vi-VN")} VNĐ` : "Chưa có"}</span>
              </div>
              <div style={{ borderBottom: "1px dashed #f1f5f9", paddingBottom: "8px" }}>
                <strong style={{ color: "var(--text-secondary)", fontSize: "0.8rem", display: "block" }}>TRẠNG THÁI LỊCH</strong>
                {getStatusBadge(selectedItem.status)}
              </div>
              <div style={{ borderBottom: "1px dashed #f1f5f9", paddingBottom: "8px" }}>
                <strong style={{ color: "var(--text-secondary)", fontSize: "0.8rem", display: "block" }}>TRẠNG THÁI THANH TOÁN</strong>
                {getPaymentStatusBadge(selectedItem.status)}
              </div>
              {selectedItem.status === "completed" && (
                <div style={{ borderBottom: "1px dashed #f1f5f9", paddingBottom: "8px", gridColumn: "1 / -1" }}>
                  <strong style={{ color: "var(--text-secondary)", fontSize: "0.8rem", display: "block", marginBottom: "4px" }}>ĐÁNH GIÁ DỊCH VỤ DÀNH CHO BẠN</strong>
                  {selectedItem.reviewed ? (
                    <span style={{ color: "var(--success)", fontWeight: "600", fontSize: "0.9rem" }}>⭐ Bạn đã gửi nhận xét đánh giá môn học này.</span>
                  ) : (
                    <button
                      onClick={() => {
                        setReviewItem(selectedItem);
                        setShowReviewModal(true);
                      }}
                      className="btn"
                      style={{
                        padding: "6px 12px",
                        background: "linear-gradient(90deg, #f59e0b, #d97706)",
                        color: "white",
                        border: "none",
                        borderRadius: "8px",
                        fontWeight: "700",
                        cursor: "pointer",
                        fontSize: "0.8rem",
                        boxShadow: "0 2px 6px rgba(245, 158, 11, 0.3)"
                      }}
                    >
                      ⭐ Viết nhận xét đánh giá 5 sao
                    </button>
                  )}
                </div>
              )}

              {/* VIETQR AUTOMATIC PAYMENT BLOCK */}
              {systemSettings?.bankAccount && selectedItem.price && selectedItem.status !== "rejected" && (
                <div style={{ 
                  gridColumn: "1 / -1", 
                  background: "rgba(22, 163, 74, 0.03)", 
                  padding: "1.5rem", 
                  borderRadius: "16px", 
                  border: "1px dashed var(--primary)",
                  textAlign: "center",
                  marginTop: "1rem"
                }}>
                  <strong style={{ color: "var(--primary)", fontSize: "0.95rem", display: "block", marginBottom: "8px" }}>💳 THANH TOÁN CHUYỂN KHOẢN VIETQR</strong>
                  <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)", margin: "0 0 12px 0" }}>
                    Quét mã QR dưới đây bằng ứng dụng Ngân hàng để thanh toán nhanh chóng.
                  </p>
                  
                  <div style={{ display: "flex", justifyContent: "center", marginBottom: "12px" }}>
                    <img 
                      src={`https://img.vietqr.io/image/${systemSettings.bankName}-${systemSettings.bankAccount}-compact.png?amount=${selectedItem.price}&addInfo=THUEHOC%20${selectedItem.id.substring(0, 8).toUpperCase()}&accountName=${encodeURIComponent(systemSettings.bankOwner)}`} 
                      alt="VietQR Payment" 
                      style={{ 
                        width: "200px", 
                        height: "200px", 
                        objectFit: "contain", 
                        border: "1px solid #cbd5e1", 
                        borderRadius: "12px", 
                        padding: "5px",
                        background: "white"
                      }} 
                    />
                  </div>
                  
                  <div style={{ fontSize: "0.85rem", textAlign: "left", display: "inline-block", background: "white", padding: "10px 15px", borderRadius: "10px", border: "1px solid #e2e8f0", width: "100%", boxSizing: "border-box" }}>
                    <strong>Ngân hàng:</strong> {systemSettings.bankName}<br/>
                    <strong>Số tài khoản:</strong> {systemSettings.bankAccount}<br/>
                    <strong>Chủ tài khoản:</strong> {systemSettings.bankOwner}<br/>
                    <strong>Số tiền:</strong> <span style={{ fontWeight: "700", color: "#8B5CF6" }}>{Number(selectedItem.price).toLocaleString("vi-VN")} VNĐ</span><br/>
                    <strong>Nội dung CK:</strong> <span style={{ fontWeight: "700", color: "var(--primary)", fontFamily: "monospace" }}>THUEHOC {selectedItem.id.substring(0, 8).toUpperCase()}</span>
                  </div>

                  {selectedItem.status === "pending" && (
                    <button
                      onClick={() => handleConfirmPayment(selectedItem.id, selectedItem.name, selectedItem.price)}
                      className="btn btn-primary"
                      style={{
                        width: "100%",
                        marginTop: "1rem",
                        padding: "0.8rem",
                        borderRadius: "12px",
                        fontSize: "0.95rem"
                      }}
                    >
                      Tôi đã chuyển tiền
                    </button>
                  )}
                </div>
              )}

              <div style={{ gridColumn: "1 / -1", background: "#f8fafc", padding: "12px", borderRadius: "10px" }}>
                <strong style={{ color: "var(--text-secondary)", fontSize: "0.8rem", display: "block", marginBottom: "4px" }}>GHI CHÚ HỌC TẬP</strong>
                <span style={{ fontStyle: "italic" }}>{selectedItem.notes || "Không có ghi chú thêm."}</span>
              </div>
            </div>

            {selectedItem.imageUrl && (
              <div style={{ marginTop: "1.5rem" }}>
                <strong style={{ display: "block", color: "var(--text-primary)", fontSize: "0.85rem", marginBottom: "0.5rem" }}>📷 ẢNH LỊCH HỌC ĐÍNH KÈM</strong>
                <a href={selectedItem.imageUrl} target="_blank" rel="noreferrer" title="Click để phóng to ảnh">
                  <img src={selectedItem.imageUrl} alt="Lịch học" style={{ width: "100%", borderRadius: "12px", border: "1px solid #cbd5e1", maxHeight: "300px", objectFit: "contain", background: "#f1f5f9", cursor: "zoom-in" }} />
                </a>
              </div>
            )}
          </div>
        </div>
      )}

      {/* POPUP THANH TOÁN TỨC THÌ (KHI TẠO ĐƠN THÀNH CÔNG) */}
      {showPaymentModal && newOrderInfo && (
        <div 
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0,0,0,0.6)",
            backdropFilter: "blur(8px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1001,
            padding: "1.5rem",
            animation: "fadeIn 0.2s ease"
          }}
          onClick={() => setShowPaymentModal(false)}
        >
          <div 
            style={{
              background: "white",
              borderRadius: "24px",
              padding: "2rem",
              maxWidth: "500px",
              width: "100%",
              maxHeight: "90vh",
              overflowY: "auto",
              boxShadow: "0 25px 50px -12px rgba(0,0,0,0.3)",
              border: "1px solid #e2e8f0",
              textAlign: "center"
            }}
            onClick={e => e.stopPropagation()}
          >
            {/* Icon chúc mừng */}
            <div style={{
              width: "60px",
              height: "60px",
              background: "rgba(16, 185, 129, 0.1)",
              color: "var(--success)",
              borderRadius: "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 1rem auto"
            }}>
              <svg style={{ width: "30px", height: "30px" }} fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>

            <h3 style={{ margin: "0 0 0.5rem 0", fontSize: "1.4rem", fontWeight: "800", color: "var(--success)" }}>Đăng Đơn Thành Công!</h3>
            <p style={{ margin: "0 0 1.5rem 0", fontSize: "0.9rem", color: "var(--text-secondary)", lineHeight: "1.5" }}>
              Đơn hàng của bạn đã được ghi nhận. Vui lòng chuyển khoản quét mã QR bên dưới để Admin duyệt lịch học nhanh nhất.
            </p>

            {/* Tóm tắt đơn */}
            <div style={{ 
              background: "#f8fafc", 
              padding: "1rem", 
              borderRadius: "16px", 
              fontSize: "0.85rem", 
              textAlign: "left", 
              border: "1px solid #e2e8f0",
              marginBottom: "1.5rem"
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.4rem" }}>
                <span style={{ color: "var(--text-secondary)" }}>Sinh viên:</span>
                <strong style={{ color: "var(--text-primary)" }}>{newOrderInfo.name} ({newOrderInfo.studentId})</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.4rem" }}>
                <span style={{ color: "var(--text-secondary)" }}>Lịch học:</span>
                <strong style={{ color: "var(--text-primary)" }}>{newOrderInfo.classDate ? new Date(newOrderInfo.classDate).toLocaleDateString("vi-VN") : ""} ({newOrderInfo.weekday})</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "var(--text-secondary)" }}>Giá đề xuất:</span>
                <strong style={{ color: "#8B5CF6", fontSize: "0.95rem" }}>{Number(newOrderInfo.price).toLocaleString("vi-VN")} VNĐ</strong>
              </div>
            </div>

            {/* VietQR tự sinh */}
            {systemSettings?.bankAccount && (
              <div style={{ 
                background: "rgba(22, 163, 74, 0.02)", 
                padding: "1.25rem", 
                borderRadius: "16px", 
                border: "1px dashed var(--primary)",
                marginBottom: "1.5rem"
              }}>
                <div style={{ display: "flex", justifyContent: "center", marginBottom: "1rem" }}>
                  <img 
                    src={`https://img.vietqr.io/image/${systemSettings.bankName}-${systemSettings.bankAccount}-compact.png?amount=${newOrderInfo.price}&addInfo=THUEHOC%20${newOrderInfo.id.substring(0, 8).toUpperCase()}&accountName=${encodeURIComponent(systemSettings.bankOwner)}`} 
                    alt="VietQR Payment" 
                    style={{ 
                      width: "180px", 
                      height: "180px", 
                      objectFit: "contain", 
                      border: "1px solid #cbd5e1", 
                      borderRadius: "12px", 
                      padding: "5px",
                      background: "white"
                    }} 
                  />
                </div>
                
                <div style={{ fontSize: "0.85rem", textAlign: "left", background: "white", padding: "10px 12px", borderRadius: "10px", border: "1px solid #e2e8f0", display: "inline-block", width: "100%", boxSizing: "border-box" }}>
                  <strong>Ngân hàng:</strong> {systemSettings.bankName}<br/>
                  <strong>Số tài khoản:</strong> {systemSettings.bankAccount}<br/>
                  <strong>Chủ tài khoản:</strong> {systemSettings.bankOwner}<br/>
                  <strong>Nội dung CK:</strong> <span style={{ fontWeight: "700", color: "var(--primary)", fontFamily: "monospace" }}>THUEHOC {newOrderInfo.id.substring(0, 8).toUpperCase()}</span>
                </div>
              </div>
            )}

            {/* Nút báo chuyển tiền */}
            <button 
              onClick={() => handleConfirmPayment(newOrderInfo.id, newOrderInfo.name, newOrderInfo.price)}
              className="btn btn-primary"
              style={{ width: "100%", padding: "0.8rem", borderRadius: "12px", fontSize: "0.95rem" }}
            >
              Tôi đã chuyển tiền
            </button>
          </div>
        </div>
      )}

      {/* POPUP NẠP TIỀN VÀO VÍ TÀI KHOẢN */}
      {showWalletModal && (
        <div 
          style={{
            position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
            background: "rgba(0,0,0,0.6)", backdropFilter: "blur(6px)",
            display: "flex", alignItems: "center", justifyContent: "center",
            zIndex: 1001, padding: "1.5rem"
          }}
          onClick={() => setShowWalletModal(false)}
        >
          <div 
            style={{
              background: "white", borderRadius: "24px", padding: "2rem",
              maxWidth: "480px", width: "100%", border: "1px solid #e2e8f0"
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
              <h3 style={{ margin: 0, fontSize: "1.25rem", fontWeight: "800", color: "var(--text-primary)" }}>Nạp tiền vào ví số dư</h3>
              <button onClick={() => setShowWalletModal(false)} style={{ background: "none", border: "none", fontSize: "1.5rem", cursor: "pointer", color: "#64748b" }}>&times;</button>
            </div>

            <div className="form-group" style={{ marginBottom: "1.25rem" }}>
              <label className="form-label" style={{ fontWeight: "700" }}>Số tiền nạp (VNĐ)</label>
              <select 
                value={topupAmount} 
                onChange={(e) => setTopupAmount(e.target.value)}
                className="form-input"
                style={{ background: "white" }}
              >
                <option value="50000">50.000 VNĐ</option>
                <option value="100000">100.000 VNĐ</option>
                <option value="200000">200.000 VNĐ</option>
                <option value="500000">500.000 VNĐ</option>
                <option value="1000000">1.000.000 VNĐ</option>
              </select>
            </div>

            {systemSettings?.bankAccount && (
              <div style={{ background: "rgba(22, 163, 74, 0.02)", padding: "1.25rem", borderRadius: "16px", border: "1px dashed var(--primary)", marginBottom: "1.5rem", textAlign: "center" }}>
                <strong style={{ color: "var(--primary)", fontSize: "0.9rem", display: "block", marginBottom: "8px" }}>QUÉT QR ĐỂ NẠP TIỀN TỰ ĐỘNG</strong>
                
                <div style={{ display: "flex", justifyContent: "center", marginBottom: "12px" }}>
                  <img 
                    src={`https://img.vietqr.io/image/${systemSettings.bankName}-${systemSettings.bankAccount}-compact.png?amount=${topupAmount}&addInfo=THUENAP%20${user.uid.substring(0, 6).toUpperCase()}&accountName=${encodeURIComponent(systemSettings.bankOwner)}`} 
                    alt="VietQR Topup" 
                    style={{ width: "170px", height: "170px", objectFit: "contain", border: "1px solid #cbd5e1", borderRadius: "12px", padding: "5px", background: "white" }} 
                  />
                </div>

                <div style={{ fontSize: "0.82rem", textAlign: "left", background: "white", padding: "10px", borderRadius: "10px", border: "1px solid #e2e8f0" }}>
                  <strong>Số tài khoản:</strong> {systemSettings.bankAccount} ({systemSettings.bankName})<br/>
                  <strong>Chủ tài khoản:</strong> {systemSettings.bankOwner}<br/>
                  <strong>Nội dung CK:</strong> <span style={{ fontWeight: "800", color: "var(--primary)", fontFamily: "monospace" }}>THUENAP {user.uid.substring(0, 6).toUpperCase()}</span>
                </div>
                <span style={{ fontSize: "0.72rem", color: "var(--danger)", fontWeight: "600", display: "block", marginTop: "8px" }}>⚠️ Chuyển khoản đúng nội dung trên để hệ thống tự ghi nhận ví!</span>
              </div>
            )}

            <button 
              type="button" 
              onClick={handleTopupRequest}
              className="btn btn-primary"
              style={{ width: "100%", padding: "0.8rem", borderRadius: "12px" }}
            >
              Tôi đã chuyển tiền nạp ví
            </button>
          </div>
        </div>
      )}

      {/* POPUP ĐÁNH GIÁ DỊCH VỤ 5 SAO */}
      {showReviewModal && reviewItem && (
        <div 
          style={{
            position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
            background: "rgba(0,0,0,0.6)", backdropFilter: "blur(6px)",
            display: "flex", alignItems: "center", justifyContent: "center",
            zIndex: 1001, padding: "1.5rem"
          }}
          onClick={() => setShowReviewModal(false)}
        >
          <form 
            onSubmit={handleSubmitReview}
            style={{
              background: "white", borderRadius: "24px", padding: "2rem",
              maxWidth: "480px", width: "100%", border: "1px solid #e2e8f0"
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem" }}>
              <h3 style={{ margin: 0, fontSize: "1.25rem", fontWeight: "800", color: "var(--text-primary)" }}>Đánh giá lịch học hộ</h3>
              <button type="button" onClick={() => setShowReviewModal(false)} style={{ background: "none", border: "none", fontSize: "1.5rem", cursor: "pointer", color: "#64748b" }}>&times;</button>
            </div>

            <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)", marginBottom: "1.25rem" }}>
              Hãy để lại đánh giá của bạn cho môn <strong>{reviewItem.className}</strong> tại <strong>{reviewItem.school}</strong> để giúp cải thiện dịch vụ.
            </p>

            <div style={{ display: "flex", justifyContent: "center", gap: "10px", marginBottom: "1.5rem" }}>
              {[1, 2, 3, 4, 5].map((star) => (
                <span 
                  key={star} 
                  onClick={() => setRating(star)}
                  style={{ fontSize: "2rem", cursor: "pointer", color: star <= rating ? "#FBBC05" : "#cbd5e1", transition: "color 0.1s" }}
                >
                  ★
                </span>
              ))}
            </div>

            <div className="form-group" style={{ marginBottom: "1.5rem" }}>
              <label className="form-label" style={{ fontWeight: "700" }}>Nhận xét / Feedback</label>
              <textarea 
                value={reviewText} 
                onChange={(e) => setReviewText(e.target.value)}
                required
                className="form-input" 
                rows="4" 
                placeholder="Tuyệt vời! Bạn học hộ đi đúng giờ và làm bài kiểm tra điểm rất cao. Sẽ tiếp tục ủng hộ Thuê Học Pro!"
                style={{ resize: "none", background: "white", padding: "0.8rem" }}
              ></textarea>
            </div>

            <button 
              type="submit" 
              className="btn btn-primary"
              style={{ width: "100%", padding: "0.8rem", borderRadius: "12px", background: "linear-gradient(90deg, #f59e0b, #d97706)" }}
              disabled={submittingReview}
            >
              {submittingReview ? "Đang gửi nhận xét..." : "Gửi Đánh Giá Ngay"}
            </button>
          </form>
        </div>
      )}

    </div>
  );
}
