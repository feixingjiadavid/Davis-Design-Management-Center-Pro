window.PAGE_TYPE = 'design'; 
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

    if (!(user.perms || []).includes(window.PAGE_TYPE)) { 
        window.showAlert("权限错误", "无权限访问此页面", "danger"); 
        setTimeout(window.logout, 1500); 
        return false; 
    }

    const avatarEl = document.getElementById('sidebar-avatar');
    if(avatarEl) { avatarEl.innerText = user.avatar || '?'; avatarEl.className = `w-9 h-9 rounded-full ${user.color || 'bg-orange-600'} border border-zinc-700 flex items-center justify-center text-white font-bold text-sm shadow-lg shrink-0`; }
    if(document.getElementById('sidebar-name')) document.getElementById('sidebar-name').innerText = user.displayName || user.cnName || user.enName;
    if(document.getElementById('sidebar-role')) document.getElementById('sidebar-role').innerHTML = `<span class="text-orange-400 font-bold">当前视角: 设计方</span>`;
    
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
            html += `<div class="flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-white/5 text-zinc-400 hover:text-white cursor-pointer btn-press transition-colors" onclick="window.location.href='manager-workspace.html'"><div class="w-7 h-7 rounded-lg bg-fuchsia-500/10 flex items-center justify-center text-fuchsia-400"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="3" y1="9" x2="21" y2="9"></line><line x1="9" y1="21" x2="9" y2="9"></line></svg></div><span class="text-[13px] font-medium">管理方 (统筹大盘)</span></div>`; 
        }
        menuContainer.innerHTML = html;
    }
    const triggerBtn = document.getElementById('identityBtn');
    if (triggerBtn) { triggerBtn.innerHTML = `<span class="text-orange-500 font-black flex items-center gap-1.5"><span class="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse"></span></span> 身份: 设计方 (当前) <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="text-zinc-500 ml-1"><polyline points="6 9 12 15 18 9"></polyline></svg>`; }
    
    currentUserData = user;
    return user;
}

// ================= 高级弹窗引擎 =================
window.closeCustomDialog = function() {
    const overlay = document.getElementById('custom-dialog-overlay');
    const dialog = document.getElementById('custom-dialog');
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
        colorBar.className = 'absolute top-0 left-0 right-0 h-1 bg-orange-500';
        icon.className = 'w-8 h-8 rounded-full bg-orange-500/20 text-orange-400 flex items-center justify-center shrink-0';
        icon.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>`;
    }
}

window.showDialogUI = function() {
    const overlay = document.getElementById('custom-dialog-overlay');
    const dialog = document.getElementById('custom-dialog');
    overlay.classList.remove('hidden');
    setTimeout(() => { overlay.classList.remove('opacity-0'); dialog.classList.remove('scale-95'); }, 10);
}

window.showAlert = function(title, message, type="primary") {
    window.setupDialog(title, message, type);
    const btnContainer = document.getElementById('dialog-buttons');
    let btnColor = type === 'danger' ? 'bg-rose-600 hover:bg-rose-500' : (type === 'success' ? 'bg-emerald-600 hover:bg-emerald-500' : 'bg-orange-600 hover:bg-orange-500');
    btnContainer.innerHTML = `<button onclick="window.closeCustomDialog()" class="w-full py-2.5 ${btnColor} text-white rounded-xl text-[13px] font-bold shadow-lg transition-all btn-press">我知道了</button>`;
    window.showDialogUI();
}

window.showToast = function(title, desc, type = 'success') {
    const toast = document.getElementById('action-toast');
    document.getElementById('toast-title').innerText = title;
    document.getElementById('toast-desc').innerText = desc;
    const icon = document.getElementById('toast-icon');
    if(type === 'success') {
        icon.className = "w-8 h-8 rounded-full flex items-center justify-center shrink-0 bg-emerald-500/20 text-emerald-400";
        icon.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
    } else if(type === 'info') {
        icon.className = "w-8 h-8 rounded-full flex items-center justify-center shrink-0 bg-orange-500/20 text-orange-400";
        icon.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>`;
    }
    toast.classList.remove('hidden');
    setTimeout(() => { toast.classList.add('hidden'); }, 3000);
}

