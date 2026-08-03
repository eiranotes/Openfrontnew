# OpenFront Fortress UI System Overhaul

기준 브랜치: `agent/project-handoff-2026-08-02`  
작업 브랜치: `agent/ui-system-overhaul-2026-08-02`

## 1. 목표

게임 지도를 항상 주 화면으로 유지하면서, 홈부터 인게임 명령까지 하나의 작전 지도 제품처럼 보이고 동작하도록 UI 체계를 통합한다. 화면을 새 카드와 장식으로 채우는 방식은 사용하지 않는다. 현재 기능과 조작 흐름을 보존하고, 정보 위계·입력 피드백·모바일 공간 사용을 개선한다.

핵심 목표는 다음과 같다.

- 지도를 가리지 않는 명령 UI
- 공격·상륙·건설·외교의 상태와 결과를 실행 전에 이해할 수 있는 정보 구조
- 모바일과 데스크톱에서 동일한 개념 모델을 유지하되 배치만 다르게 구성
- 기능마다 제각각인 색상·radius·그림자·타이포를 디자인 토큰으로 통합
- 모든 주요 상태에 기본·hover·focus-visible·pressed·disabled·pending 피드백 제공
- 원격 폰트나 새 대형 이미지 의존성 없이 빠르게 렌더링

## 2. 적용한 외부 설계 규칙

검토한 자료:

- Anthropic `frontend-design` skill: 명확한 미학 방향, 맥락에 맞는 차별점, 토큰 일관성, 무작위 장식 대신 의도적인 구성
  - https://github.com/anthropics/skills/blob/main/skills/frontend-design/SKILL.md
- Microsoft `frontend-design-review` skill: frictionless, quality craft, trustworthy의 세 축과 접근성·코드 품질 동시 검토
  - https://github.com/microsoft/skills/blob/main/.github/skills/frontend-design-review/SKILL.md
- Apple HIG `Designing for games`, `Game controls`: 플랫폼별 기본 입력 방식, 터치 크기, 메뉴 동작, 포인터와 터치의 차이
  - https://developer.apple.com/design/human-interface-guidelines/designing-for-games/
  - https://developer.apple.com/design/human-interface-guidelines/game-controls
- OpenFront 공식 UI와 릴리스 기록: 지도 중심 플레이, 플레이어 정보·이벤트·건설 메뉴의 실제 기능 구조, 최근 단축키·전체화면·로비 개선 방향
  - https://openfront.io/
  - https://github.com/openfrontio/OpenFrontIO/releases

이 자료에서 스타일을 복제하지 않고 다음 실행 규칙만 사용한다.

1. 하나의 명확한 시각 방향을 선택한다.
2. 화면마다 새 카드 문법을 만들지 않는다.
3. 가장 자주 쓰는 명령을 첫 계층에 두고, 설명과 상세 수치는 점진적으로 공개한다.
4. 포인터 전용 hover 정보에 의존하지 않는다.
5. 애니메이션은 상태 변화를 설명하는 데만 쓰며, 장식용 반복 모션을 제거한다.
6. 터치와 마우스의 입력 차이를 별도 검증한다.

## 3. 미학 방향: Operational Atlas

Fortress 포크의 UI를 `Operational Atlas`로 정의한다.

- 지도: 가장 밝고 넓은 정보 표면
- UI 표면: 불투명한 먹색·청회색의 얇은 명령판
- 경계: 1px 실선과 구획선, 그림자보다 구조를 우선
- 강조색: 명령 가능한 상태는 청록, 위험과 파괴는 적색, 경제·지원은 황동색
- 모서리: 작은 radius만 사용하고 pill은 상태 태그와 숫자 제어에 한정
- 질감: 장식용 그라데이션·glass blur·neon glow를 사용하지 않음
- 타이포: 숫자는 tabular, 제목은 짧고 단단하게, 설명문은 한 단계 낮은 대비
- 아이콘: 의미가 중복되는 장식 아이콘을 제거하고 명령 유형을 구분하는 아이콘만 유지

금지 항목:

- 보라색 중심 SaaS 팔레트
- 모든 내용을 둥근 카드에 넣는 대시보드
- 여러 개의 동일한 카드 그리드
- 의미 없는 KPI 배지
- 과도한 blur, glow, gradient border
- hover 확대와 `transition: all`
- 화면마다 다른 radius와 그림자
- 모바일에서 지도를 덮는 중앙 대형 모달

## 4. 정보 구조

### 4.1 홈과 싱글플레이

- 홈은 게임 진입을 첫 화면의 명확한 주 행동으로 둔다.
- 로고·버전·주 행동·보조 링크를 한 축으로 정리한다.
- 싱글플레이 설정은 왼쪽에 맵과 게임 요약, 오른쪽에 설정을 배치한다.
- 모바일에서는 설정을 한 열로 재배치하고 시작 버튼을 하단 sticky action으로 유지한다.
- 토글과 선택 요소는 카드가 아니라 행 단위 control group으로 구성한다.

### 4.2 인게임 HUD

