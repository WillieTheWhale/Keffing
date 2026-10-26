// The Experience section's six entries (ExperienceSection.tsx), newest first
// except the wave maker, which sits ahead of Blockchain at Berkeley by choice.
// Roles and dates follow LinkedIn (October 2026); the wave maker's details
// come from its repository (adrhito/wavemaker-f25). Where a source gives no
// field, it is left out rather than guessed. Entries with a case file have
// one on this site (content/projects.ts).

import { withBase } from "@/lib/basePath";

export interface ExperienceEntry {
  id: string;
  /** Full name of the company, lab or organisation. */
  org: string;
  /** A short mark for display-scale type. */
  mark: string;
  role?: string;
  when?: string;
  /** "work" = roles & research; "org" = beyond the work. */
  kind: "work" | "org";
  /** One sentence: what it is / what I did. */
  line: string;
  /** More, when there is more to say than the line. */
  detail?: string;
  tags: string[];
  url?: string;
  /** The url's host, for a typed link. */
  host?: string;
  logo?: string;
  /** A case-study page on this site. */
  caseFile?: string;
}

export const experienceEntries: ExperienceEntry[] = [
  {
    id: "ai-research",
    org: "Artificial Intelligence Research, UNC Chapel Hill",
    mark: "Heelcode",
    role: "Artificial Intelligence Researcher",
    when: "Sep 2026 – present",
    kind: "work",
    line: "Building a custom agent harness for undergraduate CS classrooms with Dr. Prasun Dewan.",
    detail:
      "Heelcode is a fork of OpenCode wired to UNC's PromptLab: a local coding-agent harness whose model traffic runs through a secure, OpenAI-compatible daemon and the student's own authenticated browser session.",
    tags: ["TypeScript", "Agent Tooling", "PromptLab", "OpenAI Compatible"],
    url: "https://github.com/WillieTheWhale/heelcode",
    host: "github",
    caseFile: "/work/heelcode",
  },
  {
    id: "caia",
    org: "Carolina AI Alignment",
    mark: "AI Safety",
    role: "AI Safety Fellow",
    when: "Aug 2026 – present",
    kind: "org",
    line: "A fellowship on alignment and governance in AI safety, with UNC's student community working to reduce catastrophic AI risk.",
    tags: [],
  },
  {
    id: "eel",
    org: "Experimental Engineering Lab and the Joint Fluids Lab",
    mark: "WaveMaker",
    role: "Undergraduate Student Researcher",
    when: "Nov 2025 – present",
    kind: "work",
    line: "Write and maintain the software that runs the fluid dynamics lab's 13,500-gallon wave maker.",
    detail:
      "Thirty LinMot pistons in three rows of ten, driven by an Allen-Bradley ControlLogix PLC. Operators pick pistons on a drawing of the tank, set stroke and speed, and run waves, saved presets or single soliton pulses. It comes with a simulated wave maker for learning away from the tank, a command-line driver for scripted runs, and a camera module that measures the water through the tank wall.",
    tags: ["Python", "Tkinter", "PLC", "EtherNet/IP", "OpenCV"],
    url: "https://github.com/adrhito/wavemaker-f25",
    host: "github",
    logo: withBase("/assets/logos/eel.jpg"),
    caseFile: "/work/eel",
  },
  {
    id: "blockchain-berkeley",
    org: "Blockchain at Berkeley",
    mark: "Blockchain",
    role: "Analyst",
    when: "Jun – Aug 2026",
    kind: "org",
    line: "Analyst on the prediction-markets team.",
    tags: [],
    url: "https://blockchain.studentorg.berkeley.edu/",
    host: "blockchain at berkeley",
  },
  {
    id: "nscc",
    org: "Natural Sciences Computing Club",
    mark: "NSCC",
    role: "President & Founder",
    when: "Oct 2025 – present",
    kind: "org",
    line: "Founded and lead UNC's club bridging biology, chemistry and physics with practical computing.",
    detail:
      "Workshops in Python, data science and machine learning, and team builds such as proton-therapy Bragg-peak and quantum-tunneling simulations. I set each semester's priorities and goals, run an officer team across programming, partnerships and communications, build research collaborations and sponsorships, and look after the club's GitHub, website and brand.",
    tags: [],
    url: "https://www.nsccatunc.org/",
    host: "nsccatunc.org",
  },
  {
    id: "duke",
    org: "Duke University, Dept. of Anesthesiology",
    mark: "Duke",
    role: "Research Assistant",
    when: "Feb – Jul 2023",
    kind: "work",
    line: "Reviewed clinical studies and modeled perioperative sleep outcomes in a meta-analysis with Duke anesthesiologists.",
    detail:
      "Applied statistical modeling and systematic-review methods across clinical studies of how anesthesia affects sleep around surgery, and learned to synthesize data and communicate findings across disciplines.",
    tags: ["Meta-Analysis", "Statistical Modeling", "Clinical Research"],
    caseFile: "/work/duke",
  },
];
