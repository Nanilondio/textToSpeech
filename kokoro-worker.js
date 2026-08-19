import { KokoroTTS } from './vendor/kokoro/kokoro.web.js';

let ttsModel = null;
let modelPromise = null;

async function getModel(modelId) {
  if (ttsModel) return ttsModel;
  if (!modelPromise) {
    modelPromise = KokoroTTS.from_pretrained(modelId, { dtype: 'q8', device: 'wasm' })
      .then(model => { ttsModel = model; return model; })
      .catch(err => { modelPromise = null; throw err; });
  }
  return modelPromise;
}

self.onmessage = async (e) => {
  const d = e.data;
  try {
    if (d.type === 'loadModel') {
      await getModel(d.modelId);
      self.postMessage({ type: 'loaded' });

    } else if (d.type === 'generate') {
      const { text, voice, speed } = d;
      const model = await getModel(d.modelId || 'onnx-community/Kokoro-82M-v1.0-ONNX');
      const res = await model.generate(text, { voice, speed });
      const pcm = res.audio; const sr = res.sampling_rate;
      self.postMessage({ type: 'result', pcm: pcm.buffer, sr }, [pcm.buffer]);

    } else if (d.type === 'generate_dialogue') {
      const turns = d.turns; const speed = d.speed;
      const pieces = [];
      let sr = 22050;
      for (let i = 0; i < turns.length; i++) {
        const turn = turns[i];
        self.postMessage({ type: 'progress', index: i, total: turns.length });
        const model = await getModel(d.modelId || 'onnx-community/Kokoro-82M-v1.0-ONNX');
        const res = await model.generate(turn.text, { voice: turn.voice, speed });
        sr = res.sampling_rate;
        pieces.push(res.audio, new Float32Array(Math.round(sr * 0.22)));
      }
      const total = pieces.reduce((s, p) => s + p.length, 0);
      const pcm = new Float32Array(total);
      let offset = 0; pieces.forEach(p => { pcm.set(p, offset); offset += p.length; });
      self.postMessage({ type: 'result', pcm: pcm.buffer, sr }, [pcm.buffer]);

    }
  } catch (err) {
    self.postMessage({ type: 'error', message: err && err.message ? err.message : String(err) });
  }
};
