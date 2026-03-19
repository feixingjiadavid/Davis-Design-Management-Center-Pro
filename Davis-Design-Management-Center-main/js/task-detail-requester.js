// ================= 基础配置与全局变量 =================
const urlParams = new URLSearchParams(window.location.search);
const currentTaskId = urlParams.get('id');
let globalTaskData = null;
let globalHistoryArr = [];  
let rejectCountLimit = 5; 
let currentRejectCount = 0;
let currentUser = null;
let isRequesterMode = false; 

const safeSetTxt = (id, txt) => { const el = document.getElementById(id); if (el) el.innerText = txt; };

// 覆盖通用 Toast，使用专属的定制图标
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

// ================= 系统初始化 =================
window.initApp = async function() {
    const userStr = localStorage.getItem('activeUserObj');
    if (!userStr) { window.location.href = 'login.html'; return; }
    currentUser = JSON.parse(userStr);
    
    document.getElementById('sidebar-avatar').innerText = currentUser.avatar || '?';
    document.getElementById('sidebar-name').innerText = currentUser.displayName || currentUser.cnName || currentUser.enName;
    
    if(!currentTaskId) { window.showAlert("错误", "非法访问：未找到需求单号！", "danger"); setTimeout(() => window.location.href = 'index.html', 1500); return; }

    const checkAndLoad = setInterval(() => {
        if(window.supabase) { clearInterval(checkAndLoad); fetchTaskData(); }
    }, 100);
    setTimeout(() => clearInterval(checkAndLoad), 5000); 
}

async function fetchTaskData() {
    try {
        const { data, error } = await window.supabase.from(window.DB_TABLE).select('*').eq('id', currentTaskId).single();
        if(error || !data) { window.showAlert("错误", "需求拉取失败或已被撤销！", "danger"); setTimeout(() => window.location.href = 'index.html', 1500); return; }
        
        globalTaskData = data;
        try { globalHistoryArr = JSON.parse(data.history_json || '[]'); } catch(e) { globalHistoryArr = []; }
        
        calculateRejectThreshold();
        renderStaticInfo();
        renderVersionHistory(); 
        renderResourceSummary(); 
        renderSmartActionPanel();
        renderTimeline();

    } catch(e) { console.error(e); window.showToast("数据加载失败", e.message, "error"); }
}

function calculateRejectThreshold() {
    currentRejectCount = 0;
    globalHistoryArr.forEach(h => {
        if(h.is_rejected === true || (h.action && h.action.startsWith('reject'))) currentRejectCount++;
    });
}

// ================= DOM 渲染引擎 =================
function renderStaticInfo() {
    const d = globalTaskData;
    safeSetTxt('req-id', d.id || '--');
    safeSetTxt('req-title-display', d.title || '无标题');
    safeSetTxt('dt-project', d.project || '--');
    safeSetTxt('dt-date', d.due_date || '--');
    safeSetTxt('dt-creator', d.creator || '系统记录');
    safeSetTxt('dt-assignee', (d.assignee && d.assignee !== 'none') ? d.assignee : '暂未分配');

    const descHTML = (d.full_desc || '暂无描述').replace(/\n/g, '<br>');
    document.getElementById('req-desc-display').innerHTML = descHTML;

    if(d.link) {
        document.getElementById('dt-link-container').classList.remove('hidden');
        document.getElementById('dt-link').innerHTML = `<a href="${d.link}" target="_blank" class="text-sky-400 hover:underline break-all">${d.link}</a>`;
    }
    if(d.file_name) {
        const attachEl = document.getElementById('attachment-container');
        if (d.file_data) {
            attachEl.innerHTML = `<button onclick="window.downloadBase64Attachment('${d.file_name}', '${d.file_data}')" class="text-[11px] bg-white/5 text-indigo-300 px-3 py-1.5 rounded-lg border border-white/10 hover:bg-white/10 flex items-center gap-1.5 transition-colors btn-press"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"></path></svg> 下载甲方提单附件：${d.file_name}</button>`;
        } else {
            attachEl.innerHTML = `<p class="text-[11px] text-zinc-500 italic mt-2 flex items-center gap-1">📎 提单附带文件名：${d.file_name} (无文件实体)</p>`;
        }
    }
}

