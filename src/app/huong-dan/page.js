"use client";

import { useState } from "react";

export default function HuongDanPage() {
  const [openFaq, setOpenFaq] = useState(null);
  const [activeTab, setActiveTab] = useState("student"); // "student" or "helper"

  const faqs = [
    {
      q: "🔒 Lịch học của tôi được bảo mật như thế nào?",
      a: "Tất cả thông tin tài khoản, mã sinh viên, và hình ảnh lịch học của bạn được lưu trữ trên hệ thống cơ sở dữ liệu bảo mật Firestore của Google Cloud. Chỉ có bạn và Quản trị viên hệ thống có quyền truy cập để duyệt và phân công lớp học. Chúng tôi cam kết bảo mật tuyệt đối, không chia sẻ cho bên thứ ba."
    },
    {
      q: "💳 Tôi có thể nạp tiền và thanh toán bằng phương thức nào?",
      a: "Hệ thống hỗ trợ nạp tiền tự động qua chuyển khoản ngân hàng (VietQR). Khi bạn nạp ví, hệ thống sẽ tạo mã QR kèm nội dung chuyển khoản định dạng sẵn. Ngay khi chuyển khoản thành công, bạn gửi xác nhận để Quản trị viên duyệt và cộng tiền vào tài khoản ví của bạn tức thì."
    },
    {
      q: "🕒 Thời gian phê duyệt đơn và học hộ thường mất bao lâu?",
      a: "Sau khi bạn nộp đơn, hệ thống sẽ gửi cảnh báo tức thì về nhóm Telegram bảo mật của ban quản trị. Thông thường đơn hàng sẽ được duyệt và phân công Cộng tác viên phù hợp trong vòng 10 đến 30 phút."
    },
    {
      q: "🎓 Làm thế nào để đăng ký trở thành Cộng tác viên (CTV)?",
      a: "Bạn truy cập trang 'Tuyển CTV' ở thanh Menu, điền đầy đủ thông tin cá nhân, trường lớp học và gửi hồ sơ ứng tuyển. Ban quản trị sẽ thẩm định hồ sơ của bạn và duyệt quyền hoạt động. Khi được duyệt, bạn sẽ được giao đơn trực lớp và nhận thù lao hấp dẫn."
    },
    {
      q: "🔄 Chính sách hoàn tiền khi đơn học bị hủy như thế nào?",
      a: "Nếu lớp học bị hủy trước giờ học hoặc Cộng tác viên không thể tham gia vì lý do bất khả kháng, toàn bộ số tiền thanh toán của đơn đó sẽ được hoàn lại 100% vào số dư ví tài khoản của bạn trên website để bạn có thể rút ra hoặc dùng cho các môn học khác."
    }
  ];

  return (
    <div className="glass-panel" style={{ maxWidth: "850px", margin: "3rem auto", padding: "2.5rem" }}>
      <h1 className="page-title" style={{ fontSize: "2.2rem", marginBottom: "1.5rem", textAlign: "center", fontWeight: "850" }}>
        📖 Trung Tâm Hướng Dẫn Sử Dụng
      </h1>
      <p style={{ textAlign: "center", color: "var(--text-secondary)", fontSize: "0.95rem", marginBottom: "2.5rem" }}>
        Chào mừng bạn đến với hệ thống hỗ trợ Thuê Học Pro. Hãy chọn vai trò của bạn dưới đây để xem quy trình hướng dẫn cụ thể.
      </p>

      {/* Tab Selector */}
      <div style={{ display: "flex", justifyContent: "center", gap: "12px", marginBottom: "3rem" }}>
        <button
          onClick={() => setActiveTab("student")}
          style={{
            padding: "0.8rem 1.8rem",
            borderRadius: "14px",
            border: "none",
            background: activeTab === "student" ? "var(--primary)" : "white",
            color: activeTab === "student" ? "white" : "var(--text-secondary)",
            fontWeight: "700",
            fontSize: "0.92rem",
            cursor: "pointer",
            boxShadow: activeTab === "student" ? "0 4px 15px rgba(22, 163, 74, 0.25)" : "0 2px 5px rgba(0,0,0,0.03)",
            border: activeTab === "student" ? "none" : "1px solid #e2e8f0",
            transition: "all 0.2s ease"
          }}
        >
          👥 Dành cho Học Viên (Đặt Lịch)
        </button>
        <button
          onClick={() => setActiveTab("helper")}
          style={{
            padding: "0.8rem 1.8rem",
            borderRadius: "14px",
            border: "none",
            background: activeTab === "helper" ? "var(--primary)" : "white",
            color: activeTab === "helper" ? "white" : "var(--text-secondary)",
            fontWeight: "700",
            fontSize: "0.92rem",
            cursor: "pointer",
            boxShadow: activeTab === "helper" ? "0 4px 15px rgba(22, 163, 74, 0.25)" : "0 2px 5px rgba(0,0,0,0.03)",
            border: activeTab === "helper" ? "none" : "1px solid #e2e8f0",
            transition: "all 0.2s ease"
          }}
        >
          🎓 Dành cho Cộng Tác Viên (Nhận Ca)
        </button>
      </div>
      
      {/* Student workflow */}
      {activeTab === "student" ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem", marginBottom: "3rem" }}>
          <h2 style={{ fontSize: "1.25rem", color: "var(--primary)", borderBottom: "2px solid var(--primary-light)", paddingBottom: "6px", textAlign: "left", fontWeight: "800" }}>
            🏁 Quy Trình Đặt Lịch Trong 4 Bước
          </h2>
          
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "1.25rem" }}>
            <div className="glass-panel" style={{ padding: "1.25rem", background: "white", borderRadius: "16px", border: "1px solid #f1f5f9", textAlign: "left" }}>
              <div style={{ fontSize: "1.5rem", marginBottom: "8px" }}>1️⃣</div>
              <h4 style={{ margin: "0 0 6px 0", color: "var(--text-primary)", fontWeight: "700" }}>Đăng ký tài khoản</h4>
              <p style={{ margin: 0, fontSize: "0.82rem", color: "var(--text-secondary)", lineHeight: "1.5" }}>
                Đăng nhập nhanh qua Google hoặc đăng ký bằng Email & SĐT trực tiếp tại trang chủ.
              </p>
            </div>
            <div className="glass-panel" style={{ padding: "1.25rem", background: "white", borderRadius: "16px", border: "1px solid #f1f5f9", textAlign: "left" }}>
              <div style={{ fontSize: "1.5rem", marginBottom: "8px" }}>2️⃣</div>
              <h4 style={{ margin: "0 0 6px 0", color: "var(--text-primary)", fontWeight: "700" }}>Nạp số dư ví</h4>
              <p style={{ margin: 0, fontSize: "0.82rem", color: "var(--text-secondary)", lineHeight: "1.5" }}>
                Quét mã VietQR chuyển khoản Admin để nạp tiền tài khoản thanh toán tiền đặt ca học.
              </p>
            </div>
            <div className="glass-panel" style={{ padding: "1.25rem", background: "white", borderRadius: "16px", border: "1px solid #f1f5f9", textAlign: "left" }}>
              <div style={{ fontSize: "1.5rem", marginBottom: "8px" }}>3️⃣</div>
              <h4 style={{ margin: "0 0 6px 0", color: "var(--text-primary)", fontWeight: "700" }}>Tải ảnh lịch học</h4>
              <p style={{ margin: 0, fontSize: "0.82rem", color: "var(--text-secondary)", lineHeight: "1.5" }}>
                Điền thông tin lớp học (Môn học, Giờ, Phòng học, Địa điểm) kèm tải ảnh thời khóa biểu.
              </p>
            </div>
            <div className="glass-panel" style={{ padding: "1.25rem", background: "white", borderRadius: "16px", border: "1px solid #f1f5f9", textAlign: "left" }}>
              <div style={{ fontSize: "1.5rem", marginBottom: "8px" }}>4️⃣</div>
              <h4 style={{ margin: "0 0 6px 0", color: "var(--text-primary)", fontWeight: "700" }}>Nhận kết quả</h4>
              <p style={{ margin: 0, fontSize: "0.82rem", color: "var(--text-secondary)", lineHeight: "1.5" }}>
                Duyệt CTV và theo dõi tiến trình trực ca, điểm danh đầy đủ từ CTV của bạn.
              </p>
            </div>
          </div>
        </div>
      ) : (
        /* Helper workflow */
        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem", marginBottom: "3rem" }}>
          <h2 style={{ fontSize: "1.25rem", color: "var(--primary)", borderBottom: "2px solid var(--primary-light)", paddingBottom: "6px", textAlign: "left", fontWeight: "800" }}>
            🏁 Quy Trình Trực Lớp Cho Cộng Tác Viên
          </h2>
          
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "1.25rem" }}>
            <div className="glass-panel" style={{ padding: "1.25rem", background: "white", borderRadius: "16px", border: "1px solid #f1f5f9", textAlign: "left" }}>
              <div style={{ fontSize: "1.5rem", marginBottom: "8px" }}>1️⃣</div>
              <h4 style={{ margin: "0 0 6px 0", color: "var(--text-primary)", fontWeight: "700" }}>Nộp hồ sơ ứng tuyển</h4>
              <p style={{ margin: 0, fontSize: "0.82rem", color: "var(--text-secondary)", lineHeight: "1.5" }}>
                Điền đơn đăng ký tuyển CTV kèm ảnh thẻ sinh viên để Admin xác minh học lực và kích hoạt.
              </p>
            </div>
            <div className="glass-panel" style={{ padding: "1.25rem", background: "white", borderRadius: "16px", border: "1px solid #f1f5f9", textAlign: "left" }}>
              <div style={{ fontSize: "1.5rem", marginBottom: "8px" }}>2️⃣</div>
              <h4 style={{ margin: "0 0 6px 0", color: "var(--text-primary)", fontWeight: "700" }}>Nhận lớp tại Chợ ca</h4>
              <p style={{ margin: 0, fontSize: "0.82rem", color: "var(--text-secondary)", lineHeight: "1.5" }}>
                Vào 'Chợ nhận lớp', duyệt tìm ca học thích hợp theo thời gian biểu của bạn để ứng tuyển.
              </p>
            </div>
            <div className="glass-panel" style={{ padding: "1.25rem", background: "white", borderRadius: "16px", border: "1px solid #f1f5f9", textAlign: "left" }}>
              <div style={{ fontSize: "1.5rem", marginBottom: "8px" }}>3️⃣</div>
              <h4 style={{ margin: "0 0 6px 0", color: "var(--text-primary)", fontWeight: "700" }}>Check-in lớp học</h4>
              <p style={{ margin: 0, fontSize: "0.82rem", color: "var(--text-secondary)", lineHeight: "1.5" }}>
                Đến lớp học hộ đúng giờ, chụp ảnh làm minh chứng tải lên trang quản lý cá nhân.
              </p>
            </div>
            <div className="glass-panel" style={{ padding: "1.25rem", background: "white", borderRadius: "16px", border: "1px solid #f1f5f9", textAlign: "left" }}>
              <div style={{ fontSize: "1.5rem", marginBottom: "8px" }}>4️⃣</div>
              <h4 style={{ margin: "0 0 6px 0", color: "var(--text-primary)", fontWeight: "700" }}>Nhận thù lao về ví</h4>
              <p style={{ margin: 0, fontSize: "0.82rem", color: "var(--text-secondary)", lineHeight: "1.5" }}>
                Tiền công cơ bản và tiền tip sẽ được chuyển trực tiếp vào ví CTV để rút về tài khoản ngân hàng.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* FAQ section */}
      <div style={{ display: "flex", flexDirection: "column", gap: "1rem", textAlign: "left" }}>
        <h2 style={{ fontSize: "1.25rem", color: "var(--primary)", borderBottom: "2px solid var(--primary-light)", paddingBottom: "6px", fontWeight: "800" }}>
          ❓ Câu Hỏi Thường Gặp (FAQs)
        </h2>
        
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          {faqs.map((faq, index) => {
            const isOpen = openFaq === index;
            return (
              <div 
                key={index} 
                style={{
                  border: "1px solid #e2e8f0",
                  borderRadius: "12px",
                  overflow: "hidden",
                  background: "white",
                  transition: "all 0.25s ease"
                }}
              >
                <button
                  onClick={() => setOpenFaq(isOpen ? null : index)}
                  style={{
                    width: "100%",
                    padding: "1rem 1.25rem",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    background: isOpen ? "rgba(22, 163, 74, 0.03)" : "white",
                    border: "none",
                    cursor: "pointer",
                    textAlign: "left",
                    outline: "none"
                  }}
                >
                  <span style={{ fontWeight: "700", fontSize: "0.95rem", color: isOpen ? "var(--primary)" : "var(--text-primary)" }}>
                    {faq.q}
                  </span>
                  <span style={{ fontSize: "1rem", color: "var(--text-secondary)", transition: "transform 0.2s", transform: isOpen ? "rotate(180deg)" : "rotate(0deg)" }}>
                    ▼
                  </span>
                </button>
                <div
                  style={{
                    maxHeight: isOpen ? "200px" : "0px",
                    overflow: "hidden",
                    transition: "max-height 0.3s cubic-bezier(0, 1, 0, 1)",
                    background: "#f8fafc"
                  }}
                >
                  <p style={{ padding: "1.25rem", margin: 0, fontSize: "0.88rem", color: "var(--text-secondary)", lineHeight: "1.6", borderTop: "1px solid #f1f5f9" }}>
                    {faq.a}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
