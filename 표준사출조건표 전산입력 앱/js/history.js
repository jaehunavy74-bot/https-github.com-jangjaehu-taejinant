// history.js — 데이터 조회 탭
// 저장된 일일 사출조건 기록을 년/월/일 · 차종/품명 으로 필터링하여 조회 + 상세보기 + 엑셀.

const HistoryTab = (() => {

  let records = [];
  let lastDetailId = null;
  const filter = { year: '', month: '', day: '', car: '', part: '' };

  function $(id) { return document.getElementById(id); }
  function metaNum(r, k) { const v = r.meta?.[k]; return (v === '' || v == null) ? null : Number(v); }
  function metaStr(r, k) { const v = r.meta?.[k]; return (v == null) ? '' : String(v); }
  function distinct(a) { return [...new Set(a)]; }
  function pad2(v) { const s = String(v); return s.length < 2 ? '0' + s : s; }
  function dateStr(r) {
    const y = metaStr(r, '년'), m = metaStr(r, '월'), d = metaStr(r, '일');
    return y ? `${y}-${pad2(m)}-${pad2(d)}` : (r.savedAt || '').slice(0, 10);
  }

  function init() {
    ['f-year', 'f-month', 'f-day', 'f-car', 'f-part'].forEach(id => {
      const el = $(id); if (el) el.addEventListener('change', onFilterChange);
    });
    $('btn-history-reset')?.addEventListener('click', resetFilters);
    $('btn-history-refresh')?.addEventListener('click', refresh);
    $('btn-history-excel')?.addEventListener('click', exportFiltered);
    $('btn-history-print')?.addEventListener('click', () => printRecord(lastDetailId));
    $('btn-history-detail-close')?.addEventListener('click', () => { $('history-detail').style.display = 'none'; });
  }

  async function refresh() {
    records = await Storage.loadAllRecords();
    // 최신순 정렬
    records = records.slice().sort((a, b) => String(b.savedAt || '').localeCompare(String(a.savedAt || '')));
    populateSelects();
    render();
  }

  function fillSelect(id, values, current) {
    const sel = $(id);
    if (!sel) return;
    sel.innerHTML = ['<option value="">전체</option>']
      .concat(values.map(v => `<option value="${v}">${v}</option>`)).join('');
    sel.value = (current && values.map(String).includes(String(current))) ? String(current) : '';
  }

  // 패싯 방식: 상위 필터에 맞춰 하위 선택지 갱신
  function populateSelects() {
    const years = distinct(records.map(r => metaNum(r, '년')).filter(v => v != null)).sort((a, b) => b - a);
    fillSelect('f-year', years, filter.year);

    const byY = records.filter(r => !filter.year || String(metaNum(r, '년')) === String(filter.year));
    const months = distinct(byY.map(r => metaNum(r, '월')).filter(v => v != null)).sort((a, b) => a - b);
    fillSelect('f-month', months, filter.month);

    const byYM = byY.filter(r => !filter.month || String(metaNum(r, '월')) === String(filter.month));
    const days = distinct(byYM.map(r => metaNum(r, '일')).filter(v => v != null)).sort((a, b) => a - b);
    fillSelect('f-day', days, filter.day);

    const cars = distinct(records.map(r => metaStr(r, '차종')).filter(Boolean)).sort();
    fillSelect('f-car', cars, filter.car);

    const byCar = records.filter(r => !filter.car || metaStr(r, '차종') === filter.car);
    const parts = distinct(byCar.map(r => metaStr(r, '품명')).filter(Boolean)).sort();
    fillSelect('f-part', parts, filter.part);
  }

  function onFilterChange(e) {
    const id = e.target.id, val = e.target.value;
    if (id === 'f-year') { filter.year = val; filter.month = ''; filter.day = ''; }
    else if (id === 'f-month') { filter.month = val; filter.day = ''; }
    else if (id === 'f-day') { filter.day = val; }
    else if (id === 'f-car') { filter.car = val; filter.part = ''; }
    else if (id === 'f-part') { filter.part = val; }
    populateSelects();
    render();
  }

  function resetFilters() {
    filter.year = filter.month = filter.day = filter.car = filter.part = '';
    populateSelects();
    render();
    $('history-detail').style.display = 'none';
  }

  function filtered() {
    return records.filter(r => {
      if (filter.year && String(metaNum(r, '년')) !== String(filter.year)) return false;
      if (filter.month && String(metaNum(r, '월')) !== String(filter.month)) return false;
      if (filter.day && String(metaNum(r, '일')) !== String(filter.day)) return false;
      if (filter.car && metaStr(r, '차종') !== filter.car) return false;
      if (filter.part && metaStr(r, '품명') !== filter.part) return false;
      return true;
    });
  }

  function render() {
    const list = filtered();
    const tbody = document.querySelector('#history-table tbody');
    if (!tbody) return;
    tbody.innerHTML = '';
    list.forEach((r, i) => {
      const j = r.judgement || {};
      const tr = document.createElement('tr');
      if (j.out > 0) tr.className = 'row-out'; else if (j.warn > 0) tr.className = 'row-warn';
      tr.innerHTML = `
        <td>${i + 1}</td>
        <td>${dateStr(r)}</td>
        <td>${metaStr(r, '차종')}</td>
        <td>${metaStr(r, '품명')}</td>
        <td>${metaStr(r, '호기')}</td>
        <td>${metaStr(r, '이름')}</td>
        <td>${j.totalParams ?? '-'}</td>
        <td><span class="badge ok">${j.ok ?? 0}</span></td>
        <td><span class="badge warn">${j.warn ?? 0}</span></td>
        <td><span class="badge out">${j.out ?? 0}</span></td>
        <td>
          <button class="btn btn-secondary btn-detail" data-id="${r.id}">상세</button>
          <button class="btn btn-secondary btn-print" data-id="${r.id}" title="조건표 출력">🖨</button>
        </td>`;
      tbody.appendChild(tr);
    });
    if (!list.length) {
      tbody.innerHTML = '<tr><td colspan="11" style="text-align:center;color:var(--text-muted);padding:24px;">조건에 맞는 데이터가 없습니다</td></tr>';
    }
    tbody.querySelectorAll('.btn-detail').forEach(b =>
      b.addEventListener('click', () => showDetail(b.dataset.id)));
    tbody.querySelectorAll('.btn-print').forEach(b =>
      b.addEventListener('click', () => printRecord(b.dataset.id)));
    const el = $('history-count');
    if (el) el.innerHTML = `조회 <b>${list.length}</b>건`;
  }

  function findProduct(productId) {
    const db = StandardsTab.getDb();
    return db.products.find(p => p.id === productId) || StandardsTab.activeProduct();
  }

  function showDetail(id) {
    const rec = records.find(r => r.id === id);
    if (!rec) return;
    lastDetailId = id;
    const prod = findProduct(rec.productId);
    const items = prod ? prod.items : [];

    const byGroup = {};
    items.forEach(it => { (byGroup[it.group] = byGroup[it.group] || []).push(it); });

    let rows = '';
    Object.keys(byGroup).forEach(group => {
      rows += `<tr class="hist-group-row"><td colspan="6">${group}</td></tr>`;
      byGroup[group].forEach(it => {
        const v = rec.values?.[it.code];
        const has = v !== '' && v != null;
        let badge = '<span class="badge empty">-</span>';
        if (has && !it.textType) {
          const s = Judge.judgeValue(v, it);
          badge = `<span class="badge ${s}">${s === 'ok' ? 'OK' : s === 'warn' ? '주의' : s === 'out' ? '이탈' : '-'}</span>`;
        }
        rows += `<tr>
          <td>${it.code}</td><td>${it.name}</td><td>${it.unit}</td>
          <td>${it.target}</td><td><b>${has ? v : '-'}</b></td>
          <td style="text-align:center;">${badge}</td></tr>`;
      });
    });

    $('history-detail-body').innerHTML = `
      <table class="data-table dark hist-detail-table">
        <thead><tr><th>코드</th><th>항목</th><th>단위</th><th>표준값</th><th>측정값</th><th>판정</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>`;
    $('history-detail-title').textContent = `${dateStr(rec)} · ${metaStr(rec, '차종')} / ${metaStr(rec, '품명')} 상세`;
    $('history-detail').style.display = '';
    $('history-detail').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // ===== 일별 조건표 출력(인쇄) =====
  function buildPrintHTML(rec, prod) {
    const items = prod ? prod.items : [];
    const byGroup = {};
    items.forEach(it => { (byGroup[it.group] = byGroup[it.group] || []).push(it); });
    const m = k => metaStr(rec, k);
    const j = rec.judgement || {};

    let cond = '';
    Object.keys(byGroup).forEach(group => {
      cond += `<tr class="grp"><td colspan="8">${group}</td></tr>`;
      byGroup[group].forEach(it => {
        const v = rec.values?.[it.code];
        const has = v !== '' && v != null;
        let st = '', stTxt = '-';
        if (has && !it.textType) {
          const s = Judge.judgeValue(v, it);
          st = s; stTxt = s === 'ok' ? 'OK' : s === 'warn' ? '주의' : s === 'out' ? '이탈' : '-';
        }
        cond += `<tr>
          <td>${it.code}</td><td class="l">${it.name}</td><td>${it.unit}</td>
          <td>${it.textType ? '' : it.target}</td>
          <td>${it.textType ? '' : (it.ucl ?? '')}</td>
          <td>${it.textType ? '' : (it.lcl ?? '')}</td>
          <td class="meas">${has ? v : '-'}</td>
          <td class="${st}">${stTxt}</td></tr>`;
      });
    });

    return `
      <div class="print-title">일별 사출조건표</div>
      <table class="print-meta">
        <tr><td class="k">일자</td><td>${dateStr(rec)}</td><td class="k">차종</td><td>${m('차종')}</td><td class="k">품명</td><td>${m('품명')}</td></tr>
        <tr><td class="k">호기</td><td>${m('호기')}</td><td class="k">작성자</td><td>${m('이름')}</td><td class="k">원재료</td><td>${m('원재료명')}</td></tr>
        <tr><td class="k">TON</td><td>${m('TON')}</td><td class="k">CAVITY</td><td>${m('CAVITY')}</td><td class="k">판정</td><td>정상 ${j.ok ?? 0} · 주의 ${j.warn ?? 0} · 이탈 ${j.out ?? 0}</td></tr>
      </table>
      <table class="print-cond">
        <thead><tr><th>코드</th><th>항목</th><th>단위</th><th>표준값</th><th>상한</th><th>하한</th><th>측정값</th><th>판정</th></tr></thead>
        <tbody>${cond}</tbody>
      </table>
      <div class="print-foot">출력일시 ${new Date().toISOString().slice(0, 16).replace('T', ' ')}</div>`;
  }

  function printRecord(id) {
    const rec = id && records.find(r => r.id === id);
    if (!rec) { toast('출력할 기록을 선택하세요', 'error'); return; }
    const area = $('print-area');
    if (!area) return;
    area.innerHTML = buildPrintHTML(rec, findProduct(rec.productId));
    window.print();
  }

  function exportFiltered() {
    const list = filtered();
    if (!list.length) { toast('조회 결과가 없습니다', 'error'); return; }
    const stamp = [filter.year, filter.month, filter.day].filter(Boolean).join('-') || '전체';
    ExcelExport.exportRecords(list, `사출조건_조회_${stamp}.xlsx`);
  }

  return { init, refresh };
})();

window.HistoryTab = HistoryTab;
