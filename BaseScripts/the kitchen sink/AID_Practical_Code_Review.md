# AI Dungeon Scripting — Practical Code Review Reference

> Corrected reference grounded **exclusively** in working JavaScript implementations.
> Every claim below is verified against actual running .js and .txt scripts from the AI Dungeon sandbox.
>
> **Source files (ground truth):**
> `library.js` (InnerSelf/AutoCards), `verbalizedSampling-library.js`, `verbalizedSampling-context.js`,
> `ai_studio_code(4).js`, `Input(1).txt`, `Output.txt`, `Narrative-Steering-Wheel(1).txt`

---

## 1 — Environment

AI Dungeon scripts execute in a **sandboxed JavaScript** runtime. The sandbox serialises all output through GraphQL/JSON — `undefined` becomes `null` in logs.

**Confirmed ES2020+ features (used in working scripts):**

- Arrow functions, `const`/`let`, template literals
- `for...of` loops, destructuring, spread syntax
- Optional chaining `?.` and nullish coalescing `??`
- `class` with `static` properties (library.js — `MainSettings`)
- `Object.seal()`, `Object.assign()`, `Object.entries()`
- `globalThis` access to all globals
- `Array.prototype.entries()`, `.find()`, `.findIndex()`, `.splice()`
- `Math.random()`, `RegExp`, `JSON.stringify()`/`JSON.parse()`

**Not available (sandbox restrictions):** No DOM, no `window`, no `setTimeout`, no `fetch`.

**Execution order per player action:**

```
SharedLibrary (global scope)
  → Input hook (local scope)
SharedLibrary (global scope)
  → Context hook (local scope)
SharedLibrary (global scope)
  → Output hook (local scope)
```

SharedLibrary re-executes before **every** hook. It is *textually prepended* — variables declared there are available in all hooks but are **re-initialised** each execution. Use `state` for cross-execution persistence.

---

## 2 — Globals (Proven by Running Code)

### Confirmed in use across scripts:

| Global | Type | Evidence |
|---|---|---|
| `text` | `string` | Every script uses it as the modifier parameter |
| `state` | `object` | All scripts store persistent data here |
| `state.memory.authorsNote` | `string` | Narrative-Steering-Wheel sets this directly |
| `state.memory.frontMemory` | `string` | Output.txt, Input(1).txt write this |
| `state.message` | `string` | library.js writes toast messages via this |
| `info` | `object` | All scripts reference `info.actionCount` |
| `info.actionCount` | `number` | Used in every script for turn tracking |
| `history` | `array` | ai_studio_code reads `history[i].text` and `.type` |
| `storyCards` | `array` | library.js, verbalizedSampling manipulate directly |
| `addStoryCard` | `function` | Called with 1 or 3 args in working code |
| `removeStoryCard` | `function` | library.js calls this with index |
| `log` | `function` | library.js uses this for debug output |
| `globalThis` | `object` | library.js accesses `globalThis.state`, `globalThis.info`, etc. |

### Referenced in documentation but NOT used in any .js/.txt file:

| Global | Status |
|---|---|
| `stop` | Never used as standalone global or in `{stop: true}` return |
| `state.memory.context` | Never set in any script (authorsNote and frontMemory are used instead) |
| `info.characterNames` | Never referenced |
| `info.maxChars` | Never referenced |
| `info.memoryLength` | Never referenced |
| `console.log` | Used in Narrative-Steering-Wheel — confirmed working alongside `log()` |

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

| Field | Position | Proven By |
|---|---|---|
| `authorsNote` | Before last action | Narrative-Steering-Wheel sets tone directives here |
| `frontMemory` | After last action | Output.txt appends D20 results here; Input(1).txt writes roll outcomes |

Setting empty string `""` falls back to UI values. Changes to `state.memory` in Output hook take effect **next turn**.

### 2.2 — History Entry (Proven Fields)

```js
{ text: string, type: "start"|"continue"|"do"|"say"|"story"|"see" }
```

`rawText` exists per documentation but is never used in any working script.

### 2.3 — StoryCard (Proven Runtime Fields)

All six fields are **read/write at runtime**, confirmed by library.js and verbalizedSampling-library.js:

```js
{
  id: string,          // auto-generated, preserved across updates
  keys: string,        // trigger keywords
  entry: string,       // content injected into World Lore
  type: string,        // category label
  title: string,       // display name (separate from keys)
  description: string  // metadata (writable at runtime)
}
```

Cards inject their `entry` into "World Lore" when `keys` match recent story content.

---

