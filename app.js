/**
 * 智光高級商工職業學校資處科一仁午餐訂餐系統
 * 核心應用程式：AppState 集中狀態管理、型態安全轉換、純淨無測試假資料、跨裝置同步與徹底重置
 */

// 一、 學生名單資料（共 6 排 31 人）
const STUDENTS = [
  // 第一排（1 ~ 6 號）
  { id: 1, row: 1 },
  { id: 2, row: 1 },
  { id: 3, row: 1 },
  { id: 4, row: 1 },
  { id: 5, row: 1 },
  { id: 6, row: 1 },

  // 第二排（7 ~ 12 號）
  { id: 7, row: 2 },
  { id: 8, row: 2 },
  { id: 9, row: 2 },
  { id: 10, row: 2 },
  { id: 11, row: 2 },
  { id: 12, row: 2 },

  // 第三排（13 ~ 18 號）
  { id: 13, row: 3 },
  { id: 14, row: 3 },
  { id: 15, row: 3 },
  { id: 16, row: 3 },
  { id: 17, row: 3 },
  { id: 18, row: 3 },

  // 第四排（19 ~ 24 號）
  { id: 19, row: 4 },
  { id: 20, row: 4 },
  { id: 21, row: 4 },
  { id: 22, row: 4 },
  { id: 23, row: 4 },
  { id: 24, row: 4 },

  // 第五排（25 ~ 30 號）
  { id: 25, row: 5 },
  { id: 26, row: 5 },
  { id: 27, row: 5 },
  { id: 28, row: 5 },
  { id: 29, row: 5 },
  { id: 30, row: 5 },

  // 第六排（31 號）
  { id: 31, row: 6 }
];

// 二、 餐點清單（共 12 項）
const MENU_ITEMS = [
  { id: "m1", name: "涼麵", price: 50, icon: "🍜" },
  { id: "m2", name: "滷肉飯", price: 50, icon: "🍚" },
  { id: "m3", name: "麻辣燙（附白飯）", price: 80, icon: "🍲" },
  { id: "m4", name: "沙茶豬肉鍋（附白飯）", price: 90, icon: "🍲" },
  { id: "m5", name: "麻辣沙茶豬肉鍋（附白飯）", price: 90, icon: "🥘" },
  { id: "m6", name: "咖哩雞排飯", price: 80, icon: "🍛" },
  { id: "m7", name: "便當（無骨雞）", price: 80, icon: "🍱" },
  { id: "m8", name: "便當（椒麻雞）", price: 80, icon: "🍱" },
  { id: "m9", name: "便當（日式豬）", price: 80, icon: "🍱" },
  { id: "m10", name: "便當（豬柳飯）", price: 80, icon: "🍱" },
  { id: "m11", name: "便當（糖醋排骨）", price: 80, icon: "🍱" },
  { id: "m12", name: "羹麵", price: 60, icon: "🍜" }
];

// =========================================================
// 集中式應用程式狀態管理 (AppState)
// 預設純淨無測試假資料（空物件 {} 與空陣列 []）
// =========================================================
const STORAGE_KEY = "zhiguang_cs1ren_orders_clean_v5";
const STORAGE_FEED_KEY = "zhiguang_cs1ren_feed_clean_v5";
const STORAGE_RESET_EPOCH = "zhiguang_cs1ren_reset_epoch_v5";

const AppState = {
  orders: {},          // 預設純淨空物件，絕無硬編碼假資料 (如 29, 30)
  activityFeed: [],    // 預設純淨空陣列
  selectedMealId: null,
  soundEnabled: true,
  resetEpoch: 0,
  stateTimestamp: 0    // Unix ms 狀態版本號：每次 orders 變動時更新，用於拒絕過時 retained 訊息
};

// 掛載至 window 全域物件，解決控制台 Console 呼叫 AppState is not defined 作用域問題
window.AppState = AppState;

// 台灣時間與 13:00 重置輔助函式
const TW_OFFSET_MS = 8 * 60 * 60 * 1000;

function getTodayTwNoonResetTimestamp() {
  const nowTW = new Date(Date.now() + TW_OFFSET_MS);
  return Date.UTC(
    nowTW.getUTCFullYear(),
    nowTW.getUTCMonth(),
    nowTW.getUTCDate(),
    5, 0, 0 // UTC 05:00 = 台灣時間 13:00:00
  );
}

function isWeekdayTw(timestamp = Date.now()) {
  const day = new Date(timestamp + TW_OFFSET_MS).getUTCDay();
  return day >= 1 && day <= 5; // 1 = 週一, 5 = 週五
}

// 計算最近一個已截止的週一至週五 13:00 午餐時間點
function getLastWeekday1300Timestamp(now = Date.now()) {
  const nowTW = new Date(now + TW_OFFSET_MS);
  const currentDay = nowTW.getUTCDay(); // 0 = 週日, 1 = 週一, ..., 6 = 週六
  const today1300 = Date.UTC(
    nowTW.getUTCFullYear(),
    nowTW.getUTCMonth(),
    nowTW.getUTCDate(),
    5, 0, 0 // UTC 05:00 = 台灣時間 13:00:00
  );

  // 若今日為工作日（週一至週五）且目前時間已超過今日 13:00，則最近截止點為今日 13:00
  if (currentDay >= 1 && currentDay <= 5 && now >= today1300) {
    return today1300;
  }

  // 否則回推前一個上課工作日（週一至週五）的 13:00
  let candidate = today1300 - 86400000;
  for (let i = 0; i < 7; i++) {
    const candDay = new Date(candidate + TW_OFFSET_MS).getUTCDay();
    if (candDay >= 1 && candDay <= 5) {
      return candidate;
    }
    candidate -= 86400000;
  }
  return today1300 - 86400000;
}

// 訂單有效性判定（核心修復：徹底支援前天晚上、昨晚與週末提前點餐）
function isOrderStillValid(order, now = Date.now()) {
  if (!order) return false;
  const ts = Number(order.timestamp || 0);
  if (!ts || isNaN(ts)) return true; // 若無時間戳記則保留，避免誤刪

  // 規則 1：若操作者在該筆訂單成立後執行過手動重置/清空 (resetEpoch)
  const currentResetEpoch = getResetEpoch();
  if (currentResetEpoch > 0 && ts < currentResetEpoch) {
    return false;
  }

  // 規則 2：超過 96 小時（4 天）的歷史陳舊資料清理（涵蓋 3~4 天連假）
  const ageMs = now - ts;
  if (ageMs > 96 * 60 * 60 * 1000) {
    return false;
  }

  // 規則 3：週一至週五若目前時間已超過今日 13:00，則今日 13:00 以前（中午吃完的舊午餐）已截止失效
  const today1300 = getTodayTwNoonResetTimestamp();
  if (isWeekdayTw(now) && now >= today1300) {
    if (ts < today1300) {
      return false;
    }
  }

  // 規則 4：訂單若成立於最近一個工作日 13:00 截止點之後（例如：昨晚、前天晚上、週末），
  //        代表是要吃即將到來的新一頓午餐，100% 有效！
  const lastWeekday1300 = getLastWeekday1300Timestamp(now);
  if (ts >= lastWeekday1300) {
    return true;
  }

  // 規則 5：48 小時內訂單（支援前天晚上提前點餐，即便遇特殊放假日未重置亦保留）
  if (ageMs <= 48 * 60 * 60 * 1000) {
    return true;
  }

  return false;
}

// 訂單時間格式化（含完整西元年月日與時分秒，統計表與卡片顯示）
function formatOrderDisplayTime(order) {
  if (!order) return '-';
  if (order.timestamp) {
    const d = new Date(Number(order.timestamp));
    const Y = d.getFullYear();
    const M = String(d.getMonth() + 1).padStart(2, '0');
    const D = String(d.getDate()).padStart(2, '0');
    const h = String(d.getHours()).padStart(2, '0');
    const m = String(d.getMinutes()).padStart(2, '0');
    const s = String(d.getSeconds()).padStart(2, '0');
    return `${Y}/${M}/${D} ${h}:${m}:${s}`;
  }
  return order.time || '-';
}

// 唯一裝置辨識標記
const DEVICE_ID = 'dev_' + Math.random().toString(36).substring(2, 9);
const IS_MOBILE = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
const DEVICE_LABEL = IS_MOBILE ? "📱 手機" : "💻 電腦";

// 環境偵測：判斷是運行於 GitHub Pages 雲端靜態託管，還是本機 Node.js 伺服器
const IS_GITHUB_PAGES = location.hostname.endsWith('github.io') || location.hostname.includes('github');
const IS_LOCAL_SERVER = !IS_GITHUB_PAGES && (
  location.hostname === 'localhost' ||
  location.hostname === '127.0.0.1' ||
  /^192\.168\./.test(location.hostname) ||
  /^10\./.test(location.hostname) ||
  /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(location.hostname)
) && (location.port !== '');

// MQTT 跨裝置雲端同步設定 (採用隔離頻道與雙節點自動容錯)
const MQTT_BROKERS = [
  "wss://broker.emqx.io:8084/mqtt",
  "wss://broker.hivemq.com:8884/mqtt"
];
let currentBrokerIndex = 0;
const MQTT_TOPIC_EVENT = "zhiguang/cs1ren/prod_clean_2026/events";
const MQTT_TOPIC_STATE = "zhiguang/cs1ren/prod_clean_2026/state";
const MQTT_TOPIC_REQ = "zhiguang/cs1ren/prod_clean_2026/sync_request";
let mqttClient = null;
let _mqttReconnectTimer = null;

// 瀏覽器跨分頁廣播
const BROADCAST_CHANNEL_NAME = "zhiguang_cs1ren_channel_clean_v5";
let broadcastChannel = null;

// 本地 WebSocket
let localWs = null;

// =========================================================
// 訂單資料驗證與清理 (Sanitization)
// =========================================================
function sanitizeOrders(rawOrders) {
  const clean = {};
  if (!rawOrders || typeof rawOrders !== 'object') return clean;
  for (const seatIdKey in rawOrders) {
    const seatId = Number(seatIdKey); // 嚴格轉換為數字
    if (isNaN(seatId) || seatId < 1 || seatId > 31) continue;
    const student = STUDENTS.find(s => Number(s.id) === seatId);
    const item = rawOrders[seatIdKey];
    if (student && item && item.mealId) {
      const meal = MENU_ITEMS.find(m => String(m.id) === String(item.mealId));
      if (meal) {
        clean[seatId] = {
          seatId: Number(student.id),
          mealId: String(meal.id),
          mealName: meal.name,
          price: Number(meal.price),
          time: item.time || getNowTime(),
          deviceType: item.deviceType || "📱 裝置",
          timestamp: Number(item.timestamp || Date.now())
        };
      }
    }
  }
  return clean;
}

function getResetEpoch() {
  try {
    return Number(localStorage.getItem(STORAGE_RESET_EPOCH) || "0");
  } catch (e) {
    return 0;
  }
}

function setResetEpoch(epoch) {
  try {
    localStorage.setItem(STORAGE_RESET_EPOCH, String(Number(epoch)));
  } catch (e) { }
}

// =========================================================
// 資料持久化 (LocalStorage 安全讀寫)
// 沒讀到資料時 Fallback 嚴格回傳空物件 {} 或空陣列 []
// =========================================================
function persistOrders() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(AppState.orders || {}));
    localStorage.setItem(STORAGE_FEED_KEY, JSON.stringify(AppState.activityFeed ? AppState.activityFeed.slice(0, 30) : []));
  } catch (e) {
    console.error("LocalStorage 寫入失敗:", e);
  }
}
const saveLocalData = persistOrders;

