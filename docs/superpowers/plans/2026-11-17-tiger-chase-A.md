# 호랑이 추격 10초 영상 (A안 2.5D) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 첨부 이미지 에셋으로 10초 1080p30 호랑이 추격 영상을 Three.js(2.5D) + HyperFrames로 렌더하고 오디오를 믹싱해 최종 MP4와 평가 기록을 만든다.

**Architecture:** Python 전처리(rembg 누끼, Depth-Anything 깊이맵) → Gemini TTS/Lyria + ffmpeg 효과음 → `timing.json` 하나가 화면·소리 타이밍의 단일 원천 → HyperFrames 컴포지션 안 Three.js 캔버스를 `hf-seek`에서 GSAP 타임라인 seek 후 렌더 → ffmpeg 믹싱·합본.

**Tech Stack:** three@0.187.0, gsap@3.15.1, hyperframes@0.9.61, Python 3 + rembg(isnet-general-use) + onnxruntime + scipy + Pillow, ffmpeg 6.1, Gemini API(TTS·Lyria).

**Spec:** `docs/superpowers/specs/2026-11-17-tiger-chase-design.md`

## Global Constraints

- 출력: 1920×1080, 30fps, 10.0s(±1s), H.264 + AAC
- 모든 프레임은 시간 t만의 함수: `requestAnimationFrame`/`Date.now`/시드 없는 `Math.random` 금지, 랜덤은 mulberry32 시드
- API 키는 `request_credential`(호스트 `generativelanguage.googleapis.com`, 헤더 `x-goog-api-key`)로만. 스크립트는 더미 값 `PROXY_INJECTED` 전송. 키를 파일·로그·커밋에 남기지 않음
- 커밋 전 `git grep -n "AIza"`가 설계서 한 줄 외 0건
- 오디오: 최종 -14 LUFS(±1), true peak ≤ -1 dBTP, 대사 구간 BGM 더킹
- 캐릭터는 정면/3·4 각도로만 노출 (카드 측면 금지)
- 검수 지점 ①~⑤에서 사용자에게 SendUserFile로 보내고 피드백 반영 후 진행

## Review Focus

1. 누끼 털 테두리 할로·옆 칸 조각 잔존 → 어두운/밝은 배경 양쪽 합성 시트로 확인 (Task 1)
2. 같은 시간 두 번 렌더 시 픽셀 불일치(비결정성) → snapshot 4,0,4 바이트 비교 (Task 4)
3. 9.3s 정지 이후 미세 움직임(파티클·그레인·흔들림 누수) → 9.4s와 9.6s 프레임의 그레인 제외 동일성 확인 (Task 6)
4. TTS 결과가 목표 길이 초과 → timing.json 재계산 후 총 길이 10±1s 검사 (Task 3)
5. 깊이 메시 가장자리 늘어짐이 카메라 이동 끝점에서 노출 → 각 샷 시작/끝 스냅샷 확인 (Task 4, 6)

---

### Task 1: 프로젝트 골격 + 에셋 전처리 (검수 ①)

**Files:**
- Create: `tools/prep_assets.py`, `tools/test_assets.py`, `a-25d/` (HyperFrames init), `a-25d/assets/chars/*.png`, `a-25d/assets/bg/{color.png,depth.png,occluder.png}`
- Create: `assets_src/` (첨부 원본 7장 복사, 키아트 제외 6장 사용)

**Interfaces:**
- Produces: `a-25d/assets/chars/{g_2,g_3,g_4,g_5,t_2,t_3,t_4,t_5,t_6}.png` (RGBA, 단일 덩어리, 높이 ≥ 400px, 하단 = 발 기준선), `a-25d/assets/chars/meta.json` = `{ "<id>": {"w":int,"h":int,"footY":float(0~1, 이미지 하단 기준 발 위치)} }`; `bg/color.png`(3344×1882), `bg/depth.png`(16bit 그레이, 가까울수록 밝음), `bg/occluder.png`(RGBA, 왼쪽 소나무 줄기·덤불·하단 바위만)

- [ ] **Step 1:** `npm i three@0.187.0 gsap@3.15.1 hyperframes@0.9.61` (루트 package.json), `npx hyperframes init a-25d --skip-skills`; Depth-Anything-V2 small ONNX를 GitHub 릴리스에서 `~/.cache/depth/`로 다운로드
- [ ] **Step 2: 실패 테스트 작성** `tools/test_assets.py`
  - `test_chars_single_component`: 각 char PNG 알파>20 영역 연결요소 1개(면적 5% 미만 조각 0)
  - `test_chars_no_halo`: 알파 경계 2px 띠의 평균 밝기가 내부 평균의 ±25% 이내
  - `test_meta`: meta.json 9개 키, footY ∈ [0.9, 1.0]
  - `test_bg`: color 3344×1882, depth 동일 크기 16bit, occluder 알파 픽셀 비율 5~30%
