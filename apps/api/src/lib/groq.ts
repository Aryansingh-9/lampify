const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

export async function groqChat(messages: { role: "system" | "user" | "assistant"; content: string }[], jsonMode = false): Promise<string> {
  const key = process.env.GROQ_API_KEY;
  if (!key) throw new Error("GROQ_API_KEY is not set");

  const body: Record<string, unknown> = {
    model: process.env.GROQ_MODEL ?? "llama-3.3-70b-versatile",
    messages,
    temperature: 0.4,
    max_tokens: 8192,
  };
  if (jsonMode) {
    body.response_format = { type: "json_object" };
  }

  const res = await fetch(GROQ_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Groq API error: ${res.status} ${err}`);
  }

  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const text = data.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error("Empty Groq response");
  return text;
}
