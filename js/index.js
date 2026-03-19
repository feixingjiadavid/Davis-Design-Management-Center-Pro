// ================= 核心：连接云端数据库 =================
import { supabase } from '../supabase-config.js';
window.supabase = supabase;
window.DB_TABLE = 'test_tasks'; 
window.LIGHT_FIELDS = 'id, created_at, title, summary_desc, project, assignee, due_date, status, creator, history_json';

window.PAGE_TYPE = 'req'; 
let currentUploadedFileData = null;

// ================= 系统鉴权与环境初始化 =================
window.updateGreeting = function(user) {
    const hour = new Date().getHours();
    let timeStr = '晚上好';
    if (hour >= 5 && hour < 12) timeStr = '上午好';
    else if (hour >= 12 && hour < 18) timeStr = '下午好';
    const display = user.displayName || user.cnName || user.enName;
    const greetingEl = document.getElementById('header-greeting');
    if(greetingEl) greetingEl.innerHTML = `${timeStr}，${display}。<div id="sync-indicator" class="hidden w-2 h-2 rounded-full bg-emerald-500 animate-pulse ml-3" title="云端连接中..."></div>`;
}

window.initRBAC = function() {
    const userStr = localStorage.getItem('activeUserObj');
    if (!userStr) { window.location.href = 'login.html'; return false; }
    const user = JSON.parse(userStr);
    const enName = user.enName ? user.enName.toLowerCase() : '';

    if (!(user.perms || []).includes(window.PAGE_TYPE)) { 
        window.showAlert("权限错误", "无权限访问此页面", "danger"); 
        setTimeout(window.logout, 1500); 
        return false; 
    }

    const avatarEl = document.getElementById('sidebar-avatar');
    if(avatarEl) { avatarEl.innerText = user.avatar || '?'; avatarEl.className = `w-9 h-9 rounded-full ${user.color || 'bg-indigo-600'} border border-zinc-700 flex items-center justify-center text-white font-bold text-sm shadow-lg shrink-0`; }
    const nameEl = document.getElementById('sidebar-name');
    if(nameEl) nameEl.innerText = user.displayName || user.cnName || user.enName;
    const roleEl = document.getElementById('sidebar-role');
    if(roleEl) roleEl.innerHTML = `<span class="text-indigo-400 font-bold">当前视角: 需求方</span>`;
    
    window.updateGreeting(user);

    const testUsers = ['ponyxu', 'davidxxu', 'yoshyliu', 'judyzzhang', '小戴维斯'];
    const isTestUser = testUsers.includes(enName) || testUsers.includes(user.displayName) || testUsers.includes(user.cnName);
    if(isTestUser) {
        const clrBtn = document.getElementById('clear-db-btn');
        if(clrBtn) { clrBtn.classList.remove('hidden'); clrBtn.classList.add('flex'); }
    }

    const menuContainer = document.getElementById('dynamic-identity-list');
    if (menuContainer) {
        let html = `<div class="flex items-center gap-3 px-3 py-3 rounded-xl bg-[#2a2a35] text-indigo-300 cursor-default"><div class="w-7 h-7 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg></div><span class="text-[13px] font-bold">需求方视角 (当前)</span></div>`;
        if ((user.perms || []).includes('design')) { 
            html += `<div class="flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-white/5 text-zinc-400 hover:text-white cursor-pointer btn-press transition-colors" onclick="window.location.href='assistant-workspace.html'"><div class="w-7 h-7 rounded-lg bg-orange-500/10 text-orange-500 flex items-center justify-center"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg></div><span class="text-[13px] font-medium">设计方视角 (去接单)</span></div>`; 
        }
        if ((user.perms || []).includes('admin')) { 
            html += `<div class="flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-white/5 text-zinc-400 hover:text-white cursor-pointer btn-press transition-colors" onclick="window.location.href='manager-workspace.html'"><div class="w-7 h-7 rounded-lg bg-fuchsia-500/10 text-fuchsia-400 flex items-center justify-center"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="3" y1="9" x2="21" y2="9"></line><line x1="9" y1="21" x2="9" y2="9"></line></svg></div><span class="text-[13px] font-medium">管理方视角 (统筹大盘)</span></div>`; 
        }
        menuContainer.innerHTML = html;
    }
    const triggerBtn = document.getElementById('identityBtn');
    if (triggerBtn) { triggerBtn.innerHTML = `<span class="text-indigo-400 font-black">•</span> 身份: 需求方 (当前) <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="text-zinc-500 ml-1"><polyline points="6 9 12 15 18 9"></polyline></svg>`; }
    return user;
}

// ================= 大厅看板渲染引擎 =================
window.cancelTask = async function(taskId) {
    if(!window.supabase) return;
    window.showConfirm("确认撤销", `确定要彻底撤销并删除需求单 ${taskId} 吗？此操作不可恢复。`, async () => {
        try {
            const { error } = await window.supabase.from(window.DB_TABLE).delete().eq('id', taskId);
            if (error) throw error;
            const card = document.getElementById('card-' + taskId);
            if(card) card.remove();
            window.showToast('已撤销', `需求单 ${taskId} 已被彻底删除。`, 'info');
            setTimeout(async () => { await window.loadTasksFromCloud(true); }, 300);
        } catch(e) { window.showAlert("撤销失败", e.message, "danger"); }
    }, "danger");
}

