"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

export default function SupportWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    {
      sender: "bot",
      text: "Xin chào! 👋 Tôi là trợ lý hỗ trợ tự động của Thuê Học Pro. Tôi có thể giúp gì cho bạn hôm nay?",
      time: new Date()
    }
  ]);
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef(null);
  const router = useRouter();

  const faqTriggers = [
    {
      q: "💵 Bảng giá dịch vụ thuê học hộ?",
      a: "Chào bạn! Chi phí thuê học hộ cơ bản dao động từ 150.000 đ - 200.000 đ/buổi trực lớp tùy theo thời lượng (tiết học). Các khoản tiền tip làm bài kiểm tra hoặc thuyết trình sẽ do bạn thương lượng thêm với CTV. Bạn có thể đặt lịch ngay tại Bảng điều khiển cá nhân nhé!",
      cta: { text: "📅 Đi đặt lịch ngay", link: "/dashboard" }
    },
    {
      q: "🎓 Muốn đăng ký làm Cộng tác viên (CTV)?",
      a: "Chào bạn! Chúng tôi liên tục tuyển dụng CTV trực lớp. Bạn chỉ cần click vào nút bên dưới để đi đến trang nộp hồ sơ Tuyển CTV (điền thông tin và tải ảnh thẻ SV xác minh). Admin sẽ xem duyệt nhanh sau 10 - 20 phút!",
      cta: { text: "✍️ Đi ứng tuyển CTV", link: "/tuyen-ctv" }
    },
    {
      q: "🔒 Chính sách bảo mật thông tin học viên?",
      a: "Bạn hoàn toàn có thể yên tâm! Thuê Học Pro cam kết bảo mật 100% danh tính học viên, mã sinh viên, thời khóa biểu và hình ảnh của bạn. Chỉ có Admin và CTV trực tiếp nhận ca được xem thông tin lớp học. Hệ thống lưu trữ dữ liệu an toàn trên Firestore Cloud.",
      cta: { text: "📖 Xem điều khoản bảo mật", link: "/dieu-khoan" }
    },
    {
      q: "💬 Liên hệ trực tiếp Zalo hỗ trợ 24/7?",
      a: "Nếu bạn có yêu cầu đặc biệt hoặc cần hỗ trợ nạp tiền/rút tiền ví gấp, hãy liên hệ trực tiếp với Admin qua số điện thoại/Zalo Hotline: <b>0852.866.856</b>. Hỗ trợ viên trực tuyến 24/7 luôn sẵn sàng xử lý ca khó!",
      cta: { text: "💬 Chat Zalo trực tiếp", link: "https://zalo.me/0852866856" }
    }
  ];

  const handleSelectQuestion = (q, a, cta) => {
    // Add user question
    const userMsg = { sender: "user", text: q, time: new Date() };
    setMessages(prev => [...prev, userMsg]);
    setIsTyping(true);

    // Simulate bot typing
    setTimeout(() => {
      setIsTyping(false);
      const botMsg = { sender: "bot", text: a, time: new Date(), cta };
      setMessages(prev => [...prev, botMsg]);
    }, 700);
  };

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isTyping]);

  return (
    <>
      {/* NÚT CHAT BONG BÓNG FLOATING */}
      <div 
        onClick={() => setIsOpen(!isOpen)}
        style={{
          position: "fixed",
          bottom: "25px",
          right: "25px",
          width: "60px",
          height: "60px",
          borderRadius: "50%",
          background: "linear-gradient(135deg, #10B981 0%, #059669 100%)",
          color: "white",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: "0 8px 30px rgba(16, 185, 129, 0.4)",
          cursor: "pointer",
          zIndex: 9999,
          fontSize: "1.6rem",
          transition: "transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
          animation: isOpen ? "none" : "pulseChat 2s infinite"
        }}
        onMouseEnter={e => e.currentTarget.style.transform = "scale(1.1) rotate(5deg)"}
        onMouseLeave={e => e.currentTarget.style.transform = "scale(1)"}
      >
        {isOpen ? "✖" : "💬"}
      </div>

      {/* CỬA SỔ CHAT DRAWER */}
      {isOpen && (
        <div 
          className="glass-panel"
          style={{
            position: "fixed",
            bottom: "95px",
            right: "25px",
            width: "360px",
            maxWidth: "calc(100vw - 50px)",
            height: "480px",
            maxHeight: "calc(100vh - 120px)",
            borderRadius: "20px",
            display: "flex",
            flexDirection: "column",
            boxShadow: "0 10px 40px rgba(0,0,0,0.12)",
            background: "rgba(255, 255, 255, 0.92)",
            backdropFilter: "blur(12px)",
            border: "1px solid rgba(16, 185, 129, 0.2)",
            overflow: "hidden",
            zIndex: 9999,
            animation: "slideInChat 0.3s ease-out"
          }}
        >
          {/* Header */}
          <div style={{
            background: "linear-gradient(135deg, #10B981 0%, #059669 100%)",
            color: "white",
            padding: "1rem 1.25rem",
            display: "flex",
            alignItems: "center",
            gap: "10px"
          }}>
            <div style={{
              width: "40px",
              height: "40px",
              borderRadius: "50%",
              background: "rgba(255,255,255,0.2)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "1.2rem"
            }}>
              🛡️
            </div>
            <div style={{ textAlign: "left" }}>
              <div style={{ fontSize: "0.9rem", fontWeight: "800" }}>Trợ lý hỗ trợ tự động</div>
              <div style={{ fontSize: "0.72rem", opacity: 0.9, display: "flex", alignItems: "center", gap: "4px" }}>
                <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#4ade80", display: "inline-block" }}></span>
                Trực tuyến 24/7
              </div>
            </div>
          </div>

          {/* Messages Area */}
          <div style={{
            flex: 1,
            padding: "1.25rem",
            overflowY: "auto",
            display: "flex",
            flexDirection: "column",
            gap: "12px",
            background: "#f8fafc"
          }}>
            {messages.map((m, idx) => (
              <div 
                key={idx} 
                style={{
                  alignSelf: m.sender === "user" ? "flex-end" : "flex-start",
                  maxWidth: "85%",
                  textAlign: "left"
                }}
              >
                <div style={{
                  background: m.sender === "user" ? "#10B981" : "white",
                  color: m.sender === "user" ? "white" : "var(--text-primary)",
                  padding: "10px 14px",
                  borderRadius: m.sender === "user" ? "16px 16px 2px 16px" : "16px 16px 16px 2px",
                  fontSize: "0.82rem",
                  lineHeight: "1.5",
                  boxShadow: "0 2px 5px rgba(0,0,0,0.03)",
                  border: m.sender === "user" ? "none" : "1px solid #e2e8f0"
                }}>
                  <div dangerouslySetInnerHTML={{ __html: m.text }}></div>
                  
                  {m.cta && (
                    <button
                      onClick={() => {
                        if (m.cta.link.startsWith("http")) {
                          window.open(m.cta.link, "_blank");
                        } else {
                          router.push(m.cta.link);
                        }
                      }}
                      className="btn btn-primary"
                      style={{
                        marginTop: "8px",
                        fontSize: "0.75rem",
                        padding: "5px 12px",
                        borderRadius: "8px",
                        width: "100%",
                        border: "none",
                        fontWeight: "750"
                      }}
                    >
                      {m.cta.text}
                    </button>
                  )}
                </div>
                <span style={{ fontSize: "0.65rem", color: "var(--text-secondary)", marginTop: "2px", display: "block", textAlign: m.sender === "user" ? "right" : "left" }}>
                  {m.time.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
            ))}

            {isTyping && (
              <div style={{ alignSelf: "flex-start", display: "flex", gap: "4px", padding: "8px 14px", background: "white", borderRadius: "12px", border: "1px solid #e2e8f0" }}>
                <span className="dot" style={{ width: "5px", height: "5px", background: "#64748b", borderRadius: "50%", display: "inline-block", animation: "bounce 1.4s infinite" }}></span>
                <span className="dot" style={{ width: "5px", height: "5px", background: "#64748b", borderRadius: "50%", display: "inline-block", animation: "bounce 1.4s infinite 0.2s" }}></span>
                <span className="dot" style={{ width: "5px", height: "5px", background: "#64748b", borderRadius: "50%", display: "inline-block", animation: "bounce 1.4s infinite 0.4s" }}></span>
              </div>
            )}
            
            <div ref={messagesEndRef} />
          </div>

          {/* Quick Triggers Option footer */}
          <div style={{
            padding: "10px",
            background: "white",
            borderTop: "1px solid #e2e8f0",
            display: "flex",
            flexDirection: "column",
            gap: "6px"
          }}>
            <div style={{ fontSize: "0.72rem", color: "var(--text-secondary)", fontWeight: "700", textAlign: "left", paddingLeft: "6px" }}>
              💡 Câu hỏi gợi ý:
            </div>
            <div 
              className="hide-scrollbar"
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "5px",
                maxHeight: "130px",
                overflowY: "auto",
                padding: "2px"
              }}
            >
              {faqTriggers.map((item, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSelectQuestion(item.q, item.a, item.cta)}
                  style={{
                    background: "#f1f5f9",
                    color: "var(--text-primary)",
                    border: "1px solid #cbd5e1",
                    borderRadius: "10px",
                    padding: "6px 10px",
                    fontSize: "0.75rem",
                    fontWeight: "600",
                    cursor: "pointer",
                    textAlign: "left",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    transition: "all 0.15s"
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.background = "#e2e8f0";
                    e.currentTarget.style.borderColor = "#94a3b8";
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.background = "#f1f5f9";
                    e.currentTarget.style.borderColor = "#cbd5e1";
                  }}
                >
                  {item.q}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* CSS KEYFRAMES ANIMATIONS */}
      <style jsx global>{`
        @keyframes pulseChat {
          0% { transform: scale(1); box-shadow: 0 8px 25px rgba(16, 185, 129, 0.4); }
          50% { transform: scale(1.05); box-shadow: 0 8px 35px rgba(16, 185, 129, 0.6); }
          100% { transform: scale(1); box-shadow: 0 8px 25px rgba(16, 185, 129, 0.4); }
        }
        @keyframes slideInChat {
          from { transform: translateY(20px) scale(0.95); opacity: 0; }
          to { transform: translateY(0) scale(1); opacity: 1; }
        }
        @keyframes bounce {
          0%, 80%, 100% { transform: translateY(0); }
          40% { transform: translateY(-5px); }
        }
      `}</style>
    </>
  );
}