// ================= 基础交互库 =================
window.logout = function(e) {
    if(e) e.stopPropagation();
    localStorage.removeItem('activeUserObj'); 
    window.location.href = 'login.html'; 
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

// ================= 💡 核心：拉取云端数据 =================
window.initApp = async function() {
    if(!window.initRBAC()) return;
    if(!window.supabase) return;

    const currentUserEn = currentUserData.enName ? currentUserData.enName.toLowerCase() : '';
    const isSuperAdmin = currentUserEn === 'davidxxu' || currentUserEn === 'judyzzhang';

    const syncDot = document.getElementById('sync-indicator');
    if(syncDot) syncDot.classList.remove('hidden');

    try {
        let query = window.supabase.from(window.DB_TABLE).select('*').order('due_date', { ascending: true });
        const { data, error } = await query;
        if (error) throw error;
        
        myAllTasks = (data || []).filter(t => {
            if (isSuperAdmin) return true;
            const a = (t.assignee || '').toLowerCase();
            return a === currentUserEn;
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
    } finally {
        if(syncDot) setTimeout(() => syncDot.classList.add('hidden'), 500);
    }
}

// ================= 状态解析与工具函数 =================
function parseTaskStatus(task) {
    let sColor, sText, iconHtml;
    const isFinished = ['completed','archived','terminated'].includes(task.status);
    
    switch(task.status) {
        case 'rejected': sColor = 'rose'; sText = '被打回重画'; iconHtml = `🔴`; break;
        case 'reviewing': sColor = 'emerald'; sText = '待甲方验收'; iconHtml = `🟢`; break;
        case 'pending_accept': sColor = 'sky'; sText = '待您接单'; iconHtml = `⚪`; break;
        case 'pending_approval': sColor = 'amber'; sText = '框架待审批'; iconHtml = `🔒`; break;
        case 'processing': sColor = 'orange'; sText = '制作中'; iconHtml = `✍️`; break;
        case 'completed': 
        case 'archived': sColor = 'zinc'; sText = '已完结'; iconHtml = `✓`; break;
        case 'terminated': sColor = 'rose'; sText = '已终止'; iconHtml = `❌`; break;
        default: sColor = 'sky'; sText = '待排期'; iconHtml = `⚪`; 
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
            ? '检测到本周有需求卡在周六日截止，请密切关注排期防止延误。'
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
            btn.className = "px-5 py-1.5 text-[13px] font-bold bg-orange-500/20 text-orange-400 border border-orange-500/20 rounded-lg shadow-sm cursor-default";
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
            html += `<div class="w-full text-left px-5 py-2.5 text-[14px] text-orange-400 bg-orange-500/10 font-bold cursor-default">${item.text} <span class="text-[10px] bg-orange-500/20 px-1.5 py-0.5 rounded ml-2">当前</span></div>`;
        } else {
            html += `<button onclick="window.selectDropdownDate(${index})" class="w-full text-left px-5 py-2.5 text-[14px] text-zinc-400 hover:bg-white/5 hover:text-white transition-colors">${item.text}</button>`;
        }
    });
    dropdown.innerHTML = html + '</div>';
    dropdown.classList.toggle('hidden');
    setTimeout(() => { const act = dropdown.querySelector('.bg-orange-500\\/10'); if(act) act.scrollIntoView({ block: 'center' }); }, 10);
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
        document.getElementById('stat-period-title').innerText = '本月填报工时';
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
        document.getElementById('stat-period-title').innerText = '本周填报工时';
    }
    else if (currentView === 'year') {
        for(let i = -3; i <= 3; i++) {
            const y = year + i;
            dropdownData.push({ text: `${y} 年度`, date: new Date(y, 0, 1), isCurrent: i===0 });
        }
        document.getElementById('current-date-text').innerText = `${year} 年度`;
        document.getElementById('stat-period-title').innerText = '全年填报工时';
    }

    let tasksInView = [];
    if (currentView === 'month') tasksInView = renderMonthGrid();
    else if (currentView === 'week') tasksInView = renderWeekGrid();
    else if (currentView === 'year') tasksInView = renderYearGrid();

    updateInsights(tasksInView);
}

