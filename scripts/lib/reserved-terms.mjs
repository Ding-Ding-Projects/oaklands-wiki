/**
 * Reserved-term detection without publishing the terms.
 *
 * A short list of working shorthand must never reach a public record — and a
 * guard that enforces that by listing the words in a public file has published
 * them itself, which is the exact failure it exists to prevent. So the list is
 * stored one-way: each reserved phrase is normalised and hashed, and the check
 * hashes candidate phrases from the text and looks for a match.
 *
 * The digests are irreversible, so this file publishes nothing readable. The
 * cost is stated plainly rather than implied: a digest set cannot be reviewed by
 * reading it, and a phrase absent from the set is a phrase this cannot catch.
 * It is a backstop against an accidental paste, not a proof of sanitisation.
 *
 * `--self-test` in the calling guard proves it bites by hashing a known phrase.
 */
import { createHash } from 'node:crypto';

/**
 * SHA-256 of each reserved phrase, lowercased with runs of whitespace collapsed.
 * Regenerate with `node scripts/lib/reserved-terms.mjs <phrase>` — which prints a
 * digest and never echoes the phrase back.
 */
const DIGESTS = new Set([
  '0af33508e62b594e9845b1d21a1b4ef2140b16a6975712a73f5324bb53057b0f',
  '0be5c694c067bfa62f5c00b9d5f412a5e4356b3776b8bb12522ef952d4951d88',
  '15d078c661d5e0dcf8130d6e576c142dac1a8695d6f1965a9ee19d3f91a26bdd',
  '23d62e2aee5b720dd35e52879ffb5b4792ab504e190cf6420d342d56fe8854dd',
  '2ed5d8a62855a12100a01fc6850426298984f757bdc7e4a12b2050a4edaa4780',
  '2f87855c713d5f889d07b279a3dda3f02e1622e8f15485d7b2be397a86bd5ae2',
  '307f192137c1fbd1bfbd7998b81a46b8f881045680833b5615c16c0979415454',
  '31d7e37d73a86e9afccc45000cf4a709a342bb0e689cc3bbc02ec482e1a8c745',
  '36d1b439df5b6b8eb84c72193e26c912db3603ef9a2c31968fcee37d23c6c411',
  '3c1ea5cba2b4018a3e878230d6334e64cd95c92e71020d9ed9c1af0c56051fbd',
  '3c599cfb67db38c19ccbfc94fecb00e650f24708b381992a9924488b4907534f',
  '4a2b91d1d70ebbaf81e03af77fe80053b6cc90d6dc5a88f9542c03cee1024289',
  '52e70770c9f2aabf99d65bef43846999b4e6cf0481588a82e4db72bcbe3f7441',
  '553c8e03a1eacca30abd0255ea50988072c2165578633e15a0860c3144064262',
  '6165bce356e843c12b11468c76daacf155e51b9b57bf8ce436a42f6add8ea961',
  '6388ed227c1b5d1a9cb143651b66d17125e3c79ae7312bda12bc2f6ad4ab00ff',
  '63e3a7b0073893983a01e68d0cdbd5c706aa5ea96cc027914151aff1eab9b53c',
  '661f707f9d84336543c0324229c7f0a8bbbb6f0c5dbd0859ff0cc0afa8eac95f',
  '69c83fbeee73fe91c2edddb34c82dd69a26c407a2f215a330da7281187f015ca',
  '6a23de0518367c7838e830a8bed98edb3001fc3a7fafa2263d93716621ed859a',
  '6f1da61d2783540f2a1576bab020b58f2ca7d12bbd9caee2c0cda9c586c9d1ca',
  '6f67a8c9cd9821d7bbb853b546cfc6ad417f9d6f9c8aa356b56a58b5984e2471',
  '700c833168a1abeb5cd9a1c45e9d2a5c428b85b29ba80389f73133d3a29dbcb1',
  '759af6620b06cfd2e94837fce5a6594b3fe61f09284aed32b1a63f6aad0fe011',
  '76761f3c77fff09d1df297ed171c4eaf151a293bad2ad3fb49ad4b19d3b19328',
  '76c88a16e4f3323f4c83d2994bf8789f97a5596c35dc288390de503eb201e1a4',
  '7d88c59728ba99b2c9c10d3b7649914b0c35b45eb2336c89ed9cba6a386cac65',
  '84bc89ec998e50ef4128478268f9dc5d4759bfe42cae1984ce71bbff5d04ba92',
  '8844bebd8b5ea907838aeb82659c890a3b9ddff433029d1569f75a30887150d4',
  '8a0cff5db1556951b82f0506c58b05e2e9cf901a8128880c5817ecf7dcb681bb',
  '8b2ca14f93162f05c2821e430bad4b7175fda945b15bb70e658bf91737712fdb',
  '8d1c8525761446e45f57d228b84f64c542b670da38021a5d397e44e85784144e',
  '8df1efa9c9adb131687d2936b90afb8f23b745b62628312e4d9a0ec6c57234b0',
  '948ad468eb5f7087f672bc575ee600aa315ce5c0fc9fc74b9aab03b387daabc1',
  '95def1c048ccefd3e2ce69dce1f49cf45b54f7471c973c311f91f8a80bc7b229',
  '976ca8ca810253490397965d1bffbd25994cf7d516a489886939ce545c0a7e62',
  '9fa47096b81ebd21f8e58537abd6f68df6628390163bfcdcef64d2df163f12cf',
  'a488b47420114e7be731c07775fef59f73fb79a152ac45efb7d64b65f7c41e28',
  'a94556ef19a97d3e587d9d419797d391e778dc90b6d6278f22ccf3d2738d78e1',
  'ab6c580ee143cfc7ecab073a87f641db6ea5f398f97a668615ad3eda108471ec',
  'ac767bf341fdcdbe0bc2a73b1477b56f26d0a1e8146a55f1fed0e6f17c150ada',
  'b2f5ddef38258c970110de1d77ebd50608de628c2ce658f87aa32cf3e7f8ba17',
  'b6cf14b4b1ada1c3cd8167944a1070466eb51a7c234d938fd7db024e1cdf4591',
  'b70d96b4e97b454bb79c737558c13a58a72a71c59024acee4e2c339ba260469b',
  'b73b159db7f6dbf562b6bfc60fd92136023d237124647cd3d7809e1df8e3459e',
  'bc5c46caeb933f6aa7f1dda891b584d4a15eba0341a7d22da23acaf96861782c',
  'bf70984e7b223a781050763f146bebcc424ded184cfaf7c833f19a4be26ceea4',
  'bf8d2bc652ca2504493bca75d754489ad5996fd2c5394d768f8bd0b84c5724ef',
  'c9dc55be02947a12637eeaa302cc49dd6d3a56c1e00d427efafd64d142a4275d',
  'caf32a1b780b23867b8caf3f040668750d362cde0484bddcae9430c723adc5e5',
  'd37efe8b9564ef65c582e62572e9b14de6b8667fb29fde3a80e7c7b318c8d274',
  'dae86f430e00fc5ad2f46560f4ac07ca2f36d31276cc9dde1a27a6fb850b25ca',
  'dbed88fc857037bf943a45030a6db2695265f416a39201a8b9cd228d6e0c0c51',
  'de347469cb9e4f8857f163f423490c40ab11fec4b0e9febf47916d193df6c8d6',
  'e0bb49efd22be7abac25a2e1fd659f762439c1a373ddbc96a55bae851e2073cf',
  'ea290d5c0101746d2acdf3307e2edfbd75625f70e581f728fa8edb2df04b20ab',
  'eaaacbda90f88a54c314f6d4f5980948f63bc81876d84da5ef8613ad8b03a47e',
  'eb6993e7ef74063f34ee6f66595f27235aaf7a4a3e48048429891357fd5caf01',
  'f34cb69ff11dd777721e97909b9b6dd984932112d32556f59d081b97b579db6f',
  'f3ceab9fd42b9dd198cb4e4acd53b9570d1817d1e8c1653db034473b740ca7b5',
  'f47814a0884788e60c741fa2dec10db3aca17d40a1e5e071871fbe50d02bc099',
  'f806836d7af53ba698c0ac8e9da47ad0a3a08eef93c6c441826cd95d3c1437f1',
  'fabca56486a240ebe7d14db438bd0fc6e838e582980d29c8a5661e07b6949aa2',
]);

