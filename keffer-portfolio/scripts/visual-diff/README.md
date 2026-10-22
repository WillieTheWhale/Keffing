# visual-diff

Proves a change leaves the site's pixels alone, and measures what it costs.

1. Build the reference and keep its export: `git stash` (or check out the
   reference), `npx next build`, `cp -R out /tmp/ref-out`; then build the
   candidate the same way into `/tmp/new-out`.
2. Serve both: `node scripts/visual-diff/serve.mjs /tmp/ref-out 4101` and
   `node scripts/visual-diff/serve.mjs /tmp/new-out 4102`.
3. Capture both with the same plan, then diff:

   ```
   SW=1 STEP=50 DPR=1 node scripts/visual-diff/capture.mjs http://localhost:4101 /tmp/cap-ref desk home
   SW=1 STEP=50 DPR=1 node scripts/visual-diff/capture.mjs http://localhost:4102 /tmp/cap-new desk home
   python3 scripts/visual-diff/diff.py /tmp/cap-ref /tmp/cap-new /tmp/cap-heat
   ```

`SW=1` renders WebGL in software (SwiftShader), which is bit-exact from run
to run. Without it the captures use the GPU, which on Apple silicon jitters
by a few dozen isolated pixels per frame (the porcelain ink speckle) even for
identical WebGL commands, so GPU diffs show that floor in both directions:
compare reference against itself to see it.

`perf.mjs` loads one build with the CPU throttled (default 6×) and reports
load long tasks, idle cost, and frame times plus main-thread time while
scrolling the whole page.
