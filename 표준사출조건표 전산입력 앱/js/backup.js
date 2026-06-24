// backup.js — 폴더 연결 없이도 동작하는 JSON 저장/불러오기
// 단일 백업 파일에 표준조건(standards) + 전체 기록(records)을 함께 담는다.

const Backup = (() => {

  function dateStamp() {
    const d = new Date();
    const p = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  }

  // ===== JSON 저장: 표준조건 + 전체 기록을 파일 1개로 다운로드 =====
  async function saveJSON() {
    const records = await Storage.loadAllRecords();
    const standards = StandardsTab.getDb();
    const backup = {
      type: 'sq-injection-backup',
      version: 1,
      exportedAt: new Date().toISOString(),
      standards,
      records,
    };
    const res = await Storage.saveFileWithPicker(
      `사출조건_백업_${dateStamp()}.json`,
      JSON.stringify(backup, null, 2)
    );
    if (res.aborted) return;   // 사용자가 저장 취소
    const where = res.downloaded ? ' (다운로드 폴더)' : ` — ${res.name}`;
    toast(`JSON 내보내기${where} · 제품 ${standards.products?.length || 0} · 기록 ${records.length}건`, 'success');
  }

  // ===== JSON 불러오기: 폴더에서 파일 지정 후 형식 자동 판별 =====
  async function loadJSON() {
    const r = await Storage.openFileWithPicker();
    if (!r) return;
    apply(r.name, r.data);
  }

  // 통합 백업 / standards.json / records-*.json / 기록 배열 모두 수용
  function apply(name, data) {
    let appliedStd = false;
    let recCount = null;

    if (data && data.standards && Array.isArray(data.records)) {
      applyStandards(data.standards);
      recCount = applyRecords(data.records);
      appliedStd = true;
    } else if (data && Array.isArray(data.products)) {
      applyStandards(data);
      appliedStd = true;
    } else if (data && Array.isArray(data.records)) {
      recCount = applyRecords(data.records);
    } else if (Array.isArray(data)) {
      recCount = applyRecords(data);
    } else {
      toast('알 수 없는 JSON 형식', 'error');
      return;
    }

    if (typeof Dashboard !== 'undefined') Dashboard.refresh();

    const parts = [];
    if (appliedStd) parts.push('표준조건');
    if (recCount != null) parts.push(`기록 ${recCount}건`);
    toast(`JSON 불러오기 — ${parts.join(' · ') || name}`, 'success');
  }

  function applyStandards(std) {
    StandardsTab.setDb(std);   // setDb 내부에서 migrateStandards 수행
    StandardsTab.render();
    FormTab.render();
  }

  function applyRecords(records) {
    Storage.setMemRecords(records);
    return records.length;
  }

  return { saveJSON, loadJSON, apply };
})();

window.Backup = Backup;
