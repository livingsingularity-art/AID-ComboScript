# AID ComboScript — Integrated Systems Blueprint

> A unified architecture that weaves the Narrative Gravity Observatory (NGO),
> BonepokeOS (VSL tension protocol), Verbalized Sampling (anti-mode-collapse),
> Narrative Steering Wheel (player-directed memory injection), InnerSelf/AutoCards,
> and the JADE modular orchestrator into a single coherent system where each
> subsystem amplifies every other.
>
> **Supersedence:** Where conflicts exist, AID_Practical_Code_Review is canonical
> for API behavior; AID_Gap_Analysis_Reference is canonical for corrections;
> AID_Scripting_Reference is the fallback.

---

## 0 — Design Philosophy: Integration, Not Stacking

The documents in this repository describe six distinct systems. Stacking them would
mean running each independently — six separate keyword scans, six separate state
objects, six separate authorsNote writes clobbering each other. Integration means
finding the places where one system's output is another system's input, and wiring
those connections so the whole becomes greater than the parts.

**The core insight:** Every system in this repository ultimately does one of three
things:

1. **Measures** something about the narrative (NGO measures heat; Bonepoke
   measures E/β/LSC; VS-Diversity measures mode collapse; Steering Wheel
   captures player intent; InnerSelf tracks NPC cognition)
2. **Decides** what to do about it (Bonepoke selects archetypes and generates
   corrections; VS adapts thresholds; NGO classifies temperature; JADE
   orchestrates which logic module to activate)
3. **Injects** steering signals into the AI's context (authorsNote, frontMemory,
   storyCards, text modifications)

The integration blueprint fuses these into a single **Measure → Decide → Inject**
pipeline where measurements flow up, decisions happen once in a unified arbiter, and
injection happens through coordinated, non-competing memory slots.

---

## 1 — Unified Execution Architecture

### 1.1 — Hook Lifecycle (Single Pipeline)

```
SharedLibrary ────────────────────────────────────────────────────
 │ Phase A: Framework Code (InnerSelf + AutoCards)
 │ Phase B: Unified Engine Module (ComboEngine IIFE)
 │   ├── LEXICON (merged: NGO conflict/calming + BP tension + VS genre + tone)
 │   ├── State initializer (deepMerge for state.combo)
 │   ├── Detection functions (CoreEngine from BP, scan from NGO, fingerprint from VS)
 │   ├── Decision functions (archetype selector, VS threshold adapter, correction generator)
 │   ├── Injection formatters (authorsNote builder, frontMemory builder, dashboard formatter)
 │   └── Player command router
 │
Input Hook ───────────────────────────────────────────────────────
 │ 1. InnerSelf("input")
 │ 2. ComboEngine.onInput(text):
 │    a. Player command interception (/status, /vs, /bp, /steer, /mode, /reset)
 │    b. Unified keyword scan (ONE pass — conflict, calming, tone, genre — all at once)
 │    c. Steering Wheel memory capture ((parenthetical) → slot)
 │    d. D20 success/failure roll
 │    e. Store: state.combo.inputSnapshot = { tone, genre, heat, steerMemories }
 │ 3. return { text }
 │
Context Hook ─────────────────────────────────────────────────────
 │ 1. ComboEngine.onContext(text):
 │    a. Read last Output analysis (state.combo.lastAnalysis)
 │    b. Read current Input snapshot (state.combo.inputSnapshot)
 │    c. Run Arbiter: combines E/β/heat/tone/genre/collapseScore → single decision
 │    d. Build layered authorsNote (see §5)
 │    e. Build frontMemory (D20 result + VS selection constraint + steering transition)
 │ 2. return { text }
 │
Output Hook ──────────────────────────────────────────────────────
 │ 1. InnerSelf("output")
 │ 2. ComboEngine.onOutput(text):
 │    a. Unified keyword scan on AI output (same single-pass scanner)
 │    b. BonepokeOS.ingest(text, state.combo.bp) → full VSL audit
 │    c. VS fingerprint + collapse detection
 │    d. Heat/temperature clamping
 │    e. Correction signal generation (stored for next Context pass)
 │    f. Dashboard card update (unified: NGO + BP + VS in one card)
 │    g. Steering Wheel: capture last-5-words of output
 │ 3. AutoCards passthrough
 │ 4. return { text }
```

### 1.2 — Why This Order Matters

- **InnerSelf/AutoCards** run first/last because they have their own internal
  state machines. They are treated as a black box that ComboEngine wraps around.
- **Input** captures player intent before generation. Continue/Retry skip Input,
  so all Input data is stored to `state.combo.inputSnapshot` for Context to read
  even on skipped-Input turns.
