export const bookingGroups = [
  { id: 'hand', ja: 'ハンドネイル', vi: 'Nail tay', en: 'Hand nails', mark: '01' },
  { id: 'tip', ja: 'チップ（長さ出し）ネイル', vi: 'Nối móng tip', en: 'Tip extensions', mark: '02' },
  { id: 'sculpt', ja: 'スカルプ（長さ出し）ネイル', vi: 'Đắp bột / nối sculpt', en: 'Sculpted extensions', mark: '03' },
  { id: 'foot', ja: 'フットネイル', vi: 'Nail chân', en: 'Foot nails', mark: '04' },
  { id: 'removal', ja: 'オフのみ', vi: 'Tháo móng', en: 'Removal only', mark: '05' },
  { id: 'repair', ja: 'お直し（リペア）', vi: 'Sửa móng', en: 'Repair', mark: '06' },
  { id: 'model', ja: 'モデルさん募集', vi: 'Dịch vụ mẫu', en: 'Model appointments', mark: '07' },
];
const rows = [
 ['hand','クリアネイル【メンズOK】',3900,60],
 ['hand','ワンカラー【メンズOK】',4280,60],
 ['hand','【人気キラキラ】◆マグネットorフラッシュネイル',5280,75],
 ['hand','【学割☆必見】アートシンプル・パーツ両手2個',7680,90],
 ['hand','【アートシンプル】持込◎',7580,90],
 ['hand','【持ち込み◎】アートシンプル・パーツつけ放題',8980,120],
 ['hand','【持ち込み◎】アートやり放題・つけ放題',9980,120],
 ['tip','【チップ長さ出し10本】ワンカラー',7180,120],
 ['tip','【チップ長さ出し10本】マグネットorフラッシュ',7980,120],
 ['tip','【チップ長さ出し10本】アートシンプル・持込み◎',8980,150],
 ['tip','【チップ長さ出し10本】アートシンプル・パーツ2個',9580,150],
 ['tip','【チップ長さ出し10本】シンプル・パーツつけ放題',10980,150],
 ['tip','【チップ長さ出し10本】アート／パーツつけ放題（持ち込み可）',12980,180],
 ['sculpt','【スカルプ長さ出し】スカルプ長さ出し ワンカラー',8280,120],
 ['sculpt','【スカルプ長さ出し10本】マグネットorフラッシュ',8980,150],
 ['sculpt','【スカルプ長さ出し10本】アートシンプル・パーツ2個無料',11980,150],
 ['sculpt','【スカルプ長さ出し】アートやり放題・パーツつけ放題',14980,180],
 ['foot','【今だけセット】Hand・Foot ♪ ハンドフットワンカラー',9000,120],
 ['foot','【Footワンカラー】',5000,60],
 ['foot','【Foot】マグネット・フラッシュ',5980,75],
 ['foot','【Foot】親指デザイン',6980,90],
 ['foot','【Foot】アートシンプル',7580,90],
 ['foot','【Foot】アートやり放題・つけ放題',7980,120],
 ['removal','フットオフのみ',3500,45],
 ['removal','ハンドオフのみ',3300,45],
 ['removal','チップ長さ出しオフのみ',3800,60],
 ['removal','スカルプ、ハードジェルオフのみ',4200,60],
 ['repair','【お直し（リペア）】当店施術のみ',1000,30],
 ['model','【モデルさん募集】【チップ長さ出し10本】やり放題コース（持ち込み可）',8580,180],
];
export const referenceServices = rows.map(([category, name, price, duration], index) => ({ id: `mai-menu-${index+1}`, category, name, price, duration, estimatedDuration: true, staff: [] }));
export const bookingOptions = [
 ['パラジェル変更',1000,0],
 ['（当店）ハンドソフトジェル付替オフ',500,30],
 ['（当店）ハンドチップ長さ出しorハードジェル付替オフ',1500,30],
 ['（当店）ハンドスカルプ付替オフ',2500,45],
 ['（他店）ハンドソフトジェル付替オフ',1000,30],
 ['（他店）ハンドチップ長さ出しorハードジェル付替オフ',2000,30],
 ['（他店）ハンドスカルプ付替オフ',3000,45],
 ['フットジェル付替オフ',1500,30],
 ['チップフィルイン付替オフ',2500,45],
 ['スカルプorハードジェルフィルイン付替オフ',3500,45],
 ['ハンド＋フットソフトジェル付替オフ',2500,45],
].map(([name, price, duration], index) => ({ id: `mai-option-${index+1}`, name, price, duration }));
// Reference items are composed for display only. Never write them into the stored catalog.
export function withReferenceServices(existing) {
 const result = [...referenceServices];
 for (const item of existing) {
   const index = result.findIndex(ref => ref.id === item.id || ref.name === item.name);
   if (index >= 0) result[index] = { ...result[index], ...item, category: result[index].category };
   else result.push({ ...item, category: item.category || 'existing' });
 }
 return result;
}
export function japanToday() { return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Tokyo' }).format(new Date()); }
