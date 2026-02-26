# ComboScript v1.0

A unified AI Dungeon scripting engine that integrates six subsystems into a single
**Measure → Decide → Inject** pipeline. Every system enhances every other — they are
woven together, not stacked.

## What's Inside

| System | What It Does | Where It Lives |
|---|---|---|
| **InnerSelf v1.0.2** | NPC brain simulation — characters learn, plan, adapt | combo_library.js (lines 1-8783) |
| **AutoCards v1.1.3** | Automatic plot-relevant story card generation | combo_library.js (lines 1-8783) |
| **BonepokeOS v4.3.5** | VSL tension protocol — E (fatigue) / β (tension) / LSC (coherence) analysis, archetype selection, Fragment Compost correction | combo_library.js (BonepokeOS IIFE) |
| **ComboEngine** | Unified scanner, Arbiter, VS fingerprinting, Steering Wheel state, JADE modes, layered context injection | combo_library.js (ComboEngine IIFE) |
| **NGO (Narrative Gravity Observatory)** | Heat/temperature tracking from conflict and calming keywords | Built into ComboEngine scanner + Input/Output hooks |
| **Verbalized Sampling** | Anti-mode-collapse — forces the AI to consider multiple probability-distribution branches before committing | Built into Arbiter + frontMemory injection |
| **Narrative Steering Wheel** | Player-directed memory injection with TTL expiration | Built into Input hook (capture) + Arbiter (injection) |
| **JADE Orchestrator** | Preset mode system — one command tunes all subsystems | Built into ComboEngine (JADE_MODES) |
| **D20 System** | Success/failure rolls on "try to" / "attempt" actions | Built into Input hook |

## Installation

### Step 1: Library Tab
Copy the entire contents of `combo_library.js` into your **Library** tab.

This file includes (in order):
1. InnerSelf + AutoCards framework code (8783 lines)
2. BonepokeOS IIFE (tension analysis engine)
3. ComboEngine IIFE (integration engine + state initialization)

### Step 2: Input Tab
Copy the entire contents of `combo_input.js` into your **Input** tab.

### Step 3: Context Tab
Copy the entire contents of `combo_context.js` into your **Context** tab.

### Step 4: Output Tab
Copy the entire contents of `combo_output.js` into your **Output** tab.

### Step 5: Configure (Optional)
The `MainSettings` class at the top of `combo_library.js` is the InnerSelf/AutoCards
config panel. Edit it to set NPC names, POV, card cooldowns, etc.

ComboScript defaults to GRITTY mode. To change on first play, use `/mode <name>`.

## Player Commands

Type these in the "Do" input box during gameplay:

| Command | What It Does |
|---|---|
| `/status` | Full status report — all subsystem states, constraints, values |
| `/debug` | Toggle debug logging (shows system internals in story cards) |
| `/combo` or `/combo help` | List all available commands |

### BonepokeOS
| Command | What It Does |
|---|---|
| `/bp on` / `/bp off` | Toggle tension analysis |
| `/bp archetype OBSERVER` | Force archetype (OBSERVER, SHERLOCK, JESTER, WOUNDED_HEALER, CALCIFIER) |
| `/bp archetype auto` | Return to automatic archetype selection |
| `/bp reset` | Reset all Bonepoke state (shimmer, motifs, history) |

### Verbalized Sampling
| Command | What It Does |
|---|---|
| `/vs on` / `/vs off` | Toggle anti-mode-collapse |
| `/vs threshold 0.10` | Set probability threshold (0.01 = most diverse, 1.0 = most focused) |
| `/vs candidates 7` | Set how many continuations the AI considers (3-10) |
| `/vs wild` | Maximum diversity (threshold=0.01, candidates=7, tail sampling) |
| `/vs focus` | Balanced quality (threshold=1.0, candidates=3, standard sampling) |

### Steering Wheel
| Command | What It Does |
|---|---|
| `/steer betrayal aftermath` | Inject a theme that lasts 4 turns |
| `/steer clear` | Clear all steering memories |

