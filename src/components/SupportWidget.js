"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

export default function SupportWidget() {
  const { user } = useAuth();
  const router = useRouter();

  const [isOpen, setIsOpen] = useState(false);
  const [inputText, setInputText] = useState("");
  const [isTyping, setIsTyping] = useState(false);

  const [messages, setMessages] = useState([
    {
      sender: "bot",
      text: "Xin chào! 👋 Tôi là **Trợ lý AI 24/7** của **Thuê Học Pro**.\n\nNhấp trực tiếp vào một trong các ô lựa chọn bên dưới để tôi hỗ trợ bạn ngay nhé: 😊",
      options: [
        { label: "🎯 Tra cứu ca học của tôi", prompt: "Tôi muốn tra cứu lịch học/ca học gần nhất của tôi" },
        { label: "💵 Bảng giá dịch vụ (35k/giờ)", prompt: "Bảng giá dịch vụ thuê học hộ là bao nhiêu?" },
        { label: "💳 Hướng dẫn nạp/rút tiền ví", prompt: "Cách nạp tiền tự động vào ví như thế nào?" },
        { label: "🛡️ Cam kết bảo mật 100%", prompt: "Chính sách bảo mật thông tin học viên ra sao?" },
        { label: "🎓 Đăng ký làm CTV trực lớp", prompt: "Muốn ứng tuyển làm CTV trực lớp thì làm thế nào?" }
      ],
      time: new Date()
    }
  ]);

  const messagesEndRef = useRef(null);

  // Gợi ý thanh trượt bên dưới
  const quickSuggestions = [
    { label: "🎯 Tra cứu ca học của tôi", prompt: "Tôi muốn tra cứu lịch học/ca học gần nhất của tôi" },
    { label: "💵 Bảng giá thuê học hộ", prompt: "Bảng giá dịch vụ thuê học hộ là bao nhiêu?" },
    { label: "💳 Hướng dẫn nạp tiền ví", prompt: "Cách nạp tiền tự động vào ví như thế nào?" },
    { label: "🛡️ Cam kết bảo mật danh tính", prompt: "Chính sách bảo mật thông tin học viên ra sao?" },
    { label: "🎓 Đăng ký làm CTV trực lớp", prompt: "Muốn ứng tuyển làm CTV trực lớp thì làm thế nào?" }
  ];

  // Helper format Markdown sang HTML an toàn
  const formatMarkdown = (text) => {
    if (!text) return "";
    let formatted = text
      .replace(/`([^`]+)`/g, '<code style="background:#e2e8f0; padding:2px 6px; borderRadius:4px; font-family:monospace; font-size:0.8rem; color:#0f172a;">$1</code>')
      .replace(/\*\*(.*?)\*\*/g, "<b>$1</b>")
      .replace(/\*(.*?)\*/g, "<i>$1</i>")
      .replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" style="color: #059669; font-weight: bold; text-decoration: underline;">$1</a>')
      .replace(/\n/g, "<br/>");
    return formatted;
  };

  // Gửi câu hỏi tới AI Assistant API
  const handleSendMessage = async (textToSend) => {
    const queryText = textToSend || inputText;
    if (!queryText || !queryText.trim() || isTyping) return;

    // Add user message
    const userMsg = { sender: "user", text: queryText.trim(), time: new Date() };
    setMessages(prev => [...prev, userMsg]);
    if (!textToSend) setInputText("");
    setIsTyping(true);

    try {
      const res = await fetch("/api/ai/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: queryText.trim(),
          userEmail: user?.email || "",
          userId: user?.uid || ""
        })
      });

      const data = await res.json();
      setIsTyping(false);

      if (data && data.reply) {
        const botMsg = {
          sender: "bot",
          text: data.reply,
          options: data.options || null,
          cta: data.cta,
          time: new Date()
        };
        setMessages(prev => [...prev, botMsg]);
      } else {
        setMessages(prev => [
          ...prev,
          {
            sender: "bot",
            text: "Xin lỗi bạn, tôi không thể xử lý câu hỏi lúc này. Vui lòng liên hệ trực tiếp Zalo Hotline: **0852.866.856** để được hỗ trợ tức thì!",
            cta: { text: "💬 Chat Zalo Admin", link: "https://zalo.me/0852866856" },
            time: new Date()
          }
        ]);
      }
    } catch (err) {
      console.error("Lỗi gửi tin nhắn AI:", err);
      setIsTyping(false);
      setMessages(prev => [
        ...prev,
        {
          sender: "bot",
          text: "Có lỗi kết nối xảy ra. Bạn vui lòng thử lại hoặc liên hệ Zalo Hotline: **0852866856** nhé!",
          cta: { text: "💬 Chat Zalo Admin", link: "https://zalo.me/0852866856" },
          time: new Date()
        }
      ]);
    }
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
          width: "62px",
          height: "62px",
          borderRadius: "50%",
          background: "linear-gradient(135deg, #10B981 0%, #059669 100%)",
          color: "white",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: "0 8px 30px rgba(16, 185, 129, 0.4)",
          cursor: "pointer",
          zIndex: 9999,
          fontSize: "1.7rem",
          transition: "transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
          animation: isOpen ? "none" : "pulseChat 2s infinite"
        }}
        onMouseEnter={e => e.currentTarget.style.transform = "scale(1.1) rotate(5deg)"}
        onMouseLeave={e => e.currentTarget.style.transform = "scale(1)"}
      >
        {isOpen ? "✖" : "🤖"}
      </div>

      {/* CỬA SỔ CHAT DRAWER AI */}
      {isOpen && (
        <div 
          className="glass-panel"
          style={{
            position: "fixed",
            bottom: "98px",
            right: "25px",
            width: "385px",
            maxWidth: "calc(100vw - 40px)",
            height: "530px",
            maxHeight: "calc(100vh - 120px)",
            borderRadius: "20px",
            display: "flex",
            flexDirection: "column",
            boxShadow: "0 12px 45px rgba(0,0,0,0.15)",
            background: "rgba(255, 255, 255, 0.96)",
            backdropFilter: "blur(14px)",
            border: "1px solid rgba(16, 185, 129, 0.3)",
            overflow: "hidden",
            zIndex: 9999,
            animation: "slideInChat 0.3s ease-out"
          }}
        >
          {/* Header (Đã loại bỏ nút Trạng thái dư thừa ở góc trên theo yêu cầu) */}
          <div style={{
            background: "linear-gradient(135deg, #059669 0%, #047857 100%)",
            color: "white",
            padding: "1rem 1.2rem",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between"
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <div style={{
                width: "42px",
                height: "42px",
                borderRadius: "50%",
                background: "rgba(255,255,255,0.2)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "1.4rem"
              }}>
                🤖
              </div>
              <div style={{ textAlign: "left" }}>
                <div style={{ fontSize: "0.92rem", fontWeight: "800" }}>Trợ Lý AI Smart Support</div>
                <div style={{ fontSize: "0.72rem", opacity: 0.9, display: "flex", alignItems: "center", gap: "4px" }}>
                  <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#4ade80", display: "inline-block" }}></span>
                  {user ? `Trực tuyến (${user.displayName || user.email.split('@')[0]})` : "Phản hồi tự động 24/7"}
                </div>
              </div>
            </div>

            <button
              onClick={() => setIsOpen(false)}
              style={{ background: "none", border: "none", color: "white", fontSize: "1.3rem", cursor: "pointer", opacity: 0.8 }}
            >
              ✖
            </button>
          </div>

          {/* Messages Area */}
          <div style={{
            flex: 1,
            padding: "1rem",
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
                  maxWidth: "88%",
                  textAlign: "left"
                }}
              >
                <div style={{
                  background: m.sender === "user" ? "linear-gradient(135deg, #10B981 0%, #059669 100%)" : "white",
                  color: m.sender === "user" ? "white" : "var(--text-primary)",
                  padding: "10px 14px",
                  borderRadius: m.sender === "user" ? "16px 16px 2px 16px" : "16px 16px 16px 2px",
                  fontSize: "0.82rem",
                  lineHeight: "1.55",
                  boxShadow: "0 2px 6px rgba(0,0,0,0.04)",
                  border: m.sender === "user" ? "none" : "1px solid #e2e8f0"
                }}>
                  <div dangerouslySetInnerHTML={{ __html: formatMarkdown(m.text) }}></div>
                  
                  {/* Ô CHỌN TRỰC TIẾP DẠNG NÚT BẤM DÀNH CHO NGƯỜI DÙNG */}
                  {m.options && m.options.length > 0 && (
                    <div style={{ marginTop: "10px", display: "flex", flexDirection: "column", gap: "6px" }}>
                      {m.options.map((opt, oIdx) => (
                        <button
                          key={oIdx}
                          type="button"
                          onClick={() => handleSendMessage(opt.prompt)}
                          style={{
                            background: "#f0fdf4",
                            color: "#166534",
                            border: "1px solid #bbf7d0",
                            borderRadius: "10px",
                            padding: "7px 12px",
                            fontSize: "0.78rem",
                            fontWeight: "750",
                            cursor: "pointer",
                            textAlign: "left",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            transition: "all 0.15s"
                          }}
                          onMouseEnter={e => {
                            e.currentTarget.style.background = "#dcfce7";
                            e.currentTarget.style.borderColor = "#86efac";
                          }}
                          onMouseLeave={e => {
                            e.currentTarget.style.background = "#f0fdf4";
                            e.currentTarget.style.borderColor = "#bbf7d0";
                          }}
                        >
                          <span>{opt.label}</span>
                          <span style={{ fontSize: "0.85rem", opacity: 0.7 }}>➔</span>
                        </button>
                      ))}
                    </div>
                  )}

                  {m.cta && (
                    <button
                      onClick={() => {
                        if (m.cta.link.startsWith("http")) {
                          window.open(m.cta.link, "_blank");
                        } else {
                          router.push(m.cta.link);
                        }
                      }}
                      className="btn"
                      style={{
                        marginTop: "10px",
                        fontSize: "0.78rem",
                        padding: "6px 12px",
                        borderRadius: "8px",
                        width: "100%",
                        border: "none",
                        fontWeight: "750",
                        background: "#047857",
                        color: "white",
                        cursor: "pointer"
                      }}
                    >
                      {m.cta.text}
                    </button>
                  )}
                </div>
                <span style={{ fontSize: "0.65rem", color: "var(--text-secondary)", marginTop: "3px", display: "block", textAlign: m.sender === "user" ? "right" : "left" }}>
                  {m.time.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
            ))}

            {isTyping && (
              <div style={{ alignSelf: "flex-start", display: "flex", alignItems: "center", gap: "6px", padding: "8px 14px", background: "white", borderRadius: "12px", border: "1px solid #e2e8f0", fontSize: "0.78rem", color: "var(--text-secondary)" }}>
                <span>🤖 AI đang tra cứu & phản hồi...</span>
                <span className="dot" style={{ width: "5px", height: "5px", background: "#10B981", borderRadius: "50%", animation: "bounce 1.4s infinite" }}></span>
                <span className="dot" style={{ width: "5px", height: "5px", background: "#10B981", borderRadius: "50%", animation: "bounce 1.4s infinite 0.2s" }}></span>
              </div>
            )}
            
            <div ref={messagesEndRef} />
          </div>

          {/* Gợi ý nhanh Quick Chips bên dưới */}
          <div style={{
            padding: "8px 10px",
            background: "#ffffff",
            borderTop: "1px solid #e2e8f0",
            display: "flex",
            gap: "6px",
            overflowX: "auto"
          }}>
            {quickSuggestions.map((item, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleSendMessage(item.prompt)}
                style={{
                  background: "#f0fdf4",
                  color: "#166534",
                  border: "1px solid #bbf7d0",
                  borderRadius: "20px",
                  padding: "4px 10px",
                  fontSize: "0.72rem",
                  fontWeight: "700",
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                  transition: "all 0.15s"
                }}
                onMouseEnter={e => e.currentTarget.style.background = "#dcfce7"}
                onMouseLeave={e => e.currentTarget.style.background = "#f0fdf4"}
              >
                {item.label}
              </button>
            ))}
          </div>

          {/* Input Form Footer */}
          <form 
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            style={{
              padding: "10px 12px",
              background: "white",
              borderTop: "1px solid #e2e8f0",
              display: "flex",
              gap: "8px",
              alignItems: "center"
            }}
          >
            <input
              type="text"
              value={inputText}
              onChange={e => setInputText(e.target.value)}
              placeholder="Nhập câu hỏi hoặc dán Mã ca học của bạn..."
              style={{
                flex: 1,
                padding: "8px 12px",
                borderRadius: "10px",
                border: "1px solid #cbd5e1",
                fontSize: "0.82rem",
                outline: "none"
              }}
            />
            <button
              type="submit"
              disabled={!inputText.trim() || isTyping}
              style={{
                background: inputText.trim() && !isTyping ? "linear-gradient(135deg, #10B981 0%, #059669 100%)" : "#cbd5e1",
                color: "white",
                border: "none",
                borderRadius: "10px",
                padding: "8px 14px",
                fontWeight: "750",
                fontSize: "0.82rem",
                cursor: inputText.trim() && !isTyping ? "pointer" : "not-allowed"
              }}
            >
              Gửi 🚀
            </button>
          </form>

        </div>
      )}

      {/* CSS KEYFRAMES ANIMATIONS */}
      <style jsx global>{`
        @keyframes pulseChat {
          0% { transform: scale(1); box-shadow: 0 8px 25px rgba(16, 185, 129, 0.4); }
          50% { transform: scale(1.06); box-shadow: 0 8px 35px rgba(16, 185, 129, 0.6); }
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
