import { useState } from "react";
import { useNavigate } from "react-router-dom";

function Login() {
  const [showModal, setShowModal] = useState(false);
  const [loginType, setLoginType] = useState("student");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [studentStep, setStudentStep] = useState("email"); // "email" | "setPassword" | "login"
  const [error, setError] = useState("");
  const navigate = useNavigate();

  function openModal(type) {
    setLoginType(type);
    setError("");
    setEmail("");
    setPassword("");
    setConfirmPassword("");
    setStudentStep("email");
    setShowModal(true);
  }

  async function checkEmail() {
    setError("");
    if (!email) {
      setError("Please enter your email.");
      return;
    }
    try {
      const res = await fetch("/api/check-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email })
      });
      const data = await res.json();
      if (!data.success) {
        setError(data.message);
        return;
      }
      setStudentStep(data.hasPassword ? "login" : "setPassword");
    } catch {
      setError("Error connecting to server.");
    }
  }

  async function handleSetPassword() {
    setError("");
    if (!password || !confirmPassword) {
      setError("Please fill in both password fields.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    try {
      const res = await fetch("/api/set-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      if (data.success) {
        localStorage.setItem("loggedIn", "true");
        localStorage.setItem("role", "student");
        localStorage.setItem("studentName", data.name);
        localStorage.setItem("studentEmail", email);
        navigate("/dashboard");
      } else {
        setError(data.message);
      }
    } catch {
      setError("Error connecting to server.");
    }
  }

  async function handleLogin() {
    setError("");

    if (loginType === "admin") {
      if (!email || !password) {
        setError("Please enter your email and password.");
        return;
      }
      try {
        const res = await fetch("/api/admin-login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password })
        });
        const data = await res.json();
        if (data.success) {
          localStorage.setItem("loggedIn", "true");
          localStorage.setItem("role", "admin");
          navigate("/admin");
        } else {
          setError(data.message || "Login failed.");
        }
      } catch {
        setError("Error connecting to server.");
      }
      return;
    }

    // student flow
    if (studentStep === "email") {
      checkEmail();
      return;
    }
    if (studentStep === "setPassword") {
      handleSetPassword();
      return;
    }
    // studentStep === "login"
    if (!password) {
      setError("Please enter your password.");
      return;
    }
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      if (data.success) {
        localStorage.setItem("loggedIn", "true");
        localStorage.setItem("role", "student");
        localStorage.setItem("studentName", data.name);
        localStorage.setItem("studentEmail", email);
        navigate("/dashboard");
      } else {
        setError(data.message || "Login failed.");
      }
    } catch {
      setError("Error connecting to server.");
    }
  }

  const navLinks = ["Current Students", "Researchers", "Alumni", "Library", "Staff"];

  return (
    <div style={{ fontFamily: "Arial, sans-serif", background: "#f7f8fa", minHeight: "100vh" }}>

      {/* TOP UTILITY BAR */}
      <div style={{ background: "#f0f0f0", borderBottom: "1px solid #ddd", padding: "8px 40px", display: "flex", justifyContent: "flex-end", gap: 24, fontSize: 13, color: "#333" }}>
        {navLinks.map((l, i) => <span key={i} style={{ cursor: "pointer" }}>{l}</span>)}
      </div>

      {/* MAIN NAV */}
      <div style={{ background: "white", padding: "16px 40px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #e0e0e0" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 46, height: 46, background: "#0f2a52", color: "white", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: "bold" }}>
            CIHE
          </div>
          <div>
            <div style={{ fontSize: 17, fontWeight: "bold", color: "#0f2a52", lineHeight: 1.1 }}>Crown Institute</div>
            <div style={{ fontSize: 12, color: "#888" }}>of Higher Education</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 12 }}>
          <button
            onClick={() => openModal("student")}
            style={{ background: "white", color: "#0f2a52", padding: "10px 22px", border: "2px solid #0f2a52", borderRadius: 6, fontWeight: "bold", fontSize: 14, cursor: "pointer" }}
          >
            Student Login
          </button>
          <button
            onClick={() => openModal("admin")}
            style={{ background: "#0f2a52", color: "white", padding: "10px 22px", border: "none", borderRadius: 6, fontWeight: "bold", fontSize: 14, cursor: "pointer" }}
          >
            Admin Login
          </button>
        </div>
      </div>

      {/* HERO */}
      <div style={{ background: "linear-gradient(135deg, #0f2a52 0%, #1c3f6e 100%)", color: "white", padding: "80px 40px", textAlign: "center" }}>
        <div style={{ fontSize: 36, fontWeight: "bold", marginBottom: 16 }}>Welcome to CIHE</div>
        <div style={{ fontSize: 16, color: "#cbd5e1", maxWidth: 560, margin: "0 auto 30px" }}>
          Crown Institute of Higher Education — delivering quality, industry-relevant education in
          Business, Information Technology, and Health.
        </div>
        <button
          onClick={() => openModal("student")}
          style={{ background: "#e8a020", color: "white", padding: "14px 36px", border: "none", borderRadius: 6, fontWeight: "bold", fontSize: 15, cursor: "pointer" }}
        >
          Student Portal Login
        </button>
      </div>

      {/* FEATURES */}
      <div style={{ padding: "60px 40px", maxWidth: 1000, margin: "0 auto" }}>
        <div style={{ fontSize: 24, fontWeight: "bold", color: "#0f2a52", textAlign: "center", marginBottom: 40 }}>
          Everything you need, in one place
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 24 }}>
          {[
            { icon: "💬", title: "AI Helpdesk", text: "Get instant answers about enrolment, fees, timetables and more." },
            { icon: "🎓", title: "Manage Your Course", text: "View your units, semester details, and academic progress." },
            { icon: "📅", title: "Stay Organised", text: "Track key dates, assessments, and deadlines." },
            { icon: "📖", title: "Library Access", text: "Search over 45,000 titles and 200,000+ e-books and journals." }
          ].map((f, i) => (
            <div key={i} style={{ background: "white", borderRadius: 10, padding: "28px 22px", boxShadow: "0 2px 10px rgba(0,0,0,0.06)", textAlign: "center" }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>{f.icon}</div>
              <div style={{ fontWeight: "bold", fontSize: 15, color: "#0f2a52", marginBottom: 8 }}>{f.title}</div>
              <div style={{ fontSize: 13, color: "#666", lineHeight: 1.5 }}>{f.text}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ABOUT */}
      <div style={{ background: "white", padding: "60px 40px", borderTop: "1px solid #e0e0e0" }}>
        <div style={{ maxWidth: 800, margin: "0 auto", textAlign: "center" }}>
          <div style={{ fontSize: 22, fontWeight: "bold", color: "#0f2a52", marginBottom: 16 }}>About CIHE</div>
          <div style={{ fontSize: 14, color: "#555", lineHeight: 1.7 }}>
            Crown Institute of Higher Education is committed to delivering quality, industry-relevant education
            across Business, Information Technology, and Health disciplines, supported by a connected student portal
            and AI-powered helpdesk.
          </div>
        </div>
      </div>

      {/* FOOTER */}
      <div style={{ background: "#e8a020", padding: "24px 40px", color: "#0f2a52" }}>
        <div style={{ display: "flex", gap: 24, fontSize: 13, fontWeight: "bold", marginBottom: 10, flexWrap: "wrap" }}>
          <span>🔖 https://www.cihe.edu.au</span>
          <span>✉️ info@cihe.edu.au</span>
          <span>📱 1300 171 094</span>
        </div>
        <div style={{ fontSize: 13, fontWeight: "bold" }}>© 2018–2026 CIHE Australia</div>
      </div>

      {/* LOGIN MODAL */}
      {showModal && (
        <div
          onClick={() => setShowModal(false)}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50 }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{ background: "white", padding: 40, borderRadius: 10, boxShadow: "0 10px 40px rgba(0,0,0,0.25)", width: 380, textAlign: "center", position: "relative" }}
          >
            <button
              onClick={() => setShowModal(false)}
              style={{ position: "absolute", top: 14, right: 16, background: "none", border: "none", fontSize: 18, cursor: "pointer", color: "#999" }}
            >
              ✕
            </button>

            <div style={{ background: "#0f2a52", color: "white", fontSize: 20, fontWeight: "bold", padding: 15, borderRadius: 8, marginBottom: 10, display: "inline-block", width: 70 }}>
              CIHE
            </div>
            <h2 style={{ color: "#0f2a52", marginBottom: 5 }}>{loginType === "admin" ? "Admin Login" : "Student Login"}</h2>
            <p style={{ color: "#888", fontSize: 13, marginBottom: 25 }}>
              {loginType === "admin" ? "Sign in to manage units and students" : "Sign in to access your student portal"}
            </p>

            <div style={{ display: "flex", justifyContent: "center", gap: 8, marginBottom: 20 }}>
              <button
                onClick={() => { setLoginType("student"); setStudentStep("email"); setError(""); setPassword(""); setConfirmPassword(""); }}
                style={{ padding: "6px 14px", borderRadius: 20, border: "1px solid #0f2a52", background: loginType === "student" ? "#0f2a52" : "white", color: loginType === "student" ? "white" : "#0f2a52", fontSize: 12, fontWeight: "bold", cursor: "pointer" }}
              >
                Student
              </button>
              <button
                onClick={() => { setLoginType("admin"); setError(""); setPassword(""); }}
                style={{ padding: "6px 14px", borderRadius: 20, border: "1px solid #0f2a52", background: loginType === "admin" ? "#0f2a52" : "white", color: loginType === "admin" ? "white" : "#0f2a52", fontSize: 12, fontWeight: "bold", cursor: "pointer" }}
              >
                Admin
              </button>
            </div>

            <label style={{ display: "block", textAlign: "left", fontSize: 13, fontWeight: "bold", marginBottom: 5 }}>Email</label>
            <input
              type="email"
              placeholder={loginType === "admin" ? "admin@cihe.edu.au" : "student@cihe.edu.au"}
              value={email}
              onChange={e => setEmail(e.target.value)}
              disabled={loginType === "student" && studentStep !== "email"}
              onKeyDown={e => e.key === "Enter" && loginType === "student" && studentStep === "email" && handleLogin()}
              style={{ width: "100%", padding: 11, marginBottom: 18, border: "1px solid #ccc", borderRadius: 6, fontSize: 14, boxSizing: "border-box", background: (loginType === "student" && studentStep !== "email") ? "#f5f5f5" : "white" }}
            />

            {(loginType === "admin" || studentStep !== "email") && (
              <>
                <label style={{ display: "block", textAlign: "left", fontSize: 13, fontWeight: "bold", marginBottom: 5 }}>
                  {studentStep === "setPassword" ? "Create Password" : "Password"}
                </label>
                <input
                  type="password"
                  placeholder={studentStep === "setPassword" ? "Choose a password (min 6 characters)" : "Enter your password"}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && studentStep !== "setPassword" && handleLogin()}
                  style={{ width: "100%", padding: 11, marginBottom: 18, border: "1px solid #ccc", borderRadius: 6, fontSize: 14, boxSizing: "border-box" }}
                />
              </>
            )}

            {studentStep === "setPassword" && (
              <>
                <label style={{ display: "block", textAlign: "left", fontSize: 13, fontWeight: "bold", marginBottom: 5 }}>Confirm Password</label>
                <input
                  type="password"
                  placeholder="Re-enter your password"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleLogin()}
                  style={{ width: "100%", padding: 11, marginBottom: 18, border: "1px solid #ccc", borderRadius: 6, fontSize: 14, boxSizing: "border-box" }}
                />
              </>
            )}

            {studentStep === "setPassword" && (
              <p style={{ fontSize: 12, color: "#e8a020", marginBottom: 12 }}>
                First time signing in — please create a password for your account.
              </p>
            )}

            {error && <p style={{ color: "#dc3545", fontSize: 13, marginBottom: 12 }}>{error}</p>}

            <button onClick={handleLogin} style={{ width: "100%", padding: 12, background: "#0f2a52", color: "white", fontSize: 15, fontWeight: "bold", border: "none", borderRadius: 6, cursor: "pointer" }}>
              {loginType === "admin" ? "Sign In" : studentStep === "email" ? "Continue" : studentStep === "setPassword" ? "Create Password & Sign In" : "Sign In"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default Login;