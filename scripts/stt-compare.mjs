/**
 * STT 비교 실험 하니스 — "원문 없이 순수 받아쓰기를 한 번 더 돌리면 바뀐/추가된
 * 단어를 잡을 수 있나"를 실제 아이 녹음으로 검증한다.
 *
 * 준비:
 *   1) reading-test 결과 화면(개발 모드)의 "⬇ WAV+원문 저장" 버튼으로
 *      reading-pXX-<time>.wav + .txt 한 쌍을 내려받아 scripts/audio/ 에 둔다.
 *      (일부러 단어를 빼먹거나 바꿔 읽은 녹음을 몇 개 만들면 감지력 비교가 된다)
 *   2) node scripts/stt-compare.mjs scripts/audio/reading-p12-....wav
 *
 * 엔진:
 *   A. azure-pa      Azure STT + PronunciationAssessment(enableMiscue) — 현재 프로덕션.
 *                    원문을 정답지로 함께 준다. 전사가 원문 쪽으로 정규화됨.
 *   B. azure-plain   Azure STT 순수 받아쓰기 — 원문 안 줌.
 *   C. gpt4o         OpenAI gpt-4o-transcribe — 원문 안 줌.
 *   D. whisper       OpenAI whisper-1 — 원문 안 줌.
 *
 * 각 전사본을 원문과 LCS 정렬해서 놓친/삽입/치환 단어를 뽑고, 엔진별로 나란히 출력한다.
 * 비용은 오디오 길이 × 단가로 추정.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

// ---- .env.local 로드 (의존성 없이) ----
for (const line of fs.readFileSync(path.join(ROOT, ".env.local"), "utf8").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m) process.env[m[1]] ??= m[2].replace(/^["']|["']$/g, "");
}

const wavPath = process.argv[2];
if (!wavPath) {
  console.error("usage: node scripts/stt-compare.mjs <file.wav> [ref.txt]");
  process.exit(1);
}
const refPath = process.argv[3] || wavPath.replace(/\.wav$/i, ".txt");
const refText = fs.readFileSync(refPath, "utf8").trim();
const wavBuf = fs.readFileSync(wavPath);
// 우리 pcmToWav 헤더는 고정 44바이트, 16k/16bit/mono
const pcm = wavBuf.subarray(44);
const durationSec = pcm.length / (16000 * 2);

console.log(`\n파일:   ${path.basename(wavPath)}  (${durationSec.toFixed(1)}s)`);
console.log(`원문:   ${refText.split(/\s+/).length} 단어\n`);

// ---------------- 텍스트 정규화 + LCS 정렬 (route.ts 와 동일) ----------------
const normalize = (str) =>
  str
    .toLowerCase()
    .replace(/n't/g, " not")
    .replace(/'s/g, " is")
    .replace(/[^a-z\s]/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

function diff(ref, spoken) {
  const R = ref.length;
  const S = spoken.length;
  const dp = Array.from({ length: R + 1 }, () => new Array(S + 1).fill(0));
  for (let i = R - 1; i >= 0; i--)
    for (let k = S - 1; k >= 0; k--)
      dp[i][k] =
        ref[i] === spoken[k]
          ? dp[i + 1][k + 1] + 1
          : Math.max(dp[i + 1][k], dp[i][k + 1]);

  const ops = [];
  let i = 0;
  let k = 0;
  while (i < R || k < S) {
    if (i < R && k < S && ref[i] === spoken[k]) {
      ops.push({ t: "match", ref: i });
      i++;
      k++;
    } else if (k >= S || (i < R && dp[i + 1][k] >= dp[i][k + 1])) {
      ops.push({ t: "del", ref: i });
      i++;
    } else {
      ops.push({ t: "ins", sp: k });
      k++;
    }
  }

  const missed = [];
  const inserted = [];
  const substituted = [];
  let idx = 0;
  while (idx < ops.length) {
    if (ops[idx].t === "match") {
      idx++;
      continue;
    }
    const dels = [];
    const inss = [];
    while (idx < ops.length && ops[idx].t !== "match") {
      if (ops[idx].t === "del") dels.push(ref[ops[idx].ref]);
      else inss.push(spoken[ops[idx].sp]);
      idx++;
    }
    const pairs = Math.min(dels.length, inss.length);
    for (let p = 0; p < pairs; p++) substituted.push(`${dels[p]}→${inss[p]}`);
    missed.push(...dels.slice(pairs));
    inserted.push(...inss.slice(pairs));
  }
  const matched = ops.filter((o) => o.t === "match").length;
  return { missed, inserted, substituted, matched, refLen: R };
}

// ---------------- A/B. Azure ----------------
async function azure({ withPA }) {
  const SpeechSDK = await import("microsoft-cognitiveservices-speech-sdk");
  const speechConfig = SpeechSDK.SpeechConfig.fromSubscription(
    process.env.AZURE_SPEECH_KEY,
    process.env.AZURE_SPEECH_REGION
  );
  speechConfig.speechRecognitionLanguage = "en-US";
  speechConfig.setProperty(
    SpeechSDK.PropertyId.Speech_SegmentationSilenceTimeoutMs,
    "1500"
  );

  const push = SpeechSDK.AudioInputStream.createPushStream(
    SpeechSDK.AudioStreamFormat.getWaveFormatPCM(16000, 16, 1)
  );
  push.write(new Uint8Array(pcm).buffer);
  push.close();

  const recognizer = new SpeechSDK.SpeechRecognizer(
    speechConfig,
    SpeechSDK.AudioConfig.fromStreamInput(push)
  );

  if (withPA) {
    const pa = new SpeechSDK.PronunciationAssessmentConfig(
      refText,
      SpeechSDK.PronunciationAssessmentGradingSystem.HundredMark,
      SpeechSDK.PronunciationAssessmentGranularity.Phoneme,
      true
    );
    pa.applyTo(recognizer);
  }

  let text = "";
  await new Promise((resolve) => {
    recognizer.recognized = (_s, e) => {
      if (e.result.reason === SpeechSDK.ResultReason.RecognizedSpeech)
        text += e.result.text + " ";
    };
    recognizer.sessionStopped = () => resolve();
    recognizer.canceled = () => resolve();
    recognizer.startContinuousRecognitionAsync();
  });
  recognizer.close();
  return text.trim();
}

// ---------------- C/D. OpenAI ----------------
async function openaiTranscribe(model) {
  const OpenAI = (await import("openai")).default;
  const { toFile } = await import("openai");
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const res = await client.audio.transcriptions.create({
    file: await toFile(wavBuf, "audio.wav"),
    model,
    // 원문 힌트를 절대 주지 않는다 — "아이가 실제로 뭐라 했나"를 보려는 실험이므로.
    response_format: "text",
    language: "en",
  });
  return (typeof res === "string" ? res : res.text || "").trim();
}

// ---------------- 실행 ----------------
const ref = normalize(refText);

const engines = [
  { id: "A azure-pa   ", cost: durationSec * (1.32 / 3600), run: () => azure({ withPA: true }) },
  { id: "B azure-plain", cost: durationSec * (1.32 / 3600), run: () => azure({ withPA: false }) },
  { id: "C gpt4o      ", cost: durationSec * (0.006 / 60), run: () => openaiTranscribe("gpt-4o-transcribe") },
  { id: "D whisper    ", cost: durationSec * (0.006 / 60), run: () => openaiTranscribe("whisper-1") },
];

const rows = [];
for (const e of engines) {
  const t0 = Date.now();
  let transcript = "";
  let err = "";
  try {
    transcript = await e.run();
  } catch (x) {
    err = x?.message || String(x);
  }
  const ms = Date.now() - t0;
  const d = err ? null : diff(ref, normalize(transcript));
  rows.push({ ...e, transcript, err, ms, d });

  console.log(`──────── ${e.id.trim()} ${err ? "(ERROR)" : ""} ────────`);
  if (err) {
    console.log("  " + err);
  } else {
    console.log(`  전사본: ${transcript}`);
    console.log(
      `  정렬:   match ${d.matched}/${d.refLen}` +
        `  |  놓침 ${d.missed.length}: [${d.missed.join(", ")}]` +
        `  |  삽입 ${d.inserted.length}: [${d.inserted.join(", ")}]` +
        `  |  치환 ${d.substituted.length}: [${d.substituted.join(", ")}]`
    );
  }
  console.log(`  시간: ${(ms / 1000).toFixed(1)}s   비용: $${e.cost.toFixed(5)}\n`);
}

// ---------------- 요약 ----------------
console.log("════════ 요약 (엔진별 감지 건수) ════════");
console.log("engine        match    missed  inserted  substituted   $/read     x1000회");
for (const r of rows) {
  if (!r.d) {
    console.log(`${r.id}  ERROR: ${r.err}`);
    continue;
  }
  console.log(
    `${r.id}  ${String(r.d.matched + "/" + r.d.refLen).padEnd(7)}` +
      `  ${String(r.d.missed.length).padEnd(6)}` +
      `  ${String(r.d.inserted.length).padEnd(8)}` +
      `  ${String(r.d.substituted.length).padEnd(11)}` +
      `  $${r.cost.toFixed(5)}  $${(r.cost * 1000).toFixed(2)}`
  );
}
console.log(
  "\n현재 프로덕션 = A 하나. 'A + (B|C|D)' 2패스로 가면 read당 비용은 두 값의 합."
);