function loadLocalData() {
  // 自動清理舊版殘留快取
  ["zhiguang_cs1ren_lunch_orders_v1", "zhiguang_cs1ren_lunch_orders_v2", "zhiguang_cs1ren_feed_v2"].forEach(k => {
    try { localStorage.removeItem(k); } catch (e) { }
  });

  // 安全解析 LocalStorage，加入 try...catch 避免 JSON 解析失敗引發頁面崩潰
  try {
    const rawOrders = localStorage.getItem(STORAGE_KEY);
    if (rawOrders) {
      const parsed = JSON.parse(rawOrders);
      AppState.orders = (parsed && typeof parsed === 'object') ? sanitizeOrders(parsed) : {};
    } else {
      AppState.orders = {}; // 嚴格 Fallback 為空物件
    }

    const rawFeed = localStorage.getItem(STORAGE_FEED_KEY);
    if (rawFeed) {
      const parsedFeed = JSON.parse(rawFeed);
      AppState.activityFeed = Array.isArray(parsedFeed) ? parsedFeed : [];
    } else {
      AppState.activityFeed = []; // 嚴格 Fallback 為空陣列
    }
  } catch (e) {
    console.warn("LocalStorage 讀取解析異常，回退至純淨空狀態:", e);
    AppState.orders = {};
    AppState.activityFeed = [];
  }
}

// =========================================================
// 核心封裝函式：取消點餐 cancelOrder(seat)
// 支援在 Console 直接調用，自動執行 delete AppState.orders[seat]、
// 呼叫 persistOrders()、廣播通知並重新渲染畫面
// =========================================================
function cancelOrder(seat) {
  const seatId = Number(seat); // 確保嚴格型態轉換，避免 "29" 與 29 比對失敗
  if (isNaN(seatId) || seatId < 1 || seatId > 31) return;
  if (!AppState.orders[seatId]) return;

  const order = AppState.orders[seatId];
  delete AppState.orders[seatId];
  persistOrders();

  // 先廣播事件，再立即更新 MQTT retained 狀態（確保 broker 上的狀態是已刪除後的版本）
  broadcastToAllDevices('ORDER_CANCELLED', { seatId: seatId });
  // 明確覆寫 MQTT retained，避免新連線裝置收到舊的 retained 訊息而把取消的訂單「補回來」
  publishFullStateToMQTT();
  // 發布全量快照至 ntfy 雲端，確保其他裝置立即看到最新狀態（取消立即同步）
  publishFullStateToCloud(0);

  // 雙重保證：若在本地伺服器模式，向伺服器端發送取消請求，同步清除 orders.json
  if (IS_LOCAL_SERVER) {
    fetch(`${getServerBaseUrl()}/api/cancel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ seatId: seatId })
    }).catch(e => console.warn('POST /api/cancel 異常:', e.message));
  }

  renderAllViews();
  playCancelChime();
  addActivityItem('cancel', `${seatId}號 取消點餐`, `${order.mealName} 已取消`, getNowTime());

  console.log(`✅ [cancelOrder] 座號 ${seatId} 點餐已取消`);
}
window.cancelOrder = cancelOrder;

function resetSystem(operatorSeat = null) {
  const newEpoch = Date.now();
  setResetEpoch(newEpoch);

  // 1. 一次清空 AppState 記憶體資料
  AppState.orders = {};
  AppState.activityFeed = [];
  AppState.stateTimestamp = 0; // 歸零，讓 publishFullStateToMQTT 用當下時間重新建立版本號

  // 2. 徹底清理 LocalStorage
  try {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(STORAGE_FEED_KEY);
  } catch (e) {
    console.error("LocalStorage 清理失敗:", e);
  }

  // 3. 發布空狀態包覆寫 MQTT 雲端 Retained 訊息，抹除歷史保留
  if (mqttClient && mqttClient.connected) {
    try {
      mqttClient.publish(MQTT_TOPIC_STATE, JSON.stringify({ orders: {}, resetEpoch: newEpoch, cleared: true }), { retain: true, qos: 1 });
    } catch (e) { }
  }

  // 4. 廣播重置事件（附帶操作裝置標籤）
  const opLabel = operatorSeat ? `${operatorSeat}號` : DEVICE_LABEL;
  broadcastToAllDevices('ORDERS_RESET', { resetEpoch: newEpoch, operatorLabel: opLabel, operatorSeat: operatorSeat });
  // 重置後立即發布空的全量快照至 ntfy，確保其他裝置立即清空
  publishFullStateToCloud(0);

  // 雙重保證：若在本地伺服器模式，向伺服器發送重置請求，同步清空 orders.json
  if (IS_LOCAL_SERVER) {
    fetch(`${getServerBaseUrl()}/api/reset`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ resetEpoch: newEpoch, operatorLabel: DEVICE_LABEL })
    }).catch(e => console.warn('POST /api/reset 異常:', e.message));
  }

  // 5. 同步重新渲染所有 DOM 畫面
  renderAllViews();

  // 6. 在本機動態牆新增重置記錄
  addActivityItem('reset', `🔄 訂餐紀錄已全部重置`, `由 ${DEVICE_LABEL} 執行，所有座位已重新開放`, getNowTime());

  console.log("✅ [resetSystem] 系統已徹底重置！AppState.orders 與 LocalStorage 已清空，畫面已同步更新。");
}
window.resetSystem = resetSystem;

// 供外部習慣使用的別名函式
window.renderLiveRosterTable = function () {
  renderAdminDashboard();
};

// =========================================================
// 音效合成器 (Web Audio API)
// =========================================================
let audioCtx = null;
function getAudioContext() {
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass) audioCtx = new AudioContextClass();
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

function playSuccessChime() {
  if (!AppState.soundEnabled) return;
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(523.25, now);
    osc1.frequency.exponentialRampToValueAtTime(659.25, now + 0.12);
    gain1.gain.setValueAtTime(0.2, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.4);

    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(783.99, now + 0.1);
    osc2.frequency.exponentialRampToValueAtTime(1046.50, now + 0.28);
    gain2.gain.setValueAtTime(0.25, now + 0.1);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.65);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.1);
    osc2.stop(now + 0.65);
  } catch (e) { }
}

function playCancelChime() {
  if (!AppState.soundEnabled) return;
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(440, now);
    osc.frequency.linearRampToValueAtTime(311.13, now + 0.25);
    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.35);
  } catch (e) { }
}

// 最近推播訂單記錄，避免短時間內重複播放相同事件，但確保全班各裝置 100% 觸發通知
const _recentlyNotifiedOrders = new Map();
function markOrderNotified(orderKey) {
  _recentlyNotifiedOrders.set(orderKey, Date.now());
  if (_recentlyNotifiedOrders.size > 200) {
    const oldestKey = _recentlyNotifiedOrders.keys().next().value;
    _recentlyNotifiedOrders.delete(oldestKey);
  }
}

// 統一觸發全班即時點餐通知（推播橫幅、音效、Toast、座位綠光、手機震動、分頁標籤閃爍、桌面推播）
function notifyOrderCreated(order, deviceLabel) {
  if (!order || !order.seatId) return;

  // 1. 跑馬燈即時快報
  updateMarquee(`⚡【${order.seatId} 號】剛點了「${order.mealName}」($${order.price}元)！全班總計已同步更新`);

  // 2. 醒目頂部推播橫幅（全班所有不同裝置立即彈出）
  triggerLivePushBanner(
    `📢 ${deviceLabel || '同學'} 剛送出點餐！`,
    `【${order.seatId} 號】點了「${order.mealName}」($${order.price}元)！`
  );

  // 3. 浮動 Toast 提示
  showToast(`🔔 [${order.seatId}號] 剛點了餐！`, `餐點：${order.mealName} ($${order.price}元)`);

  // 4. 清脆提示音效
  playSuccessChime();

  // 5. 手機震動提示 (支援震動的裝置)
  if (navigator.vibrate) {
    try { navigator.vibrate([150, 80, 150]); } catch (e) { }
  }

  // 6. 課桌卡片即時綠光脈衝
  pulseDeskCard(order.seatId);

  // 7. 瀏覽器分頁標籤閃爍（就算切換到別的視窗也能一眼看到誰點餐）
  flashPageTitle(`🔔【${order.seatId}號 點了 ${order.mealName}】`);

  // 8. 系統級桌面/手機通知（背景最小化也能跳通知）
  triggerDesktopNotification(`🍱【${order.seatId}號 點餐通知】`, `${order.seatId} 號同學點了「${order.mealName}」($${order.price}元)`);
}

// 螢幕任一互動即自動解鎖 Web Audio 與要求通知權限（解決手機/瀏覽器未觸碰靜音問題）
function unlockAudioAndPermissions() {
  getAudioContext();
  requestNotificationPermission();
}
window.addEventListener('click', unlockAudioAndPermissions, { passive: true });
window.addEventListener('touchstart', unlockAudioAndPermissions, { passive: true });

function addActivityItem(type, title, desc, time) {
  const item = { type, title, desc, time: time || getNowTime() };
  AppState.activityFeed.unshift(item);
  if (AppState.activityFeed.length > 30) AppState.activityFeed.pop();
  persistOrders();
  renderActivityFeed();
  updateMarquee(title + "：" + desc);
}

function getNowTime() {
  const d = new Date();
  const Y = d.getFullYear();
  const M = String(d.getMonth() + 1).padStart(2, '0');
  const D = String(d.getDate()).padStart(2, '0');
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  const s = String(d.getSeconds()).padStart(2, '0');
  return `${Y}/${M}/${D} ${h}:${m}:${s}`;
}

// =========================================================
// 核心即時雲端同步引擎 (Port 443 WSS + HTTP 全網無阻擋即時通道)
// 保證手機、平板、學校 Wi-Fi 與 4G/5G 毫秒級全班互通，打開立刻看見誰點餐！
// =========================================================
const CLOUD_SYNC_TOPIC = "zg_cs1ren_lunch_orders_live_2026";
let cloudWs = null;
let _cloudWsReconnectTimer = null;

// 防抖計時器：避免短時間內多次觸發 publishFullStateToCloud
let _fullStatePublishTimer = null;

// 向 ntfy 發布完整全量狀態快照，供其他裝置重建最新狀態
// 這是確保「立即同步」的核心：不只發事件，也發快照
function publishFullStateToCloud(delayMs = 300) {
  if (_fullStatePublishTimer) clearTimeout(_fullStatePublishTimer);
  _fullStatePublishTimer = setTimeout(() => {
    _fullStatePublishTimer = null;
    try {
      const snapshot = {
        type: 'FULL_STATE',
        orders: sanitizeOrders(AppState.orders),
        resetEpoch: getResetEpoch(),
        updatedAt: Date.now(),
        senderId: DEVICE_ID,
        deviceLabel: DEVICE_LABEL
      };
      fetch(`https://ntfy.sh/${CLOUD_SYNC_TOPIC}`, {
        method: 'POST',
        headers: { 'Title': 'full_state', 'Priority': 'urgent' },
        body: JSON.stringify(snapshot)
      }).catch(() => {});
    } catch (e) {}
  }, delayMs);
}

