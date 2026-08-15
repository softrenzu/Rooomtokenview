(() => {
  'use strict';

  const normalize = (text) => String(text || '')
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\r/g, '')
    .trim();

  const toPercent = (value) => {
    const n = Number(value);
    if (!Number.isFinite(n)) return null;
    return Math.max(0, Math.min(100, n));
  };

  const getLines = (text) => normalize(text).split('\n').map((line) => line.trim()).filter(Boolean);

  const findPercentNear = (text, labels) => {
    const lines = getLines(text);
    const loweredLabels = labels.map((label) => label.toLowerCase());

    for (let i = 0; i < lines.length; i += 1) {
      const lower = lines[i].toLowerCase();
      if (!loweredLabels.some((label) => lower.includes(label))) continue;

      const window = lines.slice(i, i + 7).join(' ');
      const matches = [...window.matchAll(/(\d{1,3}(?:\.\d+)?)\s*%/g)];
      if (matches.length) return toPercent(matches[0][1]);
    }
    return null;
  };

  const findPercentStateNear = (text, labels, defaultMeaning = 'remaining') => {
    const lines = getLines(text);
    const loweredLabels = labels.map((label) => label.toLowerCase());

    for (let i = 0; i < lines.length; i += 1) {
      const lower = lines[i].toLowerCase();
      if (!loweredLabels.some((label) => lower.includes(label))) continue;

      const windowLines = lines.slice(i, i + 8);
      const window = windowLines.join(' ');
      const match = window.match(/(\d{1,3}(?:\.\d+)?)\s*%/);
      if (!match) continue;

      const value = toPercent(match[1]);
      if (value === null) continue;

      const remainingWords = /\b(?:left|remaining|remain|available)\b|残り|残量|利用可能|使用可能|余り|übrig/i;
      const usedWords = /\b(?:used|consumed|usage used|spent)\b|使用済み|利用済み|消費済み|使用量|利用量/i;
      const context = window.toLowerCase();

      let meaning = defaultMeaning;
      if (remainingWords.test(context)) meaning = 'remaining';
      else if (usedWords.test(context)) meaning = 'used';

      const remaining = meaning === 'used' ? Math.max(0, 100 - value) : value;
      const used = Math.max(0, 100 - remaining);
      return { value, meaning, remaining, used };
    }
    return null;
  };

  const findResetNear = (text, labels) => {
    const lines = getLines(text);
    const loweredLabels = labels.map((label) => label.toLowerCase());

    for (let i = 0; i < lines.length; i += 1) {
      const lower = lines[i].toLowerCase();
      if (!loweredLabels.some((label) => lower.includes(label))) continue;
      const window = lines.slice(i, i + 8);
      const explicit = window.find((line) => /reset|resets|リセット|更新/i.test(line));
      if (explicit) return explicit.slice(0, 180);
      const fallback = window.find((line) => /remaining|left|残り/i.test(line));
      if (fallback) return fallback.slice(0, 180);
    }
    return null;
  };

  const findCreditBalance = (text) => {
    const lines = getLines(text);
    const labelRe = /remaining credits?|credits? remaining|credit balance|credits? balance|available credits?|クレジット残高|残りクレジット|利用可能クレジット/i;

    for (let i = 0; i < lines.length; i += 1) {
      if (!labelRe.test(lines[i])) continue;
      const window = lines.slice(i, i + 4);
      for (const line of window) {
        const withoutPercent = line.replace(/\d{1,3}(?:\.\d+)?\s*%/g, '');
        const money = withoutPercent.match(/(?:\$|USD\s*|US\$\s*|¥|￥|€|£)?\s*\d[\d,]*(?:\.\d+)?/i);
        if (!money) continue;
        const raw = money[0].trim();
        if (!raw) continue;
        return raw;
      }
    }
    return null;
  };

  const findBankedResets = (text) => {
    const source = normalize(text);
    const match = source.match(/(\d+)\s*(?:banked\s*)?(?:usage[- ]limit\s*)?resets?\s*(?:available|remaining)|(?:available|remaining)\s*(\d+)\s*(?:banked\s*)?resets?/i);
    if (!match) return null;
    return Number(match[1] || match[2]);
  };

  const parseClaudeUsage = (text) => {
    const source = normalize(text);
    const sessionUsed = findPercentNear(source, [
      'current session', '5-hour', '5 hour', 'session limit', '現在のセッション', '5時間', 'セッション'
    ]);
    const weeklyAllUsed = findPercentNear(source, [
      'all models', 'weekly limit', 'weekly usage', 'all model', 'すべてのモデル', '週間制限', '週間使用'
    ]);
    const weeklyOpusUsed = findPercentNear(source, [
      'opus only', 'opus', 'Opusのみ', 'Opus のみ'
    ]);

    return {
      sessionUsed,
      sessionRemaining: sessionUsed === null ? null : Math.max(0, 100 - sessionUsed),
      weeklyAllUsed,
      weeklyAllRemaining: weeklyAllUsed === null ? null : Math.max(0, 100 - weeklyAllUsed),
      weeklyOpusUsed,
      weeklyOpusRemaining: weeklyOpusUsed === null ? null : Math.max(0, 100 - weeklyOpusUsed),
      sessionResetText: findResetNear(source, ['current session', '5-hour', '5 hour', '現在のセッション', '5時間']),
      weeklyResetText: findResetNear(source, ['weekly', 'all models', '週間', 'すべてのモデル'])
    };
  };

  const parseChatGPTLimitText = (text) => {
    const source = normalize(text);
    const relevantLines = source.split('\n').filter((line) =>
      /limit|usage|reset|resets|remaining|messages|上限|使用|リセット|残り|メッセージ/i.test(line)
    );
    const joined = relevantLines.slice(-30).join(' | ');
    const resetMatch = joined.match(/([^|]{0,80}(?:reset|resets|リセット)[^|]{0,100})/i);
    const limitMatch = joined.match(/(?:up to|max(?:imum)?|上限|最大)\s*(\d{1,5})\s*(?:messages?|件|メッセージ)/i);

    return {
      resetText: resetMatch ? resetMatch[1].trim() : null,
      visibleMessageCap: limitMatch ? Number(limitMatch[1]) : null
    };
  };

  const parseChatGPTWorkUsage = (text) => {
    const source = normalize(text);
    const fiveLabels = [
      '5h limit', '5h', '5-hour limit', '5-hour', '5 hour limit', '5-hour usage limit', '5 hour usage limit',
      'five-hour limit', 'five hour limit', '5時間制限', '5時間の制限', '5時間の使用制限', '5時間上限', '5時間'
    ];
    const weeklyLabels = [
      'weekly limit', 'weekly usage limit', 'weekly usage', 'weekly', '7d limit', '7-day limit', '7 day limit',
      '週間制限', '週間の制限', '週間使用制限', '週間の使用制限', '週間', '週次制限', '7日間制限', '7日'
    ];

    const five = findPercentStateNear(source, fiveLabels, 'remaining');
    const weekly = findPercentStateNear(source, weeklyLabels, 'remaining');
    const creditBalanceText = findCreditBalance(source);
    const bankedResets = findBankedResets(source);
    const contextDetected = /codex|agentic|chatgpt work|workspace agents?|usage dashboard|rate limits?|使用量|利用上限|クレジット/i.test(source);
    const detected = Boolean((five || weekly || creditBalanceText !== null || bankedResets !== null) && contextDetected);

    return {
      detected,
      fiveHourRemaining: five?.remaining ?? null,
      fiveHourUsed: five?.used ?? null,
      fiveHourResetText: findResetNear(source, fiveLabels),
      weeklyRemaining: weekly?.remaining ?? null,
      weeklyUsed: weekly?.used ?? null,
      weeklyResetText: findResetNear(source, weeklyLabels),
      creditBalanceText,
      bankedResets
    };
  };

  globalThis.RooomUsageParser = {
    normalize,
    parseClaudeUsage,
    parseChatGPTLimitText,
    parseChatGPTWorkUsage
  };
})();
