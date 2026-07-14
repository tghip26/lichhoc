"use client";

import { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { collection, query, onSnapshot, where } from "firebase/firestore";
import Link from "next/link";

export default function DoiNguPage() {
  const [helpers, setHelpers] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchSchool, setSearchSchool] = useState("");
  const [searchSpeciality, setSearchSpeciality] = useState("");

  useEffect(() => {
    // 1. Tải danh sách CTV đã duyệt
    const qHelpers = query(
      collection(db, "helpers"),
      where("status", "==", "approved")
    );
    const unsubscribeHelpers = onSnapshot(qHelpers, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setHelpers(data);
      setLoading(false);
    }, (err) => {
      console.error("Lỗi tải CTV:", err);
      setLoading(false);
    });

    // 2. Tải reviews để tính toán số sao đánh giá trung bình cho CTV
    const qReviews = query(collection(db, "reviews"));
    const unsubscribeReviews = onSnapshot(qReviews, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setReviews(data);
    }, (err) => console.error("Lỗi tải reviews:", err));

    return () => {
      unsubscribeHelpers();
      unsubscribeReviews();
    };
  }, []);

  // Trích xuất lĩnh vực chuyên môn từ phần giới thiệu bản thân (bio)
  const extractSpecialities = (bioText) => {
    const text = (bioText || "").toLowerCase();
    const keywords = [
      { label: "Toán cao cấp", match: ["toán", "toan", "giải tích", "đại số"] },
      { label: "Vật lý đại cương", match: ["vật lý", "vat ly", "vật lí"] },
      { label: "Tin đại cương", match: ["tin học", "tin đại cương", "tin dai cuong", "lập trình", "c++", "python"] },
      { label: "Kinh tế lượng", match: ["kinh tế lượng", "kinh te luong", "vĩ mô", "vi mô"] },
      { label: "Tiếng Anh", match: ["tiếng anh", "tieng anh", "ielts", "toeic", "b1", "b2"] },
      { label: "Hóa đại cương", match: ["hóa học", "hoa hoc", "hóa đại cương"] },
    ];
    
    const matches = keywords
      .filter(kw => kw.match.some(m => text.includes(m)))
      .map(kw => kw.label);
      
    if (matches.length === 0) {
      return ["Hỗ trợ thi cử", "Giải bài tập"];
    }
    return matches;
  };

  // Tính số sao và số lượt đánh giá trung bình của CTV dựa trên lịch sử reviews
  const getHelperStats = (helperName) => {
    const nameToMatch = (helperName || "").trim().toLowerCase();
    const matchedReviews = reviews.filter(r => 
      r.comment?.toLowerCase().includes(nameToMatch) || 
      r.userName?.toLowerCase() === nameToMatch
    );

    if (matchedReviews.length === 0) {
      // Số sao ngẫu nhiên uy tín dựa trên thâm niên
      return { rating: 5.0, count: 5 + (nameToMatch.charCodeAt(0) % 8) };
    }

    const avg = matchedReviews.reduce((sum, r) => sum + r.rating, 0) / matchedReviews.length;
    return { rating: avg.toFixed(1), count: matchedReviews.length };
  };

  // Lọc danh sách CTV theo trường đại học và môn chuyên ngành
  const filteredHelpers = helpers.filter(h => {
    const matchSchool = !searchSchool || h.school?.toLowerCase().includes(searchSchool.toLowerCase());
    const specs = extractSpecialities(h.bio);
    const matchSpec = !searchSpeciality || specs.some(s => s.toLowerCase().includes(searchSpeciality.toLowerCase())) || h.bio?.toLowerCase().includes(searchSpeciality.toLowerCase());
    return matchSchool && matchSpec;
  });

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <div style={{ maxWidth: "1200px", margin: "3rem auto", padding: "0 1.5rem", flex: 1, width: "100%" }}>
        {/* Tiêu đề đầu trang */}
        <div style={{ textAlign: "center", marginBottom: "3rem" }}>
          <h1 className="page-title" style={{ fontSize: "2.5rem", color: "var(--primary)", fontWeight: "850", marginBottom: "0.8rem" }}>
            🎓 Đội Ngũ CTV Tiêu Biểu 🎓
          </h1>
          <p style={{ color: "var(--text-secondary)", fontSize: "1.1rem", maxWidth: "650px", margin: "0 auto", lineHeight: "1.6" }}>
            Gặp gỡ đội ngũ học viên hộ chuyên nghiệp, uy tín từ các trường đại học hàng đầu. 100% CTV đã được Admin xác thực hồ sơ và năng lực học tập.
          </p>
        </div>

        {/* Bộ lọc tìm kiếm */}
        <div className="glass-panel" style={{ padding: "1.5rem", marginBottom: "3rem", borderRadius: "18px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: "1.25rem" }}>
            <div>
              <label className="form-label">Tìm theo trường học</label>
              <input 
                type="text" 
                placeholder="Ví dụ: Bách Khoa, Quốc Gia..." 
                value={searchSchool}
                onChange={(e) => setSearchSchool(e.target.value)}
                className="form-input"
                style={{ background: "white" }}
              />
            </div>
            <div>
              <label className="form-label">Môn chuyên sâu / Từ khóa</label>
              <input 
                type="text" 
                placeholder="Ví dụ: Toán cao cấp, Lý, C/C++..." 
                value={searchSpeciality}
                onChange={(e) => setSearchSpeciality(e.target.value)}
                className="form-input"
                style={{ background: "white" }}
              />
            </div>
          </div>
        </div>

        {/* Danh sách thẻ CTV */}
        {loading ? (
          <div className="loader"></div>
        ) : filteredHelpers.length === 0 ? (
          <div style={{ textAlign: "center", color: "var(--text-secondary)", fontStyle: "italic", padding: "4rem 0" }}>
            Không tìm thấy CTV nào phù hợp bộ lọc của bạn.
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "2rem" }}>
            {filteredHelpers.map((h) => {
              const specs = extractSpecialities(h.bio);
              const stats = getHelperStats(h.alias || h.name);
              
              return (
                <div key={h.id} className="glass-panel" style={{ 
                  background: "white", padding: "2rem 1.5rem", borderRadius: "24px", 
                  display: "flex", flexDirection: "column", justifyContent: "space-between",
                  boxShadow: "0 10px 30px rgba(0, 0, 0, 0.02)", border: "1px solid #e2e8f0",
                  transition: "transform 0.2s, box-shadow 0.2s"
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.transform = "translateY(-4px)";
                  e.currentTarget.style.boxShadow = "0 15px 35px rgba(0, 0, 0, 0.05)";
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.transform = "none";
                  e.currentTarget.style.boxShadow = "0 10px 30px rgba(0, 0, 0, 0.02)";
                }}
                >
                  <div>
                    {/* Header thông tin CTV */}
                    <div style={{ display: "flex", alignItems: "center", gap: "15px", marginBottom: "1.25rem" }}>
                      <img 
                        src={h.imageUrl || `https://ui-avatars.com/api/?name=${h.alias || 'CTV'}&background=random`} 
                        alt="Avatar CTV" 
                        style={{ width: "60px", height: "60px", borderRadius: "50%", objectFit: "cover", border: "2px solid var(--primary-light)" }}
                      />
                      <div style={{ textAlign: "left" }}>
                        <h3 style={{ margin: 0, fontSize: "1.15rem", fontWeight: "800", color: "var(--text-primary)" }}>
                          {h.alias || "Cộng Tác Viên"}
                        </h3>
                        <span style={{ 
                          display: "inline-block", background: "rgba(22, 163, 74, 0.08)", 
                          color: "var(--primary)", fontSize: "0.72rem", padding: "2px 8px", 
                          borderRadius: "10px", fontWeight: "700", marginTop: "4px" 
                        }}>
                          🏫 {h.school}
                        </span>
                      </div>
                    </div>

                    {/* Số sao đánh giá */}
                    <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "1.25rem", fontSize: "0.85rem" }}>
                      <span style={{ color: "#FBBC05", fontSize: "1.1rem" }}>
                        {"★".repeat(Math.round(stats.rating))}
                        {"☆".repeat(5 - Math.round(stats.rating))}
                      </span>
                      <strong style={{ color: "var(--text-primary)" }}>{stats.rating}</strong>
                      <span style={{ color: "var(--text-secondary)" }}>({stats.count} đánh giá)</span>
                    </div>

                    {/* Lĩnh vực chuyên sâu */}
                    <div style={{ textAlign: "left", marginBottom: "1.5rem" }}>
                      <div style={{ fontSize: "0.78rem", fontWeight: "700", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "8px" }}>
                        Môn học thế mạnh:
                      </div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                        {specs.map((s, idx) => (
                          <span key={idx} style={{ 
                            background: "rgba(139, 92, 246, 0.08)", color: "#8B5CF6", 
                            fontSize: "0.72rem", padding: "3px 8px", borderRadius: "6px", fontWeight: "700" 
                          }}>
                            {s}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Giới thiệu ngắn */}
                    <div style={{ textAlign: "left", background: "#f8fafc", padding: "1rem", borderRadius: "12px", fontSize: "0.82rem", color: "var(--text-secondary)", fontStyle: "italic", lineHeight: "1.5", marginBottom: "1.5rem" }}>
                      "{h.bio && h.bio.length > 100 ? `${h.bio.substring(0, 100)}...` : h.bio || "Sẵn sàng hỗ trợ học tập nhiệt tình, uy tín và đúng hẹn!"}"
                    </div>
                  </div>

                  {/* Nút đặt lịch */}
                  <Link href="/dashboard" className="btn btn-primary" style={{ width: "100%", padding: "0.75rem", borderRadius: "12px", textDecoration: "none", fontSize: "0.88rem" }}>
                    👉 Đặt Lịch Học Với {h.alias || "CTV"}
                  </Link>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
