import { shouldRenderDashboard } from './formal-workflow-state.mjs?v=formal-workflow-state-v1';

let installed = false;
let previousSnapshot = '';

function snapshotOf(tasks = []) {
  return JSON.stringify((tasks || []).map((task) => ({
    id: task.id,
    status: task.status,
    assignee: task.assignee,
    due_date: task.due_date,
  })));
}

export function bootstrapManagerFormalSync(supabase) {
  if (typeof window === 'undefined') return;
  if ((location.pathname.split('/').pop() || '') !== 'manager-workspace.html') return;
  if (installed) return;
  installed = true;

  const install = () => {
    if (typeof window.loadDashboardData !== 'function') {
      setTimeout(install, 80);
      return;
    }
    if (window.loadDashboardData.__formalSyncV2) return;

    const legacyLoadDashboardData = window.loadDashboardData.bind(window);
    const wrapped = async function(isSilent = false) {
      try {
        const { data, error } = await supabase
          .from('test_tasks')
          .select('id,status,assignee,due_date')
          .order('created_at', { ascending: false });
        if (error) throw error;
        const nextSnapshot = snapshotOf(data || []);
        if (!shouldRenderDashboard(previousSnapshot, nextSnapshot, isSilent)) return;
        previousSnapshot = nextSnapshot;
        // 复用正式管理台原有渲染器；这里只修复“静默刷新不更新 DOM”的 bug。
        return await legacyLoadDashboardData(false);
      } catch (error) {
        console.error('正式管理台状态同步失败:', error);
        // 读取快照失败时仍调用原正式渲染器，避免因兼容层造成页面空白。
        return await legacyLoadDashboardData(false);
      }
    };
    wrapped.__formalSyncV2 = true;
    window.loadDashboardData = wrapped;

    // 修复已经以 0/0 首屏渲染的页面，不等待下一轮 8 秒轮询。
    setTimeout(() => window.loadDashboardData(false), 0);
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => setTimeout(install, 0), { once: true });
  } else {
    setTimeout(install, 0);
  }
}
