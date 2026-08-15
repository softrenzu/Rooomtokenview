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

  const findPercentNear = (text, labels) => {
    const lines = normalize(text).split('\n').map((line) => line.trim()).filter(Boolean);
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

  const findResetNear = (text, labels) => {
    const lines = normalize(text).split('\n').map((line) => line.trim()).filter(Boolean);
    const loweredLabels = labels.map((label) => label.toLowerCase());

    for (let i = 0; i < lines.length; i += 1) {
      const lower = lines[i].toLowerCase();
      if (!loweredLabels.some((label) => lower.includes(label))) continue;
      const window = lines.slice(i, i + 8);
      const candidate = window.find((line) => /reset|resets|remaining|left|リセット|残り/i.test(line));
      if (candidate) return candidate.slice(0, 160);
    }
    return null;
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

  globalThis.RooomUsageParser = {
    normalize,
    parseClaudeUsage,
    parseChatGPTLimitText
  };
})();
