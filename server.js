import express from "express";
import fetch from "node-fetch";
import dotenv from "dotenv";

dotenv.config();
const app = express();

// Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.static(".")); // serves index.html, script.js, etc.

// CORS middleware for development
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    next();
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        timestamp: new Date().toISOString(),
        groqConfigured: !!process.env.GROQ_API_KEY 
    });
});

// Main translation/AI processing endpoint
app.post("/translate", async (req, res) => {
    try {
        const { prompt } = req.body;
        
        // Validate request
        if (!prompt || typeof prompt !== 'string') {
            return res.status(400).json({ 
                error: 'Invalid request: prompt is required and must be a string' 
            });
        }

        // Check if API key is configured
        if (!process.env.GROQ_API_KEY) {
            return res.status(500).json({ 
                error: 'Server configuration error: GROQ_API_KEY not found in environment variables' 
            });
        }

        console.log('Processing request with prompt length:', prompt.length);

        // Make request to Groq API
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

        // Check if the API request was successful
        if (!response.ok) {
            const errorData = await response.json();
            console.error('Groq API error:', errorData);
            return res.status(response.status).json({ 
                error: errorData.error?.message || 'API request failed',
                details: errorData 
            });
        }

        const data = await response.json();
        
        // Validate response structure
        if (!data.choices || !data.choices[0] || !data.choices[0].message) {
            console.error('Unexpected API response structure:', data);
            return res.status(500).json({ 
                error: 'Invalid response from AI service' 
            });
        }

        console.log('Request processed successfully');
        res.json(data);

    } catch (error) {
        console.error('Server error:', error.message);
        res.status(500).json({ 
            error: 'Internal server error: ' + error.message 
        });
    }
});

// Alternative endpoint for specific AI tasks
app.post("/ai/:task", async (req, res) => {
    try {
        const { task } = req.params;
        const { content, language } = req.body;

        if (!content) {
            return res.status(400).json({ error: 'Content is required' });
        }

        let prompt;
        switch (task) {
            case 'summary':
                prompt = `Please provide a concise 2-3 sentence summary of the following text:\n\n${content}`;
                break;
            case 'grammar':
                prompt = `Please check the following text for grammar errors and provide suggestions for improvement:\n\n${content}`;
                break;
            case 'tags':
                prompt = `Based on the following text, suggest 5 relevant tags (single words or short phrases). Return only the tags separated by commas:\n\n${content}`;
                break;
            case 'translate':
                if (!language) {
                    return res.status(400).json({ error: 'Language is required for translation' });
                }
                prompt = `Translate the following text to ${language}. Maintain the original meaning and tone. Only return the translated text without any additional comments:\n\n${content}`;
                break;
            case 'terms':
                prompt = `Identify 8-10 key technical terms, concepts, or important words from the following text. Return only the terms separated by commas:\n\n${content}`;
                break;
            case 'define':
                prompt = `Provide a brief, clear definition (1-2 sentences maximum) for the term: "${content}". Focus on the most relevant meaning in context.`;
                break;
            case 'detailed-define':
                prompt = `Provide a comprehensive but concise explanation of the term: "${content}". Include its definition, context, and why it's important. Keep it informative but not too lengthy (3-4 sentences maximum).`;
                break;
            default:
                return res.status(400).json({ error: 'Invalid task. Supported tasks: summary, grammar, tags, translate, terms, define, detailed-define' });
        }

        // Make request to main endpoint
        const response = await fetch(`${req.protocol}://${req.get('host')}/translate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt })
        });

        const data = await response.json();
        res.json(data);

    } catch (error) {
        console.error('AI task error:', error.message);
        res.status(500).json({ error: 'Internal server error: ' + error.message });
    }
});

// Error handler middleware
app.use((error, req, res, next) => {
    console.error('Unhandled error:', error);
    res.status(500).json({ error: 'Something went wrong!' });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({ error: 'Endpoint not found' });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`Groq API configured: ${!!process.env.GROQ_API_KEY}`);
    console.log(`Model: ${process.env.GROQ_MODEL || "llama-3.1-8b-instant"}`);
    console.log(`Max tokens: ${process.env.MAX_TOKENS || 1000}`);
    console.log(`Temperature: ${process.env.TEMPERATURE || 0.7}`);
});