window.createTaskHTML = function(task, currentUser) {
    const currentUserEn = currentUser.enName ? currentUser.enName.toLowerCase() : '';
    const creator = task.creator || '';
    const isOwner = creator === currentUser.displayName || creator === currentUser.cnName || creator === currentUser.enName || creator === currentUserEn;
    
    let isJudy = currentUserEn === 'judyzzhang';
    let isSuperAdmin = currentUserEn === 'davidxxu'; 
    
    if(!isOwner && !isSuperAdmin && !(isJudy && ['pending_approval', 'reviewing', 'completed', 'archived', 'terminated'].includes(task.status))) return null;

    let sColor, sText;
    let targetUrl = `task-detail-requester.html?id=${task.id}`; 
    let isUrgent = false;

    if(task.due_date && !['completed','archived','terminated'].includes(task.status)) {
        const due = new Date(task.due_date);
        const today = new Date();
        due.setHours(0,0,0,0); today.setHours(0,0,0,0);
        const diffDays = (due - today) / (1000 * 60 * 60 * 24);
        if(diffDays <= 2 && diffDays >= -999) isUrgent = true;
    }

    switch(task.status) {
        case 'rejected': sColor = 'text-rose-500'; sText = '需求被打回修改'; isUrgent = true; break;
        case 'reviewing': sColor = 'text-emerald-500'; sText = '方案待验收'; break;
        case 'pending_accept': sColor = 'text-amber-400'; sText = '待接单'; break;
        case 'pending_approval': sColor = 'text-amber-500'; sText = '框架待审批'; break;
        case 'processing': sColor = 'text-orange-500'; sText = '设计制作中'; break;
        case 'completed': 
        case 'archived': sColor = 'text-zinc-400'; sText = '已完结'; break;
        case 'terminated': sColor = 'text-rose-700'; sText = '已强行终止'; break;
        default: sColor = 'text-sky-400'; sText = '待排期/待分配'; 
    }

    const isCompleted = ['completed','archived','terminated'].includes(task.status);
    const borderColBase = isUrgent ? 'rgba(244,63,94,0.7)' : sColor.replace('text-', 'rgba(').replace('sky','56,189,248').replace('amber','251,191,36').replace('emerald','16,185,129').replace('rose','244,63,94').replace('orange','249,115,22').replace('zinc','113,113,122') + ',0.3)';
    const breatheClass = isUrgent ? 'breathe-rose' : '';
    const canCancel = (task.status === 'pending' || task.status === 'pending_accept' || task.status === 'rejected') && isOwner;
    const cancelBtn = canCancel ? `<button onclick="event.stopPropagation(); window.cancelTask('${task.id}')" class="text-[10px] text-rose-500 bg-rose-500/10 px-2 py-0.5 rounded ml-2 hover:bg-rose-500 hover:text-white transition-colors">撤销</button>` : '';

    const iconHtml = (task.status === 'reviewing' || task.status === 'rejected' || isCompleted) ? '' : `<svg class="animate-spin h-3.5 w-3.5 ${sColor}" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>`;

    const cardHTML = `
        <div class="rounded-2xl p-5 interactive-card flex flex-col relative overflow-hidden ${breatheClass} mb-4 ${isCompleted ? 'opacity-60' : ''}" style="border-color: ${borderColBase}" id="card-${task.id}" onmouseenter="window.previewTask('${task.id}', '${task.title}', '${sColor}')" onclick="window.location.href='${targetUrl}'">
            ${isUrgent ? '<div class="absolute top-0 right-0 bg-rose-500 text-white text-[10px] font-bold px-3 py-1 rounded-bl-xl z-10 animate-pulse">临期预警</div>' : ''}
            <div class="flex items-center justify-between mb-3 mt-1 relative z-10">
                <div class="flex gap-2 items-center">
                    <span class="font-mono text-[10px] font-bold ${sColor} bg-white/5 px-2 py-0.5 rounded border border-white/5">${task.id}</span>
                    <span class="text-xs ${sColor} font-bold tracking-wide flex items-center gap-1.5">${iconHtml} ${sText}</span>
                </div>
                ${cancelBtn || `<span class="text-[11px] ${sColor} font-bold opacity-0 group-hover:opacity-100 transition-opacity">查看详情 ↗</span>`}
            </div>
            <h4 class="text-[17px] font-bold text-zinc-100 mb-2 relative z-10">${task.title}</h4>
            ${isCompleted ? '' : `<p class="text-xs text-zinc-400 mb-4 line-clamp-1 relative z-10">${task.summary_desc || ''}</p>`}
            <div class="flex items-center justify-between text-[11px] text-zinc-400 border-t border-white/5 pt-3 relative z-10">
                <span>归属: ${task.project}</span>
                <span>执行人: ${task.assignee === 'none' ? '待定' : task.assignee}</span>
                <span class="${isCompleted ? 'text-zinc-500' : (isUrgent ? 'text-rose-500 font-bold' : 'text-zinc-400')}">期望交付: ${task.due_date}</span>
            </div>
        </div>
    `;

    let strokeColor = sColor.split('-')[1] || 'sky';
    if(strokeColor === 'zinc') strokeColor = 'gray'; 

    let historyArr = [];
    try { historyArr = JSON.parse(task.history_json || '[]'); } catch(e) {}

    let timelineHTML = `<div id="timeline-${task.id}" class="hidden" data-col="${sColor}" data-title="${task.title}">`;

    if (historyArr.length > 0) {
        let revHistory = [...historyArr].reverse();
        revHistory.forEach(h => {
            let dotColor = 'zinc', actionTxt = h.action, subTxt = '';
            if(h.is_rejected) { dotColor = 'rose'; actionTxt = '被打回修改'; subTxt = `原因: ${h.reply || h.desc || ''}`; }
            else if(h.action === 'approve_framework') { dotColor = 'emerald'; actionTxt = '领导审批通过'; subTxt = h.reply || '同意'; }
            else if(h.action === 'submit_draft') { dotColor = 'sky'; actionTxt = '设计师上传正稿 ' + (h.version||''); }
            else if(h.action === 'submit_framework') { dotColor = 'amber'; actionTxt = '设计师上传框架 ' + (h.version||''); }
            else if(h.action === 'complete') { dotColor = 'emerald'; actionTxt = '甲方验收成功完结'; }
            else if(h.action === 'terminate') { dotColor = 'rose'; actionTxt = '任务被强行终止'; subTxt = h.reply || ''; }
            else if(h.action === 'transfer') { dotColor = 'orange'; actionTxt = '任务发生转单'; subTxt = h.reply || ''; }
            else { actionTxt = h.action || '状态更新'; subTxt = h.reply || h.desc || ''; }
            
            let timeStr = new Date(h.created_at || h.time).toLocaleString();

            timelineHTML += `
            <div class="timeline-item relative flex gap-4 z-10 pb-6 group">
               <div class="timeline-line group-last:hidden"></div>
               <div class="w-5 h-5 rounded-full bg-[#121217] border-[2px] border-${dotColor}-500 flex items-center justify-center shrink-0 z-10 mt-0.5 shadow-[0_0_8px_rgba(var(--tw-colors-${dotColor}-500),0.3)]"><div class="w-1.5 h-1.5 bg-${dotColor}-500 rounded-full"></div></div>
               <div class="w-full pr-2 z-10">
                   <p class="text-[12px] font-bold text-zinc-300 flex justify-between">${actionTxt} <span class="text-[9px] text-zinc-600 font-mono font-normal">${timeStr}</span></p>
                   ${subTxt ? `<p class="text-[10px] text-zinc-500 mt-1 line-clamp-2">${subTxt}</p>` : ''}
               </div>
            </div>`;
        });
    }

    timelineHTML += `
        <div class="timeline-item relative flex gap-4 z-10 pb-2 opacity-40 grayscale hover:opacity-100 hover:grayscale-0 transition-all duration-300 group">
            <div class="timeline-line hidden"></div>
            <div class="w-5 h-5 rounded-full bg-[#121217] border-[2px] border-zinc-500 flex items-center justify-center shrink-0 z-10">
                <div class="w-1.5 h-1.5 bg-zinc-500 rounded-full"></div>
            </div>
            <div class="pt-0.5 w-full pr-2">
                <p class="text-[12px] font-bold text-zinc-300 mb-0.5 flex justify-between">需求建单发至大厅 <span class="text-[9px] text-zinc-500 font-mono font-normal">${new Date(task.created_at).toLocaleString()}</span></p>
                <p class="text-[10px] text-zinc-500">发起人: ${task.creator || '未知'}</p>
            </div>
        </div>
    </div>`;

    return { isCompleted, cardHTML, timelineHTML };
}

