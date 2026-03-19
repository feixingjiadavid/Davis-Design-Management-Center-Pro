// ====== 1. 高定弹窗引擎 ======
window.closeCustomDialog = function() {
    const overlay = document.getElementById('custom-dialog-overlay');
    const dialog = document.getElementById('custom-dialog');
    if(!overlay || !dialog) return;
    overlay.classList.add('opacity-0');
    dialog.classList.add('scale-95');
    setTimeout(() => { overlay.classList.add('hidden'); }, 300);
}

window.setupDialog = function(title, message, type) {
    document.getElementById('dialog-title').innerText = title;
    document.getElementById('dialog-message').innerHTML = message;
    const colorBar = document.getElementById('dialog-color-bar');
    const icon = document.getElementById('dialog-icon');
    
    if(type === 'danger') {
        colorBar.className = 'absolute top-0 left-0 right-0 h-1 bg-rose-500';
        icon.className = 'w-8 h-8 rounded-full bg-rose-500/20 text-rose-500 flex items-center justify-center shrink-0';
        icon.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`;
    } else if(type === 'success') {
        colorBar.className = 'absolute top-0 left-0 right-0 h-1 bg-emerald-500';
        icon.className = 'w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0';
        icon.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
    } else {
        colorBar.className = 'absolute top-0 left-0 right-0 h-1 bg-indigo-500';
        icon.className = 'w-8 h-8 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center shrink-0';
        icon.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>`;
    }
}

window.showDialogUI = function() {
    const overlay = document.getElementById('custom-dialog-overlay');
    const dialog = document.getElementById('custom-dialog');
    if(!overlay || !dialog) return;
    overlay.classList.remove('hidden');
    setTimeout(() => { overlay.classList.remove('opacity-0'); dialog.classList.remove('scale-95'); }, 10);
}

window.showAlert = function(title, message, type="primary") {
    window.setupDialog(title, message, type);
    const btnContainer = document.getElementById('dialog-buttons');
    let btnColor = type === 'danger' ? 'bg-rose-600 hover:bg-rose-500' : (type === 'success' ? 'bg-emerald-600 hover:bg-emerald-500' : 'bg-indigo-600 hover:bg-indigo-500');
    btnContainer.innerHTML = `<button onclick="closeCustomDialog()" class="w-full py-2.5 ${btnColor} text-white rounded-xl text-[13px] font-bold shadow-lg transition-all btn-press">我知道了</button>`;
    window.showDialogUI();
}

window.showConfirm = function(title, message, onConfirm, type="primary") {
    window.setupDialog(title, message, type);
    const btnContainer = document.getElementById('dialog-buttons');
    let btnColor = type === 'danger' ? 'bg-rose-600 hover:bg-rose-500' : (type === 'success' ? 'bg-emerald-600 hover:bg-emerald-500' : 'bg-indigo-600 hover:bg-indigo-500');
    btnContainer.innerHTML = `
        <button onclick="closeCustomDialog()" class="flex-1 py-2.5 bg-transparent border border-zinc-700 text-zinc-400 hover:text-white rounded-xl text-[13px] font-bold transition-colors btn-press">取消</button>
        <button id="dialog-confirm-btn" class="flex-1 py-2.5 ${btnColor} text-white rounded-xl text-[13px] font-bold shadow-lg transition-all btn-press">确认执行</button>
    `;
    document.getElementById('dialog-confirm-btn').onclick = () => { window.closeCustomDialog(); onConfirm(); };
    window.showDialogUI();
}

window.showToast = function(title, desc, type = 'success') {
    const toast = document.getElementById('action-toast');
    if(!toast) return;
    document.getElementById('toast-title').innerText = title;
    document.getElementById('toast-desc').innerText = desc;
    const icon = document.getElementById('toast-icon');
    if(type === 'success') {
        icon.className = "w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0";
        icon.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
    } else if(type === 'info') {
        icon.className = "w-8 h-8 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center shrink-0";
        icon.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>`;
    } else {
        icon.className = "w-8 h-8 rounded-full bg-rose-500/20 text-rose-500 flex items-center justify-center shrink-0";
        icon.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`;
    }
    toast.classList.remove('hidden');
    setTimeout(() => { toast.classList.add('hidden'); }, 3000);
}

// ====== 2. 基础交互模块 ======
window.logout = function(e) {
    if(e) e.stopPropagation();
    localStorage.removeItem('activeUserObj'); 
    window.location.href = 'login.html'; 
}

window.openPwdModal = function() {
    const pwdOverlay = document.getElementById('pwd-modal-overlay');
    const pwdModal = document.getElementById('pwd-modal');
    if(!pwdOverlay || !pwdModal) return;
    pwdOverlay.classList.remove('hidden'); 
    setTimeout(() => { pwdOverlay.classList.remove('opacity-0'); pwdModal.classList.remove('hidden'); pwdModal.classList.remove('scale-95'); }, 10);
    document.getElementById('old-pwd').value = ''; document.getElementById('new-pwd').value = ''; document.getElementById('new-pwd-confirm').value = '';
}

