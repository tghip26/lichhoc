"use client";

import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { useState, useEffect } from "react";
import toast from "react-hot-toast";

export default function LienHePage() {
  const { user, systemSettings, sendTelegramAlert } = useAuth();
  
  const hotline = systemSettings?.hotline || "0852 866 856";
  const zalo = systemSettings?.zaloContact || "0838 636 538";
  
  // Clean special characters for anchor links
  const cleanPhone = hotline.replace(/[^0-9]/g, "");
  const cleanZalo = zalo.replace(/[^0-9]/g, "");

  // Form states
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [subject, setSubject] = useState("dat_lich");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Pre-fill form when user is logged in
  useEffect(() => {
    if (user) {
      setName(user.displayName || user.email.split("@")[0]);
      setContact(user.email || "");
    }
  }, [user]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim() || !contact.trim() || !message.trim()) {
      toast.error("Vui lòng điền đầy đủ các thông tin bắt buộc!");
      return;
    }

    setSubmitting(true);
    toast.loading("Đang gửi lời nhắn hỗ trợ...", { id: "contact" });

    try {
      // 1. Lưu vào Firestore
      await addDoc(collection(db, "contact_messages"), {
        name: name.trim(),
        contact: contact.trim(),
        subject,
        message: message.trim(),
        userId: user ? user.uid : "guest",
        status: "pending",
        createdAt: serverTimestamp()
      });

      // 2. Gửi cảnh báo Telegram
      const subjectLabels = {
        dat_lich: "📅 Hỗ trợ đặt lịch học",
        nap_tien: "💳 Vấn đề nạp/rút tiền",
        phản_hồi: "⚠️ Khiếu nại/Phản hồi CTV",
        khac: "❓ Ý kiến/Thắc mắc khác"
      };

      const alertText = `📩 <b>CÓ LỜI NHẮN HỖ TRỢ MỚI!</b>\n\n` +
                        `• <b>Họ tên:</b> ${name.trim()}\n` +
                        `• <b>Liên hệ:</b> ${contact.trim()}\n` +
                        `• <b>Chủ đề:</b> ${subjectLabels[subject] || subject}\n` +
                        `• <b>Nội dung:</b> ${message.trim()}\n` +
                        `• <b>Thời gian:</b> ${new Date().toLocaleString("vi-VN")}`;

      await sendTelegramAlert(alertText);

      toast.success("Đã gửi lời nhắn thành công! Chúng tôi sẽ phản hồi sớm nhất.", { id: "contact" });
      setMessage("");
    } catch (err) {
      console.error(err);
      toast.error("Lỗi khi gửi lời nhắn, vui lòng thử lại sau!", { id: "contact" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ padding: "2rem 1.5rem", maxWidth: "1000px", margin: "0 auto" }}>
      <h1 className="page-title" style={{ fontSize: "2.2rem", marginBottom: "1rem", textAlign: "center", fontWeight: "850" }}>
        📞 Liên Hệ & Hỗ Trợ 24/7
      </h1>
      <p style={{ color: "var(--text-secondary)", marginBottom: "2.5rem", textAlign: "center", fontSize: "0.95rem" }}>
        Thuê Học Pro luôn sẵn sàng giải đáp thắc mắc và hỗ trợ xử lý sự cố của bạn nhanh nhất.
      </p>

      {/* 2-Column Layout */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1.2fr", gap: "2rem", alignItems: "start" }} className="form-grid">
        
        {/* Left Column: Direct Contacts */}
        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
          
          <a 
            href={`tel:${cleanPhone}`} 
            className="grid-card" 
            style={{ textDecoration: "none", display: "flex", flexDirection: "column", alignItems: "center", padding: "1.75rem", background: "white", borderRadius: "20px", border: "1px solid #e2e8f0" }}
          >
            <div style={{ width: "50px", height: "50px", borderRadius: "50%", background: "rgba(79, 70, 229, 0.08)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--primary)", marginBottom: "0.75rem" }}>
              <svg style={{ width: "24px", height: "24px" }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"></path></svg>
            </div>
            <h4 style={{ margin: "0 0 4px 0", color: "var(--text-primary)", fontSize: "0.95rem", fontWeight: "750" }}>Hotline Hỗ Trợ 24/7</h4>
            <p style={{ margin: 0, fontSize: "1.2rem", fontWeight: "800", color: "var(--primary)" }}>{hotline}</p>
          </a>

          <a 
            href={`https://zalo.me/${cleanZalo}`} 
            target="_blank"
            rel="noopener noreferrer"
            className="grid-card" 
            style={{ textDecoration: "none", display: "flex", flexDirection: "column", alignItems: "center", padding: "1.75rem", background: "white", borderRadius: "20px", border: "1px solid #e2e8f0" }}
          >
            <div style={{ width: "50px", height: "50px", borderRadius: "50%", background: "rgba(0, 104, 255, 0.08)", display: "flex", alignItems: "center", justifyContent: "center", color: "#0068FF", marginBottom: "0.75rem" }}>
              <svg style={{ width: "24px", height: "24px" }} viewBox="0 0 24 24" fill="currentColor"><path d="M21.544 10.499c0-4.259-4.214-7.729-9.428-7.729S2.688 6.24 2.688 10.499c0 4.258 4.214 7.728 9.428 7.728 1.487 0 2.872-.258 4.093-.71l3.52 1.996c.264.15.586-.046.527-.348l-.68-3.486c1.233-1.4 1.968-3.217 1.968-5.18z"/></svg>
            </div>
            <h4 style={{ margin: "0 0 4px 0", color: "var(--text-primary)", fontSize: "0.95rem", fontWeight: "750" }}>Nhắn Tin Zalo Hỗ Trợ</h4>
            <p style={{ margin: 0, fontSize: "1.2rem", fontWeight: "800", color: "#0068FF" }}>{zalo}</p>
          </a>

          <div className="glass-panel" style={{ padding: "1.5rem", background: "white", borderRadius: "20px", border: "1px solid #e2e8f0", textAlign: "left" }}>
            <h4 style={{ margin: "0 0 10px 0", color: "var(--text-primary)", fontSize: "0.95rem", fontWeight: "800" }}>⏰ Thời gian làm việc:</h4>
            <p style={{ margin: "0 0 8px 0", fontSize: "0.85rem", color: "var(--text-secondary)", lineHeight: "1.5" }}>
              • <b>Hỗ trợ hệ thống:</b> 24/7 toàn bộ các ngày trong tuần.<br/>
              • <b>Phê duyệt tài khoản CTV:</b> 08:00 - 22:00 hàng ngày.<br/>
              • <b>Duyệt giao dịch chuyển khoản:</b> Tối đa 15 phút từ lúc chuyển tiền thành công.
            </p>
          </div>
        </div>

        {/* Right Column: Contact Message Form */}
        <div className="glass-panel" style={{ padding: "2rem", background: "white", borderRadius: "24px", border: "1px solid #e2e8f0", textAlign: "left" }}>
          <h3 style={{ margin: "0 0 0.5rem 0", color: "var(--text-primary)", fontWeight: "850", fontSize: "1.2rem" }}>
            📩 Gửi Lời Nhắn Hỗ Trợ
          </h3>
          <p style={{ color: "var(--text-secondary)", fontSize: "0.82rem", marginBottom: "1.5rem" }}>
            Nếu bạn không tiện gọi điện hoặc chat, hãy gửi biểu mẫu bên dưới. Chúng tôi sẽ phản hồi trực tiếp qua Email hoặc SĐT của bạn trong thời gian ngắn nhất.
          </p>

          <form onSubmit={handleSubmit}>
            <div className="form-group" style={{ marginBottom: "1rem" }}>
              <label style={{ fontSize: "0.82rem", fontWeight: "750", color: "var(--text-primary)", display: "block", marginBottom: "6px" }}>Họ và tên của bạn *</label>
              <input 
                type="text" 
                required 
                value={name} 
                onChange={(e) => setName(e.target.value)} 
                className="form-input" 
                placeholder="Nguyễn Văn A" 
                style={{ background: "white" }} 
              />
            </div>

            <div className="form-group" style={{ marginBottom: "1rem" }}>
              <label style={{ fontSize: "0.82rem", fontWeight: "750", color: "var(--text-primary)", display: "block", marginBottom: "6px" }}>Email hoặc Số điện thoại liên hệ *</label>
              <input 
                type="text" 
                required 
                value={contact} 
                onChange={(e) => setContact(e.target.value)} 
                className="form-input" 
                placeholder="vidu@gmail.com hoặc 0987..." 
                style={{ background: "white" }} 
              />
            </div>

            <div className="form-group" style={{ marginBottom: "1rem" }}>
              <label style={{ fontSize: "0.82rem", fontWeight: "750", color: "var(--text-primary)", display: "block", marginBottom: "6px" }}>Chủ đề cần hỗ trợ</label>
              <select 
                value={subject} 
                onChange={(e) => setSubject(e.target.value)} 
                className="form-input" 
                style={{ background: "white", cursor: "pointer", fontWeight: "600" }}
              >
                <option value="dat_lich">📅 Hỗ trợ đặt lịch học</option>
                <option value="nap_tien">💳 Vấn đề nạp/rút tiền</option>
                <option value="phản_hồi">⚠️ Khiếu nại/Phản hồi CTV</option>
                <option value="khac">❓ Ý kiến/Thắc mắc khác</option>
              </select>
            </div>

            <div className="form-group" style={{ marginBottom: "1.5rem" }}>
              <label style={{ fontSize: "0.82rem", fontWeight: "750", color: "var(--text-primary)", display: "block", marginBottom: "6px" }}>Nội dung chi tiết lời nhắn *</label>
              <textarea 
                required 
                rows={5} 
                value={message} 
                onChange={(e) => setMessage(e.target.value)} 
                className="form-input" 
                placeholder="Nhập chi tiết câu hỏi, thắc mắc hoặc thông tin khiếu nại của bạn tại đây..." 
                style={{ background: "white", resize: "vertical", fontFamily: "inherit" }} 
              />
            </div>

            <button 
              type="submit" 
              className="btn btn-primary" 
              style={{ width: "100%", padding: "0.8rem", borderRadius: "12px", border: "none" }}
              disabled={submitting}
            >
              {submitting ? "Đang gửi..." : "Gửi lời nhắn hỗ trợ 🚀"}
            </button>
          </form>
        </div>

      </div>
    </div>
  );
}
