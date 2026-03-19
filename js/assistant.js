window.PAGE_TYPE = 'design'; 

// ================= 系统鉴权与环境初始化 =================
window.updateGreeting = function(user) {
    const hour = new Date().getHours();
    let timeStr = '晚上好';
    if (hour >= 5 && hour < 12) timeStr = '上午好';
    else if (hour >= 12 && hour < 18) timeStr = '下午好';
    const display = user.displayName || user.cnName || user.enName;
    const greetingEl = document.getElementById('header-greeting');
    if(greetingEl) greetingEl.innerHTML = `${timeStr}，${display}。 
        <span class="bg-orange-500/20 text-orange-400 text-[11px] px-2.5 py-0.5 rounded-lg border border-orange-500/30 ml-2">设计看板</span>
        <div id="sync-indicator" class="hidden w-2 h-2 rounded-full bg-emerald-500 animate-pulse ml-3" title="云端监听中..."></div>
    `;
}

window.initRBAC = function() {
    const userStr = localStorage.getItem('activeUserObj');
    if (!userStr) { window.location.href = 'login.html'; return false; }
    const user = JSON.parse(userStr);
    const enName = user.enName ? user.enName.toLowerCase() : '';

    if (!(user.perms || []).includes(window.PAGE_TYPE)) {
        window.showAlert("权限拦截", "您没有执行层做图权限，为您退回大厅。", "danger");
        setTimeout(()=> window.location.href = 'index.html', 1500);
        return false;
    }

    const avatarEl = document.getElementById('sidebar-avatar');
    if(avatarEl) { avatarEl.innerText = user.avatar || '?'; avatarEl.className = `w-9 h-9 rounded-full ${user.color || 'bg-orange-600'} border border-zinc-700 flex items-center justify-center text-white font-bold text-sm shadow-lg shrink-0`; }
    const nameEl = document.getElementById('sidebar-name');
    if(nameEl) nameEl.innerText = user.displayName || user.cnName || user.enName;
    const roleEl = document.getElementById('sidebar-role');
    if(roleEl) roleEl.innerHTML = `<span class="text-orange-400 font-bold">当前视角: 设计方</span>`;
    
    window.updateGreeting(user);

    const menuContainer = document.getElementById('dynamic-identity-list');
    if (menuContainer) {
        let html = '';
        if ((user.perms || []).includes('req')) { 
            html += `<div class="flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-white/5 text-zinc-400 hover:text-white cursor-pointer btn-press transition-colors" onclick="window.location.href='index.html'"><div class="w-7 h-7 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-400"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg></div><span class="text-[13px] font-medium">需求方 (去发单/验收)</span></div>`; 
        }
        if ((user.perms || []).includes('design')) { 
            html += `<div class="flex items-center gap-3 px-3 py-3 rounded-xl bg-[#362013] text-orange-400 cursor-default border border-orange-900/50"><div class="w-7 h-7 rounded-lg bg-orange-500/20 flex items-center justify-center text-orange-500"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg></div><span class="text-[13px] font-bold">设计方 (当前)</span></div>`; 
        }
        if ((user.perms || []).includes('admin')) { 
            html += `<div class="flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-white/5 text-zinc-400 hover:text-white cursor-pointer btn-press transition-colors" onclick="window.location.href='manager-workspace.html'"><div class="w-7 h-7 rounded-lg bg-fuchsia-500/10 flex items-center justify-center text-fuchsia-400"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="3" y1="9" x2="21" y2="9"></line><line x1="9" y1="21" x2="9" y2="21"></line></svg></div><span class="text-[13px] font-medium">管理方 (统筹/大盘)</span></div>`; 
        }
        menuContainer.innerHTML = html;
    }

    const triggerBtn = document.getElementById('identityBtn');
    if (triggerBtn) { triggerBtn.innerHTML = `<span class="text-orange-500 font-black flex items-center gap-1.5"><span class="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse"></span></span> 身份: 设计方 (当前) <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="text-zinc-500 ml-1"><polyline points="6 9 12 15 18 9"></polyline></svg>`; }

    return user;
}

