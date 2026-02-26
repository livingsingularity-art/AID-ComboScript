// ═══════════════════════════════════════════════════════════════════════════
// CONTEXT MODIFIER — BonepokeOS Translator Module
// Injects VSL coordinates, archetype mandate, correction signal,
// and tone-aware Author's Note into the AI's context window
// ═══════════════════════════════════════════════════════════════════════════

const modifier = (text) => {
  if (!state.bp || typeof BonepokeOS === 'undefined') return { text };

  const bp = state.bp;

  /* === 1. BUILD AUTHOR'S NOTE === */
  // Layers: base scenario note + NGO state + BonepokeOS VSL state + correction

  let noteLines = [];

  // Layer 1: Original scenario Author's Note
  if (state.originalAuthorsNote) {
    noteLines.push(state.originalAuthorsNote);
  }

  // Layer 2: NGO Heat/Temperature state (narrative pressure)
  if (typeof state.heat !== 'undefined') {
    let heatDesc = '';
    if (state.heat <= 3) heatDesc = 'The scene is calm, tension dormant.';
    else if (state.heat <= 8) heatDesc = 'Underlying tension simmers.';
    else if (state.heat <= 15) heatDesc = 'The situation is volatile. Conflict is close.';
    else heatDesc = 'The scene crackles with imminent violence or eruption.';

    noteLines.push('[HEAT:' + state.heat + ' TEMP:' + state.storyTemperature + '] ' + heatDesc);
  }

  // Layer 3: BonepokeOS VSL state from last output analysis
  const lastResult = bp.lastOutputResult;
  if (lastResult && lastResult.vanillaOk) {
    // VSL coordinate injection (from Freezing the Fog: "the system's own principles")
    noteLines.push('[VSL E:' + lastResult.e.toFixed(2) +
      ' β:' + lastResult.beta.toFixed(2) +
      ' LSC:' + lastResult.lsc.toFixed(2) +
      ' | STATE:' + lastResult.state + ']');

    // Archetype mandate (from Protocol-Locked Trajectories §3)
    noteLines.push('[ARCHETYPE:' + lastResult.archetype.id +
      ' | MANDATE:' + lastResult.archetype.mandate + ']');

    // Archetype-specific narrative instructions
    switch (lastResult.archetype.id) {
      case 'OBSERVER':
        noteLines.push('Ground the scene in sensory detail. What can be seen, heard, felt.');
        break;
      case 'SHERLOCK':
        noteLines.push('Enforce cause-and-effect. Actions have consequences. Details matter. No convenient coincidences.');
        break;
      case 'JESTER':
        noteLines.push('Break the pattern. Something unexpected happens. Subvert the obvious resolution. Inject dark humor or absurdity.');
        break;
      case 'WOUNDED_HEALER':
        noteLines.push('Hold contradictions without resolving them. Characters can want opposing things. Let emotional complexity breathe.');
        break;
      case 'CALCIFIER':
        noteLines.push('Crystallize volatile material into stable narrative. Find the structural core of the current chaos.');
        break;
    }

    // Dominant tone from player input (guide AI response tone)
    if (bp.lastInputTone && bp.lastInputTone.dominant !== 'neutral') {
      const toneMap = {
        lift: 'Player is escalating. Match or exceed their tension.',
        drop: 'Player is de-escalating. Honor the release but leave residue.',
        shear: 'Player disrupted the scene. Follow the rupture; let consequences cascade.',
        invert: 'Player contradicted or subverted. Build on the reversal. Explore what the inversion reveals.'
      };
      const toneNote = toneMap[bp.lastInputTone.dominant];
      if (toneNote) noteLines.push(toneNote);
    }

    // Correction signal (Fragment Compost Protocol)
    if (bp.correctionActive && bp.correctionSignal) {
      noteLines.push('[CORRECTION] ' + bp.correctionSignal);
    }

    // Motif decay warning: stop overusing exhausted symbols
    if (lastResult.motifDecay && Object.keys(lastResult.motifDecay).length > 0) {
      const exhausted = Object.keys(lastResult.motifDecay).join(', ');
      noteLines.push('Avoid overusing: ' + exhausted + '. Find fresh language for the same feeling.');
    }

    // MARM canary
    if (lastResult.marm === 'MARM: active') {
      noteLines.push('MARM active: the narrative is in a charged state. A breakthrough or collapse is imminent.');
    }
  }

  /* === 2. INJECT INTO CONTEXT === */
  // Use authorsNote for the composite instruction block
  state.memory = state.memory || {};
  state.memory.authorsNote = noteLines.join('\n');

  // D20 front memory passthrough
  if (state.roll && state.roll.action === info.actionCount) {
    state.memory.frontMemory = state.roll.frontMemory || '';
  } else {
    state.memory.frontMemory = '';
  }

  return { text };
};
modifier(text);
