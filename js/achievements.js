/** 14 个成就 */
export const ACHIEVEMENTS = [
  { id: 'first_ride', icon: '🚲', name: '首次出海', desc: '开始你的海岸骑行' },
  { id: 'dusk_rider', icon: '🌅', name: '黄昏骑手', desc: '在黄昏光线中骑行' },
  { id: 'night_ride', icon: '🌙', name: '星夜飞驰', desc: '进入星夜时段' },
  { id: 'first_fish', icon: '🐟', name: '鱼跃入门', desc: '成功抓到第一条鱼' },
  { id: 'combo_5', icon: '🔥', name: '连续捕手', desc: '连续抓到 5 条鱼' },
  { id: 'wing_spread', icon: '🦅', name: '海风展翅', desc: '展开双翅抬前轮' },
  { id: 'big_air', icon: '⚡', name: '腾空而起', desc: '完成一次跳跃' },
  { id: 'speed_demon', icon: '💨', name: '极速狂飙', desc: '速度达到 28 km/h' },
  { id: 'lane_master', icon: '↔️', name: '变道达人', desc: '累计变道 30 次' },
  { id: 'cinema', icon: '🎬', name: '电影大师', desc: '切换到电影运镜' },
  { id: 'pov', icon: '👁️', name: '鹈鹕视角', desc: '使用第一人称视角' },
  { id: 'auto_fish', icon: '🤖', name: '自动巡航', desc: '自动驾驶时抓到鱼' },
  { id: 'rhythm', icon: '🎵', name: '节奏大师', desc: '持续骑行 45 秒' },
  { id: 'legend', icon: '🏆', name: '海岸传奇', desc: '累计抓到 20 条鱼' },
];

export function createAchievements(onUnlock) {
  const unlocked = new Set();
  const stats = {
    fish: 0,
    combo: 0,
    bestCombo: 0,
    laneChanges: 0,
    distance: 0,
    rideTime: 0,
    maxSpeed: 0,
  };

  function unlock(id) {
    if (unlocked.has(id)) return false;
    const def = ACHIEVEMENTS.find((a) => a.id === id);
    if (!def) return false;
    unlocked.add(id);
    onUnlock?.(def);
    return true;
  }

  function tick(events) {
    // events: { speed, dayT, jumped, wing, camMode, autopilot, fishCaught, laneChanged, dt }
    if (events.started) unlock('first_ride');
    if (events.dayT !== undefined) {
      if (events.dayT < 0.18) unlock('dusk_rider');
      if (events.dayT > 0.35 && events.dayT < 0.8) unlock('night_ride');
    }
    if (events.fishCaught) {
      stats.fish += 1;
      stats.combo += 1;
      stats.bestCombo = Math.max(stats.bestCombo, stats.combo);
      unlock('first_fish');
      if (stats.combo >= 5) unlock('combo_5');
      if (stats.fish >= 20) unlock('legend');
      if (events.autopilot) unlock('auto_fish');
    } else if (events.comboBreak) {
      stats.combo = 0;
    }
    if (events.jumped) unlock('big_air');
    if (events.wing) unlock('wing_spread');
    if (events.speed !== undefined) {
      stats.maxSpeed = Math.max(stats.maxSpeed, events.speed);
      if (events.speed >= 28) unlock('speed_demon');
    }
    if (events.laneChanged) {
      stats.laneChanges += 1;
      if (stats.laneChanges >= 30) unlock('lane_master');
    }
    if (events.camMode === 'cinematic') unlock('cinema');
    if (events.camMode === 'pov') unlock('pov');
    if (events.dt) {
      stats.rideTime += events.dt;
      if (stats.rideTime >= 45) unlock('rhythm');
    }
  }

  function progress() {
    return { unlocked: unlocked.size, total: ACHIEVEMENTS.length, stats, unlockedIds: [...unlocked] };
  }

  return { unlock, tick, progress, unlocked, stats };
}
