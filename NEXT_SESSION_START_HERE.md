# OpenFront Fortress — 다음 세션 작업 인수인계

> 기준 시각: 2026-08-02 20:54 KST  
> 저장소: `eiranotes/Openfrontnew`  
> 기준 브랜치: `main`  
> 이 문서는 현재 구현 상태, 미완료 작업, 충돌 브랜치 처리 원칙과 다음 작업 순서를 한 번에 복구하기 위한 작업 기준서다.

---

## 1. 현재 상태 요약

이 저장소는 OpenFront 최신 소스를 기반으로 다음 기능을 추가한 **실행 가능한 Fortress 개조판 알파**다.

| 범위 | 상태 |
| --- | --- |
| GitHub Pages 싱글플레이 | 실행·배포 검증 완료 |
| Fortress 병력 품질 | 구현 완료 |
| 내부개발 보너스 | 구현 완료 |
| 모바일 전투 조작 | 1차 완료 |
| 지도 우선 국가 명령 UI | 1차 완료 |
| 동맹 공동공격·자원 요청 | 1차 완료 |
| 건설·도시발전 UI | 미완료 |
| 장시간 실전 밸런싱 | 미완료 |
| 공개 인터넷 친구 팀전 | 미구현 |
| 저장소 구조 정리 | 미완료 |

진행도 판정:

- 싱글플레이 Fortress 포크 기준: 약 80%
- 친구 팀전까지 포함한 완성 게임 기준: 약 60~65%

현재 결과물은 프로토타입을 넘어 실제 플레이 가능한 기능 알파다. 정식 완성본은 아니다.

---

## 2. 기준 커밋과 배포

### 저장소 기준점

- 최신 게임 변경 커밋: `a85333a4263cda3928b4ef9fb4450d16c940582e`
- 최신 배포 상태 기록 커밋: `6134fe2ccdeb8ae647edee80b441aa1dd16393f3`
- 업스트림 기준 커밋: `753c66ef9463970616b17b625146b26a7154085d`
- 업스트림 저장소: `openfrontio/OpenFrontIO`

업스트림 기준점은 `.fortress-source`에서 확인한다.

### 배포

- URL: `https://eiranotes.github.io/Openfrontnew/`
- `PAGES_STATUS.md` 기준 마지막 검증 시각: `2026-08-02T08:00:00Z`
- 검증된 JavaScript 번들: `/Openfrontnew/assets/index-DAlLzAuq.js`

새 세션에서는 먼저 `main` SHA와 `PAGES_STATUS.md`가 이 문서 이후 변경됐는지 확인한다. 변경됐다면 최신 소스를 우선한다.

---

## 3. 확정된 제품 방향

### 핵심 목표

- 작은 영토에서도 도시·공장·훈련망에 투자하면 전략적으로 경쟁 가능해야 한다.
- 영토 확장 자체에 음수 페널티를 주지 않는다.
- 확장은 최대 병력과 전략 공간을 늘리고, 내부개발은 효율 보너스를 준다.
- 게임 화면은 지도를 주 표면으로 유지한다.
- 모바일에서 탭 한 번으로 국가를 선택하고, 공격은 명시적 액션으로 실행한다.
- 네온, 과도한 글로우, 유리 카드, 카드 그리드 중심의 일반적인 AI 생성 UI를 피한다.
- 데스크톱과 모바일 모두 실제 조작 가능성이 우선이다.

### 유지해야 할 밸런스 원칙

현재 `main`은 영토 점유율 기반 과확장 손실을 제거했다.

- 영토 보유 자체의 경제·전투·회복 배율 최저값은 `1.0`
- 도시와 공장 밀도가 높을수록 양수 보너스 지급
- 확장한 국가도 추가 투자로 최대 효율 회복 가능

이 방향을 되돌리지 않는다.

---

## 4. `main`에 구현된 기능

## 4.1 병력 품질

주요 파일:

- `src/core/game/FortressBalance.ts`
- `src/core/configuration/Config.ts`
- `src/core/execution/PlayerExecution.ts`
- `src/client/hud/layers/ControlPanel.ts`
- `tests/FortressBalance.test.ts`

