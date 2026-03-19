// 假设 supabase-config.js 仍在你的根目录
import { supabase } from '../supabase-config.js';

// 暴露 supabase 给全局，防止报错
window.supabase = supabase;

// ================= 登录页逻辑 (login.html) =================
window.showForgotModal = function() { 
    document.getElementById('forgot-modal').classList.remove('hidden'); 
    setTimeout(() => { 
        document.getElementById('forgot-modal').classList.remove('opacity-0'); 
        document.getElementById('forgot-content').classList.remove('scale-95'); 
    }, 10); 
}

window.hideForgotModal = function() { 
    const modal = document.getElementById('forgot-modal'); 
    modal.classList.add('opacity-0'); 
    document.getElementById('forgot-content').classList.add('scale-95'); 
    setTimeout(() => { modal.classList.add('hidden'); }, 300); 
}

window.handleLogin = async function(e) {
    e.preventDefault();
    if(!window.supabase) return alert("云端服务未连接！");
    const enName = document.getElementById('log-en').value.trim().toLowerCase();
    const pwd = document.getElementById('log-pwd').value;
    const realEmail = enName + '@webank.com';

    const btn = document.getElementById('login-btn');
    btn.innerText = "云端验证中...";
    btn.disabled = true;

    // 调用 Supabase 官方鉴权
    const { data, error } = await window.supabase.auth.signInWithPassword({ email: realEmail, password: pwd });

    if (error) { 
        alert("账号或密码错误！"); 
        btn.innerText = "进入控制台"; 
        btn.disabled = false; 
        return; 
    }

    // 核心要求：登录后写入 metadata，跳转大厅
    localStorage.setItem('activeUserObj', JSON.stringify(data.user.user_metadata));
    window.location.href = 'index.html'; 
}

// ================= 注册页逻辑 (register.html) =================
window.showCustomModal = function(title, descHtml) {
    const overlay = document.getElementById('custom-modal-overlay');
    const content = document.getElementById('custom-modal-content');
    const icon = document.getElementById('modal-icon');
    
    document.getElementById('modal-title').innerText = title;
    document.getElementById('modal-desc').innerHTML = descHtml;
    
    overlay.classList.remove('hidden');
    void overlay.offsetWidth; 
    
    overlay.classList.remove('opacity-0');
    content.classList.remove('scale-95', 'opacity-0');
    
    icon.classList.remove('hidden');
    icon.classList.add('animate-check');

    let count = 3;
    const btnSpan = document.getElementById('btn-countdown');
    btnSpan.innerText = `去登录 (${count}s)`;
    
    const timer = setInterval(() => {
        count--;
        if(count > 0) {
            btnSpan.innerText = `去登录 (${count}s)`;
        } else {
            clearInterval(timer);
            window.location.href = 'login.html';
        }
    }, 1000);
}

window.handleRegister = async function(e) {
    e.preventDefault();
    
    if(!window.supabase) {
        return alert("云端服务未连接，请确保您使用 Live Server 打开此页面！");
    }

    const enName = document.getElementById('reg-en').value.trim().toLowerCase();
    const cnName = document.getElementById('reg-cn').value.trim();
    const nickName = document.getElementById('reg-nick').value.trim();
    const pwd = document.getElementById('reg-pwd').value;

    let perms = ['req', 'design']; 
    let roleDesc = '行政 / 业务岗';
    let color = 'bg-zinc-800';

    if (enName === 'judyzzhang') {
        perms = ['req', 'admin']; 
        roleDesc = '部门领导';
        color = 'bg-rose-700';
    } else if (enName === 'davidxxu') {
        perms = ['req', 'design', 'admin']; 
        roleDesc = '系统管理员';
        color = 'bg-indigo-600';
    }

    const displayName = nickName || cnName;
    const avatarName = cnName.substring(0, 1).toUpperCase(); 
    const realEmail = enName + '@webank.com';

    const btn = document.getElementById('register-btn');
    const originalText = btn.innerText;
    btn.innerText = "云端写入中...";
    btn.disabled = true;

    const { data, error } = await window.supabase.auth.signUp({
        email: realEmail,
        password: pwd,
        options: {
            data: {
                enName: enName,
                cnName: cnName,
                displayName: displayName,
                perms: perms,
                role: roleDesc,
                avatar: avatarName,
                color: color
            }
        }
    });

    btn.innerText = originalText;
    btn.disabled = false;

    if (error) {
        alert("注册失败：" + (error.message.includes('already registered') ? "该企微账号已被注册！" : error.message));
        return;
    }
    
    window.showCustomModal(
        "🎉 注册成功", 
        `欢迎 <span class="text-white font-bold">${displayName}</span> 加入系统。<br>您的系统权限已被分配为：<br><span class="inline-block mt-3 px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-indigo-400 font-bold">${roleDesc}</span>`
    );
}