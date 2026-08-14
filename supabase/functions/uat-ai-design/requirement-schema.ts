export interface RequirementPage {
  index: number;
  title: string;
  copy: string[];
}

export interface RequirementBrief {
  goal: string;
  success_criteria: string[];
  audience: string[];
  deliverables: Array<{ type: string; quantity: number }>;
  pages: RequirementPage[];
  channels: string[];
  dimensions: string[];
  copy: string[];
  visual_direction: string[];
  layout_plan: string[];
  required_assets: string[];
  constraints: string[];
  deadline: string;
  facts: Array<{ key: string; value: string; source_type: string; source_id: string; locator: string }>;
  recommendations: Array<{ value: string; label: "AI建议" }>;
  missing_information: string[];
  conflicts: string[];
  risks: string[];
  confidence: number;
  clarification_questions: string[];
  template_recommendations: Array<{ template_id: string; reason: string }>;
}

const stringArray = { type: "array", items: { type: "string" } };

export const REQUIREMENT_BRIEF_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    goal: { type: "string" },
    success_criteria: stringArray,
    audience: stringArray,
    deliverables: { type: "array", items: { type: "object", additionalProperties: false, properties: { type: { type: "string" }, quantity: { type: "integer", minimum: 1 } }, required: ["type", "quantity"] } },
    pages: { type: "array", items: { type: "object", additionalProperties: false, properties: { index: { type: "integer", minimum: 1 }, title: { type: "string" }, copy: stringArray }, required: ["index", "title", "copy"] } },
    channels: stringArray,
    dimensions: stringArray,
    copy: stringArray,
    visual_direction: stringArray,
    layout_plan: stringArray,
    required_assets: stringArray,
    constraints: stringArray,
    deadline: { type: "string" },
    facts: { type: "array", items: { type: "object", additionalProperties: false, properties: { key: { type: "string" }, value: { type: "string" }, source_type: { type: "string" }, source_id: { type: "string" }, locator: { type: "string" } }, required: ["key", "value", "source_type", "source_id", "locator"] } },
    recommendations: { type: "array", items: { type: "object", additionalProperties: false, properties: { value: { type: "string" }, label: { type: "string", enum: ["AI建议"] } }, required: ["value", "label"] } },
    missing_information: stringArray,
    conflicts: stringArray,
    risks: stringArray,
    confidence: { type: "number", minimum: 0, maximum: 1 },
    clarification_questions: stringArray,
    template_recommendations: { type: "array", items: { type: "object", additionalProperties: false, properties: { template_id: { type: "string" }, reason: { type: "string" } }, required: ["template_id", "reason"] } },
  },
  required: ["goal", "success_criteria", "audience", "deliverables", "pages", "channels", "dimensions", "copy", "visual_direction", "layout_plan", "required_assets", "constraints", "deadline", "facts", "recommendations", "missing_information", "conflicts", "risks", "confidence", "clarification_questions", "template_recommendations"],
} as const;

function requireStringArray(value: unknown, key: string) {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) throw new Error(`INVALID_${key.toUpperCase()}`);
}

function textField(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

export function normalizeRequiredAssets(value: unknown): string[] {
  if (!Array.isArray(value)) throw new Error("INVALID_REQUIRED_ASSETS");
  return value.map((item) => {
    if (typeof item === "string") return item.trim();
    if (!item || typeof item !== "object" || Array.isArray(item)) throw new Error("INVALID_REQUIRED_ASSETS");
    const record = item as Record<string, unknown>;
    const role = textField(record, ["asset_role", "role", "type", "name", "label"]);
    const fileName = textField(record, ["file_name", "filename", "file", "asset_name"]);
    const status = textField(record, ["status", "state"]);
    const note = textField(record, ["note", "description", "usage", "instruction"]);
    const provided = record.provided === true || /已提供|uploaded|provided/i.test(status);
    const prefix = provided ? "已提供" : (status || "必用素材");
    const identity = [role, fileName].filter(Boolean).join(" / ");
    const normalized = `${prefix}：${identity || note || "未命名素材"}${note && identity ? `（${note}）` : ""}`;
    return normalized.trim();
  }).filter(Boolean);
}

export function validateRequirementBrief(value: unknown): RequirementBrief {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("INVALID_REQUIREMENT_BRIEF");
  const brief = value as Record<string, unknown>;
  if (typeof brief.goal !== "string" || !brief.goal.trim()) throw new Error("GOAL_REQUIRED");

  // DeepSeek sometimes returns required_assets as structured objects when it has rich
  // asset metadata. Preserve that useful meaning but normalize it to our stable UI/API
  // contract instead of failing the entire requirement analysis.
  brief.required_assets = normalizeRequiredAssets(brief.required_assets);

  for (const key of ["success_criteria", "audience", "channels", "dimensions", "copy", "visual_direction", "layout_plan", "required_assets", "constraints", "missing_information", "conflicts", "risks", "clarification_questions"]) requireStringArray(brief[key], key);
  if (!Array.isArray(brief.pages)) throw new Error("INVALID_PAGES");
  const pages = brief.pages as Array<Record<string, unknown>>;
  pages.forEach((page, offset) => {
    if (!Number.isInteger(page.index) || Number(page.index) !== offset + 1) throw new Error("INVALID_PAGE_INDEX");
    if (typeof page.title !== "string" || !page.title.trim()) throw new Error("PAGE_TITLE_REQUIRED");
    requireStringArray(page.copy, "page_copy");
    if ((page.copy as string[]).length === 0) throw new Error("PAGE_COPY_REQUIRED");
  });
  if (typeof brief.deadline !== "string") throw new Error("INVALID_DEADLINE");
  if (typeof brief.confidence !== "number" || brief.confidence < 0 || brief.confidence > 1) throw new Error("INVALID_CONFIDENCE");
  if (!Array.isArray(brief.facts)) throw new Error("INVALID_FACTS");
  for (const fact of brief.facts as Array<Record<string, unknown>>) {
    if (!fact.source_id || !fact.locator || !String(fact.locator).trim()) throw new Error("FACT_CITATION_REQUIRED");
  }
  if (!Array.isArray(brief.deliverables) || !Array.isArray(brief.recommendations) || !Array.isArray(brief.template_recommendations)) throw new Error("INVALID_REQUIREMENT_LISTS");
  return brief as unknown as RequirementBrief;
}
