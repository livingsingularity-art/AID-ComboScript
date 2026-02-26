# AI Dungeon Scripting — Best Practices & API Reference

> Streamlined reference for AI Dungeon's sandboxed JavaScript scripting environment.
> Compiled from community scripts, official docs, and battle-tested patterns.

---

## 1 — Environment

AI Dungeon scripts execute in a **sandboxed ES2022 JavaScript** runtime (no DOM, no `window`, no `setTimeout`, no `fetch`). The sandbox serialises all output through GraphQL/JSON — `undefined` becomes `null` in logs.

**Execution order per player action:**

```
SharedLibrary (global scope)
  → Input hook (local scope)
SharedLibrary (global scope)
  → Context hook (local scope)
SharedLibrary (global scope)
  → Output hook (local scope)
```

SharedLibrary re-executes before **every** hook. Functions and variables declared there are global to all hooks.

---

## 2 — Globals

| Global | Type | Scope | Description |
|---|---|---|---|
| `text` | `string` | All hooks | Current text being processed (player input / context / AI output) |
| `stop` | `boolean` | Output only | Set `true` to trigger regeneration |
| `state` | `object` | All hooks | Persistent key-value store across turns |
| `state.memory` | `object` | All hooks | Controls injected memory (see §2.1) |
| `state.message` | `string` | All hooks | Message shown to player (not yet on Phoenix) |
| `info` | `object` | All hooks | Read-only adventure metadata |
| `info.actionCount` | `number` | All hooks | Total actions in adventure |
| `info.characterNames` | `array` | All hooks | Multiplayer character names |
| `info.maxChars` | `number` | Context only | Estimated max context characters |
| `info.memoryLength` | `number` | Context only | Characters used by memory section |
| `history` | `History[]` | All hooks | Recent actions array |
| `storyCards` | `StoryCard[]` | All hooks | Story cards array (formerly `worldInfo`) |

### 2.1 — Memory Slots (`state.memory`)

```
[AI Instructions]
[Plot Essentials]
World Lore: [triggered story cards]
Story Summary: [summary]
Memories: [state.memory.context — overrides UI Memory]
Recent Story: [history actions]
  [state.memory.authorsNote — overrides UI Author's Note]
  [last AI response / player action]
  [state.memory.frontMemory — appended at very end]
```

| Field | Position | Notes |
|---|---|---|
| `context` | Before history | Overrides UI Memory if non-empty |
| `authorsNote` | Before last action | Overrides UI Author's Note if non-empty |
| `frontMemory` | After last action | Last thing the AI sees — powerful for steering |

Setting empty string `""` falls back to UI values. Changes to `state.memory` in Output hook take effect **next turn**.

### 2.2 — History Entry

```ts
{ text: string, rawText?: string, type: "start"|"continue"|"do"|"say"|"story"|"see" }
```

### 2.3 — StoryCard

```ts
{ id: string, keys: string, entry: string, type: string, title: string, description: string }
```

Cards inject their `entry` into "World Lore" when `keys` match recent story content.

---

## 3 — Built-in Functions

### `log(...args)`
Logs to script console. Prefer over `console.log`. Remember: `undefined` → `null` in output due to JSON serialisation.

### `addStoryCard(keys, entry?, type?, name?, notes?, options?)`
Creates a story card. Returns new array length (or the card object if `options: { returnCard: true }`). Duplicate `keys` are silently rejected.

### `removeStoryCard(index)`
Removes card at `index`. Throws if not found. **Indices shift after removal** — iterate backwards when removing multiples.

### `updateStoryCard(index, keys, entry, type?, name?, notes?)`
Replaces card at `index`, preserving `id`. Omitted optional params keep existing values. Throws if not found.

---

## 4 — Hook Patterns

### 4.1 — Minimal Hook Template

```js
const modifier = (text) => {
  // your logic
  return { text };
};
modifier(text);
void 0;
```

**Always end every script file with `void 0`** — the engine evaluates the last expression and `void 0` prevents unintended returns.

### 4.2 — Return Values

| Hook | `{ text }` | `{ text: '', stop: true }` |
|---|---|---|
| Input | Replaces player input | — |
| Context | Replaces full AI context | — |
| Output | Replaces AI output | Triggers regeneration |

Returning empty string from Input or Output shows an error to the player.

### 4.3 — Library → Hook Dispatch

Define logic in SharedLibrary, keep hooks thin:

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
void 0;
```

---

## 5 — State Management

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
    Object.assign(card, { type, title, keys, entry, description });
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

// Usage
const card = getCard(c => c.title === "MyCard");
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

**Known bugs:**
- StoryCard manipulation fails when "Memory Bank" is off.
- Card changes in earlier hooks may not persist into later hooks.
- Context hook card updates can be overwritten by Output hook updates.

---

## 7 — Common Patterns

### 7.1 — IIFE Module

Encapsulate features with private scope:

```js
const MyFeature = (() => {
  let _internal = 0;
  const process = (text) => { _internal++; return text; };
  return { process };
})();
```

### 7.2 — Regeneration with Limit

```js
// Output hook only
const MAX_REGEN = 3;
state.regenAttempts = state.regenAttempts || 0;

if (shouldRegenerate(text) && state.regenAttempts < MAX_REGEN) {
  state.regenAttempts++;
  return { text: '', stop: true };
}
state.regenAttempts = 0;
return { text };
```

### 7.3 — Keyword Scanning

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

### 7.4 — D20 / Success-Failure Roll

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

### 7.5 — Expiring Memory Slots

```js
// Input: store directive with TTL
state.memory1 = state.memory1 || "";
state.expiration1 = state.expiration1 || null;

