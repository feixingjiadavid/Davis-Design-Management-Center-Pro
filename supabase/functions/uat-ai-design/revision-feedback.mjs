const normalize = (value = '') => String(value ?? '').replace(/\s+/g, ' ').trim();

function chinesePageNumber(raw = '') {
  const text = normalize(raw);
  const digits = { '零': 0, '一': 1, '二': 2, '两': 2, '三': 3, '四': 4, '五': 5, '六': 6, '七': 7, '八': 8, '九': 9 };
  if (text in digits) return digits[text];
  if (text === '十') return 10;
  if (text.startsWith('十')) return 10 + (digits[text.slice(1)] || 0);
  if (text.endsWith('十')) return (digits[text.slice(0, -1)] || 0) * 10;
  const parts = text.split('十');
  if (parts.length === 2) return (digits[parts[0]] || 0) * 10 + (digits[parts[1]] || 0);
  return 0;
}

export function mergeAffectedPages(...groups) {
  return [...new Set(groups.flatMap((group) => Array.isArray(group) ? group : []).map(Number).filter((value) => Number.isInteger(value) && value > 0))].sort((a, b) => a - b);
}

export function inferExplicitFeedbackPages(feedback = '', templatePages = []) {
  const text = normalize(feedback);
  const pages = Array.isArray(templatePages) ? templatePages : [];
  const valid = new Set(pages.map((page) => Number(page.page_index)).filter((value) => Number.isInteger(value) && value > 0));
  if (!text || valid.size === 0) return [];

  const matched = [];
  const numericPatterns = [/\bP\s*(\d+)\b/gi, /第\s*(\d+)\s*页/g, /\bpage\s*(\d+)\b/gi];
  for (const pattern of numericPatterns) {
    for (const match of text.matchAll(pattern)) {
      const value = Number(match[1]);
      if (valid.has(value)) matched.push(value);
    }
  }
  for (const match of text.matchAll(/第\s*([零一二两三四五六七八九十]+)\s*页/g)) {
    const value = chinesePageNumber(match[1]);
    if (valid.has(value)) matched.push(value);
  }
  for (const page of pages) {
    const title = normalize(page.page_title);
    const index = Number(page.page_index);
    if (title && text.includes(title) && valid.has(index)) matched.push(index);
  }
  return mergeAffectedPages(matched);
}

export function inferFeedbackAffectedPages(feedback = '', templatePages = []) {
  const text = normalize(feedback);
  const pages = Array.isArray(templatePages) ? templatePages : [];
  const valid = pages.map((page) => Number(page.page_index)).filter((value) => Number.isInteger(value) && value > 0);
  if (!text || valid.length === 0) return [];
  const explicit = inferExplicitFeedbackPages(text, pages);
  return explicit.length ? explicit : [...new Set(valid)].sort((a, b) => a - b);
}