async function fetchCloudOrderHistory() {
  try {
    // 拉取最近 24 小時所有訊息（含 FULL_STATE 快照與事件）
    const res = await fetch(`https://ntfy.sh/${CLOUD_SYNC_TOPIC}/json?poll=1&since=24h`);
    if (!res.ok) return;
    const text = await res.text();
    if (!text || !text.trim()) return;
    const lines = text.trim().split('\n');
    const now = Date.now();

    // ── 第一步：找出最新的 FULL_STATE 快照 ──
    let latestSnapshot = null;
    let latestSnapshotTime = 0;

    for (const line of lines) {
      try {
        const item = JSON.parse(line);
        if (item.event === 'message' && item.message) {
          const payload = JSON.parse(item.message);
          if (payload && payload.type === 'FULL_STATE' && payload.senderId !== DEVICE_ID) {
            const epoch = Number(payload.updatedAt || 0);
            if (epoch > latestSnapshotTime) {
              latestSnapshotTime = epoch;
              latestSnapshot = payload;
              latestSnapshot._ntfyTime = Number(item.time || 0) * 1000; // ntfy 時間為秒
            }
          }
        }
      } catch (err) {}
    }

    // ── 第二步：若找到快照，優先採用（這是最可靠的全量狀態）──
    let hasChanges = false;
    if (latestSnapshot && latestSnapshot.orders) {
      const snapshotEpoch = Number(latestSnapshot.resetEpoch || 0);
      const localEpoch = getResetEpoch();

      // 快照的 resetEpoch 比本機新 → 本機需要重置
      if (snapshotEpoch > localEpoch) {
        setResetEpoch(snapshotEpoch);
        AppState.orders = {};
        AppState.activityFeed = [];
      }

      // 以快照訂單為基礎，更新本機狀態
      const snapshotOrders = sanitizeOrders(latestSnapshot.orders);

      // 刪除本機有但快照沒有的（已取消的）
      for (const seatId in AppState.orders) {
        if (!snapshotOrders[seatId]) {
          delete AppState.orders[seatId];
          hasChanges = true;
        }
      }
      // 加入快照有但本機沒有的（未同步到的）
      for (const seatId in snapshotOrders) {
        const incoming = snapshotOrders[seatId];
        if (!isOrderStillValid(incoming, now)) continue;
        const local = AppState.orders[seatId];
        if (!local || Number(incoming.timestamp || 0) > Number(local.timestamp || 0)) {
          AppState.orders[seatId] = incoming;
          hasChanges = true;
        }
      }
    }

    // ── 第三步：在快照之後的增量事件補充（補抓快照後發生的訂餐/取消）──
    const snapshotCutoff = latestSnapshot ? latestSnapshot._ntfyTime : 0;
    let newOrderCount = 0;

    for (const line of lines) {
      try {
        const item = JSON.parse(line);
        if (item.event !== 'message' || !item.message) continue;
        const msgTime = Number(item.time || 0) * 1000;
        // 只處理快照之後的事件（避免重放快照前已確認取消的訂單）
        if (snapshotCutoff > 0 && msgTime <= snapshotCutoff) continue;

        const payload = JSON.parse(item.message);
        if (!payload || !payload.type || payload.senderId === DEVICE_ID) continue;

        if (payload.type === 'ORDERS_RESET') {
          const epoch = Number(payload.resetEpoch) || 0;
          if (epoch > getResetEpoch()) {
            setResetEpoch(epoch);
            AppState.orders = {};
            AppState.activityFeed = [];
            hasChanges = true;
          }
        } else if (payload.type === 'ORDER_CREATED' && payload.data) {
          const order = payload.data;
          const seatId = Number(order.seatId);
          if (!isOrderStillValid(order, now)) continue;
          if (!isNaN(seatId) && seatId >= 1 && seatId <= 31) {
            if (!AppState.orders[seatId] || Number(order.timestamp || 0) >= Number(AppState.orders[seatId].timestamp || 0)) {
              AppState.orders[seatId] = order;
              hasChanges = true;
              newOrderCount++;
            }
          }
        } else if (payload.type === 'ORDER_CANCELLED' && payload.data) {
          const sId = Number(payload.data.seatId);
          if (AppState.orders[sId]) {
            delete AppState.orders[sId];
            hasChanges = true;
          }
        }
      } catch (err) {}
    }

    if (hasChanges) {
      persistOrders();
      renderAllViews();
      if (newOrderCount > 0) {
        console.log(`[雲端同步] 補進 ${newOrderCount} 筆最新點餐！`);
      }
    }
  } catch (e) {
    console.warn('[雲端載入] 連線略過:', e.message);
  }
}

function connectCloudWebSocket() {
  try {
    if (cloudWs && (cloudWs.readyState === WebSocket.OPEN || cloudWs.readyState === WebSocket.CONNECTING)) {
      return;
    }
    cloudWs = new WebSocket(`wss://ntfy.sh/${CLOUD_SYNC_TOPIC}/ws`);

    cloudWs.onopen = () => {
      console.log('[即時雲端] WSS 連線成功！標準 Port 443 跨網零阻擋');
      updateNetworkStatus(true, "🟢 跨裝置全班即時連線中");
      fetchCloudOrderHistory();
    };

    cloudWs.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.event === 'message' && data.message) {
          const payload = JSON.parse(data.message);
          handleRemotePayload(payload);
        }
      } catch (err) {}
    };

    cloudWs.onclose = () => {
      if (_cloudWsReconnectTimer) clearTimeout(_cloudWsReconnectTimer);
      _cloudWsReconnectTimer = setTimeout(() => {
        _cloudWsReconnectTimer = null;
        connectCloudWebSocket();
      }, 3000);
    };

    cloudWs.onerror = () => {
      try { cloudWs.close(); } catch (e) {}
    };
  } catch (e) {}
}

function publishToCloudChannel(payload) {
  try {
    fetch(`https://ntfy.sh/${CLOUD_SYNC_TOPIC}`, {
      method: 'POST',
      headers: {
        'Title': 'lunch_order',
        'Priority': 'urgent'
      },
      body: JSON.stringify(payload)
    }).catch(() => {});
  } catch (e) {}
}

// =========================================================
// 跨裝置同步引擎 (雲端標準 443 埠 + MQTT + WebSocket + BroadcastChannel)
// =========================================================
function initSyncEngine() {
  if (typeof BroadcastChannel !== 'undefined') {
    broadcastChannel = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
    broadcastChannel.onmessage = (event) => {
      handleRemotePayload(event.data);
    };
  }

  window.addEventListener('storage', (e) => {
    if (e.key === STORAGE_KEY) {
      loadLocalData();
      renderAllViews();
    }
  });

  // 1. 啟用標準 Port 443 雲端即時連線（零阻擋、免伺服器、全班秒同步）
  connectCloudWebSocket();
  fetchCloudOrderHistory();
  // 每 20 秒背景定期校對全班訂單，保證換網路或鎖定解鎖後 100% 補全
  setInterval(fetchCloudOrderHistory, 20000);

  // 2. 備援 MQTT 連線
  connectMQTT();

  // 僅在本地 Node.js 伺服器模式才啟用區網 WebSocket 與輪詢，避免在 GitHub Pages 產生 404
  if (IS_LOCAL_SERVER) {
    connectLocalWebSocket();
    fetchServerOrders();
    setInterval(fetchServerOrders, 1000);
    window.addEventListener('focus', fetchServerOrders);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        fetchServerOrders();
        if (!localWs || localWs.readyState !== WebSocket.OPEN) {
          connectLocalWebSocket();
        }
      }
    });
  }
}

function getMqttConnectFn() {
  if (typeof mqtt !== 'undefined') {
    if (typeof mqtt.connect === 'function') return mqtt.connect.bind(mqtt);
    if (mqtt.default && typeof mqtt.default.connect === 'function') return mqtt.default.connect.bind(mqtt.default);
  }
  if (typeof window.mqtt !== 'undefined') {
    if (typeof window.mqtt.connect === 'function') return window.mqtt.connect.bind(window.mqtt);
    if (window.mqtt.default && typeof window.mqtt.default.connect === 'function') return window.mqtt.default.connect.bind(window.mqtt.default);
  }
  return null;
}

function switchMqttBroker() {
  if (_mqttReconnectTimer) return;
  _mqttReconnectTimer = setTimeout(() => {
    _mqttReconnectTimer = null;
    currentBrokerIndex = (currentBrokerIndex + 1) % MQTT_BROKERS.length;
    if (mqttClient) {
      try { mqttClient.end(true); } catch (e) { }
      mqttClient = null;
    }
    connectMQTT();
  }, 2500);
}

function connectMQTT() {
  const connectFn = getMqttConnectFn();
  if (!connectFn) {
    if (!window._mqttRetryCount) window._mqttRetryCount = 0;
    if (window._mqttRetryCount < 40) {
      window._mqttRetryCount++;
      updateNetworkStatus(false, "🟡 正在載入跨裝置即時模組...");
      setTimeout(connectMQTT, 250);
      return;
    }
    updateNetworkStatus(false, "🔴 雲端模組載入失敗 (請檢查網路或重新整理)");
    return;
  }

  if (mqttClient && mqttClient.connected) return;

  const currentBroker = MQTT_BROKERS[currentBrokerIndex];
  updateNetworkStatus(false, "🟡 正在連線全班即時雲端...");

  try {
    const clientId = 'zg_' + Math.random().toString(16).substring(2, 10);
    mqttClient = connectFn(currentBroker, {
      clientId: clientId,
      clean: true,
      connectTimeout: 8000,
      reconnectPeriod: 4000
    });

    mqttClient.on('connect', () => {
      updateNetworkStatus(true, "🟢 跨裝置全班即時連線中");
      mqttClient.subscribe(MQTT_TOPIC_EVENT);
      mqttClient.subscribe(MQTT_TOPIC_STATE);
      mqttClient.subscribe(MQTT_TOPIC_REQ);
      mqttClient.publish(MQTT_TOPIC_REQ, JSON.stringify({ reqFrom: DEVICE_ID }));
      flushPendingBroadcasts();
      if (Object.keys(AppState.orders).length > 0) {
        publishFullStateToMQTT();
      }
    });

    mqttClient.on('message', (topic, message) => {
      try {
        const payload = JSON.parse(message.toString());
        const currentEpoch = getResetEpoch();

        if (topic === MQTT_TOPIC_STATE) {
          if (payload) {
            // ── 版本檢查 1：resetEpoch（世代）──
            const incomingEpoch = Number(payload.resetEpoch || 0);
            if (currentEpoch > 0 && incomingEpoch < currentEpoch) {
              publishFullStateToMQTT();
              return;
            }

            const incomingUpdatedAt = Number(payload.updatedAt || 0);

            if (payload.cleared === true) {
              if (location.protocol.startsWith('http') && IS_LOCAL_SERVER) {
                return;
              }
              AppState.orders = {};
              AppState.activityFeed = [];
              AppState.stateTimestamp = incomingUpdatedAt || Date.now();
              persistOrders();
              publishFullStateToMQTT();
              renderAllViews();
              return;
            }

            if (payload.orders) {
              const newOrders = sanitizeOrders(payload.orders);
              let missedCount = 0;
              let hasNewChanges = false;

              // 合併雲端收到的所有座號訂單
              for (const seatId in newOrders) {
                const incomingOrder = newOrders[seatId];
                if (!isOrderStillValid(incomingOrder, Date.now())) {
                  continue;
                }
                const localOrder = AppState.orders[seatId];
                const orderKey = `${incomingOrder.seatId}_${incomingOrder.mealId}_${incomingOrder.timestamp || incomingOrder.time}`;

                if (!localOrder) {
                  AppState.orders[seatId] = incomingOrder;
                  missedCount++;
                  hasNewChanges = true;
                  addActivityItem('order', `🔄 [雲端同步] ${incomingOrder.seatId}號`, `${incomingOrder.mealName}`, incomingOrder.time || getNowTime());

                  // 關鍵修復：若此筆訂單是最近 3 分鐘內發生的，且尚未通知過，主動觸發全班即時通知！
                  const orderAge = Date.now() - Number(incomingOrder.timestamp || Date.now());
                  if (orderAge < 180000 && !_recentlyNotifiedOrders.has(orderKey)) {
                    markOrderNotified(orderKey);
                    notifyOrderCreated(incomingOrder, incomingOrder.deviceType || '📱 雲端同步');
                  }
                } else if ((incomingOrder.timestamp || 0) > (localOrder.timestamp || 0)) {
                  AppState.orders[seatId] = incomingOrder;
                  hasNewChanges = true;
                  if (!_recentlyNotifiedOrders.has(orderKey)) {
                    markOrderNotified(orderKey);
                    notifyOrderCreated(incomingOrder, incomingOrder.deviceType || '📱 雲端同步');
                  }
                }
              }

              // 同步刪除：若本機有某座號，但雲端完整狀態包沒有，代表已被取消 → 同步刪除
              let localHasExtra = false;
              for (const seatId in AppState.orders) {
                if (!newOrders[seatId]) {
                  delete AppState.orders[seatId];
                  hasNewChanges = true;
                  localHasExtra = true;
                  addActivityItem('cancel', `${seatId}號 取消點餐（遠端同步）`, `座位已釋放`, getNowTime());
                }
              }

              if (hasNewChanges || localHasExtra) {
                AppState.stateTimestamp = Math.max(incomingUpdatedAt, Date.now());
                persistOrders();
                renderAllViews();
              }

              if (missedCount > 0 && !_recentlyNotifiedOrders.size) {
                showToast(`🔄 雲端即時同步`, `已為您同步 ${missedCount} 筆全班最新點餐！`);
                playSuccessChime();
              }
            }
          }
        } else if (topic === MQTT_TOPIC_EVENT) {
          handleRemotePayload(payload);
        } else if (topic === MQTT_TOPIC_REQ) {
          if (payload.reqFrom !== DEVICE_ID && Object.keys(AppState.orders).length > 0) {
            publishFullStateToMQTT();
          }
        }
      } catch (err) {
        console.warn("MQTT parse error:", err);
      }
    });

    mqttClient.on('error', (err) => {
      console.warn("MQTT 伺服器異常:", err && err.message);
      updateNetworkStatus(false, "🟡 正在切換備用即時節點...");
      switchMqttBroker();
    });

    mqttClient.on('close', () => {
      updateNetworkStatus(false, "🟡 正在重新連線雲端...");
    });

    mqttClient.on('offline', () => {
      updateNetworkStatus(false, "🟡 雲端離線重連中...");
    });
  } catch (e) {
    console.error("MQTT 初始化異常:", e);
    switchMqttBroker();
  }
}