You can also steer by including (parenthetical) text in your actions:
> You walk into the bar (tense reunion with your ex)

The parenthetical content becomes a steering memory automatically.

### JADE Modes
| Command | Description |
|---|---|
| `/mode GRITTY` | Dark realism. Consequence-heavy, no safety nets. Default. |
| `/mode WHIMSICAL` | Lighter tone. Surprise and wonder over tension. |
| `/mode LITERARY` | Dense, layered prose. Maximum structural tension analysis. |
| `/mode FREEFORM` | All analysis active, but no correction signals. Instrument panel only. |
| `/mode RAW` | Everything off. Vanilla AID experience. |

### System
| Command | What It Does |
|---|---|
| `/reset all` | Reset all ComboScript state to fresh defaults |

## How the Systems Work Together

### The Five Feedback Loops

**Loop 1 — Fragment Compost Cycle** (BonepokeOS)
Output detects SLOP or GOLD → stores correction → next Context injects correction →
AI writes with correction → Output re-evaluates → SALVAGE achieved → correction clears.

**Loop 2 — Collapse-Diversity Cycle** (VS + BonepokeOS)
Output fingerprints text → measures collapse score → collapse + Bonepoke E feed Arbiter →
Arbiter tightens VS threshold → Context injects tighter tail-sampling → AI generates
more diverse output → collapse drops → Arbiter loosens threshold.

**Loop 3 — Tone-Archetype Resonance** (Scanner + BonepokeOS)
Player input scanned for tone → stored in snapshot → Context reads tone + archetype →
Arbiter generates tone-sensitive archetype guidance. A JESTER with a shearing player
gets different instructions than a JESTER with a dropping player.

**Loop 4 — Heat-Tension Bridge** (NGO + BonepokeOS)
NGO conflict/calming → heat value. Bonepoke β → structural tension. A scene can be
high-heat (fighting words) but low-β (predictable formula). Dashboard shows both.

**Loop 5 — Steering-Correction Separation** (Steering Wheel + BonepokeOS)
Steering says WHERE the plot goes. Correction says HOW the AI writes. They're different
authorsNote layers — they never clobber each other.

### No More Clobbering

The #1 problem in the old codebase was multiple systems writing to `authorsNote`
independently. Only the last write survived.

ComboScript fixes this with **exclusive ownership**:
- Only `combo_context.js` writes to `state.memory.authorsNote` and `state.memory.frontMemory`
- It builds a 7-layer priority stack (scenario note → steering → VSL/archetype → tone → heat → correction → motif warnings)
- If AID truncates for token budget, lower-priority layers (correction, warnings) are lost first

### Single-Pass Scanner

The old code duplicated conflict/calming word lists across 3+ files. ComboScript
uses ONE scanner with O(1) hash lookups across all vocabularies (conflict, calming,
lift, drop, shear, invert, combat, social, exploration, mystery) in a single pass.

## Constraints and Bounds

Every tunable value has minimum and maximum constraints enforced in code:

| Value | Min | Max | Where Enforced |
|---|---|---|---|
| Heat | 0 (configurable) | 100 | `clampHeat()` in Input + Output hooks |
| Temperature | 1 (configurable) | 15 (configurable) | `clampTemperature()` in Input + Output hooks |
| VS Threshold | 0.01 | 1.0 | `clampVS()`, Arbiter, command handler |
| VS Candidates | 3 | 10 | `clampVS()`, Arbiter, command handler |
| Steering TTL | 1 | 20 | CONSTRAINTS object |
| Steering Slots | — | 3 | CONSTRAINTS.steerSlots |
| VS Fingerprints | — | 10 | `recordFingerprint()` slices to max |
| BP Memory Residue | — | 20 | `ingest()` shifts when exceeded |
| BP History | — | 50 | `ingest()` shifts when exceeded |
| Shimmer Budget | 0 | 25 (resets every 25 ticks) | `registerShimmerEvent()` |
| Motif Counts | — | halved every 50 ticks | Output hook cleanup |
| E (exhaustion) | 0.0 | 1.0 | `calculateE()` clamp |
| β (tension) | 0.0 | 1.0 | `calculateBeta()` clamp |
| LSC (coherence) | 0.0 | 1.0 | `calculateLSC()` clamp |
| D20 Threshold | 0.1 | 0.9 | Input hook roll logic |

