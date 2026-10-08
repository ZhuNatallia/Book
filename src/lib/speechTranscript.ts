const tidy = (value: string) => value.replace(/\s+/g, ' ').trim();

const samePhrase = (words: string[], size: number) => {
  const times = words.length / size;
  if (times < 2 || times > 3 || words.length % size !== 0) return false;
  const unit = words.slice(0, size).map((word) => word.toLowerCase()).join('\0');
  for (let i = 1; i < times; i++) {
    const chunk = words.slice(i * size, (i + 1) * size).map((word) => word.toLowerCase()).join('\0');
    if (chunk !== unit) return false;
  }
  return true;
};

// Chrome on Android often returns one spoken phrase two or three times,
// either as repeated words or glued together with no space.
export const collapseRepeatedUtterance = (text: string) => {
  const cleaned = tidy(text);
  if (!cleaned) return '';
  const words = cleaned.split(' ');
  if (words.length >= 2) {
    for (let size = 1; size <= Math.floor(words.length / 2); size++) {
      const singleShortWord = size === 1 && words[0].length < 8;
      if (singleShortWord) continue;
      if (!samePhrase(words, size)) continue;
      return words.slice(0, size).join(' ');
    }
  }
  const n = cleaned.length;
  for (let size = 8; size <= Math.floor(n / 2); size++) {
    if (n % size !== 0) continue;
    const times = n / size;
    if (times < 2 || times > 3) continue;
    const unit = cleaned.slice(0, size);
    if (unit.repeat(times).toLowerCase() === cleaned.toLowerCase()) return tidy(unit);
  }
  return cleaned;
};

export const joinSpeechPieces = (pieces: string[]) => {
  let text = '';
  for (const raw of pieces) {
    const piece = collapseRepeatedUtterance(raw);
    if (!piece) continue;
    if (!text) {
      text = piece;
      continue;
    }
    const textKey = text.toLowerCase();
    const pieceKey = piece.toLowerCase();
    if (pieceKey === textKey || textKey.startsWith(pieceKey)) continue;
    if (pieceKey.startsWith(textKey)) {
      text = piece;
      continue;
    }
    text = collapseRepeatedUtterance(`${text} ${piece}`);
  }
  return text;
};
