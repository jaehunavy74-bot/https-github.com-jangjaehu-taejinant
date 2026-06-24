// schema.js — 사출조건 파라메터 정의 (그룹/코드/한글명/단위/기본 목표·공차)
// 모든 모듈(form/judge/dashboard/excel)이 공유하는 단일 정의

// 메타 필드 (판정 대상 아님)
const META_FIELDS = [
  { key: '년',     type: 'number', placeholder: '2026' },
  { key: '월',     type: 'number', placeholder: '5' },
  { key: '일',     type: 'number', placeholder: '12' },
  { key: '차종',   type: 'text',   placeholder: 'GARNISH' },
  { key: '품명',   type: 'text',   placeholder: 'UPR CVR_수출' },
  { key: '호기',   type: 'text',   placeholder: '5호기' },
  { key: 'TON',    type: 'number', placeholder: '850' },
  { key: '이름',   type: 'text',   placeholder: '홍길동' },
  { key: '원재료명', type: 'text', placeholder: 'ABS-XR404' },
  { key: '색상',   type: 'text',   placeholder: '' },
  { key: 'CAVITY', type: 'number', placeholder: '2' },
];

// 부동소수점 오차 정리 (소수점 6자리까지 반올림 후 의미없는 0 제거)
function round6(n) {
  if (typeof n !== 'number') return n;
  return Math.round(n * 1e6) / 1e6;
}

// ─────────────────────────────────────────────────────────────
// SQ(품질시스템) 제시 파라메터 공차 정책 — 단일 출처
//   · 노즐온도(수지온도) : ±5℃   → 실린더온도(노즐/H1~H6), 핫러너
//   · 작동유 온도        : ±5℃   → (현재 파라메터 없음)
//   · 냉각수(설비/금형) 입/출수 온도차 3℃ 이내 → 금형온도1·2, 칠러온도1·2 를 ±3℃ 관리
//   · 기타 성형조건(압력·속도·위치·계량·시간 등) : ±5% ⇒ 환산치(절대값)로 상·하한 표시
// ─────────────────────────────────────────────────────────────
const SQ_ABS_TOL = {       // 온도(℃) 그룹 — 절대 공차
  '실린더온도': 5,
  '핫러너':     5,
  '금형온도1':  3,
  '금형온도2':  3,
  '칠러온도1':  3,
  '칠러온도2':  3,
};
const SQ_PCT_TOL = 0.05;   // 그 외 성형조건 — 목표값 ±5%

// SQ 정책에 따른 공차(환산치) 계산.
//   fallback: 목표값이 0이라 ±5% 환산이 불가능한 경우(타이머류 등)에만 사용하는 수동 공차
function sqTol(group, target, fallback) {
  if (group in SQ_ABS_TOL) return SQ_ABS_TOL[group];
  const pct = round6(Math.abs(target) * SQ_PCT_TOL);
  return pct > 0 ? pct : round6(Math.abs(fallback || 0));
}

// 파라메터 정의 helper — 공차는 SQ 정책으로 산출(수동 tol은 0목표 환산불가 시 fallback)
function p(code, group, name, unit, target, tol) {
  const t = sqTol(group, target, tol);
  return {
    code, group, name, unit,
    target: round6(target),
    ucl: round6(target + t),
    lcl: round6(target - t),
    enabled: true,    // 사용/미사용 (false이면 일일입력 탭에서 숨김)
  };
}

// 텍스트(선택) 타입 파라메터 (열전대 K/J, 게이트 ON/OFF 등)
function pText(code, group, name, options) {
  return { code, group, name, unit: '-', textType: true, options, target: options[0], ucl: null, lcl: null, enabled: true };
}

