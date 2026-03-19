window.PAGE_TYPE = 'req'; 
let currentView = 'month'; 
let currentDate = new Date();
let myAllTasks = []; 
let dropdownData = []; 
const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
let currentUserData = null;

// ================= 系统初始化与鉴权 =================
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
    if(document.getElementById('sidebar-name')) document.getElementById('sidebar-name').innerText = user.displayName || user.cnName || user.enName;
    if(document.getElementById('sidebar-role')) document.getElementById('sidebar-role').innerText = user.role || '系统成员';
    
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
    
    currentUserData = user;
    return user;
}

// ================= 💡 核心：拉取云端数据 =================
window.initApp = async function() {
    if(!window.initRBAC()) return;
    if(!window.supabase) return;

    const currentUserEn = currentUserData.enName ? currentUserData.enName.toLowerCase() : '';
    const cNames = [currentUserData.displayName, currentUserData.cnName, currentUserData.enName, currentUserEn].filter(Boolean).map(n => n.toLowerCase());
    const isSuperAdmin = currentUserEn === 'davidxxu' || currentUserEn === 'judyzzhang';

    try {
        const { data, error } = await window.supabase.from(window.DB_TABLE).select('*').order('due_date', { ascending: true });
        if (error) throw error;
        
        myAllTasks = (data || []).filter(t => {
            if (isSuperAdmin) return true;
            const c = (t.creator || '').toLowerCase();
            return cNames.includes(c);
        });

        if (myAllTasks.length > 0) {
            let latestTaskWithDate = [...myAllTasks].reverse().find(t => t.due_date);
            if (latestTaskWithDate) {
                const latestDateObj = new Date(latestTaskWithDate.due_date);
                if (latestDateObj.getMonth() !== currentDate.getMonth() || latestDateObj.getFullYear() !== currentDate.getFullYear()) {
                    currentDate = new Date(latestDateObj.getFullYear(), latestDateObj.getMonth(), 1);
                }
            }
        }

        window.switchView('month');
        document.getElementById('calendar-loading').classList.add('hidden');
        
        if(window.syncNotificationsFromCloud) {
            window.syncNotificationsFromCloud();
        }
    } catch (err) {
        console.error(err);
        document.getElementById('calendar-loading').innerHTML = `<p class="text-rose-500 font-bold">数据拉取失败</p><p class="text-xs text-zinc-500">${err.message}</p>`;
    } 
}

// ================= 状态解析与工具函数 =================
function parseTaskStatus(task) {
    let sColor, sText, iconHtml;
    const isFinished = ['completed','archived','terminated'].includes(task.status);
    
    switch(task.status) {
        case 'rejected': sColor = 'rose'; sText = '被打回修改'; iconHtml = `🔴`; break;
        case 'reviewing': sColor = 'emerald'; sText = '待您验收'; iconHtml = `🟢`; break;
        case 'pending_accept': sColor = 'sky'; sText = '待接单'; iconHtml = `⚪`; break;
        case 'pending_approval': sColor = 'amber'; sText = '审批框架中'; iconHtml = `🔒`; break;
        case 'processing': sColor = 'orange'; sText = '设计制作中'; iconHtml = `✍️`; break;
        case 'completed': 
        case 'archived': sColor = 'zinc'; sText = '已完结归档'; iconHtml = `✓`; break;
        case 'terminated': sColor = 'rose'; sText = '已强行终止'; iconHtml = `❌`; break;
        default: sColor = 'sky'; sText = '待排期统筹'; iconHtml = `⚪`; 
    }

    const borderStyle = isFinished ? 'border-zinc-700 bg-[#1a1a24] opacity-70' : `border-${sColor}-500/50 bg-[#1a1a24]`;
    const textStyle = isFinished ? 'text-zinc-500' : `text-${sColor}-400`;
    const tagClass = `text-${sColor}-400 bg-${sColor}-500/10 border border-${sColor}-500/20`;

    return { sColor, sText, iconHtml, borderStyle, textStyle, tagClass, isFinished };
}