- **Context** is the single point of injection. Only Context writes to
  `authorsNote` and `frontMemory`. This eliminates the clobbering problem
  where NGO, BP, VS, and Steering Wheel all independently overwrote the same slots.
- **Output** is the single point of measurement. Only Output runs BonepokeOS
  `ingest()`, VS fingerprinting, and NGO output scanning. This prevents duplicate
  detection work.

---

## 2 — Unified State Object

Instead of `state.heat`, `state.bp`, `state.vs`, `state.roll`,
`state.memory1`...`state.memory3`, `state.originalAuthorsNote` as separate
top-level keys, everything lives under `state.combo`:

```js
state.combo = deepMerge(state.combo || {}, {
  // ── NGO (Narrative Gravity Observatory) ──────────────────
  heat: 5,
  temperature: 1,
  config: {
    playerHeatImpact: 2,
    playerCoolImpact: 2,
    modelHeatImpact: 1,
    modelCoolImpact: 1,
    tempIncreaseThreshold: 2,
    maxTemperature: 15,
    minTemperature: 1,
    minHeat: 0
  },

  // ── BonepokeOS ───────────────────────────────────────────
  bp: {
    tick: 0,
    shimmerUsed: 0,
    motifCounts: {},
    lastRuptureTick: 0,
    memory: [],          // resonant fragment residue (max 20)
    history: [],         // E/β trajectory (max 50)
    lastAnalysis: null,  // full ingest() result from last Output
    correctionActive: false,
    correctionSignal: ''
  },

  // ── Verbalized Sampling ──────────────────────────────────
  vs: {
    enabled: true,
    mode: 'standard',    // 'standard' | 'tail' | 'off'
    threshold: 0.20,
    candidates: 5,
    fingerprints: [],    // output fingerprints (max 10)
    collapseScore: 0
  },

  // ── Narrative Steering Wheel ─────────────────────────────
  steer: {
    memories: ['', '', ''],       // 3 memory slots
    expirations: [null, null, null],
    lastInputWords: '',
    lastOutputWords: ''
  },

  // ── D20 System ───────────────────────────────────────────
  roll: { frontMemory: '', action: 0 },

  // ── Scenario ─────────────────────────────────────────────
  baseAuthorsNote: '',  // Set once from scenario; never overwritten by scripts

  // ── Input snapshot (persists across skipped-Input turns) ─
  inputSnapshot: {
    tone: { lift: 0, drop: 0, shear: 0, invert: 0, dominant: 'neutral' },
    genre: null,
    conflictCount: 0,
    calmingCount: 0
  },

  // ── System ───────────────────────────────────────────────
  initialized: true,
  enabled: true          // master kill switch
});
```

**Why unified state matters:**
- One `deepMerge` call in SharedLibrary initializes everything safely
- No namespace collisions between subsystems
- Bounded arrays (`.slice(-N)`) applied consistently
- Single JSON serialization path — easier to monitor state budget
- Continue/Retry can read `inputSnapshot` even though Input hook was skipped

---

## 3 — The Single-Pass Scanner (Eliminating Duplicate Keyword Work)

The current codebase duplicates the conflict/calming word lists across Input (1).txt,
Output.txt, and ai_studio_code (4).js. Meanwhile BonepokeOS has its own tone
lexicons, VS has genre lexicons, and the Steering Wheel has parenthetical parsing.

The integrated blueprint uses **one scan function** that categorizes every word in
a single pass across all vocabularies:

```js
// In SharedLibrary (ComboEngine IIFE)
const VOCAB = {
  // NGO (from Input (1).txt / Output.txt)
  conflict: new Set(["attack","stab","destroy",...]),
  calming:  new Set(["calm","rest","relax",...]),

  // Bonepoke tone (from LEXICON.tone)
  lift:   new Set(["threat","danger","warning",...]),
  drop:   new Set(["sigh","exhale","ease",...]),
  shear:  new Set(["crash","shatter","snap",...]),
  invert: new Set(["but","however","yet",...]),

  // VS genre detection (from VS_Implementation_Report)
  combat:      new Set(["attack","fight","battle","sword",...]),
  social:      new Set(["talk","conversation","persuade",...]),
  exploration: new Set(["explore","search","investigate",...]),
  mystery:     new Set(["clue","mystery","suspicious",...])
};

function scanText(text) {
  const words = text.toLowerCase().split(/\s+/);
  const result = {
    conflict: 0, calming: 0,
    lift: 0, drop: 0, shear: 0, invert: 0,
    combat: 0, social: 0, exploration: 0, mystery: 0,
    dominantTone: 'neutral', dominantGenre: null,
    wordCount: words.length
  };

  for (const raw of words) {
    const w = raw.replace(/^[^\w]+|[^\w]+$/g, '');
    if (!w) continue;
    // One pass, all vocabularies
    for (const [category, set] of Object.entries(VOCAB)) {
      if (set.has(w)) result[category]++;
    }
  }

  // Derive dominant tone
  let maxTone = 0;
  for (const t of ['lift','drop','shear','invert']) {
    if (result[t] > maxTone) { maxTone = result[t]; result.dominantTone = t; }
  }

  // Derive dominant genre (require >= 2 hits)
  let maxGenre = 0;
  for (const g of ['combat','social','exploration','mystery']) {
    if (result[g] > maxGenre && result[g] >= 2) { maxGenre = result[g]; result.dominantGenre = g; }
  }

  return result;
}
```

