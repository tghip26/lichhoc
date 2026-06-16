export default function LienHePage() {
  return (
    <div className="glass-panel" style={{ maxWidth: "600px", margin: "3rem auto", textAlign: "center" }}>
      <h1 className="page-title" style={{ fontSize: "2rem", marginBottom: "1rem" }}>Liên Hệ & Hỗ Trợ</h1>
      <p style={{ color: "var(--text-secondary)", marginBottom: "2.5rem" }}>
        Chúng tôi luôn sẵn sàng lắng nghe và hỗ trợ bạn. Vui lòng chọn phương thức liên lạc bên dưới.
      </p>
      
      <div style={{ display: "grid", gap: "1.5rem" }}>
        <a 
          href="tel:0852866856" 
          className="grid-card" 
          style={{ textDecoration: "none", alignItems: "center", padding: "2rem" }}
        >
          <div style={{ width: "64px", height: "64px", borderRadius: "50%", background: "rgba(79, 70, 229, 0.1)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--primary)", marginBottom: "1rem" }}>
            <svg style={{ width: "32px", height: "32px" }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"></path></svg>
          </div>
          <h3 style={{ margin: "0 0 0.5rem 0", color: "var(--text-primary)" }}>Gọi điện thoại trực tiếp</h3>
          <p style={{ margin: 0, fontSize: "1.2rem", fontWeight: "700", color: "var(--primary)" }}>0852 866 856</p>
        </a>

        <a 
          href="https://zalo.me/0838636538" 
          target="_blank"
          rel="noopener noreferrer"
          className="grid-card" 
          style={{ textDecoration: "none", alignItems: "center", padding: "2rem" }}
        >
          <div style={{ width: "64px", height: "64px", borderRadius: "50%", background: "rgba(0, 104, 255, 0.1)", display: "flex", alignItems: "center", justifyContent: "center", color: "#0068FF", marginBottom: "1rem" }}>
            <svg style={{ width: "32px", height: "32px" }} viewBox="0 0 24 24" fill="currentColor"><path d="M21.544 10.499c0-4.259-4.214-7.729-9.428-7.729S2.688 6.24 2.688 10.499c0 4.258 4.214 7.728 9.428 7.728 1.487 0 2.872-.258 4.093-.71l3.52 1.996c.264.15.586-.046.527-.348l-.68-3.486c1.233-1.4 1.968-3.217 1.968-5.18z"/></svg>
          </div>
          <h3 style={{ margin: "0 0 0.5rem 0", color: "var(--text-primary)" }}>Nhắn tin qua Zalo</h3>
          <p style={{ margin: 0, fontSize: "1.2rem", fontWeight: "700", color: "#0068FF" }}>0838 636 538</p>
        </a>
      </div>
    </div>
  );
}
