/* Auden Tools UI proposal. Currency figures and chart are explicitly illustrative. */
const { t, localizedItems } = AudenI18n;
const decimal = AudenDecimal;
const paths = {
  grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7v5l3 2"/>',
  globe: '<circle cx="12" cy="12" r="9"/><ellipse cx="12" cy="12" rx="4" ry="9"/><path d="M3 12h18M5 6.5h14M5 17.5h14"/>',
  calendar: '<rect x="3.5" y="5" width="17" height="16" rx="2"/><path d="M7 3v4m10-4v4M3.5 10h17M8 14h2m4 0h2m-8 3h2"/>',
  star: '<path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9Z"/>',
  history: '<path d="M3 11a9 9 0 1 1 2.5 7M3 5v6h6M12 7v5l3 2"/>',
  arrows: '<path d="M4 7h15m-4-4 4 4-4 4M20 17H5m4-4-4 4 4 4"/>',
  text: '<path d="M4 5h16M8 5v15m8-15v15M5 20h6m2 0h6"/>',
  code: '<path d="m8 5-5 7 5 7m8-14 5 7-5 7M14 3l-4 18"/>',
  ruler: '<path d="m4 15 11-11 5 5L9 20H4ZM11 8l2 2m1-5 2 2m-8 4 2 2m-5 1 2 2"/>',
  search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4.5 4.5"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/>',
  moon: '<path d="M20.5 14.5A9 9 0 0 1 9.5 3.5a9 9 0 1 0 11 11Z"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 0 1 5 .5c0 1.5-2.5 2-2.5 3.5m0 3h.01"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  right: '<path d="M4 12h15m-5-5 5 5-5 5"/>',
  left: '<path d="M20 12H5m5-5-5 5 5 5"/>',
  down: '<path d="M12 4v15m-5-5 5 5 5-5"/>',
  diagonal: '<path d="M5 19 19 5M6 5h13v13"/>',
  copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M15 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h3"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  close: '<path d="m6 6 12 12M6 18 18 6"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  spark: '<path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5ZM20 2v4m-2-2h4"/>',
  shield: '<path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6Z"/><path d="m8 12 3 3 5-6"/>',
  chart: '<path d="M4 3v17h17M7 14l4-4 4 2 5-7"/>',
};
const icon = (name, cls = '') => `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.55" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.grid}</svg>`;
const tools = localizedItems([
  { id: 'timestamp', name: '时间戳转换', desc: '在时间戳与日期之间，轻松转换。', category: 'time', label: 'TIME & DATE', icon: 'clock', color: 'amber', keywords: 'unix timestamp 时间转换 秒 毫秒' },
  { id: 'world', name: '世界时间', desc: '连接每个时区，找到合适的时间。', category: 'time', label: 'TIME & DATE', icon: 'globe', color: '', keywords: 'timezone 时区 城市 世界时钟 会议' },
  { id: 'date', name: '日期计算', desc: '计算日期间隔，安排每一个日程。', category: 'time', label: 'TIME & DATE', icon: 'calendar', color: 'blue', keywords: '日期差 天数 加减 倒计时' },
  { id: 'currency', name: '汇率换算', desc: '一个金额，多种货币，一目了然。', category: 'convert', label: 'CONVERT & CALCULATE', icon: 'arrows', color: '', keywords: '汇率 多货币 外汇 美元 人民币 currency' },
  { id: 'units', name: '单位换算', desc: '长度、重量、温度，换个单位就好。', category: 'convert', label: 'CONVERT & CALCULATE', icon: 'ruler', color: 'violet', keywords: '单位 长度 重量 温度 unit' },
  { id: 'text', name: '文本工具', desc: '统计、去重、整理，让文字更清爽。', category: 'text', label: 'TEXT & DEVELOPMENT', icon: 'text', color: 'rose', keywords: '文本 字数 统计 去重 排序 空行' },
  { id: 'json', name: 'JSON 工具', desc: '格式化、校验，让数据清晰可读。', category: 'text', label: 'TEXT & DEVELOPMENT', icon: 'code', color: 'blue', keywords: 'json 格式化 压缩 校验 开发' },
]);
const cities = localizedItems(AudenCatalog.cities);
const currencies = localizedItems(AudenCatalog.currencies);
const timeZones = [...localizedItems([{ id: 'utc', name: '协调世界时', country: '全球标准', flag: '🌐', region: '全球', tz: 'UTC' }]), ...cities];
const defaultCities = ['shanghai', 'london', 'newyork', 'tokyo', 'singapore', 'dubai', 'sydney', 'losangeles'];
const defaultCurrencies = ['USD', 'EUR', 'JPY', 'GBP', 'HKD', 'KRW', 'SGD', 'AUD'];
function readStorage(key, fallback) { try { const value = JSON.parse(localStorage.getItem(key)); return Array.isArray(value) ? value : fallback; } catch { return fallback; } }
function saveStorage(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* Storage is optional in the preview. */ } }
const state = {
  view: 'home', filter: 'all', query: '', favorites: readStorage('auden-design-favorites', ['timestamp', 'world', 'currency']),
  recent: readStorage('auden-design-recent', []),
  cities: [...new Set(['shanghai', ...readStorage('auden-design-cities', defaultCities).filter(id => cities.some(city => city.id === id))])],
  hour12: false, timestampMode: 'to-date', timezone: 'Asia/Shanghai', overlap: 'earlier',
  baseCurrency: 'CNY', amount: '1000',
  selectedCurrencies: [...new Set(readStorage('auden-design-currencies', defaultCurrencies).filter(code => code !== 'CNY' && currencies.some(currency => currency.code === code)))],
  currencyPickerMode: 'targets', currencyRegion: '全部', cityRegion: '全部', timezoneRegion: '全部',
};
const main = document.getElementById('main-content');
const escapeHtml = value => String(value).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
function flagBadge(item, small = false) { return `<span class="region-flag ${small ? 'small' : ''}" role="img" aria-label="${item.country}">${item.flag}</span>`; }
function currencyDigits(code) { return new Intl.NumberFormat('en', { style: 'currency', currency: code }).resolvedOptions().maximumFractionDigits; }
function catalogMatch(item, query) { return [item.code, item.id, item.name, item.country, item.tz, item.keywords, item.searchTerms].filter(Boolean).join(' ').toLowerCase().replaceAll('_', ' ').includes(query.toLowerCase().replaceAll('_', ' ').trim()); }
function hydrateIcons() { document.querySelectorAll('[data-icon]').forEach(element => { element.innerHTML = icon(element.dataset.icon); }); }
function toast(message) { const el = document.getElementById('toast'); el.textContent = message; el.classList.add('visible'); clearTimeout(toast.timer); toast.timer = setTimeout(() => el.classList.remove('visible'), 2400); }
async function copy(text) { try { await navigator.clipboard.writeText(String(text)); toast(t("已复制到剪贴板")); } catch { toast(t("当前预览环境不支持复制，请选中文字复制")); } }
function dateParts(tz, date = new Date()) { return Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(date).map(part => [part.type, part.value])); }
function timeIn(tz, date = new Date()) { return new Intl.DateTimeFormat(AudenI18n.locale, { timeZone: tz, hour: '2-digit', minute: '2-digit', hourCycle: state.hour12 ? 'h12' : 'h23' }).format(date); }
function clock(tz, large = false) { const parts = dateParts(tz); const h = Number(parts.hour), m = Number(parts.minute); return `<div class="analog-clock ${large ? 'large' : ''}" data-clock="${tz}">${[0, 90, 180, 270].map(deg => `<i class="clock-tick" style="transform:rotate(${deg}deg)"></i>`).join('')}<i class="clock-hand clock-hour" style="transform:rotate(${h * 30 + m / 2}deg)"></i><i class="clock-hand clock-minute" style="transform:rotate(${m * 6}deg)"></i></div>`; }
function toolIcon(tool) { return `<span class="tool-icon ${tool.color}">${icon(tool.icon)}</span>`; }
function starButton(id) { const saved = state.favorites.includes(id); return `<button class="star-btn ${saved ? 'saved' : ''}" data-favorite="${id}" aria-label="${t(saved ? t("取消收藏：{name}") : t("收藏：{name}"), { name: tools.find(tool => tool.id === id).name })}" aria-pressed="${saved}">${icon('star')}</button>`; }
function toolCard(tool) { return `<article class="tool-card"><a class="card-link" href="#${tool.id}" aria-label="${t('打开{name}', { name: tool.name })}"></a>${toolIcon(tool)}<div class="card-body"><h3>${tool.name}</h3><p>${tool.desc}</p><span class="tool-category">${tool.label}</span></div>${starButton(tool.id)}</article>`; }
function renderTools() {
  let displayed = tools.filter(tool => (state.filter === 'all' || tool.category === state.filter || (state.filter === 'favorites' && state.favorites.includes(tool.id)) || (state.filter === 'recent' && state.recent.includes(tool.id))) && `${tool.name} ${tool.desc} ${tool.keywords} ${tool.searchTerms}`.toLowerCase().includes(state.query.toLowerCase()));
  if (state.filter === 'recent') displayed = displayed.sort((a, b) => state.recent.indexOf(a.id) - state.recent.indexOf(b.id));
  const grid = document.getElementById('tools-grid');
  if (grid) grid.innerHTML = displayed.length ? displayed.map(toolCard).join('') : `<div class="empty-state">${icon(state.filter === 'recent' ? 'history' : 'search')}<h3 style="margin-top:12px">${state.filter === 'recent' ? t("还没有最近使用的工具") : state.filter === 'favorites' && !state.query ? t("收藏你的常用工具") : t("没有找到相关工具")}</h3><p>${state.filter === 'recent' ? t("打开一个工具，就会出现在这里。") : t("点击工具卡片上的星标，或试试其他关键词。")}</p></div>`;
  document.querySelectorAll('.filter-pill').forEach(el => el.classList.toggle('active', el.dataset.category === state.filter));
  const title = document.getElementById('tools-title'); if (title) title.textContent = ({ favorites: t("我的收藏"), recent: t("最近使用"), time: t("时间与日期"), convert: t("换算与计算"), text: t("文本与开发") })[state.filter] || t("全部工具");
  const count = document.getElementById('tools-count'); if (count) count.textContent = String(displayed.length).padStart(2, '0');
}
function renderHome() {
  const now = new Date(); const parts = dateParts('Asia/Shanghai', now); const weekday = new Intl.DateTimeFormat(AudenI18n.locale, { weekday: 'long', timeZone: 'Asia/Shanghai' }).format(now);
  const epoch = Math.floor(now.getTime() / 1000);
  main.innerHTML = `<section class="hero"><div><p class="eyebrow">YOUR EVERYDAY TOOLKIT</p><h1>${t("让日常，简单一点。")}</h1><p class="hero-subtitle">${t("好用的小工具，帮你省下每一个不必浪费的瞬间。")}</p></div><div class="hero-date"><span class="day">${parts.month} / ${parts.day}</span><span class="weekday">${weekday} &nbsp;·&nbsp; </span><span class="date-lower">${parts.year}</span></div></section>
  <div class="search-bar">${icon('search')}<input id="home-search" aria-label="${t("搜索工具")}" placeholder="${t("想做点什么？搜索工具，例如：时间、汇率、JSON")}" value="${escapeHtml(state.query)}"/><span class="key-hint"><kbd>⌘</kbd><kbd>K</kbd></span></div>
  <section aria-label="${t("常用工具")}"><div class="section-heading"><div class="section-title"><h2>${t("常用工具")}</h2><span>${t("为日常，随手备好")}</span></div><button class="text-btn" data-filter="favorites">${t("我的收藏")} ${icon('right')}</button></div>
  <div class="featured-grid"><article class="feature-card feature-world"><div class="feature-top">${icon('globe')}<h3>${t("世界时间")}</h3><button class="icon-btn" data-view="world" aria-label="${t("打开世界时间")}">${icon('diagonal')}</button></div><div class="mini-clocks">${cities.slice(0, 3).map(city => `<div class="mini-city">${clock(city.tz)}<span class="mini-city-name">${city.name}</span><span class="mini-time" data-timezone="${city.tz}">${timeIn(city.tz)}</span></div>`).join('')}</div><div class="feature-bottom"><span>${t("此刻，世界与你同步")}</span><button class="text-btn" data-view="world">${t("查看全部")} ${icon('right')}</button></div></article>
  <article class="feature-card feature-currency"><div class="feature-top">${icon('arrows')}<h3>${t("汇率换算")}</h3><button class="icon-btn" data-view="currency" aria-label="${t("打开汇率换算")}">${icon('diagonal')}</button></div><div class="rate-preview"><span class="currency-name">${flagBadge(currencies.find(c => c.code === 'CNY'), true)}CNY</span><span class="rate-value">1,000<span style="font-size:12px;color:var(--muted)">.00</span></span></div><div class="rate-preview" style="border:0;padding-bottom:0;margin:0"><span class="currency-name">${flagBadge(currencies.find(c => c.code === 'USD'), true)}USD</span><span class="rate-value">140<span style="font-size:12px;color:var(--muted)">.17</span></span></div><div class="feature-bottom"><span class="preview-tag">${t("示例汇率")}</span><button class="text-btn" data-view="currency">${t("开始换算")} ${icon('right')}</button></div></article>
  <article class="feature-card feature-timestamp"><div class="feature-top">${icon('clock')}<h3>${t("时间戳转换")}</h3><button class="icon-btn" data-view="timestamp" aria-label="${t("打开时间戳转换")}">${icon('diagonal')}</button></div><div class="timestamp-display" data-live-epoch>${epoch}</div><p class="timestamp-caption">${t("当前 Unix 时间戳 · 秒")}</p><div class="timestamp-arrow">${icon('down')}</div><div class="timestamp-date" data-live-date="Asia/Shanghai">${AudenTime.format(now).replace("T", " ")}</div><div class="feature-bottom"><span>Asia/Shanghai</span><button class="text-btn" data-view="timestamp">${t("转换时间")} ${icon('right')}</button></div></article></div></section>
  <section id="all-tools"><div class="section-heading all-heading"><div class="section-title"><h2 id="tools-title">${t("全部工具")}</h2><span id="tools-count">07</span></div><div class="filter-pills" aria-label="${t("工具分类")}"><button class="filter-pill active" data-category="all">${t("全部")}</button><button class="filter-pill" data-category="time">${t("时间日期")}</button><button class="filter-pill" data-category="convert">${t("换算计算")}</button><button class="filter-pill" data-category="text">${t("文本开发")}</button></div></div><div class="tools-grid" id="tools-grid"></div></section><div class="bottom-note"><span class="green-dot"></span>${t("即开即用，让每一次操作都简单一点。")}</div>`;
  renderTools();
  document.getElementById('home-search').addEventListener('input', event => { state.query = event.target.value; renderTools(); });
}
function detailHeader(id, description, extra = '') { const tool = tools.find(item => item.id === id); const saved = state.favorites.includes(id); return `<div class="detail-head"><div><a class="back-link" href="#home">${icon('left')}${t("全部工具")}</a><div class="detail-heading-line">${toolIcon(tool)}<h1>${tool.name}</h1></div><p class="detail-description">${description}</p></div><div class="detail-actions"><button class="button" data-favorite="${id}">${icon('star')}${saved ? t("已收藏") : t("收藏工具")}</button>${extra}</div></div>`; }
function offsetLabel(tz, date = new Date()) { const label = new Intl.DateTimeFormat('en-US', { timeZone: tz, timeZoneName: 'shortOffset' }).formatToParts(date).find(item => item.type === 'timeZoneName').value; return label.replace('GMT', 'UTC'); }
function cityCard(city) { const p = dateParts(city.tz); const night = Number(p.hour) < 7 || Number(p.hour) >= 19; const date = new Intl.DateTimeFormat(AudenI18n.locale, { month: 'long', day: 'numeric', weekday: 'short', timeZone: city.tz }).format(new Date()); return `<article class="city-card ${city.local ? 'local' : night ? 'night' : ''}"><div class="city-top"><h3 class="city-name-with-flag">${flagBadge(city, true)}${city.name}</h3>${city.local ? `<span class="local-badge">${t("参考城市")}</span>` : icon(night ? 'moon' : 'sun')}</div><p class="city-country">${city.country} · ${offsetLabel(city.tz)}</p>${clock(city.tz, true)}<div class="city-time" data-timezone="${city.tz}">${timeIn(city.tz)}</div><p class="city-date">${date}</p><div class="city-footer"><span>${icon(night ? 'moon' : 'sun')}${night ? t("夜间时光") : t("日间时光")}</span><span>${city.tz.split('/')[1].replace('_', ' ')}</span></div></article>`; }
function timeline() {
  const dateValue = document.getElementById('meeting-date')?.value || new Date().toISOString().slice(0, 10);
  const hourValue = Number(document.getElementById('meeting-hour')?.value || 16);
  const shown = state.cities.map(id => cities.find(city => city.id === id));
  const html = `<span class="hour-label" style="text-align:left">${t("上海时间")}</span>${Array.from({ length: 12 }, (_, i) => `<span class="hour-label">${String(i + 8).padStart(2, '0')}:00</span>`).join('')}${shown.map(city => `<span class="timeline-city">${city.name}</span>${Array.from({ length: 12 }, (_, i) => { const d = new Date(`${dateValue}T${String(i + 8).padStart(2, '0')}:00:00+08:00`); const p = dateParts(city.tz, d); const hour = Number(p.hour); return `<span class="timeline-cell ${hour >= 9 && hour < 18 ? 'work' : ''} ${hourValue === i + 8 ? 'selected' : ''}">${p.hour}</span>`; }).join('')}`).join('')}`;
  const grid = document.getElementById('time-grid'); if (grid) grid.innerHTML = html;
  const summary = document.getElementById('meeting-summary'); if (summary) { const d = new Date(`${dateValue}T${String(hourValue).padStart(2, '0')}:00:00+08:00`); summary.textContent = shown.map(city => `${city.name} ${timeIn(city.tz, d)}`).join('  ·  '); }
}
function renderWorld() {
  main.innerHTML = detailHeader('world', t("此刻的世界，一眼尽收。找到适合彼此的时间。"), `<button class="button primary" id="add-city">${icon('plus')}${t("管理城市")}</button>`) + `<div class="world-toolbar"><div class="segmented"><button data-hour-format="24" class="${!state.hour12 ? 'active' : ''}">${t("24 小时制")}</button><button data-hour-format="12" class="${state.hour12 ? 'active' : ''}">${t("12 小时制")}</button></div><span class="world-now"><i class="live-dot"></i>${t("当前时间 · 自动更新")}</span></div><div class="catalog-summary"><span>${icon("globe")}<strong>24</strong> ${t('个常用城市')}<span class="summary-divider">/</span>${t('已关注 {count} 个', { count: state.cities.length })}</span><div><button class="text-btn" data-city-preset="all">${t("显示全部 24 城市")}</button><button class="text-btn" data-city-preset="default">${t("恢复常用")}</button></div></div><div class="city-grid">${state.cities.map(id => cityCard(cities.find(city => city.id === id))).join('')}</div>
  <section class="panel"><div class="panel-heading"><h2 class="meeting-title">${icon('calendar')}${t("找个好时间")}</h2><span class="subtle">${t("跨时区会议，一起安排")}</span></div><div class="meeting-inputs"><label for="meeting-date">${t("计划日期")}</label><input class="field" id="meeting-date" type="date" value="${new Date().toISOString().slice(0, 10)}" aria-label="${t("计划日期")}"/><label for="meeting-hour">${t("上海时间")}</label><select class="field" id="meeting-hour">${Array.from({ length: 12 }, (_, i) => `<option value="${i + 8}" ${i + 8 === 16 ? 'selected' : ''}>${String(i + 8).padStart(2, '0')}:00</option>`).join('')}</select><button class="button small" id="copy-meeting">${icon('copy')}${t("复制时间")}</button></div><div class="time-grid" id="time-grid"></div><div class="timeline-legend"><span><i class="legend-box"></i>${t("工作时间 09–18")}</span><span><i class="legend-box rest"></i>${t("休息时间")}</span><span><i class="legend-box selected"></i>${t("选中时间")}</span></div><div class="notice">${icon('globe')}<span id="meeting-summary"></span></div></section><div class="bottom-note">${icon('help')}${t("日期与时差按所选时区计算，已考虑夏令时。")}</div>`;
  timeline();
  document.getElementById('meeting-date').addEventListener('change', event => { if (event.target.value) timeline(); });
  document.getElementById('meeting-hour').addEventListener('change', timeline);
  document.getElementById('copy-meeting').onclick = () => copy(`${document.getElementById('meeting-date').value}\n${document.getElementById('meeting-summary').textContent}`);
  document.getElementById('add-city').onclick = openCities;
}
function currencyRows() {
  const amountInput = document.getElementById('currency-amount'); if (!amountInput) return;
  state.amount = amountInput.value;
  let amount;
  try { amount = decimal.parse(state.amount); if (amount.n < 0n) amount = null; } catch { amount = null; }
  const valid = amount !== null;
  const base = currencies.find(currency => currency.code === state.baseCurrency);
  const shown = state.selectedCurrencies.map(code => currencies.find(currency => currency.code === code)).filter(currency => currency && currency.code !== base.code);
  document.getElementById('currency-result-count').textContent = t('已选 {count} 种 · 共 {total} 种可选', { count: shown.length, total: currencies.length });
  document.getElementById('currency-list').innerHTML = shown.length ? shown.map(currency => {
    const rate = decimal.divide(currency.rate, base.rate), digits = currencyDigits(currency.code);
    const rounded = valid ? decimal.round(decimal.multiply(amount, rate), digits) : null;
    return `<div class="currency-row">${flagBadge(currency)}<div class="currency-info">${currency.code}<small>${currency.name} · ${currency.country}</small></div><div class="currency-total">${valid ? decimal.format(rounded, AudenI18n.locale) : '—'}<small>1 ${base.code} = ${decimal.round(rate, 5)} ${currency.code}</small></div><div class="currency-row-actions"><button class="icon-btn" ${valid ? `data-copy="${rounded}"` : 'disabled'} aria-label="${t('复制{name}金额', { name: currency.name })}">${icon('copy')}</button><button class="icon-btn remove-currency" data-remove-currency="${currency.code}" aria-label="${t('移除{name}', { name: currency.name })}">${icon('close')}</button></div></div>`;
  }).join('') : `<div class="empty-state"><h3>${t("选择要对照的货币")}</h3><p>${t("点击“管理货币”，添加你常用的币种。")}</p></div>`;
  document.getElementById('currency-input-error').textContent = state.amount && !valid ? t('请输入不小于 0 的有效金额（最多 200 位数字）。') : '';
}
function renderCurrency() {
  const base = currencies.find(currency => currency.code === state.baseCurrency);
  main.innerHTML = detailHeader('currency', t("24 种常见货币，带上熟悉的旗帜。一个金额，一次看清。"), `<button class="button primary" id="manage-currencies">${icon('plus')}${t("管理货币")}</button>`) + `<div class="detail-columns currency-columns"><section class="panel"><div class="panel-heading"><h2>${t("多币种换算")}</h2><span class="example-badge">${t("设计预览 · 示例汇率")}</span></div><label class="input-label" for="currency-amount">${t("输入金额")}</label><div class="amount-input"><input id="currency-amount" type="text" inputmode="decimal" maxlength="220" value="${escapeHtml(state.amount)}" aria-label="${t("需要换算的金额")}"/><button class="currency-base-picker" id="currency-base-picker" aria-label="${t('选择基础货币，目前为{name}', { name: base.name })}">${flagBadge(base, true)}<span><strong>${base.code}</strong><small>${base.name}</small></span>${icon('down')}</button></div><p class="validation-error" id="currency-input-error" role="alert"></p><div class="currency-results-heading"><div><h2>${t("换算结果")}</h2><span id="currency-result-count"></span></div><button class="text-btn" id="show-all-currencies">${t('显示全部 {count} 种', { count: currencies.length - 1 })} ${icon('right')}</button></div><div class="currency-list" id="currency-list"></div><button class="add-currency" id="more-currency">${icon('plus')}${t("管理货币 · 搜索 24 种常用币种")}</button><p class="precision-note">${t('按币种小数位四舍五入，计算过程保留精度。')}</p><div class="source-note">${icon('help')}${t("当前为界面示例数据，正式版将显示汇率来源及更新时间。")}</div></section>
  <aside class="detail-side"><section class="panel"><div class="panel-heading" style="margin-bottom:10px"><h2>CNY / USD</h2><span class="example-badge">${t("示例趋势")}</span></div><p class="muted" style="font-size:10px">${t("1 人民币可兑换")}</p><div class="trend-value">0.14017<span>USD</span></div><div class="trend-change">${icon('chart')}+0.28% <span class="muted">&nbsp;${t("过去 30 天 · 示意")}</span></div><svg class="trend-chart" viewBox="0 0 320 150" preserveAspectRatio="none" aria-label="${t("示例汇率趋势图")}"><defs><linearGradient id="chart-fill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stop-color="#8fab76" stop-opacity=".19"/><stop offset="100%" stop-color="#8fab76" stop-opacity="0"/></linearGradient></defs><path d="M0 30H320M0 75H320M0 120H320" stroke="var(--line)" stroke-width="1" stroke-dasharray="3 5"/><path d="M0 110 13 98 26 102 40 87 53 94 66 80 79 84 92 63 105 74 118 68 131 80 144 60 157 67 170 55 183 61 196 43 209 49 222 34 235 42 248 25 261 35 274 29 287 42 300 21 320 16V150H0Z" fill="url(#chart-fill)"/><path d="M0 110 13 98 26 102 40 87 53 94 66 80 79 84 92 63 105 74 118 68 131 80 144 60 157 67 170 55 183 61 196 43 209 49 222 34 235 42 248 25 261 35 274 29 287 42 300 21 320 16" fill="none" stroke="#879f70" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><circle cx="320" cy="16" r="4" fill="#879f70" stroke="var(--surface)" stroke-width="2"/></svg><div class="chart-labels"><span>10 / 01</span><span>10 / 15</span><span>10 / 30</span></div><div class="rate-detail-list"><div><span>${t("30 天最高")}</span><strong>0.14062 USD</strong></div><div><span>${t("30 天最低")}</span><strong>0.13898 USD</strong></div><div><span>${t("数据类型")}</span><strong>${t("界面演示数据")}</strong></div></div></section><section class="tip-panel"><h3>${icon('spark')}${t("换算小提示")}</h3><p>${t("参考汇率帮助你快速估算金额。实际支付或兑换金额，还会受到银行报价与手续费的影响。")}</p></section></aside></div>`;
  currencyRows();
  document.getElementById('currency-amount').addEventListener('input', currencyRows);
  document.getElementById('currency-base-picker').onclick = () => openCurrencies('base');
  document.getElementById('manage-currencies').onclick = () => openCurrencies('targets');
  document.getElementById('more-currency').onclick = () => openCurrencies('targets');
  document.getElementById('show-all-currencies').onclick = selectAllCurrencies;

}
function formatShanghai(date) { const p = dateParts('Asia/Shanghai', date); return `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}:${String(date.getUTCSeconds()).padStart(2, '0')}`; }
function timezoneButton() {
  const zone = timeZones.find(zone => zone.tz === state.timezone);
  return `${flagBadge(zone, true)}<span><strong>${zone.name} <small>${offsetLabel(zone.tz)}</small></strong><small>${zone.tz}</small></span>${icon('down')}`;
}
function renderTimestamp() {
  const now = new Date(), mode = state.timestampMode;
  main.innerHTML = detailHeader('timestamp', t("24 个城市时区 + UTC。时间戳与当地时间，双向转换。")) + `
  <div class="current-timestamp"><div><div class="label"><i class="live-dot"></i>${t("当前 Unix 时间戳")}</div><div class="value" data-live-epoch>${Math.floor(now.getTime() / 1000)}</div></div><div class="right-time"><span><span data-live-date="Asia/Shanghai">${formatShanghai(now)}</span><span style="display:block;text-align:right;margin-top:5px">${t("Asia/Shanghai · 秒")}</span></span><button class="icon-btn" id="copy-current" aria-label="${t("复制当前时间戳")}">${icon('copy')}</button></div></div>
  <div class="detail-columns"><section class="panel"><div class="conversion-tabs"><button data-timestamp-mode="to-date" class="${mode === 'to-date' ? 'active' : ''}">${t("时间戳 → 日期时间")}</button><button data-timestamp-mode="to-epoch" class="${mode === 'to-epoch' ? 'active' : ''}">${t("日期时间 → 时间戳")}</button></div>
  <label class="input-label" for="timestamp-input">${mode === 'to-date' ? t("输入时间戳") : t("输入当地日期时间")}</label><div class="input-row"><input class="field mono" id="timestamp-input" ${mode === 'to-date' ? 'type="text" inputmode="numeric"' : 'type="datetime-local" step="0.001"'} value="${mode === 'to-date' ? Math.floor(now.getTime() / 1000) : AudenTime.format(now, state.timezone, true)}"/>${mode === 'to-date' ? `<select class="field" id="timestamp-unit" aria-label="${t("时间戳单位")}"><option value="seconds">${t("秒（s）")}</option><option value="milliseconds">${t("毫秒（ms）")}</option></select>` : ''}</div>
  <div class="field-group"><div class="field-heading"><label class="input-label" id="zone-field-label">${mode === 'to-date' ? t("结果时区") : t("输入时区")}</label><span>${t("25 个时区可选")}</span></div><button class="timezone-picker" id="output-zone-picker" aria-labelledby="zone-field-label">${timezoneButton()}</button><div class="zone-shortcuts">${['Asia/Shanghai', 'UTC', 'America/New_York', 'Asia/Dubai'].map(tz => { const zone = timeZones.find(zone => zone.tz === tz); return `<button data-timezone-select="${tz}" class="${tz === state.timezone ? 'active' : ''}">${zone.flag} ${tz === 'UTC' ? 'UTC' : zone.name}</button>`; }).join('')}</div></div>
  <div class="field-group" id="timestamp-overlap-field" hidden><label class="input-label" for="timestamp-overlap">${t("这个当地时间出现两次，请选择")}</label><select class="field" id="timestamp-overlap"><option value="earlier">${t("第一次（时钟回拨前）")}</option><option value="later">${t("第二次（时钟回拨后）")}</option></select></div>
  <div class="button-row"><button class="button primary" id="convert-timestamp">${icon('arrows')}${t("开始转换")}</button><button class="button" id="fill-now">${t("使用当前时间")}</button></div><div class="results-box"><div class="results-title"><span>${t("转换结果")}</span><button class="icon-btn" id="copy-timestamp-result" aria-label="${t("复制转换结果")}">${icon('copy')}</button></div><div id="timestamp-result"></div></div><p class="validation-error" id="timestamp-error" role="alert"></p>
  </section><aside class="panel"><div class="panel-heading"><h2>${t("关于时间与时区")}</h2>${icon('globe')}</div><div class="timezone-coverage"><strong>25</strong><span>${t("个常用时区")}<small>${t("亚洲 · 欧洲 · 美洲 · 大洋洲 · UTC")}</small></span></div><div class="help-list"><div class="help-item"><span>UNIX TIMESTAMP</span><p>${t("从 1970 年 1 月 1 日 00:00:00 UTC 起，经过的秒数。同一时间戳始终代表同一个瞬间。")}</p></div><div class="help-item"><span>${t("秒 / 毫秒")}</span><p>${t("秒级时间戳通常为 10 位，毫秒级通常为 13 位。")}<br/><code>${t("1 秒 = 1,000 毫秒")}</code></p></div><div class="help-item"><span>${t("自动处理夏令时")}</span><p>${t("按照所选日期的时区规则转换。回拨造成的重复时间可选择前后两次，跳时造成的不存在时间会提示调整。")}</p></div></div><div class="notice">${icon('shield')}${t("输入内容仅在当前浏览器中处理。")}</div></aside></div>`;
  document.getElementById('copy-current').onclick = () => copy(Math.floor(Date.now() / 1000));
  document.getElementById('convert-timestamp').onclick = convertTimestamp;
  document.getElementById('output-zone-picker').onclick = openTimezones;
  document.getElementById('fill-now').onclick = () => { const unit = document.getElementById('timestamp-unit')?.value; document.getElementById('timestamp-input').value = mode === 'to-date' ? (unit === 'milliseconds' ? Date.now() : Math.floor(Date.now() / 1000)) : AudenTime.format(new Date(), state.timezone, true); convertTimestamp(); };
  document.getElementById('copy-timestamp-result').onclick = () => copy(document.getElementById('timestamp-result').innerText);
  document.getElementById('timestamp-overlap').value = state.overlap;
  document.getElementById('timestamp-overlap').onchange = event => { state.overlap = event.target.value; convertTimestamp(); };
  document.getElementById('timestamp-input').oninput = convertTimestamp;
  if (document.getElementById('timestamp-unit')) document.getElementById('timestamp-unit').onchange = convertTimestamp;
  convertTimestamp();
}
function selectTimezone(timezone) {
  state.timezone = timezone; state.overlap = 'earlier';
  document.getElementById('output-zone-picker').innerHTML = timezoneButton();
  document.getElementById('timestamp-overlap').value = 'earlier';
  document.querySelectorAll('[data-timezone-select]').forEach(button => button.classList.toggle('active', button.dataset.timezoneSelect === timezone));
  closeDialogs(); convertTimestamp();
}
function convertTimestamp() {
  const value = document.getElementById('timestamp-input').value.trim(), error = document.getElementById('timestamp-error');
  const overlapField = document.getElementById('timestamp-overlap-field');
  error.textContent = ''; overlapField.hidden = true;
  const zone = state.timezone;
  try {
    let date;
    if (state.timestampMode === 'to-date') {
      if (!/^-?\d+$/.test(value)) throw new Error(t("请输入有效的整数时间戳。"));
      const input = Number(value), milliseconds = input * (document.getElementById('timestamp-unit').value === 'seconds' ? 1000 : 1);
      if (!Number.isSafeInteger(milliseconds)) throw new Error(t("时间戳超出安全转换范围。"));
      date = new Date(milliseconds);
    } else {
      const candidates = AudenTime.parse(value, zone);
      overlapField.hidden = candidates.length < 2;
      date = state.overlap === 'later' ? candidates[candidates.length - 1] : candidates[0];
    }
    if (!Number.isFinite(date.getTime())) throw new Error(t("这个时间超出了有效范围，请检查输入。"));
    const selected = timeZones.find(item => item.tz === zone);
    const output = state.timestampMode === 'to-date' ? [[t("当地日期时间"), AudenTime.format(date, zone, document.getElementById('timestamp-unit').value === 'milliseconds').replace('T', ' ')], ['ISO 8601 / UTC', date.toISOString()], [t("结果时区"), `${selected.name} · ${offsetLabel(zone, date)}`], [t("IANA 标识"), zone]] : [[t("秒级时间戳"), String(Math.floor(date.getTime() / 1000))], [t("毫秒级时间戳"), String(date.getTime())], ['ISO 8601 / UTC', date.toISOString()], [t("输入时区"), `${selected.name} · ${offsetLabel(zone, date)}`]];
    document.getElementById('timestamp-result').innerHTML = output.map(([label, text]) => `<div class="result-line"><span>${label}</span><strong>${escapeHtml(text)}</strong></div>`).join('');
    document.getElementById('copy-timestamp-result').disabled = false;
  } catch (exception) {
    error.textContent = t(exception.message);
    document.getElementById('timestamp-result').innerHTML = `<p class="muted" style="font-size:11px">${t("等待有效输入")}</p>`;
    document.getElementById('copy-timestamp-result').disabled = true;
  }
}
function renderDate() {
  main.innerHTML = detailHeader('date', t("从今天到那一天，每一天都算数。")) + `<div class="detail-columns"><section class="panel"><div class="panel-heading"><h2>${t("计算日期间隔")}</h2><span class="subtle">${t("按自然日计算")}</span></div><div class="date-fields"><div class="field-group"><label class="input-label" for="date-start">${t("开始日期")}</label><input class="field" type="date" id="date-start" value="2026-10-31"/></div><div class="field-group"><label class="input-label" for="date-end">${t("结束日期")}</label><input class="field" type="date" id="date-end" value="2027-01-01"/></div></div><div class="results-box date-result"><strong id="date-days">62</strong><span>${t("天")}</span><p id="date-caption">${t("距离新的一天，还有新的可能。")}</p></div><div class="button-row"><button class="button primary" id="calculate-date">${icon('calendar')}${t("计算间隔")}</button><button class="button" id="date-today">${t("从今天开始")}</button></div></section><aside class="panel"><div class="panel-heading"><h2>${t("日期加减")}</h2></div><label class="input-label" for="date-base">${t("起始日期")}</label><input class="field" id="date-base" type="date" value="2026-10-31" style="width:100%;margin-bottom:18px"/><label class="input-label" for="date-offset">${t("增加或减少天数")}</label><input class="field" id="date-offset" type="number" value="30" style="width:100%"/><p class="muted" style="font-size:9px;margin-top:9px">${t("输入负数可以向前推算日期。")}</p><div class="results-box" style="margin-top:22px"><span class="muted" style="font-size:10px">${t("计算后的日期")}</span><div class="compact-output" id="date-offset-result"></div></div></aside></div>`;
  const calculate = () => { const start = new Date(`${document.getElementById('date-start').value}T00:00:00Z`), end = new Date(`${document.getElementById('date-end').value}T00:00:00Z`); if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime())) return; const days = Math.round((end - start) / 86400000); document.getElementById('date-days').textContent = Math.abs(days); document.getElementById('date-caption').textContent = `${days < 0 ? t('结束日期早于开始日期，') : ''}${t('相差 {weeks} 周 {days} 天 · 不含开始日', { weeks: Math.floor(Math.abs(days) / 7), days: Math.abs(days) % 7 })}`; };
  const add = () => { const date = new Date(`${document.getElementById('date-base').value}T00:00:00Z`); date.setUTCDate(date.getUTCDate() + Number(document.getElementById('date-offset').value)); if (Number.isFinite(date.getTime())) document.getElementById('date-offset-result').textContent = date.toISOString().slice(0, 10); };
  document.getElementById('calculate-date').onclick = calculate; document.getElementById('date-today').onclick = () => { document.getElementById('date-start').value = new Date().toISOString().slice(0, 10); calculate(); }; ['date-start','date-end'].forEach(id => document.getElementById(id).onchange = calculate); ['date-base','date-offset'].forEach(id => document.getElementById(id).oninput = add); calculate(); add();
}
const unitGroups = { length: [['米', '1'], ['千米', '1000'], ['厘米', '0.01'], ['英尺', '0.3048'], ['英寸', '0.0254']], weight: [['千克', '1'], ['克', '0.001'], ['磅', '0.45359237'], ['盎司', '0.028349523125']], temperature: [['摄氏度', 'c'], ['华氏度', 'f'], ['开尔文', 'k']] };
function renderUnits() {
  main.innerHTML = detailHeader('units', t("熟悉的数值，不同的单位。换算变得简单。")) + `<div class="detail-columns"><section class="panel"><div class="panel-heading"><h2>${t("单位换算")}</h2><select class="field" id="unit-category" aria-label="${t("换算类别")}" style="height:33px"><option value="length">${t("长度")}</option><option value="weight">${t("重量")}</option><option value="temperature">${t("温度")}</option></select></div><label class="input-label" for="unit-value">${t("输入数值")}</label><div class="input-row"><input class="field" id="unit-value" type="text" inputmode="decimal" maxlength="220" value="100"/><select class="field" id="unit-from" aria-label="${t("原始单位")}"></select></div><label class="input-label" for="unit-to">${t("转换为")}</label><select class="field" id="unit-to" style="width:100%;margin-bottom:24px"></select><div class="results-box"><p class="muted" style="font-size:10px;margin-bottom:8px">${t("换算结果")}</p><div class="unit-result" id="unit-result"></div><p class="precision-note">${t('结果最多保留 8 位小数，仅在显示时四舍五入。')}</p></div><p class="validation-error" id="unit-error" role="alert"></p></section><aside class="panel"><div class="panel-heading"><h2>${t("常用关系")}</h2>${icon('ruler')}</div><div class="help-list"><div class="help-item"><span>${t("长度")}</span><p>${t("1 英寸 = 2.54 厘米")}<br/>${t("1 英尺 = 0.3048 米")}<br/>${t("1 千米 = 1,000 米")}</p></div><div class="help-item"><span>${t("重量")}</span><p>${t("1 磅 = 0.45359237 千克")}<br/>${t("1 千克 = 1,000 克")}</p></div><div class="help-item"><span>${t("温度")}</span><p>${t("华氏度 = 摄氏度 × 1.8 + 32")}<br/>${t("开尔文 = 摄氏度 + 273.15")}</p></div></div></aside></div>`;
  const calculate = () => {
    const group = document.getElementById('unit-category').value, list = unitGroups[group];
    const from = list[Number(document.getElementById('unit-from').value)], to = list[Number(document.getElementById('unit-to').value)];
    try {
      const value = decimal.parse(document.getElementById('unit-value').value);
      let result;
      if (group === 'temperature') {
        const c = from[1] === 'f' ? decimal.divide(decimal.subtract(value, '32'), '1.8') : from[1] === 'k' ? decimal.subtract(value, '273.15') : value;
        result = to[1] === 'f' ? decimal.add(decimal.multiply(c, '1.8'), '32') : to[1] === 'k' ? decimal.add(c, '273.15') : c;
      } else result = decimal.multiply(value, decimal.divide(from[1], to[1]));
      document.getElementById('unit-result').textContent = decimal.format(decimal.round(result, 8), AudenI18n.locale, true) + ' ' + t(to[0]);
      document.getElementById('unit-error').textContent = '';
    } catch {
      document.getElementById('unit-result').textContent = '—';
      document.getElementById('unit-error').textContent = t('请输入有效数值（最多 200 位数字）。');
    }
  };
  const fill = () => { const list = unitGroups[document.getElementById('unit-category').value]; ['unit-from','unit-to'].forEach((id, which) => { document.getElementById(id).innerHTML = list.map(([name], index) => `<option value="${index}" ${index === which ? 'selected' : ''}>${t(name)}</option>`).join(''); }); calculate(); }; document.getElementById('unit-category').onchange = fill; ['unit-value','unit-from','unit-to'].forEach(id => document.getElementById(id).oninput = calculate); fill();
}
function renderText() {
  main.innerHTML = detailHeader('text', t("把文字整理好，让思路更清晰。")) + `<section class="panel"><div class="panel-heading"><h2>${t("文本工作区")}</h2><button class="button small" id="copy-text">${icon('copy')}${t("复制文本")}</button></div><textarea class="text-area" id="text-input" aria-label="${t("待处理文本")}" placeholder="${t("在这里粘贴或输入文本…")}">${escapeHtml([t('让日常，简单一点。'), t('把时间留给更重要的事。'), t('让日常，简单一点。'), '', 'Auden Tools — your everyday toolkit.'].join('\n'))}</textarea><div class="status-row" id="text-stats"></div><div class="button-row" style="flex-wrap:wrap"><button class="button primary" data-text-action="dedupe">${t("按行去重")}</button><button class="button" data-text-action="empty">${t("去除空行")}</button><button class="button" data-text-action="trim">${t("清理首尾空格")}</button><button class="button" data-text-action="sort">${t("按行排序")}</button><button class="button" data-text-action="upper">${t("转为大写")}</button><button class="button" data-text-action="lower">${t("转为小写")}</button></div><div class="notice">${icon('shield')}${t("文本仅在当前浏览器处理。请按需要复制保存处理结果。")}</div></section>`;
  document.getElementById('text-input').oninput = updateTextStats; document.getElementById('copy-text').onclick = () => copy(document.getElementById('text-input').value); updateTextStats();
}
function updateTextStats() { const text = document.getElementById('text-input').value; document.getElementById('text-stats').innerHTML = `<span>${t('{characters} 字符 · {lines} 行 · {han} 个汉字', { characters: [...text].length, lines: text ? text.split('\n').length : 0, han: text.match(/[\u4e00-\u9fff]/g)?.length || 0 })}</span><span>${t("即时统计")}</span>`; }
function renderJson() {
  main.innerHTML = detailHeader('json', t("让结构一目了然，让数据清晰可读。")) + `<section class="panel"><div class="panel-heading"><h2>${t("JSON 编辑器")}</h2><div style="display:flex;gap:8px"><select class="field" id="json-indent" aria-label="${t("缩进")}" style="height:32px;font-size:10px"><option value="2">${t("2 空格")}</option><option value="4">${t("4 空格")}</option></select><button class="button small" id="copy-json">${icon('copy')}${t("复制")}</button></div></div><textarea class="text-area json-area" id="json-input" aria-label="${t("JSON 内容")}" spellcheck="false" style="min-height:330px">${escapeHtml(JSON.stringify({ name: 'Auden Tools', description: t('让日常，简单一点。'), tools: ['time', 'currency', 'text'], simple: true }, null, 2))}</textarea><div class="status-row"><span id="json-status">${t("有效 JSON")}</span><span>${t("输入内容仅在浏览器处理")}</span></div><div class="button-row"><button class="button primary" data-json-action="format">${icon('code')}${t("格式化")}</button><button class="button" data-json-action="compress">${t("压缩")}</button><button class="button" data-json-action="validate">${t("校验")}</button></div></section>`;
  document.getElementById('copy-json').onclick = () => copy(document.getElementById('json-input').value);
}
function updateNav() {
  document.getElementById('favorite-count').textContent = state.favorites.length;
  document.querySelectorAll('.nav-item').forEach(item => { const active = item.dataset.view === 'home' && state.view === 'home' && state.filter === 'all' || item.dataset.filter === state.filter && state.view === 'home' || item.dataset.category === (state.view === 'home' ? state.filter : tools.find(tool => tool.id === state.view)?.category); item.classList.toggle('active', active); });
  document.getElementById('breadcrumb-current').textContent = state.view === 'home' ? ({ favorites: t("我的收藏"), recent: t("最近使用"), time: t("时间与日期"), convert: t("换算与计算"), text: t("文本与开发") })[state.filter] || t("工具首页") : tools.find(tool => tool.id === state.view)?.name || t("工具首页");
}
function render() { ({ home: renderHome, world: renderWorld, currency: renderCurrency, timestamp: renderTimestamp, date: renderDate, units: renderUnits, text: renderText, json: renderJson })[state.view](); updateNav(); hydrateIcons(); document.getElementById('sidebar').classList.remove('open'); }
function navigate(view, preserveFilter = false) { if (view !== 'home' && !tools.some(tool => tool.id === view)) view = 'home'; state.view = view; if (!preserveFilter) { state.filter = 'all'; state.query = ''; } if (view !== 'home') { state.recent = [view, ...state.recent.filter(id => id !== view)].slice(0, 7); saveStorage('auden-design-recent', state.recent); } if (location.hash.slice(1) !== view) history.replaceState(null, '', `#${view}`); render(); window.scrollTo({ top: 0 }); }
function searchResults(query = '') { const displayed = tools.filter(tool => `${tool.name} ${tool.keywords} ${tool.searchTerms}`.toLowerCase().includes(query.toLowerCase())); document.getElementById('dialog-results').innerHTML = displayed.length ? displayed.map(tool => `<button class="search-result" data-view="${tool.id}">${toolIcon(tool)}<span><strong>${tool.name}</strong><small>${tool.desc}</small></span>${icon('right')}</button>`).join('') : `<p class="muted" style="padding:22px;font-size:12px">${t("没有找到相关工具，试试其他关键词。")}</p>`; }
function openSearch() { searchResults(); const input = document.getElementById('global-search'); input.value = ''; document.getElementById('search-dialog').showModal(); input.focus(); }
function catalogFilters(kind, items) {
  const regions = ['全部', ...new Set(items.map(item => item.region))];
  document.getElementById(`${kind}-filters`).innerHTML = regions.map(region => `<button class="filter-pill ${state[`${kind}Region`] === region ? 'active' : ''}" data-catalog="${kind}" data-region="${region}">${t(region)}</button>`).join('');
}
function updateCityOptions() {
  const query = document.getElementById('city-search').value;
  const matches = cities.filter(city => catalogMatch(city, query) && (state.cityRegion === '全部' || city.region === state.cityRegion));
  catalogFilters('city', cities);
  document.getElementById('city-options').innerHTML = matches.length ? matches.map(city => `<button class="catalog-option ${state.cities.includes(city.id) ? 'selected' : ''}" data-city="${city.id}" aria-pressed="${state.cities.includes(city.id)}" ${city.local ? 'disabled' : ''}>${flagBadge(city)}<span class="catalog-option-label"><strong>${city.name}<em>${city.country}</em></strong><small>${city.tz}</small></span><span class="catalog-option-end"><small>${offsetLabel(city.tz)}</small><span class="catalog-checkbox">${state.cities.includes(city.id) ? icon('check') : ''}</span></span></button>`).join('') : `<p class="catalog-empty">${t("没有找到城市，试试中文名或 IANA 时区。")}</p>`;
  document.getElementById('city-selection-count').textContent = t('已关注 {count} / {total} 个城市', { count: state.cities.length, total: cities.length });
}
function openCities() {
  state.cityRegion = '全部'; document.getElementById('city-search').value = ''; updateCityOptions();
  document.getElementById('city-dialog').showModal(); document.getElementById('city-search').focus();
}
function updateCurrencyOptions() {
  const query = document.getElementById('currency-search').value, isBase = state.currencyPickerMode === 'base';
  const matches = currencies.filter(currency => catalogMatch(currency, query) && (state.currencyRegion === '全部' || currency.region === state.currencyRegion));
  catalogFilters('currency', currencies);
  document.getElementById('currency-options').innerHTML = matches.length ? matches.map(currency => {
    const base = currency.code === state.baseCurrency, selected = isBase ? base : state.selectedCurrencies.includes(currency.code);
    return `<button class="catalog-option ${selected ? 'selected' : ''}" data-currency="${currency.code}" aria-pressed="${selected}" ${!isBase && base ? 'disabled' : ''}>${flagBadge(currency)}<span class="catalog-option-label"><strong>${currency.code}<em>${currency.name}</em></strong><small>${currency.country}</small></span><span class="catalog-option-end">${base ? `<small>${t("基础货币")}</small>` : `<small>${currency.sign}</small>`}<span class="catalog-checkbox ${isBase ? 'radio' : ''}">${selected ? icon('check') : ''}</span></span></button>`;
  }).join('') : `<p class="catalog-empty">${t("没有找到货币，试试 USD、日元或日本。")}</p>`;
  document.getElementById('currency-selection-count').textContent = isBase ? t('共 {count} 种货币可选', { count: currencies.length }) : t('已选 {count} 种目标货币', { count: state.selectedCurrencies.length });
  document.getElementById('currency-select-all').hidden = isBase;
}
function openCurrencies(mode) {
  state.currencyPickerMode = mode; state.currencyRegion = '全部';
  document.getElementById('currency-dialog-title').textContent = mode === 'base' ? t("选择基础货币") : t("管理对照货币");
  document.getElementById('currency-search').value = ''; updateCurrencyOptions();
  document.getElementById('currency-dialog').showModal(); document.getElementById('currency-search').focus();
}
function selectAllCurrencies() {
  state.selectedCurrencies = currencies.filter(currency => currency.code !== state.baseCurrency).map(currency => currency.code);
  saveStorage('auden-design-currencies', state.selectedCurrencies); currencyRows();
  if (document.getElementById('currency-dialog').open) updateCurrencyOptions();
  toast(t('已显示 {count} 种目标货币', { count: state.selectedCurrencies.length }));
}
function updateTimezoneOptions() {
  const query = document.getElementById('timezone-search').value;
  const matches = timeZones.filter(zone => catalogMatch(zone, query) && (state.timezoneRegion === '全部' || zone.region === state.timezoneRegion));
  catalogFilters('timezone', timeZones);
  document.getElementById('timezone-options').innerHTML = matches.length ? matches.map(zone => `<button class="catalog-option ${state.timezone === zone.tz ? 'selected' : ''}" data-timezone-select="${zone.tz}" aria-pressed="${state.timezone === zone.tz}">${flagBadge(zone)}<span class="catalog-option-label"><strong>${zone.name}<em>${zone.country}</em></strong><small>${zone.tz}</small></span><span class="catalog-option-end"><small>${offsetLabel(zone.tz)}</small><span class="catalog-checkbox radio">${state.timezone === zone.tz ? icon('check') : ''}</span></span></button>`).join('') : `<p class="catalog-empty">${t("没有找到时区，试试城市名或 Asia/Tokyo。")}</p>`;
}
function openTimezones() {
  state.timezoneRegion = '全部'; document.getElementById('timezone-search').value = ''; updateTimezoneOptions();
  document.getElementById('timezone-dialog').showModal(); document.getElementById('timezone-search').focus();
}
function closeDialogs() { document.querySelectorAll('dialog[open]').forEach(dialog => dialog.close()); }
function changeLanguage(locale) {
  // Keep editable values as data, including text/JSON that happens to match UI copy.
  const fields = [...main.querySelectorAll('input[id], select[id], textarea[id]')]
    .map(input => ({ id: input.id, value: input.value }));
  const scroll = { top: window.scrollY, left: window.scrollX };
  AudenI18n.setLocale(locale);
  AudenI18n.apply();
  render();
  if (state.view === 'units') {
    document.getElementById('unit-category').value = fields.find(field => field.id === 'unit-category').value;
    document.getElementById('unit-category').onchange();
  }
  fields.forEach(({ id, value }) => { const input = document.getElementById(id); if (input) input.value = value; });
  if (state.view === 'timestamp') convertTimestamp();
  if (state.view === 'currency') currencyRows();
  if (state.view === 'world') timeline();
  if (state.view === 'date') {
    document.getElementById('date-start').onchange();
    document.getElementById('date-base').oninput();
  }
  if (state.view === 'units') document.getElementById('unit-value').oninput();
  if (state.view === 'text') updateTextStats();
  if (state.view === 'json') {
    const status = document.getElementById('json-status');
    try { JSON.parse(document.getElementById('json-input').value); status.textContent = t('✓ 有效 JSON'); }
    catch (error) { status.textContent = t('格式错误：{message}', { message: error.message }); status.style.color = '#b25b50'; }
  }
  window.scrollTo(scroll);
}
document.addEventListener('click', event => {
  const button = event.target.closest('button'); if (!button) return;
  if (button.dataset.view) { closeDialogs(); navigate(button.dataset.view); }
  if (button.dataset.category || button.dataset.filter) { state.filter = button.dataset.category || button.dataset.filter; state.query = ''; navigate('home', true); if (state.filter !== 'all') document.getElementById('all-tools').scrollIntoView({ behavior: 'smooth', block: 'start' }); }
  if (button.dataset.favorite) { const id = button.dataset.favorite, index = state.favorites.indexOf(id); if (index >= 0) state.favorites.splice(index, 1); else state.favorites.push(id); saveStorage('auden-design-favorites', state.favorites); toast(index >= 0 ? t("已取消收藏") : t("已加入我的收藏")); updateNav(); if (state.view === 'home') renderTools(); else button.innerHTML = `${icon('star')}${state.favorites.includes(id) ? t("已收藏") : t("收藏工具")}`; }
  if (button.hasAttribute('data-theme-toggle')) { document.body.classList.toggle('dark'); try { localStorage.setItem('auden-design-theme', document.body.classList.contains('dark') ? 'dark' : 'light'); } catch {} }
  if (button.hasAttribute('data-close-dialog')) closeDialogs();
  if (button.dataset.copy) copy(button.dataset.copy);
  if (button.dataset.hourFormat) { state.hour12 = button.dataset.hourFormat === '12'; renderWorld(); }
  if (button.dataset.timestampMode) { state.timestampMode = button.dataset.timestampMode; renderTimestamp(); }
  if (button.dataset.city) {
    const id = button.dataset.city; if (id === 'shanghai') return;
    if (state.cities.includes(id)) state.cities = state.cities.filter(cityId => cityId !== id); else state.cities.push(id);
    saveStorage('auden-design-cities', state.cities); renderWorld(); updateCityOptions();
  }
  if (button.dataset.cityPreset) {
    state.cities = button.dataset.cityPreset === 'all' ? cities.map(city => city.id) : [...defaultCities];
    saveStorage('auden-design-cities', state.cities); renderWorld();
    if (document.getElementById('city-dialog').open) updateCityOptions();
  }
  if (button.dataset.catalog) {
    state[`${button.dataset.catalog}Region`] = button.dataset.region;
    ({ city: updateCityOptions, currency: updateCurrencyOptions, timezone: updateTimezoneOptions })[button.dataset.catalog]();
  }
  if (button.dataset.currency) {
    const code = button.dataset.currency;
    if (state.currencyPickerMode === 'base') {
      const previous = state.baseCurrency; state.baseCurrency = code;
      state.selectedCurrencies = state.selectedCurrencies.filter(item => item !== code);
      if (previous !== code && !state.selectedCurrencies.includes(previous)) state.selectedCurrencies.push(previous);
      closeDialogs(); renderCurrency();
    } else {
      state.selectedCurrencies = state.selectedCurrencies.includes(code) ? state.selectedCurrencies.filter(item => item !== code) : [...state.selectedCurrencies, code];
      currencyRows(); updateCurrencyOptions();
    }
    saveStorage('auden-design-currencies', state.selectedCurrencies);
  }
  if (button.dataset.removeCurrency) {
    state.selectedCurrencies = state.selectedCurrencies.filter(code => code !== button.dataset.removeCurrency);
    saveStorage('auden-design-currencies', state.selectedCurrencies); currencyRows();
  }
  if (button.dataset.timezoneSelect) selectTimezone(button.dataset.timezoneSelect);
  if (button.dataset.textAction) { const input = document.getElementById('text-input'), lines = input.value.split('\n'); const actions = { dedupe: () => [...new Set(lines)].join('\n'), empty: () => lines.filter(line => line.trim()).join('\n'), trim: () => lines.map(line => line.trim()).join('\n').trim(), sort: () => lines.toSorted((a, b) => a.localeCompare(b, AudenI18n.locale)).join('\n'), upper: () => input.value.toUpperCase(), lower: () => input.value.toLowerCase() }; input.value = actions[button.dataset.textAction](); updateTextStats(); toast(t("文本已处理")); }
  if (button.dataset.jsonAction) { const input = document.getElementById('json-input'), status = document.getElementById('json-status'); try { JSON.parse(input.value); if (button.dataset.jsonAction === 'format') input.value = AudenJson.format(input.value, Number(document.getElementById('json-indent').value)); if (button.dataset.jsonAction === 'compress') input.value = AudenJson.minify(input.value); status.textContent = t("✓ 有效 JSON"); status.style.color = 'var(--brand)'; toast(button.dataset.jsonAction === 'validate' ? t("JSON 校验通过") : t("JSON 已处理")); } catch (error) { status.textContent = t('格式错误：{message}', { message: error.message }); status.style.color = '#b25b50'; } }
});
document.getElementById('city-search').oninput = updateCityOptions;
document.getElementById('currency-search').oninput = updateCurrencyOptions;
document.getElementById('timezone-search').oninput = updateTimezoneOptions;
document.getElementById('currency-select-all').onclick = selectAllCurrencies;
document.getElementById('quick-search').onclick = openSearch;
document.getElementById('global-search').oninput = event => searchResults(event.target.value);
document.getElementById('global-search').onkeydown = event => { if (event.key === 'Enter') document.querySelector('.search-result')?.click(); };
document.getElementById('menu-toggle').onclick = () => document.getElementById('sidebar').classList.toggle('open');
document.getElementById('help-button').onclick = () => toast(t("UI 设计预览：可切换页面、收藏和搜索。汇率为示例数据。"));
document.querySelectorAll('dialog').forEach(dialog => dialog.addEventListener('click', event => { if (event.target === dialog) { const rect = dialog.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close(); } }));
document.addEventListener('keydown', event => { if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); openSearch(); } if ((event.metaKey || event.ctrlKey) && event.key === '1') { event.preventDefault(); navigate('home'); } });
window.addEventListener('hashchange', () => navigate(location.hash.slice(1) || 'home'));
try { if (localStorage.getItem('auden-design-theme') === 'dark') document.body.classList.add('dark'); } catch {}
AudenI18n.apply();
document.getElementById('language-select').value = AudenI18n.locale;
document.getElementById('language-select').onchange = event => changeLanguage(event.target.value);
navigate(location.hash.slice(1) || 'home');
setInterval(() => { const now = new Date(); document.querySelectorAll('[data-live-epoch]').forEach(el => el.textContent = Math.floor(now.getTime() / 1000)); document.querySelectorAll('[data-live-date]').forEach(el => el.textContent = AudenTime.format(now, el.dataset.liveDate).replace('T', ' ')); document.querySelectorAll('[data-timezone]').forEach(el => el.textContent = timeIn(el.dataset.timezone, now)); document.querySelectorAll('[data-clock]').forEach(el => { const parts = dateParts(el.dataset.clock, now); el.querySelector('.clock-hour').style.transform = `rotate(${Number(parts.hour) * 30 + Number(parts.minute) / 2}deg)`; el.querySelector('.clock-minute').style.transform = `rotate(${Number(parts.minute) * 6}deg)`; }); }, 1000);
