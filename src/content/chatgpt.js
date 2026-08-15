(() => {
  'use strict';

  const THREE_HOURS = 3 * 60 * 60 * 1000;
  const DEDUPE_MS = 1200;
  const WORK_USAGE_PATH_RE = /^\/codex\/(?:settings\/usage|cloud\/settings\/analytics)/i;
  let lastCountAt = 0;
  let scanTimer = null;
  let lastWorkFingerprint = '';

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
    const match = candidates.find((text) => /GPT-5\.6|GPT-5\.5|Instant|Medium|High|Thinking|Sol|Work|即時|中程度|高|推論|ワーク/i.test(text));
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

  const progressAccessibilityText = () => {
    const nodes = [...document.querySelectorAll('progress, [role="progressbar"]')];
    return nodes.map((el, index) => {
      const label = el.getAttribute('aria-label') || el.getAttribute('title') || `progress ${index + 1}`;
      const nowRaw = el.getAttribute('aria-valuenow') ?? el.value;
      const maxRaw = el.getAttribute('aria-valuemax') ?? el.max;
      const now = Number(nowRaw);
      const max = Number(maxRaw);
      let percent = null;
      if (Number.isFinite(now) && Number.isFinite(max) && max > 0) percent = Math.max(0, Math.min(100, (now / max) * 100));
      else if (Number.isFinite(now) && now >= 0 && now <= 100) percent = now;

      let context = '';
      let parent = el.parentElement;
      for (let depth = 0; parent && depth < 4; depth += 1, parent = parent.parentElement) {
        const text = String(parent.innerText || '').trim();
        if (text && text.length <= 500) {
          context = text;
          if (/5h|5-hour|weekly|7d|credit|usage|5時間|週間|クレジット|使用/i.test(text)) break;
        }
      }
      const valueText = Number.isFinite(percent) ? `${Math.round(percent * 10) / 10}%` : '';
      return `${context}\n${label} ${valueText}`.trim();
    }).filter(Boolean).join('\n');
  };

  const scanWorkUsage = async (force = false) => {
    if (!WORK_USAGE_PATH_RE.test(location.pathname)) return false;
    const parser = globalThis.RooomUsageParser?.parseChatGPTWorkUsage;
    if (!parser) return false;

    const source = `${document.body?.innerText || ''}\n${progressAccessibilityText()}`;
    const parsed = parser(source);
    if (!parsed?.detected) return false;

    const payload = {
      ...parsed,
      capturedAt: Date.now(),
      page: location.href
    };
    const fingerprint = JSON.stringify([
      parsed.fiveHourRemaining,
      parsed.fiveHourResetText,
      parsed.weeklyRemaining,
      parsed.weeklyResetText,
      parsed.creditBalanceText,
      parsed.bankedResets
    ]);

    if (force || fingerprint !== lastWorkFingerprint) {
      lastWorkFingerprint = fingerprint;
      await chrome.storage.local.set({ chatgptWorkUsage: payload });
      chrome.runtime.sendMessage({ type: 'workSynced' }).catch(() => {});
      chrome.runtime.sendMessage({ type: 'usageUpdated' }).catch(() => {});
    }
    return true;
  };

  const scheduleScan = () => {
    clearTimeout(scanTimer);
    scanTimer = setTimeout(() => {
      scanVisibleLimits();
      scanWorkUsage();
    }, 900);
  };

  new MutationObserver(scheduleScan).observe(document.documentElement, { childList: true, subtree: true, characterData: true });
  scheduleScan();

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type === 'scanWorkUsageNow') {
      scanWorkUsage(true).then((ok) => sendResponse({ ok })).catch((error) => sendResponse({ ok: false, error: error.message }));
      return true;
    }

    if (message?.type !== 'getChatGPTSnapshot') return;
    chrome.storage.local.get(['chatgptEvents', 'chatgptVisibleLimit', 'chatgptWorkUsage', 'settings']).then((data) => {
      const now = Date.now();
      const events = (data.chatgptEvents || []).filter((event) => now - event.at < THREE_HOURS);
      sendResponse({
        events,
        visibleLimit: data.chatgptVisibleLimit || null,
        workUsage: data.chatgptWorkUsage || null,
        settings: data.settings || null
      });
    });
    return true;
  });
})();
