// dashboard.js — KPI + 파라메터별 트렌드 꺾은선 (테마 연동)

const Dashboard = (() => {

  let chart = null;
  let allRecords = [];

  // 그룹 라인 색상 팔레트 (여러 파라메터를 동시에 그릴 때 사용)
  const PALETTE = [
    '#2563eb', '#16a34a', '#db2777', '#ea580c', '#7c3aed', '#0891b2',
    '#ca8a04', '#dc2626', '#4f46e5', '#059669', '#9333ea', '#0d9488',
  ];

  function init() {
    const grpSel = document.getElementById('trend-group');
    grpSel.innerHTML = SCHEMA.GROUPS
      .filter(g => SCHEMA.PARAMS.some(p => p.group === g && !p.textType))
      .map(g => `<option value="${g}">${g}</option>`).join('');
    grpSel.addEventListener('change', drawTrend);
    document.getElementById('trend-start').addEventListener('change', drawTrend);
    document.getElementById('trend-end').addEventListener('change', drawTrend);
    document.getElementById('btn-trend-reset').addEventListener('click', () => {
      document.getElementById('trend-start').value = '';
      document.getElementById('trend-end').value = '';
      drawTrend();
    });
  }

  async function refresh() {
    allRecords = await Storage.loadAllRecords();
    updateKpi();
    drawTrend();
    updateRecentAlarms();
  }

  function redrawIfActive() {
    // 테마 토글 시 호출. 대시보드 탭이 활성이 아니어도 차트 객체가 있으면 재생성.
    if (chart) drawTrend();
  }

  function currentMonthKey() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }

  function recordMonthKey(rec) {
    if (rec.meta && rec.meta['년'] && rec.meta['월']) {
      return `${rec.meta['년']}-${String(rec.meta['월']).padStart(2, '0')}`;
    }
    return (rec.savedAt || '').slice(0, 7);
  }

  // 레코드 일자 키 (YYYY-MM-DD) — 메타 년/월/일 우선, 없으면 저장시각
  function recordDateKey(rec) {
    const m = rec.meta || {};
    if (m['년'] && m['월'] && m['일']) {
      const p2 = v => String(v).padStart(2, '0');
      return `${m['년']}-${p2(m['월'])}-${p2(m['일'])}`;
    }
    return (rec.savedAt || '').slice(0, 10);
  }

  function updateKpi() {
    const mk = currentMonthKey();
    const monthRecs = allRecords.filter(r => recordMonthKey(r) === mk);
    const count = monthRecs.length;
    const warn = monthRecs.reduce((s, r) => s + (r.judgement?.warn || 0), 0);
    const out  = monthRecs.reduce((s, r) => s + (r.judgement?.out  || 0), 0);
    const totalParams = monthRecs.reduce((s, r) => s + (r.judgement?.totalParams || 0), 0);
    const rate = totalParams ? (out / totalParams * 100) : 0;
    document.getElementById('kpi-count').textContent = count;
    document.getElementById('kpi-warn').textContent  = warn;
    document.getElementById('kpi-out').textContent   = out;
    document.getElementById('kpi-rate').innerHTML    = rate.toFixed(2) + '<span class="unit">%</span>';
  }

  function getFilteredRecords() {
    const start = document.getElementById('trend-start').value; // '' or YYYY-MM-DD
    const end   = document.getElementById('trend-end').value;
    const recs = allRecords.filter(r => {
      const dk = recordDateKey(r);
      if (start && dk < start) return false;
      if (end && dk > end) return false;
      return true;
    });
    // 트렌드는 시간 오름차순으로 표시
    return recs.slice().sort((a, b) => String(a.savedAt || '').localeCompare(String(b.savedAt || '')));
  }

  // 현재 테마의 CSS 변수에서 색상을 읽어옴
  function themeColors() {
    const cs = getComputedStyle(document.documentElement);
    return {
      grid: cs.getPropertyValue('--chart-grid').trim() || '#cbd5e1',
      text: cs.getPropertyValue('--chart-text').trim() || '#64748b',
      primary: cs.getPropertyValue('--primary').trim() || '#22d3ee',
      success: cs.getPropertyValue('--success').trim() || '#22c55e',
      warn: cs.getPropertyValue('--warn').trim() || '#facc15',
      danger: cs.getPropertyValue('--danger').trim() || '#ef4444',
    };
  }

  function drawTrend() {
    const group = document.getElementById('trend-group').value;
    if (!group) return;
    const c = themeColors();

    // 선택 그룹의 숫자형 + 사용 항목 전체
    const ap = StandardsTab.activeProduct();
    const items = (ap?.items || []).filter(it => it.group === group && !it.textType && it.enabled !== false);

    const recs = getFilteredRecords();
    const labels = recs.map(r => `${recordDateKey(r).slice(5)} ${(r.savedAt || '').slice(11, 16)}`.trim());

    // 항목별 라인 — 값 없는 지점은 null (spanGaps로 연결)
    const datasets = items.map((it, idx) => {
      const base = PALETTE[idx % PALETTE.length];
      const data = recs.map(r => {
        const v = r.values?.[it.code];
        return (v === '' || v == null) ? null : Number(v);
      });
      const pointColors = data.map(v => {
        if (v == null) return base;
        const s = Judge.judgeValue(v, it);
        return s === 'out' ? c.danger : s === 'warn' ? c.warn : base;
      });
      return {
        label: `${it.name} (${it.unit})`,
        data, fill: false, spanGaps: true,
        borderColor: base,
        backgroundColor: base,
        pointBackgroundColor: pointColors,
        pointBorderColor: pointColors,
        pointRadius: 4,
        pointHoverRadius: 6,
        tension: 0.2,
        borderWidth: 2,
      };
    });

    const cfg = {
      type: 'line',
      data: { labels, datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'top', labels: { color: c.text, font: { size: 11 } } },
          tooltip: { mode: 'index', intersect: false },
        },
        scales: {
          x: {
            ticks: { color: c.text, maxRotation: 60, minRotation: 30, font: { size: 10 } },
            grid: { color: c.grid },
          },
          y: {
            ticks: { color: c.text },
            title: { display: true, text: group, color: c.text },
            grid: { color: c.grid },
          },
        },
      },
    };

    const ctx = document.getElementById('trend-chart');
    if (chart) chart.destroy();
    chart = new Chart(ctx, cfg);
  }

  function updateRecentAlarms() {
    const tbody = document.querySelector('#recent-alarms tbody');
    if (!tbody) return;
    tbody.innerHTML = '';
    const items = [];
    for (let i = allRecords.length - 1; i >= 0 && items.length < 20; i--) {
      const rec = allRecords[i];
      if (!rec.values) continue;
      for (const code of Object.keys(rec.values)) {
        const std = StandardsTab.getItem(code);
        if (!std || std.textType) continue;
        const v = rec.values[code];
        if (v === '' || v == null) continue;
        const s = Judge.judgeValue(v, std);
        if (s === 'warn' || s === 'out') {
          items.push({ savedAt: rec.savedAt, name: std.name, group: std.group, v, lcl: std.lcl, ucl: std.ucl, status: s, author: rec.meta?.['이름'] || '' });
          if (items.length >= 20) break;
        }
      }
    }
    let n = 1;
    for (const it of items) {
      const tr = document.createElement('tr');
      tr.className = 'row-' + it.status;
      tr.innerHTML = `
        <td>${n++}</td>
        <td>${(it.savedAt || '').slice(5,16).replace('T',' ')}</td>
        <td>${it.group} / ${it.name}</td>
        <td>${it.v}</td>
        <td>${it.lcl} ~ ${it.ucl}</td>
        <td><span class="badge ${it.status}">${it.status === 'out' ? '이탈' : '주의'}</span></td>
      `;
      tbody.appendChild(tr);
    }
    if (!items.length) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--text-muted);padding:24px;">이탈/주의 항목 없음</td></tr>';
    }
  }

  return { init, refresh, redrawIfActive };
})();

window.Dashboard = Dashboard;