function getStartOfWeek(d) {
    d = new Date(d);
    var day = d.getDay(), diff = d.getDate() - day + (day == 0 ? -6:1); 
    return new Date(d.setDate(diff));
}

function triggerWarning(text) {
    const warningPanel = document.getElementById('warning-panel');
    if(text) {
        warningPanel.classList.remove('hidden');
        document.getElementById('warning-title').innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/></svg> ${text.includes('周末') ? '周末交付预警' : '集中爆发预警'}`;
        document.getElementById('warning-desc').innerText = text.includes('周末') 
            ? '检测到本周有需求卡在周六日截止，请密切关注设计团队节假日的响应情况，避免延误。'
            : '检测到该时段需求扎堆期望交付，存在一定的排期及超期风险。';
    } else {
        warningPanel.classList.add('hidden');
    }
}

// ================= 视图控制与日期导航 =================
window.switchView = function(view) {
    currentView = view;
    
    const btns = ['week', 'month', 'year'];
    btns.forEach(b => {
        const btn = document.getElementById(`btn-view-${b}`);
        if(b === view) {
            btn.className = "px-5 py-1.5 text-[13px] font-bold bg-indigo-500/20 text-indigo-400 border border-indigo-500/20 rounded-lg shadow-sm cursor-default";
        } else {
            btn.className = "px-5 py-1.5 text-[13px] font-medium text-zinc-400 hover:text-white transition-colors rounded-lg btn-press";
            btn.setAttribute('onclick', `window.switchView('${b}')`);
        }
    });

    document.querySelectorAll('.view-section').forEach(el => el.classList.remove('active'));
    const activeSec = document.getElementById(`view-${view}`);
    if(activeSec) {
        const mainWrapper = document.getElementById('main-grid-wrapper');
        if (view === 'month') {
            mainWrapper.className = "flex-1 bg-[#121217] border border-white/5 rounded-3xl overflow-hidden shadow-2xl flex flex-col h-full min-w-0";
        } else {
            mainWrapper.className = "flex-1 bg-transparent border-none rounded-3xl overflow-hidden flex flex-col h-full min-w-0";
        }
        activeSec.classList.add('active');
    }

    const jumpBtn = document.getElementById('btn-jump-current');
    if(view === 'month') jumpBtn.innerText = '回到本月';
    else if(view === 'week') jumpBtn.innerText = '回到本周';
    else jumpBtn.innerText = '回到今年';

    window.updateDataAndRender();
    window.hideHoverCard();
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
    let html = '<div class="py-2">';
    dropdownData.forEach((item, index) => {
        if(item.isCurrent) {
            html += `<div class="w-full text-left px-5 py-2.5 text-[14px] text-indigo-400 bg-indigo-500/10 font-bold cursor-default">${item.text} <span class="text-[10px] bg-indigo-500/20 px-1.5 py-0.5 rounded ml-2">当前</span></div>`;
        } else {
            html += `<button onclick="window.selectDropdownDate(${index})" class="w-full text-left px-5 py-2.5 text-[14px] text-zinc-400 hover:bg-white/5 hover:text-white transition-colors">${item.text}</button>`;
        }
    });
    dropdown.innerHTML = html + '</div>';
    dropdown.classList.toggle('hidden');
    setTimeout(() => { const activeItem = dropdown.querySelector('.bg-indigo-500\\/10'); if(activeItem) activeItem.scrollIntoView({ block: 'center' }); }, 10);
}

window.selectDropdownDate = function(index) { 
    currentDate = dropdownData[index].date; 
    document.getElementById('date-dropdown').classList.add('hidden'); 
    window.updateDataAndRender(); 
}

// ================= 大盘数据计算与视图渲染 =================
window.updateDataAndRender = function() {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    dropdownData = [];
    if (currentView === 'month') {
        for(let i = -5; i <= 5; i++) {
            const d = new Date(year, month + i, 1);
            dropdownData.push({ text: `${d.getFullYear()}年 ${d.getMonth()+1}月`, date: d, isCurrent: i===0 });
        }
        document.getElementById('current-date-text').innerText = `${year}年 ${month+1}月`;
    } 
    else if (currentView === 'week') {
        const startWeek = getStartOfWeek(currentDate);
        for(let i = -5; i <= 5; i++) {
            const d = new Date(startWeek);
            d.setDate(d.getDate() + (i * 7));
            const end = new Date(d); end.setDate(end.getDate() + 6);
            dropdownData.push({ text: `周 (${d.getMonth()+1}.${d.getDate()}-${end.getMonth()+1}.${end.getDate()})`, date: d, isCurrent: i===0 });
        }
        const e = new Date(startWeek); e.setDate(e.getDate() + 6);
        document.getElementById('current-date-text').innerText = `${startWeek.getMonth()+1}.${startWeek.getDate()} - ${e.getMonth()+1}.${e.getDate()}`;
    }
    else if (currentView === 'year') {
        for(let i = -3; i <= 3; i++) {
            const y = year + i;
            dropdownData.push({ text: `${y} 年度`, date: new Date(y, 0, 1), isCurrent: i===0 });
        }
        document.getElementById('current-date-text').innerText = `${year} 年度`;
    }

    let tasksInView = [];
    if (currentView === 'month') tasksInView = renderMonthGrid();
    else if (currentView === 'week') tasksInView = renderWeekGrid();
    else if (currentView === 'year') tasksInView = renderYearGrid();

    updateInsights(tasksInView);
}

function updateInsights(tasks) {
    document.getElementById('stat-total').innerText = tasks.length;
    
    const completedTasks = tasks.filter(t => ['completed', 'archived'].includes(t.status));
    
    let firstPassCount = 0;
    let projectDist = {};

    completedTasks.forEach(t => {
        let hist = [];
        try { hist = JSON.parse(t.history_json || '[]'); }catch(e){}
        let rejected = hist.some(h => h.is_rejected || (h.action && h.action.includes('reject')));
        if (!rejected) firstPassCount++;
    });

    tasks.forEach(t => {
        let p = t.project || '其他未定项目';
        projectDist[p] = (projectDist[p] || 0) + 1;
    });

    let overdueCount = 0;
    const today = new Date();
    today.setHours(0,0,0,0);

    tasks.forEach(t => {
        if (!t.due_date) return;
        const dueDate = new Date(t.due_date);
        dueDate.setHours(0,0,0,0);

        const isFinished = ['completed', 'archived'].includes(t.status);
        if (isFinished) {
            let endDateStr = t.created_at;
            try {
                const hist = JSON.parse(t.history_json || '[]');
                for(let i=hist.length-1; i>=0; i--) {
                    if(['complete', 'approve_draft'].includes(hist[i].action)) {
                        endDateStr = hist[i].created_at || hist[i].time;
                        break;
                    }
                }
            } catch(e){}
            const endDate = new Date(endDateStr);
            endDate.setHours(0,0,0,0);
            if (endDate > dueDate) overdueCount++;
        } else if (!['terminated', 'rejected'].includes(t.status)) { 
            if (today > dueDate) overdueCount++;
        }
    });

    const firstPassRate = completedTasks.length > 0 ? Math.round((firstPassCount / completedTasks.length) * 100) : 0;
    document.getElementById('stat-pass-rate').innerText = completedTasks.length > 0 ? `${firstPassRate}%` : '--';
    
    const overdueEl = document.getElementById('stat-overdue');
    overdueEl.innerText = overdueCount;
    if(overdueCount > 0) { overdueEl.className = 'text-rose-500'; } else { overdueEl.className = 'text-emerald-400'; }

    const distContainer = document.getElementById('project-dist-container');
    if (tasks.length === 0) {
        distContainer.innerHTML = '<div class="text-center text-zinc-500 py-10 text-sm">当前周期无数据</div>';
    } else {
        let distHtml = '';
        const sortedProj = Object.keys(projectDist).map(k => ({ name: k, count: projectDist[k] })).sort((a,b) => b.count - a.count);
        const colors = ['indigo', 'emerald', 'sky', 'orange', 'fuchsia'];

        sortedProj.forEach((p, idx) => {
            const pct = Math.round((p.count / tasks.length) * 100);
            const col = colors[idx % colors.length];
            distHtml += `
            <div class="mb-4">
                <div class="flex justify-between items-end mb-1.5">
                    <h4 class="text-[13px] font-bold text-zinc-200">${p.name}</h4>
                    <div class="text-right">
                        <span class="text-[13px] font-mono font-bold text-${col}-400">${p.count} <span class="text-[10px] text-${col}-400/60 font-sans font-normal">单</span></span>
                    </div>
                </div>
                <div class="w-full h-1.5 bg-zinc-900 rounded-full overflow-hidden">
                    <div class="h-full bg-${col}-500 rounded-full opacity-80" style="width: ${pct}%"></div>
                </div>
            </div>`;
        });
        distContainer.innerHTML = distHtml;
    }
}

// ================= 月/周/年 视图渲染器 =================
function renderMonthGrid() {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const startingDay = firstDay.getDay(); 
    const monthLength = new Date(year, month + 1, 0).getDate();
    
    let dayData = {};
    for(let i=1; i<=monthLength; i++) dayData[i] = [];

    let tasksInView = [];
    myAllTasks.forEach(t => {
        if (t.due_date) {
            const d = new Date(t.due_date);
            if(d.getFullYear() === year && d.getMonth() === month) {
                dayData[d.getDate()].push(t);
                tasksInView.push(t);
            }
        }
    });

    const grid = document.getElementById('month-grid');
    let html = '';
    const today = new Date();
    const isCurrentMonthReal = (year === today.getFullYear() && month === today.getMonth());

    for (let i = 0; i < startingDay; i++) html += `<div class="calendar-cell muted"></div>`;

    let hasConcentration = false;
    for (let i = 1; i <= monthLength; i++) {
        const isToday = isCurrentMonthReal && i === today.getDate();
        const tasks = dayData[i];
        if (tasks.length >= 3) hasConcentration = true;
        
        let numHtml = isToday 
            ? `<div class="absolute top-0 left-0 right-0 h-0.5 bg-indigo-500"></div><span class="text-[12px] text-white font-bold bg-indigo-600 px-2 rounded-full self-end mt-1">${i} (今天)</span>` 
            : `<span class="text-[13px] font-bold text-zinc-400 self-end">${i}</span>`;
        
        let cellClass = isToday ? 'bg-indigo-900/10 border-indigo-500/20' : '';
        
        let pillsHtml = tasks.map(t => {
            const st = parseTaskStatus(t);
            return `
            <div onmouseenter="window.showHoverCard(event, '${t.id}')" onmouseleave="window.hideHoverCard()" onclick="event.stopPropagation(); window.location.href='task-detail-requester.html?id=${t.id}'" class="mt-1.5 p-2 rounded-lg border border-white/5 bg-[#16161d] transition-all shadow-sm event-pill ${st.isFinished ? 'opacity-50' : ''}">
                <div class="text-[11px] font-bold text-white mb-0.5 truncate">${t.title}</div>
                <div class="text-[10px] ${st.textStyle} flex items-center gap-1 truncate">${st.iconHtml} ${st.sText}</div>
            </div>`;
        }).join('');

        let safeTasks = encodeURIComponent(JSON.stringify(tasks));
        html += `
            <div class="calendar-cell relative ${cellClass}" onclick="window.openPeriodDetail('${year}年${month+1}月${i}日', '${safeTasks}')">
                ${numHtml}
                <div class="flex-1 overflow-y-auto custom-scrollbar mt-1 p-1">${pillsHtml}</div>
            </div>`;
    }

    const remainingCells = 42 - (startingDay + monthLength);
    for (let i = 0; i < remainingCells; i++) html += `<div class="calendar-cell muted"></div>`; 
    grid.innerHTML = html;

    document.getElementById('stat-period-title').innerText = '本月总计发单';
    triggerWarning(hasConcentration ? '本月' : null);
    return tasksInView;
}

function renderWeekGrid() {
    const startWeek = getStartOfWeek(currentDate);
    const grid = document.getElementById('week-grid');
    let html = '';
    let tasksInView = [];
    let hasWeekendTask = false;

    for(let i=0; i<7; i++) {
        let d = new Date(startWeek);
        d.setDate(d.getDate() + i);
        
        let y = d.getFullYear(), m = d.getMonth(), dateNum = d.getDate();
        const today = new Date();
        let isToday = (y === today.getFullYear() && m === today.getMonth() && dateNum === today.getDate());
        
        let tasks = myAllTasks.filter(t => {
            if(!t.due_date) return false;
            let td = new Date(t.due_date);
            return td.getFullYear() === y && td.getMonth() === m && td.getDate() === dateNum;
        });
        
        tasksInView.push(...tasks);
        if(tasks.length > 0 && (i===0 || i===6)) hasWeekendTask = true; 

        let headerHtml = isToday 
            ? `<div class="absolute top-0 left-0 right-0 h-1 bg-indigo-500"></div>
                <div class="py-4 text-center border-b border-indigo-500/20 bg-indigo-500/10">
                    <p class="text-[11px] text-indigo-400 font-bold mb-1">${weekdays[i]} (今天)</p>
                    <p class="text-[18px] text-indigo-300 font-bold font-mono">${dateNum}</p>
                </div>`
            : `<div class="py-4 text-center border-b border-white/5 bg-[#16161d]">
                    <p class="text-[11px] ${(i===0||i===6)?'text-indigo-400/50':'text-zinc-500'} font-bold mb-1">${weekdays[i]}</p>
                    <p class="text-[16px] text-zinc-400 font-mono">${dateNum}</p>
                </div>`;
                
        let cardsHtml = tasks.map(t => {
            const st = parseTaskStatus(t);
            return `
            <div onmouseenter="window.showHoverCard(event, '${t.id}')" onmouseleave="window.hideHoverCard()" onclick="event.stopPropagation(); window.location.href='task-detail-requester.html?id=${t.id}'" class="p-3 rounded-xl week-card border-l-2 ${st.borderStyle} bg-[#1a1a24] ${st.isFinished?'opacity-50':''}">
                <div class="flex justify-between items-start mb-2">
                    <span class="text-[9px] ${st.tagClass} px-1.5 py-0.5 rounded font-mono inline-block">${t.id}</span>
                    <span class="text-[10px] ${st.textStyle}">${st.iconHtml} ${st.sText}</span>
                </div>
                <p class="text-[13px] font-bold text-white leading-tight line-clamp-2 transition-colors">${t.title}</p>
            </div>`;
        }).join('');
            
        let safeTasks = encodeURIComponent(JSON.stringify(tasks));
        let bgClass = isToday ? 'bg-indigo-900/10 border-x border-indigo-500/20 relative hover:bg-indigo-900/20' : 'bg-[#0c0c0e] hover:bg-white/5 border border-white/5';
        
        html += `<div class="${bgClass} flex flex-col transition-colors rounded-2xl overflow-hidden cursor-pointer" onclick="window.openPeriodDetail('${m+1}月${dateNum}日', '${safeTasks}')">
                    ${headerHtml}
                    <div class="flex-1 p-3 space-y-3 overflow-y-auto custom-scrollbar">${cardsHtml}</div>
                    </div>`;
    }
    grid.innerHTML = html;
    document.getElementById('stat-period-title').innerText = '本周总计发单';
    triggerWarning(hasWeekendTask ? '周末' : null);
    return tasksInView;
}

function renderYearGrid() {
    const year = currentDate.getFullYear();
    const grid = document.getElementById('year-grid');
    let html = '';
    let tasksInView = [];

    for(let m=0; m<12; m++) {
        let tasks = myAllTasks.filter(t => {
            if(!t.due_date) return false;
            let td = new Date(t.due_date);
            return td.getFullYear() === year && td.getMonth() === m;
        });
        
        tasksInView.push(...tasks);
        let count = tasks.length;
        let safeTasks = encodeURIComponent(JSON.stringify(tasks));
        const today = new Date();
        let isCurrentMonth = (year === today.getFullYear() && m === today.getMonth());

        if(isCurrentMonth) {
            html += `
            <div onclick="window.openPeriodDetail('${year}年 ${m+1}月', '${safeTasks}')" class="bg-indigo-900/10 rounded-3xl p-6 month-card flex flex-col justify-between aspect-[4/3] border-indigo-500/30 shadow-[0_0_20px_rgba(99,102,241,0.1)] relative">
                <div class="absolute top-4 right-4 bg-indigo-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">本月</div>
                <h3 class="text-indigo-400 font-bold text-[18px]">${m+1} 月</h3>
                <div><p class="text-[42px] font-mono text-white font-black leading-none mb-1">${count}<span class="text-[14px] text-indigo-300 font-normal ml-1">单</span></p></div>
            </div>`;
        } else if(count > 0) {
            html += `
            <div onclick="window.openPeriodDetail('${year}年 ${m+1}月', '${safeTasks}')" class="bg-[#121217] rounded-3xl p-6 month-card flex flex-col justify-between aspect-[4/3] opacity-80">
                <h3 class="text-white font-bold text-[18px]">${m+1} 月</h3>
                <div><p class="text-[36px] font-mono text-zinc-300 font-black">${count}<span class="text-[12px] text-zinc-600 font-normal ml-1">单</span></p></div>
            </div>`;
        } else {
            html += `
            <div onclick="window.openPeriodDetail('${year}年 ${m+1}月', '[]')" class="bg-[#121217] rounded-3xl p-6 month-card flex flex-col justify-between aspect-[4/3] opacity-20">
                <h3 class="text-zinc-600 font-bold text-[18px]">${m+1} 月</h3>
            </div>`;
        }
    }
    grid.innerHTML = html;
    document.getElementById('stat-period-title').innerText = '今年总计发单';
    triggerWarning(null);
    return tasksInView;
}

// ================= 悬浮框与二级弹窗 =================
window.showHoverCard = function(e, taskId) {
    const task = myAllTasks.find(t => t.id === taskId);
    if (!task) return;

    const st = parseTaskStatus(task);
    const card = document.getElementById('hover-detail-card');
    const assignee = task.assignee === 'none' ? '待定 (系统统筹)' : task.assignee;
    const creator = task.creator || '未知';
    
    card.innerHTML = `
        <div class="flex items-center justify-between mb-3">
            <span class="text-[10px] font-mono font-bold px-2 py-0.5 rounded ${st.tagClass}">${task.id}</span>
            <span class="text-[11px] ${st.textStyle} font-bold flex items-center gap-1">${st.iconHtml} ${st.sText}</span>
        </div>
        <h4 class="text-[15px] font-bold text-white mb-4 leading-snug">${task.title}</h4>
        <div class="space-y-2.5 border-t border-white/5 pt-4">
            <div class="flex justify-between items-center text-[12px]">
                <span class="text-zinc-500">归属项目</span>
                <span class="text-zinc-200 font-medium truncate max-w-[180px]">${task.project || '--'}</span>
            </div>
            <div class="flex justify-between items-center text-[12px]">
                <span class="text-zinc-500">需求发起方</span>
                <span class="text-zinc-200 font-medium truncate max-w-[180px]">${creator}</span>
            </div>
            <div class="flex justify-between items-center text-[12px]">
                <span class="text-zinc-500">设计执行方</span>
                <span class="text-indigo-400 font-bold truncate max-w-[180px]">${assignee}</span>
            </div>
            <div class="flex justify-between items-center text-[12px]">
                <span class="text-zinc-500">期望交付日</span>
                <span class="text-zinc-200 font-mono">${task.due_date || '--'}</span>
            </div>
        </div>
    `;

    const rect = e.currentTarget.getBoundingClientRect();
    card.classList.remove('hidden');
    
    requestAnimationFrame(() => {
        const cardRect = card.getBoundingClientRect();
        let top = rect.top;
        let left = rect.right + 15; 
        
        if (left + cardRect.width > window.innerWidth) {
            left = rect.left - cardRect.width - 15; 
        }
        if (top + cardRect.height > window.innerHeight) {
            top = window.innerHeight - cardRect.height - 20; 
        }
        if (top < 20) top = 20;
        
        card.style.left = `${left}px`;
        card.style.top = `${top}px`;
        card.style.opacity = '1';
    });
};

window.hideHoverCard = function() {
    const card = document.getElementById('hover-detail-card');
    card.style.opacity = '0';
    setTimeout(() => { if(card.style.opacity === '0') card.classList.add('hidden'); }, 200); 
};

window.openPeriodDetail = function(periodTitle, tasksStr) {
    let tasks = JSON.parse(decodeURIComponent(tasksStr));
    document.getElementById('period-modal-title').innerText = periodTitle + ' 需求清单';
    const list = document.getElementById('period-modal-list');
    list.innerHTML = '';
    
    if(tasks.length === 0) {
        list.innerHTML = `<div class="text-center py-12 flex flex-col items-center opacity-50"><p class="text-zinc-400 text-[13px]">该时段您未曾发起任何需求。</p></div>`;
    } else {
        tasks.forEach(t => {
            const st = parseTaskStatus(t);
            const assignee = t.assignee === 'none' ? '待定' : t.assignee;
            const creator = t.creator || '未知';
            list.innerHTML += `
                <div onclick="window.location.href='task-detail-requester.html?id=${t.id}'" class="bg-[#1a1a24] border border-white/5 p-4 rounded-2xl hover:border-indigo-500/50 cursor-pointer transition-colors group btn-press ${st.isFinished ? 'opacity-50' : ''}">
                    <div class="flex justify-between items-center mb-3">
                        <span class="text-[10px] font-mono font-bold px-2 py-0.5 rounded ${st.tagClass}">${t.id}</span>
                        <span class="text-[11px] ${st.textStyle} font-bold">${st.iconHtml} ${st.sText}</span>
                    </div>
                    <h4 class="text-[15px] font-bold text-white mb-2 line-clamp-1">${t.title}</h4>
                    <div class="flex justify-between items-center text-[11px] text-zinc-500 bg-[#09090b] px-3 py-2 rounded-lg border border-white/5">
                        <span class="truncate">发起: ${creator}</span>
                        <span class="truncate">执行: ${assignee}</span>
                    </div>
                </div>`;
        });
    }
    
    const modal = document.getElementById('period-detail-modal');
    const content = document.getElementById('period-detail-content');
    modal.classList.remove('hidden'); void modal.offsetWidth;
    content.classList.remove('scale-95', 'opacity-0'); content.classList.add('scale-100', 'opacity-100');
}

window.closeModal = function(id) {
    const modal = document.getElementById(id);
    const content = document.getElementById('period-detail-content');
    content.classList.remove('scale-100', 'opacity-100'); content.classList.add('scale-95', 'opacity-0');
    setTimeout(() => { modal.classList.add('hidden'); }, 300);
}

// 挂载通知与监听事件
document.addEventListener('DOMContentLoaded', () => {
    if(window.supabase) {
        window.initApp();
        
        const idBtn = document.getElementById('identityBtn');
        const idMenu = document.getElementById('identityMenu');
        if(idBtn && idMenu) idBtn.addEventListener('click', (e) => { e.stopPropagation(); idMenu.classList.toggle('hidden'); });
        
        const notifBtn = document.getElementById('notifBtn');
        const notifMenu = document.getElementById('notifMenu');
        if(notifBtn && notifMenu) notifBtn.addEventListener('click', (e) => { e.stopPropagation(); notifMenu.classList.toggle('hidden'); });

        document.addEventListener('click', (e) => { 
            if(idMenu && !idMenu.contains(e.target)) idMenu.classList.add('hidden'); 
            if(notifMenu && !notifMenu.contains(e.target)) notifMenu.classList.add('hidden'); 
            const dateWrap = document.getElementById('date-selector-wrapper');
            const dateDrop = document.getElementById('date-dropdown');
            if (dateWrap && dateDrop && !dateWrap.contains(e.target)) dateDrop.classList.add('hidden');
        });
    }
});