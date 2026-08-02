# OpenFront Fortress

개인 컴까기와 친구 플레이를 위해 OpenFront를 개조한 밸런스 포크입니다.

- 작은 영토에서 도시를 발전시키면 전체 병력의 질이 상승합니다.
- 도시 수용량보다 병력이 많아지면 평균 품질이 낮아집니다.
- 대국은 영토 점유율에 따라 전투·점령 페널티를 받습니다.
- 점령한 고급 시설과 도시를 그대로 흡수할 수 없습니다.
- 핵 피해와 연사 능력을 낮추고 초기 방공을 강화했습니다.

상세 수치는 [FORTRESS_MODE.md](./FORTRESS_MODE.md)를 참고하십시오.

## 브라우저에서 컴까기

예정된 GitHub Pages 주소:

```text
https://eiranotes.github.io/Openfrontnew/
```

GitHub 보안 정책상 Actions 토큰이 새 Pages 사이트를 최초 생성하지 못하므로, 저장소 소유자가 아래 설정을 한 번 해야 합니다.

1. 저장소의 **Settings**를 엽니다.
2. 왼쪽 메뉴에서 **Pages**를 선택합니다.
3. **Build and deployment → Source**를 **GitHub Actions**로 지정합니다.
4. **Actions**에서 `Bootstrap, test, and deploy Fortress`를 선택하고 **Run workflow**를 실행합니다.

배포 워크플로는 정적 사이트를 올린 뒤 공개 HTML과 JavaScript 번들을 다시 받아 검증합니다. 성공하면 저장소에 `PAGES_STATUS.md`가 생성됩니다.

페이지가 열린 뒤:

1. **Single Player**를 선택합니다.
2. 기본 프리셋은 중간 난이도, 봇 80명, Compact Map입니다.
3. 수소폭탄과 MIRV는 기본 비활성화되고, 약화된 원자폭탄은 사용할 수 있습니다.
4. 도시를 Lv3·5·7·9까지 올리면 훈련군·상비군·정예군·근위군 단계가 해금됩니다.
5. 하단 HUD에서 현재 군사 등급, 품질 배수, 훈련 충족률을 확인할 수 있습니다.

## 로컬 실행

필요 사항:

- Node.js 22
- npm 10.9.2 이상
- Git

```bash
git clone https://github.com/eiranotes/Openfrontnew.git
cd Openfrontnew
npm run inst
npm run dev
```

같은 네트워크의 친구가 접속하게 하려면:

```bash
npm run dev:host
```

친구는 호스트 PC의 내부 IP와 9000번 포트로 접속합니다.

```text
http://호스트-IP:9000
```

## Fortress 핵심 규칙

### 병력 품질

| 최고 완성 도시 | 등급 | 최대 품질 |
| ---: | --- | ---: |
| Lv1–2 | 징집군 | ×1.00 |
| Lv3–4 | 훈련군 | ×1.20 |
| Lv5–6 | 상비군 | ×1.45 |
| Lv7–8 | 정예군 | ×1.70 |
| Lv9+ | 근위군 | ×2.00 |

도시 전체 레벨 1당 병력 200,000명을 훈련할 수 있습니다. 본토 병력, 진행 중인 공격 병력, 수송선 병력을 합한 총병력이 수용량을 초과하면 품질이 ×1.00 방향으로 희석됩니다.

### 과확장과 점령

- 전체 육지 20%부터 과확장 페널티가 시작됩니다.
- 50% 이상이면 공격 손실 최대 +35%, 점령 시간 비용 최대 +45%가 적용됩니다.
- 점령된 도시는 3레벨 하락하고 항구는 Lv1로 초기화됩니다.
- 공장·사일로·SAM·방어기지는 점령 시 파괴됩니다.
- 인간 플레이어 정복 시 금 획득은 50%에서 25%로 감소했습니다.

### 핵과 방공

- 원자폭탄: 150만 골드, 반경 8/20
- 수소폭탄: 1,000만 골드, 반경 45/65
- 비 MIRV 핵 병력 피해 계수: 5 → 2
- 피해 계산의 영토 분모 최솟값: 5,000
- 사일로 재사용: 25초
- 첫 SAM: 75만 골드, 건설 10초, 기본 사거리 90, 재장전 6초

## 검증

GitHub Actions에서 다음 항목을 통과했습니다.

```bash
npx vitest run tests/FortressBalance.test.ts
npx tsc --noEmit
npm run build-dev
```

- Fortress 단위 테스트 3개 통과
- 전체 TypeScript 검사 통과
- GitHub Pages 경로를 사용하는 정적 싱글플레이 빌드 통과

## 라이선스와 출처

이 저장소는 `openfrontio/OpenFrontIO`의 공개 소스를 기반으로 하며, 기준 업스트림 커밋은 `.fortress-source`에 기록되어 있습니다.

- 코드: GNU Affero General Public License v3.0
- 공개 자산: CC BY-SA 4.0
- 별도 권리가 명시된 자산은 해당 조건을 따릅니다.
- OpenFront 저작권 고지는 유지됩니다.

전체 조건은 [LICENSE](./LICENSE), [LICENSE-ASSETS](./LICENSE-ASSETS), [LICENSING.md](./LICENSING.md)를 참고하십시오.
