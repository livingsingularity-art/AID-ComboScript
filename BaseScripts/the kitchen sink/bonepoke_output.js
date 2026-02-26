// ═══════════════════════════════════════════════════════════════════════════
// OUTPUT MODIFIER — BonepokeOS Full Audit + NGO Output Tracking
// Runs the complete Vanilla → Bonepoke → Translator pipeline on AI output,
// updates dashboard card, stores correction signal for next Context pass
// ═══════════════════════════════════════════════════════════════════════════

/* === InnerSelf Integration === */
if (typeof InnerSelf === "function") {
  InnerSelf("output");
}

const modifier = (text) => {
  if (!state || typeof state.heat === 'undefined') return { text };

  /* === 1. NGO OUTPUT KEYWORD TRACKING (your existing system) === */
  const conflictWords = ["attack","stab","destroy","break","steal","ruin","burn","smash","sabotage","shoot","punch","hit","slap","scream","yell","gun","pistol","rifle","bullet","ammo","shotgun","firearm","blast","kill","slay","blood","bleed","bleeding","gore","wound","pain","dying","die","perish","rage","anger","betray","revenge","drug","cocaine","heroin","needle","scam","theft","crime","felony","arrest","handcuffs","police","cop","murder","execution","deadly"];
  const calmingWords = ["calm","rest","relax","meditate","sleep","comfort","hug","smile","forgive","mend","repair","protect","shelter","trust","hope","eat","drink","balance","laugh","apologize","befriend","thank","appreciate","love","pet","respect","restore","heal","help","assist","romance","affection","flirt","cuddle","care","gentle","soft","tender","kiss","reassure"];

  const lowerText = text.toLowerCase();
  const words = lowerText.split(/\s+/);
  let conflictCount = 0;
  let calmingCount = 0;

  words.forEach(word => {
    const fixedWord = word.replace(/^[^\w]+|[^\w]+$/g, '');
    if (conflictWords.includes(fixedWord)) conflictCount++;
    if (calmingWords.includes(fixedWord)) calmingCount++;
  });

  if (conflictCount > 0) {
    state.heat += conflictCount * (state.modelIncreaseHeatImpact || 1);
    if (conflictCount >= (state.threshholdModelIncreaseTemperature || 3)) {
      state.storyTemperature += (state.modelIncreaseTemperatureImpact || 1);
    }
  }
  if (calmingCount > 0) {
    state.heat -= calmingCount * (state.modelDecreaseHeatImpact || 1);
  }

  const maxTemp = state.maximumTemperature || 15;
  const minTemp = state.minimumTemperature || 1;
  const minHeat = state.minimumHeat || 0;
  state.heat = Math.max(minHeat, state.heat);
  state.storyTemperature = Math.max(minTemp, Math.min(maxTemp, state.storyTemperature));

  /* === 2. BONEPOKE: FULL INGEST ON AI OUTPUT === */
  if (typeof BonepokeOS !== 'undefined' && state.bp && text.length > 20) {
    const result = BonepokeOS.ingest(text, state.bp);
    state.bp.lastOutputResult = result;

    // ── Fragment Compost Protocol ──────────────────────────────
    // If SLOP or GOLD: store correction signal for next Context pass
    if (result.state === 'SLOP' || result.state === 'GOLD') {
      state.bp.correctionActive = true;
      state.bp.correctionSignal = result.correction.instruction;
    } else {
      // SALVAGE: clear correction, output is productive
      state.bp.correctionActive = false;
      state.bp.correctionSignal = '';
    }

    // ── Shimmer budget reset at cycle boundary ────────────────
    // Reset every 25 ticks to prevent budget exhaustion stalling
    if (state.bp.tick % 25 === 0 && state.bp.tick > 0) {
      BonepokeOS.resetShimmer(state.bp);
    }

    // ── Update Dashboard Card ─────────────────────────────────
    const dashText = BonepokeOS.formatDashboard(result) +
      ' | HEAT:' + state.heat + ' TEMP:' + state.storyTemperature +
      ' | Turn:' + info.actionCount;

    let dashCard = storyCards.find(c => c.title === 'SYSTEM: Dashboard');
    if (dashCard) {
      dashCard.entry = dashText;
    } else {
      addStoryCard('SYSTEM: Dashboard', dashText, 'system');
    }

    // ── Optional: Suggestions card (for scenario debugging) ───
    // Uncomment the block below to see salvage suggestions in-game:
    /*
    if (result.suggestions.length > 0) {
      const sugText = result.suggestions.slice(0, 5).join('\n');
      let sugCard = storyCards.find(c => c.title === 'BP: Suggestions');
      if (sugCard) { sugCard.entry = sugText; }
      else { addStoryCard('BP: Suggestions', sugText, 'system'); }
    }
    */
  }

  /* === 3. D20 FRONT MEMORY PASSTHROUGH === */
  if (state.roll && state.roll.action === info.actionCount - 1) {
    state.memory = state.memory || {};
    state.memory.frontMemory = state.roll.frontMemory || '';
  } else {
    if (state.memory) state.memory.frontMemory = '';
  }

  /* === 4. AUTOCARDS === */
  if (typeof AutoCards === "function") {
    const cardResult = AutoCards("output", text);
    text = (typeof cardResult === 'object') ? cardResult.text : cardResult;
  }

  return { text };
};
modifier(text);
