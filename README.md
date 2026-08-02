# OpenFront Fortress

OpenFront를 기반으로 소국의 내부개발, 명시적인 모바일 명령, 동맹 협동을 강화한 전략 게임 포크입니다.

- 도시·공장 밀도가 높을수록 경제, 병력 회복, 실전 전투력이 상승합니다.
- 영토 확장 자체에는 음수 페널티가 없습니다.
- 도시 네트워크가 병력 훈련 수용량과 군사 등급을 결정합니다.
- 모바일에서는 국가를 한 번 탭한 뒤 공격·상륙·외교·지원 명령을 직접 선택합니다.
- 상륙은 선택 국가의 전체 해안 중 공격자가 실제로 도달 가능한 지점을 자동 선택합니다.

세부 규칙은 [FORTRESS_MODE.md](./FORTRESS_MODE.md), 현재 작업 상태는 [NEXT_SESSION_START_HERE.md](./NEXT_SESSION_START_HERE.md)를 참고하십시오.

## 브라우저 싱글플레이

```text
https://eiranotes.github.io/Openfrontnew/
```

기본 설정은 World, Easy, 봇 400명, Normal Map, 모든 유닛 활성입니다. 설정 화면에서 맵, 난이도, 봇 수, 맵 크기, 팀 구성과 비활성 유닛을 변경할 수 있습니다.

인게임 조작:

1. 지도에서 국가를 선택합니다.
2. 국가 명령 도크에서 지상 공격 또는 상륙을 선택합니다.
3. 공격 버튼에는 현재 공격 비율과 투입 병력이 함께 표시됩니다.
4. 상륙은 선택 지점이 내륙이어도 해당 국가의 도달 가능한 해안을 탐색합니다.
5. 하단 HUD에서 군사 등급, 품질, 훈련 충족률, 내부개발 효율을 확인합니다.

## Fortress 핵심 규칙

### 병력 품질

| 등급 | 최고 완성 도시 | 전체 도시 레벨 | 최대 품질 |
| --- | ---: | ---: | ---: |
| 징집군 | 1 | 1 | ×1.00 |
| 훈련군 | 3 | 3 | ×1.20 |
| 상비군 | 5 | 7 | ×1.45 |
| 정예군 | 7 | 13 | ×1.70 |
| 근위군 | 9 | 21 | ×2.00 |

도시 전체 레벨 1당 병력 200,000명을 훈련할 수 있습니다. 본토 병력, 진행 중인 공격 병력, 수송선 병력을 합친 총병력이 수용량을 넘으면 품질이 ×1.00 방향으로 희석됩니다.

### 내부개발

- 기본 행정역량: 12,000
- 도시 레벨 1당 행정역량: 5,000
- 완공 공장 1개당 행정역량: 8,000
- 개발 밀도 최대 보너스: 경제 +30%, 병력 회복 +22%, 실전 전투력 +10%
- 모든 효율 배율의 최저값: ×1.00

### 점령과 해상전

- 점령 도시는 기존 레벨의 절반까지 유지한 뒤 재개발해야 합니다.
- 항구는 Lv1로 초기화됩니다.
- 공장·사일로·SAM·방어기지는 점령 시 파괴됩니다.
- 수송선 체력은 600이며, 방어 함정은 호위 함정을 우선 상대합니다.
- 상륙 목표는 연결되지 않은 내해를 제외하고 공격자 해안과 연결된 수역에서만 선택됩니다.

## 로컬 실행

필요 사항: Node.js 22, npm 10.9.2 이상, Git.

```bash
git clone https://github.com/eiranotes/Openfrontnew.git
cd Openfrontnew
npm ci --ignore-scripts
npm run dev
```

같은 네트워크에서 실행하려면 `npm run dev:host`를 사용합니다. 공개 인터넷 친구 방, 초대 코드, 재접속 서버는 아직 별도 구현 대상입니다.

## 검증

```bash
npx vitest run \
  tests/FortressBalance.test.ts \
  tests/AllianceCoordination.test.ts \
  tests/SinglePlayerOptions.test.ts \
  tests/WorkerAssetBase.test.ts
npx tsc --noEmit
npm run build-dev
npm run lint
```

GitHub Actions는 정적 빌드 후 Pages HTML과 프로젝트 경로의 JavaScript 번들을 다시 내려받아 배포 결과를 확인합니다.

## 라이선스와 출처

이 저장소는 `openfrontio/OpenFrontIO` 공개 소스를 기반으로 하며 기준 업스트림 커밋은 `.fortress-source`에 기록됩니다.

- 코드: GNU Affero General Public License v3.0
- 공개 자산: CC BY-SA 4.0
- 별도 권리가 명시된 자산: 해당 고지 우선

전체 조건은 [LICENSE](./LICENSE), [LICENSE-ASSETS](./LICENSE-ASSETS), [LICENSING.md](./LICENSING.md)를 참고하십시오.
