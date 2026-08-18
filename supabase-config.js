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

  import('./js/index-lifecycle-recovery.js?v=uat-index-lifecycle-v1')
    .catch(error => console.error('需求大厅生命周期恢复模块加载失败:', error));

  import('./js/required-design-assets-ui.js?v=uat-assets-v1')
    .then(module => module.bootstrapRequiredDesignAssetsUI(supabase))
    .then(() => import('./js/visual-reference-ui.js?v=uat-style-reference-v2'))
    .then(module => module.bootstrapVisualReferenceUI(supabase))
    .catch(error => console.error('设计输入模块加载失败:', error));

  import('./js/ai-auto-recovery.js?v=uat-state-recovery-v48-required-assets')
    .then(module => module.bootstrapAiAutoRecovery(supabase))
    .catch(error => console.error('AI 自动恢复模块加载失败:', error));

  import('./js/ai-confidence-copy.js?v=uat-confidence-copy-v1b')
    .then(module => module.bootstrapAiConfidenceCopy())
    .catch(error => console.error('AI 理解程度文案模块加载失败:', error));

  import('./js/seedream-demo-guard.js?v=uat-ark-gateway-health-v2')
    .then(module => module.bootstrapSeedreamDemoGuard(supabase))
    .catch(error => console.error('Seedream Demo 连通性/实时轮询模块加载失败:', error));
}

console.log('🧪 UAT 环境：Davis 设计管理中心连接成功！SDK:', sdk.source);
