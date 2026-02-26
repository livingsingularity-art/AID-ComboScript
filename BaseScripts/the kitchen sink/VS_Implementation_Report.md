# Verbalized Sampling in the AI Dungeon Sandbox

## A Technical Report on Maximizing the Paper's Methods Under Platform Constraints

**Reference paper:** Zhang et al., "Verbalized Sampling: How to Mitigate Mode Collapse and Unlock LLM Diversity," arXiv:2510.01171v3  
**Platform:** AI Dungeon (Phoenix-era), sandboxed JavaScript runtime  
**Reference documents:** AID Practical Code Review (primary), AID Gap Analysis Reference, AID Scripting Reference

---

## 1 — The Problem: What the Paper Proves and Why It Matters for AID

The paper establishes a formal mechanism for why post-trained LLMs produce repetitive, stereotypical outputs. The core finding is expressed in Equation 3:

> π*(y|x) ∝ π_ref(y|x)^γ · exp(r_true(x,y) / β),  where γ = 1 + α/β > 1

In plain terms: when many valid story continuations exist (high true-utility tie), human typicality bias in alignment data acts as a sharpening exponent (γ > 1) that compresses the model's output toward the single most conventional response. For interactive fiction this is devastating — it means the AI will gravitate toward the same story beats, the same character reactions, the same descriptive phrasings, turn after turn.

The paper identifies three tiers of prompt that collapse to different modes:

1. **Instance-level** ("write a story continuation") → collapses to the single mode instance of the base model. This is what every AID turn does by default.
2. **List-level** ("write 5 story continuations") → collapses to a uniform list. Better, but still loses probability information.
3. **Distribution-level / VS** ("write 5 continuations with their probabilities") → collapses to a distribution approximating the pre-training distribution. This is the key innovation.

The paper proves that the probability verbalization is the critical differentiator: it shifts the LLM from generating a single "best" item to generating a *distribution* of items — which recovers the diversity of the underlying base model.

For AI Dungeon, where the whole point is surprising, varied, creative narrative generation, this is exactly the mechanism that would have the most impact. But the platform imposes hard constraints that the paper's reference implementation (JSON API calls returning structured lists) cannot directly accommodate.

---

## 2 — Platform Constraints Analysis

The AID sandbox limits what is possible. These constraints shape every implementation decision:

**Single output per turn.** The AI produces one text response per action. There is no way to generate multiple candidate responses and select among them programmatically. The model's output is streamed directly to the player.

**No logit access.** Scripts cannot read token probabilities, top-k distributions, or any internal model state. The probability information that VS asks the model to verbalize cannot be verified or consumed numerically by scripts.

**No API calls.** No `fetch`, no `setTimeout`, no network access. The script cannot call the model a second time or make external requests.

**Text-only injection.** Scripts influence the AI through three channels: modifying the context text (context hook), modifying player input (input hook), and modifying AI output (output hook). All steering is done by manipulating the text the model sees or produces.

**Memory slot positioning is fixed.** The context structure places `state.memory.authorsNote` just before the last action and `state.memory.frontMemory` at the very end — both near the recency-bias sweet spot where instructions have the strongest effect. Story cards inject into the World Lore section, which is higher up and more easily displaced by token limits.

**State persists but re-executes.** `state` survives across turns (JSON-serialized), but SharedLibrary re-executes before every hook. Computed values in Library scope are fresh each time.

**Hook execution is not universal.** Continue and Retry skip the Input hook. Alter triggers no hooks at all. Any VS implementation must account for this.

---

## 3 — Proposed Implementation Methods

The following methods are ordered from simplest (drop-in replacement) to most sophisticated (multi-system integration). Each preserves the paper's theoretical mechanism to the greatest degree possible within AID constraints.

### Method 1: Internal Distribution Reasoning (VS-CoT Adaptation)

**Theoretical basis:** The paper's VS-CoT variant asks the model to reason step-by-step before generating the distribution. The paper shows VS-CoT achieves the highest single-call quality-diversity Pareto position (Figure 4d) and that the "cognitive burden" of complex prompts is actually beneficial for larger models (Figure 4f). Since AID must produce a single output, we adapt VS-CoT to perform the distribution reasoning internally while outputting only the selected response.

