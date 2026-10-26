// Browser, OS and device from the User-Agent (and the low-entropy client
// hints browsers send anyway), plus a crawler test. Order matters: most
// browsers claim to be Chrome and Safari as well as themselves.

export interface Agent {
  browser: string;
  browserVer: string;
  os: string;
  osVer: string;
  device: "desktop" | "mobile" | "tablet";
  bot: boolean;
}

const BOT = /bot\b|bot\/|crawl|spider|slurp|scrape|headless|phantomjs|puppeteer|playwright|selenium|lighthouse|pagespeed|gtmetrix|pingdom|uptime|monitor|preview|facebookexternalhit|embedly|quora link|whatsapp|telegrambot|discordbot|slackbot|vkshare|w3c_validator|curl\/|wget\/|python-|go-http|java\/|okhttp|axios|node-fetch|httpclient|bingpreview|google-inspectiontool|chrome-lighthouse|yandex|baiduspider|duckduckbot|applebot|petalbot|bytespider|gptbot|claudebot|ccbot|perplexitybot|amazonbot|semrush|ahrefs|mj12bot|dotbot/i;

// [name, pattern whose first group is the version]
const BROWSERS: [string, RegExp][] = [
  ["LinkedIn app", /LinkedInApp(?:\/([\d.]+))?/],
  ["Instagram app", /Instagram ([\d.]+)/],
  ["Facebook app", /FB(?:AV|_IAB)\/([\d.]+)/],
  ["Snapchat app", /Snapchat\/([\d.]+)/],
  ["TikTok app", /(?:musical_ly|BytedanceWebview|TikTok)[_/ ]?([\d.]+)?/],
  ["X app", /Twitter(?:Android)?\/([\d.]+)/],
  ["Edge", /Edg(?:e|A|iOS)?\/([\d.]+)/],
  ["Opera", /(?:OPR|OPiOS|Opera)\/([\d.]+)/],
  ["Samsung Internet", /SamsungBrowser\/([\d.]+)/],
  ["Vivaldi", /Vivaldi\/([\d.]+)/],
  ["Yandex", /YaBrowser\/([\d.]+)/],
  ["DuckDuckGo", /(?:DuckDuckGo|Ddg)\/([\d.]+)/],
  ["Arc", /Arc\/([\d.]+)/],
  ["Firefox", /(?:Firefox|FxiOS)\/([\d.]+)/],
  ["Chrome", /(?:Chrome|CriOS)\/([\d.]+)/],
  ["Safari", /Version\/([\d.]+).*Safari\//],
  ["Safari", /AppleWebKit\/[\d.]+ \(KHTML, like Gecko\) Mobile\/\w+$/], // iOS web views
];

function major(v: string | undefined, parts = 1): string {
  return (v ?? "").split(".").slice(0, parts).join(".");
}

export function parseAgent(ua: string, headers: Headers, touchPoints = 0): Agent {
  let browser = "Other";
  let browserVer = "";
  for (const [name, re] of BROWSERS) {
    const m = ua.match(re);
    if (m) { browser = name; browserVer = major(m[1]); break; }
  }
  // Brave and Arc look like Chrome in the UA; the brand list says otherwise
  const brands = headers.get("Sec-CH-UA") ?? "";
  if (browser === "Chrome" && /Brave/.test(brands)) browser = "Brave";

  let os = "Other";
  let osVer = "";
  let m: RegExpMatchArray | null;
  if ((m = ua.match(/iPhone OS (\d+)[_.](\d+)?/)) || (/iPhone/.test(ua) && (m = ua.match(/OS (\d+)_(\d+)?/)))) {
    os = "iOS"; osVer = m[1];
  } else if ((m = ua.match(/iPad.*OS (\d+)/))) {
    os = "iPadOS"; osVer = m[1];
  } else if ((m = ua.match(/Android (\d+)/)) || /Android/.test(ua)) {
    os = "Android"; osVer = m?.[1] ?? "";
  } else if (/CrOS/.test(ua)) {
    os = "ChromeOS";
  } else if ((m = ua.match(/Windows NT ([\d.]+)/))) {
    os = "Windows";
    osVer = { "10.0": "10/11", "6.3": "8.1", "6.2": "8", "6.1": "7" }[m[1]] ?? m[1];
  } else if ((m = ua.match(/Mac OS X (\d+)[_.](\d+)/))) {
    // an iPad asks for desktop sites as a Mac; only touch gives it away
    if (touchPoints > 1) os = "iPadOS";
    else { os = "macOS"; osVer = m[1] === "10" ? `10.${m[2]}` : m[1]; }
  } else if (/Linux|X11/.test(ua)) {
    os = "Linux";
  }

  let device: Agent["device"] = "desktop";
  if (os === "iPadOS" || /Tablet|iPad/.test(ua) || (os === "Android" && !/Mobile/.test(ua))) device = "tablet";
  else if (/Mobi|iPhone|iPod/.test(ua) || headers.get("Sec-CH-UA-Mobile") === "?1") device = "mobile";

  return { browser, browserVer, os, osVer, device, bot: !ua || BOT.test(ua) };
}
