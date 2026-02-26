# AI Dungeon Scripting — Comprehensive Gap Analysis Reference

> Corrected reference incorporating findings from the comprehensive gap analysis and fact-check.
> Cross-referenced against: Official AI Dungeon Scripting Docs (help.aidungeon.com), Magic's Scripting Guidebook
> (magicoflolis/aidungeon.js), Worldsmythe's type definitions, SlumberingMage's AID-Programming-Guide,
> archived Latitude/Scripting GitHub repo, and community sources.
>
> Each claim is annotated with its verification status:
> ✅ = Confirmed across multiple sources | ⚠️ = Partially correct / needs nuance | ❌ = Corrected from original

---

## 1 — Environment

AI Dungeon scripts execute in a **sandboxed JavaScript VM** consistent with ES2022 features. ⚠️

> **Correction from original:** No official Latitude documentation specifies "ES2022." The claim traces to the
> magicoflolis guidebook's `/// <reference lib="es2022"/>` TypeScript configuration. Error messages reference
> `vm.js:` line numbers, indicating a VM-based sandbox. The specific sandbox technology (isolated-vm, QuickJS, etc.)
> is unknown.

**Sandbox restrictions:** ✅ No DOM, no `window`, no `setTimeout`, no `fetch`. The official archived repo confirms
"for security reasons some Javascript functionality is locked down." DOM types exist in the **editor** but not
at runtime.

**`undefined` → `null` serialisation:** ✅ Confirmed. When `console.log` is called, values pass through AI Dungeon's
GraphQL layer which returns JSON responses, causing `undefined` to be stringified as `null`.

**Execution order per player action:** ✅

```
SharedLibrary (global scope)
  → Input hook (local scope)
SharedLibrary (global scope)
  → Context hook (local scope)
SharedLibrary (global scope)
  → Output hook (local scope)
```

SharedLibrary is *textually prepended* to each modifier. Variables declared there are **not shared across
modifiers** unless stored in `state`. The official repo warns: "To share variables throughout the adventure or
across modifier scripts, you should use the State variable."

### ❌ Missing from original: Not All Actions Trigger All Hooks

| Player Action | Hooks Triggered |
|---|---|
| Normal input (Do/Say/Story) | Input → Context → Output |
| Continue | Context → Output (skips Input) |
| Retry | Context → Output (skips Input) |
| Alter | **No scripts triggered** |
| Opening World Info/Story Cards | **No scripts triggered** |

---

## 2 — Globals

| Global | Type | Scope | Status |
|---|---|---|---|
| `text` | `string` | All hooks | ✅ Confirmed |
| `state` | `object` | All hooks | ✅ Confirmed — persists across turns, JSON-serializable only |
| `state.memory` | `object` | All hooks | ✅ Confirmed |
| `state.message` | `string` | All hooks | ✅ Still "Not yet implemented on Phoenix" |
| `info` | `object` | All hooks | ✅ Confirmed |
| `info.actionCount` | `number` | All hooks | ✅ Confirmed |
| `info.characters` | `array` | All hooks | ❌ **Was `info.characterNames` in original — WRONG** |
| `info.maxChars` | `number` | Context only | ✅ Confirmed |
| `info.memoryLength` | `number` | Context only | ✅ Confirmed |
| `history` | `History[]` | All hooks | ✅ Confirmed |
| `storyCards` | `StoryCard[]` | All hooks | ✅ Confirmed (formerly `worldInfo`, still works) |

### ❌ `stop` — Corrected from Original

The original document listed `stop` as an "Output only" global variable. This is **incorrect**.

`stop` is a **return value** (not a pre-set global) available in the return object from **all three hooks**, with
different behavior in each:

| Hook | `{ stop: true }` Behavior |
|---|---|
| `onInput` | Throws "Unable to run scenario scripts" error to player |
| `onModelContext` | Throws "Sorry, the AI is stumped" error to player |
| `onOutput` | Changes output text to the literal word "stop" — **do not use** |

Additionally, returning the literal text string `"stop"` from any hook is equivalent to `{stop: true}`.

**Known bug:** The `stop` flag also prevents the player's actions from showing up in the adventure.

