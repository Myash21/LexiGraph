import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { ChatGoogle } from '@langchain/google';
import { ChatGroq } from '@langchain/groq'

const apiKey = process.env.GROQ_API_KEY;

if (!apiKey) {
    console.warn('Groq API Key missing. Please set GROQ_API_KEY in .env');
}

// We will use llama models via Groq for cost-effective, fast entity extraction
export const llm = new ChatGroq({
    model: "llama-3.3-70b-versatile",
    maxTokens: 2048,
    temperature: 0, // 0 for deterministic extraction tasks
});