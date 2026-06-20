// Roster persistence — save/load Zook genomes in localStorage.
const KEY = "bamzooki.roster.v1";

export function loadRoster() {
  try { return JSON.parse(localStorage.getItem(KEY)) || []; }
  catch { return []; }
}

export function saveRoster(list) {
  localStorage.setItem(KEY, JSON.stringify(list));
}

/** Insert or update by name; returns the new list. */
export function upsert(genome) {
  const list = loadRoster();
  const i = list.findIndex((g) => g.name === genome.name);
  if (i >= 0) list[i] = genome; else list.push(genome);
  saveRoster(list);
  return list;
}

export function remove(name) {
  const list = loadRoster().filter((g) => g.name !== name);
  saveRoster(list);
  return list;
}
