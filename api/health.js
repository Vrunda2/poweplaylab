export default function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }
    
    res.json({ 
        status: 'ok', 
        timestamp: new Date().toISOString(),
        groqConfigured: !!process.env.GROQ_API_KEY 
    });
}