// stdhistory.js — 표준조건 변경이력 조회 + 수정/삭제/출력
// StandardsTab.save() 시 직전 대비 변경된 표준/공차/사용여부/제품을 기록 → 여기서 조회·관리.

const StdHistory = (() => {

  let rows = [];
  let editingId = null;
  let lastCheckedIdx = null;   // shift+클릭 범위 선택용
  const filter = { product: '' };

  function $(id) { return document.getElementById(id); }
  function esc(v) { return String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  function escAttr(v) { return esc(v).replace(/"/g, '&quot;'); }

  const FIELD_KR = { target: '표준값', ucl: '상한', lcl: '하한', vgType: '벨브타입', enabled: '사용여부' };
  function fieldLabel(e) { return FIELD_KR[e.field] || e.field; }
  function productLabel(e) { return `${e.차종 || ''}${e.품명 ? ' / ' + e.품명 : ''}`.trim() || '-'; }
  function whenLabel(e) { return (e.at || '').slice(0, 16).replace('T', ' '); }
  function itemLabel(e) { return e.code ? `${e.group ? e.group + ' / ' : ''}${e.name} (${e.code})` : '-'; }
  function changeTextPlain(e) {
    if (e.type === 'product-added') return '제품 추가';
    if (e.type === 'product-removed') return '제품 삭제';
    if (e.type === 'product-renamed') return '제품명 변경';
    return fieldLabel(e);
  }
  function changeText(e) {
    if (e.type === 'product-added') return '<span class="badge ok">제품 추가</span>';
    if (e.type === 'product-removed') return '<span class="badge out">제품 삭제</span>';
    return esc(changeTextPlain(e));
  }

  function init() {
    $('f-std-product')?.addEventListener('change', e => { filter.product = e.target.value; editingId = null; render(); });
    $('btn-stdhist-refresh')?.addEventListener('click', refresh);
    $('btn-stdhist-excel')?.addEventListener('click', exportExcel);
    $('btn-stdhist-print')?.addEventListener('click', printList);
    $('btn-stdhist-delsel')?.addEventListener('click', deleteSelected);
    $('btn-stdhist-clear')?.addEventListener('click', clearAll);
    $('stdhist-check-all')?.addEventListener('change', e => {
      document.querySelectorAll('#stdhist-table tbody .stdhist-row-check')
        .forEach(c => { c.checked = e.target.checked; });
      lastCheckedIdx = null;
    });
  }

  async function refresh() {
    rows = await Storage.loadStandardsHistory();
    rows = rows.slice().sort((a, b) => String(b.at || '').localeCompare(String(a.at || '')));
    populateProductFilter();
    render();
  }

  function populateProductFilter() {
    const labels = [...new Set(rows.map(productLabel).filter(v => v && v !== '-'))].sort();
    const sel = $('f-std-product');
    if (!sel) return;
    sel.innerHTML = ['<option value="">전체</option>']
      .concat(labels.map(l => `<option value="${escAttr(l)}">${esc(l)}</option>`)).join('');
    sel.value = labels.includes(filter.product) ? filter.product : '';
  }

  function filtered() {
    return rows.filter(e => !filter.product || productLabel(e) === filter.product);
  }

  function render() {
    const list = filtered();
    const tbody = document.querySelector('#stdhist-table tbody');
    if (!tbody) return;
    tbody.innerHTML = '';
    list.forEach((e, i) => {
      const tr = document.createElement('tr');
      const checkCell = `<td style="text-align:center;"><input type="checkbox" class="stdhist-row-check" data-id="${e.id}" data-idx="${i}"></td>`;
      if (e.id === editingId) {
        tr.innerHTML = `
          ${checkCell}
          <td>${i + 1}</td>
          <td>${whenLabel(e)}</td>
          <td>${esc(productLabel(e))}</td>
          <td style="text-align:left;">${esc(itemLabel(e))}</td>
          <td>${changeText(e)}</td>
          <td><input class="stdhist-edit-before" value="${escAttr(e.before)}" style="width:88px;"></td>
          <td class="hist-arrow">→</td>
          <td><input class="stdhist-edit-after" value="${escAttr(e.after)}" style="width:88px;"></td>
          <td>
            <button class="btn btn-primary btn-hist-save" data-id="${e.id}">저장</button>
            <button class="btn btn-secondary btn-hist-cancel">취소</button>
          </td>`;
      } else {
        tr.innerHTML = `
          ${checkCell}
          <td>${i + 1}</td>
          <td>${whenLabel(e)}</td>
          <td>${esc(productLabel(e))}</td>
          <td style="text-align:left;">${esc(itemLabel(e))}</td>
          <td>${changeText(e)}</td>
          <td class="hist-before">${e.before === '' ? '-' : esc(e.before)}</td>
          <td class="hist-arrow">→</td>
          <td class="hist-after"><b>${e.after === '' ? '-' : esc(e.after)}</b></td>
          <td>
            <button class="btn btn-secondary btn-hist-edit" data-id="${e.id}">수정</button>
            <button class="btn btn-secondary btn-hist-del" data-id="${e.id}">삭제</button>
          </td>`;
      }
      tbody.appendChild(tr);
    });
    if (!list.length) {
      tbody.innerHTML = '<tr><td colspan="10" style="text-align:center;color:var(--text-muted);padding:24px;">변경이력이 없습니다 — 표준/공차를 수정 후 저장하면 기록됩니다</td></tr>';
    }
    bindRowActions();
    // 렌더할 때마다 선택 상태 초기화
    lastCheckedIdx = null;
    const all = $('stdhist-check-all');
    if (all) { all.checked = false; all.indeterminate = false; }
    const el = $('stdhist-count');
    if (el) el.innerHTML = `이력 <b>${list.length}</b>건`;
  }

  function bindRowActions() {
    const tbody = document.querySelector('#stdhist-table tbody');
    tbody.querySelectorAll('.btn-hist-edit').forEach(b =>
      b.addEventListener('click', () => { editingId = b.dataset.id; render(); }));
    tbody.querySelectorAll('.btn-hist-cancel').forEach(b =>
      b.addEventListener('click', () => { editingId = null; render(); }));
    tbody.querySelectorAll('.btn-hist-save').forEach(b =>
      b.addEventListener('click', () => saveEdit(b.dataset.id, b.closest('tr'))));
    tbody.querySelectorAll('.btn-hist-del').forEach(b =>
      b.addEventListener('click', () => removeEntry(b.dataset.id)));

    // 행 체크박스 — shift+클릭 범위 선택 + 전체선택 상태 동기화
    const checks = [...tbody.querySelectorAll('.stdhist-row-check')];
    checks.forEach(chk => {
      chk.addEventListener('click', (ev) => {
        const idx = Number(chk.dataset.idx);
        if (ev.shiftKey && lastCheckedIdx != null) {
          const [a, b] = [lastCheckedIdx, idx].sort((x, y) => x - y);
          for (let k = a; k <= b; k++) if (checks[k]) checks[k].checked = chk.checked;
        }
        lastCheckedIdx = idx;
        syncCheckAll();
      });
    });
  }

  function syncCheckAll() {
    const checks = [...document.querySelectorAll('#stdhist-table tbody .stdhist-row-check')];
    const all = $('stdhist-check-all');
    if (!all) return;
    const on = checks.filter(c => c.checked).length;
    all.checked = on > 0 && on === checks.length;
    all.indeterminate = on > 0 && on < checks.length;
  }

  function selectedIds() {
    return [...document.querySelectorAll('#stdhist-table tbody .stdhist-row-check')]
      .filter(c => c.checked).map(c => c.dataset.id);
  }

  async function deleteSelected() {
    const ids = selectedIds();
    if (!ids.length) { toast('삭제할 항목을 체크하세요', 'error'); return; }
    if (!confirm(`선택한 변경이력 ${ids.length}건을 삭제할까요? 되돌릴 수 없습니다.`)) return;
    await Storage.deleteStandardsHistoryMany(ids);
    if (ids.includes(editingId)) editingId = null;
    await refresh();
    toast(`변경이력 ${ids.length}건 삭제됨`, 'success');
  }

  async function saveEdit(id, tr) {
    const before = tr.querySelector('.stdhist-edit-before').value;
    const after = tr.querySelector('.stdhist-edit-after').value;
    await Storage.updateStandardsHistory(id, { before, after, edited: true });
    editingId = null;
    await refresh();
    toast('변경이력 수정됨', 'success');
  }

  async function removeEntry(id) {
    if (!confirm('이 변경이력 1건을 삭제할까요?')) return;
    await Storage.deleteStandardsHistory(id);
    if (editingId === id) editingId = null;
    await refresh();
    toast('변경이력 삭제됨', 'success');
  }

  async function clearAll() {
    const list = filtered();
    if (!list.length) { toast('삭제할 이력이 없습니다', 'error'); return; }
    if (!confirm(`표준조건 변경이력 전체(${rows.length}건)를 삭제할까요? 되돌릴 수 없습니다.`)) return;
    await Storage.clearStandardsHistory();
    editingId = null;
    await refresh();
    toast('변경이력 전체 삭제됨', 'success');
  }

  function exportExcel() {
    const list = filtered();
    if (!list.length) { toast('내보낼 이력이 없습니다', 'error'); return; }
    if (typeof XLSX === 'undefined') { toast('SheetJS 미로드', 'error'); return; }
    const header = ['일시', '제품', '항목', '변경', '변경전', '변경후'];
    const aoa = [header].concat(list.map(e => [
      whenLabel(e), productLabel(e), itemLabel(e), changeTextPlain(e),
      e.before === '' ? '-' : e.before, e.after === '' ? '-' : e.after,
    ]));
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws['!cols'] = [{ wch: 17 }, { wch: 22 }, { wch: 26 }, { wch: 12 }, { wch: 16 }, { wch: 16 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '표준조건변경이력');
    XLSX.writeFile(wb, '표준조건_변경이력.xlsx');
    toast('변경이력 Excel 내보내기', 'success');
  }

  // 출력(인쇄) — 현재 필터된 이력을 인쇄용 표로
  function printList() {
    const list = filtered();
    if (!list.length) { toast('출력할 이력이 없습니다', 'error'); return; }
    const area = $('print-area');
    if (!area) return;
    let body = '';
    list.forEach((e, i) => {
      body += `<tr>
        <td>${i + 1}</td><td>${whenLabel(e)}</td><td class="l">${esc(productLabel(e))}</td>
        <td class="l">${esc(itemLabel(e))}</td><td>${esc(changeTextPlain(e))}</td>
        <td>${e.before === '' ? '-' : esc(e.before)}</td><td>${e.after === '' ? '-' : esc(e.after)}</td></tr>`;
    });
    const scope = filter.product ? ` (제품: ${esc(filter.product)})` : '';
    area.innerHTML = `
      <div class="print-title">표준조건 변경이력${scope}</div>
      <table class="print-cond">
        <thead><tr><th>No</th><th>일시</th><th>제품</th><th>항목</th><th>변경</th><th>변경전</th><th>변경후</th></tr></thead>
        <tbody>${body}</tbody>
      </table>
      <div class="print-foot">출력일시 ${new Date().toISOString().slice(0, 16).replace('T', ' ')} · 총 ${list.length}건</div>`;
    window.print();
  }

  return { init, refresh };
})();

window.StdHistory = StdHistory;
