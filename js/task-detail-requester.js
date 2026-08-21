const currentTaskId = new URLSearchParams(window.location.search).get('id');
let currentTask = null;
let currentUser = null;
let chatRefreshTimer = null;

const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[character]));
const setText = (id, value) => {
  const element = document.getElementById(id);
  if (element) element.textContent = value;
};

window.showToast = function showToast(title, description, type = 'success') {
  const toast = document.getElementById('action-toast');
  const icon = document.getElementById('toast-icon');
  if (!toast || !icon) return;
  setText('toast-title', title);
  setText('toast-desc', description);
  const styles = type === 'success'
    ? 'bg-emerald-500/20 text-emerald-400'
    : type === 'info'
      ? 'bg-orange-500/20 text-orange-400'
      : 'bg-rose-500/20 text-rose-400';
  icon.className = `w-8 h-8 rounded-full ${styles} flex items-center justify-center shrink-0`;
  icon.textContent = type === 'success' ? '✓' : type === 'info' ? 'i' : '!';
  toast.classList.remove('hidden');
  setTimeout(() => toast.classList.add('hidden'), 3000);
};

function userName(user) {
  return user?.displayName || user?.cnName || user?.enName || '';
}

function isTaskRequester() {
  const requester = String(currentTask?.creator || '').trim().toLowerCase();
  return [userName(currentUser), currentUser?.enName].some((value) => String(value || '').trim().toLowerCase() === requester);
}

function renderIdentity() {
  const enName = String(currentUser?.enName || '').toLowerCase();
  const isAdmin = enName === 'davidxxu';
  const identity = isAdmin ? '身份: 管理员' : isTaskRequester() ? '身份: 需求提单方' : '身份: 只读访问';
  setText('header-identity-tag', identity);
  setText('sidebar-role', isAdmin ? '管理员' : isTaskRequester() ? '需求方' : '只读访问');
}

function renderTaskDetails() {
  setText('req-id', currentTask.id || '--');
  setText('req-title-display', currentTask.title || '无标题');
  setText('dt-project', currentTask.project || '--');
  setText('dt-date', currentTask.due_date || '--');
  setText('dt-creator', currentTask.creator || '系统记录');
  setText('dt-assignee', currentTask.assignee && currentTask.assignee !== 'none' ? currentTask.assignee : '暂未分配');

  const description = document.getElementById('req-desc-display');
  if (description) description.innerHTML = escapeHtml(currentTask.full_desc || '暂无描述').replace(/\n/g, '<br>');

  const linkContainer = document.getElementById('dt-link-container');
  const linkTarget = document.getElementById('dt-link');
  if (linkContainer && linkTarget && currentTask.link) {
    linkContainer.classList.remove('hidden');
    const anchor = document.createElement('a');
    anchor.href = currentTask.link;
    anchor.target = '_blank';
    anchor.rel = 'noopener noreferrer';
    anchor.className = 'text-sky-400 hover:underline break-all';
    anchor.textContent = currentTask.link;
    linkTarget.replaceChildren(anchor);
  }

  const attachment = document.getElementById('attachment-container');
  if (!attachment || !currentTask.file_name) return;
  if (!currentTask.file_data) {
    attachment.innerHTML = `<p class="text-[11px] text-zinc-500 italic mt-2">📎 提单附件：${escapeHtml(currentTask.file_name)}</p>`;
    return;
  }
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'text-[11px] bg-white/5 text-indigo-300 px-3 py-1.5 rounded-lg border border-white/10 hover:bg-white/10';
  button.textContent = `下载提单附件：${currentTask.file_name}`;
  button.addEventListener('click', () => window.downloadBase64Attachment(currentTask.file_name, currentTask.file_data));
  attachment.replaceChildren(button);
}

