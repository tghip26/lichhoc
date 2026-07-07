"use client";

import { useState } from "react";

export default function HuongDanPage() {
  const [openFaq, setOpenFaq] = useState(null);

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
    <div className="glass-panel" style={{ maxWidth: "800px", margin: "3rem auto" }}>
      <h1 className="page-title" style={{ fontSize: "2rem", marginBottom: "2rem", textAlign: "center" }}>Hướng Dẫn Sử Dụng</h1>
      
      <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem", marginBottom: "3rem" }}>
        <h2 style={{ fontSize: "1.25rem", color: "var(--primary)", borderBottom: "2px solid var(--primary-light)", paddingBottom: "6px", textAlign: "left" }}>
          🏁 Quy Trình Đặt Lịch Trong 4 Bước
        </h2>
        
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "1.25rem" }}>
          <div className="glass-panel" style={{ padding: "1.25rem", background: "white", borderRadius: "16px", border: "1px solid #f1f5f9", textAlign: "left" }}>
            <div style={{ fontSize: "1.5rem", marginBottom: "8px" }}>1️⃣</div>
            <h4 style={{ margin: "0 0 6px 0", color: "var(--text-primary)" }}>Đăng ký tài khoản</h4>
            <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--text-secondary)", lineHeight: "1.5" }}>
              Đăng nhập qua Google hoặc tạo tài khoản mới bằng Email/SĐT ở trang chủ.
            </p>
          </div>
          <div className="glass-panel" style={{ padding: "1.25rem", background: "white", borderRadius: "16px", border: "1px solid #f1f5f9", textAlign: "left" }}>
            <div style={{ fontSize: "1.5rem", marginBottom: "8px" }}>2️⃣</div>
            <h4 style={{ margin: "0 0 6px 0", color: "var(--text-primary)" }}>Nạp số dư ví</h4>
            <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--text-secondary)", lineHeight: "1.5" }}>
              Nạp tiền qua VietQR ngân hàng của Admin để có số dư ví thanh toán học phí.
            </p>
          </div>
          <div className="glass-panel" style={{ padding: "1.25rem", background: "white", borderRadius: "16px", border: "1px solid #f1f5f9", textAlign: "left" }}>
            <div style={{ fontSize: "1.5rem", marginBottom: "8px" }}>3️⃣</div>
            <h4 style={{ margin: "0 0 6px 0", color: "var(--text-primary)" }}>Tải ảnh lịch học</h4>
            <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--text-secondary)", lineHeight: "1.5" }}>
              Chọn tải ảnh lịch học, điền thông tin chi tiết môn học, thời gian rảnh.
            </p>
          </div>
          <div className="glass-panel" style={{ padding: "1.25rem", background: "white", borderRadius: "16px", border: "1px solid #f1f5f9", textAlign: "left" }}>
            <div style={{ fontSize: "1.5rem", marginBottom: "8px" }}>4️⃣</div>
            <h4 style={{ margin: "0 0 6px 0", color: "var(--text-primary)" }}>Nhận kết quả</h4>
            <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--text-secondary)", lineHeight: "1.5" }}>
              Theo dõi trạng thái duyệt đơn và quản lý Cộng tác viên trực tiếp trên bảng điều khiển.
            </p>
          </div>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "1rem", textAlign: "left" }}>
        <h2 style={{ fontSize: "1.25rem", color: "var(--primary)", borderBottom: "2px solid var(--primary-light)", paddingBottom: "6px" }}>
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
