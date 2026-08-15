'use strict';

const DEFAULT_SETTINGS = {
  chatgptThreeHourCap: 160,
  chatgptWindowHours: 3,
  planLabel: 'ChatGPT Plus',
  claudeUsageUrl: 'https://claude.ai/settings/usage'
};

const $ = (id) => document.getElementById(id);

async function load() {
  const { settings } = await chrome.storage.local.get('settings');
  const s = { ...DEFAULT_SETTINGS, ...(settings || {}) };
  $('planLabel').value = s.planLabel;
  $('cap').value = s.chatgptThreeHourCap;
  $('windowHours').value = s.chatgptWindowHours;
  $('claudeUrl').value = s.claudeUsageUrl;
}

$('save').addEventListener('click', async () => {
  const settings = {
    planLabel: $('planLabel').value.trim() || 'ChatGPT',
    chatgptThreeHourCap: Math.max(1, Number($('cap').value) || 160),
    chatgptWindowHours: Math.max(1, Number($('windowHours').value) || 3),
    claudeUsageUrl: $('claudeUrl').value.trim() || DEFAULT_SETTINGS.claudeUsageUrl
  };
  await chrome.storage.local.set({ settings });
  await chrome.runtime.sendMessage({ type: 'refreshBadge' }).catch(() => {});
  $('status').textContent = '保存しました';
  setTimeout(() => { $('status').textContent = ''; }, 1500);
});

$('reset').addEventListener('click', async () => {
  await chrome.storage.local.remove(['chatgptEvents', 'chatgptVisibleLimit']);
  await chrome.runtime.sendMessage({ type: 'refreshBadge' }).catch(() => {});
  $('status').textContent = '履歴を削除しました';
});

load();
