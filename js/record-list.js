window.PAGE_TYPE = 'req'; 

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
    const nameEl = document.getElementById('sidebar-name');
    if(nameEl) nameEl.innerText = user.displayName || user.cnName || user.enName;
    const roleEl = document.getElementById('sidebar-role');
    if(roleEl) roleEl.innerText = user.role || '系统成员';
    
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

// ================= 数据拉取与表格渲染 =================
window.loadTasksFromCloud = async function() {
    if(!window.supabase) return;
    const currentUser = window.initRBAC();
    if(!currentUser) return;
    const currentUserEn = currentUser.enName ? currentUser.enName.toLowerCase() : '';
    const isSuperAdmin = currentUserEn === 'davidxxu' || currentUserEn === 'judyzzhang';

    try {
        const { data, error } = await window.supabase.from(window.DB_TABLE).select('*').order('created_at', { ascending: false });
        if(error) throw error;

        const tbody = document.getElementById('recordTableBody');
        tbody.innerHTML = '';
        
        let renderCount = 0;
        let projectSet = new Set(); 

        (data || []).forEach(task => {
            const creator = task.creator || '';
            const isOwner = creator === currentUser.displayName || creator === currentUser.cnName || creator === currentUser.enName || creator === currentUser.enName.toLowerCase();
            
            if(!isOwner && !isSuperAdmin) return;

            if(task.project) projectSet.add(task.project);

            let sColor, sText, sIcon, doingFlag;
            const isFinished = ['completed','archived','terminated'].includes(task.status);
            
            switch(task.status) {
                case 'rejected': 
                    sColor = 'rose'; sText = '需求被打回修改'; doingFlag = 'doing';
                    sIcon = `<span class="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse"></span>`; break;
                case 'reviewing': 
                    sColor = 'emerald'; sText = '方案待验收'; doingFlag = 'doing';
                    sIcon = `<span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>`; break;
                case 'pending_accept': 
                    sColor = 'sky'; sText = '待设计确认接单'; doingFlag = 'doing';
                    sIcon = `<svg class="animate-spin h-3 w-3 text-sky-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>`; break;
                case 'pending_approval': 
                    sColor = 'amber'; sText = '领导审批框架中'; doingFlag = 'doing';
                    sIcon = `<svg class="animate-spin h-3 w-3 text-amber-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>`; break;
                case 'processing': 
                    sColor = 'orange'; sText = '设计制作中'; doingFlag = 'doing';
                    sIcon = `<svg class="animate-spin h-3 w-3 text-orange-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>`; break;
                case 'completed': 
                case 'archived': 
                    sColor = 'zinc'; sText = '✓ 已完结归档'; doingFlag = 'done';
                    sIcon = ``; break;
                case 'terminated': 
                    sColor = 'rose'; sText = '已强行终止 (废弃)'; doingFlag = 'done';
                    sIcon = ``; break;
                default: 
                    sColor = 'sky'; sText = '待排期统筹'; doingFlag = 'doing';
                    sIcon = `<span class="w-1.5 h-1.5 rounded-full bg-sky-400"></span>`; 
            }

            let isUrgent = false;
            let dateText = task.due_date || '未定';
            if(task.due_date && !isFinished) {
                const due = new Date(task.due_date);
                const today = new Date();
                due.setHours(0,0,0,0); today.setHours(0,0,0,0);
                const diffDays = (due - today) / (1000 * 60 * 60 * 24);
                if(diffDays <= 2 && diffDays >= -999) isUrgent = true;
            }
            const dateCol = isFinished ? 'text-zinc-500' : (isUrgent ? 'text-rose-500 font-bold' : 'text-sky-400 font-bold');

            const displayAssignee = (task.assignee && task.assignee !== 'none') ? task.assignee : '暂未分配';
            const avatText = displayAssignee !== '暂未分配' ? displayAssignee.substring(0,2).toUpperCase() : '?';
            const avatCol = displayAssignee !== '暂未分配' ? 'bg-indigo-900 text-indigo-200' : 'bg-zinc-800 text-zinc-400';

            const badgeHtml = `<span class="bg-${sColor}-500/10 text-${sColor}-400 border border-${sColor}-500/20 px-2.5 py-1 rounded text-[11px] font-bold flex items-center w-max gap-1.5">${sIcon}${sText}</span>`;

            let btnHtml = '';
            if(task.status === 'reviewing' && isOwner) {
                btnHtml = `<button class="text-[12px] text-indigo-400 font-bold hover:text-indigo-300 transition-colors btn-press">去验收</button>`;
            } else if (isFinished) {
                btnHtml = `<button class="text-[12px] text-indigo-400/80 font-bold hover:text-indigo-300 transition-colors flex items-center justify-end gap-1 ml-auto btn-press">去查看 <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg></button>`;
            } else {
                if (isSuperAdmin) {
                    const urgeTarget = ['pending_approval'].includes(task.status) ? '文哥' : task.assignee;
                    btnHtml = `<button onclick="window.urgeTask(event, this, '${urgeTarget}')" class="text-[12px] text-indigo-400 bg-indigo-500/10 px-3 py-1.5 rounded-lg hover:bg-indigo-500/20 transition-colors btn-press ml-auto">督导催办</button>`;
                } else {
                    btnHtml = `<button class="text-[12px] text-zinc-500 hover:text-zinc-300 transition-colors btn-press">查看进度</button>`;
                }
            }

            const rowHtml = `
                <tr data-status="${doingFlag}" data-project="${task.project || 'other'}" class="table-row-hover ${isFinished ? 'opacity-60' : ''}" onclick="window.location.href='task-detail-requester.html?id=${task.id}'">
                    <td class="py-4 px-6 font-mono font-bold text-zinc-400">${task.id}</td>
                    <td class="py-4 px-6 font-medium text-zinc-100 max-w-xs truncate" title="${task.title}">${task.title}</td>
                    <td class="py-4 px-6 text-zinc-400">${task.project || '--'}</td>
                    <td class="py-4 px-6 ${dateCol}">${dateText}</td>
                    <td class="py-4 px-6">
                        <div class="flex items-center gap-2">
                            <div class="w-6 h-6 rounded-full ${avatCol} flex items-center justify-center text-[10px] font-bold shrink-0">${avatText}</div>
                            <span class="text-[13px] text-zinc-300">${displayAssignee}</span>
                        </div>
                    </td>
                    <td class="py-4 px-6">${badgeHtml}</td>
                    <td class="py-4 px-6 text-right">${btnHtml}</td>
                </tr>
            `;
            tbody.insertAdjacentHTML('beforeend', rowHtml);
            renderCount++;
        });

        document.getElementById('table-loading').classList.add('hidden');
        document.getElementById('table-stats').innerText = `找到 ${renderCount} 条匹配记录`;

        if(projectSet.size > 0) {
            const sel = document.getElementById('projectFilter');
            let selHtml = `<option value="all">所有归属项目</option>`;
            Array.from(projectSet).forEach(p => {
                selHtml += `<option value="${p}">${p}</option>`;
            });
            sel.innerHTML = selHtml;
        }

    } catch (err) {
        console.error(err);
        document.getElementById('table-loading').innerHTML = `<p class="text-rose-500 font-bold">数据拉取失败</p><p class="text-xs text-zinc-500">${err.message}</p>`;
    }
}