**Implementation — Context Hook Injection via authorsNote:**

```js
// === SharedLibrary ===
const VS = (() => {
    const deepMerge = (target = {}, source = {}) => {
        for (const key in source) {
            if (source[key] && typeof source[key] === "object"
                && !Array.isArray(source[key])) {
                if (!target[key] || typeof target[key] !== "object")
                    target[key] = {};
                deepMerge(target[key], source[key]);
            } else if (target[key] === undefined) {
                target[key] = source[key];
            }
        }
        return target;
    };

    // Persistent config with safe defaults
    const cfg = state.vs = deepMerge(state.vs || {}, {
        enabled: true,
        threshold: 0.20,
        candidates: 5,
        mode: "standard"  // "standard" | "tail" | "off"
    });

    const INSTRUCTIONS = {
        standard: (k) =>
            `[Internal process: Before writing, silently consider ${k}`
            + ` distinct possible continuations spanning the full probability`
            + ` distribution. Estimate each continuation's relative probability`
            + ` (0.0–1.0) given the story context. Select one continuation to`
            + ` write, weighted by these probabilities. Output only the selected`
            + ` continuation with no meta-commentary.]`,

        tail: (k, p) =>
            `[Internal process: Before writing, silently consider ${k}`
            + ` distinct possible continuations sampled from the tails of the`
            + ` probability distribution — each with estimated probability`
            + ` below ${p}. These should be surprising, unconventional, or`
            + ` creatively unexpected while remaining coherent with the`
            + ` established story. Select one and output only that continuation`
            + ` with no meta-commentary.]`
    };

    const getInstruction = () => {
        if (!cfg.enabled || cfg.mode === "off") return "";
        if (cfg.mode === "tail") {
            return INSTRUCTIONS.tail(cfg.candidates, cfg.threshold);
        }
        return INSTRUCTIONS.standard(cfg.candidates);
    };

    return { getInstruction, cfg };
})();
```

```js
// === Context Hook ===
const modifier = (text) => {
    const instruction = VS.getInstruction();
    if (instruction) {
        state.memory.authorsNote = instruction;
    }
    return { text };
};
modifier(text);
```

**Why authorsNote instead of a story card:** Per the AID Practical Code Review §2.1, `authorsNote` is positioned just before the last action in the context — the highest-influence position for behavioral steering. Story cards inject into World Lore, which is farther from the generation point and subject to token-limit reduction. The paper's own prompt is designed as a system-level instruction, not triggered world information. Using `authorsNote` maps the paper's prompt placement to the most analogous AID position.

**Why this preserves the paper's mechanism:** The instruction asks the model to internally construct a probability distribution over candidates before selecting. The paper proves (§4.1) that the act of reasoning about a distribution — even without outputting it — shifts which mode the model collapses to. The key phrase "estimate each continuation's relative probability" is what differentiates this from a simple "be creative" instruction. It activates the distribution-level reasoning pathway that the paper identifies as the core VS mechanism.

**Configurable threshold:** The paper demonstrates (Figures 4g–i) that decreasing the probability threshold increases diversity monotonically. The `state.vs.threshold` parameter maps directly to this mechanism and can be adjusted by players through slash commands.

---

### Method 2: Output-Hook Diversity Monitor with Adaptive Thresholds

**Theoretical basis:** The paper shows that mode collapse manifests as high pairwise cosine similarity between outputs (§5 evaluation methodology). While AID cannot compute embeddings, lexical repetition detection serves as a practical proxy. The paper also shows (§5.3 Temperature Ablation) that VS is orthogonal to temperature — the two compose. This method uses cross-turn repetition detection to dynamically tighten the VS probability threshold when the story is collapsing.

**Implementation — Output Hook with History Scanning:**

```js
// === SharedLibrary (additions to Method 1) ===
const VSDiversity = (() => {
    const cfg = state.vs;  // shared with VS module

    // Track output fingerprints for repetition detection
    state.vs.fingerprints = state.vs.fingerprints ?? [];
    const MAX_FINGERPRINTS = 10;

    // Extract content words as a rough fingerprint
    const fingerprint = (text) => {
        const words = text.toLowerCase()
            .replace(/[^\w\s]/g, "")
            .split(/\s+/)
            .filter(w => w.length > 3);
        // Keep the 20 most frequent content words
        const freq = {};
        for (const w of words) freq[w] = (freq[w] || 0) + 1;
        return Object.entries(freq)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 20)
            .map(e => e[0]);
    };

    // Jaccard similarity between two word sets
    const similarity = (a, b) => {
        if (!a.length || !b.length) return 0;
        const setA = new Set(a);
        const setB = new Set(b);
        let intersection = 0;
        for (const w of setA) {
            if (setB.has(w)) intersection++;
        }
        return intersection / (setA.size + setB.size - intersection);
    };

    // Compute average similarity of latest output against recent history
    const measureCollapse = (currentFP) => {
        const fps = state.vs.fingerprints;
        if (fps.length < 2) return 0;
        let total = 0;
        for (const fp of fps) {
            total += similarity(currentFP, fp);
        }
        return total / fps.length;
    };

    // Record a new fingerprint, bounded
    const record = (text) => {
        const fp = fingerprint(text);
        state.vs.fingerprints.push(fp);
        if (state.vs.fingerprints.length > MAX_FINGERPRINTS) {
            state.vs.fingerprints =
                state.vs.fingerprints.slice(-MAX_FINGERPRINTS);
        }
        return fp;
    };

    // Adaptive threshold: tighten when collapse detected
    const adapt = (collapseScore) => {
        // collapseScore ranges 0 (no similarity) to 1 (identical)
        // Paper Fig 4g-i: lower threshold → higher diversity
        if (collapseScore > 0.6) {
            // High repetition: push into distribution tails
            cfg.mode = "tail";
            cfg.threshold = Math.max(0.05, cfg.threshold * 0.7);
        } else if (collapseScore > 0.4) {
            // Moderate repetition: use tail sampling
            cfg.mode = "tail";
            cfg.threshold = 0.20;
        } else {
            // Healthy diversity: standard sampling
            cfg.mode = "standard";
            cfg.threshold = 0.20;
        }
    };

    return { fingerprint, measureCollapse, record, adapt };
})();
```

```js
// === Output Hook ===
const modifier = (text) => {
    if (!state.vs?.enabled) return { text };

    const fp = VSDiversity.record(text);
    const collapse = VSDiversity.measureCollapse(fp);
    VSDiversity.adapt(collapse);

    return { text };
};
modifier(text);
```

**How this extends the paper:** The paper treats VS as a static prompt configuration. This method makes it reactive — the system detects when the model is falling into mode collapse (high fingerprint similarity across recent outputs) and automatically tightens the probability threshold to push generation further into the distribution tails. This is the programmatic equivalent of the paper's manual diversity tuning experiments (§H.4), but automated based on observed output behavior.

**Bounded state growth:** Fingerprints are capped at 10 entries with `.slice(-MAX_FINGERPRINTS)`, following the anti-pattern guidance from the Practical Code Review §8.

---

### Method 3: Multi-Turn VS via History-Aware Context Construction

**Theoretical basis:** The paper's VS-Multi variant uses conversation history to avoid repeating previously generated responses. In AID, `history` provides exactly this — a record of all prior AI outputs. The paper shows VS-Multi achieves the highest diversity scores on story generation (Figure 4b: 36.0 vs 34.7 for VS-Standard). This method constructs a history-aware VS instruction that tells the model what modes it has already explored.

**Implementation — Context Hook with History Analysis:**

```js
// === SharedLibrary (additions to Methods 1–2) ===
const VSMultiTurn = (() => {
    const SCAN_DEPTH = 5;  // How many recent outputs to analyze

    // Extract the "mode" of each recent output as a brief descriptor
    const extractModes = () => {
        if (!history || history.length < 2) return [];
        const recent = history.slice(-SCAN_DEPTH * 2);
        const modes = [];
        for (const entry of recent) {
            if (entry.type === "story" || entry.type === "continue") {
                // Extract opening phrase as mode indicator
                const opening = (entry.text || "").trim()
                    .split(/[.!?\n]/)
                    .filter(s => s.trim().length > 10)
                    .slice(0, 2)
                    .map(s => s.trim())
                    .join("; ");
                if (opening) modes.push(opening);
            }
        }
        return modes.slice(-4);  // Keep last 4 mode summaries
    };

    // Build a VS-Multi style instruction that references history
    const getMultiTurnInstruction = (baseCfg) => {
        const modes = extractModes();
        const k = baseCfg.candidates || 5;
        const p = baseCfg.threshold || 0.20;

        let instruction =
            `[Internal process: Before writing, silently consider`
            + ` ${k} distinct possible continuations. Estimate each`
            + ` continuation's probability (0.0–1.0) relative to the`
            + ` full distribution. Preferentially sample from`
            + ` continuations with probability below ${p}.`;

        if (modes.length > 0) {
            instruction +=
                ` The story has recently explored these narrative`
                + ` directions: "${modes.join('"; "')}".`
                + ` Deliberately diverge from these established`
                + ` patterns — seek unexplored narrative territory.`;
        }

        instruction +=
            ` Select one continuation and output only that`
            + ` continuation with no meta-commentary.]`;

        return instruction;
    };

    return { getMultiTurnInstruction, extractModes };
})();
```

```js
// === Context Hook (replacing Method 1's simpler version) ===
const modifier = (text) => {
    if (!state.vs?.enabled) return { text };

    const instruction = (history && history.length > 4)
        ? VSMultiTurn.getMultiTurnInstruction(state.vs)
        : VS.getInstruction();  // fall back to standard VS early on

    if (instruction) {
        state.memory.authorsNote = instruction;
    }
    return { text };
};
modifier(text);
```

**How this maps to the paper:** The paper's VS-Multi (Table 1) uses `h_{i-1}` (conversation history up to turn i-1) so the model avoids repeating itself. The AID `history` array provides the same signal. By extracting opening phrases from recent AI outputs and including them as "already-explored modes" in the instruction, we give the model the same anti-repetition signal that VS-Multi achieves through multi-turn conversation context. The paper shows this variant is particularly strong for story generation.

---

### Method 4: Dual-Slot VS with Separated Concerns

**Theoretical basis:** The paper's VS prompt has two functional components: (1) the distribution-reasoning instruction and (2) the diversity-tuning threshold. These serve different purposes in the context. The AID context structure provides two high-influence injection points: `authorsNote` (near end of context, before last action) and `frontMemory` (absolute end, never reduced by token limits). Separating the VS components across these slots maximizes their individual effectiveness.

**Implementation:**

```js
// === Context Hook ===
const modifier = (text) => {
    if (!state.vs?.enabled) return { text };

    const cfg = state.vs;
    const k = cfg.candidates || 5;

    // authorsNote: the distribution-reasoning instruction
    // This goes near the end of context, steering the model's
    // generation approach
    state.memory.authorsNote =
        `[Internal process: Before writing, silently consider`
        + ` ${k} distinct possible continuations and estimate each`
        + ` one's probability relative to the full distribution of`
        + ` valid story continuations.]`;

    // frontMemory: the selection/threshold instruction
    // This is the very last thing the model sees — it controls
    // which part of the distribution to sample from
    const modes = VSMultiTurn.extractModes();
    let front =
        `[Select one continuation with probability below`
        + ` ${cfg.threshold}. Output only the selected`
        + ` continuation.]`;

    if (modes.length > 1) {
        front =
            `[Avoid repeating the narrative patterns:`
            + ` "${modes.slice(-2).join('"; "')}".`
            + ` Select one continuation with probability below`
            + ` ${cfg.threshold}. Output only the selected`
            + ` continuation.]`;
    }

    state.memory.frontMemory = front;

    return { text };
};
modifier(text);
```

**Why dual-slot is theoretically grounded:** The paper's prompts place the full VS instruction in the system prompt. In AID's context structure, no single injection point has both system-prompt authority *and* last-position recency advantage. By splitting the instruction: the *reasoning directive* ("consider a distribution") goes in `authorsNote` where it shapes the model's generation approach, while the *selection constraint* ("pick from the tails") goes in `frontMemory` where it has the final word. `frontMemory` is never reduced by token limits (Gap Analysis §2.1), making the threshold constraint maximally persistent.

---

### Method 5: Player-Controlled VS via Input Hook Commands

**Theoretical basis:** The paper demonstrates tunable diversity through the probability threshold parameter (Figures 4g–i). This method exposes that tunability to the player through slash commands, letting them adjust VS behavior in real time — a direct implementation of the paper's diversity-tuning mechanism.

**Implementation — Input Hook:**

```js
// === Input Hook ===
const modifier = (text) => {
    if (!state.vs) return { text };

    const cmd = text.trim().toLowerCase();

    // Slash command processing
    if (cmd === "/vs off") {
        state.vs.enabled = false;
        state.message = "Verbalized Sampling: OFF";
        return { text: " " };
    }
    if (cmd === "/vs on") {
        state.vs.enabled = true;
        state.message = "Verbalized Sampling: ON";
        return { text: " " };
    }
    if (cmd.startsWith("/vs threshold ")) {
        const val = parseFloat(cmd.split(" ")[2]);
        if (!isNaN(val) && val > 0 && val <= 1) {
            state.vs.threshold = val;
            state.vs.mode = val < 1 ? "tail" : "standard";
            state.message =
                `VS threshold: ${val}`
                + ` (${val <= 0.05 ? "high" : val <= 0.2 ? "moderate" : "low"} diversity)`;
        }
        return { text: " " };
    }
    if (cmd === "/vs status") {
        const cfg = state.vs;
        state.message =
            `VS: ${cfg.enabled ? "ON" : "OFF"}`
            + ` | Mode: ${cfg.mode}`
            + ` | Threshold: ${cfg.threshold}`
            + ` | Candidates: ${cfg.candidates}`;
        return { text: " " };
    }
    if (cmd.startsWith("/vs candidates ")) {
        const val = parseInt(cmd.split(" ")[2]);
        if (!isNaN(val) && val >= 3 && val <= 10) {
            state.vs.candidates = val;
            state.message = `VS candidates: ${val}`;
        }
        return { text: " " };
    }
    if (cmd === "/vs wild") {
        // Paper §H.4: p=0.001 gives maximum diversity
        state.vs.threshold = 0.01;
        state.vs.candidates = 7;
        state.vs.mode = "tail";
        state.message = "VS: WILD mode (extreme diversity)";
        return { text: " " };
    }
    if (cmd === "/vs focus") {
        // Standard sampling from the full distribution
        state.vs.threshold = 1.0;
        state.vs.candidates = 3;
        state.vs.mode = "standard";
        state.message = "VS: FOCUS mode (balanced diversity)";
        return { text: " " };
    }

    return { text };
};
modifier(text);
```

**Note on return values:** Commands return `{ text: " " }` (single space) rather than `""` to avoid the known empty-string error documented in the Practical Code Review §4.2.

---

### Method 6: Story Card World Lore Integration for Genre-Specific VS

**Theoretical basis:** The paper shows (§5.1 Qualitative Examples, Table 2) that VS produces dramatically different diversity effects depending on the creative domain. Poetry, stories, and jokes each benefit from different probability thresholds. The paper also tests seven different probability verbalization formats (§H.3) and finds that the optimal format varies by model and task. This method uses keyword-triggered story cards to activate genre-specific VS configurations when the story enters different narrative modes.

**Implementation — SharedLibrary Genre Cards:**

```js
// === SharedLibrary ===
const VSGenre = (() => {
    const GENRES = {
        combat: {
            keys: "attack,fight,battle,sword,weapon,strike,parry,dodge",
            threshold: 0.15,
            candidates: 5,
            note: `Consider ${5} distinct possible combat outcomes`
                + ` spanning the full probability distribution.`
                + ` Include unexpected tactical developments,`
                + ` environmental factors, and consequences.`
                + ` Estimate probabilities and select one below 0.15.`
        },
        social: {
            keys: "talk,conversation,persuade,negotiate,charm,argue,discuss",
            threshold: 0.10,
            candidates: 6,
            note: `Consider ${6} distinct possible dialogue outcomes.`
                + ` Include unexpected emotional reactions, changes of`
                + ` mind, misunderstandings, and social dynamics rarely`
                + ` explored. Estimate probabilities and select one`
                + ` below 0.10.`
        },
        exploration: {
            keys: "explore,search,investigate,examine,discover,travel,journey",
            threshold: 0.08,
            candidates: 7,
            note: `Consider ${7} distinct possible discoveries`
                + ` spanning the full probability distribution.`
                + ` Include bizarre, wondrous, or unsettling`
                + ` findings that subvert expectations.`
                + ` Estimate probabilities and select one below 0.08.`
        },
        mystery: {
            keys: "clue,mystery,suspicious,evidence,detective,secret,hidden",
            threshold: 0.12,
            candidates: 5,
            note: `Consider ${5} distinct possible revelations.`
                + ` Include red herrings, unexpected connections,`
                + ` and evidence that recontextualizes prior events.`
                + ` Estimate probabilities and select one below 0.12.`
        }
    };

    const ensureCard = (title, entry, type = "VS-Genre") => {
        let card = storyCards.find(c => c.title === title);
        if (!card) {
            addStoryCard(title, entry, type);
            card = storyCards.find(c => c.title === title);
        } else {
            card.entry = entry;
        }
        return card;
    };

    // Scan recent text to detect active genre
    const detectGenre = (text) => {
        const lower = text.toLowerCase();
        const words = lower.split(/\s+/);
        let best = null;
        let bestScore = 0;
        for (const [genre, config] of Object.entries(GENRES)) {
            const keys = config.keys.split(",");
            let score = 0;
            for (const w of words) {
                const clean = w.replace(/^[^\w]+|[^\w]+$/g, "");
                if (keys.includes(clean)) score++;
            }
            if (score > bestScore) {
                bestScore = score;
                best = genre;
            }
        }
        return bestScore >= 2 ? best : null;
    };

    // Apply genre-specific VS settings
    const apply = (text) => {
        const genre = detectGenre(text);
        if (genre && GENRES[genre]) {
            const g = GENRES[genre];
            state.vs.threshold = g.threshold;
            state.vs.candidates = g.candidates;
            state.vs.mode = "tail";
            return g.note;
        }
        return null;
    };

    return { apply, detectGenre, GENRES };
})();
```

This method creates a feedback loop: the story's content determines how aggressively VS pushes into the distribution tails. Combat scenes get moderate diversity (you still want coherent action), while exploration scenes get high diversity (the whole point is unexpected discoveries).

---

## 4 — Recommended Combined Architecture

The methods above are designed to compose. The recommended full implementation uses all six methods in a layered architecture:

```
SharedLibrary
├── VS (Method 1)         — core config, instruction templates
├── VSDiversity (Method 2) — fingerprinting, collapse detection
├── VSMultiTurn (Method 3) — history-aware mode extraction
└── VSGenre (Method 6)    — genre detection, threshold tuning

