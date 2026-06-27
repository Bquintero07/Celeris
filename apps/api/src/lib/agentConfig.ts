import { prisma } from "./prisma.js";

// Global, operator-tuned settings for the Python AI agent. Single-row table
// (agent_config, id=1). The agent itself stays stateless: the Node API reads
// these and forwards them on every call, falling back to defaults if unset.

export type AgentConfig = {
  model: string;
  temperature: number;
  max_tokens: number | null;
  quote_system_prompt: string | null;
  plan_system_prompt: string | null;
  updated_at: string | null;
};

const DEFAULTS: AgentConfig = {
  model: "gpt-4o-mini",
  temperature: 0.7,
  max_tokens: null,
  quote_system_prompt: null,
  plan_system_prompt: null,
  updated_at: null,
};

export async function getAgentConfig(): Promise<AgentConfig> {
  try {
    const rows = await prisma.$queryRaw<any[]>`
      SELECT model, temperature, max_tokens, quote_system_prompt, plan_system_prompt, updated_at
      FROM public.agent_config WHERE id = 1 LIMIT 1
    `;
    const r = rows[0];
    if (!r) return DEFAULTS;
    return {
      model: r.model ?? DEFAULTS.model,
      temperature: r.temperature != null ? Number(r.temperature) : DEFAULTS.temperature,
      max_tokens: r.max_tokens != null ? Number(r.max_tokens) : null,
      quote_system_prompt: r.quote_system_prompt ?? null,
      plan_system_prompt: r.plan_system_prompt ?? null,
      updated_at: r.updated_at ? new Date(r.updated_at).toISOString() : null,
    };
  } catch {
    // Table not migrated yet — never break AI calls over config.
    return DEFAULTS;
  }
}

// Build the override block the agent understands for a given kind of request.
export function agentOverrides(cfg: AgentConfig, kind: "plan" | "quote") {
  return {
    model: cfg.model,
    temperature: cfg.temperature,
    max_tokens: cfg.max_tokens,
    system_prompt: kind === "plan" ? cfg.plan_system_prompt : cfg.quote_system_prompt,
  };
}
