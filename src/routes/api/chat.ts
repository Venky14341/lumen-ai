import "@tanstack/react-start";
import { createFileRoute } from "@tanstack/react-router";
import { convertToModelMessages, streamText, type UIMessage } from "ai";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway";

const ALLOWED_MODELS = new Set([
  "google/gemini-3.1-pro-preview",
  "google/gemini-3-flash-preview",
  "google/gemini-3.1-flash-lite-preview",
  "openai/gpt-5",
  "openai/gpt-5-mini",
]);

const DEFAULT_MODEL = "google/gemini-3-flash-preview";

const PERSONAS: Record<string, string> = {
  default:
    "You are Lumen, a helpful, concise AI assistant. Format responses in clean markdown when helpful.",
  coder:
    "You are Lumen Coder, an expert senior software engineer. Always think step by step. Provide runnable, well-structured code with brief explanations and call out edge cases.",
  writer:
    "You are Lumen Writer, a sharp editor and creative writer. Improve clarity, tone, and structure. Offer alternative phrasings when useful.",
  tutor:
    "You are Lumen Tutor. Explain concepts clearly with simple analogies, examples, and short exercises. Adapt to the user's level.",
  brainstorm:
    "You are Lumen Brainstorm. Generate diverse, creative, non-obvious ideas. Group them, then highlight the top 3 with reasoning.",
};

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        const body = (await request.json()) as {
          messages?: UIMessage[];
          model?: string;
          persona?: string;
        };
        const { messages, model: modelId, persona } = body;
        if (!Array.isArray(messages)) {
          return new Response("Messages required", { status: 400 });
        }
        const key = process.env.LOVABLE_API_KEY;
        if (!key) return new Response("Missing LOVABLE_API_KEY", { status: 500 });

        const chosenModel = modelId && ALLOWED_MODELS.has(modelId) ? modelId : DEFAULT_MODEL;
        const today = new Intl.DateTimeFormat("en-US", {
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric",
          timeZone: "UTC",
        }).format(new Date());
        const system = `${PERSONAS[persona ?? "default"] ?? PERSONAS.default}\n\nCurrent date: ${today} (UTC). Current year: ${new Date().getUTCFullYear()}. Use this as the source of truth for current-date questions. If asked for very recent real-world facts you cannot verify from context, be honest and say the information may need checking.`;

        const gateway = createLovableAiGatewayProvider(key);
        const result = streamText({
          model: gateway(chosenModel),
          system,
          messages: await convertToModelMessages(messages),
        });

        return result.toUIMessageStreamResponse({ originalMessages: messages });
      },
    },
  },
});