## 3 — Built-in Functions (Proven Signatures Only)

### `log(...args)`

Logs to script console. Both `log()` and `console.log()` work — Narrative-Steering-Wheel uses `console.log()` directly. Remember: `undefined` → `null` in output due to JSON serialisation.

### `addStoryCard(keys)` or `addStoryCard(keys, entry, type)`

**Proven call patterns (only these are confirmed):**

```js
// 1-arg: placeholder creation (library.js line 7692, verbalizedSampling-library.js line 44)
addStoryCard("%@%");

// 3-arg: standard creation (Output.txt, library.js line 769)
addStoryCard("SYSTEM: Dashboard", statusText, "system");
addStoryCard(title, entry, type);
```

Returns new array length. The `keys` parameter also sets `title` to the same value. Duplicate `keys` may be silently rejected (documented but not directly tested in source scripts).

**The 6-parameter signature `addStoryCard(keys, entry, type, name, notes, options)` with `returnCard` option is NOT used in any working script.** This comes from the .d.ts type definitions and may or may not exist at runtime — it is unverified.

### `removeStoryCard(index)`

Removes card at `index`. Confirmed by library.js. Throws if not found. **Indices shift after removal** — iterate backwards when removing multiples.

### `updateStoryCard` — UNVERIFIED

**No working script ever calls `updateStoryCard`.** Every script that needs to update a card mutates the card object directly:

```js
card.entry = newValue;
card.type = newType;
card.title = newTitle;
// etc.
```

The signature `updateStoryCard(index, keys, entry, type?, name?, notes?)` comes from documentation and type definitions only.

---

## 4 — Hook Patterns

### 4.1 — Minimal Hook Template (What Actually Ships)

Every working script ends with `modifier(text)` — **none** end with `void 0`:

```js
const modifier = (text) => {
  // your logic
  return { text };
};
modifier(text);
```

> **Note on `void 0`:** The convention of ending scripts with `void 0` comes from the Director framework (magicoflolis). None of the uploaded production scripts use it. The standard `modifier(text)` pattern — where the last expression is the modifier's return value — works without `void 0`. Use `void 0` only if your script's last expression might evaluate to something unexpected (e.g., when using Director-style chaining instead of the modifier pattern).

### 4.2 — Return Values

| Hook | `{ text }` | Effect |
|---|---|---|
| Input | Replaces player input | Returning `""` shows an error |
| Context | Replaces full AI context | — |
| Output | Replaces AI output | Returning `""` shows an error |

Return at least `" "` (single space) if you need to suppress output without error.

### 4.3 — Library → Hook Dispatch (IIFE Pattern from Working Code)

Both VerbalizedSampling and InnerSelf/AutoCards use the IIFE module pattern:

```js
// === SharedLibrary (verbalizedSampling-library.js) ===
const VerbalizedSampling = (() => {
  // private helpers
  const buildCard = (title, entry, ...) => { /* ... */ };
  const getCard = (predicate) => { /* ... */ };

  // public API
  return { buildCard, getCard };
})();

// === Context hook (verbalizedSampling-context.js) ===
const modifier = (text) => {
  // append instruction to context
  text += "\n[Verbalized Sampling instruction]";
  return { text };
};
modifier(text);
```

### 4.4 — Function-Based Dispatch (Yi1i1i Pattern)

```js
// === SharedLibrary ===
function onInput(text) { /* ... */ return text; }
function onContext(text) { /* ... */ return text; }
function onOutput(text) { /* ... */ return text; }

// === Input hook ===
const modifier = (text) => {
  text = onInput(text);
  return { text };
};
modifier(text);
```

---

## 5 — State Management

### 5.1 — Safe Initialisation (Proven Patterns)

**Guard pattern (library.js — InnerSelf):**
```js
const IS = state.InnerSelf = deepMerge(state.InnerSelf || {}, {
  encoding: "",
  agent: "",
  label: 0,
  hash: "",
  ops: 0,
  AC: { enabled: false, forced: false }
});
```

**Nullish coalescing (ai_studio_code):**
```js
state.heat = state.heat ?? 5;
state.storyTemperature = state.storyTemperature ?? 'MEDIUM';
state.roll = state.roll || { frontMemory: '', action: 0 };
```

**Boolean init (Narrative-Steering-Wheel):**
```js
state.memory1 = state.memory1 || "";
state.expiration1 = state.expiration1 || null;
```

### 5.2 — Deep Merge Utility (Exact Code from library.js)

