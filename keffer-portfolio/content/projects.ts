import { withBase } from "@/lib/basePath";
// Project & Experience Data

export interface Project {
  id: string;
  title: string;
  description: string;
  tags: string[];
  url?: string;
  github?: string;
  image?: string;
  coverImage?: string;
  coverImageAlt?: string;
  sceneHints: {
    burstDirection: number;
    accentDensity: number;
    skyFragmentCount: number;
  };
}

export const experience: Project[] = [
  {
    id: "eel",
    title: "Experimental Engineering Lab",
    description:
      "Control software for the fluid dynamics lab's 13,500-gallon wave maker, built with the Experimental Engineering Lab and the Joint Fluids Lab at UNC. Thirty LinMot pistons in three rows of ten are driven by an Allen-Bradley ControlLogix PLC: operators pick pistons on a drawing of the tank, set stroke and speed, and run waves, saved presets or single soliton pulses. It comes with a simulated wave maker for learning away from the tank, a command-line driver for scripted runs, and a camera module that measures the water through the tank wall. I also design and maintain the lab's website, deployed to Red Hat OpenShift through CI/CD.",
    tags: ["Python", "Tkinter", "PLC", "EtherNet/IP", "OpenCV", "OpenShift"],
    url: "https://eel.unc.edu",
    github: "https://github.com/adrhito/wavemaker-f25",
    image: withBase("/assets/logos/eel.jpg"),
    sceneHints: {
      burstDirection: 45,
      accentDensity: 0.15,
      skyFragmentCount: 2,
    },
  },
  {
    id: "duke",
    title: "Duke University, Dept. of Anesthesiology",
    description:
      "Conducted a meta-analysis with anesthesiologists on the effects of anesthesia on perioperative sleep outcomes, applying statistical modeling and systematic review methods across clinical studies. Gained experience in data synthesis, cross-disciplinary collaboration, and clear communication of research findings.",
    tags: ["Meta-Analysis", "Statistical Modeling", "Clinical Research"],
    sceneHints: {
      burstDirection: 90,
      accentDensity: 0.25,
      skyFragmentCount: 4,
    },
  },
];

type ProjectCatalogEntry = Omit<Project, "sceneHints">;

/**
 * Primary project inventory imported from the Hermes application workspace.
 * Descriptions stay evidence-based; entries with sparse/private evidence say so
 * explicitly rather than inventing a finished story.
 */
