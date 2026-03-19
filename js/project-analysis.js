window.PAGE_TYPE = 'admin'; 
let currentView = 'year'; 
let currentDate = new Date();
let myAllTasks = []; 
let allProjects = [];
let currentSelectedProject = 'all'; // 'all' or specific project string
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

// ================= 💡 视图与时间引擎 =================
window.switchView = function(view) {
    currentView = view;
    const btns = ['month', 'year'];
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
    else jumpBtn.innerText = '回到今年';

    document.getElementById('ai-report-content').classList.add('hidden');
    document.getElementById('ai-report-content').innerHTML = '';
    document.getElementById('ai-empty').classList.remove('hidden');

    window.updateDataAndRender();
}

window.navDate = function(step) {
    if (currentView === 'month') currentDate.setMonth(currentDate.getMonth() + step);
    else if (currentView === 'year') currentDate.setFullYear(currentDate.getFullYear() + step);
    window.updateDataAndRender();
}

window.jumpToCurrent = function() {
    currentDate = new Date();
    window.updateDataAndRender();
}

window.toggleDropdown = function(id) {
    const dropdown = document.getElementById(id);
    if (id === 'project-dropdown') {
        window.renderProjectList();
    } else if (id === 'date-dropdown') {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        dropdownData = [];
        if (currentView === 'month') {
            for(let i = -5; i <= 5; i++) {
                const d = new Date(year, month + i, 1);
                dropdownData.push({ text: `${d.getFullYear()}年 ${d.getMonth()+1}月`, date: d, isCurrent: i===0 });
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
    }
    
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

window.selectProject = function(pName) {
    currentSelectedProject = pName;
    document.getElementById('current-project-text').innerText = pName === 'all' ? '全部项目大盘' : pName;
    document.getElementById('project-dropdown').classList.add('hidden');
    
    document.getElementById('ai-report-content').classList.add('hidden');
    document.getElementById('ai-empty').classList.remove('hidden');

    window.updateDataAndRender();
}

window.filterProjectList = function() { window.renderProjectList(document.getElementById('project-search').value.toLowerCase()); }

window.renderProjectList = function(filterText = '') {
    const listEl = document.getElementById('project-dropdown-list');
    let filtered = allProjects.filter(p => p.toLowerCase().includes(filterText));
    let html = `<button onclick="window.selectProject('all')" class="w-full text-left px-5 py-2 text-[13px] ${currentSelectedProject==='all'?'text-fuchsia-400 bg-fuchsia-500/10 font-bold':'text-zinc-300 hover:bg-white/5'} transition-colors">全部项目大盘</button>`;
    
    if(filtered.length === 0) {
        html += `<div class="px-5 py-3 text-[12px] text-zinc-500 text-center">无相关项目</div>`;
    } else {
        filtered.forEach(p => {
            let isActive = currentSelectedProject === p;
            html += `<button onclick="window.selectProject('${p}')" class="w-full text-left px-5 py-2 text-[13px] truncate ${isActive?'text-fuchsia-400 bg-fuchsia-500/10 font-bold':'text-zinc-300 hover:bg-white/5'} transition-colors" title="${p}">${p}</button>`;
        });
    }
    listEl.innerHTML = html;
}

// ================= 💡 核心：拉取云端数据 =================
window.loadDashboardData = async function() {
    if(!window.initRBAC()) return;
    if(!window.supabase) return;

    const syncDot = document.getElementById('sync-indicator');
    if(syncDot) syncDot.classList.remove('hidden');

    try {
        const { data: tasks, error } = await window.supabase.from(window.DB_TABLE).select('id, title, project, status, creator, assignee, due_date, history_json').order('created_at', { ascending: false });
        if (error) throw error;
        myAllTasks = tasks || [];

        let pSet = new Set();
        myAllTasks.forEach(t => { if(t.project) pSet.add(t.project); });
        allProjects = Array.from(pSet).sort();

        window.switchView('year'); 
        document.getElementById('dashboard-loading').classList.add('hidden');

    } catch (err) {
        console.error(err);
        document.getElementById('dashboard-loading').innerHTML = `<p class="text-rose-500 font-bold">数据拉取失败</p><p class="text-xs text-zinc-500">${err.message}</p>`;
    } finally {
        if(syncDot) setTimeout(() => syncDot.classList.add('hidden'), 500);
    }
}

function extractDataForPeriod(year, month, isYearly) {
    let totalHours = 0;
    let peopleMap = {}; 
    let aiCount = 0;
    let totalTasksSet = new Set();

    myAllTasks.forEach(t => {
        if (currentSelectedProject !== 'all' && t.project !== currentSelectedProject) return;

        let isTaskInPeriod = false;
        try {
            const hist = JSON.parse(t.history_json || '[]');
            hist.forEach(h => {
                const hDate = new Date(h.created_at || h.time);
                let matchPeriod = false;
                if (isYearly) { matchPeriod = (hDate.getFullYear() === year); } 
                else { matchPeriod = (hDate.getFullYear() === year && hDate.getMonth() === month); }

                if (matchPeriod) {
                    const hVal = parseFloat(h.work_hours) || 0;
                    if (hVal > 0 && h.operator) {
                        isTaskInPeriod = true;
                        totalHours += hVal;
                        let cleanName = h.operator.split(' ')[0].split('(')[0].trim(); 
                        if(!peopleMap[cleanName]) peopleMap[cleanName] = 0;
                        peopleMap[cleanName] += hVal;
                    }
                    
                    if (h.action === 'submit_draft' || h.action === 'submit_framework') {
                        const tools = h.ai_tools || [];
                        tools.forEach(tool => {
                            if (tool && tool !== '无AI辅助') aiCount++;
                        });
                    }
                }
            });
        } catch(e){}

        if(isTaskInPeriod) totalTasksSet.add(t.id);
    });

    return { totalHours, peopleMap, aiCount, tasksCount: totalTasksSet.size };
}

// ================= 💡 数据计算与大盘更新 =================
window.updateDataAndRender = function() {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    if (currentView === 'month') {
        document.getElementById('current-date-text').innerText = `${year}年 ${month+1}月`;
    } else {
        document.getElementById('current-date-text').innerText = `${year} 年度`;
    }

    const currentData = extractDataForPeriod(year, month, currentView === 'year');
    
    let prev1Data, prev2Data;
    let periodLabels = [];
    if (currentView === 'month') {
        let p1Date = new Date(year, month - 1, 1);
        let p2Date = new Date(year, month - 2, 1);
        prev1Data = extractDataForPeriod(p1Date.getFullYear(), p1Date.getMonth(), false);
        prev2Data = extractDataForPeriod(p2Date.getFullYear(), p2Date.getMonth(), false);
        periodLabels = [`${p2Date.getMonth()+1}月`, `${p1Date.getMonth()+1}月`, `${month+1}月 (本期)`];
    } else {
        prev1Data = extractDataForPeriod(year - 1, 0, true);
        prev2Data = extractDataForPeriod(year - 2, 0, true);
        periodLabels = [`${year-2}年`, `${year-1}年`, `${year}年 (本期)`];
    }

    document.getElementById('metric-cur-hours').innerText = currentData.totalHours.toFixed(1);
    document.getElementById('metric-cur-people').innerText = Object.keys(currentData.peopleMap).length;
    document.getElementById('metric-cur-tasks').innerText = currentData.tasksCount;
    document.getElementById('metric-cur-ai').innerText = currentData.aiCount;

    const trendH = currentData.totalHours - prev1Data.totalHours;
    document.getElementById('metric-trend-hours').innerHTML = prev1Data.totalHours === 0 ? `对比前期: <span class="text-zinc-400">无记录</span>` : `对比前期: <span class="${trendH>0?'text-rose-400':'text-emerald-400'} font-bold">${trendH>0?'↑':'↓'} ${Math.abs(Math.round((trendH/prev1Data.totalHours)*100))}%</span>`;
    
    const trendT = currentData.tasksCount - prev1Data.tasksCount;
    document.getElementById('metric-trend-tasks').innerHTML = prev1Data.tasksCount === 0 ? `对比前期: <span class="text-zinc-400">无记录</span>` : `对比前期: <span class="${trendT>0?'text-rose-400':'text-emerald-400'} font-bold">${trendT>0?'↑':'↓'} ${Math.abs(Math.round((trendT/prev1Data.tasksCount)*100))}%</span>`;

    const trendA = currentData.aiCount - prev1Data.aiCount;
    document.getElementById('metric-trend-ai').innerHTML = prev1Data.aiCount === 0 ? `对比前期: <span class="text-zinc-400">无记录</span>` : `对比前期: <span class="${trendA>0?'text-emerald-400':'text-rose-400'} font-bold">${trendA>0?'↑':'↓'} ${Math.abs(Math.round((trendA/prev1Data.aiCount)*100))}%</span>`;

    const pplContainer = document.getElementById('people-dist-container');
    if (currentData.totalHours === 0) {
        pplContainer.innerHTML = '<div class="text-center py-6 text-zinc-500 text-sm">该周期无工时投入记录</div>';
    } else {
        let pplHtml = '';
        const sortedPpl = Object.keys(currentData.peopleMap).map(k => ({ name: k, hours: currentData.peopleMap[k] })).sort((a,b) => b.hours - a.hours).slice(0, 6);
        const colors = ['indigo', 'fuchsia', 'sky', 'emerald', 'amber', 'orange'];
        
        sortedPpl.forEach((p, idx) => {
            const pct = Math.round((p.hours / currentData.totalHours) * 100);
            const col = colors[idx % colors.length];
            pplHtml += `
            <div class="mb-4 group">
                <div class="flex justify-between items-end mb-1.5">
                    <h4 class="text-[13px] font-bold text-zinc-200 group-hover:text-${col}-400 transition-colors">${p.name}</h4>
                    <div class="text-right">
                        <span class="text-[13px] font-mono font-bold text-${col}-400">${p.hours.toFixed(1)} <span class="text-[10px] text-${col}-400/60 font-sans font-normal">h</span></span>
                        <span class="text-[10px] text-zinc-500 ml-2">占 ${pct}%</span>
                    </div>
                </div>
                <div class="w-full h-2 bg-zinc-900 rounded-full overflow-hidden">
                    <div class="h-full bg-${col}-500 rounded-full opacity-80 bar-grow shadow-[0_0_10px_var(--tw-colors-${col}-500)]" style="width: ${pct}%"></div>
                </div>
            </div>`;
        });
        pplContainer.innerHTML = pplHtml;
    }

    let globalAiFreq = {};
    myAllTasks.forEach(t => {
        if (currentSelectedProject !== 'all' && t.project !== currentSelectedProject) return;
        try {
            const hist = JSON.parse(t.history_json || '[]');
            hist.forEach(h => {
                const hDate = new Date(h.created_at || h.time);
                let matchPeriod = false;
                if (currentView === 'year') { matchPeriod = (hDate.getFullYear() === year); } 
                else { matchPeriod = (hDate.getFullYear() === year && hDate.getMonth() === month); }

                if (matchPeriod && (h.action === 'submit_draft' || h.action === 'submit_framework')) {
                    const tools = h.ai_tools || [];
                    tools.forEach(tool => {
                        if (tool && tool !== '无AI辅助') {
                            if(!globalAiFreq[tool]) globalAiFreq[tool] = 0;
                            globalAiFreq[tool]++;
                        }
                    });
                }
            });
        }catch(e){}
    });

    const aiContainer = document.getElementById('ai-dist-container');
    const totalToolTags = Object.values(globalAiFreq).reduce((a, b) => a + b, 0);
    if (totalToolTags === 0) {
        aiContainer.innerHTML = '<div class="text-center py-6 text-zinc-500 text-sm">该周期未使用 AI 辅助</div>';
    } else {
        let aiHtml = '';
        const AI_COLOR_MAP = { 'Midjourney': 'emerald', 'Gemini': 'indigo', 'PS生成填充': 'sky', '豆包': 'fuchsia', '即梦': 'orange' };
        const sortedTools = Object.keys(globalAiFreq).map(k => ({ name: k, count: globalAiFreq[k] })).sort((a,b) => b.count - a.count).slice(0,5);
        
        sortedTools.forEach(t => {
            const pct = Math.round((t.count / totalToolTags) * 100);
            const col = AI_COLOR_MAP[t.name] || 'amber';
            aiHtml += `
            <div class="mb-3 group">
                <div class="flex items-center justify-between mb-1.5">
                    <span class="text-[12px] font-bold text-${col}-400 flex items-center gap-2"><div class="w-2 h-2 bg-${col}-400 rounded-full shadow-[0_0_8px_var(--tw-colors-${col}-400)]"></div> ${t.name}</span>
                    <span class="text-[12px] font-mono font-bold text-white">${pct}% <span class="text-[10px] font-normal text-zinc-500 ml-1">(${t.count}次)</span></span>
                </div>
                <div class="w-full h-1.5 bg-zinc-900 rounded-full overflow-hidden"><div class="h-full bg-${col}-500 rounded-full opacity-80 bar-grow" style="width: ${pct}%"></div></div>
            </div>`;
        });
        aiContainer.innerHTML = aiHtml;
    }

    const chartContainer = document.getElementById('history-chart-container');
    const maxHours = Math.max(prev2Data.totalHours, prev1Data.totalHours, currentData.totalHours, 10); 
    
    const datasets = [prev2Data, prev1Data, currentData];
    let chartHtml = `
        <div class="absolute inset-0 flex flex-col justify-between pointer-events-none opacity-10 py-6">
            <div class="w-full h-px bg-white relative"><span class="absolute -top-2 -left-8 text-[9px] text-white">${Math.round(maxHours)}h</span></div>
            <div class="w-full h-px bg-white relative"><span class="absolute -top-2 -left-8 text-[9px] text-white">${Math.round(maxHours*0.75)}h</span></div>
            <div class="w-full h-px bg-white relative"><span class="absolute -top-2 -left-8 text-[9px] text-white">${Math.round(maxHours*0.5)}h</span></div>
            <div class="w-full h-px bg-white relative"><span class="absolute -top-2 -left-8 text-[9px] text-white">${Math.round(maxHours*0.25)}h</span></div>
            <div class="w-full h-px bg-white relative"><span class="absolute -top-2 -left-8 text-[9px] text-white">0h</span></div>
        </div>
    `;

    datasets.forEach((d, idx) => {
        const hPct = Math.round((d.totalHours / maxHours) * 85); 
        const isCur = idx === 2;
        
        chartHtml += `
        <div class="flex flex-col items-center justify-end h-full z-10 w-20 group relative">
            <div class="absolute -top-10 bg-[#1a1a24] border border-white/10 px-3 py-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity z-50 text-center shadow-2xl pointer-events-none">
                <p class="text-[10px] text-zinc-400 whitespace-nowrap mb-0.5">人力: <span class="text-white font-bold font-mono">${d.totalHours.toFixed(1)}h</span></p>
                <p class="text-[10px] text-zinc-400 whitespace-nowrap">AI: <span class="text-amber-400 font-bold font-mono">${d.aiCount}次</span></p>
            </div>
            
            <div class="flex items-end gap-1.5 w-full h-full justify-center pb-2">
                <div class="w-5 bg-indigo-500 rounded-t-sm opacity-90 bar-grow shadow-[0_0_15px_rgba(99,102,241,0.4)]" style="height: ${hPct}%; ${isCur?'':'filter: grayscale(0.5) opacity(0.6)'}"></div>
                <div class="w-3 bg-amber-500 rounded-t-sm opacity-90 bar-grow" style="height: ${Math.min(d.aiCount * 2, 85)}%; ${isCur?'':'filter: grayscale(0.5) opacity(0.6)'}"></div>
            </div>
            <span class="text-[11px] font-bold ${isCur?'text-fuchsia-400':'text-zinc-500'}">${periodLabels[idx]}</span>
        </div>`;
    });
    chartContainer.innerHTML = chartHtml;

    aiReportDataSnap = {
        project: currentSelectedProject === 'all' ? '全局大盘' : currentSelectedProject,
        period: currentView === 'month' ? `${year}年${month+1}月` : `${year}年`,
        currentData: currentData,
        prevData: prev1Data,
        trendH: trendH
    };
}

// ================= 🧠 Gemini 智能报告生成器 =================
window.triggerAIReport = function() {
    const btn = document.getElementById('btn-generate-ai');
    const loading = document.getElementById('ai-loading');
    const empty = document.getElementById('ai-empty');
    const content = document.getElementById('ai-report-content');

    btn.disabled = true;
    btn.innerHTML = `<svg class="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> 思考中...`;
    
    empty.classList.add('hidden');
    content.classList.add('hidden');
    loading.classList.remove('hidden');
    loading.classList.add('flex');

    setTimeout(() => {
        loading.classList.remove('flex');
        loading.classList.add('hidden');
        
        btn.disabled = false;
        btn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg> 重新生成`;

        const snap = aiReportDataSnap;
        const topPerson = Object.keys(snap.currentData.peopleMap).sort((a,b)=>snap.currentData.peopleMap[b]-snap.currentData.peopleMap[a])[0] || '无记录';
        
        let evaluation = '健康'; let evaCol = 'emerald';
        let suggestion = `目前 <b>${snap.project}</b> 在 <b>${snap.period}</b> 的人效投入合理。主力 <b>${topPerson}</b> 输出了最大的工时贡献。建议继续保持，可尝试进一步增加 AI (如 Midjourney) 的介入，提升基础物料的产出速度。`;

        if (snap.trendH > 20) {
            evaluation = '负载激增'; evaCol = 'rose';
            suggestion = `警告：<b>${snap.project}</b> 的投入人力环比上期激增了 <b>${snap.trendH.toFixed(1)}小时</b>。且 <b>${topPerson}</b> 可能存在单点依赖风险。建议立即介入排期，引入外部助理分担基础排版工作。`;
        } else if (snap.currentData.totalHours === 0) {
            evaluation = '静默'; evaCol = 'zinc';
            suggestion = `该时段内未检测到 <b>${snap.project}</b> 有任何工时投入。请确认项目是否已搁置或未规范填写日志。`;
        }

        const reportHTML = `
            <div class="mb-4 flex items-center justify-between border-b border-fuchsia-500/20 pb-3">
                <span class="text-[12px] text-fuchsia-400 font-bold bg-fuchsia-500/10 px-2 py-1 rounded">分析对象: ${snap.project} (${snap.period})</span>
                <span class="text-[12px] font-bold text-${evaCol}-400 bg-${evaCol}-500/10 border border-${evaCol}-500/20 px-2 py-1 rounded">综合评估: ${evaluation}</span>
            </div>
            <div class="space-y-4 text-zinc-300">
                <p class="ai-cursor">${suggestion}</p>
                <div class="bg-black/50 p-4 rounded-xl border border-white/5 mt-4">
                    <h4 class="text-white font-bold text-[13px] mb-2 flex items-center gap-1.5"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg> AI 执行建议</h4>
                    <ul class="list-disc list-inside text-[12px] space-y-1.5 text-zinc-400 ml-2">
                        <li>当前 AI 介入频次为 ${snap.currentData.aiCount} 次，同环比变化提示团队仍有空间通过 AIGC 工具压缩草图与线稿周期。</li>
                        <li>建议为 ${topPerson} 等高负载产出节点配备专职的 AI 跑图助理，进一步释放核心脑力。</li>
                    </ul>
                </div>
            </div>
        `;

        content.innerHTML = reportHTML;
        content.classList.remove('hidden');
        
        setTimeout(() => {
            const cursorP = content.querySelector('.ai-cursor');
            if(cursorP) cursorP.classList.remove('ai-cursor');
        }, 1500);

    }, 1800); 
}

// 绑定页面全局事件
document.addEventListener('DOMContentLoaded', () => {
    if(window.initRBAC()) setTimeout(()=> { if(window.supabase) window.loadDashboardData(); }, 100); 
});

document.addEventListener('click', (e) => {
    const dateWrap = document.getElementById('date-selector-wrapper');
    const dateDrop = document.getElementById('date-dropdown');
    if (dateWrap && dateDrop && !dateWrap.contains(e.target)) dateDrop.classList.add('hidden');

    const projWrap = document.getElementById('project-selector-wrapper');
    const projDrop = document.getElementById('project-dropdown');
    if (projWrap && projDrop && !projWrap.contains(e.target)) projDrop.classList.add('hidden');
    
    const idWrap = document.getElementById('identity-wrapper');
    const idMenu = document.getElementById('identityMenu');
    if (idWrap && idMenu && !idWrap.contains(e.target)) idMenu.classList.add('hidden');
});