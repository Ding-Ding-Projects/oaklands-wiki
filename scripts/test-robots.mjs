import assert from 'node:assert/strict';
import { robotsVerdict } from './import-oaklands.mjs';

const AGENT = 'OaklandsWikiCorpusImporter/1.0 (+https://github.com/Ding-Ding-Projects/oaklands-wiki)';

// A named group for our agent must beat the wildcard group outright.
assert.equal(
  robotsVerdict('User-agent: ClaudeBot\nDisallow: /\n\nUser-agent: *\nAllow: /api.php?\n', 'ClaudeBot/1.0', '/api.php?action=query').allowed,
  false, 'a named Disallow: / group must win for that agent');

// Longest match wins.
assert.equal(robotsVerdict('User-agent: *\nDisallow: /\nAllow: /api.php?\n', AGENT, '/api.php?action=query').allowed, true);
assert.equal(robotsVerdict('User-agent: *\nDisallow: /\nAllow: /api.php?\n', AGENT, '/wiki/Copper').allowed, false);

// An empty Disallow allows everything.
assert.equal(robotsVerdict('User-agent: *\nDisallow:\n', AGENT, '/api.php?action=query').allowed, true);

// Comments and CRLF must not change the verdict — a CRLF checkout otherwise
// silently produces a different answer than the same file with LF.
assert.equal(
  robotsVerdict('User-agent: *\r\nDisallow: /   # everything\r\nAllow: /api.php?\r\n', AGENT, '/api.php?action=query').allowed,
  true, 'CRLF and comments must parse identically');

// The live policy, fetched through the SAME transport the importer uses.
// This assertion is the reason the importer does not use the global fetch:
// undici is served HTTP 403 for this exact file while node:https gets 200.
import https from 'node:https';
const text = await new Promise((resolve, reject) => {
  https.get('https://oaklands.fandom.com/robots.txt',
    { headers: { 'user-agent': AGENT, accept: '*/*' } },
    (response) => {
      assert.equal(response.statusCode, 200, `live robots.txt returned HTTP ${response.statusCode}`);
      let body = '';
      response.setEncoding('utf8');
      response.on('data', (chunk) => { body += chunk; });
      response.on('end', () => resolve(body));
    }).on('error', reject);
});
const live = robotsVerdict(text, AGENT, '/api.php?action=query');
assert.equal(live.allowed, true, `live policy refuses the API: ${live.rule}`);
console.log(`robots: live verdict ALLOW via group "${live.group}" rule "${live.rule}"`);

// And the documented asymmetry itself, so a future change to either client is noticed.
const viaFetch = await fetch('https://oaklands.fandom.com/robots.txt', { headers: { 'user-agent': AGENT } });
console.log(`robots: undici sees HTTP ${viaFetch.status} for the same file (node:https sees 200)`);

console.log('robots: all assertions passed');