window.kanbanUrge = function(e, btn, assignee) {
    e.stopPropagation();
    btn.innerHTML = '✓ 已提醒';
    btn.classList.remove('hover:bg-zinc-700', 'bg-zinc-800', 'text-zinc-300', 'border-zinc-600', 'hover:text-white');
    btn.classList.add('opacity-50', 'cursor-not-allowed', 'bg-zinc-900', 'text-zinc-500', 'border-zinc-800');
    btn.disabled = true;
    window.showToast('催办已发送', `已向 ${assignee} 发送系统提醒。`, 'success');
}

// ================= 看板渲染引擎 =================
window.createKanbanCard = function(task, currentUser) {
    const currentUserEn = currentUser.enName ? currentUser.enName.toLowerCase() : '';
    const taskAssignee = task.assignee ? task.assignee.toLowerCase() : 'none';
    
    const isSuperAdmin = currentUserEn === 'davidxxu' || currentUserEn === 'judyzzhang';
    const isMyDesignTask = taskAssignee === currentUserEn;
    const isUnassignedPool = taskAssignee === 'none'; 
    let isJudy = currentUserEn === 'judyzzhang';
    
    if (!isSuperAdmin && !isMyDesignTask && !(isUnassignedPool && task.status === 'pending')) return null;

    let laneId = '';
    let sColor = '', sText = '', strokeColor = '';
    
    switch(task.status) {
        case 'pending':
        case 'pending_accept':
            laneId = 'lane-pending';
            sColor = 'text-sky-400'; 
            sText = task.status === 'pending' ? '待分配/认领' : '待确认接单';
            strokeColor = 'sky';
            break;
        case 'processing':
        case 'rejected':
            laneId = 'lane-processing';
            sColor = task.status === 'rejected' ? 'text-rose-500' : 'text-orange-500';
            sText = task.status === 'rejected' ? '被驳回重画' : '设计制作中';
            strokeColor = task.status === 'rejected' ? 'rose' : 'orange';
            break;
        case 'pending_approval':
            laneId = 'lane-blocked';
            sColor = 'text-amber-500'; 
            sText = '领导审批中';
            strokeColor = 'amber';
            break;
        case 'reviewing':
            laneId = 'lane-review';
            sColor = 'text-emerald-500'; 
            sText = '待甲方验收';
            strokeColor = 'emerald';
            break;
        case 'completed':
        case 'archived':
        case 'terminated':
            laneId = 'lane-completed';
            sColor = 'text-zinc-500';
            sText = task.status === 'terminated' ? '已强行终止' : '已验收完结';
            strokeColor = 'zinc';
            break;
        default:
            return null; 
    }

    const targetUrl = `task-detail-designer.html?id=${task.id}`;
    let isUrgent = false;
    if(task.due_date && !['completed','archived','terminated'].includes(task.status)) {
        const due = new Date(task.due_date);
        const today = new Date();
        due.setHours(0,0,0,0); today.setHours(0,0,0,0);
        const diffDays = (due - today) / (1000 * 60 * 60 * 24);
        if(diffDays <= 2 && diffDays >= -999) isUrgent = true;
    }

    const borderColBase = isUrgent ? 'rgba(225,29,72,0.6)' : sColor.replace('text-', 'rgba(').replace('sky','56,189,248').replace('amber','251,191,36').replace('emerald','16,185,129').replace('rose','244,63,94').replace('orange','249,115,22').replace('zinc','113,113,122') + ',0.3)';
    const breatheClass = isUrgent ? 'breathe-rose' : '';
    const isFinished = ['completed','archived','terminated'].includes(task.status);
    const iconHtml = (task.status === 'reviewing' || task.status === 'rejected' || isFinished) ? '' : `<svg class="animate-spin h-3.5 w-3.5 ${sColor}" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>`;

    let primaryBtnText = '查看进度详情';
    let primaryBtnClass = 'bg-[#0284c7] hover:bg-sky-500 text-white border border-transparent';
    let primaryBtnAction = `event.stopPropagation(); window.location.href='${targetUrl}'`;

    if (isFinished) {
        primaryBtnText = '查看留档快照';
        primaryBtnClass = 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border-zinc-700';
    } else if (isMyDesignTask || (isUnassignedPool && task.status === 'pending')) {
        if (task.status === 'pending' || task.status === 'pending_accept') {
            primaryBtnText = '去接单并响应';
        } else if (task.status === 'processing' || task.status === 'rejected') {
            primaryBtnText = '去处理并传稿';
            primaryBtnClass = 'bg-orange-600 hover:bg-orange-500 text-white border-transparent';
        } else if (task.status === 'pending_approval') {
            primaryBtnText = '查看被锁进度';
            primaryBtnClass = 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border-zinc-700';
        } else if (task.status === 'reviewing') {
            primaryBtnText = '查看验收进度';
            primaryBtnClass = 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border-zinc-700';
        }
    } else {
        if (task.status === 'pending_accept') {
            primaryBtnText = `提醒 ${task.assignee} 接单`;
            primaryBtnClass = 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border-zinc-600 hover:text-white';
            primaryBtnAction = `window.kanbanUrge(event, this, '${task.assignee}')`;
        } else if (task.status === 'processing' || task.status === 'rejected') {
            primaryBtnText = `提醒 ${task.assignee} 交方案`;
            primaryBtnClass = 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border-zinc-600 hover:text-white';
            primaryBtnAction = `window.kanbanUrge(event, this, '${task.assignee}')`;
        } else if (task.status === 'pending_approval') {
            if (isJudy) {
                primaryBtnText = '去审批框架方案';
                primaryBtnClass = 'bg-amber-600 hover:bg-amber-500 text-white border-amber-500';
                primaryBtnAction = `event.stopPropagation(); window.location.href='task-detail-locked.html?id=${task.id}'`;
            } else {
                primaryBtnText = '等待领导审批';
                primaryBtnClass = 'bg-zinc-800 text-zinc-500 border-zinc-700 cursor-not-allowed';
                primaryBtnAction = `event.stopPropagation();`;
            }
        } else if (task.status === 'reviewing') {
            primaryBtnText = '等待甲方验收';
            primaryBtnClass = 'bg-zinc-800 text-zinc-500 border-zinc-700 cursor-not-allowed';
            primaryBtnAction = `event.stopPropagation();`;
        }
    }

    const canTransfer = !isFinished && (task.status === 'pending_accept' || task.status === 'processing' || task.status === 'rejected') && (isMyDesignTask || isSuperAdmin);
    
    let btnHtml = `
        <div class="flex items-center gap-2 mt-4 relative z-10 pl-2">
            <button onclick="${primaryBtnAction}" class="flex-1 py-2.5 rounded-lg text-[13px] font-bold transition-all btn-press border ${primaryBtnClass}">${primaryBtnText}</button>
            ${canTransfer ? `<button onclick="event.stopPropagation(); window.openTransferModal('${task.id}', '${task.title}')" class="px-5 py-2.5 rounded-lg text-[13px] font-bold text-zinc-300 bg-transparent border border-zinc-600 hover:text-white hover:bg-zinc-700 transition-all btn-press">转单</button>` : ''}
        </div>
    `;

    if (!strokeColor) strokeColor = sColor.split('-')[1] || 'sky';
    if(strokeColor === 'zinc') strokeColor = 'gray';

    const html = `
        <div class="rounded-xl p-4 kanban-card flex flex-col relative overflow-hidden bg-[#18181b] border border-zinc-800 group ${breatheClass} ${isFinished ? 'opacity-60' : ''}" onclick="window.location.href='${targetUrl}'" style="border-color: ${borderColBase}">
            <div class="absolute left-0 top-0 bottom-0 w-1.5 bg-${strokeColor}-500 z-10 shadow-[0_0_8px_rgba(var(--tw-colors-${strokeColor}-500),0.5)]"></div>
            ${isUrgent ? '<div class="absolute top-0 right-0 bg-[#e11d48] text-white text-[11px] font-bold px-3 py-1 rounded-bl-xl z-20 shadow-md animate-pulse">临期预警</div>' : ''}
            
            <div class="flex items-center justify-between mb-3 mt-1 relative z-10 pl-2">
                <div class="flex gap-2 items-center">
                    <span class="font-mono text-[11px] font-black ${sColor} bg-${strokeColor}-500/10 px-2 py-0.5 rounded border border-${strokeColor}-500/20">${task.id}</span>
                    <span class="text-[12px] ${sColor} font-bold tracking-wide flex items-center gap-1.5">${iconHtml} ${sText}</span>
                </div>
            </div>
            
            <h4 class="text-[16px] font-bold text-white mb-2 relative z-10 pl-2 leading-snug group-hover:text-${strokeColor}-400 transition-colors">${task.title}</h4>
            ${task.summary_desc ? `<p class="text-[13px] text-zinc-400 mb-3 line-clamp-2 relative z-10 pl-2">${task.summary_desc}</p>` : ''}
            
            <div class="bg-[#27272a]/50 rounded-xl p-3.5 mt-1 space-y-2.5 relative z-10 ml-2">
                <p class="text-[12px] text-zinc-400 flex items-center gap-2"><span class="w-1.5 h-1.5 rounded-full bg-zinc-500"></span> 发起人: <span class="text-white font-bold">${task.creator || '未知'}</span></p>
                <p class="text-[12px] text-zinc-400 flex items-center gap-2"><span class="w-1.5 h-1.5 rounded-full bg-[#0ea5e9]"></span> 期望交付: <span class="${isUrgent ? 'text-[#f43f5e]' : 'text-[#f43f5e]'} font-bold">${task.due_date || '未定'}</span></p>
            </div>
            
            ${btnHtml}
        </div>
    `;

    return { laneId, html };
}