const STATUS_VIEW = {
  pending: ['排队中', '需求已提交，等待设计接单。', 'sky'],
  pending_accept: ['待接单', '需求已提交，等待设计接单。', 'sky'],
  needs_input: ['等待补充', '请在 AI 设计师沟通区回答问题或继续补充需求。', 'amber'],
  understanding_ready: ['信息已确认', 'AI 已理解需求，正在进入设计执行。', 'indigo'],
  processing: ['设计进行中', '设计师正在制作下一版设计稿。', 'sky'],
  pending_approval: ['领导审核中', '框架方案正在等待领导审核。', 'amber'],
  reviewing: ['待验收', '当前最新交付版本等待需求方验收。', 'emerald'],
  rejected: ['修改中', '设计师正在根据修改意见制作下一版。', 'rose'],
  completed: ['已验收', '最新交付版本已经验收，任务已完成。', 'emerald'],
  archived: ['已验收', '最新交付版本已经验收，任务已归档。', 'emerald'],
  terminated: ['已结束', '该需求已结束。', 'zinc'],
};

function renderAcceptance() {
  const panel = document.getElementById('acceptance-panel');
  const badge = document.getElementById('header-status-badge');
  if (!panel || !badge) return;
  const [label, description, color] = STATUS_VIEW[currentTask.status] || ['进行中', '需求正在按正式流程推进。', 'sky'];
  badge.textContent = label;
  badge.className = `bg-${color}-500/20 text-${color}-400 border border-${color}-500/30 px-3 py-1.5 rounded-lg text-[12px] font-bold flex items-center gap-1.5`;
  badge.classList.remove('hidden');

  const canAct = isTaskRequester() || String(currentUser?.enName || '').toLowerCase() === 'davidxxu';
  const actions = currentTask.status === 'reviewing' && canAct
    ? `<div class="mt-5 space-y-3"><button type="button" onclick="window.submitReqAccept()" class="w-full py-3.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-[13px] font-bold">满意，确认验收</button><button type="button" onclick="window.openRevisionModal()" class="w-full py-3.5 bg-rose-600/10 hover:bg-rose-500 hover:text-white text-rose-400 border border-rose-500/30 rounded-xl text-[13px] font-bold">提交修改意见</button></div>`
    : '';
  panel.innerHTML = `<div class="absolute right-0 top-0 bottom-0 w-1.5 bg-${color}-500"></div><p class="text-[11px] text-zinc-500 mb-2">验收</p><h3 class="text-[16px] font-bold text-${color}-400 mb-3">${label}</h3><p class="text-[12px] text-zinc-400 leading-relaxed">${description}</p>${actions}`;
}

async function renderAiCommunication() {
  const panel = document.getElementById('ai-requirement-panel');
  const content = document.getElementById('ai-requirement-content');
  if (!panel || !content || currentTask?.assignee !== 'davis.design.ai' || !window.aiRequirementClient || !window.aiClarificationChat) return;
  panel.classList.remove('hidden');
  try {
    const state = await window.aiRequirementClient.loadAiCommunicationState(window.supabase, currentTaskId);
    window.currentAiRequirementState = state;
    const openQuestions = state.clarifications.filter((item) => item.status === 'open');
    const messages = state.messages
      .filter((message) => !(message.sender_type === 'ai' && message.status === 'open'))
      .map((message) => window.aiClarificationChat.renderMessageBubble(message, escapeHtml))
      .join('');
    const questions = openQuestions
      .map((question, index) => window.aiClarificationChat.renderQuestionControl(question, index, escapeHtml))
      .join('');
    const statusText = currentTask.status === 'processing' ? '正在设计' : openQuestions.length ? `等待回答 ${openQuestions.length} 个问题` : '可以继续补充需求';
    content.innerHTML = `<div id="ai-clarification-chat"><div class="flex justify-between gap-3 mb-5"><div><h3 class="text-lg font-bold text-white">与 AI 设计师沟通</h3><p class="text-sm text-zinc-400 mt-1">查看设计师提问、需求方回复，并继续补充需求。</p></div><span class="text-sm text-indigo-300">${statusText}</span></div><div class="max-h-72 overflow-y-auto space-y-3 mb-4">${messages || '<p class="text-xs text-zinc-500">暂无沟通记录。</p>'}</div><div class="space-y-4">${questions || '<p class="text-emerald-400">AI 暂时没有需要你回答的问题。</p>'}</div><textarea id="ai-general-message" class="mt-4 w-full min-h-[80px] rounded-xl bg-black/30 border border-white/10 p-3 text-sm text-white outline-none focus:border-indigo-400" placeholder="继续补充需求"></textarea><div class="mt-3 flex flex-wrap gap-3"><button id="ai-chat-submit" type="button" onclick="window.submitAiChatAnswers()" class="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold">${openQuestions.length ? '提交回答' : '提交补充需求'}</button>${openQuestions.length ? '<button type="button" onclick="window.delegateAiClarifications()" class="px-5 py-2.5 rounded-xl bg-zinc-700 hover:bg-zinc-600 text-white font-bold">不确定的交给 AI 决定</button>' : ''}</div><p id="ai-chat-status" class="mt-3 text-xs text-zinc-500"></p></div>`;
  } catch (error) {
    console.error('需求方沟通信息读取失败:', error);
    content.innerHTML = '<p class="text-zinc-400">沟通信息暂时无法读取，请刷新页面后再试。</p>';
  }
}

