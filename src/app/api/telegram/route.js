import { NextResponse } from 'next/server';
import { db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";

export async function POST(request) {
  try {
    const { text } = await request.json();

    if (!text) {
      return NextResponse.json({ error: 'Missing message text' }, { status: 400 });
    }

    // Xác minh danh tính người gọi API để tránh bị spam/tấn công
    const authHeader = request.headers.get("authorization");
    const clientKey = request.headers.get("x-public-client-key");
    let isAuthorized = false;

    if (clientKey === "THUEHOCPRO_PUBLIC_ALERT_2026") {
      isAuthorized = true;
    } else if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.split("Bearer ")[1];
      const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyB3R7ar7W3BXIKmcGo0Zc4U5oOUl4mg44c";
      try {
        const validationRes = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ idToken: token })
        });
        if (validationRes.ok) {
          isAuthorized = true;
        }
      } catch (err) {
        console.warn("Lỗi xác minh token trên máy chủ:", err.message);
      }
    }

    if (!isAuthorized) {
      return NextResponse.json({ error: "Unauthorized access blocked by Web Security System" }, { status: 401 });
    }

    // Đọc từ biến môi trường (Khuyến nghị - Bảo mật tuyệt đối)
    let token = process.env.TELEGRAM_BOT_TOKEN;
    let chatId = process.env.TELEGRAM_CHAT_ID;

    // Dự phòng: Đọc từ Firestore settings/system
    if (!token || !chatId) {
      try {
        const docSnap = await getDoc(doc(db, "settings", "system"));
        if (docSnap.exists()) {
          const data = docSnap.data();
          token = token || data.telegramBotToken;
          chatId = chatId || data.telegramChatId;
        }
      } catch (err) {
        console.warn("Không thể đọc cấu hình Telegram từ Firestore (được coi là bình thường nếu luật bảo mật đang bật):", err.message);
      }
    }

    // Giá trị mặc định dự phòng tối cao nếu cả môi trường lẫn Firestore đều không lấy được (do lỗi phân quyền)
    if (!token || !chatId) {
      token = token || "8987058324:AAGROX1cy0wWbausiuTKLYQ70AUoyiLEt4Q";
      chatId = chatId || "5484109031";
    }

    if (!token || !chatId) {
      console.error("Lỗi: Token hoặc Chat ID chưa được cấu hình trên môi trường máy chủ.");
      return NextResponse.json({ error: 'Telegram credentials are not configured on the server' }, { status: 500 });
    }

    const telegramUrl = `https://api.telegram.org/bot${token}/sendMessage`;
    const response = await fetch(telegramUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        chat_id: chatId,
        text: text,
        parse_mode: "HTML"
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Lỗi từ Telegram API:", errorText);
      return NextResponse.json({ error: errorText }, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error("Lỗi hệ thống trong API Telegram:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
