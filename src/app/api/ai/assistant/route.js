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
    // 🔒 1. TRA CỨU ĐƠN HÀNG AN TOÀN BẢO MẬT (CHỈ TRA CỨU ĐƠN CỦA CHÍNH MÌNH)
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

      // Extract potential order ID from query (e.g. "mã ca abc123xyz")
      const words = message.split(/\s+/);
      let targetDocId = null;
      words.forEach(w => {
        if (w.length >= 6 && /^[a-zA-Z0-9_-]+$/.test(w)) {
          targetDocId = w;
        }
      });

      // Nếu tra cứu theo Mã đơn cụ thể
      if (targetDocId) {
        try {
          const docRef = doc(db, "schedules", targetDocId);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            const data = docSnap.data();
            // BẢO MẬT TUYỆT ĐỐI: Kiểm tra xem mã đơn này có thuộc về đúng userId / email đang đăng nhập hay không!
            const isOwner = (userId && data.userId === userId) || 
                            (userEmail && (data.userEmail === userEmail || data.email === userEmail || data.studentEmail === userEmail));

            if (isOwner) {
              foundOrders.push({ id: docSnap.id, ...data });
            } else {
              return NextResponse.json({
                reply: "🚫 **Cảnh báo bảo mật:** Mã đơn ca học này thuộc về tài khoản khác. Vì chính sách bảo mật 100% thông tin cá nhân học viên của Thuê Học Pro, bạn chỉ có thể tra cứu đơn hàng do chính tài khoản của bạn đăng ký!",
                options: [
                  { label: "🔍 Xem danh sách ca học của tôi", prompt: "Tôi muốn tra cứu lịch học/ca học gần nhất của tôi" },
                  { label: "📅 Đặt lịch học hộ mới", prompt: "Tạo đơn đặt lịch mới" }
                ],
                cta: { text: "📋 Quản lý đơn tại Dashboard", link: "/dashboard" }
              });
            }
          } else {
            return NextResponse.json({
              reply: "❓ Không tìm thấy mã đơn ca học này trên hệ thống. Bạn vui lòng kiểm tra lại mã đơn hoặc dán chính xác mã đơn ca học của bạn nhé!",
              options: [
                { label: "🔍 Tra cứu tất cả ca học của tôi", prompt: "Tôi muốn tra cứu lịch học/ca học gần nhất của tôi" }
              ]
            });
          }
        } catch (e) {
          console.warn("Lỗi kiểm tra ID mã đơn:", e.message);
        }
      } else {
        // Tra cứu tất cả ca học thuộc về chính tài khoản này từ collection `schedules`
        // LƯU Ý BẢO MẬT: Tuyệt đối KHÔNG tra cứu `internal_schedules` cho khách hàng công khai
        if (!userEmail && !userId) {
          return NextResponse.json({
            reply: "🔑 **Yêu cầu đăng nhập:** Để bảo mật thông tin ca học của bạn, vui lòng **[Đăng nhập](/dashboard)** vào tài khoản hoặc gửi **Mã đơn ca học** của bạn cho tôi nhé!",
            options: [
              { label: "🔑 Đăng nhập Bảng Điều Khiển", prompt: "Mở trang Bảng Điều Khiển" },
              { label: "💵 Xem Bảng giá dịch vụ", prompt: "Bảng giá dịch vụ thuê học hộ là bao nhiêu?" }
            ],
            cta: { text: "🔑 Đăng nhập Bảng Điều Khiển", link: "/dashboard" }
          });
        }

        try {
          let q;
          if (userId) {
            q = query(collection(db, "schedules"), where("userId", "==", userId), limit(5));
          } else if (userEmail) {
            q = query(collection(db, "schedules"), where("userEmail", "==", userEmail), limit(5));
          }

          if (q) {
            const snap = await getDocs(q);
            snap.forEach(d => foundOrders.push({ id: d.id, ...d.data() }));
          }
        } catch (err) {
          console.warn("Lỗi query Firestore AI:", err.message);
        }
      }

      if (foundOrders.length === 0) {
        return NextResponse.json({
          reply: `Xin chào! Hệ thống đã kiểm tra nhưng chưa tìm thấy ca học nào đăng ký bằng tài khoản **${userEmail || 'của bạn'}**.\n\nBạn có thể chọn thao tác bên dưới để tạo đơn học hộ mới nhé! 🚀`,
          options: [
            { label: "➕ Đặt lịch học hộ mới ngay", prompt: "Tôi muốn đặt lịch học hộ mới" },
            { label: "💵 Bảng giá dịch vụ", prompt: "Bảng giá dịch vụ thuê học hộ là bao nhiêu?" }
          ],
          cta: { text: "➕ Đặt lịch học hộ ngay", link: "/dashboard" }
        });
      }

      // Tra cứu thành công - Trả về dữ liệu kèm các Nút Chọn Tương Tác
      let replyText = `📋 **Danh sách ca học của bạn (${foundOrders.length} ca gần nhất):**\n\n`;

      foundOrders.forEach((s, idx) => {
        const statusEmoji = s.status === "completed" ? "✅ Đã hoàn thành" :
                            s.status === "accepted" ? "🔵 CTV đang trực lớp" :
                            s.status === "in_progress" ? "⏳ Đang diễn ra" :
                            s.status === "proof_submitted" ? "📸 Đã nộp minh chứng (Chờ duyệt)" :
                            s.status === "rejected" ? "🚨 Ca đã bị hủy / Hoàn tiền" : "⏳ Hệ thống đang điều CTV...";

        const dateStr = s.classDate ? new Date(s.classDate).toLocaleDateString("vi-VN") : "N/A";
        const priceVal = s.price ? s.price : (s.rentAmount ? `${Number(s.rentAmount).toLocaleString('vi-VN')} đ` : "N/A");

        replyText += `**Ca ${idx + 1}: ${s.className || s.subject || 'Môn học'}**\n`;
        replyText += `   • Mã ca: \`${s.id}\`\n`;
        replyText += `   • Ngày học: **${dateStr}** (${s.startTime || ''} - ${s.endTime || ''})\n`;
        replyText += `   • Trạng thái: **${statusEmoji}**\n`;
        if (s.assignedTo) replyText += `   • CTV phụ trách: **${s.assignedTo}**\n`;
        replyText += `   • Chi phí: **${priceVal}**\n\n`;
      });

      return NextResponse.json({
        reply: replyText,
        options: [
          { label: "🔍 Quản lý minh chứng ảnh tại Dashboard", prompt: "Mở trang Dashboard cá nhân" },
          { label: "💳 Nạp tiền vào ví cá nhân", prompt: "Cách nạp tiền tự động vào ví như thế nào?" }
        ],
        cta: { text: "🔍 Quản lý ca học tại Dashboard", link: "/dashboard" }
      });
    }

    // -----------------------------------------------------------------
    // 💡 2. CÂU TRẢ LỜI VỚI CÁC Ô NÚT BẤM TRỰC TIẾP (INTERACTIVE BUTTON OPTIONS)
    // -----------------------------------------------------------------
    if (lowerMsg.includes("giá") || lowerMsg.includes("bảng giá") || lowerMsg.includes("chi phí")) {
      return NextResponse.json({
        reply: "💵 **Bảng Giá Dịch Vụ Thuê Học Hộ Niêm Yết:**\n\n• **Trực lớp tiêu chuẩn**: **35.000 đ - 40.000 đ / giờ** (khoảng 150k - 200k cho ca 4-5 tiết học).\n• **Làm bài kiểm tra / Thuyết trình**: Thêm tiền Tip hỗ trợ tùy chọn khi đặt đơn.\n• **Ghi chép slide bài giảng**: CTV chụp lại toàn bộ bài giảng trên lớp cho bạn.\n\nNhấp chọn thao tác bên dưới để thực hiện:",
        options: [
          { label: "📅 Đặt lịch học hộ ngay", prompt: "Tôi muốn đặt lịch học hộ mới" },
          { label: "💳 Hướng dẫn nạp tiền ví", prompt: "Cách nạp tiền tự động vào ví như thế nào?" },
          { label: "🛡️ Chính sách bảo mật 100%", prompt: "Chính sách bảo mật thông tin học viên ra sao?" }
        ],
        cta: { text: "📅 Tạo đơn đặt lịch ngay", link: "/dashboard" }
      });
    }

    if (lowerMsg.includes("bảo mật") || lowerMsg.includes("lộ thông tin") || lowerMsg.includes("an toàn")) {
      return NextResponse.json({
        reply: "🛡️ **Cam Kết Bảo Mật Danh Tính 100%:**\n\n1. **Khách Hàng**: Mã sinh viên, tên thật và ảnh của bạn được bảo mật tuyệt đối. CTV chỉ biết trường, phòng học và thời gian ca học.\n2. **Hệ Thống Cloud**: Dữ liệu lưu trên Google Firebase Security Cloud mã hóa 2 chiều.\n3. **Ví An Toàn**: Tiền giữ an toàn trên ví hệ thống, chỉ giải ngân cho CTV khi bạn xác nhận ca hoàn thành!",
        options: [
          { label: "📖 Đọc Điều Khoản Bảo Mật", prompt: "Tôi muốn đọc điều khoản bảo mật" },
          { label: "📅 Đặt lịch học hộ ngay", prompt: "Tôi muốn đặt lịch học hộ mới" }
        ],
        cta: { text: "📖 Điều Khoản Bảo Mật", link: "/dieu-khoan" }
      });
    }

    if (lowerMsg.includes("nạp tiền") || lowerMsg.includes("ví") || lowerMsg.includes("rút tiền")) {
      return NextResponse.json({
        reply: "💳 **Hướng Dẫn Nạp Tiền Ví Tự Động 24/7:**\n\n1. Vào trang **[Bảng Điều Khiển](/dashboard)** -> Thẻ **Ví Tiền**.\n2. Nhập số tiền nạp và bấm **Nạp tiền qua QR**.\n3. Quét mã VietQR chuyển khoản (MBBank). Tiền sẽ nộp vào ví tự động sau 1-3 phút!\n\nHotline hỗ trợ nạp tay Zalo: **0852.866.856**",
        options: [
          { label: "💳 Mở Ví Tiền Cá Nhân", prompt: "Tôi muốn xem ví tiền cá nhân" },
          { label: "💬 Chat Zalo Admin 0852866856", prompt: "Liên hệ Zalo Admin" }
        ],
        cta: { text: "💳 Đi đến Ví Tiền", link: "/dashboard" }
      });
    }

    if (lowerMsg.includes("ctv") || lowerMsg.includes("làm việc") || lowerMsg.includes("ứng tuyển")) {
      return NextResponse.json({
        reply: "🎓 **Đăng Ký Làm CTV Trực Lớp (Thu Nhập 150k-300k/ca):**\n\nThuê Học Pro liên tục tuyển dụng sinh viên các trường ĐH. Bạn có thể chủ động nhận ca học hỗ trợ bạn bè, rút tiền về ATM bất cứ lúc nào!\n\nBấm nút bên dưới để nộp hồ sơ sinh viên xét duyệt ngay!",
        options: [
          { label: "✍️ Ứng tuyển CTV ngay", prompt: "Tôi muốn ứng tuyển làm CTV" },
          { label: "💵 Bảng giá dịch vụ", prompt: "Bảng giá dịch vụ thuê học hộ là bao nhiêu?" }
        ],
        cta: { text: "✍️ Đi ứng tuyển CTV", link: "/tuyen-ctv" }
      });
    }

    // Default response with interactive option buttons
    return NextResponse.json({
      reply: `Xin chào! 👋 Tôi là **Trợ lý AI 24/7** của Thuê Học Pro. Bạn vui lòng nhấp chọn trực tiếp vào một trong các tùy chọn bên dưới để tôi hỗ trợ bạn ngay nhé:`,
      options: [
        { label: "🎯 Tra cứu ca học của tôi", prompt: "Tôi muốn tra cứu lịch học/ca học gần nhất của tôi" },
        { label: "💵 Bảng giá dịch vụ (35k/giờ)", prompt: "Bảng giá dịch vụ thuê học hộ là bao nhiêu?" },
        { label: "💳 Hướng dẫn nạp/rút tiền ví", prompt: "Cách nạp tiền tự động vào ví như thế nào?" },
        { label: "🛡️ Chính sách bảo mật 100%", prompt: "Chính sách bảo mật thông tin học viên ra sao?" },
        { label: "🎓 Đăng ký làm CTV trực lớp", prompt: "Muốn ứng tuyển làm CTV trực lớp thì làm thế nào?" }
      ]
    });

  } catch (error) {
    console.error("Lỗi AI Assistant API:", error);
    return NextResponse.json({ 
      reply: "Xin lỗi bạn, hệ thống AI đang nâng cấp trong giây lát. Vui lòng liên hệ trực tiếp Zalo **0852866856** để được Admin hỗ trợ tức thì!",
      cta: { text: "💬 Chat Zalo Admin", link: "https://zalo.me/0852866856" }
    });
  }
}
