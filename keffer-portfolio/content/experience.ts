// The Experience section's six entries (ExperienceSection.tsx): roles and
// research, then the organisations beyond the work. Roles and dates come from
// the 2026 résumé; where it gives none, the field is left out rather than
// guessed. The three roles also have case files (content/projects.ts).

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
  /** The full description, as on the site today. */
  detail: string;
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
    id: "blockd",
    org: "Blockd",
    mark: "Blockd",
    kind: "work",
    line: "An interview-integrity platform: a locked-down Chromium browser with eye tracking, AI-answer detection and live security monitoring.",
    detail:
      "Blockd is an enterprise-grade interview security platform that combines a custom Chromium browser with AI-powered anti-cheating detection to preserve the integrity of remote interviews. Real-time monitoring includes eye tracking via MediaPipe, multi-LLM answer analysis, mode-collapse screening, screen-recording and VM detection, and window-focus tracking. Interviewers get a React dashboard with security events, gaze heatmaps, AI-detection confidence and live video, on eight backend services with WebRTC, WebSockets and Kubernetes-ready infrastructure.",
    tags: ["Chromium", "MediaPipe", "WebRTC", "Microservices", "React", "Kubernetes"],
    url: "https://www.linkedin.com/company/blockdcompany/",
    host: "linkedin",
    logo: withBase("/assets/logos/blockd.png"),
    caseFile: "/work/blockd",
  },
  {
    id: "eel",
    org: "Experimental Engineering Lab",
    mark: "EEL",
    role: "Undergraduate Researcher",
    when: "Fall 2025 – present",
    kind: "work",
    line: "Design and maintain the lab's website, deployed to Red Hat OpenShift through CI/CD, and rewrote the control software for a 10,000-gallon wave maker.",
    detail:
      "The Experimental Engineering Lab (EEL) is an undergraduate research lab at UNC dedicated to hands-on engineering projects and interdisciplinary collaboration. I design, develop and maintain the site and manage its deployment on Red Hat OpenShift through an automated CI/CD pipeline.",
    tags: ["Web Development", "OpenShift", "CI/CD"],
    url: "https://eel.unc.edu",
    host: "eel.unc.edu",
    logo: withBase("/assets/logos/eel.jpg"),
    caseFile: "/work/eel",
  },
  {
    id: "duke",
    org: "Duke University, Dept. of Anesthesiology",
    mark: "Duke",
    role: "Research Intern",
    when: "Summer 2023",
    kind: "work",
    line: "Reviewed clinical studies and modeled perioperative sleep outcomes in a meta-analysis with Duke anesthesiologists.",
    detail:
      "Conducted a meta-analysis with anesthesiologists on the effects of anesthesia on perioperative sleep outcomes, applying statistical modeling and systematic review methods across clinical studies.",
    tags: ["Meta-Analysis", "Statistical Modeling", "Clinical Research"],
    caseFile: "/work/duke",
  },
  {
    id: "nscc",
    org: "Natural Sciences Computing Club",
    mark: "NSCC",
    role: "President & Founder",
    when: "Fall 2024 – present",
    kind: "org",
    line: "Lead interdisciplinary teams building proton-therapy Bragg peak and quantum-tunneling simulations.",
    detail:
      "NSCC bridges the gap between traditional science education and the computational skills modern research needs. We build computational models for natural-sciences research and a community where scientists use code confidently to advance their fields.",
    tags: [],
    url: "https://www.nsccatunc.org/",
    host: "nsccatunc.org",
  },
  {
    id: "unc-sg",
    org: "UNC Student Government",
    mark: "Student Gov",
    role: "Head of Web Development",
    kind: "org",
    line: "Rebuilt the Executive Branch website from scratch, off WordPress onto Red Hat OpenShift, and run its DNS, TLS and deployment.",
    detail:
      "Rebuilt the Executive Branch website from scratch, migrating off WordPress to a custom application on Red Hat OpenShift, and manage the full deployment pipeline including DNS, SSL/TLS and cloud infrastructure.",
    tags: [],
    url: "https://executivebranch.unc.edu/",
    host: "executivebranch.unc.edu",
  },
  {
    id: "urc",
    org: "Undergraduate Research Conference at UNC",
    mark: "URC",
    role: "Director of Technology",
    kind: "org",
    line: "Designed the logo, built the website and run the digital presence for a one-day research showcase in the Great Hall.",
    detail:
      "Designed the conference logo, built the event website, and manage the conference's full digital presence: the primary platform for applicant outreach, event information and sponsor engagement for a one-day research showcase in the Campus Union's Great Hall.",
    tags: [],
    url: "https://uncurc.com/",
    host: "uncurc.com",
  },
];