현재 규칙:

- 도시 레벨 총합 1당 훈련 수용량 `200,000`
- 총 병력에는 다음이 모두 포함된다.
  - 본토 병력
  - 진행 중인 공격 병력
  - 수송선 탑승 병력
- 병력이 훈련 수용량을 넘으면 품질이 `1.0` 방향으로 희석된다.
- 최고 도시 레벨뿐 아니라 전체 도시 레벨 합계도 상위 군사 등급 조건에 포함된다.

현재 등급:

| 등급 | 최고 도시 | 전체 도시 레벨 최소 | 최대 품질 |
| --- | ---: | ---: | ---: |
| 징집군 | 1 | 1 | ×1.00 |
| 훈련군 | 3 | 3 | ×1.20 |
| 상비군 | 5 | 7 | ×1.45 |
| 정예군 | 7 | 13 | ×1.70 |
| 근위군 | 9 | 21 | ×2.00 |

HUD에는 군사 등급, 현재 품질 배수, 훈련 충족률이 표시된다.

## 4.2 내부개발 보너스

현재 상수:

- 기본 행정역량: `12,000`
- 도시 레벨 1당 행정역량: `5,000`
- 완공 공장 1개당 행정역량: `8,000`

개발 밀도에 따른 최대 보너스:

- 경제: `+30%`
- 병력 회복: `+22%`
- 실전 전투력: `+10%`

중요:

- 음수 배율은 없다.
- 현재 `main` 테스트는 `overextensionPenalties`가 전투·경제 연결에 남아 있지 않은지 확인한다.

## 4.3 전투·상륙·전술 범위

완료된 변경:

- 모바일 롱프레스 `800ms → 500ms`
- 모바일 공격·확장·상륙 취소 버튼 개선
- 선택한 SAM·핵의 사거리 표시 유지
- 핵 내부 치명 반경과 외부 피해 반경 분리
- 수송선 체력 `600`
- 함정 표적 우선순위: 적 함정 → 수송선 → 무역선
- 수송선 공격에도 함포 재장전 적용
- 호위 함정이 있으면 방어 함정이 호위를 먼저 상대하도록 조정

## 4.4 동맹 협동

주요 파일:

- `src/core/game/AllianceCoordination.ts`
- `src/core/execution/QuickChatExecution.ts`
- `src/client/hud/layers/ActionableEvents.ts`
- `src/client/hud/layers/PlayerPanel.ts`
- `tests/AllianceCoordination.test.ts`

구현된 기능:

- 공동공격 목표 요청
- 참여 시 5초 뒤 동시 공격
- 금 지원 요청
- 병력 지원 요청
- 사람 플레이어의 10% 지원 또는 직접 금액 선택
- 봇·국가 AI의 자동 지원
- 요청 15초 만료
- 중복 요청 제거와 최대 12개 인박스

봇 자동 지원 규칙:

- 금: `20,000` 예비금 초과분의 `20%`
- 병력: 최대 병력의 `55%`를 예비로 남기고 현재 병력의 최대 `12%`

현재 구조는 별도 서버 작전 객체가 아니라 기존 Target Player 업데이트와 Quick Chat 전달 체계를 확장한 방식이다.

## 4.5 싱글플레이 설정

현재 원본 OpenFront 기본값으로 복원돼 있다.

- 맵: World
- 난이도: Easy
- 봇: 400
- 맵 크기: Normal
- 모든 유닛 활성

사용자가 맵, 난이도, 봇 수, Compact, 팀전, 팀 수, 국가 수, 비활성 유닛을 바꾸면 실제 `join-lobby` 구성으로 전달된다.

관련 테스트:

- `tests/SinglePlayerOptions.test.ts`

## 4.6 UI

완료된 화면:

- 홈
- 데스크톱·모바일 내비게이션
- 싱글플레이 설정
- 맵 선택
- 인게임 상단·하단 HUD
- 공격 비율 조작
- 병력 품질 표시
- 국가 명령 패널
- 동맹 요청 인박스

