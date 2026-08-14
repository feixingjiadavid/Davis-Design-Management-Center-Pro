export function isAutomaticAnalysisAction(action: string) {
  return ["auto_analyze", "answer_clarifications", "delegate_to_ai"].includes(action);
}
