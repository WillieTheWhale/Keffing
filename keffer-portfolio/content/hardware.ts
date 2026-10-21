export interface HardwareDevice {
  id: string;
  name: string;
  note: string;
  meta: string;
  category: "Computer" | "Audio" | "Phone" | "Handheld" | "Coffee";
  interaction: "open" | "unfold" | "inspect";
  /** Camera direction in glTF's Y-up space. */
  view: [number, number, number];
}

export const hardwareDevices: HardwareDevice[] = [
  { id: "macbook-pro-m4-max", name: "MacBook Pro", note: "16-inch · M4 Max · macOS", meta: "Space Black", category: "Computer", interaction: "open", view: [0.65, 0.9, 1.5] },
  { id: "panasonic-cf-sx1", name: "Panasonic Let’s Note", note: "CF-SX1 · Arch Linux · DVD drive", meta: "Mariana Blue", category: "Computer", interaction: "open", view: [0.65, 0.9, 1.5] },
  { id: "bose-qc35", name: "Bose QuietComfort 35", note: "QC35 · over-ear headphones", meta: "Silver", category: "Audio", interaction: "unfold", view: [0.85, 0.5, 1.7] },
  { id: "airpods-pro-3", name: "AirPods Pro 3", note: "Earbuds + charging case", meta: "White", category: "Audio", interaction: "open", view: [0.7, 0.55, 1.5] },
  { id: "iphone-16-pro-max", name: "iPhone 16 Pro Max", note: "6.9-inch · Pro Max", meta: "Black Titanium", category: "Phone", interaction: "inspect", view: [0.3, 1.6, 0.38] },
  { id: "new-2ds-xl-hylian", name: "New Nintendo 2DS XL", note: "Hylian Shield Edition", meta: "Blue / silver", category: "Handheld", interaction: "open", view: [0.5, 1.2, 1.5] },
  { id: "dsi-xl-bronze", name: "Nintendo DSi XL", note: "Dual-screen handheld", meta: "Bronze", category: "Handheld", interaction: "open", view: [0.5, 1.2, 1.5] },
  { id: "mac-mini-2024", name: "Mac mini", note: "2024 · compact desktop", meta: "Silver", category: "Computer", interaction: "inspect", view: [0.8, 1.0, 1.5] },
  { id: "nintendo-switch", name: "Nintendo Switch", note: "Standard model · Joy-Con pair", meta: "Neon blue / neon red", category: "Handheld", interaction: "inspect", view: [0.2, 1.6, 0.55] },
  { id: "breville-barista-express", name: "Breville Barista Express", note: "Espresso machine · integrated grinder", meta: "Black Sesame", category: "Coffee", interaction: "inspect", view: [0.72, 0.65, 1.7] },
];
