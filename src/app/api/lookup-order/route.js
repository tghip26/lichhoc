import { NextResponse } from "next/server";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs } from "firebase/firestore";

export async function POST(req) {
  try {
    const { keyword } = await req.json();
    if (!keyword || !keyword.trim()) {
      return NextResponse.json({ success: false, message: "Vui lòng nhập mã đơn hoặc SĐT tra cứu." }, { status: 400 });
    }

    const term = keyword.trim();
    const ordersRef = collection(db, "orders");
    let results = [];

    // Search by ID exact match
    if (term.length > 5) {
      try {
        const qId = query(ordersRef, where("__name__", "==", term));
        const snapId = await getDocs(qId);
        snapId.forEach(doc => {
          results.push({ id: doc.id, ...doc.data() });
        });
      } catch (err) {
        console.error(err);
      }
    }

    // Search by Phone
    if (results.length === 0) {
      const qPhone = query(ordersRef, where("phone", "==", term));
      const snapPhone = await getDocs(qPhone);
      snapPhone.forEach(doc => {
        results.push({ id: doc.id, ...doc.data() });
      });
    }

    // Search by user search term if empty
    if (results.length === 0) {
      const snapAll = await getDocs(ordersRef);
      snapAll.forEach(doc => {
        const d = doc.data();
        if (
          doc.id.toLowerCase().includes(term.toLowerCase()) ||
          (d.subject && d.subject.toLowerCase().includes(term.toLowerCase())) ||
          (d.phone && d.phone.includes(term))
        ) {
          results.push({ id: doc.id, ...d });
        }
      });
    }

    if (results.length === 0) {
      return NextResponse.json({ success: false, message: "Không tìm thấy đơn hàng tương ứng." });
    }

    // Sanitize results for security (mask sensitive student details)
    const sanitized = results.map(item => ({
      id: item.id,
      subject: item.subject || "Lịch học",
      sessionsCount: item.sessionsCount || 1,
      status: item.status || "pending",
      officialPrice: item.officialPrice || item.price || 0,
      paymentStatus: item.paymentStatus || "Chưa thanh toán",
      createdAt: item.createdAt ? item.createdAt.toDate().toLocaleDateString("vi-VN") : "Gần đây"
    }));

    return NextResponse.json({ success: true, orders: sanitized.slice(0, 5) });
  } catch (err) {
    console.error("Lỗi API tra cứu đơn:", err);
    return NextResponse.json({ success: false, message: "Lỗi hệ thống tra cứu." }, { status: 500 });
  }
}
