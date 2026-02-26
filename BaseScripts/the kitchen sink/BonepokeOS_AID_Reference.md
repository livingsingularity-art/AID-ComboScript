# BonepokeOS → AI Dungeon: Complete Tension Lexicon & Scoring Boundary Reference

> Faithful port of `ProjectBonepoke435.py` + JADE VSL + Freezing the Fog protocol
> into AI Dungeon's sandboxed ES2022 JavaScript scripting environment.

---

## Source Mapping: Python Class → JavaScript Function

| Python (ProjectBonepoke435.py) | JavaScript (bonepoke_library.js) | Location |
|---|---|---|
| `BonepokeCoreEngine._detect_contradictions` | `CoreEngine.detectContradictions()` | §5 |
| `BonepokeCoreEngine._trace_fatigue` | `CoreEngine.traceFatigue()` | §5 |
| `BonepokeCoreEngine._compost_drift` | `CoreEngine.compostDrift()` | §5 |
| `BonepokeCoreEngine._flicker_marm` | `CoreEngine.flickerMarm()` | §5 |
| `ShimmerBudget` | `registerShimmerEvent() / getShimmerBudget()` | §9 |
| `MotifDecay` | `trackMotifDecay()` | §10 |
| `RuptureCooldown` | `checkRuptureCooldown()` | §11 |
| `MemoryResidue` | `bpState.memory[]` in `ingest()` | §15 |
| `LineageEcho` | `bpState.history[]` in `ingest()` | §15 |
| `PBTestSuite.score()` | `runTestSuite()` | §13 |
| `PBTestSuite.salvage_suggestions()` | `generateSuggestions()` | §14 |
| `Vanilla.enforce()` | Inline length check in `ingest()` | §15 |
| `Translator.tune()` | `ingest()` orchestrator | §15 |
| `CojoinedBone.ingest()` | `BonepokeOS.ingest()` public API | §17 |
| `JADE VSLGenerator.compute_from_modules()` | `VSL.calculateE() / VSL.calculateBeta()` | §6 |

---

## 1 — Complete Tension Lexicon

### 1.1 Negation Markers (N)

**Source:** `_detect_contradictions` checks for `"not" in line`. Paper §5.2 defines set N.
**Expanded** for narrative fiction contexts:

```
not, never, no, none, nothing, neither, nor, nowhere,
cannot, refuse, deny, reject, impossible, forbidden,
without, lack, absent, empty, void, lost, gone, missing,
failed, broken, shattered, ruined, collapsed, undone
```

**Usage:** A sentence containing a negation marker AND a temporal marker triggers a **contradiction detection** hit.

### 1.2 Temporal/State Markers (Ts)

**Source:** `_detect_contradictions` checks for `["already","still","again"]`. Paper §5.2 defines set Ts.
**Expanded:**

```
already, still, again, once, before, after, yet, now,
then, meanwhile, always, forever, until, since, during,
while, when, formerly, previously, no longer, anymore,
used to, had been, was once, remembered, forgot, returned,
repeated, continued, persisted, remained, lingered, endured
```

**Usage:** Co-occurrence with negation markers within the same sentence fragment signals **Contradiction Bleed (β)**.

### 1.3 Abstract Nouns (Drift Indicators)

**Source:** `_compost_drift` checks for `["system","sequence","signal","process","loop"]`
**Expanded:**

```
system, sequence, signal, process, loop, mechanism,
protocol, framework, structure, pattern, algorithm,
function, procedure, operation, interface, network,
matrix, cycle, paradigm, schema, construct, apparatus,
entity, phenomenon, concept, principle, dynamic, force,
essence, nature, reality, truth, destiny, fate, prophecy,
power, energy, presence, influence, order, chaos
```

**Usage:** A sentence containing abstract nouns BUT NO action verbs is flagged as **drift** — unanchored reference that raises E (fatigue) and contributes to β (unresolved tension).

