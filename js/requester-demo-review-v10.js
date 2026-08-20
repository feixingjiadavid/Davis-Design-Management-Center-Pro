import { bootstrapRequesterDemoViewV12 } from './requester-demo-view-v12.js?v=all-stages-lazy-v1';
import { bootstrapLeaderDemoHdReviewV1 } from './leader-demo-hd-review-v1.js?v=leader-demo-hd-review-v1';

// 兼容旧 HTML 入口：需求方不再审批 Demo。
// 所有页面统一切到 v12 只读框架预览；正式审批仅发生在母版锁定前的 pending_approval 阶段。
export function bootstrapRequesterDemoReviewV10(client) {
  bootstrapRequesterDemoViewV12(client);
  bootstrapLeaderDemoHdReviewV1(client);
}