## Debug Logging

Type `/debug` to toggle debug logging. When enabled, every subsystem logs its
activity to AID's `log()` function. Log entries are prefixed with `[COMBO:label]`.

Debug logs include:
- **input.scan**: Word counts per category, dominant tone/genre
- **input.heat/temp**: Current heat and temperature after player impact
- **input.invert**: When player inversion clears a correction signal
- **steer.capture**: When parenthetical steering memories are captured
- **steer.expire**: When steering memories expire
- **d20.roll**: Roll value, threshold, and result
- **context.arbiter**: Full Arbiter decision summary
- **context.authorsNote.length**: Character count of injected note
- **context.frontMemory.length**: Character count of front memory
- **output.scan**: Word counts from AI output
- **output.bp**: Full BonepokeOS analysis (E, β, LSC, state, archetype, MARM, shimmer)
- **output.correction.set/clear**: When Fragment Compost Protocol activates or clears
- **output.vs**: Collapse score and fingerprint count
- **output.vs.WARNING**: High collapse detection alert
- **output.steer.anchor**: Last 5 words captured for transition anchoring
- **output.dashboard**: Full dashboard text
- **output.autocards**: AutoCards processing status
- **output.shimmer.reset**: Shimmer budget periodic reset
- **output.motif.cleanup**: Motif count periodic halving
- **output.suggestions**: BonepokeOS salvage suggestions
- **output.testScores**: PBTestSuite 11-category scoring
- **cmd**: Player command execution

## Architecture

```
combo_library.js (Library tab)
├── InnerSelf + AutoCards (lines 1-8783, unchanged from library.js)
├── BonepokeOS IIFE (globalThis.BonepokeOS)
│   ├── Tension Lexicon (negation, temporal, abstract, action, resonance, tone, etc.)
│   ├── Thresholds & Constraints (all named, all with min/max)
│   ├── Archetypes (OBSERVER, SHERLOCK, JESTER, WOUNDED_HEALER, CALCIFIER)
│   ├── Core Engine (contradictions, fatigue, drift, MARM, slop, tone, symbolism)
│   ├── VSL Calculator (E, β, LSC)
│   ├── State Machine (GOLD / SLOP / SALVAGE)
│   ├── Shimmer Budget, Motif Decay, Rupture Cooldown
│   ├── Correction Signal Generator
│   └── PBTestSuite 11-Category Scoring
└── ComboEngine IIFE (globalThis.ComboEngine)
    ├── deepMerge (safe state initialization)
    ├── Unified Vocabulary + Single-Pass Scanner
    ├── Constraints (all min/max bounds)
    ├── JADE Mode Presets
    ├── State Initialization
    ├── Debug Logger
    ├── Clamp Helpers (heat, temperature, VS)
    ├── VS Fingerprint + Collapse Detection (Jaccard similarity)
    ├── Arbiter (unified decision engine)
    ├── Authors Note Builder (7-layer priority stack)
    ├── Front Memory Builder (VS + D20 + MARM)
    ├── Dashboard Formatter
    └── Mode Application + Status Report

combo_input.js (Input tab)
├── InnerSelf("input") — outside modifier, first
├── Player Command Router (all /commands)
├── Steering Wheel — parenthetical capture + TTL expiration
├── Unified Keyword Scan — single pass, all vocabularies
├── NGO Heat Update — player impact
├── Tone → Heat Crosswalk
├── Player Inversion → Correction Clear
├── Input Snapshot Storage — persists for Context on Continue/Retry
└── D20 Roll — success/failure on "try to" / "attempt" patterns

combo_context.js (Context tab)
├── Run Arbiter — reads all subsystem state, produces unified decision
├── Build Layered Authors Note — 7 layers, priority-ordered
├── Build Front Memory — VS + D20 + MARM
└── Inject into state.memory — single point of injection

combo_output.js (Output tab)
├── InnerSelf("output") — outside modifier, first
├── NGO Output Keyword Tracking — model heat impact
├── BonepokeOS Full Ingest — complete VSL audit
├── Fragment Compost Protocol — correction signal for next turn
├── Shimmer Budget Reset — periodic (every 25 ticks)
├── Motif Count Cleanup — periodic halving (every 50 ticks)
├── VS Fingerprint + Collapse Detection — Jaccard similarity
├── Steering Wheel — capture last 5 words for transition anchor
├── Dashboard Card Update — unified status display
└── AutoCards("output", text) — last, polymorphic return handling
```

