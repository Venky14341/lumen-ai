import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

export const createGeminiProvider = (apiKey: string) =>
  createOpenAICompatible({
    name: "gemini",
    baseURL: "https://generativelanguage.googleapis.com/v1beta1/openai",
    queryParams: { key: apiKey },
  });
