/** Build customFocus / practiceFocus string for any module. */
export function buildModuleCustomFocus(
  userFocus: string,
  includeFlashcards: boolean,
  flashcardWords: string[],
  weakPractice?: boolean,
  weakLabels?: string[],
): string | undefined {
  const parts: string[] = [];
  if (userFocus.trim()) parts.push(userFocus.trim());
  if (weakPractice && weakLabels?.length) parts.push(`Focus on: ${weakLabels.join(", ")}`);
  if (includeFlashcards && flashcardWords.length) {
    parts.push(`Naturally incorporate these saved vocabulary words: ${flashcardWords.slice(0, 24).join(", ")}`);
  }
  return parts.length ? parts.join(". ") : undefined;
}

export function flashcardWordsPayload(
  includeFlashcards: boolean,
  flashcardWords: string[],
): string[] | undefined {
  if (!includeFlashcards || !flashcardWords.length) return undefined;
  return flashcardWords;
}
