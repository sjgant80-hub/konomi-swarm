// ═══════════════════════════════════════════════════════════════
// ◊·κ=1 — konomi-swarm — colony primitive
// ─────────────────────────────────────────────────────────────
//   shape  · κ₂.thomas (via swarm-mind.html)
//   build  · κ₀.simon (sovereign single-file implementation)
//   prime  · 109
//   sees   · every approve/reject is a pheromone deposit
//   gives  · weighted sampling for next decision · evolution per gen
//   uses   · FallReach · si-didy · FallBrief · FallGrade — any tool
//            with a binary outcome loop
// ═══════════════════════════════════════════════════════════════

(function (global, factory) {
  if (typeof module !== 'undefined' && module.exports) module.exports = factory();
  else global.KonomiSwarm = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // ─── Colony ───────────────────────────────────────────────────
  // One operator's accumulated memory of what worked.
  // Pheromone map keys ARE the pattern keys you choose to track
  // (message archetype · lead class · weave name · whatever).
  //
  //   const c = new Colony({ id: 'fallreach' });
  //   c.deposit({ pattern: 'observation+question', outcome: 'approved' });
  //   c.sample({ candidates: [...], k: 3 });
  //   c.evolve();
  //
  function Colony(opts) {
    opts = opts || {};
    this.id           = opts.id || 'col_' + Date.now().toString(36);
    this.pheromone    = opts.pheromone || {};
    this.gen          = opts.gen || 1;
    this.traits       = opts.traits || { speed: 1.0, sense: 1.0, voice_match: 1.0 };
    this.decayRate    = typeof opts.decayRate === 'number' ? opts.decayRate : 0.95;
    this.maxTrail     = opts.maxTrail || 100;
    this.history      = opts.history || [];
    this.historyMax   = opts.historyMax || 500;
    this.created      = opts.created || Date.now();
    this.lastEvolved  = opts.lastEvolved || null;
  }

  // Deposit a pheromone trail. Outcome 'approved' or 'landed' or 'replied' (positive),
  // 'rejected' or 'cold' or 'ignored' (negative). Weight scales the effect.
  Colony.prototype.deposit = function (info) {
    if (!info || !info.pattern) return this;
    var key    = String(info.pattern);
    var out    = info.outcome || 'approved';
    var weight = typeof info.weight === 'number' ? info.weight : 1;
    var sign   = 1;
    if (out === 'rejected' || out === 'cold' || out === 'ignored' || out === 'bounced') sign = -1;
    else if (out === 'neutral' || out === 'mixed') sign = 0;
    var current = this.pheromone[key] || 0;
    var next    = current + sign * weight * this.traits.voice_match;
    if (next >  this.maxTrail) next =  this.maxTrail;
    if (next < -this.maxTrail) next = -this.maxTrail;
    this.pheromone[key] = next;
    this.history.push({ pattern: key, outcome: out, weight: weight, t: Date.now() });
    if (this.history.length > this.historyMax) this.history.shift();
    return this;
  };

  // Sample k candidates from a pool, weighted by trail strength (softmax).
  // `explore` is the epsilon-greedy random-pick probability — keeps the
  // colony from converging too early.
  Colony.prototype.sample = function (opts) {
    opts = opts || {};
    var cands = opts.candidates || [];
    if (!cands.length) return [];
    var k       = opts.k || 1;
    var explore = typeof opts.explore === 'number' ? opts.explore : 0.15;
    var keyFn   = opts.key || function (x) { return String(x); };
    var pool    = cands.slice();
    var out     = [];
    while (out.length < k && pool.length) {
      if (Math.random() < explore) {
        var i = Math.floor(Math.random() * pool.length);
        out.push(pool.splice(i, 1)[0]);
        continue;
      }
      var weights = pool.map(function (c) {
        var trail = this.pheromone[keyFn(c)] || 0;
        return Math.exp(trail * this.traits.sense * 0.1);
      }, this);
      var total = weights.reduce(function (a, b) { return a + b; }, 0);
      var r     = Math.random() * total;
      var idx   = 0;
      for (var j = 0; j < weights.length; j++) {
        r -= weights[j];
        if (r <= 0) { idx = j; break; }
      }
      out.push(pool.splice(idx, 1)[0]);
    }
    return out;
  };

  // Score a single candidate by its current trail strength.
  // Higher = more reinforced, lower / negative = avoided.
  Colony.prototype.score = function (pattern) {
    return this.pheromone[String(pattern)] || 0;
  };

  // Decay all trails by decayRate. Drops near-zero entries.
  Colony.prototype.decay = function () {
    for (var k in this.pheromone) {
      if (Object.prototype.hasOwnProperty.call(this.pheromone, k)) {
        this.pheromone[k] *= this.decayRate;
        if (Math.abs(this.pheromone[k]) < 0.05) delete this.pheromone[k];
      }
    }
    return this;
  };

  // Evolve one generation. Traits mutate proportional to (1 - recent reward).
  // Failing colonies mutate harder. Successful ones lock in.
  Colony.prototype.evolve = function () {
    var window = this.history.slice(-100);
    var wins = 0;
    for (var i = 0; i < window.length; i++) {
      var o = window[i].outcome;
      if (o !== 'rejected' && o !== 'cold' && o !== 'ignored' && o !== 'bounced') wins++;
    }
    var total = window.length || 1;
    var reward = wins / total;
    var sigma = 0.08 * (1 - reward);
    this.traits.speed       = clamp(this.traits.speed       * (1 + gauss() * sigma));
    this.traits.sense       = clamp(this.traits.sense       * (1 + gauss() * sigma));
    this.traits.voice_match = clamp(this.traits.voice_match * (1 + gauss() * sigma));
    this.gen++;
    this.lastEvolved = Date.now();
    this.decay();
    return this;
  };

  // Top reinforced trails (positive strength). For UI display + δ priors.
  Colony.prototype.topTrails = function (k) {
    k = k || 10;
    return Object.keys(this.pheromone)
      .map(function (key) { return { pattern: key, strength: this.pheromone[key] }; }, this)
      .filter(function (t) { return t.strength > 0; })
      .sort(function (a, b) { return b.strength - a.strength; })
      .slice(0, k);
  };

  // Avoided trails (negative strength). The colony's "don't go there" map.
  Colony.prototype.avoidedTrails = function (k) {
    k = k || 10;
    return Object.keys(this.pheromone)
      .map(function (key) { return { pattern: key, strength: this.pheromone[key] }; }, this)
      .filter(function (t) { return t.strength < 0; })
      .sort(function (a, b) { return a.strength - b.strength; })
      .slice(0, k);
  };

  // Generation summary — for the UI watcher.
  Colony.prototype.stats = function () {
    var keys = Object.keys(this.pheromone);
    var pos = 0, neg = 0, sumPos = 0, sumNeg = 0;
    for (var i = 0; i < keys.length; i++) {
      var v = this.pheromone[keys[i]];
      if (v > 0) { pos++; sumPos += v; } else if (v < 0) { neg++; sumNeg += v; }
    }
    var window = this.history.slice(-100);
    var wins = 0;
    for (var j = 0; j < window.length; j++) {
      var o = window[j].outcome;
      if (o !== 'rejected' && o !== 'cold' && o !== 'ignored' && o !== 'bounced') wins++;
    }
    return {
      id: this.id,
      gen: this.gen,
      traits: Object.assign({}, this.traits),
      trail_count: keys.length,
      positive_trails: pos,
      negative_trails: neg,
      sum_positive: Math.round(sumPos * 100) / 100,
      sum_negative: Math.round(sumNeg * 100) / 100,
      history_size: this.history.length,
      recent_reward: window.length ? Math.round((wins / window.length) * 100) / 100 : null,
      last_evolved: this.lastEvolved
    };
  };

  Colony.prototype.toJSON = function () {
    return {
      id: this.id, pheromone: this.pheromone, gen: this.gen,
      traits: this.traits, decayRate: this.decayRate, maxTrail: this.maxTrail,
      history: this.history, historyMax: this.historyMax,
      created: this.created, lastEvolved: this.lastEvolved
    };
  };

  Colony.fromJSON = function (json) {
    if (!json) return new Colony();
    return new Colony(json);
  };

  // ─── ColonyStore — localStorage persistence ───────────────────
  function ColonyStore(ns) {
    this.ns = ns || 'konomi_swarm';
  }
  ColonyStore.prototype.key = function (id) { return this.ns + ':' + id; };
  ColonyStore.prototype.load = function (id) {
    try {
      var raw = localStorage.getItem(this.key(id));
      if (!raw) return null;
      return Colony.fromJSON(JSON.parse(raw));
    } catch (e) { return null; }
  };
  ColonyStore.prototype.save = function (colony) {
    try { localStorage.setItem(this.key(colony.id), JSON.stringify(colony.toJSON())); return true; }
    catch (e) { return false; }
  };
  ColonyStore.prototype.list = function () {
    var ids = [];
    for (var i = 0; i < localStorage.length; i++) {
      var k = localStorage.key(i);
      if (k && k.indexOf(this.ns + ':') === 0) ids.push(k.slice(this.ns.length + 1));
    }
    return ids;
  };
  ColonyStore.prototype.remove = function (id) {
    try { localStorage.removeItem(this.key(id)); } catch (e) {}
  };
  ColonyStore.prototype.loadOrCreate = function (id, opts) {
    var c = this.load(id);
    if (c) return c;
    return new Colony(Object.assign({ id: id }, opts || {}));
  };

  // ─── Mesh broadcast hook (optional) ───────────────────────────
  // When opted in, a tool emits 'swarm:pheromone' on the shared
  // 'fallmesh' channel so peer tools can observe (anonymised) trails.
  function meshBroadcast(colony, deposit, fromNode) {
    if (typeof BroadcastChannel === 'undefined') return false;
    try {
      var ch = new BroadcastChannel('fallmesh');
      ch.postMessage({
        type: 'swarm:pheromone',
        from: fromNode || 'konomi-swarm',
        colony: colony.id,
        gen: colony.gen,
        deposit: deposit,
        t: Date.now()
      });
      ch.close();
      return true;
    } catch (e) { return false; }
  }

  // ─── helpers ──────────────────────────────────────────────────
  function clamp(v) { return Math.max(0.1, Math.min(3.0, v)); }
  function gauss() {
    var u = Math.random() || 1e-9, v = Math.random() || 1e-9;
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }

  return {
    VERSION: '1.0.0',
    PRIME: 109,
    Colony: Colony,
    ColonyStore: ColonyStore,
    meshBroadcast: meshBroadcast
  };
});