window.loadTasksFromCloud = async function(isSilent = false) {
    if(!window.supabase) return;
    const userStr = localStorage.getItem('activeUserObj');
    const currentUser = userStr ? JSON.parse(userStr) : null;
    if(!currentUser) return;
    const currentUserEn = currentUser.enName ? currentUser.enName.toLowerCase() : '';
    const cNames = [currentUser.displayName, currentUser.cnName, currentUser.enName, currentUserEn].filter(Boolean).map(n => n.toLowerCase());
    const isSuperAdmin = currentUserEn === 'davidxxu' || currentUserEn === 'judyzzhang';
    
    if (!isSilent) window.renderDraftToUI(); 
    const spinner = document.getElementById('loading-spinner');
    const syncDot = document.getElementById('sync-indicator');
    if(syncDot && isSilent) syncDot.classList.remove('hidden');
    
    try {
        const [ongoingRes, completedRes] = await Promise.all([
            window.supabase.from(window.DB_TABLE).select(window.LIGHT_FIELDS).not('status', 'in', '("completed","archived","terminated")').order('created_at', { ascending: false }),
            window.supabase.from(window.DB_TABLE).select(window.LIGHT_FIELDS).in('status', ['completed', 'archived', 'terminated']).order('created_at', { ascending: false }).limit(20)
        ]);

        const ongoingC = document.getElementById('ongoing-tasks-container');
        const completedC = document.getElementById('completed-tasks-container');
        const timelineC = document.getElementById('all-timelines-container');

        if(!isSilent && ongoingC) ongoingC.querySelectorAll('.interactive-card:not(#draft-card)').forEach(el => el.remove());
        if(!isSilent && completedC) completedC.innerHTML = ''; 
        if(!isSilent && timelineC) timelineC.innerHTML = '';

        const allData = [...(ongoingRes.data || []), ...(completedRes.data || [])];
        let ongoingCount = 0;
        let completedCount = 0;

        allData.forEach(task => {
            const creator = task.creator || '';
            const isOwner = cNames.includes(creator.toLowerCase());
            if(!isOwner && !isSuperAdmin) return;

            if (!isSilent) {
                const res = createTaskHTML(task, currentUser);
                if(res) { 
                    if(res.isCompleted) {
                        if(completedC) { completedC.insertAdjacentHTML('beforeend', res.cardHTML); completedCount++; }
                    } else {
                        if(ongoingC) { ongoingC.insertAdjacentHTML('beforeend', res.cardHTML); ongoingCount++; }
                    }
                    if(timelineC) timelineC.insertAdjacentHTML('beforeend', res.timelineHTML); 
                }
            }
        });

        if(window.syncNotificationsFromCloud) await window.syncNotificationsFromCloud();

        if(!isSilent) {
            if(spinner) spinner.classList.add('hidden');
            if(ongoingC && ongoingCount === 0) {
                ongoingC.innerHTML += `
                    <div class="text-center py-20 bg-[#121217] rounded-3xl border border-white/5 border-dashed">
                        <div class="w-16 h-16 bg-zinc-800/50 rounded-full flex items-center justify-center mx-auto mb-4 text-zinc-500">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="9" y1="3" x2="9" y2="21"></line></svg>
                        </div>
                        <p class="text-sm font-bold text-zinc-400 mb-1">大厅空空如也</p>
                        <p class="text-xs text-zinc-600">快点击右上角发起你的第一个需求吧！</p>
                    </div>`;
            }
            if(completedC && completedCount === 0) {
                completedC.innerHTML = `<div class="text-center py-8 text-zinc-600 text-sm">暂无已完结/归档的工单</div>`;
            }

            if (localStorage.getItem('myDraftTask')) {
                window.previewTask('draft-card', '草稿', 'text-zinc-400');
            } else {
                const firstCard = document.querySelector('.interactive-card:not(#draft-card)');
                if (firstCard) {
                    const tid = firstCard.id.replace('card-', '');
                    window.previewTask(tid, '', '');
                }
            }
        }
    } catch(e) { 
        console.error(e); 
        if(spinner) spinner.classList.add('hidden');
    } finally {
        if(syncDot) setTimeout(() => syncDot.classList.add('hidden'), 500);
    }
}

