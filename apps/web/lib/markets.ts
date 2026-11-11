const tradingView = "https://www.tradingview.com";

export const marketRanks = {
  us: `${tradingView}/markets/stocks-usa/market-movers-large-cap/`,
  hk: `${tradingView}/markets/stocks-hong-kong/market-movers-large-cap/`,
  jp: `${tradingView}/markets/stocks-japan/market-movers-large-cap/`,
  kr: `${tradingView}/markets/stocks-korea/market-movers-large-cap/`,
  crypto: `${tradingView}/markets/cryptocurrencies/prices-large-cap/`,
};

export const marketSymbolUrl = (symbol: string) =>
  `${tradingView}/symbols/${symbol.replace(":", "-")}/`;

export const indexGroups = [
  {
    name: "美股",
    flag: "🇺🇸",
    items: [
      ["标普 500", "SP:SPX"],
      ["道琼斯工业平均指数", "DJ:DJI"],
      ["纳斯达克综合指数", "NASDAQ:IXIC"],
      ["纳斯达克 100", "NASDAQ:NDX"],
    ],
  },
  {
    name: "港股",
    flag: "🇭🇰",
    items: [
      ["恒生指数", "HSI:HSI"],
      ["恒生科技指数", "HSI:HSTECH"],
    ],
  },
  {
    name: "日股",
    flag: "🇯🇵",
    items: [
      ["日经 225", "TVC:NI225"],
      ["东证指数", "TSE:TOPIX"],
    ],
  },
  {
    name: "韩股",
    flag: "🇰🇷",
    items: [
      ["韩国综合股价指数", "KRX:KOSPI"],
      ["KOSDAQ 综合指数", "KRX:KOSDAQ"],
    ],
  },
] as const;

export const stockGroups = [
  {
    name: "港股",
    flag: "🇭🇰",
    currency: "HKD",
    rank: marketRanks.hk,
    items: [
      ["腾讯", "HKEX:700"],
      ["阿里巴巴", "HKEX:9988"],
      ["汇丰控股", "HKEX:5"],
      ["比亚迪", "HKEX:1211"],
      ["小米", "HKEX:1810"],
    ],
  },
  {
    name: "日股",
    flag: "🇯🇵",
    currency: "JPY",
    rank: marketRanks.jp,
    items: [
      ["丰田汽车", "TSE:7203"],
      ["索尼", "TSE:6758"],
      ["三菱日联金融集团", "TSE:8306"],
      ["东京电子", "TSE:8035"],
      ["任天堂", "TSE:7974"],
    ],
  },
  {
    name: "韩股",
    flag: "🇰🇷",
    currency: "KRW",
    rank: marketRanks.kr,
    items: [
      ["三星电子", "KRX:005930"],
      ["SK 海力士", "KRX:000660"],
      ["现代汽车", "KRX:005380"],
      ["NAVER", "KRX:035420"],
      ["LG 新能源", "KRX:373220"],
    ],
  },
] as const;

export const overviewTabs = [
  {
    title: "美股观察名单",
    symbols: [
      "NASDAQ:NVDA",
      "NASDAQ:AAPL",
      "NASDAQ:MSFT",
      "NASDAQ:AMZN",
      "NASDAQ:GOOGL",
      "NYSE:JPM",
    ],
  },
  { title: "香港指数", symbols: ["HSI:HSI", "HSI:HSTECH"] },
] as const;
