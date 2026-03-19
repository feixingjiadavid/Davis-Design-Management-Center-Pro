// supabase-config.js
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm'

// 💡 这是你全新的 Davis-Design-System-Pro 项目通行证
const supabaseUrl = 'https://dhzyeqrbqrokwvfwform.supabase.co';
const supabaseAnonKey = 'sb_publishable_BZYQh-m3mA0Hu7tBrdZKHA_XY-cDzjC'

// 创建连接通道并暴露给其他页面使用
export const supabase = createClient(supabaseUrl, supabaseAnonKey)

console.log("🚀 生产环境：Davis 设计管理中心连接成功！");
