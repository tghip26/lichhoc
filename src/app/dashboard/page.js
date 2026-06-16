"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { db, storage } from "@/lib/firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";

export default function Dashboard() {
  const { user, loading } = useAuth();
  const router = useRouter();

  const [formData, setFormData] = useState({
    name: "",
    className: "",
    studentId: "",
    school: ""
  });
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [successMsg, setSuccessMsg] = useState("");

  useEffect(() => {
    if (!loading && !user) {
      router.push("/");
    }
  }, [user, loading, router]);

  if (loading || !user) {
    return <div className="loader"></div>;
  }

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleFileChange = (e) => {
    if (e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file) {
      alert("Vui lòng chọn ảnh lịch học!");
      return;
    }

    setUploading(true);
    setSuccessMsg("");

    const fileName = `${Date.now()}_${file.name}`;
    const storageRef = ref(storage, `schedules/${fileName}`);

    const uploadTask = uploadBytesResumable(storageRef, file);

    uploadTask.on(
      "state_changed",
      (snapshot) => {
        const p = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
        setProgress(p);
      },
      (error) => {
        console.error("Lỗi upload ảnh:", error);
        alert("Có lỗi xảy ra khi upload ảnh!");
        setUploading(false);
      },
      async () => {
        const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
        
        try {
          await addDoc(collection(db, "schedules"), {
            userId: user.uid,
            userEmail: user.email,
            name: formData.name,
            className: formData.className,
            studentId: formData.studentId,
            school: formData.school,
            imageUrl: downloadURL,
            createdAt: serverTimestamp()
          });

          setSuccessMsg("Tải lên lịch học thành công!");
          setFormData({ name: "", className: "", studentId: "", school: "" });
          setFile(null);
          setProgress(0);
        } catch (error) {
          console.error("Lỗi lưu dữ liệu:", error);
          alert("Lỗi khi lưu dữ liệu vào cơ sở dữ liệu!");
        }
        setUploading(false);
      }
    );
  };

  return (
    <div className="glass-panel" style={{ maxWidth: "600px", margin: "2rem auto" }}>
      <h2 className="page-title" style={{ fontSize: "1.8rem", marginBottom: "1.5rem" }}>Tải lên lịch học</h2>
      
      {successMsg && (
        <div style={{ padding: "1rem", backgroundColor: "var(--success)", color: "white", borderRadius: "8px", marginBottom: "1.5rem", textAlign: "center" }}>
          {successMsg}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label className="form-label">Họ và Tên</label>
          <input type="text" name="name" value={formData.name} onChange={handleChange} required className="form-input" placeholder="Nguyễn Văn A" />
        </div>
        <div className="form-group">
          <label className="form-label">Lớp</label>
          <input type="text" name="className" value={formData.className} onChange={handleChange} required className="form-input" placeholder="IT1" />
        </div>
        <div className="form-group">
          <label className="form-label">Mã sinh viên</label>
          <input type="text" name="studentId" value={formData.studentId} onChange={handleChange} required className="form-input" placeholder="SV123456" />
        </div>
        <div className="form-group">
          <label className="form-label">Trường</label>
          <input type="text" name="school" value={formData.school} onChange={handleChange} required className="form-input" placeholder="Đại học Công nghệ" />
        </div>
        <div className="form-group">
          <label className="form-label">Ảnh lịch học</label>
          <input type="file" accept="image/*" onChange={handleFileChange} required className="file-input" />
        </div>
        
        {uploading && (
          <div style={{ marginBottom: "1rem" }}>
            <div style={{ height: "8px", background: "#E5E7EB", borderRadius: "4px", overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${progress}%`, background: "var(--primary)", transition: "width 0.2s" }}></div>
            </div>
            <p style={{ fontSize: "0.8rem", color: "var(--text-secondary)", textAlign: "right", marginTop: "0.5rem" }}>Đang tải lên... {Math.round(progress)}%</p>
          </div>
        )}

        <button type="submit" className="btn btn-primary" style={{ width: "100%" }} disabled={uploading}>
          {uploading ? "Đang xử lý..." : "Gửi thông tin"}
        </button>
      </form>
    </div>
  );
}