**Integration points created by the unified scanner:**

- NGO conflict/calming counts feed into `state.combo.heat`
- Tone scores feed into Bonepoke's `state.combo.inputSnapshot.tone`
- Genre detection feeds into VS threshold adaptation
- Shared word count feeds into Bonepoke's E calculation
- Overlap words (e.g., "attack" is both conflict AND lift AND combat) are counted
  in all their categories simultaneously — no double-scan, no missed overlap

---

## 4 — The Arbiter: Unified Decision Engine

Currently each subsystem makes its own decisions independently:
- NGO decides temperature labels
- Bonepoke selects archetypes and generates corrections
- VS adapts thresholds based on collapse score
- Steering Wheel decides where to inject memories

The Arbiter is a single decision function that takes all measurements and produces
a **unified narrative directive** — one coherent set of instructions for the AI.

```js
function arbitrate(combo) {
  const bp = combo.bp.lastAnalysis;   // BonepokeOS result
  const vs = combo.vs;                // VS config
  const heat = combo.heat;
  const input = combo.inputSnapshot;
  const steer = combo.steer;

  const decision = {
    // What archetype should the AI embody?
    archetype: null,
    archetypeNote: '',

    // What VS mode should be active?
    vsMode: vs.mode,
    vsThreshold: vs.threshold,
    vsCandidates: vs.candidates,
    vsInstruction: '',

    // What correction signal (if any)?
    correction: '',

    // What steering memory transition?
    steerTransition: '',

    // What tone guidance?
    toneGuidance: '',

    // What motif warnings?
    motifWarnings: [],

    // Dashboard summary
    dashboardLine: ''
  };

  // ── Step 1: Archetype (from BonepokeOS, or forced) ───────
  if (bp && bp.vanillaOk) {
    decision.archetype = bp.archetype;
    decision.archetypeNote = bp.archetype.note;
  }

  // ── Step 2: VS adaptation informed by BP state ────────────
  // KEY INTEGRATION: Bonepoke's E and collapse score BOTH feed VS
  if (bp && bp.vanillaOk) {
    // High E (fatigue/repetition) AND high collapse = aggressive tail sampling
    if (bp.e > 0.4 && vs.collapseScore > 0.5) {
      decision.vsMode = 'tail';
      decision.vsThreshold = Math.max(0.05, vs.threshold * 0.6);
      decision.vsCandidates = 7;
    }
    // GOLD state (cohesion trap) = push into tails to break pattern
    else if (bp.state === 'GOLD') {
      decision.vsMode = 'tail';
      decision.vsThreshold = 0.10;
    }
    // SALVAGE (productive tension) = standard sampling to maintain
    else if (bp.state === 'SALVAGE') {
      decision.vsMode = 'standard';
      decision.vsThreshold = 0.20;
    }
    // SLOP = aggressive diversity + correction
    else if (bp.state === 'SLOP') {
      decision.vsMode = 'tail';
      decision.vsThreshold = 0.08;
      decision.vsCandidates = 6;
    }
  }

  // Genre override: tighten for combat, loosen for exploration
  if (input.genre) {
    const genreThresholds = {
      combat: 0.15, social: 0.10, exploration: 0.08, mystery: 0.12
    };
    if (genreThresholds[input.genre]) {
      decision.vsThreshold = genreThresholds[input.genre];
      decision.vsMode = 'tail';
    }
  }

  // ── Step 3: Correction signal (from Bonepoke) ────────────
  if (combo.bp.correctionActive && combo.bp.correctionSignal) {
    decision.correction = combo.bp.correctionSignal;
  }

  // ── Step 4: Tone guidance ─────────────────────────────────
  // KEY INTEGRATION: Player tone from scanner feeds archetype behavior
  const toneMap = {
    lift:   'Player is escalating. Match or exceed their tension.',
    drop:   'Player is de-escalating. Honor the release but leave residue.',
    shear:  'Player disrupted the scene. Follow the rupture; consequences cascade.',
    invert: 'Player contradicted expectation. Build on the reversal.'
  };
  if (input.tone.dominant !== 'neutral') {
    decision.toneGuidance = toneMap[input.tone.dominant] || '';

    // INTEGRATION: Player inversion clears correction (player IS steering toward tension)
    if (input.tone.dominant === 'invert' && input.tone.invert > 1) {
      decision.correction = '';
    }
  }

  // ── Step 5: Tone → Archetype reinforcement ────────────────
  // When player tone aligns with an archetype's purpose, amplify it
  if (decision.archetype) {
    if (input.tone.dominant === 'shear' && decision.archetype.id === 'JESTER') {
      decision.archetypeNote += ' The player has sheared the scene open — follow through with maximum disruption.';
    }
    if (input.tone.dominant === 'invert' && decision.archetype.id === 'SHERLOCK') {
      decision.archetypeNote += ' The player has inverted expectations — trace the logical consequences.';
    }
    if (input.tone.dominant === 'drop' && decision.archetype.id === 'WOUNDED_HEALER') {
      decision.archetypeNote += ' The player is releasing. Let the wound breathe. Do not suture prematurely.';
    }
  }

  // ── Step 6: Steering Wheel memories ───────────────────────
  const activeMemories = steer.memories.filter(Boolean);
  if (activeMemories.length > 0) {
    const anchor = steer.lastInputWords || steer.lastOutputWords || '';
    if (anchor) {
      decision.steerTransition =
        'Immediately after "' + anchor + '", flawlessly transition toward: ' +
        activeMemories.join(', ') + '.';
    } else {
      decision.steerTransition =
        'Weave the following themes into the narrative: ' + activeMemories.join(', ') + '.';
    }
  }

  // ── Step 7: Motif decay warnings ──────────────────────────
  if (bp && bp.motifDecay) {
    const exhausted = Object.keys(bp.motifDecay);
    if (exhausted.length > 0) {
      decision.motifWarnings = exhausted;
    }
  }

  // ── Step 8: Build VS instruction ──────────────────────────
  const k = decision.vsCandidates;
  const p = decision.vsThreshold;
  if (combo.vs.enabled && decision.vsMode !== 'off') {
    if (decision.vsMode === 'tail') {
      decision.vsInstruction =
        '[Internal process: Before writing, silently consider ' + k +
        ' distinct continuations from the probability tails (p < ' + p +
        '). Select one and output only that continuation.]';
    } else {
      decision.vsInstruction =
        '[Internal process: Before writing, silently consider ' + k +
        ' distinct continuations spanning the full probability distribution.' +
        ' Estimate relative probabilities. Select one weighted by these' +
        ' probabilities. Output only the selected continuation.]';
    }
  }

  return decision;
}
```

