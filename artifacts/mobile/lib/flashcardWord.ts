/** Normalize word for flashcard storage: single gender, verb infinitive. */
export function normalizeFlashcardWord(word: string, partOfSpeech: string, dictionaryForm?: string): string {
  if (dictionaryForm?.trim()) return dictionaryForm.trim();

  let w = word.trim();
  w = w.replace(/\b(\w+)\/(\w+)\b/g, (_, a: string, b: string) => {
    const stemA = a.replace(/[oa]$/, "");
    const stemB = b.replace(/[oa]$/, "");
    if (stemA === stemB || a.slice(0, -1) === b.slice(0, -1)) {
      if (/^[aeiou]/i.test(b) && /o$/i.test(a)) return a;
      if (/a$/i.test(b)) return b.replace(/a$/, "o");
      return a;
    }
    return a;
  });
  w = w.replace(/\((?:o\/a|a\/o|m\/f)\)/gi, "").replace(/\s+/g, " ").trim();

  const pos = partOfSpeech.toLowerCase();
  if (/verb|verbo/.test(pos) && !/(ar|er|ir)$/i.test(w)) {
    return w;
  }
  return w;
}
