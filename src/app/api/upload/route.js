import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const { fileBase64, fileName, token } = await request.json();

    if (!fileBase64 || !fileName || !token) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Tách phần header của chuỗi Base64
    const base64Data = fileBase64.replace(/^data:image\/\w+;base64,/, "");
    const buffer = Buffer.from(base64Data, 'base64');

    const bucket = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "lichhoc-e15b6.firebasestorage.app";
    // Đường dẫn phải được encode, vd: schedules/abc.jpg -> schedules%2Fabc.jpg
    const encodedPath = encodeURIComponent(`schedules/${fileName}`);
    const uploadUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket}/o?name=${encodedPath}`;

    // Server-to-Server call: Bỏ qua hoàn toàn lỗi CORS của trình duyệt!
    const response = await fetch(uploadUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'image/jpeg'
      },
      body: buffer
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Firebase Storage API Error:", errorText);
      return NextResponse.json({ error: errorText }, { status: response.status });
    }

    const data = await response.json();
    
    // Lấy token tải xuống để tạo Link ảnh công khai
    const downloadToken = data.downloadTokens;
    const downloadURL = `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/${encodedPath}?alt=media&token=${downloadToken}`;

    return NextResponse.json({ url: downloadURL });
  } catch (error) {
    console.error("Internal Server Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
