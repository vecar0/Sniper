// 점수·별 계산. 기획서 ②의 표를 그대로 따른다. 결과는 100점 만점으로 환산.
import { SCORE, STARS } from '../config/balance.js';

export function computeScore(w, win) {
  const s = w.stats;
  const hostages = w.countKind('hostage');
  const suspects = w.countKind('suspect');
  const dummies = w.countKind('dummy');
  const rows = [];
  const add = (label, n, per) => { if (n) rows.push({ label, n, per, pts: n * per }); };
  add('인질 생존 확보', s.hostagesSecured, SCORE.hostageSecured);
  if (hostages > 0 && s.hostagesSecured === hostages) add('인질 전원 생존 보너스', 1, SCORE.allHostagesBonus);
  add('용의자 체포', s.arrests, SCORE.arrest);
  add('용의자 사살', s.kills, SCORE.kill);
  add('표적판 명중', s.dummies, SCORE.dummyHit);
  add('증거물 회수', s.evidence, SCORE.evidence);
  add('대원 부상', s.squadInjured, SCORE.squadInjured);
  add('정당하지 않은 사살', s.unjustified, SCORE.unjustified);
  add('민간인·인질 피격', s.innocentShots, SCORE.innocentShot);
  const limit = w.mission.timeLimit || 300;
  if (win && w.time <= limit * 0.5) add('시간 보너스', 1, SCORE.timeBonus);
  const earned = rows.reduce((a, r) => a + r.pts, 0);
  const max = hostages * SCORE.hostageSecured + (hostages ? SCORE.allHostagesBonus : 0)
    + suspects * (SCORE.arrest + SCORE.evidence) + dummies * SCORE.dummyHit + SCORE.timeBonus;
  const score = win ? Math.max(0, Math.min(100, Math.round((100 * earned) / max))) : 0;
  return { rows, earned, max, score, stars: starsFor(score, win), violations: s.violations.slice() };
}

export function starsFor(score, win) {
  if (!win) return 0;
  return STARS.filter((t) => score >= t).length;
}
