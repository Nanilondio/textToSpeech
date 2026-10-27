import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve('vendor/kokoro-model/onnx-community/Kokoro-82M-v1.0-ONNX');
const expected = {
  'config.json': 'df34b4f930b23447cd4dc410fabfb42eb3f24e803e6c3f97d618fb359380a36f',
  'tokenizer.json': 'ee301fc39cf903ddbb463564630a28767785e3a11edd6d8226e92d4b4ef131bb',
  'tokenizer_config.json': 'be1cb066d6ef6b074b3f15e6a6dd21ac88ff3cdaedf325f0aaed686c70f75d20',
  'onnx/model_q8f16.onnx': '04c658aec1b6008857c2ad10f8c589d4180d0ec427e7e6118ceb487e215c3cd0',
  'voices/af_bella.bin': 'f69d836209b78eb8c66e75e3cda491e26ea838a3674257e9d4e5703cbaf55c8b',
  'voices/af_heart.bin': 'd583ccff3cdca2f7fae535cb998ac07e9fcb90f09737b9a41fa2734ec44a8f0b',
  'voices/am_adam.bin': '162b035ed91cfc48b6046982184c645f72edcdd1b82843347f605d7bf7b15716',
  'voices/bf_emma.bin': '669fe0647f9dd04fcab92f1439a40eeb4c8b4ab1f82e4996fe3d918ce4a63b73',
  'voices/bm_george.bin': 'c4b235a4c1f2cd3b939fed08b899ce9385638b763f7b73a59616c4fc9bd6c9bc',
};

for (const [relative, hash] of Object.entries(expected)) {
  const digest = createHash('sha256').update(await readFile(path.join(root, relative))).digest('hex');
  assert.equal(digest, hash, `${relative}: checksum mismatch`);
}
console.log(`Kokoro local assets verified (${Object.keys(expected).length} files)`);
