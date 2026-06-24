// form.js — 일일입력 폼 + 제품 선택/추가 + 실시간 비교결과 표

const FormTab = (() => {

  // values: 현재 입력값 / originals: 비교 기준값(직전에 불러온 값) — 변경 셀 하이라이트용
  const state = { meta: {}, values: {}, originals: {} };

  function markChanged(code) {
    const inp = document.querySelector(`input.measurement[data-code="${code}"]`);
    if (!inp) return;
    const cur = state.values[code];
    const orig = state.originals[code];
    const changed = (orig !== undefined && orig !== '' && String(cur) !== String(orig));
    inp.classList.toggle('changed', changed);
  }

  // 차종/품명은 제품 셀렉터에서 자동 채움 → readonly로 표시
  const READONLY_FROM_PRODUCT = new Set(['차종','품명']);

  function render() {
    renderMeta();
    renderParamGroups();
    renderComparison();
    updateSummary();
  }

  function renderMeta() {
    const host = document.getElementById('meta-fields-basic');
    if (!host) return;
    host.innerHTML = '';
    const today = new Date();
    const ap = StandardsTab.activeProduct();

    SCHEMA.META_FIELDS.forEach(f => {
      let def = '';
      if (f.key === '년') def = today.getFullYear();
      else if (f.key === '월') def = today.getMonth() + 1;
      else if (f.key === '일') def = today.getDate();
      else if (f.key === '차종') def = ap?.차종 || '';
      else if (f.key === '품명') def = ap?.품명 || '';
      else if (ap?.defaults && ap.defaults[f.key] != null && ap.defaults[f.key] !== '') {
        def = ap.defaults[f.key];
      }
      state.meta[f.key] = def !== '' ? def : '';

      const ro = READONLY_FROM_PRODUCT.has(f.key) ? 'readonly' : '';
      const cls = READONLY_FROM_PRODUCT.has(f.key) ? 'class="from-product"' : '';
      const row = document.createElement('div');
      row.style.display = 'contents';
      row.innerHTML = `
        <label>${f.key}</label>
        <input type="${f.type}" data-meta="${f.key}" ${cls} ${ro} placeholder="${f.placeholder || ''}" value="${def}">
        <span class="badge ok">정상</span>
      `;
      host.appendChild(row);
    });

    document.querySelectorAll('input[data-meta]').forEach(inp => {
      inp.addEventListener('input', (e) => {
        state.meta[e.target.dataset.meta] = e.target.value;
      });
    });
  }

  function renderParamGroups() {
    const root = document.getElementById('entry-groups');
    if (!root) return;
    root.innerHTML = '';
    const std = StandardsTab.get();
    // 사용중(enabled !== false)인 항목만 필터링
    const activeItems = std.items.filter(x => x.enabled !== false);
    const byGroup = groupBy(activeItems, 'group');

    for (const group of Object.keys(byGroup)) {
      // 그룹 안에 표시할 항목이 0개면 그룹 카드 자체 생략
      if (byGroup[group].length === 0) continue;
      const card = document.createElement('div');
      card.className = 'group-card';
      card.innerHTML = `
        <div class="group-header">${group}<span class="group-badge">${byGroup[group].length}개</span></div>
        <div class="param-row header">
          <div>코드</div><div>항목</div><div>단위</div>
          <div>표준값</div><div>상한</div><div>하한</div><div>측정값</div><div style="text-align:center;">판정</div>
        </div>
      `;
      for (const it of byGroup[group]) {
        const row = document.createElement('div');
        row.className = 'param-row';
        if (it.textType) {
          const opts = it.options.map(o => `<option value="${o}">${o}</option>`).join('');
          row.innerHTML = `
            <div>${it.code}</div>
            <div class="name">${it.name}</div>
            <div class="unit">${it.unit}</div>
            <div style="grid-column: 4/7; color:var(--text-muted); text-align:left;">선택 (${it.options.join(' / ')})</div>
            <div><select data-code="${it.code}">${opts}</select></div>
            <div style="text-align:center;"><span class="badge empty" data-led="${it.code}">-</span></div>
          `;
        } else {
          const vgLabel = it.vgType !== undefined ? ` <span class="vg-type-badge">${it.vgType}</span>` : '';
          row.innerHTML = `
            <div>${it.code}</div>
            <div class="name">${it.name}${vgLabel}</div>
            <div class="unit">${it.unit}</div>
            <div class="std-target" data-std="${it.code}-target">${it.target}</div>
            <div class="std-ucl"    data-std="${it.code}-ucl">${it.ucl}</div>
            <div class="std-lcl"    data-std="${it.code}-lcl">${it.lcl}</div>
            <div><input class="measurement" type="number" step="any" data-code="${it.code}" placeholder=""></div>
            <div style="text-align:center;"><span class="badge empty" data-led="${it.code}">-</span></div>
          `;
        }
        card.appendChild(row);
      }
      root.appendChild(card);
    }

    root.querySelectorAll('input.measurement').forEach(inp => {
      inp.addEventListener('input', (e) => {
        const code = e.target.dataset.code;
        const v = e.target.value;
        state.values[code] = v === '' ? '' : Number(v);
        updateLed(code);
        updateComparisonRow(code);
        markChanged(code);
        updateSummary();
      });
    });
    root.querySelectorAll('select[data-code]').forEach(sel => {
      sel.addEventListener('change', (e) => {
        state.values[e.target.dataset.code] = e.target.value;
      });
      state.values[sel.dataset.code] = sel.value;
    });
  }

  // ===== 표준 vs 실측 비교 결과 표 =====
  function renderComparison() {
    const tbody = document.querySelector('#comparison-table tbody');
    if (!tbody) return;
    tbody.innerHTML = '';
    const std = StandardsTab.get();
    let n = 1;
    for (const it of std.items) {
      if (it.textType) continue;
      const tr = document.createElement('tr');
      tr.dataset.code = it.code;
      tr.innerHTML = `
        <td>${n++}</td>
        <td>${it.group} / ${it.name}</td>
        <td class="std-val">${it.target}</td>
        <td class="cur-val">-</td>
        <td class="diff-val">-</td>
        <td class="state-cell"><span class="badge empty">-</span></td>
      `;
      tbody.appendChild(tr);
    }
  }

  // 1개 행만 갱신 (입력할 때마다)
  function updateComparisonRow(code) {
    const tr = document.querySelector(`#comparison-table tr[data-code="${code}"]`);
    if (!tr) return;
    const std = StandardsTab.getItem(code);
    if (!std) return;
    const v = state.values[code];
    const curCell = tr.querySelector('.cur-val');
    const diffCell = tr.querySelector('.diff-val');
    const stateCell = tr.querySelector('.state-cell');
    if (v === '' || v == null || isNaN(v)) {
      curCell.textContent = '-';
      diffCell.textContent = '-';
      stateCell.innerHTML = '<span class="badge empty">-</span>';
      return;
    }
    const diff = Number(v) - std.target;
    curCell.textContent = v;
    diffCell.innerHTML = formatDiff(diff);
    const status = Judge.judgeValue(v, std);
    stateCell.innerHTML = `<span class="badge ${status}">${
      status === 'ok' ? 'OK' : status === 'warn' ? '주의' : status === 'out' ? '이탈' : '-'
    }</span>`;
  }

  function formatDiff(d) {
    if (d === 0) return '<span style="color:var(--text-dim);">0</span>';
    const sign = d > 0 ? '+' : '';
    const color = d > 0 ? 'var(--success)' : 'var(--danger)';
    return `<span style="color:${color}; font-weight:600;">${sign}${d.toFixed(d % 1 === 0 ? 0 : 1)}</span>`;
  }

  function updateLed(code) {
    const std = StandardsTab.getItem(code);
    const el = document.querySelector(`[data-led="${code}"]`);
    if (!el || !std) return;
    const status = Judge.judgeValue(state.values[code], std);
    el.className = 'badge ' + status;
    el.textContent = status === 'ok' ? 'OK'
                   : status === 'warn' ? '주의'
                   : status === 'out' ? '이탈' : '-';
  }

  function refreshLeds() {
    const std = StandardsTab.get();
    for (const it of std.items) {
      const t = document.querySelector(`[data-std="${it.code}-target"]`);
      const u = document.querySelector(`[data-std="${it.code}-ucl"]`);
      const l = document.querySelector(`[data-std="${it.code}-lcl"]`);
      if (t) t.textContent = it.target;
      if (u) u.textContent = it.ucl;
      if (l) l.textContent = it.lcl;
      updateLed(it.code);
      updateComparisonRow(it.code);
    }
  }

  function updateSummary() {
    const sum = Judge.summarize(state.values, StandardsTab.get());
    const el = document.getElementById('entry-summary');
    if (el) el.innerHTML =
      `입력 <b>${sum.totalParams}</b> · 정상 <span style="color:var(--success);font-weight:600;">${sum.ok}</span> · 주의 <span style="color:var(--warn);font-weight:600;">${sum.warn}</span> · 이탈 <span style="color:var(--danger);font-weight:600;">${sum.out}</span>`;
  }

  function reset() {
    if (!confirm('현재 입력한 측정값을 초기화할까요? (메타 정보는 유지)')) return;
    state.values = {};
    document.querySelectorAll('input.measurement').forEach(i => i.value = '');
    document.querySelectorAll('[data-led]').forEach(e => { e.className = 'badge empty'; e.textContent = '-'; });
    renderComparison();
    updateSummary();
  }

  // 제품 변경 시: 메타의 차종/품명 + 등록된 defaults 자동 채움 + 표준값/신호등 새로 그림
  function onProductChanged() {
    const ap = StandardsTab.activeProduct();
    if (!ap) return;
    // 차종/품명
    setMetaInput('차종', ap.차종);
    setMetaInput('품명', ap.품명);
    // 등록된 defaults (호기/TON/이름/품번/모델명/원재료명/GRADE/색상/CAVITY)
    if (ap.defaults) {
      SCHEMA.PRODUCT_DEFAULT_KEYS.forEach(k => {
        if (ap.defaults[k] != null && ap.defaults[k] !== '') {
          setMetaInput(k, ap.defaults[k]);
        }
      });
    }
    renderParamGroups();
    renderComparison();
    Object.keys(state.values).forEach(code => {
      const inp = document.querySelector(`input.measurement[data-code="${code}"]`);
      if (inp) inp.value = state.values[code];
      updateLed(code);
      updateComparisonRow(code);
    });
    updateSummary();
  }

  function setMetaInput(key, value) {
    state.meta[key] = value;
    const inp = document.querySelector(`input[data-meta="${key}"]`);
    if (inp) inp.value = value;
  }

  async function saveRecord() {
    if (!state.meta['년'] || !state.meta['월'] || !state.meta['일']) {
      toast('년/월/일을 입력해주세요', 'error'); return;
    }
    const std = StandardsTab.get();
    const sum = Judge.summarize(state.values, std);
    const rec = {
      id: uuid(),
      savedAt: new Date().toISOString(),
      productId: std.id,
      meta: { ...state.meta },
      values: { ...state.values },
      judgement: { totalParams: sum.totalParams, ok: sum.ok, warn: sum.warn, out: sum.out },
    };
    const y = Number(state.meta['년']);
    const m = Number(state.meta['월']);
    const monthKey = `${y}-${String(m).padStart(2, '0')}`;
    const filename = `records-${monthKey}.json`;

    let res;
    if (Storage.isConnected()) {
      let monthData = await Storage.readJSON(filename);
      if (!monthData || !Array.isArray(monthData.records)) {
        monthData = { month: monthKey, records: [] };
      }
      monthData.records.push(rec);
      monthData.updatedAt = new Date().toISOString();
      res = await Storage.saveJSON(filename, monthData);
    } else {
      // 폴더 미연결: 브라우저 로컬에 누적 보관 (새로고침해도 유지). 백업·이동은 'JSON 내보내기'.
      Storage.addMemRecords([rec]);
      res = { mode: 'local' };
    }
    toast(`저장 완료 (${res.mode}) — ${sum.out > 0 ? '⚠ 이탈 ' + sum.out + '건' : '정상'}`,
      sum.out > 0 ? 'error' : 'success');

    // 저장 후 originals를 현재 값으로 갱신 → 변경 하이라이트 초기화
    state.originals = { ...state.values };
    document.querySelectorAll('input.measurement.changed').forEach(el => el.classList.remove('changed'));

    if (typeof Dashboard !== 'undefined') Dashboard.refresh();
    if (typeof HistoryTab !== 'undefined') HistoryTab.refresh();  // 데이터 조회 화면 즉시 반영
  }

  // 현재 선택된 제품의 가장 최근(전일 맨 마지막 입력) 기록을 폼에 채움
  // opts.auto=true (제품 선택 시 자동 호출)면 기록이 없어도 조용히 넘어간다.
  async function loadLatestForCurrentProduct(opts = {}) {
    const ap = StandardsTab.activeProduct();
    if (!ap) return;
    const all = await Storage.loadAllRecords();
    // 같은 제품(productId) 우선, productId가 어긋나도 같은 차종/품명이면 매칭 (재생성·재import 대비)
    const sameCarPart = r => r.meta && r.meta['차종'] === ap.차종 && r.meta['품명'] === ap.품명;
    const filtered = all.filter(r => r.productId === ap.id || sameCarPart(r));
    if (!filtered.length) {
      if (opts.auto) {
        // 자동 호출(제품 선택)인데 기록이 없으면: 이전 제품 값이 남지 않도록 측정값만 비움
        state.values = {};
        state.originals = {};
        document.querySelectorAll('input.measurement').forEach(i => { i.value = ''; i.classList.remove('changed'); });
        document.querySelectorAll('select[data-code]').forEach(s => { s.selectedIndex = 0; });
        document.querySelectorAll('[data-led]').forEach(e => { e.className = 'badge empty'; e.textContent = '-'; });
        updateSummary();
      } else {
        toast(`'${ap.차종} / ${ap.품명}' 의 이전 기록이 없습니다`, 'error');
      }
      return;
    }
    // savedAt 기준 가장 최근 = 전일 맨 마지막 입력값
    const latest = filtered.reduce((a, b) =>
      (a.savedAt || '') >= (b.savedAt || '') ? a : b);

    // 메타 채우기 (년/월/일은 오늘 날짜 유지)
    const skipKeys = new Set(['년','월','일']);
    SCHEMA.META_FIELDS.forEach(f => {
      if (skipKeys.has(f.key)) return;
      if (latest.meta && latest.meta[f.key] != null) {
        const inp = document.querySelector(`input[data-meta="${f.key}"]`);
        if (inp) {
          inp.value = latest.meta[f.key];
          state.meta[f.key] = latest.meta[f.key];
        }
      }
    });

    // 측정값 채우기 + originals 기준값 저장 (이후 변경 시 노란색 강조용)
    state.originals = {};
    Object.entries(latest.values || {}).forEach(([code, v]) => {
      const inp = document.querySelector(`input.measurement[data-code="${code}"]`);
      const sel = document.querySelector(`select[data-code="${code}"]`);
      if (inp) {
        inp.value = v;
        state.values[code] = (v === '' ? '' : Number(v));
        state.originals[code] = state.values[code];
        inp.classList.remove('changed');
        updateLed(code);
      } else if (sel) {
        sel.value = v;
        state.values[code] = v;
        state.originals[code] = v;
      }
    });
    updateSummary();
    toast(`'${ap.차종} / ${ap.품명}' 전일조건 로드 (${(latest.savedAt||'').slice(0,16).replace('T',' ')})`, 'success');
  }

  async function loadLatest() {
    const all = await Storage.loadAllRecords();
    if (!all.length) { toast('불러올 기록 없음', 'error'); return; }
    const latest = all[all.length - 1];
    // 제품 자동 전환
    if (latest.productId) StandardsTab.setActive(latest.productId);
    // META 채우기
    SCHEMA.META_FIELDS.forEach(f => {
      const inp = document.querySelector(`[data-meta="${f.key}"]`);
      if (inp && latest.meta && latest.meta[f.key] != null) {
        inp.value = latest.meta[f.key];
        state.meta[f.key] = latest.meta[f.key];
      }
    });
    // 측정값 + originals 기준값 저장 (이후 변경 시 노란색 강조용)
    state.originals = {};
    Object.entries(latest.values || {}).forEach(([code, v]) => {
      const inp = document.querySelector(`input.measurement[data-code="${code}"]`);
      const sel = document.querySelector(`select[data-code="${code}"]`);
      if (inp) {
        inp.value = v;
        state.values[code] = (v === '' ? '' : Number(v));
        state.originals[code] = state.values[code];
        inp.classList.remove('changed');
        updateLed(code);
        updateComparisonRow(code);
      } else if (sel) {
        sel.value = v;
        state.values[code] = v;
        state.originals[code] = v;
      }
    });
    updateSummary();
    toast(`최신 기록 로드 (${(latest.savedAt||'').slice(0,16).replace('T',' ')})`, 'success');
  }

  function getState() { return state; }

  function groupBy(arr, key) {
    const r = {};
    for (const x of arr) { (r[x.group] = r[x.group] || []).push(x); }
    return r;
  }
  function uuid() {
    return ([1e7]+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g, c =>
      (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16));
  }

  // 제품 변경 이벤트 구독
  window.addEventListener('product-changed', onProductChanged);
  // 사용/미사용 토글 변경 이벤트 구독 — 일일입력 폼 갱신
  window.addEventListener('standards-enabled-changed', () => {
    renderParamGroups();
    // 기존 측정값 복원 + LED 갱신
    Object.keys(state.values).forEach(code => {
      const inp = document.querySelector(`input.measurement[data-code="${code}"]`);
      if (inp) {
        inp.value = state.values[code];
        updateLed(code);
      }
    });
    updateSummary();
  });

  return { render, refreshLeds, reset, saveRecord, loadLatest, loadLatestForCurrentProduct, getState, renderComparison };
})();

window.FormTab = FormTab;
