import { escapeHtml } from "./webText.js";
export function printerCapabilities({userAgent="",maxTouchPoints=0,usb=false,secure=true}={}) {
 const ios=/iPad|iPhone|iPod/i.test(userAgent)||(/Macintosh/i.test(userAgent)&&maxTouchPoints>1);
 const android=/Android/i.test(userAgent);
 return {ios,android,mobile:ios||android,usb:secure&&usb&&!ios&&!android&&/Chrome|Chromium|Edg/i.test(userAgent)};
}
export function passPrntReceiptHtml(sale={},store={},documentType="receipt") {
 const text=value=>escapeHtml(String(value??""));
 const amount=value=>`¥${Math.round(Number(value)||0).toLocaleString("ja-JP")}`;
 const rows=(sale.lines||[]).map(item=>`<tr><td>${text(item.name)} × ${text(item.quantity||1)}</td><td class="money">${amount(Number(item.unitPrice||0)*Number(item.quantity||1)-Number(item.discountValue||0))}</td></tr>`).join("");
 return `<!doctype html><html><head><meta charset="utf-8"><style>body{width:360px;margin:0;padding:12px;font-family:sans-serif;color:#000;font-size:16px}h1{font-size:22px;text-align:center}h2{text-align:center;font-size:20px}p{white-space:pre-wrap;word-break:break-word}table{width:100%;border-collapse:collapse}td{padding:6px 0;vertical-align:top}.money{text-align:right;white-space:nowrap}.total{font-size:22px;font-weight:bold;border-top:1px solid #000}small{font-size:12px}</style></head><body><h1>${text(store.salonName||"Mai Beauty Salon")}</h1><p>${text(store.address||"")}<br>${text(store.phone||"")}</p><h2>${documentType==="ryoshusho"?"領収書":"レシート"}</h2><p>${text(sale.orderNumber||sale.receiptNumber||"POS")}<br>${text(new Date(sale.issuedAt||Date.now()).toLocaleString("ja-JP"))}</p><table>${rows}<tr class="total"><td>合計</td><td class="money">${amount(sale.total)}</td></tr><tr><td>お支払い</td><td class="money">${amount(sale.paid)}</td></tr><tr><td>お釣り</td><td class="money">${amount(sale.change)}</td></tr></table><p>${text(sale.paymentMethodText||"")}</p><p>Thank you / ありがとうございました</p></body></html>`;
}
export function passPrntUrl(html, returnUrl, openDrawer=false) {
 const back=new URL(returnUrl);if(!['https:','http:'].includes(back.protocol))throw Error("Địa chỉ quay lại không hợp lệ");
 // Do not copy login/assignment tokens into another app's callback URL.
 const callback=back.origin+back.pathname;
 const encode=value=>encodeURIComponent(value).replace(/[!'()*]/g,char=>'%'+char.charCodeAt(0).toString(16).toUpperCase());
 const query={back:callback,html,size:'384',drawer:openDrawer?'after':'off',popup:'enable'};
 const url='starpassprnt://v1/print/nopreview?'+Object.entries(query).map(([key,value])=>`${key}=${encode(String(value))}`).join('&');
 if(url.length>250000)throw Error("Hóa đơn quá dài để chuyển sang ứng dụng in. Hãy dùng máy tính hoặc in hệ thống.");
 return url;
}
export function printCallback(url) {
 const params=new URL(url).searchParams;const code=params.get('passprnt_code');if(code===null)return null;
 return {ok:code==='0',code,message:code==='0'?'Star PassPRNT báo in thành công.':`Star PassPRNT báo lỗi ${code}. Kiểm tra máy in đã bật, giấy và kết nối trong ứng dụng Star.`};
}
