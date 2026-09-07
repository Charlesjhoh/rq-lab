/**
 * 실험용 합성 음성 생성 — 실제 아이 녹음이 준비되기 전에 하니스를 스모크 테스트하고
 * "깨끗한 낭독 / 일부러 틀린 낭독"의 상한선 감지력을 보기 위한 것.
 *
 * ⚠️ TTS는 성인 수준의 또렷한 발음이라 아이 녹음보다 훨씬 쉬운 케이스다.
 *    여기서 안 잡히면 아이 녹음에서도 못 잡는다(상한선), 반대는 성립 안 함.
 *
 *   node scripts/tts-gen.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
for (const line of fs.readFileSync(path.join(ROOT, ".env.local"), "utf8").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m) process.env[m[1]] ??= m[2].replace(/^["']|["']$/g, "");
}

const OUT = path.join(__dirname, "audio");
fs.mkdirSync(OUT, { recursive: true });

// 원문
const REF =
  "The little dog ran across the yard and barked at the cat. " +
  "It jumped over a small fence and chased a red ball. " +
  "Then it stopped and looked back at the boy who called its name.";

// 일부러 틀린 버전: barked→bark(어미), chased→chase(어미), small 빠짐,
// red→big(치환), "very" 삽입, "who called its name" 통째 스킵
const ALTERED =
  "The little dog ran across the yard and bark at the cat. " +
  "It jumped over a fence and chase a big ball. " +
  "Then it stopped and looked very back at the boy.";

async function synth(text, file) {
  const SpeechSDK = await import("microsoft-cognitiveservices-speech-sdk");
  const cfg = SpeechSDK.SpeechConfig.fromSubscription(
    process.env.AZURE_SPEECH_KEY,
    process.env.AZURE_SPEECH_REGION
  );
  cfg.speechSynthesisVoiceName = "en-US-JennyNeural";
  cfg.speechSynthesisOutputFormat =
    SpeechSDK.SpeechSynthesisOutputFormat.Riff16Khz16BitMonoPcm;
  const audioCfg = SpeechSDK.AudioConfig.fromAudioFileOutput(file);
  const synth = new SpeechSDK.SpeechSynthesizer(cfg, audioCfg);
  await new Promise((resolve, reject) => {
    synth.speakTextAsync(
      text,
      (r) => {
        synth.close();
        r.reason === SpeechSDK.ResultReason.SynthesizingAudioCompleted
          ? resolve()
          : reject(new Error(r.errorDetails || "synth failed"));
      },
      (e) => {
        synth.close();
        reject(e);
      }
    );
  });
  console.log("wrote", file);
}

fs.writeFileSync(path.join(OUT, "tts-clean.txt"), REF);
fs.writeFileSync(path.join(OUT, "tts-altered.txt"), REF); // 채점 기준은 항상 원문
await synth(REF, path.join(OUT, "tts-clean.wav"));
await synth(ALTERED, path.join(OUT, "tts-altered.wav"));
console.log("\n일부러 넣은 오류(altered): bark(-ed누락) chase(-ed누락) small(놓침) red→big(치환) very(삽입) 'who called its name'(문장꼬리 스킵)");
