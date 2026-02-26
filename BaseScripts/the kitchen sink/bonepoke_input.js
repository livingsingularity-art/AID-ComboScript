// ═══════════════════════════════════════════════════════════════════════════
// INPUT MODIFIER — BonepokeOS + NGO Heat/D20 Integration
// Runs tone scoring on player input, updates BP state + heat/temperature
// ═══════════════════════════════════════════════════════════════════════════

/* === InnerSelf Integration === */
if (typeof InnerSelf === "function") {
  InnerSelf("input");
}

const modifier = (text) => {

  /* === 1. NGO INITIALIZATION (unchanged from your existing system) === */
  if (!state.initialized) {
    state.originalAuthorsNote = "Gritty, chaotic, morally gray. Relationships carry tension, loyalty, secrets, desire, betrayal. Small actions matter: silence, looks, slammed doors. Humor mixes with danger: guns, drugs, crime, theft, scams, broken families, sudden violence. Scenes feel intimate and pressure-filled. Violence is realistic and allowed. When fights erupt, characters hit and escalate. Do NOT redirect violence into restraint, grappling, or romance. Follow through with believable action and consequences. Mature themes (drugs, alcohol, crime, domestic tension) appear with realism, not glamorization";
    state.initialHeatValue = 5;
    state.initialTemperatureValue = 1;
    state.playerIncreaseHeatImpact = 2;
    state.playerDecreaseHeatImpact = 2;
    state.playerIncreaseTemperatureImpact = 1;
    state.playerDecreaseTemperatureImpact = 1;
    state.threshholdPlayerIncreaseTemperature = 2;
    state.maximumTemperature = 15;
    state.minimumTemperature = 1;
    state.minimumHeat = 0;

    state.heat = state.initialHeatValue;
    state.storyTemperature = state.initialTemperatureValue;
    state.initialized = true;
  }

  /* === 2. BONEPOKE STATE INITIALIZATION === */
  if (!state.bp) {
    state.bp = {
      tick: 0,
      shimmerUsed: 0,
      motifCounts: {},
      lastRuptureTick: 0,
      memory: [],
      history: [],
      lastInputResult: null,
      lastOutputResult: null,
      correctionActive: false,
      correctionSignal: ''
    };
  }

  /* === 3. NGO KEYWORD TRACKING (your existing conflict/calming system) === */
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
    state.heat += conflictCount * state.playerIncreaseHeatImpact;
    if (conflictCount >= state.threshholdPlayerIncreaseTemperature) {
      state.storyTemperature += state.playerIncreaseTemperatureImpact;
    }
  }
  if (calmingCount > 0) {
    state.heat -= calmingCount * state.playerDecreaseHeatImpact;
  }
  state.heat = Math.max(state.minimumHeat || 0, state.heat);
  state.storyTemperature = Math.max(state.minimumTemperature || 1, state.storyTemperature);

  /* === 4. BONEPOKE: TONE SCORING ON PLAYER INPUT === */
  // Run lightweight tone classification (not full ingest — save that for output)
  if (typeof BonepokeOS !== 'undefined' && text.length > 10) {
    const toneScores = BonepokeOS.classifyTone(text);
    state.bp.lastInputTone = toneScores;

    // Tone → Heat crosswalk: shear/lift raise heat, drop lowers it
    if (toneScores.shear > 0) state.heat += toneScores.shear;
    if (toneScores.lift > 0) state.heat += Math.ceil(toneScores.lift * 0.5);
    if (toneScores.drop > 0) state.heat -= toneScores.drop;
    state.heat = Math.max(state.minimumHeat || 0, state.heat);

    // Inversion in player input hints at β-rich narrative direction
    if (toneScores.invert > 1) {
      state.bp.correctionSignal = '';  // Player is steering toward tension; clear any correction
      state.bp.correctionActive = false;
    }
  }

  /* === 5. D20 SUCCESS/FAILURE LOGIC (unchanged) === */
  if (!state.roll) state.roll = { frontMemory: '', action: 0 };

  if (state.roll.action !== info.actionCount) {
    let Success = 0.5;
    if (/disadvantage/i.test(text)) Success += 0.2;
    if (/advantage/i.test(text)) Success -= 0.2;
    const PartialSuccess = Success + 0.2;
    const outcome = (v) => {
      const match = text.match(/> (.*) (try|trie|attempt)(s?)/i);
      if (!match || ((match[1].match(/"/g) ?? []).length % 2)) return '';
      let s = v > Success;
      return (s ? 'And ' : 'But ') + match[1].replace(/^You\b/, 'you').replace(/,$/, ' and') +
        ((s && v < PartialSuccess) ? ' partially' : '') +
        (s ? ' succeed' : ' fail') + (match[3] ? 's' : '') + (s ? '.' : '!');
    };
    state.roll.frontMemory = outcome(Math.random());
    state.roll.action = info.actionCount;
  }

  return { text };
};
modifier(text);