window.previewTask = function(taskId, title='', col='') {
    document.querySelectorAll('.interactive-card').forEach(el => el.classList.remove('active-card'));
    const targetCard = document.getElementById('card-' + taskId);
    if(targetCard) targetCard.classList.add('active-card');
    
    document.querySelectorAll('[id^="timeline-"]').forEach(el => el.classList.add('hidden'));
    const timeline = document.getElementById('timeline-' + taskId);
    if(timeline) {
        timeline.classList.remove('hidden');
        const focusEl = document.getElementById('tracking-focus-text');
        if(focusEl) {
            focusEl.innerText = `${taskId} (${timeline.dataset.title})`;
            focusEl.className = `${timeline.dataset.col} font-mono font-bold truncate block`;
        }
    } else if (taskId === 'draft-card') {
        const focusEl = document.getElementById('tracking-focus-text');
        if(focusEl) {
            focusEl.innerText = `草稿 (暂存中)`;
            focusEl.className = `text-zinc-400 font-mono font-bold`;
        }
    }
}

// ================= 发单、草稿与表单逻辑 =================
window.openModal = function(modalId, isEdit = false) {
    const overlay = document.getElementById('modal-overlay');
    overlay.classList.remove('hidden');
    setTimeout(() => {
        overlay.classList.remove('opacity-0');
        document.getElementById(modalId).classList.remove('hidden');
        document.getElementById(modalId).classList.add('modal-enter');
    }, 10);
    if(modalId === 'create-modal' && !isEdit) {
        document.getElementById('req-short-title').value = '';
        document.getElementById('req-title').value = '';
        document.getElementById('req-project').value = '';
        document.getElementById('req-assignee').value = 'none';
        const assInput = document.getElementById('req-assignee-input');
        if(assInput) assInput.value = '';
        document.getElementById('req-date').value = '';
        document.getElementById('req-link').value = '';
        document.querySelectorAll('.req-channel').forEach(cb => cb.checked = false);
        document.getElementById('channel-other-cb').checked = false;
        window.toggleOtherInput();
        window.resetUploadZone();
    }
}

