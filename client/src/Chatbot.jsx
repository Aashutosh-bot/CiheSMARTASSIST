import { useState, useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";

function Chatbot() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const location = useLocation();
  const navigate = useNavigate();

  async function sendMessage(overrideText) {
    const textToSend = overrideText !== undefined ? overrideText : input;
    if (!textToSend.trim()) return;
    setMessages(prev => [...prev, { role: "user", text: textToSend }]);
    setInput("");
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: textToSend })
      });
      const data = await res.json();
      setMessages(prev => [...prev, { role: "bot", text: data.text, sources: data.sources }]);
    } catch {
      setMessages(prev => [...prev, { role: "bot", text: "Error connecting to server." }]);
    }
  }

 const sentPreset = useRef(false);

useEffect(() => {
  if (localStorage.getItem("loggedIn") !== "true") {
    navigate("/");
    return;
  }
  if (location.state?.presetQuestion && !sentPreset.current) {
    sentPreset.current = true;
    sendMessage(location.state.presetQuestion);
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, []);

  return (
    <div style={{ fontFamily: "Arial, sans-serif", background: "#f0f2f5", minHeight: "100vh" }}>
      <div style={{ background: "#0f2a52", color: "white", padding: "15px 30px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1 style={{ fontSize: 20 }}>🤖 CIHE AI Helpdesk</h1>
        <button onClick={() => navigate("/dashboard")} style={{ background: "#e8a020", color: "white", padding: "8px 18px", borderRadius: 5, border: "none", fontWeight: "bold", cursor: "pointer" }}>
          ← Dashboard
        </button>
      </div>

      <div style={{ maxWidth: 500, margin: "40px auto" }}>
        <div style={{ border: "1px solid #ccc", borderRadius: 8, padding: 16, minHeight: 300, background: "white" }}>
          {messages.map((m, i) => (
            <div key={i} style={{ margin: "8px 0", textAlign: m.role === "user" ? "right" : "left" }}>
              <span style={{ background: m.role === "user" ? "#0f2a52" : "#eee", color: m.role === "user" ? "white" : "#333", padding: "8px 12px", borderRadius: 10, display: "inline-block" }}>
                {m.text}
              </span>
            </div>
          ))}
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && sendMessage()}
            placeholder="Ask me anything..."
            style={{ flex: 1, padding: 10, borderRadius: 6, border: "1px solid #ccc" }}
          />
          <button onClick={() => sendMessage()} style={{ padding: "10px 16px", background: "#0f2a52", color: "white", border: "none", borderRadius: 6 }}>
            Send
          </button>
        </div>
      </div>
    </div>
  );
}

export default Chatbot;