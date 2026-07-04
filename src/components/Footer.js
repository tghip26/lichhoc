import Link from "next/link";

export default function Footer() {
  return (
    <footer style={{ 
      background: "rgba(255, 255, 255, 0.8)", 
      backdropFilter: "blur(24px)", 
      borderTop: "1px solid rgba(226, 232, 240, 0.8)", 
      padding: "3rem 0 2rem 0", 
      marginTop: "4rem" 
    }}>
      <div className="container" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: "2rem" }}>
        
        {/* Brand & Contact Info */}
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "1rem" }}>
            <div style={{
              width: "32px", 
              height: "32px", 
              borderRadius: "8px", 
              background: "linear-gradient(135deg, var(--primary) 0%, var(--primary-hover) 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "white",
              fontWeight: "900",
              fontSize: "1.2rem",
              boxShadow: "0 2px 8px rgba(22, 163, 74, 0.2)"
            }}>
              L
            </div>
            <span style={{ fontSize: "1.2rem", fontWeight: "800", background: "linear-gradient(135deg, var(--primary), var(--secondary))", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
              ThuêHọc Pro
            </span>
          </div>
          <p style={{ color: "var(--text-secondary)", fontSize: "0.9rem", lineHeight: "1.6", marginBottom: "1.5rem" }}>
            Hệ thống kết nối và quản lý lịch thuê học chuyên nghiệp, giúp tối ưu hóa thời gian cho sinh viên và ban quản lý.
          </p>
          
          <div style={{ display: "flex", gap: "1rem" }}>
            <a 
              href="tel:0852866856" 
              style={{ display: "flex", alignItems: "center", gap: "8px", background: "rgba(22, 163, 74, 0.1)", color: "var(--primary)", padding: "0.6rem 1rem", borderRadius: "8px", textDecoration: "none", fontWeight: "600", fontSize: "0.9rem", transition: "all 0.2s" }}
            >
              <svg style={{ width: "18px", height: "18px" }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"></path></svg>
              0852 866 856
            </a>
            <a 
              href="https://zalo.me/0838636538" 
              target="_blank"
              rel="noopener noreferrer"
              style={{ display: "flex", alignItems: "center", gap: "8px", background: "#0068FF", color: "white", padding: "0.6rem 1rem", borderRadius: "8px", textDecoration: "none", fontWeight: "600", fontSize: "0.9rem", transition: "all 0.2s" }}
            >
              <svg style={{ width: "18px", height: "18px" }} viewBox="0 0 24 24" fill="currentColor"><path d="M21.544 10.499c0-4.259-4.214-7.729-9.428-7.729S2.688 6.24 2.688 10.499c0 4.258 4.214 7.728 9.428 7.728 1.487 0 2.872-.258 4.093-.71l3.52 1.996c.264.15.586-.046.527-.348l-.68-3.486c1.233-1.4 1.968-3.217 1.968-5.18z"/></svg>
              0838 636 538
            </a>
          </div>
        </div>

        {/* Links */}
        <div style={{ paddingLeft: "1rem" }}>
          <h4 style={{ fontSize: "1.05rem", fontWeight: "700", marginBottom: "1.2rem", color: "var(--text-primary)" }}>Hỗ trợ</h4>
          <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "0.8rem" }}>
            <li>
              <Link href="/huong-dan" style={{ color: "var(--text-secondary)", textDecoration: "none", fontSize: "0.95rem", transition: "color 0.2s" }}>
                Hướng dẫn sử dụng
              </Link>
            </li>
            <li>
              <Link href="/dieu-khoan" style={{ color: "var(--text-secondary)", textDecoration: "none", fontSize: "0.95rem", transition: "color 0.2s" }}>
                Điều khoản & Bảo mật
              </Link>
            </li>
            <li>
              <Link href="/lien-he" style={{ color: "var(--text-secondary)", textDecoration: "none", fontSize: "0.95rem", transition: "color 0.2s" }}>
                Liên hệ với chúng tôi
              </Link>
            </li>
          </ul>
        </div>
        
        {/* Working Hours */}
        <div style={{ paddingLeft: "1rem" }}>
          <h4 style={{ fontSize: "1.05rem", fontWeight: "700", marginBottom: "1.2rem", color: "var(--text-primary)" }}>Thời gian làm việc</h4>
          <div style={{ color: "var(--text-secondary)", fontSize: "0.95rem", display: "flex", flexDirection: "column", gap: "0.8rem" }}>
            <p style={{ margin: 0 }}><strong>Thứ 2 - Thứ 6:</strong> 08:00 - 18:00</p>
            <p style={{ margin: 0 }}><strong>Thứ 7:</strong> 08:00 - 12:00</p>
            <p style={{ margin: 0 }}><strong>Chủ nhật & Ngày lễ:</strong> Nghỉ</p>
          </div>
        </div>
      </div>
      
      <div className="container" style={{ marginTop: "3rem", paddingTop: "1.5rem", borderTop: "1px solid rgba(226, 232, 240, 0.8)", textAlign: "center", color: "var(--text-secondary)", fontSize: "0.85rem" }}>
        &copy; {new Date().getFullYear()} ThuêHọc Pro. Tất cả quyền được bảo lưu.
      </div>
    </footer>
  );
}
