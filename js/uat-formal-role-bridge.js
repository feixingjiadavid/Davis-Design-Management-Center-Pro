export function bridgeUatRoleToFormalIdentity() {
  if (typeof window === 'undefined') return;
  try {
    const raw = localStorage.getItem('activeUserObj');
    if (!raw) return;
    const user = JSON.parse(raw);
    const page = location.pathname.split('/').pop() || '';

    // 离开审批详情页时恢复 UAT 原始英文名，避免影响其他管理统计与通知。
    if (page !== 'task-detail-requester.html' && user.__uatOriginalEnName) {
      const restored = { ...user, enName: user.__uatOriginalEnName };
      delete restored.__uatOriginalEnName;
      localStorage.setItem('activeUserObj', JSON.stringify(restored));
      window.__uatFormalLeaderBridge = false;
      return;
    }

    if (page !== 'task-detail-requester.html') return;

    const enName = String(user?.enName || '').toLowerCase();
    const accountType = String(user?.account_type || '').toLowerCase();
    const role = String(user?.role || '').toLowerCase();
    const isUatLeader = accountType === 'uat_leader' || role === 'leader' || enName === 'uat.leader' || Boolean(user.__uatOriginalEnName);
    if (!isUatLeader) return;

    // 正式系统历史代码以 judyzzhang 识别领导。这里只做 UAT 页面内兼容映射，
    // 不修改 Supabase Auth 账号、邮箱或数据库用户记录。
    const original = user.__uatOriginalEnName || user.enName || 'uat.leader';
    const bridged = {
      ...user,
      __uatOriginalEnName: original,
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
