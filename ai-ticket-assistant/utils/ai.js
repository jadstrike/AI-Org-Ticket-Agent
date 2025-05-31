import { createAgent, gemini } from "@inngest/agent-kit";
import { OpenAI } from "openai";
import { Claude } from "@anthropic-ai/sdk";

const providers = {
  gemini: {
    client: gemini({
      model: "gemini-1.5-flash-8b",
      apiKey: process.env.GEMINI_API_KEY,
    }),
    weight: 0.4,
  },
  openai: {
    client: new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    }),
    weight: 0.4,
  },
  claude: {
    client: new Claude({
      apiKey: process.env.ANTHROPIC_API_KEY,
    }),
    weight: 0.2,
  },
};

const selectProvider = () => {
  const rand = Math.random();
  let sum = 0;
  for (const [name, provider] of Object.entries(providers)) {
    sum += provider.weight;
    if (rand <= sum) return name;
  }
  return "gemini"; // fallback
};

const analyzeTicket = async (ticket) => {
  const provider = selectProvider();
  const supportAgent = createAgent({
    model: providers[provider].client,
    name: "AI Ticket Triage Assistant",
    system: `You are an expert AI assistant that processes technical support tickets. 

Your job is to:
1. Summarize the issue.
2. Estimate its priority.
3. Provide helpful notes and resource links for human moderators.
4. List relevant technical skills required.

IMPORTANT:
- Respond with *only* valid raw JSON.
- Do NOT include markdown, code fences, comments, or any extra formatting.
- The format must be a raw JSON object.`,
  });

  try {
    const response = await supportAgent.run(
      `Analyze the following support ticket and provide a JSON object with:

- summary: A short 1-2 sentence summary of the issue.
- priority: One of "low", "medium", or "high".
- helpfulNotes: A detailed technical explanation that a moderator can use to solve this issue. Include useful external links or resources if possible.
- relatedSkills: An array of relevant skills required to solve the issue (e.g., ["React", "MongoDB"]).

Ticket information:

- Title: ${ticket.title}
- Description: ${ticket.description}`
    );

    const raw = response.output[0].context;

    try {
      const match = raw.match(/```json\s*([\s\S]*?)\s*```/i);
      const jsonString = match ? match[1] : raw.trim();
      return JSON.parse(jsonString);
    } catch (e) {
      console.log("Failed to parse JSON from AI response: " + e.message);
      return null;
    }
  } catch (error) {
    console.error(`Error with ${provider}:`, error);
    // Fallback to another provider
    const fallbackProvider = Object.keys(providers).find(p => p !== provider);
    if (fallbackProvider) {
      console.log(`Falling back to ${fallbackProvider}`);
      providers[provider].client = providers[fallbackProvider].client;
      return analyzeTicket(ticket);
    }
    return null;
  }
};

export default analyzeTicket;