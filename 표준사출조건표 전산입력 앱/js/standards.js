// standards.js — 제품 마스터 + 제품별 표준조건/공차 관리
// 데이터 구조 v2: { products: [{id, 차종, 품명, items:[...]}, ...], activeProductId }

const StandardsTab = (() => {

  // 전역 DB (앱 전역에서 공유)
  let db = SCHEMA.defaultStandardsDb();

  // 변경이력 비교용 — 마지막으로 저장/로드된 시점의 스냅샷
  function cloneDb(o) { return JSON.parse(JSON.stringify(o)); }
  let lastSnapshot = cloneDb(db);
  function uid() {
    if (window.crypto && crypto.randomUUID) { try { return crypto.randomUUID(); } catch (e) {} }
    return 'h-' + Date.now().toString(36) + '-' + Math.floor(Math.random() * 1e6).toString(36);
  }

  const FIELD_LABEL = { target: '표준값', ucl: '상한', lcl: '하한', vgType: '벨브타입', enabled: '사용여부' };

  // old/new DB를 비교해 변경 항목 배열 생성
  function diffStandards(oldDb, newDb) {
    const out = [];
    const at = new Date().toISOString();
    const mk = (p, type, group, code, name, field, before, after) => ({
      id: uid(), at, productId: p.id, 차종: p.차종, 품명: p.품명,
      type, group: group || '', code: code || '', name: name || '',
      field, before: before === undefined ? '' : before, after: after === undefined ? '' : after,
    });
    const oldById = {}; (oldDb.products || []).forEach(p => oldById[p.id] = p);
    const newById = {}; (newDb.products || []).forEach(p => newById[p.id] = p);

    for (const p of (oldDb.products || [])) {
      if (!newById[p.id]) out.push(mk(p, 'product-removed', '', '', '', '제품삭제', `${p.차종}/${p.품명}`, ''));
    }
    for (const np of (newDb.products || [])) {
      const op = oldById[np.id];
      if (!op) { out.push(mk(np, 'product-added', '', '', '', '제품추가', '', `${np.차종}/${np.품명}`)); continue; }
      if (op.차종 !== np.차종 || op.품명 !== np.품명) {
        out.push(mk(np, 'product-renamed', '', '', '', '제품명', `${op.차종}/${op.품명}`, `${np.차종}/${np.품명}`));
      }
      const oItems = {}; (op.items || []).forEach(it => oItems[it.code] = it);
      for (const ni of (np.items || [])) {
        const oi = oItems[ni.code];
        if (!oi) continue;
        // 사용여부
        const oEn = oi.enabled !== false, nEn = ni.enabled !== false;
        if (oEn !== nEn) out.push(mk(np, 'item', ni.group, ni.code, ni.name, 'enabled', oEn ? '사용' : '미사용', nEn ? '사용' : '미사용'));
        // 값 필드
        const fields = ni.textType ? ['target'] : ['target', 'ucl', 'lcl', 'vgType'];
        for (const f of fields) {
          if (ni[f] === undefined && oi[f] === undefined) continue;
          if (String(oi[f] ?? '') !== String(ni[f] ?? '')) {
            out.push(mk(np, 'item', ni.group, ni.code, ni.name, f, oi[f] ?? '', ni[f] ?? ''));
          }
        }
      }
    }
    return out;
  }

  // ===== DB 접근 =====
  function getDb()        { return db; }
  function setDb(obj)     { db = SCHEMA.migrateStandards(obj); ensureActive(); lastSnapshot = cloneDb(db); }
  function products()     { return db.products; }
  function activeProduct() {
    return db.products.find(p => p.id === db.activeProductId) || db.products[0];
  }
  function setActive(id) {
    if (db.products.some(p => p.id === id)) {
      db.activeProductId = id;
      render();
      // 이벤트 알림 → form 탭이 듣고 새로 그림
      window.dispatchEvent(new CustomEvent('product-changed'));
    }
  }
  function ensureActive() {
    if (!db.products.length) db = SCHEMA.defaultStandardsDb();
    if (!db.products.some(p => p.id === db.activeProductId)) {
      db.activeProductId = db.products[0].id;
    }
  }

  // 호환 인터페이스: form/judge가 쓰던 get() / getItem() — 활성 제품 기준
  function get() { return activeProduct(); }
  function getItem(code) {
    const ap = activeProduct();
    return ap?.items.find(x => x.code === code);
  }

  // ===== 제품 추가 =====
  function addProduct(carModel, partName, defaults = {}) {
    const id = 'P-' + Date.now().toString(36).toUpperCase();
    const items = SCHEMA.PARAMS.map(x => ({ ...x }));
    db.products.push({ id, 차종: carModel, 품명: partName, defaults, items });
    db.activeProductId = id;
    render();
    window.dispatchEvent(new CustomEvent('product-changed'));
    toast(`제품 추가: ${carModel} / ${partName}`, 'success');
  }

  // ===== 제품 수정 (차종/품명/기본메타) =====
  function updateProduct(id, carModel, partName, defaults = {}) {
    const p = db.products.find(x => x.id === id);
    if (!p) { toast('수정할 제품을 찾을 수 없습니다', 'error'); return; }
    p.차종 = carModel;
    p.품명 = partName;
    p.defaults = defaults;
    render();
    window.dispatchEvent(new CustomEvent('product-changed'));
    toast(`제품 수정: ${carModel} / ${partName}`, 'success');
  }

  function deleteProduct(id) {
    if (db.products.length <= 1) { toast('최소 1개의 제품은 남겨야 합니다', 'error'); return; }
    const idx = db.products.findIndex(p => p.id === id);
    if (idx < 0) return;
    const p = db.products[idx];
    if (!confirm(`'${p.차종} / ${p.품명}' 제품을 삭제하시겠습니까?`)) return;
    db.products.splice(idx, 1);
    ensureActive();
    render();
    window.dispatchEvent(new CustomEvent('product-changed'));
    toast('제품 삭제', 'success');
  }

  // ===== 렌더 =====
  function renderProductPickers() {
    // 양쪽 탭에 공통으로 사용되는 picker 채우기
    document.querySelectorAll('select.product-picker').forEach(sel => {
      sel.innerHTML = db.products.map(p =>
        `<option value="${p.id}" ${p.id===db.activeProductId?'selected':''}>${p.차종} / ${p.품명}</option>`
      ).join('');
    });
    // 현재 차종/품명 표시 라벨
    const ap = activeProduct();
    document.querySelectorAll('.product-label-car').forEach(el => el.textContent = ap.차종);
    document.querySelectorAll('.product-label-part').forEach(el => el.textContent = ap.품명);
  }

  function render() {
    renderProductPickers();

    const root = document.getElementById('standards-groups');
    if (!root) return;
    const ap = activeProduct();
    root.innerHTML = '';

    const byGroup = groupBy(ap.items, 'group');

    for (const group of Object.keys(byGroup)) {
      const card = document.createElement('div');
      card.className = 'group-card';
      const enabledCount = byGroup[group].filter(x => x.enabled !== false).length;
      card.innerHTML = `
        <div class="group-header">
          ${group}
          <span class="group-header-right">
            <span class="group-badge">사용 ${enabledCount} / 전체 ${byGroup[group].length}</span>
            <button type="button" class="bulk-btn" data-group="${group}" data-on="1">전체 사용</button>
            <button type="button" class="bulk-btn off" data-group="${group}" data-on="0">전체 해제</button>
          </span>
        </div>
        <div class="param-row header">
          <div>코드</div><div>한글명</div><div>단위</div>
          <div>표준값</div><div>상한 UCL</div><div>하한 LCL</div><div>±</div><div style="text-align:center;">사용</div>
        </div>
      `;
      for (const it of byGroup[group]) {
        const row = document.createElement('div');
        row.className = 'param-row' + (it.enabled === false ? ' disabled-row' : '');
        const toggleCell = `
          <div style="text-align:center;">
            <label class="switch" title="사용/미사용">
              <input type="checkbox" class="enable-toggle" data-code="${it.code}" ${it.enabled !== false ? 'checked' : ''}>
              <span class="slider"></span>
            </label>
          </div>`;
        if (it.textType) {
          const opts = it.options.map(o => `<option value="${o}" ${o===it.target?'selected':''}>${o}</option>`).join('');
          row.innerHTML = `
            <div>${it.code}</div>
            <div class="name">${it.name}</div>
            <div class="unit">${it.unit}</div>
            <div style="grid-column: 4/8;"><select class="std-input text-select" data-code="${it.code}" data-field="target">${opts}</select></div>
            ${toggleCell}
          `;
        } else {
          const tol = Math.round(((it.ucl - it.lcl) / 2) * 1e6) / 1e6;
          const vgPicker = it.vgType !== undefined ? `
            <select class="vg-type-pick" data-code="${it.code}">
              <option value="A" ${it.vgType==='A'?'selected':''}>A</option>
              <option value="B" ${it.vgType==='B'?'selected':''}>B</option>
            </select>` : '';
          row.innerHTML = `
            <div>${it.code}</div>
            <div class="name">${it.name}${vgPicker}</div>
            <div class="unit">${it.unit}</div>
            <div><input class="std-input" type="number" step="any" data-code="${it.code}" data-field="target" value="${it.target}"></div>
            <div><input class="std-input" type="number" step="any" data-code="${it.code}" data-field="ucl" value="${it.ucl}"></div>
            <div><input class="std-input" type="number" step="any" data-code="${it.code}" data-field="lcl" value="${it.lcl}"></div>
            <div><input class="std-input tol-input" type="number" step="any" min="0" data-code="${it.code}" data-field="tol" value="${tol}"></div>
            ${toggleCell}
          `;
        }
        card.appendChild(row);
      }
      root.appendChild(card);
    }

    // 텍스트형(선택) 셀렉트
    root.querySelectorAll('select.std-input.text-select').forEach(sel => {
      sel.addEventListener('change', (e) => {
        const code = e.target.dataset.code;
        const it = getItem(code);
        if (it) it.target = e.target.value;
      });
    });
    // 벨브타이머 A/B 타입 셀렉트
    root.querySelectorAll('select.vg-type-pick').forEach(sel => {
      sel.addEventListener('change', (e) => {
        const code = e.target.dataset.code;
        const it = getItem(code);
        if (it) it.vgType = e.target.value;
      });
    });

    // 사용/미사용 토글
    root.querySelectorAll('input.enable-toggle').forEach(chk => {
      chk.addEventListener('change', (e) => {
        const code = e.target.dataset.code;
        const it = getItem(code);
        if (!it) return;
        it.enabled = e.target.checked;
        // 행 시각 처리
        const row = e.target.closest('.param-row');
        if (row) row.classList.toggle('disabled-row', !it.enabled);
        // 그룹 헤더 카운트 갱신
        updateGroupBadges();
        // 일일입력 탭도 영향 받음 → form 재렌더 신호
        window.dispatchEvent(new CustomEvent('standards-enabled-changed'));
      });
    });

    // 그룹별 일괄 사용/해제 버튼
    root.querySelectorAll('button.bulk-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const g = btn.dataset.group;
        const on = btn.dataset.on === '1';
        const ap = activeProduct();
        if (!ap) return;
        let changed = 0;
        ap.items.forEach(it => {
          if (it.group === g && (it.enabled !== false) !== on) { it.enabled = on; changed++; }
        });
        if (!changed) { toast(`'${g}' 이미 모두 ${on ? '사용' : '해제'} 상태`, ''); return; }
        // 해당 그룹의 토글 스위치 + 행 시각 상태 동기화
        root.querySelectorAll('input.enable-toggle').forEach(chk => {
          const it = getItem(chk.dataset.code);
          if (it && it.group === g) {
            chk.checked = on;
            const row = chk.closest('.param-row');
            if (row) row.classList.toggle('disabled-row', !on);
          }
        });
        updateGroupBadges();
        window.dispatchEvent(new CustomEvent('standards-enabled-changed'));
        toast(`'${g}' ${changed}개 ${on ? '사용' : '해제'}`, 'success');
      });
    });

    root.querySelectorAll('input.std-input').forEach(inp => {
      inp.addEventListener('change', (e) => {
        const code = e.target.dataset.code;
        const field = e.target.dataset.field;
        const v = parseFloat(e.target.value);
        const it = getItem(code);
        if (!it || isNaN(v)) return;
        const round = (n) => Math.round(n * 1e6) / 1e6;
        const r = e.target.closest('.param-row');

        if (field === 'tol') {
          // ± 입력 시 UCL/LCL 자동 재계산 (음수 방지)
          const tol = Math.abs(round(v));
          it.ucl = round(it.target + tol);
          it.lcl = round(it.target - tol);
          e.target.value = tol;
          if (r) {
            const uclInp = r.querySelector('input[data-field="ucl"]');
            const lclInp = r.querySelector('input[data-field="lcl"]');
            if (uclInp) uclInp.value = it.ucl;
            if (lclInp) lclInp.value = it.lcl;
          }
        } else if (field === 'target') {
          // 표준값 수정 시 → 현재 공차(±)를 유지한 채 UCL/LCL 자동 재계산
          const tol = Math.abs(round((it.ucl - it.lcl) / 2));
          it.target = round(v);
          it.ucl = round(it.target + tol);
          it.lcl = round(it.target - tol);
          e.target.value = it.target;
          if (r) {
            const uclInp = r.querySelector('input[data-field="ucl"]');
            const lclInp = r.querySelector('input[data-field="lcl"]');
            const tolInp = r.querySelector('input[data-field="tol"]');
            if (uclInp) uclInp.value = it.ucl;
            if (lclInp) lclInp.value = it.lcl;
            if (tolInp) tolInp.value = tol;
          }
        } else {
          // ucl / lcl 직접 수정 시 → ± 자동 갱신
          it[field] = round(v);
          e.target.value = it[field];
          if (r) {
            const tolInp = r.querySelector('input[data-field="tol"]');
            if (tolInp) tolInp.value = round((it.ucl - it.lcl) / 2);
          }
        }
      });
    });
  }

  // 그룹별 "사용 N / 전체 M" 카운트 갱신
  function updateGroupBadges() {
    const ap = activeProduct();
    if (!ap) return;
    const byGroup = groupBy(ap.items, 'group');
    document.querySelectorAll('#standards-groups .group-card').forEach(card => {
      const headerEl = card.querySelector('.group-header');
      const groupName = headerEl ? headerEl.childNodes[0].textContent.trim() : '';
      if (!groupName || !byGroup[groupName]) return;
      const enabled = byGroup[groupName].filter(x => x.enabled !== false).length;
      const total = byGroup[groupName].length;
      const badge = card.querySelector('.group-badge');
      if (badge) badge.textContent = `사용 ${enabled} / 전체 ${total}`;
    });
  }

  // ===== 저장 / 초기화 =====
  async function save() {
    // 변경이력 기록 (직전 저장/로드 시점 대비)
    const changes = diffStandards(lastSnapshot, db);
    db.updatedAt = new Date().toISOString();
    const res = await Storage.saveJSON('standards.json', db);
    if (changes.length) await Storage.appendStandardsHistory(changes);
    lastSnapshot = cloneDb(db);
    toast(`표준조건 저장 (${res.mode})${changes.length ? ` — 변경 ${changes.length}건 기록` : ''}`, 'success');
    if (typeof FormTab !== 'undefined') FormTab.refreshLeds();
    if (typeof StdHistory !== 'undefined') StdHistory.refresh();
  }

  function resetToDefaults() {
    if (!confirm('모든 제품 및 표준조건을 샘플 기본값으로 초기화할까요?')) return;
    db = SCHEMA.defaultStandardsDb();
    lastSnapshot = cloneDb(db);  // 초기화는 이력 폭주 방지 위해 기준점 갱신(이력 미기록)
    render();
    window.dispatchEvent(new CustomEvent('product-changed'));
    if (typeof FormTab !== 'undefined') FormTab.refreshLeds();
    toast('샘플 5개 제품으로 초기화', 'success');
  }

  function groupBy(arr, key) {
    const r = {};
    for (const x of arr) { (r[x.group] = r[x.group] || []).push(x); }
    return r;
  }

  // 활성 제품의 메타정보 표시용 (defaults 기준)
  function metaVal(ap, key) {
    return (ap && ap.defaults && ap.defaults[key] != null && ap.defaults[key] !== '') ? ap.defaults[key] : '-';
  }

  // ===== 표준조건표 인쇄 =====
  function print() {
    const ap = activeProduct();
    if (!ap) { toast('인쇄할 제품이 없습니다', 'error'); return; }
    const area = document.getElementById('print-area');
    if (!area) return;

    // 사용(enabled) 체크된 항목만 인쇄 — 미사용 항목은 제외
    const usedItems = ap.items.filter(it => it.enabled !== false);
    if (!usedItems.length) { toast('인쇄할 사용 항목이 없습니다', 'error'); return; }
    const byGroup = groupBy(usedItems, 'group');
    let cond = '';
    Object.keys(byGroup).forEach(group => {
      cond += `<tr class="grp"><td colspan="7">${group}</td></tr>`;
      byGroup[group].forEach(it => {
        const tol = it.textType ? '' : Math.round(((it.ucl - it.lcl) / 2) * 1e6) / 1e6;
        cond += `<tr>
          <td>${it.code}</td><td class="l">${it.name}</td><td>${it.unit}</td>
          <td>${it.target}</td>
          <td>${it.textType ? '' : (it.ucl ?? '')}</td>
          <td>${it.textType ? '' : (it.lcl ?? '')}</td>
          <td>${it.textType ? '' : tol}</td></tr>`;
      });
    });

    area.innerHTML = `
      <div class="print-title">표준 사출 조건표</div>
      <table class="print-meta">
        <tr><td class="k">차종</td><td>${ap.차종}</td><td class="k">품명</td><td>${ap.품명}</td><td class="k">호기</td><td>${metaVal(ap, '호기')}</td></tr>
        <tr><td class="k">TON</td><td>${metaVal(ap, 'TON')}</td><td class="k">CAVITY</td><td>${metaVal(ap, 'CAVITY')}</td><td class="k">원재료</td><td>${metaVal(ap, '원재료명')}</td></tr>
      </table>
      <table class="print-cond">
        <thead><tr><th>코드</th><th>한글명</th><th>단위</th><th>표준값</th><th>상한 UCL</th><th>하한 LCL</th><th>±</th></tr></thead>
        <tbody>${cond}</tbody>
      </table>
      <div class="print-foot">출력일시 ${new Date().toISOString().slice(0, 16).replace('T', ' ')}</div>`;
    window.print();
  }

  // ===== 표준조건표 Excel 저장 =====
  function exportExcel() {
    if (typeof XLSX === 'undefined') { toast('SheetJS 미로드', 'error'); return; }
    const ap = activeProduct();
    if (!ap) { toast('내보낼 제품이 없습니다', 'error'); return; }

    const aoa = [
      [`표준 사출 조건표`],
      [`차종`, ap.차종, `품명`, ap.품명, `호기`, metaVal(ap, '호기')],
      [`TON`, metaVal(ap, 'TON'), `CAVITY`, metaVal(ap, 'CAVITY'), `원재료`, metaVal(ap, '원재료명')],
      [],
      ['그룹', '코드', '한글명', '단위', '표준값', '상한 UCL', '하한 LCL', '±', '사용'],
    ];
    const byGroup = groupBy(ap.items, 'group');
    Object.keys(byGroup).forEach(group => {
      byGroup[group].forEach(it => {
        const tol = it.textType ? '' : Math.round(((it.ucl - it.lcl) / 2) * 1e6) / 1e6;
        aoa.push([
          group, it.code, it.name, it.unit,
          it.target,
          it.textType ? '' : it.ucl,
          it.textType ? '' : it.lcl,
          tol,
          it.enabled === false ? '미사용' : '사용',
        ]);
      });
    });

    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 8 } }];
    ws['!cols'] = [{ wch: 12 }, { wch: 10 }, { wch: 16 }, { wch: 8 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 8 }, { wch: 8 }];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '표준조건');
    const fn = `표준사출조건_${ap.차종}_${ap.품명}.xlsx`.replace(/[\\/:*?"<>|]/g, '_');
    XLSX.writeFile(wb, fn);
    toast(`Excel 저장: ${fn}`, 'success');
  }

  return {
    render, save, getDb, setDb, get, getItem, products, activeProduct, setActive,
    addProduct, updateProduct, deleteProduct, resetToDefaults, renderProductPickers,
    print, exportExcel,
  };
})();

window.StandardsTab = StandardsTab;
