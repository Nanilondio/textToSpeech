importScripts('https://cdn.jsdelivr.net/npm/lamejs@1.2.1/lame.min.js');

self.onmessage = function(e) {
  const d = e.data;
  try {
    const pcm = new Float32Array(d.pcm);
    const sampleRate = d.sr;
    const enc = new lamejs.Mp3Encoder(1, sampleRate, 128);
    const out = [];
    const block = 1152;
    for (let i = 0; i < pcm.length; i += block) {
      const slice = pcm.subarray(i, i + block);
      const int16 = new Int16Array(slice.length);
      for (let j = 0; j < slice.length; j++) int16[j] = Math.max(-32768, Math.min(32767, slice[j] * 32767));
      const buf = enc.encodeBuffer(int16);
      if (buf.length > 0) out.push(new Uint8Array(buf));
    }
    const flush = enc.flush();
    if (flush.length > 0) out.push(new Uint8Array(flush));
    // Concatenate
    let totalLen = out.reduce((s, a) => s + a.length, 0);
    const mp3 = new Uint8Array(totalLen);
    let offset = 0;
    out.forEach(chunk => { mp3.set(chunk, offset); offset += chunk.length; });
    self.postMessage({ type: 'mp3', mp3: mp3.buffer }, [mp3.buffer]);
  } catch (err) {
    self.postMessage({ type: 'error', message: err && err.message ? err.message : String(err) });
  }
};
