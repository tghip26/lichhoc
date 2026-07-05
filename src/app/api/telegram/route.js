import { NextResponse } from 'next/server';
import { db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";

export async function POST(request) {
  try {
    const { text } = await request.json();

    if (!text) {
      return NextResponse.json({ error: 'Missing message text' }, { status: 400 });
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
