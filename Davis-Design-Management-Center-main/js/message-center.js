let currentRole = 'req'; 
let themeColor = 'indigo'; 

// ================= 系统初始化与变色龙渲染 =================
window.initPage = function() {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has('role')) currentRole = urlParams.get('role');

    const userStr = localStorage.getItem('activeUserObj');
    if (!userStr) { window.location.href = 'login.html'; return; }
    const user = JSON.parse(userStr);

    // 💡 核心：根据不同身份动态渲染对应的颜色和菜单
    if (currentRole === 'admin') {
        themeColor = 'fuchsia';
        document.getElementById('body-container').classList.add('selection:bg-fuchsia-500/30');
        document.getElementById('bg-glow').classList.add('bg-fuchsia-900/10');
        document.getElementById('logo-box').classList.add('bg-fuchsia-600', 'shadow-[0_0_15px_rgba(217,70,239,0.3)]');
        document.getElementById('pwd-color-bar').classList.add('bg-gradient-to-r', 'from-fuchsia-500', 'to-indigo-500');
        document.getElementById('sidebar-role').innerHTML = `<span class="text-fuchsia-400 font-bold">当前视角: 管理方</span>`;
        
        document.getElementById('sidebar-menu').innerHTML = `
            <button onclick="window.location.href='manager-workspace.html'" class="w-full flex items-center gap-4 px-4 py-3.5 rounded-2xl text-zinc-400 hover:bg-white/5 hover:text-white transition-all btn-press">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="3" y1="9" x2="21" y2="9"></line><line x1="9" y1="21" x2="9" y2="9"></line></svg>
                <span class="font-medium text-[14px]">总监控制台</span>
            </button>
            <button onclick="window.location.href='manager-dashboard.html'" class="w-full flex items-center gap-4 px-4 py-3.5 rounded-2xl text-zinc-400 hover:bg-white/5 hover:text-white transition-all btn-press">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
                <span class="font-medium text-[14px]">团队效能大盘</span>
            </button>
            <button onclick="window.location.href='project-analysis.html'" class="w-full flex items-center gap-4 px-4 py-3.5 rounded-2xl text-zinc-400 hover:bg-white/5 hover:text-white transition-all btn-press">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>
                <span class="font-medium text-[14px]">项目投入分析</span>
            </button>
            <button onclick="window.location.href='org-chart.html'" class="w-full flex items-center gap-4 px-4 py-3.5 rounded-2xl text-zinc-400 hover:bg-white/5 hover:text-white transition-all btn-press">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
                <span class="font-medium text-[14px]">组织架构与账号</span>
            </button>
            <button class="w-full flex items-center gap-4 px-4 py-3.5 rounded-2xl bg-fuchsia-500/10 text-fuchsia-400 border border-fuchsia-500/20 transition-all cursor-default">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>
                <span class="font-bold text-[14px]">全局消息中心</span>
            </button>
        `;
    } else if (currentRole === 'design') {
        themeColor = 'orange';
        document.getElementById('body-container').classList.add('selection:bg-orange-500/30');
        document.getElementById('bg-glow').classList.add('bg-orange-900/5');
        document.getElementById('logo-box').classList.add('bg-orange-600', 'shadow-[0_0_15px_rgba(249,115,22,0.3)]');
        document.getElementById('pwd-color-bar').classList.add('bg-gradient-to-r', 'from-orange-500', 'to-amber-500');
        document.getElementById('sidebar-role').innerHTML = `<span class="text-orange-400 font-bold">当前视角: 设计方</span>`;
        
        document.getElementById('sidebar-menu').innerHTML = `
            <button onclick="window.location.href='assistant-workspace.html'" class="w-full flex items-center gap-4 px-4 py-3.5 rounded-2xl text-zinc-400 hover:bg-white/5 hover:text-white transition-all btn-press">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="9" y1="3" x2="9" y2="21"></line></svg>
                <span class="font-medium text-[14px]">执行看板 (Kanban)</span>
            </button>
            <button onclick="window.location.href='assistant-assets.html'" class="w-full flex items-center gap-4 px-4 py-3.5 rounded-2xl text-zinc-400 hover:bg-white/5 hover:text-white transition-all btn-press">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
                <span class="font-medium text-[14px]">我的过稿资产库</span>
            </button>
            <button onclick="window.location.href='assistant-calendar.html'" class="w-full flex items-center gap-4 px-4 py-3.5 rounded-2xl text-zinc-400 hover:bg-white/5 hover:text-white transition-all btn-press">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                <span class="font-medium text-[14px]">工时与 AI 绩效</span>
            </button>
            <button class="w-full flex items-center gap-4 px-4 py-3.5 rounded-2xl bg-orange-500/10 text-orange-400 border border-orange-500/20 transition-all cursor-default">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>
                <span class="font-bold text-[14px]">全局消息中心</span>
            </button>
        `;
    } else {
        // 默认 req 需求方
        themeColor = 'indigo';
        document.getElementById('body-container').classList.add('selection:bg-indigo-500/30');
        document.getElementById('bg-glow').classList.add('bg-indigo-900/5');
        document.getElementById('logo-box').classList.add('bg-indigo-600', 'shadow-[0_0_15px_rgba(79,70,229,0.3)]');
        document.getElementById('pwd-color-bar').classList.add('bg-gradient-to-r', 'from-indigo-500', 'to-purple-500');
        document.getElementById('sidebar-role').innerHTML = `<span class="text-indigo-400 font-bold">当前视角: 需求方</span>`;
        
        document.getElementById('sidebar-menu').innerHTML = `
            <button onclick="window.location.href='index.html'" class="w-full flex items-center gap-4 px-4 py-3.5 rounded-2xl text-zinc-400 hover:bg-white/5 hover:text-white transition-all btn-press">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="9" y1="3" x2="9" y2="21"></line></svg>
                <span class="font-medium text-[14px]">需求排号大厅</span>
            </button>
            <button onclick="window.location.href='record-list.html'" class="w-full flex items-center gap-4 px-4 py-3.5 rounded-2xl text-zinc-400 hover:bg-white/5 hover:text-white transition-all btn-press">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line></svg>
                <span class="font-medium text-[14px]">我的提单记录</span>
            </button>
            <button onclick="window.location.href='calendar.html'" class="w-full flex items-center gap-4 px-4 py-3.5 rounded-2xl text-zinc-400 hover:bg-white/5 hover:text-white transition-all btn-press">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                <span class="font-medium text-[14px]">我的需求日历</span>
            </button>
            <button class="w-full flex items-center gap-4 px-4 py-3.5 rounded-2xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 transition-all cursor-default">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>
                <span class="font-bold text-[14px]">全局消息中心</span>
            </button>
        `;
    }

    const avatarEl = document.getElementById('sidebar-avatar');
    if(avatarEl) { avatarEl.innerText = user.avatar || '?'; }
    if(document.getElementById('sidebar-name')) document.getElementById('sidebar-name').innerText = user.displayName || user.cnName || user.enName;
    
    window.loadMsgs();
}

