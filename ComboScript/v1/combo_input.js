// ═══════════════════════════════════════════════════════════════════════════════
// ComboScript v1.0 — Input Hook
// Handles: InnerSelf integration, player commands, unified text scanning,
//          Steering Wheel memory capture, D20 success/failure rolls,
//          and inputSnapshot storage for the Context hook.
//
// Per AID_Practical_Code_Review §3.1: Input hook receives player text.
// It MUST return { text } (never empty string — use single space for commands).
// Continue/Retry skip this hook, so all data is stored in state.combo.inputSnapshot.
// ═══════════════════════════════════════════════════════════════════════════════

// ── InnerSelf integration guard (§10 of Blueprint) ───────────────────────────
if (typeof InnerSelf === "function") {
  InnerSelf("input");
}

const modifier = (text) => {
  // Safety: if ComboEngine didn't load or master switch is off, pass through
  if (typeof ComboEngine === 'undefined' || !state.combo || !state.combo.enabled) {
    return { text };
  }

  const combo = state.combo;
  const CE = ComboEngine;

  // ═══════════════════════════════════════════════════════════════════════════
  // 1. PLAYER COMMAND ROUTER
  //    All commands return { text: ' ' } (single space, per Practical Code
  //    Review §4.2: never return empty string from Input).
  // ═══════════════════════════════════════════════════════════════════════════

  const trimmed = text.trim().toLowerCase();

  // ── /status — Full status report ───────────────────────────────────────
  if (trimmed === '/status') {
    const report = CE.getStatusReport(combo);
    CE.ensureCard('SYSTEM: Status', report, 'system');
    CE.dbg('cmd', '/status');
    return { text: ' ' };
  }

  // ── /debug — Toggle debug logging ──────────────────────────────────────
  if (trimmed === '/debug') {
    combo.debug = !combo.debug;
    CE.ensureCard('SYSTEM: Status', 'Debug logging: ' + (combo.debug ? 'ON' : 'OFF'), 'system');
    return { text: ' ' };
  }

  // ── /bp — BonepokeOS commands ──────────────────────────────────────────
  if (trimmed === '/bp on') {
    combo.bp.enabled = true;
    CE.ensureCard('SYSTEM: Status', 'BonepokeOS: ON', 'system');
    CE.dbg('cmd', '/bp on');
    return { text: ' ' };
  }
  if (trimmed === '/bp off') {
    combo.bp.enabled = false;
    CE.ensureCard('SYSTEM: Status', 'BonepokeOS: OFF', 'system');
    CE.dbg('cmd', '/bp off');
    return { text: ' ' };
  }
  if (trimmed.indexOf('/bp archetype ') === 0) {
    const archName = trimmed.substring(14).trim().toUpperCase();
    const validArchetypes = ['OBSERVER', 'SHERLOCK', 'JESTER', 'WOUNDED_HEALER', 'CALCIFIER'];
    if (validArchetypes.indexOf(archName) !== -1) {
      combo.bp.forcedArchetype = archName;
      CE.ensureCard('SYSTEM: Status', 'Forced archetype: ' + archName, 'system');
      CE.dbg('cmd', '/bp archetype ' + archName);
    } else if (archName === 'AUTO' || archName === 'NONE' || archName === 'CLEAR') {
      combo.bp.forcedArchetype = null;
      CE.ensureCard('SYSTEM: Status', 'Archetype: auto-detect', 'system');
      CE.dbg('cmd', '/bp archetype auto');
    } else {
      CE.ensureCard('SYSTEM: Status', 'Unknown archetype: ' + archName + '. Valid: OBSERVER, SHERLOCK, JESTER, WOUNDED_HEALER, CALCIFIER, AUTO', 'system');
    }
    return { text: ' ' };
  }
  if (trimmed === '/bp reset') {
    combo.bp.tick = 0;
    combo.bp.shimmerUsed = 0;
    combo.bp.motifCounts = {};
    combo.bp.lastRuptureTick = 0;
    combo.bp.memory = [];
    combo.bp.history = [];
    combo.bp.lastAnalysis = null;
    combo.bp.correctionActive = false;
    combo.bp.correctionSignal = '';
    combo.bp.forcedArchetype = null;
    CE.ensureCard('SYSTEM: Status', 'BonepokeOS state reset.', 'system');
    CE.dbg('cmd', '/bp reset');
    return { text: ' ' };
  }

  // ── /vs — Verbalized Sampling commands ─────────────────────────────────
  if (trimmed === '/vs on') {
    combo.vs.enabled = true;
    CE.ensureCard('SYSTEM: Status', 'Verbalized Sampling: ON', 'system');
    CE.dbg('cmd', '/vs on');
    return { text: ' ' };
  }
  if (trimmed === '/vs off') {
    combo.vs.enabled = false;
    CE.ensureCard('SYSTEM: Status', 'Verbalized Sampling: OFF', 'system');
    CE.dbg('cmd', '/vs off');
    return { text: ' ' };
  }
  if (trimmed === '/vs wild') {
    combo.vs.mode = 'tail';
    combo.vs.threshold = 0.01;
    combo.vs.candidates = 7;
    CE.clampVS(combo);
    CE.ensureCard('SYSTEM: Status', 'VS: WILD mode (tail@0.01, 7 candidates)', 'system');
    CE.dbg('cmd', '/vs wild');
    return { text: ' ' };
  }
  if (trimmed === '/vs focus') {
    combo.vs.mode = 'standard';
    combo.vs.threshold = 1.0;
    combo.vs.candidates = 3;
    CE.clampVS(combo);
    CE.ensureCard('SYSTEM: Status', 'VS: FOCUS mode (standard@1.00, 3 candidates)', 'system');
    CE.dbg('cmd', '/vs focus');
    return { text: ' ' };
  }
  if (trimmed.indexOf('/vs threshold ') === 0) {
    const tVal = parseFloat(trimmed.substring(14));
    if (!isNaN(tVal)) {
      combo.vs.threshold = Math.max(CE.CONSTRAINTS.vsThreshold.min, Math.min(CE.CONSTRAINTS.vsThreshold.max, tVal));
      CE.ensureCard('SYSTEM: Status', 'VS threshold: ' + combo.vs.threshold.toFixed(2) +
        ' [' + CE.CONSTRAINTS.vsThreshold.min + '-' + CE.CONSTRAINTS.vsThreshold.max + ']', 'system');
      CE.dbg('cmd', '/vs threshold ' + combo.vs.threshold);
    } else {
      CE.ensureCard('SYSTEM: Status', 'Invalid threshold. Use: /vs threshold 0.10', 'system');
    }
    return { text: ' ' };
  }
  if (trimmed.indexOf('/vs candidates ') === 0) {
    const cVal = parseInt(trimmed.substring(15), 10);
    if (!isNaN(cVal)) {
      combo.vs.candidates = Math.max(CE.CONSTRAINTS.vsCandidates.min, Math.min(CE.CONSTRAINTS.vsCandidates.max, cVal));
      CE.ensureCard('SYSTEM: Status', 'VS candidates: ' + combo.vs.candidates +
        ' [' + CE.CONSTRAINTS.vsCandidates.min + '-' + CE.CONSTRAINTS.vsCandidates.max + ']', 'system');
      CE.dbg('cmd', '/vs candidates ' + combo.vs.candidates);
    } else {
      CE.ensureCard('SYSTEM: Status', 'Invalid count. Use: /vs candidates 5', 'system');
    }
    return { text: ' ' };
  }

  // ── /steer — Steering Wheel manual injection ──────────────────────────
  if (trimmed.indexOf('/steer ') === 0 && combo.steer.enabled) {
    const steerText = text.trim().substring(7).trim();
    if (steerText.length > 0) {
      // Find first empty slot, or overwrite oldest
      let placed = false;
      for (let si = 0; si < CE.CONSTRAINTS.steerSlots; si++) {
        if (!combo.steer.memories[si]) {
          combo.steer.memories[si] = steerText;
          combo.steer.expirations[si] = info.actionCount + combo.steer.ttl;
          placed = true;
          break;
        }
      }
      if (!placed) {
        // Overwrite the one expiring soonest
        let minExp = Infinity;
        let minIdx = 0;
        for (let si = 0; si < CE.CONSTRAINTS.steerSlots; si++) {
          const exp = combo.steer.expirations[si] || 0;
          if (exp < minExp) { minExp = exp; minIdx = si; }
        }
        combo.steer.memories[minIdx] = steerText;
        combo.steer.expirations[minIdx] = info.actionCount + combo.steer.ttl;
      }
      CE.ensureCard('SYSTEM: Status', 'Steering memory set: "' + steerText + '" (expires turn ' + (info.actionCount + combo.steer.ttl) + ')', 'system');
      CE.dbg('cmd.steer', steerText);
    } else {
      CE.ensureCard('SYSTEM: Status', 'Usage: /steer <theme or direction>', 'system');
    }
    return { text: ' ' };
  }
  if (trimmed === '/steer clear') {
    combo.steer.memories = ['', '', ''];
    combo.steer.expirations = [null, null, null];
    CE.ensureCard('SYSTEM: Status', 'Steering memories cleared.', 'system');
    return { text: ' ' };
  }

  // ── /mode — JADE preset switching ──────────────────────────────────────
  if (trimmed.indexOf('/mode ') === 0) {
    const modeName = trimmed.substring(6).trim().toUpperCase();
    if (CE.applyMode(modeName)) {
      const modeInfo = CE.JADE_MODES[modeName];
      CE.ensureCard('SYSTEM: Status', 'Mode: ' + modeName + ' — ' + modeInfo.desc, 'system');
    } else {
      const available = Object.keys(CE.JADE_MODES).join(', ');
      CE.ensureCard('SYSTEM: Status', 'Unknown mode: ' + modeName + '. Available: ' + available, 'system');
    }
    return { text: ' ' };
  }

  // ── /reset all — Full state reset ──────────────────────────────────────
  if (trimmed === '/reset all') {
    delete state.combo;
    CE.initState();
    CE.ensureCard('SYSTEM: Status', 'All ComboScript state reset to defaults.', 'system');
    CE.dbg('cmd', '/reset all');
    return { text: ' ' };
  }

  // ── /help — List commands ──────────────────────────────────────────────
  if (trimmed === '/combo' || trimmed === '/combo help') {
    const helpText = [
      'ComboScript v1.0 Commands:',
      '/status — Full system status',
      '/debug — Toggle debug logging',
      '/bp on|off — Toggle BonepokeOS',
      '/bp archetype <name|auto> — Force/clear archetype',
      '/bp reset — Reset Bonepoke state',
      '/vs on|off — Toggle Verbalized Sampling',
      '/vs threshold <0.01-1.0> — Set VS threshold',
      '/vs candidates <3-10> — Set VS candidate count',
      '/vs wild — Max diversity mode',
      '/vs focus — Balanced mode',
      '/steer <text> — Inject steering memory (TTL: ' + combo.steer.ttl + ' turns)',
      '/steer clear — Clear all steering memories',
      '/mode <name> — Switch preset (GRITTY, WHIMSICAL, LITERARY, FREEFORM, RAW)',
      '/reset all — Reset all state to defaults'
    ].join('\n');
    CE.ensureCard('SYSTEM: Status', helpText, 'system');
    return { text: ' ' };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 2. STEERING WHEEL — PARENTHETICAL MEMORY CAPTURE
  //    Player text containing (parenthetical) phrases are extracted as
  //    steering memories. Original text is passed through unchanged.
  // ═══════════════════════════════════════════════════════════════════════════

  if (combo.steer.enabled) {
    // Expire old memories
    for (let si = 0; si < CE.CONSTRAINTS.steerSlots; si++) {
      if (combo.steer.expirations[si] !== null && info.actionCount >= combo.steer.expirations[si]) {
        CE.dbg('steer.expire', 'slot ' + si + ': "' + combo.steer.memories[si] + '"');
        combo.steer.memories[si] = '';
        combo.steer.expirations[si] = null;
      }
    }

    // Capture (parenthetical) content from player input
    const parenMatch = text.match(/\(([^)]+)\)/g);
    if (parenMatch) {
      for (let pi = 0; pi < parenMatch.length; pi++) {
        const content = parenMatch[pi].replace(/[()]/g, '').trim();
        if (content.length < 3) continue;
        // Find empty slot or overwrite oldest
        let placed = false;
        for (let si = 0; si < CE.CONSTRAINTS.steerSlots; si++) {
          if (!combo.steer.memories[si]) {
            combo.steer.memories[si] = content;
            combo.steer.expirations[si] = info.actionCount + combo.steer.ttl;
            placed = true;
            CE.dbg('steer.capture', 'slot ' + si + ': "' + content + '"');
            break;
          }
        }
        if (!placed) {
          let minExp = Infinity, minIdx = 0;
          for (let si = 0; si < CE.CONSTRAINTS.steerSlots; si++) {
            const exp = combo.steer.expirations[si] || 0;
            if (exp < minExp) { minExp = exp; minIdx = si; }
          }
          combo.steer.memories[minIdx] = content;
          combo.steer.expirations[minIdx] = info.actionCount + combo.steer.ttl;
          CE.dbg('steer.capture.overwrite', 'slot ' + minIdx + ': "' + content + '"');
        }
      }
    }

    // Capture last 5 words of input for transition anchoring
    const inputWords = text.trim().split(/\s+/);
    if (inputWords.length >= 5) {
      combo.steer.lastInputWords = inputWords.slice(-5).join(' ');
    } else if (inputWords.length > 0) {
      combo.steer.lastInputWords = inputWords.join(' ');
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 3. UNIFIED KEYWORD SCAN (single pass — all vocabularies)
  // ═══════════════════════════════════════════════════════════════════════════

  const scan = CE.scanText(text);
  CE.dbg('input.scan', {
    conflict: scan.conflict, calming: scan.calming,
    tone: scan.dominantTone, genre: scan.dominantGenre, words: scan.wordCount
  });

  // ── NGO Heat Update (player impact) ────────────────────────────────────
  if (scan.conflict > 0) {
    combo.heat += scan.conflict * combo.config.playerHeatImpact;
    if (scan.conflict >= combo.config.tempIncreaseThreshold) {
      combo.temperature += 1;
    }
  }
  if (scan.calming > 0) {
    combo.heat -= scan.calming * combo.config.playerCoolImpact;
  }

  // ── Tone → Heat crosswalk (Bonepoke Integration Methods §4) ────────────
  if (scan.shear > 0) combo.heat += scan.shear;
  if (scan.lift > 0) combo.heat += Math.ceil(scan.lift * 0.5);
  if (scan.drop > 0) combo.heat -= scan.drop;

  CE.clampHeat(combo);
  CE.clampTemperature(combo);

  CE.dbg('input.heat', combo.heat);
  CE.dbg('input.temp', combo.temperature);

  // ── Player inversion clears correction (Integration Loop 5) ────────────
  if (scan.invert > 1 && combo.bp.correctionActive) {
    combo.bp.correctionActive = false;
    combo.bp.correctionSignal = '';
    CE.dbg('input.invert', 'player inversion cleared correction signal');
  }

  // ── Store input snapshot (persists for Context even on Continue/Retry) ──
  combo.inputSnapshot = {
    tone: {
      lift: scan.lift, drop: scan.drop, shear: scan.shear, invert: scan.invert,
      dominant: scan.dominantTone, intensity: Math.max(scan.lift, scan.drop, scan.shear, scan.invert)
    },
    genre: scan.dominantGenre,
    conflictCount: scan.conflict,
    calmingCount: scan.calming
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // 4. D20 SUCCESS/FAILURE LOGIC
  //    Only rolls if action count changed. Detects "You try to" / "You attempt"
  //    patterns and resolves success/failure/partial.
  // ═══════════════════════════════════════════════════════════════════════════

  if (combo.roll.action !== info.actionCount) {
    let successThreshold = 0.5;
    if (/disadvantage/i.test(text)) successThreshold += 0.2;
    if (/advantage/i.test(text)) successThreshold -= 0.2;
    // Clamp success threshold to [0.1, 0.9]
    successThreshold = Math.max(0.1, Math.min(0.9, successThreshold));

    const partialThreshold = successThreshold + 0.2;
    const rollValue = Math.random();

    const match = text.match(/> (.*) (try|trie|attempt)(s?)/i);
    let rollResult = '';
    if (match && !((match[1].match(/"/g) || []).length % 2)) {
      const succeeded = rollValue > successThreshold;
      const partial = succeeded && rollValue < partialThreshold;
      rollResult = (succeeded ? 'And ' : 'But ') +
        match[1].replace(/^You\b/, 'you').replace(/,$/, ' and') +
        (partial ? ' partially' : '') +
        (succeeded ? ' succeed' : ' fail') +
        (match[3] ? 's' : '') +
        (succeeded ? '.' : '!');
    }

    combo.roll.frontMemory = rollResult;
    combo.roll.action = info.actionCount;
    CE.dbg('d20.roll', { value: rollValue.toFixed(2), threshold: successThreshold, result: rollResult || 'no match' });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 5. RETURN — Per Practical Code Review §3.1, always return { text }
  // ═══════════════════════════════════════════════════════════════════════════

  return { text };
};

modifier(text);