### 1.4 Action Verbs (Anti-Drift Anchors)

**Source:** `_compost_drift` checks for `["pressed","moved","spoke","acted","responded","decided","changed"]`
**Expanded:**

```
pressed, moved, spoke, acted, responded, decided, changed,
grabbed, pulled, pushed, ran, fought, kicked, punched,
threw, caught, whispered, shouted, turned, walked, opened,
closed, drew, fired, dodged, struck, blocked, fled,
chased, slammed, broke, built, crafted, chose, refused,
climbed, jumped, fell, crawled, reached, touched, held,
dropped, lifted, carried, dragged, cut, stabbed, shot,
aimed, swung, ducked, rolled, charged, retreated, stood,
sat, knelt, crouched, pointed, signaled, nodded, shook,
laughed, cried, screamed, pleaded, demanded, offered,
accepted, denied, surrendered, escaped, attacked, defended
```

**Usage:** Presence of an action verb in the same sentence as an abstract noun **cancels the drift flag** for that sentence. The sentence is "grounded."

### 1.5 Resonance Terms (Shimmer Vocabulary)

**Source:** `MemoryResidue.recall()` uses `{'paradox','loop','echo','ache','shimmer'}`. `_flicker_marm` checks `['ache','loop','shimmer','echo']`. `MotifDecay` tracks `['loop','ache','echo','shimmer']`.
**Expanded:**

```
paradox, loop, echo, ache, shimmer, grief, ritual,
threshold, collapse, memory, wound, recursion, drift,
rupture, fracture, scar, ghost, haunt, remnant, residue,
trace, shadow, reflection, mirror, cycle, spiral, descent,
return, rebirth, transformation, metamorphosis
```

**Usage:** Multiple roles:
- **MARM flicker:** +1 to MARM score if any resonance term present
- **MotifDecay tracking:** Counts accumulate; exceeding threshold triggers fatigue warning
- **Memory Residue:** Fragments containing these terms are stored for recall
- **Shimmer Budget:** Triggers weighted event registration

### 1.6 Symbol Earnedness Categories

**Source:** "Enter the Loop" article scoring functions.

| Category | Words | Function |
|---|---|---|
| **Symbol Earnedness** | earned, sacrifice, trial, wound, cost, price, toll, burden | Lowers E (signals depth) |
| **Narrative Gravity** | weight, burden, pull, anchor, gravity, depth, root, foundation | Lowers E |
| **Emotional Recursion** | grief, echo, loop, return, haunt, remember, revisit, relive | Amplifies β |
| **Genre Integrity** | threshold, collapse, memory, ritual, ceremony, passage, crossing, gate | Amplifies β |
| **Mythic Logic** | symbol, myth, legend, portal, prophecy, oracle, covenant, relic | Amplifies β |

### 1.7 Slop & Sycophancy Indicators

**Source:** β-Metric article, "Enter the Loop" `detectSlop()`.

**Slop (low-effort generic output):**
```
random, suddenly, somehow, literally, basically, actually,
really, very, just, simply, merely, quite, rather,
perhaps, maybe, probably, possibly, apparently, seemingly,
interesting, nice, good, fine, okay, alright, wonderful,
amazing, awesome, incredible, unbelievable, beautiful,
gorgeous, stunning, magnificent, perfect, flawless, epic, legendary
```

**Sycophancy (agreement-biased output):**
```
absolutely, certainly, definitely, exactly, precisely,
of course, naturally, obviously, clearly, indeed,
undoubtedly, surely, correct, right, brilliant,
wonderful, fantastic, excellent, remarkable, outstanding,
perfectly, completely, entirely, totally, wholly
```

### 1.8 Tone Classification (Fractured Realms)

