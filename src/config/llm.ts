import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { ChatGoogle } from '@langchain/google';

const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
    console.warn('Gemini API Key missing. Please set GEMINI_API_KEY in .env');
}

// We will use gemini-2.5-flash for cost-effective, fast entity extraction
export const llm = new ChatGoogle({
    apiKey: apiKey || 'placeholder',
    model: 'gemini-2.5-flash',
    maxOutputTokens: 2048,
    temperature: 0, // 0 for deterministic extraction tasks
});
