import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { stuffPages, stuffById } from "@/content/stuff";
import StuffPage from "@/components/stuff/StuffPage";

export function generateStaticParams() {
  return stuffPages.map((c) => ({ slug: c.id }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const c = stuffById(slug);
  if (!c) return {};
  return {
    title: `${c.title} — My stuff — William Keffer`,
    description: c.standfirst,
  };
}

export default async function StuffRoute({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const c = stuffById(slug);
  if (!c) notFound();
  return <StuffPage collection={c} />;
}
