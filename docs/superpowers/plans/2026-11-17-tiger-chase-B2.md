# 호랑이 추격 B2안 (전부 코드 3D) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 외부 에셋 없이 Three.js 코드만으로 A안과 같은 10초 장면을 만들어 720p 무음 MP4, A/B2 비교 영상, 평가 리포트를 낸다.

**Architecture:** A안과 같은 HyperFrames 하네스(`hf-seek` → GSAP 타임라인 seek → 렌더). 애니메이션 수학(보행·블렌딩·표정)은 three 의존 없는 순수 모듈로 분리해 node로 테스트한다. 모델은 Object3D 계층 리그 + 절차적 지오메트리/셰이더.

**Tech Stack:** three@0.187.0, gsap@3.15.1, hyperframes@0.9.61, node:test, pytest + Pillow/numpy, ffmpeg

**Spec:** `docs/superpowers/specs/2026-11-17-tiger-chase-B2-design.md`

## Global Constraints

- 1280×720, 30fps, 10.0s, 무음. 타이밍은 `a-25d/assets/timing.json`과 같은 값 (S1 0–1.5, S2 1.5–3.5, S3 3.5–6.0, S4 6.0–8.0, S5 8.0–10.0, freeze 9.3, black 9.7)
- 외부 모델·이미지 텍스처 0개. 텍스처는 캔버스/셰이더로 생성
- 모든 랜덤은 `rng.js`(mulberry32/hash) 시드. `Math.random`·`Date.now`·rAF 금지
- 성능 예산: 프레임당 3초 미만 (SwiftShader)
- 팔레트는 설계서 §3 값 사용

## Review Focus

1. 상태 전환 순간의 관절 튐 (crouch→run, run→lookback, anticipation→pounce) → 프레임당 각도 변화 < 25° 테스트 (Task 1)
2. 지지 구간 발 미끄러짐 → 보폭 3% 미만 테스트 (Task 1)
3. 경사 지형에서 발이 지면에 묻히거나 뜸 → 발 높이 = 지형 높이 ±0.02 테스트 (Task 5)
4. 셸 털·그림자로 인한 성능 초과 → 최중량 프레임 시간 측정 (Task 6)
5. 정지 이후 2차 동작(꼬리·치마·파티클) 누수 → 9.4=9.6 픽셀 일치 (Task 6)

---

### Task 1: 프로젝트 골격 + 순수 애니메이션 모듈

**Files:** Create `b2-3d/` (index.html, lib/, src/rng.js, src/post.js 복사), `b2-3d/src/anim/{gait.js,blend.js,face.js}`, `tools/b2_anim.test.mjs`

**Interfaces — Produces:**
- `bipedRun(phase:number, {stride:number}) -> {hip:{y,rotY,rotZ}, L:{hip,knee,ankle,footFwd,footUp}, R:{...}, armL, armR, chest, head}` (각도 rad, 거리 월드 단위; footFwd = 골반 기준 발 전후 위치)
- `quadGallop(phase, {stride}) -> {spine:[3 angles], FL,FR,HL,HR:{shoulder,elbow,wrist,footFwd,footUp}, head, tail:[6]}`
- `blendPose(a, b, w) -> pose` (같은 구조 객체를 수치 보간), `stateWeights(t, keys:[[t, state]], fade=0.2) -> {state:weight}`
- `faceAt(t, keys) -> {brow, lid, jaw, eyeX, eyeY}`

- [ ] 테스트 작성: 지지 구간 footFwd 변화율 = -속도(발 월드 고정) → 미끄러짐 < 보폭 3%; 1/30s 간격 연속 샘플의 모든 각도 변화 < 25°(블렌딩 포함); 같은 입력 같은 출력
- [ ] FAIL 확인 → 구현 → PASS → 커밋

### Task 2: 할머니 모델 + 리그 + 턴어라운드 (검수 ① 절반)

**Files:** Create `b2-3d/src/grandma.js`, `b2-3d/src/mats.js`(공용 절차적 텍스처·재질), `b2-3d/turnaround.html`(검수용 페이지, 변수 `who`)
**Produces:** `createGrandma() -> {root, joints:{pelvis,spine,chest,neck,head,shoulderL/R,elbowL/R,hipL/R,kneeL/R,ankleL/R}, setPose(pose), setFace(face), setSecondary(t, speed)}`; 키 1.0 단위(월드)
- [ ] 턴어라운드 렌더(0/45/90/180°) 스냅샷 시트 + 원본 시트 나란히 → 검토·수정 → 커밋

### Task 3: 호랑이 모델 + 리그 + 턴어라운드 (검수 ① 나머지)

**Files:** Create `b2-3d/src/tiger.js`, `b2-3d/src/fur.js`
**Produces:** `createTiger({shells:number}) -> {root, setPose(gallopPose), setFace(face), update()}`; 몸길이 약 1.6 단위
- [ ] 척추 튜브(매 프레임 단면 갱신), 줄무늬 셰이더, 셸 털, 턱 경첩, 꼬리 체인 → 턴어라운드 시트 → 검수 ① 전송 → 커밋

### Task 4: 환경 (검수 ②)

**Files:** Create `b2-3d/src/{terrain.js,flora.js,sky.js}`
**Produces:** `createTerrain() -> {mesh, heightAt(x,z), path:CatmullRomCurve3, pathPoint(u)->Vector3}`; `createFlora(scene, terrain, rng)`; `createSky(scene) -> {sun:DirectionalLight}`
- [ ] 와이드 스냅샷 + 샷 위치 후보 스냅샷 → 검수 ② 전송 → 커밋

### Task 5: 안무 통합 (검수 ③)

**Files:** Create `b2-3d/src/choreo.js`, `tools/b2_choreo.test.mjs`
**Produces:** `grandmaAt(t)->{u(path param), state weights, phase, face}`, `tigerAt(t)->{...}`; main에서 경로·지형에 맞춰 배치 + 2관절 IK로 발 높이 맞춤
- [ ] 테스트: 발 높이 = heightAt ±0.02(지지 구간), freeze 이후 동일, S1 비가시/S3 호랑이 등장
- [ ] 캐릭터 단독 보행·표정 클립 → 검수 ③ → 커밋

### Task 6: 카메라·후보정·성능 + 렌더 테스트

**Files:** Create `b2-3d/src/camera.js`, `tools/test_b2_render.py`
- [ ] 테스트(A안 test_render 재사용, 프로젝트 경로만 변경): 결정성, 장면 존재, 카메라 이동, 9.4=9.6, 탈색, 9.95 암전
- [ ] 샷 카메라(S4 오비트 25–35°), 최중량 프레임 시간 측정 → 예산 초과 시 단계 조절 → PASS → 커밋

### Task 7: 최종 렌더 + 비교 + 리포트 (검수 ④)

**Files:** Create `renders/tiger_chase_B2_720p.mp4`, `renders/compare_A_B2.mp4`(상하 스택), `docs/review/B2_compare.jpg`, `docs/evaluation-B2.md`
- [ ] 렌더(시간 측정) → ffprobe 검증 → 비교 영상·같은 시각 비교 시트 → A안 F1~F8 대비 평가 → 커밋·푸시·전송
