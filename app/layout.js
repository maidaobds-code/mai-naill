import "./globals.css";

export const metadata = {
  title: "Nail Japan",
  description: "All-in-one salon management for Japan",
};

export default function RootLayout({ children }) {
  return (
    <html lang="vi">
      <body>{children}</body>
    </html>
  );
}
