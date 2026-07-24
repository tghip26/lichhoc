import { NextResponse } from 'next/server';
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs, limit, doc, getDoc } from "firebase/firestore";

export async function POST(request) {
  try {
    const { message, userEmail, userId } = await request.json();

    if (!message || typeof message !== 'string') {
      return NextResponse.json({ error: 'Nội dung tin nhắn không hợp lệ' }, { status: 400 });
    }

    const lowerMsg = message.toLowerCase().trim();

    // -----------------------------------------------------------------
    // 🧠 1. THÔNG MINH TRA CỨU ĐƠN HÀNG MULTI-SOURCE (SCHEDULES & INTERNAL)
    // -----------------------------------------------------------------
    const isOrderLookupQuery = 
      lowerMsg.includes("tra cứu") || 
      lowerMsg.includes("kiểm tra lịch") || 
      lowerMsg.includes("đơn của tôi") || 
      lowerMsg.includes("trạng thái ca") || 
      lowerMsg.includes("lịch học của tôi") ||
      lowerMsg.includes("đơn đã đặt") ||
      lowerMsg.includes("mã ca") ||
      lowerMsg.includes("mã đơn") ||
      lowerMsg.includes("tìm đơn");

    if (isOrderLookupQuery) {
      let foundOrders = [];

      // Extract potential order ID / word from query (e.g. "mã ca 12345" or "đơn ABC")
      const words = message.split(/\s+/);
      let targetDocId = null;
      words.forEach(w => {
        if (w.length >= 5 && /^[a-zA-Z0-9_-]+$/.test(w)) {
          targetDocId = w;
        }
      });

      // Search by specific Document ID first if available
      if (targetDocId) {
        try {
          const docRef = doc(db, "schedules", targetDocId);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            foundOrders.push({ id: docSnap.id, source: "Portal", ...docSnap.data() });
          } else {
            const intDocRef = doc(db, "internal_schedules", targetDocId);
            const intDocSnap = await getDoc(intDocRef);
            if (intDocSnap.exists()) {
              foundOrders.push({ id: intDocSnap.id, source: "Nội bộ", ...intDocSnap.data() });
            }
          }
        } catch (e) {
          console.warn("Lỗi tìm kiếm theo ID:", e.message);
        }
      }

      // If no order by ID, search by userId or userEmail
      if (foundOrders.length === 0 && (userId || userEmail)) {
        try {
          // Query portal schedules
          if (userId) {
            const q1 = query(collection(db, "schedules"), where("userId", "==", userId), limit(5));
            const snap1 = await getDocs(q1);
            snap1.forEach(d => foundOrders.push({ id: d.id, source: "Portal", ...d.data() }));
          }

          // Query internal schedules if user matches studentName or email
          if (foundOrders.length === 0 && userEmail) {
            const q2 = query(collection(db, "internal_schedules"), where("studentEmail", "==", userEmail), limit(5));
            const snap2 = await getDocs(q2);
            snap2.forEach(d => foundOrders.push({ id: d.id, source: "Nội bộ", ...d.data() }));
          }
        } catch (err) {
          console.warn("Lỗi query Firestore AI:", err.message);
        }
      }

      // If user is not logged in and didn't provide order ID
      if (foundOrders.length === 0 && !userId && !userEmail && !targetDocId) {
        return NextResponse.json({
          reply: "Để tra cứu đơn hàng chuẩn xác nhất, bạn vui lòng **[Đăng nhập](/dashboard)** vào tài khoản hoặc dán **Mã đơn ca học** trực tiếp vào ô chat cho tôi nhé! 🔑\n\nVí dụ: *Tra cứu mã đơn abc123xyz*",
          cta: { text: "🔑 Đăng nhập Dashboard", link: "/dashboard" }
        });
      }

      // If no orders found
      if (foundOrders.length === 0) {
        return NextResponse.json({
          reply: `Tôi đã kiểm tra kỹ trên hệ thống nhưng chưa tìm thấy đơn hàng nào khớp với yêu cầu của **${userEmail || 'bạn'}**.\n\nBạn có thể dán Mã đơn hàng hoặc bấm bên dưới để tiến hành tạo đơn đặt lịch học mới nhé! 🚀`,
          cta: { text: "➕ Đặt lịch học hộ mới", link: "/dashboard" }
        });
      }

      // Format rich response
      let replyText = `🎯 **Hệ thống AI đã tìm thấy ${foundOrders.length} ca học liên quan:**\n\n`;

      foundOrders.forEach((s, idx) => {
        const statusEmoji = s.status === "completed" ? "✅ Đã hoàn thành" :
                            s.status === "accepted" ? "🔵 CTV đang trực lớp" :
                            s.status === "in_progress" ? "⏳ Đang học trực tuyến" :
                            s.status === "proof_submitted" ? "📸 Đã nộp minh chứng (Chờ duyệt)" :
                            s.status === "rejected" ? "🚨 Ca đã bị hủy / Hoàn tiền" : "⏳ Hệ thống đang điều CTV...";

        const dateStr = s.classDate ? new Date(s.classDate).toLocaleDateString("vi-VN") : "N/A";
        const priceVal = s.price ? s.price : (s.rentAmount ? `${Number(s.rentAmount).toLocaleString('vi-VN')} đ` : "N/A");

        replyText += `**Ca ${idx + 1}: ${s.className || s.subject || 'Môn học'}** (Mã ca: \`${s.id.slice(0,8)}...\`)\n`;
        replyText += `   • Trường học: **${s.school || 'N/A'}** (${s.room || 'Phòng học'})\n`;
        replyText += `   • Thời gian: **${dateStr}** | **${s.startTime || ''} - ${s.endTime || ''}** (${s.timeSlot || ''})\n`;
        replyText += `   • Trạng thái: **${statusEmoji}**\n`;
        if (s.assignedTo || s.helperName) replyText += `   • CTV phụ trách: **${s.assignedTo || s.helperName}**\n`;
        replyText += `   • Giá thuê: **${priceVal}** (${s.paymentStatus || 'ChưaTT'})\n\n`;
      });

      replyText += `💡 *Bạn có thể xem ảnh minh chứng điểm danh và quản lý chi tiết tại Bảng điều khiển cá nhân.*`;

      return NextResponse.json({
        reply: replyText,
        cta: { text: "🔍 Quản lý ca học chi tiết", link: "/dashboard" }
      });
    }

    // -----------------------------------------------------------------
    // 🤖 2. GỌI GEMINI API CHO CÁC CÂU HỎI PHỨC TẠP
    // -----------------------------------------------------------------
    const apiKey = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY;
    if (apiKey) {
      try {
        const systemInstruction = `Bạn là Trợ lý AI tư vấn hỗ trợ 24/7 chuyên nghiệp nhất của nền tảng "THUEHOCPRO" (Hệ thống Thuê Học Hộ & Trợ Lý Học Tập Uy Tín).
Về dịch vụ:
- Thuê trực lớp, làm bài kiểm tra, thuyết trình, chép slide bài giảng, điểm danh.
- Giá chuẩn: 35.000đ - 50.000đ / giờ trực lớp tiêu chuẩn (150k - 200k / buổi 4-5 tiết).
- Bảo mật: 100% danh tính học viên, mã sinh viên và thời khóa biểu được bảo vệ.
- Ví tiền & Nạp tiền: Nạp VietQR MBBank tự động 24/7. Tiền chỉ chuyển cho CTV khi ca hoàn thành.
- Hủy ca & Hoàn tiền: Hoàn tiền 100% vào ví nếu ca học bị hủy hoặc khiếu nại thành công.
- Hotline Zalo hỗ trợ: 0852866856.
Trả lời lịch sự, thân thiện, dùng icon sinh động, cấu trúc markdown rõ ràng.`;

        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [
              { role: "user", parts: [{ text: `${systemInstruction}\n\nNgười dùng hỏi: ${message}` }] }
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
        console.warn("Lỗi Gemini API, fallback AI logic:", err.message);
      }
    }

    // -----------------------------------------------------------------
    // 💡 3. AI SMART FALLBACK SYSTEM CẬP NHẬT VƯỢT TRỘI
    // -----------------------------------------------------------------
    if (lowerMsg.includes("giá") || lowerMsg.includes("nhiều tiền") || lowerMsg.includes("chi phí") || lowerMsg.includes("bảng giá")) {
      return NextResponse.json({
        reply: "💵 **Bảng Giá Dịch Vụ Thuê Học Hộ Niêm Yết:**\n\n• **Trực lớp tiêu chuẩn**: **35.000 đ - 40.000 đ / giờ** (khoảng 150k - 200k cho ca 4-5 tiết học).\n• **Làm bài kiểm tra / Thuyết trình**: Thêm tiền Tip hỗ trợ tùy chọn khi đặt đơn.\n• **Ghi chép slide bài giảng**: CTV chụp lại toàn bộ bài giảng trên lớp cho bạn.\n\nMọi chi phí đều hiển thị công khai trước khi bạn xác nhận tạo đơn!",
        cta: { text: "📅 Tạo đơn đặt lịch ngay", link: "/dashboard" }
      });
    }

    if (lowerMsg.includes("bảo mật") || lowerMsg.includes("lộ thông tin") || lowerMsg.includes("an toàn")) {
      return NextResponse.json({
        reply: "🛡️ **Cam Kết Bảo Mật Danh Tính 100%:**\n\n1. **Khách Hàng**: Mã sinh viên, tên thật và ảnh của bạn được bảo mật tuyệt đối. CTV chỉ biết trường, phòng học và thời gian ca học.\n2. **Hệ Thống Cloud**: Dữ liệu lưu trên Google Firebase Security Cloud mã hóa 2 chiều.\n3. **Ví An Toàn**: Tiền giữ an toàn trên ví hệ thống, chỉ giải ngân cho CTV khi bạn xác nhận ca hoàn thành!",
        cta: { text: "📖 Điều Khoản Bảo Mật", link: "/dieu-khoan" }
      });
    }

    if (lowerMsg.includes("nạp tiền") || lowerMsg.includes("ví") || lowerMsg.includes("rút tiền")) {
      return NextResponse.json({
        reply: "💳 **Hướng Dẫn Nạp Tiền Ví Tự Động 24/7:**\n\n1. Vào trang **[Bảng Điều Khiển](/dashboard)** -> Thẻ **Ví Tiền**.\n2. Nhập số tiền nạp và bấm **Nạp tiền qua QR**.\n3. Quét mã VietQR chuyển khoản (MBBank). Tiền sẽ nộp vào ví tự động sau 1-3 phút!\n\nHotline hỗ trợ nạp tay Zalo: **0852.866.856**",
        cta: { text: "💳 Đi đến Ví Tiền", link: "/dashboard" }
      });
    }

    if (lowerMsg.includes("hủy") || lowerMsg.includes("hoàn tiền") || lowerMsg.includes("trả lại tiền")) {
      return NextResponse.json({
        reply: "🔄 **Chính Sách Hủy Ca & Hoàn Tiền:**\n\n• **Hoàn tiền 100%** vào ví nếu hủy ca khi chưa có CTV nhận hoặc trước giờ bắt đầu học.\n• Nếu có sự cố (CTV bỏ ca, đi muộn...), Admin xác minh và hoàn tiền 100% ngay lập tức!",
        cta: { text: "📋 Quản lý đơn hàng", link: "/dashboard" }
      });
    }

    if (lowerMsg.includes("ctv") || lowerMsg.includes("làm việc") || lowerMsg.includes("ứng tuyển")) {
      return NextResponse.json({
        reply: "🎓 **Đăng Ký Làm CTV Trực Lớp (Thu Nhập 150k-300k/ca):**\n\nThuê Học Pro liên tục tuyển dụng sinh viên các trường ĐH. Bạn có thể chủ động nhận ca học hỗ trợ bạn bè, rút tiền về ATM bất cứ lúc nào!\n\nBấm nút bên dưới để nộp hồ sơ sinh viên xét duyệt ngay!",
        cta: { text: "✍️ Đi ứng tuyển CTV", link: "/tuyen-ctv" }
      });
    }

    return NextResponse.json({
      reply: `Xin chào! 👋 Tôi là **Trợ lý AI 24/7** của Thuê Học Pro. Tôi luôn sẵn sàng hỗ trợ bạn:\n\n• 🎯 **Tra cứu chi tiết đơn hàng / ca học của bạn**\n• 💵 **Tư vấn bảng giá dịch vụ chuẩn** (35k/giờ)\n• 💳 **Hướng dẫn nạp/rút tiền ví cá nhân tự động**\n• 🛡️ **Chính sách bảo mật danh tính tuyệt đối 100%**\n• 🎓 **Đăng ký làm CTV trực lớp tăng thu nhập**\n\nBạn hãy gõ câu hỏi hoặc dán mã ca học để tôi kiểm tra giúp bạn nhé! 😊`,
      cta: { text: "💬 Chat Zalo Admin 0852866856", link: "https://zalo.me/0852866856" }
    });

  } catch (error) {
    console.error("Lỗi AI Assistant API:", error);
    return NextResponse.json({ 
      reply: "Xin lỗi bạn, hệ thống AI đang nâng cấp trong giây lát. Vui lòng liên hệ trực tiếp Zalo **0852866856** để được Admin hỗ trợ tức thì!",
      cta: { text: "💬 Chat Zalo Admin", link: "https://zalo.me/0852866856" }
    });
  }
}
