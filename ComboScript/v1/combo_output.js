// ═══════════════════════════════════════════════════════════════════════════════
// ComboScript v1.0 — Output Hook
// The SINGLE point of measurement. Only this hook runs BonepokeOS.ingest(),
// VS fingerprinting, and NGO output scanning. This prevents duplicate work.
//
// Per AID_Practical_Code_Review §3.3: Output hook receives AI-generated text.
// It can modify `text` before display (AutoCards does this). Must return { text }.
//
// Compatibility with InnerSelf/AutoCards (from ai_studio_code (4).js, Output.txt):
//   1. InnerSelf("output") called FIRST, OUTSIDE modifier (handles its own state)
//   2. AutoCards("output", text) called LAST, INSIDE modifier
//   3. AutoCards return is polymorphic: may be object {text} or string
//   4. text must be reassigned from AutoCards result before returning
//   5. Do NOT call AutoCards("input") here — InnerSelf handles that in Input hook
//
// D20 frontMemory timing (from Output.txt line 44):
//   Output hook checks info.actionCount - 1 because the roll was recorded during
//   the Input hook for the PREVIOUS action. This is NOT done here anymore —
//   frontMemory is now built exclusively by Context hook. But the pattern is
//   preserved in how Context reads combo.roll.action vs info.actionCount.
// ═══════════════════════════════════════════════════════════════════════════════

// ── InnerSelf integration guard ──────────────────────────────────────────────
// MUST run outside modifier, before everything else.
// InnerSelf("output") handles NPC brain processing and card updates.
// Per ai_studio_code (4).js §1: "This must run first."
if (typeof InnerSelf === "function") {
  InnerSelf("output");
}