const PARAMS = [
  // 1. 사출속도 1~6단 [mm/s]
  p('IJ_V1', '사출속도', '1단', 'mm/s', 10, 3),
  p('IJ_V2', '사출속도', '2단', 'mm/s', 20, 5),
  p('IJ_V3', '사출속도', '3단', 'mm/s', 50, 10),
  p('IJ_V4', '사출속도', '4단', 'mm/s', 15, 5),
  p('IJ_V5', '사출속도', '5단', 'mm/s', 10, 5),
  p('IJ_V6', '사출속도', '6단', 'mm/s', 10, 5),

  // 2. 사출압력 1~6단 [RKg]
  p('IJ_P1', '사출압력', '1단', 'RKg', 195, 15),
  p('IJ_P2', '사출압력', '2단', 'RKg', 195, 15),
  p('IJ_P3', '사출압력', '3단', 'RKg', 195, 15),
  p('IJ_P4', '사출압력', '4단', 'RKg', 195, 15),
  p('IJ_P5', '사출압력', '5단', 'RKg', 195, 15),
  p('IJ_P6', '사출압력', '6단', 'RKg', 195, 15),

  // 3. 사출위치(보압전환) 1~6단 [mm]
  p('IJ_S1', '사출위치', '1단', 'mm', 14,  3),
  p('IJ_S2', '사출위치', '2단', 'mm', 80,  5),
  p('IJ_S3', '사출위치', '3단', 'mm', 130, 5),
  p('IJ_S4', '사출위치', '4단', 'mm', 162, 5),
  p('IJ_S5', '사출위치', '5단', 'mm', 14,  3),
  p('IJ_S6', '사출위치', '6단', 'mm', 14,  3),

  // 4. 사이클 타임(CT) — 충진/사출/쿠션 + 사이클 + 보압시간 통합
  p('IJ_FILL',    '사이클 타임(CT)', '충진시간',  'sec', 3.0,  0.5),
  p('IJ_TIME',    '사이클 타임(CT)', '사출시간',  'sec', 15.0, 1.0),
  p('IJ_CUSHION', '사이클 타임(CT)', '쿠션잔량',  'mm',  12,   3),
  p('CYC_COOL',   '사이클 타임(CT)', '냉각시간',  'sec', 57,   5),
  p('HP_T_PH1',   '사이클 타임(CT)', '보압시간 PH1', 'sec', 0, 1),
  p('HP_T_PH2',   '사이클 타임(CT)', '보압시간 PH2', 'sec', 9, 1),
  p('HP_T_PH3',   '사이클 타임(CT)', '보압시간 PH3', 'sec', 0, 1),
  p('HP_T_PH4',   '사이클 타임(CT)', '보압시간 PH4', 'sec', 0, 1),
  p('CYC_TOTAL',  '사이클 타임(CT)', 'CYCLE TIME','sec', 95,   5),

  // 5. 보압압력 1~5단 [bar]
  p('HP_P1', '보압압력', '1단', 'bar', 110, 10),
  p('HP_P2', '보압압력', '2단', 'bar', 110, 10),
  p('HP_P3', '보압압력', '3단', 'bar', 110, 10),
  p('HP_P4', '보압압력', '4단', 'bar', 110, 10),
  p('HP_P5', '보압압력', '5단', 'bar', 110, 10),

  // 7. 배압 1~3단 [bar]
  p('BP_1', '배압', '1단', 'bar', 20, 5),
  p('BP_2', '배압', '2단', 'bar', 20, 5),
  p('BP_3', '배압', '3단', 'bar', 20, 5),

  // 8. 계량속도 1~3단 [%]
  p('PL_V1', '계량속도', '1단', '%', 20, 5),
  p('PL_V2', '계량속도', '2단', '%', 20, 5),
  p('PL_V3', '계량속도', '3단', '%', 20, 5),

  // 9. 계량완료거리 [mm]
  p('PL_DONE', '계량완료', '계량완료거리', 'mm', 150, 10),

  // 10. 실린더 온도 7존 (노즐/H1~H6) [℃]
  p('CY_NOZZLE', '실린더온도', '노즐', '℃', 230, 10),
  p('CY_H1',     '실린더온도', 'H1',  '℃', 250, 10),
  p('CY_H2',     '실린더온도', 'H2',  '℃', 250, 10),
  p('CY_H3',     '실린더온도', 'H3',  '℃', 240, 10),
  p('CY_H4',     '실린더온도', 'H4',  '℃', 230, 10),
  p('CY_H5',     '실린더온도', 'H5',  '℃', 220, 10),
  p('CY_H6',     '실린더온도', 'H6',  '℃', 200, 10),

  // 11. HOT RUNNER 타입 + H1~H78 (78존)
  pText('HR_TYPE', '핫러너', '열전대타입', ['K', 'J']),
  ...Array.from({ length: 78 }, (_, i) => p(`HR_H${i + 1}`, '핫러너', `H${i + 1}`, '℃', 240, 10)),

  // 12. 벨브타이머 GATE1~16 (DELAY/OPEN)
  //   DELAY: A/B 선택 없음
  //   OPEN : 행별 A/B 타입 선택 (vgType)
  p('VG1_DELAY', '벨브타이머', 'GATE1_DELAY', 'sec', 0,   1),
  { ...p('VG1_OPEN',  '벨브타이머', 'GATE1_OPEN',  'sec', 2.0, 1), vgType: 'A' },
  p('VG2_DELAY', '벨브타이머', 'GATE2_DELAY', 'sec', 2.7, 1),
  { ...p('VG2_OPEN',  '벨브타이머', 'GATE2_OPEN',  'sec', 2.0, 1), vgType: 'A' },
  p('VG3_DELAY', '벨브타이머', 'GATE3_DELAY', 'sec', 0,   1),
  { ...p('VG3_OPEN',  '벨브타이머', 'GATE3_OPEN',  'sec', 0,   1), vgType: 'A' },
  p('VG4_DELAY', '벨브타이머', 'GATE4_DELAY', 'sec', 2.5, 1),
  { ...p('VG4_OPEN',  '벨브타이머', 'GATE4_OPEN',  'sec', 2.0, 1), vgType: 'A' },
  p('VG5_DELAY', '벨브타이머', 'GATE5_DELAY', 'sec', 0,   1),
  { ...p('VG5_OPEN',  '벨브타이머', 'GATE5_OPEN',  'sec', 0,   1), vgType: 'A' },
  p('VG6_DELAY', '벨브타이머', 'GATE6_DELAY', 'sec', 0,   1),
  { ...p('VG6_OPEN',  '벨브타이머', 'GATE6_OPEN',  'sec', 0,   1), vgType: 'A' },
  // VG7~VG16 동적 생성 (동일 패턴)
  ...Array.from({ length: 10 }, (_, i) => {
    const n = i + 7;
    return [
      p(`VG${n}_DELAY`, '벨브타이머', `GATE${n}_DELAY`, 'sec', 0, 1),
      { ...p(`VG${n}_OPEN`, '벨브타이머', `GATE${n}_OPEN`, 'sec', 0, 1), vgType: 'A' },
    ];
  }).flat(),

  // 13. 금형온도 1 (고정/이동)
  p('MT_FIX', '금형온도1', '고정측', '℃', 40, 5),
  p('MT_MOV', '금형온도1', '이동측', '℃', 30, 5),

  // 14. 금형온도 2 (고정/이동)
  p('MT2_FIX', '금형온도2', '고정측', '℃', 40, 5),
  p('MT2_MOV', '금형온도2', '이동측', '℃', 30, 5),

  // 15. 칠러온도 1 (고정/이동)
  p('CH_FIX', '칠러온도1', '고정측', '℃', 25, 5),
  p('CH_MOV', '칠러온도1', '이동측', '℃', 20, 5),

  // 16. 칠러온도 2 (고정/이동)
  p('CH2_FIX', '칠러온도2', '고정측', '℃', 25, 5),
  p('CH2_MOV', '칠러온도2', '이동측', '℃', 20, 5),

];

