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
    imageUrl: ""
  });
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [progress, setProgress] = useState(0);

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
            imageUrl: data.imageUrl || ""
          });
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
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleFileChange = (e) => {
    if (e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    setSaving(true);

    try {
      let updatedImageUrl = formData.imageUrl;

      if (file) {
        const fileName = `${Date.now()}_${file.name}`;
        const storageRef = ref(storage, `schedules/${fileName}`);
        const uploadTask = uploadBytesResumable(storageRef, file);

        await new Promise((resolve, reject) => {
          uploadTask.on(
            "state_changed",
            (snapshot) => {
              const p = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
              setProgress(p);
            },
            (error) => reject(error),
            async () => {
              updatedImageUrl = await getDownloadURL(uploadTask.snapshot.ref);
              resolve();
            }
          );
        });
      }

      const docRef = doc(db, "schedules", id);
      await updateDoc(docRef, {
        name: formData.name,
        className: formData.className,
        studentId: formData.studentId,
        school: formData.school,
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
              <label className="form-label">Ảnh lịch học hiện tại</label>
              {formData.imageUrl && (
                <div style={{ marginBottom: "1rem", textAlign: "center" }}>
                  <img src={formData.imageUrl} alt="Lịch học" style={{ maxWidth: "100%", maxHeight: "300px", borderRadius: "8px", border: "1px solid #E5E7EB", objectFit: "contain" }} />
                </div>
              )}
              <label className="form-label">Tải lên ảnh mới (Bỏ trống nếu không đổi)</label>
              <input type="file" accept="image/*" onChange={handleFileChange} className="file-input" />
            </div>
            
            {saving && file && (
              <div style={{ marginBottom: "1rem" }}>
                <div style={{ height: "8px", background: "#E5E7EB", borderRadius: "4px", overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${progress}%`, background: "var(--primary)", transition: "width 0.2s" }}></div>
                </div>
                <p style={{ fontSize: "0.8rem", color: "var(--text-secondary)", textAlign: "right", marginTop: "0.5rem" }}>Đang tải lên ảnh mới... {Math.round(progress)}%</p>
              </div>
            )}

            <button type="submit" className="btn btn-primary" style={{ width: "100%" }} disabled={saving}>
              {saving ? "Đang lưu thay đổi..." : "Lưu thay đổi"}
            </button>
          </form>
        )}
      </div>
    </AdminGuard>
  );
}