window.closePwdModal = function() {
    const pwdOverlay = document.getElementById('pwd-modal-overlay');
    const pwdModal = document.getElementById('pwd-modal');
    if(!pwdOverlay || !pwdModal) return;
    pwdOverlay.classList.add('opacity-0'); pwdModal.classList.add('scale-95'); 
    setTimeout(() => { pwdOverlay.classList.add('hidden'); pwdModal.classList.add('hidden'); }, 300);
}

window.submitPwdChange = function() { 
    window.showAlert('提示', '系统演示环境暂不可自助修改密码，请联系管理员。', 'info'); 
    window.closePwdModal(); 
}

window.clearTestData = async function() {
    if(!window.supabase) return;
    window.showConfirm("清空数据", "⚠️ 警告：这将直接清空云端测试表中的所有需求数据！且不可恢复！<br><br>确定要继续吗？", async () => {
        try {
            const { error } = await window.supabase.from(window.DB_TABLE).delete().neq('id', '0');
            if (error) throw error;
            window.showToast('已清空', '云端测试数据已全部清空！', 'success');
            setTimeout(() => window.location.reload(), 1500);
        } catch(e) { window.showAlert("清理失败", e.message, "danger"); }
    }, "danger");
}

// ====== 3. 全局跨角色实时消息引擎 ======
window.syncNotificationsFromCloud = async function() {
    if(!window.supabase) return;
    const userStr = localStorage.getItem('activeUserObj');
    if(!userStr) return;
    const currentUser = JSON.parse(userStr);
    const currentUserEn = currentUser.enName ? currentUser.enName.toLowerCase() : '';
    const isLeader = currentUserEn === 'judyzzhang' || currentUserEn === 'davidxxu';
    const hasDesignPerm = (currentUser.perms || []).includes('design');

    try {
        const { data: tasks, error } = await window.supabase.from(window.DB_TABLE).select('id, title, creator, assignee, status, history_json').order('created_at', { ascending: false }).limit(200);
        if(error) throw error;

        let myUnreadNotifs = [];
        let readReceipts = JSON.parse(localStorage.getItem('read_receipts_' + currentUserEn) || '{}');
        let sysNotifs = JSON.parse(localStorage.getItem('sys_notifications') || '[]');
        let sysNotifsUpdated = false;

        (tasks || []).forEach(task => {
            const creatorStr = (task.creator || '').toLowerCase();
            const isMyCreation = creatorStr.includes((currentUser.displayName||'').toLowerCase()) || creatorStr.includes((currentUser.cnName||'').toLowerCase()) || creatorStr.includes(currentUserEn);
            const isMyAssignment = (task.assignee || '').toLowerCase() === currentUserEn;
            const isUnassigned = (task.assignee || '').toLowerCase() === 'none';
            const isConcerned = isMyCreation || isMyAssignment || isLeader || (isUnassigned && hasDesignPerm && task.status === 'pending');

            if (!isConcerned) return; 

            let historyArr = [];
            try { historyArr = JSON.parse(task.history_json || '[]'); } catch(e){}

            historyArr.forEach((h, index) => {
                const eventId = `${task.id}_${index}`; 
                
                if (readReceipts[eventId]) {
                    let existing = sysNotifs.find(n => n.eventId === eventId && n.role === window.PAGE_TYPE);
                    if (existing && !existing.read) {
                        existing.read = true;
                        sysNotifsUpdated = true;
                    }
                    return; 
                }

                const op = (h.operator || '').toLowerCase();
                if (op.includes(currentUserEn) || op.includes((currentUser.displayName||'').toLowerCase()) || op.includes((currentUser.cnName||'').toLowerCase())) {
                    readReceipts[eventId] = true;
                    return;
                }

                let actionText = h.action || '更新了状态';
                let iconDot = 'bg-sky-500';
                if(h.action === 'submit_draft') { actionText = '上传了最新设计正稿'; iconDot = 'bg-sky-500'; }
                if(h.action === 'submit_framework') { actionText = '提交了设计框架'; iconDot = 'bg-amber-500'; }
                if(h.action === 'approve_framework') { actionText = '通过了框架审批'; iconDot = 'bg-emerald-500'; }
                if(h.is_rejected || h.action === 'reject') { actionText = '打回了该需求'; iconDot = 'bg-rose-500'; }
                if(h.action === 'complete') { actionText = '验收通过并完结了工单'; iconDot = 'bg-emerald-500'; }
                if(h.action === 'transfer') { actionText = '转移了需求执行人'; iconDot = 'bg-orange-500'; }
                if(h.action === 'accept') { actionText = '已接单并开始制作'; iconDot = 'bg-sky-500'; }
                if(h.action === 'create') { actionText = '向大厅发起了新需求'; iconDot = 'bg-indigo-500'; }

                myUnreadNotifs.push({
                    eventId: eventId,
                    taskId: task.id,
                    title: `[${task.id}] ${actionText}`,
                    desc: `${h.operator || '系统'} : ${h.reply || h.desc || '请及时跟进处理'}`,
                    time: h.time || h.created_at || new Date().toISOString(),
                    iconDot: iconDot
                });

                if (!sysNotifs.find(n => n.eventId === eventId && n.role === window.PAGE_TYPE)) {
                    sysNotifs.push({
                        id: new Date().getTime() + Math.random(),
                        eventId: eventId,
                        taskId: task.id,
                        title: `[${task.id}] ${actionText}`,
                        desc: `${h.operator || '系统'} : ${h.reply || h.desc || '请及时跟进处理'}`,
                        role: window.PAGE_TYPE, 
                        read: false,
                        time: h.time || h.created_at || new Date().toISOString()
                    });
                    sysNotifsUpdated = true;
                }
            });
        });

        localStorage.setItem('read_receipts_' + currentUserEn, JSON.stringify(readReceipts));
        if (sysNotifsUpdated) {
            localStorage.setItem('sys_notifications', JSON.stringify(sysNotifs));
        }

        myUnreadNotifs.sort((a, b) => new Date(b.time) - new Date(a.time));
        window.currentUnreadNotifs = myUnreadNotifs; 
        window.renderNotificationsUI();

    } catch(e) { console.error("消息引擎同步失败:", e); }
}