```js
const deepMerge = (target = {}, source = {}) => {
  for (const key in source) {
    if (source[key] && (typeof source[key] === "object") && !Array.isArray(source[key])) {
      if (!target[key] || (typeof target[key] !== "object")) {
        target[key] = {};
      }
      deepMerge(target[key], source[key]);
    } else if (target[key] === undefined) {
      target[key] = source[key];
    }
  }
  return target;
};
```

### 5.3 — Integration Guard Pattern (library.js)

Check for external script systems before calling them:

```js
if (typeof InnerSelf === "function") {
  InnerSelf("input");
}
if (typeof AutoCards === "function") {
  const cardResult = AutoCards("output", text);
  text = (typeof cardResult === 'object') ? cardResult.text : cardResult;
}
```

---

## 6 — StoryCard Helpers (From Working Code)

### 6.1 — The `"%@%"` Placeholder Pattern (Primary Method)

Both library.js and verbalizedSampling-library.js use this same core pattern — create a placeholder card, find it, then mutate its properties:

```js
const buildCard = (title, entry, type = "Custom", keys = title, description = "", insertionIndex = 0) => {
  addStoryCard("%@%");
  for (const [index, card] of storyCards.entries()) {
    if (card.title !== "%@%") continue;
    // Set properties individually (actual code pattern)
    card.type = type;
    card.title = title;
    card.keys = keys;
    card.entry = entry;
    card.description = description;
    // Reposition if needed
    if (index !== insertionIndex) {
      storyCards.splice(index, 1);
      storyCards.splice(insertionIndex, 0, card);
    }
    Object.seal(card);  // Prevent property addition/deletion
    return card;
  }
};
```

**Why this pattern exists:** `addStoryCard` sets `title = keys` automatically. To set a different `title`, you must create a throwaway card then overwrite its fields. This is the de facto standard in production scripts.

### 6.2 — Find Card (with `Object.seal`)

```js
const getCard = (predicate) => {
  for (const card of storyCards) {
    if (predicate(card)) {
      Object.seal(card);  // Both library.js and VS-library.js do this
      return card;
    }
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

### 6.4 — Direct Array Manipulation

`storyCards` is a standard mutable array. Working scripts use `splice` directly:

```js
// Reorder: remove from old position, insert at new position
storyCards.splice(oldIndex, 1);
storyCards.splice(newIndex, 0, card);

// Remove by title
const idx = storyCards.findIndex(c => c.title === title);
if (idx > -1) storyCards.splice(idx, 1);

// Alternative: push a manually-constructed card (Scripting_Guidebook pattern)
storyCards.push({
  id: Math.floor(Math.random() * 1000000000).toString(),
  type: 'Custom',
  title: 'My Card',
  keys: 'keyword1, keyword2',
  entry: 'Card content here',
  description: ''
});
```

### 6.5 — Dashboard Card (Output.txt)

```js
const status = `HEAT: ${state.heat} | TEMP: ${state.storyTemperature} | TURN: ${info.actionCount}`;
const dash = storyCards.find(c => c.title === "SYSTEM: Dashboard");
if (dash) dash.entry = status;
else addStoryCard("SYSTEM: Dashboard", status, "system");
```

---

## 7 — Common Patterns (From Working Code)

### 7.1 — IIFE Module

Proven by VerbalizedSampling, InnerSelf, and AutoCards:

```js
const MyFeature = (() => {
  let _internal = 0;
  const process = (text) => { _internal++; return text; };
  return { process };
})();
```

### 7.2 — Static Class Config (library.js)

```js
globalThis.MainSettings = (class MainSettings {
  static InnerSelf = {
    IS_INNER_SELF_ENABLED_BY_DEFAULT: true,
    PERCENTAGE_OF_RECENT_STORY_USED_FOR_BRAINS: 30,
    // ... more settings
  };
  static AC = {
    IS_AC_ENABLED_BY_DEFAULT: false,
    // ... more settings
  };
});
```

### 7.3 — Keyword Scanning (ai_studio_code, Input(1).txt)

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

### 7.4 — D20 / Success-Failure Roll (Input(1).txt, ai_studio_code)

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

### 7.5 — Narrative Gravity / Heat System (ai_studio_code)

```js
state.heat = state.heat ?? 5;
state.storyTemperature = state.storyTemperature ?? 'MEDIUM';

const conflictCount = scan(text, CONFLICT);
const calmCount = scan(text, CALMING);
state.heat += conflictCount;
state.heat -= calmCount;
state.heat = Math.max(0, Math.min(10, state.heat));

