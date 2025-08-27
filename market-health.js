// Simple in-memory storage (resets on deployment)
let latestData = {
  value: null,
  timestamp: null,
  status: "No data"
};

export default function handler(req, res) {
  if (req.method === 'POST') {
    // Store the incoming webhook data
    latestData = {
      value: req.body.value || Math.random() * 100, // fallback for testing
      timestamp: new Date().toISOString(),
      status: req.body.status || "UPDATED"
    };
    
    console.log('Market Health updated:', latestData);
    res.status(200).json({ success: true });
    
  } else if (req.method === 'GET') {
    // Return current data for dashboard
    res.status(200).json(latestData);
    
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
}