const modifier = (text) => {
  // Safety: if ComboEngine didn't load or master switch is off, pass through
  // but still run AutoCards (it's independent of ComboEngine)
  if (typeof ComboEngine === 'undefined' || !state.combo || !state.combo.enabled) {
    // Still run AutoCards even if ComboEngine is off
    if (typeof AutoCards === "function") {
      const cardResult = AutoCards("output", text);
      text = (typeof cardResult === 'object') ? cardResult.text : cardResult;
    }
    return { text };
  }

  const combo = state.combo;
  const CE = ComboEngine;

  CE.dbg('output.start', 'turn ' + info.actionCount + ', text length ' + text.length);

  // ═══════════════════════════════════════════════════════════════════════════
  // 1. NGO OUTPUT KEYWORD TRACKING
  //    AI output uses model impact values (lower than player impact, per the
  //    original Output.txt design: modelIncreaseHeatImpact defaults to 1).
  // ═══════════════════════════════════════════════════════════════════════════

  const scan = CE.scanText(text);

  CE.dbg('output.scan', {
    conflict: scan.conflict, calming: scan.calming,
    tone: scan.dominantTone, words: scan.wordCount
  });

  if (scan.conflict > 0) {
    combo.heat += scan.conflict * combo.config.modelHeatImpact;
    // Model output requires higher threshold to raise temperature (default 3, per Output.txt line 27)
    if (scan.conflict >= 3) {
      combo.temperature += 1;
    }
  }
  if (scan.calming > 0) {
    combo.heat -= scan.calming * combo.config.modelCoolImpact;
  }

  // Tone crosswalk on output (lighter touch than input — model output shouldn't
  // spike heat as aggressively as player intent)
  if (scan.shear > 1) combo.heat += 1;
  if (scan.drop > 1) combo.heat -= 1;

  CE.clampHeat(combo);
  CE.clampTemperature(combo);

  CE.dbg('output.heat', combo.heat);
  CE.dbg('output.temp', combo.temperature);

  // ═══════════════════════════════════════════════════════════════════════════
  // 2. BONEPOKE OS — FULL INGEST ON AI OUTPUT
  //    Runs the complete Vanilla → Bonepoke → Translator pipeline.
  //    Results stored in state.combo.bp.lastAnalysis for next Context pass.
  // ═══════════════════════════════════════════════════════════════════════════

  if (combo.bp.enabled && typeof BonepokeOS !== 'undefined' && text.length > 20) {
    const result = BonepokeOS.ingest(text, combo.bp, combo.bp.forcedArchetype);
    combo.bp.lastAnalysis = result;

    CE.dbg('output.bp', {
      e: result.e, beta: result.beta, lsc: result.lsc,
      state: result.state, arch: result.archetype.id,
      marm: result.marm, shimmer: result.shimmerUsed + '/' + result.shimmerLimit
    });

    // ── Fragment Compost Protocol ────────────────────────────────────────
    // If SLOP or GOLD: store correction signal for next Context pass
    // If SALVAGE: clear correction — output is productively tense
    if (!combo.correctionDisabled) {
      if (result.state === 'SLOP' || result.state === 'GOLD') {
        combo.bp.correctionActive = true;
        combo.bp.correctionSignal = result.correction.instruction;
        CE.dbg('output.correction.set', result.state + ': ' + result.correction.type);
      } else {
        combo.bp.correctionActive = false;
        combo.bp.correctionSignal = '';
        CE.dbg('output.correction.clear', 'SALVAGE achieved');
      }
    }

    // ── Shimmer budget reset at cycle boundary ──────────────────────────
    // Reset every N ticks to prevent budget exhaustion from stalling the system
    if (combo.bp.tick > 0 && combo.bp.tick % BonepokeOS.THRESHOLDS.shimmerResetInterval === 0) {
      BonepokeOS.resetShimmer(combo.bp);
      CE.dbg('output.shimmer.reset', 'tick ' + combo.bp.tick);
    }

    // ── Motif count periodic cleanup ────────────────────────────────────
    // Every N ticks, halve motif counts to allow motifs to re-enter the narrative
    if (combo.bp.tick > 0 && combo.bp.tick % BonepokeOS.THRESHOLDS.motifCleanupInterval === 0) {
      for (var motif in combo.bp.motifCounts) {
        combo.bp.motifCounts[motif] = Math.floor(combo.bp.motifCounts[motif] / 2);
        if (combo.bp.motifCounts[motif] <= 0) delete combo.bp.motifCounts[motif];
      }
      CE.dbg('output.motif.cleanup', combo.bp.motifCounts);
    }

    // ── Debug: log suggestions if any ───────────────────────────────────
    if (result.suggestions.length > 0) {
      CE.dbg('output.suggestions', result.suggestions);
    }

    // ── Debug: log test scores ──────────────────────────────────────────
    if (combo.debug && result.testScores) {
      var scoreLines = [];
      for (var cat in result.testScores) {
        scoreLines.push(cat + ':' + result.testScores[cat].tier + '(' + result.testScores[cat].score + ')');
      }
      CE.dbg('output.testScores', scoreLines.join(', '));
    }
  } else if (!combo.bp.enabled) {
    CE.dbg('output.bp', 'disabled');
  } else if (text.length <= 20) {
    CE.dbg('output.bp', 'skipped — text too short (' + text.length + ' chars)');
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 3. VERBALIZED SAMPLING — FINGERPRINT & COLLAPSE DETECTION
  //    Records a word-frequency fingerprint of each output. Compares against
  //    recent history using Jaccard similarity. High similarity across outputs
  //    indicates mode collapse, which feeds into the Arbiter to tighten VS
  //    thresholds on the next turn.
  // ═══════════════════════════════════════════════════════════════════════════

  if (combo.vs.enabled && text.length > 20) {
    const collapseScore = CE.recordFingerprint(combo, text);

    CE.dbg('output.vs', {
      collapse: collapseScore,
      fingerprints: combo.vs.fingerprints.length + '/' + CE.CONSTRAINTS.maxFingerprints
    });

    // Log warning if collapse is high
    if (collapseScore > CE.CONSTRAINTS.collapseHighThreshold) {
      CE.dbg('output.vs.WARNING', 'HIGH COLLAPSE DETECTED: ' + collapseScore.toFixed(2) + ' — Arbiter will tighten VS next turn');
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 4. STEERING WHEEL — CAPTURE LAST WORDS OF OUTPUT
  //    Used by the Arbiter as transition anchor points. The Context hook
  //    builds instructions like: "After 'slammed the door hard', transition..."
  // ═══════════════════════════════════════════════════════════════════════════

  if (combo.steer.enabled) {
    const outputWords = text.trim().split(/\s+/);
    if (outputWords.length >= 5) {
      combo.steer.lastOutputWords = outputWords.slice(-5).join(' ');
    } else if (outputWords.length > 0) {
      combo.steer.lastOutputWords = outputWords.join(' ');
    }
    CE.dbg('output.steer.anchor', combo.steer.lastOutputWords);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 5. DASHBOARD CARD UPDATE
  //    One unified card showing all subsystem states at a glance.
  //    Per AID_Practical_Code_Review §4.3: use addStoryCard() for new cards,
  //    direct property assignment for updates.
  // ═══════════════════════════════════════════════════════════════════════════

  const dashText = CE.formatDashboard(combo);
  CE.ensureCard('SYSTEM: Dashboard', dashText, 'system');

  CE.dbg('output.dashboard', dashText);

  // ═══════════════════════════════════════════════════════════════════════════
  // 6. AUTOCARDS PASSTHROUGH
  //    Per ai_studio_code (4).js comment on line 83-84:
  //      "We do NOT call AutoCards('input') manually here."
  //      "InnerSelf('input') called at the top already handles this for you."
  //    But AutoCards("output", text) IS called here in the Output hook.
  //
  //    Per Output.txt lines 56-58: AutoCards returns polymorphic result.
  //    Must check typeof and extract .text if object. Must reassign `text`.
  //
  //    This runs LAST because AutoCards may modify the display text (adding
  //    card information, formatting). All our measurements are already done
  //    on the original text above.
  // ═══════════════════════════════════════════════════════════════════════════

  if (typeof AutoCards === "function") {
    const cardResult = AutoCards("output", text);
    text = (typeof cardResult === 'object') ? cardResult.text : cardResult;
    CE.dbg('output.autocards', 'processed — text now ' + text.length + ' chars');
  } else {
    CE.dbg('output.autocards', 'AutoCards not available');
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 7. RETURN — Per Practical Code Review §3.3, return { text }
  //    text may have been modified by AutoCards. Everything else stores to state.
  // ═══════════════════════════════════════════════════════════════════════════

  CE.dbg('output.complete', 'turn ' + info.actionCount);

  return { text };
};

modifier(text);
