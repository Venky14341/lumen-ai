import "@tanstack/react-start";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        try {
          return new Response(JSON.stringify({
            success: true,
            message: "API is working on Vercel"
          }), {
            status: 200,
            headers: { "Content-Type": "application/json" }
          });
        } catch (error) {
          return new Response(JSON.stringify({ error: "Server error" }), {
            status: 500,
            headers: { "Content-Type": "application/json" }
          });
        }
      },
    },
  },
});


