const assert = require('node:assert/strict');
const { test } = require('node:test');
const { WorkbenchService } = require('../dist/sdlearn-api/src/workbench.service.js');
const { simulateChaos, findSinglePointsOfFailure } = require('../dist/shared/engine/chaos.js');
const { designToMermaid, mermaidToDesign } = require('../dist/shared/engine/graph.js');
const { analyzeDesign } = require('../dist/shared/engine/rubric.js');
const { findProblem } = require('../dist/shared/catalog/problems.js');

function createHarness(llm = null) {
  const records = new Map();
  const database = {
    async query(sql, values) {
      if (sql.startsWith('SELECT payload FROM sdlearn_records WHERE kind = $1 AND id = $2')) {
        const record = records.get(`${values[0]}:${values[1]}`);
        return { rows: record ? [{ payload: record.payload }] : [] };
      }
      if (sql.startsWith('SELECT payload FROM sdlearn_records WHERE kind = $1 ORDER BY')) {
        return { rows: [...records.entries()].filter(([key]) => key.startsWith(`${values[0]}:`)).reverse().map(([, value]) => ({ payload: value.payload })) };
      }
      if (sql.startsWith('INSERT INTO sdlearn_records')) {
        records.delete(`${values[0]}:${values[1]}`);
        records.set(`${values[0]}:${values[1]}`, { payload: JSON.parse(values[2]) });
        return { rows: [] };
      }
      if (sql.startsWith('DELETE FROM sdlearn_records')) {
        for (const [key, value] of records) {
          if (key === `session:${values[0]}` || ((key.startsWith('chaos-run:') || key.startsWith('evaluation:')) && value.payload.sessionId === values[0])) records.delete(key);
        }
        return { rows: [] };
      }
      throw new Error(`Unexpected SQL: ${sql}`);
    },
  };
  return { service: new WorkbenchService(database, llm), records };
}

const node = (id, kind, replicas = 1, x = 0) => ({ id, type: 'component', position: { x, y: 0 }, data: { kind, label: id, replicas } });
const edge = (source, target, extra = {}) => ({ id: `${source}-${target}`, source, target, ...extra });
const profile = { peakRps: 20000, latencyBudgetMs: 100 };

function redundantDesign() {
  return {
    nodes: [node('client', 'client'), node('lb', 'load-balancer', 2), node('api', 'service', 6), node('cache', 'cache', 3), node('db', 'nosql', 3)],
    edges: [edge('client', 'lb'), edge('lb', 'api'), edge('api', 'cache'), edge('api', 'db')],
    mermaid: '', notes: '',
  };
}

test('problem catalog filters by text, difficulty and tag', () => {
  const { service } = createHarness();
  assert.ok(service.listProblems({}).items.length >= 16);
  assert.deepEqual(service.listProblems({ q: 'bit.ly' }).items.map((item) => item.id), ['url-shortener']);
  assert.ok(service.listProblems({ difficulty: 'Easy' }).items.every((item) => item.difficulty === 'Easy'));
  assert.ok(service.listProblems({ tag: 'caching' }).items.some((item) => item.id === 'twitter-feed'));
});

test('every problem links to existing articles', () => {
  const { service } = createHarness();
  const slugs = new Set(service.listArticles().items.map((item) => item.slug));
  for (const problem of service.listProblems({}).items) {
    for (const slug of service.getProblem(problem.id).relatedArticles) assert.ok(slugs.has(slug), `${problem.id} -> ${slug}`);
  }
});

test('sessions start with a client node, persist designs and can be deleted with their history', async () => {
  const { service, records } = createHarness();
  const session = await service.createSession('url-shortener');
  assert.equal(session.design.nodes[0].data.kind, 'client');
  await service.saveDesign(session.id, redundantDesign());
  assert.equal((await service.getSession(session.id)).design.nodes.length, 5);
  assert.equal((await service.listSessions({ limit: 10 })).items[0].componentCount, 5);
  await service.runChaos(session.id, { scenarioId: 'node-failure', targetId: 'cache' });
  await service.deleteSession(session.id);
  assert.equal(records.size, 0);
});

test('chaos: redundancy survives a replica loss, a single instance is a SPOF', () => {
  const design = redundantDesign();
  const survived = simulateChaos(design, profile, { scenarioId: 'replica-loss', targetId: 'api', magnitude: 1 });
  assert.equal(survived.outcome, 'survived');
  assert.equal(survived.nodes.find((item) => item.id === 'api').health, 'degraded');

  design.nodes[4].data.replicas = 1;
  const outage = simulateChaos(design, profile, { scenarioId: 'replica-loss', targetId: 'db' });
  assert.equal(outage.outcome, 'outage');
  assert.equal(outage.nodes.find((item) => item.id === 'api').health, 'failing');
  assert.deepEqual(findSinglePointsOfFailure(design, profile).map((item) => item.id), ['db']);
});

test('chaos: losing the cache shifts its hits to the database', () => {
  const design = redundantDesign();
  design.nodes[4].data = { kind: 'sql', label: 'db', replicas: 1 };
  const baseline = simulateChaos(design, profile, { scenarioId: 'traffic-spike', magnitude: 1 });
  const withoutCache = simulateChaos(design, profile, { scenarioId: 'node-failure', targetId: 'cache' });
  const dbLoad = (result) => result.nodes.find((item) => item.id === 'db').load;
  assert.equal(dbLoad(withoutCache), dbLoad(baseline) * 5);
  assert.equal(withoutCache.nodes.find((item) => item.id === 'api').health, 'degraded');
  assert.equal(withoutCache.outcome, 'degraded');
});

