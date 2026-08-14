// supabase-config.js
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm'

// UAT 前端固定连接 Davis Design AI UAT 项目；仅使用可公开的 publishable key
const supabaseUrl = 'https://bjzfkwxrvytgphvgwltl.supabase.co';
const supabaseAnonKey = 'sb_publishable__c7_KcaKy6NlBO0BKsmy2g_oGZmZSYV';

// 创建连接通道并暴露给其他页面使用
export const supabase = createClient(supabaseUrl, supabaseAnonKey)

if (typeof window !== 'undefined') {
  import('./js/visual-reference-ui.js?v=uat-qwen-vision-20260814b')
    .then(module => module.bootstrapVisualReferenceUI(supabase))
    .catch(error => console.error('视觉参考模块加载失败:', error));
  import('./js/ai-auto-recovery.js?v=uat-qwen-vision-20260814b')
    .then(module => module.bootstrapAiAutoRecovery(supabase))
    .catch(error => console.error('AI 自动恢复模块加载失败:', error));
}

console.log("🧪 UAT 环境：Davis 设计管理中心连接成功！");
