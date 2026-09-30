import { create, act } from './engine.mjs';

const original = { reaches: [0, 1], water: [0], start: 0, target: 2, budget: null };
let state = create(original);
const history = [];
const $ = id => document.getElementById(id);
const control = (id, label, action, parent) => {
  const button = document.createElement('button');
  button.id = id;
  button.textContent = label;
  button.addEventListener('click', action);
  parent.append(button);
  return button;
};
const lockControls = $('lock-controls');
const lowerButton = control('gate-0-low', 'Lower gate', () => order({ type: 'gate', lock: 0, side: 'low' }), lockControls);
const upperButton = control('gate-0-high', 'Upper gate', () => order({ type: 'gate', lock: 0, side: 'high' }), lockControls);
const drainButton = control('water-0-low', 'Drain to lower reach', () => order({ type: 'water', lock: 0, side: 'low' }), lockControls);
const fillButton = control('water-0-high', 'Fill from upper reach', () => order({ type: 'water', lock: 0, side: 'high' }), lockControls);
$('sail-forward').addEventListener('click', () => order({ type: 'sail', direction: 1 }));
$('sail-back').addEventListener('click', () => order({ type: 'sail', direction: -1 }));
$('undo').addEventListener('click', () => {
  if (!history.length) return;
  state = history.pop();
  render();
});
$('restart').addEventListener('click', () => {
  state = create(original);
  history.length = 0;
  $('status').textContent = 'Boat in reach 1.';
  render();
});
function order(action) {
  const result = act(state, action);
  if (result.error) {
    $('status').textContent = result.error;
    return;
  }
  history.push(state);
  state = result.state;
  render();
}
function render() {
  const chamber = state.chambers[0];
  $('status').textContent = state.won
    ? `Moored! You brought the boat home in ${state.moves} moves.`
    : state.boat % 2 === 0
      ? `Boat in reach ${state.boat / 2 + 1}.`
      : `Boat in lock ${(state.boat + 1) / 2}.`;
  $('lower-state').textContent = `Lower gate: ${chamber.low ? 'open' : 'shut'}`;
  $('upper-state').textContent = `Upper gate: ${chamber.high ? 'open' : 'shut'}`;
  $('water-state').textContent = `Water level: ${chamber.water}`;
  $('moves-state').textContent = `Moves: ${state.moves}`;
  $('undo').disabled = history.length === 0;
  for (const button of [lowerButton, upperButton, drainButton, fillButton, $('sail-forward'), $('sail-back')]) button.disabled = state.won;
  renderCanal();
}
function renderCanal() {
  const svg = $('canal');
  const zoneWidth = 1000 / 3;
  const zones = [
    { type: 'reach', level: state.reaches[0] },
    { type: 'chamber', level: state.chambers[0].water },
    { type: 'reach', level: state.reaches[1] },
  ];
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
    const y = 300 - 70 * zone.level;
    add('rect', { x, y, width: zoneWidth, height: 400 - y, class: 'water' });
    add('line', { x1: x, y1: 300, x2: x + zoneWidth, y2: 300, stroke: '#183b43', 'stroke-width': 3, opacity: .35 });
  });
  const chamberX = zoneWidth;
  const gate = (side, x, open) => {
    const waterY = 300 - 70 * state.chambers[0].water;
    const boundaryY = Math.min(waterY, 300 - 70 * (side === 'low' ? state.reaches[0] : state.reaches[1]));
    add('line', { x1: x, y1: boundaryY - 8, x2: open ? x + (side === 'low' ? -38 : 38) : x, y2: boundaryY + (open ? 35 : 55), class: 'gate' });
  };
  gate('low', chamberX, state.chambers[0].low);
  gate('high', chamberX + zoneWidth, state.chambers[0].high);
  const center = (state.boat + .5) * zoneWidth;
  const level = state.boat % 2 === 0 ? state.reaches[state.boat / 2] : state.chambers[(state.boat - 1) / 2].water;
  const base = 300 - 70 * level;
  const boat = add('g', { class: 'boat', transform: `translate(${center - 58} ${base - 22})` });
  add('path', { d: 'M8 22 L108 22 L92 42 Q58 52 24 42 Z', class: 'hull' }, boat);
  add('rect', { x: 43, y: 2, width: 34, height: 20, rx: 3, class: 'cabin' }, boat);
  add('path', { d: 'M38 3 L82 3 L76 -5 L45 -5 Z', class: 'roof' }, boat);
}
render();
window.__locks = { state: () => structuredClone(state) };
