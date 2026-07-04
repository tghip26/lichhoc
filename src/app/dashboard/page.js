"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { db, storage } from "@/lib/firebase";
import { collection, addDoc, serverTimestamp, query, where, orderBy, onSnapshot, doc, deleteDoc } from "firebase/firestore";
import { ref, uploadString, getDownloadURL } from "firebase/storage";
import toast from "react-hot-toast";
import imageCompression from "browser-image-compression";

export default function Dashboard() {
  const { user, loading } = useAuth();
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

  useEffect(() => {
    if (!loading && !user) {
      router.push("/");
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (user) {
      const q = query(
        collection(db, "schedules"), 
        where("userId", "==", user.uid),
        orderBy("createdAt", "desc")
      );
      
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const data = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setHistory(data);
        setLoadingHistory(false);
      }, (error) => {
        console.error("Lỗi tải lịch sử:", error);
        setLoadingHistory(false);
      });

      return () => unsubscribe();
    }
  }, [user]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
    
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
    if (!file) {
      toast.error("Vui lòng đợi ảnh tải xong hoặc chọn ảnh khác!");
      return;
    }

    setUploading(true);
    setProgress(30);
    toast.loading("Đang đẩy dữ liệu lên máy chủ...", { id: "upload" });

    // GIAI ĐOẠN ĐỘT PHÁ: Lưu thẳng chuỗi văn bản ảnh vào CSDL Firestore (Không cần Storage)
    try {
      await addDoc(collection(db, "schedules"), {
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
        price: formData.price,
        weekday: weekday,
        imageUrl: file, // Lưu trực tiếp chuỗi Base64
        status: "pending",
        createdAt: serverTimestamp()
      });

      setProgress(100);
      toast.success("Thành công! Đơn thuê học đã được nộp.", { id: "upload" });
      
      // Reset form
      setFormData({ 
        name: "", className: "", studentId: "", school: "", 
        classDate: "", startTime: "", endTime: "", dob: "", notes: "", phone: "", price: "" 
      });
      setWeekday("");
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

  const getStatusBadge = (status) => {
    switch (status) {
      case "approved":
      case "accepted":
        return <span style={{ background: "rgba(16, 185, 129, 0.15)", color: "var(--success)", padding: "4px 10px", borderRadius: "12px", fontSize: "0.8rem", fontWeight: "700" }}>Sắp học</span>;
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

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(380px, 1fr))", gap: "2.5rem", marginTop: "2rem" }}>
      
      {/* LEFT COLUMN: Upload Form */}
      <div className="glass-panel" style={{ padding: "2.5rem" }}>
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
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.25rem" }}>
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
              <input type="date" name="classDate" value={formData.classDate} onChange={handleChange} className="form-input" />
            </div>

            <div className="form-group">
              <label className="form-label">Từ mấy giờ</label>
              <input type="time" name="startTime" value={formData.startTime} onChange={handleChange} className="form-input" />
            </div>

            <div className="form-group">
              <label className="form-label">Đến mấy giờ</label>
              <input type="time" name="endTime" value={formData.endTime} onChange={handleChange} className="form-input" />
            </div>

            <div className="form-group" style={{ gridColumn: "1 / -1" }}>
              <label className="form-label">Mức giá đề xuất (VNĐ)</label>
              <input type="number" name="price" value={formData.price} onChange={handleChange} className="form-input" placeholder="Ví dụ: 50000" />
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
      <div className="glass-panel" style={{ padding: "2.5rem", display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "2rem" }}>
          <h2 className="page-title" style={{ fontSize: "1.6rem", margin: 0 }}>Lịch sử của bạn</h2>
          <span style={{ background: "var(--primary-light)", color: "var(--primary)", padding: "0.3rem 0.8rem", borderRadius: "20px", fontSize: "0.85rem", fontWeight: "700" }}>
            {history.length} mục
          </span>
        </div>
        
        {loadingHistory ? (
          <div className="loader"></div>
        ) : history.length === 0 ? (
          /* EMPTY STATE ĐẸP */
          <div style={{ textAlign: "center", padding: "4rem 1rem", flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
            <div style={{ width: "120px", height: "120px", background: "white", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "1.5rem", boxShadow: "0 10px 25px rgba(0,0,0,0.05)" }}>
              <svg style={{ width: "60px", height: "60px", color: "#cbd5e1" }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path></svg>
            </div>
            <h3 style={{ fontSize: "1.2rem", fontWeight: "700", color: "var(--text-primary)", marginBottom: "0.5rem" }}>Chưa có dữ liệu nào</h3>
            <p style={{ color: "var(--text-secondary)", fontSize: "0.95rem", maxWidth: "80%" }}>
              Trông có vẻ trống vắng quá! Bạn hãy sử dụng biểu mẫu bên trái để tạo đơn thuê học đầu tiên của mình nhé.
            </p>
          </div>
        ) : (
          /* Lịch sử List */
          <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem", overflowY: "auto", maxHeight: "650px", paddingRight: "0.5rem" }}>
            {history.map(item => (
              <div key={item.id} style={{ background: "white", border: "1px solid #e2e8f0", borderRadius: "16px", padding: "1.25rem", display: "flex", gap: "1.25rem", transition: "transform 0.2s, box-shadow 0.2s", cursor: "default" }} onMouseOver={e => {e.currentTarget.style.transform="translateY(-2px)"; e.currentTarget.style.boxShadow="0 8px 20px rgba(0,0,0,0.05)"}} onMouseOut={e => {e.currentTarget.style.transform="translateY(0)"; e.currentTarget.style.boxShadow="none"}}>
                <div style={{ position: "relative" }}>
                  <img src={item.imageUrl} alt="Lịch" style={{ width: "90px", height: "90px", objectFit: "cover", borderRadius: "10px", border: "1px solid #f1f5f9" }} />
                </div>
                
                <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.4rem" }}>
                    <h4 style={{ margin: 0, fontSize: "1.05rem", fontWeight: "700", color: "var(--text-primary)" }}>{item.name}</h4>
                    {getStatusBadge(item.status)}
                  </div>
                  
                  <div style={{ fontSize: "0.85rem", color: "var(--text-secondary)", display: "flex", alignItems: "center", gap: "6px", marginBottom: "0.4rem" }}>
                    <svg style={{ width: "14px", height: "14px" }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"></path></svg>
                    {item.school} • {item.className}
                  </div>

                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "auto" }}>
                    <p style={{ margin: 0, fontSize: "0.8rem", color: "#9CA3AF", fontWeight: "500" }}>
                      Nộp lúc: {item.createdAt ? new Date(item.createdAt.toDate()).toLocaleDateString("vi-VN") : "Vừa xong"}
                    </p>
                    
                    {item.status !== "approved" && (
                      <button 
                        onClick={() => handleDelete(item.id)}
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
  );
}
