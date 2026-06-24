// storage.js — File System Access API + 다운로드 fallback
// 사용 환경: Chrome/Edge 권장. Firefox는 fallback 경로(다운로드/업로드).

const Storage = (() => {
  let folderHandle = null;
  const supportsFS = typeof window.showDirectoryPicker === 'function';

  // ===== 로컬 보관(localStorage) — 폴더 없이도 새로고침에 데이터 유지 =====
  const LS_KEYS = { records: 'sq_mem_records', history: 'sq_mem_history', standards: 'sq_standards' };
  function lsGet(key) {
    try { return JSON.parse(localStorage.getItem(key) || 'null'); }
    catch (e) { console.warn('localStorage 읽기 실패:', key, e); return null; }
  }
  function lsSet(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); }
    catch (e) { console.warn('localStorage 저장 실패(용량 초과 가능):', key, e); toast('로컬 저장 실패 — JSON 내보내기로 백업하세요', 'error'); }
  }
  function saveStandardsLocal(db) { lsSet(LS_KEYS.standards, db); }
  function loadStandardsLocal()   { return lsGet(LS_KEYS.standards); }

  // 표준조건 변경이력 (standards-history.json) — 폴더 연결 시 파일, 항상 메모리에도 누적
  let memHistory = lsGet(LS_KEYS.history) || [];
  function persistHistory() { lsSet(LS_KEYS.history, memHistory); }
  async function loadStandardsHistory() {
    let arr = [];
    if (folderHandle) {
      const o = await readJSON('standards-history.json');
      if (o && Array.isArray(o.history)) arr = o.history;
    }
    if (memHistory.length) {
      const ids = new Set(arr.map(h => h.id).filter(Boolean));
      for (const h of memHistory) if (!h.id || !ids.has(h.id)) arr.push(h);
    }
    return arr;
  }
  async function appendStandardsHistory(entries) {
    if (!entries || !entries.length) return;
    if (folderHandle) {
      let o = await readJSON('standards-history.json');
      if (!o || !Array.isArray(o.history)) o = { history: [] };
      o.history.push(...entries);
      o.updatedAt = new Date().toISOString();
      await saveJSON('standards-history.json', o);
    }
    memHistory.push(...entries);
    persistHistory();
  }
  // 파일 + 메모리 양쪽을 id 기준으로 수정/삭제 (loadStandardsHistory가 둘을 병합하므로 둘 다 반영 필요)
  async function _rewriteHistoryFile(fn) {
    if (!folderHandle) return;
    let o = await readJSON('standards-history.json');
    if (!o || !Array.isArray(o.history)) o = { history: [] };
    o.history = fn(o.history);
    o.updatedAt = new Date().toISOString();
    await saveJSON('standards-history.json', o);
  }
  async function updateStandardsHistory(id, patch) {
    memHistory = memHistory.map(h => h.id === id ? { ...h, ...patch } : h);
    persistHistory();
    await _rewriteHistoryFile(arr => arr.map(h => h.id === id ? { ...h, ...patch } : h));
  }
  async function deleteStandardsHistory(id) {
    memHistory = memHistory.filter(h => h.id !== id);
    persistHistory();
    await _rewriteHistoryFile(arr => arr.filter(h => h.id !== id));
  }
  // 여러 id를 한 번에 삭제 (파일 1회 재기록)
  async function deleteStandardsHistoryMany(ids) {
    const set = new Set(ids || []);
    if (!set.size) return;
    memHistory = memHistory.filter(h => !set.has(h.id));
    persistHistory();
    await _rewriteHistoryFile(arr => arr.filter(h => !set.has(h.id)));
  }
  async function clearStandardsHistory() {
    memHistory = [];
    persistHistory();
    await _rewriteHistoryFile(() => []);
  }

  // 폴더 미연결 시 사용하는 메모리 기록 (저장/불러오기로 채워짐, localStorage에 영속)
  let memRecords = lsGet(LS_KEYS.records) || [];
  function persistRecords() { lsSet(LS_KEYS.records, memRecords); }
  function setMemRecords(recs) { memRecords = Array.isArray(recs) ? recs.slice() : []; persistRecords(); }
  function addMemRecords(recs) {
    if (!Array.isArray(recs)) return;
    const ids = new Set(memRecords.map(r => r.id).filter(Boolean));
    for (const r of recs) {
      if (!r.id || !ids.has(r.id)) { memRecords.push(r); if (r.id) ids.add(r.id); }
    }
    persistRecords();
  }

  async function pickFolder() {
    if (!supportsFS) {
      toast('이 브라우저는 폴더 직접 접근 미지원. 저장/불러오기는 파일 다이얼로그로 동작합니다.', 'error');
      return null;
    }
    try {
      folderHandle = await window.showDirectoryPicker({ mode: 'readwrite' });
      return folderHandle;
    } catch (e) {
      if (e.name !== 'AbortError') console.error(e);
      return null;
    }
  }

  function isConnected() { return !!folderHandle; }
  function folderName() { return folderHandle ? folderHandle.name : null; }

  async function saveJSON(filename, obj) {
    const text = JSON.stringify(obj, null, 2);
    if (folderHandle) {
      const fh = await folderHandle.getFileHandle(filename, { create: true });
      const w = await fh.createWritable();
      await w.write(text);
      await w.close();
      return { mode: 'folder', filename };
    } else if (filename === 'standards.json') {
      // 폴더 미연결: 표준조건은 localStorage에 보관
      saveStandardsLocal(obj);
      return { mode: 'local', filename };
    } else {
      downloadBlob(filename, text, 'application/json');
      return { mode: 'download', filename };
    }
  }

  async function readJSON(filename) {
    if (!folderHandle) return null;
    try {
      const fh = await folderHandle.getFileHandle(filename);
      const file = await fh.getFile();
      const text = await file.text();
      return JSON.parse(text);
    } catch (e) {
      if (e.name !== 'NotFoundError') console.warn(`readJSON(${filename}):`, e);
      return null;
    }
  }

  // 폴더 내 records-YYYY-MM.json 전부 스캔
  async function listRecordFiles() {
    if (!folderHandle) return [];
    const files = [];
    for await (const entry of folderHandle.values()) {
      if (entry.kind === 'file' && /^records-\d{4}-\d{2}\.json$/.test(entry.name)) {
        files.push(entry.name);
      }
    }
    return files.sort();  // 오름차순 (최신이 마지막)
  }

  async function loadAllRecords() {
    const all = [];
    if (folderHandle) {
      const files = await listRecordFiles();
      for (const f of files) {
        const obj = await readJSON(f);
        if (obj && Array.isArray(obj.records)) all.push(...obj.records);
      }
    }
    // 메모리 기록 병합 (id 기준 중복 제거 → 폴더 기록 우선)
    if (memRecords.length) {
      const ids = new Set(all.map(r => r.id).filter(Boolean));
      for (const r of memRecords) {
        if (!r.id || !ids.has(r.id)) all.push(r);
      }
    }
    return all;
  }

  async function loadStandards() {
    return await readJSON('standards.json');
  }

  // ===== Fallback: 파일 선택 업로드 =====
  function uploadJSON() {
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json,application/json';
      input.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return resolve(null);
        const text = await file.text();
        try { resolve({ name: file.name, data: JSON.parse(text) }); }
        catch (err) { toast('JSON 파싱 실패: ' + err.message, 'error'); resolve(null); }
      };
      input.click();
    });
  }

  // ===== 사용자가 폴더를 지정해 저장/열기 (File System Access API) =====
  // 저장: '다른 이름으로 저장' 대화상자 → 폴더/파일명 직접 지정. 미지원 시 다운로드 대체.
  async function saveFileWithPicker(suggestedName, text) {
    if (typeof window.showSaveFilePicker === 'function') {
      try {
        const handle = await window.showSaveFilePicker({
          suggestedName,
          types: [{ description: 'JSON 파일', accept: { 'application/json': ['.json'] } }],
        });
        const w = await handle.createWritable();
        await w.write(text);
        await w.close();
        return { ok: true, name: handle.name };
      } catch (e) {
        if (e.name === 'AbortError') return { ok: false, aborted: true };
        console.warn('showSaveFilePicker 실패, 다운로드로 대체:', e);
      }
    }
    downloadBlob(suggestedName, text, 'application/json');
    return { ok: true, name: suggestedName, downloaded: true };
  }

  // 열기: '열기' 대화상자 → 어느 폴더에서든 파일 선택. 미지원 시 파일 입력 대체.
  async function openFileWithPicker() {
    if (typeof window.showOpenFilePicker === 'function') {
      try {
        const [handle] = await window.showOpenFilePicker({
          multiple: false,
          types: [{ description: 'JSON 파일', accept: { 'application/json': ['.json'] } }],
        });
        const file = await handle.getFile();
        const text = await file.text();
        try { return { name: file.name, data: JSON.parse(text) }; }
        catch (err) { toast('JSON 파싱 실패: ' + err.message, 'error'); return null; }
      } catch (e) {
        if (e.name === 'AbortError') return null;
        console.warn('showOpenFilePicker 실패, 파일 입력으로 대체:', e);
      }
    }
    return await uploadJSON();
  }

  function downloadBlob(filename, content, mime) {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 100);
  }

  function toast(msg, kind = '') {
    const el = document.getElementById('toast');
    if (!el) return;
    el.className = 'toast show' + (kind ? ' ' + kind : '');
    el.textContent = msg;
    clearTimeout(toast._t);
    toast._t = setTimeout(() => el.classList.remove('show'), 2500);
  }

  return {
    pickFolder, isConnected, folderName,
    saveJSON, readJSON, loadAllRecords, loadStandards,
    setMemRecords, addMemRecords,
    saveStandardsLocal, loadStandardsLocal,
    loadStandardsHistory, appendStandardsHistory,
    updateStandardsHistory, deleteStandardsHistory, deleteStandardsHistoryMany, clearStandardsHistory,
    uploadJSON, saveFileWithPicker, openFileWithPicker, downloadBlob, toast, supportsFS,
  };
})();

window.Storage = Storage;
window.toast = Storage.toast;
