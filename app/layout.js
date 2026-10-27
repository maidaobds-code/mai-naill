import "./globals.css";
import DynamicFavicon from "../components/DynamicFavicon";

export const metadata = {
  title: "Mai Beauty Salon",
  description: "All-in-one beauty salon management",
};

export default function RootLayout({ children }) {
  return (
    <html lang="vi">
      <body>{children}<DynamicFavicon /></body>
    </html>
  );
}