// 自動辨識伺服器網址（支援 http、手機 IP 或直接點開 file://）
function getServerBaseUrl() {
  if (location.protocol.startsWith('http')) return location.origin;
  return 'http://localhost:3000';
}

function getServerWsUrl() {
  if (location.protocol === 'https:') return `wss://${location.host}/ws`;
  if (location.protocol.startsWith('http')) return `ws://${location.host}/ws`;
  return 'ws://localhost:3000/ws';
}

let _wsHeartbeatTimer = null;
function connectLocalWebSocket() {
  try {
    if (localWs && (localWs.readyState === WebSocket.OPEN || localWs.readyState === WebSocket.CONNECTING)) {
      return;
    }
    const wsUrl = getServerWsUrl();
    localWs = new WebSocket(wsUrl);

    localWs.onopen = () => {
      updateNetworkStatus(true, "🟢 班級區網高速同步中");
      // 連線成功時主動向伺服器請求全量最新同步
      try {
        localWs.send(JSON.stringify({ type: 'REQ_SYNC', senderId: DEVICE_ID }));
      } catch (e) { }
      fetchServerOrders();

      // 每 15 秒發送客戶端 Ping 心跳，維持手機 AP 連線不睡眠
      if (_wsHeartbeatTimer) clearInterval(_wsHeartbeatTimer);
      _wsHeartbeatTimer = setInterval(() => {
        if (localWs && localWs.readyState === WebSocket.OPEN) {
          try { localWs.send(JSON.stringify({ type: 'PING' })); } catch (e) { }
        }
      }, 15000);
    };

    localWs.onmessage = (e) => {
      try {
        const payload = JSON.parse(e.data);
        if (payload.type === 'PONG') return;
        handleRemotePayload(payload);
      } catch (err) { }
    };

    // 斷線後立即自動重連
    localWs.onclose = () => {
      updateNetworkStatus(false, "🟡 區網重新連線中...");
      if (_wsHeartbeatTimer) {
        clearInterval(_wsHeartbeatTimer);
        _wsHeartbeatTimer = null;
      }
      localWs = null;
      setTimeout(() => {
        if (location.protocol.startsWith('http')) {
          connectLocalWebSocket();
        }
      }, 2000);
    };

    localWs.onerror = () => {
      updateNetworkStatus(false, "🟡 區網連線異常");
      try { localWs.close(); } catch (e) { }
    };
  } catch (e) { }
}

// 核心函式：自伺服器取得全量訂單（每 1 秒極速靜默同步，保證免按重新整理！）
let _isFetchingServerOrders = false;
async function fetchServerOrders() {
  if (_isFetchingServerOrders) return;
  _isFetchingServerOrders = true;
  try {
    const res = await fetch(`${getServerBaseUrl()}/api/orders`, { cache: 'no-store' });
    if (!res.ok) return;
    const data = await res.json();
    if (!data || !data.success) return;

    const serverEpoch = Number(data.lastResetEpoch || 0);
    const localEpoch = getResetEpoch();

    // 若伺服器已進行過較新的重置
    if (serverEpoch > 0 && serverEpoch > localEpoch) {
      setResetEpoch(serverEpoch);
      AppState.orders = {};
      AppState.activityFeed = [];
      persistOrders();
      renderAllViews();
      renderActivityFeed();
      return;
    }

    const serverOrders = sanitizeOrders(data.orders || {});
    const localKeys = Object.keys(AppState.orders);
    const serverKeys = Object.keys(serverOrders);

    let hasDiff = localKeys.length !== serverKeys.length;
    if (!hasDiff) {
      for (const k of serverKeys) {
        if (!AppState.orders[k] || AppState.orders[k].mealId !== serverOrders[k].mealId) {
          hasDiff = true;
          break;
        }
      }
    }

    if (hasDiff) {
      let missedCount = 0;
      for (const k of serverKeys) {
        if (!AppState.orders[k]) missedCount++;
      }
      AppState.orders = serverOrders;
      if (Array.isArray(data.activityFeed) && data.activityFeed.length > 0) {
        AppState.activityFeed = data.activityFeed;
        renderActivityFeed();
      }
      persistOrders();
      renderAllViews();

      if (missedCount > 0 && localKeys.length > 0) {
        showToast('🔄 即時同步', `已及時補進 ${missedCount} 筆全班最新點餐！`);
        playSuccessChime();
      }
    }
  } catch (e) {
    // 離線或非伺服器模式，靜默略過
  } finally {
    _isFetchingServerOrders = false;
  }
}

function updateNetworkStatus(online, text) {
  const badge = document.getElementById("network-status-badge");
  if (badge) {
    badge.innerHTML = `<span class="live-dot" style="background-color: ${online ? '#10b981' : '#f59e0b'};"></span> ${text}`;
  }
}

function publishFullStateToMQTT() {
  if (mqttClient && mqttClient.connected) {
    try {
      // updatedAt 為 Unix ms 版本號，供接收端判斷是否比本機狀態新
      const now = Date.now();
      if (now > AppState.stateTimestamp) AppState.stateTimestamp = now;
      mqttClient.publish(MQTT_TOPIC_STATE, JSON.stringify({
        orders: sanitizeOrders(AppState.orders),
        resetEpoch: getResetEpoch(),
        updatedBy: DEVICE_ID,
        updatedAt: AppState.stateTimestamp,
        time: getNowTime()
      }), { retain: true, qos: 1 });
    } catch (e) { }
  }
}

const _pendingBroadcasts = [];

function flushPendingBroadcasts() {
  if (!mqttClient || !mqttClient.connected) return;
  while (_pendingBroadcasts.length > 0) {
    const payload = _pendingBroadcasts.shift();
    try {
      mqttClient.publish(MQTT_TOPIC_EVENT, JSON.stringify(payload), { qos: 1 });
    } catch (e) { }
  }
  publishFullStateToMQTT();
}

function broadcastToAllDevices(type, data) {
  const payload = {
    type: type,
    data: data,
    resetEpoch: getResetEpoch(),
    senderId: DEVICE_ID,
    deviceLabel: DEVICE_LABEL,
    time: getNowTime()
  };

  if (broadcastChannel) {
    try { broadcastChannel.postMessage(payload); } catch (e) { }
  }

  // 核心：標準 Port 443 雲端推播發布（全班手機與電腦 0 阻擋立即跳通知）
  publishToCloudChannel(payload);

  if (mqttClient && mqttClient.connected) {
    try {
      mqttClient.publish(MQTT_TOPIC_EVENT, JSON.stringify(payload), { qos: 1 });
      publishFullStateToMQTT();
    } catch (e) { }
  } else {
    // 尚未連線完成時暫存隊列，連線一建立立即發送，確保零延遲、零漏發
    _pendingBroadcasts.push(payload);
  }

  if (localWs && localWs.readyState === WebSocket.OPEN) {
    try { localWs.send(JSON.stringify(payload)); } catch (e) { }
  }
}

