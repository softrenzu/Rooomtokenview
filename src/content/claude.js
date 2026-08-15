(() => {
  'use strict';
  let timer = null;

  const scan = async () => {
    const text = document.body?.innerText || '';
    if (!/usage|current session|weekly|使用|セッション|週間/i.test(text)) return;

    const parsed = globalThis.RooomUsageParser?.parseClaudeUsage(text);
    if (!parsed) return;
    const hasUsefulData = [parsed.sessionUsed, parsed.weeklyAllUsed, parsed.weeklyOpusUsed].some((v) => v !== null);
    if (!hasUsefulData) return;

    await chrome.storage.local.set({
      claudeUsage: {
        ...parsed,
        capturedAt: Date.now(),
        page: location.href
      }
    });
    chrome.runtime.sendMessage({ type: 'claudeSynced' }).catch(() => {});
  };

  const schedule = () => {
    clearTimeout(timer);
    timer = setTimeout(scan, 900);
  };

  new MutationObserver(schedule).observe(document.documentElement, { childList: true, subtree: true, characterData: true });
  schedule();
})();
