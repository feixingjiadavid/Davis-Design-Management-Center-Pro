window.PAGE_TYPE = 'admin'; 
let currentView = 'month'; 
let currentDate = new Date();
let myAllTasks = []; 
let allDesigners = [];
let dropdownData = []; 
let currentUserData = null;
let aiReportDataSnap = null; 

// ================= 高定弹窗引擎 =================
window.closeCustomDialog = function() {
    const overlay = document.getElementById('custom-dialog-overlay');
    const dialog = document.getElementById('custom-dialog');
    overlay.classList.add('opacity-0'); dialog.classList.add('scale-95');
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
        colorBar.className = 'absolute top-0 left-0 right-0 h-1 bg-fuchsia-500';
        icon.className = 'w-8 h-8 rounded-full bg-fuchsia-500/20 text-fuchsia-400 flex items-center justify-center shrink-0';
        icon.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>`;
    }
}

window.showDialogUI = function() {
    const overlay = document.getElementById('custom-dialog-overlay');
    const dialog = document.getElementById('custom-dialog');
    overlay.classList.remove('hidden'); setTimeout(() => { overlay.classList.remove('opacity-0'); dialog.classList.remove('scale-95'); }, 10);
}

window.showAlert = function(title, message, type="primary") {
    window.setupDialog(title, message, type);
    const btnContainer = document.getElementById('dialog-buttons');
    let btnColor = type === 'danger' ? 'bg-rose-600 hover:bg-rose-500' : (type === 'success' ? 'bg-emerald-600 hover:bg-emerald-500' : 'bg-fuchsia-600 hover:bg-fuchsia-500');
    btnContainer.innerHTML = `<button onclick="window.closeCustomDialog()" class="w-full py-2.5 ${btnColor} text-white rounded-xl text-[13px] font-bold shadow-lg transition-all btn-press">我知道了</button>`;
    window.showDialogUI();
}

window.logout = function(e) {
    if(e) e.stopPropagation();
    localStorage.removeItem('activeUserObj'); window.location.href = 'login.html'; 
}

window.openPwdModal = function() {
    const pwdOverlay = document.getElementById('pwd-modal-overlay');
    const pwdModal = document.getElementById('pwd-modal');
    pwdOverlay.classList.remove('hidden'); setTimeout(() => { pwdOverlay.classList.remove('opacity-0'); pwdModal.classList.remove('hidden'); pwdModal.classList.remove('scale-95'); }, 10);
    document.getElementById('old-pwd').value = ''; document.getElementById('new-pwd').value = ''; document.getElementById('new-pwd-confirm').value = '';
}

window.closePwdModal = function() {
    const pwdOverlay = document.getElementById('pwd-modal-overlay');
    const pwdModal = document.getElementById('pwd-modal');
    pwdOverlay.classList.add('opacity-0'); pwdModal.classList.add('scale-95'); setTimeout(() => { pwdOverlay.classList.add('hidden'); pwdModal.classList.add('hidden'); }, 300);
}

window.submitPwdChange = function() { window.showAlert('提示', '系统演示环境暂不可自助修改密码，请联系管理员。', 'info'); window.closePwdModal(); }

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
    if(document.getElementById('sidebar-name')) document.getElementById('sidebar-name').innerText = user.displayName || user.cnName || user.enName;
    if(document.getElementById('sidebar-role')) document.getElementById('sidebar-role').innerHTML = `<span class="text-fuchsia-400 font-bold">当前视角: 管理方</span>`;
    
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

    currentUserData = user;
    return user;
}

// ================= 💡 三维时间引擎 =================
window.switchView = function(view) {
    currentView = view;
    const btns = ['week', 'month', 'year'];
    btns.forEach(b => {
        const btn = document.getElementById(`btn-view-${b}`);
        if(b === view) {
            btn.className = "px-5 py-1.5 text-[13px] font-bold bg-fuchsia-500/20 text-fuchsia-400 border border-fuchsia-500/20 rounded-lg shadow-sm cursor-default";
        } else {
            btn.className = "px-5 py-1.5 text-[13px] font-medium text-zinc-400 hover:text-white transition-colors rounded-lg btn-press";
            btn.setAttribute('onclick', `window.switchView('${b}')`);
        }
    });
    const jumpBtn = document.getElementById('btn-jump-current');
    if(view === 'month') jumpBtn.innerText = '回到本月';
    else if(view === 'week') jumpBtn.innerText = '回到本周';
    else jumpBtn.innerText = '回到今年';

    document.getElementById('ai-report-content').classList.add('hidden');
    document.getElementById('ai-report-content').innerHTML = '';
    document.getElementById('ai-empty').classList.remove('hidden');

    window.updateDataAndRender();
}

function getStartOfWeek(d) {
    d = new Date(d);
    var day = d.getDay(), diff = d.getDate() - day + (day == 0 ? -6:1); 
    return new Date(d.setDate(diff));
}

window.navDate = function(step) {
    if (currentView === 'month') currentDate.setMonth(currentDate.getMonth() + step);
    else if (currentView === 'week') currentDate.setDate(currentDate.getDate() + (step * 7));
    else if (currentView === 'year') currentDate.setFullYear(currentDate.getFullYear() + step);
    window.updateDataAndRender();
}

window.jumpToCurrent = function() {
    currentDate = new Date();
    window.updateDataAndRender();
}

window.toggleDropdown = function(id) {
    const dropdown = document.getElementById(id);
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    dropdownData = [];
    if (currentView === 'month') {
        for(let i = -5; i <= 5; i++) {
            const d = new Date(year, month + i, 1);
            dropdownData.push({ text: `${d.getFullYear()}年 ${d.getMonth()+1}月`, date: d, isCurrent: i===0 });
        }
    } else if (currentView === 'week') {
        const startWeek = getStartOfWeek(currentDate);
        for(let i = -5; i <= 5; i++) {
            const d = new Date(startWeek);
            d.setDate(d.getDate() + (i * 7));
            const end = new Date(d); end.setDate(end.getDate() + 6);
            dropdownData.push({ text: `周 (${d.getMonth()+1}.${d.getDate()}-${end.getMonth()+1}.${end.getDate()})`, date: d, isCurrent: i===0 });
        }
    } else {
        for(let i = -3; i <= 3; i++) {
            const y = year + i;
            dropdownData.push({ text: `${y} 年度`, date: new Date(y, 0, 1), isCurrent: i===0 });
        }
    }
    
    let html = '<div class="py-2">';
    dropdownData.forEach((item, index) => {
        if(item.isCurrent) {
            html += `<div class="w-full text-left px-5 py-2.5 text-[14px] text-fuchsia-400 bg-fuchsia-500/10 font-bold cursor-default">${item.text} <span class="text-[10px] bg-fuchsia-500/20 px-1.5 py-0.5 rounded ml-2">当前</span></div>`;
        } else {
            html += `<button onclick="window.selectDropdownDate(${index})" class="w-full text-left px-5 py-2.5 text-[14px] text-zinc-400 hover:bg-white/5 hover:text-white transition-colors">${item.text}</button>`;
        }
    });
    dropdown.innerHTML = html + '</div>';
    
    dropdown.classList.toggle('hidden');
    if(id === 'date-dropdown') {
        setTimeout(() => { const act = dropdown.querySelector('.bg-fuchsia-500\\/10'); if(act) act.scrollIntoView({ block: 'center' }); }, 10);
    }
}

window.selectDropdownDate = function(index) {
    currentDate = dropdownData[index].date;
    document.getElementById('date-dropdown').classList.add('hidden');
    window.updateDataAndRender();
}

document.addEventListener('click', (e) => {
    const dateWrap = document.getElementById('date-selector-wrapper');
    const dateDrop = document.getElementById('date-dropdown');
    if (dateWrap && dateDrop && !dateWrap.contains(e.target)) dateDrop.classList.add('hidden');
    
    const idWrap = document.getElementById('identity-wrapper');
    const idMenu = document.getElementById('identityMenu');
    if (idWrap && idMenu && !idWrap.contains(e.target)) idMenu.classList.add('hidden');
});

// ================= 💡 核心：全量数据解析与水位表渲染 =================
window.loadDashboardData = async function() {
    if(!window.initRBAC()) return;
    if(!window.supabase) return;

    const syncDot = document.getElementById('sync-indicator');
    if(syncDot) syncDot.classList.remove('hidden');

    try {
        const { data: users } = await window.supabase.from('user_profiles').select('en_name, display_name, cn_name, perms');
        if (users) {
            allDesigners = users.filter(u => u.perms && u.perms.includes('design'));
        } else {
            allDesigners = [
                { en_name: 'davidxxu', display_name: 'Davidxxu (核心)' },
                { en_name: 'skyler', display_name: 'Skyler' },
                { en_name: 'wang', display_name: '王助理(排版)' }
            ];
        }

        const { data: tasks, error } = await window.supabase.from(window.DB_TABLE).select('id, title, project, status, creator, assignee, due_date, history_json').order('created_at', { ascending: false });
        if (error) throw error;
        myAllTasks = tasks || [];

        window.switchView('month'); 
        document.getElementById('dashboard-loading').classList.add('hidden');

    } catch (err) {
        console.error(err);
        document.getElementById('dashboard-loading').innerHTML = `<p class="text-rose-500 font-bold">数据拉取失败</p><p class="text-xs text-zinc-500">${err.message}</p>`;
    } finally {
        if(syncDot) setTimeout(() => syncDot.classList.add('hidden'), 500);
    }
}

window.updateDataAndRender = function() {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    if (currentView === 'month') {
        document.getElementById('current-date-text').innerText = `${year}年 ${month+1}月`;
        document.getElementById('stat-period-title').innerText = '本月交付吞吐量';
    } 
    else if (currentView === 'week') {
        const startWeek = getStartOfWeek(currentDate);
        const end = new Date(startWeek); end.setDate(end.getDate() + 6);
        document.getElementById('current-date-text').innerText = `${startWeek.getMonth()+1}.${startWeek.getDate()} - ${end.getMonth()+1}.${end.getDate()}`;
        document.getElementById('stat-period-title').innerText = '本周交付吞吐量';
    }
    else if (currentView === 'year') {
        document.getElementById('current-date-text').innerText = `${year} 年度`;
        document.getElementById('stat-period-title').innerText = '本年交付吞吐量';
    }

    let completedCount = 0;
    let firstPassCount = 0;
    let totalAiHours = 0;
    let overdueCount = 0;

    let designerStats = {};
    allDesigners.forEach(u => {
        const k = u.en_name.toLowerCase();
        designerStats[k] = { 
            name: u.display_name || u.cn_name || u.en_name, 
            loggedHours: 0, 
            activeTasks: 0 
        };
    });

    const today = new Date(); today.setHours(0,0,0,0);
    let projectDist = {};

    myAllTasks.forEach(t => {
        let isCompletedInPeriod = false;
        let hasReject = false;
        let tUsedAiCount = 0;

        try {
            const hist = JSON.parse(t.history_json || '[]');
            
            hist.forEach(h => {
                if(h.is_rejected || (h.action && h.action.includes('reject'))) hasReject = true;
                
                if (h.action === 'submit_draft' || h.action === 'submit_framework') {
                    const tools = h.ai_tools || [];
                    tools.forEach(tool => {
                        if (tool && tool !== '无AI辅助') { tUsedAiCount++; }
                    });
                }

                const hDate = new Date(h.created_at || h.time);
                let matchPeriod = false;
                if (currentView === 'month') matchPeriod = (hDate.getFullYear() === year && hDate.getMonth() === month);
                else if (currentView === 'year') matchPeriod = (hDate.getFullYear() === year);
                else {
                    const sw = getStartOfWeek(currentDate);
                    const ew = new Date(sw); ew.setDate(ew.getDate()+6);
                    hDate.setHours(0,0,0,0);
                    matchPeriod = (hDate >= sw && hDate <= ew);
                }

                if (matchPeriod && h.operator) {
                    let opName = h.operator.toLowerCase();
                    for (let key in designerStats) {
                        if (opName.includes(key) || opName.includes(designerStats[key].name.toLowerCase())) {
                            designerStats[key].loggedHours += (parseFloat(h.work_hours) || 0);
                            break;
                        }
                    }
                }

                if (['completed', 'archived'].includes(t.status)) {
                    if (h.action === 'complete' || h.action === 'approve_draft') {
                        const cDate = new Date(h.created_at || h.time);
                        let cMatch = false;
                        if (currentView === 'month') cMatch = (cDate.getFullYear() === year && cDate.getMonth() === month);
                        else if (currentView === 'year') cMatch = (cDate.getFullYear() === year);
                        else {
                            const sw = getStartOfWeek(currentDate);
                            const ew = new Date(sw); ew.setDate(ew.getDate()+6);
                            cDate.setHours(0,0,0,0);
                            cMatch = (cDate >= sw && cDate <= ew);
                        }
                        if(cMatch) {
                            isCompletedInPeriod = true;
                            const pName = t.project || '其他支持';
                            if (!projectDist[pName]) projectDist[pName] = 0;
                            projectDist[pName]++;
                        }
                    }
                }
            });
        } catch(e){}

        if (isCompletedInPeriod) {
            completedCount++;
            if (!hasReject) firstPassCount++;
            if (tUsedAiCount > 0) totalAiHours += (tUsedAiCount * 2.4); 
        }

        if (t.due_date) {
            const dueDate = new Date(t.due_date); dueDate.setHours(0,0,0,0);
            const isFinished = ['completed', 'archived'].includes(t.status);
            if (isFinished) {
                let endDateStr = t.created_at;
                try {
                    const hist = JSON.parse(t.history_json || '[]');
                    for(let i=hist.length-1; i>=0; i--) {
                        if(['complete', 'approve_draft'].includes(hist[i].action)) {
                            endDateStr = hist[i].created_at || hist[i].time; break;
                        }
                    }
                } catch(e){}
                const endDate = new Date(endDateStr); endDate.setHours(0,0,0,0);
                let mMatch = false;
                if (currentView === 'month') mMatch = (endDate.getFullYear() === year && endDate.getMonth() === month);
                else if (currentView === 'year') mMatch = (endDate.getFullYear() === year);
                else {
                    const sw = getStartOfWeek(currentDate); const ew = new Date(sw); ew.setDate(ew.getDate()+6);
                    mMatch = (endDate >= sw && endDate <= ew);
                }
                if (mMatch && endDate > dueDate) overdueCount++;
            } else if (!['terminated', 'rejected'].includes(t.status)) { 
                if (today > dueDate) overdueCount++;
            }
        }

        if (t.assignee && t.assignee !== 'none' && !['completed', 'archived', 'terminated', 'pending'].includes(t.status)) {
            let aKey = t.assignee.toLowerCase();
            for (let key in designerStats) {
                if (aKey.includes(key) || aKey.includes(designerStats[key].name.toLowerCase())) {
                    designerStats[key].activeTasks++;
                    break;
                }
            }
        }
    });

    document.getElementById('stat-completed').innerText = completedCount;
    
    const firstPassRate = completedCount > 0 ? Math.round((firstPassCount / completedCount) * 100) : 0;
    document.getElementById('stat-first-pass').innerText = completedCount > 0 ? `${firstPassRate}%` : '--';
    document.getElementById('stat-first-pass-desc').innerText = completedCount > 0 ? `该时段内 ${firstPassCount} 单一稿即过` : '当前周期无验收记录';
    
    document.getElementById('stat-ai-hours').innerText = totalAiHours.toFixed(1);

    document.getElementById('metric-overdue').innerText = overdueCount;
    if(overdueCount > 0) document.getElementById('card-overdue').className = 'bg-rose-500/10 border border-rose-500/40 rounded-3xl p-6 shadow-[0_0_20px_rgba(244,63,94,0.2)] relative overflow-hidden animate-pulse';
    else document.getElementById('card-overdue').className = 'bg-[#121217] border border-white/5 rounded-3xl p-6 shadow-xl relative overflow-hidden group';

    const distContainer = document.getElementById('project-dist-container');
    if (completedCount === 0) {
        distContainer.innerHTML = '<div class="text-center text-zinc-500 py-10 text-sm">当前周期无完结产出记录</div>';
    } else {
        let distHtml = '';
        const sortedProj = Object.keys(projectDist).map(k => ({ name: k, count: projectDist[k] })).sort((a,b) => b.count - a.count).slice(0,5);
        const colors = ['fuchsia', 'indigo', 'sky', 'emerald', 'orange'];

        sortedProj.forEach((p, idx) => {
            const pct = Math.round((p.count / completedCount) * 100);
            const col = colors[idx % colors.length];
            distHtml += `
            <div class="mb-4">
                <div class="flex justify-between items-end mb-1.5">
                    <h4 class="text-[13px] font-bold text-zinc-200 truncate pr-2">${p.name}</h4>
                    <div class="text-right shrink-0">
                        <span class="text-[13px] font-mono font-bold text-${col}-400">${p.count} <span class="text-[10px] text-${col}-400/60 font-sans font-normal">单</span></span>
                    </div>
                </div>
                <div class="w-full h-1.5 bg-zinc-900 rounded-full overflow-hidden">
                    <div class="h-full bg-${col}-500 rounded-full opacity-80 shadow-[0_0_10px_var(--tw-colors-${col}-500)]" style="width: ${pct}%"></div>
                </div>
            </div>`;
        });
        distContainer.innerHTML = distHtml;
    }

    const wlContainer = document.getElementById('workload-list');
    let wlHtml = '';
    
    const sortedDesigners = Object.keys(designerStats).map(k => ({ key: k, ...designerStats[k] }))
                          .sort((a,b) => {
                              if (b.activeTasks !== a.activeTasks) return b.activeTasks - a.activeTasks;
                              return b.loggedHours - a.loggedHours;
                          });

    let capacityLimit = currentView === 'week' ? 40 : (currentView === 'month' ? 160 : 1920);

    if (sortedDesigners.length === 0) {
        wlContainer.innerHTML = '<div class="text-center text-zinc-500 py-10 text-sm">系统未配置设计资源账号</div>';
    } else {
        sortedDesigners.forEach(d => {
            let fillPct = Math.min(Math.round((d.loggedHours / capacityLimit) * 100), 100);
            let statusColor = 'bg-zinc-600'; let textColor = 'text-zinc-400'; let statusTxt = '☕ 极度空闲'; let outlineCol = 'border-white/5';
            let loadScore = d.activeTasks + (d.loggedHours / 10);

            if (loadScore > 5) {
                statusColor = 'bg-rose-500 shadow-[0_0_10px_#f43f5e]'; textColor = 'text-rose-400 font-bold'; statusTxt = '🔥 严重超负荷'; outlineCol = 'border-rose-500/30';
                fillPct = Math.max(fillPct, 90);
            } else if (loadScore > 2) {
                statusColor = 'bg-amber-500 shadow-[0_0_10px_#f59e0b]'; textColor = 'text-amber-400 font-bold'; statusTxt = '⚡ 运转饱和'; outlineCol = 'border-amber-500/20';
                fillPct = Math.max(fillPct, 60);
            } else if (loadScore > 0) {
                statusColor = 'bg-emerald-500 shadow-[0_0_10px_#10b981]'; textColor = 'text-emerald-400'; statusTxt = '🟢 进度健康';
                fillPct = Math.max(fillPct, 30);
            }

            wlHtml += `
            <div class="workload-card p-4 rounded-2xl ${outlineCol} group">
                <div class="flex justify-between items-start mb-3">
                    <div class="flex items-center gap-3">
                        <div class="w-8 h-8 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center text-[10px] font-bold text-zinc-300 shadow-inner shrink-0 group-hover:scale-110 transition-transform">${d.name.substring(0,2).toUpperCase()}</div>
                        <div>
                            <p class="text-[13px] font-bold text-white mb-0.5">${d.name}</p>
                            <p class="text-[10px] ${textColor}">${statusTxt}</p>
                        </div>
                    </div>
                    <div class="text-right">
                        <p class="text-[14px] font-black text-white font-mono leading-none">${d.activeTasks} <span class="text-[10px] font-sans text-zinc-500 font-normal">单当前压单</span></p>
                        <p class="text-[10px] text-zinc-400 mt-1">本期已耗时: <span class="text-white font-bold font-mono">${d.loggedHours.toFixed(1)}</span> h</p>
                    </div>
                </div>
                <div class="w-full h-1.5 bg-zinc-900 rounded-full overflow-hidden mt-2 relative">
                    <div class="absolute left-0 top-0 bottom-0 ${statusColor} progress-bar-fill opacity-90" style="width: ${fillPct}%"></div>
                </div>
            </div>`;
        });
        wlContainer.innerHTML = wlHtml;
    }

    aiReportDataSnap = {
        period: currentView === 'month' ? `${year}年${month+1}月` : (currentView === 'year' ? `${year}年` : `本周`),
        overdue: overdueCount,
        completed: completedCount,
        firstPassRate: firstPassRate,
        designers: sortedDesigners
    };
}

// ================= 🧠 本地模拟的 Gemini 智能调度大盘分析 =================
window.triggerAIReport = function() {
    const btn = document.getElementById('btn-generate-ai');
    const loading = document.getElementById('ai-loading');
    const empty = document.getElementById('ai-empty');
    const content = document.getElementById('ai-report-content');

    btn.disabled = true;
    btn.innerHTML = `<svg class="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> 推理排期中...`;
    
    empty.classList.add('hidden');
    content.classList.add('hidden');
    loading.classList.remove('hidden');
    loading.classList.add('flex');

    setTimeout(() => {
        loading.classList.remove('flex');
        loading.classList.add('hidden');
        
        btn.disabled = false;
        btn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg> 重新获取最新洞察`;

        const snap = aiReportDataSnap;
        if(snap.designers.length === 0) {
            content.innerHTML = `<p class="text-zinc-400 text-center py-4">数据不足，无法完成智能诊断。</p>`;
            content.classList.remove('hidden');
            return;
        }

        const topBusy = snap.designers[0];
        const topIdle = snap.designers[snap.designers.length - 1];
        
        let evalText = '状态良好'; let evalCol = 'emerald';
        let adviseHtml = `
            <li>主力核心资源 <span class="text-fuchsia-400 font-bold">${topBusy.name}</span> 当前处于饱和输出状态，需注意防范疲劳引起的“一稿通过率”下降。</li>
            <li><span class="text-emerald-400 font-bold">${topIdle.name}</span> 目前排期极度空闲，建议将非核心视觉或延展排版类需求直接指派给该成员，实现团队“削峰填谷”。</li>
        `;

        if (snap.overdue > 0) {
            evalText = '存在延期风险'; evalCol = 'rose';
            adviseHtml = `
                <li><span class="text-rose-400 font-bold">高危提示：当前有 ${snap.overdue} 个项目超期。</span> <span class="text-white">${topBusy.name}</span> 已处于严重超负荷状态。</li>
                <li>紧急调度建议：立即将 ${topBusy.name} 手里未开始的延展需求平移给 <span class="text-emerald-400 font-bold">${topIdle.name}</span>，并考虑为核心项目引入外部 AI 生图助理。</li>
            `;
        }

        const reportHTML = `
            <div class="mb-4 flex items-center justify-between border-b border-fuchsia-500/20 pb-3">
                <span class="text-[12px] text-fuchsia-400 font-bold bg-fuchsia-500/10 px-2 py-1 rounded">分析时段: ${snap.period}大盘</span>
                <span class="text-[12px] font-bold text-${evalCol}-400 bg-${evalCol}-500/10 border border-${evalCol}-500/20 px-2 py-1 rounded">全盘风险评估: ${evalText}</span>
            </div>
            <div class="space-y-4 text-zinc-300">
                <p class="ai-cursor">基于全盘算力雷达检测，团队目前交付通过率为 <b>${snap.firstPassRate}%</b>。</p>
                <div class="bg-black/50 p-4 rounded-xl border border-white/5 mt-4">
                    <h4 class="text-white font-bold text-[13px] mb-2 flex items-center gap-1.5"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg> AI 调度执行指令</h4>
                    <ul class="list-disc list-inside text-[12px] space-y-2 text-zinc-400 ml-2">
                        ${adviseHtml}
                    </ul>
                </div>
            </div>
        `;

        content.innerHTML = reportHTML;
        content.classList.remove('hidden');
        
        setTimeout(() => { const c = content.querySelector('.ai-cursor'); if(c) c.classList.remove('ai-cursor'); }, 1500);

    }, 1800); 
}