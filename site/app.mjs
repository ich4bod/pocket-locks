import { create, act } from './engine.mjs?v=2';
import { trips } from './trips.mjs?v=17';

let selectedTrip = trips[0];
let state = create(selectedTrip.spec);
const history = [];
export function nextHint(state) {
  if (state.won) return 'Home. Try another trip.';
  const direction = Math.sign(state.target - state.boat);
  const reach = state.boat % 2 === 0;
  const lock = reach
    ? direction === 1 ? state.boat / 2 : state.boat / 2 - 1
    : (state.boat - 1) / 2;
  const side = reach
    ? direction === 1 ? 'low' : 'high'
    : direction === 1 ? 'high' : 'low';
  const chamber = state.chambers[lock];
  const gate = side === 'low' ? 'Lower gate' : 'Upper gate';
  const opposite = side === 'low' ? 'high' : 'low';
  const targetWater = side === 'low' ? state.reaches[lock] : state.reaches[lock + 1];
  const sail = direction === 1 ? 'Try Sail forward.' : 'Try Sail back.';
  if (chamber[side]) return sail;
  if (chamber[opposite]) return `Try Lock ${lock + 1}: ${opposite === 'low' ? 'Lower' : 'Upper'} gate.`;
  if (chamber.water !== targetWater) {
    if (targetWater > chamber.water && state.budget !== null && state.fills >= state.budget) {
      return 'No water tokens left. Undo or restart.';
    }
    return `Try Lock ${lock + 1}: ${side === 'low' ? 'Drain to lower reach.' : 'Fill from upper reach.'}`;
  }
  return `Try Lock ${lock + 1}: ${gate}.`;
}
const $ = id => document.getElementById(id);
const lockControls = $('lock-controls');
let hintVisible = false;
$('show-hint').addEventListener('click', () => {
  hintVisible = !hintVisible;
  $('show-hint').setAttribute('aria-pressed', String(hintVisible));
  $('show-hint').textContent = hintVisible ? 'Hide the hint' : 'Show a hint';
  $('hint').hidden = !hintVisible;
  updateHint();
});
const control = (id, label, action, parent) => {
  const button = document.createElement('button');
  button.id = id;
  button.textContent = label;
  button.addEventListener('click', action);
  parent.append(button);
  return button;
};
$('sail-forward').addEventListener('click', () => order({ type: 'sail', direction: 1 }));
$('sail-back').addEventListener('click', () => order({ type: 'sail', direction: -1 }));
$('undo').addEventListener('click', () => {
  if (!history.length) return;
  state = history.pop();
  render();
});
$('trip').addEventListener('change', () => {
  selectedTrip = trips.find(trip => trip.id === $('trip').value);
  resetTrip();
});
$('restart').addEventListener('click', resetTrip);
function resetTrip() {
  state = create(selectedTrip.spec);
  history.length = 0;
  $('trip-description').textContent = selectedTrip.description;
  $('water-note').hidden = selectedTrip.spec.budget === null;
  render();
}
function order(action) {
  const result = act(state, action);
  if (result.error) {
    $('status').textContent = result.error;
    updateHint();
    return;
  }
  history.push(state);
  state = result.state;
  render();
}
function render() {
  $('journey-stage').hidden = !state.stops;
  if (state.stops) {
    $('journey-stage').textContent = state.won
      ? 'All stops visited.'
      : `Stop ${state.stopIndex + 1} of ${state.stops.length} · ${state.target % 2 === 0 ? `Reach ${state.target / 2 + 1}` : `Lock ${(state.target + 1) / 2}`}`;
  }
  $('water-budget').hidden = state.budget === null;
  if (state.budget !== null) $('water-budget').textContent = `Water tokens: ${state.budget - state.fills} / ${state.budget}`;
  $('status').textContent = state.won
    ? `Moored! You brought the boat home in ${state.moves} moves.`
    : state.boat % 2 === 0
      ? `Boat in reach ${state.boat / 2 + 1}.`
      : `Boat in lock ${(state.boat + 1) / 2}.`;
  $('moves-state').textContent = `Moves: ${state.moves}`;
  $('undo').disabled = history.length === 0;
  for (const button of [$('sail-forward'), $('sail-back')]) button.disabled = state.won;
  renderLocks();
  renderCanal();
  updateHint();
}
function updateHint() {
  $('hint').textContent = nextHint(state);
}
function renderLocks() {
  lockControls.replaceChildren();
  state.chambers.forEach((chamber, lock) => {
    const card = document.createElement('article');
    card.className = 'lock-card';
    const heading = document.createElement('h3');
    heading.textContent = `Lock ${lock + 1}`;
    card.append(heading);
    const buttons = document.createElement('div');
    buttons.className = 'lock-buttons';
    const gateLow = control(`gate-${lock}-low`, 'Lower gate', () => order({ type: 'gate', lock, side: 'low' }), buttons);
    const gateHigh = control(`gate-${lock}-high`, 'Upper gate', () => order({ type: 'gate', lock, side: 'high' }), buttons);
    const drain = control(`water-${lock}-low`, 'Drain to lower reach', () => order({ type: 'water', lock, side: 'low' }), buttons);
    const fill = control(`water-${lock}-high`, 'Fill from upper reach', () => order({ type: 'water', lock, side: 'high' }), buttons);
    card.append(buttons);
    for (const [id, text] of [
      [`lower-state-${lock}`, `Lower gate: ${chamber.low ? 'open' : 'shut'}`],
      [`upper-state-${lock}`, `Upper gate: ${chamber.high ? 'open' : 'shut'}`],
      [`water-state-${lock}`, `Water level: ${chamber.water}`],
    ]) {
      const status = document.createElement('p');
      status.id = id;
      status.textContent = text;
      card.append(status);
    }
    for (const button of [gateLow, gateHigh, drain, fill]) button.disabled = state.won;
    lockControls.append(card);
  });
}
function renderCanal() {
  const svg = $('canal');
  const levelMax = Math.max(...state.reaches, ...state.chambers.map(c => c.water));
  const unit = levelMax > 2 ? 150 / levelMax : 70;
  const zoneWidth = 1000 / (state.reaches.length + state.chambers.length);
  const zones = [];
  for (let i = 0; i < state.reaches.length; i++) {
    zones.push({ type: 'reach', level: state.reaches[i] });
    if (i < state.chambers.length) zones.push({ type: 'chamber', level: state.chambers[i].water });
  }
  svg.replaceChildren();
  const add = (name, attrs, parent = svg) => {
    const el = document.createElementNS('http://www.w3.org/2000/svg', name);
    for (const [key, value] of Object.entries(attrs)) el.setAttribute(key, value);
    parent.append(el);
    return el;
  };
  add('rect', { x: 0, y: 300, width: 1000, height: 100, class: 'bank' });
  zones.forEach((zone, index) => {
    const x = index * zoneWidth;
    const y = 300 - unit * zone.level;
    add('rect', { x, y, width: zoneWidth, height: 400 - y, class: 'water' });
    add('line', { x1: x, y1: 300, x2: x + zoneWidth, y2: 300, stroke: '#183b43', 'stroke-width': 3, opacity: .35 });
    const name = zone.type === 'reach' ? `Reach ${Math.floor(index / 2) + 1}` : `Lock ${(index + 1) / 2}`;
    add('text', { x: x + zoneWidth / 2, y: 38, 'text-anchor': 'middle', 'font-size': 22, 'font-weight': 'bold', 'font-family': 'system-ui, sans-serif', fill: '#183b43', class: 'zone-label' }).textContent = name;
  });
  state.chambers.forEach((chamber, lock) => {
    const chamberX = (2 * lock + 1) * zoneWidth;
    const gate = (side, x, open) => {
      const waterY = 300 - unit * chamber.water;
      const boundaryY = Math.min(waterY, 300 - unit * (side === 'low' ? state.reaches[lock] : state.reaches[lock + 1]));
      add('line', { x1: x, y1: boundaryY - 8, x2: open ? x + (side === 'low' ? -38 : 38) : x, y2: boundaryY + (open ? 35 : 55), class: 'gate' });
    };
    gate('low', chamberX, chamber.low);
    gate('high', chamberX + zoneWidth, chamber.high);
  });
  const targetLevel = state.target % 2 === 0
    ? state.reaches[state.target / 2]
    : state.chambers[(state.target - 1) / 2].water;
  const targetCenter = (state.target + .5) * zoneWidth;
  const flagPoleX = Math.min(targetCenter + 45, 960);
  const waterY = 300 - unit * targetLevel;
  const flagTop = waterY - 75;
  const marker = add('g', { id: 'destination-marker', 'data-zone': state.target });
  add('line', { x1: flagPoleX, y1: flagTop, x2: flagPoleX, y2: waterY, stroke: '#183b43', 'stroke-width': 4 }, marker);
  add('path', { d: `M${flagPoleX} ${flagTop} h32 v22 Z`, fill: '#e56b54' }, marker);
  add('text', { id: 'destination-label', x: flagPoleX, y: flagTop - 10, 'text-anchor': 'middle', 'font-size': 20, 'font-family': 'system-ui, sans-serif', fill: '#183b43' }, marker).textContent = state.stops && state.stopIndex < state.stops.length - 1 ? 'Stop' : 'Home';
  const center = (state.boat + .5) * zoneWidth;
  const level = state.boat % 2 === 0 ? state.reaches[state.boat / 2] : state.chambers[(state.boat - 1) / 2].water;
  const base = 300 - unit * level;
  const boat = add('g', { class: 'boat', transform: `translate(${center - 58} ${base - 22})` });
  add('path', { d: 'M8 22 L108 22 L92 42 Q58 52 24 42 Z', class: 'hull' }, boat);
  add('rect', { x: 43, y: 2, width: 34, height: 20, rx: 3, class: 'cabin' }, boat);
  add('path', { d: 'M38 3 L82 3 L76 -5 L45 -5 Z', class: 'roof' }, boat);
}
render();
window.__locks = { state: () => structuredClone(state) };
