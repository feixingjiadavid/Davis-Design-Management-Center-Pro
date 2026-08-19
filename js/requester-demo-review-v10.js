import { bootstrapRequesterDemoViewV12 } from './requester-demo-view-v12.js?v=requester-demo-view-v12-compat';

// 兼容旧 HTML 入口：需求方不再审批 Demo。
// 所有页面统一切到 v12 只读框架预览；正式审批由领导在 pending_approval 阶段执行。
export function bootstrapRequesterDemoReviewV10(client) {
  bootstrapRequesterDemoViewV12(client);
}
