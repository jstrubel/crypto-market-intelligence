// 2s–10s spread: DGS10 - DGS2
// Usage: /api/yield-spread?start=2018-01-01
export default async function handler(req, res) {
  const key = process.env.FRED_API_KEY;
  if (!key) return res.status(500).json({ error: "Missing FRED_API_KEY" });

  const start = req.query.start || "2018-01-01";

  async function getSeries(series_id) {
    const url = `https://api.stlouisfed.org/fred/series/observations?series_id=${series_id}&api_key=${key}&file_type=json&observation_start=${start}`;
    const r = await fetch(url);
    const j = await r.json();
    const pts = (j.observations || [])
      .filter(o => o.value !== ".")
      .map(o => ({ time: o.date, value: Number(o.value) }));
    return pts;
  }

  const [ten, two] = await Promise.all([getSeries("DGS10"), getSeries("DGS2")]);

  // date => value map for 2y
  const map2 = new Map(two.map(p => [p.time, p.value]));
  const spread = ten
    .filter(p => map2.has(p.time))
    .map(p => ({ time: p.time, value: +(p.value - map2.get(p.time)).toFixed(3) }));

  res.setHeader("Cache-Control", "s-maxage=3600, stale-while-revalidate");
  res.status(200).json({ series_id: "DGS10-DGS2", start, points: spread });
}
