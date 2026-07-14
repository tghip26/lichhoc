"use client";

import { useState } from "react";
import { db } from "@/lib/firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { useAuth } from "@/context/AuthContext";
import toast from "react-hot-toast";
import Link from "next/link";

export default function TuyenCTV() {
  const { sendTelegramAlert } = useAuth();
  const [submitted, setSubmitted] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [file, setFile] = useState(null);
  const [fileName, setFileName] = useState("");
  const [filePreview, setFilePreview] = useState(null);

  const [formData, setFormData] = useState({
    name: "",
    studentId: "",
    className: "",
    school: "",
    phone: "",
    email: "",
    bio: "",
    availability: ""
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      
      const reader = new FileReader();
      reader.onloadend = () => {
        setFilePreview(reader.result);
      };
      reader.readAsDataURL(selectedFile);

      // Nén ảnh bằng Canvas
      const img = new Image();
      img.src = URL.createObjectURL(selectedFile);
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const MAX_WIDTH = 1000;
        const MAX_HEIGHT = 1000;
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
        setFile(base64String);
        setFileName(selectedFile.name.replace(/\.[^/.]+$/, "") + ".jpg");
      };
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file) {
      toast.error("Vui lòng tải lên ảnh chân dung hoặc Thẻ sinh viên!");
      return;
    }

    setUploading(true);
    toast.loading("Đang gửi hồ sơ ứng tuyển...", { id: "ctv-submit" });

    try {
      await addDoc(collection(db, "helpers"), {
        name: formData.name,
        studentId: formData.studentId,
        className: formData.className,
        school: formData.school,
        phone: formData.phone,
        email: formData.email,
        bio: formData.bio,
        availability: formData.availability,
        imageUrl: file,
        status: "pending",
        isApproved: false,
        createdAt: serverTimestamp()
      });

      // Báo Telegram
      const alertText = `🎓 <b>HỒ SƠ ỨNG TUYỂN CTV MỚI!</b>\n\n` +
        `• <b>Họ và Tên:</b> ${formData.name}\n` +
        `• <b>Trường:</b> ${formData.school} (${formData.studentId})\n` +
        `• <b>Số điện thoại:</b> ${formData.phone}\n` +
        `• <b>Email:</b> ${formData.email}\n` +
        `• <b>Ghi chú rảnh:</b> ${formData.availability}\n\n` +
        `<i>Vui lòng truy cập Bảng quản trị để phê duyệt CTV!</i>`;
      
      sendTelegramAlert(alertText);

      // Tạo thông báo cho Admin
      await addDoc(collection(db, "notifications"), {
        userId: "admin",
        title: "Ứng tuyển CTV mới",
        message: `Ứng viên ${formData.name} đăng ký ứng tuyển CTV (${formData.school}).`,
        read: false,
        link: "/admin?tab=helpers",
        createdAt: serverTimestamp()
      });

      toast.success("Nộp hồ sơ ứng tuyển thành công! Vui lòng đợi Zalo liên hệ.", { id: "ctv-submit" });
      setSubmitted(true);
    } catch (error) {
      console.error("Lỗi ứng tuyển:", error);
      toast.error("Gửi hồ sơ thất bại. Vui lòng kiểm tra lại!", { id: "ctv-submit" });
    } finally {
      setUploading(false);
    }
  };

  if (submitted) {
    return (
      <div style={{ maxWidth: "550px", margin: "4rem auto", padding: "0 1rem" }}>
        <div className="glass-panel" style={{ textAlign: "center", padding: "3rem 2rem", borderTop: "5px solid var(--success)" }}>
          <div style={{
            width: "70px",
            height: "70px",
            background: "rgba(16, 185, 129, 0.15)",
            borderRadius: "50%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "var(--success)",
            margin: "0 auto 1.5rem auto"
          }}>
            <svg style={{ width: "36px", height: "36px" }} fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
            </svg>
          </div>
          <h2 style={{ fontSize: "1.6rem", fontWeight: "800", color: "var(--text-primary)", marginBottom: "1rem" }}>Đã Nhận Hồ Sơ Ứng Tuyển!</h2>
          <p style={{ color: "var(--text-secondary)", fontSize: "0.95rem", lineHeight: "1.6", marginBottom: "2rem" }}>
            Cảm ơn bạn đã quan tâm ứng tuyển làm Cộng tác viên của <strong>Thuê Học Pro</strong>. Hồ sơ của bạn đã được chuyển đến bộ phận Admin duyệt. Chúng mình sẽ liên hệ với bạn qua số điện thoại hoặc Zalo trong vòng 24 giờ tới!
          </p>
          <Link href="/" className="btn btn-primary" style={{ width: "100%", padding: "0.8rem", borderRadius: "12px", display: "inline-block", textDecoration: "none" }}>
            Quay về trang chủ
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: "650px", margin: "4rem auto", padding: "0 1rem" }}>
      <div style={{ textAlign: "center", marginBottom: "2.5rem" }}>
        <h1 className="page-title" style={{ fontSize: "2rem", color: "var(--primary)" }}>Ứng Tuyển Cộng Tác Viên</h1>
        <p style={{ color: "var(--text-secondary)", fontSize: "0.95rem", maxWidth: "500px", margin: "0 auto", lineHeight: "1.6" }}>
          Đăng ký tham gia vào đội ngũ học viên chuyên nghiệp của Thuê Học Pro để tăng thêm thu nhập trong thời gian rảnh.
        </p>
      </div>

      <div className="glass-panel" style={{ borderTop: "5px solid var(--primary)" }}>
        <form onSubmit={handleSubmit}>
          <div className="form-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.25rem", marginBottom: "1.25rem" }}>
            <div className="form-group" style={{ display: "flex", flexDirection: "column" }}>
              <label style={{ fontSize: "0.85rem", fontWeight: "700", marginBottom: "6px", color: "var(--text-primary)" }}>Họ và Tên</label>
              <input type="text" name="name" required value={formData.name} onChange={handleChange} className="form-input" placeholder="Nguyễn Văn A" style={{ background: "white" }} />
            </div>
            
            <div className="form-group" style={{ display: "flex", flexDirection: "column" }}>
              <label style={{ fontSize: "0.85rem", fontWeight: "700", marginBottom: "6px", color: "var(--text-primary)" }}>Số điện thoại (Zalo)</label>
              <input type="tel" name="phone" required value={formData.phone} onChange={handleChange} className="form-input" placeholder="0912345678" style={{ background: "white" }} />
            </div>

            <div className="form-group" style={{ display: "flex", flexDirection: "column" }}>
              <label style={{ fontSize: "0.85rem", fontWeight: "700", marginBottom: "6px", color: "var(--text-primary)" }}>Mã sinh viên (MSSV)</label>
              <input type="text" name="studentId" required value={formData.studentId} onChange={handleChange} className="form-input" placeholder="SV123456" style={{ background: "white" }} />
            </div>

            <div className="form-group" style={{ display: "flex", flexDirection: "column" }}>
              <label style={{ fontSize: "0.85rem", fontWeight: "700", marginBottom: "6px", color: "var(--text-primary)" }}>Lớp học hiện tại</label>
              <input type="text" name="className" required value={formData.className} onChange={handleChange} className="form-input" placeholder="K67-CNTT" style={{ background: "white" }} />
            </div>

            <div className="form-group" style={{ display: "flex", flexDirection: "column", gridColumn: "1 / -1" }}>
              <label style={{ fontSize: "0.85rem", fontWeight: "700", marginBottom: "6px", color: "var(--text-primary)" }}>Trường Đại học</label>
              <input type="text" name="school" required value={formData.school} onChange={handleChange} className="form-input" placeholder="Đại học Công nghệ - ĐHQGHN" style={{ background: "white" }} />
            </div>

            <div className="form-group" style={{ display: "flex", flexDirection: "column", gridColumn: "1 / -1" }}>
              <label style={{ fontSize: "0.85rem", fontWeight: "700", marginBottom: "6px", color: "var(--text-primary)" }}>Địa chỉ Email</label>
              <input type="email" name="email" required value={formData.email} onChange={handleChange} className="form-input" placeholder="email@gmail.com" style={{ background: "white" }} />
            </div>

            <div className="form-group" style={{ display: "flex", flexDirection: "column", gridColumn: "1 / -1" }}>
              <label style={{ fontSize: "0.85rem", fontWeight: "700", marginBottom: "6px", color: "var(--text-primary)" }}>Thời gian rảnh rỗi (Phân lịch học)</label>
              <input type="text" name="availability" required value={formData.availability} onChange={handleChange} className="form-input" placeholder="Rảnh các chiều Thứ 2, 4, 6 và cả ngày Chủ Nhật" style={{ background: "white" }} />
            </div>

            <div className="form-group" style={{ display: "flex", flexDirection: "column", gridColumn: "1 / -1" }}>
              <label style={{ fontSize: "0.85rem", fontWeight: "700", marginBottom: "6px", color: "var(--text-primary)" }}>Giới thiệu bản thân & Năng lực học tập (Điểm mạnh môn gì)</label>
              <textarea name="bio" rows="3" required value={formData.bio} onChange={handleChange} className="form-input" placeholder="Học tốt các môn Toán cao cấp, Vật lý đại cương, Tiếng Anh B2..." style={{ background: "white", resize: "none", padding: "0.8rem" }}></textarea>
            </div>

            {/* Phần chọn ảnh */}
            <div className="form-group" style={{ gridColumn: "1 / -1", display: "flex", flexDirection: "column" }}>
              <label style={{ fontSize: "0.85rem", fontWeight: "700", marginBottom: "6px", color: "var(--text-primary)" }}>Ảnh thẻ sinh viên hoặc Ảnh chân dung để nhận diện</label>
              <input type="file" accept="image/*" required onChange={handleFileChange} style={{ display: "none" }} id="ctv-file" />
              <label htmlFor="ctv-file" style={{
                background: "rgba(22, 163, 74, 0.02)", border: "2px dashed #cbd5e1", borderRadius: "16px", padding: "2rem 1.5rem", textAlign: "center", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: "0.5rem", transition: "all 0.2s"
              }} onMouseOver={e => e.currentTarget.style.borderColor = "var(--primary)"} onMouseOut={e => e.currentTarget.style.borderColor = "#cbd5e1"}>
                <svg style={{ width: "40px", height: "40px", color: "var(--text-secondary)", opacity: 0.6 }} fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.115-.782.17-1.186.17a3 3 0 00-3 3v8.5a3 3 0 003 3h16a3 3 0 003-3V10.4a3 3 0 00-3-3 3 3 0 00-3-3H6.827z" />
                  <circle cx="12" cy="13.5" r="3" />
                </svg>
                <span style={{ fontSize: "0.9rem", fontWeight: "600", color: "var(--text-primary)" }}>{fileName || "Click để chọn tệp tin ảnh"}</span>
                <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>Định dạng ảnh chụp JPG, PNG</span>
              </label>
              {filePreview && (
                <div style={{ marginTop: "1rem", textAlign: "center" }}>
                  <img src={filePreview} alt="Xem trước" style={{ maxWidth: "100%", maxHeight: "180px", objectFit: "contain", borderRadius: "12px", border: "1px solid #e2e8f0", padding: "5px" }} />
                </div>
              )}
            </div>
          </div>

          <button type="submit" className="btn btn-primary" style={{ width: "100%", padding: "0.9rem", fontSize: "1rem", borderRadius: "12px" }} disabled={uploading}>
            {uploading ? "Đang nộp hồ sơ..." : "Gửi Hồ Sơ Ứng Tuyển"}
          </button>
        </form>
      </div>
    </div>
  );
}
