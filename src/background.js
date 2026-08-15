'use strict';

const DEFAULT_SETTINGS = {
  chatgptThreeHourCap: 160,
  chatgptWindowHours: 3,
  planLabel: 'ChatGPT Plus',
  workUsageUrl: 'https://chatgpt.com/codex/settings/usage',
  claudeUsageUrl: 'https://claude.ai/settings/usage'
};

let pendingClaudeTabId = null;
let pendingWorkTabId = null;

async function ensureDefaults() {
  const { settings } = await chrome.storage.local.get('settings');
  await chrome.storage.local.set({ settings: { ...DEFAULT_SETTINGS, ...(settings || {}) } });
}

function clamp(value) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function minimumFinite(values) {
  const valid = values.filter((value) => Number.isFinite(value));
  return valid.length ? Math.min(...valid) : null;
}

async function updateBadge() {
  const data = await chrome.storage.local.get(['settings', 'chatgptEvents', 'chatgptWorkUsage', 'claudeUsage']);
  const settings = { ...DEFAULT_SETTINGS, ...(data.settings || {}) };
  const now = Date.now();
  const windowMs = settings.chatgptWindowHours * 60 * 60 * 1000;
  const recentCount = (data.chatgptEvents || []).filter((event) => now - event.at < windowMs).length;
  const chatRemaining = settings.chatgptThreeHourCap > 0
    ? clamp((1 - recentCount / settings.chatgptThreeHourCap) * 100)
    : null;
  const work = data.chatgptWorkUsage;
  const workRemaining = minimumFinite([work?.fiveHourRemaining, work?.weeklyRemaining]);
  const claudeRemaining = data.claudeUsage?.sessionRemaining ?? null;

  const badgeValue = Number.isFinite(workRemaining)
    ? clamp(workRemaining)
    : minimumFinite([chatRemaining, claudeRemaining]);

  if (!Number.isFinite(badgeValue)) {
    await chrome.action.setBadgeText({ text: '' });
    await chrome.action.setTitle({ title: 'Rooom Token View' });
    return;
  }

  await chrome.action.setBadgeText({ text: `${badgeValue}%` });
  await chrome.action.setBadgeBackgroundColor({ color: badgeValue <= 20 ? '#8b1e1e' : badgeValue <= 50 ? '#8a5a00' : '#1f6f43' });
  await chrome.action.setTitle({
    title: Number.isFinite(workRemaining)
      ? `GPT Work 共通枠の残り目安 ${clamp(workRemaining)}%`
      : `Rooom Token View 残り目安 ${badgeValue}%`
  });
}

async function closePendingTab(kind, senderTabId) {
  const current = kind === 'work' ? pendingWorkTabId : pendingClaudeTabId;
  if (!current || senderTabId !== current) return;
  if (kind === 'work') pendingWorkTabId = null;
  else pendingClaudeTabId = null;
  setTimeout(() => chrome.tabs.remove(current).catch(() => {}), 500);
}

function schedulePendingTimeout(kind, tabId) {
  setTimeout(() => {
    const current = kind === 'work' ? pendingWorkTabId : pendingClaudeTabId;
    if (current !== tabId) return;
    if (kind === 'work') pendingWorkTabId = null;
    else pendingClaudeTabId = null;
    chrome.tabs.remove(tabId).catch(() => {});
  }, 20000);
}

chrome.runtime.onInstalled.addListener(async () => {
  await ensureDefaults();
  chrome.alarms.create('refreshBadge', { periodInMinutes: 5 });
  await updateBadge();
});

chrome.runtime.onStartup.addListener(async () => {
  await ensureDefaults();
  await updateBadge();
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'refreshBadge') updateBadge();
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === 'usageUpdated') updateBadge();

  if (message?.type === 'workSynced') {
    updateBadge();
    closePendingTab('work', sender.tab?.id);
  }

  if (message?.type === 'claudeSynced') {
    updateBadge();
    closePendingTab('claude', sender.tab?.id);
  }

  if (message?.type === 'syncWork') {
    (async () => {
      const data = await chrome.storage.local.get('settings');
      const settings = { ...DEFAULT_SETTINGS, ...(data.settings || {}) };
      const tab = await chrome.tabs.create({ url: settings.workUsageUrl, active: false });
      pendingWorkTabId = tab.id || null;
      if (pendingWorkTabId) schedulePendingTimeout('work', pendingWorkTabId);
      sendResponse({ ok: true });
    })().catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message?.type === 'syncClaude') {
    (async () => {
      const data = await chrome.storage.local.get('settings');
      const settings = { ...DEFAULT_SETTINGS, ...(data.settings || {}) };
      const tab = await chrome.tabs.create({ url: settings.claudeUsageUrl, active: false });
      pendingClaudeTabId = tab.id || null;
      if (pendingClaudeTabId) schedulePendingTimeout('claude', pendingClaudeTabId);
      sendResponse({ ok: true });
    })().catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message?.type === 'refreshBadge') {
    updateBadge().then(() => sendResponse({ ok: true }));
    return true;
  }
});