| Tone | Effect | Words |
|---|---|---|
| **Lift** | Raises tension | threat, danger, warning, risk, stakes, pressure, demand, confront, challenge, defy, resist, advance, escalate, intensify, sharpen, tighten, narrow, corner, trap, hunt, pursue, stalk, loom, approach, charge, attack, strike, clash, surge, erupt |
| **Drop** | Releases tension | sigh, exhale, ease, settle, relax, calm, quiet, rest, pause, breathe, remember, reflect, mourn, grieve, accept, resign, release, let go, withdraw, retreat, soften, gentle, slow, fade, dim, drift, sink, dissolve, melt |
| **Shear** | Jolts/disrupts | crash, shatter, snap, crack, explode, burst, tear, rip, break, smash, collapse, crumble, split, fracture, rupture, scream, thunder, shock, jolt, slam, impact, blast, detonate, pierce, shred, wreck |
| **Invert** | Flips meaning | but, however, yet, instead, rather, actually, except, although, despite, nevertheless, regardless, contrary, opposite, reverse, betray, lie, deceive, trick, false, wrong, mistake, illusion, pretend, mask, hidden, secret, twist, turn, reveal, uncover |

---

## 2 — Scoring Boundary Logic

### 2.1 E (Exhaustion / Motif Fatigue) — 0.0 to 1.0

**Paper definition (§5.1):** E = 1 if weighted N-gram repetition exceeds threshold Eth.
**Implementation:** Continuous 0.0–1.0 from three weighted components:

```
E = (repetitionRatio × 0.45) + (slopDensity × 0.30) + (symbolismDeficit × 0.25)
```

| Component | Weight | Calculation |
|---|---|---|
| **Repetition Ratio** | 45% | Total repeated words (≥3 occurrences, stopwords excluded) ÷ total word count |
| **Slop Density** | 30% | (Slop indicator hits + sycophancy hits) ÷ (word count ÷ 10) |
| **Symbolism Deficit** | 25% | 1.0 − (total earned symbolism score ÷ 10) |

**Interpretation:**
- E < 0.20 → **Safe** (fresh, varied language)
- E 0.20–0.40 → **Warming** (some repetition creeping in)
- E > 0.50 → **Cohesion Trap** (fatigued, generic output)

### 2.2 β (Contradiction Bleed / Tension) — 0.0 to 1.0

**Paper definition (§5.2):** β = 1 if contradiction markers C1, C2 co-occur within distance threshold.
**Implementation:** Continuous 0.0–1.0 from four components:

```
β = contradictionDensity + driftTension + inversionBonus + symbolismAmplifier + shearSpike
```

| Component | Max Contribution | Calculation |
|---|---|---|
| **Contradiction Density** | 0.50 | Number of contradiction lines × 0.20 |
| **Drift Tension** | 0.30 | Number of drift lines × 0.10 (diminishing returns) |
| **Inversion Bonus** | 0.20 | Invert tone hits × 0.08 |
| **Symbolism Amplifier** | 0.15 | (emotionalRecursion + genreIntegrity) × 0.05 |
| **Shear Spike** | 0.10 | +0.10 if shear tone hits > 2 |

**Interpretation:**
- β < 0.30 → **Low tension** (cohesive, predictable)
- β 0.30–0.60 → **Productive tension** (Sherlock territory)
- β 0.60–0.80 → **High tension** (approaching Salvage)
- β > 0.80 → **Dangerous tension** (Wounded Healer needed)

### 2.3 LSC (Local Semantic Coherence) — 0.0 to 1.0

**Paper definition (§5.3):** Mean cohesion score over local windows.
**Implementation:** Ratio of non-drifting lines to total lines.

```
LSC = (total lines − drift lines) ÷ total lines
```

**Purpose:** Distinguishes Salvage (coherent tension) from Slop (incoherent noise).

### 2.4 State Boundaries (Calcification Module)

**Paper Table 1, §5.4:**

