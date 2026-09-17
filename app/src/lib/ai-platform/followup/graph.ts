import { z } from "zod";

export const FOLLOWUP_NODE_TYPES = ["trigger", "wait", "condition", "ai_classify", "action", "end"] as const;
export type FollowupNodeType = (typeof FOLLOWUP_NODE_TYPES)[number];

const positionSchema = z.object({ x: z.number(), y: z.number() }).strict();
const branchIdSchema = z.string().min(1).max(64).refine((id) => id !== "else", '"else" é reservado para o fallback');

export const followupCheckSchema = z.object({
  id: branchIdSchema.optional(),
  label: z.string().min(1).max(60).optional(),
  field: z.string().min(1).max(100),
  op: z.enum(["eq", "neq", "gte", "lte", "contains"]),
  value: z.union([z.string(), z.number(), z.boolean()]),
}).strict();

const triggerNodeSchema = z.object({
  id: z.string().min(1), type: z.literal("trigger"), label: z.string().min(1).max(60), position: positionSchema,
  config: z.object({ event: z.string().min(1).default("manual"), filters: z.record(z.string(), z.unknown()).default({}) }).strict(),
}).strict();

const waitNodeSchema = z.object({
  id: z.string().min(1), type: z.literal("wait"), label: z.string().min(1).max(60), position: positionSchema,
  config: z.discriminatedUnion("mode", [
    z.object({ mode: z.literal("fixed"), duration_ms: z.number().int().min(300_000).max(7_776_000_000) }).strict(),
    z.object({ mode: z.literal("smart"), min_ms: z.number().int().min(300_000), max_ms: z.number().int().max(7_776_000_000), guidance: z.string().max(500).optional() }).strict()
      .refine((value) => value.min_ms <= value.max_ms, { message: "min_ms deve ser menor ou igual a max_ms" }),
  ]),
}).strict();

const conditionNodeSchema = z.object({
  id: z.string().min(1), type: z.literal("condition"), label: z.string().min(1).max(60), position: positionSchema,
  config: z.object({
    combinator: z.enum(["and", "or"]).default("and"),
    branching: z.enum(["combined", "per_check"]).default("combined"),
    checks: z.array(followupCheckSchema).min(1).max(10),
  }).strict().superRefine((config, ctx) => {
    if (config.branching === "per_check" && config.checks.some((check) => !check.id)) {
      ctx.addIssue({ code: "custom", message: "Cada regra precisa de id estável no modo por regra", path: ["checks"] });
    }
    const ids = config.checks.flatMap((check) => check.id ? [check.id] : []);
    if (new Set(ids).size !== ids.length) ctx.addIssue({ code: "custom", message: "IDs de regra precisam ser únicos", path: ["checks"] });
  }),
}).strict();

const classifyNodeSchema = z.object({
  id: z.string().min(1), type: z.literal("ai_classify"), label: z.string().min(1).max(60), position: positionSchema,
  config: z.object({
    classes: z.array(z.object({ id: branchIdSchema, label: z.string().min(1).max(40) }).strict()).min(1).max(8),
    grace_timeout_ms: z.number().int().min(900_000),
    target: z.enum(["last_reply", "summary"]).default("last_reply"),
    hint: z.string().max(500).optional(),
    agent_id: z.string().uuid().optional(),
  }).strict().refine((config) => new Set(config.classes.map((item) => item.id)).size === config.classes.length, { message: "IDs de classe precisam ser únicos", path: ["classes"] }),
}).strict();

const actionNodeSchema = z.object({
  id: z.string().min(1), type: z.literal("action"), label: z.string().min(1).max(60), position: positionSchema,
  config: z.discriminatedUnion("mode", [
    z.object({ mode: z.literal("ai_message"), prompt_hint: z.string().min(1).max(1000), agent_id: z.string().uuid().optional(), fallback_template_id: z.string().uuid().optional() }).strict(),
    z.object({ mode: z.literal("template"), template_id: z.string().uuid() }).strict(),
    z.object({ mode: z.literal("create_task"), title: z.string().min(1).max(160), description: z.string().max(1000).optional(), priority: z.enum(["baixa", "media", "alta", "urgente"]).default("media"), due_minutes: z.number().int().min(0).max(525_600).default(1440), owner_id: z.string().uuid().optional() }).strict(),
    z.object({ mode: z.literal("add_tag"), label_id: z.string().uuid() }).strict(),
    z.object({ mode: z.literal("remove_tag"), label_id: z.string().uuid() }).strict(),
    z.object({ mode: z.literal("update_stage"), stage: z.string().min(1).max(80) }).strict(),
    z.object({ mode: z.literal("assign_owner"), owner_id: z.string().uuid() }).strict(),
    z.object({ mode: z.literal("add_note"), title: z.string().min(1).max(160), description: z.string().max(4000).optional() }).strict(),
    z.object({ mode: z.literal("email"), subject: z.string().min(1).max(160), message: z.string().min(1).max(10_000) }).strict(),
    z.object({ mode: z.literal("callface_call") }).strict(),
  ]),
}).strict();

