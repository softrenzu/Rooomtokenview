'use strict';

const DEFAULT_SETTINGS = {
  chatgptThreeHourCap: 160,
  chatgptWindowHours: 3,
  planLabel: 'ChatGPT Plus',
  claudeUsageUrl: 'https://claude.ai/settings/usage'
};

const $ = (id) => document.getElementById(id);
const pct = (value) => Number.isFinite(value) ? `${Math.max(0, Math.min(100, Math.round(value)))}%` : '--%';

function setBar(id, value) {
  $(id).style.width = Number.isFinite(value) ? `${Math.max(0, Math.min(100, value))}%` : '0%';
}

function shortTime(timestamp) {
  if (!timestamp) return '';
  return new Date(timestamp).toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

async function render() {
  const data = await chrome.storage.local.get(['settings', 'chatgptEvents', 'chatgptVisibleLimit', 'claudeUsage']);
  const settings = { ...DEFAULT_SETTINGS, ...(data.settings || {}) };
  const now = Date.now();
  const windowMs = settings.chatgptWindowHours * 60 * 60 * 1000;
  const recentEvents = (data.chatgptEvents || []).filter((event) => now - event.at < windowMs);
  const visibleCap = data.chatgptVisibleLimit?.visibleMessageCap;
  const cap = Number.isFinite(visibleCap) ? visibleCap : Number(settings.chatgptThreeHourCap || 0);
  const remainingCount = cap > 0 ? Math.max(0, cap - recentEvents.length) : null;
  const remainingPct = cap > 0 ? Math.max(0, (remainingCount / cap) * 100) : null;

  $('chatgptPlan').textContent = settings.planLabel.replace('ChatGPT ', '');
  $('chatgptRemaining').textContent = pct(remainingPct);
  $('chatgptCount').textContent = cap > 0 ? `${recentEvents.length} / ${cap}件` : `${recentEvents.length}件`;
  setBar('chatgptBar', remainingPct);
  $('chatgptReset').textContent = data.chatgptVisibleLimit?.resetText || `ローカル計測・残り約${remainingCount ?? '--'}件`;

  const claude = data.claudeUsage;
  $('claudeSession').textContent = pct(claude?.sessionRemaining);
  $('claudeWeekly').textContent = pct(claude?.weeklyAllRemaining);
  setBar('claudeBar', claude?.sessionRemaining);
  $('claudeReset').textContent = claude
    ? (claude.sessionResetText || claude.weeklyResetText || `最終同期 ${shortTime(claude.capturedAt)}`)
    : '「同期」で公式Usageを読み取ります';
}

$('syncClaude').addEventListener('click', async () => {
  $('syncClaude').textContent = '同期中';
  await chrome.runtime.sendMessage({ type: 'syncClaude' }).catch(() => {});
  setTimeout(async () => {
    await render();
    $('syncClaude').textContent = '同期';
  }, 3500);
});

$('settingsButton').addEventListener('click', () => chrome.runtime.openOptionsPage());
$('openChatGPT').addEventListener('click', () => chrome.tabs.create({ url: 'https://chatgpt.com/' }));
$('openClaudeUsage').addEventListener('click', async () => {
  const { settings } = await chrome.storage.local.get('settings');
  chrome.tabs.create({ url: settings?.claudeUsageUrl || DEFAULT_SETTINGS.claudeUsageUrl });
});

chrome.storage.onChanged.addListener(() => render());
render();