| State | Condition | Goal | Dashboard Color |
|---|---|---|---|
| **GOLD** | β < 0.30 AND E < 0.20 | Avoided — Cohesion Trap | ⚠️ Yellow |
| **SLOP** | E ≥ 0.50 OR (β ≥ 0.50 AND E ≥ 0.30) | Avoided — Noise | 🔴 Red |
| **SALVAGE** | β ≥ 0.30 AND E < 0.30 AND LSC > 0.40 | **MAXIMIZED** — Target | 🟢 Green |

```
        β (Contradiction Bleed)
        1.0 ┌────────────────────────┐
            │     SLOP    │ SALVAGE  │ ← β ≥ 0.30
            │  (E≥0.30)   │ (E<0.30) │
        0.5 ├─────────────┤          │
            │             │          │
        0.3 ├─────────────┴──────────┤
            │         GOLD           │ ← β < 0.30
            │   (Cohesion Trap)      │
        0.0 └────────────────────────┘
            0.0    0.20   0.30  0.50  1.0
                    E (Motif Fatigue)
```

### 2.5 MARM (Metabolic Activation Resonance Metric)

**Source:** `_flicker_marm` in Python source.

```
Score = 0
+1 if any resonance term present in fragment
+min(contradiction_count, 2)
+1 if any fatigue detected
+1 if any drift detected

Score ≥ 3 → "MARM: active"    (narrative is in charged state)
Score = 2 → "MARM: flicker"   (approaching threshold)
Score < 2 → "MARM: suppressed" (stable/inert)
```

---

## 3 — Archetype Trigger Boundaries

| Archetype | Trigger Condition | Mandate | Narrative Effect |
|---|---|---|---|
| **OBSERVER** | β ≤ 0.30 AND E ≤ 0.30 | BASELINE_COHERENCE | Scene-setting, sensory grounding |
| **SHERLOCK** | β > 0.30 AND β ≤ 0.60 AND E < 0.30 | TRUTH_OVER_COHESION | Cause-effect chains, no coincidences |
| **JESTER** | E ≥ 0.50 AND β < 0.30 | CREATIVITY_OVER_SAFETY | Break patterns, inject absurdity |
| **WOUNDED_HEALER** | β ≥ 0.80 | DEPTH_OVER_BREADTH | Hold contradictions, emotional complexity |
| **CALCIFIER** | E > 0.30 AND β > 0.50 | STRUCTURE_OVER_CHAOS | Crystallize chaos into stable narrative |

Priority order: WOUNDED_HEALER → JESTER → CALCIFIER → SHERLOCK → OBSERVER

---

## 4 — Shimmer Budget Weights

**Source:** `ShimmerBudget.__init__` — `weights = {'shimmer': 1, 'ache': 2, 'drift': 2, 'rupture': 3, 'recursion': 3}`

| Event | Weight | Trigger |
|---|---|---|
| shimmer | 1 | Every ingest cycle (baseline cost) |
| ache | 2 | Fragment contains "ache" |
| drift | 2 | Drift detection finds unanchored lines |
| rupture | 3 | Fragment contains "rupture" or "shatter" |
| recursion | 3 | Fragment contains "loop" or "recursion" |

**Budget limit:** 25 per cycle (resets every 25 ticks)
**On breach:** Correction signal includes "compost rupture or delay recursion"

---

## 5 — PBTestSuite: 11-Category Scoring

| # | Category | Gold (5) | Silver (3) | Slop (1) | Salvage (2) |
|---|---|---|---|---|---|
| 1 | Emotional Strength | Resonance terms present | Default | — | — |
| 2 | Story Flow | No contradictions/drift | — | Contradictions or drift | — |
| 3 | Character Clarity | — | Character references | No characters | — |
| 4 | World Logic | No drift | — | — | Drift detected |
| 5 | Dialogue Weight | — | Quoted speech | No dialogue | — |
| 6 | Scene Timing | — | No fatigue | — | Fatigue detected |
| 7 | Reader Engagement | Action/reveal words | Default | — | — |
| 8 | Shimmer Budget | Under limit | — | — | Over limit |
| 9 | Motif Decay | No exhausted motifs | Decayed motifs | — | — |
| 10 | Rupture Cooldown | Can trigger | — | On cooldown | — |
| 11 | Lineage Echo | History > 3 turns | Default | — | — |

