(() => {
  'use strict';

  const THREE_HOURS = 3 * 60 * 60 * 1000;
  const DEDUPE_MS = 1200;
  let lastCountAt = 0;
  let scanTimer = null;

  const getPromptElement = () => document.querySelector(
    '#prompt-textarea, textarea[placeholder], textarea, [contenteditable="true"][data-lexical-editor="true"], [contenteditable="true"]'
  );

  const hasPromptText = () => {
    const el = getPromptElement();
    if (!el) return false;
    const value = 'value' in el ? el.value : el.innerText;
    return String(value || '').trim().length > 0;
  };

  const detectMode = () => {
    const candidates = [...document.querySelectorAll('button, [role="button"]')]
      .map((el) => `${el.getAttribute('aria-label') || ''} ${el.innerText || ''}`.trim())
      .filter(Boolean);
    const match = candidates.find((text) => /GPT-5\.6|GPT-5\.5|Instant|Medium|High|Thinking|Sol|即時|中程度|高|推論/i.test(text));
    return match ? match.slice(0, 80) : 'ChatGPT';
  };

  const countSend = async (source) => {
    const now = Date.now();
    if (now - lastCountAt < DEDUPE_MS) return;
    if (!hasPromptText()) return;
    lastCountAt = now;

    const stored = await chrome.storage.local.get(['chatgptEvents']);
    const events = Array.isArray(stored.chatgptEvents) ? stored.chatgptEvents : [];
    const recent = events.filter((event) => now - event.at < 7 * 24 * 60 * 60 * 1000);
    recent.push({ at: now, mode: detectMode(), source });
    await chrome.storage.local.set({ chatgptEvents: recent, chatgptLastSeenAt: now });
    chrome.runtime.sendMessage({ type: 'usageUpdated' }).catch(() => {});
  };

  document.addEventListener('submit', (event) => {
    if (event.target instanceof HTMLFormElement) countSend('submit');
  }, true);

  document.addEventListener('click', (event) => {
    const button = event.target?.closest?.('button');
    if (!button) return;
    const label = `${button.getAttribute('aria-label') || ''} ${button.getAttribute('data-testid') || ''} ${button.innerText || ''}`;
    if (/send|submit|送信/i.test(label)) countSend('button');
  }, true);

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' || event.shiftKey || event.altKey || event.ctrlKey || event.metaKey || event.isComposing) return;
    const prompt = getPromptElement();
    if (prompt && (event.target === prompt || prompt.contains?.(event.target))) countSend('enter');
  }, true);

  const scanVisibleLimits = async () => {
    const parsed = globalThis.RooomUsageParser?.parseChatGPTLimitText(document.body?.innerText || '');
    if (!parsed) return;
    const payload = {
      ...parsed,
      capturedAt: Date.now(),
      page: location.href
    };
    if (parsed.resetText || parsed.visibleMessageCap) {
      await chrome.storage.local.set({ chatgptVisibleLimit: payload });
      chrome.runtime.sendMessage({ type: 'usageUpdated' }).catch(() => {});
    }
  };

  const scheduleScan = () => {
    clearTimeout(scanTimer);
    scanTimer = setTimeout(scanVisibleLimits, 1200);
  };

  new MutationObserver(scheduleScan).observe(document.documentElement, { childList: true, subtree: true });
  scheduleScan();

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type !== 'getChatGPTSnapshot') return;
    chrome.storage.local.get(['chatgptEvents', 'chatgptVisibleLimit', 'settings']).then((data) => {
      const now = Date.now();
      const events = (data.chatgptEvents || []).filter((event) => now - event.at < THREE_HOURS);
      sendResponse({ events, visibleLimit: data.chatgptVisibleLimit || null, settings: data.settings || null });
    });
    return true;
  });
})();