**What the Arbiter achieves that independent systems cannot:**

1. **BP state drives VS aggressiveness.** When Bonepoke detects GOLD (cohesion
   trap), VS simultaneously pushes into distribution tails. The two systems
   attack mode collapse from different angles at the same time.

2. **Player tone modulates archetype behavior.** A SHERLOCK archetype with an
   inverting player gets different instructions than a SHERLOCK with a lifting
   player. The archetype is context-sensitive.

3. **Genre detection tunes VS AND informs BP.** A combat scene gets conservative
   VS diversity (coherent action matters) but the BP scanner knows combat keywords
   mean the heat system and the tone system see the same event.

4. **Steering Wheel memories coexist with BP correction.** The Steering Wheel's
   player-directed transitions don't clobber BP's structural corrections — both
   appear as layers in the authorsNote, with the Steering Wheel providing plot
   direction and BP providing quality direction.

5. **Player inversion cancels correction.** If the player is already steering
   toward contradiction (high invert tone), Bonepoke's correction signal is
   redundant and gets cleared. The systems don't fight each other.

---

## 5 — Layered Context Injection (No More Clobbering)

The single greatest failure mode in the current codebase is multiple systems
writing to `state.memory.authorsNote` independently, each overwriting the last.
The Steering Wheel writes it. The NGO heat system writes it. Bonepoke writes it.
VS writes it. Only the last one wins.

The integrated blueprint assigns **exclusive ownership** of each injection slot:

### 5.1 — `state.memory.authorsNote` (Owned by Context Hook)

Built as a priority-ordered stack. If token budget forces truncation, lower layers
are lost first. Most important content is at the top.

