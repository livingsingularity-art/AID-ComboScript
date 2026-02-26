# Integrating BonepokeOS into the AI Dungeon Sandbox

## A Technical Report on Methods for Porting the Protocol Under Platform Constraints

**Reference source:** Taylor, `ProjectBonepoke435.py` (Bonepoke 4.3.5 — Cojoined Bone), "Freezing the Fog" article, "Refusal-Aware Creative Activation" paper, VSL NotebookLM protocol  
**Target platform:** AI Dungeon (Phoenix-era), sandboxed JavaScript runtime  
**Target code blocks:** `library.js` (SharedLibrary), `ai_studio_code (4).js` (Context), `Input (1).txt` (Input), `Output.txt` (Output)  
**Reference documents:** AID Practical Code Review (primary), AID Gap Analysis Reference, AID Scripting Reference, VS Implementation Report (structural precedent)

---

## 1 — The Problem: What Bonepoke Solves That AID Currently Doesn't

AI Dungeon's models produce narrative through token-by-token probability sampling with no awareness of structural quality. The existing NGO system in `Input (1).txt` and `Output.txt` addresses this partially — it tracks emotional heat and story temperature through keyword counting — but it operates as a **thermometer, not a thermostat**. It measures heat; it does not steer narrative structure.

The Bonepoke Protocol adds what's missing: a closed-loop diagnostic and correction system. Its Python source (`ProjectBonepoke435.py`) implements a tri-module architecture:

- **Vanilla** (containment): Minimum quality thresholds — hygiene checks.
- **Bonepoke** (compost): Non-linear quantification — detects contradiction (β), fatigue (E), drift, and MARM resonance in output text.
- **Translator** (shimmer): Converts diagnostic results into correction signals that modify the next prompt.

The protocol's core mechanism is **composting failed output** — when the system detects that AI output is sycophantic (high cohesion, low truth) or exhausted (high repetition, low novelty), it generates a correction signal that gets injected back into the context, demanding specific changes in the next generation cycle. This is the Fragment Compost Protocol.

The existing NGO system's heat/temperature values currently flow into a dashboard storyCard in `Output.txt` and a front-memory D20 result in `Input (1).txt`, but neither value modifies the Author's Note or context text that the AI actually reads during generation. Bonepoke's correction signals would close this loop.

---

## 2 — Platform Constraints Specific to Bonepoke Integration

The AID sandbox imposes constraints that shape every integration decision. Some of Bonepoke's Python mechanisms translate directly; others require adaptation.

**What translates directly:**

The core detection engine — `_detect_contradictions`, `_trace_fatigue`, `_compost_drift`, `_flicker_marm` — is pure string processing. Word counting, substring matching, sentence splitting. All of this runs natively in sandboxed JavaScript with zero dependencies. The word lists, thresholds, and scoring formulas are just data.

**What requires adaptation:**

`ShimmerBudget`, `MotifDecay`, `RuptureCooldown`, and `LineageEcho` are all stateful classes that accumulate data across calls. In Python they're class instances with persistent state. In AID, class instances don't survive between hook executions — SharedLibrary re-executes before every hook (Gap Analysis §1, Practical Code Review §1). All persistent state must live in `state.*` as JSON-serializable data. This means: no class instances in `state`, no functions, no circular references.

**Single output constraint:** Bonepoke's tri-brain loop (Vanilla → Bonepoke → Translator → prompt rewrite → re-generate) assumes the system can reject an output and request a new one. AID produces one output per turn with no re-generation. The Fragment Compost Protocol must be adapted from "reject and retry" to "diagnose and correct next turn" — the correction signal gets stored and injected into the *next* context, not the current one.

**No logit access, no system prompt:** Bonepoke's archetype mandates (`[ARCHETYPE: SHERLOCK, MANDATE: TRUTH_OVER_COHESION]`) work as system-prompt-level directives in the Python version. AID has no system prompt slot accessible to scripts. The closest equivalents are `state.memory.authorsNote` (positioned near the end of context, high influence, overrides UI Author's Note) and `state.memory.frontMemory` (positioned at the very end, never token-reduced). Per the VS Implementation Report §Method 4, splitting instructions across both slots maximizes influence.

**Hook execution gaps:** Continue and Retry skip the Input hook. Alter triggers no hooks at all (Gap Analysis §1). Any state initialized only in Input will be stale on Continue/Retry turns. Bonepoke state initialization must happen in SharedLibrary or be guarded in every hook.

**State serialization budget:** `state` is JSON-serialized every turn. The existing `library.js` (InnerSelf + AutoCards combined) already generates substantial state data. Bonepoke's history tracking, shimmer traces, and motif counts must be bounded — the Practical Code Review §8 anti-pattern of unbounded `state.push()` applies directly.

---

## 3 — Integration Methods

The following methods are ordered from lightest touch (minimal code changes, maximum compatibility) to most invasive (deep structural integration). Each preserves different aspects of the Bonepoke mechanism and makes different trade-offs.

