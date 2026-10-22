// Static server for a Next export (`out/`), with an optional frozen clock
// (?freeze) injected into every HTML page so two builds render the same frame:
// performance.now, rAF timestamps, Date and Math.random become virtual;
// window.__clock.advance(n, ms) steps n frames, .set(ms) jumps. WebGL
// canvases keep their drawing buffer so they can be read back.
// usage: node scripts/visual-diff/serve.mjs <outDir> <port>
import http from "http"; import fs from "fs"; import path from "path";
const [dir, port] = [process.argv[2], +process.argv[3]];
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".svg": "image/svg+xml", ".woff2": "font/woff2", ".glb": "model/gltf-binary", ".txt": "text/plain", ".ico": "image/x-icon", ".md": "text/plain" };
const CLOCK = `<script>(function(){
var T0=1,t=T0,pending=0,rr=window.requestAnimationFrame.bind(window);
performance.now=function(){return t};
window.requestAnimationFrame=function(cb){return rr(function(){cb(t)})};
var RD=Date,FIX=new RD(2026,9,22,12,0,0).getTime();
function FD(){if(!(this instanceof FD))return new RD(FIX).toString();var a=[].slice.call(arguments);return a.length?new (Function.prototype.bind.apply(RD,[null].concat(a)))():new RD(FIX)}
FD.now=function(){return FIX};FD.UTC=RD.UTC;FD.parse=RD.parse;FD.prototype=RD.prototype;window.Date=FD;
var s=0x2545F491;Math.random=function(){s=(s+0x6D2B79F5)|0;var x=Math.imul(s^(s>>>15),1|s);x=(x+Math.imul(x^(x>>>7),61|x))^x;return((x^(x>>>14))>>>0)/4294967296};
var step=1000/60;(function pump(){if(pending>0){t+=step;pending--}rr(pump)})();
var gc=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,o){if(type==="webgl"||type==="webgl2"){o=Object.assign({},o||{},{preserveDrawingBuffer:true})}return gc.call(this,type,o)};
window.__clock={now:function(){return t},set:function(v){t=v},advance:function(n,ms){step=ms||1000/60;pending+=n;return new Promise(function(res){(function w(){pending<=0?res(t):rr(w)})()})}};
})();</script>`;
http.createServer((req, res) => {
  const u = new URL(req.url, "http://x");
  let p = decodeURIComponent(u.pathname);
  let f = path.join(dir, p);
  const tries = [f, f + ".html", path.join(f, "index.html")];
  f = tries.find((x) => fs.existsSync(x) && fs.statSync(x).isFile());
  if (!f) { res.writeHead(404); res.end(fs.existsSync(path.join(dir, "404.html")) ? fs.readFileSync(path.join(dir, "404.html")) : "404"); return; }
  const ext = path.extname(f);
  let body = fs.readFileSync(f);
  if (ext === ".html" && u.searchParams.has("freeze")) body = Buffer.from(body.toString().replace("<head>", "<head>" + CLOCK));
  res.writeHead(200, { "content-type": MIME[ext] || "application/octet-stream", "cache-control": "no-store" });
  res.end(body);
}).listen(port, "127.0.0.1", () => console.log(`serving ${dir} on http://localhost:${port}`));