## InnerSelf/AutoCards Compatibility

ComboScript wraps around InnerSelf and AutoCards without modifying them:

1. `InnerSelf("input")` is called at the very top of `combo_input.js`, outside the modifier function, before any ComboScript code runs. InnerSelf handles its own internal processing and also handles AutoCards input processing internally.

2. `InnerSelf("output")` is called at the very top of `combo_output.js`, outside the modifier function, before any ComboScript code runs.

3. `AutoCards("output", text)` is called at the very bottom of `combo_output.js`, inside the modifier, after all ComboScript measurements are complete. Its polymorphic return (may be `{text}` object or plain string) is handled correctly.

4. ComboScript does NOT call `AutoCards("input")` anywhere — InnerSelf handles that internally (per the comment in ai_studio_code (4).js line 83-84).

5. ComboScript does NOT modify any story card that InnerSelf or AutoCards manages. The only shared card is `SYSTEM: Dashboard`.

6. ComboScript does NOT write to `globalThis.MainSettings` — that belongs to InnerSelf/AutoCards configuration.

7. If InnerSelf/AutoCards are not present (`typeof InnerSelf !== "function"`), ComboScript runs standalone without errors.

8. AutoCards passthrough runs even if ComboEngine itself is disabled (`state.combo.enabled = false`), ensuring AutoCards always processes regardless of ComboScript state.

## Differences From the Old Codebase

| Old Pattern | New Pattern |
|---|---|
| Separate conflict/calming arrays in Input, Output, and ai_studio_code | Single VOCAB object in library, single `scanText()` call |
| NGO, BP, VS, Steering Wheel each write authorsNote independently | Only Context hook writes; 7-layer priority stack |
| frontMemory written in Output hook | Only Context hook writes frontMemory |
| State scattered: `state.heat`, `state.bp`, `state.vs`, `state.roll` | Everything under `state.combo` with `deepMerge` |
| VS uses a storyCard with empty keys | VS instruction goes in frontMemory (never reduced) |
| BP correction and VS threshold tuned independently | Arbiter uses BP state to drive VS adaptation |
| No way to see all states at once | Unified dashboard + `/status` command |
| No constraints on heat or state arrays | Every value has enforced min/max bounds |
| No debug logging | `/debug` toggles comprehensive logging |
| No preset modes | `/mode GRITTY/WHIMSICAL/LITERARY/FREEFORM/RAW` |

## Credits

- **InnerSelf v1.0.2** — LewdLeah
- **AutoCards v1.1.3** — LewdLeah
- **BonepokeOS / ProjectBonepoke435** — James Taylor (protocol)
- **Verbalized Sampling** — Xilmanaath (based on arxiv.org/html/2510.01171v3)
- **NGO (Narrative Gravity Observatory)** — original scenario scripting
- **Narrative Steering Wheel** — original concept
- **JADE Modular** — proof of concept orchestrator
- **AID_Practical_Code_Review, AID_Gap_Analysis_Reference, AID_Scripting_Reference** — canonical reference documents
