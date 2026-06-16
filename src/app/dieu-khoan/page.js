export default function DieuKhoanPage() {
  return (
    <div className="glass-panel" style={{ maxWidth: "800px", margin: "3rem auto" }}>
      <h1 className="page-title" style={{ fontSize: "2rem", marginBottom: "2rem", textAlign: "center" }}>Điều Khoản & Bảo Mật</h1>
      
      <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
        <section>
          <h3 style={{ color: "var(--primary)", marginBottom: "0.8rem", borderBottom: "2px solid var(--primary-light)", paddingBottom: "0.5rem" }}>1. Điều khoản sử dụng</h3>
          <p style={{ color: "var(--text-secondary)", lineHeight: "1.7" }}>
            Khi đăng ký và sử dụng hệ thống Quản lý Lịch học, bạn đồng ý tuân thủ các quy định của ban quản lý. Bạn chịu trách nhiệm về tính xác thực của các thông tin cá nhân và hình ảnh lịch học được cung cấp. Chúng tôi có quyền từ chối phê duyệt những tài liệu không hợp lệ, mờ, không rõ ràng hoặc có dấu hiệu giả mạo.
          </p>
        </section>

        <section>
          <h3 style={{ color: "var(--primary)", marginBottom: "0.8rem", borderBottom: "2px solid var(--primary-light)", paddingBottom: "0.5rem" }}>2. Chính sách bảo mật dữ liệu</h3>
          <p style={{ color: "var(--text-secondary)", lineHeight: "1.7" }}>
            Chúng tôi cam kết bảo vệ quyền riêng tư và dữ liệu của sinh viên. Mọi thông tin bạn cung cấp (bao gồm Họ tên, Mã sinh viên, Lớp, Trường và Ảnh lịch học) chỉ được sử dụng cho mục đích kiểm tra và phê duyệt. Thông tin của bạn được lưu trữ an toàn trên máy chủ đám mây với mức độ bảo mật cao và không được chia sẻ cho bất kỳ bên thứ ba nào khi chưa có sự đồng ý của bạn.
          </p>
        </section>

        <section>
          <h3 style={{ color: "var(--primary)", marginBottom: "0.8rem", borderBottom: "2px solid var(--primary-light)", paddingBottom: "0.5rem" }}>3. Chỉnh sửa và Xóa dữ liệu</h3>
          <p style={{ color: "var(--text-secondary)", lineHeight: "1.7" }}>
            Người dùng có quyền chỉnh sửa, hoặc xóa lịch học của chính mình khi lịch đang ở trạng thái <strong>Chờ duyệt</strong>. Sau khi quản trị viên đã đánh dấu <strong>Đã duyệt</strong>, nếu có sai sót, vui lòng liên hệ ban quản trị để được hỗ trợ sửa đổi hệ thống.
          </p>
        </section>
      </div>
    </div>
  );
}