if (state.expiration1 && info.actionCount > state.expiration1) {
  state.memory1 = "";
  state.expiration1 = null;
}

// Set a new memory with 4-turn lifespan
const match = text.match(/\(([^)]+)\)/);
if (match && !state.memory1) {
  state.memory1 = match[1].trim();
  state.expiration1 = info.actionCount + 4;
  text = text.replace(/\([^)]*\)/g, "").trim() || ".";
}
```

### 7.6 — Dashboard Card (live HUD)

```js
// Output hook — update a visible status card
const status = `HEAT: ${state.heat} | TEMP: ${state.storyTemperature} | TURN: ${info.actionCount}`;
const dash = storyCards.find(c => c.title === "SYSTEM: Dashboard");
if (dash) dash.entry = status;
else addStoryCard("SYSTEM: Dashboard", status, "system");
```

### 7.7 — Author's Note Injection

```js
// Steer narrative via authorsNote
state.memory.authorsNote = [
  "Gritty tone. Morally gray.",
  "Small actions matter: silence, looks, slammed doors.",
  "Violence is realistic. Follow through with consequences."
].join(' ');
```

### 7.8 — Director Pattern (function chaining)

```js
// SharedLibrary — chain modifier functions
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

// Hook usage
director.input(fnA, fnB, fnC);
void 0;
```

---

## 8 — Anti-Patterns

| Don't | Do | Why |
|---|---|---|
| Omit `void 0` at end of script | Always end with `void 0;` | Engine evaluates last expression; prevents bugs |
| `console.log()` exclusively | `log()` | Built-in; always available |
| `history[history.length-1].text` | `history.at(-1)?.text \|\| ''` | History may be empty |
| `return { text: '', stop: true }` without counter | Cap regeneration at 3 attempts | Prevents infinite loops |
| `state.allData.push(x)` unbounded | Slice to cap: `.slice(-100)` | Prevents memory exhaustion |
| Mutate `CONFIG` from hooks | Use `state` for runtime overrides | SharedLibrary `const` re-declares each execution |
| Heavy logic in Context hook | Define in Library, call from hook | Context runs every turn; keep it fast |
| `addWorldEntry` / `updateWorldEntry` | `addStoryCard` / `updateStoryCard` | Old API is deprecated |
| Remove cards during forward iteration | Iterate backwards or collect indices first | Indices shift on splice |
| Return `""` from Input/Output | Return at least `" "` (space) | Empty string triggers an error |

---

## 9 — Performance

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
  if (!CONFIG.enabled) return { text };
  if (!text.trim()) return { text };
  // main logic at shallow depth
  return { text };
};
```

**Batch card operations** — avoid adding/removing cards in tight loops.

---

## 10 — Debugging

```js
const DEBUG = false;
const dbg = (label, val) => { if (DEBUG) log(`[DBG] ${label}: ${JSON.stringify(val)}`); };

// Assertion
const assert = (cond, msg) => { if (!cond) { log(`ASSERT FAIL: ${msg}`); throw new Error(msg); } };
```

Remember: `undefined` logs as `null` due to JSON serialisation. Use `String(val)` or `val === undefined ? 'undefined' : val` if the distinction matters.

---

## 11 — Naming Conventions

| Kind | Convention | Example |
|---|---|---|
| Functions | camelCase | `analyzeText`, `getCard` |
| Constants | UPPER_SNAKE | `MAX_ATTEMPTS`, `CONFLICT_WORDS` |
| Modules | PascalCase | `VerbalizedSampling`, `InnerSelf` |
| Internal/private | `_` prefix | `_internalState` |
| State keys | camelCase | `state.storyTemperature` |

---

## 12 — Quick-Start Template

### SharedLibrary

```js
// === Config ===
const CONFIG = { debug: false, featureX: true };

// === Helpers ===
const dbg = (l, v) => { if (CONFIG.debug) log(`[DBG] ${l}: ${JSON.stringify(v)}`); };

const ensureCard = (title, entry, type = "Custom") => {
  let c = storyCards.find(x => x.title === title);
  if (!c) { addStoryCard(title, entry, type); c = storyCards.find(x => x.title === title); }
  else c.entry = entry;
  return c;
};

// === State Init ===
if (!state.init) {
  state.myData = {};
  state.init = true;
}

void 0;
```

### Input

```js
const modifier = (text) => {
  dbg('input', text.slice(0, 80));
  return { text };
};
modifier(text);
void 0;
```

### Context

```js
const modifier = (text) => {
  return { text };
};
modifier(text);
void 0;
```

### Output

```js
const modifier = (text) => {
  dbg('output', text.slice(0, 80));
  return { text };
};
modifier(text);
void 0;
```

---

## 13 — Context Structure Quick-Ref

```
┌─────────────────────────────────┐
│ AI Instructions                 │
│ Plot Essentials                 │
├─────────────────────────────────┤
│ World Lore:                     │
│   [triggered story card entries]│
├─────────────────────────────────┤
│ Story Summary                   │
├─────────────────────────────────┤
│ Memories:                       │
│   [state.memory.context]        │
├─────────────────────────────────┤
│ Recent Story:                   │
│   [history actions ...]         │
│   [state.memory.authorsNote]    │  ← near end
│   [last action]                 │
│   [state.memory.frontMemory]    │  ← very end
└─────────────────────────────────┘
```

---

*Sources: Official AI Dungeon Scripting Docs, Magic's Scripting Guidebook, Yi1i1i's Standardized Outline, LewdLeah's InnerSelf/AutoCards, Xilmanaath's VerbalizedSampling, Director by magicoflolis, Worldsmythe's type definitions, community best practices.*