async function fetchTaskData() {
  const { data, error } = await window.supabase
    .from(window.DB_TABLE)
    .select('id,title,project,due_date,creator,assignee,full_desc,link,file_name,file_data,status')
    .eq('id', currentTaskId)
    .single();
  if (error || !data) throw error || new Error('需求不存在');
  currentTask = data;
  renderTaskDetails();
  renderIdentity();
  renderAcceptance();
  await renderAiCommunication();
}

window.initApp = async function initApp() {
  const storedUser = localStorage.getItem('activeUserObj');
  if (!storedUser) {
    window.location.href = 'login.html';
    return;
  }
  currentUser = JSON.parse(storedUser);
  setText('sidebar-avatar', currentUser.avatar || '?');
  setText('sidebar-name', userName(currentUser));
  if (!currentTaskId) {
    window.showAlert('错误', '非法访问：未找到需求单号！', 'danger');
    return;
  }
  try {
    await fetchTaskData();
  } catch (error) {
    console.error('需求详情读取失败:', error);
    window.showToast('数据加载失败', error?.message || '请刷新页面后再试', 'error');
  }
};

window.selectAiChoice = function selectAiChoice(button) {
  const group = button.closest('[data-ai-choice-group]');
  const input = group?.previousElementSibling;
  if (!input?.matches('[data-ai-question]')) return;
  input.value = button.dataset.aiChoiceValue || '';
  group.querySelectorAll('[data-ai-choice-value]').forEach((item) => item.classList.toggle('bg-indigo-600', item === button));
};

window.submitAiChatAnswers = async function submitAiChatAnswers() {
  const answers = [...document.querySelectorAll('[data-ai-question]')]
    .filter((field) => field.value.trim())
    .map((field) => ({ clarification_id: field.dataset.aiQuestion, answer: field.value.trim() }));
  const message = document.getElementById('ai-general-message')?.value.trim() || '';
  if (!answers.length && !message) return window.showToast('还没有填写', '请回答问题或填写补充需求。', 'info');
  const button = document.getElementById('ai-chat-submit');
  if (button) button.disabled = true;
  try {
    await window.aiRequirementClient.submitClarificationAnswers(window.supabase, currentTaskId, answers, message);
    window.showToast('已提交', '设计师已收到补充信息。', 'success');
    clearTimeout(chatRefreshTimer);
    chatRefreshTimer = setTimeout(fetchTaskData, 1500);
  } catch (error) {
    if (button) button.disabled = false;
    window.showToast('提交失败', error.message, 'error');
  }
};

