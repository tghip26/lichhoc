export default function HuongDanPage() {
  return (
    <div className="glass-panel" style={{ maxWidth: "800px", margin: "3rem auto" }}>
      <h1 className="page-title" style={{ fontSize: "2rem", marginBottom: "2rem", textAlign: "center" }}>Hướng Dẫn Sử Dụng</h1>
      
      <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
        <div>
          <h3 style={{ color: "var(--primary)", marginBottom: "0.5rem" }}>Bước 1: Đăng nhập</h3>
          <p style={{ color: "var(--text-secondary)", lineHeight: "1.6" }}>
            Sử dụng tài khoản Google cá nhân hoặc tạo một tài khoản mới bằng Email và Mật khẩu tại trang chủ để có thể sử dụng hệ thống.
          </p>
        </div>

        <div>
          <h3 style={{ color: "var(--primary)", marginBottom: "0.5rem" }}>Bước 2: Cập nhật thông tin</h3>
          <p style={{ color: "var(--text-secondary)", lineHeight: "1.6" }}>
            Truy cập mục <strong>"Lịch của tôi"</strong>. Điền đầy đủ các thông tin: Họ và tên, Mã sinh viên, Lớp và Trường đại học của bạn.
          </p>
        </div>

        <div>
          <h3 style={{ color: "var(--primary)", marginBottom: "0.5rem" }}>Bước 3: Tải ảnh lịch học</h3>
          <p style={{ color: "var(--text-secondary)", lineHeight: "1.6" }}>
            Bấm chọn ảnh lịch học (hỗ trợ các định dạng .png, .jpg) từ thiết bị của bạn. Vui lòng đảm bảo ảnh chụp rõ nét, dễ đọc. Sau đó bấm nút <strong>"Gửi thông tin"</strong>.
          </p>
        </div>

        <div>
          <h3 style={{ color: "var(--primary)", marginBottom: "0.5rem" }}>Bước 4: Theo dõi trạng thái</h3>
          <p style={{ color: "var(--text-secondary)", lineHeight: "1.6" }}>
            Lịch học của bạn sau khi nộp sẽ hiển thị ở cột bên phải với trạng thái <strong>"Chờ duyệt"</strong>. Bạn có thể xóa nếu lỡ nộp nhầm. Ban quản lý sẽ sớm phê duyệt lịch của bạn.
          </p>
        </div>
      </div>
    </div>
  );
}
