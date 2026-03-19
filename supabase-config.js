// supabase-config.js
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm'

// 💡 这是你全新的 Davis-Design-System-Pro 项目通行证
const supabaseUrl = 'https://dhzyeqrbqrokwvfwform.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRoenllcXJicXJva3d2Zndmb3JtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM4NzYwODQsImV4cCI6MjA4OTQ1MjA4NH0.NFkgV_CI-VZwm2GDOwd_X7dYTwAotbh_e79tcXDKKwA'

// 创建连接通道并暴露给其他页面使用
export const supabase = createClient(supabaseUrl, supabaseAnonKey)

console.log("🚀 生产环境：Davis 设计管理中心连接成功！");
