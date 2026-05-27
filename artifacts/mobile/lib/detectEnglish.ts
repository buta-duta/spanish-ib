const ENGLISH_INTRUSIONS = new Set([
  "ok", "okay", "hello", "hi", "hey", "yes", "no", "yeah", "yep", "nope",
  "the", "and", "or", "but", "so", "because", "like", "just", "really", "very",
  "actually", "basically", "literally", "maybe", "probably", "definitely",
  "thing", "things", "stuff", "people", "person", "school", "work", "home",
  "good", "bad", "nice", "cool", "awesome", "great", "well", "also", "too",
  "however", "although", "though", "then", "when", "where", "what", "why",
  "think", "thought", "know", "knew", "want", "wanted", "need", "needed",
  "make", "made", "get", "got", "go", "went", "come", "came", "see", "saw",
  "say", "said", "tell", "told", "feel", "felt", "look", "looked", "use", "used",
  "english", "spanish", "french", "german", "language", "word", "words",
  "actually", "anyway", "whatever", "something", "anything", "everything",
  "always", "never", "sometimes", "often", "usually", "already", "still",
  "even", "only", "about", "with", "from", "into", "through", "during",
  "before", "after", "above", "below", "between", "under", "over",
  "family", "friend", "friends", "mother", "father", "brother", "sister",
  "country", "city", "world", "life", "live", "living", "love", "hate",
  "happy", "sad", "angry", "tired", "busy", "free", "important", "different",
  "same", "other", "another", "each", "every", "all", "some", "any", "many",
  "much", "more", "most", "less", "least", "first", "last", "next", "new", "old",
  "young", "big", "small", "long", "short", "high", "low", "right", "wrong",
  "true", "false", "real", "fake", "hard", "easy", "simple", "complex",
  "problem", "problems", "solution", "answer", "question", "questions",
  "idea", "ideas", "example", "examples", "reason", "reasons", "fact", "facts",
  "culture", "cultural", "society", "social", "political", "politics", "economy",
  "environment", "environmental", "technology", "technological", "science",
  "art", "music", "sport", "sports", "food", "water", "money", "time",
  "year", "years", "month", "day", "week", "hour", "minute", "today", "tomorrow",
  "yesterday", "now", "later", "soon", "here", "there", "everywhere", "somewhere",
]);

const SPANISH_MARKERS = /[ñáéíóúüÑÁÉÍÓÚÜ]/;

export function detectEnglishWords(text: string): string[] {
  const tokens = text.match(/[a-zA-Z']+/g) ?? [];
  const found: string[] = [];

  for (const raw of tokens) {
    const word = raw.replace(/'/g, "");
    if (word.length < 3) continue;
    if (SPANISH_MARKERS.test(word)) continue;

    const lower = word.toLowerCase();
    if (ENGLISH_INTRUSIONS.has(lower)) {
      found.push(word);
    }
  }

  return [...new Set(found)];
}