window.loadTasksFromCloud = async function(isSilent = false) {
    if(!window.supabase) return;
    const userStr = localStorage.getItem('activeUserObj');
    const currentUser = userStr ? JSON.parse(userStr) : null;
    if(!currentUser) return;
    const currentUserEn = currentUser.enName ? currentUser.enName.toLowerCase() : '';
    
    const syncDot = document.getElementById('sync-indicator');
    if(syncDot && isSilent) syncDot.classList.remove('hidden');

    try {
        const { data, error } = await window.supabase.from(window.DB_TABLE).select(window.LIGHT_FIELDS)
            .order('created_at', { ascending: false }).limit(100);

        if(error) throw error;

        const lanes = {
            'lane-pending': document.getElementById('lane-pending'),
            'lane-processing': document.getElementById('lane-processing'),
            'lane-blocked': document.getElementById('lane-blocked'),
            'lane-review': document.getElementById('lane-review'),
            'lane-completed': document.getElementById('lane-completed')
        };
        
        if(!isSilent) {
            Object.values(lanes).forEach(lane => { if(lane) lane.innerHTML = ''; });
        }

        let myTodoCount = 0;
        let myRejectedCount = 0;
        let myMonthCompletedCount = 0;
        const now = new Date();

        (data || []).forEach(task => {
            const taskAssignee = task.assignee ? task.assignee.toLowerCase() : 'none';
            const isMyDesignTask = taskAssignee === currentUserEn;
            
            if (isMyDesignTask) {
                if (!['completed', 'archived', 'terminated'].includes(task.status)) {
                    myTodoCount++;
                }
                if (task.status === 'rejected') {
                    myRejectedCount++;
                }
                if (['completed', 'archived'].includes(task.status)) {
                    let completeDateStr = task.created_at;
                    try {
                        let historyArr = JSON.parse(task.history_json || '[]');
                        if (historyArr.length > 0) completeDateStr = historyArr[historyArr.length-1].time || historyArr[historyArr.length-1].created_at || completeDateStr;
                    }catch(e){}
                    const cDate = new Date(completeDateStr);
                    if (cDate.getFullYear() === now.getFullYear() && cDate.getMonth() === now.getMonth()) {
                        myMonthCompletedCount++;
                    }
                }
            }

            if(!isSilent) {
                const cardData = window.createKanbanCard(task, currentUser);
                if(cardData && lanes[cardData.laneId]) {
                    lanes[cardData.laneId].insertAdjacentHTML('beforeend', cardData.html);
                }
            }
        });

        if(!isSilent) {
            document.getElementById('metric-todo').innerHTML = `${myTodoCount} <span class="text-[11px] text-zinc-600 font-normal ml-1 font-sans">单</span>`;
            document.getElementById('metric-rejected').innerHTML = `${myRejectedCount} <span class="text-[11px] text-zinc-600 font-normal ml-1 font-sans">单</span>`;
            document.getElementById('metric-completed').innerHTML = `${myMonthCompletedCount} <span class="text-[11px] text-zinc-600 font-normal ml-1 font-sans">单</span>`;

            Object.values(lanes).forEach(lane => {
                if(lane && lane.innerHTML === '') {
                    lane.innerHTML = `<div class="text-center py-10 opacity-50"><div class="w-10 h-10 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-2 text-zinc-600"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg></div><p class="text-[11px] text-zinc-600">本列暂无任务</p></div>`;
                }
            });
        }

        // 调用 common.js 里的消息雷达引擎
        if(window.syncNotificationsFromCloud) await window.syncNotificationsFromCloud(data, isSilent);

    } catch(e) { console.error(e); } finally {
        if(syncDot) setTimeout(() => syncDot.classList.add('hidden'), 500);
    }
}