window.renderNotificationsUI = function() {
    const notifs = window.currentUnreadNotifs || [];
    const unreadCount = notifs.length;
    const bellDot = document.getElementById('bell-dot');
    const notifContainer = document.getElementById('notif-list-container');

    if (bellDot) {
        if (unreadCount > 0) {
            bellDot.classList.remove('hidden', 'bg-zinc-600', 'border-transparent');
            bellDot.classList.add('bg-rose-500', 'animate-pulse', 'border-[#141417]');
        } else {
            bellDot.classList.add('hidden');
        }
    }

    if (notifContainer) {
        if (unreadCount === 0) {
            notifContainer.innerHTML = '<div class="px-5 py-8 text-center text-zinc-500 text-xs">暂无未读消息</div>';
        } else {
            let html = '';
            notifs.forEach(n => {
                const dateStr = new Date(n.time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
                html += `
                    <div class="px-5 py-4 border-b border-white/5 hover:bg-white/5 transition-colors cursor-pointer group" onclick="window.markSingleAsRead('${n.eventId}', '${n.taskId}')">
                        <div class="flex justify-between items-start mb-1">
                            <h4 class="text-[13px] font-bold text-white flex items-center gap-2 group-hover:text-indigo-400 transition-colors">
                                <span class="w-2 h-2 rounded-full ${n.iconDot} shrink-0 shadow-[0_0_8px_currentColor]"></span>
                                ${n.title}
                            </h4>
                            <span class="text-[10px] text-zinc-500">${dateStr}</span>
                        </div>
                        <p class="text-[11px] text-zinc-400 leading-relaxed pl-4 line-clamp-2">${n.desc}</p>
                    </div>
                `;
            });
            notifContainer.innerHTML = html;
        }
    }
}

window.markSingleAsRead = function(eventId, taskId) {
    const userStr = localStorage.getItem('activeUserObj');
    if(!userStr) return;
    const currentUserEn = JSON.parse(userStr).enName.toLowerCase();
    let readReceipts = JSON.parse(localStorage.getItem('read_receipts_' + currentUserEn) || '{}');
    
    readReceipts[eventId] = true;
    localStorage.setItem('read_receipts_' + currentUserEn, JSON.stringify(readReceipts));
    
    window.currentUnreadNotifs = window.currentUnreadNotifs.filter(n => n.eventId !== eventId);
    window.renderNotificationsUI(); 
    
    let targetUrl = `task-detail.html?id=${taskId}`;
    if (typeof window.PAGE_TYPE !== 'undefined') {
        if (window.PAGE_TYPE === 'req') targetUrl = `task-detail-requester.html?id=${taskId}`;
        if (window.PAGE_TYPE === 'design') targetUrl = `task-detail-designer.html?id=${taskId}`;
        if (window.PAGE_TYPE === 'admin') targetUrl = `task-detail-locked.html?id=${taskId}`;
    }
    window.location.href = targetUrl;
}

window.markAllAsRead = function(event) {
    if(event) event.stopPropagation();
    const userStr = localStorage.getItem('activeUserObj');
    if(!userStr) return;
    const currentUserEn = JSON.parse(userStr).enName.toLowerCase();
    let readReceipts = JSON.parse(localStorage.getItem('read_receipts_' + currentUserEn) || '{}');
    
    const notifs = window.currentUnreadNotifs || [];
    notifs.forEach(n => { readReceipts[n.eventId] = true; });
    
    localStorage.setItem('read_receipts_' + currentUserEn, JSON.stringify(readReceipts));
    window.currentUnreadNotifs = [];
    window.renderNotificationsUI();
    
    if(window.showToast) window.showToast('全部已读', '收件箱已清空。', 'success');
}