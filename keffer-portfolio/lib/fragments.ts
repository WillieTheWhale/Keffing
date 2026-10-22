// The site's sky photographs. Cards use the 800px thumbs; full-viewport
// moments (case hero bands) use SKY_PHOTOS_FULL.

import { withBase } from "@/lib/basePath";

export const SKY_PHOTOS = [
  "/assets/sky/thumbs/sky-1.jpg",
  "/assets/sky/thumbs/sky-2.jpg",
  "/assets/sky/thumbs/sky-4.jpg",
  "/assets/sky/thumbs/sky-5.jpg",
  "/assets/sky/thumbs/sky-6.jpg",
  "/assets/sky/thumbs/sky-7.jpg",
  "/assets/sky/thumbs/sky-8.jpg",
  "/assets/sky/thumbs/sky-9.jpg",
  "/assets/sky/thumbs/sky-10.jpg",
  "/assets/sky/thumbs/sky-11.jpg",
  "/assets/sky/thumbs/sky-12.jpg",
  "/assets/sky/thumbs/sky-13.jpg",
  "/assets/sky/thumbs/sky-14.jpg",
  "/assets/sky/thumbs/sky-15.jpg",
  "/assets/sky/thumbs/sky-16.jpg",
  "/assets/sky/thumbs/sky-17.jpg",
  "/assets/sky/thumbs/sky-18.jpg",
  "/assets/sky/thumbs/sky-19.jpg",
  "/assets/sky/thumbs/sky-20.jpg",
].map(withBase);

export const SKY_PHOTOS_FULL = SKY_PHOTOS.map((p) => p.replace("/thumbs/", "/"));