// ================= 数据拉取与列表渲染 =================
window.loadMsgs = function() {
    let sysNotifs = JSON.parse(localStorage.getItem('sys_notifications') || '[]');
    let myNotifs = sysNotifs.filter(n => n.role === currentRole);
    myNotifs.sort((a, b) => b.id - a.id);

    const container = document.getElementById('msg-list-container');
    const badge = document.getElementById('unread-badge');

    const unreadCount = myNotifs.filter(n => !n.read).length;
    if(unreadCount > 0) {
        badge.innerText = `${unreadCount} 未读`;
        badge.classList.remove('hidden');
    } else {
        badge.classList.add('hidden');
    }

    if(myNotifs.length === 0) {
        container.innerHTML = `
            <div class="text-center py-24 opacity-50 flex flex-col items-center">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="text-zinc-500 mb-4"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>
                <p class="text-[14px] font-medium text-zinc-400">消息列表空空如也</p>
                <p class="text-[11px] text-zinc-500 mt-2">没有任何新的通知或动态</p>
            </div>`;
        return;
    }

    let html = '';
    myNotifs.forEach(n => {
        const isRead = n.read;
        const dotHtml = isRead ? `<div class="w-8 h-8 rounded-full bg-zinc-800/50 flex items-center justify-center text-zinc-600 shrink-0"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg></div>` : 
                               `<div class="w-8 h-8 rounded-full bg-${themeColor}-500/20 border border-${themeColor}-500/30 flex items-center justify-center text-${themeColor}-400 shrink-0"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg></div>`;
        
        const bgClass = isRead ? 'bg-[#121217]' : `bg-[#18181b] border-${themeColor}-500/30 shadow-[0_0_15px_rgba(var(--tw-colors-${themeColor}-500),0.05)]`;
        const titleClass = isRead ? 'text-zinc-400' : 'text-white';
        
        let targetUrl = '#';
        if (currentRole === 'req') targetUrl = `task-detail-requester.html?id=${n.taskId}`;
        else if (currentRole === 'design') targetUrl = `task-detail-designer.html?id=${n.taskId}`;
        else if (currentRole === 'admin') targetUrl = `task-detail-locked.html?id=${n.taskId}`;

        const dateStr = new Date(n.time).toLocaleString();

        html += `
        <div class="msg-card p-5 rounded-2xl flex items-start gap-4 ${bgClass}">
            ${dotHtml}
            <div class="flex-1 min-w-0">
                <div class="flex justify-between items-start mb-1.5">
                    <div class="flex items-center gap-2">
                        <span class="text-[10px] font-mono font-bold bg-white/5 px-2 py-0.5 rounded text-zinc-400 border border-white/5">${n.taskId}</span>
                        <h4 class="text-[14px] font-bold ${titleClass}">${n.title}</h4>
                    </div>
                    <span class="text-[11px] text-zinc-500 font-mono flex items-center gap-1.5"><span class="w-1.5 h-1.5 rounded-full ${isRead?'bg-zinc-700':`bg-${themeColor}-500 animate-pulse`}"></span> ${dateStr}</span>
                </div>
                <p class="text-[12px] text-zinc-400 leading-relaxed mb-3">${n.desc}</p>
                <button onclick="window.markSingleAndGo(${n.id}, '${targetUrl}')" class="text-[11px] font-bold text-zinc-300 bg-white/5 hover:bg-white/10 border border-white/5 px-3 py-1.5 rounded flex items-center gap-1.5 transition-colors w-max btn-press">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg> 点击穿梭至详情页处理
                </button>
            </div>
        </div>`;
    });
    container.innerHTML = html;
}