시각 방향:

- 지도 우선
- 불투명 단색 표면
- 얇은 경계
- 작은 radius
- 제한된 accent
- 장식용 glow와 glass blur 축소
- 빈번한 조작은 최소 44px

## 4.7 모바일 국가 선택

최신 구현:

- 터치 탭 허용 오차 `22px`
- 작은 손가락 흔들림은 탭 유지
- 의도적인 이동만 드래그 처리
- `pointercancel` 분리
- 패널 바깥 지도 입력 통과
- 다른 국가를 한 번 탭으로 재선택 가능
- 빠른 연속 선택 시 오래된 비동기 응답이 최신 선택을 덮지 않도록 요청 번호 사용
- 모바일 하단 명령 도크
- 데스크톱 우측 소형 패널
- 상세 정보 기본 접힘

관련 테스트:

- `tests/TouchSelectionUi.test.ts`

---

## 5. 테스트와 CI 상태

주요 워크플로:

- `.github/workflows/fortress-pages.yml`
- `.github/workflows/browser-single-player-smoke.yml`
- `.github/workflows/worker-asset-base.yml`

현재 필수 검증:

- Fortress 밸런스 테스트
- 동맹 협동 테스트
- 싱글플레이 설정 테스트
- Worker asset base 테스트
- `npx tsc --noEmit`
- GitHub Pages development build
- 데스크톱 Chromium `1440×900`
- 모바일 Chromium `390×844`
- 실제 Worker 로딩, WebGL2 캔버스, 스프라이트와 인게임 진입

아직 필수 CI에 포함되지 않은 검증:

- 전체 `npm test`
- 전체 서버 테스트
- `npm run lint`
- Prettier check
- 테스트 커버리지
- 장시간 게임 시뮬레이션
- 실제 멀티클라이언트 동맹 E2E
- 공개 서버 접속 E2E

---

## 6. 현재 문서 불일치

`README.md`와 `FORTRESS_MODE.md` 일부는 이전 규칙을 설명한다.

문서에 남아 있는 잘못된 내용:

- 영토 20%부터 과확장 페널티
- 50% 이상 공격 손실 +35%
- 점령 시간 +45%
- 기본 프리셋 봇 80명
- 기본 Compact Map
- 수소폭탄과 MIRV 기본 비활성

실제 `main`:

- 영토 기반 음수 페널티 없음
- 봇 400
- Normal Map
- 모든 유닛 활성

다음 기능 작업과 함께 문서를 반드시 갱신한다.

---

## 7. 열린 PR 처리

## PR #14 — `Implement Fortress economy and responsive command UI`

상태:

- `main`보다 뒤처졌지만 독자 변경이 많은 장기 작업 브랜치
- 현재 밸런스 방향과 충돌
- 통째로 병합 금지

### 회수할 가치가 있는 부분

- 도시 업그레이드 전후 효과 미리보기
- 현재·다음 도시 금 생산량
- 전체 도시 네트워크 생산량
- 훈련 수용량 변화
- 최대 병력 변화
- 다음 군사 등급 해금 안내
- 모바일 건설 시트
- 지도 위 도시 발전 단계 시각화
- 상대 병력 품질 오버레이
- 개발 상세 패널
- `tests/FortressResponsiveUI.test.ts`의 검증 아이디어

주요 후보 파일:

- `docs/FORTRESS_DEVELOPMENT_SYSTEM.md`
- `src/client/hud/layers/BuildMenu.ts`
- `src/client/hud/layers/UnitDisplay.ts`
- `src/client/hud/layers/ControlPanel.ts`
- `src/client/hud/layers/PlayerInfoOverlay.ts`
- `src/client/render/gl/passes/StructurePass.ts`
- `src/client/render/gl/shaders/structure/structure.vert.glsl`
- `src/client/render/gl/shaders/structure/structure.frag.glsl`
- `tests/FortressResponsiveUI.test.ts`