function renderResourceSummary() {
    let stats = {};
    globalHistoryArr.forEach(h => {
        if (h.action === 'submit_framework' || h.action === 'submit_draft') {
            let op = h.operator || '未知设计师';
            if (!stats[op]) stats[op] = { hours: 0, tools: new Set() };
            stats[op].hours += parseFloat(h.work_hours || 0);
            if (h.ai_tools && Array.isArray(h.ai_tools)) h.ai_tools.forEach(t => stats[op].tools.add(t));
        }
    });

    const panel = document.getElementById('resource-summary-panel');
    let html = `<h3 class="text-[14px] font-bold text-white mb-4 border-b border-white/5 pb-3 flex items-center gap-2"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#f97316" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg> 累计资源投入大盘</h3>`;
    
    if (Object.keys(stats).length === 0) {
        html += `<p class="text-xs text-zinc-500">暂无投入记录</p>`;
    } else {
        html += `<div class="space-y-3">`;
        for (let op in stats) {
            let toolsArray = Array.from(stats[op].tools);
            let toolsText = toolsArray.length > 0 ? toolsArray.join(', ') : '纯手绘 / 未使用';
            html += `
            <div class="bg-white/5 border border-white/10 p-3.5 rounded-xl">
                <div class="flex justify-between items-center mb-2.5">
                    <span class="text-[13px] font-bold text-orange-400">${op}</span>
                    <span class="text-[13px] font-black text-white font-mono bg-white/10 px-2 py-0.5 rounded shadow-inner">${stats[op].hours} <span class="text-[10px] text-zinc-400 font-normal">h</span></span>
                </div>
                <p class="text-[11px] text-zinc-400 truncate" title="${toolsText}">🛠️ 工具: <span class="text-emerald-400">${toolsText}</span></p>
            </div>
            `;
        }
        html += `</div>`;
    }
    panel.innerHTML = html;
    panel.classList.remove('hidden');
}

