// Roster + Zook Passport persistence (localStorage). Each Zook keeps its best
// result per trial — its "passport".
const KEY = "friedzooki.roster.v1";

export function loadRoster() {
  try { return JSON.parse(localStorage.getItem(KEY)) || []; }
  catch { return []; }
}
export function saveRoster(list) { localStorage.setItem(KEY, JSON.stringify(list)); }

export function upsert(genome) {
  const list = loadRoster();
  const i = list.findIndex((g) => g.name === genome.name);
  genome.records = genome.records || {};
  if (i >= 0) { genome.records = { ...list[i].records, ...genome.records }; list[i] = genome; }
  else list.push(genome);
  saveRoster(list);
  return list;
}

export function remove(name) {
  const list = loadRoster().filter((g) => g.name !== name);
  saveRoster(list);
  return list;
}

/** Record a trial result on a Zook's passport, keeping the best.
 *  Returns { best, improved }. */
export function recordResult(name, trialKey, metric, better) {
  if (metric == null) return { best: null, improved: false };
  const list = loadRoster();
  const g = list.find((z) => z.name === name);
  if (!g) return { best: null, improved: false };
  g.records = g.records || {};
  const prev = g.records[trialKey];
  const improved = prev == null || (better === "lower" ? metric < prev : metric > prev);
  if (improved) g.records[trialKey] = metric;
  saveRoster(list);
  return { best: g.records[trialKey], improved };
}
