// Language metadata for the course-translation Edition picker + reader.
//
// A plain data module (no Convex functions) imported by BOTH the backend
// (translate prompt: the target language's English name) and the client (the
// searchable picker + the reader's dir/lang for a chosen Edition). `LANGUAGES`
// is the picker's menu; the mechanism underneath accepts any BCP-47 `code`, so
// `langInfo` falls back gracefully (name → the code, rtl → the RTL-script set)
// for a code not listed here. Extend `LANGUAGES` to grow the menu — no other
// change is needed.

export type LanguageInfo = {
  code: string; // BCP-47 primary subtag, e.g. "es", "ur", "pt-BR"
  name: string; // English name, used in the translate prompt
  native: string; // endonym, shown in the picker + switcher
  rtl?: boolean;
};

// BCP-47 subtags whose script is right-to-left. `isRtl` consults this, so even
// an unlisted RTL language renders correctly if its base subtag is here.
const RTL_CODES = new Set([
  "ar",
  "he",
  "fa",
  "ur",
  "ps",
  "sd",
  "ug",
  "yi",
  "dv",
  "ckb",
  "ku",
]);

// The picker menu: a broad set covering the world's major languages plus every
// common RTL one. Not exhaustive by design — any code still works via langInfo.
export const LANGUAGES: LanguageInfo[] = [
  { code: "es", name: "Spanish", native: "Español" },
  { code: "fr", name: "French", native: "Français" },
  { code: "hi", name: "Hindi", native: "हिन्दी" },
  { code: "ur", name: "Urdu", native: "اردو", rtl: true },
  { code: "ar", name: "Arabic", native: "العربية", rtl: true },
  { code: "he", name: "Hebrew", native: "עברית", rtl: true },
  { code: "fa", name: "Persian", native: "فارسی", rtl: true },
  { code: "ps", name: "Pashto", native: "پښتو", rtl: true },
  { code: "sd", name: "Sindhi", native: "سنڌي", rtl: true },
  { code: "ug", name: "Uyghur", native: "ئۇيغۇرچە", rtl: true },
  { code: "yi", name: "Yiddish", native: "ייִדיש", rtl: true },
  { code: "dv", name: "Dhivehi", native: "ދިވެހި", rtl: true },
  { code: "ckb", name: "Kurdish (Sorani)", native: "کوردیی ناوەندی", rtl: true },
  { code: "pt", name: "Portuguese", native: "Português" },
  { code: "de", name: "German", native: "Deutsch" },
  { code: "it", name: "Italian", native: "Italiano" },
  { code: "nl", name: "Dutch", native: "Nederlands" },
  { code: "pl", name: "Polish", native: "Polski" },
  { code: "ru", name: "Russian", native: "Русский" },
  { code: "uk", name: "Ukrainian", native: "Українська" },
  { code: "cs", name: "Czech", native: "Čeština" },
  { code: "sv", name: "Swedish", native: "Svenska" },
  { code: "no", name: "Norwegian", native: "Norsk" },
  { code: "da", name: "Danish", native: "Dansk" },
  { code: "fi", name: "Finnish", native: "Suomi" },
  { code: "el", name: "Greek", native: "Ελληνικά" },
  { code: "tr", name: "Turkish", native: "Türkçe" },
  { code: "ro", name: "Romanian", native: "Română" },
  { code: "hu", name: "Hungarian", native: "Magyar" },
  { code: "bg", name: "Bulgarian", native: "Български" },
  { code: "sr", name: "Serbian", native: "Српски" },
  { code: "hr", name: "Croatian", native: "Hrvatski" },
  { code: "sk", name: "Slovak", native: "Slovenčina" },
  { code: "id", name: "Indonesian", native: "Bahasa Indonesia" },
  { code: "ms", name: "Malay", native: "Bahasa Melayu" },
  { code: "vi", name: "Vietnamese", native: "Tiếng Việt" },
  { code: "th", name: "Thai", native: "ไทย" },
  { code: "ja", name: "Japanese", native: "日本語" },
  { code: "ko", name: "Korean", native: "한국어" },
  { code: "zh", name: "Chinese (Simplified)", native: "简体中文" },
  { code: "zh-Hant", name: "Chinese (Traditional)", native: "繁體中文" },
  { code: "bn", name: "Bengali", native: "বাংলা" },
  { code: "pa", name: "Punjabi", native: "ਪੰਜਾਬੀ" },
  { code: "ta", name: "Tamil", native: "தமிழ்" },
  { code: "te", name: "Telugu", native: "తెలుగు" },
  { code: "mr", name: "Marathi", native: "मराठी" },
  { code: "gu", name: "Gujarati", native: "ગુજરાતી" },
  { code: "kn", name: "Kannada", native: "ಕನ್ನಡ" },
  { code: "ml", name: "Malayalam", native: "മലയാളം" },
  { code: "ne", name: "Nepali", native: "नेपाली" },
  { code: "si", name: "Sinhala", native: "සිංහල" },
  { code: "sw", name: "Swahili", native: "Kiswahili" },
  { code: "am", name: "Amharic", native: "አማርኛ" },
  { code: "tl", name: "Filipino", native: "Filipino" },
];

const BY_CODE = new Map(LANGUAGES.map((l) => [l.code, l]));

// True when a language code's script is right-to-left. Checks the base subtag
// (e.g. "fa-AF" → "fa"), so an unlisted regional RTL variant still resolves.
export function isRtl(code: string): boolean {
  if (!code) return false;
  const base = code.split("-")[0]!.toLowerCase();
  return RTL_CODES.has(code.toLowerCase()) || RTL_CODES.has(base);
}

// Metadata for any code — a listed language, or a graceful fallback for a code
// outside the menu (name = the code, native = the code, rtl from the script set).
export function langInfo(code: string): LanguageInfo {
  return BY_CODE.get(code) ?? { code, name: code, native: code, rtl: isRtl(code) };
}

// The text direction for a language's content/chrome.
export function langDir(code: string): "ltr" | "rtl" {
  return isRtl(code) ? "rtl" : "ltr";
}