### 폐기하거나 현재 방식으로 다시 작성할 부분

- 영토 기반 과확장 페널티
- 행정 효율 최저 `0.4`로 인한 생산 감소
- `overextensionPenalties`
- 도시 레벨당 훈련 수용량 `300,000`
- 단일 최고 도시만으로 군사 등급 결정하는 방식
- PR #14의 이전 홈·HUD UI를 현재 UI 위에 전체 덮어쓰기

### 통합 원칙

PR #14를 merge하거나 대량 cherry-pick하지 않는다.

1. 최신 `main`에서 새 통합 브랜치를 만든다.
2. 후보 파일을 diff 단위로 읽는다.
3. UI와 프리뷰 계산만 현재 `FortressBalance.ts` API에 맞춰 수동 이식한다.
4. 현재 병력 품질·개발 보너스·동맹·터치 UI를 보존한다.
5. 데스크톱과 모바일 실제 브라우저 테스트를 다시 수행한다.

## PR #16 — `Export latest main snapshot`

- 고유 변경은 임시 export workflow 하나다.
- 제품 기능 없음.
- 닫아도 된다.

---

## 8. 미완료 작업

## 8.1 건설·도시발전 UX

현재 `BuildMenu.ts`에는 원본 스타일이 많이 남아 있다.

- 중앙 대형 모달
- 반복 카드
- hover 확대
- `transition: all`
- 모바일에서도 지도를 크게 가림
- 도시 업그레이드 결과 미리보기 없음

다음 마일스톤의 최우선 작업이다.

## 8.2 발전의 지도상 피드백

필요한 표시:

- 도시 발전 단계
- 선택 도시의 현재 레벨
- 다음 업그레이드 효과
- 내 군사 품질과 상대 군사 품질
- 개발 투자에 따른 경제·병력 회복 보너스

정보를 항상 노출하지 말고 선택 또는 상세 패널에서 계층적으로 보여준다.

## 8.3 실전 밸런싱

자동 테스트로는 확인되지 않은 항목:

- 30분 이상 플레이 흐름
- 봇 20/80/400별 성장 속도
- 도시 투자 회수 기간
- 경제 +30%, 회복 +22%, 전투 +10% 동시 적용 체감
- 상륙 성공률
- 봇 자원 지원 빈도
- 공동공격 5초 지연의 실전성
- 후반 핵·SAM·도시 성장 관계
- 소국 플레이가 대기 게임으로 변하는지
- 대국의 절대 생산량 우위가 어느 정도 남는지

## 8.4 공개 친구 팀전

현재 GitHub Pages는 정적 싱글플레이다.

로컬에서는 `npm run dev:host`로 같은 네트워크 플레이가 가능하지만, 다음은 없다.

- 공개 서버
- 초대 코드
- 비공개 방
- 친구와 AI를 상대로 하는 원클릭 팀전
- 재접속
- 서버 기반 게임 종료·재시작

별도 서버 배포와 방 생성 흐름이 필요하다.

## 8.5 저장소 구조

현재 실제 수정 소스와 재생성 패치가 동시에 존재한다.

- 실제 TypeScript·CSS
- `apply-*.mjs`
- 압축 패치 조각
- 체크섬
- CI가 소스를 다시 적용하고 자동 커밋하는 과정

초기 부트스트랩에는 유효했지만 현재는 유지비가 크다.

최종 방향:

- 실제 소스를 source of truth로 사용
- 업스트림 재베이스 도구는 별도 `tools/upstream-rebase/` 계열로 격리
- 일반 PR CI가 소스 커밋을 만들지 않도록 수정
- 패치 멱등성 검증은 필요한 경우 별도 유지

---

## 9. 다음 세션 실행 순서

## 단계 0 — 최신 상태 재확인

반드시 확인:

```bash
git fetch --all --prune
git checkout main
git pull --ff-only

git log -10 --oneline
git status -sb
```

GitHub에서 확인:

- `main` 최신 SHA
- Pages 배포 상태
- 열린 PR 목록
- PR #14와 `main` 비교
- 이 문서 작성 이후 새 커밋 여부