// 그룹 목록 (정의 순서 보존)
const GROUPS = [...new Set(PARAMS.map(x => x.group))];

// 코드 → param 빠른 조회
const PARAM_MAP = Object.fromEntries(PARAMS.map(x => [x.code, x]));

// 제품별로 보관할 메타 키 (년/월/일은 매일 바뀌므로 제외)
const PRODUCT_DEFAULT_KEYS = ['호기','TON','이름','원재료명','CAVITY'];

// 샘플 제품 5종 — 차종 / 품명 조합. 일부 파라메터는 제품별로 다르게 오버라이드.
function makeProduct(id, carModel, partName, overrides = {}, defaults = {}) {
  const items = PARAMS.map(x => {
    const o = overrides[x.code];
    // 제품별 목표값만 오버라이드 → 상·하한은 SQ 공차 정책으로 재산출(환산치)
    if (o && o.target !== undefined && !x.textType) {
      const t = sqTol(x.group, o.target, (x.ucl - x.lcl) / 2);
      return { ...x, target: round6(o.target), ucl: round6(o.target + t), lcl: round6(o.target - t) };
    }
    return { ...x };
  });
  return { id, 차종: carModel, 품명: partName, defaults, items };
}

const SAMPLE_PRODUCTS = [
  makeProduct('P-001', 'GARNISH', 'UPR CVR_수출', {
    CY_NOZZLE: { target: 240, ucl: 250, lcl: 230 },
    CY_H1:     { target: 250, ucl: 260, lcl: 240 },
    IJ_V1:     { target: 65,  ucl: 75,  lcl: 55  },
    MT_FIX:    { target: 50,  ucl: 60,  lcl: 40  },
  }, {
    호기: '5호기', TON: 850, 이름: '장재후',
    품번: 'GR-UPR-EX-001', 모델명: 'GARNISH_수출_TAIL', 원재료명: 'ABS-XR404',
    GRADE: 'HU600', 색상: 'BLACK', CAVITY: 2,
  }),
  makeProduct('P-002', 'GARNISH', 'UPR CVR_내수', {
    CY_NOZZLE: { target: 235, ucl: 245, lcl: 225 },
    IJ_V1:     { target: 60,  ucl: 70,  lcl: 50  },
  }, {
    호기: '5호기', TON: 850, 이름: '장재후',
    품번: 'GR-UPR-DM-001', 모델명: 'GARNISH_내수_TAIL', 원재료명: 'ABS-XR404',
    GRADE: 'HU600', 색상: 'BLACK', CAVITY: 2,
  }),
  makeProduct('P-003', 'GARNISH', 'BRKT_수출', {
    CY_NOZZLE: { target: 245, ucl: 255, lcl: 235 },
    IJ_P1:     { target: 210, ucl: 225, lcl: 195 },
    MT_FIX:    { target: 45,  ucl: 55,  lcl: 35  },
  }, {
    호기: '5호기', TON: 850, 이름: '장재후',
    품번: 'GR-BRK-EX-001', 모델명: 'GARNISH_수출_BRKT', 원재료명: 'PP-T20',
    GRADE: 'M740', 색상: 'BLACK', CAVITY: 4,
  }),
  makeProduct('P-004', 'PILLAR', 'UPR CVR_수출', {
    CY_NOZZLE: { target: 230, ucl: 240, lcl: 220 },
    IJ_V1:     { target: 12,  ucl: 18,  lcl: 8   },
    HP_P1:     { target: 120, ucl: 130, lcl: 110 },
  }, {
    호기: '5호기', TON: 850, 이름: '김철수',
    품번: 'PL-UPR-EX-001', 모델명: 'PILLAR_수출', 원재료명: 'ABS-XR404',
    GRADE: 'HU600', 색상: 'GRAY', CAVITY: 2,
  }),
  makeProduct('P-005', 'PILLAR', 'BRKT_내수', {
    CY_NOZZLE: { target: 225, ucl: 235, lcl: 215 },
    IJ_P1:     { target: 180, ucl: 195, lcl: 165 },
    MT_FIX:    { target: 35,  ucl: 45,  lcl: 25  },
  }, {
    호기: '5호기', TON: 850, 이름: '김철수',
    품번: 'PL-BRK-DM-001', 모델명: 'PILLAR_내수_BRKT', 원재료명: 'PP-T20',
    GRADE: 'M740', 색상: 'BLACK', CAVITY: 4,
  }),
];