- 상단: 시간·속도·전역 상태처럼 전 게임에 걸친 정보
- 좌하단: 내 국가의 병력·경제·훈련 상태
- 우하단: 이벤트·동맹·외교 인박스
- 선택 시 하단 중앙 또는 우측: 선택한 국가/도시의 명령 패널
- 공격 비율은 명령 실행과 가까운 위치에 유지

동일 정보를 두 패널에 중복 표시하지 않는다.

### 4.3 국가 명령 패널

첫 계층:

- 공격
- 상륙
- 동맹·외교 핵심 행동

둘째 계층:

- 현재 공격 비율
- 예상 투입 병력
- 실행 가능 여부와 막힌 이유

셋째 계층:

- 상대 군사 품질
- 경제·시설·외교 상세

주요 버튼은 `명령명 / 결과 또는 규모`의 2행 구조를 유지하고, 로딩 중에는 요청 상태를 표시한다.

### 4.4 건설·도시 발전

- 중앙 대형 모달을 데스크톱 소형 도크, 모바일 하단 시트로 변경
- 시설 목록과 선택 시설의 현재/다음 효과를 한 흐름으로 연결
- 도시 업그레이드 전에 비용, 훈련 수용량, 행정역량, 군사 등급 변화를 표시
- 건설 불가 상태는 버튼을 숨기지 않고 원인을 표시

### 4.5 이벤트와 동맹

- 긴 이벤트 피드를 기본 노출하지 않는다.
- 긴급 공격, 실행 가능한 동맹 요청, 일반 기록을 구분한다.
- 긴급 이벤트는 지도 focus와 즉시 대응 행동을 제공한다.
- 읽은 항목과 만료 항목은 시각적 우선순위를 낮춘다.

## 5. 디자인 토큰

`src/client/styles/command-ui.css`에 다음 토큰 계층을 만든다.

- surface: canvas, panel, panel-raised, control
- border: subtle, normal, strong
- text: primary, secondary, muted, inverse
- semantic: command, support, warning, danger, success
- spacing: 2, 4, 6, 8, 12, 16, 20, 24
- radius: 2, 4, 6, 8
- elevation: none, dock, modal
- motion: instant, fast, standard
- target: 36px compact pointer, 44px touch

Tailwind 유틸리티가 남아 있어도 핵심 제품 표면은 semantic class와 CSS variable을 사용하도록 이동한다.

## 6. 구현 단계

### Phase A — UI 감사와 토큰 정리

- 홈, 싱글플레이, HUD, 국가 패널, 건설, 이벤트, 설정의 현재 구조 기록
- 중복 색상·radius·shadow·animation 추출
- `command-ui.css` 토큰과 공통 상태 클래스 추가
- reduced-motion, focus-visible, safe-area 기본 규칙 통합

### Phase B — 홈과 싱글플레이

- 첫 진입 시선 흐름 정리
- 설정 control group 통합
- 데스크톱과 모바일 시작 행동 고정
- 맵 정보와 설정 상태의 요약 개선

### Phase C — 인게임 명령 표면

- 상단/좌하단/우하단 HUD의 역할 분리
- 국가 명령 패널의 계층과 버튼 상태 통합
- 공격·상륙·동맹 버튼의 명령 규모와 상태 표시
- 이벤트 인박스 밀도 조정

### Phase D — 건설과 발전

- 비모달 건설 도크/시트
- 도시 업그레이드 프리뷰
- 지도상의 발전 단계와 선택 상태 구분

### Phase E — 회귀 검증과 Pages

- 1440×900, 1024×768, 390×844에서 시각·입력 검증
- 홈, 설정, 게임 진입, 국가 선택, 공격, 상륙, 동맹, 건설, 설정 화면 캡처
- overflow, safe-area, focus, pointer interception, stale async 상태 검사
- GitHub Pages 배포 후 실제 번들 경로와 Worker 로딩 검증

## 7. 이번 PR의 구현 범위

이번 UI PR에서는 다음을 우선 완료한다.

- 디자인 토큰과 공통 interaction state
- 홈·싱글플레이 화면의 정보 위계와 반응형 배치
- 인게임 HUD·국가 명령·이벤트 표면의 시각 통합
- 건설 메뉴의 지도 우선형 레이아웃 1차 개편
- 데스크톱·태블릿·모바일 브라우저 스모크와 스크린샷 산출물
- GitHub Pages 배포

도시 성장의 신규 게임 규칙, 공개 멀티플레이 서버, 대규모 신규 이미지 에셋은 포함하지 않는다.

## 8. 완료 조건

- 홈부터 인게임까지 동일한 색·타입·공간·상태 문법 사용
- 주요 명령이 장식 없이 1초 안에 식별 가능
- 모바일 주요 조작 44px 이상
- 모든 상호작용에 focus-visible 및 pressed 상태 존재
- hover만으로 제공되는 필수 정보 없음
- 패널 바깥 지도 입력 가능
- 390px 폭에서 가로 overflow 없음
- `prefers-reduced-motion` 지원
- 기존 Fortress·상륙·동맹·터치 테스트 통과
- TypeScript, build, Worker asset base, 브라우저 스모크 통과
- Pages에서 WebGL 게임 진입과 핵심 패널 렌더링 확인