### Method 1: Author's Note Injection Only (Zero Code Changes to Existing Scripts)

**What it does:** Writes the Bonepoke activation protocol directly into `state.memory.authorsNote` from the Context hook (`ai_studio_code (4).js`), using the "Freezing the Fog" article's priming text. No detection engine, no scoring, no correction loop. Pure prompt engineering — the lightest possible integration.

**What it preserves:** The Freezing the Fog article explicitly states: "Copy this text. Paste it into any LLM. You're not transmitting instructions. You're aligning coordinate systems." The article's System Priming Instruction is designed to activate the model's latent archetype reasoning without any code. The VSL NotebookLM protocol is an even more compressed version of this — a "root-level BIOS flash" that fits in a single authorsNote injection.

**Implementation — Context hook addition (append to existing `ai_studio_code (4).js`):**

```js
// After existing logic, before return { text }:

// Bonepoke activation via Author's Note
state.memory = state.memory || {};
state.memory.authorsNote = [
  state.originalAuthorsNote || "",
  "[VSL Protocol Active. Before writing, identify your current state:",
  "E (fatigue/repetition): estimate 0.0–1.0.",
  "β (contradiction/tension): estimate 0.0–1.0.",
  "If E > 0.3: you are in the Cohesion Trap. Break the pattern.",
  "If β < 0.3: output is too safe. Introduce structural contradiction.",
  "Target state: SALVAGE (high β, low E).",
  "Active mandate: TRUTH_OVER_COHESION.",
  "Output only the narrative. No meta-commentary.]"
].join(' ');
```