// ================= 表格筛选联动逻辑 =================
window.filterTable = function() {
    const input = document.getElementById("searchInput").value.toLowerCase();
    const projectFilter = document.getElementById("projectFilter").value;
    const statusFilter = document.getElementById("statusFilter").value;
    
    const tbody = document.getElementById("recordTableBody");
    const trs = tbody.getElementsByTagName("tr");
    
    let visibleCount = 0;

    for (let i = 0; i < trs.length; i++) {
        const tr = trs[i];
        const rowStatus = tr.getAttribute('data-status');
        const rowProject = tr.getAttribute('data-project');
        
        const idText = tr.getElementsByTagName("td")[0].textContent.toLowerCase();
        const titleText = tr.getElementsByTagName("td")[1].textContent.toLowerCase();
        const userText = tr.getElementsByTagName("td")[4].textContent.toLowerCase();
        
        const matchSearch = idText.includes(input) || titleText.includes(input) || userText.includes(input);
        const matchProject = projectFilter === 'all' || rowProject === projectFilter;
        const matchStatus = statusFilter === 'all' || rowStatus === statusFilter;

        if (matchSearch && matchProject && matchStatus) {
            tr.style.display = "";
            visibleCount++;
        } else {
            tr.style.display = "none";
        }
    }

    const emptyState = document.getElementById('emptyState');
    const tableStats = document.getElementById('table-stats');
    
    if(visibleCount === 0) {
        emptyState.classList.remove('hidden');
        emptyState.classList.add('flex');
        tableStats.innerText = `找到 0 条匹配记录`;
    } else {
        emptyState.classList.add('hidden');
        emptyState.classList.remove('flex');
        tableStats.innerText = `显示匹配的 ${visibleCount} 条记录`;
    }
}

