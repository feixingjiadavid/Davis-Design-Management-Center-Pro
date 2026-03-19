window.PAGE_TYPE = 'admin'; 

// ================= 系统鉴权与环境初始化 =================
window.initRBAC = function() {
    const userStr = localStorage.getItem('activeUserObj');
    if (!userStr) { window.location.href = 'login.html'; return false; }
    const user = JSON.parse(userStr);

    if (!(user.perms || []).includes(window.PAGE_TYPE)) {
        window.showAlert("权限拦截", "您没有总监控制台访问权限，为您退回大厅。", "danger");
        setTimeout(()=> window.location.href = 'index.html', 1500);
        return false;
    }

    const avatarEl = document.getElementById('sidebar-avatar');
    if(avatarEl) { avatarEl.innerText = user.avatar || '?'; avatarEl.className = `w-9 h-9 rounded-full ${user.color || 'bg-fuchsia-600'} border border-zinc-700 flex items-center justify-center text-white font-bold text-sm shadow-lg shrink-0`; }
    const nameEl = document.getElementById('sidebar-name');
    if(nameEl) nameEl.innerText = user.displayName || user.cnName || user.enName;
    const roleEl = document.getElementById('sidebar-role');
    if(roleEl) roleEl.innerHTML = `<span class="text-fuchsia-400 font-bold">当前视角: 管理方</span>`;
    
    const menuContainer = document.getElementById('dynamic-identity-list');
    if (menuContainer) {
        let html = '';
        if ((user.perms || []).includes('req')) { 
            html += `<div class="flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-white/5 text-zinc-400 hover:text-white cursor-pointer btn-press transition-colors" onclick="window.location.href='index.html'"><div class="w-7 h-7 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-400"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg></div><span class="text-[13px] font-medium">需求方 (去发单/验收)</span></div>`; 
        }
        if ((user.perms || []).includes('design')) { 
            html += `<div class="flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-white/5 text-zinc-400 hover:text-white cursor-pointer btn-press transition-colors" onclick="window.location.href='assistant-workspace.html'"><div class="w-7 h-7 rounded-lg bg-orange-500/10 flex items-center justify-center text-orange-500"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg></div><span class="text-[13px] font-medium">设计方 (执行看板)</span></div>`; 
        }
        if ((user.perms || []).includes('admin')) { 
            html += `<div class="flex items-center gap-3 px-3 py-3 rounded-xl bg-[#3b1740] text-fuchsia-400 cursor-default border border-fuchsia-900/50"><div class="w-7 h-7 rounded-lg bg-fuchsia-500/20 flex items-center justify-center text-fuchsia-500"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="3" y1="9" x2="21" y2="9"></line><line x1="9" y1="21" x2="9" y2="9"></line></svg></div><span class="text-[13px] font-bold">管理方 (当前)</span></div>`; 
        }
        menuContainer.innerHTML = html;
    }

    const triggerBtn = document.getElementById('identityBtn');
    if (triggerBtn) { triggerBtn.innerHTML = `<span class="text-fuchsia-500 font-black flex items-center gap-1.5"><span class="w-1.5 h-1.5 rounded-full bg-fuchsia-500 animate-pulse"></span></span> 身份: 管理方 (当前) <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="text-zinc-500 ml-1"><polyline points="6 9 12 15 18 9"></polyline></svg>`; }

    return user;
}