test('chaos: queues buffer spikes instead of failing, partitions isolate components', () => {
  const design = {
    nodes: [node('client', 'client'), node('api', 'service', 10), node('queue', 'queue', 2), node('worker', 'worker', 1), node('db', 'sql', 2)],
    edges: [edge('client', 'api'), edge('api', 'queue'), edge('queue', 'worker', { async: true }), edge('worker', 'db')],
    mermaid: '', notes: '',
  };
  const spike = simulateChaos(design, { peakRps: 10000, latencyBudgetMs: 200 }, { scenarioId: 'traffic-spike', magnitude: 2 });
  assert.ok(spike.servedRatio > 0.99);
  assert.ok(spike.nodes.find((item) => item.id === 'queue').reasons.some((reason) => reason.includes('Backlog')));

  const partition = simulateChaos(design, { peakRps: 10000, latencyBudgetMs: 200 }, { scenarioId: 'network-partition', targetId: 'client-api' });
  assert.equal(partition.outcome, 'outage');
  assert.equal(partition.nodes.find((item) => item.id === 'db').health, 'unreachable');
  assert.throws(() => simulateChaos(design, profile, { scenarioId: 'node-failure' }), /alvo/);
});

test('mermaid round-trips canvas components, replicas and async edges', () => {
  const design = redundantDesign();
  design.edges.push(edge('cache', 'db', { async: true, label: 'writes' }));
  const source = designToMermaid(design);
  assert.match(source, /Db\[\("db ×3"\)\]/);
  const twins = designToMermaid({ nodes: ['a', 'b'].map((id) => ({ ...node(id, 'websocket'), data: { kind: 'websocket', label: 'WebSocket Server', replicas: 1 } })), edges: [] });
  assert.match(twins, /WebSocketServer\[/);
  assert.match(twins, /WebSocketServer2\[/);
  const imported = mermaidToDesign(source);
  assert.equal(imported.nodes.length, 5);
  assert.equal(imported.nodes.find((item) => item.data.label === 'db').data.replicas, 3);
  assert.ok(imported.edges.some((item) => item.async && item.label === 'writes'));

  const parsed = mermaidToDesign('graph TD\n  U([Users]) --> LB[Load Balancer] --> A & B\n  A[API] -.->|events| K[/Kafka/]\n  B[API 2] --> R[(Redis cache)]');
  const kinds = Object.fromEntries(parsed.nodes.map((item) => [item.data.label, item.data.kind]));
  assert.deepEqual(kinds, { Users: 'client', 'Load Balancer': 'load-balancer', API: 'service', 'API 2': 'service', Kafka: 'stream', 'Redis cache': 'cache' });
  assert.equal(parsed.edges.length, 5);
  assert.deepEqual(parsed.warnings, []);
});

test('rubric rewards a complete, redundant design', () => {
  const problem = findProblem('url-shortener');
  const empty = analyzeDesign({ nodes: [node('client', 'client')], edges: [], mermaid: '', notes: '' }, problem);
  const good = analyzeDesign({ ...redundantDesign(), notes: 'x'.repeat(250) }, problem);
  assert.ok(empty.rubric.score < 20);
  assert.equal(good.rubric.score, 100);
});

test('evaluation without an AI provider is stored as a labelled heuristic pre-check', async () => {
  const { service } = createHarness();
  const session = await service.createSession('url-shortener');
  const evaluation = await service.requestEvaluation(session.id);
  assert.equal(evaluation.status, 'heuristic');
  assert.equal(evaluation.consensus, null);
  assert.match(evaluation.error, /provedor/);
  assert.equal((await service.getSession(session.id)).bestScore, null);
});

test('two judges assess independently, debate and reach a consensus within their range', async () => {
  const prompts = [];
  const llm = {
    name: 'fake',
    async completeJson(system, user) {
      prompts.push(user);
      const rigor = system.includes('O Rigoroso"');
      if (user.includes('"revisedScore"')) return { revisedScore: rigor ? 66 : 74, agreements: ['Cache bem posicionado'], disagreements: [], argument: 'Mantenho minha posição.' };
      if (user.includes('"keyStrengths"')) return { score: 99, summary: 'Consenso.', keyStrengths: ['A'], keyImprovements: ['B'], nextSteps: ['C'] };
      return { score: rigor ? 60 : 80, summary: 'Avaliação.', strengths: ['Bom'], weaknesses: ['Ruim'], dimensions: [{ name: 'Escalabilidade', score: 70 }] };
    },
  };
  const { service } = createHarness(llm);
  const session = await service.createSession('url-shortener');
  await service.saveDesign(session.id, redundantDesign());
  const queued = await service.requestEvaluation(session.id);
  assert.equal(queued.status, 'queued');
  await service.whenSettled(queued.id);
  const done = await service.getEvaluation(queued.id);
  assert.equal(done.status, 'completed');
  assert.deepEqual(done.assessments.map((item) => [item.judge, item.score, item.verdict]), [['rigor', 60, 'borderline'], ['pragmatic', 80, 'pass']]);
  assert.equal(done.debate.length, 2);
  assert.equal(done.consensus.score, 74);
  assert.equal(done.consensus.verdict, 'borderline');
  assert.equal(prompts.length, 5);
  assert.match(prompts[0], /Load Balancer/);
  const judged = await service.getSession(session.id);
  assert.equal(judged.status, 'judged');
  assert.equal(judged.bestScore, 74);
});

test('a failing provider marks the evaluation failed instead of inventing a score', async () => {
  const { service } = createHarness({ name: 'broken', async completeJson() { throw new Error('HTTP 500'); } });
  const session = await service.createSession('chat');
  const queued = await service.requestEvaluation(session.id);
  await service.whenSettled(queued.id);
  const failed = await service.getEvaluation(queued.id);
  assert.equal(failed.status, 'failed');
  assert.equal(failed.consensus, null);
  assert.match(failed.error, /HTTP 500/);
});