// ================= 状态操作机制 =================
window.markAllAsRead = function() {
    let sysNotifs = JSON.parse(localStorage.getItem('sys_notifications') || '[]');
    sysNotifs.forEach(n => { if (n.role === currentRole) n.read = true; });
    localStorage.setItem('sys_notifications', JSON.stringify(sysNotifs));
    window.loadMsgs();
}

window.markSingleAndGo = function(id, url) {
    let sysNotifs = JSON.parse(localStorage.getItem('sys_notifications') || '[]');
    let target = sysNotifs.find(n => n.id === id);
    if(target) { target.read = true; localStorage.setItem('sys_notifications', JSON.stringify(sysNotifs)); }
    window.location.href = url;
}

// ================= 基础交互 =================
window.logout = function(e) { e.stopPropagation(); localStorage.removeItem('activeUserObj'); window.location.href = 'login.html'; }
        
window.openPwdModal = function() { document.getElementById('pwd-modal-overlay').classList.remove('hidden'); setTimeout(() => { document.getElementById('pwd-modal-overlay').classList.remove('opacity-0'); document.getElementById('pwd-modal').classList.remove('hidden', 'scale-95'); }, 10); }
window.closePwdModal = function() { document.getElementById('pwd-modal-overlay').classList.add('opacity-0'); document.getElementById('pwd-modal').classList.add('scale-95'); setTimeout(() => { document.getElementById('pwd-modal-overlay').classList.add('hidden'); document.getElementById('pwd-modal').classList.add('hidden'); }, 300); }

window.goBack = function() {
    if (currentRole === 'req') window.location.href = 'index.html';
    else if (currentRole === 'design') window.location.href = 'assistant-workspace.html';
    else window.location.href = 'manager-workspace.html';
}

// 启动入口
document.addEventListener('DOMContentLoaded', window.initPage);