Input Hook (Method 5)
└── Slash commands → state.vs config

Context Hook (Methods 1, 3, 4)
├── Genre detection → threshold adjustment
├── History analysis → anti-repetition hints
├── authorsNote ← distribution reasoning instruction
└── frontMemory ← selection threshold + mode avoidance

Output Hook (Method 2)
├── Fingerprint current output
├── Measure collapse score
└── Adapt threshold for next turn
```

**Execution flow per player action:**

1. **SharedLibrary** initializes VS config from `state`, sets up modules
2. **Input Hook** intercepts slash commands, or passes text through
3. **SharedLibrary** re-executes (fresh module instances, persisted state)
4. **Context Hook** detects genre, builds history-aware VS instruction, writes to `authorsNote` and `frontMemory`
5. **SharedLibrary** re-executes
6. **Output Hook** fingerprints the AI's response, measures collapse, adapts threshold for next turn

This architecture preserves all four of the paper's key mechanisms within AID constraints:

| Paper Mechanism | AID Implementation |
|---|---|
| Distribution-level reasoning | authorsNote instruction asks model to consider k candidates with probabilities |
| Probability threshold tuning | `state.vs.threshold` adjustable via commands, auto-adapted by collapse detector |
| VS-Multi history awareness | `history` scanning extracts recent narrative modes for anti-repetition instruction |
| VS-CoT chain-of-thought | "Internal process" framing triggers the model's step-by-step reasoning pathway |

---

## 5 — What Cannot Be Replicated and Honest Trade-offs

Several elements of the paper's method are impossible to fully implement in AID:

**No structured output verification.** The paper's VS prompts return JSON with explicit `text` and `probability` fields. AID cannot parse or verify the model's internal probability estimates. We rely entirely on the model's honest engagement with the instruction. The paper's finding that VS works across models (including closed-source ones where probabilities also cannot be verified) suggests this is acceptable — the act of *reasoning about* probabilities is what matters, not the numeric accuracy of those probabilities.

**No true multi-candidate selection.** The paper generates k candidates and optionally samples from them by verbalized probability. AID produces one output. Our adaptation asks the model to perform candidate generation and selection internally, which cannot be guaranteed. However, VS-CoT — which also uses single-output reasoning before selection — is the paper's highest-performing variant, suggesting that internal reasoning is effective.

**No embedding-based diversity measurement.** The paper evaluates diversity using OpenAI embeddings. The Jaccard fingerprint approximation in Method 2 is a coarse proxy. It will miss semantic similarity between lexically different outputs (e.g., two "partner disappearance" stories with different vocabulary, as in the paper's Table 2). This is a genuine limitation.

**No temperature control.** The paper shows VS composes with temperature (§5.3, Figure 6). AID scripts cannot modify sampling temperature. The probability threshold in the VS instruction serves as a partial proxy — the paper's experiments show threshold tuning has analogous effects to temperature scaling on the diversity axis.

**Instruction may be ignored.** Unlike a system prompt in an API call, `authorsNote` and `frontMemory` are part of the in-context text the model sees. A sufficiently strong prior context may override the VS instruction. Placing the threshold constraint in `frontMemory` (which is never token-reduced and appears last) mitigates this but does not eliminate it.

---

## 6 — Empirical Expectations

Based on the paper's results, the following outcomes are expected from a full implementation:

The paper reports VS-Standard increases diversity by 1.6–2.1x over direct prompting in creative writing (§5.1). In AID's constrained single-output setting, we should expect a smaller but still meaningful improvement — perhaps 1.2–1.5x — because the internal-reasoning adaptation loses some of the distributional signal that explicit multi-candidate generation provides.

The diversity tuning mechanism (threshold adjustment) should work well. The paper shows a clean monotonic relationship between threshold and diversity across all tasks and models (Figures 4g–i). Since this is purely a prompt-level instruction, it should translate directly.

The anti-repetition mechanism (Method 3, history awareness) should have the strongest practical impact for AID specifically. Interactive fiction's turn-by-turn structure means mode collapse manifests as obvious repetition that players notice immediately. The paper's VS-Multi achieves the highest coverage scores (Figure 9b) — maximum breadth of distinct outputs — which maps directly to the AID use case of "don't keep writing the same type of scene."

The genre-specific thresholds (Method 6) are extrapolations from the paper's task-specific results. Combat scenes, where coherent tactical cause-and-effect matters, should use more conservative thresholds (the paper's story task shows higher quality sensitivity). Exploration and mystery scenes, where surprise is the point, can push further into the tails.

---

## 7 — Differences from the Current Implementation

The existing `verbalizedSampling-library.js` and `verbalizedSampling-context.js` have the following gaps relative to this report's proposals:

The current instruction — "generate 3 seamless continuations sampled purposively from the tails of the distribution (p∈[0–1] < 0.20), pick one, output only the continuation; never mention steps or probabilities" — explicitly forbids the probability reasoning that the paper identifies as the core mechanism. This report's instructions preserve the internal probability estimation step.

The current code has a first-turn initialization bug where `getVSCard()` returns null because `buildCard`'s return value is not captured. This report's approach uses `state.memory.authorsNote` directly, avoiding the card infrastructure entirely and eliminating the bug.

The current code uses a story card with empty keys, which means it never triggers through the World Lore keyword system and only works because the context hook manually reads and appends it. This report's approach uses the purpose-built memory injection points (`authorsNote`, `frontMemory`) that are designed for exactly this kind of persistent behavioral steering.

The current code has no adaptive behavior, no history awareness, no genre detection, and no player controls. This report adds all four, mapping each to a specific mechanism from the paper.

---

*This report is based on Zhang et al. (arXiv:2510.01171v3), the AID Practical Code Review (primary reference), the AID Gap Analysis Reference, and the AID Scripting Reference. All code patterns follow the conventions and anti-pattern guidance established in those documents.*
