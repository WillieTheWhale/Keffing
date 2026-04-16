"use client";

import DocumentPage from "@/components/shared/DocumentPage";

export default function CVPage() {
  return (
    <DocumentPage
      images={["/docs/cv-1.png"]}
      title="Cover Letter"
      sectionNumber="01"
      pdfPath="/docs/William_Keffer_Cover_Letter.pdf"
    />
  );
}
