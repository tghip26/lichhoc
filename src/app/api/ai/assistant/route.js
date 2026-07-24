import { NextResponse } from 'next/server';
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs, limit } from "firebase/firestore";

export async function POST(request) {
  try {
    const { message, userEmail, userId } = await request.json();

    if (!message || typeof message !== 'string') {
      return NextResponse.json({ error: 'Nội dung tin nhắn không hợp lệ' }, { status: 400 });
    }

    const lowerMsg = message.toLowerCase().trim();

    // 1. KIỂM TRA NẾU NGƯỜI DÙNG HỎI VỀ TRA CỨU ĐƠN HÀNG / CA HỌC VỚI LIVE FIRESTORE LOOKUP
    const isOrderLookupQuery = 
      lowerMsg.includes("tra cứu") || 
      lowerMsg.includes("kiểm tra lịch") || 
      lowerMsg.includes("đơn của tôi") || 
      lowerMsg.includes("trạng thái ca") || 
      lowerMsg.includes("lịch học của tôi") ||
      lowerMsg.includes("đơn đã đặt");

    if (isOrderLookupQuery) {
      if (!userEmail && !userId) {
        return NextResponse.json({
          reply: "Để tra cứu lịch học hoặc đơn đăng ký của bạn, bạn vui lòng **đăng nhập tài khoản** hoặc gửi **Mã đơn hàng** cho tôi nhé! 🔑\n\nBạn cũng có thể xem trực tiếp danh sách ca học tại trang **[Bảng Điều Khiển](/dashboard)**.",
          cta: { text: "📅 Mở Bảng Điều Khiển", link: "/dashboard" }
        });
      }

      try {
        // Query recent schedules for this customer
        const q = query(
          collection(db, "schedules"),
          where("userId", "==", userId || ""),
          limit(3)
        );
        const snapshot = await getDocs(q);

        if (snapshot.empty) {
          return NextResponse.json({
            reply: `Xin chào! Tôi đã kiểm tra hệ thống nhưng chưa tìm thấy ca học nào đăng ký bằng tài khoản **${userEmail || 'của bạn'}**.\n\nBạn có thể nhấp nút bên dưới để tiến hành đặt ca học hộ mới nhé! 🚀`,
            cta: { text: "➕ Đặt lịch học hộ ngay", link: "/dashboard" }
          });
        }

        const schedulesList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        let replyText = `📋 **Danh sách ca học gần nhất của bạn (${schedulesList.length} ca):**\n\n`;

        schedulesList.forEach((s, idx) => {
          const statusText = s.status === "completed" ? "✅ Đã hoàn thành" :
                             s.status === "accepted" ? "🔵 CTV đã nhận ca (Đang trực lớp)" :
                             s.status === "in_progress" ? "⏳ Đang diễn ra" :
                             s.status === "proof_submitted" ? "📸 Đã nộp minh chứng (Chờ duyệt)" :
                             s.status === "rejected" ? "🚨 Đã hủy / Hoàn tiền" : "⏳ Đang tìm CTV...";
          
          const dateStr = s.classDate ? new Date(s.classDate).toLocaleDateString("vi-VN") : "N/A";
          replyText += `${idx + 1}. **${s.className || s.subject}** (${s.school || 'N/A'})\n`;
          replyText += `   • Ngày học: **${dateStr}** (${s.startTime || ''} - ${s.endTime || ''})\n`;
          replyText += `   • Trạng thái: **${statusText}**\n`;
          if (s.assignedTo) replyText += `   • CTV phụ trách: **${s.assignedTo}**\n`;
          replyText += `\n`;
        });

        replyText += `Bạn có thể bấm vào bên dưới để xem chi tiết đầy đủ minh chứng ảnh điểm danh nhé!`;

        return NextResponse.json({
          reply: replyText,
          cta: { text: "🔍 Xem chi tiết tại Dashboard", link: "/dashboard" }
        });

      } catch (err) {
        console.warn("Lỗi tra cứu đơn hàng Firestore:", err.message);
      }
    }

    // 2. GỌI GEMINI API NẾU CÓ GEMINI_API_KEY
    const apiKey = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY;
    if (apiKey) {
      try {
        const systemInstruction = `Bạn là Trợ lý AI tư vấn hỗ trợ 24/7 của nền tảng "THUEHOCPRO" (Thuê Học Hộ & Trợ Lý Học Tập Hàng Đầu).
Các thông tin chính thức của dịch vụ:
- Dịch vụ: Thuê học hộ trực lớp, làm bài kiểm tra, thuyết trình, chép slide bài giảng, điểm danh.
- Giá cả: 35.000đ - 50.000đ / giờ trực lớp tiêu chuẩn (hoặc khoảng 150.000đ - 200.000đ cho buổi học 4-5 tiết). Tiền tip hỗ trợ bài kiểm tra do khách thương lượng thêm.
- Bảo mật: Cam kết bảo mật 100% danh tính học viên, mã sinh viên và thời khóa biểu. Không lộ thông tin cá nhân.
- Nạp tiền ví: Nạp tự động qua chuyển khoản VietQR MBBank tại trang Ví cá nhân (/dashboard). Tiền được giữ an toàn trên hệ thống và chỉ chuyển cho CTV khi ca học hoàn thành thành công.
- Hủy ca & Hoàn tiền: Khách được quyền hủy ca và nhận lại 100% tiền vào ví nếu chưa có CTV nhận hoặc ca học bị hủy trước giờ học.
- Tuyển CTV: Sinh viên các trường ĐH có thể ứng tuyển làm CTV tại trang (/tuyen-ctv).
- Hotline Zalo hỗ trợ: 0852866856.
Hãy trả lời ngắn gọn, lịch sự, thân thiện, dùng icon sinh động, sử dụng GitHub markdown định dạng và hướng dẫn khách hàng nếu cần.`;

        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [
              { role: "user", parts: [{ text: `${systemInstruction}\n\nCâu hỏi của người dùng: ${message}` }] }
            ]
          })
        });

        if (response.ok) {
          const data = await response.json();
          const aiReply = data?.candidates?.[0]?.content?.parts?.[0]?.text;
          if (aiReply) {
            return NextResponse.json({ reply: aiReply });
          }
        }
      } catch (err) {
        console.warn("Lỗi gọi Gemini API, chuyển sang AI logic thông minh dự phòng:", err.message);
      }
    }

    // 3. AI SMART FALLBACK SYSTEM (BỘ TƯ VẤN THÔNG MINH DỰ PHÒNG)
    if (lowerMsg.includes("giá") || lowerMsg.includes("nhiều tiền") || lowerMsg.includes("chi phí") || lowerMsg.includes("bảng giá")) {
      return NextResponse.json({
        reply: "💵 **Bảng Giá Dịch Vụ Thuê Học Hộ Tiêu Chuẩn:**\n\n• **Trực lớp tiêu chuẩn**: Từ **35.000 đ - 40.000 đ / giờ** (khoảng 150k - 200k cho 1 ca 4-5 tiết học).\n• **Làm bài kiểm tra / Thuyết trình**: Khách hàng điền thêm tiền Tip đính kèm ca học để thương lượng với CTV.\n• **Chép slide bài giảng**: Hỗ trợ chụp lại bài giảng & ghi chép theo yêu cầu.\n\nToàn bộ chi phí được niêm yết rõ ràng khi bạn tạo đơn nhé!",
        cta: { text: "📅 Tạo đơn đặt lịch ngay", link: "/dashboard" }
      });
    }

    if (lowerMsg.includes("bảo mật") || lowerMsg.includes("lộ thông tin") || lowerMsg.includes("an toàn") || lowerMsg.includes("uy tín")) {
      return NextResponse.json({
        reply: "🛡️ **Cam Kết Bảo Mật Danh Tính 100%:**\n\n1. **Khách Hàng**: Mã sinh viên, tên thật và ảnh của bạn được bảo mật tuyệt đối. CTV chỉ nhìn thấy thông tin trường, phòng học và giờ học.\n2. **Hệ Thống**: Dữ liệu lưu trữ trên Google Firebase Security Cloud với lớp mã hóa 2 chiều.\n3. **Thanh Toán**: Tiền được giữ tạm trên hệ thống và chỉ trả cho CTV khi bạn xác nhận ca học thành công!",
        cta: { text: "📖 Xem Điều Khoản Bảo Mật", link: "/dieu-khoan" }
      });
    }

    if (lowerMsg.includes("nạp tiền") || lowerMsg.includes("ví") || lowerMsg.includes("rút tiền") || lowerMsg.includes("thanh toán")) {
      return NextResponse.json({
        reply: "💳 **Hướng Dẫn Nạp Tiền Vào Ví Cá Nhân:**\n\n1. Bạn truy cập vào trang **[Bảng Điều Khiển cá nhân](/dashboard)** -> Chọn thẻ **Ví Tiền**.\n2. Nhập số tiền muốn nạp và bấm **Nạp tiền qua QR**.\n3. Quét mã VietQR chuyển khoản (MBBank). Hệ thống sẽ kiểm tra và cộng tiền vào tài khoản của bạn tự động sau 1-3 phút!\n\nNếu gặp sự cố, bạn có thể liên hệ Zalo Hotline: **0852.866.856** để hỗ trợ nạp tay ngay lập tức.",
        cta: { text: "💳 Đi đến Ví Tiền", link: "/dashboard" }
      });
    }

    if (lowerMsg.includes("hủy") || lowerMsg.includes("hoàn tiền") || lowerMsg.includes("trả lại tiền")) {
      return NextResponse.json({
        reply: "🔄 **Chính Sách Hủy Ca & Hoàn Tiền:**\n\n• Bạn được **hủy ca học miễn phí 100%** và nhận lại đủ tiền vào ví nếu ca học chưa có CTV nhận hoặc được hủy trước giờ bắt đầu học.\n• Nếu ca học có khiếu nại (CTV bỏ ca, đi muộn...), Admin sẽ xác minh và hoàn tiền 100% lại cho bạn ngay lập tức!",
        cta: { text: "📋 Quản lý đơn hàng", link: "/dashboard" }
      });
    }

    if (lowerMsg.includes("ctv") || lowerMsg.includes("làm việc") || lowerMsg.includes("ứng tuyển") || lowerMsg.includes("tuyển dụng")) {
      return NextResponse.json({
        reply: "🎓 **Đăng Ký Làm CTV Trực Lớp (Tăng Thu Nhập):**\n\nThuê Học Pro liên tục tuyển dụng các bạn sinh viên năng động trực lớp giúp bạn bè. Thu nhập từ **150.000 đ - 300.000 đ / ca**, rút tiền ví về thẻ ngân hàng bất cứ lúc nào!\n\nBạn chỉ cần nộp hồ sơ sinh viên tại trang Tuyển CTV bên dưới nhé!",
        cta: { text: "✍️ Đi ứng tuyển CTV ngay", link: "/tuyen-ctv" }
      });
    }

    // Default polite response
    return NextResponse.json({
      reply: `Xin chào! 👋 Tôi là **Trợ lý AI 24/7** của Thuê Học Pro. Tôi luôn sẵn sàng hỗ trợ bạn:\n\n• **Bảng giá dịch vụ** (35k/giờ)\n• **Hướng dẫn nạp/rút tiền ví cá nhân**\n• **Tra cứu trạng thái ca học của bạn**\n• **Chính sách bảo mật danh tính 100%**\n• **Quy trình hủy đơn & hoàn tiền**\n\nBạn hãy gõ câu hỏi hoặc chọn các gợi ý bên dưới nhé! 😊`,
      cta: { text: "💬 Chat Zalo Admin 0852866856", link: "https://zalo.me/0852866856" }
    });

  } catch (error) {
    console.error("Lỗi AI Assistant API:", error);
    return NextResponse.json({ 
      reply: "Xin lỗi bạn, trợ lý AI đang quá tải trong giây lát. Vui lòng liên hệ trực tiếp Zalo **0852866856** để được Admin hỗ trợ tức thì!",
      cta: { text: "💬 Chat Zalo Admin", link: "https://zalo.me/0852866856" }
    });
  }
}
