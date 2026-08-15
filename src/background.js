'use strict';

const DEFAULT_SETTINGS = {
  chatgptThreeHourCap: 160,
  chatgptWindowHours: 3,
  planLabel: 'ChatGPT Plus',
  claudeUsageUrl: 'https://claude.ai/settings/usage'
};

let pendingClaudeTabId = null;

async function ensureDefaults() {
  const { settings } = await chrome.storage.local.get('settings');
  if (!settings) await chrome.storage.local.set({ settings: DEFAULT_SETTINGS });
}

function clamp(value) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

async function updateBadge() {
  const data = await chrome.storage.local.get(['settings', 'chatgptEvents', 'claudeUsage']);
  const settings = { ...DEFAULT_SETTINGS, ...(data.settings || {}) };
  const now = Date.now();
  const windowMs = settings.chatgptWindowHours * 60 * 60 * 1000;
  const recentCount = (data.chatgptEvents || []).filter((event) => now - event.at < windowMs).length;
  const chatRemaining = settings.chatgptThreeHourCap > 0
    ? clamp((1 - recentCount / settings.chatgptThreeHourCap) * 100)
    : null;
  const claudeRemaining = data.claudeUsage?.sessionRemaining ?? null;
  const values = [chatRemaining, claudeRemaining].filter((v) => Number.isFinite(v));

  if (!values.length) {
    await chrome.action.setBadgeText({ text: '' });
    return;
  }
  const minimum = Math.min(...values);
  await chrome.action.setBadgeText({ text: `${minimum}%` });
  await chrome.action.setBadgeBackgroundColor({ color: minimum <= 20 ? '#8b1e1e' : minimum <= 50 ? '#8a5a00' : '#1f6f43' });
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
  if (message?.type === 'usageUpdated') {
    updateBadge();
  }

  if (message?.type === 'claudeSynced') {
    updateBadge();
    if (pendingClaudeTabId && sender.tab?.id === pendingClaudeTabId) {
      const id = pendingClaudeTabId;
      pendingClaudeTabId = null;
      setTimeout(() => chrome.tabs.remove(id).catch(() => {}), 500);
    }
  }

  if (message?.type === 'syncClaude') {
    (async () => {
      const data = await chrome.storage.local.get('settings');
      const settings = { ...DEFAULT_SETTINGS, ...(data.settings || {}) };
      const tab = await chrome.tabs.create({ url: settings.claudeUsageUrl, active: false });
      pendingClaudeTabId = tab.id || null;
      sendResponse({ ok: true });
    })().catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message?.type === 'refreshBadge') {
    updateBadge().then(() => sendResponse({ ok: true }));
    return true;
  }
});
