export default function handler(req, res) {
  if (req.method === 'POST') {
    // Store the data from TradingView
    const data = req.body;
    console.log('Received market health data:', data);
    
    // For now, just return success
    // Later we'll add database storage
    res.status(200).json({ success: true });
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
}