// v2: 표준조건 DB 전체 구조
function defaultStandardsDb() {
  return {
    version: '2.0',
    updatedAt: new Date().toISOString(),
    activeProductId: SAMPLE_PRODUCTS[0].id,
    products: SAMPLE_PRODUCTS.map(p => ({ ...p, items: p.items.map(x => ({ ...x })) })),
  };
}

// 저장된 제품 items를 현재 스키마(PARAMS)와 정합화.
//  - 스키마에 새로 추가된 코드(예: 6단)는 기본값으로 보충
//  - group/한글명/단위/options 등 메타는 스키마를 따르되, 사용자가 편집한 목표·공차·사용여부는 보존
//  - PARAMS 순서로 재정렬, 스키마에 없는 레거시 코드는 뒤에 보존
function reconcileItems(items) {
  const byCode = Object.fromEntries((items || []).map(it => [it.code, it]));
  const merged = PARAMS.map(base => {
    const ex = byCode[base.code];
    if (!ex) return { ...base };
    const out = {
      ...base,
      target:  ex.target  !== undefined ? ex.target  : base.target,
      ucl:     ex.ucl     !== undefined ? ex.ucl     : base.ucl,
      lcl:     ex.lcl     !== undefined ? ex.lcl     : base.lcl,
      enabled: ex.enabled !== undefined ? ex.enabled : base.enabled,
    };
    if (base.vgType !== undefined) out.vgType = ex.vgType !== undefined ? ex.vgType : base.vgType;
    return out;
  });
  const known = new Set(PARAMS.map(x => x.code));
  for (const it of (items || [])) {
    if (!known.has(it.code)) merged.push({ ...it });
  }
  return merged;
}

// v1(기존: items 직접) → v2 마이그레이션
function migrateStandards(db) {
  if (!db) return defaultStandardsDb();
  if (db.version === '2.0' && Array.isArray(db.products)) {
    db.products.forEach(p => { p.items = reconcileItems(p.items); });
    return db;
  }
  // v1: items만 있는 경우 → 기본 제품 1개로 감쌈
  if (Array.isArray(db.items)) {
    return {
      version: '2.0',
      updatedAt: new Date().toISOString(),
      activeProductId: 'P-LEGACY',
      products: [{ id: 'P-LEGACY', 차종: '기존', 품명: '기존 표준', items: reconcileItems(db.items) }],
    };
  }
  return defaultStandardsDb();
}

window.SCHEMA = {
  META_FIELDS, PARAMS, GROUPS, PARAM_MAP,
  defaultStandardsDb, migrateStandards, SAMPLE_PRODUCTS,
  PRODUCT_DEFAULT_KEYS,
};
