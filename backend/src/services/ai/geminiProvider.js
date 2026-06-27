import { GoogleGenerativeAI } from '@google/generative-ai';
import BaseAiProvider from './aiProvider.js';
import logger from '../../utils/logger.js';

class GeminiProvider extends BaseAiProvider {
  constructor() {
    super();
    // Resolve configurations from environment
    this.apiKey = process.env.GEMINI_API_KEY;
    this.modelName = process.env.GEMINI_MODEL || 'gemini-1.5-flash';
  }

  /**
   * Invokes the Gemini API using the official Google Generative AI SDK.
   * 
   * @param {object} context - Prepared prompt, system instruction, and schema templates
   * @returns {Promise<string>} Raw text response containing JSON from Gemini
   */
  async generateRawInsights(context) {
    const apiKey = this.apiKey || process.env.GEMINI_API_KEY;
    if (!apiKey) {
      logger.error('Gemini API Key missing from environment.');
      throw new Error('GEMINI_API_KEY is not configured in environment variables.');
    }

    const modelName = this.modelName || process.env.GEMINI_MODEL || 'gemini-1.5-flash';
    logger.info(`Initializing Gemini Generative Client with model: ${modelName}`);

    const genAI = new GoogleGenerativeAI(apiKey);
    
    // Setup model options, including system instruction
    const modelOptions = { model: modelName };
    if (context.systemInstruction) {
      modelOptions.systemInstruction = context.systemInstruction;
    }

    const model = genAI.getGenerativeModel(modelOptions);

    // Build the final prompt by combining system instruction, schema, and specific context
    // This double-inclusion guarantees instruction compliance across older SDK versions.
    const fullPrompt = `
${context.systemInstruction ? `SYSTEM INSTRUCTION:\n${context.systemInstruction}\n` : ''}
=========================================
REQUIRED RESPONSE JSON STRUCTURE:
${JSON.stringify(context.responseJsonTemplate, null, 2)}
=========================================
DEVELOPER DATA AND METRICS:
${context.prompt}

Generate the JSON response following the exact schema above. Do not include markdown wraps (like \`\`\`json), HTML, or extra text. Return ONLY the raw JSON string.
`;

    logger.debug(`Sending prompt to Gemini API (Length: ${fullPrompt.length} chars)`);
    
    const startTime = Date.now();
    const result = await model.generateContent(fullPrompt);
    const duration = Date.now() - startTime;
    
    logger.info(`Gemini API responded in ${duration}ms`);

    const responseText = result.response?.text ? result.response.text() : '';
    
    if (!responseText || responseText.trim() === '') {
      throw new Error('Empty response received from Gemini API.');
    }

    return responseText;
  }
}

export default new GeminiProvider();
