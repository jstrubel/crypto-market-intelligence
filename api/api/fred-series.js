// Simple FRED series fetcher
// Usage: /api/fred-series?series_id=DGS10&start=2018-01-01
export default async function handler(req, res) {
  const key = process.env.FRED_API_KEY;
  const { series_id, start = "2018-01-01" } = req.query || {};
  if (!key) return res.status(500).json({ error: "Missing FRED_API_KEY" });
  if (!series_id) return res.status(400).json({ error: "series_id is required" });

  const url = `https://api.stlouisfed.org/fred/series/observations?` +
              `series_id=${encodeURIComponent(series_id)}&api_key=${key}` +
              `&file_type=json&observation_start=${encodeURIComponent(start)}`;

  const r = await fetch(url);
  const j = await r.json();

  const points = (j.observations || [])
    .filter(o => o.value !== ".")
    .map(o => ({ time: o.date, value: Number(o.value) }));

  res.setHeader("Cache-Control", "s-maxage=3600, stale-while-revalidate");
  res.status(200).json({ series_id, start, points });
}
