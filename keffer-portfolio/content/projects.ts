// Project Data Schema (§10.2)

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

export const projects: Project[] = [
  {
    id: "generative-landscapes",
    title: "Generative Landscapes",
    description:
      "An interactive WebGL experience that generates infinite procedural terrain using layered noise functions. Real-time GLSL shaders create dynamic atmospherics, volumetric fog, and time-of-day lighting cycles. Built with custom rendering pipeline for maximum GPU utilization.",
    tags: ["Three.js", "GLSL", "WebGL", "Procedural Generation"],
    url: "https://example.com/landscapes",
    github: "https://github.com/williamkeffer/gen-landscapes",
    sceneHints: {
      burstDirection: -30,
      accentDensity: 0.2,
      skyFragmentCount: 3,
    },
  },
  {
    id: "neural-typography",
    title: "Neural Typography Engine",
    description:
      "A machine learning system that generates expressive typefaces by learning from historical letterforms. The neural network interpolates between styles, creating hybrid fonts that blend calligraphic tradition with computational precision. Deployed as a real-time web tool.",
    tags: ["Machine Learning", "Typography", "Python", "TensorFlow", "React"],
    url: "https://example.com/neural-type",
    github: "https://github.com/williamkeffer/neural-type",
    sceneHints: {
      burstDirection: 45,
      accentDensity: 0.15,
      skyFragmentCount: 2,
    },
  },
  {
    id: "spatial-audio-viz",
    title: "Spatial Audio Visualizer",
    description:
      "Real-time 3D audio visualization using Web Audio API and WebGPU compute shaders. Sound frequencies are mapped to particle behaviors — bass drives gravitational fields, mids control color spectra, and highs generate crystalline geometric structures that shatter and reform.",
    tags: ["WebGPU", "Web Audio API", "Compute Shaders", "Real-time"],
    url: "https://example.com/spatial-audio",
    sceneHints: {
      burstDirection: 90,
      accentDensity: 0.25,
      skyFragmentCount: 4,
    },
  },
  {
    id: "data-sculpture",
    title: "Data Sculpture Series",
    description:
      "A collection of physical-digital hybrid installations where environmental sensor data is transformed into evolving 3D-printed sculptures. Each piece represents a week of atmospheric data — temperature, humidity, wind patterns — encoded as mathematical surfaces and lattice structures.",
    tags: ["Data Visualization", "3D Printing", "IoT", "Generative Design"],
    github: "https://github.com/williamkeffer/data-sculpture",
    sceneHints: {
      burstDirection: -60,
      accentDensity: 0.1,
      skyFragmentCount: 3,
    },
  },
  {
    id: "decentralized-gallery",
    title: "Decentralized Gallery Protocol",
    description:
      "An open-source protocol for curating and exhibiting digital art across distributed networks. Features peer-to-peer exhibition spaces, cryptographic provenance tracking, and a novel consensus mechanism for community curation that resists centralized gatekeeping.",
    tags: ["Distributed Systems", "React", "Node.js", "Protocol Design"],
    url: "https://example.com/gallery",
    github: "https://github.com/williamkeffer/dgp",
    sceneHints: {
      burstDirection: 0,
      accentDensity: 0.18,
      skyFragmentCount: 2,
    },
  },
];