function updateInsights(tasks) {
    let totalPeriodHours = 0; 
    let projectHoursMap = {};
    let aiToolsFreq = {};
    let totalCompletedInPeriod = 0;
    let onTimeCompleted = 0;
    let rejectedCount = 0;
    let aiTasksCount = 0;
    
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    tasks.forEach(t => {
        let taskHoursThisPeriod = 0;
        let isTaskInPeriod = false;
        let isCompletedInPeriod = false;

        try {
            const hist = JSON.parse(t.history_json || '[]');
            let tUsedAi = false;
            let hasReject = false;

            hist.forEach(h => {
                if(h.is_rejected || (h.action && h.action.includes('reject'))) hasReject = true;
                
                if (h.action === 'submit_draft' || h.action === 'submit_framework') {
                    const tools = h.ai_tools || [];
                    tools.forEach(tool => {
                        if (tool && tool !== '无AI辅助') {
                            tUsedAi = true;
                            if(!aiToolsFreq[tool]) aiToolsFreq[tool] = 0;
                            aiToolsFreq[tool]++;
                        }
                    });
                }

                if (h.operator && (h.operator.includes(currentUserData.enName) || h.operator.includes(currentUserData.displayName))) {
                    const hDate = new Date(h.created_at || h.time);
                    let matchPeriod = false;
                    if (currentView === 'month') matchPeriod = (hDate.getFullYear() === year && hDate.getMonth() === month);
                    else if (currentView === 'year') matchPeriod = (hDate.getFullYear() === year);
                    else {
                        const startWeek = getStartOfWeek(currentDate);
                        const endWeek = new Date(startWeek); endWeek.setDate(endWeek.getDate() + 6);
                        hDate.setHours(0,0,0,0);
                        matchPeriod = (hDate >= startWeek && hDate <= endWeek);
                    }

                    if (matchPeriod) {
                        isTaskInPeriod = true;
                        const hVal = parseFloat(h.work_hours) || 0;
                        taskHoursThisPeriod += hVal;
                        totalPeriodHours += hVal;
                        
                        const pName = t.project || '其他支持';
                        if (!projectHoursMap[pName]) projectHoursMap[pName] = 0;
                        projectHoursMap[pName] += hVal;
                    }
                }

                if (['completed', 'archived'].includes(t.status)) {
                    if (h.action === 'complete' || h.action === 'approve_draft') {
                        const cDate = new Date(h.created_at || h.time);
                        let matchPeriod = false;
                        if (currentView === 'month') matchPeriod = (cDate.getFullYear() === year && cDate.getMonth() === month);
                        else if (currentView === 'year') matchPeriod = (cDate.getFullYear() === year);
                        else {
                            const startWeek = getStartOfWeek(currentDate);
                            const endWeek = new Date(startWeek); endWeek.setDate(endWeek.getDate() + 6);
                            cDate.setHours(0,0,0,0);
                            matchPeriod = (cDate >= startWeek && cDate <= endWeek);
                        }
                        if(matchPeriod) {
                            isCompletedInPeriod = true;
                            if(t.due_date) {
                                const dDate = new Date(t.due_date); dDate.setHours(0,0,0,0);
                                cDate.setHours(0,0,0,0);
                                if (cDate <= dDate) onTimeCompleted++;
                            } else {
                                onTimeCompleted++; 
                            }
                        }
                    }
                }
            });
            
            if (isCompletedInPeriod) {
                totalCompletedInPeriod++;
                if (hasReject) rejectedCount++;
            }
            if (isTaskInPeriod && tUsedAi) aiTasksCount++;

        } catch(e){}
    });

    const firstPassCount = totalCompletedInPeriod - rejectedCount;
    const firstPassRate = totalCompletedInPeriod > 0 ? Math.round((firstPassCount / totalCompletedInPeriod) * 100) : 0;
    const onTimeRate = totalCompletedInPeriod > 0 ? Math.round((onTimeCompleted / totalCompletedInPeriod) * 100) : 0;
    const aiSavedHours = (aiTasksCount * 2.4).toFixed(1); 

    document.getElementById('stat-total-hours').innerText = totalPeriodHours.toFixed(1);
    document.getElementById('stat-ontime-rate').innerText = totalCompletedInPeriod > 0 ? `${onTimeRate}%` : '--';
    document.getElementById('stat-first-pass').innerText = totalCompletedInPeriod > 0 ? `${firstPassRate}%` : '--';
    document.getElementById('stat-ai-saved').innerText = aiSavedHours;

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

    const overdueEl = document.getElementById('stat-overdue');
    overdueEl.innerText = overdueCount;
    if(overdueCount > 0) { overdueEl.className = 'text-rose-500'; } else { overdueEl.className = 'text-emerald-400'; }

    const distContainer = document.getElementById('project-dist-container');
    if (distContainer) {
        if (totalPeriodHours === 0) {
            distContainer.innerHTML = '<div class="text-center text-zinc-500 py-10 text-sm">当前周期无填报工时</div>';
        } else {
            let distHtml = '';
            const sortedProj = Object.keys(projectHoursMap).map(k => ({ name: k, count: projectHoursMap[k] })).sort((a,b) => b.count - a.count).slice(0,5);
            const colors = ['orange', 'emerald', 'sky', 'indigo', 'fuchsia'];

            sortedProj.forEach((p, idx) => {
                const pct = Math.round((p.count / totalPeriodHours) * 100);
                const col = colors[idx % colors.length];
                distHtml += `
                <div class="mb-4">
                    <div class="flex justify-between items-end mb-1.5">
                        <h4 class="text-[13px] font-bold text-zinc-200 truncate pr-2">${p.name}</h4>
                        <div class="text-right shrink-0">
                            <span class="text-[13px] font-mono font-bold text-${col}-400">${p.count.toFixed(1)} <span class="text-[10px] text-${col}-400/60 font-sans font-normal">h</span></span>
                        </div>
                    </div>
                    <div class="w-full h-1.5 bg-zinc-900 rounded-full overflow-hidden">
                        <div class="h-full bg-${col}-500 rounded-full opacity-80 shadow-[0_0_10px_var(--tw-colors-${col}-500)]" style="width: ${pct}%"></div>
                    </div>
                </div>`;
            });
            distContainer.innerHTML = distHtml;
        }
    }

    const aiContainer = document.getElementById('ai-dist-container');
    if (aiContainer) {
        const totalToolTags = Object.values(aiToolsFreq).reduce((a, b) => a + b, 0);
        if (totalToolTags === 0) {
            aiContainer.innerHTML = '<div class="text-center text-zinc-500 py-6 text-sm">本期未使用 AI 辅助</div>';
        } else {
            let aiHtml = '';
            const AI_COLOR_MAP = { 'Midjourney': 'emerald', 'Gemini': 'indigo', 'PS生成填充': 'sky', '豆包': 'fuchsia', '即梦': 'orange' };
            const sortedTools = Object.keys(aiToolsFreq).map(k => ({ name: k, count: aiToolsFreq[k] })).sort((a,b) => b.count - a.count).slice(0,5);
            
            sortedTools.forEach(t => {
                const pct = Math.round((t.count / totalToolTags) * 100);
                const col = AI_COLOR_MAP[t.name] || 'indigo';
                aiHtml += `
                <div class="mb-3">
                    <div class="flex items-center justify-between mb-1.5">
                        <span class="text-[12px] font-bold text-${col}-400 flex items-center gap-2"><div class="w-2 h-2 bg-${col}-400 rounded-full shadow-[0_0_8px_var(--tw-colors-${col}-400)]"></div> ${t.name}</span>
                        <span class="text-[12px] font-mono font-bold text-white">${pct}% <span class="text-[10px] font-normal text-zinc-500 ml-1">(${t.count}次)</span></span>
                    </div>
                    <div class="w-full h-1.5 bg-zinc-900 rounded-full"><div class="h-full bg-${col}-500 rounded-full opacity-80" style="width: ${pct}%"></div></div>
                </div>`;
            });
            aiContainer.innerHTML = aiHtml;
        }
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
    for(let i=1; i<=monthLength; i++) dayData[i] = { totalHours: 0, tasks: [] };

    let tasksInView = [];
    myAllTasks.forEach(task => {
        let isTaskInThisMonth = false;

        if (task.due_date) {
            const d = new Date(task.due_date);
            if (d.getFullYear() === year && d.getMonth() === month) {
                const day = d.getDate();
                dayData[day].tasks.push(task);
                isTaskInThisMonth = true;
                if(!tasksInView.find(t=>t.id===task.id)) tasksInView.push(task);
            }
        }

        let taskHoursByMeThisMonth = 0;
        try {
            const hist = JSON.parse(task.history_json || '[]');
            hist.forEach(h => {
                if (h.operator && (h.operator.includes(currentUserData.enName) || h.operator.includes(currentUserData.displayName))) {
                    const hDate = new Date(h.created_at || h.time);
                    if (hDate.getFullYear() === year && hDate.getMonth() === month) {
                        const hVal = parseFloat(h.work_hours) || 0;
                        taskHoursByMeThisMonth += hVal;

                        if (!isTaskInThisMonth) {
                            if(!tasksInView.find(t=>t.id===task.id)) tasksInView.push(task);
                            const hDay = hDate.getDate();
                            if(!dayData[hDay].tasks.find(t => t.id === task.id)) {
                                dayData[hDay].tasks.push(task);
                            }
                        }
                    }
                }
            });
        } catch(e){}

        if (isTaskInThisMonth && task.due_date) {
            const d = new Date(task.due_date);
            dayData[d.getDate()].totalHours += taskHoursByMeThisMonth;
        }
    });

    const grid = document.getElementById('month-grid');
    let html = '';
    const today = new Date();
    const isCurrentMonthReal = (year === today.getFullYear() && month === today.getMonth());

    for (let i = 0; i < startingDay; i++) html += `<div class="calendar-cell muted"></div>`;

    for (let i = 1; i <= monthLength; i++) {
        const isToday = isCurrentMonthReal && i === today.getDate();
        const dayInfo = dayData[i];
        
        let loadHtml = '';
        let cellOutline = isToday ? 'border border-orange-500/50 shadow-[inset_0_0_15px_rgba(249,115,22,0.15)] relative z-10' : '';
        let dayNumClass = isToday ? 'text-orange-400 bg-orange-500/20 w-5 h-5 flex items-center justify-center rounded-full ml-auto' : 'text-zinc-400';
        
        if (dayInfo.totalHours > 0) {
            let loadClass = 'workload-safe'; let loadPulse = '';
            if (dayInfo.totalHours >= 4 && dayInfo.totalHours <= 8) { loadClass = 'workload-heavy'; }
            else if (dayInfo.totalHours > 8) { loadClass = 'workload-overload'; loadPulse = 'animate-pulse'; }
            loadHtml = `<span class="text-[10px] ${loadClass} px-1.5 rounded font-mono font-bold ${loadPulse}">${dayInfo.totalHours.toFixed(1)}h</span>`;
        } else if (dayInfo.tasks.length > 0) {
            loadHtml = `<span class="text-[10px] bg-zinc-800 text-zinc-500 px-1.5 rounded font-mono font-bold">排期</span>`;
        }

        let pillsHtml = dayInfo.tasks.map(t => {
            const st = parseTaskStatus(t);
            const borderStyle = st.isFinished ? 'border border-zinc-800 border-dashed border-l-2 border-l-zinc-600 opacity-60' : `bg-${st.sColor}-500/10 border border-${st.sColor}-500/20 border-l-2 border-l-${st.sColor}-500`;
            const textStyle = st.isFinished ? 'text-zinc-500' : `text-${st.sColor}-400`;

            return `<div onmouseenter="window.showHoverCard(event, '${t.id}')" onmouseleave="window.hideHoverCard()" onclick="event.stopPropagation(); window.location.href='task-detail-designer.html?id=${t.id}'" class="mt-1.5 text-[10px] ${textStyle} truncate ${borderStyle} px-1.5 py-0.5 rounded transition-all cursor-pointer event-pill" title="${t.title}">${t.title}</div>`;
        }).join('');

        let safeTasks = encodeURIComponent(JSON.stringify(dayInfo.tasks));
        html += `
            <div class="calendar-cell relative ${cellOutline}" onclick="window.openPeriodDetail('${year}年${month+1}月${i}日', '${safeTasks}')">
                ${isToday ? '<div class="absolute top-0 left-0 right-0 h-0.5 bg-orange-500"></div>' : ''}
                <div class="flex justify-between items-start mb-2">
                    ${loadHtml}
                    <span class="text-xs font-bold ${dayNumClass} ${!isToday ? 'self-end' : ''}">${i}</span>
                </div>
                <div class="flex-1 overflow-y-auto custom-scrollbar pr-1">${pillsHtml}</div>
            </div>`;
    }

    const remainingCells = 42 - (startingDay + monthLength);
    for (let i = 0; i < remainingCells; i++) html += `<div class="calendar-cell muted"></div>`; 
    grid.innerHTML = html;

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
            let matchDue = false;
            if(t.due_date) {
                let td = new Date(t.due_date);
                if(td.getFullYear() === y && td.getMonth() === m && td.getDate() === dateNum) matchDue = true;
            }
            let matchLog = false;
            try {
                const hist = JSON.parse(t.history_json || '[]');
                hist.forEach(h => {
                    if (h.operator && (h.operator.includes(currentUserData.enName) || h.operator.includes(currentUserData.displayName))) {
                        const hDate = new Date(h.created_at || h.time);
                        if (hDate.getFullYear() === y && hDate.getMonth() === m && hDate.getDate() === dateNum) matchLog = true;
                    }
                });
            }catch(e){}
            return matchDue || matchLog;
        });
        
        tasks.forEach(t => {
            if(!tasksInView.find(x=>x.id===t.id)) tasksInView.push(t);
        });

        if(tasks.length > 0 && (i===0 || i===6)) hasWeekendTask = true; 

        let headerHtml = isToday 
            ? `<div class="absolute top-0 left-0 right-0 h-1 bg-orange-500"></div>
                <div class="py-4 text-center border-b border-orange-500/20 bg-orange-500/10">
                    <p class="text-[11px] text-orange-400 font-bold mb-1">${weekdays[i]} (今天)</p>
                    <p class="text-[18px] text-orange-300 font-bold font-mono">${dateNum}</p>
                </div>`
            : `<div class="py-4 text-center border-b border-white/5 bg-[#16161d]">
                    <p class="text-[11px] ${(i===0||i===6)?'text-orange-400/50':'text-zinc-500'} font-bold mb-1">${weekdays[i]}</p>
                    <p class="text-[16px] text-zinc-400 font-mono">${dateNum}</p>
                </div>`;
                
        let cardsHtml = tasks.map(t => {
            const st = parseTaskStatus(t);
            return `
            <div onmouseenter="window.showHoverCard(event, '${t.id}')" onmouseleave="window.hideHoverCard()" onclick="event.stopPropagation(); window.location.href='task-detail-designer.html?id=${t.id}'" class="p-3 rounded-xl week-card border-l-2 ${st.borderStyle} bg-[#1a1a24] ${st.isFinished?'opacity-50':''}">
                <div class="flex justify-between items-start mb-2">
                    <span class="text-[9px] ${st.tagClass} px-1.5 py-0.5 rounded font-mono inline-block">${t.id}</span>
                    <span class="text-[10px] ${st.textStyle}">${st.iconHtml} ${st.sText}</span>
                </div>
                <p class="text-[13px] font-bold text-white leading-tight line-clamp-2 transition-colors">${t.title}</p>
            </div>`;
        }).join('');
            
        let safeTasks = encodeURIComponent(JSON.stringify(tasks));
        let bgClass = isToday ? 'bg-orange-900/10 border-x border-orange-500/20 relative cursor-pointer hover:bg-orange-900/20' : 'bg-[#0c0c0e] cursor-pointer hover:bg-white/5 border border-white/5';
        
        html += `<div class="${bgClass} flex flex-col transition-colors rounded-2xl overflow-hidden" onclick="window.openPeriodDetail('${m+1}月${dateNum}日', '${safeTasks}')">
                    ${headerHtml}
                    <div class="flex-1 p-3 space-y-3 overflow-y-auto custom-scrollbar">${cardsHtml}</div>
                 </div>`;
    }
    grid.innerHTML = html;
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
            let matchDue = false;
            if(t.due_date) {
                let td = new Date(t.due_date);
                if(td.getFullYear() === year && td.getMonth() === m) matchDue = true;
            }
            let matchLog = false;
            try {
                const hist = JSON.parse(t.history_json || '[]');
                hist.forEach(h => {
                    if (h.operator && (h.operator.includes(currentUserData.enName) || h.operator.includes(currentUserData.displayName))) {
                        const hDate = new Date(h.created_at || h.time);
                        if (hDate.getFullYear() === year && hDate.getMonth() === m) matchLog = true;
                    }
                });
            }catch(e){}
            return matchDue || matchLog;
        });
        
        tasks.forEach(t => {
            if(!tasksInView.find(x=>x.id===t.id)) tasksInView.push(t);
        });

        let count = tasks.length;
        let safeTasks = encodeURIComponent(JSON.stringify(tasks));
        const today = new Date();
        let isCurrentMonth = (year === today.getFullYear() && m === today.getMonth());

        if(isCurrentMonth) {
            html += `
            <div onclick="window.openPeriodDetail('${year}年 ${m+1}月', '${safeTasks}')" class="bg-orange-900/10 rounded-3xl p-6 month-card flex flex-col justify-between aspect-[4/3] border-orange-500/30 shadow-[0_0_20px_rgba(249,115,22,0.1)] relative">
                <div class="absolute top-4 right-4 bg-orange-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">本月</div>
                <h3 class="text-orange-400 font-bold text-[18px]">${m+1} 月</h3>
                <div><p class="text-[42px] font-mono text-white font-black leading-none mb-1">${count}<span class="text-[14px] text-orange-300 font-normal ml-1">单</span></p></div>
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
    triggerWarning(null);
    return tasksInView;
}

// ================= Excel 导出 =================
window.exportMyExcel = function() {
    const btn = document.querySelector('button[onclick="window.exportMyExcel()"]');
    const txt = document.getElementById('export-btn-text');
    btn.disabled = true; txt.innerText = "数据打包中...";
    
    window.showToast('开始生成', '正在为您生成本期报表...', 'info');

    setTimeout(() => {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        
        let csvContent = "工单编号,需求标题,归属项目,状态,期望交付日,我的填报工时(h),我使用的AI辅助工具\n";
        let hasData = false;

        myAllTasks.forEach(task => {
            let taskHours = 0;
            let isTaskInPeriod = false;
            let aiTools = new Set();

            try {
                const hist = JSON.parse(task.history_json || '[]');
                hist.forEach(h => {
                    if (h.operator && (h.operator.includes(currentUserData.enName) || h.operator.includes(currentUserData.displayName))) {
                        const hDate = new Date(h.created_at || h.time);
                        
                        let matchPeriod = false;
                        if (currentView === 'month') matchPeriod = (hDate.getFullYear() === year && hDate.getMonth() === month);
                        else if (currentView === 'year') matchPeriod = (hDate.getFullYear() === year);
                        else {
                            const sw = getStartOfWeek(currentDate); const ew = new Date(sw); ew.setDate(ew.getDate()+6);
                            hDate.setHours(0,0,0,0); sw.setHours(0,0,0,0); ew.setHours(0,0,0,0);
                            matchPeriod = (hDate >= sw && hDate <= ew);
                        }

                        if (matchPeriod) {
                            taskHours += parseFloat(h.work_hours) || 0;
                            isTaskInPeriod = true;
                        }
                        
                        if (h.ai_tools && (h.action === 'submit_draft' || h.action === 'submit_framework')) {
                            h.ai_tools.forEach(t => { if(t !== '无AI辅助') aiTools.add(t); });
                        }
                    }
                });
            } catch(e){}

            if (task.due_date) {
                const d = new Date(task.due_date);
                if (currentView === 'month' && d.getFullYear() === year && d.getMonth() === month) isTaskInPeriod = true;
                else if (currentView === 'year' && d.getFullYear() === year) isTaskInPeriod = true;
                else if (currentView === 'week') {
                    const sw = getStartOfWeek(currentDate); const ew = new Date(sw); ew.setDate(ew.getDate()+6);
                    d.setHours(0,0,0,0); sw.setHours(0,0,0,0); ew.setHours(0,0,0,0);
                    if(d >= sw && d <= ew) isTaskInPeriod = true;
                }
            }

            if (isTaskInPeriod) {
                const title = `"${(task.title || '').replace(/"/g, '""')}"`;
                const aiStr = aiTools.size > 0 ? Array.from(aiTools).join(' / ') : '无';
                csvContent += `${task.id},${title},${task.project},${task.status},${task.due_date || '未定'},${taskHours.toFixed(1)},${aiStr}\n`;
                hasData = true;
            }
        });

        btn.disabled = false; txt.innerText = "导出本期绩效报表 (CSV)";

        if(!hasData) return window.showAlert('导出失败', '当前选定周期内没有您的工单或工时记录！', 'error');

        const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' }); 
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        const periodLabel = currentView === 'month' ? `${year}年${month+1}月` : (currentView === 'year' ? `${year}年` : `第XX周`);
        link.setAttribute('download', `我的设计绩效台账_${periodLabel}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        window.showToast('导出成功', 'Excel 报表已下载至本地。', 'success');
    }, 1000);
}

// ================= 🔔 消息通知引擎 =================
window.syncNotificationsFromCloud = async function() {
    if(!window.supabase) return;
    const userStr = localStorage.getItem('activeUserObj');
    if(!userStr) return;
    const currentUser = JSON.parse(userStr);
    const currentUserEn = currentUser.enName ? currentUser.enName.toLowerCase() : '';
    const isLeader = currentUserEn === 'judyzzhang' || currentUserEn === 'davidxxu';

    try {
        const { data, error } = await window.supabase.from('test_tasks').select('id, creator, assignee, status, history_json').order('created_at', { ascending: false }).limit(100);
        if(error) throw error;

        let knownHistories = JSON.parse(localStorage.getItem('known_histories_design') || '{}');
        let sysNotifs = JSON.parse(localStorage.getItem('sys_notifications') || '[]');
        let hasNew = false;

        (data || []).forEach(task => {
            const assignee = task.assignee ? task.assignee.toLowerCase() : 'none';
            if (assignee !== currentUserEn && !isLeader) return;

            let historyArr = [];
            try { historyArr = JSON.parse(task.history_json || '[]'); } catch(e){}

            const knownLen = knownHistories[task.id] || 0;
            if (historyArr.length > knownLen) {
                for(let i = knownLen; i < historyArr.length; i++) {
                    const newEvent = historyArr[i];
                    const opEnName = currentUser.enName || '';
                    const opDispName = currentUser.displayName || '';
                    if (newEvent.operator && (newEvent.operator.includes(opEnName) || newEvent.operator.includes(opDispName))) continue;
                    
                    sysNotifs.push({
                        id: new Date().getTime() + Math.random(),
                        taskId: task.id,
                        title: `💡 [${task.id}] 进展更新`,
                        desc: `${newEvent.operator || '系统'} 操作: ${newEvent.action}. ${newEvent.reply || newEvent.desc || ''}`,
                        role: 'design', 
                        read: false,
                        time: new Date().toISOString()
                    });
                    hasNew = true;
                }
                knownHistories[task.id] = historyArr.length;
            }
        });

        if (hasNew) {
            localStorage.setItem('known_histories_design', JSON.stringify(knownHistories));
            localStorage.setItem('sys_notifications', JSON.stringify(sysNotifs));
        }
        window.loadNotifications();
    } catch(e) {}
}

window.loadNotifications = function() {
    const userStr = localStorage.getItem('activeUserObj');
    if(!userStr) return;
    const user = JSON.parse(userStr);
    const enName = user.enName ? user.enName.toLowerCase() : '';
    const isLeader = enName === 'judyzzhang' || enName === 'davidxxu';

    let sysNotifs = JSON.parse(localStorage.getItem('sys_notifications') || '[]');
    let myNotifs = sysNotifs.filter(n => {
        if (n.role === 'design') return true;
        if (isLeader && n.role === 'admin') return true;
        return false;
    });
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
            notifContainer.innerHTML = '<div class="px-5 py-8 text-center text-zinc-500 text-xs">暂无新消息</div>';
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
    if (taskId && taskId !== 'KANBAN') window.location.href = `task-detail-designer.html?id=${taskId}`;
    else window.loadNotifications();
}

window.markAllAsRead = function(event) {
    if(event) event.stopPropagation();
    let sysNotifs = JSON.parse(localStorage.getItem('sys_notifications') || '[]');
    sysNotifs.forEach(n => { if (n.role === 'design' || n.role === 'admin') n.read = true; });
    localStorage.setItem('sys_notifications', JSON.stringify(sysNotifs));
    window.loadNotifications();
    window.showAlert('提示', '所有消息已标记为已读', 'success');
}

// ================= 生命周期绑定 =================
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