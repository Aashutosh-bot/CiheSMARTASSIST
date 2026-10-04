import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import ChatPanel from "./ChatPanel";

// Standalone full-page chat view. The main chat experience now lives
// directly on the student Dashboard ("AI Chat" tab) - this page is kept
// as a direct link/bookmark fallback that renders the same ChatPanel.
function Chatbot() {
  const navigate = useNavigate();
  const studentName = localStorage.getItem("studentName") || "";

  useEffect(() => {
    if (localStorage.getItem("loggedIn") !== "true") {
      navigate("/");
    }
  }, [navigate]);

  return (
    <div style={{ fontFamily: "Arial, sans-serif", background: "#f0f2f5", height: "100vh", display: "flex", flexDirection: "column" }}>
      <div style={{ background: "#0f2a52", color: "white", padding: "14px 24px", display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
        <div style={{ fontWeight: "bold" }}>🤖 CIHE SmartAssist</div>
        <button
          onClick={() => navigate(localStorage.getItem("role") === "admin" ? "/admin" : "/dashboard")}
          style={{ background: "#e8a020", color: "white", padding: "8px 18px", borderRadius: 5, border: "none", fontWeight: "bold", cursor: "pointer" }}
        >
          ← Dashboard
        </button>
      </div>
      <div style={{ flex: 1, minHeight: 0 }}>
        <ChatPanel greetingName={studentName} />
      </div>
    </div>
  );
}

export default Chatbot;