window.closeAllModals = function() {
    const overlay = document.getElementById('modal-overlay');
    overlay.classList.add('opacity-0');
    const el = document.getElementById('create-modal');
    if(el) { el.classList.remove('modal-enter'); el.classList.add('hidden'); }
    setTimeout(() => { overlay.classList.add('hidden'); }, 300);
}

window.renderDraftToUI = function() {
    const savedDraft = localStorage.getItem('myDraftTask');
    const container = document.getElementById('ongoing-tasks-container');
    if(!container) return;
    
    const existingDraft = document.getElementById('draft-card');
    if(existingDraft) existingDraft.remove();
    
    if (savedDraft) {
        const draft = JSON.parse(savedDraft);
        const draftHTML = `
            <div class="rounded-2xl p-5 border border-zinc-700 bg-transparent opacity-40 mb-4 cursor-pointer hover:opacity-70 transition-opacity interactive-card" id="draft-card" onclick="window.editDraft()">
                <div class="flex justify-between items-center mb-1 relative z-10">
                    <span class="text-[10px] text-zinc-500 font-bold bg-zinc-800/50 px-2 py-0.5 rounded">📝 需求草稿 (仅本地可见)</span>
                    <button onclick="window.deleteDraft(event, this)" class="text-rose-500 text-[10px] hover:text-white transition-colors">删除</button>
                </div>
                <h4 class="text-zinc-400 font-bold relative z-10">${draft.title || '无标题草稿'}</h4>
            </div>
        `;
        container.insertAdjacentHTML('afterbegin', draftHTML);
    }
}

window.saveDraft = function() { 
    const shortTitle = document.getElementById('req-short-title').value.trim();
    const fullDesc = document.getElementById('req-title').value.trim();
    if(!shortTitle || !fullDesc) return window.showAlert('暂存失败', '请至少填写标题和需求描述！', 'danger');
    
    const selectedChannels = Array.from(document.querySelectorAll('.req-channel:checked')).map(cb => cb.value);
    const otherChannelText = document.getElementById('req-channel-other').value;

    const draftData = { 
        title: shortTitle, fullText: fullDesc, project: document.getElementById('req-project').value, 
        assignee: document.getElementById('req-assignee').value, date: document.getElementById('req-date').value, 
        link: document.getElementById('req-link').value, channels: selectedChannels,
        otherChannel: otherChannelText, fileName: window.getFileNameFromUI(), fileData: currentUploadedFileData, time: new Date().getTime() 
    };
    
    try {
        localStorage.setItem('myDraftTask', JSON.stringify(draftData));
        window.closeAllModals(); 
        window.showToast('📝 暂存成功', '草稿与附件已保存，始终置顶。', 'info'); 
        window.renderDraftToUI();
        const spinner = document.getElementById('loading-spinner');
        if(spinner) spinner.classList.add('hidden');
    } catch (e) {
        draftData.fileData = null;
        draftData.fileName = draftData.fileName ? draftData.fileName + " (因体积过大暂存未包含)" : "";
        try {
            localStorage.setItem('myDraftTask', JSON.stringify(draftData));
            window.closeAllModals(); 
            window.showToast('📝 暂存部分成功', '因附件过大超出浏览器限制，已为您安全保留文本草稿。', 'info'); 
            window.renderDraftToUI();
            const spinner = document.getElementById('loading-spinner');
            if(spinner) spinner.classList.add('hidden');
        } catch (err) { window.showAlert("存储失败", "浏览器本地存储空间已满。清理空间后重试。", "danger"); }
    }
}

