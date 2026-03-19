window.PAGE_TYPE = 'design';
window.activeMonthFilter = 'all';

// ================= 高定弹窗引擎 (覆盖为设计方橙色主题) =================
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
        icon.className = "w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0";
        icon.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
    } else if(type === 'info') {
        icon.className = "w-8 h-8 rounded-full bg-orange-500/20 text-orange-400 flex items-center justify-center shrink-0";
        icon.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>`;
    } else {
        icon.className = "w-8 h-8 rounded-full bg-rose-500/20 text-rose-500 flex items-center justify-center shrink-0";
        icon.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`;
    }
    toast.classList.remove('hidden');
    setTimeout(() => { toast.classList.add('hidden'); }, 3000);
}

// ================= 基础交互 =================
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

window.initRBAC = function() {
    const userStr = localStorage.getItem('activeUserObj');
    if (!userStr) { window.location.href = 'login.html'; return false; }
    const user = JSON.parse(userStr);

    if (!(user.perms || []).includes(window.PAGE_TYPE)) {
        window.showAlert("权限拦截", "您没有执行层做图权限，为您退回大厅。", "danger");
        setTimeout(()=> window.location.href = 'index.html', 1500);
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
            html += `<div class="flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-white/5 text-zinc-400 hover:text-white cursor-pointer btn-press transition-colors" onclick="window.location.href='manager-workspace.html'"><div class="w-7 h-7 rounded-lg bg-fuchsia-500/10 flex items-center justify-center text-fuchsia-400"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="3" y1="9" x2="21" y2="9"></line><line x1="9" y1="21" x2="9" y2="21"></line></svg></div><span class="text-[13px] font-medium">管理方 (统筹/大盘)</span></div>`; 
        }
        menuContainer.innerHTML = html;
    }

    const triggerBtn = document.getElementById('identityBtn');
    if (triggerBtn) { triggerBtn.innerHTML = `<span class="text-orange-500 font-black flex items-center gap-1.5"><span class="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse"></span></span> 身份: 设计方 (当前) <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="text-zinc-500 ml-1"><polyline points="6 9 12 15 18 9"></polyline></svg>`; }

    return user;
}