// ================= 💡 核心：全局数据引擎 (直连云端资源池) =================
window.loadDashboardData = async function(isSilent = false) {
    if(!window.initRBAC()) return;
    if(!window.supabase) return;

    const syncDot = document.getElementById('sync-indicator');
    if(syncDot && isSilent) syncDot.classList.remove('hidden');

    try {
        // 1. 获取全量流转中工单
        const { data: tasks, error } = await window.supabase.from(window.DB_TABLE).select('id, title, status, creator, assignee, due_date, history_json').order('created_at', { ascending: false });
        if (error) throw error;

        const ongoingTasks = (tasks || []).filter(t => !['completed', 'archived', 'terminated'].includes(t.status));
        const pendingTasks = ongoingTasks.filter(t => ['pending', 'pending_accept', 'pending_approval', 'reviewing'].includes(t.status));

        // 2. 动态抓取真实设计师名单
        let designersMap = {};

        try {
            const { data: users } = await window.supabase.from('user_profiles').select('en_name, cn_name, display_name, role, perms');
            if (users) {
                users.filter(u => u.perms && u.perms.includes('design')).forEach(u => {
                    const key = u.en_name.toLowerCase();
                    if(!designersMap[key]) {
                        designersMap[key] = { 
                            display: u.display_name || u.cn_name || u.en_name, 
                            count: 0, 
                            hours: 0 
                        };
                    }
                });
            }
        } catch(e){}

        // 3. 渲染左侧：已分派流转中工单
        if(!isSilent) {
            document.getElementById('stat-ongoing').innerText = ongoingTasks.length;
            document.getElementById('stat-pending').innerText = pendingTasks.length;
            
            const tasksC = document.getElementById('tasks-container');
            let tasksHtml = '';
            
            if (ongoingTasks.length === 0) {
                tasksHtml = `<div class="text-center py-10 opacity-50"><p class="text-zinc-500 text-sm">全盘目前无进行中的工单</p></div>`;
            } else {
                ongoingTasks.forEach(t => {
                    let sColor, sText, btnHtml;
                    switch(t.status) {
                        case 'pending': sColor = 'sky'; sText = '待接单'; btnHtml = `<button class="text-sky-400 bg-sky-500/10 px-3 py-1 rounded text-[11px] font-bold">待响应</button>`; break;
                        case 'pending_accept': sColor = 'amber'; sText = '待确认接单'; btnHtml = `<button class="text-amber-400 bg-amber-500/10 px-3 py-1 rounded text-[11px] font-bold">待接单</button>`; break;
                        case 'processing': sColor = 'orange'; sText = '制作中'; btnHtml = `<button class="text-orange-400 bg-orange-500/10 px-3 py-1 rounded text-[11px] font-bold">查看进度</button>`; break;
                        case 'pending_approval': sColor = 'amber'; sText = '框架审批中'; btnHtml = `<button onclick="event.stopPropagation(); window.location.href='task-detail-locked.html?id=${t.id}'" class="text-white bg-amber-600 hover:bg-amber-500 px-3 py-1 rounded text-[11px] font-bold transition-colors shadow-lg">去审批</button>`; break;
                        case 'reviewing': sColor = 'emerald'; sText = '待甲方验收'; btnHtml = `<button class="text-emerald-400 border border-emerald-500/30 px-3 py-1 rounded text-[11px] font-bold">甲方验收中</button>`; break;
                        case 'rejected': sColor = 'rose'; sText = '打回修改中'; btnHtml = `<button class="text-rose-400 bg-rose-500/10 px-3 py-1 rounded text-[11px] font-bold">督办催稿</button>`; break;
                        default: sColor = 'zinc'; sText = '未知状态'; btnHtml = '';
                    }

                    // 统计负荷 (跳过 pending)
                    if (t.assignee && t.assignee !== 'none' && t.status !== 'pending') {
                        const assKey = t.assignee.toLowerCase();
                        if(!designersMap[assKey]) designersMap[assKey] = { display: t.assignee, count: 0, hours: 0 };
                        designersMap[assKey].count += 1;
                        designersMap[assKey].hours += 4.5; // 预估单件负荷
                    }

                    tasksHtml += `
                    <div class="bg-[#18181b] border border-white/5 rounded-2xl p-5 hover:border-white/10 transition-colors cursor-pointer" onclick="window.location.href='task-detail-requester.html?id=${t.id}'">
                        <div class="flex justify-between items-center mb-4">
                            <div class="flex items-center gap-3">
                                <span class="text-[10px] font-mono font-bold bg-white/5 px-2 py-0.5 rounded border border-white/10 text-zinc-400">${t.id}</span>
                                <span class="text-[14px] font-bold text-white">${t.title}</span>
                            </div>
                            ${btnHtml}
                        </div>
                        <div class="flex justify-between items-center text-[12px] text-zinc-500">
                            <div class="flex items-center gap-4">
                                <span class="flex items-center gap-1.5"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg> 委派: ${t.assignee === 'none' ? '暂未分配' : t.assignee}</span>
                            </div>
                            <span>期望交付: ${t.due_date || '未定'}</span>
                        </div>
                    </div>
                    `;
                });
            }
            tasksC.innerHTML = tasksHtml;
        }

        // 4. 渲染右侧：真实资源池
        if(!isSilent) {
            const poolContainer = document.getElementById('resource-pool');
            let poolHtml = '';
            
            const sortedDesigners = Object.keys(designersMap).sort((a,b) => designersMap[b].count - designersMap[a].count);
            
            sortedDesigners.forEach(key => {
                const data = designersMap[key];
                const statusColor = data.count === 0 ? 'text-zinc-500' : (data.count > 2 ? 'text-rose-500' : 'text-emerald-500');
                const statusText = data.count === 0 ? '空闲' : (data.count > 2 ? '高负荷' : '适中');
                const opacity = data.count === 0 ? 'opacity-60' : 'opacity-100';

                poolHtml += `
                <div class="flex items-center justify-between py-3 border-b border-white/5 last:border-0 ${opacity}">
                    <div class="flex items-center gap-3">
                        <div class="w-8 h-8 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center text-[10px] font-bold text-zinc-300 shadow-inner shrink-0">${data.display.substring(0,2).toUpperCase()}</div>
                        <div>
                            <p class="text-[13px] font-bold text-zinc-200 flex items-center gap-2">${data.display} <span class="text-[10px] text-zinc-500 bg-white/5 px-1.5 rounded border border-white/10 font-normal">${data.count} 单</span></p>
                        </div>
                    </div>
                    <div class="text-right shrink-0">
                        <p class="text-[12px] font-bold ${statusColor} mb-0.5">${statusText}</p>
                        <p class="text-[10px] text-zinc-600 font-mono">${data.hours.toFixed(1)}h 预估</p>
                    </div>
                </div>
                `;
            });
            poolContainer.innerHTML = poolHtml;
        }

        const loader = document.getElementById('dashboard-loading');
        if(loader) loader.classList.add('hidden');

    } catch (err) {
        console.error(err);
    } finally {
        if(syncDot) setTimeout(() => syncDot.classList.add('hidden'), 500);
    }
}