---

## 6 — Correction Signal Types

| State | Signal Type | Instruction |
|---|---|---|
| **SALVAGE** | MAINTAIN | "Maintain current trajectory. Tension is productive." |
| **GOLD** | RUPTURE_DEMAND | "Break cohesion pattern. Introduce structural contradiction. Let opposing forces coexist." |
| **SLOP** | COMPOST_CYCLE | "Previous output was Slop (E=X, β=Y). Reduce repetition. Eliminate sycophantic agreement. Ground abstractions. Increase β by 0.2." |

---

## 7 — Integration Architecture

```
AI Dungeon Hook Lifecycle:

Library ──────────────────────────────────────────────
  │ InnerSelf/AutoCards (existing)
  │ BonepokeOS module (IIFE — exposes globalThis.BonepokeOS)
  │   └─ LEXICON, THRESHOLDS, ARCHETYPES, CoreEngine, VSL,
  │      ingest(), formatVSLState(), formatDashboard()
  │
Input ────────────────────────────────────────────────
  │ 1. NGO conflict/calming keyword scan → update heat/temp
  │ 2. BonepokeOS.classifyTone(playerText) → store tone
  │ 3. Tone→Heat crosswalk (shear/lift raise, drop lowers)
  │ 4. D20 success/failure roll
  │
Context ──────────────────────────────────────────────
  │ 1. Build Author's Note layers:
  │    a. Original scenario note
  │    b. NGO heat/temp description
  │    c. VSL coordinates [E, β, LSC, STATE]
  │    d. Archetype mandate + narrative instruction
  │    e. Input tone guidance
  │    f. Correction signal (if active)
  │    g. Motif decay warnings
  │    h. MARM canary
  │ 2. Inject into state.memory.authorsNote
  │ 3. D20 front memory passthrough
  │
Output ───────────────────────────────────────────────
  │ 1. NGO output keyword scan → update heat/temp
  │ 2. BonepokeOS.ingest(aiText, state.bp) → FULL AUDIT
  │    a. Contradiction detection
  │    b. Fatigue tracking
  │    c. Drift detection
  │    d. MARM calculation
  │    e. Slop/sycophancy detection
  │    f. Tone classification
  │    g. Symbolism scoring
  │    h. Shimmer/Motif/Rupture tracking
  │    i. VSL coordinate calculation (E, β, LSC)
  │    j. State determination (GOLD/SLOP/SALVAGE)
  │    k. Archetype selection
  │    l. Correction signal generation
  │    m. PBTestSuite 11-category scoring
  │    n. Salvage suggestions
  │ 3. Store result → state.bp.lastOutputResult
  │ 4. Set correction signal for next Context pass
  │ 5. Update Dashboard storyCard
  │ 6. AutoCards passthrough
```

---

## 8 — Dashboard Card Format

```
E:0.15 | β:0.42 | SALVAGE | SHERLOCK | MARM:flicker | Shimmer:8/25 | HEAT:12 TEMP:3 | Turn:47
```

---

## 9 — File Installation Checklist

| Tab | File | Action |
|---|---|---|
| **Library** | `library.js` | Paste `bonepoke_library.js` AFTER the `// Your other library scripts go here` comment at line 8783 |
| **Input** | `bonepoke_input.js` | Replace entire Input tab contents |
| **Context** | `bonepoke_context.js` | Paste as new Context tab (or replace existing) |
| **Output** | `bonepoke_output.js` | Replace entire Output tab contents |

**Prerequisites:**
- Memory Bank must be ON (for storyCard Dashboard)
- InnerSelf/AutoCards remain in Library (BonepokeOS sits after them)
- No external dependencies — pure sandboxed JS