window.formatDateToDisplay = function(dateStr) {
    if (!dateStr) return '--';
    const d = new Date(dateStr);
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

// ================= 💡 核心：全量拉取过稿资产 =================
window.loadAssetsFromCloud = async function() {
    if(!window.supabase) return;
    const currentUser = window.initRBAC();
    if(!currentUser) return;
    const currentUserEn = currentUser.enName ? currentUser.enName.toLowerCase() : '';
    const isSuperAdmin = currentUserEn === 'davidxxu' || currentUserEn === 'judyzzhang';

    try {
        const { data, error } = await window.supabase.from(window.DB_TABLE)
            .select('id, title, project, created_at, creator, assignee, channels, history_json, source_file_link')
            .in('status', ['completed', 'archived'])
            .order('created_at', { ascending: false });

        if(error) throw error;

        const container = document.getElementById('assets-container');
        container.innerHTML = '';
        let renderCount = 0;
        
        let groupedAssets = {};

        (data || []).forEach(task => {
            const taskAssignee = task.assignee ? task.assignee.toLowerCase() : 'none';
            const isMyDesignTask = taskAssignee === currentUserEn;

            if (!isSuperAdmin && !isMyDesignTask) return;

            let finalImg = '';
            let finalSourceLink = task.source_file_link || '';
            let endDate = task.created_at; 
            
            try {
                const historyArr = JSON.parse(task.history_json || '[]');
                for(let i = historyArr.length - 1; i >= 0; i--) {
                    if(historyArr[i].action === 'submit_draft') {
                        if(!finalImg && historyArr[i].img_url) finalImg = historyArr[i].img_url;
                        if(!finalSourceLink && historyArr[i].source_link) finalSourceLink = historyArr[i].source_link;
                    }
                    if(historyArr[i].action === 'complete' || historyArr[i].action === 'approve_draft') {
                        endDate = historyArr[i].created_at || historyArr[i].time || endDate;
                    }
                }
                if (endDate === task.created_at && historyArr.length > 0) {
                    endDate = historyArr[historyArr.length - 1].created_at || historyArr[historyArr.length - 1].time || endDate;
                }
            } catch(e){}

            if (!finalImg) return; 

            const d = new Date(endDate);
            const label = `${d.getFullYear()}年 ${d.getMonth() + 1}月`;
            const sortKey = d.getFullYear() * 100 + d.getMonth(); 
            const searchKey = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}`;

            if(!groupedAssets[sortKey]) {
                groupedAssets[sortKey] = { label: label, searchKey: searchKey, tasks: [] };
            }

            task._finalImg = finalImg;
            task._finalSourceLink = finalSourceLink;
            task._startDateStr = window.formatDateToDisplay(task.created_at);
            task._endDateStr = window.formatDateToDisplay(endDate);

            groupedAssets[sortKey].tasks.push(task);
            renderCount++;
        });

        const dateDropdownList = document.getElementById('date-dropdown');
        if (dateDropdownList) {
            let dropHtml = `<div class="py-1">`;
            dropHtml += `<button onclick="window.setMonthFilter('all', '全部月份')" class="w-full text-left px-5 py-2.5 text-[13px] text-zinc-300 hover:bg-white/5 hover:text-white transition-colors">全部月份</button>`;
            
            for (let y = 2026; y >= 2024; y--) {
                for (let m = 12; m >= 1; m--) {
                    const key = (y * 100 + (m - 1)).toString();
                    const label = `${y}年 ${m}月`;
                    dropHtml += `<button onclick="window.setMonthFilter('${key}', '${label}')" class="w-full text-left px-5 py-2.5 text-[13px] text-zinc-300 hover:bg-white/5 hover:text-white transition-colors">${label}</button>`;
                }
            }
            dropHtml += `</div>`;
            dateDropdownList.innerHTML = dropHtml;
        }

        const sortedKeys = Object.keys(groupedAssets).sort((a, b) => b - a);
        sortedKeys.forEach(key => {
            const group = groupedAssets[key];
            
            let sectionHtml = `
            <div class="w-full flex flex-col month-section" data-month-key="${key}">
                <div class="flex items-center gap-3 mb-6 border-b border-white/10 pb-4 pl-1">
                    <h3 class="text-xl font-bold text-white">${group.label}</h3>
                    <span class="text-xs font-mono text-zinc-500 bg-white/5 px-2 py-0.5 rounded border border-white/10">${group.tasks.length} 个资产</span>
                </div>
                <div class="w-full columns-1 md:columns-2 lg:columns-3 xl:columns-4 gap-6 space-y-6">
            `;

            group.tasks.forEach(task => {
                let tagsHtml = '';
                let tagsArr = [];
                if(task.channels && task.channels.length > 0) {
                    try {
                        const arr = typeof task.channels === 'string' ? JSON.parse(task.channels) : task.channels;
                        tagsArr = arr;
                    }catch(e){}
                }
                tagsArr.forEach(t => {
                    tagsHtml += `<span class="text-[10px] bg-sky-500/10 text-sky-400 border border-sky-500/20 px-2 py-0.5 rounded truncate max-w-[120px]">${t}</span>`;
                });
                if(!tagsHtml) tagsHtml = `<span class="text-[10px] bg-zinc-800 border border-zinc-700 px-2 py-0.5 rounded text-zinc-400">通用物料</span>`;

                let downloadBtnHtml = '';
                if (task._finalSourceLink) {
                    let href = task._finalSourceLink.trim();
                    if(!href.match(/^https?:\/\//i) && !href.startsWith('//')) href = 'http://' + href;
                    downloadBtnHtml = `<button onclick="event.stopPropagation(); window.open('${href}', '_blank')" class="absolute top-4 right-4 w-10 h-10 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-orange-500 hover:scale-110 transition-all btn-press opacity-0 group-hover:opacity-100 z-20 backdrop-blur-md border border-white/10" title="提取源文件"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg></button>`;
                }

                const targetUrl = `task-detail-designer.html?id=${task.id}`;
                const searchStr = `${group.label} ${group.searchKey} ${task.title} ${task.project} ${task.creator} ${tagsArr.join(' ')}`;

                sectionHtml += `
                    <div class="asset-card bg-[#121217] rounded-2xl border border-white/5 overflow-hidden group cursor-pointer shadow-lg relative" data-search="${searchStr}" onclick="window.location.href='${targetUrl}'">
                        ${downloadBtnHtml}
                        <div class="bg-zinc-900 relative overflow-hidden min-h-[150px]">
                            <img src="${task._finalImg}" class="w-full object-cover group-hover:scale-105 transition-transform duration-500">
                        </div>
                        <div class="p-5 flex flex-col gap-3">
                            <div>
                                <h3 class="text-[14px] font-bold text-zinc-100 mb-1 leading-snug group-hover:text-orange-400 transition-colors">${task.title}</h3>
                                <p class="text-[10px] text-zinc-500 font-mono">${task.id}</p>
                            </div>
                            
                            <div class="bg-[#09090b] rounded-xl p-3 border border-white/5 space-y-2">
                                <div class="flex justify-between items-center text-[11px]">
                                    <span class="text-zinc-500 flex items-center gap-1"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg> 归属项目</span>
                                    <span class="text-zinc-300 font-medium truncate max-w-[120px]" title="${task.project}">${task.project || '--'}</span>
                                </div>
                                <div class="flex justify-between items-center text-[11px]">
                                    <span class="text-zinc-500 flex items-center gap-1"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg> 需求方</span>
                                    <span class="text-orange-400 font-bold truncate max-w-[120px]" title="${task.creator}">${task.creator || '未知'}</span>
                                </div>
                                <div class="flex justify-between items-center text-[11px] pt-1.5 border-t border-white/5">
                                    <span class="text-zinc-500 flex items-center gap-1"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg> 流转周期</span>
                                    <span class="text-emerald-500/80 font-mono tracking-tight">${task._startDateStr.slice(5)} ~ ${task._endDateStr.slice(5)}</span>
                                </div>
                            </div>

                            <div class="flex gap-1.5 flex-wrap pt-1">
                                ${tagsHtml}
                            </div>
                        </div>
                    </div>
                `;
            });

            sectionHtml += `</div></div>`; 
            container.insertAdjacentHTML('beforeend', sectionHtml);
        });

        document.getElementById('assets-loading').classList.add('hidden');
        
        if(renderCount === 0) {
            document.getElementById('emptyState').style.display = 'flex';
        }

    } catch (err) {
        console.error(err);
        document.getElementById('assets-loading').innerHTML = `<p class="text-rose-500 font-bold">数据拉取失败</p><p class="text-xs text-zinc-500">${err.message}</p>`;
    }
}

// ================= 💡 月份切换与超级检索 =================
window.toggleDateDropdown = function() {
    document.getElementById('date-dropdown').classList.toggle('hidden');
}

window.setMonthFilter = function(key, label) {
    window.activeMonthFilter = key;
    document.getElementById('current-date-text').innerText = label;
    document.getElementById('date-dropdown').classList.add('hidden');
    window.filterAssets();
}

window.filterAssets = function() {
    const inputEl = document.getElementById("asset-search");
    const input = inputEl.value.toLowerCase().trim();
    const clearBtn = document.getElementById("clear-search-btn");
    
    if (input.length > 0) clearBtn.classList.remove('hidden');
    else clearBtn.classList.add('hidden');

    const sections = document.querySelectorAll('.month-section');
    let globalVisibleCount = 0;

    sections.forEach(sec => {
        const secMonthKey = sec.dataset.monthKey;
        
        if (window.activeMonthFilter !== 'all' && window.activeMonthFilter !== secMonthKey) {
            sec.style.display = "none";
            return;
        }

        const cards = sec.querySelectorAll('.asset-card');
        let secVisibleCount = 0;

        cards.forEach(card => {
            const searchStr = card.getAttribute('data-search').toLowerCase();
            if (searchStr.includes(input)) {
                card.style.display = "";
                secVisibleCount++;
                globalVisibleCount++;
            } else {
                card.style.display = "none";
            }
        });

        if (secVisibleCount === 0) {
            sec.style.display = "none";
        } else {
            sec.style.display = "flex";
        }
    });

    if(globalVisibleCount === 0) {
        document.getElementById('emptyState').style.display = 'flex';
        document.getElementById('emptyStateText').innerText = window.activeMonthFilter === 'all' ? '没有找到匹配的资产' : '该月份下暂无任何资产';
    } else {
        document.getElementById('emptyState').style.display = 'none';
    }
}

window.clearAssetSearch = function() {
    const inputEl = document.getElementById("asset-search");
    inputEl.value = "";
    window.filterAssets();
    inputEl.focus();
}

// ================= 🔔 全局消息通知 =================
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
                            <h4 class="text-[13px] font-bold text-white flex items-center gap-2 group-hover:text-sky-400 transition-colors">
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
    window.showAlert("提示", "所有消息已标记为已读", "success");
}

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
            const dateWrap = document.getElementById('date-selector-wrapper');
            const dateDrop = document.getElementById('date-dropdown');
            if (dateWrap && dateDrop && !dateWrap.contains(e.target)) dateDrop.classList.add('hidden');
        });

        window.loadNotifications();
    }
});