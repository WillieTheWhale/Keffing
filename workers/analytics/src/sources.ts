// Where a visit came from: a UTM tag if the link had one, else the referring
// site, named when it's one people know, else "Direct". In-app browsers
// (LinkedIn, Instagram) usually send no referrer, so their UA stands in.

const NAMED: [RegExp, string][] = [
  [/(^|\.)linkedin\.com$|^lnkd\.in$/, "LinkedIn"],
  [/^gemini\.google\.com$|^bard\.google\.com$/, "Gemini"],
  [/^mail\.google\.com$/, "Gmail"],
  [/(^|\.)google\.[a-z.]+$/, "Google"],
  [/(^|\.)bing\.com$/, "Bing"],
  [/(^|\.)duckduckgo\.com$/, "DuckDuckGo"],
  [/(^|\.)yahoo\.[a-z.]+$/, "Yahoo"],
  [/(^|\.)yandex\.[a-z.]+$/, "Yandex"],
  [/(^|\.)baidu\.com$/, "Baidu"],
  [/(^|\.)ecosia\.org$/, "Ecosia"],
  [/^search\.brave\.com$/, "Brave Search"],
  [/(^|\.)kagi\.com$/, "Kagi"],
  [/(^|\.)perplexity\.ai$/, "Perplexity"],
  [/^chatgpt\.com$|^chat\.openai\.com$/, "ChatGPT"],
  [/^claude\.ai$/, "Claude"],
  [/^copilot\.microsoft\.com$/, "Copilot"],
  [/^t\.co$|(^|\.)twitter\.com$|(^|\.)x\.com$/, "X"],
  [/(^|\.)facebook\.com$|^fb\.me$/, "Facebook"],
  [/(^|\.)instagram\.com$/, "Instagram"],
  [/(^|\.)threads\.(net|com)$/, "Threads"],
  [/(^|\.)bsky\.app$/, "Bluesky"],
  [/(^|\.)reddit\.com$/, "Reddit"],
  [/^news\.ycombinator\.com$/, "Hacker News"],
  [/(^|\.)github\.com$|(^|\.)github\.io$/, "GitHub"],
  [/(^|\.)youtube\.com$|^youtu\.be$/, "YouTube"],
  [/(^|\.)tiktok\.com$/, "TikTok"],
  [/(^|\.)discord(app)?\.com$/, "Discord"],
  [/(^|\.)slack\.com$/, "Slack"],
  [/^outlook\.(live|office|office365)\.com$/, "Outlook"],
  [/(^|\.)handshake(app)?\.com$|(^|\.)joinhandshake\.com$/, "Handshake"],
  [/(^|\.)unc\.edu$/, "UNC"],
];

const APPS: [RegExp, string][] = [
  [/LinkedInApp/, "LinkedIn"],
  [/Instagram/, "Instagram"],
  [/FBAN|FBAV|FB_IAB/, "Facebook"],
  [/Snapchat/, "Snapchat"],
  [/musical_ly|BytedanceWebview|TikTok/, "TikTok"],
  [/Twitter/, "X"],
];

const UTM_NAMES: Record<string, string> = {
  linkedin: "LinkedIn", li: "LinkedIn", instagram: "Instagram", ig: "Instagram", twitter: "X", x: "X",
  facebook: "Facebook", fb: "Facebook", github: "GitHub", resume: "Resume", cv: "Resume", email: "Email",
  newsletter: "Email", qr: "QR code", handshake: "Handshake", google: "Google", reddit: "Reddit",
};

export function referrerHost(referrer: string): string {
  try {
    return new URL(referrer).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
}

/** The visit's source; null when the referrer is the site itself (not an entry). */
export function classify(refHost: string, siteHosts: string[], utmSource: string, ua: string): string | null {
  if (utmSource) return UTM_NAMES[utmSource.toLowerCase()] ?? utmSource;
  if (refHost && siteHosts.includes(refHost)) return null;
  if (refHost) {
    for (const [re, name] of NAMED) if (re.test(refHost)) return name;
    return refHost;
  }
  for (const [re, name] of APPS) if (re.test(ua)) return name;
  return "Direct";
}