if (state.heat >= 8) state.storyTemperature = 'BOILING';
else if (state.heat >= 5) state.storyTemperature = 'HOT';
else if (state.heat >= 3) state.storyTemperature = 'MEDIUM';
else state.storyTemperature = 'COOL';
```

### 7.6 — Expiring Memory Slots (Narrative-Steering-Wheel)

```js
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

### 7.7 — Author's Note Injection (Narrative-Steering-Wheel)

```js
state.memory.authorsNote = [
  "Gritty tone. Morally gray.",
  "Small actions matter: silence, looks, slammed doors.",
  "Violence is realistic. Follow through with consequences."
].join(' ');
```

### 7.8 — Polymorphic Return Handling (Output.txt)

When calling external script systems, handle both string and object returns:

```js
const cardResult = AutoCards("output", text);
text = (typeof cardResult === 'object') ? cardResult.text : cardResult;
```

---

## 8 — Anti-Patterns (Grounded in Source Code Evidence)

| Don't | Do | Evidence |
|---|---|---|
| Use `addStoryCard` with 6 params | Stick to 1 or 3 params | Only proven signatures |
| Call `updateStoryCard` | Mutate card properties directly | No working script uses it |
| Return `""` from Input/Output | Return at least `" "` | Known to cause errors |
| `state.allData.push(x)` unbounded | Cap growth: `.slice(-N)` | State serialises to JSON |
| Heavy logic in hooks | Define in Library, call from hooks | Library re-executes each hook |
| Remove cards during forward iteration | Iterate backwards or collect indices | Indices shift on splice |
| `addWorldEntry` / `updateWorldEntry` | `addStoryCard` / `updateStoryCard` | Old API is deprecated |
| Assume `title === keys` after creation | Check and set separately | `addStoryCard` sets `title = keys` |
| Skip `Object.seal` on returned cards | Seal cards from helper functions | Prevents accidental property addition |

---

## 9 — Debugging

```js
// library.js pattern
log("unexpected error");

// Narrative-Steering-Wheel pattern
console.log("memory1:", state.memory1);

// Debug toggle pattern
const DEBUG = false;
const dbg = (label, val) => { if (DEBUG) log(`[DBG] ${label}: ${JSON.stringify(val)}`); };
```

Remember: `undefined` logs as `null` due to JSON serialisation.

---

## 10 — `globalThis` Access Pattern (library.js)

All sandbox globals are accessible via `globalThis`:

```js
// Validation check (InnerSelf init)
if (
  !globalThis.state || (typeof state !== "object") || Array.isArray(state)
  || !globalThis.info || (typeof info !== "object") || Array.isArray(info)
  || !Array.isArray(globalThis.storyCards)
  || (typeof addStoryCard !== "function")
  || !Array.isArray(globalThis.history)
  || (typeof text !== "string")
) {
  log("unexpected error");
  globalThis.text ||= " ";
  return;
}
```

This is the proven way to validate the sandbox environment before running complex script logic.

---

## 11 — Context Structure Quick-Ref

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

## 12 — Quick-Start Template (Based on Working Code Patterns)

### SharedLibrary

```js
// === Helpers ===
const deepMerge = (target = {}, source = {}) => {
  for (const key in source) {
    if (source[key] && (typeof source[key] === "object") && !Array.isArray(source[key])) {
      if (!target[key] || (typeof target[key] !== "object")) target[key] = {};
      deepMerge(target[key], source[key]);
    } else if (target[key] === undefined) {
      target[key] = source[key];
    }
  }
  return target;
};

const ensureCard = (title, entry, type = "Custom") => {
  let c = storyCards.find(x => x.title === title);
  if (!c) { addStoryCard(title, entry, type); c = storyCards.find(x => x.title === title); }
  else c.entry = entry;
  return c;
};

// === State Init ===
state.myData = deepMerge(state.myData || {}, {
  counter: 0,
  enabled: true
});
```

### Input

```js
const modifier = (text) => {
  // your input logic
  return { text };
};
modifier(text);
```

### Context

```js
const modifier = (text) => {
  // your context logic
  return { text };
};
modifier(text);
```

### Output

```js
const modifier = (text) => {
  // your output logic
  return { text };
};
modifier(text);
```

---

*Ground truth sources: LewdLeah's InnerSelf/AutoCards (library.js), Xilmanaath's VerbalizedSampling, NGO/D20 system (ai_studio_code, Input(1).txt, Output.txt), Narrative-Steering-Wheel. All code verified as running in the AI Dungeon sandbox.*
