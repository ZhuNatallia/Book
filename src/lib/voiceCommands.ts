export const foldVoice = (text: string) =>
  text
    .toLowerCase()
    .replace(/ё/g, 'е')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[.!?,…'’«»"]+/g, ' ');

export const voiceTokens = (text: string) => foldVoice(text).split(/\s+/).filter(Boolean);

export const STOP_WORDS = [
  'стоп',
  'stop',
  'stopp',
  'pause',
  'пауза',
  'pausa',
  'pauza',
  'останови',
  'остановись',
  'подожди',
  'хватит',
  'зупинись',
  'зупини',
  'зачекай',
  'досить',
  'wait',
  'hold on',
  'halt',
  'warte',
  'stój',
  'stoj',
  'czekaj',
  'ferma',
  'fermati',
  'aspetta',
  'basta',
  'para',
  'pare',
  'detente',
  'espera',
  'alto',
  'arrête',
  'arrete',
  'arrêt',
  'arret',
  'attends',
  'тоқта',
  'тоқтат',
  'күте тұр',
];

// After a pause: these move on to the following step...
export const NEXT_WORDS = [
  'дальше',
  'далее',
  'следующий',
  'next',
  'go',
  'гоу',
  'weiter',
  'nächster',
  'далі',
  'наступний',
  'dalej',
  'następny',
  'avanti',
  'prossimo',
  'siguiente',
  'adelante',
  'suivant',
  'la suite',
  'әрі',
  'әрі қарай',
  'келесі',
];

// ...and these read the interrupted step again from its start.
export const REPEAT_WORDS = [
  'продолжай',
  'продолжи',
  'повтори',
  'ещё раз',
  'continue',
  'go on',
  'repeat',
  'again',
  'nochmal',
  'noch einmal',
  'wiederhole',
  'продовжуй',
  'продовж',
  'ще раз',
  'kontynuuj',
  'powtórz',
  'jeszcze raz',
  'continua',
  'ripeti',
  'ancora',
  'sigue',
  'continúa',
  'repite',
  'otra vez',
  'continuez',
  'répète',
  'répétez',
  'encore',
  'жалғастыр',
  'қайтала',
];

// The microphone also hears the step being read aloud. A long transcript that is
// mostly that step is the loudspeaker. A short phrase is the cook, even when the
// step happens to contain the same word ("хватит", "para", "далее").
export const matchesVoice = (text: string, words: string[], echoOf = '') => {
  const said = voiceTokens(text);
  if (said.length === 0) return false;
  const folded = ` ${said.join(' ')} `;
  const echoTokens = voiceTokens(echoOf);
  const echo = ` ${echoTokens.join(' ')} `;
  const echoSet = new Set(echoTokens);
  const overlap = echoTokens.length === 0
    ? 0
    : said.filter((token) => echoSet.has(token)).length / said.length;
  const speaker = said.length >= 4 && overlap >= 0.6;
  return words.some((word) => {
    const spoken = ` ${voiceTokens(word).join(' ')} `;
    if (!folded.includes(spoken)) return false;
    if (!speaker) return true;
    return !echo.includes(spoken);
  });
};
