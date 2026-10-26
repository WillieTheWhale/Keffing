// Builds public/geo/world.json and public/geo/us.json for the dashboard map.
// world: Natural Earth 1:110m countries (world-atlas), each tagged with its
// ISO 3166-1 alpha-2 code (`a2`) so it can be joined to Cloudflare's
// request.cf.country. us: US Census states (us-atlas), joined by name to
// request.cf.region.
//
//   npm i --prefix /tmp/geo world-atlas@2.0.2 us-atlas@3.0.1 i18n-iso-countries@7.14.0
//   cp scripts/build-geo.mjs /tmp/geo/ && node /tmp/geo/build-geo.mjs "$PWD/public/geo"
import fs from "node:fs";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const countries = require("i18n-iso-countries");
const out = process.argv[2];

const world = JSON.parse(fs.readFileSync(require.resolve("world-atlas/countries-110m.json"), "utf8"));
const byName = { Kosovo: "XK", "N. Cyprus": "CY", Somaliland: "SO" };
const missing = [];
for (const g of world.objects.countries.geometries) {
  const a2 = (g.id && countries.numericToAlpha2(g.id)) || byName[g.properties.name];
  if (a2) g.properties.a2 = a2;
  else missing.push(g.properties.name);
}
delete world.objects.land;
fs.writeFileSync(`${out}/world.json`, JSON.stringify(world));

const us = JSON.parse(fs.readFileSync(require.resolve("us-atlas/states-10m.json"), "utf8"));
fs.writeFileSync(`${out}/us.json`, JSON.stringify(us));
console.log("untagged:", missing.join(", ") || "none");