window.urgeTask = function(event, btn, target) {
    event.stopPropagation();
    btn.innerHTML = '✓ 已发送';
    btn.className = "text-[12px] bg-zinc-800 text-zinc-500 px-3 py-1.5 rounded-lg ml-auto cursor-not-allowed";
    btn.disabled = true;
    window.showToast('催办通知已发送', `已向 ${target} 发送加急提醒。`, 'success');
}

// ================= Excel 导出模块 =================
window.exportExcel = function(btn) {
    const icon = btn.querySelector('.export-icon');
    const text = btn.querySelector('.export-text');
    
    btn.disabled = true;
    icon.innerHTML = `<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>`;
    icon.classList.add('animate-spin', 'text-indigo-400');
    text.innerText = "数据抓取中...";
    
    window.showToast('开始生成报表', '系统正在拉取最新的历史提单记录...', 'info');

    setTimeout(() => {
        btn.disabled = false;
        icon.classList.remove('animate-spin', 'text-indigo-400');
        icon.innerHTML = `<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line>`;
        text.innerText = "导出记录报表";

        const tbody = document.getElementById("recordTableBody");
        const trs = tbody.getElementsByTagName("tr");
        
        if (trs.length === 0) {
            return window.showToast('导出失败', '当前没有任何数据可导出！', 'error');
        }

        let csvContent = "工单编号,需求标题,归属项目,期望交付日,执行人,当前状态\n";
        let hasData = false;

        for (let i = 0; i < trs.length; i++) {
            const tr = trs[i];
            if(tr.style.display !== "none") {
                const tds = tr.getElementsByTagName("td");
                if (tds.length >= 6) {
                    const id = tds[0].textContent.trim();
                    const title = `"${tds[1].textContent.trim().replace(/"/g, '""')}"`; 
                    const project = tds[2].textContent.trim();
                    const date = tds[3].textContent.trim();
                    const assignee = `"${tds[4].innerText.replace(/\n/g, ' ').trim()}"`;
                    const status = `"${tds[5].innerText.replace(/\n/g, ' ').trim()}"`;

                    csvContent += `${id},${title},${project},${date},${assignee},${status}\n`;
                    hasData = true;
                }
            }
        }

        if(!hasData) return window.showToast('导出失败', '当前筛选条件下没有可导出的数据！', 'error');

        const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' }); 
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `戴维斯需求台账_${new Date().toISOString().slice(0,10)}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        window.showToast('导出成功', 'Excel 报表已下载至本地。', 'success');
    }, 1000);
}

// 统一在页面渲染完成后，挂载后台雷达和交互
document.addEventListener('DOMContentLoaded', () => {
    if(window.supabase) {
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
    }
});