// /api/macro.js — serverless macro feed for your site (Vercel)
// Fetches: DXY, VIX, SPY, QQQ, Gold (Yahoo) + 10Y/2Y (FRED)
// Returns a simple JSON your page can read.

const FRED_KEY = process.env.FRED_API_KEY;

// helpers
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const sma = (arr, p) => (arr && arr.length >= p)
  ? arr.slice(arr.length - p).reduce((a, b) => a + b, 0) / p
  : null;
const rocPct = (arr, p) => (arr && arr.length > p && arr[arr.length - 1 - p] != null)
  ? ((arr.at(-1) - arr[arr.length - 1 - p]) / arr[arr.length - 1 - p]) * 100
  : null;
const changeN = (arr, p) => (arr && arr.length > p)
  ? arr.at(-1) - arr[arr.length - 1 - p]
  : null;
const clean = (xs) => (xs || []).map(Number).filter(Number.isFinite);

// fetchers
async function fredSeries(seriesId, days = 500) {
  if (!FRED_KEY) throw new Error("Missing FRED_API_KEY");
  const start = new Date(); start.setDate(start.getDate() - days * 1.2);
  const url = `https://api.stlouisfed.org/fred/series/observations?series_id=${seriesId}&api_key=${FRED_KEY}&file_type=json&observation_start=${start.toISOString().slice(0,10)}`;
  const r = await fetch(url, { cache: "no-store" });
  if (!r.ok) throw new Error(`FRED ${seriesId} ${r.status}`);
  const j = await r.json();
  return clean(j?.observations?.map(o => parseFloat(o.value)));
}
async function yahooDaily(symbol, range = "2y", interval = "1d") {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=${range}&interval=${interval}`;
  const r = await fetch(url, { cache: "no-store" });
  if (!r.ok) throw new Error(`Yahoo ${symbol} ${r.status}`);
  const j = await r.json();
  return clean(j?.chart?.result?.[0]?.indicators?.quote?.[0]?.close);
}

async function computeMacro() {
  const [dxy, vix, spy, qqq, gold, dgs10, dgs2] = await Promise.all([
    yahooDaily("^DXY"),
    yahooDaily("^VIX"),
    yahooDaily("SPY"),
    yahooDaily("QQQ"),
    yahooDaily("GC=F"),
    fredSeries("DGS10"),
    fredSeries("DGS2"),
  ]);

  const p = 20; // 20-day look for momentum
  const dxy_mom = rocPct(dxy, p);
  const ten_change = changeN(dgs10, p);
  const vix_last = vix.at(-1);
  const vix_ma20 = sma(vix, 20);
  const gold_mom = rocPct(gold, p);
  const spy_mom  = rocPct(spy,  p);
  const qqq_mom  = rocPct(qqq,  p);

  // score pieces (0-100)
  let dxyScore  = clamp(50 - (dxy_mom ?? 0) * 2, 0, 100);       // weaker USD => higher score
  let tenScore  = clamp(50 - (ten_change ?? 0) * 5, 0, 100);    // falling yields => higher score
  let vixScore  = clamp(50 - ((vix_last ?? 0) - 20) * 2, 0, 100);
  let spyScore  = clamp(50 + (spy_mom ?? 0) * 2, 0, 100);
  let goldScore = clamp(50 + (gold_mom ?? 0) * 1.5, 0, 100);

  const macro = dxyScore * 0.25 + tenScore * 0.25 + vixScore * 0.20 + spyScore * 0.20 + goldScore * 0.10;

  const dxySMA50 = sma(dxy, 50);
  const dxyTrend = (dxy.at(-1) != null && dxySMA50 != null && dxy.at(-1) > dxySMA50) ? "STRONG" : "WEAK";
  const dollarImpact = dxyTrend === "STRONG" ? "HEADWIND" : "TAILWIND";

  const vixStatus = (vix_ma20 && vix_last)
    ? (vix_last > vix_ma20 * 1.3 ? "HIGH FEAR" : (vix_last < vix_ma20 * 0.7 ? "LOW FEAR" : "NORMAL"))
    : "NORMAL";

  const ten = dgs10.at(-1);
  const two = dgs2.at(-1);
  const slope = (ten != null && two != null) ? (ten - two) : null;
  const yieldStatus = slope == null ? "—" : (slope < 0 ? "INVERTED" : slope < 0.5 ? "FLAT" : "STEEP");

  const riskOnMomentum  = ((spy_mom ?? 0) + (qqq_mom ?? 0)) / 2;
  const riskOffMomentum = (gold_mom ?? 0);
  const riskAppetite = riskOnMomentum > riskOffMomentum ? "RISK ON" : "RISK OFF";

  return {
    metrics: {
      macro: Number(macro.toFixed(1)),
      dxyScore: Math.round(dxyScore),
      tenScore: Math.round(tenScore),
      vixScore: Math.round(vixScore),
      spyScore: Math.round(spyScore)
    },
    status: {
      dxyTrend,
      dollarImpact,
      yieldStatus,
      vixStatus,
      riskAppetite,
      tenYear: ten != null ? Number(ten).toFixed(2) : null
    }
  };
}

// vercel handler
export default async function handler(req, res) {
  try {
    const data = await computeMacro();
    res.setHeader("Cache-Control", "s-maxage=60, stale-while-revalidate=600");
    res.status(200).json(data);
  } catch (e) {
    res.status(200).json({
      metrics: { macro: 50, dxyScore: 50, tenScore: 50, vixScore: 50, spyScore: 50 },
      status: { dxyTrend: "WEAK", dollarImpact: "TAILWIND", yieldStatus: "—", vixStatus: "NORMAL", riskAppetite: "RISK ON", tenYear: null },
      error: String(e?.message || e)
    });
  }
}
