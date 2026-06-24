// build_manual.js — USER_MANUAL.md 내용을 Word 문서(.docx)로 변환
// 실행: node build_manual.js

const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  Header, Footer, AlignmentType, PageOrientation, LevelFormat,
  HeadingLevel, BorderStyle, WidthType, ShadingType, VerticalAlign,
  PageNumber, PageBreak, TabStopType, TabStopPosition,
} = require('docx');
const fs = require('fs');

// ===== 공통 스타일 =====
const FONT = '맑은 고딕';
const CODE_FONT = 'Consolas';

const border = (color = 'BFBFBF') => ({ style: BorderStyle.SINGLE, size: 4, color });
const tableBorders = {
  top: border(), bottom: border(), left: border(), right: border(),
  insideHorizontal: border('D9D9D9'),
  insideVertical: border('D9D9D9'),
};

// ===== Helper =====
function H1(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 360, after: 200 },
    children: [new TextRun({ text, bold: true, size: 32, font: FONT, color: '1F3A66' })],
  });
}
function H2(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 280, after: 140 },
    children: [new TextRun({ text, bold: true, size: 26, font: FONT, color: '2563EB' })],
  });
}
function H3(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_3,
    spacing: { before: 200, after: 100 },
    children: [new TextRun({ text, bold: true, size: 22, font: FONT, color: '334155' })],
  });
}
function P(text, opts = {}) {
  return new Paragraph({
    spacing: { after: 100 },
    children: [new TextRun({ text, size: 22, font: FONT, ...opts })],
  });
}
function Bullet(text, level = 0) {
  return new Paragraph({
    numbering: { reference: 'bullets', level },
    spacing: { after: 60 },
    children: parseInline(text),
  });
}
function Numbered(text, level = 0) {
  return new Paragraph({
    numbering: { reference: 'numbers', level },
    spacing: { after: 60 },
    children: parseInline(text),
  });
}
function Code(text) {
  return new Paragraph({
    spacing: { before: 80, after: 80 },
    shading: { fill: 'F1F5F9', type: ShadingType.CLEAR },
    border: {
      top: border('CBD5E1'), bottom: border('CBD5E1'),
      left: border('CBD5E1'), right: border('CBD5E1'),
    },
    children: [new TextRun({ text, font: CODE_FONT, size: 20, color: '0F172A' })],
  });
}
function Quote(text) {
  return new Paragraph({
    spacing: { before: 80, after: 80 },
    indent: { left: 360 },
    border: { left: { style: BorderStyle.SINGLE, size: 24, color: '2563EB' } },
    children: parseInline(text, { italics: false, color: '475569' }),
  });
}

