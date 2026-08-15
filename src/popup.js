'use strict';

const DEFAULT_SETTINGS = {
  chatgptThreeHourCap: 160,
  chatgptWindowHours: 3,
  planLabel: 'ChatGPT Plus',
  workUsageUrl: 'https://chatgpt.com/codex/settings/usage',
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

function minimumFinite(values) {
  const valid = values.filter((value) => Number.isFinite(value));
  return valid.length ? Math.min(...valid) : null;
}

function cleanReset(text) {
  if (!text) return '';
  return String(text).replace(/\s+/g, ' ').trim().slice(0, 110);
}

async function render() {
  const data = await chrome.storage.local.get([
    'settings',
    'chatgptEvents',
    'chatgptVisibleLimit',
    'chatgptWorkUsage',
    'claudeUsage'
  ]);
  const settings = { ...DEFAULT_SETTINGS, ...(data.settings || {}) };
  const now = Date.now();

  const work = data.chatgptWorkUsage;
  $('workFiveHour').textContent = pct(work?.fiveHourRemaining);
  $('workWeekly').textContent = pct(work?.weeklyRemaining);
  const effectiveWorkRemaining = minimumFinite([work?.fiveHourRemaining, work?.weeklyRemaining]);
  setBar('workBar', effectiveWorkRemaining);
  const resetBits = [
    work?.fiveHourResetText ? `5h: ${cleanReset(work.fiveHourResetText)}` : '',
    work?.weeklyResetText ? `週: ${cleanReset(work.weeklyResetText)}` : ''
  ].filter(Boolean);
  $('workReset').textContent = resetBits.length
    ? resetBits.join(' / ')
    : '「同期」で公式Usage Dashboardを読み取ります';
  $('workCredits').textContent = `追加クレジット: ${work?.creditBalanceText ?? '--'}`;
  $('workSyncedAt').textContent = work?.capturedAt ? `同期 ${shortTime(work.capturedAt)}` : '未同期';

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

async function sync(buttonId, messageType, waitMs = 4500) {
  const button = $(buttonId);
  const original = button.textContent;
  button.disabled = true;
  button.textContent = '同期中';
  const response = await chrome.runtime.sendMessage({ type: messageType }).catch(() => null);
  if (!response?.ok) {
    button.textContent = '失敗';
    setTimeout(() => { button.textContent = original; button.disabled = false; }, 1500);
    return;
  }
  setTimeout(async () => {
    await render();
    button.textContent = original;
    button.disabled = false;
  }, waitMs);
}

$('syncWork').addEventListener('click', () => sync('syncWork', 'syncWork', 5000));
$('syncClaude').addEventListener('click', () => sync('syncClaude', 'syncClaude', 4000));
$('settingsButton').addEventListener('click', () => chrome.runtime.openOptionsPage());
$('openWorkUsage').addEventListener('click', async () => {
  const { settings } = await chrome.storage.local.get('settings');
  chrome.tabs.create({ url: settings?.workUsageUrl || DEFAULT_SETTINGS.workUsageUrl });
});
$('openChatGPT').addEventListener('click', () => chrome.tabs.create({ url: 'https://chatgpt.com/' }));
$('openClaudeUsage').addEventListener('click', async () => {
  const { settings } = await chrome.storage.local.get('settings');
  chrome.tabs.create({ url: settings?.claudeUsageUrl || DEFAULT_SETTINGS.claudeUsageUrl });
});

chrome.storage.onChanged.addListener(() => render());
render();
