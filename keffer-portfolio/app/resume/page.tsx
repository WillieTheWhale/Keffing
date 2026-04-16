"use client";

import DocumentPage from "@/components/shared/DocumentPage";

export default function ResumePage() {
  return (
    <DocumentPage
      images={["/docs/resume-1.png"]}
      title="Resume"
      sectionNumber="01"
      pdfPath="/docs/William_Keffer_Resume.pdf"
    />
  );
}