function handleRemotePayload(payload) {
  if (!payload || !payload.type) return;
  if (payload.senderId === DEVICE_ID) return;

  // 伺服器全量狀態下發 (STATE_INIT)
  if (payload.type === 'STATE_INIT') {
    if (payload.data) {
      const serverEpoch = Number(payload.data.resetEpoch || payload.resetEpoch || 0);
      if (serverEpoch > currentEpoch) {
        setResetEpoch(serverEpoch);
        AppState.orders = {};
        AppState.activityFeed = [];
      }
      if (payload.data.orders) {
        AppState.orders = sanitizeOrders(payload.data.orders);
      }
      if (Array.isArray(payload.data.activityFeed) && payload.data.activityFeed.length > 0) {
        AppState.activityFeed = payload.data.activityFeed;
        renderActivityFeed();
      }
      persistOrders();
      renderAllViews();
    }
    return;
  }

  // ntfy 全量快照 (FULL_STATE) - 優先採用作為最新授權狀態
  if (payload.type === 'FULL_STATE') {
    if (!payload.orders) return;
    const incomingEpoch = Number(payload.resetEpoch || 0);
    const localEpoch = getResetEpoch();
    if (incomingEpoch > localEpoch) {
      setResetEpoch(incomingEpoch);
      AppState.orders = {};
      AppState.activityFeed = [];
    }
    const now = Date.now();
    const snapshotOrders = sanitizeOrders(payload.orders);
    let changed = false;
    // 刪除本機有但快照沒有的（已被取消）
    for (const seatId in AppState.orders) {
      if (!snapshotOrders[seatId]) {
        delete AppState.orders[seatId];
        changed = true;
      }
    }
    // 合入快照有的（未同步到的）
    for (const seatId in snapshotOrders) {
      const incoming = snapshotOrders[seatId];
      if (!isOrderStillValid(incoming, now)) continue;
      const local = AppState.orders[seatId];
      if (!local || Number(incoming.timestamp || 0) > Number(local.timestamp || 0)) {
        AppState.orders[seatId] = incoming;
        changed = true;
      }
    }
    if (changed) {
      persistOrders();
      renderAllViews();
    }
    return;
  }

  if (payload.type === 'ORDERS_RESET') {
    if (payload.resetEpoch) setResetEpoch(payload.resetEpoch);
    AppState.orders = {};
    AppState.activityFeed = [];
    AppState.stateTimestamp = 0; // 歸零，確保後續新訂單的 updatedAt 必然比重置後更新
    persistOrders();
    // 立即用空狀態覆寫 MQTT retained 訊息，避免新裝置連線時仍收到上週舊資料
    publishFullStateToMQTT();
    renderAllViews();
    const operatorLabel = (payload.data && payload.data.operatorSeat)
      ? `${payload.data.operatorSeat}號`
      : ((payload.data && payload.data.operatorLabel) ? payload.data.operatorLabel : (payload.deviceLabel || '其他裝置'));
    triggerLivePushBanner(`🔄 全班訂餐紀錄已重置`, `${operatorLabel} 重置了班上整個訂單，所有座位已重新開放`);
    showToast(`🔄 系統通知`, `${operatorLabel} 重置了班上整個訂單`, true);
    // 清空後重新加入這筆重置紀錄至動態牆
    addActivityItem('reset', `🔄 ${operatorLabel} 重置了班上整個訂單`, `所有座位已重新開放`, getNowTime());
    return;
  } else if (payload.type === 'ORDER_CREATED') {
    const order = payload.data;
    if (!order || !order.seatId) return;
    const seatId = Number(order.seatId);
    const orderKey = `${seatId}_${order.mealId}_${order.timestamp || order.time}`;

    AppState.orders[seatId] = order;
    persistOrders();

    // 零延遲立即同步畫面
    renderAllViews();

    // 關鍵修復：只要這筆訂單在最近未播報過，保證 100% 觸發全班通知，絕不再被狀態覆蓋阻擋！
    if (!_recentlyNotifiedOrders.has(orderKey)) {
      markOrderNotified(orderKey);
      notifyOrderCreated(order, payload.deviceLabel);
      addActivityItem('order', `${order.seatId}號 點餐`, `${order.mealName} ($${order.price}元)`, order.time);
    }
    // 收到新訂單後也發布全量快照，確保自己是最新的授權狀態源
    publishFullStateToCloud(500);
  } else if (payload.type === 'ORDER_CANCELLED') {
    const { seatId } = payload.data;
    const sId = Number(seatId);
    // 無論本機是否有記錄到該筆訂單（可能漏接 ORDER_CREATED），
    // 都要執行刪除並顯示通知，避免「訂單靜默消失」問題
    const hadOrder = !!AppState.orders[sId];
    delete AppState.orders[sId];
    persistOrders();
    renderAllViews();

    triggerLivePushBanner(`⚠️ 取消點餐推播`, `【${sId} 號】已取消點餐，座位已重新釋放`);
    showToast(`⚠️ [${sId}號] 取消了點餐`, `該座位已重新開放點餐`, true);
    playCancelChime();
    addActivityItem('cancel', `${sId}號 取消點餐`, hadOrder ? `座位已釋放` : `（補接到取消事件，座位已確認釋放）`, getNowTime());
  }
}

function pulseDeskCard(seatId) {
  const desk = document.getElementById(`desk-seat-${Number(seatId)}`);
  if (desk) {
    desk.classList.add('pulse-highlight');
    setTimeout(() => desk.classList.remove('pulse-highlight'), 4000);
  }
}

let bannerTimeout = null;
function triggerLivePushBanner(badgeText, mainText) {
  const banner = document.getElementById("live-broadcast-banner");
  const badgeEl = document.getElementById("banner-badge-text");
  const textEl = document.getElementById("banner-main-text");
  if (!banner || !badgeEl || !textEl) return;

  badgeEl.textContent = badgeText;
  textEl.textContent = mainText;
  banner.classList.add("active");

  if (bannerTimeout) clearTimeout(bannerTimeout);
  bannerTimeout = setTimeout(() => banner.classList.remove("active"), 6500);
}

function closeBroadcastBanner() {
  const banner = document.getElementById("live-broadcast-banner");
  if (banner) banner.classList.remove("active");
}

function updateMarquee(text) {
  const marquee = document.getElementById("live-marquee-text");
  if (marquee) marquee.textContent = text;
}

function showToast(title, msg, isCancel = false) {
  const container = document.getElementById("toast-container");
  if (!container) return;

  const toast = document.createElement("div");
  toast.className = `toast-item ${isCancel ? 'cancel-toast' : ''}`;
  toast.innerHTML = `
    <div class="toast-icon">${isCancel ? '⚠️' : '📢'}</div>
    <div class="toast-content">
      <div class="toast-title">${title}</div>
      <div class="toast-msg">${msg}</div>
    </div>
  `;
  container.appendChild(toast);

  setTimeout(() => {
    if (toast.parentNode === container) container.removeChild(toast);
  }, 5000);
}

// 瀏覽器分頁標籤閃爍通知（切換到其他分頁或視窗也能一眼看到誰點餐）
let _titleFlashInterval = null;
const ORIGINAL_PAGE_TITLE = document.title || "智光高級商工職業學校資處科一仁午餐訂餐系統";

function flashPageTitle(message) {
  try {
    if (_titleFlashInterval) clearInterval(_titleFlashInterval);
    let showNotice = true;
    let count = 0;
    _titleFlashInterval = setInterval(() => {
      document.title = showNotice ? message : ORIGINAL_PAGE_TITLE;
      showNotice = !showNotice;
      count++;
      if (count > 24) { // 閃爍 12 秒後自動復原標題
        clearInterval(_titleFlashInterval);
        _titleFlashInterval = null;
        document.title = ORIGINAL_PAGE_TITLE;
      }
    }, 500);
  } catch (e) { }
}

window.addEventListener('focus', () => {
  if (_titleFlashInterval) {
    clearInterval(_titleFlashInterval);
    _titleFlashInterval = null;
    document.title = ORIGINAL_PAGE_TITLE;
  }
});

// 桌面 / 手機系統級推播通知 (HTML5 Web Notifications API)
function requestNotificationPermission() {
  try {
    if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => { });
    }
  } catch (e) { }
}

function triggerDesktopNotification(title, body) {
  try {
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      const notif = new Notification(title, {
        body: body,
        icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">🍱</text></svg>',
        tag: 'lunch-order-' + Date.now()
      });
      setTimeout(() => { try { notif.close(); } catch (e) { } }, 6000);
    }
  } catch (e) { }
}

// =========================================================
// 畫面渲染與事件互動
// =========================================================

function renderMenuCatalog() {
  const container = document.getElementById("menu-items-grid");
  if (!container) return;
  container.innerHTML = "";

  MENU_ITEMS.forEach(item => {
    const card = document.createElement("div");
    card.className = `menu-card ${AppState.selectedMealId === item.id ? 'selected' : ''}`;
    card.id = `menu-card-${item.id}`;
    card.onclick = () => selectMenuItem(item.id);

    card.innerHTML = `
      <div class="menu-card-header">
        <div class="menu-icon">${item.icon}</div>
        <div class="menu-radio-check"></div>
      </div>
      <div>
        <div class="menu-name">${item.name}</div>
      </div>
      <div class="menu-price">$${item.price}<span>元</span></div>
    `;
    container.appendChild(card);
  });
}

function selectMenuItem(mealId) {
  AppState.selectedMealId = mealId;
  document.querySelectorAll(".menu-card").forEach(c => c.classList.remove("selected"));
  const activeCard = document.getElementById(`menu-card-${mealId}`);
  if (activeCard) activeCard.classList.add("selected");
  updateOrderSummaryBar();
}

function renderSeatOptions() {
  const select = document.getElementById("seat-select");
  if (!select) return;
  const currentVal = select.value;

  select.innerHTML = `<option value="">-- 請選擇座號 --</option>`;
  STUDENTS.forEach(student => {
    const isOrdered = !!AppState.orders[Number(student.id)];
    const option = document.createElement("option");
    option.value = String(student.id);
    option.textContent = `${student.id} 號 ${isOrdered ? '【已點餐】' : ''}`;
    select.appendChild(option);
  });

  if (currentVal) select.value = currentVal;
}

function handleSeatChange() {
  const seatSelect = document.getElementById("seat-select");
  const seatId = Number(seatSelect ? seatSelect.value : 0);
  const student = STUDENTS.find(s => Number(s.id) === seatId);

  const nameInput = document.getElementById("student-name-display");
  const passwordHint = document.getElementById("password-hint");
  const statusBox = document.getElementById("current-student-status");
  const cancelSection = document.getElementById("cancel-order-section");

  if (!student) {
    if (nameInput) nameInput.value = "";
    if (passwordHint) passwordHint.textContent = "提示：預設密碼為座號";
    if (statusBox) statusBox.style.display = "none";
    if (cancelSection) cancelSection.style.display = "none";
    updateOrderSummaryBar();
    return;
  }

  if (nameInput) nameInput.value = "";
  if (passwordHint) passwordHint.textContent = `提示：${student.id} 號同學的密碼即為座號「${student.id}」`;

  const order = AppState.orders[seatId];
  if (order) {
    if (statusBox) {
      statusBox.style.display = "flex";
      statusBox.innerHTML = `
        <div class="status-badge-row">
          <span style="font-weight: 700; color: #34d399;">已點餐狀態</span>
          <span class="status-tag ordered">已完成點餐</span>
        </div>
        <div style="font-size: 0.95rem; font-weight: 800; color: var(--text-main);">
          已點：${order.mealName}
        </div>
        <div style="font-size: 0.85rem; color: var(--text-muted); display: flex; justify-content: space-between;">
          <span>金額：$${order.price} 元</span>
          <span>時間：${formatOrderDisplayTime(order)}</span>
        </div>
      `;
    }
    if (cancelSection) cancelSection.style.display = "flex";
  } else {
    if (statusBox) {
      statusBox.style.display = "flex";
      statusBox.innerHTML = `
        <div class="status-badge-row">
          <span style="font-weight: 700; color: var(--text-muted);">點餐狀態</span>
          <span class="status-tag unorder">尚未點餐</span>
        </div>
        <div style="font-size: 0.88rem; color: var(--text-muted);">
          一人限點一份餐點，請在右方選取餐點後點擊「送出訂單」。
        </div>
      `;
    }
    if (cancelSection) cancelSection.style.display = "none";
  }

  updateOrderSummaryBar();
}

function updateOrderSummaryBar() {
  const seatSelect = document.getElementById("seat-select");
  const seatId = Number(seatSelect ? seatSelect.value : 0);
  const student = STUDENTS.find(s => Number(s.id) === seatId);
  const meal = MENU_ITEMS.find(m => m.id === AppState.selectedMealId);

  const summarySeat = document.getElementById("summary-seat-name");
  const summaryMeal = document.getElementById("summary-meal-name");
  const summaryPrice = document.getElementById("summary-price-total");
  const submitBtn = document.getElementById("submit-order-btn");

  const isOrdered = seatId && AppState.orders[seatId];

  if (summarySeat) {
    summarySeat.textContent = student ? `${student.id} 號` : "尚未選擇座號";
  }

  if (summaryMeal) {
    summaryMeal.textContent = meal ? meal.name : "未選餐點";
  }

  if (summaryPrice) {
    summaryPrice.textContent = meal ? `$${meal.price} 元` : "$0 元";
  }

  if (submitBtn) {
    if (!student || !meal || isOrdered) {
      submitBtn.disabled = true;
      if (isOrdered) {
        submitBtn.innerHTML = `⚠️ 該座號已點過餐（一人限點一份）`;
      } else {
        submitBtn.innerHTML = `<span>🚀 送出訂單</span>`;
      }
    } else {
      submitBtn.disabled = false;
      submitBtn.innerHTML = `<span>🚀 確認送出訂單 ($${meal.price} 元)</span>`;
    }
  }
}