window.delegateAiClarifications = async function delegateAiClarifications() {
  try {
    await window.aiRequirementClient.delegateClarificationsToAi(window.supabase, currentTaskId);
    window.showToast('已提交', '设计师将按专业判断继续处理。', 'success');
    clearTimeout(chatRefreshTimer);
    chatRefreshTimer = setTimeout(fetchTaskData, 1500);
  } catch (error) {
    window.showToast('提交失败', error.message, 'error');
  }
};

window.openRevisionModal = function openRevisionModal() {
  const overlay = document.getElementById('reject-modal-overlay');
  const modal = document.getElementById('reject-modal');
  overlay?.classList.remove('hidden');
  setTimeout(() => {
    overlay?.classList.remove('opacity-0');
    modal?.classList.remove('hidden');
  }, 10);
};

window.closeActionModals = function closeActionModals() {
  const overlay = document.getElementById('reject-modal-overlay');
  const modal = document.getElementById('reject-modal');
  overlay?.classList.add('opacity-0');
  setTimeout(() => {
    overlay?.classList.add('hidden');
    modal?.classList.add('hidden');
  }, 300);
};

window.submitReject = async function submitReject() {
  const reason = document.getElementById('reject-reason')?.value.trim() || '';
  if (!reason) return window.showAlert('提示', '请填写具体修改意见。', 'danger');
  const button = document.getElementById('btn-reject-submit');
  if (button) button.disabled = true;
  try {
    if (currentTask.assignee === 'davis.design.ai') {
      await window.aiRequirementClient.submitContentRevisionRequest(window.supabase, currentTaskId, { requester_feedback: reason, refresh_tencent_doc: false });
    } else {
      const { error } = await window.supabase.from(window.DB_TABLE).update({ status: 'rejected', summary_desc: `需求方修改意见：${reason}` }).eq('id', currentTaskId);
      if (error) throw error;
    }
    window.closeActionModals();
    window.showToast('修改意见已提交', '设计师将制作下一版设计稿。', 'success');
    setTimeout(() => window.location.reload(), 1000);
  } catch (error) {
    if (button) button.disabled = false;
    window.showToast('提交失败', error.message, 'error');
  }
};

window.submitReqAccept = function submitReqAccept() {
  window.showConfirm('确认验收', '确认当前最新交付版本符合需求并完成验收吗？', async () => {
    try {
      if (currentTask.assignee === 'davis.design.ai') {
        await window.aiRequirementClient.acceptCurrentRevision(window.supabase, currentTaskId);
      } else {
        const { error } = await window.supabase.from(window.DB_TABLE).update({ status: 'completed', summary_desc: '需求方已确认验收。' }).eq('id', currentTaskId);
        if (error) throw error;
      }
      window.showToast('验收完成', '当前最新版本已验收。', 'success');
      setTimeout(() => window.location.reload(), 1000);
    } catch (error) {
      window.showToast('验收失败', error.message, 'error');
    }
  }, 'success');
};

window.openPreview = function openPreview(sourceUrl) {
  if (!sourceUrl) return;
  const image = document.getElementById('modal-image');
  const modal = document.getElementById('image-preview-modal');
  if (!image || !modal) return;
  image.src = sourceUrl;
  modal.classList.remove('hidden');
  modal.style.display = 'flex';
  setTimeout(() => modal.classList.add('visible'), 10);
};

window.closePreview = function closePreview() {
  const modal = document.getElementById('image-preview-modal');
  if (!modal) return;
  modal.classList.remove('visible');
  setTimeout(() => {
    modal.style.display = 'none';
    modal.classList.add('hidden');
  }, 300);
};

window.downloadBase64Attachment = function downloadBase64Attachment(name, data) {
  const anchor = document.createElement('a');
  anchor.href = data;
  anchor.download = name;
  anchor.click();
};

document.addEventListener('DOMContentLoaded', () => {
  if (window.supabase) window.initApp();
});