- [ ] **Step 3:** `python3 -m pytest tools/test_assets.py` → FAIL (파일 없음)
- [ ] **Step 4: `tools/prep_assets.py` 구현** — 3×2 그리드 크롭 → rembg(`alpha_matting=True`) → 최대 덩어리 유지 → 알파 1px erode + 경계 색 디프린지(내부색 확산) → bbox 크롭; 배경 Lanczos 2× 업스케일 → 깊이 추론 → occluder = 깊이 상위 15% ∩ 이미지 좌측 30%/하단 15% 영역
- [ ] **Step 5:** pytest PASS
- [ ] **Step 6: 검수 ①** 누끼를 어두운·밝은 배경에 올린 시트 + 깊이맵/occluder 미리보기 → `docs/review/01_assets.jpg` 전송
- [ ] **Step 7:** 커밋 `feat: 에셋 전처리 (누끼·깊이맵)`

### Task 2: 오디오 생성 (검수 ②)

**Files:**
- Create: `tools/gemini.py`, `tools/gen_voice.py`, `tools/gen_bgm.py`, `tools/gen_sfx.sh`, `tools/test_audio.py`
- Create: `a-25d/assets/audio/{v1,v2,v3,v4}.wav`, `bgm.wav`, `sfx/*.wav`, `audio/candidates/*.wav`

**Interfaces:**
- Produces: `gemini.post(path:str, body:dict) -> dict` (헤더 `x-goog-api-key: PROXY_INJECTED`), `gemini.list_models() -> list[str]`; 확정 파일 v1~v4.wav(48kHz mono), bgm.wav(48kHz stereo ≥ 12s), sfx/{wind,whoosh1,whoosh2,impact1,impact2,riser,step}.wav

- [ ] **Step 1:** `request_credential` 호출 → 저장 확인 후 `gemini.list_models()`로 TTS·Lyria 모델 ID 확정 (없으면 사용자에게 질문)
- [ ] **Step 2: 실패 테스트** `test_audio.py`: v1 0.8~1.6s, v2 1.8~3.0s, v3 0.6~1.4s, v4 0.5~1.2s; 모든 파일 true peak ≤ -1 dBTP; bgm ≥ 12s; sfx 7개 존재
- [ ] **Step 3:** FAIL 확인
- [ ] **Step 4:** `gen_voice.py` 설계서 §4 대사·연기 지시로 줄당 후보 3개(음색 다르게) 생성 → `candidates/`; `gen_bgm.py` Lyria 프롬프트(설계서 §4)로 30s 생성; `gen_sfx.sh` ffmpeg 노이즈 합성(wind) + HyperFrames 내장 sfx 복사·가공(step = impact-bass 0.18s, lowpass 400Hz)
- [ ] **Step 5: 검수 ②** 후보 묶음 MP3 + BGM 미리듣기 전송 → 사용자 선택을 v1~v4.wav로 확정, -1 dBTP 정규화
- [ ] **Step 6:** pytest PASS → 커밋 (`git grep AIza` 검사 포함)

### Task 3: 타이밍 시트 확정

**Files:**
- Create: `tools/make_timing.py`, `tools/test_timing.py`, `a-25d/assets/timing.json`, `a-25d/assets/audio/v2_env.json`

**Interfaces:**
- Produces: `timing.json` = `{ "duration": float, "shots": [{"id":"S1".."S5","start":float,"end":float}], "freeze": float, "black": float, "cues": [{"id":str,"file":str,"t":float,"gain_db":float}] }`; `v2_env.json`·`v4_env.json` = 30fps 음량 배열(0~1) (호랑이 입 뻐끔용)

- [ ] **Step 1: 실패 테스트**: 샷 연속(이전 end == 다음 start), S1.start 0, duration 9.0~11.0, freeze = S5.start+1.3, black = freeze+0.4; 대사 cue 서로 겹침 없음; 각 cue가 해당 샷 안에서 시작
- [ ] **Step 2:** FAIL → **Step 3:** 설계서 §5 초안 + 실제 wav 길이로 경계 ±0.5s 조정, 엔벨로프 추출 → PASS → 커밋

### Task 4: Three.js 장면 — 배경·대기 + 결정성 하네스

**Files:**
- Create: `a-25d/index.html`, `a-25d/compositions/scene.html`, `a-25d/src/{main.js,background.js,atmosphere.js,rng.js}`, `tools/test_determinism.sh`

**Interfaces:**
- Consumes: Task 1 bg 에셋, Task 3 timing.json
- Produces: `createBackground(scene, tex):{group, occluder}`; `createAtmosphere(scene, rng):{update(t)}`; `rng.mulberry32(seed):()=>number`, `rng.hash(i, seed):number`; `main.js`가 `window.__hf.buildReady.scene` 프로미스 등록, `hf-seek`에서 `state.seek(t)` → 모듈 `update(t)` → `renderer.render`