function renderVersionHistory() {
    const container = document.getElementById('version-history-container');
    const block = document.getElementById('version-history-block');
    
    let submissions = [];
    for(let i=0; i<globalHistoryArr.length; i++) {
        let h = globalHistoryArr[i];
        if(h.action === 'submit_framework' || h.action === 'submit_draft') {
            let fate = 'pending'; 
            let fateReason = '';
            for(let j = i + 1; j < globalHistoryArr.length; j++) {
                let nextH = globalHistoryArr[j];
                if (nextH.action.startsWith('reject_') || nextH.is_rejected) {
                    fate = 'rejected'; fateReason = nextH.reply || nextH.desc; break;
                }
                if (nextH.action.startsWith('approve_') || nextH.action === 'complete' || (nextH.reply && !nextH.is_rejected)) {
                    fate = 'approved'; fateReason = nextH.reply; break;
                }
                if (nextH.action.startsWith('submit_')) { break; }
            }
            submissions.push({ ...h, fate, fateReason });
        }
    }

    if(submissions.length === 0) {
        block.classList.add('hidden');
        return;
    }

    block.classList.remove('hidden');
    let html = '';
    
    [...submissions].reverse().forEach((sub) => {
        let badgeCol = sub.fate === 'approved' ? 'emerald' : (sub.fate === 'rejected' ? 'rose' : 'amber');
        let badgeTxt = sub.fate === 'approved' ? '已过审 / 验收' : (sub.fate === 'rejected' ? '被打回' : '等待审核中');
        let typeTxt = sub.action === 'submit_framework' ? '框架方案' : '正式定稿';
        let toolsArr = sub.ai_tools || [];
        let toolsTxt = toolsArr.length > 0 ? toolsArr.join('、') : '纯手绘 / 未填';

        let sourceLinkHtml = '';
        if (sub.source_link) {
            let href = sub.source_link.trim();
            if(!href.match(/^https?:\/\//i) && !href.startsWith('//')) href = 'http://' + href;
            sourceLinkHtml = `
                <a href="${href}" target="_blank" class="mt-3 inline-flex items-center gap-1.5 text-[11px] text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-3 py-1.5 rounded-lg hover:bg-indigo-500/20 transition-colors w-fit btn-press">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>
                    提取提交的源文件
                </a>
            `;
        }

        html += `
            <div class="bg-[#16161d] border border-white/5 rounded-2xl p-5 relative overflow-hidden flex gap-6 hover:border-${badgeCol}-500/30 transition-colors group shadow-md">
                <div class="absolute right-0 top-0 bg-${badgeCol}-500/10 text-${badgeCol}-500 text-[10px] font-bold px-3 py-1 rounded-bl-xl border-b border-l border-${badgeCol}-500/20">${badgeTxt}</div>
                
                <div class="w-[280px] aspect-video bg-[#09090b] rounded-xl border border-white/10 overflow-hidden relative shadow-inner p-1 flex items-center justify-center shrink-0 cursor-pointer" onclick="window.openPreview('${sub.img_url}')">
                    <img src="${sub.img_url}" class="max-w-full max-h-full object-contain group-hover:scale-[1.02] transition-transform">
                    <div class="absolute bottom-2 right-2 bg-black/60 text-white text-[10px] px-2 py-1 rounded backdrop-blur-sm pointer-events-none">点击看大图</div>
                </div>
                
                <div class="flex-1 flex flex-col justify-center space-y-3">
                    <div>
                        <h4 class="text-[15px] font-bold text-white mb-1 flex items-center gap-2">
                            ${typeTxt} <span class="bg-white/10 px-2 py-0.5 rounded text-[11px] font-mono text-zinc-300 shadow-sm">${sub.version || 'v-X'}</span>
                        </h4>
                        <p class="text-[11px] text-zinc-500">执行人: <span class="text-orange-400 font-bold">${sub.operator || '未知'}</span> <span class="mx-2">|</span> 提交时间: ${new Date(sub.created_at || sub.time).toLocaleString()}</p>
                    </div>
                    
                    <div class="grid grid-cols-2 gap-4 bg-white/5 p-3 rounded-xl border border-white/5">
                        <div>
                            <p class="text-[10px] text-zinc-500 mb-1 flex items-center gap-1"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg> 消耗工时</p>
                            <p class="text-[14px] font-black text-white font-mono">${sub.work_hours || 0} <span class="text-[10px] text-zinc-500 font-normal">小时</span></p>
                        </div>
                        <div>
                            <p class="text-[10px] text-zinc-500 mb-1 flex items-center gap-1"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg> 借助工具</p>
                            <p class="text-[12px] font-bold text-emerald-400 truncate" title="${toolsTxt}">${toolsTxt}</p>
                        </div>
                    </div>
                    
                    <div class="text-[12px] text-zinc-400 bg-[#09090b] p-3 rounded-lg border border-white/5">
                        <span class="font-bold text-zinc-300">📝 交付说明:</span> ${sub.desc || '未填写'}
                    </div>

                    ${sourceLinkHtml}
                    
                    ${sub.fate === 'rejected' ? `<div class="text-[12px] text-rose-400 bg-rose-500/10 p-3 rounded-lg border border-rose-500/20"><span class="font-bold">💥 被驳回原因:</span> ${sub.fateReason || '无详细意见'}</div>` : ''}
                    ${sub.fate === 'approved' ? `<div class="text-[12px] text-emerald-400 bg-emerald-500/10 p-3 rounded-lg border border-emerald-500/20"><span class="font-bold">✅ 过审意见:</span> ${sub.fateReason || '直接通过'}</div>` : ''}
                </div>
            </div>
        `;
    });
    container.innerHTML = html;
}

function renderSmartActionPanel() {
    const status = globalTaskData.status;
    const enName = currentUser.enName.toLowerCase();
    const dispName = currentUser.displayName || currentUser.cnName || currentUser.enName;
    
    const isCreator = (dispName === globalTaskData.creator || enName === (globalTaskData.creator || '').toLowerCase());
    const isLeader = enName === 'judyzzhang';
    const isSuperAdmin = enName === 'davidxxu';
    
    const hBadge = document.getElementById('header-status-badge');
    const hTag = document.getElementById('header-identity-tag');
    const sRole = document.getElementById('sidebar-role');
    const pnl = document.getElementById('smart-action-panel');
    const dGlow = document.getElementById('dynamic-glow');
    
    let sText = '', sCol = '', sIcon = '';
    let pnlHtml = '';
    let pnlClasses = 'bg-[#121217] border border-white/5 rounded-3xl p-7 shadow-2xl relative overflow-hidden transition-all duration-300';

    if(isSuperAdmin) { hTag.innerText = "身份: 超管上帝视角"; sRole.innerText = "管理员"; }
    else if(isLeader) { hTag.innerText = "身份: 领导审批者"; sRole.innerText = "管理层"; }
    else if(isCreator) { hTag.innerText = "身份: 需求提单方"; sRole.innerText = "需求方"; }
    else { hTag.innerText = "身份: 外部旁观者"; sRole.innerText = "只读访问"; }

    if (status === 'pending' || status === 'pending_accept') {
        sCol = 'sky'; sText = status==='pending'?'排队统筹中':'待设计接单';
        sIcon = `<svg class="animate-spin h-3.5 w-3.5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>`;
        
        if(isCreator || isSuperAdmin) {
            pnlClasses = 'bg-[#121217] border border-white/5 rounded-3xl p-7 shadow-2xl relative overflow-hidden';
            pnlHtml = `
                <div class="absolute right-0 top-0 bottom-0 w-1.5 bg-sky-500/50"></div>
                <h3 class="text-[16px] font-bold text-sky-400 mb-2">等待设计接单确认</h3>
                <p class="text-[12px] text-zinc-400 leading-relaxed mb-6">系统正在统筹分配中，如果发现需求填写有误，您可以在对方接单前随时撤销本需求并重新发起。</p>
                <button onclick="window.actionCancel()" class="w-full py-3.5 bg-rose-500/10 hover:bg-rose-500 text-rose-500 hover:text-white border border-rose-500/30 rounded-xl text-[13px] font-bold btn-press transition-all">撤销该需求</button>
            `;
        } else {
            pnlHtml = `<div class="text-center py-6 text-zinc-500 text-sm">此阶段只需等待设计排期。</div>`;
        }

    } else if (status === 'processing') {
        sCol = 'orange'; sText = '设计制作赶稿中';
        sIcon = `<svg class="animate-spin h-3.5 w-3.5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>`;
        
        if(isCreator || isSuperAdmin || isLeader) {
            pnlClasses = 'bg-[#18181b] border border-orange-500/20 rounded-3xl p-7 shadow-2xl relative overflow-hidden';
            pnlHtml = `
                <div class="absolute right-0 top-0 bottom-0 w-1.5 bg-orange-500"></div>
                <div class="w-14 h-14 bg-orange-500/10 text-orange-500 rounded-full flex items-center justify-center mb-5"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg></div>
                <h3 class="text-[16px] font-bold text-white mb-3">设计师爆肝作图中</h3>
                <p class="text-[12px] text-zinc-400 leading-relaxed mb-6">设计师 ${globalTaskData.assignee || ''} 已接手该单，正在根据您的需求产出设计图。若进度缓慢，可点击下方按钮催促。</p>
                <button onclick="window.actionUrge(this)" class="w-full py-3.5 bg-[#1a1a24] hover:bg-zinc-800 border border-zinc-700 text-zinc-300 hover:text-white rounded-xl text-[13px] font-bold transition-all btn-press flex items-center justify-center gap-2"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"></path></svg>发送催办系统通知</button>
            `;
        } else {
            pnlHtml = `<div class="text-center py-6 text-zinc-500 text-sm">系统处理中，旁观者无操作权限。</div>`;
        }

    } else if (status === 'pending_approval') {
        sCol = 'amber'; sText = '领导审批框架大方向中';
        sIcon = `<svg class="animate-spin h-3.5 w-3.5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>`;
        
        if(isLeader) {
            pnlClasses = 'bg-gradient-to-b from-[#291b0c] to-[#121217] border border-amber-500/40 rounded-3xl p-7 shadow-[0_20px_40px_-10px_rgba(245,158,11,0.2)] relative overflow-hidden';
            pnlHtml = `
                <div class="absolute right-0 top-0 bottom-0 w-1.5 bg-amber-500"></div>
                <h3 class="text-[16px] font-bold text-amber-500 mb-2 flex items-center gap-2">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
                    框架大方向审批
                </h3>
                <p class="text-[12px] text-amber-500/80 leading-relaxed mb-6">作为主管，请对左侧画廊中最新提交的设计框架进行大方向把关。通过后设计师将继续推进正稿；若方向偏离请及时打回。</p>
                <div class="space-y-4">
                    <button onclick="window.openActionModal('approve')" class="w-full py-3.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-[13px] font-bold shadow-[0_5px_15px_rgba(16,185,129,0.3)] btn-press transition-all flex items-center justify-center gap-2">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"></polyline></svg> 同意并推进正稿
                    </button>
                    <button onclick="isRequesterMode=false; window.openActionModal('reject')" class="w-full py-3.5 bg-rose-600/10 hover:bg-rose-500 hover:text-white text-rose-500 border border-rose-500/30 rounded-xl text-[13px] font-bold btn-press transition-all flex items-center justify-center gap-2">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg> 偏离需求，打回重画
                    </button>
                </div>
            `;
        } else {
            pnlClasses = 'bg-[#18181b] border border-zinc-700 rounded-3xl p-7 shadow-2xl relative overflow-hidden';
            pnlHtml = `
                <div class="absolute right-0 top-0 bottom-0 w-1.5 bg-zinc-500"></div>
                <h3 class="text-[16px] font-bold text-white mb-3">框架方案审核中</h3>
                <p class="text-[12px] text-zinc-400 leading-relaxed mb-6">设计已提交中期框架方案，请等待主管 (丹楠姐) 审批把关结果。</p>
                <button onclick="window.actionUrge(this)" class="w-full py-3.5 bg-[#1a1a24] hover:bg-zinc-800 border border-zinc-700 text-zinc-400 hover:text-white rounded-xl text-[13px] font-bold transition-all btn-press">发送催办红点给主管</button>
            `;
        }

    } else if (status === 'reviewing') {
        sCol = 'emerald'; sText = '正式设计稿待验收';
        sIcon = `<svg class="animate-pulse h-3.5 w-3.5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" stroke="currentColor" d="M5 13l4 4L19 7"></path></svg>`;
        
        if(isCreator) {
            pnlClasses = 'bg-gradient-to-b from-[#061e13] to-[#121217] border border-emerald-500/40 rounded-3xl p-7 shadow-[0_20px_40px_-10px_rgba(16,185,129,0.2)] relative overflow-hidden';
            
            let limitHtml = '';
            if(currentRejectCount >= rejectCountLimit) {
                limitHtml = `
                    <div class="bg-rose-500/10 border border-rose-500/30 rounded-xl p-4 mb-5">
                        <p class="text-[12px] text-rose-400 font-bold mb-1">⚠️ 警告：系统熔断保护触发</p>
                        <p class="text-[11px] text-rose-400/80 leading-relaxed">当前需求打回修改次数已达 <span class="font-black">${rejectCountLimit}次</span> 上限。为保障排期流转，普通修改通道已关闭。</p>
                    </div>
                    <div class="space-y-3">
                        <button onclick="window.submitReqAccept()" class="w-full py-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-[14px] font-bold shadow-[0_5px_15px_rgba(16,185,129,0.3)] btn-press transition-all flex items-center justify-center gap-2">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"></polyline></svg> 妥协验收此版本并完结
                        </button>
                        <button onclick="window.actionTerminate()" class="w-full py-4 bg-rose-600 hover:bg-rose-500 text-white shadow-[0_5px_15px_rgba(244,63,94,0.3)] rounded-xl text-[13px] font-bold btn-press transition-all">
                            强行终止该单 (废弃)，重建新单
                        </button>
                    </div>
                `;
            } else {
                limitHtml = `
                    <p class="text-[12px] text-emerald-500/80 leading-relaxed mb-6">设计师已交付最终稿件(见左侧最新版本)。如无问题请确认验收，系统将自动结算完结。若细节仍需调整，可打回重修。</p>
                    <div class="space-y-4">
                        <button onclick="window.submitReqAccept()" class="w-full py-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-[14px] font-bold shadow-[0_5px_15px_rgba(16,185,129,0.3)] btn-press transition-all flex items-center justify-center gap-2">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"></polyline></svg> 满意，确认验收并完结
                        </button>
                        <button onclick="isRequesterMode=true; window.openActionModal('reject')" class="w-full py-3.5 bg-rose-600/10 hover:bg-rose-500 hover:text-white text-rose-500 border border-rose-500/30 rounded-xl text-[13px] font-bold btn-press transition-all flex justify-center items-center gap-1.5">
                            细节不佳，打回重修 <span class="text-[10px] opacity-80">(已修 ${currentRejectCount}/${rejectCountLimit} 次)</span>
                        </button>
                    </div>
                `;
            }

            pnlHtml = `
                <div class="absolute right-0 top-0 bottom-0 w-1.5 bg-emerald-500"></div>
                <h3 class="text-[16px] font-bold text-emerald-400 mb-2 flex items-center gap-2">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg> 正式设计稿待您验收
                </h3>
                ${limitHtml}
            `;
        } else if (isSuperAdmin) {
             pnlClasses = 'bg-[#18181b] border border-zinc-700 rounded-3xl p-7 shadow-2xl relative overflow-hidden';
             pnlHtml = `
                <div class="absolute right-0 top-0 bottom-0 w-1.5 bg-zinc-500"></div>
                <h3 class="text-[16px] font-bold text-white mb-3">正式稿验收中</h3>
                <p class="text-[12px] text-zinc-400 leading-relaxed mb-6">正式稿已送达，等待发起人 ${globalTaskData.creator} 验收。</p>
                <button onclick="window.actionUrge(this)" class="w-full py-3.5 bg-[#1a1a24] hover:bg-zinc-800 border border-zinc-700 text-zinc-400 hover:text-white rounded-xl text-[13px] font-bold transition-all btn-press">催促发起人验收</button>
             `;
        } else {
            pnlHtml = `<div class="text-center py-6 text-zinc-500 text-sm">等待甲方最终验收结果。</div>`;
        }

    } else if (status === 'rejected') {
        sCol = 'rose'; sText = '已被打回重修中';
        sIcon = `<svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`;
        
        pnlClasses = 'bg-[#18181b] border border-zinc-700 rounded-3xl p-7 shadow-2xl relative overflow-hidden';
        pnlHtml = `
            <div class="absolute right-0 top-0 bottom-0 w-1.5 bg-rose-500"></div>
            <div class="w-14 h-14 bg-rose-500/10 text-rose-500 rounded-full flex items-center justify-center mb-5"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg></div>
            <h3 class="text-[16px] font-bold text-white mb-3">方案已被打回重修</h3>
            <p class="text-[12px] text-zinc-400 leading-relaxed mb-6">当前设计存在不符预期的地方已被驳回，请留意下方时间轴中指出的打回意见。目前正在等待设计师重新提交新版本。</p>
            <button onclick="window.actionUrge(this)" class="w-full py-3.5 bg-[#1a1a24] hover:bg-zinc-800 border border-zinc-700 text-zinc-400 hover:text-white rounded-xl text-[13px] font-bold transition-all btn-press">催促设计尽快重传</button>
        `;

    } else {
        sCol = status==='terminated'?'rose':'zinc'; sText = status==='terminated'?'已强行终止 (废弃)':'任务已圆满结项';
        sIcon = status==='terminated'?`<svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`:`<svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
        
        pnlClasses = 'bg-[#121217] border border-white/10 rounded-3xl p-7 shadow-xl relative overflow-hidden opacity-60';
        pnlHtml = `
            <div class="absolute right-0 top-0 bottom-0 w-1.5 bg-${sCol}-500"></div>
            <h3 class="text-[16px] font-bold text-white mb-3">${sText}</h3>
            <p class="text-[12px] text-zinc-400 leading-relaxed mb-6">该需求的所有生命周期已闭环。源文件及设计稿已数字存档，若需下载请点击左侧画廊中对应版本的提取按钮。</p>
            <button onclick="window.location.href='index.html'" class="w-full py-3.5 bg-[#1a1a24] border border-zinc-700 text-zinc-400 hover:bg-zinc-800 hover:text-white rounded-xl text-[13px] font-bold transition-all btn-press">返回大厅</button>
        `;
    }

    hBadge.innerHTML = `${sIcon} ${sText}`;
    hBadge.className = `bg-${sCol}-500/20 text-${sCol}-400 border border-${sCol}-500/30 px-3 py-1.5 rounded-lg text-[12px] font-bold flex items-center gap-1.5 shadow-[0_0_10px_rgba(var(--tw-colors-${sCol}-500),0.2)]`;
    hBadge.classList.remove('hidden');
    dGlow.className = `glow-bg bg-${sCol}-900/10`;
    
    pnl.className = pnlClasses;
    pnl.innerHTML = pnlHtml;
}

function renderTimeline() {
    let html = '';
    
    if (globalHistoryArr && globalHistoryArr.length > 0) {
        let revHistory = [...globalHistoryArr].reverse();
        revHistory.forEach(h => {
            let dotColor = 'zinc', actionTxt = h.action, subTxt = '';
            if(h.is_rejected) { dotColor = 'rose'; actionTxt = '被打回修改'; subTxt = `原因: ${h.reply || h.desc || ''}`; }
            else if(h.action === 'approve_framework') { dotColor = 'emerald'; actionTxt = '领导审批通过'; subTxt = h.reply || '同意'; }
            else if(h.action === 'submit_draft') { dotColor = 'sky'; actionTxt = '设计师上传了正稿版本 ' + h.version; }
            else if(h.action === 'submit_framework') { dotColor = 'amber'; actionTxt = '设计师上传了框架版本 ' + h.version; }
            else if(h.action === 'complete') { dotColor = 'emerald'; actionTxt = '甲方验收成功完结'; }
            else if(h.action === 'terminate') { dotColor = 'rose'; actionTxt = '任务被强行终止'; subTxt = h.reply || ''; }
            else if(h.action === 'transfer') { dotColor = 'orange'; actionTxt = '任务发生转单'; subTxt = h.reply || ''; }
            
            html += `
            <div class="relative flex gap-4 z-10 pb-6 group">
               <div class="timeline-line group-last:hidden"></div>
               <div class="w-5 h-5 rounded-full bg-[#121217] border-[2px] border-${dotColor}-500 flex items-center justify-center shrink-0 z-10 mt-0.5 shadow-[0_0_8px_rgba(var(--tw-colors-${dotColor}-500),0.3)]"><div class="w-1.5 h-1.5 bg-${dotColor}-500 rounded-full"></div></div>
               <div class="w-full pr-2 z-10">
                   <p class="text-[12px] font-bold text-zinc-300 flex justify-between">${actionTxt} <span class="text-[9px] text-zinc-600 font-mono font-normal">${new Date(h.created_at || h.time).toLocaleDateString()}</span></p>
                   ${subTxt ? `<p class="text-[10px] text-zinc-500 mt-1 line-clamp-2">${subTxt}</p>` : ''}
               </div>
            </div>`;
        });
    }
    html += `<div class="text-[10px] text-zinc-600 font-mono pl-9 mt-2">-- 需求创建起点 --</div>`;
    document.getElementById('task-timeline-container').innerHTML = html;
}

// ================= 行动与状态流转接口 =================
async function updateSupabaseState(newStatus, newSummary, actionPayload) {
    globalHistoryArr.push(actionPayload);
    const { error } = await window.supabase.from(window.DB_TABLE).update({
        status: newStatus, 
        summary_desc: newSummary,
        history_json: JSON.stringify(globalHistoryArr)
    }).eq('id', currentTaskId);
    
    if(error) { window.showAlert("错误", "云端状态更新失败：" + error.message, "danger"); return false; }
    return true;
}

window.actionCancel = async function() { 
    window.showConfirm("确认撤销", "确定要撤销该需求单吗？该操作会将记录彻底删除。", async () => {
        const { error } = await window.supabase.from(window.DB_TABLE).delete().eq('id', currentTaskId);
        if(error) return window.showAlert("撤销失败", error.message, "danger");
        window.showToast('已撤销', `需求单已安全删除。`, 'info');
        setTimeout(() => window.location.href='index.html', 1000); 
    }, "danger");
}

window.actionUrge = function(btn) {
    btn.innerHTML = '✓ 已发送系统强提醒';
    btn.className = "w-full py-3.5 bg-zinc-800 border border-zinc-700 text-zinc-500 rounded-xl text-[13px] font-bold cursor-not-allowed";
    btn.disabled = true;
    window.showToast('催办成功', '已向对方端推送提醒', 'success');
}

window.submitApprove = async function() {
    const notes = document.getElementById('approve-notes').value.trim();
    const btn = document.getElementById('btn-approve-submit');
    btn.disabled = true; btn.innerText = "写入同步中...";

    const payload = {
        action: 'approve_framework', operator: '丹楠姐 (领导)', time: new Date().toISOString(),
        reply: notes || '大方向没问题，同意推进正稿。', is_rejected: false, reply_by: '丹楠姐 (领导)'
    };

    if(await updateSupabaseState('processing', notes ? `领导框架已过审：${notes}` : `领导已通过框架，继续制作正稿。`, payload)) {
        window.closeActionModals(); window.showToast('审批通过', '任务已流转回设计师推进正稿。', 'success');
        setTimeout(() => window.location.reload(), 1500);
    } else { btn.disabled = false; btn.innerText = "确认通过方向"; }
}

window.submitReject = async function() {
    const reason = document.getElementById('reject-reason').value.trim();
    if(!reason) return window.showAlert("提示", "为了设计师修改清晰，打回原因必填！", "danger");
    
    const btn = document.getElementById('btn-reject-submit');
    btn.disabled = true; btn.innerText = "写入同步中...";

    const dispName = currentUser.displayName || currentUser.enName;
    const roleStr = isRequesterMode ? `${dispName} (需求方)` : '丹楠姐 (领导)';
    const actionStr = isRequesterMode ? 'reject_draft' : 'reject_framework';

    const payload = {
        action: actionStr, operator: roleStr, time: new Date().toISOString(),
        reply: reason, is_rejected: true, reply_by: roleStr
    };

    const summaryStr = isRequesterMode ? `甲方打回正式稿：${reason}` : `领导将框架打回：${reason}`;

    if(await updateSupabaseState('rejected', summaryStr, payload)) {
        window.closeActionModals(); window.showToast('已打回', '该任务已被打回修改池。', 'info');
        setTimeout(() => window.location.reload(), 1500);
    } else { btn.disabled = false; btn.innerText = "确认打回修改"; }
}

window.submitReqAccept = function() {
    const isLimit = currentRejectCount >= rejectCountLimit;
    const msg = isLimit ? "确认要妥协并以此最终版作为完结结案吗？" : "确认对当前设计正稿非常满意，同意验收并完结任务吗？";
    
    window.showConfirm("确认验收", msg, async () => {
        const dispName = currentUser.displayName || currentUser.enName;
        const payload = {
            action: 'complete', operator: `${dispName} (需求方)`, time: new Date().toISOString(),
            reply: isLimit ? '因达到修改上限，甲方妥协验收当前最后版本。' : '甲方对正稿非常满意，已验收通过！',
            is_rejected: false, reply_by: `${dispName} (需求方)`
        };

        if(await updateSupabaseState('completed', '甲方已确认验收，任务圆满完结闭环。', payload)) {
            window.showToast('任务结案', '恭喜，该任务的生命周期已全部走完！', 'success');
            setTimeout(() => window.location.reload(), 1500);
        }
    }, "success");
}

window.actionTerminate = function() {
    window.showConfirm("强行终止单据", "确定因为修改次数过多而终止此需求吗？<br><br>终止后该记录将被彻底封存归档，您需要重新在大厅发起新单。", async () => {
        const dispName = currentUser.displayName || currentUser.enName;
        const payload = {
            action: 'terminate', operator: `${dispName} (需求方)`, time: new Date().toISOString(),
            reply: '因修改次数达到上限始终无法通过，需求方主动选择熔断强行终止该单据。',
            is_rejected: true, reply_by: '系统触发熔断'
        };

        if(await updateSupabaseState('terminated', '修改次数达阈值上限，需求方已将此单强行终止归档。', payload)) {
            window.showToast('已强行终止', '单据已封存！即将为您跳转回大厅...', 'error');
            setTimeout(() => window.location.href = 'index.html', 2000);
        }
    }, "danger");
}

// 供 Modal 使用的方法绑定
window.openActionModal = function(type) {
    if(type === 'approve') {
        const approveOverlay = document.getElementById('approve-modal-overlay');
        const approveModal = document.getElementById('approve-modal');
        approveOverlay.classList.remove('hidden'); setTimeout(() => { approveOverlay.classList.remove('opacity-0'); approveModal.classList.remove('hidden'); }, 10);
    } else if (type === 'reject') {
        const rejectOverlay = document.getElementById('reject-modal-overlay');
        const rejectModal = document.getElementById('reject-modal');
        rejectOverlay.classList.remove('hidden'); setTimeout(() => { rejectOverlay.classList.remove('opacity-0'); rejectModal.classList.remove('hidden'); }, 10);
    }
}

window.closeActionModals = function() {
    const approveOverlay = document.getElementById('approve-modal-overlay');
    const approveModal = document.getElementById('approve-modal');
    const rejectOverlay = document.getElementById('reject-modal-overlay');
    const rejectModal = document.getElementById('reject-modal');
    if(approveOverlay) approveOverlay.classList.add('opacity-0'); 
    if(rejectOverlay) rejectOverlay.classList.add('opacity-0');
    setTimeout(() => { 
        if(approveOverlay) { approveOverlay.classList.add('hidden'); approveModal.classList.add('hidden'); }
        if(rejectOverlay) { rejectOverlay.classList.add('hidden'); rejectModal.classList.add('hidden'); }
    }, 300);
}

window.openPreview = function(srcUrl) {
    if(!srcUrl) return; 
    document.getElementById('modal-image').src = srcUrl;
    const modal = document.getElementById('image-preview-modal');
    modal.classList.remove('hidden'); void modal.offsetWidth; modal.style.display = 'flex'; setTimeout(() => modal.classList.add('visible'), 10);
}

window.closePreview = function() {
    const modal = document.getElementById('image-preview-modal');
    modal.classList.remove('visible'); setTimeout(() => { modal.style.display = 'none'; modal.classList.add('hidden'); }, 300);
}

window.downloadBase64Attachment = function(name, dataBase64) {
    const a = document.createElement('a'); a.href = dataBase64; a.download = name; a.click();
    window.showToast('下载成功', '原始附件提取成功', 'success');
}

// 启动入口
document.addEventListener('DOMContentLoaded', () => {
    if(window.supabase) {
        window.initApp();
    }
});