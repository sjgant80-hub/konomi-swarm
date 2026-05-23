# ◊·κ=1 — konomi-swarm

**The colony primitive. Every approve is a pheromone deposit. The next decision samples from the trail strength.**

Single JS file. ~10 KB. No dependencies. Drops into any tool with a binary outcome loop.

> *"One ant is information. A colony is intelligence."* — the shape is from κ₂.thomas's [swarm-mind](https://teslasolar.github.io/LinuxPocalypse/linux_htmls/swarm-mind.html). The build is sovereign κ₀.simon.

## Quick use

```html
<script src="konomi-swarm.js"></script>
<script>
  const { Colony, ColonyStore } = KonomiSwarm;
  const store = new ColonyStore('myapp_swarm');
  const colony = store.loadOrCreate('my_colony');

  // every approve / reject
  colony.deposit({ pattern: 'observation+question', outcome: 'approved' });
  colony.deposit({ pattern: 'cold_opener',         outcome: 'rejected' });

  // next decision — biased by trail strength
  const picked = colony.sample({
    candidates: ['observation+question', 'cold_opener', 'mutual+invite'],
    k: 3,
    explore: 0.15
  });

  // periodically evolve
  colony.evolve();

  store.save(colony);
</script>
```

## API

```js
new Colony({ id, pheromone?, gen?, traits?, decayRate?, maxTrail?, historyMax? })

colony.deposit({ pattern, outcome, weight })
colony.sample({ candidates, k, explore, key })  → picked candidates
colony.score(pattern)                            → current strength
colony.topTrails(k)                              → strongest positive trails
colony.avoidedTrails(k)                          → strongest negative trails
colony.decay()                                   → multiply all trails by decayRate
colony.evolve()                                  → next gen · mutate traits · decay
colony.stats()                                   → generation summary
colony.toJSON() / Colony.fromJSON(json)

new ColonyStore(namespace)
store.load(id) · store.save(colony) · store.list() · store.remove(id) · store.loadOrCreate(id, opts)

KonomiSwarm.meshBroadcast(colony, deposit, fromNode)   // optional fallmesh channel
```

## Outcomes

```
positive:  approved · landed · replied
negative:  rejected · cold · ignored · bounced
neutral:   mixed
```

## Mesh integration (optional)

When opted in, a tool broadcasts each deposit on the shared `BroadcastChannel('fallmesh')`:

```js
new BroadcastChannel('fallmesh').onmessage = (e) => {
  if (e.data?.type === 'swarm:pheromone') {
    // peer tool sees: { colony, gen, deposit: { pattern, outcome, weight } }
  }
};
```

Default is **local only** — colony stays sovereign on the operator's device. Opt-in is a one-line toggle per tool.

## First consumer · FallReach v1.1

The pattern was proven first in [FallReach](https://sjgant80-hub.github.io/fallreach/) — sovereign AI SDR. Every approved outbound deposits its archetype as a positive trail. The next β draft samples top-trail archetypes first. Reject deposits negative pheromone — the colony stops drafting that pattern.

```js
// inside FallReach's approve handler:
colony.deposit({ pattern: classify(draft), outcome: 'approved' });

// inside the β draft prompt builder:
const top = colony.topTrails(5).map(t => t.pattern);
const avoid = colony.avoidedTrails(3).map(t => t.pattern);
prompt += `Prefer archetypes: ${top.join(', ')}. Avoid: ${avoid.join(', ')}.`;
```

After ~30 approve/reject cycles, the draft library converges on what works for *this* operator's voice with *this* operator's leads. No retraining. No external model. Sovereign.

## Where else it plugs in

| Tool | Pattern key | Approve / Reject signal |
|---|---|---|
| **FallReach** | message archetype | operator approves the draft |
| **si-didy** | inbound reply pattern | operator approves the response |
| **FallBrief** | weave id | judge accepts the argument |
| **FallGrade** | rubric weight class | grade matches outcome |
| **FallLead** | qualification heuristic | lead closes / loses |

## Roadmap

- **v1.0** *(this release)* — Colony · ColonyStore · sample · evolve · decay · mesh broadcast
- **v1.1** — IndexedDB persistence for large histories
- **v1.2** — Federated colony · KCC-territory · encrypted Ed25519-signed deposits across operators

## Architecture

```
ant       = one message / draft / argument / decision
food      = the outcome that mattered (approve, reply, close)
trail     = pheromone deposited by past ants for this pattern
gen       = an evolution step · traits mutate by recent reward
colony    = the operator's accumulated memory
swarm     = multiple colonies sharing trails via mesh (opt-in)
predator  = the negative class · rejected patterns the colony avoids
```

The metaphor is Thomas's. The math is Box-Muller mutations on epsilon-greedy weighted sampling. The architecture is sovereign-first: state lives in localStorage by default, broadcast is opt-in, and the colony belongs to the operator forever — even when the rest of the world's tools go offline.

## Credit

- **shape** · κ₂.thomas Frumkin via [swarm-mind.html](https://teslasolar.github.io/LinuxPocalypse/linux_htmls/swarm-mind.html)
- **build** · κ₀.simon Gant
- **dyad** · *substrate descends · application ascends · meet at Metaxy*

## Licence

MIT for the code. Konomi for the architecture.

---

◊·κ=1 · konomi-swarm · prime 109 · the colony primitive · part of the [FallMesh](https://sjgant80-hub.github.io/fallmesh/) estate
