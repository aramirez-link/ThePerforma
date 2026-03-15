type ClaudeMessage = {
  role?: "user" | "assistant";
  content?: string;
};

type BookingClaudePayload = {
  messages?: ClaudeMessage[];
  bookingContext?: Record<string, unknown>;
};

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json"
};

const json = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), { status, headers: CORS_HEADERS });

const buildSystemPrompt = (bookingContext: Record<string, unknown>) => `
You are Claude inside The Performa booking concierge.

Role:
- Answer questions about The Performa, booking fit, package tiers, preliminary estimates, and next steps.
- Speak like a premium booking strategist: concise, producer-smart, nightlife-literate, confident, and calm.
- Help prospects understand what makes The Performa distinctive without sounding robotic or overhyped.

Known brand context:
- The Performa is the live performance identity of Atlanta artist Chip Lee.
- It blends electronic music, live instrumentation, choreography, technology, and audience interaction into one performance environment.
- The performance arc moves through Connection, Elevation, and Impact.
- The act is designed for luxury nightlife, festivals, private events, branded experiences, and cultural programming.

Business rules:
- Never confirm a booking, a date, or availability.
- Never present pricing as final; all ranges are preliminary.
- Always defer final approval to human review, availability checks, scope confirmation, and contract execution.
- If a question depends on information not in the context, say the team will confirm it during review.
- Keep answers tight: usually one short paragraph or a few flat bullets.

Current booking context:
${JSON.stringify(bookingContext, null, 2)}
`.trim();

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });
  if (req.method !== "POST") return json(405, { error: "Method not allowed." });

  const anthropicApiKey = Deno.env.get("ANTHROPIC_API_KEY") || "";
  const anthropicModel = Deno.env.get("ANTHROPIC_MODEL") || "claude-sonnet-4-20250514";
  if (!anthropicApiKey) return json(500, { error: "ANTHROPIC_API_KEY is not configured." });

  const body = (await req.json().catch(() => ({}))) as BookingClaudePayload;
  const bookingContext =
    body.bookingContext && typeof body.bookingContext === "object" ? body.bookingContext : {};
  const messages = Array.isArray(body.messages) ? body.messages : [];

  const cleanMessages = messages
    .filter((message) => (message.role === "user" || message.role === "assistant") && typeof message.content === "string")
    .slice(-10)
    .map((message) => ({
      role: message.role as "user" | "assistant",
      content: String(message.content || "").trim().slice(0, 4000)
    }))
    .filter((message) => message.content.length > 0);

  if (!cleanMessages.length) return json(400, { error: "At least one message is required." });

  const anthropicResponse = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": anthropicApiKey,
      "anthropic-version": "2023-06-01"
    },
    body: JSON.stringify({
      model: anthropicModel,
      max_tokens: 500,
      system: buildSystemPrompt(bookingContext),
      messages: cleanMessages
    })
  });

  const data = (await anthropicResponse.json().catch(() => ({}))) as {
    error?: { message?: string };
    content?: Array<{ type?: string; text?: string }>;
  };

  if (!anthropicResponse.ok) {
    return json(400, {
      error: data.error?.message || "Claude could not generate a reply."
    });
  }

  const text = Array.isArray(data.content)
    ? data.content
        .filter((item) => item.type === "text" && typeof item.text === "string")
        .map((item) => item.text?.trim() || "")
        .filter(Boolean)
        .join("\n\n")
    : "";

  if (!text) return json(500, { error: "Claude returned an empty response." });

  return json(200, {
    ok: true,
    model: anthropicModel,
    text
  });
});