// ================= 🔔 管理端专属：全盘监控引擎 =================
// 覆盖 common.js 中的默认通知逻辑，实现管理端独有的 "🚨 监控节点变化" UI
window.syncNotificationsFromCloud = async function() {
    if(!window.supabase) return;
    const userStr = localStorage.getItem('activeUserObj');
    if(!userStr) return;
    const currentUser = JSON.parse(userStr);

    try {
        const { data, error } = await window.supabase.from('test_tasks').select('id, creator, assignee, status, history_json').order('created_at', { ascending: false }).limit(100);
        if(error) throw error;

        let knownHistories = JSON.parse(localStorage.getItem('known_histories_admin') || '{}');
        let sysNotifs = JSON.parse(localStorage.getItem('sys_notifications') || '[]');
        let hasNew = false;

        (data || []).forEach(task => {
            let historyArr = [];
            try { historyArr = JSON.parse(task.history_json || '[]'); } catch(e){}

            const knownLen = knownHistories[task.id] || 0;
            if (historyArr.length > knownLen) {
                for(let i = knownLen; i < historyArr.length; i++) {
                    const newEvent = historyArr[i];
                    const opEnName = currentUser.enName || '';
                    const opDispName = currentUser.displayName || '';
                    // 过滤自己的操作
                    if (newEvent.operator && (newEvent.operator.includes(opEnName) || newEvent.operator.includes(opDispName))) continue;
                    
                    sysNotifs.push({
                        id: new Date().getTime() + Math.random(),
                        taskId: task.id,
                        title: `🚨 [${task.id}] 监控节点变化`,
                        desc: `${newEvent.operator || '系统'} 操作: ${newEvent.action}.`,
                        role: 'admin', 
                        read: false,
                        time: new Date().toISOString()
                    });
                    hasNew = true;
                }
                knownHistories[task.id] = historyArr.length;
            }
        });

        if (hasNew) {
            localStorage.setItem('known_histories_admin', JSON.stringify(knownHistories));
            localStorage.setItem('sys_notifications', JSON.stringify(sysNotifs));
        }
        window.loadNotifications();
    } catch(e) {}
}

