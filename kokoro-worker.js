import { KokoroTTS, env as kokoroEnv } from './vendor/kokoro/kokoro.web.js';

let ttsModel = null;
let modelPromise = null;
const audioCache = new Map();
const AUDIO_CACHE_LIMIT = 32;
let runtimeMode = 'wasm-single-thread';

function configureWasmThreads(requestedThreads) {
  const isolated = self.crossOriginIsolated === true;
  const sharedMemoryAvailable = typeof SharedArrayBuffer !== 'undefined';
  const maxThreads = Math.min(8, Math.max(1, Number(requestedThreads) || 1));
  const threads = isolated && sharedMemoryAvailable ? maxThreads : 1;

  // KokoroTTS.from_pretrained does not accept or forward ORT session options.
  // This vendored bundle exports env.wasmPaths but hides ONNX Runtime's env.
  // The local bundle exposes env.wasm as a bridge to ORT's wasm config.
  kokoroEnv.wasm.numThreads = threads;
  runtimeMode = threads > 1 ? 'wasm-multithread' : 'wasm-single-thread';
  return { runtimeMode, numThreads: threads, crossOriginIsolated: isolated, sharedArrayBuffer: sharedMemoryAvailable };
}

function cacheKey(text, voice, speed) {
  return `${voice || ''}\u0000${speed ?? 1}\u0000${String(text).trim()}`;
}

function rememberAudio(key, audio) {
  if (audioCache.has(key)) audioCache.delete(key);
  audioCache.set(key, { audio: audio.audio.slice(), sr: audio.sr });
  while (audioCache.size > AUDIO_CACHE_LIMIT) audioCache.delete(audioCache.keys().next().value);
}

async function generateCached(model, text, voice, speed) {
  const key = cacheKey(text, voice, speed);
  const cached = audioCache.get(key);
  if (cached) {
    audioCache.delete(key);
    audioCache.set(key, cached);
    return { audio: cached.audio.slice(), sr: cached.sr, cacheHit: true };
  }
  const res = await model.generate(text, { voice, speed });
  const result = { audio: res.audio, sr: res.sampling_rate };
  rememberAudio(key, result);
  return { audio: result.audio.slice(), sr: result.sr, cacheHit: false };
}

async function getModel(modelId) {
  if (ttsModel) return ttsModel;
  if (!modelPromise) {
    modelPromise = KokoroTTS.from_pretrained(modelId, { dtype: 'q8', device: 'wasm' })
      .then(model => { ttsModel = model; return model; })
      .catch(err => { modelPromise = null; throw err; });
  }
  return modelPromise;
}

function reportWorkerError(err) {
  const message = err?.message || String(err);
  self.postMessage({ type: 'error', message });
}

self.onmessage = async (e) => {
  const d = e.data;
  try {
    if (d.type === 'loadModel') {
      const runtime = configureWasmThreads(d.numThreads);
      const startedAt = performance.now();
      await getModel(d.modelId);
      self.postMessage({ type: 'loaded', device: runtime.runtimeMode, numThreads: runtime.numThreads, loadMs: Math.round(performance.now() - startedAt) });

    } else if (d.type === 'generate') {
      const startedAt = performance.now();
      const { text, voice, speed } = d;
      const model = await getModel(d.modelId || 'onnx-community/Kokoro-82M-v1.0-ONNX');
      const result = await generateCached(model, text, voice, speed);
      const pcm = result.audio; const sr = result.sr;
      self.postMessage({ type: 'result', pcm: pcm.buffer, sr, inferenceMs: Math.round(performance.now() - startedAt), cacheHit: result.cacheHit, device: runtimeMode }, [pcm.buffer]);

    } else if (d.type === 'generate_dialogue') {
      const startedAt = performance.now();
      const turns = d.turns; const speed = d.speed;
      const pieces = [];
      let sr = 22050;
      for (let i = 0; i < turns.length; i++) {
        const turn = turns[i];
        self.postMessage({ type: 'progress', index: i, total: turns.length });
        const model = await getModel(d.modelId || 'onnx-community/Kokoro-82M-v1.0-ONNX');
        const result = await generateCached(model, turn.text, turn.voice, speed);
        sr = result.sr;
        const audio = result.audio;
        pieces.push(audio, new Float32Array(Math.round(sr * 0.22)));
      }
      const total = pieces.reduce((s, p) => s + p.length, 0);
      const pcm = new Float32Array(total);
      let offset = 0; pieces.forEach(p => { pcm.set(p, offset); offset += p.length; });
      self.postMessage({ type: 'result', pcm: pcm.buffer, sr, inferenceMs: Math.round(performance.now() - startedAt) }, [pcm.buffer]);

    }
  } catch (err) {
    reportWorkerError(err);
  }
};

self.addEventListener('unhandledrejection', event => {
  reportWorkerError(event.reason || new Error('Unhandled worker rejection'));
});
