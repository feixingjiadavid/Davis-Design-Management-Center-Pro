export type ClarificationQuestionType = "hard" | "soft";

const HARD_MARKERS = ["尺寸", "比例", "数量", "几张", "文案", "标题", "截止", "交付", "素材", "logo", "品牌", "必须", "产出物"];

export function classifyQuestion(question: string): ClarificationQuestionType {
  const normalized = question.toLowerCase();
  return HARD_MARKERS.some((marker) => normalized.includes(marker)) ? "hard" : "soft";
}

export function selectBoundedQuestions<T>(questions: T[], round: number): T[] {
  if (round < 1 || round > 2) return [];
  return questions.slice(0, 3);
}

export function canDelegateQuestion(type: string) {
  return type === "soft";
}
