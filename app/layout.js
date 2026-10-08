import "./globals.css";

export const metadata = {
  title: "Mai Beauty Salon",
  description: "All-in-one beauty salon management",
};

export default function RootLayout({ children }) {
  return (
    <html lang="vi">
      <body>{children}</body>
    </html>
  );
}