## 단계 1 — 도시 발전 UI 통합 브랜치

권장 브랜치명:

```text
agent/city-development-command-ui
```

작업 전제:

- 최신 `main`에서 시작
- PR #14 전체 merge 금지
- 현재 UI와 터치 입력 보존

## 단계 2 — 계산 API 정리

`src/core/game/FortressBalance.ts`에 UI용 읽기 모델을 추가한다.

권장 API:

- `cityUpgradePreview(player, currentLevel)`
- `nextMilitaryTier(profile)`
- `developmentBonusBreakdown(player)`

현재 상수를 사용해야 한다.

- 훈련 수용량: 200,000/도시 레벨
- 기본 행정역량: 12,000
- 도시 레벨당: 5,000
- 공장당: 8,000
- 모든 효율 배율 최저 1.0

도시 생산량 또는 업그레이드 비용을 새로 도입한다면 별도 테스트와 문서가 필요하다. 기존 PR #14 값을 자동 채택하지 않는다.

## 단계 3 — 건설 UI

목표:

- 모바일: 지도 하단의 비모달 건설 도크 또는 시트
- 데스크톱: 지도 주변 소형 명령 패널
- 시설 선택과 업그레이드 결과를 같은 흐름에서 표시
- 핵심 정보만 기본 노출
- 상세 수치는 접기
- 터치 타깃 최소 44px
- 패널 바깥 지도 입력 가능
- hover 전용 정보 금지

도시 선택 시 표시:

- 현재 레벨
- 업그레이드 비용
- 훈련 수용량 증가
- 행정역량 증가
- 군사 등급 해금 여부
- 경제 보너스 변화

## 단계 4 — 지도 시각화

PR #14의 구조물 셰이더 변경을 참고하되 최신 렌더러와 충돌 여부를 확인한다.

요구:

- 도시 레벨을 지도에서 구분 가능
- 작은 화면에서도 과도하게 번쩍이지 않음
- 선택 상태와 발전 단계가 혼동되지 않음
- 기존 국가색·전투 가독성을 훼손하지 않음

## 단계 5 — 검증

최소 실행:

```bash
npx vitest run \
  tests/FortressBalance.test.ts \
  tests/AllianceCoordination.test.ts \
  tests/TouchSelectionUi.test.ts \
  tests/SinglePlayerOptions.test.ts \
  tests/WorkerAssetBase.test.ts

npx tsc --noEmit
npm run build-dev
npm run lint
```

추가:

- 데스크톱 `1440×900`
- 모바일 `390×844`
- 실제 게임 진입
- 건설 메뉴 열기·닫기
- 도시 건설·업그레이드
- 국가 패널과 건설 패널 입력 충돌
- 지도 드래그와 한 번 탭 선택
- safe-area와 가로 overflow

## 단계 6 — 문서와 저장소 정리

기능 통합 후:

- `README.md` 최신화
- `FORTRESS_MODE.md` 최신화
- 이 문서의 상태 갱신
- PR #16 종료
- PR #14 회수 완료 후 종료
- 병합된 `agent/*` 브랜치 정리
- CI 자동 소스 커밋 제거 검토

---

## 10. 다음 마일스톤 완료 조건

도시 발전·건설 UX 마일스톤은 아래를 모두 충족해야 완료다.

- [ ] 도시 건설과 업그레이드가 데스크톱·모바일에서 동작
- [ ] 업그레이드 전후 효과를 실행 전에 확인 가능
- [ ] 현재 군사 품질과 훈련 수용량을 이해 가능
- [ ] 현재의 양수 내부개발 보너스 규칙 유지
- [ ] 영토 기반 음수 과확장 페널티가 재도입되지 않음
- [ ] 지도 입력을 불필요하게 차단하지 않음
- [ ] 모바일 주요 조작 44px 이상
- [ ] 기존 국가 명령 도크와 충돌 없음
- [ ] Fortress·동맹·터치·싱글플레이 테스트 통과
- [ ] TypeScript·빌드·lint 통과
- [ ] 데스크톱·모바일 실제 브라우저 검증 통과
- [ ] README와 규칙 문서가 코드와 일치