/**
 * Hyphens JOIN rather than separate.
 *
 * Splitting on them manufactures phrases the text never contained: a slug like
 * a-b-projects in a URL becomes the two-word run "a b", which then matches a
 * two-word needle and reports a leak on every page. Observed exactly that way —
 * every generated page failed on a phrase that appears nowhere in any of them.
 */
export function tokenise(phrase) {
  return String(phrase).toLowerCase().match(/[a-z][a-z'-]*/g) ?? [];
}

/**
 * One canonical form for both sides. Deriving the digest from the same tokens
 * the scanner produces is what stops a phrase carrying punctuation from hashing
 * as one string and being searched for as another — a needle that never matches,
 * with nothing to say so.
 */
export function normalise(phrase) {
  return tokenise(phrase).join(' ');
}

export function digest(phrase) {
  return createHash('sha256').update(normalise(phrase), 'utf8').digest('hex');
}

/**
 * Every reserved phrase found in `text`, reported by digest rather than by the
 * phrase itself — naming the hit in an error message would republish it.
 *
 * Candidates are word runs of length 1 to `maxWords`, which is how a multi-word
 * phrase is caught without the caller knowing how many words to look for.
 */
export function findReserved(text, { maxWords = 4, digests = DIGESTS } = {}) {
  // Call the shared tokenizer. A second inline copy of the pattern is how the
  // two sides silently diverged once already: the digest was built one way and
  // the scan ran another, so a needle matched a run that was never in the text.
  const words = tokenise(text);
  const hits = [];
  for (let i = 0; i < words.length; i += 1) {
    for (let n = 1; n <= maxWords && i + n <= words.length; n += 1) {
      const candidate = words.slice(i, i + n).join(' ');
      const d = digest(candidate);
      if (digests.has(d)) hits.push({ index: i, words: n, digest: d.slice(0, 12) });
    }
  }
  return hits;
}

/** Digest count, so a caller can assert the set has not been emptied. */
export const reservedCount = DIGESTS.size;


// Helper and self-test. Neither ever prints a phrase back.
if (process.argv[1] && process.argv[1].endsWith('reserved-terms.mjs')) {
  if (process.argv.includes('--self-test')) {
    // Proved with an innocuous phrase and an injected set, so the mechanism is
    // demonstrated without a reserved phrase ever appearing in this repository.
    const probe = 'purple ostrich lantern';
    const injected = new Set([digest(probe)]);
    const checks = [
      ['a reserved phrase mid-sentence', findReserved(`prose ${probe} prose`, { digests: injected }).length === 1],
      ['the same phrase with punctuation and case', findReserved(`Prose. PURPLE, Ostrich -- Lantern!`, { digests: injected }).length === 1],
      ['an ordinary sentence stays clean', findReserved('copper ore sells per stud', { digests: injected }).length === 0],
      ['a partial match does not count', findReserved('purple ostrich', { digests: injected }).length === 0],
      ['the live set is not empty', reservedCount > 0],
    ];
    console.log('reserved-terms: self-test');
    let ok = true;
    for (const [label, pass] of checks) {
      if (!pass) ok = false;
      console.log(`  ${pass ? 'PASS' : 'FAIL'}  ${label}`);
    }
    if (!ok) { console.error('reserved-terms: self-test FAILED'); process.exit(1); }
    console.log(`reserved-terms: self-test passed (${reservedCount} digests live)`);
  } else {
    const phrase = process.argv[2];
    if (!phrase) {
      console.error('usage: node scripts/lib/reserved-terms.mjs "<phrase>"   (prints a digest, never the phrase)');
      console.error('       node scripts/lib/reserved-terms.mjs --self-test');
      process.exit(1);
    }
    console.log(digest(phrase));
  }
}