export const bookingGroups = [
  { id: 'addons', ja: '追加サービス', vi: 'Dịch vụ bổ sung', en: 'Add-ons', zh: '附加服务', ko: '추가 서비스', mark: '＋' },
  { id: 'hand', ja: 'ハンドネイル', vi: 'Nail tay', en: 'Hand nails', zh: '手部美甲', ko: '핸드 네일', mark: '01' },
  { id: 'tip', ja: 'チップ（長さ出し）ネイル', vi: 'Nối móng tip', en: 'Tip extensions', zh: '甲片延长', ko: '팁 연장', mark: '02' },
  { id: 'sculpt', ja: 'スカルプ（長さ出し）ネイル', vi: 'Đắp bột / nối sculpt', en: 'Sculpted extensions', zh: '水晶延长', ko: '스컬프 연장', mark: '03' },
  { id: 'foot', ja: 'フットネイル', vi: 'Nail chân', en: 'Foot nails', zh: '足部美甲', ko: '풋 네일', mark: '04' },
  { id: 'removal', ja: 'オフのみ', vi: 'Tháo móng', en: 'Removal only', zh: '仅卸甲', ko: '제거만', mark: '05' },
  { id: 'repair', ja: 'お直し（リペア）', vi: 'Sửa móng', en: 'Repair', zh: '修复', ko: '리페어', mark: '06' },
  { id: 'model', ja: 'モデルさん募集', vi: 'Dịch vụ mẫu', en: 'Model appointments', zh: '模特预约', ko: '모델 예약', mark: '07' },
];

export const fallbackBookingGroup = { id: 'existing', ja: 'その他のサービス', vi: 'Dịch vụ khác', en: 'Other services', zh: '其他服务', ko: '기타 서비스', mark: '08' };

export function bookingGroupLabel(category, language = 'vi') {
  const group = [...bookingGroups, fallbackBookingGroup].find(item => item.id === category) || fallbackBookingGroup;
  const key = ['ja', 'en', 'zh', 'ko'].includes(language) ? language : 'vi';
  return group[key] || group.en;
}

