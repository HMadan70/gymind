import { useCallback, useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { API_URL } from "../../constants/api";
import { fonts, shapeTokens } from "../../constants/theme";
import { useTheme } from "../../context/ThemeContext";
import { authFetch } from "../../lib/session";

type ChatTurn = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

const SUGGESTIONS = [
  "What should I train today?",
  "How is my progress looking?",
  "Am I eating enough protein?",
];

// Bubble keys must be unique and stable for the lifetime of the bubble.
// Neither candidate works alone: Date.now() collides when two sends land in
// the same millisecond, and the server's message id is absent whenever the
// response is not the shape we expect - which silently produced the same
// key ("reply-undefined") for every reply. A local counter cannot collide.
let turnSequence = 0;
const nextTurnId = () => `turn-${(turnSequence += 1)}`;

// POST /coach returns the assistant turn as an object: { reply: { content } }.
// An earlier revision of this same endpoint returned it as a bare string,
// { reply: "..." }, so a backend that has not been redeployed still answers
// in that shape. Accept both, and return null when neither yields text so an
// unreadable response surfaces as an error instead of an empty bubble.
function extractReplyText(data: unknown): string | null {
  const reply = (data as { reply?: unknown } | null)?.reply;
  if (typeof reply === "string") {
    return reply.trim() || null;
  }
  if (reply && typeof reply === "object") {
    const content = (reply as { content?: unknown }).content;
    if (typeof content === "string") {
      return content.trim() || null;
    }
  }
  return null;
}

export default function Coach() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);

  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [draft, setDraft] = useState("");
  const [conversationId, setConversationId] = useState<number | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const send = useCallback(
    async (text: string) => {
      const message = text.trim();
      if (!message || sending) return;

      setError(null);
      setDraft("");
      setSending(true);
      setTurns((prev) => [
        ...prev,
        { id: nextTurnId(), role: "user", content: message },
      ]);

      try {
        const response = await authFetch(`${API_URL}/coach`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message,
            ...(conversationId === null ? {} : { conversation_id: conversationId }),
          }),
        });

        if (!response.ok) {
          // The backend returns 503 when the Coach provider is unconfigured
          // or unreachable; anything else is unexpected. Either way the turn
          // was not stored server-side, so drop the optimistic bubble.
          setTurns((prev) => prev.slice(0, -1));
          setDraft(message);
          setError(
            response.status === 503
              ? "Coach is unavailable right now. Please try again shortly."
              : "Something went wrong. Please try again."
          );
          return;
        }

        const data = await response.json();
        const replyText = extractReplyText(data);

        if (replyText === null) {
          setTurns((prev) => prev.slice(0, -1));
          setDraft(message);
          setError("Coach replied in a format this app could not read.");
          return;
        }

        if (typeof data?.conversation_id === "number") {
          setConversationId(data.conversation_id);
        }
        setTurns((prev) => [
          ...prev,
          { id: nextTurnId(), role: "assistant", content: replyText },
        ]);
      } catch {
        setTurns((prev) => prev.slice(0, -1));
        setDraft(message);
        setError("Could not reach the server. Check your connection.");
      } finally {
        setSending(false);
      }
    },
    [conversationId, sending]
  );

  const isEmpty = turns.length === 0;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={{ flex: 1, backgroundColor: colors.bgBase }}
    >
      <View style={{ flex: 1, paddingTop: insets.top }}>
        <View style={{ paddingHorizontal: 20, paddingVertical: 18 }}>
          <Text
            accessibilityRole="header"
            style={{
              color: colors.textPrimary,
              fontFamily: fonts.heading,
              fontSize: 28,
            }}
          >
            Coach
          </Text>
          <Text
            style={{
              marginTop: 4,
              color: colors.textDim,
              fontFamily: fonts.body,
              fontSize: 14,
            }}
          >
            Advice grounded in what you have actually logged.
          </Text>
        </View>

        <ScrollView
          ref={scrollRef}
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 16 }}
          onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
          keyboardShouldPersistTaps="handled"
        >
          {isEmpty ? (
            <View style={{ gap: 10 }}>
              {SUGGESTIONS.map((suggestion) => (
                <Pressable
                  key={suggestion}
                  onPress={() => send(suggestion)}
                  disabled={sending}
                  style={{
                    ...shapeTokens.secondaryCard,
                    backgroundColor: colors.bgCard,
                    borderWidth: 1,
                    borderColor: colors.border,
                    paddingHorizontal: 18,
                    paddingVertical: 16,
                    opacity: sending ? 0.5 : 1,
                  }}
                >
                  <Text
                    style={{
                      color: colors.textPrimary,
                      fontFamily: fonts.bodyMedium,
                      fontSize: 15,
                    }}
                  >
                    {suggestion}
                  </Text>
                </Pressable>
              ))}
            </View>
          ) : (
            turns.map((turn) => {
              const isUser = turn.role === "user";
              return (
                <View
                  key={turn.id}
                  style={{
                    marginBottom: 12,
                    maxWidth: "88%",
                    alignSelf: isUser ? "flex-end" : "flex-start",
                    backgroundColor: isUser ? colors.tealSoft : colors.bgCard,
                    borderWidth: 1,
                    borderColor: isUser ? colors.teal : colors.border,
                    borderRadius: 18,
                    paddingHorizontal: 16,
                    paddingVertical: 12,
                  }}
                >
                  <Text
                    style={{
                      color: colors.textPrimary,
                      fontFamily: fonts.body,
                      fontSize: 15,
                      lineHeight: 22,
                    }}
                  >
                    {turn.content}
                  </Text>
                </View>
              );
            })
          )}

          {sending ? (
            <View style={{ alignSelf: "flex-start", paddingVertical: 8 }}>
              <ActivityIndicator color={colors.teal} />
            </View>
          ) : null}

          {error ? (
            <Text
              style={{
                marginTop: 4,
                color: colors.coral,
                fontFamily: fonts.bodyMedium,
                fontSize: 14,
              }}
            >
              {error}
            </Text>
          ) : null}
        </ScrollView>

        <View
          style={{
            flexDirection: "row",
            alignItems: "flex-end",
            gap: 10,
            paddingHorizontal: 20,
            paddingTop: 10,
            paddingBottom: 12,
            borderTopWidth: 1,
            borderTopColor: colors.border,
            backgroundColor: colors.bgBase,
          }}
        >
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder="Ask your coach"
            placeholderTextColor={colors.textFaint}
            multiline
            editable={!sending}
            onSubmitEditing={() => send(draft)}
            style={{
              flex: 1,
              maxHeight: 120,
              color: colors.textPrimary,
              fontFamily: fonts.body,
              fontSize: 15,
              backgroundColor: colors.bgInset,
              borderRadius: 18,
              paddingHorizontal: 16,
              paddingVertical: 12,
            }}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Send message"
            onPress={() => send(draft)}
            disabled={sending || draft.trim().length === 0}
            style={{
              ...shapeTokens.pill,
              backgroundColor:
                sending || draft.trim().length === 0 ? colors.border : colors.teal,
              paddingHorizontal: 20,
              paddingVertical: 14,
            }}
          >
            <Text
              style={{
                color: colors.tealOn,
                fontFamily: fonts.bodyExtra,
                fontSize: 15,
              }}
            >
              Send
            </Text>
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}
