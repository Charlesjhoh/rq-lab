export async function blobToPCM16kMono(blob: Blob): Promise<Uint8Array> {
  const arrayBuf = await new Promise<ArrayBuffer>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = reject;
    reader.readAsArrayBuffer(blob);
  });
  const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();

  let decoded: AudioBuffer;

  try {
    decoded = await Promise.race([
      new Promise<AudioBuffer>((resolve, reject) => {
        audioCtx.decodeAudioData(
          arrayBuf.slice(0),
          (buffer) => resolve(buffer),
          (err) => reject(err)
        );
      }),
      new Promise<AudioBuffer>((_, reject) =>
        setTimeout(() => reject(new Error("decode timeout")), 3000)
      ),
    ]);
  } catch (e) {
    console.error("🔥 decode 실패 → fallback", e);

    return new Uint8Array(arrayBuf);
  }

  const targetSampleRate = 16000;
  const offline = new OfflineAudioContext(1, Math.ceil(decoded.duration * targetSampleRate), targetSampleRate);
  const source = offline.createBufferSource();
  source.buffer = decoded;
  source.connect(offline.destination);
  source.start(0);

  const rendered = await offline.startRendering();
  await audioCtx.close();

  const samples = rendered.getChannelData(0);
  const pcm16 = new Int16Array(samples.length);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }

  return new Uint8Array(pcm16.buffer);
}

export function pcmToWav(pcmData: Uint8Array) {
  const sampleRate = 16000;
  const channels = 1;
  const bitsPerSample = 16;

  const blockAlign = (channels * bitsPerSample) / 8;
  const byteRate = sampleRate * blockAlign;

  const buffer = new ArrayBuffer(44 + pcmData.length);
  const view = new DataView(buffer);

  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  writeString(0, "RIFF");
  view.setUint32(4, 36 + pcmData.length, true);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);
  writeString(36, "data");
  view.setUint32(40, pcmData.length, true);

  new Uint8Array(buffer, 44).set(pcmData);

  return buffer;
}