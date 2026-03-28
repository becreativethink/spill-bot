const { HfInference } = require('@huggingface/inference');
const axios = require('axios');
require('dotenv').config();

const hf = new HfInference(process.env.HF_API_KEY);
const defaultModel = process.env.DEFAULT_MODEL || "Qwen/Qwen2.5-7B-Instruct";

const generateResponse = async (user, prompt, systemPrompt = "You are Spill, an AI agent.") => {
    const config = user.aiConfig || { type: 'default' };
    
    if (config.type === 'default') {
        // Hugging Face Default
        try {
            const response = await hf.chatCompletion({
                model: defaultModel,
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: prompt }
                ],
                max_tokens: 500,
                temperature: 0.7
            });
            return response.choices[0].message.content;
        } catch (error) {
            console.error("HF Error:", error);
            return "HF API error: " + error.message;
        }
    } else if (config.type === 'custom') {
        // Dynamic Provider
        const { provider, model, apiKey } = config;
        
        try {
            switch (provider.toLowerCase()) {
                case 'openai':
                    const openaiResponse = await axios.post('https://api.openai.com/v1/chat/completions', {
                        model: model || 'gpt-3.5-turbo',
                        messages: [{ role: "system", content: systemPrompt }, { role: "user", content: prompt }]
                    }, {
                        headers: { 'Authorization': `Bearer ${apiKey}` }
                    });
                    return openaiResponse.data.choices[0].message.content;
                
                case 'gemini':
                    // Basic Google Gemini API implementation
                    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model || 'gemini-pro'}:generateContent?key=${apiKey}`;
                    const geminiResponse = await axios.post(geminiUrl, {
                        contents: [{ parts: [{ text: prompt }] }]
                    });
                    return geminiResponse.data.candidates[0].content.parts[0].text;
                
                case 'claude':
                    const anthropicResponse = await axios.post('https://api.anthropic.com/v1/messages', {
                        model: model || 'claude-3-opus-20240229',
                        max_tokens: 1024,
                        messages: [{ role: "user", content: prompt }]
                    }, {
                        headers: { 
                            'x-api-key': apiKey,
                            'anthropic-version': '2023-06-01',
                            'content-type': 'application/json'
                        }
                    });
                    return anthropicResponse.data.content[0].text;

                case 'openrouter':
                    const orResponse = await axios.post('https://openrouter.ai/api/v1/chat/completions', {
                        model: model || 'openai/gpt-3.5-turbo',
                        messages: [{ role: "user", content: prompt }]
                    }, {
                        headers: { 'Authorization': `Bearer ${apiKey}` }
                    });
                    return orResponse.data.choices[0].message.content;

                default:
                    return "Provider not supported yet.";
            }
        } catch (error) {
            console.error(`${provider} Error:`, error);
            return `${provider} API error: ${error.message}`;
        }
    }
};

module.exports = { generateResponse };
