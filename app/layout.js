import "./globals.css";
import DynamicFavicon from "../components/DynamicFavicon";

export const metadata = {
  title: "Mai Beauty Salon",
  description: "All-in-one beauty salon management",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Mai Beauty Salon",
    statusBarStyle: "default",
  },
  formatDetection: { telephone: false },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  userScalable: true,
};

export default function RootLayout({ children }) {
  return (
    <html lang="vi">
      <body>{children}<DynamicFavicon /></body>
    </html>
  );
}
