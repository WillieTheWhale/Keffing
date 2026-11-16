# Bio drafts (2026-11-16)

Ten replacements for the About section (`keffer-portfolio/components/overlay/sections/AboutSection.tsx`).
Each one is paragraph 1. Paragraph 2 is one of the four two-sentence colophons at the bottom of this file; any colophon works with any bio.

Contents: what's wrong with the current bio → the sites studied → the shared brief → ten prompts and the bio each produced → colophons → facts to confirm.

---

## What's wrong with the current one

- **"His research includes adversarial ML, VLM security, and satellite-economic analysis."** Argo, Aperture and the prompt-injection PoC are projects (Aperture was a Carolina Data Challenge entry). Calling them research is the buzzword problem.
- **"He loves talking about all things related to these fields."** Says nothing.
- **Paragraph 2 spends 80 words on the site** and credits Aletiune, which no longer describes it.
- **It leaves out the real work:** Heelcode with Prasun Dewan, the wave maker, founding NSCC, the Carolina AI Alignment fellowship.

## Sites studied

Researchers and engineers: karpathy.ai, colah.github.io, andymatuschak.org, thesephist.com (Linus Lee), jasonwei.net, nat.org, patrickcollison.com, jvns.ca (Julia Evans), gwern.net, neelnanda.io, kvfrans.com.
Undergrads and recent grads: ekzhang.com (Eric Zhang), mit.edu/~kevinhw (Kevin Wang), riddhibhagwat.github.io, rpandey.tech (Rohan Pandey).
Designers and design engineers: rauno.me, paco.me, emilkowal.ski, leerob.com, brianlovin.com, maggieappleton.com, frankchimero.com, joshwcomeau.com, lynnandtonic.com, craigmod.com, macwright.com, worrydream.com (Bret Victor).
Colophons: maggieappleton.com/colophon, macwright.com/about, brittanychiang.com, stephango.com/about, seijis.csail.mit.edu/colophon.html, leahprice.org, paulstamatiou.com/about, naildrivin5.com, dansinker.com/colophon.

**What the good ones share:**

1. The first sentence says what you do or believe, in plain words. School, year and titles come later, often last.
2. One "why" sentence connects everything else.
3. Evidence is nouns and numbers, not adjectives (blogging since 2014, 300 foods tested).
4. Personal details: one or two, oddly specific, placed after the work. The best ones explain the work. Generic lists ("travel, hiking, video games") read as filler.
5. First person, 40 to 170 words. Third person only works for famous names or a press blurb labelled as one.

**What the weak ones do:** open with status ("I'm a junior at X studying Y"), turn a CV into prose, list research areas with nothing connecting them, add a generic hobby list at the end.

**Colophons that work:** sentence one says who made it and with what. Sentence two gives one craft detail (typefaces, a fixed seed, an admitted quirk). No essays.

---

## The shared brief (pasted ahead of every prompt)

