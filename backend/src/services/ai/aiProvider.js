/**
 * Base abstract class representing an AI provider.
 * Defines the contract that all concrete AI providers (Gemini, Claude, GPT) must implement.
 */
class BaseAiProvider {
  /**
   * Generates raw qualitative insights based on the provided prompt context.
   * Must return a string containing the JSON response from the LLM.
   * 
   * @param {object} context - Prepared metrics, scores, and templates for the model
   * @returns {Promise<string>} Raw text response (containing JSON) from the LLM
   */
  async generateRawInsights(context) {
    throw new Error('generateRawInsights(context) must be implemented by the concrete provider subclass.');
  }
}

export default BaseAiProvider;
