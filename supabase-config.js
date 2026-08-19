// supabase-config.js
import { loadSupabaseSdk } from './js/supabase-sdk-loader.js?v=uat-boot-fallback-20260814';

// UAT 前端固定连接 Davis Design AI UAT 项目；仅使用可公开的 publishable key
const supabaseUrl = 'https://bjzfkwxrvytgphvgwltl.supabase.co';
const supabaseAnonKey = 'sb_publishable__c7_KcaKy6NlBO0BKsmy2g_oGZmZSYV';

function showBootState(kind, detail = '') {
  if (typeof document === 'undefined') return;
  const who = document.getElementById('who');
  const cloudStatus = document.getElementById('cloudStatus');
  const taskList = document.getElementById('taskList');
  if (kind === 'loading') {
    if (cloudStatus) cloudStatus.textContent = '加载 UAT 连接组件…';
    return;
  }
  if (kind === 'failed') {
    if (who) who.textContent = '连接初始化失败';
    if (cloudStatus) {
      cloudStatus.textContent = 'UAT 连接失败';
      cloudStatus.className = 'text-xs px-3 py-1.5 rounded-full bg-rose-950 text-rose-300';
    }
    if (taskList) {
      taskList.innerHTML = `<div class="text-sm text-rose-300 p-4 rounded-xl bg-rose-950/40">UAT 连接组件加载失败。请刷新重试。<br><span class="text-xs break-words">${String(detail || 'SUPABASE_SDK_LOAD_FAILED').replace(/[&<>"']/g, '')}</span></div>`;
    }
  }
}

showBootState('loading');

let sdk;
try {
  sdk = await loadSupabaseSdk();
} catch (error) {
  showBootState('failed', error?.message || String(error));
  console.error('Supabase SDK 加载失败:', error);
  throw error;
}

export const supabase = sdk.createClient(supabaseUrl, supabaseAnonKey);

if (typeof window !== 'undefined') {
  window.__davisSupabaseSdkSource = sdk.source;
  const page = location.pathname.split('/').pop() || 'index.html';

  import('./js/index-lifecycle-recovery.js?v=uat-index-lifecycle-v1')
    .catch(error => console.error('需求大厅生命周期恢复模块加载失败:', error));

  import('./js/required-design-assets-ui.js?v=uat-assets-v1')
    .then(module => module.bootstrapRequiredDesignAssetsUI(supabase))
    .then(() => import('./js/visual-reference-ui.js?v=uat-style-reference-drive-v7'))
    .then(module => module.bootstrapVisualReferenceUI(supabase))
    .catch(error => console.error('设计输入模块加载失败:', error));

  import('./js/ai-auto-recovery.js?v=uat-state-recovery-v48-required-assets')
    .then(module => module.bootstrapAiAutoRecovery(supabase))
    .catch(error => console.error('AI 自动恢复模块加载失败:', error));

  import('./js/ai-confidence-copy.js?v=uat-confidence-copy-v1b')
    .then(module => module.bootstrapAiConfidenceCopy())
    .catch(error => console.error('AI 理解程度文案模块加载失败:', error));

  // AI 设计师工作台：数据库队列状态是唯一真源，Drive 私有文件通过鉴权 Relay 预览。
  import('./js/seedream-demo-orchestrator-v5.js?v=seedream-demo-drive-preview-v7c')
    .then(module => module.bootstrapSeedreamDemoOrchestratorV5(supabase))
    .catch(error => console.error('Seedream Demo v5 控制器加载失败:', error));

  // AI 工作台使用 v8 图库；需求方不再使用它，避免与聊天区重绘竞争。
  if (page === 'ai-designer-workspace.html') {
    import('./js/seedream-drive-preview-ui-v7.js?v=drive-preview-ui-v8')
      .then(module => module.bootstrapSeedreamDrivePreviewUIV7(supabase))
      .catch(error => console.error('Seedream Drive 工作台预览层加载失败:', error));
  }

  // 需求方固定初稿验收区 v11：稳定 DOM，只在数据快照变化时更新；确认后复用正式 pending_approval 流程。
  if (page === 'task-detail-requester.html') {
    import('./js/requester-demo-review-v10.js?v=requester-demo-review-v11')
      .then(module => module.bootstrapRequesterDemoReviewV10(supabase))
      .catch(error => console.error('需求方初稿验收区加载失败:', error));
  }
}

console.log('🧪 UAT 环境：Davis 设计管理中心连接成功！SDK:', sdk.source);