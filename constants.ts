import { Category, EquipmentItem, PeriodCharge } from './types';

export const CATEGORIES: { id: Category; label: string; color: string; bg: string }[] = [
  { id: 'audio', label: '音響系統', color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
  { id: 'lighting', label: '燈光系統', color: 'text-yellow-500', bg: 'bg-yellow-500/10' },
  { id: 'led', label: 'LED系統', color: 'text-violet-500', bg: 'bg-violet-500/10' },
  { id: 'projection', label: '投影系統', color: 'text-pink-500', bg: 'bg-pink-500/10' },
  { id: 'power', label: '電力系統', color: 'text-orange-500', bg: 'bg-orange-500/10' },
  { id: 'stage', label: '舞台結構', color: 'text-amber-600', bg: 'bg-amber-600/10' },
  { id: 'crew', label: '工作團隊', color: 'text-blue-500', bg: 'bg-blue-500/10' },
  { id: 'effects', label: '特效', color: 'text-red-500', bg: 'bg-red-500/10' },
];

// Suggested accessories map
export const ACCESSORY_SUGGESTIONS: Record<Category, string[]> = {
  audio: [
    'XLR 訊號線 (2m)', 'XLR 訊號線 (3m)', 'XLR 訊號線 (10m)', 'XLR 訊號線 (15m)',
    'MULTI 8CH (30m)', 'MULTI 4CH (20m)',
    '樂器導線 phone (5m)', '樂器導線 phone (3m)',
    '音源線 6.3 對 3.5', '公對母延長線 (3m)',
    '麥架 (長)', '麥架 (桌架短)', '譜架', '喇叭架 (長)', '喇叭架 (短)',
    'DI Box (Behringer)', '3號電池 (AA)', '電源延長線 (排插)', '網路線 (50m)'
  ],
  lighting: [
    'DMX 訊號線 (短)', 'DMX 訊號線 (長)', '電源線 (PowerCon)',
    '燈鉤 (Clamp)', '安全索 (Safety Cable)', '色紙',
    '對講機', '手套'
  ],
  led: [
    '備品箱', '發送卡', '網路線', '電源線 (220V)',
    'HDMI 訊號線', 'SDI 訊號線', '訊號放大器',
    '固定支架', '吊掛架'
  ],
  projection: [
    'HDMI 訊號線 (1.5m)', 'HDMI 訊號線 (3m)', 'HDMI 訊號線 (10m)',
    'SDI 訊號線', '轉接頭 (Type-C)', '轉接頭 (MiniDP)',
    '電源延長線', '筆電變壓器', '遙控器', '雷射筆電池',
    '投影機吊架', '訊號放大器'
  ],
  power: [
    '電源延長線 (30m)', '電源延長線 (50m)', '排插 (6孔)',
    '配電箱 (三相)', '配電箱 (單相)', '電纜線 (3.5mm²)',
    '接地線', '絕緣膠帶', '束線帶'
  ],
  stage: [
    '螺絲組', '扳手組', '安全索 (Safety Cable)',
    '地毯 (黑色)', '地毯膠帶', '斜坡板',
    '護欄', '防滑墊', '圍裙 (Skirt)'
  ],
  crew: [
    '夜間進場', '前一天進場', '彩排費用', '超時費用', '交通費', '住宿費', '便當費'
  ],
  effects: [
    '煙油', 'CO2 鋼瓶', '彩帶補充包', '泡泡液',
    '火焰燃料', '保險絲', '遙控器', '安全防護網'
  ],
};

// This list is used for the "Select Item" feature
export const STANDARD_EQUIPMENT_OPTIONS: Omit<EquipmentItem, 'id'>[] = [
  // --- 音響系統 ---
  // 控台
  { category: 'audio', name: '數位混音控台', quantity: 1, unit: '式', price: 4000, note: 'Behringer X32 Compact', subItems: ['電源線', '變壓器'] },
  { category: 'audio', name: '類比混音控台', quantity: 1, unit: '式', price: 2000, note: 'Yamaha MG16XU', subItems: ['電源線'] },
  // 喇叭
  { category: 'audio', name: '主動式喇叭 12"', quantity: 2, unit: '顆', price: 2000, note: 'QSC KS12.2 (庫存8顆)', subItems: ['電源線', 'XLR 線'] },
  { category: 'audio', name: '主動式喇叭 10"', quantity: 2, unit: '顆', price: 1500, note: 'QSC KS10.2 (庫存2顆)', subItems: ['電源線', 'XLR 線'] },
  { category: 'audio', name: '主動式同軸喇叭 12"', quantity: 2, unit: '顆', price: 1500, note: 'The box pro 同軸 (庫存6顆)', subItems: ['電源線', 'XLR 線'] },
  { category: 'audio', name: '超低音喇叭', quantity: 2, unit: '顆', price: 3000, note: 'QSC KS118 (庫存2顆)', subItems: ['電源線', 'XLR 線'] },
  { category: 'audio', name: '被動式喇叭 12"', quantity: 2, unit: '顆', price: 1200, note: 'JBL STX800 (庫存4顆)', subItems: ['SpeakOn 喇叭線'] },
  { category: 'audio', name: '小型監聽喇叭', quantity: 1, unit: '顆', price: 800, note: 'MACKIE SRM150', subItems: ['電源線'] },
  { category: 'audio', name: '監聽喇叭', quantity: 1, unit: '組', price: 3000, note: 'Neumann KH80DSP', subItems: ['電源線', 'XLR 線'] },
  // 無線麥克風
  { category: 'audio', name: '無線手持麥克風', quantity: 4, unit: '支', price: 1000, note: 'MIPRO ACT-52H / ACT-700T', subItems: ['3號電池 x8', '麥克風夾'] },
  { category: 'audio', name: '無線領夾麥克風', quantity: 4, unit: '支', price: 1200, note: 'MIPRO mu55ls + ACT-74', subItems: ['3號電池 x8', '領夾'] },
  { category: 'audio', name: '無線耳掛麥克風', quantity: 4, unit: '支', price: 1200, note: 'MIPRO MU-55HNS + ACT-70H', subItems: ['3號電池 x8'] },
  { category: 'audio', name: '軟管收音麥克風', quantity: 2, unit: '支', price: 500, note: 'MIPRO SM-32 / 6VA-5', subItems: [] },
  // 有線麥克風
  { category: 'audio', name: '有線麥克風 (SM58)', quantity: 2, unit: '支', price: 300, note: 'SHURE SM58 (庫存5支)', subItems: ['麥克風夾', 'XLR 線'] },
  { category: 'audio', name: '有線麥克風 (SM57)', quantity: 2, unit: '支', price: 300, note: 'SHURE SM57 收音用 (庫存4支)', subItems: ['麥克風夾', 'XLR 線'] },
  { category: 'audio', name: '動圈式人聲麥克風', quantity: 4, unit: '支', price: 500, note: 'Telefunken TPA-2 (庫存8支)', subItems: ['麥克風夾'] },
  // 鼓組/樂團
  { category: 'audio', name: '鼓組收音麥克風組', quantity: 1, unit: '套', price: 3000, note: 'SHURE PG56×3 + PG52 + PG81×2', subItems: ['鼓夾', 'XLR 線', '麥架'] },
  // 周邊
  { category: 'audio', name: '入耳式監聽放大器', quantity: 1, unit: '組', price: 1500, note: 'the t.bone FREE2B', subItems: [] },
  { category: 'audio', name: 'DI Box', quantity: 2, unit: '個', price: 300, note: 'Behringer UltraDI D100/D120', subItems: [] },
  { category: 'audio', name: '訊號轉換盒', quantity: 1, unit: '個', price: 500, note: 'Focusrite Scarlett 2i2 (庫存4個)', subItems: ['USB 線'] },
  { category: 'audio', name: '金嗓點歌機', quantity: 1, unit: '台', price: 2000, note: 'CPX-900M1', subItems: ['遙控器', '電源線'] },
  { category: 'audio', name: '直播控制器', quantity: 1, unit: '組', price: 1500, note: 'Elgato Stream Deck MK.2', subItems: ['USB 線'] },
  // 架子/線材
  { category: 'audio', name: '喇叭架 (長)', quantity: 2, unit: '組', price: 300, note: 'K&M (庫存4組)', subItems: [] },
  { category: 'audio', name: '喇叭架 (短)', quantity: 2, unit: '組', price: 200, note: 'K&M (庫存8組)', subItems: [] },
  { category: 'audio', name: '麥架 (長)', quantity: 2, unit: '支', price: 150, note: '庫存6支', subItems: [] },
  { category: 'audio', name: '麥架 (桌架短)', quantity: 2, unit: '支', price: 100, note: '鐵板型 (庫存4支)', subItems: [] },
  { category: 'audio', name: '譜架', quantity: 2, unit: '支', price: 100, note: '庫存4支', subItems: [] },
  { category: 'audio', name: '訊號線材與配件', quantity: 1, unit: '批', price: 3000, note: 'XLR / Phone / 電源 / 架子', subItems: [] },

  // --- 燈光系統 ---
  { category: 'lighting', name: '燈光控台', quantity: 1, unit: '式', price: 10000, note: 'Tiger Touch II', subItems: ['電源線', '工作燈', '防塵套'] },
  { category: 'lighting', name: 'LED 搖頭燈 (1915)', quantity: 8, unit: '顆', price: 800, note: 'LED MOVING 1915 (庫存32顆)', subItems: ['電源線 (PowerCon)', 'DMX 線', '燈鉤', '安全索'] },
  { category: 'lighting', name: 'LED 搖頭燈 (1940)', quantity: 4, unit: '顆', price: 1200, note: 'LED MOVING 1940 (庫存4顆)', subItems: ['電源線 (PowerCon)', 'DMX 線', '燈鉤', '安全索'] },
  { category: 'lighting', name: '光束搖頭燈 (Beam 280)', quantity: 4, unit: '顆', price: 1500, note: 'Beam Spot 280 (庫存4顆)', subItems: ['電源線 (PowerCon)', 'DMX 線', '燈鉤', '安全索'] },
  { category: 'lighting', name: 'LED 染色燈 (LED Par)', quantity: 12, unit: '顆', price: 500, note: 'LED PAR RGBW', subItems: ['電源線', 'DMX 線', '燈鉤'] },
  { category: 'lighting', name: 'LED 四眼觀眾燈', quantity: 4, unit: '座', price: 1000, note: 'LED四眼 (庫存8座)', subItems: ['電源線', 'DMX 線'] },
  { category: 'lighting', name: '追蹤燈 (Follow Spot)', quantity: 2, unit: '支', price: 3000, note: 'Includes Operator Stand', subItems: ['腳架', '電源線', '色片'] },
  { category: 'lighting', name: '燈光線材與配電', quantity: 1, unit: '批', price: 5000, note: 'DMX / PowerCon / 配電', subItems: [] },

  // --- LED系統 ---
  { category: 'led', name: 'LED 電視牆 (P2.5)', quantity: 1, unit: '式', price: 60000, note: '300x200cm', subItems: ['備品箱', '發送卡', '網路線'] },
  { category: 'led', name: 'LED 電視牆 (P3.9)', quantity: 1, unit: '式', price: 45000, note: '400x300cm 戶外型', subItems: ['備品箱', '發送卡', '網路線'] },
  { category: 'led', name: '液晶電視 (50")', quantity: 2, unit: '台', price: 3000, note: '外框 111×64.5cm / 螢幕 110.5×62.3cm / 厚 2.2cm', subItems: ['電源線', '遙控器', '立架配件包'] },
  { category: 'led', name: '液晶電視 (65")', quantity: 1, unit: '台', price: 5000, note: 'PHILIPS 外框 146×84.5cm / 螢幕 143×80.5cm / 厚 2.5cm', subItems: ['電源線', '遙控器', '立架配件包'] },
  { category: 'led', name: 'LED 發送處理器', quantity: 1, unit: '台', price: 5000, note: 'Novastar / Brompton', subItems: ['電源線', '網路線'] },

  // --- 投影系統 ---
  { category: 'projection', name: '高流明雷射投影機', quantity: 1, unit: '台', price: 25000, note: '15,000 Lumens Laser', subItems: ['電源線 (220V)', '遙控器', '鏡頭蓋'] },
  { category: 'projection', name: '商務投影機', quantity: 1, unit: '台', price: 5000, note: '5,000 Lumens', subItems: ['電源線', 'HDMI 線', '遙控器'] },
  { category: 'projection', name: '快速折疊幕 (150-200")', quantity: 1, unit: '式', price: 3000, note: 'Front/Rear Projection', subItems: ['幕布 (前投)', '幕布 (背投)', '框架組', '腳架組'] },
  { category: 'projection', name: '視訊導播控台 (Switcher)', quantity: 1, unit: '式', price: 12000, note: 'Roland V60 / V160HD', subItems: ['變壓器'] },
  { category: 'projection', name: '4K 導播控台 (4K Switcher)', quantity: 1, unit: '式', price: 20000, note: 'Barco E2 / S3', subItems: ['電源線 x2'] },
  { category: 'projection', name: '筆記型電腦 (Laptop)', quantity: 1, unit: '台', price: 1500, note: 'MacBook Pro / Windows', subItems: ['變壓器', '滑鼠', '轉接頭'] },
  { category: 'projection', name: '簡報遙控器 (Clicker)', quantity: 1, unit: '支', price: 500, note: 'Logitech R-R0011 (庫存2個)', subItems: ['電池', '接收器'] },
  { category: 'projection', name: '視訊線材 (Cabling)', quantity: 1, unit: '批', price: 2000, note: 'HDMI / SDI / Fiber', subItems: [] },

  // --- 電力系統 ---
  { category: 'power', name: '三相配電箱 (Main)', quantity: 1, unit: '式', price: 8000, note: '100A 三相主配電', subItems: ['電纜線', '接地線'] },
  { category: 'power', name: '單相配電箱 (Sub)', quantity: 2, unit: '組', price: 3000, note: '60A 單相子配電', subItems: ['電纜線'] },
  { category: 'power', name: '電源延長線組 (30m)', quantity: 4, unit: '條', price: 500, note: '3.5mm² 延長線', subItems: [] },
  { category: 'power', name: '排插組 (Power Strip)', quantity: 6, unit: '個', price: 200, note: '6孔排插', subItems: [] },
  { category: 'power', name: 'UPS 不斷電系統', quantity: 1, unit: '台', price: 3000, note: '1500VA', subItems: ['電源線'] },
  { category: 'power', name: '發電機 (Generator)', quantity: 1, unit: '台', price: 15000, note: '60KW 靜音發電機', subItems: ['油料', '電纜線'] },

  // --- 舞台結構 ---
  { category: 'stage', name: '舞台板 (Stage Deck)', quantity: 20, unit: '片', price: 800, note: '1.2m x 2.4m 標準舞台板', subItems: ['支撐腳 x4'] },
  { category: 'stage', name: '舞台支撐腳 (Legs)', quantity: 1, unit: '組', price: 2000, note: '可調高度 40-100cm', subItems: [] },
  { category: 'stage', name: '桁架 (Truss)', quantity: 1, unit: '組', price: 5000, note: '12" Box Truss 套組', subItems: ['接頭', '插銷', '安全索'] },
  { category: 'stage', name: '護欄 (Guardrail)', quantity: 10, unit: '支', price: 300, note: '1.2m 安全護欄', subItems: [] },
  { category: 'stage', name: '斜坡板 (Ramp)', quantity: 2, unit: '組', price: 1500, note: '無障礙斜坡', subItems: ['防滑墊'] },
  { category: 'stage', name: '地毯 (Carpet)', quantity: 1, unit: '式', price: 3000, note: '黑色地毯含鋪設', subItems: ['地毯膠帶'] },

  // --- 工作團隊 ---
  { category: 'crew', name: '專案執行人員', quantity: 1, unit: '人', price: 5000, note: 'Project Manager', subItems: [] },
  { category: 'crew', name: '音控工程師', quantity: 1, unit: '人', price: 5000, note: 'Audio Engineer', subItems: [] },
  { category: 'crew', name: '視訊工程師', quantity: 1, unit: '人', price: 5000, note: 'Video Engineer', subItems: [] },
  { category: 'crew', name: '燈控工程師', quantity: 1, unit: '人', price: 5000, note: 'Lighting Engineer', subItems: [] },
  { category: 'crew', name: '硬體助理人員', quantity: 2, unit: '人', price: 3000, note: 'Stagehand / Assistant', subItems: [] },
  { category: 'crew', name: '夜間進場費', quantity: 1, unit: '式', price: 3000, note: 'Night Move-in Fee', subItems: [] },
  { category: 'crew', name: '前一日進場費', quantity: 1, unit: '式', price: 5000, note: 'Day-before Move-in Fee', subItems: [] },
  { category: 'crew', name: '設備運輸費 (大車)', quantity: 1, unit: '趟', price: 3500, note: '3.5T Truck', subItems: [] },
  { category: 'crew', name: '設備運輸費 (小車)', quantity: 1, unit: '趟', price: 1500, note: 'Van', subItems: [] },

  // --- 特效 ---
  { category: 'effects', name: '煙霧機 (Haze Machine)', quantity: 2, unit: '台', price: 2000, note: 'Unique 2.1 / DF-50', subItems: ['電源線', '煙油 (桶)'] },
  { category: 'effects', name: 'CO2 噴射機', quantity: 2, unit: '台', price: 3000, note: 'CO2 Jet', subItems: ['CO2 鋼瓶', '高壓管'] },
  { category: 'effects', name: '火焰機 (Flame)', quantity: 2, unit: '台', price: 5000, note: 'DMX 控制火焰機', subItems: ['燃料', '安全防護網'] },
  { category: 'effects', name: '彩帶機 (Confetti)', quantity: 2, unit: '台', price: 2000, note: '電動彩帶發射器', subItems: ['彩帶補充包'] },
  { category: 'effects', name: '泡泡機 (Bubble)', quantity: 2, unit: '台', price: 1000, note: '大型泡泡機', subItems: ['泡泡液', '電源線'] },
  { category: 'effects', name: '冷焰火 (Cold Spark)', quantity: 4, unit: '台', price: 2500, note: 'Ti Powder Spark Machine', subItems: ['鈦粉耗材', '電源線'] },
];

// 常用檔期組合快選
export const DEFAULT_PERIOD_PRESETS: { label: string; charges: Omit<PeriodCharge, 'id'>[] }[] = [
  {
    label: '1天',
    charges: [
      { label: '活動日', type: 'rate', value: 1.0 },
    ],
  },
  {
    label: '2天(進+活)',
    charges: [
      { label: '進場日', type: 'rate', value: 0.85 },
      { label: '活動日', type: 'rate', value: 1.0 },
    ],
  },
  {
    label: '3天(進+活+撤)',
    charges: [
      { label: '進場日', type: 'rate', value: 0.85 },
      { label: '活動日', type: 'rate', value: 1.0 },
      { label: '撤場日', type: 'rate', value: 0.5 },
    ],
  },
];

// 標籤建議清單
export const DEFAULT_DAY_LABELS: string[] = [
  '活動日', '進場日', '撤場日', '彩排日', '夜間進場費', '前一天進場費', '超時費用',
];

// Default items for a brand new project
export const INITIAL_ITEMS: Omit<EquipmentItem, 'id'>[] = [
  { category: 'audio', name: '基本音響系統', quantity: 1, unit: '式', price: 15000, note: 'Speakers + Console + Mics', subItems: ['電源線', '訊號線', '麥克風立架'] },
];
