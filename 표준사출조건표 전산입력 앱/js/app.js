// app.js — 탭/테마/사이드바/폴더/제품 선택 이벤트 통합

(function () {

  // ===== 테마 토글 =====
  const THEME_KEY = 'mes_theme';
  function applyTheme(t) {
    document.documentElement.setAttribute('data-theme', t);
    localStorage.setItem(THEME_KEY, t);
    if (typeof Dashboard !== 'undefined' && Dashboard.redrawIfActive) Dashboard.redrawIfActive();
  }
  applyTheme(localStorage.getItem(THEME_KEY) || 'light');
  document.getElementById('btn-theme').addEventListener('click', () => {
    const cur = document.documentElement.getAttribute('data-theme') || 'dark';
    applyTheme(cur === 'dark' ? 'light' : 'dark');
  });

  // ===== 탭 전환 =====
  function switchTab(name) {
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    const target = document.getElementById('tab-' + name);
    if (target) target.classList.add('active');
    document.querySelectorAll('.pill').forEach(p => p.classList.toggle('active', p.dataset.tab === name));
    document.querySelectorAll('.side-link[data-tab]').forEach(p => p.classList.toggle('active', p.dataset.tab === name));
    if (name === 'dashboard') Dashboard.refresh();
    if (name === 'history' && typeof HistoryTab !== 'undefined') HistoryTab.refresh();
    if (name === 'stdhistory' && typeof StdHistory !== 'undefined') StdHistory.refresh();
  }
  document.querySelectorAll('[data-tab]').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  // ===== 폴더 연결 =====
  function updateFolderUI() {
    const el = document.getElementById('folder-info');
    if (el && Storage.isConnected()) {
      el.textContent = `📁 ${Storage.folderName()}`;
      el.classList.add('connected');
    }
  }

  async function connectFolder() {
    const handle = await Storage.pickFolder();
    if (!handle) return false;
    updateFolderUI();
    toast(`폴더 연결: ${Storage.folderName()}`, 'success');
    return true;
  }

  // B안(완전 JSON 방식): 저장은 브라우저 로컬에 누적 보관 → 폴더 선택 창을 띄우지 않음.
  // 영구 백업·이동은 'JSON 내보내기' / 'JSON 불러오기'로 처리한다.
  async function ensureFolderForSave() { return true; }

  document.getElementById('btn-import-json').addEventListener('click', async () => {
    const ok = window.confirm(
      '⚠️ JSON 불러오기\n\n' +
      '현재 화면에 표시/입력 중인 표준조건과 기록이\n' +
      '불러온 파일 내용으로 덮어쓰기 됩니다.\n\n' +
      '계속하시겠습니까?'
    );
    if (!ok) return;
    await Backup.loadJSON();
  });

  document.getElementById('btn-export-json').addEventListener('click', async () => {
    const ok = window.confirm(
      '⚠️ JSON 내보내기\n\n' +
      '현재 표준조건과 모든 기록을 JSON 파일 1개로 저장합니다.\n\n' +
      '진행하시겠습니까?'
    );
    if (!ok) return;
    await Backup.saveJSON();
  });

  // 최신 불러오기: 현재 선택된 차종/품명의 전일 맨 마지막 입력값을 폼에 채움
  document.getElementById('btn-load-latest').addEventListener('click', () => {
    FormTab.loadLatestForCurrentProduct();
  });

  // ===== 일일입력 액션 =====
  document.getElementById('btn-save').addEventListener('click', async () => {
    if (await ensureFolderForSave()) FormTab.saveRecord();
  });
  document.getElementById('btn-reset').addEventListener('click', () => FormTab.reset());
  document.getElementById('btn-excel').addEventListener('click', () => ExcelExport.exportCurrentMonth());

  // ===== 표준조건 액션 =====
  document.getElementById('btn-std-save').addEventListener('click', async () => {
    if (await ensureFolderForSave()) StandardsTab.save();
  });
  document.getElementById('btn-std-print').addEventListener('click', () => StandardsTab.print());
  document.getElementById('btn-std-excel').addEventListener('click', () => StandardsTab.exportExcel());
  document.getElementById('btn-std-reset').addEventListener('click', () => StandardsTab.resetToDefaults());

  // ===== 제품 선택 (양쪽 picker 동기화) =====
  document.querySelectorAll('select.product-picker').forEach(sel => {
    sel.addEventListener('change', async (e) => {
      StandardsTab.setActive(e.target.value);
      // 차종/품명 선택 시: 그 제품의 전일 맨 마지막 입력값 자동 로드 (없으면 조용히 넘어감)
      await FormTab.loadLatestForCurrentProduct({ auto: true });
    });
  });

  // ===== 신규 제품 / 제품 수정 공용 폼 =====
  const newProductForm = document.getElementById('new-product-form');
  const NP_KEYS = ['차종','품명','호기','TON','이름','원재료명','CAVITY'];
  function npInput(k) { return document.getElementById('np-' + k); }

  let editingProductId = null;  // null=신규 추가 모드, 값 있으면 해당 제품 수정 모드
  const formTitleEl = document.getElementById('product-form-title');
  const confirmBtn  = document.getElementById('btn-confirm-add-product');

  function openAddProductForm() {
    editingProductId = null;
    if (formTitleEl) formTitleEl.innerHTML = '<span class="hbar"></span> 신규 제품 추가';
    confirmBtn.textContent = '추가';
    newProductForm.style.display = '';
    NP_KEYS.forEach(k => { const el = npInput(k); if (el) el.value = ''; });
    npInput('차종').focus();
    newProductForm.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  function openEditProductForm() {
    const ap = StandardsTab.activeProduct();
    if (!ap) { toast('수정할 제품이 없습니다', 'error'); return; }
    editingProductId = ap.id;
    if (formTitleEl) formTitleEl.innerHTML = '<span class="hbar"></span> 현재 제품 수정';
    confirmBtn.textContent = '수정 저장';
    newProductForm.style.display = '';
    npInput('차종').value = ap.차종 || '';
    npInput('품명').value = ap.품명 || '';
    SCHEMA.PRODUCT_DEFAULT_KEYS.forEach(k => {
      const el = npInput(k);
      if (el) el.value = (ap.defaults && ap.defaults[k] != null) ? ap.defaults[k] : '';
    });
    npInput('차종').focus();
    newProductForm.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  function closeAddProductForm() {
    newProductForm.style.display = 'none';
    editingProductId = null;
  }

  document.getElementById('btn-add-product-entry').addEventListener('click', openAddProductForm);
  document.getElementById('btn-add-product-std').addEventListener('click', openAddProductForm);
  document.getElementById('btn-edit-product-entry').addEventListener('click', openEditProductForm);
  document.getElementById('btn-edit-product-std').addEventListener('click', openEditProductForm);
  document.getElementById('btn-cancel-add-product').addEventListener('click', closeAddProductForm);
  confirmBtn.addEventListener('click', () => {
    const car  = (npInput('차종').value || '').trim();
    const part = (npInput('품명').value || '').trim();
    if (!car || !part) { toast('차종과 품명을 모두 입력하세요', 'error'); return; }
    // 중복 검사 (수정 모드에서는 자기 자신 제외)
    if (StandardsTab.products().some(p => p.차종 === car && p.품명 === part && p.id !== editingProductId)) {
      toast('이미 같은 차종/품명의 제품이 있습니다', 'error'); return;
    }
    // defaults 수집 (차종/품명 제외)
    const defaults = {};
    SCHEMA.PRODUCT_DEFAULT_KEYS.forEach(k => {
      const v = (npInput(k).value || '').trim();
      if (v !== '') defaults[k] = (k === 'TON' || k === 'CAVITY') ? Number(v) : v;
    });
    if (editingProductId) {
      StandardsTab.updateProduct(editingProductId, car, part, defaults);
    } else {
      StandardsTab.addProduct(car, part, defaults);
    }
    closeAddProductForm();
  });

  document.getElementById('btn-del-product-std').addEventListener('click', () => {
    const ap = StandardsTab.activeProduct();
    if (ap) StandardsTab.deleteProduct(ap.id);
  });

  // ===== 초기 부트스트랩 =====
  async function bootstrap() {
    if (Storage.isConnected()) {
      const std = await Storage.loadStandards();
      if (std) {
        // v1 자동 마이그레이션
        StandardsTab.setDb(SCHEMA.migrateStandards(std));
      }
    }
    StandardsTab.render();
    FormTab.render();
    Dashboard.init();
    if (Storage.isConnected()) {
      // 폴더 연결 직후: 어제 마지막 기록을 폼에 자동 채움 (있을 때만)
      const records = await Storage.loadAllRecords();
      if (records.length) {
        await FormTab.loadLatest();
        toast(`전일 기록 자동 로드됨 — 변경된 셀만 수정 후 저장하세요`, 'success');
      }
      await Dashboard.refresh();
    }
  }

  // ===== 키보드 단축키 =====
  document.addEventListener('keydown', (e) => {
    // 입력란 안에서는 단축키 비활성화 (텍스트 편집 방해 안 함)
    const inField = ['INPUT','SELECT','TEXTAREA'].includes(document.activeElement?.tagName);
    if (e.ctrlKey && e.key.toLowerCase() === 's') {
      e.preventDefault();
      // 어느 탭이든 가장 적절한 저장 동작
      const activeTab = document.querySelector('.tab-panel.active');
      ensureFolderForSave().then((ok) => {
        if (!ok) return;
        if (activeTab?.id === 'tab-entry') FormTab.saveRecord();
        else if (activeTab?.id === 'tab-standards') StandardsTab.save();
      });
    } else if (e.ctrlKey && e.key.toLowerCase() === 'l' && !inField) {
      e.preventDefault();
      FormTab.loadLatest();
    }
  });

  // ===== 첫 렌더 =====
  function firstRender() {
    // 로컬에 보관된 표준조건 복원 (없으면 기본 샘플 유지)
    const std = Storage.loadStandardsLocal();
    if (std) StandardsTab.setDb(std);
    StandardsTab.render();
    FormTab.render();
    Dashboard.init();
    if (typeof HistoryTab !== 'undefined') HistoryTab.init();
    if (typeof StdHistory !== 'undefined') StdHistory.init();
    // 로컬에 누적된 기록이 있으면 마지막 기록을 폼에 자동 채움
    Storage.loadAllRecords().then(recs => {
      if (recs.length) FormTab.loadLatest();
      if (typeof Dashboard !== 'undefined') Dashboard.refresh();
    });
  }
  if (document.readyState !== 'loading') firstRender();
  else document.addEventListener('DOMContentLoaded', firstRender);
})();