```
Layer 1 (highest priority): Scenario Author's Note
  "Gritty, chaotic, morally gray..."

Layer 2: Steering Wheel transition
  "After 'slammed the door', transition toward: betrayal aftermath, guilt."

Layer 3: VSL state + archetype mandate
  "[VSL E:0.15 β:0.42 SALVAGE] [SHERLOCK: TRUTH_OVER_COHESION]"
  "Enforce cause-and-effect. Details matter. No convenient coincidences."

Layer 4: Tone guidance
  "Player is escalating. Match or exceed their tension."

Layer 5: Heat description
  "[HEAT:12 TEMP:3] The situation is volatile. Conflict is close."

Layer 6 (lowest priority): Correction signal
  "[CORRECTION] Previous output was too safe. Introduce structural contradiction."

Layer 7: Motif decay warning
  "Avoid overusing: loop, echo. Find fresh language."
```

**Estimated token cost:** ~150-250 tokens. Within the practical authorsNote budget
of ~200-400 tokens. Layers 6-7 are sacrificed first under pressure.

### 5.2 — `state.memory.frontMemory` (Owned by Context Hook)

The last thing the model sees. Never reduced by token limits. Used for the most
urgent, must-see directives.

```
Part 1: VS selection constraint
  "[Select from probability tails (p < 0.10). Output only the continuation.]"

Part 2: D20 roll result (when applicable)
  "And you partially succeed."

Part 3: MARM canary (when active)
  "MARM active: breakthrough or collapse imminent."
```

**Why VS goes in frontMemory:** The VS probability constraint is the single
most important behavioral directive — it determines HOW the model generates.
Placing it in the never-reduced, last-seen position maximizes compliance.
This follows the VS Implementation Report's Method 4 dual-slot pattern.

### 5.3 — Dashboard StoryCard (Owned by Output Hook)

One unified dashboard card that shows all subsystem states at a glance:

```
E:0.15 | β:0.42 | SALVAGE | SHERLOCK | MARM:flicker | Shimmer:8/25 | VS:tail@0.10 | HEAT:12 TEMP:3 | Turn:47
```

### 5.4 — InnerSelf/AutoCards StoryCards (Untouched)

InnerSelf and AutoCards manage their own cards through their own API.
ComboEngine does not touch, create, or modify any card that InnerSelf or
AutoCards owns. The only shared card is `SYSTEM: Dashboard`.

---

## 6 — Cross-System Feedback Loops

The following diagram shows how measurements flow between subsystems. Arrows
show data dependencies. Each arrow represents a real integration point where
one system's output feeds another system's input.

```
                    ┌──────────────┐
                    │  Player Input │
                    └──────┬───────┘
                           │
                    ┌──────▼───────┐
                    │ Single-Pass  │
                    │   Scanner    │
                    └──┬──┬──┬──┬─┘
                       │  │  │  │
          ┌────────────┘  │  │  └──────────────┐
          │               │  │                  │
    ┌─────▼──────┐  ┌─────▼──▼────┐     ┌──────▼──────┐
    │ NGO Heat   │  │  BP Tone    │     │  VS Genre   │
    │ Tracking   │  │  Scoring    │     │  Detection  │
    └─────┬──────┘  └─────┬───────┘     └──────┬──────┘
          │               │                     │
          │    ┌──────────▼────────────┐        │
          └───►│      ARBITER          │◄───────┘
               │  (Unified Decision)   │
     ┌────────►│                       │◄──────────┐
     │         └──────────┬────────────┘           │
     │                    │                         │
     │         ┌──────────▼────────────┐           │
     │         │   Context Injection   │           │
     │         │  authorsNote layers   │           │
     │         │  frontMemory layers   │           │
     │         └──────────┬────────────┘           │
     │                    │                         │
     │              ┌─────▼──────┐                  │
     │              │  AI Output │                  │
     │              └─────┬──────┘                  │
     │                    │                         │
     │         ┌──────────▼────────────┐           │
     │         │    Output Analysis    │           │
     │         │  ┌─────────────────┐  │           │
     │         │  │ BonepokeOS      │  │───────────┘
     │         │  │ .ingest()       │  │  (E/β/state/archetype
     │         │  └─────────────────┘  │   → Arbiter next turn)
     │         │  ┌─────────────────┐  │
     │         │  │ VS Fingerprint  │──┼───► collapseScore
     │         │  │ + Collapse Det. │  │     → Arbiter next turn
     │         │  └─────────────────┘  │
     │         │  ┌─────────────────┐  │
     │         │  │ NGO Output Scan │──┼───► heat/temp
     │         │  └─────────────────┘  │     → Arbiter next turn
     │         └───────────────────────┘
     │
     └── Steering Wheel memories (player-injected, expire by TTL)
```