window.editDraft = function() {
    document.getElementById('modal-title-text').innerText = '继续编辑草稿';
    const draftStr = localStorage.getItem('myDraftTask');
    if(draftStr) {
        const draft = JSON.parse(draftStr);
        document.getElementById('req-short-title').value = draft.title || '';
        document.getElementById('req-title').value = draft.fullText || '';
        document.getElementById('req-project').value = draft.project || '';
        
        const assVal = draft.assignee || 'none';
        document.getElementById('req-assignee').value = assVal;
        const assInput = document.getElementById('req-assignee-input');
        if(assInput) assInput.value = assVal === 'none' ? '不指定 (系统统筹)' : assVal;
        
        document.getElementById('req-date').value = draft.date || '';
        document.getElementById('req-link').value = draft.link || '';
        
        if(draft.channels) {
            document.querySelectorAll('.req-channel').forEach(cb => { cb.checked = draft.channels.includes(cb.value); });
            window.toggleOtherInput();
            if(draft.otherChannel) document.getElementById('req-channel-other').value = draft.otherChannel;
        }

        if(draft.fileName && draft.fileData) {
            currentUploadedFileData = draft.fileData;
            const uploadText = document.getElementById('upload-text');
            const uploadZone = document.getElementById('upload-zone');
            uploadText.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg> 已选附件: <span class="font-bold truncate max-w-[120px]">${draft.fileName}</span>`;
            uploadText.className = "text-xs font-medium flex items-center gap-1.5 text-indigo-400 w-full justify-center";
            uploadZone.className = "w-full bg-indigo-500/10 border border-indigo-500/50 rounded-xl px-4 py-2.5 flex flex-col items-center justify-center cursor-pointer transition-colors h-[46px]";
        }
    }
    window.openModal('create-modal', true);
}

window.deleteDraft = function(event, btn) {
    event.stopPropagation(); 
    window.showConfirm("删除草稿", "确定要永久删除这条草稿吗？", () => {
        localStorage.removeItem('myDraftTask');
        const dcard = document.getElementById('draft-card');
        if(dcard) dcard.remove();
        window.showToast('已删除', '草稿已永久移除。', 'info');

        setTimeout(() => {
            const container = document.getElementById('ongoing-tasks-container');
            const realCards = container.querySelectorAll('.interactive-card:not(#draft-card)');
            if(realCards.length === 0) {
                container.innerHTML = `
                    <div class="text-center py-20 bg-[#121217] rounded-3xl border border-white/5 border-dashed">
                        <div class="w-16 h-16 bg-zinc-800/50 rounded-full flex items-center justify-center mx-auto mb-4 text-zinc-500">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="9" y1="3" x2="9" y2="21"></line></svg>
                        </div>
                        <p class="text-sm font-bold text-zinc-400 mb-1">大厅空空如也</p>
                        <p class="text-xs text-zinc-600">快点击右上角发起你的第一个需求吧！</p>
                    </div>`;
            }
        }, 300);
    }, "danger");
}

window.submitNewReq = async function() {
    if(!window.supabase) return window.showAlert("系统错误", "云端服务仍在初始化，请稍等！", "danger");

    const shortTitle = document.getElementById('req-short-title').value.trim();
    const fullDesc = document.getElementById('req-title').value.trim();
    const projectVal = document.getElementById('req-project').value.trim();
    const assigneeVal = document.getElementById('req-assignee').value;
    const dateInput = document.getElementById('req-date').value;

    if(!shortTitle || !fullDesc || !projectVal || !dateInput) return window.showAlert("校验失败", "带星号的为必填项！", "danger");
    
    const selectedChannels = Array.from(document.querySelectorAll('.req-channel:checked')).map(cb => cb.value);
    const otherChannelText = document.getElementById('req-channel-other').value.trim();
    if(otherChannelText) selectedChannels.push('其他: ' + otherChannelText);
    
    const linkInput = document.getElementById('req-link').value || '';
    
    let finalStatus = 'pending';
    let finalDesc = '系统正在进行统筹评估，等待分配。';
    let actionReply = '向大厅发起了新需求，等待系统统筹。';

    if (assigneeVal !== 'none' && assigneeVal !== '') {
        finalStatus = 'pending_accept'; 
        const assigneeName = document.getElementById('req-assignee-input').value;
        finalDesc = `已直接指派给设计师 ${assigneeName}，等待接单。`;
        actionReply = `直接指派给了 ${assigneeName}，等待接单。`;
    }

    const btn = document.querySelector('button[onclick="submitNewReq()"]');
    const originalText = btn.innerText;
    btn.innerText = "数据同步中..."; btn.disabled = true;
    
    let nextNum = 1;
    const { data: latestData } = await window.supabase.from(window.DB_TABLE).select('id').order('created_at', { ascending: false }).limit(1);
    if(latestData && latestData.length > 0) {
        const lastId = latestData[0].id;
        const match = lastId.match(/\d+$/);
        if(match) nextNum = parseInt(match[0], 10) + 1;
    }
    const newId = 'TK-' + nextNum.toString().padStart(4, '0'); 

    const user = JSON.parse(localStorage.getItem('activeUserObj'));
    const creatorDisplay = user.displayName || user.cnName || user.enName;

    const initialHistory = [{
        action: 'create',
        operator: `${creatorDisplay} (需求方)`,
        time: new Date().toISOString(),
        reply: actionReply
    }];
    
    const taskData = {
        id: newId, title: shortTitle, full_desc: fullDesc, summary_desc: finalDesc, project: projectVal,
        due_date: dateInput, assignee: assigneeVal, link: linkInput, channels: selectedChannels,
        file_name: window.getFileNameFromUI(), file_data: currentUploadedFileData, status: finalStatus, creator: creatorDisplay,
        history_json: JSON.stringify(initialHistory) 
    };

    const { error } = await window.supabase.from(window.DB_TABLE).insert([taskData]);

    btn.innerText = originalText;
    btn.disabled = false;

    if (error) {
        return window.showAlert("写入失败", error.message, "danger");
    }

    localStorage.removeItem('myDraftTask');
    window.closeAllModals();
    
    const successOverlay = document.getElementById('success-overlay'); 
    successOverlay.classList.remove('hidden'); void successOverlay.offsetWidth; successOverlay.classList.remove('opacity-0');

    await window.loadTasksFromCloud(true);

    setTimeout(() => {
        successOverlay.classList.add('opacity-0');
        setTimeout(() => {
            successOverlay.classList.add('hidden');
            window.previewTask(newId, shortTitle, 'text-sky-400');
            document.getElementById('card-' + newId)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 300);
    }, 1000);
}

// ================= 表单输入辅助 =================
window.toggleOtherInput = function() {
    const otherCb = document.getElementById('channel-other-cb');
    const otherContainer = document.getElementById('other-channel-input-container');
    if(otherCb && otherCb.checked) {
        otherContainer.classList.remove('hidden');
        document.getElementById('req-channel-other').focus();
    } else {
        otherContainer.classList.add('hidden');
        document.getElementById('req-channel-other').value = ''; 
    }
}

window.resetUploadZone = function() {
    document.getElementById('real-file-upload').value = '';
    currentUploadedFileData = null; 
    document.getElementById('upload-text').innerHTML = `<svg id="upload-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg> 点击选择参考附件...`;
    document.getElementById('upload-text').className = "text-xs font-medium flex items-center gap-2 text-zinc-500";
    document.getElementById('upload-zone').className = "w-full bg-[#09090b] border border-zinc-700 border-dashed rounded-xl px-4 py-2.5 flex flex-col items-center justify-center cursor-pointer hover:border-indigo-500 transition-colors h-[46px]";
}

window.handleFileSelect = function(event) {
    const fileList = event.target.files;
    const uploadZone = document.getElementById('upload-zone');
    const uploadText = document.getElementById('upload-text');
    if(fileList.length > 0) {
        let file = fileList[0];
        let fileName = file.name;
        
        const maxSize = 2.5 * 1024 * 1024;
        if (file.size > maxSize) {
            window.showAlert("附件体积过大", "您选择的文件超过了 2.5MB。由于当前系统暂未接入云端图床，大文件将导致浏览器存储崩溃。\n\n建议您：\n1. 压缩图片后再上传\n2. 或者将源文件传至腾讯文档，在上方【需求参考链接】处提供 URL。", "warning");
            document.getElementById('real-file-upload').value = ''; 
            return;
        }

        const reader = new FileReader();
        reader.onload = function(e) { currentUploadedFileData = e.target.result; };
        reader.readAsDataURL(file); 
        uploadText.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg> 已选附件: <span class="font-bold truncate max-w-[120px]">${fileName}</span>`;
        uploadText.className = "text-xs font-medium flex items-center gap-1.5 text-indigo-400 w-full justify-center";
        uploadZone.className = "w-full bg-indigo-500/10 border border-indigo-500/50 rounded-xl px-4 py-2.5 flex flex-col items-center justify-center cursor-pointer transition-colors h-[46px]";
    }
}

window.getFileNameFromUI = function() {
    const uploadTextEl = document.getElementById('upload-text');
    if(uploadTextEl && uploadTextEl.innerText.includes('已选附件:')) { return uploadTextEl.innerText.split('已选附件:')[1].trim(); }
    return '';
}

// ================= 下拉选项与人员配置 =================
const PROJECT_LIST = [
    "Smart文化-OpenTalk", "Smart文化-1024", "Smart文化-后勤小管家", "Smart文化-小蓝书运营", "Smart文化-送物机器人",
    "荣誉体系-即时激励", "荣誉体系-荣誉奖项", "荣誉体系-AI奖项", "荣誉体系-最佳拍档", "荣誉体系-科技合作社", "荣誉体系-极客团",
    "年度大会-武汉", "年度大会-上海", "年度大会-行庆", "HR侧相关-周年庆", "HR侧相关-初八团拜", 
    "工会相关-团建旅游", "工会相关-运动季", "工会相关-文体活动",
    "常规活动-新人入职", "常规活动-科技合规银监人行类支持", "常规活动-年决", "常规活动-管理团队活动", "常规活动-外籍员工支持",
    "品宣支持", "科技子支持", "行品宣设计对接", 
    "部门-基科", "部门-数业", "部门-贷款", "部门-存款", "部门-企同", "部门-财富", "部门-政科", "部门-数发", "部门-安全", "部门-上海", "部门-武汉", "部门-成都", "部门-科管"
];
const PREDEFINED_ASSIGNEES = ['anckyyu', 'davidxxu', 'debbiehuang', 'evazzhu', 'hscheng', 'mengmengli', 'skylerhuang', 'sophiachen', 'tiaouyang', 'v_lijuangchen', 'v_lucui', 'v_sijieli', 'v_siyifu', 'v_sjtian', 'v_wbchye', 'v_wbjgao', 'v_wbmtli', 'v_zqlan', 'wenjiawu', 'yamyzhang', 'yaozhong', 'yoshyliu', 'zoeyzhou'];
let finalAssigneeList = [...PREDEFINED_ASSIGNEES].sort();

window.showProjectDropdown = function() { document.getElementById('project-dropdown').classList.remove('hidden'); window.renderProjects(document.getElementById('req-project').value); document.getElementById('assignee-dropdown').classList.add('hidden'); }
window.filterProjectDropdown = function() { window.renderProjects(document.getElementById('req-project').value); }
window.renderProjects = function(filterText = '') {
    const listEl = document.getElementById('project-dropdown-list');
    let filtered = PROJECT_LIST.filter(p => p.toLowerCase().includes(filterText.toLowerCase()));
    let html = '';
    if(filtered.length === 0) { html = `<div class="px-4 py-3 text-[13px] text-zinc-500 cursor-default">将直接使用您的手写输入 "${filterText}"</div>`; } 
    else { filtered.forEach(p => { html += `<div class="px-4 py-2.5 text-[13px] text-zinc-300 hover:bg-indigo-500/20 hover:text-indigo-300 cursor-pointer transition-colors" onmousedown="selectProject('${p}')">${p}</div>`; }); }
    listEl.innerHTML = html;
}
window.selectProject = function(val) { document.getElementById('req-project').value = val; document.getElementById('project-dropdown').classList.add('hidden'); }

window.showAssigneeDropdown = function() { document.getElementById('assignee-dropdown').classList.remove('hidden'); window.renderAssignees(''); document.getElementById('project-dropdown').classList.add('hidden'); }
window.filterAssigneeDropdown = function() { window.renderAssignees(document.getElementById('req-assignee-input').value); document.getElementById('assignee-dropdown').classList.remove('hidden'); }
window.renderAssignees = function(filterText = '') {
    const listEl = document.getElementById('assignee-dropdown-list');
    if(!listEl) return;
    let filtered = finalAssigneeList.filter(name => name.toLowerCase().includes(filterText.toLowerCase()));
    let html = '';
    if ('不指定 (系统统筹)'.includes(filterText)) { html += `<div class="px-4 py-3 text-[13px] text-zinc-300 hover:bg-indigo-500/20 hover:text-indigo-300 cursor-pointer transition-colors border-b border-zinc-800" onmousedown="selectAssignee('none', '不指定 (系统统筹)')">不指定 (系统统筹)</div>`; }
    if (filtered.length === 0 && !('不指定 (系统统筹)'.includes(filterText))) { html += `<div class="px-4 py-3 text-[13px] text-zinc-500 cursor-default">不在限定的执行人名单中</div>`; } 
    else { filtered.forEach(name => { html += `<div class="px-4 py-2.5 text-[13px] text-zinc-300 hover:bg-indigo-500/20 hover:text-indigo-300 cursor-pointer transition-colors" onmousedown="selectAssignee('${name}', '${name}')">${name}</div>`; }); }
    listEl.innerHTML = html;
}
window.selectAssignee = function(val, text) { document.getElementById('req-assignee').value = val; document.getElementById('req-assignee-input').value = text; document.getElementById('assignee-dropdown').classList.add('hidden'); }
window.validateAssigneeInput = function() {
    setTimeout(() => {
        const inputVal = document.getElementById('req-assignee-input').value.trim();
        const hiddenVal = document.getElementById('req-assignee').value;
        if (inputVal === '' || inputVal === '不指定 (系统统筹)') { window.selectAssignee('none', '不指定 (系统统筹)'); return; }
        const matchedName = finalAssigneeList.find(n => n.toLowerCase() === inputVal.toLowerCase());
        if (matchedName) { window.selectAssignee(matchedName, matchedName); } 
        else { const prevVal = hiddenVal === 'none' ? '不指定 (系统统筹)' : hiddenVal; document.getElementById('req-assignee-input').value = prevVal; }
    }, 150); 
}

window.loadAssigneesFromCloud = async function() {
    finalAssigneeList = [...PREDEFINED_ASSIGNEES].sort();
}

// ================= 生命周期加载 =================
document.addEventListener('DOMContentLoaded', () => {
    if(window.initRBAC()) {
        window.loadAssigneesFromCloud();
        
        const idBtn = document.getElementById('identityBtn');
        const idMenu = document.getElementById('identityMenu');
        if(idBtn && idMenu) idBtn.addEventListener('click', (e) => { e.stopPropagation(); idMenu.classList.toggle('hidden'); });
        
        const notifBtn = document.getElementById('notifBtn');
        const notifMenu = document.getElementById('notifMenu');
        if(notifBtn && notifMenu) notifBtn.addEventListener('click', (e) => { e.stopPropagation(); notifMenu.classList.toggle('hidden'); });

        document.addEventListener('click', (e) => { 
            if(idMenu && !idMenu.contains(e.target)) idMenu.classList.add('hidden'); 
            if(notifMenu && !notifMenu.contains(e.target)) notifMenu.classList.add('hidden'); 
            const projWrap = document.getElementById('project-wrapper');
            const projDrop = document.getElementById('project-dropdown');
            if (projWrap && projDrop && !projWrap.contains(e.target)) projDrop.classList.add('hidden');
            const assWrap = document.getElementById('assignee-wrapper');
            const assDrop = document.getElementById('assignee-dropdown');
            if (assWrap && assDrop && !assWrap.contains(e.target)) assDrop.classList.add('hidden');
        });

        // 启动全局渲染和通知引擎
        setInterval(() => { window.loadTasksFromCloud(true); }, 8000); 
    }
});