### ❌ `info.characterNames` → `info.characters`

The correct property name is **`info.characters`**. It was never called `characterNames` in any authoritative
source. Format may vary between eras:

- Pre-Phoenix: array of objects `[{ name: "Sam" }]`
- Phoenix-era: simple string array `["character1", "character2"]`

### 2.1 — Memory Slots (`state.memory`) ✅

```
[AI Instructions]
[Plot Essentials]
World Lore: [triggered story cards]
Story Summary: [summary]
Memory Bank: [embedding-retrieved memories, if enabled]
Memories: [state.memory.context — overrides UI Memory]
Recent Story: [history actions]
  [state.memory.authorsNote — overrides UI Author's Note]
  [last AI response / player action]
  [state.memory.frontMemory — appended at very end]
[Response Buffer — reserved tokens for AI generation]
```

| Field | Position | Notes |
|---|---|---|
| `context` | Before history | Overrides UI Memory if non-empty |
| `authorsNote` | Before last action | Overrides UI Author's Note if non-empty |
| `frontMemory` | After last action | Last thing the AI sees — **never reduced by token limits** |

Setting empty string `""` falls back to UI values — "it is not possible to use the state to clear the memory or
authors note completely." Changes to `state.memory` in Output hook take effect **next turn**.

### ❌ Missing from original: Token Allocation

