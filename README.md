# MAI Nail

Ứng dụng quản lý salon nail với POS, đặt lịch, sản phẩm và hóa đơn tiếng Nhật.

## Tính năng

- Quản lý lịch hẹn, khách hàng, nhân viên và dịch vụ.
- POS cho dịch vụ và sản phẩm.
- Thanh toán tiền mặt, thẻ, QR và chuyển khoản.
- In hóa đơn/領収書 theo bố cục tiếng Nhật.
- Tính giảm giá, thuế, tiền khách đưa và tiền thừa.
- Quản lý kho sản phẩm và đơn hàng online.
- Báo cáo doanh thu và lịch sử thanh toán.

## Công nghệ

- Next.js
- React
- Supabase
- Star mPOP WebUSB (tùy chọn)

## Cài đặt

```bash
npm install
npm run dev
```

Mở [http://localhost:3000](http://localhost:3000) trong trình duyệt.

## Build production

```bash
npm run build
npm run start
```

## Lưu ý

- Thiết lập thông tin salon, thuế và phương thức thanh toán trong phần Cài đặt.
- Hóa đơn in ra sử dụng nhãn tiếng Nhật, độc lập với ngôn ngữ giao diện.
- Kết nối Star mPOP cần trình duyệt hỗ trợ WebUSB, chẳng hạn Chrome hoặc Edge.
