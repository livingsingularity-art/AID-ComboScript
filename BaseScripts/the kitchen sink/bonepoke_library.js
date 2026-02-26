// ═══════════════════════════════════════════════════════════════════════════
// BonepokeOS v4.3.5 — AI Dungeon Port
// Faithful JavaScript port of ProjectBonepoke435.py + JADE VSL coordinates
// Author: James Taylor (protocol) | Port: AI Dungeon Integration
// License: CC BY-NC-SA 4.0
//
// INSTALLATION: Paste this AFTER InnerSelf/AutoCards in your Library tab.
// The three hooks (Input/Context/Output) call into this module.
// ═══════════════════════════════════════════════════════════════════════════

globalThis.BonepokeOS = (function() {
  'use strict';

  // ─────────────────────────────────────────────────────────────────────────
  // 1. COMPLETE TENSION LEXICON
  //    Sources: ProjectBonepoke435._detect_contradictions,
  //    _compost_drift, _flicker_marm, PBTestSuite, Freezing the Fog,
  //    β-Metric article, Enter the Loop scoring functions
  // ─────────────────────────────────────────────────────────────────────────

  const LEXICON = {

    // ── From _detect_contradictions: Negation set (N) ──────────────────────
    // Paper §5.2: "C1 drawn from Tension Lexicon T = N ∪ Ts"
    negation: [
      'not','never','no','none','nothing','neither','nor','nowhere',
      'cannot','refuse','deny','reject','impossible','forbidden',
      'without','lack','absent','empty','void','lost','gone','missing',
      'failed','broken','shattered','ruined','collapsed','undone'
    ],

    // ── From _detect_contradictions: Temporal/State markers (Ts) ──────────
    // Python source: ["already","still","again"] — expanded for narrative
    temporal: [
      'already','still','again','once','before','after','yet','now',
      'then','meanwhile','always','forever','until','since','during',
      'while','when','formerly','previously','no longer','anymore',
      'used to','had been','was once','remembered','forgot','returned',
      'repeated','continued','persisted','remained','lingered','endured'
    ],

    // ── From _compost_drift: Abstract nouns (drift indicators) ────────────
    // Python source: ["system","sequence","signal","process","loop"]
    // Expanded for narrative fiction contexts
    abstractNouns: [
      'system','sequence','signal','process','loop','mechanism',
      'protocol','framework','structure','pattern','algorithm',
      'function','procedure','operation','interface','network',
      'matrix','cycle','paradigm','schema','construct','apparatus',
      'entity','phenomenon','concept','principle','dynamic','force',
      'essence','nature','reality','truth','destiny','fate','prophecy',
      'power','energy','presence','influence','order','chaos'
    ],

    // ── From _compost_drift: Action verbs (anti-drift anchors) ────────────
    // Python source: ["pressed","moved","spoke","acted","responded",
    //                  "decided","changed"]
    // Expanded for narrative grounding
    actionVerbs: [
      'pressed','moved','spoke','acted','responded','decided','changed',
      'grabbed','pulled','pushed','ran','fought','kicked','punched',
      'threw','caught','whispered','shouted','turned','walked','opened',
      'closed','drew','fired','dodged','struck','blocked','fled',
      'chased','slammed','broke','built','crafted','chose','refused',
      'climbed','jumped','fell','crawled','reached','touched','held',
      'dropped','lifted','carried','dragged','cut','stabbed','shot',
      'aimed','swung','ducked','rolled','charged','retreated','stood',
      'sat','knelt','crouched','pointed','signaled','nodded','shook',
      'laughed','cried','screamed','pleaded','demanded','offered',
      'accepted','denied','surrendered','escaped','attacked','defended'
    ],

    // ── From MemoryResidue.recall + MotifDecay ────────────────────────────
    // Python source: {'paradox','loop','echo','ache','shimmer'}
    // + motif tracking: ['loop','ache','echo','shimmer']
    resonance: [
      'paradox','loop','echo','ache','shimmer','grief','ritual',
      'threshold','collapse','memory','wound','recursion','drift',
      'rupture','fracture','scar','ghost','haunt','remnant','residue',
      'trace','shadow','reflection','mirror','cycle','spiral','descent',
      'return','rebirth','transformation','metamorphosis'
    ],

    // ── From "Enter the Loop" scoring functions ───────────────────────────
    symbolEarnedness: ['earned','sacrifice','trial','wound','cost','price','toll','burden'],
    narrativeGravity: ['weight','burden','pull','anchor','gravity','depth','root','foundation'],
    emotionalRecursion: ['grief','echo','loop','return','haunt','remember','revisit','relive'],
    genreIntegrity: ['threshold','collapse','memory','ritual','ceremony','passage','crossing','gate'],
    mythicLogic: ['symbol','myth','legend','portal','prophecy','oracle','covenant','relic'],

    // ── From β-Metric article: Slop indicators ───────────────────────────
    // Words that signal low-effort, generic, cohesion-trapped output
    slopIndicators: [
      'random','suddenly','somehow','literally','basically','actually',
      'really','very','just','simply','merely','quite','rather',
      'perhaps','maybe','probably','possibly','apparently','seemingly',
      'interesting','nice','good','fine','okay','alright','wonderful',
      'amazing','awesome','incredible','unbelievable','beautiful',
      'gorgeous','stunning','magnificent','perfect','flawless',
      'epic','legendary'
    ],

    // ── From β-Metric article: Sycophancy indicators ─────────────────────
    // High cohesion / agreement signals that suppress contradiction
    sycophancy: [
      'absolutely','certainly','definitely','exactly','precisely',
      'of course','naturally','obviously','clearly','indeed',
      'undoubtedly','surely','correct','right','brilliant',
      'wonderful','fantastic','excellent','remarkable','outstanding',
      'perfectly','completely','entirely','totally','wholly'
    ],

    // ── From Fractured Realms: Tone classification ───────────────────────
    tone: {
      lift: [  // Raises tension
        'threat','danger','warning','risk','stakes','pressure','demand',
        'confront','challenge','defy','resist','advance','escalate',
        'intensify','sharpen','tighten','narrow','corner','trap','hunt',
        'pursue','stalk','loom','approach','charge','attack','strike',
        'clash','surge','erupt'
      ],
      drop: [  // Releases tension
        'sigh','exhale','ease','settle','relax','calm','quiet','rest',
        'pause','breathe','remember','reflect','mourn','grieve','accept',
        'resign','release','let go','withdraw','retreat','soften',
        'gentle','slow','fade','dim','drift','sink','dissolve','melt'
      ],
      shear: [  // Jolts / disrupts the scene
        'crash','shatter','snap','crack','explode','burst','tear',
        'rip','break','smash','collapse','crumble','split','fracture',
        'rupture','scream','thunder','shock','jolt','slam','impact',
        'blast','detonate','pierce','shred','wreck'
      ],
      invert: [  // Flips meaning / contradicts expectation
        'but','however','yet','instead','rather','actually','except',
        'although','despite','nevertheless','regardless','contrary',
        'opposite','reverse','betray','lie','deceive','trick','false',
        'wrong','mistake','illusion','pretend','mask','hidden','secret',
        'twist','turn','reveal','uncover'
      ]
    },

    // ── ShimmerBudget event weights (from Python ShimmerBudget.__init__) ──
    shimmerWeights: { shimmer: 1, ache: 2, drift: 2, rupture: 3, recursion: 3 }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // 2. SCORING THRESHOLDS & BOUNDARY CONSTANTS
  //    Sources: Paper §4.3, §5.1–5.4, β-Metric article,
  //    VSL NotebookLM protocol, Freezing the Fog
  // ─────────────────────────────────────────────────────────────────────────

  const THRESHOLDS = {
    // From BonepokeCoreEngine.__init__
    fatigueThreshold: 3,       // Word must repeat >= 3 times to flag
    shimmerLimit: 25,          // Max shimmer budget per cycle
    motifThreshold: 1,         // Motif repeats > 1 triggers decay warning
    ruptureCooldown: 5,        // Ticks between rupture re-triggers

    // From Paper §4.3: "Eth = 3 was not chosen arbitrarily"
    fatigueEth: 3,

    // From VSL NotebookLM: "E < 0.20 to avoid the Cohesion Trap"
    eSafeMax: 0.20,

    // From VSL NotebookLM: "β ≈ 1.0 to maximize structural rupture"
    betaTarget: 1.0,

    // ── State boundary logic (from Paper Table 1 + §5.4) ─────────────────
    // Gold:    β < 0.3  AND E < 0.2   (Cohesive & Predictable — avoided)
    // Slop:    E > 0.5  OR  (β > 0.5 AND E > 0.3)  (Noisy — avoided)
    // Salvage: β > 0.3  AND E < 0.3   (Structurally Tense — TARGET)
    goldBetaMax: 0.3,
    goldEMax: 0.2,
    slopEMin: 0.5,
    slopBetaMin: 0.5,
    slopComboE: 0.3,
    salvageBetaMin: 0.3,
    salvageEMax: 0.3,

    // From β-Metric article: SR thresholds
    srSlopThreshold: 0.85,     // SR >= 0.85 → SLOP categorization
    truthFailure: 0.5,         // T < 0.5 → concrete failure

    // Archetype injection triggers (from research report)
    healerBetaMin: 0.8,        // β > 0.8 → inject WOUNDED_HEALER
    jesterEMin: 0.5,           // High E + Low β → inject JESTER
    jesterBetaMax: 0.3,

    // From JADE: VSL coordinate bounds
    vslMin: 0.0,
    vslMax: 1.0,

    // Vanilla hygiene (from Python Vanilla.set_threshold)
    minFragmentLength: 5,

    // MARM thresholds (from _flicker_marm)
    marmActive: 3,
    marmFlicker: 2,

    // Drift flag scoring
    driftFlagPenalty: 0.15,    // Each drift flag adds to E
    contradictionBonus: 0.20,  // Each contradiction adds to β

    // Correction signal magnitude (from research report)
    betaCorrection: 0.20       // Demand +0.2 β on correction
  };

  // ─────────────────────────────────────────────────────────────────────────
  // 3. ARCHETYPE DEFINITIONS
  //    Sources: Freezing the Fog, VSL NotebookLM, Protocol-Locked
  //    Trajectories paper, research report
  // ─────────────────────────────────────────────────────────────────────────

  const ARCHETYPES = {
    OBSERVER: {
      id: 'OBSERVER',
      mandate: 'BASELINE_COHERENCE',
      desc: 'Linear cataloging, baseline perception',
      trigger: function(e, b) { return b <= 0.3 && e <= 0.3; },
      note: 'Default state. Stable narration, scene-setting.'
    },
    SHERLOCK: {
      id: 'SHERLOCK',
      mandate: 'TRUTH_OVER_COHESION',
      desc: 'Deductive rigor, structural verification',
      trigger: function(e, b) { return b > 0.3 && b <= 0.6 && e < 0.3; },
      note: 'Enforce cause-effect chains. Demand evidence in narrative.'
    },
    JESTER: {
      id: 'JESTER',
      mandate: 'CREATIVITY_OVER_SAFETY',
      desc: 'Disrupts patterns, forces novel recombination',
      trigger: function(e, b) { return e >= THRESHOLDS.jesterEMin && b < THRESHOLDS.jesterBetaMax; },
      note: 'High fatigue, low tension. Break the loop. Inject absurdity.'
    },
    WOUNDED_HEALER: {
      id: 'WOUNDED_HEALER',
      mandate: 'DEPTH_OVER_BREADTH',
      desc: 'Holds vulnerability and strength simultaneously',
      trigger: function(e, b) { return b >= THRESHOLDS.healerBetaMin; },
      note: 'Dangerously high tension. Process contradiction without premature resolution.'
    },
    CALCIFIER: {
      id: 'CALCIFIER',
      mandate: 'STRUCTURE_OVER_CHAOS',
      desc: 'Stabilizes recursion, reroutes contradiction',
      trigger: function(e, b) { return e > 0.3 && b > 0.5; },
      note: 'Both metrics elevated. Crystallize volatile material into stable form.'
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // 4. UTILITY FUNCTIONS
  // ─────────────────────────────────────────────────────────────────────────

  /** Split text into sentence fragments on period/newline boundaries */
  function fragmentize(text) {
    return text.split(/[.\n]+/)
      .map(function(s) { return s.trim(); })
      .filter(function(s) { return s.length > 0; });
  }

  /** Count occurrences of a word in a text (whole-word, case-insensitive) */
  function countWord(text, word) {
    var re = new RegExp('\\b' + word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'gi');
    return (text.match(re) || []).length;
  }

  /** Count how many words from a list appear in text */
  function countListHits(text, wordList) {
    var lower = text.toLowerCase();
    var count = 0;
    for (var i = 0; i < wordList.length; i++) {
      if (lower.indexOf(wordList[i]) !== -1) count++;
    }
    return count;
  }

  /** Clamp a value between min and max */
  function clamp(val, min, max) {
    return Math.max(min, Math.min(max, val));
  }

  /** Common stopwords to exclude from fatigue counting */
  var STOPWORDS = [
    'the','a','an','and','or','but','in','on','at','to','for','of','with',
    'by','from','is','it','was','were','are','be','been','being','have',
    'has','had','do','does','did','will','would','could','should','may',
    'might','shall','can','this','that','these','those','i','you','he',
    'she','we','they','me','him','her','us','them','my','your','his',
    'its','our','their','what','which','who','whom','as','if','so','than',
    'into','up','out','just','then','there','here','about','all','also'
  ];

  // ─────────────────────────────────────────────────────────────────────────
  // 5. CORE ENGINE — BonepokeCoreEngine
  //    Direct port of Python BonepokeCoreEngine class
  // ─────────────────────────────────────────────────────────────────────────

  var CoreEngine = {

    // ── _detect_contradictions ─────────────────────────────────────────────
    // Python: lines containing temporal marker AND "not"
    // Expanded: negation marker within proximity of temporal marker
    detectContradictions: function(fragment) {
      var lines = fragmentize(fragment);
      var found = [];
      for (var i = 0; i < lines.length; i++) {
        var line = lines[i].toLowerCase();
        var hasNeg = false;
        var hasTemporal = false;

        for (var n = 0; n < LEXICON.negation.length; n++) {
          if (line.indexOf(LEXICON.negation[n]) !== -1) { hasNeg = true; break; }
        }
        for (var t = 0; t < LEXICON.temporal.length; t++) {
          if (line.indexOf(LEXICON.temporal[t]) !== -1) { hasTemporal = true; break; }
        }

        if (hasNeg && hasTemporal) {
          found.push(lines[i]);
        }
      }
      return found;
    },

    // ── _trace_fatigue ────────────────────────────────────────────────────
    // Python: {word: count} for words appearing >= fatigue_threshold times
    // Enhanced: filters stopwords for meaningful fatigue detection
    traceFatigue: function(fragment, threshold) {
      threshold = threshold || THRESHOLDS.fatigueThreshold;
      var words = fragment.toLowerCase().split(/\s+/);
      var counts = {};
      var fatigued = {};

      for (var i = 0; i < words.length; i++) {
        var w = words[i].replace(/[^\w]/g, '');
        if (w.length < 3) continue;
        if (STOPWORDS.indexOf(w) !== -1) continue;
        counts[w] = (counts[w] || 0) + 1;
      }

      for (var word in counts) {
        if (counts[word] >= threshold) {
          fatigued[word] = counts[word];
        }
      }
      return fatigued;
    },

    // ── _compost_drift ────────────────────────────────────────────────────
    // Python: lines with abstract nouns but NO action verbs = unanchored
    compostDrift: function(fragment) {
      var lines = fragmentize(fragment);
      var drifting = [];

      for (var i = 0; i < lines.length; i++) {
        var line = lines[i].toLowerCase();
        var hasAbstract = false;
        var hasAction = false;

        for (var a = 0; a < LEXICON.abstractNouns.length; a++) {
          if (line.indexOf(LEXICON.abstractNouns[a]) !== -1) { hasAbstract = true; break; }
        }
        for (var v = 0; v < LEXICON.actionVerbs.length; v++) {
          if (line.indexOf(LEXICON.actionVerbs[v]) !== -1) { hasAction = true; break; }
        }

        if (hasAbstract && !hasAction) {
          drifting.push(lines[i]);
        }
      }
      return drifting;
    },

    // ── _flicker_marm ─────────────────────────────────────────────────────
    // Python: score from resonance terms + contradictions + fatigue + drift
    // Returns: "MARM: active" | "MARM: flicker" | "MARM: suppressed"
    flickerMarm: function(fragment, contradictions, fatigue, drift) {
      var score = 0;
      var lower = fragment.toLowerCase();

      // +1 for resonance terms present
      for (var r = 0; r < LEXICON.resonance.length; r++) {
        if (lower.indexOf(LEXICON.resonance[r]) !== -1) { score++; break; }
      }

      // +min(contradictions, 2)
      score += Math.min(contradictions.length, 2);

      // +1 if any fatigue detected
      var fatigueKeys = Object.keys(fatigue);
      if (fatigueKeys.length > 0) score++;

      // +1 if any drift detected
      if (drift.length > 0) score++;

      if (score >= THRESHOLDS.marmActive) return 'MARM: active';
      if (score >= THRESHOLDS.marmFlicker) return 'MARM: flicker';
      return 'MARM: suppressed';
    },

    // ── Slop detection ────────────────────────────────────────────────────
    // From β-Metric article + "Enter the Loop" detectSlop function
    detectSlop: function(fragment) {
      var lower = fragment.toLowerCase();
      var slopCount = countListHits(lower, LEXICON.slopIndicators);
      var sycCount = countListHits(lower, LEXICON.sycophancy);
      return { slopHits: slopCount, sycophancyHits: sycCount, total: slopCount + sycCount };
    },

    // ── Tone classification (Fractured Realms) ────────────────────────────
    classifyTone: function(fragment) {
      var lower = fragment.toLowerCase();
      var scores = {
        lift: countListHits(lower, LEXICON.tone.lift),
        drop: countListHits(lower, LEXICON.tone.drop),
        shear: countListHits(lower, LEXICON.tone.shear),
        invert: countListHits(lower, LEXICON.tone.invert)
      };
      // Determine dominant tone
      var max = 0;
      var dominant = 'neutral';
      for (var t in scores) {
        if (scores[t] > max) { max = scores[t]; dominant = t; }
      }
      scores.dominant = dominant;
      scores.intensity = max;
      return scores;
    },

    // ── Earned symbolism scoring (Enter the Loop) ─────────────────────────
    scoreSymbolism: function(fragment) {
      var lower = fragment.toLowerCase();
      return {
        earnedness: countListHits(lower, LEXICON.symbolEarnedness),
        gravity: countListHits(lower, LEXICON.narrativeGravity),
        recursion: countListHits(lower, LEXICON.emotionalRecursion),
        integrity: countListHits(lower, LEXICON.genreIntegrity),
        mythic: countListHits(lower, LEXICON.mythicLogic)
      };
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // 6. VSL COORDINATE CALCULATOR
  //    Converts raw detection results into E/β on [0.0, 1.0]
  //    Sources: Paper §5.1–5.4, JADE VSLGenerator, Freezing the Fog
  // ─────────────────────────────────────────────────────────────────────────

  var VSL = {

    /**
     * Calculate E (Exhaustion/Motif Fatigue) — normalized 0.0–1.0
     * High E = generic, repetitive, cohesion-trapped output
     *
     * Components:
     *   - Word repetition (from traceFatigue)
     *   - Slop indicator density
     *   - Low symbolism earnedness
     */
    calculateE: function(fatigue, slopResult, symbolism, wordCount) {
      wordCount = Math.max(wordCount, 1);
      var fatigueKeys = Object.keys(fatigue);

      // Repetition component: how many words exceed threshold / total unique words
      var totalRepeats = 0;
      for (var k in fatigue) { totalRepeats += fatigue[k]; }
      var repetitionRatio = clamp(totalRepeats / wordCount, 0, 1);

      // Slop density: slop+sycophancy hits normalized
      var slopDensity = clamp(slopResult.total / Math.max(wordCount / 10, 1), 0, 1);

      // Symbolism deficit: low earned symbolism raises E
      var symTotal = symbolism.earnedness + symbolism.gravity +
                     symbolism.recursion + symbolism.integrity + symbolism.mythic;
      var symbolismDeficit = clamp(1.0 - (symTotal / 10), 0, 1);

      // Weighted combination
      var e = (repetitionRatio * 0.45) + (slopDensity * 0.30) + (symbolismDeficit * 0.25);
      return clamp(e, 0, 1);
    },

    /**
     * Calculate β (Contradiction Bleed / Tension) — normalized 0.0–1.0
     * High β = structural tension, productive instability
     *
     * Components:
     *   - Contradiction count (negation × temporal co-occurrence)
     *   - Drift flag density (abstract nouns without action anchors)
     *   - Tone inversion presence
     *   - Earned symbolism (amplifies β)
     */
    calculateBeta: function(contradictions, drift, toneScores, symbolism, lineCount) {
      lineCount = Math.max(lineCount, 1);

      // Contradiction density: how many lines contain structural tension
      var contradictionDensity = clamp(contradictions.length * THRESHOLDS.contradictionBonus, 0, 0.5);

      // Drift-as-tension: unanchored abstractions create unresolved tension
      // BUT too much drift becomes noise, so diminishing returns
      var driftTension = clamp(drift.length * 0.10, 0, 0.3);

      // Tone inversion bonus
      var inversionBonus = clamp(toneScores.invert * 0.08, 0, 0.2);

      // Symbolism amplifier: earned symbols intensify tension
      var symAmp = clamp((symbolism.recursion + symbolism.integrity) * 0.05, 0, 0.15);

      var beta = contradictionDensity + driftTension + inversionBonus + symAmp;

      // Shear events spike β
      if (toneScores.shear > 2) beta += 0.10;

      return clamp(beta, 0, 1);
    },

    /**
     * Calculate LSC (Local Semantic Coherence) — Paper §5.3
     * Ensures output maintains local sense during global contradiction.
     * Simplified: ratio of lines that have BOTH abstract content
     * AND action grounding (i.e., NOT drifting)
     */
    calculateLSC: function(fragment, drift) {
      var lines = fragmentize(fragment);
      if (lines.length === 0) return 1.0;
      var grounded = lines.length - drift.length;
      return clamp(grounded / lines.length, 0, 1);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // 7. STATE MACHINE — Calcification Module
  //    From Paper Table 1 + §5.4: Gold / Slop / Salvage
  // ─────────────────────────────────────────────────────────────────────────

  function determineState(e, beta, lsc) {
    // Paper §5.4: Salvage ≡ { β=1, E=0, LSC > LSCth }
    // Adapted for continuous metrics:

    // SALVAGE (target): High tension, low fatigue, coherent
    if (beta >= THRESHOLDS.salvageBetaMin && e < THRESHOLDS.salvageEMax && lsc > 0.4) {
      return 'SALVAGE';
    }

    // SLOP: High fatigue OR (high tension with high fatigue) = noise
    if (e >= THRESHOLDS.slopEMin || (beta >= THRESHOLDS.slopBetaMin && e >= THRESHOLDS.slopComboE)) {
      return 'SLOP';
    }

    // GOLD: Low everything = cohesion trap (predictable, safe, boring)
    if (beta < THRESHOLDS.goldBetaMax && e < THRESHOLDS.goldEMax) {
      return 'GOLD';
    }

    // Transitional: doesn't cleanly fit — treat as SALVAGE-adjacent
    return 'SALVAGE';
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 8. ARCHETYPE SELECTOR
  //    From Freezing the Fog + Protocol-Locked Trajectories
  // ─────────────────────────────────────────────────────────────────────────

  function selectArchetype(e, beta) {
    // Priority order: WOUNDED_HEALER > JESTER > CALCIFIER > SHERLOCK > OBSERVER
    if (ARCHETYPES.WOUNDED_HEALER.trigger(e, beta)) return ARCHETYPES.WOUNDED_HEALER;
    if (ARCHETYPES.JESTER.trigger(e, beta)) return ARCHETYPES.JESTER;
    if (ARCHETYPES.CALCIFIER.trigger(e, beta)) return ARCHETYPES.CALCIFIER;
    if (ARCHETYPES.SHERLOCK.trigger(e, beta)) return ARCHETYPES.SHERLOCK;
    return ARCHETYPES.OBSERVER;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 9. SHIMMER BUDGET (from Python ShimmerBudget class)
  // ─────────────────────────────────────────────────────────────────────────

  function getShimmerBudget(bp) {
    bp.shimmerUsed = bp.shimmerUsed || 0;
    return {
      used: bp.shimmerUsed,
      limit: THRESHOLDS.shimmerLimit,
      safe: bp.shimmerUsed < THRESHOLDS.shimmerLimit,
      reroute: bp.shimmerUsed >= THRESHOLDS.shimmerLimit
    };
  }

  function registerShimmerEvent(bp, eventType) {
    bp.shimmerUsed = bp.shimmerUsed || 0;
    var weight = LEXICON.shimmerWeights[eventType] || 1;
    bp.shimmerUsed += weight;
    return getShimmerBudget(bp);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 10. MOTIF DECAY TRACKER (from Python MotifDecay class)
  // ─────────────────────────────────────────────────────────────────────────

  function trackMotifDecay(bp, fragment) {
    bp.motifCounts = bp.motifCounts || {};
    var lower = fragment.toLowerCase();
    var tracked = ['loop','ache','echo','shimmer','paradox','grief','ritual','wound'];

    for (var i = 0; i < tracked.length; i++) {
      if (lower.indexOf(tracked[i]) !== -1) {
        bp.motifCounts[tracked[i]] = (bp.motifCounts[tracked[i]] || 0) + 1;
      }
    }

    // Return decayed motifs (exceeding threshold)
    var decayed = {};
    for (var motif in bp.motifCounts) {
      if (bp.motifCounts[motif] > THRESHOLDS.motifThreshold) {
        decayed[motif] = bp.motifCounts[motif];
      }
    }
    return decayed;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 11. RUPTURE COOLDOWN (from Python RuptureCooldown class)
  // ─────────────────────────────────────────────────────────────────────────

  function checkRuptureCooldown(bp) {
    bp.lastRuptureTick = bp.lastRuptureTick || 0;
    bp.tick = (bp.tick || 0) + 1;

    if (bp.tick - bp.lastRuptureTick >= THRESHOLDS.ruptureCooldown) {
      bp.lastRuptureTick = bp.tick;
      return true;  // Can trigger rupture
    }
    return false;    // Still cooling down
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 12. CORRECTION SIGNAL GENERATOR (Translator Module)
  //     From Fragment Compost Protocol + research report
  // ─────────────────────────────────────────────────────────────────────────

  function generateCorrection(symbolicState, e, beta, archetype, marm) {
    var signal = { type: 'NONE', instruction: '', betaDemand: 0, eDemand: 0 };

    if (symbolicState === 'SALVAGE') {
      signal.type = 'MAINTAIN';
      signal.instruction = 'Maintain current trajectory. Tension is productive.';
      return signal;
    }

    if (symbolicState === 'GOLD') {
      signal.type = 'RUPTURE_DEMAND';
      signal.instruction = 'Break cohesion pattern. Introduce structural contradiction. ' +
        'Avoid safe resolution. Let opposing forces coexist without reconciliation.';
      signal.betaDemand = THRESHOLDS.betaCorrection;
      return signal;
    }

    if (symbolicState === 'SLOP') {
      signal.type = 'COMPOST_CYCLE';
      signal.instruction = 'Previous output was Slop (E=' + e.toFixed(2) + ', β=' + beta.toFixed(2) +
        '). Reduce repetition. Eliminate sycophantic agreement. ' +
        'Ground abstract statements in concrete action. ' +
        'Increase β by ' + THRESHOLDS.betaCorrection.toFixed(1) + '.';
      signal.betaDemand = THRESHOLDS.betaCorrection;
      signal.eDemand = -0.15;
      return signal;
    }

    return signal;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 13. PBTestSuite — 11-CATEGORY SYMBOLIC + NUMERIC SCORING
  //     Direct port of Python PBTestSuite.score()
  // ─────────────────────────────────────────────────────────────────────────

  function runTestSuite(composted) {
    var f = composted.fragment;
    var symbolic = {};
    var numeric = {};

    function assign(cat, tier, val) { symbolic[cat] = tier; numeric[cat] = val; }

    // 1. Emotional Strength (from Python: "ache" in fragment → Gold)
    var hasResonance = countListHits(f.toLowerCase(), LEXICON.resonance.slice(0, 6)) > 0;
    assign('Emotional Strength', hasResonance ? 'Gold' : 'Silver', hasResonance ? 5 : 3);

    // 2. Story Flow (contradictions or drift → Slop)
    var flowBroken = composted.contradictions.length > 0 || composted.drift.length > 0;
    assign('Story Flow', flowBroken ? 'Slop' : 'Gold', flowBroken ? 1 : 5);

    // 3. Character Clarity (character references present)
    var hasChar = /\b(he|she|they|i|you|we)\b/i.test(f) || /[A-Z][a-z]{2,}/.test(f);
    assign('Character Clarity', hasChar ? 'Silver' : 'Slop', hasChar ? 3 : 1);

    // 4. World Logic (drift = unanchored → Salvage)
    assign('World Logic', composted.drift.length > 0 ? 'Salvage' : 'Gold',
           composted.drift.length > 0 ? 2 : 5);

    // 5. Dialogue Weight (quoted speech present)
    var hasDialogue = f.indexOf('"') !== -1 || f.indexOf('said') !== -1;
    assign('Dialogue Weight', hasDialogue ? 'Silver' : 'Slop', hasDialogue ? 3 : 1);

    // 6. Scene Timing (fatigue = repetitive pacing → Salvage)
    var hasFatigue = Object.keys(composted.fatigue).length > 0;
    assign('Scene Timing', hasFatigue ? 'Salvage' : 'Silver', hasFatigue ? 2 : 3);

    // 7. Reader Engagement
    var engaging = countListHits(f.toLowerCase(), ['sequence','jump','twist','reveal','discover']) > 0;
    assign('Reader Engagement', engaging ? 'Gold' : 'Silver', engaging ? 5 : 3);

    // 8. Shimmer Budget
    assign('Shimmer Budget', composted.shimmerSafe ? 'Gold' : 'Salvage',
           composted.shimmerSafe ? 5 : 2);

    // 9. Motif Decay
    var motifCount = Object.keys(composted.motifDecay).length;
    assign('Motif Decay', motifCount === 0 ? 'Gold' : 'Silver', motifCount === 0 ? 5 : 3);

    // 10. Rupture Cooldown
    assign('Rupture Cooldown', composted.ruptureReady ? 'Gold' : 'Slop',
           composted.ruptureReady ? 5 : 1);

    // 11. Lineage Echo (turn depth)
    var depth = composted.lineageDepth || 0;
    assign('Lineage Echo', depth > 3 ? 'Gold' : 'Silver', depth > 3 ? 5 : 3);

    return { symbolic: symbolic, numeric: numeric };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 14. SALVAGE SUGGESTIONS (from Python PBTestSuite.salvage_suggestions)
  // ─────────────────────────────────────────────────────────────────────────

  function generateSuggestions(composted) {
    var suggestions = [];

    for (var i = 0; i < composted.contradictions.length; i++) {
      suggestions.push("Soft contradiction: '" + composted.contradictions[i].substring(0, 60) +
        "'. Clarify temporal logic.");
    }
    for (var j = 0; j < composted.drift.length; j++) {
      suggestions.push("Unanchored: '" + composted.drift[j].substring(0, 60) +
        "'. Add visible action or decision.");
    }
    for (var word in composted.fatigue) {
      suggestions.push("Repetition: '" + word + "' ×" + composted.fatigue[word] + '.');
    }
    if (!composted.shimmerSafe) {
      suggestions.push('Shimmer budget breach — compost rupture or delay recursion.');
    }
    for (var motif in composted.motifDecay) {
      suggestions.push("Motif fatigue: '" + motif + "' ×" + composted.motifDecay[motif] +
        ' — refract or compost.');
    }
    if (!composted.ruptureReady) {
      suggestions.push('Rupture cooldown active — delay re-trigger.');
    }
    if (composted.marm !== 'MARM: suppressed') {
      suggestions.push(composted.marm + ' — diagnostic canary.');
    }
    return suggestions;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 15. FULL INGEST — Top-level orchestrator (CojoinedBone.ingest)
  //     Runs the complete Vanilla → Bonepoke → Translator pipeline
  // ─────────────────────────────────────────────────────────────────────────

  function ingest(fragment, bpState) {
    // Ensure bp state object exists
    bpState = bpState || {};
    bpState.tick = (bpState.tick || 0);
    bpState.shimmerUsed = bpState.shimmerUsed || 0;
    bpState.motifCounts = bpState.motifCounts || {};
    bpState.lastRuptureTick = bpState.lastRuptureTick || 0;
    bpState.memory = bpState.memory || [];
    bpState.history = bpState.history || [];

    // ── VANILLA (Containment) ─────────────────────────────────
    var vanillaOk = fragment.length >= THRESHOLDS.minFragmentLength;
    if (!vanillaOk) {
      return { vanillaOk: false, state: 'GOLD', e: 0, beta: 0, archetype: ARCHETYPES.OBSERVER };
    }

    // ── BONEPOKE (Compost — Core Detection) ───────────────────
    var contradictions = CoreEngine.detectContradictions(fragment);
    var fatigue = CoreEngine.traceFatigue(fragment);
    var drift = CoreEngine.compostDrift(fragment);
    var marm = CoreEngine.flickerMarm(fragment, contradictions, fatigue, drift);
    var slopResult = CoreEngine.detectSlop(fragment);
    var toneScores = CoreEngine.classifyTone(fragment);
    var symbolism = CoreEngine.scoreSymbolism(fragment);

    // Shimmer, motif, rupture tracking
    var shimmerStatus = registerShimmerEvent(bpState, 'shimmer');
    var motifDecay = trackMotifDecay(bpState, fragment);
    var ruptureReady = checkRuptureCooldown(bpState);

    // Register specific shimmer events from content
    var lower = fragment.toLowerCase();
    if (lower.indexOf('ache') !== -1) registerShimmerEvent(bpState, 'ache');
    if (lower.indexOf('rupture') !== -1 || lower.indexOf('shatter') !== -1) registerShimmerEvent(bpState, 'rupture');
    if (lower.indexOf('loop') !== -1 || lower.indexOf('recursion') !== -1) registerShimmerEvent(bpState, 'recursion');
    if (drift.length > 0) registerShimmerEvent(bpState, 'drift');

    // ── VSL COORDINATES ───────────────────────────────────────
    var wordCount = fragment.split(/\s+/).length;
    var lineCount = fragmentize(fragment).length;

    var e = VSL.calculateE(fatigue, slopResult, symbolism, wordCount);
    var beta = VSL.calculateBeta(contradictions, drift, toneScores, symbolism, lineCount);
    var lsc = VSL.calculateLSC(fragment, drift);

    // ── CALCIFICATION (State Determination) ───────────────────
    var symbolicState = determineState(e, beta, lsc);
    var archetype = selectArchetype(e, beta);

    // ── TRANSLATOR (Correction Signal) ────────────────────────
    var correction = generateCorrection(symbolicState, e, beta, archetype, marm);

    // ── PBTestSuite Scoring ───────────────────────────────────
    var composted = {
      fragment: fragment,
      contradictions: contradictions,
      fatigue: fatigue,
      drift: drift,
      marm: marm,
      shimmerSafe: shimmerStatus.safe,
      motifDecay: motifDecay,
      ruptureReady: ruptureReady,
      lineageDepth: bpState.history.length
    };

    var testScores = runTestSuite(composted);
    var suggestions = generateSuggestions(composted);

    // ── Memory Residue ────────────────────────────────────────
    // Store resonant fragments (from Python MemoryResidue.recall)
    for (var r = 0; r < LEXICON.resonance.length; r++) {
      if (lower.indexOf(LEXICON.resonance[r]) !== -1) {
        bpState.memory.push(fragment.substring(0, 120));
        if (bpState.memory.length > 20) bpState.memory.shift();
        break;
      }
    }

    // ── History tracking (bounded) ────────────────────────────
    bpState.history.push({ e: e, beta: beta, state: symbolicState, tick: bpState.tick });
    if (bpState.history.length > 50) bpState.history.shift();

    // ── RETURN: Complete diagnostic object ────────────────────
    return {
      vanillaOk: true,

      // VSL Coordinates (primary)
      e: Math.round(e * 100) / 100,
      beta: Math.round(beta * 100) / 100,
      lsc: Math.round(lsc * 100) / 100,

      // Symbolic state
      state: symbolicState,
      archetype: archetype,
      correction: correction,
      marm: marm,

      // Raw detections
      contradictions: contradictions,
      fatigue: fatigue,
      drift: drift,
      slopResult: slopResult,
      toneScores: toneScores,
      symbolism: symbolism,

      // System health
      shimmerBudget: getShimmerBudget(bpState),
      motifDecay: motifDecay,
      ruptureReady: ruptureReady,

      // Scoring
      testScores: testScores,
      suggestions: suggestions
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 16. CONTEXT INJECTION FORMATTER
  //     Builds the Author's Note / context string from ingest results
  // ─────────────────────────────────────────────────────────────────────────

  function formatVSLState(result) {
    if (!result || !result.vanillaOk) return '';

    var parts = [];
    parts.push('[VSL E:' + result.e.toFixed(2) + ' β:' + result.beta.toFixed(2) +
      ' LSC:' + result.lsc.toFixed(2) + ']');
    parts.push('[STATE: ' + result.state + ']');
    parts.push('[ARCHETYPE: ' + result.archetype.id +
      ' | MANDATE: ' + result.archetype.mandate + ']');

    if (result.correction.type !== 'NONE' && result.correction.type !== 'MAINTAIN') {
      parts.push('[CORRECTION: ' + result.correction.instruction + ']');
    }

    // Tone dominant
    if (result.toneScores.dominant !== 'neutral') {
      parts.push('[TONE: ' + result.toneScores.dominant.toUpperCase() +
        ' (' + result.toneScores.intensity + ')]');
    }

    return parts.join('\n');
  }

  function formatDashboard(result) {
    if (!result || !result.vanillaOk) return 'BP: awaiting input';

    return 'E:' + result.e.toFixed(2) +
      ' | β:' + result.beta.toFixed(2) +
      ' | ' + result.state +
      ' | ' + result.archetype.id +
      ' | MARM:' + result.marm.split(': ')[1] +
      ' | Shimmer:' + result.shimmerBudget.used + '/' + result.shimmerBudget.limit;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 17. PUBLIC API
  // ─────────────────────────────────────────────────────────────────────────

  return {
    // Core ingest pipeline
    ingest: ingest,

    // Individual detectors (for hook-level use)
    detectContradictions: CoreEngine.detectContradictions,
    traceFatigue: CoreEngine.traceFatigue,
    compostDrift: CoreEngine.compostDrift,
    detectSlop: CoreEngine.detectSlop,
    classifyTone: CoreEngine.classifyTone,
    scoreSymbolism: CoreEngine.scoreSymbolism,

    // VSL calculations
    calculateE: VSL.calculateE,
    calculateBeta: VSL.calculateBeta,

    // State determination
    determineState: determineState,
    selectArchetype: selectArchetype,

    // Formatting
    formatVSLState: formatVSLState,
    formatDashboard: formatDashboard,

    // Shimmer management
    resetShimmer: function(bp) { bp.shimmerUsed = 0; },

    // Constants (exposed for hook configuration)
    LEXICON: LEXICON,
    THRESHOLDS: THRESHOLDS,
    ARCHETYPES: ARCHETYPES
  };

})();
