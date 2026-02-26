// ═══════════════════════════════════════════════════════════════════════════════
// ComboScript v1.0 — Context Hook
// The SINGLE point of injection. Only this hook writes to authorsNote and
// frontMemory. This eliminates clobbering between NGO, BonepokeOS, VS, and
// Steering Wheel — all of which previously wrote to the same slot independently.
//
// Per AID_Practical_Code_Review §3.2: Context hook runs before AI generation.
// It receives the context text and can modify state.memory.authorsNote and
// state.memory.frontMemory to steer AI behavior.
//
// Data sources:
//   state.combo.bp.lastAnalysis — BonepokeOS output audit from previous turn
//   state.combo.inputSnapshot — unified scan results from current Input hook
//   state.combo.steer — Steering Wheel memories with TTL
//   state.combo.roll — D20 roll result
//   state.combo.vs — Verbalized Sampling config + collapse score
//
// The Arbiter function in ComboEngine reads all of these and produces a single
// unified decision, which is then formatted into layered authorsNote + frontMemory.
// ═══════════════════════════════════════════════════════════════════════════════

const modifier = (text) => {
  // Safety: if ComboEngine didn't load or master switch is off, pass through
  if (typeof ComboEngine === 'undefined' || !state.combo || !state.combo.enabled) {
    return { text };
  }

  const combo = state.combo;
  const CE = ComboEngine;

  CE.dbg('context.start', 'turn ' + info.actionCount);

  // ═══════════════════════════════════════════════════════════════════════════
  // 1. RUN THE ARBITER
  //    Reads all subsystem state and produces a single unified decision.
  //    See combo_library.js §9 for the full Arbiter logic.
  // ═══════════════════════════════════════════════════════════════════════════

  const decision = CE.arbitrate(combo);

  CE.dbg('context.arbiter', {
    arch: decision.archetype ? decision.archetype.id : 'none',
    vsMode: decision.vsMode,
    vsThr: decision.vsThreshold,
    correction: decision.correction ? 'active' : 'none',
    steer: decision.steerTransition ? 'active' : 'none',
    tone: decision.toneGuidance ? decision.toneGuidance.substring(0, 40) : 'none'
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 2. BUILD LAYERED AUTHORS NOTE
  //    Priority order (Layer 1 = highest, survives truncation):
  //      1. Scenario base note (always present)
  //      2. Steering Wheel transition (player plot direction)
  //      3. VSL state + archetype mandate (structural quality)
  //      4. Tone guidance (match player emotional direction)
  //      5. Heat description (scene emotional state)
  //      6. Correction signal (Fragment Compost Protocol)
  //      7. Motif decay warnings (prevent overuse)
  //
  //    Per AID_Practical_Code_Review §4.1: authorsNote is injected ~3 lines
  //    before the end of context. Token budget is ~200-400 tokens.
  // ═══════════════════════════════════════════════════════════════════════════

  const authorsNote = CE.buildAuthorsNote(combo, decision);

  CE.dbg('context.authorsNote.length', authorsNote.length + ' chars');

  // ═══════════════════════════════════════════════════════════════════════════
  // 3. BUILD FRONT MEMORY
  //    Per AID_Practical_Code_Review §4.1: frontMemory is the last thing the
  //    model sees. Never reduced by token limits. Max ~100 tokens.
  //
  //    Parts (in order):
  //      1. VS selection constraint (most critical behavioral directive)
  //      2. D20 roll result (when applicable)
  //      3. MARM canary (when active)
  // ═══════════════════════════════════════════════════════════════════════════

  const frontMemory = CE.buildFrontMemory(combo, decision);

  CE.dbg('context.frontMemory.length', frontMemory.length + ' chars');

  // ═══════════════════════════════════════════════════════════════════════════
  // 4. INJECT INTO CONTEXT
  //    Only Context hook writes to these slots. Input never writes them.
  //    Output never writes them. This is the single point of injection.
  // ═══════════════════════════════════════════════════════════════════════════

  state.memory = state.memory || {};
  state.memory.authorsNote = authorsNote;
  state.memory.frontMemory = frontMemory;

  CE.dbg('context.injected', 'authorsNote=' + authorsNote.length + 'ch, frontMemory=' + frontMemory.length + 'ch');

  // ═══════════════════════════════════════════════════════════════════════════
  // 5. RETURN — Per Practical Code Review §3.2, return { text }
  //    Context hook does not modify `text` — it only sets memory slots.
  // ═══════════════════════════════════════════════════════════════════════════

  return { text };
};

modifier(text);
