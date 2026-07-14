export default function DieuKhoanPage() {
  return (
    <div className="glass-panel" style={{ maxWidth: "850px", margin: "3rem auto", padding: "2.5rem" }}>
      <h1 className="page-title" style={{ fontSize: "2.2rem", marginBottom: "1.5rem", textAlign: "center", fontWeight: "850" }}>
        🛡️ Điều Khoản Dịch Vụ & Bảo Mật
      </h1>
      <p style={{ textAlign: "center", color: "var(--text-secondary)", fontSize: "0.95rem", marginBottom: "3rem" }}>
        Vui lòng đọc kỹ các chính sách và điều khoản hoạt động của Thuê Học Pro để đảm bảo quyền lợi tốt nhất cho cả hai bên.
      </p>
      
      <div style={{ display: "flex", flexDirection: "column", gap: "2.5rem" }}>
        
        {/* Section 1 */}
        <section style={{ background: "white", padding: "1.5rem", borderRadius: "18px", border: "1px solid #e2e8f0", boxShadow: "0 2px 4px rgba(0,0,0,0.01)" }}>
          <h3 style={{ color: "var(--primary)", fontSize: "1.1rem", fontWeight: "800", display: "flex", alignItems: "center", gap: "8px", margin: "0 0 1rem 0", borderBottom: "1px dashed #cbd5e1", paddingBottom: "8px" }}>
            <span>📝 1. Điều Khoản Sử Dụng</span>
          </h3>
          <p style={{ color: "var(--text-secondary)", lineHeight: "1.7", fontSize: "0.9rem", margin: 0 }}>
            Khi đăng ký và sử dụng hệ thống Quản lý Lịch học, bạn đồng ý tuân thủ các quy định của ban quản lý. Bạn chịu trách nhiệm về tính xác thực của các thông tin cá nhân và hình ảnh lịch học được cung cấp. Chúng tôi có quyền từ chối phê duyệt những tài liệu không hợp lệ, mờ, không rõ ràng hoặc có dấu hiệu giả mạo.
          </p>
        </section>

        {/* Section 2 */}
        <section style={{ background: "white", padding: "1.5rem", borderRadius: "18px", border: "1px solid #e2e8f0", boxShadow: "0 2px 4px rgba(0,0,0,0.01)" }}>
          <h3 style={{ color: "var(--primary)", fontSize: "1.1rem", fontWeight: "800", display: "flex", alignItems: "center", gap: "8px", margin: "0 0 1rem 0", borderBottom: "1px dashed #cbd5e1", paddingBottom: "8px" }}>
            <span>🔒 2. Chính Sách Bảo Mật Dữ Liệu</span>
          </h3>
          <p style={{ color: "var(--text-secondary)", lineHeight: "1.7", fontSize: "0.9rem", margin: 0 }}>
            Chúng tôi cam kết bảo vệ quyền riêng tư và dữ liệu sinh viên tối đa. Mọi thông tin bạn cung cấp (bao gồm Họ tên, Mã sinh viên, Lớp, Trường và Ảnh lịch học) chỉ được sử dụng nội bộ cho mục đích xác thực và phân ca học. Thông tin được mã hóa bảo mật trên đám mây Firestore, tuyệt đối không chia sẻ cho bất kỳ bên thứ ba nào.
          </p>
        </section>

        {/* Section 3 */}
        <section style={{ background: "white", padding: "1.5rem", borderRadius: "18px", border: "1px solid #e2e8f0", boxShadow: "0 2px 4px rgba(0,0,0,0.01)" }}>
          <h3 style={{ color: "var(--primary)", fontSize: "1.1rem", fontWeight: "800", display: "flex", alignItems: "center", gap: "8px", margin: "0 0 1rem 0", borderBottom: "1px dashed #cbd5e1", paddingBottom: "8px" }}>
            <span>🔄 3. Điều Chỉnh Lịch & Hoàn Tiền</span>
          </h3>
          <p style={{ color: "var(--text-secondary)", lineHeight: "1.7", fontSize: "0.9rem", margin: 0 }}>
            Người dùng có quyền chỉnh sửa, hoặc hủy lịch học của chính mình khi đơn hàng ở trạng thái <strong>Chờ duyệt</strong>. Sau khi đơn hàng đã chuyển sang trạng thái <strong>Đã duyệt</strong>, nếu có thay đổi hoặc hủy lớp do yếu tố đột xuất, vui lòng thông tin ngay tới Zalo hỗ trợ để được nhân viên xử lý hoàn tiền ví 100% hoặc đổi lịch ca học khác phù hợp hơn.
          </p>
        </section>
        
      </div>
    </div>
  );
}