### 6.1 — The Five Key Feedback Loops

**Loop 1: The Fragment Compost Cycle** (Bonepoke core)
```
Output detects SLOP → stores correction → Context injects correction →
AI generates with correction → Output detects → SALVAGE? → clear correction
```
This is Bonepoke's core mechanism. The integration preserves it exactly.

**Loop 2: The Collapse-Diversity Cycle** (VS + Bonepoke)
```
Output fingerprints AI text → measures collapse score →
collapse + BP.E feed Arbiter → Arbiter tightens VS threshold →
Context injects tighter tail-sampling instruction →
AI generates more diverse output → Output fingerprints → collapse drops →
Arbiter loosens threshold
```
This is NEW — it doesn't exist in any single document. It emerges from wiring
VS's collapse detection into the Arbiter alongside Bonepoke's E metric. Both
measure "the AI is repeating itself" from different angles; the Arbiter uses
both to make a more informed VS tuning decision.

**Loop 3: The Tone-Archetype Resonance** (Bonepoke + NGO + Scanner)
```
Player input scanned for tone → tone stored in inputSnapshot →
Context reads tone + archetype → Arbiter generates tone-sensitive archetype
note → AI generates with tone-aware guidance
```
This connects the player's emotional direction (tone) to Bonepoke's structural
direction (archetype). A JESTER with a shearing player gets different instructions
than a JESTER with a dropping player.

**Loop 4: The Heat-Tension Bridge** (NGO + Bonepoke)
```
NGO conflict/calming counts → heat value → heat description in authorsNote
Bonepoke tone (shear/lift) → additional heat modifiers
Bonepoke β metric → structural tension independent of heat
Both visible on dashboard → player can see emotional AND structural state
```
Heat (NGO) and β (Bonepoke) measure different things. Heat tracks violence/calm
content. β tracks structural contradiction/coherence. A scene can be high-heat
(lots of fighting words) but low-β (the fighting is predictable and follows
formula). The dashboard shows both, letting the player see that "the action is
intense but the narrative is boring."

**Loop 5: The Steering-Correction Separation** (Steering Wheel + Bonepoke)
```
Player types (betrayal aftermath) → stored as steering memory with TTL →
Context builds authorsNote with steering transition (Layer 2) AND
BP correction (Layer 6) → they don't conflict because they're different layers:
  - Steering says WHERE the plot goes ("toward betrayal aftermath")
  - Correction says HOW the AI writes ("reduce repetition, ground abstractions")
```
This is the critical integration that prevents the Steering Wheel from fighting
Bonepoke. Plot direction and writing quality direction are orthogonal concerns
placed in separate layers.

---

## 7 — Player Command Interface (Unified)

All slash commands go through a single router in the Input hook. Every
subsystem's commands live under a consistent namespace:

| Command | Action | System |
|---|---|---|
| `/status` | Show all: E, β, state, archetype, heat, temp, VS mode, shimmer, turn | All |
| `/bp on/off` | Toggle BonepokeOS analysis + correction | Bonepoke |
| `/bp archetype <name>` | Force archetype (OBSERVER/SHERLOCK/JESTER/WOUNDED_HEALER/CALCIFIER) | Bonepoke |
| `/bp reset` | Reset BP state (shimmer, motifs, history) | Bonepoke |
| `/vs on/off` | Toggle Verbalized Sampling | VS |
| `/vs threshold <0.01-1.0>` | Set VS probability threshold | VS |
| `/vs wild` | Max diversity (threshold=0.01, candidates=7, tail mode) | VS |
| `/vs focus` | Balanced (threshold=1.0, candidates=3, standard mode) | VS |
| `/vs candidates <3-10>` | Set VS candidate count | VS |
| `/mode <name>` | Set JADE orchestrator mode (see §8) | JADE |
| `/steer <text>` | Manually inject a steering memory (4-turn TTL) | Steering |
| `/reset all` | Reset entire state.combo to defaults | All |
| `/debug` | Toggle debug logging | System |

Commands return `{ text: ' ' }` (single space) to prevent the empty-string
error documented in Practical Code Review §4.2.

---

## 8 — JADE Orchestrator Integration

The JADE MODULAR.py demonstrates a module orchestrator that hot-swaps logic
modules. In the ComboScript context, JADE's role is to provide **preset
configurations** that tune all subsystems simultaneously:

```js
const JADE_MODES = {
  // ── Narrative preset modes ──────────────────────────────
  GRITTY: {
    desc: 'Dark realism — consequence-heavy, no safety nets',
    vsThreshold: 0.15,
    vsCandidates: 5,
    baseNote: 'Gritty, chaotic, morally gray...',
    heatFloor: 3,
    bpEnabled: true
  },
  WHIMSICAL: {
    desc: 'Lighter tone — surprise over tension',
    vsThreshold: 0.08,
    vsCandidates: 7,
    baseNote: 'Playful, unexpected, wonder-filled...',
    heatFloor: 0,
    bpEnabled: true
  },
  LITERARY: {
    desc: 'Maximum structural tension — Bonepoke in overdrive',
    vsThreshold: 0.10,
    vsCandidates: 6,
    baseNote: 'Dense, layered, every sentence earns its place...',
    heatFloor: 0,
    bpEnabled: true
  },
  FREEFORM: {
    desc: 'All analysis on, no correction — instrument panel only',
    vsThreshold: 0.20,
    vsCandidates: 5,
    baseNote: '',
    heatFloor: 0,
    bpEnabled: true,
    correctionDisabled: true
  },
  RAW: {
    desc: 'Everything off — vanilla AID experience',
    vsThreshold: 0.20,
    bpEnabled: false,
    vsEnabled: false,
    steerEnabled: false
  }
};
```

The `/mode GRITTY` command applies the preset, adjusting VS, BP, heat floor,
and base author's note in one action. This is JADE's "hot-swap" principle:
instead of manually tuning five parameters, the player selects a holistic
configuration.

JADE's deeper concept — the Pruning Hook pattern of "discern then act" — maps
to the Arbiter's structure: first all measurements are gathered (discernment),
then a single unified decision is made (action). The JADE VSL coordinates
(E, B) map to Bonepoke's (E, β) with the understanding that JADE's "B" (Balance)
correlates with Bonepoke's LSC (Local Semantic Coherence) — both measure whether
the output holds together.

---

## 9 — The Steering Wheel Inside the Arbiter

The Narrative Steering Wheel's parenthetical memory capture is preserved exactly —
it's a player-facing feature that works well. What changes is how captured memories
reach the AI:

**Before (standalone):** Steering Wheel wrote directly to `authorsNote`,
clobbering everything else.

**After (integrated):** Steering memories are stored in `state.combo.steer.memories`.
The Arbiter reads them and places the transition instruction in Layer 2 of the
authorsNote stack. The memories coexist with all other layers. Expiration logic
(TTL of 4 turns) runs in the Input hook during the unified scan phase.

The Steering Wheel's `lastInputWords` / `lastOutputWords` anchoring is also
preserved — the Input hook captures the last 5 words of player input, the Output
hook captures the last 5 words of AI output. The Arbiter uses whichever is
available as the transition anchor point.

---

## 10 — InnerSelf/AutoCards: Encapsulation Contract

InnerSelf and AutoCards are treated as an opaque subsystem. ComboEngine:

1. **Calls** `InnerSelf("input")` at the top of Input hook
2. **Calls** `InnerSelf("output")` at the top of Output hook
3. **Calls** `AutoCards("output", text)` at the bottom of Output hook
4. **Handles polymorphic returns** from AutoCards: `typeof result === 'object' ? result.text : result`
5. **Checks** `typeof InnerSelf === "function"` before calling (integration guard)
6. **Does not** modify any storyCard that InnerSelf/AutoCards manages
7. **Does not** use `globalThis.MainSettings` — that's InnerSelf's configuration space

This means ComboEngine can be installed alongside InnerSelf/AutoCards without
conflicts, and can also run standalone if they're absent.

---

## 11 — Anti-Patterns Addressed by This Blueprint

| Problem in current codebase | How the blueprint solves it |
|---|---|
| Duplicate conflict/calming word lists in 3+ files | Single `VOCAB` object in SharedLibrary, single `scanText()` |
| Multiple systems writing to `authorsNote` independently | Only Context hook writes; layered stack with clear priority |
| `frontMemory` used inconsistently (D20 sometimes, BP sometimes) | Context hook owns frontMemory; builds from parts consistently |
| State scattered across `state.heat`, `state.bp`, `state.vs`, etc. | Unified `state.combo` with one `deepMerge` init |
| Input-only state stale on Continue/Retry | `inputSnapshot` persists; Context reads snapshot regardless of hook skip |
| VS storyCard with empty keys (never triggers) | VS instruction in `authorsNote`/`frontMemory` — no card needed |
| Bonepoke correction and VS threshold tuned independently | Arbiter uses BP state to drive VS adaptation |
| Steering Wheel clobbers BP/VS authorsNote | Steering is a layer in the stack, not a total overwrite |
| No way to see all subsystem states at once | Unified dashboard card + `/status` command |
| Unbounded state growth risk | All arrays capped: memory(20), history(50), fingerprints(10), shimmer resets every 25 ticks |