const projectCatalog = [
  {
    id: "argo",
    title: "Argo",
    description:
      "An adversarial robustness research tool focused on the projector layer connecting vision encoders to language models. Argo explores feature divergence, cross-modal misalignment, and visual-token corruption under imperceptible perturbation budgets; its public repository also contains a high-performance WebGL voice-assistant concept.",
    tags: ["Python", "Adversarial ML", "VLM Security", "WebGL"],
    github: "https://github.com/WillieTheWhale/Argo",
  },
  {
    id: "brick-studio",
    title: "Brick Studio",
    description:
      "A desktop app and MCP-style generation system that turns natural-language prompts into complete Roblox games. Google Gemini agents plan, script, validate, preview, and export publish-ready .rbxlx files through an Electron and React workspace backed by TypeScript and Rust.",
    tags: ["TypeScript", "Rust", "Electron", "MCP", "Gemini", "React"],
    github: "https://github.com/WillieTheWhale/Brick_Studio",
    image: withBase("/assets/logos/brick-studio.png"),
  },
  {
    id: "heelcode",
    title: "Heel Code",
    description:
      "A UNC-focused fork of OpenCode that connects student coding workflows to UNC Chapel Hill's PromptLab. It preserves a local coding-agent harness while routing model traffic through a secure local OpenAI-compatible daemon and the user's normal authenticated browser session.",
    tags: ["TypeScript", "Agent Tooling", "PromptLab", "OpenAI Compatible"],
    github: "https://github.com/WillieTheWhale/heelcode",
  },
  {
    id: "bragg-peak",
    title: "Bragg Peak",
    description:
      "Bragg-Peak is a careful research toolkit for understanding the Bragg peak, the point near the end of a proton beam’s path where energy delivery rises sharply. Its physics engine can simulate beams in water and layered materials, while its OpenGATE and Geant4 tools provide a separate high-detail reference for comparison. On top of that foundation, BraggTransporter explores machine learning that can speed up repeated studies without hiding uncertainty or skipping validation. Every experiment preserves its inputs and outputs so a graph can be traced back to the numbers and settings that produced it. The project focuses on repeatable evidence, clear limits, and honest reporting.",
    tags: ["Python", "PyTorch", "Monte Carlo", "OpenGATE", "Geant4"],
    github: "https://github.com/WillieTheWhale/Bragg-Peak",
    coverImage: withBase("/assets/projects/bragg-peak.jpg"),
    coverImageAlt:
      "Proton-therapy treatment apparatus with alignment lasers over a head immobilization mask",
  },
  {
    id: "aperture",
    title: "Aperture",
    description:
      "A satellite-economic machine-learning pipeline for real-estate investment intelligence built at Carolina Data Challenge 2025. It combines NASA HLS imagery, computer-vision construction detection, public economic indicators, PyTorch/XGBoost ensembles, AWS infrastructure, Dask, PostGIS, and S3.",
    tags: ["PyTorch", "XGBoost", "AWS", "Computer Vision", "PostGIS"],
    github: "https://github.com/WillieTheWhale/real-estate-ml-dashboard",
  },
  {
    id: "blockd",
    title: "Blockd",
    description:
      "An interview-integrity platform combining a locked-down Chromium browser, AI-answer detection, eye tracking, live video, and security monitoring to make remote technical interviews harder to fake.",
    tags: ["TypeScript", "Python", "PyTorch", "Chromium", "Docker"],
    github: "https://github.com/WillieTheWhale/Blockd",
    url: "https://www.linkedin.com/company/blockdcompany/",
    image: withBase("/assets/logos/blockd.png"),
  },
  {
    id: "llm-image-prompt-injection",
    title: "LLM Image Prompt Injection",
    description:
      "A cybersecurity proof of concept studying how LLM-based image-processing tools can be manipulated through prompt injection and misleading visual content.",
    tags: ["Python", "TypeScript", "Security Research", "Docker", "Redis"],
    github: "https://github.com/WillieTheWhale/LLM_Image_Prompt_Injection",
  },
  {
    id: "kuramoto-neural",
    title: "Kuramoto Neural",
    description:
      "An interactive neural Kuramoto synchronization simulator for the Natural Sciences Computing Club, presenting coupled-oscillator and brain-network dynamics through a stylized browser visualization.",
    tags: ["Scientific Visualization", "Kuramoto Model", "HTML"],
    github: "https://github.com/WillieTheWhale/Kuramoto_Neural",
  },
  {
    id: "umbra",
    title: "Umbra",
    description:
      "An experiment in rebuilding the interface layer beneath LLM agents. Umbra keeps a persistent, addressable memory of tools and data so models can work with high-signal slices instead of repeatedly loading and parsing entire schemas.",
    tags: ["Agent Infrastructure", "Tool Memory", "Context Systems"],
    github: "https://github.com/WillieTheWhale/Umbra",
  },
  {
    id: "ny-intern-hacks",
    title: "Causal Context Capsules",
    description:
      "A Python prototype for portable, validated context bundles that let AI coding agents hand work off without losing the causal trail behind decisions.",
    tags: ["Python", "MCP", "Agent Handoffs", "Context Engineering"],
    github: "https://github.com/WillieTheWhale/NYInternHacks",
  },
  {
    id: "polymarket-research",
    title: "Polymarket Research System",
    description:
      "A paper-trading research system for short-window Polymarket crypto markets that combines Chainlink Data Streams, market replay, strategy validation, latency research, and explicit safety gates that keep live trading disabled by default.",
    tags: ["Rust", "Python", "SQLite", "Chainlink", "Paper Trading"],
  },
  {
    id: "hermes-setup",
    title: "Hermes on CloudApps",
    description:
      "An OpenShift deployment workspace for Hermes Agent, including Kubernetes manifests, VPN setup, deployment scripts, Telegram bridge configuration, and OpenAI Codex OAuth documentation.",
    tags: ["OpenShift", "Kubernetes", "Python", "Shell", "OAuth"],
  },
  {
    id: "ventures",
    title: "Ventures",
    description:
      "A full-stack internship application portal for KPMG Summer Ventures with applicant registration, multi-step applications, document uploads, custom essays, admin review, account approval, email/auth integration, and Supabase-backed storage.",
    tags: ["Next.js", "React", "TypeScript", "Supabase", "Tailwind"],
    github: "https://github.com/WillieTheWhale/Ventures",
  },
  {
    id: "comp211-quiz",
    title: "COMP 211 Quiz Prep",
    description:
      "A React quiz-prep application with practice problems, timers, scoring, progress tracking, and review flows for number representation, binary arithmetic, bitwise operations, Makefiles, Bash, and C systems concepts.",
    tags: ["React", "Vite", "Education", "Systems"],
    github: "https://github.com/WillieTheWhale/211_Q2",
  },
  {
    id: "mtgox",
    title: "MtGox",
    description:
      "A transparent automation bot for low-cost EC2 repository maintenance that schedules, generates, commits, and pushes clearly labeled maintenance artifacts without pretending to be human activity.",
    tags: ["Python", "SQLite", "EC2", "Automation"],
    github: "https://github.com/WillieTheWhale/MtGox",
  },
  {
    id: "nscc-website",
    title: "NSCC Carolina Website",
    description:
      "The web presence for the Natural Sciences Computing Club at UNC, including club pages, contact and application flows, Google Apps Script backends, and a visual system for the science-computing community.",
    tags: ["JavaScript", "HTML", "CSS", "Apps Script"],
  },
  {
    id: "unc-student-government",
    title: "UNC Student Government",
    description:
      "A rebuilt Executive Branch web presence migrated away from WordPress, with OpenShift deployment, DNS and SSL/TLS management, accessibility work, and alignment with UNC's brand system.",
    tags: ["HTML", "CSS", "Docker", "OpenShift", "Accessibility"],
    github: "https://github.com/WillieTheWhale/UNCSG.github.io",
  },
  {
    id: "urc",
    title: "Undergraduate Research Conference",
    description:
      "A Next.js website and digital-presence project for UNC's Undergraduate Research Conference, supporting applicant outreach, event information, sponsor engagement, and the conference's visual identity.",
    tags: ["Next.js", "React", "TypeScript", "Brand Design"],
    github: "https://github.com/WillieTheWhale/URC",
  },
  {
    id: "eel-website",
    title: "Experimental Engineering Lab",
    description:
      "A website for UNC's Experimental Engineering Lab, with design and maintenance work backed by automated CI/CD and deployment on Red Hat OpenShift.",
    tags: ["JavaScript", "Docker", "OpenShift", "CI/CD"],
    github: "https://github.com/WillieTheWhale/EEL_Website",
    url: "https://eel.unc.edu",
    image: withBase("/assets/logos/eel.jpg"),
  },
  {
    id: "harimau-theme",
    title: "Harimau Theme",
    description:
      "A customized Shopify Liquid storefront with modular sections and snippets, product, cart, and search templates, theme settings, brand-lore components, and original retail design assets.",
    tags: ["Shopify", "Liquid", "JavaScript", "E-commerce"],
  },
  {
    id: "saotome",
    title: "Saotome Global Academy",
    description:
      "A bilingual Japanese and English website for an online tutoring service serving Japanese families in the United States, with language switching, service pages, team profiles, testimonials, articles, and contact flows.",
    tags: ["Bilingual Web", "HTML", "CSS", "JavaScript"],
    github: "https://github.com/WillieTheWhale/Saotome",
  },
  {
    id: "maritime",
    title: "Dauntless Maritime",
    description:
      "A static front-end site presenting the services and visual identity of Dauntless Maritime Services.",
    tags: ["HTML", "CSS", "JavaScript", "Client Work"],
    github: "https://github.com/WillieTheWhale/Maritime",
  },
  {
    id: "ryanverse",
    title: "Ryanverse",
    description:
      "A portfolio-style web experience for Ryan built around a retro desktop interface, resume and CV viewers, custom icons, background media, and miniature application pages.",
    tags: ["HTML", "CSS", "JavaScript", "Portfolio"],
  },
  {
    id: "jc",
    title: "John Christopher Portfolio",
    description:
      "A custom portfolio website for John Christopher, built with a modern React and Next.js front end.",
    tags: ["Next.js", "React", "TypeScript", "Client Work"],
    github: "https://github.com/WillieTheWhale/JC",
  },
  {
    id: "keffing",
    title: "Keffing",
    description:
      "A personal portfolio experiment using probability-driven generative design so each page load can produce a distinct visual composition while preserving a consistent identity.",
    tags: ["Next.js", "React", "TypeScript", "GLSL", "Generative Design"],
    github: "https://github.com/WillieTheWhale/Keffing",
  },
  {
    id: "events-planning",
    title: "Event RSVP Prototype",
    description:
      "A local event-planning and RSVP front-end prototype with static pages, guest assets, typography experiments, visual audit screenshots, and a simulated RSVP experience.",
    tags: ["HTML", "CSS", "JavaScript", "Prototyping"],
  },
  {
    id: "blockd-landing",
    title: "Blockd Landing",
    description:
      "The product landing page and waitlist experience for Blockd, built as a focused TypeScript front end separate from the core platform.",
    tags: ["TypeScript", "CSS", "Product Marketing"],
    github: "https://github.com/WillieTheWhale/Blockd_Landing",
  },
  {
    id: "cdc-house",
    title: "CDC House",
    description:
      "A machine-learning workflow repository connected to CDC-oriented research and data exploration. The available inventory contains only a short project description.",
    tags: ["Machine Learning", "Research Workflow", "Archive"],
    github: "https://github.com/WillieTheWhale/cdcHouse",
  },
  {
    id: "vitshetyn",
    title: "Vitshetyn Campaign",
    description:
      "A compact campaign platform created for Mark Vitshetyn's AEPI vice-president campaign.",
    tags: ["HTML", "Campaign Site", "Client Work"],
    github: "https://github.com/WillieTheWhale/Vitshetyn",
  },
  {
    id: "wortschatz",
    title: "Wortschatz",
    description:
      "A lightweight German 203 vocabulary web project preserved in the project archive.",
    tags: ["HTML", "Language Learning", "Course Tool"],
    github: "https://github.com/WillieTheWhale/wortschatz",
  },
  {
    id: "polymarket-archive",
    title: "Polymarket Archive",
    description:
      "An earlier local Polymarket workspace with limited surviving evidence. It is listed as an archive record; the richer paper-trading research system is the authoritative project above.",
    tags: ["Archive", "Documentation Pending"],
  },
  {
    id: "kpmg-private",
    title: "KPMG Private Prototype",
    description:
      "A private repository retained as an inventory placeholder. Public documentation is not yet sufficient to describe the implementation responsibly.",
    tags: ["Private", "Documentation Pending"],
    github: "https://github.com/WillieTheWhale/KPMG",
  },
] satisfies ProjectCatalogEntry[];

export const projects: Project[] = projectCatalog.map((project, index) => ({
  ...project,
  sceneHints: {
    burstDirection: -60 + (index % 5) * 30,
    accentDensity: 0.1 + (index % 4) * 0.04,
    skyFragmentCount: 2 + (index % 3),
  },
}));
