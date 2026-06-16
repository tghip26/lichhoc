"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { db, storage } from "@/lib/firebase";
import { collection, addDoc, serverTimestamp, query, where, orderBy, onSnapshot, doc, deleteDoc } from "firebase/firestore";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import toast from "react-hot-toast";

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
      toast.error("Vui lòng chọn ảnh lịch học!");
      return;
    }

    setUploading(true);
    const fileName = `${Date.now()}_${file.name}`;
    const storageRef = ref(storage, `schedules/${fileName}`);
    const uploadTask = uploadBytesResumable(storageRef, file);

    toast.loading("Đang tải lên...", { id: "upload" });

    uploadTask.on(
      "state_changed",
      (snapshot) => {
        const p = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
        setProgress(p);
      },
      (error) => {
        console.error("Lỗi upload ảnh:", error);
        toast.error("Có lỗi xảy ra khi upload ảnh!", { id: "upload" });
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
            status: "pending", // Trạng thái mặc định
            createdAt: serverTimestamp()
          });

          toast.success("Tải lên lịch học thành công!", { id: "upload" });
          setFormData({ name: "", className: "", studentId: "", school: "" });
          setFile(null);
          setProgress(0);
          
          // Reset file input UI
          document.getElementById('file-input').value = "";
        } catch (error) {
          console.error("Lỗi lưu dữ liệu:", error);
          toast.error("Lỗi khi lưu dữ liệu!", { id: "upload" });
        }
        setUploading(false);
      }
    );
  };

  const handleDelete = async (id) => {
    if (confirm("Bạn có chắc chắn muốn xóa lịch học này không?")) {
      try {
        await deleteDoc(doc(db, "schedules", id));
        toast.success("Đã xóa lịch học");
      } catch (error) {
        toast.error("Lỗi khi xóa lịch học");
      }
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case "approved":
        return <span style={{ background: "rgba(16, 185, 129, 0.15)", color: "var(--success)", padding: "4px 10px", borderRadius: "12px", fontSize: "0.8rem", fontWeight: "600" }}>Đã duyệt</span>;
      case "rejected":
        return <span style={{ background: "rgba(239, 68, 68, 0.15)", color: "var(--danger)", padding: "4px 10px", borderRadius: "12px", fontSize: "0.8rem", fontWeight: "600" }}>Từ chối</span>;
      default:
        return <span style={{ background: "rgba(245, 158, 11, 0.15)", color: "#D97706", padding: "4px 10px", borderRadius: "12px", fontSize: "0.8rem", fontWeight: "600" }}>Chờ duyệt</span>;
    }
  };

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(350px, 1fr))", gap: "2rem", marginTop: "2rem" }}>
      
      {/* Cột Upload */}
      <div className="glass-panel">
        <h2 className="page-title" style={{ fontSize: "1.5rem", marginBottom: "1.5rem", textAlign: "left" }}>Tải lên lịch học mới</h2>
        
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
            <input type="file" id="file-input" accept="image/*" onChange={handleFileChange} required className="file-input" />
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

      {/* Cột Lịch sử */}
      <div className="glass-panel" style={{ display: "flex", flexDirection: "column" }}>
        <h2 className="page-title" style={{ fontSize: "1.5rem", marginBottom: "1.5rem", textAlign: "left" }}>Lịch sử đã nộp</h2>
        
        {loadingHistory ? (
          <div className="loader"></div>
        ) : history.length === 0 ? (
          <div style={{ textAlign: "center", padding: "3rem 1rem", color: "var(--text-secondary)", flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
            Bạn chưa nộp lịch học nào.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem", overflowY: "auto", maxHeight: "600px", paddingRight: "0.5rem" }}>
            {history.map(item => (
              <div key={item.id} style={{ background: "rgba(255, 255, 255, 0.5)", border: "1px solid rgba(255,255,255,0.8)", borderRadius: "12px", padding: "1rem", display: "flex", gap: "1rem" }}>
                <img src={item.imageUrl} alt="Lịch" style={{ width: "80px", height: "80px", objectFit: "cover", borderRadius: "8px", border: "1px solid #E5E7EB" }} />
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.5rem" }}>
                    <h4 style={{ margin: 0, fontSize: "1rem", fontWeight: "600" }}>{item.name}</h4>
                    {getStatusBadge(item.status)}
                  </div>
                  <p style={{ margin: "0 0 0.2rem 0", fontSize: "0.85rem", color: "var(--text-secondary)" }}>{item.className} - {item.school}</p>
                  <p style={{ margin: 0, fontSize: "0.8rem", color: "#9CA3AF" }}>
                    {item.createdAt ? new Date(item.createdAt.toDate()).toLocaleDateString("vi-VN") : "Vừa xong"}
                  </p>
                </div>
                {item.status !== "approved" && (
                  <button 
                    onClick={() => handleDelete(item.id)}
                    style={{ background: "none", border: "none", color: "var(--danger)", cursor: "pointer", padding: "0.2rem", alignSelf: "flex-start" }}
                    title="Xóa lịch này"
                  >
                    <svg style={{ width: "20px", height: "20px" }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
}