const endNodeSchema = z.object({
  id: z.string().min(1), type: z.literal("end"), label: z.string().min(1).max(60), position: positionSchema,
  config: z.object({ outcome: z.enum(["converted", "exhausted", "custom"]), note: z.string().max(200).optional() }).strict(),
}).strict();

export const followupNodeSchema = z.discriminatedUnion("type", [triggerNodeSchema, waitNodeSchema, conditionNodeSchema, classifyNodeSchema, actionNodeSchema, endNodeSchema]);
export type FollowupNode = z.infer<typeof followupNodeSchema>;

export const followupEdgeConditionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("always") }).strict(),
  z.object({ type: z.literal("cond_result"), value: z.boolean() }).strict(),
  z.object({ type: z.literal("class_match"), value: z.string().min(1) }).strict(),
  z.object({ type: z.literal("branch"), branch_id: branchIdSchema }).strict(),
]);
export type FollowupEdgeCondition = z.infer<typeof followupEdgeConditionSchema>;

export const followupEdgeSchema = z.object({
  id: z.string().min(1), source: z.string().min(1), target: z.string().min(1), priority: z.number().int().default(0), condition: followupEdgeConditionSchema,
}).strict();
export type FollowupEdge = z.infer<typeof followupEdgeSchema>;

export const followupGraphSchema = z.object({
  schema_version: z.literal(2).default(2),
  nodes: z.array(followupNodeSchema).min(2).max(100),
  edges: z.array(followupEdgeSchema).min(1).max(300),
}).strict().superRefine((graph, ctx) => {
  const nodeIds = graph.nodes.map((node) => node.id);
  const edgeIds = graph.edges.map((edge) => edge.id);
  if (new Set(nodeIds).size !== nodeIds.length) ctx.addIssue({ code: "custom", message: "IDs de nós precisam ser únicos", path: ["nodes"] });
  if (new Set(edgeIds).size !== edgeIds.length) ctx.addIssue({ code: "custom", message: "IDs de arestas precisam ser únicos", path: ["edges"] });
  const known = new Set(nodeIds);
  graph.edges.forEach((edge, index) => {
    if (!known.has(edge.source)) ctx.addIssue({ code: "custom", message: `Origem inexistente: ${edge.source}`, path: ["edges", index, "source"] });
    if (!known.has(edge.target)) ctx.addIssue({ code: "custom", message: `Destino inexistente: ${edge.target}`, path: ["edges", index, "target"] });
    if (edge.source === edge.target) ctx.addIssue({ code: "custom", message: "Auto-loop não é permitido", path: ["edges", index] });
  });
});
export type FollowupGraph = z.infer<typeof followupGraphSchema>;

export type FollowupBranch = { id: string; label: string; kind: "declared" | "fallback" };

export function branchesForNode(node: FollowupNode): FollowupBranch[] {
  if (node.type === "condition") {
    if (node.config.branching === "per_check") {
      return [
        ...node.config.checks.map((check) => ({ id: check.id!, label: check.label ?? check.id!, kind: "declared" as const })),
        { id: "else", label: "Caso contrário", kind: "fallback" as const },
      ];
    }
    return [
      { id: "true", label: "Sim", kind: "declared" },
      { id: "false", label: "Não", kind: "declared" },
    ];
  }
  if (node.type === "ai_classify") {
    return [
      ...node.config.classes.map((item) => ({ id: item.id, label: item.label, kind: "declared" as const })),
      { id: "no_reply", label: "Sem resposta", kind: "declared" as const },
      { id: "else", label: "Caso contrário", kind: "fallback" as const },
    ];
  }
  if (node.type === "end") return [];
  return [{ id: "else", label: "Sempre", kind: "fallback" }];
}

export function edgeBranchId(edge: FollowupEdge): string {
  if (edge.condition.type === "always") return "else";
  if (edge.condition.type === "cond_result") return edge.condition.value ? "true" : "false";
  if (edge.condition.type === "class_match") return edge.condition.value;
  return edge.condition.branch_id;
}

export function createEmptyFollowupGraph(event = "manual"): FollowupGraph {
  return {
    schema_version: 2,
    nodes: [
      { id: "trigger", type: "trigger", label: "Início do fluxo", position: { x: 420, y: 80 }, config: { event, filters: {} } },
      { id: "end", type: "end", label: "Fim do fluxo", position: { x: 420, y: 340 }, config: { outcome: "exhausted" } },
    ],
    edges: [{ id: "trigger-end", source: "trigger", target: "end", priority: 0, condition: { type: "always" } }],
  };
}