---

## 12 — Implementation Phases

### Phase 1: Foundation (SharedLibrary)
- ComboEngine IIFE with VOCAB, `scanText()`, `deepMerge()`, state initialization
- BonepokeOS IIFE (existing `bonepoke_library.js` — already complete)
- Card helpers: `ensureCard()`, `buildCard()`

### Phase 2: Input Hook
- InnerSelf integration guard
- Unified scan (replace separate conflict/calming/tone passes)
- Steering Wheel parenthetical capture
- D20 system
- Player command router
- Store `inputSnapshot`

### Phase 3: Context Hook
- Read `lastAnalysis` + `inputSnapshot`
- Arbiter decision
- Layered authorsNote construction
- Layered frontMemory construction

### Phase 4: Output Hook
- InnerSelf integration guard
- Unified scan on AI output → heat/temp update
- BonepokeOS.ingest() → full analysis stored to `lastAnalysis`
- VS fingerprint + collapse detection
- Correction signal storage
- Dashboard card update
- Steering Wheel output-word capture
- AutoCards passthrough

### Phase 5: Polish
- JADE mode presets
- VS-Multi history awareness (extract modes from history)
- Shimmer budget reset logic
- Motif count periodic cleanup
- Debug toggle
- Comprehensive `/status` output

---

## 13 — File Layout

```
ComboScript/
├── AID_Integrated_Blueprint.md   ← this document
├── combo_library.js              ← SharedLibrary (Phase 1)
├── combo_input.js                ← Input hook (Phase 2)
├── combo_context.js              ← Context hook (Phase 3)
└── combo_output.js               ← Output hook (Phase 4)
```

The `bonepoke_library.js` IIFE is pasted into `combo_library.js` after the
ComboEngine IIFE. InnerSelf/AutoCards code (the existing 8783-line `library.js`)
goes before both. The final Library tab is:

```
[InnerSelf/AutoCards code — library.js lines 1-8783]
[BonepokeOS IIFE — bonepoke_library.js]
[ComboEngine IIFE — combo_library.js]
```

---

## 14 — Honest Constraints & Trade-offs

**One-turn correction delay.** The Fragment Compost Protocol can only affect
the *next* turn. The player will see SLOP output before the correction fires.
This is inherent to AID's single-output-per-turn architecture.

**No system prompt.** Archetype mandates, VS instructions, and correction
signals are context text, not system-level overrides. The model may treat them
as narrative content. Bracketed formatting (`[ARCHETYPE: SHERLOCK]`) helps
signal instruction-level intent.

**authorsNote token budget.** The full 7-layer stack can exceed ~400 tokens.
If it does, AID truncates. The layer ordering ensures the most important
directives (scenario note, steering transition, VSL state) survive truncation
while lower-priority layers (correction, motif warnings) are sacrificed.

**frontMemory never reduced — but shared.** D20 results, VS constraints, and
MARM canary all share frontMemory. Keep each part terse. Total target: <100
tokens.

**Detection accuracy.** Substring matching produces false positives. "loophole"
triggers "loop" tracking. "powerful argument" flags "power" as abstract. The
expanded lexicons help but don't eliminate this. Future refinement should use
word-boundary matching (`\bloop\b`) where performance permits.

**State serialization budget.** The existing library.js triggers overflow
checks at ~38,000 characters. Adding `state.combo` increases pressure. All
arrays are bounded, but monitoring total state size is advisable.

**SharedLibrary re-execution cost.** The Library re-executes 3x per player
action. Both BonepokeOS and ComboEngine IIFEs reconstruct their lexicons each
time. Mitigate with `Object.freeze()` on constant arrays. The existing 8783-line
InnerSelf/AutoCards library demonstrates that AID tolerates large SharedLibrary
files.

---

*This blueprint synthesizes: AID_Practical_Code_Review (canonical API reference),
AID_Gap_Analysis_Reference (corrections), AID_Scripting_Reference (patterns),
BonepokeOS_AID_Reference (tension lexicon & scoring), Bonepoke_Integration_Methods_Report
(8-method composition), VS_Implementation_Report (6-method anti-collapse),
Narrative-Steering-Wheel(1).txt (player memory injection), library.js + InnerSelf/AutoCards
(proven production code), JADE MODULAR.PY (orchestrator architecture),
Input(1).txt / Output.txt / ai_studio_code(4).js (NGO heat system), and
verbalizedSampling-library.js / verbalizedSampling-context.js (VS baseline).*
