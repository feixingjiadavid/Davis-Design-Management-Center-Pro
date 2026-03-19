// ================= 配置 Coze API (V3版本) =================
const COZE_API_URL = 'https://api.coze.cn/v3/chat'; 
const COZE_PAT = 'pat_FbgsPIfAiUkR2TWqw16MZMjxeafODI93LWcy35hlJNpVnL00YD2o0ifxc90jkfct'; 
const COZE_BOT_ID = '7559104686386036777'; 

let currentUserName = 'User';
let currentUserAvatar = 'U';
let currentUserEnName = 'guest';

let sessions = [];
let currentSessionId = null;

// ================= 高定弹窗引擎 =================
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
    } else {
        colorBar.className = 'absolute top-0 left-0 right-0 h-1 bg-indigo-500';
        icon.className = 'w-8 h-8 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center shrink-0';
        icon.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>`;
    }
}

window.showDialogUI = function() {
    const overlay = document.getElementById('custom-dialog-overlay');
    const dialog = document.getElementById('custom-dialog');
    overlay.classList.remove('hidden');
    setTimeout(() => { overlay.classList.remove('opacity-0'); dialog.classList.remove('scale-95'); }, 10);
}

window.showConfirm = function(title, message, onConfirm, type="primary") {
    window.setupDialog(title, message, type);
    const btnContainer = document.getElementById('dialog-buttons');
    let btnColor = type === 'danger' ? 'bg-rose-600 hover:bg-rose-500' : 'bg-indigo-600 hover:bg-indigo-500';
    btnContainer.innerHTML = `
        <button onclick="window.closeCustomDialog()" class="flex-1 py-2.5 bg-transparent border border-zinc-700 text-zinc-400 hover:text-white rounded-xl text-[13px] font-bold transition-colors btn-press">取消</button>
        <button id="dialog-confirm-btn" class="flex-1 py-2.5 ${btnColor} text-white rounded-xl text-[13px] font-bold shadow-lg transition-all btn-press">确认</button>
    `;
    document.getElementById('dialog-confirm-btn').onclick = () => { window.closeCustomDialog(); onConfirm(); };
    window.showDialogUI();
}

window.showToast = function(title, desc) {
    const toast = document.getElementById('action-toast');
    document.getElementById('toast-title').innerText = title;
    document.getElementById('toast-desc').innerText = desc;
    toast.classList.remove('hidden');
    setTimeout(() => { toast.classList.add('hidden'); }, 3000);
}

// ================= 初始化与历史管理 =================
window.initApp = function() {
    const userStr = localStorage.getItem('activeUserObj');
    if (!userStr) { window.location.href = 'login.html'; return; }
    const user = JSON.parse(userStr);
    
    document.getElementById('sidebar-avatar').innerText = user.avatar || '?';
    document.getElementById('sidebar-name').innerText = user.displayName || user.cnName || user.enName;
    
    currentUserName = user.displayName || user.cnName || user.enName;
    currentUserAvatar = user.avatar || '?';
    currentUserEnName = user.enName || 'guest';

    loadSessions();
}

function loadSessions() {
    sessions = JSON.parse(localStorage.getItem('coze_sessions_' + currentUserEnName) || '[]');
    if (sessions.length === 0) {
        window.startNewChat();
    } else {
        renderSessionList();
        window.switchSession(sessions[0].id);
    }
}

function saveSessions() {
    localStorage.setItem('coze_sessions_' + currentUserEnName, JSON.stringify(sessions));
}

window.startNewChat = function() {
    const id = 'chat_' + new Date().getTime();
    const newSession = { id: id, title: '新对话', date: new Date().toISOString() };
    sessions.unshift(newSession); 
    saveSessions();
    window.switchSession(id);
}

window.deleteCurrentSession = function() {
    if (!currentSessionId) return;
    window.showConfirm("删除对话", "确定要彻底删除当前对话吗？此操作不可恢复。", () => {
        sessions = sessions.filter(s => s.id !== currentSessionId);
        localStorage.removeItem(currentSessionId); 
        saveSessions();
        window.showToast("删除成功", "对话记录已移除。");
        if (sessions.length === 0) window.startNewChat();
        else window.switchSession(sessions[0].id);
    }, "danger");
}

function renderSessionList() {
    const list = document.getElementById('chat-session-list');
    list.innerHTML = sessions.map(s => `
        <div onclick="window.switchSession('${s.id}')" class="p-3 rounded-xl cursor-pointer transition-colors ${s.id === currentSessionId ? 'bg-indigo-500/20 border border-indigo-500/30 text-indigo-300' : 'hover:bg-white/5 text-zinc-400 border border-transparent'} flex flex-col gap-1 group">
            <p class="text-[13px] font-bold truncate group-hover:text-white transition-colors">${s.title}</p>
            <p class="text-[10px] opacity-50 font-mono">${new Date(s.date).toLocaleDateString()}</p>
        </div>
    `).join('');
}

window.switchSession = function(id) {
    currentSessionId = id;
    renderSessionList();
    
    document.getElementById('chat-box').innerHTML = `
        <div class="flex items-start gap-4 self-start max-w-[85%]">
            <div class="w-9 h-9 rounded-full bg-indigo-600 flex items-center justify-center text-white shrink-0 shadow-[0_0_15px_rgba(79,70,229,0.3)]">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="10" rx="2"></rect><circle cx="12" cy="5" r="2"></circle><path d="M12 7v4"></path><line x1="8" y1="16" x2="8.01" y2="16"></line><line x1="16" y1="16" x2="16.01" y2="16"></line></svg>
            </div>
            <div class="flex flex-col gap-1.5">
                <span class="text-[11px] text-zinc-500 font-medium ml-1">小戴维斯</span>
                <div class="bg-[#18181b] border border-white/5 text-zinc-200 text-[14px] leading-relaxed p-5 rounded-2xl rounded-tl-sm shadow-md chat-content break-words">
                    👋 欢迎来到 TIG Design，<b>${currentUserName}</b>。我是小戴维斯，你可以找我要：<br><br>1. 公司/项目Logo、VI、源文件<br>2. 企微、邮件等渠道的 标准排版规范及尺寸等<br><br>💡 <b>试试这样问我：</b><br><span class="text-indigo-400">“请给我发一下今年年度大会的Logo矢量图链接”</span><br><span class="text-indigo-400">“企微推文的首图标准尺寸是多少？”</span>
                </div>
            </div>
        </div>`;
    
    const history = JSON.parse(localStorage.getItem(currentSessionId) || '[]');
    history.forEach(msg => appendMessageToUI(msg.role, msg.content, false));
    
    scrollToBottom();
}

// ================= UI 交互 =================
window.autoResize = function(el) {
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 150) + 'px';
}

window.handleEnter = function(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        window.sendUserMessage();
    }
}

function scrollToBottom() {
    const container = document.getElementById('chat-container');
    requestAnimationFrame(() => {
        container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
    });
}

// 💡 终极无死角 Markdown 解析引擎
function parseMessageText(text) {
    if (!text) return '';
    let html = text;

    // 1. 先保护标准 Markdown 图片，防止 URL 被后续正则破坏
    html = html.replace(/!\[([^\]]*)\]\((https?:\/\/[^\)]+)\)/g, '%%IMG_START%%$1%%IMG_SEP%%$2%%IMG_END%%');
    
    // 2. 保护标准 Markdown 链接
    html = html.replace(/\[([^\]]+)\]\((https?:\/\/[^\)]+)\)/g, '%%LINK_START%%$1%%LINK_SEP%%$2%%LINK_END%%');

    // 3. 捕捉剩余的纯文本裸露 URL (只抓取到空白符或换行符为止)
    const rawUrlRegex = /(https?:\/\/[^\s]+)/g;
    html = html.replace(rawUrlRegex, function(url) {
        return `<a href="${url}" target="_blank" class="text-indigo-400 font-bold hover:text-indigo-300 transition-colors underline underline-offset-2 break-all">${url} ↗</a>`;
    });

    // 4. 将保护好的 Markdown 图片还原为绝美的 HTML UI 渲染
    html = html.replace(/%%IMG_START%%(.*?)%%IMG_SEP%%(.*?)%%IMG_END%%/g, `<div class="mt-3 mb-4 rounded-xl overflow-hidden border border-white/10 shadow-lg bg-[#0c0c0e]/50 max-w-sm"><img src="$2" alt="$1" class="w-full h-auto object-contain cursor-zoom-in hover:opacity-90 transition-opacity" onclick="window.open('$2', '_blank')"></div>`);
    
    // 5. 将保护好的 Markdown 链接还原为防污染的安全 HTML
    html = html.replace(/%%LINK_START%%(.*?)%%LINK_SEP%%(.*?)%%LINK_END%%/g, `<a href="$2" target="_blank" class="text-indigo-400 font-bold hover:text-indigo-300 transition-colors underline underline-offset-2 break-all">$1 ↗</a>`);

    // 6. 基础排版渲染
    html = html.replace(/^### (.*$)/gim, '<h3 class="text-[15px] font-bold text-white mt-4 mb-2 flex items-center gap-2">$1</h3>');
    html = html.replace(/^## (.*$)/gim, '<h2 class="text-[16px] font-bold text-white mt-4 mb-2">$1</h2>');
    html = html.replace(/\*\*(.*?)\*\*/g, '<b class="text-white font-bold">$1</b>');
    html = html.replace(/`([^`]+)`/g, '<span class="bg-indigo-500/20 text-indigo-300 px-1.5 py-0.5 rounded font-mono text-[12px] border border-indigo-500/30 break-all">$1</span>');

    // 7. 最后再处理换行，绝不污染 URL
    html = html.replace(/\n/g, '<br>');

    return html;
}

function appendMessageToUI(role, content, saveToLocal = true) {
    const box = document.getElementById('chat-box');
    let html = '';

    if (role === 'user') {
        html = `
        <div class="flex items-start gap-4 self-end max-w-[85%] flex-row-reverse chat-bubble-enter">
            <div class="w-9 h-9 rounded-full bg-zinc-700 flex items-center justify-center text-white shrink-0 font-bold text-xs border border-white/10 shadow-lg">${currentUserAvatar}</div>
            <div class="flex flex-col gap-1.5 items-end">
                <span class="text-[11px] text-zinc-500 font-medium mr-1">${currentUserName}</span>
                <div class="bg-indigo-600 text-white text-[14px] leading-relaxed p-4 rounded-2xl rounded-tr-sm shadow-md chat-content break-words text-left">
                    ${parseMessageText(content)}
                </div>
            </div>
        </div>`;
    } else {
        html = `
        <div class="flex items-start gap-4 self-start max-w-[85%] chat-bubble-enter">
            <div class="w-9 h-9 rounded-full bg-indigo-600 flex items-center justify-center text-white shrink-0 shadow-[0_0_15px_rgba(79,70,229,0.3)]">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="10" rx="2"></rect><circle cx="12" cy="5" r="2"></circle><path d="M12 7v4"></path><line x1="8" y1="16" x2="8.01" y2="16"></line><line x1="16" y1="16" x2="16.01" y2="16"></line></svg>
            </div>
            <div class="flex flex-col gap-1.5">
                <span class="text-[11px] text-zinc-500 font-medium ml-1">小戴维斯</span>
                <div class="bg-[#18181b] border border-white/5 text-zinc-300 text-[14px] leading-relaxed p-5 rounded-2xl rounded-tl-sm shadow-md chat-content break-words">
                    ${parseMessageText(content)}
                </div>
            </div>
        </div>`;
    }

    box.insertAdjacentHTML('beforeend', html);
    scrollToBottom();

    // 💡 修复：加入防内存满溢崩溃保护 (安全气囊)
    if (saveToLocal && currentSessionId) {
        try {
            const hist = JSON.parse(localStorage.getItem(currentSessionId) || '[]');
            hist.push({ role, content });
            localStorage.setItem(currentSessionId, JSON.stringify(hist));
        } catch(e) {
            console.warn("浏览器本地存储空间已满，本条记录无法持久化保存。建议清理一下大附件草稿。");
        }
    }
}

function appendThinkingUI() {
    const box = document.getElementById('chat-box');
    const id = 'thinking-' + new Date().getTime();
    const html = `
    <div id="${id}" class="flex items-start gap-4 self-start max-w-[85%] chat-bubble-enter">
        <div class="w-9 h-9 rounded-full bg-indigo-600 flex items-center justify-center text-white shrink-0 shadow-[0_0_15px_rgba(79,70,229,0.3)]">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="10" rx="2"></rect><circle cx="12" cy="5" r="2"></circle><path d="M12 7v4"></path><line x1="8" y1="16" x2="8.01" y2="16"></line><line x1="16" y1="16" x2="16.01" y2="16"></line></svg>
        </div>
        <div class="bg-[#18181b] border border-white/5 text-zinc-200 p-4 rounded-2xl rounded-tl-sm shadow-md flex gap-1.5 items-center h-[52px] mt-5">
            <div class="w-1.5 h-1.5 bg-indigo-400 rounded-full typing-dot"></div>
            <div class="w-1.5 h-1.5 bg-indigo-400 rounded-full typing-dot"></div>
            <div class="w-1.5 h-1.5 bg-indigo-400 rounded-full typing-dot"></div>
        </div>
    </div>`;
    box.insertAdjacentHTML('beforeend', html);
    scrollToBottom();
    return id;
}

function removeThinkingUI(id) {
    const el = document.getElementById(id);
    if (el) el.remove();
}

// ================= 💡 Coze API V3 核心异步轮询引擎 =================
window.sendUserMessage = async function() {
    const inputEl = document.getElementById('chat-input');
    const btnEl = document.getElementById('btn-send');
    const text = inputEl.value.trim();
    if (!text || !currentSessionId) return;

    const currentSessionObj = sessions.find(s => s.id === currentSessionId);
    if (currentSessionObj && currentSessionObj.title === '新对话') {
        currentSessionObj.title = text.substring(0, 12) + (text.length > 12 ? '...' : '');
        saveSessions();
        renderSessionList();
    }

    inputEl.value = '';
    inputEl.style.height = 'auto'; 
    inputEl.disabled = true;
    btnEl.disabled = true;
    btnEl.classList.add('opacity-50');
    
    appendMessageToUI('user', text);
    const thinkingId = appendThinkingUI();

    try {
        // 🟢 1. 第一步：发送问题，获取 chat_id
        const requestBody = {
            bot_id: COZE_BOT_ID,
            user_id: currentSessionId, 
            stream: false, 
            auto_save_history: true,
            additional_messages: [
                { role: "user", content: text, content_type: "text" }
            ]
        };

        const chatRes = await fetch(COZE_API_URL, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${COZE_PAT}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestBody)
        });

        if (!chatRes.ok) throw new Error(`API 连接异常: ${chatRes.status}`);
        const chatData = await chatRes.json();
        
        if (chatData.code !== 0) throw new Error(chatData.msg || '发起会话失败');

        const chatId = chatData.data.id;
        const conversationId = chatData.data.conversation_id;

        // 🟢 2. 第二步：轮询等待 Coze 翻找知识库完毕 (💡 等待上限拉长到 120 秒，绝不超时报错)
        let isCompleted = false;
        let retries = 60; // 60 次 * 2秒 = 120 秒
        while (!isCompleted && retries > 0) {
            await new Promise(resolve => setTimeout(resolve, 2000)); // 每隔两秒问一次扣子
            
            const retrieveRes = await fetch(`https://api.coze.cn/v3/chat/retrieve?chat_id=${chatId}&conversation_id=${conversationId}`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${COZE_PAT}`,
                    'Content-Type': 'application/json'
                }
            });

            if (retrieveRes.ok) {
                const retrieveData = await retrieveRes.json();
                if (retrieveData.code === 0 && retrieveData.data) {
                    const status = retrieveData.data.status;
                    if (status === 'completed') {
                        isCompleted = true; // 处理完毕，跳出循环！
                    } else if (status === 'failed' || status === 'canceled') {
                        throw new Error(`智能体执行异常中止。状态码: ${status}`);
                    } else if (status === 'requires_action') {
                        throw new Error(`智能体请求外部工具授权，当前环境不支持`);
                    }
                    // 如果是 in_progress 或 created，会继续循环等下去
                }
            }
            retries--;
        }

        if (!isCompleted) throw new Error('TIMEOUT_ERROR'); 

        // 🟢 3. 第三步：确认完成后，拉取消息列表拿答案
        const msgRes = await fetch(`https://api.coze.cn/v3/chat/message/list?chat_id=${chatId}&conversation_id=${conversationId}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${COZE_PAT}`,
                'Content-Type': 'application/json'
            }
        });

        if (!msgRes.ok) throw new Error(`拉取消息失败: ${msgRes.status}`);
        const msgData = await msgRes.json();

        removeThinkingUI(thinkingId);

        if (msgData.code === 0 && msgData.data) {
            const messages = msgData.data;
            // 提取 AI 返回的 answer 内容
            const ansMsg = messages.find(m => m.type === 'answer' && m.role === 'assistant');
            if (ansMsg && ansMsg.content) {
                appendMessageToUI('assistant', ansMsg.content);
            } else {
                appendMessageToUI('assistant', '⚠️ 抱歉，小戴维斯未能从知识库匹配到相关结果，请换个描述再试一次。');
            }
        } else {
            throw new Error(msgData.msg || '解析消息列表失败');
        }
        
    } catch (error) {
        console.error("Coze API 报错:", error);
        removeThinkingUI(thinkingId);
        
        if (error.message === 'TIMEOUT_ERROR') {
            appendMessageToUI('assistant', `⚠️ **响应超时**<br>小戴维斯在知识库里翻找得太久了（超过 120 秒）。您可以尝试精简词汇，或者稍后再试一次。`);
        } else if (error.message.includes('Failed to fetch')) {
            appendMessageToUI('assistant', `❌ **连接被浏览器拦截 (CORS 跨域错误)**<br>由于安全策略，浏览器阻止了纯前端发起的请求。请安装浏览器扩展 \`Allow CORS: Access-Control-Allow-Origin\` 并开启，即可正常对话！`);
        } else {
            appendMessageToUI('assistant', `❌ **发生错误**<br>${error.message}`);
        }
    } finally {
        inputEl.disabled = false;
        btnEl.disabled = false;
        btnEl.classList.remove('opacity-50');
        inputEl.focus();
        scrollToBottom();
    }
}

document.addEventListener('DOMContentLoaded', window.initApp);