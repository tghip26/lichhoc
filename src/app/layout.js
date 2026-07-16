import { Geist, Geist_Mono, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import ToastProvider from "@/components/ToastProvider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const plusJakartaSans = Plus_Jakarta_Sans({
  variable: "--font-plus-jakarta",
  subsets: ["latin"],
});

export const metadata = {
  title: "Thuê Học Pro - Hệ thống đặt lịch học hộ, trực lớp chuyên nghiệp",
  description: "Hệ thống quản lý đặt lịch học hộ, trực lớp trực tuyến chuyên nghiệp, uy tín và bảo mật tuyệt đối.",
  openGraph: {
    title: "Thuê Học Pro - Hệ thống đặt lịch học hộ chuyên nghiệp",
    description: "Hệ thống quản lý đặt lịch học hộ, trực lớp trực tuyến chuyên nghiệp, uy tín và bảo mật tuyệt đối.",
    type: "website",
  }
};

export default function RootLayout({ children }) {
  return (
    <html lang="vi" className={`${geistSans.variable} ${geistMono.variable} ${plusJakartaSans.variable}`}>
      <body>
        <AuthProvider>
          <ToastProvider />
          <Navbar />
          <main className="container" style={{ minHeight: "calc(100vh - 350px)" }}>{children}</main>
          <Footer />
        </AuthProvider>
      </body>
    </html>
  );
}
