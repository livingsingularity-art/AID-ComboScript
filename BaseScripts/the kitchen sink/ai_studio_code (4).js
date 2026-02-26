/* === 1. INNER SELF & AUTO-CARDS INTEGRATION === */
// This must run first. It handles /AC commands and Inner Self's internal processing.
if (typeof InnerSelf === "function") {
  InnerSelf("input");
}

const modifier = (text) => {
  /* === 2. NGO INITIALIZATION === */
  if (!state.initialized) {
    state.heat = 5;
    state.storyTemperature = 1;
    state.playerIncreaseHeatImpact = 2;
    state.playerDecreaseHeatImpact = 2;
    state.playerIncreaseTemperatureImpact = 1;
    state.playerDecreaseTemperatureImpact = 1;
    state.threshholdPlayerIncreaseTemperature = 2;
    state.maximumTemperature = 15;
    state.minimumTemperature = 1;
    state.initialized = true;
  }

  /* === 3. NGO KEYWORD TRACKING (PLAYER IMPACT) === */
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

  // Update stats based on Player words
  if (conflictCount > 0) {
    state.heat += conflictCount * state.playerIncreaseHeatImpact;
    if (conflictCount >= state.threshholdPlayerIncreaseTemperature) {
      state.storyTemperature += state.playerIncreaseTemperatureImpact;
    }
  }
  if (calmingCount > 0) {
    state.heat -= calmingCount * state.playerDecreaseHeatImpact;
  }

  // Safety Clamping
  state.heat = Math.max(0, state.heat);
  state.storyTemperature = Math.max(state.minimumTemperature, Math.min(state.maximumTemperature, state.storyTemperature));

  /* === 4. D20 SUCCESS/FAILURE LOGIC === */
  if (!state.roll) state.roll = { frontMemory: '', action: 0 };

  // Only roll if the action count has changed
  if (state.roll.action !== info.actionCount) {
    let successThreshold = 0.5;
    if (/disadvantage/i.test(text)) successThreshold += 0.2;
    if (/advantage/i.test(text)) successThreshold -= 0.2;
    
    const partialThreshold = successThreshold + 0.2;
    const rollValue = Math.random();

    const getOutcome = (v) => {
      // Regex to find "You try to..." or "You attempt to..."
      const match = text.match(/> (.*) (try|trie|attempt)(s?)/i);
      if (!match || ((match[1].match(/"/g) ?? []).length % 2)) return '';
      
      let succeeded = v > successThreshold;
      let partial = succeeded && v < partialThreshold;
      
      return (succeeded ? 'And ' : 'But ') + 
             match[1].replace(/^You\b/, 'you').replace(/,$/, ' and') +
             (partial ? ' partially' : '') +
             (succeeded ? ' succeed' : ' fail') + 
             (match[3] ? 's' : '') + (succeeded ? '.' : '!');
    };

    state.roll.frontMemory = getOutcome(rollValue);
    state.roll.action = info.actionCount;
  }

  // NOTE: We do NOT call AutoCards("input") manually here. 
  // InnerSelf("input") called at the top already handles this for you.

  return { text };
};

modifier(text);