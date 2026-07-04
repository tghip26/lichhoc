"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import AdminGuard from "@/components/AdminGuard";
import { db, storage } from "@/lib/firebase";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import Link from "next/link";

export default function AdminEditPage({ params }) {
  const resolvedParams = use(params);
  const id = resolvedParams.id;
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
    price: "",
    adminNote: "",
    assignedTo: "",
    imageUrl: ""
  });
  const [weekday, setWeekday] = useState("");
  const [file, setFile] = useState(null); // Will store Base64 string if selected
  const [filePreview, setFilePreview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const fetchDoc = async () => {
      try {
        const docRef = doc(db, "schedules", id);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
            setFormData({
              name: data.name || "",
              className: data.className || "",
              studentId: data.studentId || "",
              school: data.school || "",
              classDate: data.classDate || "",
              startTime: data.startTime || "",
              endTime: data.endTime || "",
              dob: data.dob || "",
              notes: data.notes || "",
              phone: data.phone || "",
              price: data.price ? data.price.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".") : "",
              adminNote: data.adminNote || "",
              assignedTo: data.assignedTo || "",
              imageUrl: data.imageUrl || ""
            });
            setWeekday(data.weekday || "");
        } else {
          alert("Không tìm thấy thông tin!");
          router.push("/admin");
        }
      } catch (error) {
        console.error("Lỗi tải dữ liệu:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchDoc();
  }, [id, router]);

  const handleChange = (e) => {
    const { name, value } = e.target;

    if (name === "price") {
      const numericValue = value.replace(/\D/g, "");
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
      
      const reader = new FileReader();
      reader.onloadend = () => {
        setFilePreview(reader.result);
      };
      reader.readAsDataURL(selectedFile);

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
        setFile(base64String);
      };
    }
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    setSaving(true);

    try {
      let updatedImageUrl = formData.imageUrl;
      if (file) {
        updatedImageUrl = file; // Sử dụng trực tiếp chuỗi Base64
      }

      const docRef = doc(db, "schedules", id);
      await updateDoc(docRef, {
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
        price: formData.price ? String(formData.price).replace(/\./g, "") : "",
        adminNote: formData.adminNote,
        assignedTo: formData.assignedTo,
        weekday: weekday,
        imageUrl: updatedImageUrl
      });

      alert("Cập nhật thành công!");
      router.push("/admin");
    } catch (error) {
      console.error("Lỗi cập nhật:", error);
      alert("Có lỗi xảy ra khi cập nhật!");
    } finally {
      setSaving(false);
      setProgress(0);
    }
  };

  return (
    <AdminGuard>
      <div className="glass-panel" style={{ maxWidth: "600px", margin: "2rem auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
          <h2 className="page-title" style={{ margin: 0, fontSize: "1.8rem" }}>Chỉnh sửa thông tin</h2>
          <Link href="/admin" className="btn" style={{ background: "#E5E7EB", padding: "0.5rem 1rem", fontSize: "0.9rem", boxShadow: "none" }}>
            Quay lại
          </Link>
        </div>

        {loading ? (
          <div className="loader"></div>
        ) : (
          <form onSubmit={handleUpdate}>
            <div className="form-group">
              <label className="form-label">Họ và Tên</label>
              <input type="text" name="name" value={formData.name} onChange={handleChange} required className="form-input" />
            </div>
            <div className="form-group">
              <label className="form-label">Lớp</label>
              <input type="text" name="className" value={formData.className} onChange={handleChange} required className="form-input" />
            </div>
            <div className="form-group">
              <label className="form-label">Mã sinh viên</label>
              <input type="text" name="studentId" value={formData.studentId} onChange={handleChange} required className="form-input" />
            </div>
            <div className="form-group">
              <label className="form-label">Trường</label>
              <input type="text" name="school" value={formData.school} onChange={handleChange} required className="form-input" />
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
              <input type="time" name="startTime" value={formData.startTime} onChange={handleChange} className="form-input" lang="en-GB" />
            </div>

            <div className="form-group">
              <label className="form-label">Đến mấy giờ</label>
              <input type="time" name="endTime" value={formData.endTime} onChange={handleChange} className="form-input" lang="en-GB" />
            </div>

            <div className="form-group">
              <label className="form-label">Ghi chú</label>
              <textarea name="notes" value={formData.notes} onChange={handleChange} className="form-input" rows="3" style={{ resize: "vertical" }}></textarea>
            </div>
            
            <div className="form-group">
              <label className="form-label">Giá tiền (VNĐ)</label>
              <input type="text" name="price" value={formData.price} onChange={handleChange} className="form-input" />
            </div>

            <div className="form-group" style={{ borderTop: "2px solid #E5E7EB", paddingTop: "1.5rem", marginTop: "1rem" }}>
              <label className="form-label" style={{ color: "#8B5CF6", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <svg style={{ width: "20px", height: "20px" }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path></svg>
                Phân công người đi học hộ
              </label>
              <input type="text" name="assignedTo" value={formData.assignedTo} onChange={handleChange} className="form-input" placeholder="Ví dụ: Cậu Vàng" />
            </div>

            <div className="form-group">
              <label className="form-label" style={{ color: "#8B5CF6" }}>Ghi chú nội bộ (Khách hàng không thấy)</label>
              <textarea name="adminNote" value={formData.adminNote} onChange={handleChange} className="form-input" rows="3" style={{ resize: "vertical" }} placeholder="Ví dụ: Đã nhận cọc 50k..."></textarea>
            </div>

            <div className="form-group" style={{ borderTop: "2px solid #E5E7EB", paddingTop: "1.5rem" }}>
              <label className="form-label">Ảnh lịch học hiện tại</label>
              {formData.imageUrl && (
                <div style={{ marginBottom: "1rem", textAlign: "center" }}>
                  <img src={formData.imageUrl} alt="Lịch học" style={{ maxWidth: "100%", maxHeight: "300px", borderRadius: "8px", border: "1px solid #E5E7EB", objectFit: "contain" }} />
                </div>
              )}
              <label className="form-label">Tải lên ảnh mới (Bỏ trống nếu không đổi)</label>
              <input type="file" accept="image/*" onChange={handleFileChange} className="file-input" />
              {filePreview && (
                <div style={{ marginTop: "1rem", textAlign: "center" }}>
                  <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)", marginBottom: "0.5rem" }}>Ảnh mới sẽ được nén và thay thế ảnh cũ:</p>
                  <img src={filePreview} alt="Preview mới" style={{ maxWidth: "100%", maxHeight: "300px", borderRadius: "8px", border: "2px solid var(--primary-light)", objectFit: "contain" }} />
                </div>
              )}
            </div>

            <button type="submit" className="btn btn-primary" style={{ width: "100%" }} disabled={saving}>
              {saving ? "Đang lưu thay đổi..." : "Lưu thay đổi"}
            </button>
          </form>
        )}
      </div>
    </AdminGuard>
  );
}
