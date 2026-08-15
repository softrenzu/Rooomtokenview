import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../src/shared/usage-parser.js', import.meta.url), 'utf8');
const context = vm.createContext({ console });
vm.runInContext(source, context);
const parser = context.RooomUsageParser;

const english = `
Plan usage limits
Current session
37% used
Resets in 2 hr 14 min
Weekly limits
All models
62% used
Resets Aug 19 at 10:00 AM
Opus only
11% used
`;

const parsedEn = parser.parseClaudeUsage(english);
assert.equal(parsedEn.sessionUsed, 37);
assert.equal(parsedEn.sessionRemaining, 63);
assert.equal(parsedEn.weeklyAllUsed, 62);
assert.equal(parsedEn.weeklyAllRemaining, 38);
assert.equal(parsedEn.weeklyOpusUsed, 11);
assert.equal(parsedEn.weeklyOpusRemaining, 89);
assert.match(parsedEn.sessionResetText, /Resets/i);

const japanese = `
プラン使用制限
現在のセッション
24% 使用済み
残り 3時間20分
週間制限
すべてのモデル
55%
リセット 8月20日 18:00
`;
const parsedJa = parser.parseClaudeUsage(japanese);
assert.equal(parsedJa.sessionRemaining, 76);
assert.equal(parsedJa.weeklyAllRemaining, 45);

const chat = parser.parseChatGPTLimitText('You can send up to 160 messages. Your limit resets at 18:30.');
assert.equal(chat.visibleMessageCap, 160);
assert.match(chat.resetText, /resets/i);

const workStatus = parser.parseChatGPTWorkUsage(`
Codex Usage Dashboard
Rate limits remaining
5h limit: 98% left (resets 19:25)
Weekly limit: 100% left (resets 14:25 on 19 Jun)
Remaining credits: 0
`);
assert.equal(workStatus.detected, true);
assert.equal(workStatus.fiveHourRemaining, 98);
assert.equal(workStatus.weeklyRemaining, 100);
assert.equal(workStatus.creditBalanceText, '0');
assert.match(workStatus.fiveHourResetText, /resets/i);

const workJapanese = parser.parseChatGPTWorkUsage(`
Codex 使用量
5時間の使用制限
残り 81%
19:25 にリセット
週間使用制限
残り 64%
8月20日 14:25 にリセット
クレジット残高
1,250
`);
assert.equal(workJapanese.detected, true);
assert.equal(workJapanese.fiveHourRemaining, 81);
assert.equal(workJapanese.weeklyRemaining, 64);
assert.equal(workJapanese.creditBalanceText, '1,250');
assert.match(workJapanese.fiveHourResetText, /リセット/);

const workUsedStyle = parser.parseChatGPTWorkUsage(`
Usage Dashboard
5-hour usage limit
37% used
Resets in 2 hours
Weekly usage limit
62% used
Resets Aug 20
Credits balance $12.40
`);
assert.equal(workUsedStyle.fiveHourRemaining, 63);
assert.equal(workUsedStyle.weeklyRemaining, 38);
assert.equal(workUsedStyle.creditBalanceText, '$12.40');

console.log('parser tests: ok');