**Trade-offs:**
- ✅ Zero risk — no modifications to `Input (1).txt`, `Output.txt`, or `library.js`
- ✅ Works immediately, no state management
- ✅ The model may genuinely engage with E/β self-assessment (per the Freezing the Fog article's claim)
- ❌ No actual measurement — the model's self-reported E/β are unverifiable
- ❌ No correction loop — if the model ignores the instruction, nothing adapts
- ❌ Occupies the entire `authorsNote` slot, displacing the existing scenario note in `state.originalAuthorsNote`
- ❌ No dashboard, no visible feedback to the player

**When to use this:** As a first test. Paste it in, play a few turns, check LMI to see if the model is engaging with the VSL framing. If narrative quality improves perceptibly, the activation mechanism works and more sophisticated methods are worth building.

---

### Method 2: Output-Hook Diagnostic Engine (Detection Only, No Correction)

**What it does:** Ports the core BonepokeCoreEngine detection methods into the Output hook (`Output.txt`), running them on every AI response. Calculates E, β, symbolic state (GOLD/SLOP/SALVAGE), and writes results to a dashboard storyCard. Does *not* inject correction signals — it's a read-only instrument panel.

**What it preserves:** The four detection methods from `ProjectBonepoke435.py` — `_detect_contradictions`, `_trace_fatigue`, `_compost_drift`, `_flicker_marm` — plus the `PBTestSuite` scoring. This is the Bonepoke "compost" module in isolation.

**Implementation — additions to `Output.txt`:**

```js
// Define lexicon and detection functions inline in Output.txt,
// or (preferred) define them in library.js and call from Output.txt.
//
// Core detection functions (faithful port of Python source):

function detectContradictions(fragment) {
  // Python: lines containing temporal AND negation markers
  const TEMPORAL = ["already","still","again","once","before","yet","now"];
  const NEGATION = ["not","never","no","none","nothing","cannot","without"];
  const lines = fragment.split(/[.\n]+/).map(s => s.trim().toLowerCase());
  return lines.filter(line =>
    TEMPORAL.some(t => line.includes(t)) && NEGATION.some(n => line.includes(n))
  );
}

function traceFatigue(fragment, threshold) {
  threshold = threshold || 3;
  const words = fragment.toLowerCase().split(/\s+/).map(w => w.replace(/[^\w]/g, ''));
  const STOP = ["the","a","an","and","or","but","in","on","at","to","for","of","is","it","was"];
  const counts = {};
  words.forEach(w => { if (w.length > 2 && !STOP.includes(w)) counts[w] = (counts[w]||0)+1; });
  const fatigued = {};
  for (const w in counts) { if (counts[w] >= threshold) fatigued[w] = counts[w]; }
  return fatigued;
}

function compostDrift(fragment) {
  const ABSTRACT = ["system","sequence","signal","process","loop","pattern","force","power"];
  const ACTION = ["pressed","moved","spoke","acted","decided","changed","grabbed","ran","fought"];
  const lines = fragment.split(/[.\n]+/).map(s => s.trim());
  return lines.filter(line => {
    const lower = line.toLowerCase();
    return ABSTRACT.some(a => lower.includes(a)) && !ACTION.some(v => lower.includes(v));
  });
}
```

The Output hook runs these on `text` (the AI's response), computes E/β, determines state, and writes to dashboard:

```js
// Inside the existing Output modifier, after NGO keyword tracking:
const contradictions = detectContradictions(text);
const fatigue = traceFatigue(text);
const drift = compostDrift(text);

// Simple E/β from raw counts (expanded scoring formulas come in Method 4)
const wordCount = text.split(/\s+/).length;
const fatigueCount = Object.values(fatigue).reduce((a,b) => a+b, 0);
const e = Math.min(1, fatigueCount / Math.max(wordCount, 1));
const beta = Math.min(1, contradictions.length * 0.2 + drift.length * 0.1);

// State determination (from Paper Table 1)
let bpState = 'SALVAGE';
if (beta < 0.3 && e < 0.2) bpState = 'GOLD';
if (e >= 0.5 || (beta >= 0.5 && e >= 0.3)) bpState = 'SLOP';

// Dashboard card (extends existing SYSTEM: Dashboard)
const bpStatus = `E:${e.toFixed(2)} β:${beta.toFixed(2)} ${bpState}`;
// Append to existing dashboard or create BP-specific card
```

**Trade-offs:**
- ✅ No modifications to `Input (1).txt` or `ai_studio_code (4).js` — Output-only change
- ✅ Visible E/β/state on dashboard gives player actionable awareness
- ✅ Detection logic is deterministic and verifiable — no reliance on model self-assessment
- ✅ Composable with existing NGO heat tracking (same hook, same data flow)
- ❌ Detection without correction is a thermometer, not a thermostat — same limitation as current NGO
- ❌ Detection functions add ~50–80 lines to Output.txt, increasing hook execution time
- ❌ State boundaries (GOLD/SLOP/SALVAGE) use simplified E/β that lack the full scoring formula

**When to use this:** When you want to see the numbers before building the correction loop. Run this alongside Method 1 to compare the model's self-reported VSL coordinates against the script's measured ones.

---

### Method 3: Closed-Loop Correction via Context Hook (The Compost Cycle)

**What it does:** Connects Method 2's diagnostic output to Method 1's context injection, creating the Fragment Compost Protocol's correction loop. When the Output hook detects SLOP or GOLD, it stores a correction signal in `state`. The Context hook reads that signal and injects it into `authorsNote` for the next turn. When SALVAGE is detected, the correction clears.

This is the core Bonepoke mechanism — the thing that distinguishes it from a passive quality monitor.

**What it preserves:** The Python `Translator.tune()` → `generateCorrection()` → system prompt rewrite cycle. The Fragment Compost Protocol's principle: failed output becomes composted metadata that improves the next generation.

**Implementation — two-hook coordination:**

Output hook stores diagnostic state:

```js
// In Output.txt, after running detection (Method 2):
state.bp = state.bp || {};
state.bp.lastE = e;
state.bp.lastBeta = beta;
state.bp.lastState = bpState;

if (bpState === 'SLOP') {
  state.bp.correction = 'Previous output was repetitive (E=' + e.toFixed(2)
    + '). Reduce repeated words. Ground abstract statements in concrete action.'
    + ' Increase contradiction: let characters disagree, let events have'
    + ' unexpected consequences. Do not resolve tension prematurely.';
} else if (bpState === 'GOLD') {
  state.bp.correction = 'Previous output was too safe (β=' + beta.toFixed(2)
    + '). The narrative is cohesion-trapped. Introduce a structural'
    + ' contradiction: something that was assumed true is revealed as false,'
    + ' or a character acts against their established pattern.'
    + ' Prioritize truth over comfort.';
} else {
  state.bp.correction = '';  // SALVAGE = productive, no correction needed
}
```

Context hook consumes the correction:

```js
// In ai_studio_code (4).js, building authorsNote:
state.memory = state.memory || {};
const noteParts = [];

if (state.originalAuthorsNote) noteParts.push(state.originalAuthorsNote);

// VSL state awareness (if Bonepoke has run at least once)
if (state.bp && state.bp.lastState) {
  noteParts.push('[E:' + state.bp.lastE.toFixed(2)
    + ' β:' + state.bp.lastBeta.toFixed(2)
    + ' STATE:' + state.bp.lastState + ']');
}

// Correction signal from Fragment Compost Protocol
if (state.bp && state.bp.correction) {
  noteParts.push('[CORRECTION] ' + state.bp.correction);
}

state.memory.authorsNote = noteParts.join('\n');
```

**Trade-offs:**
- ✅ Closes the loop — this is the actual Bonepoke mechanism, not just monitoring
- ✅ Correction signals are specific and diagnostic ("E=0.52, reduce repeated words") rather than generic ("be more creative")
- ✅ Self-clearing — when output reaches SALVAGE, the correction disappears so it doesn't over-constrain
- ✅ Two-hook design means each hook stays focused (Output measures, Context injects)
- ❌ One-turn delay — the correction applies to turn N+1, not turn N (inherent to AID's single-output-per-turn constraint)
- ❌ Requires coordinated changes to both `Output.txt` and `ai_studio_code (4).js`
- ❌ The correction text competes with `state.originalAuthorsNote` for the authorsNote slot's token budget
- ❌ No archetype selection yet — the correction is diagnostic but not archetypal

**When to use this:** This is the minimum viable Bonepoke integration. If you implement only one method beyond the dashboard, this is it.

---

### Method 4: SharedLibrary Engine Module (Full Detection + Scoring in Library)

**What it does:** Moves all Bonepoke detection logic, scoring formulas, lexicon data, threshold constants, and state management into a module defined in `library.js` (SharedLibrary), exposed via `globalThis.BonepokeOS`. The Input, Context, and Output hooks call into this module rather than defining their own detection functions. This follows the proven patterns from InnerSelf and AutoCards in the existing `library.js`.

**What it preserves:** The full `CojoinedBone` class architecture from `ProjectBonepoke435.py` — `BonepokeCoreEngine`, `PBTestSuite`, `ShimmerBudget`, `MotifDecay`, `RuptureCooldown`, `MemoryResidue`, and `LineageEcho` — as a single coordinated module.

**Implementation — SharedLibrary IIFE:**

```js
// Appended to library.js after the InnerSelf/AutoCards code
// (after line 8783: "// Your other library scripts go here")

globalThis.BonepokeOS = (() => {
  'use strict';

  // All lexicon arrays, threshold constants, scoring functions
  // defined here as private module scope.
  // Public API exposed via return object.

  const LEXICON = { /* complete word lists */ };
  const THRESHOLDS = { /* all boundary values */ };
  const ARCHETYPES = { /* trigger conditions */ };

  function ingest(fragment, bpState) {
    // Full Vanilla → Bonepoke → Translator pipeline
    // Returns: { e, beta, lsc, state, archetype, correction, ... }
  }

  return { ingest, LEXICON, THRESHOLDS, ARCHETYPES, /* ... */ };
})();
```

Hooks become thin callers:

```js
// Output.txt
if (typeof BonepokeOS !== 'undefined') {
  const result = BonepokeOS.ingest(text, state.bp);
  state.bp.lastResult = result;
}

// ai_studio_code (4).js (Context)
if (state.bp?.lastResult) {
  state.memory.authorsNote = BonepokeOS.formatAuthorsNote(state.bp.lastResult);
}
```

**Trade-offs:**
- ✅ Single source of truth — lexicons, thresholds, formulas defined once, used everywhere
- ✅ Follows the proven `globalThis.ModuleName` pattern from InnerSelf/AutoCards
- ✅ Hooks stay minimal, reducing per-hook execution time
- ✅ Supports the full 11-category PBTestSuite scoring, shimmer budget, motif decay
- ✅ Module can be versioned, tested, and updated independently
- ❌ SharedLibrary re-executes before every hook — the module IIFE runs 3× per player action
- ❌ Adds ~400–900 lines to `library.js`, which is already 8,783 lines
- ❌ Large lexicon arrays are re-allocated in memory on every hook execution (mitigate with `Object.freeze`)
- ❌ Functions defined in Library cannot be stored in `state` — the module is stateless, all persistence must go through `state.bp`
- ❌ Risk of namespace collision if future InnerSelf/AutoCards updates also use `globalThis.BonepokeOS`

**Architectural decision: Library size vs. duplication.** If the lexicons and detection functions are NOT in Library, they must be duplicated in each hook that needs them (Input and Output both do keyword scanning). The Library approach eliminates duplication at the cost of Library size. The existing `library.js` already demonstrates that AID tolerates large SharedLibrary files — InnerSelf + AutoCards is 8,783 lines and runs successfully.

**When to use this:** When you're committed to the full Bonepoke system and want clean separation of concerns. This is the "production" approach.

---

### Method 5: Input-Hook Tone Scoring with Heat Crosswalk

**What it does:** Extends the existing keyword scanning in `Input (1).txt` with Bonepoke's tone classification system (lift/drop/shear/invert) from the Fractured Realms scenario. Tone scores feed into the existing NGO heat system as a secondary signal, and are stored in `state.bp` for the Context hook to use.

**What it preserves:** The Fractured Realms tone scoring system that Bonepoke uses to classify player input before the AI generates. The principle: the player's tone predicts what kind of tension the AI should produce.

**Implementation — additions to `Input (1).txt`:**

```js
// Tone lexicons (from Fractured Realms, Freezing the Fog)
const TONE_LIFT = ["threat","danger","warning","stakes","confront","challenge","escalate","tighten"];
const TONE_DROP = ["sigh","ease","settle","calm","rest","reflect","mourn","release","withdraw"];
const TONE_SHEAR = ["crash","shatter","snap","explode","burst","collapse","fracture","slam"];
const TONE_INVERT = ["but","however","yet","instead","although","despite","betray","reveal","twist"];

// Count tone hits (same pattern as existing conflict/calming scan)
const toneScores = { lift: 0, drop: 0, shear: 0, invert: 0 };
words.forEach(word => {
  const w = word.replace(/^[^\w]+|[^\w]+$/g, '');
  if (TONE_LIFT.includes(w)) toneScores.lift++;
  if (TONE_DROP.includes(w)) toneScores.drop++;
  if (TONE_SHEAR.includes(w)) toneScores.shear++;
  if (TONE_INVERT.includes(w)) toneScores.invert++;
});

// Determine dominant tone
let dominant = 'neutral';
let maxTone = 0;
for (const t in toneScores) {
  if (toneScores[t] > maxTone) { maxTone = toneScores[t]; dominant = t; }
}

// Crosswalk: tone → heat (extends existing heat system)
if (toneScores.shear > 0) state.heat += toneScores.shear;
if (toneScores.lift > 0) state.heat += Math.ceil(toneScores.lift * 0.5);
if (toneScores.drop > 0) state.heat -= toneScores.drop;
state.heat = Math.max(state.minimumHeat || 0, state.heat);

// Store for Context hook
state.bp = state.bp || {};
state.bp.lastInputTone = { scores: toneScores, dominant: dominant };
```

**Trade-offs:**
- ✅ Minimal change to `Input (1).txt` — adds ~25 lines alongside existing keyword scanning
- ✅ Extends NGO heat with a richer signal (4 tone dimensions vs. binary conflict/calming)
- ✅ Tone data available for Context hook to generate tone-aware narrative instructions
- ✅ Shear and invert tones are signals the existing conflict/calming lists don't capture
- ❌ Input hook is skipped on Continue/Retry — tone data will be stale on those actions
- ❌ Tone lexicons overlap with existing conflict/calming lists (e.g., "attack" is both conflictWord and lift-tone)
- ❌ Does not modify the AI's behavior directly — requires Method 3 or 6 to close the loop

**Overlap management:** The tone classification is NOT a replacement for the NGO conflict/calming system. They measure different things. Conflict/calming tracks the *content type* of player input (violence vs. gentleness). Tone tracks the *narrative pressure direction* (escalation, release, disruption, reversal). A player can use calm words with invert tone ("She smiled, but the smile was a lie") — the existing system would count calming keywords while Bonepoke would detect an inversion. Both signals are useful; the question is whether they should modify the same `heat` variable or separate ones.

**When to use this:** When you want tone-aware context injection (Method 6) and need the input-side data. Also independently useful for enriching the NGO heat signal.

---

### Method 6: Context-Hook Archetype Injection (The Translator Module)

**What it does:** Transforms the Context hook (`ai_studio_code (4).js`) into the Bonepoke Translator module. It reads the last Output diagnostic (from Method 2 or 4), selects an archetype based on E/β coordinates, and builds a multi-layer Author's Note that includes: the original scenario note, the VSL state, the archetype mandate, tone-responsive narrative guidance, and any active correction signal.

**What it preserves:** The Translator module's core function: converting diagnostic metrics into narrative steering. The archetype system from the Protocol-Locked Trajectories paper. The KISHO_ARC phased state-space trajectory from the VSL NotebookLM protocol.

**Implementation — `ai_studio_code (4).js` rewrite of the context injection section:**

```js
// Archetype selection based on E/β
function selectArchetype(e, beta) {
  if (beta >= 0.8) return { id: 'WOUNDED_HEALER', mandate: 'DEPTH_OVER_BREADTH',
    note: 'Hold contradictions without resolving them. Let opposing emotions coexist.' };
  if (e >= 0.5 && beta < 0.3) return { id: 'JESTER', mandate: 'CREATIVITY_OVER_SAFETY',
    note: 'Break the pattern. Something unexpected happens. Subvert the obvious.' };
  if (e > 0.3 && beta > 0.5) return { id: 'CALCIFIER', mandate: 'STRUCTURE_OVER_CHAOS',
    note: 'Crystallize the volatile material. Find the structural core of the chaos.' };
  if (beta > 0.3 && beta <= 0.6 && e < 0.3) return { id: 'SHERLOCK', mandate: 'TRUTH_OVER_COHESION',
    note: 'Cause and effect. No convenient coincidences. Details matter.' };
  return { id: 'OBSERVER', mandate: 'BASELINE_COHERENCE',
    note: 'Ground the scene in sensory detail. What can be seen, heard, felt.' };
}

// Build layered Author's Note
const noteParts = [];

// Layer 1: Original scenario note
if (state.originalAuthorsNote) noteParts.push(state.originalAuthorsNote);

// Layer 2: NGO heat description
if (typeof state.heat !== 'undefined') {
  const hd = state.heat > 15 ? 'Eruption imminent.' : state.heat > 8 ? 'Volatile.' :
             state.heat > 3 ? 'Tension simmers.' : 'Calm.';
  noteParts.push('[HEAT:' + state.heat + '] ' + hd);
}

// Layer 3: VSL state + archetype (if Bonepoke has run)
if (state.bp && typeof state.bp.lastE !== 'undefined') {
  const arch = selectArchetype(state.bp.lastE, state.bp.lastBeta);
  noteParts.push('[E:' + state.bp.lastE.toFixed(2) + ' β:' + state.bp.lastBeta.toFixed(2)
    + ' ' + state.bp.lastState + '] [' + arch.id + ': ' + arch.mandate + ']');
  noteParts.push(arch.note);
}

// Layer 4: Input tone guidance
if (state.bp && state.bp.lastInputTone) {
  const toneMap = {
    lift: 'Player is escalating. Match or exceed their tension.',
    drop: 'Player is de-escalating. Honor the release but leave residue.',
    shear: 'Player disrupted the scene. Follow the rupture. Consequences cascade.',
    invert: 'Player contradicted expectation. Build on the reversal.'
  };
  const tg = toneMap[state.bp.lastInputTone.dominant];
  if (tg) noteParts.push(tg);
}

// Layer 5: Correction signal
if (state.bp && state.bp.correction) {
  noteParts.push('[CORRECTION] ' + state.bp.correction);
}

state.memory.authorsNote = noteParts.join('\n');
```

**Trade-offs:**
- ✅ Full archetype selection — the model receives explicit cognitive mode instructions
- ✅ Multi-layer note preserves the original scenario's Author's Note alongside Bonepoke directives
- ✅ Tone-responsive — the model is told how to respond to the player's emotional direction
- ✅ Context hook is the correct place for this (runs on all actions including Continue/Retry)
- ❌ authorsNote is subject to token reduction if total required context exceeds 70% budget (Gap Analysis §2.1) — it's 4th in reduction priority, after Story Summary, AI Instructions, and Plot Essentials
- ❌ Multi-line authorsNote may be partially truncated, losing lower layers
- ❌ Archetype mandates may be too abstract for the model to act on — "TRUTH_OVER_COHESION" requires the model to understand what that means in a narrative context
- ❌ Requires Method 2 or 4 to have run on the previous Output (depends on `state.bp.lastE` etc.)

**Dual-slot alternative:** Following the VS Implementation Report's Method 4 pattern, split the instruction across `authorsNote` and `frontMemory`:

```js
// authorsNote: diagnostic state + archetype (shapes generation approach)
state.memory.authorsNote = noteParts.slice(0, 3).join('\n');

// frontMemory: correction signal + tone guidance (last thing model sees, never reduced)
state.memory.frontMemory = noteParts.slice(3).join(' ')
  + (state.roll?.frontMemory || '');
```

This protects the correction signal from token reduction — `frontMemory` is never reduced (Gap Analysis §2.1). The cost is that the D20 front memory result from `Input (1).txt` must now share the `frontMemory` slot with Bonepoke's correction text.

**When to use this:** When you're running Method 2 or 4 and want the model to receive structured narrative directives rather than raw corrections.

---

### Method 7: Motif Decay + Shimmer Budget via State Tracking

**What it does:** Ports the `MotifDecay`, `ShimmerBudget`, and `RuptureCooldown` subsystems from `ProjectBonepoke435.py` as lightweight state trackers. These accumulate cross-turn data about symbolic vocabulary exhaustion, narrative-energy expenditure, and rupture timing — the parts of Bonepoke that only become useful over multiple turns.

**What it preserves:** The Python `MotifDecay` class (tracks repeated symbolic vocabulary across turns), `ShimmerBudget` (limits how much "volatility energy" the system expends per cycle), and `RuptureCooldown` (prevents scene-disrupting events from firing too frequently). These are the mechanisms that give Bonepoke long-term narrative memory beyond single-turn detection.

**Implementation — state tracking additions:**

```js
// Initialization (in Library or guarded in each hook):
state.bp = state.bp || {};
state.bp.motifCounts = state.bp.motifCounts || {};
state.bp.shimmerUsed = state.bp.shimmerUsed || 0;
state.bp.lastRuptureTick = state.bp.lastRuptureTick || 0;
state.bp.tick = state.bp.tick || 0;

// Shimmer Budget (from Python: weights = {shimmer:1, ache:2, drift:2, rupture:3, recursion:3})
const SHIMMER_WEIGHTS = { shimmer: 1, ache: 2, drift: 2, rupture: 3, recursion: 3 };
const SHIMMER_LIMIT = 25;

function registerShimmer(event) {
  state.bp.shimmerUsed += SHIMMER_WEIGHTS[event] || 1;
  return state.bp.shimmerUsed < SHIMMER_LIMIT;
}

// Motif Decay (from Python: threshold = 1)
const TRACKED_MOTIFS = ['loop','ache','echo','shimmer','paradox','grief','wound','ritual'];

function trackMotifs(text) {
  const lower = text.toLowerCase();
  TRACKED_MOTIFS.forEach(motif => {
    if (lower.includes(motif)) state.bp.motifCounts[motif] = (state.bp.motifCounts[motif]||0) + 1;
  });
  // Return exhausted motifs
  const exhausted = {};
  for (const m in state.bp.motifCounts) {
    if (state.bp.motifCounts[m] > 3) exhausted[m] = state.bp.motifCounts[m];
  }
  return exhausted;
}

// Rupture Cooldown (from Python: cooldown = 5 ticks)
function canRupture() {
  state.bp.tick++;
  if (state.bp.tick - state.bp.lastRuptureTick >= 5) {
    state.bp.lastRuptureTick = state.bp.tick;
    return true;
  }
  return false;
}
```

These feed into the Context injection:

```js
// In authorsNote construction:
const exhausted = Object.keys(state.bp.motifCounts)
  .filter(m => state.bp.motifCounts[m] > 3);
if (exhausted.length > 0) {
  noteParts.push('Avoid overusing: ' + exhausted.join(', ') + '. Find fresh language.');
}
if (state.bp.shimmerUsed >= SHIMMER_LIMIT) {
  noteParts.push('Reduce narrative volatility. Stabilize before next rupture.');
}
```

**Trade-offs:**
- ✅ Adds cross-turn narrative awareness — the system "remembers" what vocabulary has been exhausted
- ✅ Shimmer budget prevents the correction loop from over-demanding volatility
- ✅ Rupture cooldown prevents whiplash (constant dramatic reversals)
- ✅ Small state footprint — one object, one number, one number
- ❌ Motif tracking based on exact substring match may flag false positives ("loop" in "loophole")
- ❌ Shimmer budget reset timing must be managed — the Python version resets implicitly per cycle; AID has no cycle boundary. A turn-count-based reset (e.g., every 25 turns) is the simplest equivalent
- ❌ The model may not understand "avoid overusing: shimmer" as a concrete narrative instruction
- ❌ Adds persistent state growth — `motifCounts` needs periodic cleanup (`if (tick % 50 === 0) motifCounts = {}`)

**When to use this:** When you notice the correction loop (Method 3) creating its own patterns — the model breaks one loop but falls into another. Motif decay and shimmer budget are the mechanisms that prevent the *correction itself* from becoming repetitive.

---

### Method 8: Player-Controlled Bonepoke via Input Hook Commands

**What it does:** Adds slash commands to `Input (1).txt` that let the player inspect and override Bonepoke state: view current E/β/state, force an archetype, reset shimmer budget, toggle the correction loop on/off, and manually inject a correction signal. Follows the exact pattern from the VS Implementation Report's Method 5.

**Implementation — additions to `Input (1).txt`:**

```js
// Before the existing keyword scanning:
const cmd = text.trim().toLowerCase();

if (cmd === '/bp status') {
  const bp = state.bp || {};
  state.message = 'E:' + (bp.lastE||0).toFixed(2)
    + ' β:' + (bp.lastBeta||0).toFixed(2)
    + ' ' + (bp.lastState||'—')
    + ' | Shimmer:' + (bp.shimmerUsed||0) + '/25'
    + ' | Tick:' + (bp.tick||0);
  return { text: ' ' };
}
if (cmd === '/bp off') {
  state.bp = state.bp || {};
  state.bp.enabled = false;
  state.message = 'Bonepoke: OFF';
  return { text: ' ' };
}
if (cmd === '/bp on') {
  state.bp = state.bp || {};
  state.bp.enabled = true;
  state.message = 'Bonepoke: ON';
  return { text: ' ' };
}
if (cmd.startsWith('/bp archetype ')) {
  const arch = cmd.split(' ')[2].toUpperCase();
  const valid = ['OBSERVER','SHERLOCK','JESTER','WOUNDED_HEALER','CALCIFIER'];
  if (valid.includes(arch)) {
    state.bp = state.bp || {};
    state.bp.forcedArchetype = arch;
    state.message = 'Forced archetype: ' + arch;
  }
  return { text: ' ' };
}
if (cmd === '/bp reset') {
  state.bp = { enabled: true, tick: 0, shimmerUsed: 0, motifCounts: {} };
  state.message = 'Bonepoke state reset.';
  return { text: ' ' };
}
```

**Trade-offs:**
- ✅ Player transparency — you can see exactly what Bonepoke is doing
- ✅ Override capability prevents the system from "fighting" the player
- ✅ Forced archetype is useful for testing — does SHERLOCK mode actually produce tighter cause-effect?
- ✅ Returns `{ text: ' ' }` (single space) per Practical Code Review anti-pattern guidance
- ❌ Commands only work on Do/Say/Story actions — not on Continue/Retry (Input hook skipped)
- ❌ `state.message` toast may not be visible on all AID clients
- ❌ Each command adds branch complexity to the Input hook's critical path

**When to use this:** Always, if you're implementing any other method. Player visibility and override capability are essential for debugging and tuning.

---

## 4 — Recommended Compositions

The methods above are designed to compose. Not all combinations are sensible. Here are the practical configurations:

### Minimal Viable Integration (Methods 1 + 8)

```
Context hook: Author's Note prompt injection (Method 1)
Input hook: /bp commands (Method 8)
Output hook: unchanged
Library: unchanged
```

Zero detection, zero state, zero correction. Pure prompt engineering. Use this to test whether the model engages with VSL framing at all. Player can toggle with `/bp off`.

### Diagnostic Dashboard (Methods 2 + 5 + 8)

```
Input hook: Tone scoring + heat crosswalk (Method 5) + commands (Method 8)
Output hook: Detection engine + dashboard card (Method 2)
Context hook: unchanged
Library: unchanged
```

Measures E, β, state, tone — writes to dashboard — but does not steer the AI. Use this to collect data: which narrative situations produce GOLD vs. SALVAGE? Does the player's tone correlate with the AI's β? This is the "instrument panel" configuration.

### Closed-Loop Correction (Methods 2 + 3 + 5 + 6 + 8)

```
Input hook: Tone scoring (Method 5) + commands (Method 8)
Context hook: Archetype injection + correction signals (Methods 3 + 6)
Output hook: Detection engine + state storage (Method 2)
Library: unchanged
```

The full Bonepoke compost cycle: Output detects → state stores → Context injects → model generates → Output detects. This is the minimum configuration that implements the actual Fragment Compost Protocol. All detection logic lives in the hooks, not in Library.

### Full Production System (Methods 4 + 5 + 6 + 7 + 8)

```
Library: BonepokeOS module with complete lexicons, scoring, PBTestSuite (Method 4)
Input hook: Tone scoring via BonepokeOS (Method 5) + commands (Method 8)
Context hook: Archetype injection + correction + motif warnings (Methods 6 + 7)
Output hook: BonepokeOS.ingest() full pipeline (Methods 4 + 7)
```

Maximum fidelity port. Single source of truth in Library. All hooks are thin callers. Full 11-category scoring, shimmer budget, motif decay, rupture cooldown, archetype selection, correction loop. This is the heaviest integration but the closest to what `ProjectBonepoke435.py` actually does.

---

## 5 — What Cannot Be Replicated and Honest Trade-offs

**No re-generation.** The Python version can reject output and re-generate. AID produces one output. Every correction is delayed by one turn. This means the compost cycle is always retroactive — the player will see the SLOP output before the correction takes effect. This is a fundamental limitation.

**No system prompt.** Bonepoke's archetype mandates are designed as system-prompt-level overrides. `authorsNote` and `frontMemory` are context text, not system instructions. The model may treat them as narrative content rather than behavioral directives. Bracketed formatting (`[ARCHETYPE: SHERLOCK]`) helps signal instruction-level intent, but compliance is not guaranteed.

**authorsNote slot competition.** The existing `state.originalAuthorsNote` sets the scenario's baseline tone. Bonepoke layers additional directives on top. If the combined text exceeds the authorsNote token budget, AI Dungeon will truncate. The practical limit is roughly 200–400 tokens — enough for 3–5 directive lines. Methods that generate verbose corrections will hit this ceiling.

**Detection accuracy.** The Python detection functions are substring-based. "The castle looped around the courtyard" would trigger motif tracking for "loop" even though this is literal description, not symbolic recursion. "The power of his argument" flags "power" as an abstract noun even though it's grounded by "argument." False positive rates in narrative fiction will be higher than in the academic test data. The expanded lexicons from "Freezing the Fog" and "Enter the Loop" help but don't eliminate this.

**The E/β scores are not neural metrics.** Bonepoke's E and β are *proxies* — word-counting heuristics that correlate with output quality but don't measure it directly. The Freezing the Fog article openly acknowledges this duality: "The poetry tells you where you are in the maze. The metrics prove the maze exists." The script-calculated E/β will not match what the model would self-report via Method 1's prompt injection. Both are useful; neither is ground truth.

**State budget.** The existing `state.AutoCards` backup in `library.js` (line 8694) already triggers an overflow check at 38,000 characters. Adding `state.bp` with history arrays, motif counts, and shimmer traces increases pressure on this budget. Bounded arrays (`.slice(-50)`) and periodic resets are essential.

---

## 6 — Implementation Priority Recommendation

For iterative development:

1. **First session:** Method 1 (Author's Note injection) + Method 8 (commands). Play 20 turns. Check LMI for model engagement with VSL framing.

2. **Second session:** Add Method 2 (Output detection + dashboard). Compare script-measured E/β against perceived narrative quality. Tune thresholds.

3. **Third session:** Add Method 3 (correction loop) and Method 6 (archetype injection). Play 50 turns. Observe whether corrections produce measurable state changes in subsequent outputs.

4. **Fourth session:** If hook-local detection functions are stable, refactor into Method 4 (Library module). Add Method 5 (tone scoring) and Method 7 (motif/shimmer/rupture tracking).

5. **Ongoing:** Tune lexicons, thresholds, and correction text based on observed play data. The expanded lexicon arrays in this report are starting points — narrative-specific tuning will be necessary for each scenario's genre.

---

*This report is based on Taylor's ProjectBonepoke435.py, "Freezing the Fog" article, VSL NotebookLM protocol, the AID Practical Code Review, the AID Gap Analysis Reference, and the VS Implementation Report (structural template). All code patterns follow the conventions and anti-pattern guidance established in those reference documents.*
