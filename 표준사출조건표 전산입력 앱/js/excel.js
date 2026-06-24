// excel.js — SheetJS 사용 wide-header Excel 내보내기
// 헤더 구조는 사용자가 제공한 3행 헤더와 일치시킴.

const ExcelExport = (() => {

  async function exportCurrentMonth() {
    if (typeof XLSX === 'undefined') { toast('SheetJS 미로드', 'error'); return; }
    const all = await Storage.loadAllRecords();
    if (!all.length) { toast('내보낼 기록이 없습니다', 'error'); return; }

    // 현재 월 기준
    const d = new Date();
    const mk = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
    const recs = all.filter(r => {
      if (r.meta && r.meta['년'] && r.meta['월']) {
        return `${r.meta['년']}-${String(r.meta['월']).padStart(2,'0')}` === mk;
      }
      return (r.savedAt || '').slice(0,7) === mk;
    });
    if (!recs.length) { toast('당월 기록 없음 — 전체로 내보냅니다', ''); return exportAll(); }
    buildAndDownload(recs, `사출조건_${mk}.xlsx`);
  }

  async function exportAll() {
    const all = await Storage.loadAllRecords();
    if (!all.length) { toast('내보낼 기록이 없습니다', 'error'); return; }
    buildAndDownload(all, '사출조건_전체.xlsx');
  }

  // 레코드의 소속 월(YYYY-MM) 판별 — 메타 년/월 우선, 없으면 저장시각
  function monthKeyOf(r) {
    if (r.meta && r.meta['년'] && r.meta['월']) {
      return `${r.meta['년']}-${String(r.meta['월']).padStart(2, '0')}`;
    }
    return (r.savedAt || '').slice(0, 7);
  }

  // 저장된 기록에 존재하는 월 목록 (오름차순)
  async function availableMonths() {
    const all = await Storage.loadAllRecords();
    const set = new Set();
    all.forEach(r => { const k = monthKeyOf(r); if (k) set.add(k); });
    return [...set].sort();
  }

  // 특정 월만 내보내기
  async function exportMonth(mk) {
    if (!mk) { toast('내보낼 월을 선택하세요', 'error'); return; }
    const all = await Storage.loadAllRecords();
    const recs = all.filter(r => monthKeyOf(r) === mk);
    if (!recs.length) { toast(`${mk} 기록 없음`, 'error'); return; }
    buildAndDownload(recs, `사출조건_${mk}.xlsx`);
  }

  function buildAndDownload(records, filename) {
    const { header, merges } = buildHeader();
    const rows = records.map(toRow);
    const aoa = [...header, ...rows];

    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws['!merges'] = merges;
    // 컬럼 폭
    ws['!cols'] = new Array(aoa[0].length).fill({ wch: 8 });

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '사출조건');
    XLSX.writeFile(wb, filename);
    toast(`Excel 내보내기: ${filename}`, 'success');
  }

  // ====== Wide header (3-row) 구성 ======
  // 사용자가 제공한 헤더 그대로 재현.
  // [메타13] [사출속도5] [사출압력4] [사출위치5] [충진/사출3] [보압압력3] [보압시간2] [배압3] [계량속도3] [계량완료1]
  // [실린더온도7] [핫러너 타입1+15] [벨브타이머 타입1+12] [금형온도4] [냉각1] [CT 1]
  function buildHeader() {
    // 컬럼 정의 순서: schema의 PARAMS 순서로 = 일관성. 메타는 META_FIELDS 순서로.
    const cols = [];
    SCHEMA.META_FIELDS.forEach(m => cols.push({ key: m.key, top: m.key, mid: '', bot: '' }));

    // 그룹별 헤더 매핑
    const groupTop = {
      '사출속도': '사출속도', '사출압력': '사출압력', '사출위치': '사출위치(보압전환)',
      '충진/사출': '충진/사출/쿠션', '보압압력': '보압압력', '보압시간': '보압시간',
      '배압': '배압', '계량속도': '계량속도', '계량완료': '계량완료',
      '실린더온도': '실린더온도', '핫러너': 'HOT RUNNER (온도)',
      '벨브타이머': '벨브타이머', '금형온도': '금형온도', '사이클': '냉각/CYCLE'
    };
    SCHEMA.PARAMS.forEach(p => {
      cols.push({ key: p.code, top: groupTop[p.group] || p.group, mid: p.name, bot: p.unit });
    });

    // 3행으로 결합
    const row1 = cols.map(c => c.top);
    const row2 = cols.map(c => c.mid);
    const row3 = cols.map(c => c.bot);
    const header = [row1, row2, row3];

    // 같은 그룹(top)이 연속하는 구간을 row1에서 가로 병합
    const merges = [];
    let i = 0;
    while (i < cols.length) {
      let j = i;
      while (j + 1 < cols.length && cols[j+1].top === cols[i].top) j++;
      if (j > i) merges.push({ s: { r: 0, c: i }, e: { r: 0, c: j } });
      // 메타 컬럼은 mid/bot 빈칸 → row1~row3 세로 병합
      if (cols[i].mid === '' && cols[i].bot === '') {
        merges.push({ s: { r: 0, c: i }, e: { r: 2, c: i } });
      }
      i = j + 1;
    }
    return { header, merges };
  }

  function toRow(rec) {
    const row = [];
    SCHEMA.META_FIELDS.forEach(m => row.push(rec.meta?.[m.key] ?? ''));
    SCHEMA.PARAMS.forEach(p => row.push(rec.values?.[p.code] ?? ''));
    return row;
  }

  // 임의 레코드 집합 내보내기 (데이터 조회 결과 등)
  function exportRecords(records, filename) {
    if (typeof XLSX === 'undefined') { toast('SheetJS 미로드', 'error'); return; }
    if (!records || !records.length) { toast('내보낼 기록이 없습니다', 'error'); return; }
    buildAndDownload(records, filename || '사출조건_조회.xlsx');
  }

  return { exportCurrentMonth, exportAll, exportMonth, availableMonths, exportRecords };
})();

window.ExcelExport = ExcelExport;
