import { useState, useRef, useEffect } from "react";

const NAVY = "#0f2a52";
const GOLD = "#e8a020";

const DEFAULT_PROMPTS = [
  "What's my attendance percentage?",
  "What's my next assignment deadline?",
  "When's my next class and what room?",
  "What's the attendance policy?",
];

function TypingDots() {
  return (
    <span style={{ display: "inline-flex", gap: 4, padding: "4px 2px" }}>
      {[0, 1, 2].map(i => (
        <span
          key={i}
          style={{
            width: 6, height: 6, borderRadius: "50%", background: "#aab4c2",
            animation: "smartassist-bounce 1.2s infinite ease-in-out",
            animationDelay: `${i * 0.15}s`,
          }}
        />
      ))}
      <style>{`
        @keyframes smartassist-bounce {
          0%, 80%, 100% { transform: translateY(0); opacity: 0.5; }
          40% { transform: translateY(-4px); opacity: 1; }
        }
      `}</style>
    </span>
  );
}

function ChatPanel({ title = "CIHE SmartAssist", subtitle = "Your AI campus assistant — ask me anything about units, fees, attendance, enrolment and more.", suggestedPrompts = DEFAULT_PROMPTS, greetingName = "" }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending]);

  async function sendMessage(overrideText) {
    const textToSend = overrideText !== undefined ? overrideText : input;
    if (!textToSend.trim() || sending) return;
    setMessages(prev => [...prev, { role: "user", text: textToSend }]);
    setInput("");
    setSending(true);
    try {
      const email = localStorage.getItem("studentEmail") || "";
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: textToSend, email }),
      });
      const data = await res.json();
      setMessages(prev => [...prev, { role: "bot", text: data.text, sources: data.sources, unmatched: data.unmatched }]);
    } catch {
      setMessages(prev => [...prev, { role: "bot", text: "Error connecting to server.", unmatched: true }]);
    } finally {
      setSending(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>
      {/* HEADER */}
      <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "18px 24px", borderBottom: "1px solid #e8ecf1", background: "white", flexShrink: 0 }}>
        <div style={{ width: 44, height: 44, borderRadius: "50%", background: NAVY, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 }}>
          🤖
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 16, fontWeight: "bold", color: NAVY }}>{title}</div>
          <div style={{ fontSize: 12, color: "#888" }}>{subtitle}</div>
        </div>
      </div>

      {/* MESSAGES */}
      <div style={{ flex: 1, overflowY: "auto", padding: "24px 24px 8px", background: "#f6f8fb" }}>
        {messages.length === 0 && (
          <div style={{ maxWidth: 560, margin: "20px auto", textAlign: "center" }}>
            <div style={{ fontSize: 40, marginBottom: 10 }}>💬</div>
            <div style={{ fontSize: 17, fontWeight: "bold", color: NAVY, marginBottom: 6 }}>
              {greetingName ? `Hi ${greetingName}, how can I help?` : "How can I help?"}
            </div>
            <div style={{ fontSize: 13, color: "#888", marginBottom: 20 }}>
              Try one of these, or type your own question below.
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center" }}>
              {suggestedPrompts.map((p, i) => (
                <button
                  key={i}
                  onClick={() => sendMessage(p)}
                  style={{
                    padding: "9px 16px", borderRadius: 20, border: `1px solid ${NAVY}`,
                    background: "white", color: NAVY, fontSize: 12.5, cursor: "pointer",
                  }}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        )}

        <div style={{ maxWidth: 680, margin: "0 auto", display: "flex", flexDirection: "column", gap: 14 }}>
          {messages.map((m, i) => (
            <div key={i} style={{ display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start" }}>
              {m.role === "bot" && (
                <div style={{ width: 30, height: 30, borderRadius: "50%", background: NAVY, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, marginRight: 8, flexShrink: 0 }}>
                  🤖
                </div>
              )}
              <div style={{ maxWidth: "75%" }}>
                <div
                  style={{
                    background: m.role === "user" ? NAVY : "white",
                    color: m.role === "user" ? "white" : "#222",
                    padding: "11px 16px",
                    borderRadius: m.role === "user" ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
                    fontSize: 14, lineHeight: 1.5,
                    boxShadow: m.role === "bot" ? "0 1px 4px rgba(0,0,0,0.06)" : "none",
                  }}
                >
                  {m.text}
                </div>
                {m.role === "bot" && m.sources && m.sources.length > 0 && !m.unmatched && (
                  <div style={{ fontSize: 10.5, color: "#aaa", marginTop: 4, marginLeft: 2 }}>
                    Source: {m.sources.join(", ")}
                  </div>
                )}
                {m.unmatched && (
                  <div style={{ fontSize: 10.5, color: GOLD, marginTop: 4, marginLeft: 2, fontWeight: "bold" }}>
                    Escalated to Student Services
                  </div>
                )}
              </div>
            </div>
          ))}

          {sending && (
            <div style={{ display: "flex", alignItems: "center" }}>
              <div style={{ width: 30, height: 30, borderRadius: "50%", background: NAVY, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, marginRight: 8, flexShrink: 0 }}>
                🤖
              </div>
              <div style={{ background: "white", borderRadius: "16px 16px 16px 4px", padding: "11px 16px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
                <TypingDots />
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      </div>

      {/* INPUT */}
      <div style={{ padding: "16px 24px 20px", background: "white", borderTop: "1px solid #e8ecf1", flexShrink: 0 }}>
        <div style={{ maxWidth: 680, margin: "0 auto", display: "flex", gap: 10 }}>
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && sendMessage()}
            placeholder="Ask me anything about your course..."
            style={{ flex: 1, padding: "13px 16px", borderRadius: 24, border: "1px solid #d7dde5", fontSize: 14, outline: "none" }}
          />
          <button
            onClick={() => sendMessage()}
            disabled={sending || !input.trim()}
            style={{
              padding: "0 22px", background: NAVY, color: "white", border: "none", borderRadius: 24,
              fontSize: 14, fontWeight: "bold", cursor: sending || !input.trim() ? "default" : "pointer",
              opacity: sending || !input.trim() ? 0.6 : 1,
            }}
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}

export default ChatPanel;
