export function bridgeUatRoleToFormalIdentity() {
  if (typeof window === 'undefined') return;
  try {
    const raw = localStorage.getItem('activeUserObj');
    if (!raw) return;
    const user = JSON.parse(raw);
    const enName = String(user?.enName || '').toLowerCase();
    const accountType = String(user?.account_type || '').toLowerCase();
    const role = String(user?.role || '').toLowerCase();
    const isUatLeader = accountType === 'uat_leader' || role === 'leader' || enName === 'uat.leader';
    if (!isUatLeader) return;

    // 正式系统历史代码以 judyzzhang 识别领导。UAT 仅做前端身份映射，
    // 不修改 Supabase Auth 账号、邮箱或真实用户记录。
    const bridged = {
      ...user,
      __uatOriginalEnName: user.enName || 'uat.leader',
      enName: 'judyzzhang',
      account_type: 'uat_leader',
      perms: Array.from(new Set([...(Array.isArray(user.perms) ? user.perms : []), 'req', 'admin'])),
    };
    localStorage.setItem('activeUserObj', JSON.stringify(bridged));
    window.__uatFormalLeaderBridge = true;
  } catch (error) {
    console.warn('UAT formal leader bridge failed:', error);
  }
}

bridgeUatRoleToFormalIdentity();