window.loadNotifications = function() {
    const userStr = localStorage.getItem('activeUserObj');
    if(!userStr) return;
    
    let sysNotifs = JSON.parse(localStorage.getItem('sys_notifications') || '[]');
    let myNotifs = sysNotifs.filter(n => n.role === 'admin');
    myNotifs.sort((a, b) => b.id - a.id);

    const unreadCount = myNotifs.filter(n => !n.read).length;
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
        if (myNotifs.length === 0) {
            notifContainer.innerHTML = '<div class="px-5 py-8 text-center text-zinc-500 text-xs">全盘监控暂无异常</div>';
        } else {
            let html = '';
            myNotifs.forEach(n => {
                const dot = n.read ? '' : '<span class="w-2 h-2 rounded-full bg-rose-500 shrink-0 shadow-[0_0_8px_rgba(244,63,94,0.8)]"></span>';
                const opacity = n.read ? 'opacity-50' : '';
                const dateStr = new Date(n.time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
                html += `
                    <div class="px-5 py-4 border-b border-white/5 hover:bg-white/5 transition-colors cursor-pointer ${opacity}" onclick="window.markSingleAsRead(${n.id}, '${n.taskId}')">
                        <div class="flex justify-between items-start mb-1">
                            <h4 class="text-[13px] font-bold text-white flex items-center gap-2">${n.title} ${dot}</h4>
                            <span class="text-[10px] text-zinc-500">${dateStr}</span>
                        </div>
                        <p class="text-[11px] text-zinc-400 leading-relaxed">${n.desc}</p>
                    </div>
                `;
            });
            notifContainer.innerHTML = html;
        }
    }
}

window.markSingleAsRead = function(id, taskId) {
    let sysNotifs = JSON.parse(localStorage.getItem('sys_notifications') || '[]');
    let target = sysNotifs.find(n => n.id === id);
    if(target) { target.read = true; localStorage.setItem('sys_notifications', JSON.stringify(sysNotifs)); }
    if (taskId && taskId !== 'KANBAN') window.location.href = `task-detail-locked.html?id=${taskId}`;
    else window.loadNotifications();
}

window.markAllAsRead = function(event) {
    if(event) event.stopPropagation();
    let sysNotifs = JSON.parse(localStorage.getItem('sys_notifications') || '[]');
    sysNotifs.forEach(n => { if (n.role === 'admin') n.read = true; });
    localStorage.setItem('sys_notifications', JSON.stringify(sysNotifs));
    window.loadNotifications();
    if(window.showToast) window.showToast('监控清空', '所有未读预警已阅。', 'success');
}

// ================= 生命周期挂载 =================
document.addEventListener('DOMContentLoaded', () => {
    if(window.initRBAC()) {
        const idBtn = document.getElementById('identityBtn');
        const idMenu = document.getElementById('identityMenu');
        if(idBtn && idMenu) idBtn.addEventListener('click', (e) => { e.stopPropagation(); idMenu.classList.toggle('hidden'); });
        
        const notifBtn = document.getElementById('notifBtn');
        const notifMenu = document.getElementById('notifMenu');
        if(notifBtn && notifMenu) notifBtn.addEventListener('click', (e) => { e.stopPropagation(); notifMenu.classList.toggle('hidden'); });

        document.addEventListener('click', (e) => { 
            if(idMenu && !idMenu.contains(e.target)) idMenu.classList.add('hidden'); 
            if(notifMenu && !notifMenu.contains(e.target)) notifMenu.classList.add('hidden'); 
        });

        window.loadNotifications();
        window.loadDashboardData();
        setInterval(() => { 
            window.loadDashboardData(true); 
            window.syncNotificationsFromCloud(); 
        }, 8000);
    }
});