export function localizedService(service, language = 'vi') {
  if (!service) return service;
  const key = language === 'ja' ? 'nameJa' : language === 'zh' ? 'nameZh' : language === 'ko' ? 'nameKo' : language === 'en' ? 'nameEn' : 'nameVi';
  if (service[key]) return service[key];
  const labels = {
    'クリアネイル【メンズOK】': { vi: 'Nail trong suốt (nam cũng dùng được)', en: 'Clear nails (men welcome)' },
    'ワンカラー【メンズOK】': { vi: 'Sơn một màu (nam cũng dùng được)', en: 'One color (men welcome)' },
    '【人気キラキラ】◆マグネットorフラッシュネイル': { vi: 'Nail nam châm hoặc flash lấp lánh', en: 'Magnet or flash sparkle nails' },
    '【アートシンプル】持込◎': { vi: 'Art đơn giản · nhận mẫu mang đến', en: 'Simple art · bring your design' },
    '【持ち込み◎】アートシンプル・パーツつけ放題': { vi: 'Art đơn giản · đính charm không giới hạn', en: 'Simple art · unlimited parts' },
    '【持ち込み◎】アートやり放題・つけ放題': { vi: 'Art tự do · đính charm không giới hạn', en: 'Unlimited art and parts' },
    'フットオフのみ': { vi: 'Tháo gel chân', en: 'Foot removal only' }, 'ハンドオフのみ': { vi: 'Tháo gel tay', en: 'Hand removal only' },
    'チップ長さ出しオフのみ': { vi: 'Tháo móng tip nối dài', en: 'Tip extension removal' }, 'スカルプ、ハードジェルオフのみ': { vi: 'Tháo sculpt / gel cứng', en: 'Sculpt or hard gel removal' },
    '【お直し（リペア）】当店施術のみ': { vi: 'Sửa móng (chỉ dịch vụ tại salon)', en: 'Repair (salon work only)' },
  };
  const found = labels[service.name];
  return language === 'ja' ? service.name : (found?.[language] || service.name);
}
export function localizedOption(option, language = 'vi') {
  if (!option) return option;
  const key = language === 'ja' ? 'nameJa' : language === 'zh' ? 'nameZh' : language === 'ko' ? 'nameKo' : language === 'en' ? 'nameEn' : 'nameVi';
  if (option[key]) return option[key];
  const map = {
    'パラジェル変更': { vi: 'Đổi gel Para', en: 'Para gel change', zh: '更换Para胶', ko: '파라젤 변경' },
    '（当店）ハンドソフトジェル付替オフ': { vi: 'Tháo gel mềm tay (làm tại salon)', en: 'Our salon · hand soft gel removal', zh: '本店·手部软胶卸除', ko: '본점·손 소프트 젤 제거' },
    '（当店）ハンドチップ長さ出しorハードジェル付替オフ': { vi: 'Tháo tip nối dài hoặc gel cứng tay (làm tại salon)', en: 'Our salon · tip extension or hard gel removal', zh: '本店·甲片延长或硬胶卸除', ko: '본점·팁 연장 또는 하드젤 제거' },
    '（当店）ハンドスカルプ付替オフ': { vi: 'Tháo sculpt tay (làm tại salon)', en: 'Our salon · sculpt removal', zh: '本店·水晶甲卸除', ko: '본점·스컬프 제거' },
    '（他店）ハンドソフトジェル付替オフ': { vi: 'Tháo gel mềm tay (làm ở nơi khác)', en: 'Other salon · hand soft gel removal', zh: '他店·手部软胶卸除', ko: '타점·손 소프트 젤 제거' },
    '（他店）ハンドチップ長さ出しorハードジェル付替オフ': { vi: 'Tháo tip nối dài hoặc gel cứng tay (làm ở nơi khác)', en: 'Other salon · tip extension or hard gel removal', zh: '他店·甲片延长或硬胶卸除', ko: '타점·팁 연장 또는 하드젤 제거' },
    '（他店）ハンドスカルプ付替オフ': { vi: 'Tháo sculpt tay (làm ở nơi khác)', en: 'Other salon · sculpt removal', zh: '他店·水晶甲卸除', ko: '타점·스컬프 제거' },
    'フットジェル付替オフ': { vi: 'Tháo gel chân để thay mới', en: 'Foot gel removal for replacement', zh: '脚部凝胶卸除后更换', ko: '발 젤 교체 제거' },
    'チップフィルイン付替オフ': { vi: 'Fill-in móng tip', en: 'Tip fill-in', zh: '甲片补填', ko: '팁 필인' },
    'スカルプorハードジェルフィルイン付替オフ': { vi: 'Fill-in sculpt hoặc gel cứng', en: 'Sculpt or hard gel fill-in', zh: '水晶甲或硬胶补填', ko: '스컬프 또는 하드젤 필인' },
    'ハンド＋フットソフトジェル付替オフ': { vi: 'Tháo gel mềm tay + chân để thay mới', en: 'Hand and foot soft gel removal', zh: '手部及脚部软胶卸除', ko: '손과 발 소프트 젤 제거' },
  };
  return language === 'ja' ? option.name : (map[option.name]?.[language] || option.name);
}
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
 if (existing.some(item => item.catalogVersion === 1 || String(item.id || '').startsWith('mai-menu-'))) {
   return existing.map(item => ({ ...item, catalogVersion: 1, category: item.category || 'existing', staff: Array.isArray(item.staff) ? item.staff : [] }));
 }
 const result = [...referenceServices];
 for (const item of existing) {
   const index = result.findIndex(ref => ref.id === item.id || ref.name === item.name);
   if (index >= 0) result[index] = { ...result[index], ...item, category: result[index].category };
   else result.push({ ...item, category: item.category || 'existing' });
 }
 return result.map(item => ({ ...item, catalogVersion: 1 }));
}
export function japanToday() { return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Tokyo' }).format(new Date()); }
