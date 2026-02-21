// Project & Experience Data

export interface Project {
  id: string;
  title: string;
  description: string;
  tags: string[];
  url?: string;
  github?: string;
  image?: string;
  sceneHints: {
    burstDirection: number;
    accentDensity: number;
    skyFragmentCount: number;
  };
}

export const experience: Project[] = [
  {
    id: "blockd",
    title: "Blockd",
    description:
      "Blockd is an enterprise-grade interview security platform that combines a custom Chromium browser with AI-powered anti-cheating detection to preserve the integrity of remote interviews. The platform deploys a suite of real-time monitoring tools, including eye tracking via MediaPipe, multi-LLM answer semantic analysis, mode collapse screening, process detection for screen recording software, VM detection, and window focus tracking to identify candidates who may be using unauthorized assistance during live interviews. On the interviewer side, a React-based web dashboard provides reports on security events, gaze heatmaps, AI detection confidence scores, and live video feeds in real time, giving hiring teams full transparency into each session. Built on a microservices architecture with eight backend services, WebRTC video streaming, WebSocket real-time communication, and a Kubernetes-ready infrastructure.",
    tags: ["Chromium", "MediaPipe", "WebRTC", "Microservices", "React", "Kubernetes"],
    url: "https://www.linkedin.com/company/blockdcompany/",
    image: "/assets/logos/blockd.png",
    sceneHints: {
      burstDirection: -30,
      accentDensity: 0.2,
      skyFragmentCount: 3,
    },
  },
  {
    id: "eel",
    title: "Experimental Engineering Lab",
    description:
      "The Experimental Engineering Lab (EEL) is an undergraduate research lab at UNC dedicated to hands-on engineering projects and interdisciplinary collaboration. I have been responsible for designing, developing, and maintaining the site, managing its deployment on Red Hat OpenShift through an automated CI/CD pipeline.",
    tags: ["Web Development", "OpenShift", "CI/CD"],
    url: "https://eel.unc.edu",
    image: "/assets/logos/eel.jpg",
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

export const projects: Project[] = [
  {
    id: "brick-studio",
    title: "Brick Studio",
    description:
      "A desktop application that lets anyone describe a Roblox game in plain English and receive a complete, publish-ready game file in return. The tool transforms natural language prompts into fully functional Roblox places containing server and client scripts, user interfaces, physics, lighting, and data persistence. Under the hood, a TypeScript MCP server orchestrates nine specialized AI agents powered by Google Gemini through a recursive function-calling loop, while a Rust serializer built on the rbx-dom ecosystem produces the binary .rbxl output. The Electron + React frontend provides an IDE-like experience with a conversational chat panel, live code preview, build progress tracking, and one-click export.",
    tags: ["TypeScript", "Rust", "Electron", "MCP", "Gemini", "React"],
    github: "https://github.com/WillieTheWhale/Brick_Studio",
    image: "/assets/logos/brick-studio.png",
    sceneHints: {
      burstDirection: -60,
      accentDensity: 0.1,
      skyFragmentCount: 3,
    },
  },
  {
    id: "argo",
    title: "Argo",
    description:
      "An adversarial robustness research tool targeting the most underexplored attack surface in modern AI: the projector layer connecting vision encoders to large language models. This framework demonstrates that the thin projector bridge in VLMs like GPT-4V, LLaVA, and BLIP-2 is disproportionately sensitive to perturbation, often exhibiting higher Lipschitz constants than the vision encoder it wraps. Implements three complementary attack strategies (feature divergence, cross-modal misalignment, and visual token corruption) using PGD optimization with SPSA gradient estimation, all operating within imperceptible perturbation budgets.",
    tags: ["Python", "Adversarial ML", "VLMs", "NumPy/SciPy", "Flask"],
    sceneHints: {
      burstDirection: 0,
      accentDensity: 0.18,
      skyFragmentCount: 2,
    },
  },
  {
    id: "aperture",
    title: "Aperture",
    description:
      "A satellite-economic ML pipeline for real estate investment intelligence, built at Carolina Data Challenge 2025. Processes NASA HLS satellite imagery with computer vision to detect construction, fuses results with FRED/BLS/Census economic indicators, and scores development opportunities using PyTorch and XGBoost ensembles. Deployed on AWS (SageMaker, Lambda, PostGIS, S3) with Dask-based distributed processing and containerized inference.",
    tags: ["PyTorch", "XGBoost", "AWS", "Computer Vision", "PostGIS"],
    sceneHints: {
      burstDirection: 30,
      accentDensity: 0.2,
      skyFragmentCount: 3,
    },
  },
];

export interface Extracurricular {
  id: string;
  title: string;
  role: string;
  description: string;
  url?: string;
}

export const extracurriculars: Extracurricular[] = [
  {
    id: "nscc",
    title: "Natural Sciences Computing Club",
    role: "President & Founder",
    description:
      "NSCC bridges the gap between traditional science education and the computational skills essential to modern research. We create computational models for natural sciences research, and our goal is to build a community where scientists confidently use code to advance their fields, cultivating the next generation of computationally fluent researchers ready to work at the intersection of data and discovery.",
    url: "https://www.nsccatunc.org/",
  },
  {
    id: "unc-sg",
    title: "UNC Student Government",
    role: "Head of Web Development",
    description:
      "Rebuilt the Executive Branch website from scratch, migrating off WordPress to a custom application on Red Hat OpenShift, and manage the full deployment pipeline including DNS, SSL/TLS, and cloud infrastructure.",
    url: "https://executivebranch.unc.edu/",
  },
  {
    id: "urc",
    title: "Undergraduate Research Conference at UNC",
    role: "Director of Technology",
    description:
      "Designed the conference logo, built the event website, and manage the conference's full digital presence. The site serves as the primary platform for applicant outreach, event information, and sponsor engagement for a one-day research showcase in the Campus Union's Great Hall.",
    url: "https://uncurc.com/",
  },
];