Required elements (AI Instructions, Plot Essentials, Story Summary, Front Memory, Author's Note, Last Action)
target **70%** of context. If they exceed this, reduction priority is:

1. Story Summary (reduced first)
2. AI Instructions
3. Plot Essentials
4. Author's Note
5. Front Memory — **never reduced**
6. Last Action — **never reduced**

Dynamic elements (~30%): ~25% Story Cards, ~50% History, ~25% Memory Bank.

### 2.2 — History Entry ✅

```js
{ text: string, rawText?: string, type: "start"|"continue"|"do"|"say"|"story"|"see" }
```

`rawText` is **deprecated** — included for backward compatibility, returns same value as `text`.

### 2.3 — StoryCard ⚠️

**Runtime scripting array fields (confirmed by official docs):**

```js
{
  id: string,    // unique identifier
  keys: string,  // comma-separated trigger keywords
  entry: string, // content injected into World Lore
  type: string   // category label
}
```

**`title` and `description`:** These fields exist in the scenario editor and JSON import/export format but their
availability in the runtime `storyCards` array is confirmed only by working code (library.js,
verbalizedSampling-library.js) — not by official documentation. The JSON export format uses `value` (not `entry`)
— a known naming inconsistency.

### ❌ Missing from original: Story Card Trigger Behavior

- Cards trigger when keywords appear in the **last 4–9 actions** (minimum 4; if >500 tokens available for
  cards, actions checked = available tokens ÷ 100)
- The AI output that **first activates** a Story Card **cannot use that card's information** because activation
  happens after context assembly

---

## 3 — Built-in Functions

### `log(...args)` ✅

Logs to script console. `console.log()` is an alias "to reduce confusion." `sandboxConsole.log` is **deprecated**
but still works. All three produce the same result.

### ❌ `addStoryCard` — Corrected Signature

**Original (WRONG):** `addStoryCard(keys, entry?, type?, name?, notes?, options?)`

**Correct signature (per official docs and Scripting Guidebook):**

```js
addStoryCard(keys, entry, type)
```

**Only 3 parameters.** There are no `name`, `notes`, or `options` parameters. The `keys` parameter automatically
sets both `StoryCard.keys` and `StoryCard.title` to the same value. There is no `returnCard` option.

Returns the numeric index of the new card, or `false` if a card with the same keys already exists.

> **Note:** The 6-parameter signature with `name`, `notes`, and `options.returnCard` comes from Worldsmythe's
> .d.ts type definitions. It is presented there as a "Reference Implementation" but is not confirmed by any
> official Latitude documentation.

### `removeStoryCard(index)` ✅

Takes an index, throws `Error` if the card doesn't exist. Indices shift after removal — iterate backwards when
removing multiples.

### ⚠️ `updateStoryCard` — Corrected Signature

**Original (WRONG):** `updateStoryCard(index, keys, entry, type?, name?, notes?)`

**Correct signature (per official docs):**

```js
updateStoryCard(index, keys, entry, type)
```

**Only 4 parameters.** No `name` or `notes` parameters. Throws error if card doesn't exist. Historical note:
`updateWorldEntry` previously auto-created entries when the index didn't exist — this behavior was changed.

### Complete Built-in Function List

| Function | Status | Notes |
|---|---|---|
| `log()` | Current | Primary logging function |
| `console.log()` | Current | Alias for `log()` |
| `addStoryCard(keys, entry, type)` | Current | Returns index or `false` |
| `removeStoryCard(index)` | Current | Throws if not found |
| `updateStoryCard(index, keys, entry, type)` | Current | Throws if not found |
| `sandboxConsole.log()` | **Deprecated** | Use `log()` |
| `addWorldEntry()` | **Deprecated** | Use `addStoryCard()` |
| `removeWorldEntry()` | **Deprecated** | Use `removeStoryCard()` |
| `updateWorldEntry()` | **Deprecated** | Use `updateStoryCard()` |

No other built-in functions exist. The scripting API appears stable since Phoenix launch with no 2024–2025
additions found.

---

## 4 — Hook Patterns

### 4.1 — Minimal Hook Template ✅

```js
const modifier = (text) => {
  // your logic
  return { text };
};
modifier(text);
```

### ⚠️ `void 0` — Clarified

**Original claim:** "Always end every script file with `void 0`"

**Correction:** No official Latitude documentation mentions `void 0`. The convention originates from the Director
framework (magicoflolis). For the standard `modifier(text)` pattern — where the last line is `modifier(text)` which
returns the modifier's result — `void 0` is **unnecessary**. Use `void 0` only when using alternative patterns
(like Director chaining) where the script's final expression might evaluate to something unexpected.

### ❌ Return Value Behavior — Corrected Per Hook

| Hook | `{ text: "..." }` | `{ text: "" }` | `{ text: " " }` |
|---|---|---|---|
| Input | Replaces player input | **Error:** "Unable to run scenario scripts" | Suppresses input silently |
| Context | Replaces AI context | Context built as if script didn't run (**no error**) | Minimal context |
| Output | Replaces AI output | **Error:** "A custom script running on this scenario failed" | Blank output |

> **Important asymmetry:** Returning empty string from Context does **NOT** show an error (unlike Input/Output).
> When `info.actionCount === 0` (scenario opening), returning empty string prevents the opening from loading —
> return `" "` instead.

### 4.2 — Library → Hook Dispatch ✅

```js
// === SharedLibrary ===
const MySystem = (() => {
  const onInput = (text) => { /* ... */ return text; };
  const onContext = (text) => { /* ... */ return text; };
  const onOutput = (text) => { /* ... */ return text; };
  return { onInput, onContext, onOutput };
})();

// === Input hook ===
const modifier = (text) => {
  text = MySystem.onInput(text);
  return { text };
};
modifier(text);
```

---

## 5 — State Management ✅

### 5.1 — Safe Initialisation

```js
// Guard: run once
if (!state.initialized) {
  state.myData = { counter: 0, history: [] };
  state.initialized = true;
}

// Or: default-merge per field
state.heat = state.heat ?? 5;
state.roll = state.roll || { frontMemory: '', action: 0 };
```

### 5.2 — Bound Growth

```js
state.log = state.log || [];
state.log.push(entry);
if (state.log.length > 50) state.log = state.log.slice(-50);
```

**Important:** `state` only supports JSON-serializable data. Functions cannot be stored.

### 5.3 — Deep Merge Utility

```js
const deepMerge = (target = {}, source = {}) => {
  for (const key in source) {
    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      if (!target[key] || typeof target[key] !== 'object') target[key] = {};
      deepMerge(target[key], source[key]);
    } else if (target[key] === undefined) {
      target[key] = source[key];
    }
  }
  return target;
};
```

---

## 6 — StoryCard Helpers

### 6.1 — Build Card (create-or-update)

```js
const buildCard = (title, entry, type = "Custom", keys = title, description = "", insertionIndex = 0) => {
  addStoryCard("%@%");
  for (const [index, card] of storyCards.entries()) {
    if (card.title !== "%@%") continue;
    card.type = type;
    card.title = title;
    card.keys = keys;
    card.entry = entry;
    card.description = description;
    if (index !== insertionIndex) {
      storyCards.splice(index, 1);
      storyCards.splice(insertionIndex, 0, card);
    }
    return card;
  }
};
```

### 6.2 — Find Card

```js
const getCard = (predicate) => {
  for (const card of storyCards) {
    if (predicate(card)) return card;
  }
  return null;
};
```

### 6.3 — Ensure Card (find-or-create)

```js
const ensureCard = (title, entry, type = "Custom") => {
  let card = storyCards.find(c => c.title === title);
  if (!card) {
    addStoryCard(title, entry, type);
    card = storyCards.find(c => c.title === title);
  } else {
    card.entry = entry;
  }
  return card;
};
```

### 6.4 — Remove Card Safely

```js
const removeCard = (title) => {
  const idx = storyCards.findIndex(c => c.title === title);
  if (idx > -1) removeStoryCard(idx);
};
```

### Known Bugs ⚠️

- ✅ Card changes in earlier hooks may not persist into later hooks (confirmed — official Known Issues)
- ✅ Context hook card updates can be overwritten by Output hook updates (confirmed — official Known Issues)
- ❌ "StoryCard manipulation fails when Memory Bank is off" — **NOT VERIFIED** by any source. Memory Bank
  affects only context token allocation, not script function availability. Removed as unconfirmed.

---

## 7 — Common Patterns ✅

### 7.1 — IIFE Module

```js
const MyFeature = (() => {
  let _internal = 0;
  const process = (text) => { _internal++; return text; };
  return { process };
})();
```

### 7.2 — Keyword Scanning

```js
const CONFLICT = ["attack","stab","destroy","shoot","kill","blood","rage"];
const CALMING  = ["calm","rest","heal","comfort","hug","smile","forgive"];

const scan = (text, wordList) => {
  const words = text.toLowerCase().split(/\s+/);
  let count = 0;
  for (const w of words) {
    if (wordList.includes(w.replace(/^[^\w]+|[^\w]+$/g, ''))) count++;
  }
  return count;
};
```

### 7.3 — D20 / Success-Failure Roll

```js
if (state.roll.action !== info.actionCount) {
  let threshold = 0.5;
  if (/disadvantage/i.test(text)) threshold += 0.2;
  if (/advantage/i.test(text)) threshold -= 0.2;
  const partial = threshold + 0.2;
  const v = Math.random();
  const match = text.match(/> (.*) (try|trie|attempt)(s?)/i);

  state.roll.frontMemory = '';
  if (match && !((match[1].match(/"/g) ?? []).length % 2)) {
    const s = v > threshold;
    state.roll.frontMemory =
      (s ? 'And ' : 'But ') +
      match[1].replace(/^You\b/, 'you').replace(/,$/, ' and') +
      (s && v < partial ? ' partially' : '') +
      (s ? ' succeed' : ' fail') +
      (match[3] ? 's' : '') +
      (s ? '.' : '!');
  }
  state.roll.action = info.actionCount;
}
```

### 7.4 — Expiring Memory Slots

```js
state.memory1 = state.memory1 || "";
state.expiration1 = state.expiration1 || null;

if (state.expiration1 && info.actionCount > state.expiration1) {
  state.memory1 = "";
  state.expiration1 = null;
}

const match = text.match(/\(([^)]+)\)/);
if (match && !state.memory1) {
  state.memory1 = match[1].trim();
  state.expiration1 = info.actionCount + 4;
  text = text.replace(/\([^)]*\)/g, "").trim() || ".";
}
```

### 7.5 — Dashboard Card (live HUD)

```js
const status = `HEAT: ${state.heat} | TEMP: ${state.storyTemperature} | TURN: ${info.actionCount}`;
const dash = storyCards.find(c => c.title === "SYSTEM: Dashboard");
if (dash) dash.entry = status;
else addStoryCard("SYSTEM: Dashboard", status, "system");
```

### 7.6 — Author's Note Injection

```js
state.memory.authorsNote = [
  "Gritty tone. Morally gray.",
  "Small actions matter: silence, looks, slammed doors.",
  "Violence is realistic. Follow through with consequences."
].join(' ');
```

### 7.7 — Director Pattern (function chaining)

```js
// SharedLibrary
const director = {
  _run(fns, text, stop) {
    for (const fn of fns) {
      const result = typeof fn === 'function' ? fn(text, stop) : {};
      if (result?.text !== undefined) text = result.text;
      if (result?.stop !== undefined) stop = result.stop;
    }
    return { text, stop };
  },
  input(...fns)   { return this._run(fns, text, false); },
  context(...fns) { return this._run(fns, text, false); },
  output(...fns)  { return this._run(fns, text, false); },
  library(...fns) { fns.forEach(fn => fn()); }
};

// Hook usage (Director pattern requires void 0)
director.input(fnA, fnB, fnC);
void 0;
```

### ❌ Missing from original: Multiplayer `state.message` targeting

```js
// Target specific players in multiplayer
state.message = [
  { text: 'Only you can see this!', visibleTo: ['Sam', 'Jane'] }
];
```

---

## 8 — Anti-Patterns (Corrected)

| Don't | Do | Why |
|---|---|---|
| Use 6-param `addStoryCard` | Use `addStoryCard(keys, entry, type)` | Only 3 params confirmed |
| Use `info.characterNames` | Use `info.characters` | Wrong property name |
| Return `{ stop: true }` from Output | Avoid — it outputs the word "stop" | Known bug |
| Return `""` from Input/Output | Return at least `" "` (space) | Triggers error to player |
| `console.log()` exclusively | `log()` | Built-in; always available |
| `history[history.length-1].text` | Guard with `history.length > 0` check | History may be empty |
| `state.allData.push(x)` unbounded | Slice to cap: `.slice(-100)` | Prevents serialisation bloat |
| Mutate `CONFIG` from hooks | Use `state` for runtime overrides | Library re-declares each execution |
| `addWorldEntry` / `updateWorldEntry` | `addStoryCard` / `updateStoryCard` | Deprecated since Phoenix |
| Remove cards during forward iteration | Iterate backwards or collect indices | Indices shift on splice |
| Store functions in `state` | Store data only | `state` is JSON-serialized |
| Assume all actions trigger Input | Check — Continue/Retry skip Input | Only Context+Output run |

---

## 9 — Performance ✅

**Cache expensive work:**
```js
if (state._cache?.src !== text) {
  const words = text.split(/\s+/);
  state._cache = { src: text, words, len: words.length };
}
```

**Limit history scans:**
```js
const recent = history.slice(-5);
```

**Early returns:**
```js
const modifier = (text) => {
  if (!text.trim()) return { text };
  // main logic
  return { text };
};
```

**Batch card operations** — avoid adding/removing cards in tight loops.

---

## 10 — Debugging ✅

```js
const DEBUG = false;
const dbg = (label, val) => { if (DEBUG) log(`[DBG] ${label}: ${JSON.stringify(val)}`); };
```

### ❌ Missing from original: LMI Debugging Tool

The **Last Model Input (LMI)** tool (brain icon in adventure) shows:

- The last context sent to the AI
- Script logs with timestamps
- Current state object

**Important:** LMI data and logs **expire after a few minutes**. Check immediately after running.

### Phoenix-Era Script Management

- Scripts can only be added/edited on **web** (not iOS/Android apps)
- Script import/export works as ZIP files containing: `inputModifier.js`, `contextModifier.js`,
  `outputModifier.js`, `shared.js`
- The formal hook names are `onInput`, `onModelContext`, `onOutput`

---

## 11 — Naming Conventions ✅

| Kind | Convention | Example |
|---|---|---|
| Functions | camelCase | `analyzeText`, `getCard` |
| Constants | UPPER_SNAKE | `MAX_ATTEMPTS`, `CONFLICT_WORDS` |
| Modules | PascalCase | `VerbalizedSampling`, `InnerSelf` |
| Internal/private | `_` prefix | `_internalState` |
| State keys | camelCase | `state.storyTemperature` |

---

## 12 — Community Scripts Landscape (Corrected)

### Confirmed Active Projects

| Project | Author | Description |
|---|---|---|
| **Auto-Cards** | LewdLeah | Auto-writes/updates story cards to solve "object permanence" |
| **Inner Self** | LewdLeah | Gives NPCs memory, goals, secrets, and self-reflection |
| **Director** | magicoflolis | Function-chaining framework for cleaner script organization |
| **Hashtag-DnD** | raeleus | Full D&D system: combat, shops, spells, multiplayer, Auto-Cards integration |
| **MousAI Script Pack** | (community) | Modularized toggle-on/off modules via World Info or slash commands |
| **Gnurro's AIDscripts** | Gnurro | Encounters, RPGmech, PlaceholderGrab, RandomNamesReplacer, FixQuotes |
| **AI Dungeon Scripts** | Lelallas | Time management, hidden quests, random events, relationships, Story Arc Engine |

### ❌ Removed from original: Phantom Entries

- **"VerbalizedSampling"** — Zero results across GitHub, Reddit, and official docs when web-searched.
  This name appears only in the uploaded source files. It is a real script by Xilmanaath but has
  no public web presence discoverable through search.
- **"NGO system"** — No results found. The actual pattern is a "Narrative Gravity" heat/temperature system
  combined with D20 rolls, but the acronym "NGO" is not an established community term.

---

## 13 — Context Structure Quick-Ref ✅

```
┌─────────────────────────────────┐
│ AI Instructions                 │  ← system-level, always included
│ Plot Essentials                 │  ← always included
├─────────────────────────────────┤
│ World Lore:                     │  ← ~25% of dynamic tokens
│   [triggered story card entries]│
├─────────────────────────────────┤
│ Story Summary                   │  ← auto-generated, reduced first if over budget
├─────────────────────────────────┤
│ Memory Bank                     │  ← embedding-retrieved, ~25% of dynamic tokens
├─────────────────────────────────┤
│ Memories:                       │
│   [state.memory.context]        │
├─────────────────────────────────┤
│ Recent Story:                   │  ← ~50% of dynamic tokens
│   [history actions ...]         │
│   [state.memory.authorsNote]    │  ← near end
│   [last action]                 │  ← never reduced
│   [state.memory.frontMemory]    │  ← very end, never reduced
├─────────────────────────────────┤
│ [Response Buffer]               │  ← reserved for AI generation
└─────────────────────────────────┘
```

---

## Appendix: Summary of All Corrections from Original Document

| Section | Issue | Original Claim | Corrected |
|---|---|---|---|
| §2 Globals | Wrong property name | `info.characterNames` | `info.characters` |
| §2 Globals | `stop` scope | "Output only" global | Return value in all hooks with different behaviors |
| §3 Functions | `addStoryCard` params | 6 params with `returnCard` | 3 params: `keys, entry, type` |
| §3 Functions | `updateStoryCard` params | 6 params with `name, notes` | 4 params: `index, keys, entry, type` |
| §4.1 Template | `void 0` mandate | "Always end with `void 0`" | Only needed for Director pattern |
| §4.2 Returns | Empty string behavior | Same across all hooks | Context does NOT error on empty string |
| §6 Known bugs | Memory Bank requirement | "Fails when Memory Bank is off" | Unverified — removed |
| §7 Community | Phantom entries | VerbalizedSampling, NGO | Not findable via web search |
| Missing | Hook trigger conditions | Not covered | Continue/Retry skip Input; Alter triggers nothing |
| Missing | Token allocation | Not covered | 70% required / 30% dynamic breakdown added |
| Missing | Card trigger timing | Not covered | First activation can't use card info |
| Missing | LMI debugging tool | Not covered | Brain icon shows context, logs, state |
| Missing | Multiplayer targeting | Not covered | `state.message` with `visibleTo` array |
| Missing | Script management | Not covered | Web-only editing, ZIP import/export |

---

*Sources: Official AI Dungeon Scripting Docs (help.aidungeon.com), archived Latitude/Scripting GitHub repo,
magicoflolis/aidungeon.js Scripting Guidebook, SlumberingMage/AID-Programming-Guide, Worldsmythe's type
definitions (aidungeon_d.ts), working .js/.txt implementations, community best practices.*
