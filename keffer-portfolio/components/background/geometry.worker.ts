// Background — ALLOY. Builds the scene's geometry off the main thread (build.ts).

import { buildAll, transferables, type PageSpec, type Quality } from "./build";

self.onmessage = (e: MessageEvent<{ quality: Quality; page: PageSpec | null }>) => {
  const built = buildAll(e.data.quality, e.data.page);
  (self as unknown as Worker).postMessage(built, transferables(built));
};