- [ ] **Step 1: 실패 테스트** `test_determinism.sh`: `npx hyperframes snapshot --at 4,0,4 --no-end` 결과 4s 이미지 2장 `cmp` 동일; `npx hyperframes check --json` 에러 0
- [ ] **Step 2:** FAIL → **Step 3:** 깊이 메시(256×144 세그먼트, 변위 스케일은 S1 푸시인 끝점에서 가장자리 노출 없도록 조정), occluder 카드 z 앞, 안개 카드 2장·빛줄기 카드(가산)·솔잎/먼지 인스턴스(시드 위치, t로 위치 계산) → PASS
- [ ] **Step 4:** 샷 시작/끝 10장 스냅샷 확인 후 커밋

### Task 5: 캐릭터 리그

**Files:**
- Create: `a-25d/src/character.js`, `a-25d/src/rigs.js`

**Interfaces:**
- Consumes: chars/*.png, meta.json, v2_env.json, v4_env.json
- Produces: `createCharacter(scene, {poses:string[], heightWorld:number}):{group, setState({t, pos:Vector3, pose:string|null, runCycle:boolean, cycleHz:number, lean:number, ghosts:number})}`; `rigs.grandmaAt(t)`, `rigs.tigerAt(t)` → setState 인자 (timing.json 기반 키 상태)

- [ ] **Step 1: 테스트** (`test_determinism.sh` 확장): 2.0s·2.05s 스냅샷에서 할머니 포즈가 다름(교차 동작), 같은 t 반복 동일
- [ ] **Step 2:** 구현 — 포즈 교차 9Hz(투스), bob = |sin|, 착지 프레임 squash(x1.06,y0.94)/공중 stretch(0.96,1.05), lean ±6°, 잔상 2장(알파 0.25/0.12, 직전 포즈·이전 위치), 발 밑 그림자 타원(착지 시 진해짐), 착지 먼지 퍼프; 호랑이 대사 구간은 엔벨로프 > 0.3이면 입 벌린 포즈
- [ ] **Step 3:** PASS → 스냅샷 확인 → 커밋

### Task 6: 카메라·샷·포스트·정지 → 480p 미리보기 (검수 ③)

**Files:**
- Create: `a-25d/src/camera.js`, `a-25d/src/post.js`

**Interfaces:**
- Produces: `cameraAt(t):{pos,look,fov}` (샷별 키 + 시드 흔들림, freeze 이후 freeze 시점 값 고정), `createPost(renderer, scene, camera):{render(t)}` (그레이드·비네트·그레인(프레임번호 시드)·블룸·S5 탈색·암전)

- [ ] **Step 1: 테스트**: 9.4s와 9.6s 프레임을 그레인 끈 디버그 변수로 렌더 → 비네트 변화 제외 장면 동일(차이 영역은 비네트 마스크 내), 9.9s 평균 밝기 < 5%
- [ ] **Step 2:** 구현 (설계서 §5·§6.3·§6.4 값) → PASS
- [ ] **Step 3:** `npx hyperframes render --quality draft` 480p → 렌더 시간 기록 → **검수 ③** 미리보기 MP4 + 샷별 스냅샷 시트 전송 → 피드백 반영 → 커밋

### Task 7: 믹싱 (검수 ④)

**Files:**
- Create: `tools/mix.py`, `tools/test_mix.py`, `renders/mix.wav`

**Interfaces:**
- Consumes: timing.json cues, 오디오 파일들
- Produces: `renders/mix.wav` (48kHz stereo, duration = timing.duration)

- [ ] **Step 1: 테스트**: 길이 = duration ±1프레임, 통합 -14 LUFS ±1, true peak ≤ -1 dBTP, freeze+0.05s 이후 RMS < -50 dBFS (impact 꼬리 제외 0.6s 후)
- [ ] **Step 2:** ffmpeg filter_complex (adelay 배치, 대사 구간 BGM sidechaincompress, BGM freeze에서 하드컷, loudnorm 2-pass) → PASS
- [ ] **Step 3: 검수 ④** 720p 미리보기 + 믹스 합본 전송 → 커밋

### Task 8: 최종 렌더 + 평가 기록 (검수 ⑤)

**Files:**
- Create: `renders/tiger_chase_A_1080p.mp4`, `docs/evaluation-A.md`

- [ ] **Step 1:** `npx hyperframes render` 1080p30 (렌더 시간 측정) → ffmpeg로 mix.wav 합본(`-c:v copy -c:a aac -b:a 192k -shortest`)
- [ ] **Step 2: 검증**: ffprobe 1920×1080, 30fps, 300±30프레임, 오디오 스트림 존재; `npx hyperframes audio renders/...mp4 --json` 라우드니스 범위
- [ ] **Step 3:** `docs/evaluation-A.md` — 렌더 시간(프레임당/전체), 단계별 소요, 잘된 점, 한계(판 느낌·립싱크·각도), B2에서 볼 점
- [ ] **Step 4:** `git grep AIza` 검사 → 커밋·푸시 → **검수 ⑤** 최종본 전송, 키 시크릿 삭제 안내
