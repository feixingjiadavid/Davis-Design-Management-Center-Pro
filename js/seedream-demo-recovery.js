const DEMO_MODEL = 'doubao-seedream-4-0-250828';
const DEMO_PROMPT_VERSION = 'seedream-demo-design-director-v1';

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

function activeTaskId() {
  return document.querySelector('.task.active[data-id]')?.dataset?.id || '';
}

async function loadRecoveryState(supabase, taskId) {
  const [taskResult, analysisResult, generationResult] = await Promise.all([
    supabase.from('test_tasks').select('id,status,summary_desc').eq('id', taskId).maybeSingle(),
    supabase.from('uat_requirement_analyses').select('id,status,version').eq('task_id', taskId).order('version', { ascending: false }).limit(1).maybeSingle(),
    supabase.from('uat_design_generations').select('id,status,model,prompt_version,kind,page_index,created_at').eq('task_id', taskId).eq('kind', 'demo').order('created_at', { ascending: false }).limit(1).maybeSingle(),
  ]);
  const error = taskResult.error || analysisResult.error || generationResult.error;
  if (error) throw error;
  return {
    task: taskResult.data,
    analysis: analysisResult.data,
    latestDemo: generationResult.data,
  };
}

export function shouldOfferSeedreamDemoRecovery(state) {
  const { task, analysis, latestDemo } = state || {};
  if (!task || !analysis || analysis.status !== 'confirmed') return false;
  if (['generating_demo', 'demo_review', 'ready_for_final', 'final_review', 'completed', 'archived'].includes(task.status)) {
    const current = latestDemo?.model === DEMO_MODEL && latestDemo?.prompt_version === DEMO_PROMPT_VERSION;
    if (current) return false;
  }
  if (task.status === 'demo_failed') return true;
  if (!latestDemo) return task.status === 'ready_for_demo';
  return latestDemo.model !== DEMO_MODEL || latestDemo.prompt_version !== DEMO_PROMPT_VERSION || latestDemo.status === 'failed';
}

function bannerMarkup(taskId, analysisId) {
  return `<div id="seedream-demo-recovery" class="rounded-xl border border-violet-500/30 bg-violet-500/10 p-4 mb-5">
    <div class="flex flex-wrap items-center justify-between gap-4">
      <div class="min-w-0">
        <p class="text-sm font-bold text-violet-200">Seedream 4.0 Demo 已就绪</p>
        <p class="text-xs leading-5 text-slate-400 mt-1">旧 Cloudflare Demo 仅保留作历史记录，不会继续复用。新 Demo 会重新读取当前已确认需求、风格参考与必用素材，并由 Seedream 直接生成完整设计页。</p>
        <p class="text-[11px] text-amber-300/90 mt-2">不会自动重试或重复扣费；只有你点击下方按钮才会发起本次生成。</p>
      </div>
      <button id="seedreamDemoRetryBtn" data-task-id="${taskId}" data-analysis-id="${analysisId}" class="btn bg-violet-600 hover:bg-violet-500 text-white whitespace-nowrap">重新生成 Seedream 4.0 Demo</button>
    </div>
  </div>`;
}

function mountBanner(detail, state, onRetry) {
  const existing = detail.querySelector('#seedream-demo-recovery');
  if (!shouldOfferSeedreamDemoRecovery(state)) {
    existing?.remove();
    return;
  }
  if (!existing) detail.insertAdjacentHTML('afterbegin', bannerMarkup(state.task.id, state.analysis.id));
  const button = detail.querySelector('#seedreamDemoRetryBtn');
  if (button && !button.dataset.bound) {
    button.dataset.bound = '1';
    button.addEventListener('click', () => onRetry(button));
  }
}

export async function bootstrapSeedreamDemoRecovery(supabase) {
  if (!/ai-designer-workspace\.html$/i.test(location.pathname)) return;
  if (window.__seedreamDemoRecoveryStarted) return;
  window.__seedreamDemoRecoveryStarted = true;

  for (let attempt = 0; attempt < 40; attempt += 1) {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) break;
    await sleep(150);
  }

  let lastSignature = '';
  let busy = false;

  const refresh = async (force = false) => {
    if (busy) return;
    const detail = document.getElementById('detail');
    const taskId = activeTaskId();
    if (!detail || !taskId) return;
    const signature = `${taskId}:${detail.textContent?.slice(0, 180) || ''}`;
    if (!force && signature === lastSignature) return;
    lastSignature = signature;
    try {
      const state = await loadRecoveryState(supabase, taskId);
      mountBanner(detail, state, async (button) => {
        if (busy) return;
        busy = true;
        const original = button.textContent;
        button.disabled = true;
        button.textContent = 'Seedream Demo 生成中…';
        try {
          const { data, error } = await supabase.functions.invoke('uat-ai-design', {
            body: {
              task_id: state.task.id,
              action: 'generate_demo',
              analysis_id: state.analysis.id,
              idempotency_key: crypto.randomUUID(),
            },
          });
          if (error) throw error;
          if (!data?.ok) throw new Error(data?.error || 'SEEDREAM_DEMO_FAILED');
          button.textContent = 'Seedream Demo 已生成';
          setTimeout(() => location.reload(), 900);
        } catch (error) {
          console.error('Seedream Demo 重新生成失败:', error);
          button.disabled = false;
          button.textContent = original;
          const message = String(error?.message || error || '生成失败');
          alert(`Seedream Demo 生成失败：${message}`);
          await refresh(true);
        } finally {
          busy = false;
        }
      });
    } catch (error) {
      console.error('Seedream Demo 恢复状态读取失败:', error);
    }
  };

  const observer = new MutationObserver(() => {
    clearTimeout(window.__seedreamDemoRecoveryTimer);
    window.__seedreamDemoRecoveryTimer = setTimeout(() => refresh(), 180);
  });
  observer.observe(document.body, { subtree: true, childList: true, characterData: true });
  await refresh(true);
}
