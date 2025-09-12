import path from 'path';
import { fileURLToPath } from 'url';
import { config as dotenvConfig } from 'dotenv';

dotenvConfig();


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const config = {
  database: {
    path: path.join(__dirname, '..', 'email_analysis.db'),
  },
  gmail: {
    searchQuery: 'after:2025/01/01',
    batchSize: 100,
    rateLimitDelay: 1000,
  },
  analysis: {
    confidenceThreshold: 0.6,
    snippetMaxLength: 500,
  },
  auth: {
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    redirectUri: process.env.GOOGLE_REDIRECT_URI,
    tokens: process.env.GOOGLE_TOKENS,
  },
  llm: {
    baseUrl: process.env.OLLAMA_URL,
    model: process.env.OLLAMA_MODEL,
    timeout: parseInt(process.env.OLLAMA_TIMEOUT) || 30000,
    temperature: parseFloat(process.env.OLLAMA_TEMPERATURE) || 0.1,
    maxSnippetLength: parseInt(process.env.LLM_MAX_SNIPPET_LENGTH) || 1000,
    rejectionKeywords: [
      'not moving forward', 'unfortunately', 'we regret', 'not a fit',
      'other candidates', 'decided to pursue', 'will not be progressing',
      'thank you for your interest', 'not selected', 'position has been filled',
      'we have decided to', 'chosen to move forward with', 'not the right fit',
      'will not be moving forward', 'after careful consideration'
    ]
  }
};


export default config;