function handleSubmitOrder() {
  getAudioContext();
  requestNotificationPermission();
  const seatSelect = document.getElementById("seat-select");
  const seatId = Number(seatSelect ? seatSelect.value : 0);
  const passwordInput = document.getElementById("order-password");
  const password = passwordInput ? passwordInput.value.trim() : "";

  const student = STUDENTS.find(s => Number(s.id) === seatId);
  if (!student) {
    alert("請先選擇座號！");
    return;
  }

  if (AppState.orders[seatId]) {
    alert(`座號 ${student.id} 號 已經點過餐點囉！一人只能點一份餐點。\n如需更改，請先清除原有點餐。`);
    return;
  }

  const meal = MENU_ITEMS.find(m => m.id === AppState.selectedMealId);
  if (!meal) {
    alert("請先在右方選擇您要訂購的餐點！");
    return;
  }

  // 嚴格型態比對座號密碼
  if (String(password) !== String(student.id)) {
    alert(`訂餐密碼驗證錯誤！\n訂餐密碼即為您的座號：「${student.id}」，請輸入正確座號後再送出。`);
    if (passwordInput) {
      passwordInput.focus();
      passwordInput.select();
    }
    return;
  }

  const timeStr = getNowTime();
  const newOrder = {
    seatId: Number(student.id),
    mealId: String(meal.id),
    mealName: meal.name,
    price: Number(meal.price),
    time: timeStr,
    deviceType: DEVICE_LABEL,
    timestamp: Date.now()
  };

  const orderKey = `${newOrder.seatId}_${newOrder.mealId}_${newOrder.timestamp}`;
  markOrderNotified(orderKey);

  AppState.orders[Number(student.id)] = newOrder;
  persistOrders();

  // 1. 本地廣播推播（立即同步同裝置上的其他分頁）
  broadcastToAllDevices('ORDER_CREATED', newOrder);
  // 點餐後立即發布全量快照至 ntfy，讓所有裝置立刻看到最新完整狀態
  publishFullStateToCloud(0);

  // 2. 雙重保證：若在本地伺服器模式，向伺服器發送 POST /api/order，寫入 orders.json 持久化
  if (IS_LOCAL_SERVER) {
    fetch(`${getServerBaseUrl()}/api/order`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ order: newOrder })
    }).then(r => r.json()).then(res => {
      if (res && res.success && res.orders) {
        AppState.orders = sanitizeOrders(res.orders);
        persistOrders();
        renderAllViews();
      }
    }).catch(e => console.warn('POST /api/order 異常:', e.message));
  }

  renderAllViews();
  showToast(`🎉 點餐成功！[${student.id}號]`, `已訂購：${meal.name} ($${meal.price}元)`);
  playSuccessChime();
  pulseDeskCard(student.id);
  addActivityItem('order', `${student.id}號 點餐`, `${meal.name} ($${meal.price}元)`, timeStr);

  if (passwordInput) passwordInput.value = "";
}

function handleCancelOrder() {
  const seatSelect = document.getElementById("seat-select");
  const seatId = Number(seatSelect ? seatSelect.value : 0);
  const passwordInput = document.getElementById("cancel-password");
  const password = passwordInput ? passwordInput.value.trim() : "";

  const student = STUDENTS.find(s => Number(s.id) === seatId);
  if (!student) {
    alert("請先選擇要取消點餐的座號！");
    return;
  }

  if (!AppState.orders[seatId]) {
    alert(`座號 ${student.id} 號 目前尚未點餐，無需清除！`);
    return;
  }

  if (String(password) !== String(student.id)) {
    alert(`清除密碼錯誤！\n為防止他人不小心誤刪您的點餐，清除點餐密碼為您的座號「${student.id}」。`);
    if (passwordInput) {
      passwordInput.focus();
      passwordInput.select();
    }
    return;
  }

  const confirmed = confirm(`確認要清除【${student.id} 號】的點餐紀錄嗎？\n清除後該座號即可重新選取餐點。`);
  if (!confirmed) return;

  cancelOrder(seatId);

  if (passwordInput) passwordInput.value = "";
}

function selectStudentBySeatId(seatId) {
  const sId = Number(seatId);
  const seatSelect = document.getElementById("seat-select");
  if (seatSelect) {
    seatSelect.value = String(sId);
    handleSeatChange();
    switchTab('order');
    window.scrollTo({ top: 120, behavior: 'smooth' });
  }
}

// =========================================================
// 座位表即時對照圖渲染（6 排 31 人）
// =========================================================
function renderSeatingChart() {
  const container = document.getElementById("seating-classroom-grid");
  if (!container) return;

  // 首次渲染（容器為空）→ 全量建立 DOM
  const isFirstRender = container.children.length === 0;

  if (isFirstRender) {
    // 全量建立：建立完整 6 排 31 個課桌
    container.innerHTML = "";
    for (let r = 1; r <= 6; r++) {
      const rowStudents = STUDENTS.filter(s => Number(s.row) === r);
      const rowWrapper = document.createElement("div");
      rowWrapper.className = "seating-row-wrapper";

      const header = document.createElement("div");
      header.className = "row-header-label";
      header.innerHTML = `<span>第 ${r} 排</span> <span style="font-size: 0.8rem; color: var(--text-muted); font-weight: normal;">(${rowStudents.length} 人)</span>`;
      rowWrapper.appendChild(header);

      const grid = document.createElement("div");
      grid.className = "seating-row-grid";

      for (let col = 0; col < 6; col++) {
        if (col < rowStudents.length) {
          const student = rowStudents[col];
          const sId = Number(student.id);
          const order = AppState.orders[sId];
          const desk = document.createElement("div");
          desk.className = `desk-card ${order ? 'ordered' : ''}`;
          desk.id = `desk-seat-${sId}`;
          desk.title = `點擊快速選擇 ${sId} 號`;
          desk.onclick = () => selectStudentBySeatId(sId);
          desk.innerHTML = _buildDeskInnerHTML(sId, order);
          grid.appendChild(desk);
        } else {
          const emptySlot = document.createElement("div");
          emptySlot.className = "desk-card empty-slot";
          emptySlot.innerHTML = `<span style="font-size: 0.8rem; color: #94a3b8;">走道 / 空位</span>`;
          grid.appendChild(emptySlot);
        }
      }

      rowWrapper.appendChild(grid);
      container.appendChild(rowWrapper);
    }
  } else {
    // 差異化更新：只更新有變動的座位，不重建整個 DOM
    STUDENTS.forEach(student => {
      const sId = Number(student.id);
      const desk = document.getElementById(`desk-seat-${sId}`);
      if (!desk) return;

      const order = AppState.orders[sId];
      const isOrdered = !!order;
      const wasOrdered = desk.classList.contains('ordered');

      // 只有狀態有變動才更新 DOM
      if (isOrdered !== wasOrdered || (isOrdered && desk.dataset.mealId !== String(order.mealId))) {
        desk.className = `desk-card ${isOrdered ? 'ordered' : ''}`;
        desk.dataset.mealId = isOrdered ? String(order.mealId) : '';
        desk.innerHTML = _buildDeskInnerHTML(sId, order);
      }
    });
  }
}

// 抽取課桌卡片 innerHTML 的輔助函式，避免重複 template literal
function _buildDeskInnerHTML(sId, order) {
  return `
    <div class="desk-top">
      <span class="desk-seat-num">${sId} 號</span>
      <span style="font-size: 0.78rem; font-weight: 700; color: ${order ? '#34d399' : '#94a3b8'};">
        ${order ? '✅ 已點' : '⏳ 待點'}
      </span>
    </div>
    <div class="desk-student-name">${sId} 號</div>
    ${order ? `
      <div class="desk-meal-info">
        <div class="desk-meal-name">${order.mealName}</div>
        <div class="desk-meal-price">$${order.price} 元</div>
      </div>
    ` : `
      <div class="desk-empty-meal">尚未點餐</div>
    `}
  `;
}



