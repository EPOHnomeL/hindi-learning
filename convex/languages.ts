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
  { code: "en", name: "English", native: "English" },
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
  // African languages. South Africa's official languages come first (English is
  // the source Edition; South African Sign Language has no written form to
  // translate prose into, so both are omitted here), then other widely-spoken
  // African languages. English names carry the alternate/anglicised form so the
  // picker's search finds them ("venda", "zulu", "sotho", …).
  { code: "af", name: "Afrikaans", native: "Afrikaans" },
  { code: "zu", name: "Zulu (isiZulu)", native: "isiZulu" },
  { code: "xh", name: "Xhosa (isiXhosa)", native: "isiXhosa" },
  { code: "nso", name: "Northern Sotho (Sepedi)", native: "Sepedi" },
  { code: "st", name: "Southern Sotho (Sesotho)", native: "Sesotho" },
  { code: "tn", name: "Tswana (Setswana)", native: "Setswana" },
  { code: "ts", name: "Tsonga (Xitsonga)", native: "Xitsonga" },
  { code: "ss", name: "Swati (siSwati)", native: "siSwati" },
  { code: "ve", name: "Venda (Tshivenda)", native: "Tshivenḓa" },
  { code: "nr", name: "Southern Ndebele (isiNdebele)", native: "isiNdebele" },
  { code: "sw", name: "Swahili", native: "Kiswahili" },
  { code: "am", name: "Amharic", native: "አማርኛ" },
  { code: "ha", name: "Hausa", native: "Hausa" },
  { code: "yo", name: "Yoruba", native: "Yorùbá" },
  { code: "ig", name: "Igbo", native: "Igbo" },
  { code: "so", name: "Somali", native: "Soomaali" },
  { code: "om", name: "Oromo", native: "Afaan Oromoo" },
  { code: "ti", name: "Tigrinya", native: "ትግርኛ" },
  { code: "rw", name: "Kinyarwanda", native: "Ikinyarwanda" },
  { code: "sn", name: "Shona", native: "chiShona" },
  { code: "ny", name: "Chichewa (Nyanja)", native: "Chichewa" },
  { code: "lg", name: "Luganda", native: "Luganda" },
  { code: "ln", name: "Lingala", native: "Lingála" },
  { code: "mg", name: "Malagasy", native: "Malagasy" },
  { code: "wo", name: "Wolof", native: "Wolof" },
  { code: "bm", name: "Bambara", native: "Bamanankan" },
  { code: "ak", name: "Akan (Twi)", native: "Akan" },
  { code: "tl", name: "Filipino", native: "Filipino" },
  // Romanized (-Latn) Editions: the same language written in Latin letters, for
  // learners who can't read the native script. One entry per non-Latin-script
  // language above; the `-Latn` script subtag keeps the code valid BCP-47 and
  // makes isRtl/isDevanagari treat it as Latin. The English name doubles as the
  // translate-prompt target ("Translate … into ${name}"), so each spells out
  // the romanization it wants; `native` is the plain language name in Latin
  // script, so the picker/switcher reads "Hindi" against the native "हिन्दी".
  { code: "hi-Latn", name: "Romanized Hindi (Latin script)", native: "Hindi" },
  { code: "ur-Latn", name: "Romanized Urdu (Latin script)", native: "Urdu" },
  { code: "ne-Latn", name: "Romanized Nepali (Latin script)", native: "Nepali" },
  { code: "mr-Latn", name: "Romanized Marathi (Latin script)", native: "Marathi" },
  { code: "ar-Latn", name: "Romanized Arabic (Latin script)", native: "Arabic" },
  { code: "fa-Latn", name: "Romanized Persian (Latin script)", native: "Persian" },
  { code: "ps-Latn", name: "Romanized Pashto (Latin script)", native: "Pashto" },
  { code: "sd-Latn", name: "Romanized Sindhi (Latin script)", native: "Sindhi" },
  { code: "ug-Latn", name: "Romanized Uyghur (Latin script)", native: "Uyghur" },
  { code: "ckb-Latn", name: "Romanized Kurdish Sorani (Latin script)", native: "Kurdish (Sorani)" },
  { code: "he-Latn", name: "Romanized Hebrew (Latin script)", native: "Hebrew" },
  { code: "yi-Latn", name: "Romanized Yiddish (Latin script)", native: "Yiddish" },
  { code: "dv-Latn", name: "Romanized Dhivehi (Latin script)", native: "Dhivehi" },
  { code: "ru-Latn", name: "Romanized Russian (Latin script)", native: "Russian" },
  { code: "uk-Latn", name: "Romanized Ukrainian (Latin script)", native: "Ukrainian" },
  { code: "bg-Latn", name: "Romanized Bulgarian (Latin script)", native: "Bulgarian" },
  { code: "sr-Latn", name: "Serbian (Latin script)", native: "Serbian" },
  { code: "el-Latn", name: "Romanized Greek (Latin script)", native: "Greek" },
  { code: "zh-Latn", name: "Romanized Chinese (Hanyu Pinyin)", native: "Chinese" },
  { code: "ja-Latn", name: "Romanized Japanese (Rōmaji)", native: "Japanese" },
  { code: "ko-Latn", name: "Romanized Korean (Revised Romanization)", native: "Korean" },
  { code: "th-Latn", name: "Romanized Thai (Latin script)", native: "Thai" },
  { code: "bn-Latn", name: "Romanized Bengali (Latin script)", native: "Bengali" },
  { code: "pa-Latn", name: "Romanized Punjabi (Latin script)", native: "Punjabi" },
  { code: "ta-Latn", name: "Romanized Tamil (Latin script)", native: "Tamil" },
  { code: "te-Latn", name: "Romanized Telugu (Latin script)", native: "Telugu" },
  { code: "gu-Latn", name: "Romanized Gujarati (Latin script)", native: "Gujarati" },
  { code: "kn-Latn", name: "Romanized Kannada (Latin script)", native: "Kannada" },
  { code: "ml-Latn", name: "Romanized Malayalam (Latin script)", native: "Malayalam" },
  { code: "si-Latn", name: "Romanized Sinhala (Latin script)", native: "Sinhala" },
  { code: "am-Latn", name: "Romanized Amharic (Latin script)", native: "Amharic" },
  { code: "ti-Latn", name: "Romanized Tigrinya (Latin script)", native: "Tigrinya" },
];

