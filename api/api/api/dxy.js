// DXY proxy from FRED: Trade-Weighted Dollar Index (Broad), seasonally adjusted
// Series: DTWEXBGS  (Not the ICE DXY, but close enough for macro trend)
// Usage: /api/dxy?start=2020-01-01
export default async function handler(req, res) {
  const key = process.env.FRED_API_KEY;
  if (!key) return res.status(500).json({ error: "Missing FRED_API_KEY" });

  const start = req.query.start || "2018-01-01";
  const url = `https://api.stlouisfed.org/fred/series/observations?series_id=DTWEXBGS&api_key=${key}&file_type=json&observation_start=${start}`;
  const r = await fetch(url);
  const j = await r.json();

  const points = (j.observations || [])
    .filter(o => o.value !== ".")
    .map(o => ({ time: o.date, value: Number(o.value) }));

  res.setHeader("Cache-Control", "s-maxage=3600, stale-while-revalidate");
  res.status(200).json({ series_id: "DTWEXBGS", start, points });
}
