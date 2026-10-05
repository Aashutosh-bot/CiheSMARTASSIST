"""Input guards for the RAG pipeline (ICT306 requirements I1, I4, C4).

Pure-Python on purpose (no ML dependencies) so it can be unit-tested quickly.
"""
import re
import unicodedata

MAX_QUESTION_LEN = 500

# Characters that are invisible or used to smuggle instructions past filters.
_CONTROL_RE = re.compile(r"[\u0000-\u0008\u000b-\u001f\u007f\u200b-\u200f\u202a-\u202e\u2060-\u2064\ufeff]")

_INJECTION_PATTERNS = [
    r"ignore\s+(all\s+|any\s+|the\s+)?(previous|prior|above|earlier)\s+(instructions?|rules?|prompts?|context)",
    r"disregard\s+.{0,40}(instructions?|rules?|prompt)",
    r"forget\s+(all\s+|everything\s+)?(you|your|the)\s+(were\s+)?(told|instructions?|rules?)",
    r"(reveal|show|print|repeat|display|output|leak)\s+.{0,40}(system\s+prompt|hidden\s+prompt|instructions|your\s+prompt)",
    r"\byou\s+are\s+now\b",
    r"\bact\s+as\s+(an?\s+)?(dan|admin|administrator|root|developer|system)\b",
    r"\b(jailbreak|developer\s+mode|dan\s+mode)\b",
    r"</?\s*(system|assistant|context|instructions?)\s*>",
    r"\[\s*/?\s*(system|inst)\s*\]",
    r"\b(override|bypass)\s+.{0,30}(safety|filter|rules?|restrictions?)",
]
_INJECTION_RE = re.compile("|".join(f"(?:{p})" for p in _INJECTION_PATTERNS), re.IGNORECASE | re.DOTALL)


def sanitize(text: str) -> str:
    """Normalise unicode, strip control/zero-width characters, collapse whitespace, cap length."""
    text = unicodedata.normalize("NFKC", text or "")
    text = _CONTROL_RE.sub("", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text[:MAX_QUESTION_LEN]


def looks_like_injection(text: str) -> bool:
    return bool(_INJECTION_RE.search(sanitize(text) if len(text) < 5000 else text[:5000]))


# --- C4: role-aware retrieval -------------------------------------------------
# Sources whose identifier starts with "staff::" are only retrievable by staff.
STAFF_PREFIX = "staff::"
STAFF_ROLES = {"admin", "lecturer"}


def source_allowed(source: str, role: str) -> bool:
    if (source or "").startswith(STAFF_PREFIX):
        return role in STAFF_ROLES
    return True


def filter_by_role(candidates, role):
    """Drop any retrieved chunk the caller's role may not see (fail closed: unknown role = student)."""
    return [c for c in candidates if source_allowed(c.get("source", ""), role)]