---

## 11. 반드시 먼저 읽을 파일

순서:

1. `NEXT_SESSION_START_HERE.md`
2. `src/core/game/FortressBalance.ts`
3. `tests/FortressBalance.test.ts`
4. `src/client/hud/layers/ControlPanel.ts`
5. `src/client/hud/layers/PlayerPanel.ts`
6. `src/client/hud/layers/BuildMenu.ts`
7. `src/client/styles/command-ui.css`
8. `tests/TouchSelectionUi.test.ts`
9. `.github/workflows/fortress-pages.yml`
10. PR #14의 `docs/FORTRESS_DEVELOPMENT_SYSTEM.md`

---

## 12. 새 세션 시작 지시문

다음 세션에서 아래와 같이 요청하면 된다.

```text
https://github.com/eiranotes/Openfrontnew 저장소를 확인하고
NEXT_SESSION_START_HERE.md를 먼저 읽어라.

현재 main과 문서의 기준 SHA가 달라졌는지 확인한 뒤,
PR #14는 통째로 병합하지 말고 도시 업그레이드 프리뷰,
모바일 건설 시트, 도시 발전 지도 표시, 상대 군사 품질 표시만
현재 main의 양수 내부개발 보너스 규칙에 맞춰 선별 이식해라.

영토 기반 음수 과확장 페널티는 재도입하지 말고,
현재 동맹·터치 선택·국가 명령 UI를 보존해라.
구현 후 Fortress/Alliance/Touch/SinglePlayer/Worker 테스트,
tsc, build, lint와 데스크톱·모바일 브라우저 검증까지 수행하고
변경사항을 별도 브랜치와 Draft PR로 올려라.
```

---

## 13. 주의사항

- PR #14의 코드가 많다는 이유로 전체 병합하지 않는다.
- 문서보다 최신 `main` 코드와 테스트를 우선한다.
- 현재 구현된 터치 선택과 비모달 국가 도크를 원본 UI로 되돌리지 않는다.
- 새 UI에서 네온·글로우·중첩 카드·hover 확대를 다시 늘리지 않는다.
- 기능이 실제로 연결되지 않은 상태에서 소스 문자열 존재만 검사하는 테스트에 의존하지 않는다.
- 공개 인터넷 멀티플레이는 정적 Pages 배포와 별도 작업이다.
- 밸런스 수치를 변경하면 반드시 테스트와 문서를 같은 PR에서 갱신한다.

---

## 14. 이 문서 PR의 범위

이 문서는 인수인계만 추가한다.

- 게임 소스 변경 없음
- 밸런스 변경 없음
- UI 변경 없음
- CI 변경 없음

다음 세션은 최신 `main`을 확인한 뒤 이 문서를 작업 출발점으로 사용한다.


---

## 15. 2026-08-02 상륙·명령 UI 후속 반영

이번 후속 작업에서 다음을 반영했다.

- 국가 명령 패널의 주기 갱신이 수송선 건설 가능 정보를 지우던 문제 수정
- 대형 국가의 내륙을 선택해도 전체 국경에서 도달 가능한 상륙 해안을 찾도록 수정
- 내해·고립 수역을 상륙 목표로 선택하지 않도록 수역 연결 판정 보강
- 오래된 비동기 응답이 새 국가 선택을 덮는 경쟁 상태 차단
- 지상 공격·상륙 버튼에 투입 비율과 예상 병력을 표시하고 상륙 아이콘을 분리
- 타일 참조 0을 유효한 좌표로 전달하도록 Worker 요청 수정
- README와 FORTRESS_MODE를 실제 양수 내부개발 규칙 및 기본 설정에 맞게 갱신
- 회귀 테스트: tests/LandingOperations.test.ts

세부 원인과 후속 UI 백로그는 docs/LANDING_OPERATIONS_AND_COMMAND_UI.md를 참고한다.