const BY_CODE = new Map(LANGUAGES.map((l) => [l.code, l]));

// True when `code` is one of the offered languages (the picker menu). The
// translation mutations gate on this so an owner can only create an Edition for
// a known ISO/BCP-47 code — which caps fan-out cost (a bounded set of target
// languages, no arbitrary junk codes billed to the Claude key) and keeps the
// code safe to reflect into reader markup (`lang="…"`). The reader still renders
// any stored code via `langInfo`'s graceful fallback; this only gates creation.
export function isKnownLang(code: string): boolean {
  return BY_CODE.has(code);
}

// True when the code carries an explicit Latin script subtag (e.g. "ur-Latn").
// That pins the script regardless of the base language's default, so the
// script-derived checks below (RTL, Devanagari) must yield to it.
function hasLatnSubtag(code: string): boolean {
  return code.toLowerCase().split("-").includes("latn");
}

// True when a language code's script is right-to-left. Checks the base subtag
// (e.g. "fa-AF" → "fa"), so an unlisted regional RTL variant still resolves.
// A -Latn code is never RTL: Roman Urdu reads left-to-right.
export function isRtl(code: string): boolean {
  if (!code || hasLatnSubtag(code)) return false;
  const base = code.split("-")[0]!.toLowerCase();
  return RTL_CODES.has(code.toLowerCase()) || RTL_CODES.has(base);
}

// BCP-47 subtags written in the Devanagari script. The lesson design system's
// body font ('Spectral',Georgia,…) carries no Devanagari glyphs, so a translated
// Edition in one of these renders its prose in a browser-default face sized for
// Latin — small and cramped. `buildSrcDoc` consults this to serve those Editions
// in the Noto Devanagari webfont the taught content already uses (course-
// translation). Extend as more Devanagari languages join the picker.
const DEVANAGARI_CODES = new Set(["hi", "mr", "ne", "sa"]);

// True when a language code's script is Devanagari. Checks the base subtag
// (e.g. "hi-IN" → "hi"), mirroring isRtl, so a regional variant still resolves.
// A -Latn code isn't Devanagari — Roman Hindi keeps the default Latin fonts.
export function isDevanagari(code: string): boolean {
  if (!code || hasLatnSubtag(code)) return false;
  const base = code.split("-")[0]!.toLowerCase();
  return DEVANAGARI_CODES.has(code.toLowerCase()) || DEVANAGARI_CODES.has(base);
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
