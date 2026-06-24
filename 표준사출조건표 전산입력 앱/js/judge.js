// judge.js — 측정값 vs 표준조건 비교 → ok / warn / out

// 한계 경계로부터 ±5% 이내면 '주의'
const WARN_MARGIN = 0.05;

function judgeValue(x, std) {
  if (std == null || std.textType) return 'empty';
  if (x === '' || x == null || isNaN(x)) return 'empty';
  const v = Number(x);
  if (v < std.lcl || v > std.ucl) return 'out';
  const range = std.ucl - std.lcl;
  if (range > 0) {
    const margin = range * WARN_MARGIN;
    if (v <= std.lcl + margin || v >= std.ucl - margin) return 'warn';
  }
  return 'ok';
}

// 일일기록 1건의 모든 측정값 → 집계
function summarize(values, standards) {
  const items = standards.items || [];
  let ok = 0, warn = 0, out = 0, total = 0;
  const list = [];
  for (const std of items) {
    if (std.textType) continue;
    const v = values[std.code];
    if (v === '' || v == null) continue;
    total++;
    const s = judgeValue(v, std);
    if (s === 'ok') ok++;
    else if (s === 'warn') { warn++; list.push({ code: std.code, name: std.name, group: std.group, value: v, status: 'warn', lcl: std.lcl, ucl: std.ucl }); }
    else if (s === 'out') { out++; list.push({ code: std.code, name: std.name, group: std.group, value: v, status: 'out', lcl: std.lcl, ucl: std.ucl }); }
  }
  return { totalParams: total, ok, warn, out, list };
}

window.Judge = { judgeValue, summarize };
