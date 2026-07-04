import { Geist, Geist_Mono } from "next/font/google";
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

export const metadata = {
  title: "Quản lý Thuê Học",
  description: "Hệ thống quản lý lịch thuê học chuyên nghiệp",
};

export default function RootLayout({ children }) {
  return (
    <html lang="vi" className={`${geistSans.variable} ${geistMono.variable}`}>
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