// 굵게 표시(**text**) 파싱
function parseInline(text, baseOpts = {}) {
  const runs = [];
  const re = /\*\*([^*]+)\*\*|`([^`]+)`/g;
  let last = 0, m;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) {
      runs.push(new TextRun({ text: text.slice(last, m.index), size: 22, font: FONT, ...baseOpts }));
    }
    if (m[1] !== undefined) {
      // bold
      runs.push(new TextRun({ text: m[1], bold: true, size: 22, font: FONT, ...baseOpts }));
    } else if (m[2] !== undefined) {
      // inline code
      runs.push(new TextRun({ text: m[2], font: CODE_FONT, size: 20, color: '0F172A', shading: { fill: 'F1F5F9' } }));
    }
    last = re.lastIndex;
  }
  if (last < text.length) {
    runs.push(new TextRun({ text: text.slice(last), size: 22, font: FONT, ...baseOpts }));
  }
  if (runs.length === 0) runs.push(new TextRun({ text, size: 22, font: FONT, ...baseOpts }));
  return runs;
}

// 표 생성 — width: A4 본문 폭 9026 DXA, 컬럼 균등
function buildTable(headers, rows) {
  const totalWidth = 9026;
  const colW = Math.floor(totalWidth / headers.length);
  const columnWidths = headers.map(() => colW);
  const padding = { top: 80, bottom: 80, left: 120, right: 120 };

  const headerCells = headers.map((h, i) => new TableCell({
    borders: tableBorders,
    width: { size: columnWidths[i], type: WidthType.DXA },
    shading: { fill: '1F3A66', type: ShadingType.CLEAR },
    margins: padding,
    verticalAlign: VerticalAlign.CENTER,
    children: [new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: h, bold: true, color: 'FFFFFF', size: 20, font: FONT })],
    })],
  }));

  const dataRows = rows.map((row, ri) => new TableRow({
    children: row.map((cell, ci) => new TableCell({
      borders: tableBorders,
      width: { size: columnWidths[ci], type: WidthType.DXA },
      shading: { fill: ri % 2 === 0 ? 'F8FAFC' : 'FFFFFF', type: ShadingType.CLEAR },
      margins: padding,
      verticalAlign: VerticalAlign.CENTER,
      children: [new Paragraph({ children: parseInline(String(cell)) })],
    })),
  }));

  return new Table({
    width: { size: totalWidth, type: WidthType.DXA },
    columnWidths,
    rows: [new TableRow({ tableHeader: true, children: headerCells }), ...dataRows],
  });
}

// ===== 본문 구성 =====
const children = [];

// 표지
children.push(new Paragraph({
  spacing: { before: 1800, after: 200 },
  alignment: AlignmentType.CENTER,
  children: [new TextRun({ text: '표준사출조건 MES', bold: true, size: 56, font: FONT, color: '1F3A66' })],
}));
children.push(new Paragraph({
  alignment: AlignmentType.CENTER,
  spacing: { after: 1200 },
  children: [new TextRun({ text: '사용자 매뉴얼', bold: true, size: 44, font: FONT, color: '2563EB' })],
}));
children.push(new Paragraph({
  alignment: AlignmentType.CENTER,
  children: [new TextRun({ text: '태진A&T 사출 SQ 표준조건 전산 모니터링 시스템', size: 24, font: FONT, color: '475569' })],
}));
children.push(new Paragraph({
  alignment: AlignmentType.CENTER,
  spacing: { before: 200, after: 800 },
  children: [new TextRun({ text: '표준조건 등록 · 일일사출조건 입력 · 실시간 모니터링', size: 22, font: FONT, color: '64748B' })],
}));
children.push(new Paragraph({
  alignment: AlignmentType.CENTER,
  spacing: { before: 600 },
  children: [new TextRun({ text: '최종 갱신: 2026. 05', size: 22, font: FONT, color: '64748B' })],
}));
children.push(new Paragraph({ children: [new PageBreak()] }));

// 목차
children.push(H1('목차'));
const toc = [
  '1. 시작하기',
  '2. 화면 구성 이해하기',
  '3. 표준사출조건 등록 (관리자)',
  '4. 일일사출조건 입력 (작업자)',
  '5. 사출조건 모니터링',
  '6. 데이터 관리',
  '7. 테마 / 환경설정',
  '8. 자주 묻는 질문 (FAQ)',
];
toc.forEach(t => children.push(P(t, { size: 24 })));
children.push(new Paragraph({ children: [new PageBreak()] }));

// 1. 시작하기
children.push(H1('1. 시작하기'));
children.push(H2('1-1. 권장 환경'));
children.push(Bullet('**운영체제**: Windows 10 / 11'));
children.push(Bullet('**브라우저**: Chrome 또는 Edge 최신 버전 (Firefox는 일부 기능 제한)'));
children.push(Bullet('**인터넷 연결**: 불필요 (모든 동작이 PC 안에서 처리됩니다)'));

children.push(H2('1-2. 앱 실행 방법'));
children.push(H3('방법 ① 로컬 서버 실행 (권장 — 자동 저장 가능)'));
children.push(Numbered('시작 메뉴 → PowerShell 실행'));
children.push(Numbered('아래 명령어를 그대로 복사·붙여넣기 → Enter'));
children.push(Code('python -m http.server 8000 --directory "C:\\Users\\USER\\Documents\\Export\\표준사출조건전산관리"'));
children.push(Numbered('브라우저 주소창에 http://localhost:8000 입력 → Enter'));
children.push(Numbered('작업 종료 시 PowerShell 창에서 Ctrl + C'));
children.push(H3('방법 ② 간단 실행 (파일 직접 열기)'));
children.push(Bullet('폴더에서 **index.html** 더블클릭 → Chrome / Edge로 열기'));
children.push(Bullet('⚠ 이 방법은 폴더 자동저장이 작동하지 않으므로 매번 다운로드/업로드 필요'));

children.push(H2('1-3. 폴더 연결 (최초 1회)'));
children.push(Numbered('화면 우측 상단 [폴더 선택] 클릭'));
children.push(Numbered('폴더 선택 창에서 C:\\Users\\USER\\Documents\\Export\\표준사출조건전산관리 선택'));
children.push(Numbered('"이 사이트에서 폴더 변경을 허용하시겠습니까?" → 편집 허용'));
children.push(Numbered('좌측 상단 📁 표준사출조건전산관리 (녹색)로 표시되면 연결 완료'));
children.push(Numbered('[최신 불러오기] 클릭 → 이전 데이터 자동 로드'));
children.push(Quote('💡 페이지를 새로고침하면 보안 정책상 폴더 권한이 초기화됩니다. 다시 [폴더 선택] → [최신 불러오기] 순서로 진행하세요.'));
children.push(new Paragraph({ children: [new PageBreak()] }));

// 2. 화면 구성
children.push(H1('2. 화면 구성 이해하기'));
children.push(H2('2-1. 좌측 사이드바 (메뉴)'));
children.push(buildTable(
  ['메뉴', '용도'],
  [
    ['✓ **표준사출조건**', '제품별 표준값/UCL/LCL/공차 편집 (관리자)'],
    ['◧ **사출조건 모니터링**', 'KPI 카드, 트렌드 차트, 이탈 항목 확인'],
    ['⚙ **일일사출조건 입력**', '작업자 측정값 입력, 실시간 신호등 판정'],
  ]
));

children.push(H2('2-2. 상단 도구바'));
children.push(buildTable(
  ['버튼/표시', '설명'],
  [
    ['📂 폴더 미연결 / 📁 폴더명', '현재 데이터 저장 폴더 상태'],
    ['[폴더 선택]', '데이터 저장 폴더 지정 (Chrome/Edge)'],
    ['[최신 불러오기]', '폴더에서 표준조건 + 최근 기록 자동 로드'],
    ['🌙 / ☀️', '다크 / 라이트 테마 전환'],
    ['⬤ 빨강 / 노랑 / 초록', '시스템 표시등 (장식)'],
  ]
));

children.push(H2('2-3. 제품 선택 바'));
children.push(P('모든 작업 탭의 상단에 표시됩니다.'));
children.push(Code('📦 제품  [GARNISH / UPR CVR_수출 ▼]  차종 GARNISH / 품명 UPR CVR_수출  [+ 신규 제품]'));
children.push(Bullet('**드롭다운**: 등록된 제품 중 1개 선택 → 표준값과 메타 정보가 자동 갱신'));
children.push(Bullet('**[+ 신규 제품]**: 새 제품을 등록할 때 사용 (3-2 참조)'));
children.push(Bullet('**[현재 제품 삭제]** (표준사출조건 탭에만 표시): 현재 선택된 제품 제거'));

children.push(H2('2-4. 상태 뱃지 (신호등)'));
children.push(buildTable(
  ['뱃지', '색상', '의미'],
  [
    ['**OK**', '🟢 녹색', '한계 이내 (정상)'],
    ['**주의**', '🟡 황색', '한계 경계 ±5% 이내 (경고)'],
    ['**이탈**', '🔴 적색 (깜빡임)', '한계 초과 (긴급 조치 필요)'],
    ['-', '⚪ 회색', '측정값 미입력'],
  ]
));
children.push(new Paragraph({ children: [new PageBreak()] }));

// 3. 표준사출조건 등록
children.push(H1('3. 표준사출조건 등록 (관리자)'));
children.push(Quote('🔐 관리자 작업 — 라인장/팀장이 매월 또는 제품 변경 시 1회 진행하는 작업입니다.'));

children.push(H2('3-1. 제품 선택'));
children.push(Numbered('좌측 사이드바 → 표준사출조건 클릭'));
children.push(Numbered('상단 제품 드롭다운에서 편집할 제품 선택'));

children.push(H2('3-2. 신규 제품 추가하기'));
children.push(Numbered('우측 상단 [+ 신규 제품] 클릭'));
children.push(Numbered('펼쳐진 폼에 입력'));
children.push(Bullet('**차종** (필수): 예) GARNISH, PILLAR', 1));
children.push(Bullet('**품명** (필수): 예) UPR CVR_수출', 1));
children.push(Bullet('호기 / TON / 이름 / 원재료명 / CAVITY (선택, 매번 안 적어도 됨)', 1));
children.push(Numbered('[추가] 클릭 → 새 제품이 등록되고 자동으로 활성화됨'));
children.push(Numbered('표준값/UCL/LCL을 그 제품에 맞게 수정 후 [표준조건 저장]'));

children.push(H2('3-3. 표준값 / UCL / LCL / 공차 편집'));
children.push(P('각 그룹별로 파라메터 표가 표시됩니다. 5개의 입력 컬럼이 있습니다.'));
children.push(buildTable(
  ['컬럼', '의미', '입력 시 동작'],
  [
    ['**표준값**', '목표 설정값', 'UCL/LCL이 현재 ± 만큼 자동 재계산'],
    ['**상한 UCL**', '허용 최대값', '± 표시 자동 갱신'],
    ['**하한 LCL**', '허용 최소값', '± 표시 자동 갱신'],
    ['**±**', '공차 (한쪽 편차)', 'UCL = 표준값 + ±, LCL = 표준값 − ± 자동 재계산'],
  ]
));
children.push(H3('입력 팁'));
children.push(Bullet('**표준값만 바꾸고 싶을 때**: 표준값 셀만 수정 → 상한/하한 자동 갱신'));
children.push(Bullet('**공차만 바꾸고 싶을 때**: ± 셀에 새 공차 입력 → 상한/하한 자동 갱신'));
children.push(Bullet('**상한·하한을 비대칭으로 두고 싶을 때**: UCL, LCL을 각각 직접 입력'));

children.push(H2('3-4. 그룹별 항목 목록'));
children.push(buildTable(
  ['그룹', '항목 수', '설명'],
  [
    ['사출속도', '6단', '1단 ~ 6단 (mm/s)'],
    ['사출압력', '6단', '1단 ~ 6단 (RKg)'],
    ['사출위치(보압전환)', '6단', '1단 ~ 6단 (mm)'],
    ['사이클 타임(CT)', '9개', '충진/사출/쿠션/냉각/보압시간 PH1~PH4/CYCLE TIME'],
    ['보압압력', '3단', '1단 ~ 3단 (bar)'],
    ['배압', '3단', '1단 ~ 3단 (bar)'],
    ['계량속도', '3단', '1단 ~ 3단 (%)'],
    ['계량완료', '1개', '거리 (mm)'],
    ['실린더온도', '7개', '노즐 / H1 ~ H6 (℃)'],
    ['핫러너', '79개', '열전대 타입(K/J) + H1 ~ H78 (℃)'],
    ['벨브타이머', '32개', 'GATE1~16의 DELAY/OPEN, OPEN은 A/B 타입 선택'],
    ['금형온도1', '2개', '고정측 / 이동측 (℃)'],
    ['금형온도2', '2개', '고정측 / 이동측 (℃)'],
    ['칠러온도', '2개', '고정측 / 이동측 (℃)'],
  ]
));

children.push(H2('3-5. 저장'));
children.push(Bullet('[💾 표준조건 저장] → 폴더에 standards.json 파일이 갱신됨'));
children.push(Bullet('다음에 폴더를 연결하면 이 값이 자동 로드됨'));
children.push(Bullet('[샘플 5개로 초기화] → 모든 제품을 기본 샘플 5개로 되돌림 (⚠ 변경된 내용 사라짐)'));

children.push(H2('3-6. 샘플 등록 제품 (초기 상태)'));
children.push(buildTable(
  ['차종', '품명', '비고'],
  [
    ['GARNISH', 'UPR CVR_수출', '5호기, ABS-XR404, 2 cavity'],
    ['GARNISH', 'UPR CVR_내수', '동일 작업자, 내수 사양'],
    ['GARNISH', 'BRKT_수출', 'PP-T20, 4 cavity'],
    ['PILLAR', 'UPR CVR_수출', '김철수, GRAY 색상'],
    ['PILLAR', 'BRKT_내수', 'PP-T20, 4 cavity'],
  ]
));
children.push(new Paragraph({ children: [new PageBreak()] }));

// 4. 일일사출조건 입력
children.push(H1('4. 일일사출조건 입력 (작업자)'));
children.push(Quote('👷 작업자 작업 — 사출 작업 시작 시 또는 정기 점검 시 매일 입력합니다.'));

children.push(H2('4-1. 입력 절차 (5분 이내)'));
children.push(H3('Step 1. 메뉴 선택'));
children.push(P('좌측 사이드바 → 일일사출조건 입력 클릭'));
children.push(H3('Step 2. 제품 선택'));
children.push(P('상단 드롭다운에서 작업할 제품 선택 → 차종 / 품명 / 호기 / TON / 원재료명 등이 자동 채워짐'));
children.push(H3('Step 3. 기본 정보 확인 및 보정'));
children.push(Bullet('**년 / 월 / 일** : 오늘 날짜로 자동 입력됨 (수정 가능)'));
children.push(Bullet('**이름** : 작업자 본인 이름 (이전 입력 자동 채움)'));
children.push(Bullet('**품번 / 색상 / CAVITY** : 필요 시 수정'));
children.push(H3('Step 4. 측정값 입력'));
children.push(P('각 파라메터의 측정값 칸에 사출기에서 확인한 값을 그대로 입력합니다.'));
children.push(Code('사출속도 1단    표준값 65  상한 75  하한 55   [측정값: 67]   🟢 OK\n사출속도 2단    표준값 20  상한 25  하한 15   [측정값: 28]   🔴 이탈'));
children.push(Bullet('측정값을 입력하는 순간 우측 상태 뱃지가 즉시 갱신됩니다'));
children.push(Bullet('🔴 이탈 표시 시 → 사출 조건 점검 / 라인장 보고'));
children.push(Bullet('🟡 주의 표시 시 → 다음 측정에서 추이 확인'));
children.push(Quote('💡 모든 항목을 다 입력할 필요는 없습니다. 입력한 항목만 판정됩니다.'));
children.push(H3('Step 5. 저장'));
children.push(Bullet('화면 상단 [💾 저장] 클릭'));
children.push(Bullet('이탈이 있으면 적색 토스트로 알림: "저장 완료 — ⚠ 이탈 3건"'));
children.push(Bullet('이탈이 없으면 녹색 토스트: "저장 완료 — 정상"'));
children.push(H3('Step 6. (옵션) 다음 측정 준비'));
children.push(Bullet('[🔄 초기화] → 측정값만 초기화 (메타 정보는 유지)'));
children.push(Bullet('같은 날 여러 번 측정 시 Step 4~5 반복'));

children.push(H2('4-2. 입력 화면 구조'));
children.push(Code(
`┌─────────────────────────────────────────────────┐
│ 📦 제품: GARNISH / UPR CVR_수출   [+ 신규 제품]   │
├─────────────────────────────────────────────────┤
│ 기본 정보 [년][월][일][차종][품명]...            │
├─────────────────────────────────────────────────┤
│ 사출속도 (5개 행)                                │
│ 사출압력 (5개 행)                                │
│ 사출위치 (5개 행)                                │
│ ... (14개 그룹)                                  │
└─────────────────────────────────────────────────┘`
));
children.push(new Paragraph({ children: [new PageBreak()] }));

// 5. 모니터링
children.push(H1('5. 사출조건 모니터링'));
children.push(H2('5-1. KPI 카드 (당월 누적)'));
children.push(buildTable(
  ['카드', '의미'],
  [
    ['**측정건수**', '이번 달 저장된 일일기록 횟수'],
    ['**주의 누적**', "모든 기록에서 발생한 '주의' 건수 합계"],
    ['**이탈 누적**', "모든 기록에서 발생한 '이탈' 건수 합계"],
    ['**이탈율(%)**', '이탈 / 총 측정 파라메터 비율'],
  ]
));

children.push(H2('5-2. 트렌드 차트'));
children.push(Numbered('그룹 선택 (예: 사출속도)'));
children.push(Numbered('파라메터 선택 (예: 1단)'));
children.push(Numbered('기간 선택 (당월 / 최근 30건 / 전체)'));
children.push(P('→ 꺾은선 그래프 + 가로 점선 3개 (UCL/표준값/LCL) 표시'));
children.push(P('→ 이탈 점은 적색, 주의 점은 황색으로 자동 강조'));

children.push(H2('5-3. 최근 이탈/주의 목록'));
children.push(P('최근 20건의 이탈·주의 항목이 시간순으로 표시됩니다. 어떤 파라메터가 얼마나 빈번하게 이탈하는지 확인 가능.'));
children.push(new Paragraph({ children: [new PageBreak()] }));

// 6. 데이터 관리
children.push(H1('6. 데이터 관리'));
children.push(H2('6-1. 폴더 안에 생성되는 파일'));
children.push(buildTable(
  ['파일명', '내용', '갱신 시점'],
  [
    ['standards.json', '제품 마스터 + 표준조건/공차', '[표준조건 저장] 시'],
    ['records-2026-05.json', '2026년 5월의 모든 일일기록', '[저장] 클릭 시 append'],
    ['records-2026-06.json', '6월 분 (월 바뀌면 자동 분할)', '자동 생성'],
    ['사출조건_2026-05.xlsx', 'Excel 변환 결과', '[📤 Excel] 클릭 시'],
  ]
));
children.push(Quote('💡 JSON 파일은 메모장이나 VSCode로 열어서 직접 백업/검수도 가능합니다.'));

children.push(H2('6-2. Excel 내보내기'));
children.push(Numbered('일일사출조건 입력 탭에서 [📤 Excel] 클릭'));
children.push(Numbered('다운로드 폴더에 사출조건_YYYY-MM.xlsx 파일 생성됨'));
children.push(Numbered('Excel/한컴오피스에서 열어서 인쇄 / 메일 전송 / 보고서 활용'));

children.push(H2('6-3. 최신 데이터 불러오기'));
children.push(P('페이지 새로고침 후 또는 다른 PC에서 열 때:'));
children.push(Numbered('[폴더 선택] → 작업폴더 선택'));
children.push(Numbered('[최신 불러오기] → 표준조건과 최근 1건의 기록 자동 복원'));

children.push(H2('6-4. 백업 권장 방법'));
children.push(Bullet('작업폴더 전체를 USB 또는 사내 공유 드라이브에 주 1회 복사'));
children.push(Bullet('특히 월말에 records-YYYY-MM.json 별도 보관'));
children.push(new Paragraph({ children: [new PageBreak()] }));

// 7. 테마
children.push(H1('7. 테마 / 환경설정'));
children.push(H2('7-1. 다크 / 라이트 테마 전환'));
children.push(Bullet('우측 상단 🌙 / ☀️ 아이콘 클릭'));
children.push(Bullet('선택한 테마는 자동 저장되어 다음에 열 때도 유지됨'));
children.push(Bullet('야간 작업 → 다크, 주간 사무실 → 라이트 권장'));
children.push(new Paragraph({ children: [new PageBreak()] }));

// 8. FAQ
children.push(H1('8. 자주 묻는 질문 (FAQ)'));

const faqs = [
  ['Q1. [폴더 선택] 버튼을 눌렀는데 폴더 창이 안 떠요',
    'Chrome 또는 Edge 최신 버전에서만 작동합니다. Internet Explorer / Firefox에서는 지원되지 않습니다. 또한 file:// 경로(파일 더블클릭)로 열었을 때도 작동하지 않으므로 1-2 방법 ①으로 로컬 서버를 실행하세요.'],
  ['Q2. 새로고침 후 데이터가 사라졌어요',
    '데이터는 사라지지 않았습니다. 폴더의 JSON 파일에 안전하게 저장되어 있습니다. 새로고침 후에는 [폴더 선택] → 작업폴더 다시 선택 → [최신 불러오기] → 표준조건 + 최근 기록 복원 순서로 진행하세요.'],
  ['Q3. 측정값을 입력했는데 신호등이 회색이에요',
    '해당 파라메터의 표준값이 등록되지 않았을 수 있습니다. 표준사출조건 탭에서 해당 제품의 그 항목에 표준값/UCL/LCL을 입력하세요.'],
  ['Q4. 이탈인데 신호등이 OK로 나와요',
    'UCL/LCL이 너무 넓게 설정되어 있지 않은가, 또는 표준조건을 저장하지 않은 채 측정값을 입력했는가 확인하세요. 표준조건 탭에서 값 확인 → [표준조건 저장] → 일일입력 탭으로 가서 다시 측정값 입력.'],
  ['Q5. 제품을 잘못 선택했어요. 저장 후 변경 가능한가요?',
    '저장된 기록은 측정 시점의 제품ID로 보존됩니다. 잘못 입력한 경우: records-YYYY-MM.json 파일을 메모장으로 열어 해당 항목 삭제, 또는 새로 올바른 제품 선택 후 다시 입력 (이전 기록과 함께 누적).'],
  ['Q6. Excel 내보내기 결과가 이상해요',
    'Excel을 한국어 Microsoft Office 또는 한컴오피스에서 여세요. WPS Office는 일부 헤더 병합이 안 보일 수 있습니다.'],
  ['Q7. 핫러너 H78까지 다 입력해야 하나요?',
    '사용하는 존만 입력하세요. 미사용 존은 비워두면 판정 대상에서 제외됩니다.'],
  ['Q8. 같은 날 여러 번 측정한 기록을 모두 보관할 수 있나요?',
    '네, 가능합니다. 측정마다 별도 기록으로 저장되며, 모니터링 탭의 트렌드 차트는 시간순으로 모두 표시합니다.'],
  ['Q9. 다른 PC에서도 같은 데이터를 사용할 수 있나요?',
    '작업폴더 전체를 USB 또는 네트워크 공유로 복사하세요. 새 PC에서 같은 폴더를 [폴더 선택]으로 연결하면 동일하게 작동합니다.'],
  ['Q10. 항목을 추가하거나 그룹명을 바꾸고 싶어요',
    '시스템 관리자/개발 담당자에게 요청하세요. 개발자가 js/schema.js 파일에서 파라메터 정의를 추가/수정합니다.'],
];
faqs.forEach(([q, a]) => {
  children.push(new Paragraph({
    spacing: { before: 220, after: 80 },
    children: [new TextRun({ text: q, bold: true, size: 24, font: FONT, color: '1F3A66' })],
  }));
  children.push(new Paragraph({
    indent: { left: 240 },
    spacing: { after: 100 },
    children: [
      new TextRun({ text: 'A. ', bold: true, color: '2563EB', size: 22, font: FONT }),
      new TextRun({ text: a, size: 22, font: FONT }),
    ],
  }));
});

// 문의처
children.push(H1('📞 문의'));
children.push(buildTable(
  ['분류', '담당'],
  [
    ['표준조건 등록 / 변경', '라인장 / 팀장'],
    ['일일입력 사용법', '라인장'],
    ['시스템 오류 / 개선 요청', '시스템 관리자'],
  ]
));

// 문서 끝
children.push(new Paragraph({
  alignment: AlignmentType.CENTER,
  spacing: { before: 800 },
  children: [new TextRun({ text: '— 문서 종료 —', size: 22, color: '94A3B8', italics: true, font: FONT })],
}));

// ===== Document 생성 =====
const doc = new Document({
  creator: '표준사출조건 MES',
  title: '표준사출조건 MES 사용자 매뉴얼',
  styles: {
    default: { document: { run: { font: FONT, size: 22 } } },
    paragraphStyles: [
      { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { size: 32, bold: true, font: FONT, color: '1F3A66' },
        paragraph: { spacing: { before: 360, after: 200 }, outlineLevel: 0 } },
      { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { size: 26, bold: true, font: FONT, color: '2563EB' },
        paragraph: { spacing: { before: 280, after: 140 }, outlineLevel: 1 } },
      { id: 'Heading3', name: 'Heading 3', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { size: 22, bold: true, font: FONT, color: '334155' },
        paragraph: { spacing: { before: 200, after: 100 }, outlineLevel: 2 } },
    ],
  },
  numbering: {
    config: [
      { reference: 'bullets',
        levels: [
          { level: 0, format: LevelFormat.BULLET, text: '•', alignment: AlignmentType.LEFT,
            style: { paragraph: { indent: { left: 360, hanging: 240 } } } },
          { level: 1, format: LevelFormat.BULLET, text: '◦', alignment: AlignmentType.LEFT,
            style: { paragraph: { indent: { left: 720, hanging: 240 } } } },
        ] },
      { reference: 'numbers',
        levels: [{ level: 0, format: LevelFormat.DECIMAL, text: '%1.', alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 360, hanging: 240 } } } }] },
    ],
  },
  sections: [{
    properties: {
      page: {
        size: { width: 11906, height: 16838 }, // A4
        margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
      },
    },
    headers: {
      default: new Header({
        children: [new Paragraph({
          alignment: AlignmentType.RIGHT,
          children: [new TextRun({ text: '표준사출조건 MES — 사용자 매뉴얼', size: 18, font: FONT, color: '94A3B8' })],
        })],
      }),
    },
    footers: {
      default: new Footer({
        children: [new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [
            new TextRun({ text: '- ', size: 18, font: FONT, color: '94A3B8' }),
            new TextRun({ children: [PageNumber.CURRENT], size: 18, font: FONT, color: '94A3B8' }),
            new TextRun({ text: ' -', size: 18, font: FONT, color: '94A3B8' }),
          ],
        })],
      }),
    },
    children,
  }],
});

Packer.toBuffer(doc).then(buf => {
  const out = 'C:\\Users\\USER\\Documents\\Export\\표준사출조건전산관리\\USER_MANUAL.docx';
  fs.writeFileSync(out, buf);
  console.log(`OK: ${out}  (${buf.length} bytes)`);
}).catch(e => { console.error(e); process.exit(1); });
