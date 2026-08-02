import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { gunzipSync } from "node:zlib";
import { spawnSync } from "node:child_process";

const root = path.resolve(process.argv[2] ?? ".");
const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const encodedPatchPath = path.join(
  scriptDir,
  "landing-operations.patch.gz.b64",
);
const encodedPatch = fs.readFileSync(encodedPatchPath, "utf8").replace(/\s/g, "");
const patch = gunzipSync(Buffer.from(encodedPatch, "base64"));

function gitApply(args) {
  return spawnSync("git", ["apply", ...args, "-"], {
    cwd: root,
    encoding: "utf8",
    input: patch,
  });
}

const check = gitApply(["--check"]);
if (check.status === 0) {
  const applied = gitApply([]);
  if (applied.status !== 0) {
    throw new Error(
      `Landing operations patch failed:\n${applied.stdout}\n${applied.stderr}`,
    );
  }
} else {
  const reverseCheck = gitApply(["--reverse", "--check"]);
  if (reverseCheck.status !== 0) {
    throw new Error(
      `Landing operations patch anchors do not match the source tree.\n` +
        `Forward check:\n${check.stdout}\n${check.stderr}\n` +
        `Reverse check:\n${reverseCheck.stdout}\n${reverseCheck.stderr}`,
    );
  }
}

const handoffPath = path.join(root, "NEXT_SESSION_START_HERE.md");
const legacyScope = `## 14. 이 문서 PR의 범위

이 문서는 인수인계만 추가한다.

- 게임 소스 변경 없음
- 밸런스 변경 없음
- UI 변경 없음
- CI 변경 없음

다음 세션은 최신 \`main\`을 확인한 뒤 이 문서를 작업 출발점으로 사용한다.`;
const currentScope = `## 14. 현재 PR의 범위

이 PR은 최초 인수인계 문서에서 상륙작전과 국가 명령 UI 수정까지 확장됐다.

- 상륙 대상 해안 탐색과 수역 연결 판정 수정
- 국가 패널 비동기 갱신과 수송선 건설 가능 상태 수정
- 지상 공격·상륙 명령 정보 구조 개선
- 관련 회귀 테스트, README, Fortress 규칙 문서 갱신
- 데스크톱·모바일 브라우저와 Worker 빌드 검증

도시 건설·업그레이드 프리뷰와 지도상의 발전 단계 표시는 다음 독립 작업 범위로 유지한다.`;
const handoffMarker = "## 15. 2026-08-02 상륙·명령 UI 후속 반영";
if (fs.existsSync(handoffPath)) {
  let handoff = fs.readFileSync(handoffPath, "utf8");
  let handoffChanged = false;

  if (handoff.includes(legacyScope)) {
    handoff = handoff.replace(legacyScope, currentScope);
    handoffChanged = true;
  }

  if (!handoff.includes(handoffMarker)) {
    handoff += `\n\n---\n\n${handoffMarker}\n\n`;
    handoff += `이번 후속 작업에서 다음을 반영했다.\n\n`;
    handoff += `- 국가 명령 패널의 주기 갱신이 수송선 건설 가능 정보를 지우던 문제 수정\n`;
    handoff += `- 대형 국가의 내륙을 선택해도 전체 국경에서 도달 가능한 상륙 해안을 찾도록 수정\n`;
    handoff += `- 내해·고립 수역을 상륙 목표로 선택하지 않도록 수역 연결 판정 보강\n`;
    handoff += `- 오래된 비동기 응답이 새 국가 선택을 덮는 경쟁 상태 차단\n`;
    handoff += `- 지상 공격·상륙 버튼에 투입 비율과 예상 병력을 표시하고 상륙 아이콘을 분리\n`;
    handoff += `- 타일 참조 0을 유효한 좌표로 전달하도록 Worker 요청 수정\n`;
    handoff += `- README와 FORTRESS_MODE를 실제 양수 내부개발 규칙 및 기본 설정에 맞게 갱신\n`;
    handoff += `- 회귀 테스트: tests/LandingOperations.test.ts\n\n`;
    handoff += `세부 원인과 후속 UI 백로그는 docs/LANDING_OPERATIONS_AND_COMMAND_UI.md를 참고한다.\n`;
    handoffChanged = true;
  }

  if (handoffChanged) {
    fs.writeFileSync(handoffPath, handoff);
  }
}

console.log("Applied landing operations, async command refresh, and command UI fixes.");