// =========================================================
// 後端管理統計面板渲染
// =========================================================
function renderAdminDashboard() {
  const orderedKeys = Object.keys(AppState.orders);
  const orderedCount = orderedKeys.length;
  const totalStudents = STUDENTS.length;
  const unorderCount = totalStudents - orderedCount;

  let totalAmount = 0;
  orderedKeys.forEach(key => {
    const o = AppState.orders[Number(key)];
    if (o) totalAmount += Number(o.price || 0);
  });

  const kpiOrdered = document.getElementById("kpi-ordered-count");
  const kpiAmount = document.getElementById("kpi-total-amount");
  const kpiPending = document.getElementById("kpi-pending-count");
  if (kpiOrdered) kpiOrdered.textContent = `${orderedCount} / ${totalStudents} 人`;
  if (kpiAmount) kpiAmount.textContent = `$${totalAmount.toLocaleString()} 元`;
  if (kpiPending) kpiPending.textContent = `${unorderCount} 人`;

  const printFooterOrdered = document.getElementById("print-footer-ordered");
  const printFooterTotal = document.getElementById("print-footer-total");
  if (printFooterOrdered) printFooterOrdered.textContent = `全班 31 人，已訂餐：${orderedCount} 人`;
  if (printFooterTotal) printFooterTotal.textContent = `總金額：$${totalAmount} 元`;

  // 餐點排行
  const mealStatList = document.getElementById("meal-stat-list");
  if (mealStatList) {
    mealStatList.innerHTML = "";
    const counts = {};
    MENU_ITEMS.forEach(m => counts[m.id] = 0);
    orderedKeys.forEach(k => {
      const o = AppState.orders[Number(k)];
      if (o && counts[o.mealId] !== undefined) counts[o.mealId]++;
    });

    const sortedMeals = [...MENU_ITEMS].sort((a, b) => counts[b.id] - counts[a.id]);

    sortedMeals.forEach(meal => {
      const count = counts[meal.id];
      const percent = orderedCount > 0 ? (count / orderedCount) * 100 : 0;
      const subtotal = count * meal.price;

      const row = document.createElement("div");
      row.className = "meal-stat-row";
      row.innerHTML = `
        <div class="meal-stat-labels">
          <span>${meal.icon} ${meal.name} ($${meal.price})</span>
          <span><strong>${count}</strong> 份 <span style="color: var(--text-muted); font-size: 0.8rem;">($${subtotal}元)</span></span>
        </div>
        <div class="meal-stat-bar-track">
          <div class="meal-stat-bar-fill" style="width: ${percent}%;"></div>
        </div>
      `;
      mealStatList.appendChild(row);
    });
  }

  // 未點餐名單
  const unorderContainer = document.getElementById("unorder-tags-container");
  const copyUnorderBtn = document.getElementById("copy-unorder-btn");
  if (unorderContainer) {
    unorderContainer.innerHTML = "";
    const unorderedStudents = STUDENTS.filter(s => !AppState.orders[Number(s.id)]);

    if (unorderedStudents.length === 0) {
      unorderContainer.innerHTML = `<span style="color: #34d399; font-weight: 700;">🎉 全班 31 位同學均已完成點餐！</span>`;
      if (copyUnorderBtn) copyUnorderBtn.style.display = "none";
    } else {
      unorderedStudents.forEach(s => {
        const tag = document.createElement("span");
        tag.className = "unorder-student-tag";
        tag.textContent = `${s.id}號`;
        tag.style.cursor = "pointer";
        tag.onclick = () => selectStudentBySeatId(Number(s.id));
        unorderContainer.appendChild(tag);
      });
      if (copyUnorderBtn) {
        copyUnorderBtn.style.display = "inline-flex";
        copyUnorderBtn.onclick = () => {
          const listText = unorderedStudents.map(s => `${s.id}號`).join("、");
          navigator.clipboard.writeText(`【資處一仁午餐未點餐同學提醒】\n共 ${unorderedStudents.length} 人尚未點餐：\n${listText}`);
          alert("已複製未點餐名單至剪貼簿！可直接貼在班級群組提醒同學。");
        };
      }
    }
  }

  // 明細表
  const tableBody = document.getElementById("admin-order-table-body");
  if (tableBody) {
    tableBody.innerHTML = "";
    STUDENTS.forEach(student => {
      const sId = Number(student.id);
      const order = AppState.orders[sId];
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td style="font-weight: 800;">${sId} 號</td>
        <td>第 ${student.row} 排</td>
        <td>${order ? `<span style="color: #34d399; font-weight: 800;">${order.mealName}</span>` : `<span style="color: var(--text-light);">尚未點餐</span>`}</td>
        <td style="font-weight: 700;">${order ? `$${order.price} 元` : '-'}</td>
        <td style="font-size: 0.85rem; color: var(--text-muted);">${order ? formatOrderDisplayTime(order) : '-'}</td>
        <td>
          ${order ? `
            <button class="action-btn" style="padding: 4px 10px; font-size: 0.8rem; background: var(--danger-light); color: var(--danger-hover);" onclick="quickAdminCancel(${sId})">
              取消
            </button>
          ` : `
            <button class="action-btn" style="padding: 4px 10px; font-size: 0.8rem; background: var(--primary-light); color: var(--primary);" onclick="selectStudentBySeatId(${sId})">
              幫點餐
            </button>
          `}
        </td>
      `;
      tableBody.appendChild(tr);
    });
  }
}

function quickAdminCancel(seatId) {
  const sId = Number(seatId);
  const pwd = prompt(`【管理員取消驗證】\n請輸入座號「${sId}」以確認取消【${sId}號】的點餐：`);
  if (String(pwd) === String(sId)) {
    cancelOrder(sId);
  } else if (pwd !== null) {
    alert("密碼輸入錯誤，取消操作已終止！");
  }
}

function exportOrdersToCSV() {
  const now = new Date();
  const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;

  // 匯出報表：座號/編號, 訂餐內容, 價格, 訂餐時間 (含完整西元年月日)
  let csvContent = "\uFEFF座號/編號,訂餐內容,價格,訂餐時間\n";
  STUDENTS.forEach(s => {
    const sId = Number(s.id);
    const o = AppState.orders[sId];
    csvContent += `"${sId}","${o ? o.mealName : ''}","${o ? o.price : ''}","${o ? formatOrderDisplayTime(o) : ''}"\n`;
  });

  csvContent += "\n--- 餐點品項數量總計 ---\n品項名稱,單價,總份數,小計金額\n";
  MENU_ITEMS.forEach(m => {
    const count = Object.values(AppState.orders).filter(o => o.mealId === m.id).length;
    if (count > 0) {
      csvContent += `"${m.name}","${m.price}","${count}","${count * m.price}"\n`;
    }
  });

  let totalAmount = 0;
  Object.values(AppState.orders).forEach(o => totalAmount += Number(o.price));
  csvContent += `\n"總計訂餐人數：${Object.keys(AppState.orders).length} 人","全班總金額：$${totalAmount} 元"\n`;

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", `資處一仁午餐訂單_${dateStr}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// 匯出訂餐報表為 PDF（使用列印視窗，確保 A4 自動多頁、完整顯示）
function exportOrdersToPDF() {
  const now = new Date();
  const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;
  const nowFullStr = getNowTime();

  const orderedKeys = Object.keys(AppState.orders);
  const orderedCount = orderedKeys.length;
  const totalStudents = STUDENTS.length;
  const unorderCount = totalStudents - orderedCount;

  let totalAmount = 0;
  orderedKeys.forEach(k => {
    const o = AppState.orders[Number(k)];
    if (o) totalAmount += Number(o.price || 0);
  });

  // 品項統計
  const counts = {};
  MENU_ITEMS.forEach(m => counts[m.id] = 0);
  orderedKeys.forEach(k => {
    const o = AppState.orders[Number(k)];
    if (o && counts[o.mealId] !== undefined) counts[o.mealId]++;
  });

  const unorderedStudents = STUDENTS.filter(s => !AppState.orders[Number(s.id)]);

  // 品項統計列
  let mealRowsHtml = '';
  MENU_ITEMS.forEach(m => {
    const c = counts[m.id] || 0;
    if (c > 0) {
      mealRowsHtml += `<tr class="meal-row">
        <td class="td-name">${m.icon ? m.icon + ' ' : ''}${m.name}</td>
        <td class="td-r">$${m.price}</td>
        <td class="td-r bold blue">${c} 份</td>
        <td class="td-r bold">$${(c * m.price).toLocaleString()}</td>
      </tr>`;
    }
  });
  if (!mealRowsHtml) {
    mealRowsHtml = `<tr><td colspan="4" class="td-empty">目前尚無任何餐點訂購統計</td></tr>`;
  }

  // 全班座號明細列
  let studentRowsHtml = '';
  STUDENTS.forEach(s => {
    const sId = Number(s.id);
    const order = AppState.orders[sId];
    const bg = sId % 2 === 0 ? '#f8fafc' : '#ffffff';
    const statusColor = order ? '#15803d' : '#dc2626';
    const mealColor = order ? '#0f172a' : '#94a3b8';
    studentRowsHtml += `<tr style="background:${bg}" class="student-row">
      <td class="td-c bold">${sId} 號</td>
      <td class="td-c gray">第 ${s.row} 排</td>
      <td class="td-l" style="color:${mealColor}">${order ? order.mealName : '尚未點餐'}</td>
      <td class="td-r" style="color:${mealColor}">${order ? '$' + order.price : '-'}</td>
      <td class="td-c mono sm">${order ? formatOrderDisplayTime(order) : '-'}</td>
      <td class="td-c bold" style="color:${statusColor}">${order ? '✅ 已點' : '⏳ 待點'}</td>
    </tr>`;
  });

  // 未點餐座號列表
  const unorderHtml = unorderedStudents.length > 0
    ? `<div class="alert-box danger"><strong>⚠️ 未點餐同學（共 ${unorderedStudents.length} 人）：</strong>${unorderedStudents.map(s => s.id + '號').join('、')}</div>`
    : `<div class="alert-box success"><strong>🎉 全班 ${totalStudents} 位同學均已完成點餐！</strong></div>`;

  const printWin = window.open('', '_blank', 'width=900,height=800');
  if (!printWin) {
    alert("請允許快顯視窗以開啟 PDF 預覽！請在瀏覽器設定中允許此頁面的快顯視窗。");
    return;
  }

  showToast("📄 正在產生 PDF", "已開啟報表視窗，請選擇列印 → 另存為 PDF...");

  printWin.document.open();
  printWin.document.write(`<!DOCTYPE html>
<html lang="zh-TW">
<head>
<meta charset="UTF-8">
<title>資處一仁午餐訂單報表_${dateStr}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+TC:wght@400;500;700;900&display=swap" rel="stylesheet">
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  html, body {
    font-family: 'Noto Sans TC', 'Microsoft JhengHei', Arial, sans-serif;
    font-size: 10pt;
    color: #0f172a;
    background: #fff;
    line-height: 1.4;
  }
  .page {
    width: 100%;
    padding: 12mm 10mm;
  }
  /* 表頭 */
  .report-header {
    text-align: center;
    border-bottom: 2.5px solid #0284c7;
    padding-bottom: 7px;
    margin-bottom: 10px;
  }
  .report-header .school { font-size: 9pt; color: #0284c7; font-weight: 700; letter-spacing: 1px; }
  .report-header h1 { font-size: 16pt; font-weight: 900; color: #0f172a; margin: 4px 0; }
  .report-header .meta {
    font-size: 8.5pt; color: #64748b;
    display: flex; justify-content: space-between; margin-top: 3px;
  }
  /* KPI 卡片 */
  .kpi-row { display: flex; gap: 8px; margin-bottom: 10px; }
  .kpi-card {
    flex: 1; border-radius: 6px; padding: 6px 8px; text-align: center;
    border: 1px solid;
  }
  .kpi-card .kpi-label { font-size: 7.5pt; font-weight: 600; }
  .kpi-card .kpi-val { font-size: 13pt; font-weight: 900; }
  .kpi-green { background: #f0fdf4; border-color: #bbf7d0; color: #15803d; }
  .kpi-amber { background: #fefce8; border-color: #fef08a; color: #a16207; }
  .kpi-red   { background: #fef2f2; border-color: #fecaca; color: #b91c1c; }
  /* 區塊標題 */
  .section-title { font-size: 10pt; font-weight: 900; color: #0f172a; margin-bottom: 4px; margin-top: 8px; }
  /* 共用表格 */
  table { width: 100%; border-collapse: collapse; font-size: 8.5pt; }
  thead tr { background: #f1f5f9; color: #334155; }
  thead th {
    padding: 4px 5px;
    border-top: 1.5px solid #cbd5e1;
    border-bottom: 1.5px solid #cbd5e1;
    font-weight: 700;
  }
  .td-name { padding: 4px 5px; font-weight: 700; }
  .td-r    { padding: 4px 5px; text-align: right; }
  .td-c    { padding: 4px 5px; text-align: center; }
  .td-l    { padding: 4px 5px; text-align: left; font-weight: 600; }
  .td-empty{ padding: 8px; text-align: center; color: #94a3b8; }
  .bold    { font-weight: 800; }
  .blue    { color: #0284c7; }
  .gray    { color: #64748b; }
  .mono    { font-family: 'Courier New', monospace; }
  .sm      { font-size: 7.5pt; }
  .meal-row    { border-bottom: 1px solid #e2e8f0; }
  .student-row { border-bottom: 1px solid #f1f5f9; }
  /* 提醒框 */
  .alert-box {
    border-radius: 5px; padding: 5px 8px; font-size: 8pt;
    margin-top: 8px; border: 1px solid;
  }
  .alert-box.danger  { background: #fff1f2; border-color: #fecdd3; color: #9f1239; }
  .alert-box.success { background: #f0fdf4; border-color: #bbf7d0; color: #166534; }
  /* 簽名列 */
  .sign-row {
    display: flex; justify-content: space-between;
    border-top: 1px dashed #94a3b8; padding-top: 7px; margin-top: 10px;
    font-size: 9pt; color: #475569;
  }
  /* 列印設定：支援多頁、禁止表格欄位橫跨頁面 */
  @media print {
    @page { size: A4 portrait; margin: 8mm 7mm; }
    html, body { margin: 0; padding: 0; }
    .page { padding: 0; }
    table { page-break-inside: auto; }
    thead { display: table-header-group; }
    tr { page-break-inside: avoid; }
    .no-break { page-break-inside: avoid; }
    .btn-wrap { display: none !important; }
  }
  /* 螢幕瀏覽時顯示的按鈕 */
  .btn-wrap {
    text-align: center; padding: 12px 0 4px;
    border-top: 1px solid #e2e8f0; margin-top: 10px;
  }
  .print-btn {
    background: #0284c7; color: #fff; border: none;
    padding: 9px 30px; border-radius: 8px; font-size: 13px;
    font-weight: 700; cursor: pointer; margin: 0 5px;
    font-family: inherit;
  }
  .print-btn:hover { background: #0369a1; }
</style>
</head>
<body>
<div class="page">
  <!-- 表頭 -->
  <div class="report-header">
    <div class="school">智光高級商工職業學校 ｜ 資訊處理科 一年仁班</div>
    <h1>🍱 班級午餐訂餐統計明細表</h1>
    <div class="meta">
      <span>📅 產出時間：${nowFullStr}</span>
      <span>共 ${orderedCount} / ${totalStudents} 人訂餐 ｜ 總金額 $${totalAmount.toLocaleString()} 元</span>
    </div>
  </div>

  <!-- KPI -->
  <div class="kpi-row no-break">
    <div class="kpi-card kpi-green">
      <div class="kpi-label">已訂餐人數</div>
      <div class="kpi-val">${orderedCount} / ${totalStudents} 人</div>
    </div>
    <div class="kpi-card kpi-amber">
      <div class="kpi-label">全班訂餐總金額</div>
      <div class="kpi-val">$${totalAmount.toLocaleString()} 元</div>
    </div>
    <div class="kpi-card kpi-red">
      <div class="kpi-label">尚未點餐人數</div>
      <div class="kpi-val">${unorderCount} 人</div>
    </div>
  </div>

  <!-- 品項統計 -->
  <div class="no-break">
    <div class="section-title">🍛 各餐點品項訂購數量統計</div>
    <table>
      <thead><tr>
        <th style="text-align:left">餐點品項</th>
        <th style="text-align:right;width:65px">單價</th>
        <th style="text-align:right;width:70px">訂購份數</th>
        <th style="text-align:right;width:80px">小計金額</th>
      </tr></thead>
      <tbody>${mealRowsHtml}</tbody>
    </table>
  </div>

  <!-- 全班明細 -->
  <div class="section-title" style="margin-top:10px">📋 全班座號對照點餐明細 (1 ～ 31 號)</div>
  <table>
    <thead><tr>
      <th style="text-align:center;width:38px">座號</th>
      <th style="text-align:center;width:45px">排數</th>
      <th style="text-align:left">訂購餐點</th>
      <th style="text-align:right;width:48px">金額</th>
      <th style="text-align:center;width:138px">訂餐時間</th>
      <th style="text-align:center;width:52px">狀態</th>
    </tr></thead>
    <tbody>${studentRowsHtml}</tbody>
  </table>

  <!-- 未點餐提醒 -->
  ${unorderHtml}

  <!-- 簽名 -->
  <div class="sign-row no-break">
    <span>學藝/訂餐幹部簽名：________________________</span>
    <span>導師簽名：________________________</span>
    <span>便當廠商簽收：________________________</span>
  </div>

  <!-- 螢幕瀏覽按鈕（列印時自動隱藏） -->
  <div class="btn-wrap">
    <button class="print-btn" onclick="window.print()">🖨️ 列印 / 儲存為 PDF</button>
    <button class="print-btn" style="background:#64748b" onclick="window.close()">✕ 關閉</button>
  </div>
</div>
<script>
  window.onload = function() { setTimeout(function(){ window.print(); }, 600); };
<\/script>
</body>
</html>`);
  printWin.document.close();
  showToast("📄 PDF 預覽已開啟", "請在列印視窗中選擇「目的地：另存為 PDF」以儲存！");
}
window.exportOrdersToPDF = exportOrdersToPDF;

// UI 點擊重置按鈕處理函式
function handleResetAllOrders() {
  const confirmText = prompt("⚠️ 警告：這將會清除全班 31 位同學的所有訂餐紀錄！\n請輸入重置密碼（0901）：");
  if (confirmText !== "0901") {
    if (confirmText !== null) alert("重置密碼錯誤（密碼為 0901），已取消重置操作。");
    return;
  }

  // 請操作者輸入座號供動態牆顯示
  const seatInput = prompt("請輸入您的座號（將顯示在全班動態牆上）：");
  const seatNum = seatInput ? seatInput.trim() : null;
  const seatId = Number(seatNum);

  // 座號必須為 1~31 的有效數字，否則不帶座號
  const validSeat = (!isNaN(seatId) && seatId >= 1 && seatId <= 31) ? seatId : null;

  resetSystem(validSeat);
  alert("已成功清除全班點餐紀錄並重設為純淨初始狀態！");
}

function printSeatingChart() {
  switchTab('seating');
  setTimeout(() => window.print(), 250);
}

function switchTab(tabId) {
  document.querySelectorAll(".tab-button").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.tab === tabId);
  });

  const orderContent = document.getElementById("order-tab-content");
  const seatingContent = document.getElementById("seating-tab-content");
  const adminContent = document.getElementById("admin-tab-content");

  if (orderContent) orderContent.style.display = tabId === 'order' ? 'block' : 'none';
  if (seatingContent) seatingContent.style.display = tabId === 'seating' ? 'block' : 'none';
  if (adminContent) adminContent.style.display = tabId === 'admin' ? 'block' : 'none';
}

// =========================================================
// renderAllViews：零延遲直接執行，移除 rAF 節流避免背景標籤延遲
// =========================================================
function renderAllViews() {
  renderSeatOptions();
  handleSeatChange();
  renderSeatingChart();
  renderAdminDashboard();
}
window.renderAllViews = renderAllViews;


function toggleActivityDrawer() {
  const drawer = document.getElementById("activity-drawer");
  if (drawer) drawer.classList.toggle("open");
}

function renderActivityFeed() {
  const list = document.getElementById("activity-list");
  if (!list) return;
  list.innerHTML = "";

  if (!AppState.activityFeed || AppState.activityFeed.length === 0) {
    list.innerHTML = `<div style="text-align: center; color: var(--text-muted); padding: 20px;">尚無點餐動態</div>`;
    return;
  }

  AppState.activityFeed.forEach(item => {
    const div = document.createElement("div");
    let actClass = '';
    if (item.type === 'cancel') actClass = 'cancel-act';
    else if (item.type === 'reset') actClass = 'reset-act';
    div.className = `activity-item ${actClass}`;
    div.innerHTML = `
      <div class="activity-item-time">⏱️ ${item.time}</div>
      <div class="activity-item-title">${item.title}</div>
      <div class="activity-item-desc">${item.desc}</div>
    `;
    list.appendChild(div);
  });
}

function toggleSound() {
  AppState.soundEnabled = !AppState.soundEnabled;
  const btn = document.getElementById("audio-toggle-btn");
  if (btn) {
    btn.innerHTML = AppState.soundEnabled ? '🔊 點餐音效：開' : '🔇 點餐音效：關';
  }
  if (AppState.soundEnabled) {
    playSuccessChime();
  }
}

// ============================================================
// 週一至週五台灣時間 13:00 午餐截止「自動清空/取消訂單」系統
// 1. 在線時：13:00:00 整準時觸發全班即時廣播清空
// 2. 離線後重開：若已過 13:00，自動清除今天 13:00 以前已截止的舊午餐訂單
// ============================================================

function checkAndAutoResetOnLoad() {
  const now = Date.now();
  let hasChanges = false;

  // 使用統一的 isOrderStillValid 進行過期檢驗
  // 完美支援前天晚上、昨晚與週末提前訂餐，只有真正過期（如已被手動重置、已過 13:00 或超過 4 天）才會被清理
  for (const seatId in AppState.orders) {
    const order = AppState.orders[seatId];
    if (order && !isOrderStillValid(order, now)) {
      delete AppState.orders[seatId];
      hasChanges = true;
      console.log(`[自動清理過期訂單] 座號 ${seatId} 訂單已過期（成立於 ${formatOrderDisplayTime(order)}），已釋放座位`);
    }
  }

  if (hasChanges) {
    persistOrders();
    renderAllViews();
  }
}

// 頁面初始化
document.addEventListener("DOMContentLoaded", () => {
  loadLocalData();

  // 載入資料後檢查是否需要清空今日 13:00 以前的截止訂單
  checkAndAutoResetOnLoad();

  renderMenuCatalog();
  renderSeatOptions();
  renderSeatingChart();
  renderAdminDashboard();
  renderActivityFeed();
  initSyncEngine();

  if (MENU_ITEMS.length > 0) {
    selectMenuItem(MENU_ITEMS[0].id);
  }

  document.body.addEventListener('click', () => {
    getAudioContext();
    requestNotificationPermission();
  }, { once: true });

  // 本地伺服器模式同步（若有執行 node server.js）
  if (IS_LOCAL_SERVER) {
    fetchServerOrders();
    fetchServerResetEpoch();
  }
});

// 從伺服器查詢最後重置 Epoch（僅限本地伺服器模式）
async function fetchServerResetEpoch() {
  try {
    const res = await fetch('/api/state');
    if (!res.ok) return;
    const data = await res.json();
    const serverEpoch = Number(data.lastResetEpoch || 0);
    const localEpoch = getResetEpoch();
    if (serverEpoch > 0 && serverEpoch > localEpoch) {
      console.log(`[伺服器同步] 偵測到伺服器已執行重置，同步清空訂單...`);
      setResetEpoch(serverEpoch);
      AppState.orders = {};
      AppState.activityFeed = [];
      persistOrders();
      publishFullStateToMQTT();
      renderAllViews();
      addActivityItem('reset', '⏰ 13:00 伺服器排程自動清空', '今日午餐訂餐已截止，所有座位已重新開放', getNowTime());
      showToast('⏰ 系統通知', '已到達 13:00，今日午餐訂餐已截止並自動清空');
    }
  } catch (e) {}
}

// 週一至週五台灣時間 13:00 排程定時器
(function autoResetWeekdayScheduler() {
  function msUntilNextWeekday1300() {
    const nowUTC = Date.now();
    const todayTW = new Date(nowUTC + TW_OFFSET_MS);
    const todayResetUTC = Date.UTC(
      todayTW.getUTCFullYear(),
      todayTW.getUTCMonth(),
      todayTW.getUTCDate(),
      5, 0, 0 // UTC 05:00 = 台灣時間 13:00:00
    );
    let candidateUTC = nowUTC < todayResetUTC ? todayResetUTC : todayResetUTC + 86400000;
    while (!isWeekdayTw(candidateUTC)) {
      candidateUTC += 86400000;
    }
    return candidateUTC - nowUTC;
  }

  function run1300AutoReset() {
    const now = Date.now();
    if (isWeekdayTw(now)) {
      console.log('⏰ [13:00 自動清空] 週一至週五台灣時間 13:00 到達，執行今日午餐訂餐截止清空！');
      resetSystem();
      addActivityItem('reset', '⏰ 13:00 午餐截止清空', '今日午餐訂餐已截止，所有座位已自動釋放重新開放', getNowTime());
      showToast('⏰ 系統通知', '已到達 13:00，今日午餐訂餐已截止並自動清空');
    }
    const nextDelay = msUntilNextWeekday1300();
    setTimeout(run1300AutoReset, nextDelay);
  }

  const firstDelay = msUntilNextWeekday1300();
  setTimeout(run1300AutoReset, firstDelay);
  const nextTw = new Date(Date.now() + firstDelay + TW_OFFSET_MS).toISOString().replace('T', ' ').slice(0, 19);
  console.log(`[13:00 自動清空排程] 已啟動，下次清空台灣時間：${nextTw} TW`);
})();
// ============================================================