> **Subject:** William Keffer. Junior at UNC Chapel Hill, B.S. in Computer Science and Mathematics, graduating May 2028. Went to the North Carolina School of Science and Mathematics.
>
> **Facts you may use (don't add others):**
> - Undergraduate AI researcher with Prof. Prasun Dewan since Sep 2026. Building **Heelcode**, a fork of OpenCode wired to UNC's PromptLab, so CS classes can use a coding agent through the university's models and each student's own login.
> - **Carolina AI Alignment** fellow since Aug 2026 (alignment and governance).
> - Since Nov 2025, writes the software for the **wave maker** at the Experimental Engineering Lab and Joint Fluids Lab: 30 LinMot pistons on an Allen-Bradley PLC. Operators pick pistons on a drawing of the tank, run waves, presets or single soliton pulses, practise on a simulated wave maker, and measure the water through the tank wall with a camera. Also builds and deploys the lab's website.
> - Founded and leads the **Natural Sciences Computing Club**: proton-therapy Bragg-peak and quantum-tunneling simulations, workshops for science students, hands-on activities for hundreds of kids at NC SciFest.
> - Analyst on Blockchain at Berkeley's prediction-markets team, summer 2026.
> - In high school, research assistant in Duke Anesthesiology: a meta-analysis on perioperative sleep.
> - Builds websites for other people: UNC Student Government's executive branch, the Undergraduate Research Conference, EEL, NSCC, a bilingual Japanese–English tutoring service, a Shopify storefront, friends' portfolios.
> - Interests: machine learning, especially reinforcement learning; AI alignment; where analysis and abstract algebra meet computation. Belief, from his own cover letter: computer science matters most when it makes another field possible.
> - Personal: technical Minecraft (redstone), Stardew Valley; Pitcher56, Lamp, Ichiko Aoba, Ryo Fukui, Aphex Twin; espresso on a Breville Barista Express; a Stüssy archive at stussy.ink; Arch Linux on a Panasonic Let's Note CF-SX1 with a DVD drive.
>
> **Rules:** No list of research areas. Hackathon and side projects are never "research". No "passionate", "loves", "innovative", "leveraging", or praise of himself. Concrete nouns over adjectives. At most two personal details, and specific ones. Nothing about the website. 60–130 words unless the prompt says otherwise.

---

## Ten prompts and their bios

### 1. Mission first, school last (Linus Lee, thesephist.com)

**Prompt:** *Using the brief, write a first-person bio in Linus Lee's order: name; one sentence on what he builds and for whom; one sentence on the ideas he keeps returning to; one sentence of specific personal details; school and year as the last sentence, so it reads as incidental. About 110 words.*

> I'm William. I build software for people doing other kinds of work: a coding-agent harness for UNC's computer science classes, the controls for a fluid dynamics lab's thirty-piston wave maker, and websites for the labs and student groups around campus. The ideas I keep coming back to are in machine learning, especially reinforcement learning and the alignment problems that come with it, and in the places where analysis and abstract algebra turn into something you can compute. Away from that, I build redstone in technical Minecraft, make espresso, and keep Pitcher56 and Lamp on repeat. I'm a junior at UNC Chapel Hill studying computer science and math.

### 2. One belief, plain sentences (Julia Evans, jvns.ca)

**Prompt:** *Using the brief, write a first-person bio in Julia Evans's register: short declarative sentences and one belief that explains the rest. Open with name, school and year in one clause, then the belief, then two or three things he does that follow from it. No jokes, no hobbies. About 100 words.*

> I'm William, a junior studying computer science and math at UNC Chapel Hill. I think computing is at its best when it makes someone else's work possible, so most of what I build is for another person's class, lab or club. With Prof. Prasun Dewan I'm building Heelcode, a coding agent that runs on UNC's PromptLab so CS classes can use it. I write the control software for a fluid dynamics lab's wave maker. And I started the Natural Sciences Computing Club, where biology, chemistry and physics students learn to model their own questions in code.

### 3. "I work on…" (Chris Olah, colah.github.io)

**Prompt:** *Using the brief, write a first-person bio that opens with "I work on" plus the problem in plain words, not a field name. Then where and with whom, then what he's drawn to and why, then the rest of his work in one sentence. Year and major last. About 100 words.*

> I work on AI agents, and on what it takes to hand them to people who are still learning. At UNC Chapel Hill I'm building Heelcode with Prof. Prasun Dewan, a coding agent that CS classes run through the university's PromptLab, and I'm a fellow with Carolina AI Alignment. The part of machine learning I find hardest to stop thinking about is reinforcement learning. I also write the control software for a fluid dynamics lab's wave maker, and I founded UNC's Natural Sciences Computing Club. I'm a junior studying computer science and math.

*Check:* the opening line is an interpretation of Heelcode. Keep it only if that's really the question you're working on.

### 4. The hybrid, named and owned (Maggie Appleton, maggieappleton.com)

**Prompt:** *Using the brief, write a first-person bio in Maggie Appleton's shape: name the three things he does, admit they don't fit on one line, then one sentence of evidence for each. Year and school last. About 120 words.*

> I work in three places at once: machine learning, software that other people depend on, and design for the web. They don't fit on one line of a résumé, but each one keeps improving the others. In ML, I'm building Heelcode with Prof. Prasun Dewan, a coding-agent harness for UNC's computer science classes, and I'm a Carolina AI Alignment fellow. In engineering, I write the software that runs a fluid dynamics lab's thirty-piston wave maker. In design, I've built sites for UNC Student Government, the Undergraduate Research Conference and the Experimental Engineering Lab. I'm a junior at UNC Chapel Hill studying computer science and math.

### 5. Verb-led fragments (Paco Coursey, paco.me)

**Prompt:** *Using the brief, write a bio that opens with three short fragments that start with verbs and has no "I am". Then one plain line with school and year, then the specifics in two sentences. One dry joke at most. About 85 words.*

> Building coding agents for classrooms. Writing the software behind a thirty-piston wave maker. Designing websites for anyone who asks nicely. Studying computer science and math at UNC Chapel Hill, class of 2028. Right now that means Heelcode, a coding-agent harness for UNC's CS courses, with Prof. Prasun Dewan, and a fellowship with Carolina AI Alignment. I also run the Natural Sciences Computing Club, which I founded, and in high school I helped Duke anesthesiologists with a meta-analysis on sleep around surgery.

### 6. Reverse chronology, each item in a few words (Tom MacWright, macwright.com)

**Prompt:** *Using the brief, write a first-person bio that opens "Hi, I'm William." and then runs reverse-chronologically: a time label, then each thing explained in a few words. Close with one mixed-up "Also:" sentence of specific personal items. About 120 words.*

> Hi, I'm William. Now: Heelcode, a coding-agent harness for UNC's CS classes, with Prof. Prasun Dewan, and a fellowship with Carolina AI Alignment. Last summer: prediction markets with Blockchain at Berkeley. Since 2025: the software that runs a fluid dynamics lab's wave maker, thirty pistons and one PLC. Ongoing: the Natural Sciences Computing Club, which I started, where we simulate proton beams and quantum tunneling. In high school: a meta-analysis on anesthesia and sleep at Duke. Also: websites for a lot of the groups I've joined, a Stüssy archive, an Arch Linux laptop with a DVD drive, and more technical Minecraft than is reasonable.

### 7. A hobby that explains the work (Rohan Pandey, rpandey.tech)

**Prompt:** *Using the brief, write a first-person bio that opens with something he cares about outside class and chains it, cause by cause, to his current work, so the hobby explains the career. Year and school last. About 110 words.*

> Technical Minecraft taught me to think in clock cycles, and ever since I've liked machines I can hold entirely in my head. That's how I ended up writing the control software for a fluid dynamics lab's thirty-piston wave maker, and probably why abstract algebra was the math class that clicked. These days the machines are AI agents: I'm building Heelcode, a coding-agent harness for UNC's CS courses, with Prof. Prasun Dewan, and I'm a Carolina AI Alignment fellow because I'd like agents to stay understandable to the people using them. I'm a junior at UNC Chapel Hill studying computer science and math.

*Check:* every "because" and "that's how" here is a guess. Keep only the ones that are true. This is the most distinctive draft if they are.

### 8. "Some things about me" (Nat Friedman, nat.org)

**Prompt:** *Using the brief, write 8 to 9 short bullets with no subject ("Went to…", "Building…"). Put the CV facts in the middle and open and close with specific, slightly surprising facts.*

> - Junior at UNC Chapel Hill, computer science and math.
> - Went to the North Carolina School of Science and Mathematics.
> - Building Heelcode, a coding-agent harness for UNC's CS classes, with Prof. Prasun Dewan.
> - Write the software that runs a fluid dynamics lab's wave maker: thirty pistons, one PLC, and a camera that measures the water through the tank wall.
> - Started the Natural Sciences Computing Club, where we simulate proton-therapy beams and quantum tunneling.
> - Fellow with Carolina AI Alignment.
> - Run Arch Linux on a Panasonic Let's Note that still has a DVD drive.
> - Keep a Stüssy archive at stussy.ink.

*Layout:* needs list markup in `AboutSection.tsx`, not a `<p>`. It would sit well in the site's typed-list voice.

### 9. Short lines with repetition (Craig Mod, craigmod.com)

**Prompt:** *Using the brief, write a bio as short broken lines, almost verse. Open "Hi, I'm William" plus three roles where the last is a little unexpected. Give the work flatly, one fact per line, and end with three parallel "Current ___:" lines.*

> Hi, I'm William — student, engineer, maker of other people's websites.
> Junior at UNC Chapel Hill, computer science and math.
> Building Heelcode, a classroom coding agent, with Prof. Prasun Dewan.
> Writing the software that makes waves in a fluid dynamics lab's tank.
> Founder, Natural Sciences Computing Club.
> Fellow, Carolina AI Alignment.
> Current loop: Pitcher56.
> Current farm: Stardew Valley.
> Current machine: a Breville Barista Express.

*Layout:* needs a line break after each line.

### 10. Third person, tight (Karpathy / Bret Victor's "promotional bio")

**Prompt:** *Using the brief, write a third-person press bio of 4 sentences: name, year and school; what he builds and where; his interests, stated as specific subjects rather than a list of fields; one sentence with two personal specifics. This replaces the current bio in the same voice.*

> William Keffer is a junior at UNC Chapel Hill studying computer science and mathematics. He builds Heelcode, a coding-agent harness for UNC's computer science classes, with Prof. Prasun Dewan; writes the control software for a fluid dynamics lab's wave maker; and founded the university's Natural Sciences Computing Club. He is a fellow with Carolina AI Alignment, and his interests run to reinforcement learning and to where analysis and abstract algebra meet computation. Off the clock he builds redstone in technical Minecraft, tends a Stardew Valley farm, and listens to Pitcher56 and Aphex Twin.

---

## Colophons (paragraph 2: pick one, two sentences each)

Checked against the code: `components/background/` (engine.ts, pieces.ts, layout2d.tsx) and `app/layout.tsx`. All four leave out Aletiune.

**A. Stack, then how it's built**
> This site is built with Next.js, TypeScript and three.js, and hosted on GitHub Pages. The background is one hand-placed composition, a 3D layer of liquid chrome, glass and porcelain cable between two printed layers of paper, sky photographs and schematics, and scrolling moves a camera down through it.

**B. Typefaces plus the fixed seed**
> Next.js, TypeScript and three.js, set in Archivo, Inter and Server Mono. Every large piece of the background is placed by hand; only the finest tangles are generated, from one fixed seed, so it's the same picture on every visit.

**C. The ending**
> The site runs on Next.js and TypeScript, with the background rendered in three.js between two layers of printed paper. Scrolling is a camera moving down through a single composition, and at the very bottom it flies into a liquid mirror.

**D. With an admission**
> Built with Next.js, TypeScript and three.js, and overbuilt for a personal site on purpose. Everything behind this text is placed by hand in one scene, with only the finest texture generated from a fixed seed.

---

## Confirm before shipping

- **Tank size:** the site says 13,500 gallons, the 2026 resume says 10,000. The drafts leave the number out.
- **When NSCC started:** the resume says Fall 2024, `content/experience.ts` says Oct 2025. The drafts leave the date out.
- **Music:** the current bio names Aphex Twin, but the Media page doesn't list it. Drafts 1 and 9 use Pitcher56 and Lamp from the Media page.
- **Drafts 3 and 7** state motives that I inferred. Keep them only if they're true.
