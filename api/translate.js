export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { prompt } = req.body;
        
        if (!prompt || typeof prompt !== 'string') {
            return res.status(400).json({ 
                error: 'Invalid request: prompt is required and must be a string' 
            });
        }

        if (!process.env.GROQ_API_KEY) {
            return res.status(500).json({ 
                error: 'Server configuration error: GROQ_API_KEY not found' 
            });
        }

        const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${process.env.GROQ_API_KEY}`
            },
            body: JSON.stringify({
                model: process.env.GROQ_MODEL || "llama-3.1-8b-instant",
                messages: [{ role: "user", content: prompt }],
                max_tokens: parseInt(process.env.MAX_TOKENS) || 1000,
                temperature: parseFloat(process.env.TEMPERATURE) || 0.7
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            return res.status(response.status).json({ 
                error: errorData.error?.message || 'API request failed'
            });
        }

        const data = await response.json();
        
        if (!data.choices || !data.choices[0] || !data.choices[0].message) {
            return res.status(500).json({ 
                error: 'Invalid response from AI service' 
            });
        }

        res.json(data);

    } catch (error) {
        console.error('Server error:', error.message);
        res.status(500).json({ 
            error: 'Internal server error: ' + error.message 
        });
    }
}