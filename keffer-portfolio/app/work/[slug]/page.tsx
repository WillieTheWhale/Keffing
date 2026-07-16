import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { experience, projects } from "@/content/projects";
import CaseStudy from "@/components/case/CaseStudy";

const ALL = [...experience, ...projects];

export function generateStaticParams() {
  return ALL.map((p) => ({ slug: p.id }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const project = ALL.find((p) => p.id === slug);
  if (!project) return {};
  return {
    title: `${project.title} — William Keffer`,
    description: project.description.slice(0, 160),
  };
}

export default async function WorkPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const project = ALL.find((p) => p.id === slug);
  if (!project) notFound();
  const isExperience = experience.some((p) => p.id === slug);
  return <CaseStudy project={project} kind={isExperience ? "experience" : "project"} />;
}
