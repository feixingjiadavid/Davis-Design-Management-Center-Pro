export function pageCreativeStrategy(page){
  const title=String(page?.title||'');
  if(/封面|主视觉|首图|开场/i.test(title)) return '身份解锁主视觉：用一个强叙事场景揭晓达人身份，IP作为主动角色，标题与道具发生遮挡穿插。';
  if(/规则|TOP|排名|SKILL/i.test(title)) return '排行榜竞技场：把TOP1/2-10/11-50变成同一空间里的领奖台、榜单或奖章层级；三步参与方法形成一条连续任务路径；统计平台与周期作为场景内标签。禁止三个独立色块卡片。';
  if(/赛道|分享|文化|两条/i.test(title)) return '双路线任务场景：从同一个TIG合作社视觉中心分叉出“分享达人”和“文化大使”两条路线，用麦克风/舞台与活动/旗帜等道具区分，但保持共同背景、路径和视觉主角连接。禁止左右两个互不相干的信息框。';
  return '建立一个连续的主题场景，把信息层级嵌入道具、路径和空间关系，而不是卡片拼版。';
}
export function pageInformationArchitecture(page){
  const title=String(page?.title||'');
  const copy=(page?.copy||[]).map(String).map(x=>x.trim()).filter(Boolean);
  if(/规则|TOP|排名|SKILL/i.test(title)) return {hero:copy.slice(0,3),reward:copy.slice(3,9),meta:copy.slice(9,11),steps:copy.slice(11,14),note:copy.slice(14)};
  if(/赛道|分享|文化|两条/i.test(title)) return {hero:copy.slice(0,1),trackA:copy.slice(1,3),trackB:copy.slice(3,5)};
  return {hero:copy.slice(0,1),support:copy.slice(1,6),context:copy.slice(6)};
}
