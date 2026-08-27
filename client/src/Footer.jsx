const linkStyle = {
  color: "#cbd5e1",
  fontSize: 13,
  textDecoration: "none",
};

const headingStyle = {
  color: "white",
  fontSize: 13,
  fontWeight: "bold",
  letterSpacing: 0.5,
  marginBottom: 14,
};

const underlineStyle = {
  width: 26,
  height: 2,
  background: "#3b6fd4",
  marginTop: 6,
  marginBottom: 16,
};

function FooterColumn({ title, links }) {
  return (
    <div style={{ minWidth: 140 }}>
      <div style={headingStyle}>
        {title}
        <div style={underlineStyle} />
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {links.map((label) => (
          <a key={label} href="#" style={linkStyle}>
            {label}
          </a>
        ))}
      </div>
    </div>
  );
}

function SocialIcon({ children }) {
  return (
    <a
      href="#"
      style={{
        width: 34,
        height: 34,
        borderRadius: "50%",
        border: "1px solid #4a6fa5",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "white",
      }}
    >
      {children}
    </a>
  );
}

function ContactRow({ icon, children }) {
  return (
    <div style={{ display: "flex", gap: 12, alignItems: "flex-start", marginBottom: 16 }}>
      <div style={{ color: "#cbd5e1", marginTop: 2 }}>{icon}</div>
      <div style={{ color: "white", fontSize: 13, lineHeight: 1.5 }}>{children}</div>
    </div>
  );
}

export default function Footer() {
  return (
    <div style={{ background: "#0a1a33", padding: "48px 40px 0", color: "white", fontFamily: "Arial, sans-serif" }}>
      <div
        style={{
          maxWidth: 1200,
          margin: "0 auto",
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: 32,
          paddingBottom: 32,
        }}
      >
        {/* BRAND */}
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
            <div
              style={{
                width: 46,
                height: 46,
                borderRadius: "50%",
                border: "2px solid #e8a020",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#e8a020",
                fontSize: 18,
              }}
            >
              👑
            </div>
            <div>
              <div style={{ fontSize: 20, fontWeight: "bold", letterSpacing: 1 }}>CIHE</div>
              <div style={{ fontSize: 11, color: "#cbd5e1", lineHeight: 1.3 }}>
                Crown Institute
                <br />
                of Higher Education
              </div>
            </div>
          </div>
          <div style={{ fontSize: 13, color: "#cbd5e1", lineHeight: 1.7, marginBottom: 20, maxWidth: 260 }}>
            CIHE is dedicated to providing quality education and student support to help you achieve
            your academic and career goals.
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <SocialIcon>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
                <path d="M22 12.06C22 6.5 17.52 2 12 2S2 6.5 2 12.06c0 5 3.66 9.15 8.44 9.94v-7.03H7.9v-2.9h2.54V9.85c0-2.5 1.49-3.9 3.77-3.9 1.09 0 2.24.2 2.24.2v2.46h-1.26c-1.24 0-1.63.77-1.63 1.56v1.88h2.78l-.44 2.9h-2.34V22c4.78-.8 8.44-4.95 8.44-9.94Z" />
              </svg>
            </SocialIcon>
            <SocialIcon>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <rect x="3" y="3" width="18" height="18" rx="5" />
                <circle cx="12" cy="12" r="4" />
                <circle cx="17.2" cy="6.8" r="1" fill="currentColor" stroke="none" />
              </svg>
            </SocialIcon>
            <SocialIcon>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
                <path d="M6.94 6.5a2.44 2.44 0 1 1 0-4.88 2.44 2.44 0 0 1 0 4.88ZM2.4 21.5V8.75h4.9V21.5H2.4ZM10.5 8.75h4.7v1.74h.07c.66-1.2 2.26-2.47 4.65-2.47 4.97 0 5.88 3.16 5.88 7.27v6.71h-4.9v-5.95c0-1.42-.03-3.25-2.02-3.25-2.02 0-2.33 1.53-2.33 3.14v6.06h-4.9V8.75Z" />
              </svg>
            </SocialIcon>
            <SocialIcon>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
                <path d="M22.5 6.5s-.2-1.6-.85-2.3c-.8-.86-1.7-.87-2.12-.92C16.6 3 12 3 12 3h-.01s-4.6 0-7.53.28c-.42.05-1.32.06-2.12.92C1.7 4.9 1.5 6.5 1.5 6.5S1.25 8.4 1.25 10.3v1.4c0 1.9.25 3.8.25 3.8s.2 1.6.85 2.3c.8.86 1.86.83 2.33.92 1.7.17 7.3.28 7.3.28s4.6-.01 7.53-.28c.42-.05 1.32-.06 2.12-.92.65-.7.85-2.3.85-2.3s.25-1.9.25-3.8v-1.4c0-1.9-.25-3.8-.25-3.8ZM9.75 14.4V8.6l5.75 2.9-5.75 2.9Z" />
              </svg>
            </SocialIcon>
          </div>
        </div>

        <FooterColumn
          title="QUICK LINKS"
          links={["My Courses", "Timetable", "Assessments", "Student Support", "Contact Us"]}
        />
        <FooterColumn
          title="STUDENT RESOURCES"
          links={["Help Centre", "Academic Calendar", "Student Handbook", "Policies & Procedures", "IT Support"]}
        />

        {/* CONTACT */}
        <div>
          <div style={headingStyle}>
            CONTACT US
            <div style={underlineStyle} />
          </div>
          <ContactRow
            icon={
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M12 22s7-6.1 7-12a7 7 0 1 0-14 0c0 5.9 7 12 7 12Z" />
                <circle cx="12" cy="10" r="2.5" />
              </svg>
            }
          >
            Level 5, Miller St,
            <br />
            North Sydney NSW 2060
          </ContactRow>
          <ContactRow
            icon={
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M3 5c0-1.1.9-2 2-2h2.2c.5 0 .95.35 1.08.85l1 3.8a1.1 1.1 0 0 1-.3 1.1L7.2 10.5a15 15 0 0 0 6.3 6.3l1.75-1.78a1.1 1.1 0 0 1 1.1-.3l3.8 1a1.1 1.1 0 0 1 .85 1.08V19c0 1.1-.9 2-2 2h-1C9.6 21 3 14.4 3 6V5Z" />
              </svg>
            }
          >
            +61 2 0700 1234
          </ContactRow>
          <ContactRow
            icon={
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <rect x="3" y="5" width="18" height="14" rx="2" />
                <path d="m4 6.5 8 6 8-6" />
              </svg>
            }
          >
            info@cihe.edu.au
          </ContactRow>
        </div>
      </div>

      <div style={{ borderTop: "1px solid rgba(255,255,255,0.15)" }}>
        <div
          style={{
            maxWidth: 1200,
            margin: "0 auto",
            padding: "20px 0",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 12,
            fontSize: 12,
            color: "#cbd5e1",
          }}
        >
          <div>© 2026 Crown Institute of Higher Education. All rights reserved.</div>
          <div style={{ display: "flex", gap: 10 }}>
            <a href="#" style={linkStyle}>Privacy Policy</a>
            <span>|</span>
            <a href="#" style={linkStyle}>Terms & Conditions</a>
          </div>
        </div>
      </div>
    </div>
  );
}
