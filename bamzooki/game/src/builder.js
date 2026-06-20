// Builder UI — generates the tuning controls for a Zook genome. Structural
// changes (legs/body/leg size) need a physics rebuild; gait changes can apply
// live. The caller decides what to do via the onChange(genome, structural) hook.

const FIELDS = [
  { path: "legCount", label: "Legs", min: 2, max: 8, step: 2, structural: true },
  { path: "body.w", label: "Body width", min: 0.6, max: 2.4, step: 0.1, structural: true },
  { path: "body.h", label: "Body height", min: 0.3, max: 1.2, step: 0.05, structural: true },
  { path: "body.l", label: "Body length", min: 0.8, max: 3.0, step: 0.1, structural: true },
  { path: "body.mass", label: "Mass", min: 2, max: 16, step: 0.5, structural: true },
  { path: "leg.len", label: "Leg length", min: 0.5, max: 1.8, step: 0.05, structural: true },
  { path: "leg.radius", label: "Leg thickness", min: 0.08, max: 0.3, step: 0.01, structural: true },
  { path: "gait.freq", label: "Step speed", min: 0.5, max: 4.0, step: 0.1 },
  { path: "gait.amplitude", label: "Stride", min: 0.1, max: 1.4, step: 0.05 },
  { path: "gait.drive", label: "Muscle power", min: 0, max: 24, step: 1 },
  { path: "gait.jump", label: "Jump thrust", min: 0, max: 14, step: 0.5 },
  { path: "gait.steer", label: "Steer bias", min: -3, max: 3, step: 0.2 },
];

function get(o, path) { return path.split(".").reduce((a, k) => a[k], o); }
function set(o, path, v) {
  const keys = path.split("."); const last = keys.pop();
  keys.reduce((a, k) => a[k], o)[last] = v;
}

export function renderBuilder(container, genome, onChange) {
  container.innerHTML = "";

  const name = document.createElement("input");
  name.type = "text"; name.value = genome.name; name.maxLength = 16; name.className = "field name";
  name.oninput = () => { genome.name = name.value || "Zook"; onChange(genome, false); };
  container.append(label("Name", name));

  const color = document.createElement("input");
  color.type = "color"; color.value = genome.color; color.className = "field";
  color.oninput = () => { genome.color = color.value; onChange(genome, true); };
  container.append(label("Colour", color));

  for (const f of FIELDS) {
    const row = document.createElement("div"); row.className = "slider-row";
    const val = document.createElement("span"); val.className = "val";
    const input = document.createElement("input");
    input.type = "range"; input.min = f.min; input.max = f.max; input.step = f.step;
    input.value = get(genome, f.path);
    val.textContent = (+input.value).toFixed(f.step < 1 ? 2 : 0);
    input.oninput = () => {
      const v = parseFloat(input.value);
      set(genome, f.path, v);
      val.textContent = v.toFixed(f.step < 1 ? 2 : 0);
      onChange(genome, !!f.structural);
    };
    const head = document.createElement("div"); head.className = "slider-head";
    const lab = document.createElement("span"); lab.textContent = f.label;
    head.append(lab, val);
    row.append(head, input);
    container.append(row);
  }
}

function label(text, input) {
  const wrap = document.createElement("label"); wrap.className = "field-row";
  const span = document.createElement("span"); span.textContent = text;
  wrap.append(span, input);
  return wrap;
}
