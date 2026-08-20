import { bootstrapRequesterFrameworkRevisionFlowV3 } from './requester-framework-revision-flow-v3.js?v=requester-template-revision-v4';

// 旧入口仅做兼容转发：需求方内容修改统一使用 v3 单次提交流程。
// 不再保留“检测腾讯文档 → 分析变化 → 再次确认生成”的三步人工链路。
export function bootstrapRequesterFrameworkRevisionFlowV2(client) {
  return bootstrapRequesterFrameworkRevisionFlowV3(client);
}
