"use client";

import { useState, useEffect, Suspense } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter, useSearchParams } from "next/navigation";
import { db, storage } from "@/lib/firebase";
import { collection, addDoc, serverTimestamp, query, where, orderBy, onSnapshot, doc, deleteDoc, updateDoc, increment, setDoc } from "firebase/firestore";
import { ref, uploadString, getDownloadURL } from "firebase/storage";
import toast from "react-hot-toast";
import imageCompression from "browser-image-compression";

function Dashboard() {
  const { user, loading, isAdmin, systemSettings, sendTelegramAlert } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab");

  const [formData, setFormData] = useState({
    name: "",
    className: "",
    classRegular: "",
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
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurringWeeks, setRecurringWeeks] = useState(1);
  const [taskInput, setTaskInput] = useState("");
  const [sessionTasks, setSessionTasks] = useState([]);
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
  const [selectedBadges, setSelectedBadges] = useState([]);
  const [activeTab, setActiveTab] = useState("schedules"); // "schedules" or "wallet"
  const handleActiveTabChange = (tab) => {
    setActiveTab(tab);
    setTimeout(() => {
      const el = document.getElementById("dashboard-active-content");
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }, 50);
  };
  const [transactions, setTransactions] = useState([]);
  const [loadingTransactions, setLoadingTransactions] = useState(true);
  const [reviews, setReviews] = useState([]);
  const [loadingReviews, setLoadingReviews] = useState(true);
  const [submittingTopup, setSubmittingTopup] = useState(false);

  // Cộng tác viên (CTV) state
  const [openJobs, setOpenJobs] = useState([]);
  const [myJobs, setMyJobs] = useState([]);
  const [myInternalJobs, setMyInternalJobs] = useState([]);
  const [ctvJobsView, setCtvJobsView] = useState("list"); // "list" or "calendar"
  const [ctvSearchTerm, setCtvSearchTerm] = useState("");
  const [ctvCurrentDate, setCtvCurrentDate] = useState(new Date());
  const [ctvSelectedDay, setCtvSelectedDay] = useState(new Date());
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);
  const [isCTVMode, setIsCTVMode] = useState(false);
  const [ctvActiveTab, setCtvActiveTab] = useState("job_board"); // "job_board" or "my_jobs"
  const [showPayoutModal, setShowPayoutModal] = useState(false);
  const [payoutAmount, setPayoutAmount] = useState("");
  const [payoutBankName, setPayoutBankName] = useState("MBBank");
  const [payoutBankAccount, setPayoutBankAccount] = useState("");
  const [payoutBankOwner, setPayoutBankOwner] = useState("");
  const [showProofModal, setShowProofModal] = useState(false);
  const [selectedJobForProof, setSelectedJobForProof] = useState(null);
  const [proofFile, setProofFile] = useState(null);
  const [submittingProof, setSubmittingProof] = useState(false);
  const [lightboxImage, setLightboxImage] = useState(null);
  const [showLiveTrackerModal, setShowLiveTrackerModal] = useState(false);
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [hasDraft, setHasDraft] = useState(false);

  // 1. Tự động điền (Smart Autofill) thông tin cá nhân từ lịch sử đặt lịch gần nhất hoặc hồ sơ
  useEffect(() => {
    if (history && history.length > 0) {
      const latest = history[0];
      setFormData(prev => {
        return {
          ...prev,
          name: prev.name || latest.name || userProfile?.name || "",
          studentId: prev.studentId || latest.studentId || userProfile?.studentId || "",
          classRegular: prev.classRegular || latest.classRegular || userProfile?.classRegular || "",
          school: prev.school || latest.school || userProfile?.school || "",
          phone: prev.phone || latest.phone || userProfile?.phone || "",
          dob: prev.dob || latest.dob || userProfile?.dob || ""
        };
      });
    } else if (userProfile) {
      setFormData(prev => {
        return {
          ...prev,
          name: prev.name || userProfile.name || "",
          studentId: prev.studentId || userProfile.studentId || "",
          classRegular: prev.classRegular || userProfile.classRegular || "",
          school: prev.school || userProfile.school || "",
          phone: prev.phone || userProfile.phone || "",
          dob: prev.dob || userProfile.dob || ""
        };
      });
    }
  }, [history, userProfile]);

  // 2. Lưu trữ bản nháp (Preserve Draft) tự động vào localStorage khi người dùng nhập liệu
  useEffect(() => {
    if (user && (formData.className || formData.notes || formData.price)) {
      localStorage.setItem(`booking_draft_${user.uid}`, JSON.stringify(formData));
    }
  }, [formData, user]);

  // 3. Kiểm tra sự tồn tại của bản nháp khi tải trang
  useEffect(() => {
    if (user) {
      const saved = localStorage.getItem(`booking_draft_${user.uid}`);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (parsed.className || parsed.notes || parsed.price) {
            setHasDraft(true);
          }
        } catch (e) {
          console.error("Lỗi đọc bản nháp:", e);
        }
      }
    }
  }, [user]);

  // 4. Trích xuất danh sách môn học đã đặt gần đây của học viên
  const getRecentSubjects = () => {
    const subjects = [];
    const seen = new Set();
    for (const h of history) {
      if (h.className && !seen.has(h.className.toLowerCase())) {
        seen.add(h.className.toLowerCase());
        subjects.push({
          className: h.className,
          startTime: h.startTime || "",
          endTime: h.endTime || "",
          school: h.school || "",
          classRegular: h.classRegular || "",
          price: h.price || ""
        });
        if (subjects.length >= 4) break;
      }
    }
    return subjects;
  };

  // 5. Khôi phục bản nháp
  const handleRestoreDraft = () => {
    if (user) {
      const saved = localStorage.getItem(`booking_draft_${user.uid}`);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          setFormData(parsed);
          setHasDraft(false);
        } catch (e) {}
      }
    }
  };

  // 6. Xóa bản nháp
  const handleClearDraft = () => {
    if (user) {
      localStorage.removeItem(`booking_draft_${user.uid}`);
      setHasDraft(false);
    }
  };

  const handleDisputeOrder = async (orderId) => {
    const reason = prompt("Vui lòng nhập lý do khiếu nại ca học này (Ví dụ: CTV không đi học hộ, chép bài thiếu...):");
    if (!reason) return;
    try {
      await updateDoc(doc(db, "schedules", orderId), {
        status: "disputed",
        disputeReason: reason,
        disputedAt: serverTimestamp()
      });
      setSelectedItem(prev => ({
        ...prev,
        status: "disputed",
        disputeReason: reason
      }));
      toast.success("Đã gửi khiếu nại thành công! Nhân viên và Admin sẽ giải quyết trong thời gian sớm nhất.");
      sendTelegramAlert(`🚨 <b>ĐƠN HÀNG BỊ KHIẾU NẠI!</b>\n\n• <b>Mã đơn:</b> ${orderId.substring(0,8).toUpperCase()}\n• <b>Lý do:</b> ${reason}\n• <b>Thời gian:</b> ${new Date().toLocaleString("vi-VN")}`);
    } catch (err) {
      console.error("Lỗi khiếu nại:", err);
      toast.error("Không thể gửi khiếu nại.");
    }
  };

  useEffect(() => {
    if (!loading) {
      if (!user) {
        router.push("/");
      } else if (isAdmin) {
        router.push("/admin");
      }
    }
  }, [user, loading, isAdmin, router]);

  useEffect(() => {
    if (tabParam) {
      setActiveTab(tabParam);
    }
  }, [tabParam]);

  const [requestedHelper, setRequestedHelper] = useState("");
  const [requestedHelperEmail, setRequestedHelperEmail] = useState("");

  useEffect(() => {
    const helperName = searchParams.get("helperName");
    const helperEmail = searchParams.get("helperEmail");
    if (helperName) {
      setRequestedHelper(decodeURIComponent(helperName));
    }
    if (helperEmail) {
      setRequestedHelperEmail(decodeURIComponent(helperEmail));
    }
  }, [searchParams]);

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

      // Lắng nghe tất cả reviews để CTV có thể lọc các nhận xét thuộc về mình
      const qReviews = query(collection(db, "reviews"));
      const unsubscribeReviews = onSnapshot(qReviews, (snapshot) => {
        const rData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        rData.sort((a, b) => {
          const timeA = a.createdAt ? a.createdAt.toMillis() : 0;
          const timeB = b.createdAt ? b.createdAt.toMillis() : 0;
          return timeB - timeA;
        });
        setReviews(rData);
        setLoadingReviews(false);
      }, (err) => {
        console.error("Lỗi tải reviews:", err);
        setLoadingReviews(false);
      });

      // Lấy danh sách chợ đơn cho CTV
      let unsubscribeOpenJobs = () => {};
      let unsubscribeMyJobs = () => {};

      if (userProfile?.role === "helper" || userProfile?.role === "admin") {
        const qOpen = query(
          collection(db, "schedules"),
          where("status", "in", ["paid", "accepted", "in_progress"])
        );
        unsubscribeOpenJobs = onSnapshot(qOpen, (snapshot) => {
          const openData = snapshot.docs
            .map(doc => ({ id: doc.id, ...doc.data() }))
            .filter(s => !s.helperId);
          setOpenJobs(openData);
        }, (err) => console.error("Lỗi tải chợ đơn:", err));

        const qMyJobs = query(
          collection(db, "schedules"),
          where("helperId", "==", user.uid)
        );
        unsubscribeMyJobs = onSnapshot(qMyJobs, (snapshot) => {
          const myData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          myData.sort((a, b) => {
            const dateA = new Date(a.classDate);
            const dateB = new Date(b.classDate);
            return dateB - dateA;
          });
          setMyJobs(myData);
        }, (err) => console.error("Lỗi tải lớp đã nhận:", err));
      }

      return () => { 
        unsubscribe(); 
        unsubscribeProfile(); 
        unsubscribeTrans(); 
        unsubscribeReviews();
        unsubscribeOpenJobs();
        unsubscribeMyJobs();
      };
    }
  }, [user, userProfile?.role]);

  const [helperApplication, setHelperApplication] = useState(null);

  useEffect(() => {
    if (!user || !user.email) return;
    const q = query(collection(db, "helpers"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const myApp = snapshot.docs
        .map(d => d.data())
        .find(h => h.email?.toLowerCase() === user.email.toLowerCase());
      setHelperApplication(myApp || null);
    }, (err) => console.error("Lỗi tải thông tin ứng tuyển CTV:", err));
    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    let unsubscribeInternalJobs;
    if (user && (userProfile?.role === "helper" || userProfile?.role === "admin")) {
      const qInternal = query(collection(db, "internal_schedules"));
      unsubscribeInternalJobs = onSnapshot(qInternal, (snapshot) => {
        const allInternal = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data(), isInternal: true }));
        
        const myName = (helperApplication?.name || "").toLowerCase().trim();
        const myAlias = (helperApplication?.alias || "").toLowerCase().trim();
        const myEmail = (user?.email || "").toLowerCase().trim();
        const profileName = (userProfile?.name || "").toLowerCase().trim();
        const profileDisplayName = (userProfile?.displayName || "").toLowerCase().trim();

        const myInternalFiltered = allInternal.filter(s => {
          const assignedName = (s.helperName || "").toLowerCase().trim();
          if (!assignedName) return false;
          return (
            assignedName === myName ||
            assignedName === myAlias ||
            assignedName === profileName ||
            assignedName === profileDisplayName ||
            assignedName === myEmail
          );
        });
        
        myInternalFiltered.sort((a, b) => {
          const dateA = new Date(a.classDate);
          const dateB = new Date(b.classDate);
          return dateB - dateA;
        });

        setMyInternalJobs(myInternalFiltered);
      }, (err) => console.error("Lỗi tải lịch nội bộ CTV:", err));
    }
    return () => {
      if (unsubscribeInternalJobs) unsubscribeInternalJobs();
    };
  }, [user, userProfile?.role, helperApplication, userProfile?.name, userProfile?.displayName]);

  // Tự động điền thông tin học viên đã lưu từ hồ sơ người dùng
  useEffect(() => {
    if (userProfile) {
      setFormData(prev => ({
        ...prev,
        name: prev.name || userProfile.studentName || userProfile.displayName || "",
        studentId: prev.studentId || userProfile.studentId || "",
        classRegular: prev.classRegular || userProfile.classRegular || "",
        school: prev.school || userProfile.school || "",
        phone: prev.phone || userProfile.phone || ""
      }));
    }
  }, [userProfile]);

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

  if (loading || !user || isAdmin) {
    return <div className="loader"></div>;
  }





  const handleSubmit = async (e) => {
    e.preventDefault();

    // Chống spam gửi đơn thuê học liên tục (cooldown 30 giây)
    if (typeof window !== "undefined") {
      const lastOrderTime = localStorage.getItem("lastOrderTime");
      const now = Date.now();
      if (lastOrderTime) {
        const timeDiff = now - Number(lastOrderTime);
        const cooldownMs = 30000; // 30s
        if (timeDiff < cooldownMs) {
          const secondsLeft = Math.ceil((cooldownMs - timeDiff) / 1000);
          toast.error(`Bạn thao tác quá nhanh! Vui lòng đợi thêm ${secondsLeft} giây để đăng ký đơn thuê học tiếp theo.`);
          return;
        }
      }
    }

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
    const totalCost = priceNumeric * (isRecurring ? recurringWeeks : 1);

    if (paymentMethod === "wallet") {
      if ((userProfile?.balance || 0) < totalCost) {
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
      // 1. Trừ tiền ví trước nếu chọn thanh toán bằng ví (Trừ tổng giá trị combo)
      if (paymentMethod === "wallet") {
        await updateDoc(doc(db, "users", user.uid), {
          balance: increment(-totalCost)
        });
        
        // Ghi nhận lịch sử thanh toán ví
        await addDoc(collection(db, "transactions"), {
          userId: user.uid,
          userEmail: user.email,
          amount: totalCost,
          type: "payment",
          status: "completed",
          message: `Thanh toán ${isRecurring ? `combo ${recurringWeeks} tuần` : ""} đơn thuê học môn ${formData.className}`,
          createdAt: serverTimestamp()
        });
      }

      // Tạo mã nhóm nếu đặt lịch định kỳ
      const groupId = isRecurring ? "group_" + Date.now() + "_" + Math.random().toString(36).substring(2, 7) : "";
      const totalLoops = isRecurring ? recurringWeeks : 1;
      let lastDocRef = null;

      // Chuẩn bị danh sách nhiệm vụ ca học lưu trạng thái completed
      const formattedTasks = sessionTasks.map(t => ({ task: t, completed: false }));

      // Vòng lặp tạo đơn hàng loạt theo tuần
      for (let i = 0; i < totalLoops; i++) {
        const originalDate = new Date(formData.classDate);
        originalDate.setDate(originalDate.getDate() + i * 7);
        const finalDateStr = originalDate.toISOString().split("T")[0];
        
        const daysOfWeek = ["Chủ nhật", "Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy"];
        const finalWeekday = daysOfWeek[originalDate.getDay()];

        lastDocRef = await addDoc(collection(db, "schedules"), {
          userId: user.uid,
          userEmail: user.email || "No Email",
          name: formData.name,
          className: formData.className,
          classRegular: formData.classRegular || "",
          studentId: formData.studentId,
          school: formData.school,
          classDate: finalDateStr,
          startTime: formData.startTime,
          endTime: formData.endTime,
          dob: formData.dob,
          notes: formData.notes,
          phone: formData.phone,
          price: priceNumeric.toString(),
          weekday: finalWeekday,
          imageUrl: file, // Lưu trực tiếp chuỗi Base64
          status: paymentMethod === "wallet" ? "paid" : "pending",
          paymentMethod: paymentMethod,
          assignedTo: requestedHelper || "", // Gán thẳng nếu chỉ định CTV
          requestedHelper: requestedHelper || "",
          groupId: groupId,
          sessionTasks: formattedTasks,
          createdAt: serverTimestamp()
        });
      }

      const docRef = lastDocRef; // Dùng tham chiếu đơn cuối để hiển thị QR / Lưu trữ thông tin

      // Lưu thông tin học sinh vào hồ sơ người dùng để tự điền lần sau
      try {
        await updateDoc(doc(db, "users", user.uid), {
          studentName: formData.name,
          studentId: formData.studentId,
          className: formData.className,
          classRegular: formData.classRegular || "",
          school: formData.school,
          phone: formData.phone
        });
      } catch (profileErr) {
        console.error("Lỗi cập nhật hồ sơ người dùng:", profileErr);
      }

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
        `• <b>Lớp học cần hộ:</b> ${formData.className}\n` +
        (formData.classRegular ? `• <b>Lớp chính khóa:</b> ${formData.classRegular}\n` : "") +
        `• <b>Trường học:</b> ${formData.school}\n` +
        `• <b>Ngày học:</b> ${weekday} (${new Date(formData.classDate).toLocaleDateString("vi-VN")})${timeAlert}\n` +
        `• <b>Số điện thoại:</b> ${formData.phone}\n` +
        `• <b>Giá thuê:</b> ${formatPrice} VNĐ\n` +
        `• <b>Phương thức:</b> ${paymentInfo}\n` +
        (requestedHelper ? `• <b>CTV chỉ định:</b> ${requestedHelper}\n` : "") + `\n` +
        `<i>Vui lòng truy cập Bảng quản trị để phê duyệt lịch!</i>`;

      sendTelegramAlert(telegramText);

      // Tạo thông báo cho Admin
      await addDoc(collection(db, "notifications"), {
        userId: "admin",
        title: paymentMethod === "wallet" ? "Đơn thanh toán qua Ví" : "Đơn thuê học mới",
        message: `Sinh viên ${formData.name} đăng ký học môn ${formData.className} (${formData.classRegular || "N/A"}) (${formatPrice} đ).`,
        read: false,
        link: "/admin?tab=schedules",
        createdAt: serverTimestamp()
      });

      setProgress(100);

      // Ghi nhớ thời gian gửi đơn học thành công để chống spam
      if (typeof window !== "undefined") {
        localStorage.setItem("lastOrderTime", Date.now().toString());
        localStorage.removeItem(`booking_draft_${user.uid}`);
        setHasDraft(false);
      }

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
        name: userProfile?.studentName || userProfile?.displayName || "",
        studentId: userProfile?.studentId || "",
        className: "",
        classRegular: "",
        school: userProfile?.school || "",
        classDate: todayStr,
        startTime: "",
        endTime: "",
        dob: "",
        notes: "",
        phone: userProfile?.phone || "",
        price: "" 
      });
      setRequestedHelper("");
      setRequestedHelperEmail("");
      setIsRecurring(false);
      setRecurringWeeks(1);
      setSessionTasks([]);
      
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
    if (submittingTopup) return;

    // Chống spam gửi yêu cầu nạp tiền liên tục (cooldown 30 giây)
    if (typeof window !== "undefined") {
      const lastTopupTime = localStorage.getItem("lastTopupTime");
      const now = Date.now();
      if (lastTopupTime) {
        const timeDiff = now - Number(lastTopupTime);
        const cooldownMs = 30000; // 30s
        if (timeDiff < cooldownMs) {
          const secondsLeft = Math.ceil((cooldownMs - timeDiff) / 1000);
          toast.error(`Bạn thao tác quá nhanh! Vui lòng đợi thêm ${secondsLeft} giây để gửi yêu cầu nạp ví tiếp theo.`);
          return;
        }
      }
    }

    setSubmittingTopup(true);
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
        link: "/admin?tab=transactions",
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

      // Ghi nhớ thời gian gửi thành công
      if (typeof window !== "undefined") {
        localStorage.setItem("lastTopupTime", Date.now().toString());
      }

      toast.success("Đã gửi yêu cầu nạp ví thành công! Vui lòng chuyển khoản.", { id: "topup" });
      setShowWalletModal(false);
    } catch (err) {
      toast.error("Gửi yêu cầu thất bại!", { id: "topup" });
    } finally {
      setSubmittingTopup(false);
    }
  };

  const checkScheduleConflict = (schedulesList, helperId, helperName, targetClassDate, startTime, endTime, currentScheduleId) => {
    if (!targetClassDate || !startTime || !endTime) return null;
    
    const parseMinutes = (timeStr) => {
      if (!timeStr) return 0;
      const parts = timeStr.replace(/[^0-9:]/g, "").split(":");
      if (parts.length < 2) return 0;
      return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
    };

    const newStart = parseMinutes(startTime);
    const newEnd = parseMinutes(endTime);

    for (const s of schedulesList) {
      if (s.id === currentScheduleId) continue;
      if (s.status === "rejected" || s.status === "cancelled") continue;
      if (s.classDate !== targetClassDate) continue;

      const isSameHelper = 
        (s.helperId && helperId && s.helperId === helperId) ||
        (s.assignedTo && helperName && s.assignedTo.toLowerCase() === helperName.toLowerCase());

      if (!isSameHelper) continue;

      const sStart = parseMinutes(s.startTime);
      const sEnd = parseMinutes(s.endTime);

      if (sStart === 0 || sEnd === 0) continue;

      // Trùng giờ hoặc cách nhau dưới 30 phút
      if (Math.max(newStart, sStart) < Math.min(newEnd, sEnd) + 30) {
        return s;
      }
    }
    return null;
  };

  const handleGrabJob = async (job) => {
    const helperName = userProfile?.name || userProfile?.displayName || user.displayName || user.email;
    
    // CONFLICT SHIELD: Kiểm tra trùng ca
    const conflict = checkScheduleConflict(history, user.uid, helperName, job.classDate, job.startTime, job.endTime, job.id);
    if (conflict) {
      toast.error(`🛡️ CẢNH BÁO TRÙNG LỊCH: Bạn đã có ca học môn "${conflict.className}" (${conflict.startTime} - ${conflict.endTime}) cùng ngày!`, { duration: 6000 });
      return;
    }

    if (!confirm(`Bạn có chắc chắn muốn nhận lớp học hộ này không?`)) return;
    try {
      await updateDoc(doc(db, "schedules", job.id), {
        helperId: user.uid,
        assignedTo: helperName,
        status: "accepted"
      });
      toast.success("Chúc mừng! Bạn đã nhận lớp thành công.");

      // Gửi thông báo Telegram cho Admin
      const grabText = `🔔 <b>CTV NHẬN LỚP THÀNH CÔNG!</b>\n\n` +
        `• <b>CTV:</b> ${helperName} (${user.email})\n` +
        `• <b>Lớp học:</b> ${job.className}\n` +
        `• <b>Trường học:</b> ${job.school}\n` +
        `• <b>Ngày học:</b> ${new Date(job.classDate).toLocaleDateString("vi-VN")}\n\n` +
        `<i>Hệ thống đã tự động ghi nhận phân công công việc.</i>`;
      await sendTelegramAlert(grabText);
    } catch (err) {
      console.error("Lỗi nhận lớp:", err);
      toast.error("Không thể nhận lớp. Vui lòng thử lại!");
    }
  };

  const handleProofFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      const img = new Image();
      img.src = URL.createObjectURL(selectedFile);
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const MAX_WIDTH = 1280;
        const MAX_HEIGHT = 1280;
        let width = img.width;
        let height = img.height;
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
        const base64String = canvas.toDataURL("image/jpeg", 0.7);
        setProofFile(base64String);
      };
    }
  };

  const handleUploadProof = async () => {
    if (!proofFile) {
      toast.error("Vui lòng tải lên ảnh chụp minh chứng!");
      return;
    }
    setSubmittingProof(true);
    toast.loading("Đang gửi minh chứng...", { id: "proof" });
    try {
      if (selectedJobForProof.isInternal) {
        await updateDoc(doc(db, "internal_schedules", selectedJobForProof.id), {
          proofImage: proofFile,
          checkinStatus: "checked_in",
          studyStatus: "da_hoc"
        });
      } else {
        await updateDoc(doc(db, "schedules", selectedJobForProof.id), {
          helperProofImage: proofFile,
          helperProofTime: serverTimestamp(),
          status: "proof_submitted"
        });
      }
      toast.success("Báo cáo trực lớp thành công! Chờ Admin duyệt.", { id: "proof" });
      setShowProofModal(false);
      setProofFile(null);
      setSelectedJobForProof(null);

      // Gửi thông báo Telegram cho Admin
      const isInternalStr = selectedJobForProof.isInternal ? " [LỊCH NỘI BỘ]" : "";
      const proofText = `📸 <b>CTV BÁO CÁO HOÀN THÀNH LỚP${isInternalStr}!</b>\n\n` +
        `• <b>CTV:</b> ${userProfile?.name || user.email}\n` +
        `• <b>Môn học:</b> ${selectedJobForProof.className}\n` +
        `• <b>Ngày học:</b> ${new Date(selectedJobForProof.classDate).toLocaleDateString("vi-VN")}\n\n` +
        `<i>Vui lòng truy cập trang Admin để phê duyệt ảnh minh chứng và trả thù lao.</i>`;
      await sendTelegramAlert(proofText);
    } catch (err) {
      console.error("Lỗi nộp minh chứng:", err);
      toast.error("Không thể gửi báo cáo.", { id: "proof" });
    } finally {
      setSubmittingProof(false);
    }
  };

  const handleToggleTask = async (jobId, taskIndex, currentStatus) => {
    try {
      const updatedTasks = [...(selectedJobForProof.sessionTasks || [])];
      updatedTasks[taskIndex].completed = !currentStatus;
      
      // Cập nhật CSDL Firestore
      await updateDoc(doc(db, "schedules", jobId), {
        sessionTasks: updatedTasks
      });
      
      // Cập nhật local state
      setSelectedJobForProof(prev => ({
        ...prev,
        sessionTasks: updatedTasks
      }));
      toast.success("Đã cập nhật trạng thái nhiệm vụ!");
    } catch (err) {
      console.error("Lỗi cập nhật nhiệm vụ:", err);
      toast.error("Không thể cập nhật nhiệm vụ.");
    }
  };

  const handleUploadStepImage = async (stepNum, file) => {
    if (!file) return;
    toast.loading(`Đang tải ảnh bước ${stepNum}...`, { id: "step-upload" });
    
    // Nén ảnh bằng Canvas trước khi lưu vào Firestore dạng base64
    const img = new Image();
    img.src = URL.createObjectURL(file);
    img.onload = async () => {
      const canvas = document.createElement("canvas");
      const MAX_WIDTH = 1280;
      const MAX_HEIGHT = 1280;
      let width = img.width;
      let height = img.height;
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
      const base64String = canvas.toDataURL("image/jpeg", 0.7);

      try {
        const timeNow = new Date().toISOString();
        const updates = {};
        
        if (stepNum === 1) {
          updates.checkinStartImage = base64String;
          updates.checkinStartAt = timeNow;
        } else if (stepNum === 2) {
          updates.checkinMiddleImage = base64String;
          updates.checkinMiddleAt = timeNow;
        } else if (stepNum === 3) {
          updates.checkinEndImage = base64String;
          updates.checkinEndAt = timeNow;
          
          // Khi hoàn tất bước 3, tự động cập nhật trường hoàn thành chính để duy trì tính tương thích ngược
          if (selectedJobForProof.isInternal) {
            updates.proofImage = base64String;
            updates.checkinStatus = "checked_in";
            updates.studyStatus = "da_hoc";
          } else {
            updates.helperProofImage = base64String;
            updates.helperProofTime = serverTimestamp();
            updates.status = "proof_submitted";
          }
        }

        const docCollection = selectedJobForProof.isInternal ? "internal_schedules" : "schedules";
        await updateDoc(doc(db, docCollection, selectedJobForProof.id), updates);
        
        // Cập nhật selectedJobForProof để giao diện thay đổi lập tức
        setSelectedJobForProof(prev => ({
          ...prev,
          ...updates
        }));
        
        toast.success(`Đã lưu ảnh minh chứng Bước ${stepNum}!`, { id: "step-upload" });

        // Nếu đã hoàn thành Bước 3, bắn thông báo Telegram
        if (stepNum === 3) {
          const isInternalStr = selectedJobForProof.isInternal ? " [LỊCH NỘI BỘ]" : "";
          const proofText = `📸 <b>CTV BÁO CÁO HOÀN THÀNH LỚP${isInternalStr} (3 BƯỚC)!</b>\n\n` +
            `• <b>CTV:</b> ${userProfile?.name || user.email}\n` +
            `• <b>Môn học:</b> ${selectedJobForProof.className || selectedJobForProof.subject}\n` +
            `• <b>Ngày học:</b> ${new Date(selectedJobForProof.classDate).toLocaleDateString("vi-VN")}\n\n` +
            `<i>CTV đã hoàn thành đầy đủ 3 bước điểm danh thành công! Vui lòng duyệt thù lao.</i>`;
          await sendTelegramAlert(proofText);
          setShowProofModal(false);
        }
      } catch (err) {
        console.error("Lỗi lưu ảnh check-in:", err);
        toast.error("Không thể lưu ảnh minh chứng.", { id: "step-upload" });
      }
    };
  };

  const handlePayoutRequest = async (e) => {
    e.preventDefault();
    const amountNum = Number(payoutAmount);
    if (!amountNum || amountNum <= 0) {
      toast.error("Vui lòng nhập số tiền rút hợp lệ!");
      return;
    }
    if (amountNum > (userProfile?.helperBalance || 0)) {
      toast.error("Số dư thù lao trong ví không đủ!");
      return;
    }
    if (!payoutBankAccount.trim() || !payoutBankOwner.trim()) {
      toast.error("Vui lòng điền đầy đủ số tài khoản và tên chủ tài khoản!");
      return;
    }

    toast.loading("Đang gửi yêu cầu rút tiền...", { id: "payout" });
    try {
      // 1. Trừ tiền ví thù lao của CTV ngay lập tức để tránh double-spend
      await updateDoc(doc(db, "users", user.uid), {
        helperBalance: increment(-amountNum)
      });

      // 2. Tạo giao dịch rút tiền
      await addDoc(collection(db, "transactions"), {
        userId: user.uid,
        userEmail: user.email,
        amount: amountNum,
        type: "payout_request",
        status: "pending",
        bankName: payoutBankName,
        bankAccount: payoutBankAccount.trim(),
        bankOwner: payoutBankOwner.trim().toUpperCase(),
        message: `Rút thù lao CTV về ngân hàng ${payoutBankName}`,
        createdAt: serverTimestamp()
      });

      toast.success("Đã gửi yêu cầu rút thù lao thành công!", { id: "payout" });
      setShowPayoutModal(false);
      setPayoutAmount("");

      // Gửi thông báo Telegram cho Admin
      const payoutText = `💰 <b>YÊU CẦU RÚT THÙ LAO CTV MỚI!</b>\n\n` +
        `• <b>CTV:</b> ${userProfile?.name || user.email}\n` +
        `• <b>Số tiền rút:</b> ${amountNum.toLocaleString("vi-VN")} VNĐ\n` +
        `• <b>Ngân hàng:</b> ${payoutBankName}\n` +
        `• <b>Số tài khoản:</b> <code>${payoutBankAccount.trim()}</code>\n` +
        `• <b>Chủ tài khoản:</b> ${payoutBankOwner.trim().toUpperCase()}\n\n` +
        `<i>Vui lòng duyệt giao dịch và chuyển khoản cho CTV!</i>`;
      await sendTelegramAlert(payoutText);
    } catch (err) {
      console.error("Lỗi rút thù lao:", err);
      toast.error("Yêu cầu thất bại! Vui lòng thử lại.", { id: "payout" });
    }
  };

  const renderCTVWorkspace = () => {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
        
        {/* CTV Header & Ví thù lao */}
        <div className="glass-panel" style={{ padding: "1.5rem", display: "flex", justifyContent: "space-between", alignItems: "center", background: "linear-gradient(135deg, rgba(79,70,229,0.03) 0%, rgba(255,255,255,1) 100%)", borderLeft: "5px solid #4F46E5", flexWrap: "wrap", gap: "15px" }}>
          <div>
            <h3 style={{ margin: 0, fontSize: "1.1rem", color: "var(--text-primary)" }}>💼 Không gian Cộng Tác Viên: <span style={{ color: "#4F46E5" }}>{userProfile?.name || user.displayName || user.email}</span></h3>
            <p style={{ margin: "5px 0 0 0", fontSize: "0.85rem", color: "var(--text-secondary)" }}>
              Số dư ví thù lao tích lũy: <strong style={{ color: "#16a34a", fontSize: "1.2rem" }}>{(userProfile?.helperBalance || 0).toLocaleString("vi-VN")} đ</strong>
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setPayoutAmount("");
              setPayoutBankAccount("");
              setPayoutBankOwner(userProfile?.name || "");
              setShowPayoutModal(true);
            }}
            className="btn"
            style={{ background: "#4F46E5", color: "white", padding: "0.6rem 1.2rem", borderRadius: "10px", border: "none", fontWeight: "700", cursor: "pointer", fontSize: "0.85rem", boxShadow: "0 4px 10px rgba(79, 70, 229, 0.2)" }}
          >
            💸 Yêu cầu rút thù lao
          </button>
        </div>

        {/* Analytics calculations */}
        {(() => {
          const completedJobs = myJobs.filter(job => job.status === "completed");
          const inProgressJobs = myJobs.filter(job => job.status === "accepted" || job.status === "in_progress" || job.status === "proof_submitted");
          
          // Sum up base payout + staffTipAmount
          const totalEarned = completedJobs.reduce((sum, job) => {
            const proposedPriceNum = job.price ? Number(String(job.price).replace(/\./g, "")) : 0;
            const basePayout = job.payoutAmount !== undefined ? Number(job.payoutAmount) : Math.floor(proposedPriceNum * 0.75);
            const extraTip = job.staffTipAmount ? Number(job.staffTipAmount) : 0;
            return sum + basePayout + extraTip;
          }, 0);

          // Filter reviews belonging to this helper's completed jobs
          const myReviews = reviews.filter(r => myJobs.some(job => job.id === r.scheduleId));
          const averageStars = myReviews.length > 0 
            ? (myReviews.reduce((sum, r) => sum + r.rating, 0) / myReviews.length).toFixed(1) 
            : "N/A";

          // Save calculations on component scope dynamically for rendering
          renderCTVWorkspace.totalEarned = totalEarned;
          renderCTVWorkspace.completedJobs = completedJobs;
          renderCTVWorkspace.inProgressJobs = inProgressJobs;
          renderCTVWorkspace.myReviews = myReviews;
          renderCTVWorkspace.averageStars = averageStars;
          return null;
        })()}

        {/* CTV Tab buttons & Shift Status Switch */}
        <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: "15px", borderBottom: "1px solid #e2e8f0", paddingBottom: "15px", marginBottom: "1.5rem" }}>
          <div style={{ display: "flex", gap: "10px", overflowX: "auto" }}>
            <button
              type="button"
              onClick={() => setCtvActiveTab("job_board")}
              style={{
                flexShrink: 0,
                background: ctvActiveTab === "job_board" ? "#4F46E5" : "white",
                color: ctvActiveTab === "job_board" ? "white" : "var(--text-secondary)",
                border: "1px solid #cbd5e1",
                borderRadius: "10px",
                padding: "8px 16px",
                fontWeight: "750",
                fontSize: "0.85rem",
                cursor: "pointer",
                transition: "all 0.2s",
                boxShadow: ctvActiveTab === "job_board" ? "0 4px 8px rgba(79, 70, 229, 0.15)" : "none"
              }}
            >
              🛒 Chợ nhận lớp ({openJobs.length})
            </button>
            <button
              type="button"
              onClick={() => setCtvActiveTab("my_jobs")}
              style={{
                flexShrink: 0,
                background: ctvActiveTab === "my_jobs" ? "#4F46E5" : "white",
                color: ctvActiveTab === "my_jobs" ? "white" : "var(--text-secondary)",
                border: "1px solid #cbd5e1",
                borderRadius: "10px",
                padding: "8px 16px",
                fontWeight: "750",
                fontSize: "0.85rem",
                cursor: "pointer",
                transition: "all 0.2s",
                boxShadow: ctvActiveTab === "my_jobs" ? "0 4px 8px rgba(79, 70, 229, 0.15)" : "none"
              }}
            >
              📅 Lớp tôi nhận ({myJobs.length})
            </button>
            <button
              type="button"
              onClick={() => setCtvActiveTab("analytics")}
              style={{
                flexShrink: 0,
                background: ctvActiveTab === "analytics" ? "#4F46E5" : "white",
                color: ctvActiveTab === "analytics" ? "white" : "var(--text-secondary)",
                border: "1px solid #cbd5e1",
                borderRadius: "10px",
                padding: "8px 16px",
                fontWeight: "750",
                fontSize: "0.85rem",
                cursor: "pointer",
                transition: "all 0.2s",
                boxShadow: ctvActiveTab === "analytics" ? "0 4px 8px rgba(79, 70, 229, 0.15)" : "none"
              }}
            >
              📊 Thống kê & Thu nhập
            </button>
          </div>

          {/* Shift Status Switch */}
          <div style={{ display: "flex", alignItems: "center", gap: "10px", background: "white", padding: "6px 12px", borderRadius: "12px", border: "1px solid #cbd5e1" }}>
            <span style={{ fontSize: "0.82rem", fontWeight: "750", color: "var(--text-secondary)" }}>Trực ca:</span>
            <button
              type="button"
              onClick={async () => {
                const newStatus = userProfile?.shiftStatus === "online" ? "offline" : "online";
                try {
                  await updateDoc(doc(db, "users", user.uid), {
                    shiftStatus: newStatus
                  });
                  toast.success(`Đã chuyển trạng thái sang: ${newStatus === "online" ? "Đang trực ca 🟢" : "Nghỉ ca ⚪"}`);
                } catch (err) {
                  toast.error("Lỗi cập nhật trạng thái trực ca!");
                }
              }}
              style={{
                background: userProfile?.shiftStatus === "online" ? "#dcfce7" : "#f1f5f9",
                color: userProfile?.shiftStatus === "online" ? "#166534" : "#475569",
                border: "none",
                borderRadius: "8px",
                padding: "4px 10px",
                fontSize: "0.78rem",
                fontWeight: "750",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "5px",
                transition: "all 0.2s"
              }}
            >
              <span>{userProfile?.shiftStatus === "online" ? "Đang trực ca 🟢" : "Nghỉ ca ⚪"}</span>
            </button>
          </div>
        </div>

        {/* CTV Tab Views */}
        {ctvActiveTab === "job_board" && (
          <div>
            <div style={{
              background: "#eff6ff",
              border: "1px solid #dbeafe",
              borderRadius: "14px",
              padding: "1rem 1.25rem",
              marginBottom: "1.5rem",
              display: "flex",
              alignItems: "flex-start",
              gap: "12px",
              textAlign: "left",
              boxShadow: "0 2px 8px rgba(59, 130, 246, 0.05)"
            }}>
              <span style={{ fontSize: "1.3rem", lineHeight: "1" }}>💡</span>
              <div>
                <p style={{ margin: 0, fontSize: "0.85rem", fontWeight: "750", color: "#1d4ed8" }}>
                  Hướng dẫn nhận ca trực lớp học hộ
                </p>
                <p style={{ margin: "4px 0 0 0", fontSize: "0.78rem", color: "#1e40af", lineHeight: "1.5" }}>
                  Bạn hãy kiểm tra kỹ Trường, Ca học (ngày/giờ) và Lịch chụp đính kèm. Sau khi bấm <b>"Nhận Lớp Học Này"</b>, ca trực sẽ lưu vào tab <b>"Lớp tôi nhận"</b>. Bạn cần đi học đầy đủ đúng giờ và tải lên ảnh minh chứng hoàn thành để hệ thống thanh toán tự động thù lao.
                </p>
              </div>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem", flexWrap: "wrap", gap: "10px" }}>
              <h4 style={{ margin: 0, color: "var(--text-primary)" }}>🛒 Chợ đơn thuê học trực tuyến (Sắp học)</h4>
              <input 
                type="text"
                value={ctvSearchTerm}
                onChange={e => setCtvSearchTerm(e.target.value)}
                placeholder="🔍 Tìm kiếm môn học, trường..."
                style={{
                  padding: "6px 12px",
                  borderRadius: "8px",
                  border: "1px solid #cbd5e1",
                  fontSize: "0.82rem",
                  width: "240px",
                  maxWidth: "100%",
                  outline: "none"
                }}
              />
            </div>
            {(() => {
              const filteredOpenJobs = openJobs.filter(job => {
                const term = ctvSearchTerm.toLowerCase().trim();
                if (!term) return true;
                return (
                  (job.className || "").toLowerCase().includes(term) ||
                  (job.school || "").toLowerCase().includes(term) ||
                  (job.notes || "").toLowerCase().includes(term)
                );
              });

              if (filteredOpenJobs.length === 0) {
                return (
                  <div className="glass-panel" style={{ padding: "3rem", textAlign: "center", color: "var(--text-secondary)" }}>
                    {openJobs.length === 0 
                      ? "Hiện tại chưa có đơn thuê học mới nào cần cộng tác viên. Hãy quay lại sau!" 
                      : "Không tìm thấy ca học nào phù hợp với từ khóa của bạn."}
                  </div>
                );
              }

              return (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "1.25rem" }}>
                  {filteredOpenJobs.map((job) => {
                  const proposedPriceNum = job.price ? Number(String(job.price).replace(/\./g, "")) : 0;
                  const helperPayout = job.payoutAmount !== undefined ? Number(job.payoutAmount) : Math.floor(proposedPriceNum * 0.75);
                  return (
                    <div key={job.id} className="glass-panel" style={{ padding: "1.25rem", display: "flex", flexDirection: "column", gap: "10px", background: "white" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "10px" }}>
                        <strong style={{ fontSize: "1.05rem", color: "var(--text-primary)" }}>{job.className}</strong>
                        <span style={{ fontSize: "0.75rem", background: "rgba(79,70,229,0.1)", color: "#4F46E5", padding: "4px 8px", borderRadius: "8px", fontWeight: "700" }}>{job.school}</span>
                      </div>
                      
                      <div style={{ fontSize: "0.85rem", color: "var(--text-secondary)", display: "flex", flexDirection: "column", gap: "4px" }}>
                        <span>📅 Ngày học: <b>{job.weekday || ""} ({new Date(job.classDate).toLocaleDateString("vi-VN")})</b></span>
                        <span>🕒 Khung giờ: <b>{job.startTime} - {job.endTime}</b></span>
                        {job.notes && <span>📝 Ghi chú: {job.notes}</span>}
                      </div>

                      {/* Ảnh lịch học đăng lên */}
                      {(job.imageUrl || job.file) && (
                        <div style={{ margin: "5px 0" }}>
                          <span style={{ fontSize: "0.78rem", color: "var(--text-secondary)", display: "block", marginBottom: "4px" }}>📸 Lịch học:</span>
                          <img 
                            src={job.imageUrl || job.file} 
                            alt="Ảnh lịch học" 
                            style={{ width: "100%", height: "90px", objectFit: "cover", borderRadius: "8px", border: "1px solid #cbd5e1", cursor: "pointer" }}
                            onClick={() => setLightboxImage(job.imageUrl || job.file)}
                          />
                        </div>
                      )}

                      <div style={{ borderTop: "1px dashed #e2e8f0", paddingTop: "8px", marginTop: "4px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div>
                          <span style={{ fontSize: "0.72rem", color: "var(--text-secondary)", display: "block" }}>Thù lao nhận:</span>
                          <strong style={{ fontSize: "1.1rem", color: "var(--success)" }}>{helperPayout.toLocaleString("vi-VN")} đ</strong>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleGrabJob(job)}
                          className="btn"
                          style={{ background: "var(--success)", color: "white", padding: "0.45rem 1.1rem", borderRadius: "8px", border: "none", fontWeight: "700", cursor: "pointer", fontSize: "0.8rem", boxShadow: "0 4px 8px rgba(16, 185, 129, 0.15)" }}
                        >
                          Nhận lớp 🤝
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()}
          </div>
        )}

        {ctvActiveTab === "my_jobs" && (
          <div>
            <div style={{
              background: "#eff6ff",
              border: "1px solid #dbeafe",
              borderRadius: "14px",
              padding: "1rem 1.25rem",
              marginBottom: "1.5rem",
              display: "flex",
              alignItems: "flex-start",
              gap: "12px",
              textAlign: "left",
              boxShadow: "0 2px 8px rgba(59, 130, 246, 0.05)"
            }}>
              <span style={{ fontSize: "1.3rem", lineHeight: "1" }}>💡</span>
              <div>
                <p style={{ margin: 0, fontSize: "0.85rem", fontWeight: "750", color: "#1d4ed8" }}>
                  Hướng dẫn nộp minh chứng hoàn thành ca trực
                </p>
                <p style={{ margin: "4px 0 0 0", fontSize: "0.78rem", color: "#1e40af", lineHeight: "1.5" }}>
                  Đến giờ học, bạn cần có mặt tại giảng đường và chụp ảnh minh chứng thực tế (ví dụ: ảnh bảng viết, slide bài giảng hoặc bài tập trên lớp) rồi nhấn nút <b>"Nộp báo cáo hoàn thành"</b> để tải ảnh lên. Sau khi được duyệt, thù lao ca học sẽ tự động cộng vào Ví của bạn.
                </p>
              </div>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem", flexWrap: "wrap", gap: "10px" }}>
              <h4 style={{ margin: 0, color: "var(--text-primary)" }}>📅 Lớp học hộ bạn đã nhận công tác</h4>
              <div style={{ display: "flex", gap: "2px", background: "#f1f5f9", padding: "4px", borderRadius: "10px" }}>
                <button 
                  type="button"
                  onClick={() => setCtvJobsView("list")}
                  style={{
                    border: "none",
                    background: ctvJobsView === "list" ? "white" : "transparent",
                    color: ctvJobsView === "list" ? "var(--primary)" : "var(--text-secondary)",
                    padding: "6px 12px",
                    borderRadius: "8px",
                    fontSize: "0.8rem",
                    fontWeight: "700",
                    cursor: "pointer",
                    boxShadow: ctvJobsView === "list" ? "0 2px 5px rgba(0,0,0,0.05)" : "none",
                    transition: "all 0.2s"
                  }}
                >
                  Danh sách
                </button>
                <button 
                  type="button"
                  onClick={() => setCtvJobsView("calendar")}
                  style={{
                    border: "none",
                    background: ctvJobsView === "calendar" ? "white" : "transparent",
                    color: ctvJobsView === "calendar" ? "var(--primary)" : "var(--text-secondary)",
                    padding: "6px 12px",
                    borderRadius: "8px",
                    fontSize: "0.8rem",
                    fontWeight: "700",
                    cursor: "pointer",
                    boxShadow: ctvJobsView === "calendar" ? "0 2px 5px rgba(0,0,0,0.05)" : "none",
                    transition: "all 0.2s"
                  }}
                >
                  Lịch biểu
                </button>
              </div>
            </div>

            {(() => {
              const allJobsCombined = [
                ...myJobs.map(j => ({ ...j, isInternal: false })),
                ...myInternalJobs.map(j => ({
                  ...j,
                  isInternal: true,
                  className: j.subject,
                  startTime: j.timeSlot ? j.timeSlot.split(" - ")[0] : "Ca học",
                  endTime: j.timeSlot ? j.timeSlot.split(" - ")[1] : "Nội bộ",
                  name: j.studentName || "Học viên nội bộ",
                  payoutAmount: (Number(j.salaryAmount) || 0) + (Number(j.staffTipAmount) || 0),
                  status: j.salaryStatus === "Đã trả lương" ? "completed" : (j.proofImage ? "proof_submitted" : "in_progress")
                }))
              ];
              allJobsCombined.sort((a, b) => new Date(b.classDate) - new Date(a.classDate));

              if (allJobsCombined.length === 0) {
                return (
                  <div className="glass-panel" style={{ padding: "3rem", textAlign: "center", color: "var(--text-secondary)" }}>
                    Bạn chưa có lịch học hộ hoặc ca trực nội bộ nào được giao.
                  </div>
                );
              }

              // Calendar setup helpers
              const getCTVStartOfWeek = (d) => {
                const temp = new Date(d);
                const day = temp.getDay();
                const diff = temp.getDate() - day + (day === 0 ? -6 : 1);
                return new Date(temp.setDate(diff));
              };

              const startOfWeek = getCTVStartOfWeek(new Date(ctvCurrentDate));
              const weekDays = Array.from({ length: 7 }, (_, i) => {
                const d = new Date(startOfWeek);
                d.setDate(startOfWeek.getDate() + i);
                return d;
              });

              const getJobsForDate = (date) => {
                const dateStr = date.toLocaleDateString("en-CA");
                return allJobsCombined.filter(j => {
                  try {
                    const jDate = new Date(j.classDate);
                    return jDate.toLocaleDateString("en-CA") === dateStr;
                  } catch (e) {
                    return false;
                  }
                });
              };

              const handlePrevWeek = () => {
                const prev = new Date(ctvCurrentDate);
                prev.setDate(prev.getDate() - 7);
                setCtvCurrentDate(prev);
              };

              const handleNextWeek = () => {
                const next = new Date(ctvCurrentDate);
                next.setDate(next.getDate() + 7);
                setCtvCurrentDate(next);
              };

              const handleThisWeek = () => {
                setCtvCurrentDate(new Date());
              };

              // Reusable job card element
              const renderJobCardMini = (job) => {
                const proposedPriceNum = job.price ? Number(String(job.price).replace(/\./g, "")) : 0;
                const helperPayout = job.isInternal ? job.payoutAmount : (job.payoutAmount !== undefined ? Number(job.payoutAmount) : Math.floor(proposedPriceNum * 0.75));
                
                return (
                  <div 
                    key={job.id} 
                    className="glass-panel"
                    style={{ 
                      padding: "0.75rem", 
                      background: "white", 
                      borderLeft: "4px solid " + (job.status === "completed" ? "var(--success)" : job.status === "proof_submitted" ? "#D97706" : "#4F46E5"),
                      textAlign: "left",
                      fontSize: "0.78rem"
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "5px", marginBottom: "4px" }}>
                      <strong style={{ fontSize: "0.82rem", wordBreak: "break-word" }}>{job.className}</strong>
                      {job.isInternal && (
                        <span style={{ background: "#f3e8ff", color: "#6b21a8", fontSize: "0.6rem", fontWeight: "800", padding: "1px 4px", borderRadius: "4px", flexShrink: 0 }}>Nội bộ</span>
                      )}
                    </div>
                    <div style={{ color: "var(--text-secondary)", display: "flex", flexDirection: "column", gap: "2px", fontSize: "0.72rem", marginBottom: "6px" }}>
                      <span>🕒 {job.startTime} - {job.endTime}</span>
                      <span>🚪 Phòng: <b>{job.classroom || "N/A"}</b></span>
                      <span>👤 {job.name}</span>
                    </div>

                    <div style={{ borderTop: "1px dashed #e2e8f0", paddingTop: "5px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <strong style={{ color: "var(--success)", fontSize: "0.78rem" }}>{helperPayout.toLocaleString("vi-VN")}đ</strong>
                      {job.status === "completed" ? (
                        <span style={{ color: "var(--success)", fontWeight: "700" }}>Hoàn thành</span>
                      ) : job.status === "proof_submitted" ? (
                        <span style={{ color: "#D97706", fontWeight: "700" }}>Chờ duyệt</span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedJobForProof(job);
                            setProofFile(null);
                            setShowProofModal(true);
                          }}
                          className="btn"
                          style={{ background: "#D97706", color: "white", padding: "2px 6px", borderRadius: "5px", border: "none", fontWeight: "700", cursor: "pointer", fontSize: "0.68rem" }}
                        >
                          📸 Check-in
                        </button>
                      )}
                    </div>
                  </div>
                );
              };

              if (ctvJobsView === "calendar") {
                const monStr = weekDays[0].toLocaleDateString("vi-VN", { day: "numeric", month: "numeric", year: "numeric" });
                const sunStr = weekDays[6].toLocaleDateString("vi-VN", { day: "numeric", month: "numeric", year: "numeric" });
                const weekdayNames = ["Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy", "Chủ Nhật"];
                const weekdayShort = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];

                // Tính toán thống kê ca học & thù lao của tuần được chọn
                const weeklyJobs = weekDays.flatMap(day => getJobsForDate(day));
                const weeklyShiftsCount = weeklyJobs.length;
                const weeklyEarnings = weeklyJobs.reduce((sum, j) => {
                  const proposedPriceNum = j.price ? Number(String(j.price).replace(/\./g, "")) : 0;
                  const helperPayout = j.isInternal ? j.payoutAmount : (j.payoutAmount !== undefined ? Number(j.payoutAmount) : Math.floor(proposedPriceNum * 0.75));
                  return sum + helperPayout;
                }, 0);

                return (
                  <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
                    
                    {/* THỐNG KÊ TUẦN NHANH */}
                    <div style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
                      gap: "1rem"
                    }}>
                      <div className="glass-panel" style={{ padding: "1.25rem", background: "linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)", border: "1px solid #bfdbfe", borderRadius: "16px", display: "flex", alignItems: "center", gap: "12px", textAlign: "left" }}>
                        <span style={{ fontSize: "1.8rem" }}>📅</span>
                        <div>
                          <div style={{ fontSize: "0.75rem", color: "#1e3a8a", fontWeight: "800", textTransform: "uppercase", letterSpacing: "0.5px" }}>Ca học tuần này</div>
                          <strong style={{ fontSize: "1.35rem", color: "#1d4ed8", fontWeight: "900" }}>{weeklyShiftsCount} ca trực</strong>
                        </div>
                      </div>

                      <div className="glass-panel" style={{ padding: "1.25rem", background: "linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)", border: "1px solid #bbf7d0", borderRadius: "16px", display: "flex", alignItems: "center", gap: "12px", textAlign: "left" }}>
                        <span style={{ fontSize: "1.8rem" }}>💰</span>
                        <div>
                          <div style={{ fontSize: "0.75rem", color: "#14532d", fontWeight: "800", textTransform: "uppercase", letterSpacing: "0.5px" }}>Thù lao ước tính</div>
                          <strong style={{ fontSize: "1.35rem", color: "#15803d", fontWeight: "900" }}>{weeklyEarnings.toLocaleString("vi-VN")} đ</strong>
                        </div>
                      </div>
                    </div>

                    {/* WEEKLY CALENDAR NAVIGATION */}
                    <div className="glass-panel" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px", background: "white", padding: "1rem 1.25rem", borderRadius: "18px", border: "1px solid #cbd5e1" }}>
                      <div style={{ display: "flex", gap: "6px" }}>
                        <button type="button" onClick={handlePrevWeek} className="btn" style={{ padding: "0.5rem 1rem", background: "#f8fafc", fontSize: "0.8rem", border: "1px solid #cbd5e1", borderRadius: "10px", color: "var(--text-primary)", cursor: "pointer", transition: "all 0.2s", fontWeight: "700" }}>◀ Tuần trước</button>
                        <button type="button" onClick={handleThisWeek} className="btn" style={{ padding: "0.5rem 1rem", background: "white", fontSize: "0.8rem", border: "1.5px solid var(--primary)", borderRadius: "10px", color: "var(--primary)", fontWeight: "800", cursor: "pointer", transition: "all 0.2s" }}>Tuần này</button>
                        <button type="button" onClick={handleNextWeek} className="btn" style={{ padding: "0.5rem 1rem", background: "#f8fafc", fontSize: "0.8rem", border: "1px solid #cbd5e1", borderRadius: "10px", color: "var(--text-primary)", cursor: "pointer", transition: "all 0.2s", fontWeight: "700" }}>Tuần sau ▶</button>
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", textAlign: "right" }}>
                        <span style={{ fontSize: "0.9rem", fontWeight: "850", color: "var(--text-primary)" }}>
                          Tuần từ {monStr.substring(0, 5)} đến {sunStr.substring(0, 5)}
                        </span>
                        <span style={{ fontSize: "0.72rem", color: "var(--text-secondary)", marginTop: "2px" }}>Năm {weekDays[0].getFullYear()}</span>
                      </div>
                    </div>

                    {!isMobile ? (
                      /* DESKTOP CALENDAR VIEW: 7 Columns Grid Layout */
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "12px", alignItems: "start" }}>
                        {weekDays.map((day, idx) => {
                          const dateStr = day.toLocaleDateString("vi-VN", { day: "numeric", month: "numeric" });
                          const isToday = new Date().toDateString() === day.toDateString();
                          const dayJobs = getJobsForDate(day);

                          return (
                            <div 
                              key={idx} 
                              style={{ 
                                background: isToday ? "rgba(22, 163, 74, 0.02)" : "rgba(255, 255, 255, 0.4)", 
                                borderRadius: "16px", 
                                border: isToday ? "2px solid var(--primary)" : "1px solid #e2e8f0",
                                boxShadow: isToday ? "0 4px 20px rgba(22, 163, 74, 0.08)" : "0 1px 3px rgba(0,0,0,0.02)",
                                overflow: "hidden",
                                minHeight: "280px",
                                display: "flex",
                                flexDirection: "column",
                                transition: "all 0.2s ease"
                              }}
                            >
                              {/* Day column header */}
                              <div style={{ 
                                background: isToday ? "linear-gradient(135deg, var(--primary) 0%, #059669 100%)" : "linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%)", 
                                color: isToday ? "white" : "var(--text-primary)", 
                                padding: "10px 5px", 
                                fontSize: "0.82rem", 
                                fontWeight: "800", 
                                textAlign: "center",
                                borderBottom: "1px solid #cbd5e1"
                              }}>
                                <div>{weekdayNames[idx]}</div>
                                <div style={{ fontSize: "0.72rem", opacity: 0.9, marginTop: "2px", fontWeight: "700" }}>{dateStr}</div>
                              </div>

                              {/* Shifts list inside day column */}
                              <div style={{ padding: "8px", display: "flex", flexDirection: "column", gap: "8px", flex: 1 }}>
                                {dayJobs.length === 0 ? (
                                  <div style={{ margin: "auto 0", padding: "1rem 0", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                                    <span style={{ fontSize: "1.2rem", marginBottom: "4px" }}>☕</span>
                                    <span style={{ fontSize: "0.7rem", color: "var(--text-secondary)", fontStyle: "italic" }}>Trống lịch</span>
                                  </div>
                                ) : (
                                  dayJobs.map(job => {
                                    const proposedPriceNum = job.price ? Number(String(job.price).replace(/\./g, "")) : 0;
                                    const helperPayout = job.isInternal ? job.payoutAmount : (job.payoutAmount !== undefined ? Number(job.payoutAmount) : Math.floor(proposedPriceNum * 0.75));
                                    
                                    return (
                                      <div 
                                        key={job.id} 
                                        className="glass-panel hover-grow"
                                        style={{ 
                                          padding: "0.75rem", 
                                          background: "white", 
                                          borderLeft: "4px solid " + (job.status === "completed" ? "var(--success)" : job.status === "proof_submitted" ? "#D97706" : "#4F46E5"),
                                          textAlign: "left",
                                          fontSize: "0.78rem",
                                          boxShadow: "0 2px 8px rgba(0,0,0,0.03)",
                                          borderRadius: "10px",
                                          display: "flex",
                                          flexDirection: "column",
                                          gap: "4px",
                                          transition: "all 0.25s cubic-bezier(0.4, 0, 0.2, 1)"
                                        }}
                                      >
                                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "4px" }}>
                                          <strong style={{ fontSize: "0.82rem", wordBreak: "break-word", color: "var(--text-primary)" }}>{job.className}</strong>
                                          {job.isInternal && (
                                            <span style={{ background: "#f3e8ff", color: "#6b21a8", fontSize: "0.58rem", fontWeight: "800", padding: "1px 4px", borderRadius: "4px", flexShrink: 0 }}>Nội bộ</span>
                                          )}
                                        </div>
                                        
                                        <div style={{ color: "var(--text-secondary)", display: "flex", flexDirection: "column", gap: "2px", fontSize: "0.7rem", marginTop: "2px" }}>
                                          <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>🕒 {job.startTime} - {job.endTime}</span>
                                          <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>🚪 Phòng: <b>{job.classroom || "N/A"}</b></span>
                                          <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>👤 HV: <b>{job.name}</b></span>
                                        </div>

                                        <div style={{ borderTop: "1px dashed #e2e8f0", paddingTop: "6px", marginTop: "4px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                          <strong style={{ color: "var(--success)", fontSize: "0.82rem" }}>{helperPayout.toLocaleString("vi-VN")}đ</strong>
                                          {job.status === "completed" ? (
                                            <span style={{ color: "var(--success)", fontWeight: "800", fontSize: "0.7rem" }}>✓ Đã học</span>
                                          ) : job.status === "proof_submitted" ? (
                                            <span style={{ color: "#D97706", fontWeight: "800", fontSize: "0.7rem" }}>⌛ Duyệt</span>
                                          ) : (
                                            <button
                                              type="button"
                                              onClick={() => {
                                                setSelectedJobForProof(job);
                                                setProofFile(null);
                                                setShowProofModal(true);
                                              }}
                                              className="btn"
                                              style={{ background: "#D97706", color: "white", padding: "2px 6px", borderRadius: "5px", border: "none", fontWeight: "750", cursor: "pointer", fontSize: "0.68rem", transition: "background 0.2s" }}
                                            >
                                              📸 Báo cáo
                                            </button>
                                          )}
                                        </div>
                                      </div>
                                    );
                                  })
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      /* MOBILE CALENDAR VIEW: Horizontal planner swiper + details card list */
                      <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                        
                        {/* Day picker buttons block */}
                        <div 
                          className="hide-scrollbar"
                          style={{ 
                            display: "flex", 
                            gap: "8px", 
                            overflowX: "auto", 
                            paddingBottom: "8px",
                            WebkitOverflowScrolling: "touch"
                          }}
                        >
                          {weekDays.map((day, idx) => {
                            const dateNum = day.getDate();
                            const isSelected = ctvSelectedDay && ctvSelectedDay.toDateString() === day.toDateString();
                            const isToday = new Date().toDateString() === day.toDateString();
                            const dayJobs = getJobsForDate(day);

                            return (
                              <button
                                key={idx}
                                type="button"
                                onClick={() => setCtvSelectedDay(day)}
                                style={{
                                  flex: "1 0 54px",
                                  maxWidth: "60px",
                                  padding: "10px 0",
                                  borderRadius: "12px",
                                  border: isSelected ? "none" : (isToday ? "2px solid var(--primary)" : "1px solid #e2e8f0"),
                                  background: isSelected ? "linear-gradient(135deg, var(--primary) 0%, #059669 100%)" : "white",
                                  color: isSelected ? "white" : (isToday ? "var(--primary)" : "var(--text-primary)"),
                                  display: "flex",
                                  flexDirection: "column",
                                  alignItems: "center",
                                  gap: "4px",
                                  cursor: "pointer",
                                  position: "relative",
                                  boxShadow: isSelected ? "0 4px 12px rgba(22, 163, 74, 0.2)" : "0 1px 3px rgba(0,0,0,0.02)",
                                  transform: isSelected ? "scale(1.05)" : "scale(1)",
                                  transition: "all 0.2s ease"
                                }}
                              >
                                <span style={{ fontSize: "0.68rem", fontWeight: "800", opacity: 0.9 }}>{weekdayShort[idx]}</span>
                                <span style={{ fontSize: "1.05rem", fontWeight: "900" }}>{dateNum}</span>
                                {dayJobs.length > 0 && (
                                  <span style={{ 
                                    position: "absolute", 
                                    top: "4px", 
                                    right: "4px", 
                                    width: "14px", 
                                    height: "14px", 
                                    borderRadius: "50%", 
                                    background: isSelected ? "white" : "var(--primary)",
                                    color: isSelected ? "var(--primary)" : "white",
                                    fontSize: "0.58rem",
                                    fontWeight: "800",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center"
                                  }}>
                                    {dayJobs.length}
                                  </span>
                                )}
                              </button>
                            );
                          })}
                        </div>

                        {/* Selected day shifts list */}
                        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                          <div style={{ fontSize: "0.85rem", fontWeight: "800", color: "var(--text-secondary)", textAlign: "left", display: "flex", alignItems: "center", gap: "6px" }}>
                            <span>📋 Ca trực ngày:</span>
                            <span style={{ color: "var(--text-primary)" }}>{ctvSelectedDay.toLocaleDateString("vi-VN", { weekday: "long", day: "numeric", month: "numeric" })}</span>
                          </div>
                          {(() => {
                            const selectedDayJobs = getJobsForDate(ctvSelectedDay);
                            if (selectedDayJobs.length === 0) {
                              return (
                                <div className="glass-panel" style={{ padding: "3rem 1.5rem", textAlign: "center", color: "var(--text-secondary)", background: "white", borderRadius: "18px", border: "1px dashed #cbd5e1" }}>
                                  <span style={{ fontSize: "2rem", display: "block", marginBottom: "8px" }}>🍵</span>
                                  <span style={{ fontSize: "0.85rem", fontWeight: "700" }}>Không có ca học hộ được giao trong ngày này!</span>
                                </div>
                              );
                            }
                            return (
                              <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                                {selectedDayJobs.map(job => {
                                  const proposedPriceNum = job.price ? Number(String(job.price).replace(/\./g, "")) : 0;
                                  const helperPayout = job.isInternal ? job.payoutAmount : (job.payoutAmount !== undefined ? Number(job.payoutAmount) : Math.floor(proposedPriceNum * 0.75));
                                  return (
                                    <div 
                                      key={job.id} 
                                      className="glass-panel" 
                                      style={{ 
                                        padding: "1.25rem", 
                                        display: "flex", 
                                        flexDirection: "column", 
                                        gap: "8px", 
                                        background: "white", 
                                        borderLeft: "5px solid " + (job.status === "completed" ? "var(--success)" : job.status === "proof_submitted" ? "#D97706" : "#4F46E5"),
                                        position: "relative",
                                        borderRadius: "16px",
                                        boxShadow: "0 4px 15px rgba(0,0,0,0.03)"
                                      }}
                                    >
                                      {job.isInternal && (
                                        <span style={{ position: "absolute", top: "8px", right: "8px", background: "#f3e8ff", color: "#6b21a8", fontSize: "0.68rem", fontWeight: "800", padding: "2px 6px", borderRadius: "6px" }}>📅 Lịch Nội Bộ</span>
                                      )}
                                      
                                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "10px", paddingRight: job.isInternal ? "80px" : "0" }}>
                                        <strong style={{ fontSize: "1rem", color: "var(--text-primary)" }}>{job.className}</strong>
                                        {job.status === "completed" ? (
                                          <span style={{ fontSize: "0.75rem", background: "rgba(22,163,74,0.12)", color: "var(--success)", padding: "2px 8px", borderRadius: "8px", fontWeight: "750" }}>Hoàn thành</span>
                                        ) : job.status === "proof_submitted" ? (
                                          <span style={{ fontSize: "0.75rem", background: "rgba(217,119,6,0.12)", color: "#D97706", padding: "2px 8px", borderRadius: "8px", fontWeight: "750" }}>Đã nộp báo cáo</span>
                                        ) : (
                                          <span style={{ fontSize: "0.75rem", background: "rgba(79,70,229,0.12)", color: "#4F46E5", padding: "2px 8px", borderRadius: "8px", fontWeight: "750" }}>Đang trực lớp</span>
                                        )}
                                      </div>

                                      <div style={{ fontSize: "0.82rem", color: "var(--text-secondary)", display: "flex", flexDirection: "column", gap: "4px", textAlign: "left", marginTop: "4px" }}>
                                        <span>🏫 Trường học: <b>{job.school || "N/A"}</b></span>
                                        <span>🕒 Khung giờ: <b>{job.startTime} - {job.endTime}</b></span>
                                        {job.classroom && <span>🚪 Phòng học: <b>{job.classroom}</b></span>}
                                        <span>👤 Tên học viên: <b>{job.name}</b></span>
                                      </div>

                                      <div style={{ borderTop: "1px solid #f1f5f9", paddingTop: "10px", marginTop: "6px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                        <div>
                                          <span style={{ fontSize: "0.72rem", color: "var(--text-secondary)" }}>Thù lao nhận về:</span>
                                          <strong style={{ fontSize: "1.1rem", color: "var(--success)", display: "block", fontWeight: "800" }}>{helperPayout.toLocaleString("vi-VN")} đ</strong>
                                        </div>
                                        {(job.status === "accepted" || job.status === "in_progress") && (
                                          <button
                                            type="button"
                                            onClick={() => {
                                              setSelectedJobForProof(job);
                                              setProofFile(null);
                                              setShowProofModal(true);
                                            }}
                                            className="btn"
                                            style={{ background: "#D97706", color: "white", padding: "0.45rem 1rem", borderRadius: "10px", border: "none", fontWeight: "750", cursor: "pointer", fontSize: "0.78rem" }}
                                          >
                                            📸 Báo cáo check-in
                                          </button>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            );
                          })()}
                        </div>
                      </div>
                    )}
                  </div>
                );
              }

              /* STANDARD LIST VIEW */
              return (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "1.25rem" }}>
                  {allJobsCombined.map((job) => {
                    const proposedPriceNum = job.price ? Number(String(job.price).replace(/\./g, "")) : 0;
                    const helperPayout = job.isInternal ? job.payoutAmount : (job.payoutAmount !== undefined ? Number(job.payoutAmount) : Math.floor(proposedPriceNum * 0.75));
                    return (
                      <div 
                        key={job.id} 
                        className="glass-panel" 
                        style={{ 
                          padding: "1.25rem", 
                          display: "flex", 
                          flexDirection: "column", 
                          gap: "8px", 
                          background: "white", 
                          borderLeft: "5px solid " + (job.status === "completed" ? "var(--success)" : job.status === "proof_submitted" ? "#D97706" : "#4F46E5"),
                          position: "relative"
                        }}
                      >
                        {job.isInternal && (
                          <span style={{ 
                            position: "absolute", 
                            top: "8px", 
                            right: "8px", 
                            background: "#f3e8ff", 
                            color: "#6b21a8", 
                            fontSize: "0.68rem", 
                            fontWeight: "800", 
                            padding: "2px 6px", 
                            borderRadius: "6px" 
                          }}>
                            📅 Lịch Nội Bộ
                          </span>
                        )}

                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "10px", paddingRight: job.isInternal ? "80px" : "0" }}>
                          <strong style={{ fontSize: "1rem" }}>{job.className}</strong>
                          {job.status === "completed" ? (
                            <span style={{ fontSize: "0.75rem", background: "rgba(22,163,74,0.12)", color: "var(--success)", padding: "2px 8px", borderRadius: "8px", fontWeight: "750" }}>Hoàn thành</span>
                          ) : job.status === "proof_submitted" ? (
                            <span style={{ fontSize: "0.75rem", background: "rgba(217,119,6,0.12)", color: "#D97706", padding: "2px 8px", borderRadius: "8px", fontWeight: "750" }}>Đã nộp báo cáo</span>
                          ) : (
                            <span style={{ fontSize: "0.75rem", background: "rgba(79,70,229,0.12)", color: "#4F46E5", padding: "2px 8px", borderRadius: "8px", fontWeight: "750" }}>Đang trực lớp</span>
                          )}
                        </div>

                        <div style={{ fontSize: "0.82rem", color: "var(--text-secondary)", display: "flex", flexDirection: "column", gap: "3px" }}>
                          <span>🏫 Trường: <b>{job.school || "N/A"}</b></span>
                          <span>📅 Ngày học: <b>{job.weekday || ""} ({new Date(job.classDate).toLocaleDateString("vi-VN")})</b></span>
                          <span>🕒 Khung giờ: <b>{job.startTime} - {job.endTime}</b></span>
                          {job.classroom && <span>🚪 Phòng học: <b>{job.classroom}</b></span>}
                          <span>👤 Học viên: <b>{job.name}</b></span>
                          <span>📞 Liên hệ Admin: <a href="https://zalo.me/0852866856" target="_blank" rel="noopener noreferrer" style={{ textDecoration: "underline", color: "var(--primary)", fontWeight: "bold" }}>0852866856 💬</a></span>
                        </div>

                        {/* Nút xem lịch chụp của học viên */}
                        {(job.imageUrl || job.file || job.proofImage) && (
                          <div style={{ margin: "5px 0" }}>
                            <span style={{ fontSize: "0.78rem", color: "var(--text-secondary)", display: "block", marginBottom: "4px" }}>📸 Lịch học / Minh chứng:</span>
                            <img 
                              src={job.imageUrl || job.file || job.proofImage} 
                              alt="Ảnh đính kèm" 
                              style={{ width: "100%", height: "90px", objectFit: "cover", borderRadius: "8px", border: "1px solid #cbd5e1", cursor: "pointer" }}
                              onClick={() => setLightboxImage(job.imageUrl || job.file || job.proofImage)}
                            />
                          </div>
                        )}

                        <div style={{ borderTop: "1px solid #f1f5f9", paddingTop: "8px", marginTop: "4px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <div>
                            <span style={{ fontSize: "0.72rem", color: "var(--text-secondary)" }}>Thù lao:</span>
                            <strong style={{ fontSize: "1rem", color: "var(--success)", display: "block" }}>{helperPayout.toLocaleString("vi-VN")} đ</strong>
                          </div>
                          {(job.status === "accepted" || job.status === "in_progress") && (
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedJobForProof(job);
                                setProofFile(null);
                                setShowProofModal(true);
                              }}
                              className="btn"
                              style={{ background: "#D97706", color: "white", padding: "0.35rem 0.8rem", borderRadius: "8px", border: "none", fontWeight: "700", cursor: "pointer", fontSize: "0.78rem" }}
                            >
                              📸 Báo cáo check-in
                            </button>
                          )}
                          {job.status === "proof_submitted" && (
                            <span style={{ fontSize: "0.78rem", color: "#D97706", fontWeight: "700" }}>Chờ duyệt</span>
                          )}
                          {job.status === "completed" && (
                            <span style={{ fontSize: "0.78rem", color: "var(--success)", fontWeight: "700" }}>Đã trả ví</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>
        )}

        {ctvActiveTab === "analytics" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
            {/* KPI CARDS */}
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: "1.25rem",
              marginTop: "0.5rem"
            }}>
              <div className="glass-panel" style={{ padding: "1.25rem", borderLeft: "4px solid #10B981", background: "white", display: "flex", flexDirection: "column", gap: "4px" }}>
                <span style={{ fontSize: "0.78rem", color: "#065f46", fontWeight: "750", textTransform: "uppercase" }}>💰 Tổng thù lao tích lũy</span>
                <span style={{ fontSize: "1.45rem", fontWeight: "900", color: "#047857" }}>{renderCTVWorkspace.totalEarned.toLocaleString("vi-VN")} đ</span>
                <span style={{ fontSize: "0.72rem", color: "var(--text-secondary)" }}>Đã hoàn thành {renderCTVWorkspace.completedJobs.length} ca trực</span>
              </div>

              <div className="glass-panel" style={{ padding: "1.25rem", borderLeft: "4px solid #4F46E5", background: "white", display: "flex", flexDirection: "column", gap: "4px" }}>
                <span style={{ fontSize: "0.78rem", color: "#3730a3", fontWeight: "750", textTransform: "uppercase" }}>📅 Ca đang thực hiện</span>
                <span style={{ fontSize: "1.45rem", fontWeight: "900", color: "#4338ca" }}>{renderCTVWorkspace.inProgressJobs.length} ca</span>
                <span style={{ fontSize: "0.72rem", color: "var(--text-secondary)" }}>Chờ đi học hoặc chờ duyệt thù lao</span>
              </div>

              <div className="glass-panel" style={{ padding: "1.25rem", borderLeft: "4px solid #F59E0B", background: "white", display: "flex", flexDirection: "column", gap: "4px" }}>
                <span style={{ fontSize: "0.78rem", color: "#92400e", fontWeight: "750", textTransform: "uppercase" }}>★ Đánh giá của bạn</span>
                <span style={{ fontSize: "1.45rem", fontWeight: "900", color: "#d97706" }}>
                  {renderCTVWorkspace.averageStars === "N/A" ? "Chưa có" : `${renderCTVWorkspace.averageStars} / 5 ★`}
                </span>
                <span style={{ fontSize: "0.72rem", color: "var(--text-secondary)" }}>Dựa trên {renderCTVWorkspace.myReviews.length} lượt phản hồi</span>
              </div>
            </div>

            {/* Chi tiết ca học đã hoàn thành */}
            <div className="glass-panel" style={{ padding: "1.5rem", background: "white" }}>
              <h3 style={{ fontSize: "1.1rem", fontWeight: "800", color: "var(--text-primary)", marginBottom: "1rem" }}>📋 Bảng kê chi tiết thu nhập</h3>
              {renderCTVWorkspace.completedJobs.length === 0 ? (
                <div style={{ textAlign: "center", padding: "2rem", color: "var(--text-secondary)", fontSize: "0.85rem", fontStyle: "italic" }}>
                  Bạn chưa có ca học nào được hoàn thành và thanh toán.
                </div>
              ) : (
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "600px" }}>
                    <thead>
                      <tr style={{ borderBottom: "2px solid #f1f5f9", textAlign: "left" }}>
                        <th style={{ padding: "8px 12px", fontSize: "0.8rem", color: "var(--text-secondary)" }}>Tên môn / Lớp</th>
                        <th style={{ padding: "8px 12px", fontSize: "0.8rem", color: "var(--text-secondary)" }}>Ngày học</th>
                        <th style={{ padding: "8px 12px", fontSize: "0.8rem", color: "var(--text-secondary)" }}>Thù lao chính</th>
                        <th style={{ padding: "8px 12px", fontSize: "0.8rem", color: "var(--text-secondary)" }}>Tiền Tip thêm</th>
                        <th style={{ padding: "8px 12px", fontSize: "0.8rem", color: "var(--text-secondary)" }}>Tổng nhận</th>
                      </tr>
                    </thead>
                    <tbody>
                      {renderCTVWorkspace.completedJobs.map(job => {
                        const proposedPriceNum = job.price ? Number(String(job.price).replace(/\./g, "")) : 0;
                        const basePayout = job.payoutAmount !== undefined ? Number(job.payoutAmount) : Math.floor(proposedPriceNum * 0.75);
                        const extraTip = job.staffTipAmount ? Number(job.staffTipAmount) : 0;
                        return (
                          <tr key={job.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                            <td style={{ padding: "10px 12px", fontWeight: "700", fontSize: "0.85rem" }}>{job.className}</td>
                            <td style={{ padding: "10px 12px", fontSize: "0.82rem", color: "var(--text-secondary)" }}>{new Date(job.classDate).toLocaleDateString("vi-VN")}</td>
                            <td style={{ padding: "10px 12px", fontSize: "0.85rem", fontWeight: "600" }}>{basePayout.toLocaleString("vi-VN")} đ</td>
                            <td style={{ padding: "10px 12px", fontSize: "0.85rem", color: extraTip > 0 ? "var(--success)" : "var(--text-secondary)" }}>{extraTip > 0 ? `+${extraTip.toLocaleString("vi-VN")} đ` : "0đ"}</td>
                            <td style={{ padding: "10px 12px", fontSize: "0.88rem", fontWeight: "800", color: "var(--success)" }}>{(basePayout + extraTip).toLocaleString("vi-VN")} đ</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Nhận xét & Đánh giá từ khách hàng */}
            <div className="glass-panel" style={{ padding: "1.5rem", background: "white" }}>
              <h3 style={{ fontSize: "1.1rem", fontWeight: "800", color: "var(--text-primary)", marginBottom: "1rem" }}>💬 Nhận xét từ khách hàng ({renderCTVWorkspace.myReviews.length})</h3>
              {renderCTVWorkspace.myReviews.length === 0 ? (
                <div style={{ textAlign: "center", padding: "2rem", color: "var(--text-secondary)", fontSize: "0.85rem", fontStyle: "italic" }}>
                  Chưa có nhận xét nào dành cho bạn. Hãy làm tốt các ca học để nhận được phản hồi tốt nhé!
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  {renderCTVWorkspace.myReviews.map(rev => {
                    const matchedJob = myJobs.find(j => j.id === rev.scheduleId);
                    return (
                      <div key={rev.id} style={{ padding: "12px 1rem", border: "1px solid #e2e8f0", borderRadius: "12px", background: "#f8fafc", textAlign: "left" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                          <span style={{ fontWeight: "750", fontSize: "0.85rem" }}>👤 {rev.userName || "Khách"}</span>
                          <span style={{ fontSize: "0.78rem", color: "#d97706", fontWeight: "800" }}>
                            {"★".repeat(rev.rating)}{"☆".repeat(5 - rev.rating)} ({rev.rating}/5)
                          </span>
                        </div>
                        {matchedJob && (
                          <div style={{ fontSize: "0.72rem", color: "var(--text-secondary)", marginBottom: "4px" }}>
                            Môn học: <b>{matchedJob.className}</b> ngày {new Date(matchedJob.classDate).toLocaleDateString("vi-VN")}
                          </div>
                        )}
                        <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--text-primary)", fontStyle: "italic", lineHeight: "1.4" }}>
                          "{rev.comment}"
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
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
        badges: selectedBadges,
        helperName: reviewItem.assignedTo || "",
        createdAt: serverTimestamp()
      });
      
      // Đánh dấu đơn đã được đánh giá
      await updateDoc(doc(db, "schedules", reviewItem.id), { 
        reviewed: true,
        reviewBadges: selectedBadges
      });
      
      // Đồng bộ state selectedItem nếu đang xem
      setSelectedItem(prev => prev && prev.id === reviewItem.id ? { ...prev, reviewed: true, reviewBadges: selectedBadges } : prev);
      
      toast.success("Cảm ơn bạn đã gửi đánh giá dịch vụ!", { id: "review" });
      setShowReviewModal(false);
      setReviewText("");
      setSelectedBadges([]);
    } catch (err) {
      console.error("Lỗi gửi đánh giá:", err);
      toast.error("Không thể gửi đánh giá lúc này!", { id: "review" });
    } finally {
      setSubmittingReview(false);
    }
  };

  const handleQuickRebook = (item) => {
    setFormData({
      name: item.name || "",
      className: item.className || "",
      classRegular: item.classRegular || "",
      studentId: item.studentId || "",
      school: item.school || "",
      classDate: "",
      startTime: item.startTime || "",
      endTime: item.endTime || "",
      dob: item.dob || "",
      notes: item.notes || "",
      phone: item.phone || "",
      price: item.price !== undefined ? String(item.price) : ""
    });
    setWeekday("");
    setFile(null);
    setFileName("");
    setFilePreview(null);

    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
    toast.success(`Đã sao chép thông tin lớp "${item.className}". Vui lòng chọn ngày học mới và đính kèm ảnh lịch học.`);
  };

  const renderStatusStepper = (status) => {
    const steps = [
      { key: "pending", label: "Đăng đơn" },
      { key: "approved", label: "Giao CTV" },
      { key: "in_progress", label: "Đang học" },
      { key: "completed", label: "Hoàn thành" }
    ];

    let currentIdx = 0;
    if (status === "approved" || status === "paid") currentIdx = 1;
    else if (status === "in_progress") currentIdx = 2;
    else if (status === "completed") currentIdx = 3;
    else if (status === "rejected") {
      return (
        <div style={{ background: "#fee2e2", padding: "12px", borderRadius: "12px", border: "1px solid #fca5a5", color: "#b91c1c", fontSize: "0.82rem", fontWeight: "600", marginBottom: "1.5rem", textAlign: "center" }}>
          ❌ Đơn hàng này đã bị hủy bỏ hoặc từ chối duyệt.
        </div>
      );
    }

    return (
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", position: "relative", margin: "0.5rem 0 1.75rem 0", padding: "0 10px" }}>
        <div style={{ position: "absolute", top: "15px", left: "30px", right: "30px", height: "3px", background: "#cbd5e1", zIndex: 1 }} />
        <div style={{ 
          position: "absolute", 
          top: "15px", 
          left: "30px", 
          width: `${(currentIdx / (steps.length - 1)) * 80}%`, 
          height: "3px", 
          background: "var(--primary)", 
          zIndex: 2,
          transition: "width 0.3s ease" 
        }} />

        {steps.map((step, idx) => {
          const isActive = idx <= currentIdx;
          const isCurrent = idx === currentIdx;
          return (
            <div key={step.key} style={{ display: "flex", flexDirection: "column", alignItems: "center", zIndex: 3, position: "relative", width: "22%" }}>
              <div style={{
                width: "30px",
                height: "30px",
                borderRadius: "50%",
                background: isActive ? "var(--primary)" : "white",
                color: isActive ? "white" : "var(--text-secondary)",
                border: isActive ? "2px solid var(--primary)" : "2px solid #cbd5e1",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: "800",
                fontSize: "0.8rem",
                boxShadow: isCurrent ? "0 0 10px rgba(22, 163, 74, 0.4)" : "none",
                transition: "all 0.3s ease"
              }}>
                {idx + 1}
              </div>
              <span style={{ fontSize: "0.75rem", fontWeight: isActive ? "800" : "600", color: isActive ? "var(--primary)" : "var(--text-secondary)", marginTop: "6px", textAlign: "center", whiteSpace: "nowrap" }}>
                {step.label}
              </span>
            </div>
          );
        })}
      </div>
    );
  };

  const handleAddToGoogleCalendar = (item) => {
    if (!item || !item.classDate) return;
    const dateStr = item.classDate.replace(/-/g, "");
    const startStr = item.startTime ? item.startTime.replace(/[^0-9]/g, "") + "00" : "080000";
    const endStr = item.endTime ? item.endTime.replace(/[^0-9]/g, "") + "00" : "110000";
    
    const startISO = `${dateStr}T${startStr}`;
    const endISO = `${dateStr}T${endStr}`;
    
    const title = `Học hộ: ${item.className || "Lớp học"}`;
    const details = `Thuê Học Pro - Lớp học hộ môn ${item.className || ""}\nTrường: ${item.school || ""}\nGhi chú: ${item.notes || "Không có"}`;
    const location = item.school || "";

    const url = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(title)}&dates=${startISO}/${endISO}&details=${encodeURIComponent(details)}&location=${encodeURIComponent(location)}`;
    window.open(url, "_blank");
  };

  const handleDownloadICS = (item) => {
    if (!item || !item.classDate) return;
    const dateStr = item.classDate.replace(/-/g, "");
    const startStr = item.startTime ? item.startTime.replace(/[^0-9]/g, "") + "00" : "080000";
    const endStr = item.endTime ? item.endTime.replace(/[^0-9]/g, "") + "00" : "110000";
    
    const startICS = `${dateStr}T${startStr}`;
    const endICS = `${dateStr}T${endStr}`;

    const icsContent = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//ThueHocPro//LichHocHo//VI",
      "BEGIN:VEVENT",
      `SUMMARY:Học hộ: ${item.className || "Lớp học"}`,
      `DESCRIPTION:Lớp: ${item.className || ""} - Trường: ${item.school || ""}\\nGhi chú: ${item.notes || ""}`,
      `LOCATION:${item.school || ""}`,
      `DTSTART:${startICS}`,
      `DTEND:${endICS}`,
      "END:VEVENT",
      "END:VCALENDAR"
    ].join("\r\n");

    const blob = new Blob([icsContent], { type: "text/calendar;charset=utf-8" });
    const link = document.createElement("a");
    link.href = window.URL.createObjectURL(blob);
    link.setAttribute("download", `LichHoc_${item.className || "Ho"}.ics`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleConfirmPayment = async (orderId, orderName, orderPrice) => {
    if (!confirm(`Bạn đã chắc chắn chuyển khoản đúng số tiền ${Number(orderPrice).toLocaleString("vi-VN")} đ và đúng nội dung QR chưa?`)) {
      return;
    }
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
        link: "/admin?tab=schedules",
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

  const getUpcomingShiftReminder = () => {
    if (!history || history.length === 0) return null;
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    const todayStr = `${year}-${month}-${day}`;
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    for (const item of history) {
      if (item.classDate !== todayStr) continue;
      if (["completed", "rejected", "cancelled"].includes(item.status)) continue;
      if (!item.startTime) continue;

      const parts = item.startTime.replace(/[^0-9:]/g, "").split(":");
      if (parts.length < 2) continue;
      const startMin = parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);

      const diff = startMin - currentMinutes;
      if (diff >= -15 && diff <= 60) {
        return { item, diffMinutes: diff };
      }
    }
    return null;
  };
  const upcomingShift = getUpcomingShiftReminder();

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
    <div className="dashboard-main-container" style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      {systemSettings?.announcement && (
        <div className="announcement-box" style={{
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

      {/* 1-HOUR SHIFT REMINDER BANNER */}
      {upcomingShift && (
        <div style={{
          background: "linear-gradient(90deg, #f59e0b, #d97706)",
          color: "white",
          padding: "12px 20px",
          borderRadius: "16px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          boxShadow: "0 10px 15px -3px rgba(245, 158, 11, 0.3)",
          animation: "pulse 2s infinite",
          textAlign: "left"
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <span style={{ fontSize: "1.5rem" }}>⏰</span>
            <div>
              <strong style={{ fontSize: "0.95rem", display: "block" }}>
                CA HỌC SẮP DIỄN RA: Môn {upcomingShift.item.className}
              </strong>
              <span style={{ fontSize: "0.8rem", opacity: 0.9 }}>
                {upcomingShift.diffMinutes > 0
                  ? `Sẽ bắt đầu sau khoảng ${upcomingShift.diffMinutes} phút (Khung giờ: ${upcomingShift.item.startTime} - ${upcomingShift.item.endTime})`
                  : `Ca học đang diễn ra! (Bắt đầu lúc ${upcomingShift.item.startTime})`}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              setSelectedItem(upcomingShift.item);
              setShowDetailModal(true);
            }}
            style={{
              background: "white",
              color: "#d97706",
              border: "none",
              padding: "6px 14px",
              borderRadius: "10px",
              fontSize: "0.8rem",
              fontWeight: "800",
              cursor: "pointer",
              whiteSpace: "nowrap"
            }}
          >
            Xem Chi Tiết
          </button>
        </div>
      )}

      {/* KHU VỰC KÍCH HOẠT QUYỀN CTV CHO TÀI KHOẢN ĐÃ ĐƯỢC DUYỆT */}
      {((helperApplication?.isApproved) || (user?.email?.toLowerCase() === "tolahiep263@gmail.com")) && userProfile?.role === "user" && (
        <div className="glass-panel" style={{
          padding: "1.5rem",
          background: "linear-gradient(135deg, rgba(16, 185, 129, 0.1) 0%, rgba(255,255,255,1) 100%)",
          borderLeft: "5px solid #10B981",
          marginBottom: "0.5rem",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "15px"
        }}>
          <div>
            <h3 style={{ margin: 0, fontSize: "1.1rem", color: "#10B981", fontWeight: "800" }}>
              🎉 Chúc mừng! Hồ sơ CTV của bạn đã được duyệt!
            </h3>
            <p style={{ margin: "5px 0 0 0", fontSize: "0.85rem", color: "var(--text-secondary)" }}>
              Hãy nhấn nút bên phải để kích hoạt giao diện Không gian CTV và Chợ nhận lớp của bạn.
            </p>
          </div>
          <button
            type="button"
            onClick={async () => {
              try {
                toast.loading("Đang kích hoạt...", { id: "activate-ctv" });
                await updateDoc(doc(db, "users", user.uid), {
                  role: "helper"
                });
                toast.success("Kích hoạt CTV thành công! Hãy tải lại trang.", { id: "activate-ctv" });
              } catch (err) {
                console.error(err);
                toast.error("Lỗi kích hoạt: " + err.message, { id: "activate-ctv" });
              }
            }}
            className="btn btn-primary"
            style={{
              background: "#10B981",
              borderColor: "#10B981",
              color: "white",
              padding: "0.6rem 1.2rem",
              borderRadius: "10px",
              fontWeight: "750",
              cursor: "pointer",
              boxShadow: "0 4px 12px rgba(16, 185, 129, 0.25)"
            }}
          >
            🚀 Kích hoạt Giao diện CTV
          </button>
        </div>
      )}

      {/* GIAO DIỆN CHUYỂN CTV/HỌC VIÊN */}
      {(userProfile?.role === "helper" || userProfile?.role === "admin") && (
        <div className="ctv-mode-selector" style={{ display: "flex", justifyContent: "center", marginBottom: "0.5rem" }}>
          <div style={{ display: "flex", background: "#f1f5f9", padding: "4px", borderRadius: "14px", border: "1px solid #cbd5e1" }}>
            <button
              type="button"
              onClick={() => setIsCTVMode(false)}
              style={{
                padding: "8px 20px",
                borderRadius: "10px",
                border: "none",
                fontWeight: "750",
                fontSize: "0.85rem",
                cursor: "pointer",
                background: !isCTVMode ? "var(--primary)" : "transparent",
                color: !isCTVMode ? "white" : "var(--text-secondary)",
                boxShadow: !isCTVMode ? "0 4px 8px rgba(22, 163, 74, 0.2)" : "none",
                transition: "all 0.25s"
              }}
            >
              🎓 Giao diện Học viên
            </button>
            <button
              type="button"
              onClick={() => setIsCTVMode(true)}
              style={{
                padding: "8px 20px",
                borderRadius: "10px",
                border: "none",
                fontWeight: "750",
                fontSize: "0.85rem",
                cursor: "pointer",
                background: isCTVMode ? "#4F46E5" : "transparent",
                color: isCTVMode ? "white" : "var(--text-secondary)",
                boxShadow: isCTVMode ? "0 4px 8px rgba(79, 70, 229, 0.2)" : "none",
                transition: "all 0.25s"
              }}
            >
              💼 Giao diện Cộng tác viên (CTV)
            </button>
          </div>
        </div>
      )}

      {isCTVMode ? (
        renderCTVWorkspace()
      ) : (
        <>
          {/* TABS SELECTOR */}
      <div 
        className="hide-scrollbar main-tab-selector" 
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
          onClick={() => handleActiveTabChange("schedules")}
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
          onClick={() => handleActiveTabChange("wallet")}
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

      <div id="dashboard-active-content">
      {activeTab === "schedules" ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(290px, 1fr))", gap: "2.5rem" }}>
      
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

        {/* DRAFT RECOVERY BANNER (SESSION PRESERVATION) */}
        {hasDraft && (
          <div style={{
            background: "#fffbeb", border: "1px solid #fef3c7", padding: "12px 16px", borderRadius: "14px",
            marginBottom: "1.5rem", display: "flex", justifyContent: "space-between", alignItems: "center",
            boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.05)", animation: "slideDown 0.3s ease", textAlign: "left"
          }}>
            <div style={{ fontSize: "0.85rem", color: "#b45309", fontWeight: "600" }}>
              ⚡ Bạn có một bản nháp đơn chưa hoàn thành. Bạn muốn khôi phục không?
            </div>
            <div style={{ display: "flex", gap: "8px" }}>
              <button
                type="button"
                onClick={handleRestoreDraft}
                style={{
                  background: "#d97706", color: "white", border: "none", padding: "4px 10px",
                  borderRadius: "8px", fontSize: "0.75rem", fontWeight: "750", cursor: "pointer"
                }}
              >
                Khôi phục
              </button>
              <button
                type="button"
                onClick={handleClearDraft}
                style={{
                  background: "transparent", color: "#92400e", border: "1px solid #f59e0b",
                  padding: "3px 9px", borderRadius: "8px", fontSize: "0.75rem", fontWeight: "600", cursor: "pointer"
                }}
              >
                Xóa nháp
              </button>
            </div>
          </div>
        )}
        
        <form onSubmit={handleSubmit}>
          <div className="form-grid">
            <div className="form-group" style={{ gridColumn: "1 / -1" }}>
              <label className="form-label">Họ và Tên</label>
              <input type="text" name="name" value={formData.name} onChange={handleChange} required className="form-input" placeholder="Ví dụ: Nguyễn Văn A" />
            </div>
            
            <div className="form-group">
              <label className="form-label">Mã sinh viên</label>
              <input type="text" name="studentId" value={formData.studentId} onChange={handleChange} required className="form-input" placeholder="SV123456" />
              <span style={{ fontSize: "0.72rem", color: "var(--text-secondary)", marginTop: "4px", display: "block" }}>* Mã SV dùng để CTV điểm danh hoặc làm bài kiểm tra giúp bạn.</span>
            </div>

            <div className="form-group">
              <label className="form-label">Lớp (chính khóa)</label>
              <input type="text" name="classRegular" value={formData.classRegular} onChange={handleChange} required className="form-input" placeholder="Ví dụ: D15CNPM5" />
              <span style={{ fontSize: "0.72rem", color: "var(--text-secondary)", marginTop: "4px", display: "block" }}>* Lớp sinh hoạt chính của bạn trên trường.</span>
            </div>

            {getRecentSubjects().length > 0 && (
              <div className="form-group" style={{ gridColumn: "1 / -1", background: "rgba(22, 163, 74, 0.05)", padding: "12px", borderRadius: "12px", border: "1px dashed var(--primary)", textAlign: "left" }}>
                <span style={{ fontSize: "0.78rem", fontWeight: "750", color: "var(--primary)", display: "block", marginBottom: "6px" }}>📚 Chọn nhanh môn học đã đặt gần đây (Hiểu thói quen):</span>
                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                  {getRecentSubjects().map((sub, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        setFormData(prev => ({
                          ...prev,
                          className: sub.className,
                          startTime: sub.startTime,
                          endTime: sub.endTime,
                          school: sub.school,
                          classRegular: sub.classRegular || prev.classRegular,
                          price: sub.price || prev.price
                        }));
                        toast.success(`Đã tự động điền thông tin môn "${sub.className}"!`);
                      }}
                      style={{
                        background: "white",
                        border: "1px solid var(--primary)",
                        color: "var(--primary)",
                        padding: "4px 10px",
                        borderRadius: "8px",
                        fontSize: "0.75rem",
                        fontWeight: "700",
                        cursor: "pointer",
                        boxShadow: "0 2px 4px rgba(0,0,0,0.02)",
                        transition: "all 0.2s"
                      }}
                      onMouseOver={e => { e.currentTarget.style.background = "var(--primary)"; e.currentTarget.style.color = "white"; }}
                      onMouseOut={e => { e.currentTarget.style.background = "white"; e.currentTarget.style.color = "var(--primary)"; }}
                    >
                      📖 {sub.className}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="form-group">
              <label className="form-label">Lớp cần học hộ</label>
              <input type="text" name="className" value={formData.className} onChange={handleChange} required className="form-input" placeholder="Ví dụ: CS1.E402" />
              <span style={{ fontSize: "0.72rem", color: "var(--text-secondary)", marginTop: "4px", display: "block" }}>* Mã lớp học phần hoặc phòng học cụ thể cần người đi học hộ.</span>
            </div>

            <div className="form-group" style={{ gridColumn: "1 / -1" }}>
              <label className="form-label">Trường</label>
              <input type="text" name="school" value={formData.school} onChange={handleChange} required className="form-input" placeholder="Ví dụ: Đại học Công nghệ" />
              <span style={{ fontSize: "0.72rem", color: "var(--text-secondary)", marginTop: "4px", display: "block" }}>* Tên trường Đại học/Cao đẳng nơi có lớp học.</span>
            </div>

            {/* Người đi học (CTV Chỉ định) */}
            <div className="form-group" style={{ gridColumn: "1 / -1", background: "#f8fafc", padding: "12px", borderRadius: "12px", border: "1px solid #e2e8f0" }}>
              <label className="form-label" style={{ color: "var(--primary)", display: "flex", alignItems: "center", gap: "5px", fontWeight: "700" }}>
                <span>👤 Người đi học (CTV chỉ định)</span>
              </label>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "5px" }}>
                <span style={{ fontSize: "0.9rem", fontWeight: "700", color: requestedHelper ? "var(--primary)" : "var(--text-secondary)" }}>
                  {requestedHelper ? `🟢 ${requestedHelper}` : "⚪ Chưa chỉ định (CTV tự chọn nhận đơn / Admin duyệt)"}
                </span>
                {requestedHelper && (
                  <button 
                    type="button" 
                    onClick={() => { setRequestedHelper(""); setRequestedHelperEmail(""); }}
                    style={{ background: "#fee2e2", border: "none", color: "#b91c1c", padding: "4px 8px", borderRadius: "6px", fontSize: "0.75rem", fontWeight: "700", cursor: "pointer" }}
                  >
                    Hủy chỉ định
                  </button>
                )}
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Ngày tháng năm sinh</label>
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
              <span style={{ fontSize: "0.72rem", color: "var(--text-secondary)", marginTop: "4px", display: "block" }}>* Lựa chọn ngày cụ thể của buổi trực lớp cần đặt lịch.</span>
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
              <span style={{ fontSize: "0.72rem", color: "var(--text-secondary)", marginTop: "4px", display: "block" }}>* Định dạng 24h (ví dụ: 12:30 hoặc 07:45).</span>
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
              <span style={{ fontSize: "0.72rem", color: "var(--text-secondary)", marginTop: "4px", display: "block" }}>* Định dạng 24h (ví dụ: 14:00 hoặc 21:00).</span>
            </div>

            <div className="form-group" style={{ gridColumn: "1 / -1" }}>
              <label className="form-label">Mức giá đề xuất (VNĐ)</label>
              <input type="text" name="price" value={formData.price} onChange={handleChange} className="form-input" placeholder="Ví dụ: 50.000" />
              <span style={{ fontSize: "0.72rem", color: "#d97706", marginTop: "4px", display: "block", fontWeight: "600" }}>* Số tiền này sẽ được tạm giữ từ ví số dư của bạn khi đăng đơn và chỉ thực tế khấu trừ sau khi ca học hoàn tất thành công.</span>
            </div>

            {/* ĐẶT LỊCH ĐỊNH KỲ HÀNG TUẦN (RECURRING BOOKING WIZARD) */}
            <div className="form-group" style={{ gridColumn: "1 / -1", background: "#f8fafc", padding: "16px", borderRadius: "12px", border: "1px solid #e2e8f0" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <input 
                  type="checkbox" 
                  id="isRecurring"
                  checked={isRecurring} 
                  onChange={(e) => setIsRecurring(e.target.checked)} 
                  style={{ width: "18px", height: "18px", accentColor: "var(--primary)", cursor: "pointer" }}
                />
                <label htmlFor="isRecurring" style={{ fontSize: "0.9rem", fontWeight: "750", color: "var(--text-primary)", cursor: "pointer" }}>
                  🔁 Đặt lịch định kỳ hàng tuần (Tự động lặp lại)
                </label>
              </div>
              {isRecurring && (
                <div style={{ marginTop: "12px", display: "flex", alignItems: "center", gap: "12px", animation: "fadeIn 0.2s" }}>
                  <span style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>Số tuần lặp lại liên tục:</span>
                  <select
                    value={recurringWeeks}
                    onChange={(e) => setRecurringWeeks(Number(e.target.value))}
                    className="form-input"
                    style={{ width: "120px", padding: "4px 8px", fontSize: "0.85rem", background: "white", border: "1px solid #cbd5e1", height: "auto" }}
                  >
                    <option value={2}>2 tuần</option>
                    <option value={3}>3 tuần</option>
                    <option value={4}>4 tuần</option>
                    <option value={5}>5 tuần</option>
                  </select>
                  {formData.price && (
                    <span style={{ fontSize: "0.85rem", color: "#8B5CF6", fontWeight: "750" }}>
                      💵 Tổng thù lao: {Number(Number(formData.price.replace(/\./g, "")) * recurringWeeks).toLocaleString("vi-VN")} đ
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* DANH SÁCH NHIỆM VỤ CA HỌC (HELPER CHECKLIST) */}
            <div className="form-group" style={{ gridColumn: "1 / -1", background: "#f8fafc", padding: "16px", borderRadius: "12px", border: "1px solid #e2e8f0" }}>
              <label style={{ fontSize: "0.9rem", fontWeight: "750", color: "var(--text-primary)", display: "block", marginBottom: "8px" }}>
                📋 Danh sách Nhiệm vụ ca học (Giao cho CTV)
              </label>
              <div style={{ display: "flex", gap: "8px" }}>
                <input
                  type="text"
                  placeholder="Ví dụ: Chép slide chương 3, Điểm danh đầu giờ..."
                  value={taskInput}
                  onChange={(e) => setTaskInput(e.target.value)}
                  className="form-input"
                  style={{ flex: 1, padding: "6px 12px", fontSize: "0.85rem" }}
                />
                <button
                  type="button"
                  onClick={() => {
                    if (taskInput.trim()) {
                      setSessionTasks([...sessionTasks, taskInput.trim()]);
                      setTaskInput("");
                    }
                  }}
                  className="btn btn-primary"
                  style={{ padding: "6px 16px", borderRadius: "10px", fontSize: "0.85rem", whiteSpace: "nowrap" }}
                >
                  + Thêm
                </button>
              </div>
              {sessionTasks.length > 0 && (
                <div style={{ marginTop: "12px", display: "flex", flexDirection: "column", gap: "6px" }}>
                  {sessionTasks.map((t, idx) => (
                    <div key={idx} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "white", padding: "6px 12px", borderRadius: "8px", border: "1px solid #cbd5e1" }}>
                      <span style={{ fontSize: "0.82rem", color: "var(--text-primary)", fontWeight: "600" }}>{idx + 1}. {t}</span>
                      <button
                        type="button"
                        onClick={() => {
                          setSessionTasks(sessionTasks.filter((_, i) => i !== idx));
                        }}
                        style={{ background: "none", border: "none", color: "var(--danger)", cursor: "pointer", fontSize: "0.82rem", fontWeight: "700" }}
                      >
                        Xóa
                      </button>
                    </div>
                  ))}
                </div>
              )}
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
          <div className="stats-grid-4col" style={{ marginBottom: "1.5rem" }}>
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
                    {item.school} • {item.classRegular ? `${item.classRegular} • ` : ""}{item.className}
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
                    {item.status === "completed" && (
                      <button 
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleQuickRebook(item);
                        }}
                        style={{ display: "flex", alignItems: "center", gap: "4px", background: "rgba(22, 163, 74, 0.1)", border: "none", color: "var(--primary)", cursor: "pointer", padding: "0.4rem 0.6rem", borderRadius: "8px", fontSize: "0.8rem", fontWeight: "600", transition: "all 0.2s" }}
                        onMouseOver={e => e.currentTarget.style.background="rgba(22, 163, 74, 0.2)"}
                        onMouseOut={e => e.currentTarget.style.background="rgba(22, 163, 74, 0.1)"}
                      >
                        🔄 Đặt lại
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
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(290px, 1fr))", gap: "2.5rem" }}>
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
                <span style={{ fontSize: "0.72rem", color: "var(--text-secondary)", fontWeight: "600", display: "block", marginTop: "4px" }}>ℹ️ Rút tiền liên hệ Zalo Admin: <a href="https://zalo.me/0852866856" target="_blank" rel="noopener noreferrer" style={{ textDecoration: "underline", color: "var(--primary)" }}>0852866856</a></span>
              </div>
            )}

            <button 
              type="button" 
              onClick={handleTopupRequest}
              className="btn btn-primary"
              style={{ width: "100%", padding: "0.8rem", borderRadius: "12px" }}
              disabled={submittingTopup}
            >
              {submittingTopup ? "Đang xử lý..." : "Tôi đã chuyển tiền nạp ví"}
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
      </div>

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
            
            {/* ACTION BAR FOR PREMIUM UTILITIES */}
            <div style={{ display: "flex", gap: "10px", marginBottom: "1.5rem", flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={() => handleAddToGoogleCalendar(selectedItem)}
                className="btn"
                style={{ background: "#4285F4", color: "white", border: "none", borderRadius: "10px", padding: "8px 16px", fontWeight: "700", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "0.85rem" }}
              >
                📅 Thêm Google Calendar
              </button>

              <button
                type="button"
                onClick={() => handleDownloadICS(selectedItem)}
                className="btn"
                style={{ background: "#f8fafc", color: "var(--text-primary)", border: "1px solid #cbd5e1", borderRadius: "10px", padding: "8px 16px", fontWeight: "700", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "0.85rem" }}
              >
                📥 Tải file .ics
              </button>

              {(selectedItem.status === "in_progress" || selectedItem.status === "proof_submitted" || selectedItem.status === "completed") && (
                <button 
                  type="button"
                  onClick={() => setShowLiveTrackerModal(true)}
                  className="btn"
                  style={{ background: "#3b82f6", color: "white", border: "none", borderRadius: "10px", padding: "8px 16px", fontWeight: "700", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "0.85rem" }}
                >
                  👁️ Theo dõi ca trực trực tuyến
                </button>
              )}
              {(selectedItem.status === "approved" || selectedItem.status === "in_progress" || selectedItem.status === "completed" || selectedItem.paymentStatus === "Đã thanh toán") && (
                <button 
                  type="button"
                  onClick={() => setShowReceiptModal(true)}
                  className="btn"
                  style={{ background: "white", color: "var(--text-primary)", border: "1px solid #cbd5e1", borderRadius: "10px", padding: "8px 16px", fontWeight: "700", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "0.85rem" }}
                >
                  📄 Xuất Biên Lai
                </button>
              )}
              {selectedItem.status !== "disputed" && (selectedItem.status === "completed" || selectedItem.status === "proof_submitted" || selectedItem.status === "in_progress") && (
                <button 
                  type="button"
                  onClick={() => handleDisputeOrder(selectedItem.id)}
                  className="btn"
                  style={{ background: "#ef4444", color: "white", border: "none", borderRadius: "10px", padding: "8px 16px", fontWeight: "700", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "0.85rem" }}
                >
                  🚨 Khiếu Nại
                </button>
              )}
            </div>
            {selectedItem.status === "disputed" && (
              <div style={{ background: "#fef2f2", border: "1px solid #fca5a5", padding: "12px 16px", borderRadius: "14px", color: "#b91c1c", fontSize: "0.85rem", fontWeight: "600", marginBottom: "1.5rem", textAlign: "left" }}>
                🚨 Đơn hàng đang được giải quyết khiếu nại.<br/>
                <b>Lý do khiếu nại:</b> <i>{selectedItem.disputeReason}</i>
              </div>
            )}
            
            {/* Real-time Order Status Stepper */}
            {renderStatusStepper(selectedItem.status)}
            
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
                <strong style={{ color: "var(--text-secondary)", fontSize: "0.8rem", display: "block" }}>LỚP CẦN HỌC HỘ</strong>
                <span>{selectedItem.className}</span>
              </div>
              {selectedItem.classRegular && (
                <div style={{ borderBottom: "1px dashed #f1f5f9", paddingBottom: "8px" }}>
                  <strong style={{ color: "var(--text-secondary)", fontSize: "0.8rem", display: "block" }}>LỚP CHÍNH KHÓA</strong>
                  <span>{selectedItem.classRegular}</span>
                </div>
              )}
              <div style={{ borderBottom: "1px dashed #f1f5f9", paddingBottom: "8px" }}>
                <strong style={{ color: "var(--text-secondary)", fontSize: "0.8rem", display: "block" }}>TRƯỜNG HỌC</strong>
                <span>{selectedItem.school}</span>
              </div>
              <div style={{ borderBottom: "1px dashed #f1f5f9", paddingBottom: "8px" }}>
                <strong style={{ color: "var(--text-secondary)", fontSize: "0.8rem", display: "block" }}>SỐ ĐIỆN THOẠI</strong>
                <span>{selectedItem.phone || "Không cung cấp"}</span>
              </div>
              <div style={{ borderBottom: "1px dashed #f1f5f9", paddingBottom: "8px" }}>
                <strong style={{ color: "var(--text-secondary)", fontSize: "0.8rem", display: "block" }}>NGÀY THÁNG NĂM SINH</strong>
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

              {selectedItem.sessionTasks && selectedItem.sessionTasks.length > 0 && (
                <div style={{ gridColumn: "1 / -1", background: "#f0fdf4", padding: "12px", borderRadius: "10px", border: "1px solid #bbf7d0", textAlign: "left" }}>
                  <strong style={{ color: "#166534", fontSize: "0.8rem", display: "block", marginBottom: "6px" }}>📋 TIẾN ĐỘ NHIỆM VỤ CA HỌC</strong>
                  <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                    {selectedItem.sessionTasks.map((t, idx) => (
                      <div key={idx} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <span style={{ fontSize: "0.85rem", color: t.completed ? "var(--success)" : "#94a3b8" }}>
                          {t.completed ? "✅" : "⏳"}
                        </span>
                        <span style={{ fontSize: "0.85rem", textDecoration: t.completed ? "line-through" : "none", color: t.completed ? "#166534" : "var(--text-primary)", fontWeight: "600" }}>
                          {t.task}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
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
                <span style={{ fontSize: "0.72rem", color: "var(--text-secondary)", fontWeight: "600", display: "block", marginTop: "4px" }}>ℹ️ Rút tiền liên hệ Zalo Admin: <a href="https://zalo.me/0852866856" target="_blank" rel="noopener noreferrer" style={{ textDecoration: "underline", color: "var(--primary)" }}>0852866856</a></span>
              </div>
            )}

            <button 
              type="button" 
              onClick={handleTopupRequest}
              className="btn btn-primary"
              style={{ width: "100%", padding: "0.8rem", borderRadius: "12px" }}
              disabled={submittingTopup}
            >
              {submittingTopup ? "Đang xử lý..." : "Tôi đã chuyển tiền nạp ví"}
            </button>
          </div>
        </div>
      )}
        </>
      )}

      {/* POPUP YÊU CẦU RÚT TIỀN THÙ LAO CTV */}
      {showPayoutModal && (
        <div 
          style={{
            position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
            background: "rgba(0,0,0,0.6)", backdropFilter: "blur(6px)",
            display: "flex", alignItems: "center", justifyContent: "center",
            zIndex: 1001, padding: "1.5rem"
          }}
          onClick={() => setShowPayoutModal(false)}
        >
          <form 
            onSubmit={handlePayoutRequest}
            style={{
              background: "white", borderRadius: "24px", padding: "2rem",
              maxWidth: "450px", width: "100%", border: "1px solid #e2e8f0"
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
              <h3 style={{ margin: 0, fontSize: "1.25rem", fontWeight: "800", color: "var(--text-primary)" }}>Yêu cầu rút thù lao CTV</h3>
              <button type="button" onClick={() => setShowPayoutModal(false)} style={{ background: "none", border: "none", fontSize: "1.5rem", cursor: "pointer", color: "#64748b" }}>&times;</button>
            </div>

            <div style={{ background: "rgba(79,70,229,0.05)", padding: "10px 15px", borderRadius: "12px", marginBottom: "1.25rem", fontSize: "0.85rem", color: "var(--text-secondary)" }}>
              Số dư ví thù lao khả dụng: <strong style={{ color: "#16a34a" }}>{(userProfile?.helperBalance || 0).toLocaleString("vi-VN")} đ</strong>
            </div>

            <div className="form-group" style={{ marginBottom: "1rem" }}>
              <label className="form-label" style={{ fontWeight: "700" }}>Số tiền muốn rút (VNĐ)</label>
              <input
                type="number"
                value={payoutAmount}
                onChange={e => setPayoutAmount(e.target.value)}
                placeholder="Ví dụ: 100000"
                className="form-input"
                required
              />
            </div>

            <div className="form-group" style={{ marginBottom: "1rem" }}>
              <label className="form-label" style={{ fontWeight: "700" }}>Chọn Ngân hàng</label>
              <select 
                value={payoutBankName} 
                onChange={e => setPayoutBankName(e.target.value)}
                className="form-input"
                style={{ background: "white" }}
              >
                <option value="MBBank">MBBank (Ngân hàng Quân Đội)</option>
                <option value="Vietcombank">Vietcombank</option>
                <option value="Agribank">Agribank</option>
                <option value="BIDV">BIDV</option>
                <option value="Techcombank">Techcombank</option>
                <option value="Viettinbank">VietinBank</option>
                <option value="Momo">Ví điện tử Momo</option>
              </select>
            </div>

            <div className="form-group" style={{ marginBottom: "1rem" }}>
              <label className="form-label" style={{ fontWeight: "700" }}>Số tài khoản</label>
              <input
                type="text"
                value={payoutBankAccount}
                onChange={e => setPayoutBankAccount(e.target.value)}
                placeholder="Nhập số tài khoản nhận tiền"
                className="form-input"
                required
              />
            </div>

            <div className="form-group" style={{ marginBottom: "1.5rem" }}>
              <label className="form-label" style={{ fontWeight: "700" }}>Họ tên chủ tài khoản (Viết hoa không dấu)</label>
              <input
                type="text"
                value={payoutBankOwner}
                onChange={e => setPayoutBankOwner(e.target.value)}
                placeholder="Ví dụ: NGUYEN VAN A"
                className="form-input"
                required
              />
            </div>

            <button 
              type="submit" 
              className="btn"
              style={{ width: "100%", padding: "0.8rem", borderRadius: "12px", background: "#4F46E5", color: "white", border: "none", fontWeight: "700", cursor: "pointer" }}
            >
              Gửi yêu cầu rút thù lao
            </button>
          </form>
        </div>
      )}

      {/* POPUP NỘP MINH CHỨNG HOÀN THÀNH ĐƠN (CTV 3 BƯỚC) */}
      {showProofModal && selectedJobForProof && (
        <div 
          style={{
            position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
            background: "rgba(15, 23, 42, 0.65)", backdropFilter: "blur(8px)",
            display: "flex", alignItems: "center", justifyContent: "center",
            zIndex: 1001, padding: "1rem"
          }}
          onClick={() => setShowProofModal(false)}
        >
          <div 
            style={{
              background: "white", borderRadius: "24px", padding: "1.75rem",
              maxWidth: "500px", width: "100%", border: "1px solid #e2e8f0",
              boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)"
            }}
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem" }}>
              <div>
                <h3 style={{ margin: 0, fontSize: "1.2rem", fontWeight: "850", color: "var(--text-primary)" }}>
                  📝 Nhật Ký Điểm Danh 3 Bước
                </h3>
                <span style={{ fontSize: "0.78rem", color: "var(--text-secondary)" }}>
                  Môn: <b>{selectedJobForProof.className || selectedJobForProof.subject}</b> | Phòng: <b>{selectedJobForProof.classroom || "N/A"}</b>
                </span>
              </div>
              <button type="button" onClick={() => setShowProofModal(false)} style={{ background: "none", border: "none", fontSize: "1.5rem", cursor: "pointer", color: "#64748b" }}>&times;</button>
            </div>

            {/* Timeline steps */}
            <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem", marginBottom: "1.5rem", position: "relative" }}>
              
              {/* Step 1 */}
              <div style={{ display: "flex", gap: "12px", position: "relative" }}>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                  <div style={{
                    width: "28px", height: "28px", borderRadius: "50%",
                    background: selectedJobForProof.checkinStartImage ? "var(--success)" : "var(--primary-light)",
                    color: selectedJobForProof.checkinStartImage ? "white" : "var(--primary)",
                    display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "750", fontSize: "0.85rem"
                  }}>
                    {selectedJobForProof.checkinStartImage ? "✓" : "1"}
                  </div>
                  <div style={{ width: "2px", flex: 1, background: "#cbd5e1", margin: "4px 0", minHeight: "25px" }}></div>
                </div>
                <div style={{ flex: 1, textAlign: "left" }}>
                  <strong style={{ fontSize: "0.85rem", color: "var(--text-primary)" }}>Bước 1: Check-in đầu giờ 🏫</strong>
                  <p style={{ margin: "2px 0 6px 0", fontSize: "0.75rem", color: "var(--text-secondary)" }}>Chụp ảnh phòng học hoặc bảng viết lúc bắt đầu ca học.</p>
                  
                  {selectedJobForProof.checkinStartImage ? (
                    <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                      <img src={selectedJobForProof.checkinStartImage} alt="Start Check-in" style={{ width: "50px", height: "50px", objectFit: "cover", borderRadius: "6px", border: "1px solid #e2e8f0" }} />
                      <span style={{ fontSize: "0.7rem", color: "var(--success)", fontWeight: "600" }}>
                        Đã điểm danh: {new Date(selectedJobForProof.checkinStartAt).toLocaleTimeString("vi-VN", { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  ) : (
                    <label className="btn" style={{ display: "inline-block", background: "var(--primary)", color: "white", padding: "4px 10px", fontSize: "0.72rem", borderRadius: "6px", cursor: "pointer", fontWeight: "700" }}>
                      📸 Chụp ảnh Check-in
                      <input 
                        type="file" 
                        accept="image/*" 
                        onChange={e => {
                          if (e.target.files?.[0]) handleUploadStepImage(1, e.target.files[0]);
                        }} 
                        style={{ display: "none" }} 
                      />
                    </label>
                  )}
                </div>
              </div>

              {/* Step 2 */}
              <div style={{ display: "flex", gap: "12px", position: "relative" }}>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                  <div style={{
                    width: "28px", height: "28px", borderRadius: "50%",
                    background: selectedJobForProof.checkinMiddleImage ? "var(--success)" : "var(--primary-light)",
                    color: selectedJobForProof.checkinMiddleImage ? "white" : "var(--primary)",
                    display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "750", fontSize: "0.85rem",
                    opacity: selectedJobForProof.checkinStartImage ? 1 : 0.5
                  }}>
                    {selectedJobForProof.checkinMiddleImage ? "✓" : "2"}
                  </div>
                  <div style={{ width: "2px", flex: 1, background: "#cbd5e1", margin: "4px 0", minHeight: "25px" }}></div>
                </div>
                <div style={{ flex: 1, textAlign: "left", opacity: selectedJobForProof.checkinStartImage ? 1 : 0.5 }}>
                  <strong style={{ fontSize: "0.85rem", color: "var(--text-primary)" }}>Bước 2: Minh chứng giữa ca 📝</strong>
                  <p style={{ margin: "2px 0 6px 0", fontSize: "0.75rem", color: "var(--text-secondary)" }}>Chụp ảnh tài liệu học tập hoặc nội dung trên bảng giảng dạy.</p>
                  
                  {selectedJobForProof.checkinMiddleImage ? (
                    <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                      <img src={selectedJobForProof.checkinMiddleImage} alt="Middle Check-in" style={{ width: "50px", height: "50px", objectFit: "cover", borderRadius: "6px", border: "1px solid #e2e8f0" }} />
                      <span style={{ fontSize: "0.7rem", color: "var(--success)", fontWeight: "600" }}>
                        Đã nộp lúc: {new Date(selectedJobForProof.checkinMiddleAt).toLocaleTimeString("vi-VN", { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  ) : (
                    <label 
                      className="btn" 
                      style={{ 
                        display: "inline-block", 
                        background: selectedJobForProof.checkinStartImage ? "var(--primary)" : "#cbd5e1", 
                        color: "white", padding: "4px 10px", fontSize: "0.72rem", borderRadius: "6px", 
                        cursor: selectedJobForProof.checkinStartImage ? "pointer" : "not-allowed", 
                        fontWeight: "700" 
                      }}
                    >
                      📸 Nộp ảnh Giữa giờ
                      {selectedJobForProof.checkinStartImage && (
                        <input 
                          type="file" 
                          accept="image/*" 
                          onChange={e => {
                            if (e.target.files?.[0]) handleUploadStepImage(2, e.target.files[0]);
                          }} 
                          style={{ display: "none" }} 
                        />
                      )}
                    </label>
                  )}
                </div>
              </div>

              {/* Step 3 */}
              <div style={{ display: "flex", gap: "12px", position: "relative" }}>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                  <div style={{
                    width: "28px", height: "28px", borderRadius: "50%",
                    background: selectedJobForProof.checkinEndImage ? "var(--success)" : "var(--primary-light)",
                    color: selectedJobForProof.checkinEndImage ? "white" : "var(--primary)",
                    display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "750", fontSize: "0.85rem",
                    opacity: selectedJobForProof.checkinMiddleImage ? 1 : 0.5
                  }}>
                    {selectedJobForProof.checkinEndImage ? "✓" : "3"}
                  </div>
                </div>
                <div style={{ flex: 1, textAlign: "left", opacity: selectedJobForProof.checkinMiddleImage ? 1 : 0.5 }}>
                  <strong style={{ fontSize: "0.85rem", color: "var(--text-primary)" }}>Bước 3: Check-out tan học 🚗</strong>
                  <p style={{ margin: "2px 0 6px 0", fontSize: "0.75rem", color: "var(--text-secondary)" }}>Chụp ảnh phòng học kết thúc để nộp báo cáo hoàn thành đơn.</p>
                  
                  {selectedJobForProof.checkinEndImage ? (
                    <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                      <img src={selectedJobForProof.checkinEndImage} alt="End Check-in" style={{ width: "50px", height: "50px", objectFit: "cover", borderRadius: "6px", border: "1px solid #e2e8f0" }} />
                      <span style={{ fontSize: "0.7rem", color: "var(--success)", fontWeight: "600" }}>
                        Đã tan học lúc: {new Date(selectedJobForProof.checkinEndAt).toLocaleTimeString("vi-VN", { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  ) : (
                    <label 
                      className="btn" 
                      style={{ 
                        display: "inline-block", 
                        background: selectedJobForProof.checkinMiddleImage ? "var(--success)" : "#cbd5e1", 
                        color: "white", padding: "4px 10px", fontSize: "0.72rem", borderRadius: "6px", 
                        cursor: selectedJobForProof.checkinMiddleImage ? "pointer" : "not-allowed", 
                        fontWeight: "700" 
                      }}
                    >
                      📸 Check-out Tan học
                      {selectedJobForProof.checkinMiddleImage && (
                        <input 
                          type="file" 
                          accept="image/*" 
                          onChange={e => {
                            if (e.target.files?.[0]) handleUploadStepImage(3, e.target.files[0]);
                          }} 
                          style={{ display: "none" }} 
                        />
                      )}
                    </label>
                  )}
                </div>
              </div>

            </div>

            {selectedJobForProof.sessionTasks && selectedJobForProof.sessionTasks.length > 0 && (
              <div style={{ background: "#f8fafc", padding: "12px 16px", borderRadius: "16px", border: "1px solid #e2e8f0", marginBottom: "1.5rem", textAlign: "left" }}>
                <span style={{ fontSize: "0.85rem", fontWeight: "750", color: "var(--primary)", display: "block", marginBottom: "8px" }}>
                  📋 Nhiệm vụ Học viên yêu cầu hoàn thành:
                </span>
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {selectedJobForProof.sessionTasks.map((t, idx) => (
                    <div key={idx} style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <input
                        type="checkbox"
                        id={`helper-task-${idx}`}
                        checked={t.completed}
                        onChange={() => handleToggleTask(selectedJobForProof.id, idx, t.completed)}
                        style={{ width: "16px", height: "16px", accentColor: "var(--primary)", cursor: "pointer" }}
                      />
                      <label htmlFor={`helper-task-${idx}`} style={{ fontSize: "0.8rem", color: "var(--text-primary)", textDecoration: t.completed ? "line-through" : "none", cursor: "pointer" }}>
                        {t.task}
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Close footer */}
            <button 
              type="button" 
              onClick={() => setShowProofModal(false)}
              className="btn"
              style={{ width: "100%", padding: "0.75rem", borderRadius: "12px", background: "#f1f5f9", color: "var(--text-primary)", border: "none", fontWeight: "700", cursor: "pointer", fontSize: "0.85rem" }}
            >
              Đóng cửa sổ
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

            <div style={{ display: "flex", justifyContent: "center", gap: "10px", marginBottom: "1.25rem" }}>
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

            {/* HUY HIỆU TẶNG CTV */}
            <div style={{ marginBottom: "1.25rem" }}>
              <label style={{ fontSize: "0.85rem", fontWeight: "700", color: "var(--text-primary)", display: "block", marginBottom: "8px" }}>
                🎖️ Tặng huy hiệu ghi nhận cho CTV:
              </label>
              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                {[
                  { id: "punctual", label: "⏰ Đúng giờ xuất sắc" },
                  { id: "handwriting", label: "📝 Chép bài siêu đẹp" },
                  { id: "enthusiastic", label: "💬 Hỗ trợ nhiệt tình" }
                ].map(b => {
                  const active = selectedBadges.includes(b.id);
                  return (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() => {
                        if (active) {
                          setSelectedBadges(selectedBadges.filter(id => id !== b.id));
                        } else {
                          setSelectedBadges([...selectedBadges, b.id]);
                        }
                      }}
                      style={{
                        padding: "6px 12px",
                        borderRadius: "20px",
                        fontSize: "0.78rem",
                        fontWeight: "600",
                        border: active ? "1px solid #f59e0b" : "1px solid #e2e8f0",
                        background: active ? "#fef3c7" : "#f8fafc",
                        color: active ? "#b45309" : "#475569",
                        cursor: "pointer"
                      }}
                    >
                      {b.label} {active ? "✓" : ""}
                    </button>
                  );
                })}
              </div>
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

      {/* OVERLAY MODAL: THEO DÕI CA TRỰC TRỰC TUYẾN (DÀNH CHO HỌC VIÊN) */}
      {showLiveTrackerModal && selectedItem && (
        <div 
          style={{
            position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
            background: "rgba(15, 23, 42, 0.65)", backdropFilter: "blur(8px)",
            display: "flex", alignItems: "center", justifyContent: "center",
            zIndex: 1002, padding: "1rem"
          }}
          onClick={() => setShowLiveTrackerModal(false)}
        >
          <div 
            style={{
              background: "white", borderRadius: "24px", padding: "2rem",
              maxWidth: "500px", width: "100%", maxHeight: "85vh", overflowY: "auto",
              boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1)", border: "1px solid #cbd5e1"
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem", borderBottom: "1px solid #f1f5f9", paddingBottom: "1rem" }}>
              <div>
                <h3 style={{ margin: 0, fontSize: "1.25rem", fontWeight: "850", color: "var(--text-primary)" }}>
                  👁️ Theo Dõi Ca Trực Trực Tuyến
                </h3>
                <span style={{ fontSize: "0.78rem", color: "var(--text-secondary)" }}>
                  Mã đơn: <b>{selectedItem.id.substring(0, 8).toUpperCase()}</b> | Môn: <b>{selectedItem.className}</b>
                </span>
              </div>
              <button type="button" onClick={() => setShowLiveTrackerModal(false)} style={{ background: "none", border: "none", fontSize: "1.5rem", cursor: "pointer", color: "#64748b" }}>&times;</button>
            </div>

            <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)", marginBottom: "1.5rem", textAlign: "left" }}>
              Trạng thái điểm danh lớp học của bạn được đồng bộ tức thì dưới đây.
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem", position: "relative" }}>
              
              {/* Step 1 */}
              <div style={{ display: "flex", gap: "12px", textAlign: "left" }}>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                  <div style={{
                    width: "28px", height: "28px", borderRadius: "50%",
                    background: selectedItem.checkinStartImage ? "var(--success)" : "#e2e8f0",
                    color: selectedItem.checkinStartImage ? "white" : "#94a3b8",
                    display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "750", fontSize: "0.85rem"
                  }}>
                    {selectedItem.checkinStartImage ? "✓" : "1"}
                  </div>
                  <div style={{ width: "2px", flex: 1, background: "#e2e8f0", margin: "4px 0", minHeight: "35px" }}></div>
                </div>
                <div style={{ flex: 1 }}>
                  <strong style={{ fontSize: "0.85rem", color: "var(--text-primary)" }}>Bước 1: Check-in đầu ca 🏫</strong>
                  {selectedItem.checkinStartImage ? (
                    <div style={{ marginTop: "6px" }}>
                      <img 
                        src={selectedItem.checkinStartImage} 
                        alt="Đầu ca" 
                        style={{ width: "80px", height: "80px", objectFit: "cover", borderRadius: "8px", border: "1px solid #e2e8f0", cursor: "pointer" }}
                        onClick={() => setLightboxImage(selectedItem.checkinStartImage)}
                      />
                      <div style={{ fontSize: "0.7rem", color: "var(--success)", fontWeight: "600", marginTop: "4px" }}>
                        Đã check-in lúc: {new Date(selectedItem.checkinStartAt).toLocaleString("vi-VN", { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  ) : (
                    <span style={{ fontSize: "0.72rem", color: "var(--text-secondary)", display: "block", fontStyle: "italic", marginTop: "2px" }}>Chờ CTV vào lớp...</span>
                  )}
                </div>
              </div>

              {/* Step 2 */}
              <div style={{ display: "flex", gap: "12px", textAlign: "left" }}>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                  <div style={{
                    width: "28px", height: "28px", borderRadius: "50%",
                    background: selectedItem.checkinMiddleImage ? "var(--success)" : "#e2e8f0",
                    color: selectedItem.checkinMiddleImage ? "white" : "#94a3b8",
                    display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "750", fontSize: "0.85rem"
                  }}>
                    {selectedItem.checkinMiddleImage ? "✓" : "2"}
                  </div>
                  <div style={{ width: "2px", flex: 1, background: "#e2e8f0", margin: "4px 0", minHeight: "35px" }}></div>
                </div>
                <div style={{ flex: 1 }}>
                  <strong style={{ fontSize: "0.85rem", color: "var(--text-primary)" }}>Bước 2: Học tập & thảo luận giữa ca 📝</strong>
                  {selectedItem.checkinMiddleImage ? (
                    <div style={{ marginTop: "6px" }}>
                      <img 
                        src={selectedItem.checkinMiddleImage} 
                        alt="Giữa ca" 
                        style={{ width: "80px", height: "80px", objectFit: "cover", borderRadius: "8px", border: "1px solid #e2e8f0", cursor: "pointer" }}
                        onClick={() => setLightboxImage(selectedItem.checkinMiddleImage)}
                      />
                      <div style={{ fontSize: "0.7rem", color: "var(--success)", fontWeight: "600", marginTop: "4px" }}>
                        Đã xác thực lúc: {new Date(selectedItem.checkinMiddleAt).toLocaleString("vi-VN", { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  ) : (
                    <span style={{ fontSize: "0.72rem", color: "var(--text-secondary)", display: "block", fontStyle: "italic", marginTop: "2px" }}>Chờ minh chứng giữa ca...</span>
                  )}
                </div>
              </div>

              {/* Step 3 */}
              <div style={{ display: "flex", gap: "12px", textAlign: "left" }}>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                  <div style={{
                    width: "28px", height: "28px", borderRadius: "50%",
                    background: selectedItem.checkinEndImage ? "var(--success)" : "#e2e8f0",
                    color: selectedItem.checkinEndImage ? "white" : "#94a3b8",
                    display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "750", fontSize: "0.85rem"
                  }}>
                    {selectedItem.checkinEndImage ? "✓" : "3"}
                  </div>
                </div>
                <div style={{ flex: 1 }}>
                  <strong style={{ fontSize: "0.85rem", color: "var(--text-primary)" }}>Bước 3: Hoàn thành & Check-out 🚗</strong>
                  {selectedItem.checkinEndImage ? (
                    <div style={{ marginTop: "6px" }}>
                      <img 
                        src={selectedItem.checkinEndImage} 
                        alt="Tan học" 
                        style={{ width: "80px", height: "80px", objectFit: "cover", borderRadius: "8px", border: "1px solid #e2e8f0", cursor: "pointer" }}
                        onClick={() => setLightboxImage(selectedItem.checkinEndImage)}
                      />
                      <div style={{ fontSize: "0.7rem", color: "var(--success)", fontWeight: "600", marginTop: "4px" }}>
                        Tan học ra về lúc: {new Date(selectedItem.checkinEndAt).toLocaleString("vi-VN", { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  ) : (
                    <span style={{ fontSize: "0.72rem", color: "var(--text-secondary)", display: "block", fontStyle: "italic", marginTop: "2px" }}>Chờ hoàn thành buổi học...</span>
                  )}
                </div>
              </div>

            </div>

            <button 
              type="button" 
              onClick={() => setShowLiveTrackerModal(false)}
              className="btn btn-primary"
              style={{ width: "100%", marginTop: "1.5rem", padding: "0.8rem", borderRadius: "12px" }}
            >
              Đóng cửa sổ
            </button>
          </div>
        </div>
      )}

      {/* OVERLAY MODAL: XUẤT BIÊN LAI ĐÓNG TIỀN (PRINTABLE E-RECEIPT) */}
      {showReceiptModal && selectedItem && (
        <div 
          style={{
            position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
            background: "rgba(15, 23, 42, 0.65)", backdropFilter: "blur(8px)",
            display: "flex", alignItems: "center", justifyContent: "center",
            zIndex: 1003, padding: "1rem"
          }}
          onClick={() => setShowReceiptModal(false)}
        >
          <div 
            style={{
              background: "white", borderRadius: "24px", padding: "2.5rem",
              maxWidth: "520px", width: "100%", maxHeight: "90vh", overflowY: "auto",
              boxShadow: "0 25px 50px -12px rgba(0,0,0,0.25)", position: "relative"
            }}
            onClick={e => e.stopPropagation()}
          >
            {/* Style for printing */}
            <style dangerouslySetInnerHTML={{__html: `
              @media print {
                body * {
                  visibility: hidden;
                }
                #print-receipt-area, #print-receipt-area * {
                  visibility: visible;
                }
                #print-receipt-area {
                  position: absolute;
                  left: 0;
                  top: 0;
                  width: 100%;
                  box-shadow: none !important;
                  border: none !important;
                  padding: 20px !important;
                  background: white !important;
                }
              }
            `}} />

            {/* Printable Area */}
            <div id="print-receipt-area" style={{ textAlign: "left", background: "#ffffff" }}>
              
              {/* Logo / Header */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", borderBottom: "2px solid #1e293b", paddingBottom: "1rem", marginBottom: "1.5rem" }}>
                <div>
                  <h2 style={{ margin: 0, color: "var(--primary)", fontSize: "1.5rem", fontWeight: "900", letterSpacing: "-0.5px" }}>THUÊ HỌC PRO</h2>
                  <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)", fontWeight: "600" }}>HỆ THỐNG QUẢN LÝ LÀM BÀI & TRỰC LỚP CHUYÊN NGHIỆP</span>
                </div>
                <div style={{ textAlign: "right" }}>
                  <span style={{ fontSize: "0.85rem", fontWeight: "800", color: "#64748b", display: "block" }}>BIÊN LAI THANH TOÁN</span>
                  <span style={{ fontSize: "0.72rem", color: "#94a3b8", fontFamily: "monospace" }}>#INV-{selectedItem.id.substring(0, 8).toUpperCase()}</span>
                </div>
              </div>

              {/* Bill to */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1.5rem", fontSize: "0.82rem" }}>
                <div>
                  <strong style={{ color: "var(--text-secondary)", display: "block", marginBottom: "3px" }}>NGƯỜI THANH TOÁN:</strong>
                  <span style={{ fontWeight: "750", color: "var(--text-primary)", fontSize: "0.9rem" }}>{selectedItem.name}</span><br/>
                  <span>MSSV: {selectedItem.studentId}</span><br/>
                  <span>Lớp: {selectedItem.classRegular || "N/A"}</span><br/>
                  <span>Trường: {selectedItem.school}</span>
                </div>
                <div style={{ textAlign: "right" }}>
                  <strong style={{ color: "var(--text-secondary)", display: "block", marginBottom: "3px" }}>THÔNG TIN ĐƠN:</strong>
                  <span>Ngày in: {new Date().toLocaleDateString("vi-VN")}</span><br/>
                  <span>Ngày học: {selectedItem.classDate}</span><br/>
                  <span>Thời gian: {selectedItem.startTime} - {selectedItem.endTime}</span>
                </div>
              </div>

              {/* Main Service description */}
              <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "1.5rem", fontSize: "0.85rem" }}>
                <thead>
                  <tr style={{ background: "#f8fafc", borderBottom: "1px solid #cbd5e1" }}>
                    <th style={{ padding: "8px", textAlign: "left", fontWeight: "700", color: "var(--text-primary)" }}>Mô tả dịch vụ</th>
                    <th style={{ padding: "8px", textAlign: "right", fontWeight: "700", color: "var(--text-primary)" }}>Thành tiền</th>
                  </tr>
                </thead>
                <tbody>
                  <tr style={{ borderBottom: "1px solid #cbd5e1" }}>
                    <td style={{ padding: "12px 8px" }}>
                      <strong style={{ display: "block", color: "var(--text-primary)" }}>Dịch vụ học hộ môn: {selectedItem.className}</strong>
                      <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>Hỗ trợ trực lớp thực tế và ghi chú nội dung giảng dạy.</span>
                    </td>
                    <td style={{ padding: "12px 8px", textAlign: "right", fontWeight: "750" }}>
                      {Number(selectedItem.price || 0).toLocaleString("vi-VN")} đ
                    </td>
                  </tr>
                </tbody>
              </table>

              {/* Total Block */}
              <div style={{ borderTop: "2px dashed #cbd5e1", paddingTop: "1rem", display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "2rem" }}>
                <div>
                  <span style={{
                    fontSize: "0.75rem", padding: "4px 10px", borderRadius: "20px", fontWeight: "800",
                    background: "#dcfce7", color: "#166534", border: "1px solid #bbf7d0", letterSpacing: "1px", textTransform: "uppercase"
                  }}>
                    ✓ Đã Thanh Toán
                  </span>
                </div>
                <div style={{ textAlign: "right" }}>
                  <span style={{ fontSize: "0.85rem", color: "var(--text-secondary)", fontWeight: "600" }}>Tổng số tiền thanh toán:</span>
                  <div style={{ fontSize: "1.4rem", fontWeight: "900", color: "var(--primary)" }}>
                    {Number(selectedItem.price || 0).toLocaleString("vi-VN")} đ
                  </div>
                </div>
              </div>

              {/* Footer text */}
              <div style={{ borderTop: "1px solid #cbd5e1", paddingTop: "1rem", textAlign: "center", fontSize: "0.72rem", color: "var(--text-secondary)" }}>
                Cảm ơn bạn đã lựa chọn Thuê Học Pro. Mọi thắc mắc liên hệ hotro@thuehoc.pro.<br/>
                <i>Hóa đơn điện tử được ký và xác nhận thanh toán tự động bởi hệ thống tài chính THUEHOCPRO.</i>
              </div>
            </div>

            {/* Print action buttons */}
            <div style={{ display: "flex", gap: "10px", marginTop: "2rem" }}>
              <button 
                type="button" 
                onClick={() => window.print()}
                className="btn btn-primary"
                style={{ flex: 1, padding: "0.8rem", borderRadius: "12px", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "6px", fontWeight: "750" }}
              >
                🖨️ In Biên Lai (Print / PDF)
              </button>
              <button 
                type="button" 
                onClick={() => setShowReceiptModal(false)}
                className="btn"
                style={{ padding: "0.8rem 1.5rem", borderRadius: "12px", background: "#f1f5f9", color: "var(--text-primary)", border: "none", fontWeight: "700", cursor: "pointer" }}
              >
                Đóng
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Lightbox Modal phóng to ảnh */}
      {lightboxImage && (
        <div 
          style={{
            position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
            background: "rgba(0,0,0,0.85)", zIndex: 9999,
            display: "flex", justifyContent: "center", alignItems: "center",
            padding: "1rem"
          }}
          onClick={() => setLightboxImage(null)}
        >
          <div style={{ position: "relative", maxWidth: "90%", maxHeight: "90%" }} onClick={e => e.stopPropagation()}>
            <button 
              onClick={() => setLightboxImage(null)} 
              style={{
                position: "absolute", top: "-45px", right: "0",
                background: "none", border: "none", color: "white",
                fontSize: "2.5rem", cursor: "pointer", lineHeight: "1"
              }}
            >
              &times;
            </button>
            <img 
              src={lightboxImage} 
              alt="Ảnh phóng to" 
              style={{ maxWidth: "100%", maxHeight: "80vh", borderRadius: "12px", border: "2px solid white", boxShadow: "0 10px 25px rgba(0,0,0,0.5)" }} 
            />
          </div>
        </div>
      )}

    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "100vh", background: "#f8fafc", color: "var(--text-secondary)" }}>
        Đang tải trang cá nhân...
      </div>
    }>
      <Dashboard />
    </Suspense>
  );
}
