import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import type { GradeMap, PaperText, QuestionBlock } from "@/lib/paper";
import { blockKey, justField, tfField } from "@/lib/paper";
import { TappableText } from "@/components/WordModal";

type Colors = {
  card: string;
  cardAlt: string;
  text: string;
  textSecondary: string;
  border: string;
};

type Props = {
  texts: PaperText[];
  answers: Record<string, string>;
  setField: (fieldId: string, value: string) => void;
  submitted: boolean;
  grades: GradeMap;
  accent: string;
  colors: Colors;
  showBody: "always" | "afterSubmit";
  renderTextExtra?: (text: PaperText) => React.ReactNode;
  onWordPress?: (word: string, ctx: string) => void;
};

const GREEN = "#27AE60";
const RED = "#E74C3C";

export function PaperView({
  texts,
  answers,
  setField,
  submitted,
  grades,
  accent,
  colors,
  showBody,
  renderTextExtra,
  onWordPress,
}: Props) {
  const wp = onWordPress ?? (() => {});

  return (
    <View style={{ gap: 18 }}>
      {texts.map((text) => (
        <View key={text.id} style={{ gap: 12 }}>
          {/* Text header */}
          <View style={[pv.textHeader, { borderColor: accent + "40", backgroundColor: accent + "12" }]}>
            <Text style={[pv.textLabel, { color: accent }]}>{text.label}</Text>
            <Text style={[pv.textTitle, { color: colors.text }]}>{text.title}</Text>
            {!!text.context && <Text style={[pv.textContext, { color: colors.textSecondary }]}>{text.context}</Text>}
          </View>

          {renderTextExtra?.(text)}

          {/* Body (reading text or transcript) */}
          {(showBody === "always" || submitted) && !!text.body && (
            <View style={[pv.bodyCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              {showBody === "afterSubmit" && (
                <Text style={[pv.transcriptLabel, { color: colors.textSecondary }]}>Transcripción</Text>
              )}
              {text.body.split("\n").filter(Boolean).map((para, pi) => (
                <TappableText
                  key={pi}
                  text={para}
                  textStyle={[pv.bodyText, { color: colors.text }]}
                  onWordPress={wp}
                />
              ))}
            </View>
          )}

          {/* Question blocks */}
          {text.blocks.map((block, bi) => (
            <BlockView
              key={`${text.id}-${bi}`}
              textId={text.id}
              block={block}
              answers={answers}
              setField={setField}
              submitted={submitted}
              grades={grades}
              accent={accent}
              colors={colors}
              onWordPress={wp}
            />
          ))}
        </View>
      ))}
    </View>
  );
}

function ResultLine({
  correct,
  expected,
  feedback,
  colors,
}: {
  correct: boolean;
  expected?: string;
  feedback?: string;
  colors: Colors;
}) {
  return (
    <View style={[pv.resultLine, { borderColor: (correct ? GREEN : RED) + "50", backgroundColor: (correct ? GREEN : RED) + "12" }]}>
      <Ionicons name={correct ? "checkmark-circle" : "close-circle"} size={15} color={correct ? GREEN : RED} />
      <View style={{ flex: 1 }}>
        {!correct && !!expected && (
          <Text style={[pv.resultExpected, { color: GREEN }]}>Correcta: {expected}</Text>
        )}
        {!!feedback && <Text style={[pv.resultFeedback, { color: colors.textSecondary }]}>{feedback}</Text>}
      </View>
    </View>
  );
}

function BlockView({
  textId,
  block,
  answers,
  setField,
  submitted,
  grades,
  accent,
  colors,
  onWordPress,
}: {
  textId: string;
  block: QuestionBlock;
  answers: Record<string, string>;
  setField: (fieldId: string, value: string) => void;
  submitted: boolean;
  grades: GradeMap;
  accent: string;
  colors: Colors;
  onWordPress: (word: string, ctx: string) => void;
}) {
  const items = block.items ?? [];

  return (
    <View style={[pv.block, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Text style={[pv.instruction, { color: colors.text }]}>{block.instruction}</Text>

      {/* Shared option bank for heading-match / gap-fill-bank */}
      {(block.type === "heading-match" || block.type === "gap-fill-bank") && !!block.options?.length && (
        <View style={[pv.bank, { backgroundColor: colors.cardAlt, borderColor: colors.border }]}>
          {block.options.map((o) => (
            <Text key={o.letter} style={[pv.bankItem, { color: colors.text }]}>
              <Text style={{ color: accent, fontFamily: "Inter_700Bold" }}>{o.letter}. </Text>
              {o.text}
            </Text>
          ))}
        </View>
      )}

      {!!block.intro && (
        <Text style={[pv.intro, { color: colors.text, backgroundColor: colors.cardAlt, borderColor: colors.border }]}>
          {block.intro}
        </Text>
      )}

      {/* choose-5-true */}
      {block.type === "choose-5-true" && (
        <ChooseFiveTrue
          textId={textId}
          block={block}
          answers={answers}
          setField={setField}
          submitted={submitted}
          grades={grades}
          accent={accent}
          colors={colors}
        />
      )}

      {/* item-based blocks */}
      {block.type !== "choose-5-true" &&
        items.map((it, idx) => {
          const g = grades[it.id];
          const letterMode = block.type === "multiple-choice" || block.type === "heading-match" || block.type === "gap-fill-bank";
          return (
            <View key={it.id} style={pv.item}>
              {/* Prompt */}
              {!!it.question && (
                <Text style={[pv.qText, { color: colors.text }]}>
                  <Text style={{ color: accent, fontFamily: "Inter_700Bold" }}>{idx + 1}. </Text>
                  {it.question}
                </Text>
              )}
              {!!it.statement && (
                <Text style={[pv.qText, { color: colors.text }]}>
                  <Text style={{ color: accent, fontFamily: "Inter_700Bold" }}>{idx + 1}. </Text>
                  {it.statement}
                </Text>
              )}
              {!!it.clue && (
                <Text style={[pv.qText, { color: colors.text }]}>
                  <Text style={{ color: accent, fontFamily: "Inter_700Bold" }}>{idx + 1}. </Text>
                  {it.clue}
                </Text>
              )}
              {!!it.stem && (
                <Text style={[pv.qText, { color: colors.text }]}>
                  <Text style={{ color: accent, fontFamily: "Inter_700Bold" }}>{it.stem} </Text>
                </Text>
              )}
              {!!it.phrase && (
                <Text style={[pv.qText, { color: colors.text }]}>
                  <Text style={{ color: accent, fontFamily: "Inter_700Bold" }}>{idx + 1}. </Text>
                  {it.phrase}
                </Text>
              )}

              {/* Answer control */}
              {block.type === "multiple-choice" && (
                <View style={{ gap: 8, marginTop: 8 }}>
                  {(it.options ?? []).map((opt) => {
                    const letter = opt.trim().charAt(0).toUpperCase();
                    const active = (answers[it.id] ?? "").charAt(0).toUpperCase() === letter;
                    return (
                      <Pressable
                        key={opt}
                        disabled={submitted}
                        onPress={() => setField(it.id, letter)}
                        style={[pv.option, { backgroundColor: active ? accent + "18" : colors.cardAlt, borderColor: active ? accent : colors.border }]}
                      >
                        <Text style={[pv.optionText, { color: colors.text }]}>{opt}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              )}

              {(block.type === "heading-match" || block.type === "gap-fill-bank") && (
                <View style={pv.letterRow}>
                  {(block.options ?? []).map((o) => {
                    const active = (answers[it.id] ?? "").toUpperCase() === o.letter.toUpperCase();
                    return (
                      <Pressable
                        key={o.letter}
                        disabled={submitted}
                        onPress={() => setField(it.id, o.letter)}
                        style={[pv.letterChip, { backgroundColor: active ? accent : colors.cardAlt, borderColor: active ? accent : colors.border }]}
                      >
                        <Text style={[pv.letterChipText, { color: active ? "#fff" : colors.textSecondary }]}>{o.letter}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              )}

              {block.type === "true-false-justify" && (
                <>
                  <View style={pv.tfRow}>
                    {["Verdadero", "Falso"].map((opt) => {
                      const active = answers[tfField(it.id)] === opt;
                      const c = opt === "Verdadero" ? GREEN : RED;
                      return (
                        <Pressable
                          key={opt}
                          disabled={submitted}
                          onPress={() => setField(tfField(it.id), opt)}
                          style={[pv.tfBtn, { backgroundColor: active ? c : colors.cardAlt, borderColor: active ? c : colors.border }]}
                        >
                          <Text style={[pv.tfText, { color: active ? "#fff" : colors.text }]}>{opt}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                  <TextInput
                    editable={!submitted}
                    value={answers[justField(it.id)] ?? ""}
                    onChangeText={(v) => setField(justField(it.id), v)}
                    placeholder="Justificación (palabras del texto)…"
                    placeholderTextColor={colors.textSecondary}
                    multiline
                    style={[pv.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.cardAlt }]}
                    textAlignVertical="top"
                  />
                </>
              )}

              {(block.type === "short-answer" ||
                block.type === "find-word" ||
                block.type === "sentence-completion" ||
                block.type === "referent" ||
                block.type === "cloze-max3") && (
                <TextInput
                  editable={!submitted}
                  value={answers[it.id] ?? ""}
                  onChangeText={(v) => setField(it.id, v)}
                  placeholder="Tu respuesta…"
                  placeholderTextColor={colors.textSecondary}
                  multiline={block.type === "short-answer" || block.type === "sentence-completion"}
                  style={[pv.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.cardAlt }]}
                  textAlignVertical="top"
                  autoCorrect={false}
                />
              )}

              {/* Review result */}
              {submitted && g && (
                <ResultLine
                  correct={g.correct}
                  expected={
                    block.type === "true-false-justify"
                      ? `${it.answer}${it.justification ? ` — ${it.justification}` : ""}`
                      : letterMode
                        ? it.answer
                        : it.answer
                  }
                  feedback={g.feedback ?? it.explanation}
                  colors={colors}
                />
              )}
            </View>
          );
        })}
    </View>
  );
}

function ChooseFiveTrue({
  textId,
  block,
  answers,
  setField,
  submitted,
  grades,
  accent,
  colors,
}: {
  textId: string;
  block: QuestionBlock;
  answers: Record<string, string>;
  setField: (fieldId: string, value: string) => void;
  submitted: boolean;
  grades: GradeMap;
  accent: string;
  colors: Colors;
}) {
  const key = blockKey(textId, block);
  const selected = (answers[key] ?? "").split(",").map((x) => x.trim().toUpperCase()).filter(Boolean);
  const correctSet = new Set((block.answers ?? []).map((x) => x.toUpperCase()));

  const toggle = (letter: string) => {
    const L = letter.toUpperCase();
    let next: string[];
    if (selected.includes(L)) {
      next = selected.filter((x) => x !== L);
    } else {
      if (selected.length >= 5) return; // cap at 5
      next = [...selected, L];
    }
    setField(key, next.join(","));
  };

  return (
    <View style={{ gap: 8, marginTop: 8 }}>
      <Text style={[pv.helper, { color: colors.textSecondary }]}>Selecciona exactamente 5 ({selected.length}/5)</Text>
      {(block.options ?? []).map((o) => {
        const isSel = selected.includes(o.letter.toUpperCase());
        const isCorrect = correctSet.has(o.letter.toUpperCase());
        let borderColor = colors.border;
        let bg = colors.cardAlt;
        if (submitted) {
          if (isCorrect) {
            borderColor = GREEN;
            bg = GREEN + "15";
          } else if (isSel) {
            borderColor = RED;
            bg = RED + "15";
          }
        } else if (isSel) {
          borderColor = accent;
          bg = accent + "18";
        }
        return (
          <Pressable
            key={o.letter}
            disabled={submitted}
            onPress={() => toggle(o.letter)}
            style={[pv.option, { backgroundColor: bg, borderColor, flexDirection: "row", alignItems: "center", gap: 8 }]}
          >
            <View style={[pv.checkbox, { borderColor: isSel ? accent : colors.border, backgroundColor: isSel ? accent : "transparent" }]}>
              {isSel && <Ionicons name="checkmark" size={12} color="#fff" />}
            </View>
            <Text style={[pv.optionText, { color: colors.text, flex: 1 }]}>
              <Text style={{ fontFamily: "Inter_700Bold", color: accent }}>{o.letter}. </Text>
              {o.text}
            </Text>
            {submitted && isCorrect && <Ionicons name="checkmark-circle" size={16} color={GREEN} />}
          </Pressable>
        );
      })}
    </View>
  );
}

const pv = StyleSheet.create({
  textHeader: { borderRadius: 12, borderWidth: 1, padding: 12, gap: 2 },
  textLabel: { fontSize: 12, fontFamily: "Inter_700Bold", textTransform: "uppercase", letterSpacing: 1 },
  textTitle: { fontSize: 16, fontFamily: "Inter_700Bold" },
  textContext: { fontSize: 13, fontFamily: "Inter_400Regular", fontStyle: "italic", marginTop: 2 },
  bodyCard: { borderRadius: 12, borderWidth: 1, padding: 16, gap: 10 },
  transcriptLabel: { fontSize: 11, fontFamily: "Inter_600SemiBold", textTransform: "uppercase", letterSpacing: 0.6 },
  bodyText: { fontSize: 15, fontFamily: "Inter_400Regular", lineHeight: 24 },
  block: { borderRadius: 12, borderWidth: 1, padding: 14, gap: 12 },
  instruction: { fontSize: 14, fontFamily: "Inter_600SemiBold", lineHeight: 20 },
  bank: { borderRadius: 10, borderWidth: 1, padding: 12, gap: 6 },
  bankItem: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 19 },
  intro: { fontSize: 14, fontFamily: "Inter_400Regular", lineHeight: 22, padding: 12, borderRadius: 10, borderWidth: 1 },
  item: { gap: 6 },
  qText: { fontSize: 15, fontFamily: "Inter_400Regular", lineHeight: 22 },
  option: { padding: 12, borderRadius: 10, borderWidth: 1 },
  optionText: { fontSize: 14, fontFamily: "Inter_400Regular", lineHeight: 20 },
  letterRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 6 },
  letterChip: { minWidth: 40, alignItems: "center", paddingHorizontal: 12, paddingVertical: 9, borderRadius: 10, borderWidth: 1 },
  letterChipText: { fontSize: 14, fontFamily: "Inter_700Bold" },
  tfRow: { flexDirection: "row", gap: 10, marginTop: 6 },
  tfBtn: { flex: 1, alignItems: "center", paddingVertical: 12, borderRadius: 10, borderWidth: 1 },
  tfText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, fontFamily: "Inter_400Regular", marginTop: 8, minHeight: 44 },
  helper: { fontSize: 12, fontFamily: "Inter_500Medium" },
  checkbox: { width: 20, height: 20, borderRadius: 5, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  resultLine: { flexDirection: "row", alignItems: "flex-start", gap: 8, marginTop: 8, padding: 10, borderRadius: 10, borderWidth: 1 },
  resultExpected: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  resultFeedback: { fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 18, marginTop: 2 },
});