// ================= 转单逻辑 =================
window.currentTransferTaskId = null;

window.openTransferModal = function(taskId, title = '') { 
    window.currentTransferTaskId = taskId;
    const titleSpan = document.getElementById('transfer-task-name');
    if (titleSpan) titleSpan.innerText = `${taskId} ${title}`;
    const modalOverlay = document.getElementById('transfer-modal-overlay');
    const modal = document.getElementById('transfer-modal');
    modalOverlay.classList.remove('hidden'); 
    setTimeout(() => { modalOverlay.classList.remove('opacity-0'); modal.classList.remove('hidden'); modal.classList.remove('scale-95'); }, 10); 
}

window.closeTransferModal = function() { 
    const modalOverlay = document.getElementById('transfer-modal-overlay');
    const modal = document.getElementById('transfer-modal');
    modalOverlay.classList.add('opacity-0'); modal.classList.add('scale-95'); 
    setTimeout(() => { modalOverlay.classList.add('hidden'); modal.classList.add('hidden'); window.currentTransferTaskId = null; }, 300); 
}

window.submitTransfer = async function() { 
    if (!window.supabase) return window.showAlert("错误", "云端未连接", "danger");
    if (!window.currentTransferTaskId) return;

    const reason = document.getElementById('transfer-reason').value.trim();
    if(!reason) return window.showAlert("提示", "请填写转单原因", "danger");

    const btn = document.querySelector('#transfer-modal button:last-child');
    const originTxt = btn.innerText;
    btn.innerText = '正在转单...'; btn.disabled = true;

    const userStr = localStorage.getItem('activeUserObj');
    const user = JSON.parse(userStr);
    const dispName = user.displayName || user.cnName || user.enName;

    const { data: curTask } = await window.supabase.from(window.DB_TABLE).select('history_json').eq('id', window.currentTransferTaskId).single();
    let hist = [];
    if(curTask && curTask.history_json) { try { hist = JSON.parse(curTask.history_json); } catch(e){} }
    hist.push({
        action: 'transfer', operator: `${dispName} (设计师)`, time: new Date().toISOString(),
        reply: `因排期或其他原因转出，备注：${reason}`
    });

    const { error } = await window.supabase.from(window.DB_TABLE)
        .update({ 
            status: 'pending', 
            assignee: 'none', 
            summary_desc: `设计方已将单据退回公海：${reason}`,
            history_json: JSON.stringify(hist)
        })
        .eq('id', window.currentTransferTaskId);

    btn.innerText = originTxt; btn.disabled = false;

    if(error) return window.showAlert("错误", "转单失败: " + error.message, "danger");

    window.closeTransferModal(); 
    window.showToast('转单成功', '任务已退回统筹池等待重新分配', 'success');
    
    setTimeout(async () => { await window.loadTasksFromCloud(); }, 800);
}