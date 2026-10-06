import { create, act } from './engine.mjs?v=2';
import { trips } from './trips.mjs?v=89';

let selectedTrip = trips[0];
let state = create(selectedTrip.spec);
const history = [];
function finalArrival(state) {
  return state.finishClosed === true
    && state.boat === state.target
    && (!state.stops || state.stopIndex === state.stops.length - 1);
}
function pendingClosure(state) {
  return finalArrival(state) && !state.won;
}
function openGateCount(state) {
  return state.chambers.reduce((count, chamber) => count + Number(chamber.low) + Number(chamber.high), 0);
}
function firstOpenGate(state) {
  for (let lock = 0; lock < state.chambers.length; lock++) {
    if (state.chambers[lock].low) return `gate-${lock}-low`;
    if (state.chambers[lock].high) return `gate-${lock}-high`;
  }
  return null;
}
export function nextHintControl(state) {
  if (state.won) return null;
  if (pendingClosure(state)) return firstOpenGate(state);
  const direction = Math.sign(state.target - state.boat);
  const reach = state.boat % 2 === 0;
  const lock = reach
    ? direction === 1 ? state.boat / 2 : state.boat / 2 - 1
    : (state.boat - 1) / 2;
  const side = reach
    ? direction === 1 ? 'low' : 'high'
    : direction === 1 ? 'high' : 'low';
  const chamber = state.chambers[lock];
  const opposite = side === 'low' ? 'high' : 'low';
  const targetWater = state.reaches[lock + (side === 'high' ? 1 : 0)];
  if (chamber[side]) return direction === 1 ? 'sail-forward' : 'sail-back';
  if (chamber[opposite]) return `gate-${lock}-${opposite}`;
  if (chamber.water !== targetWater) {
    if (targetWater > chamber.water && state.budget !== null && state.fills >= state.budget) return null;
    return `water-${lock}-${side}`;
  }
  return `gate-${lock}-${side}`;
}

export function nextHint(state) {
  if (state.won) return 'Home. Try another trip.';
  if (pendingClosure(state)) {
    const id = firstOpenGate(state);
    const [, lock, side] = id.match(/^gate-(\d+)-(low|high)$/);
    return `Try Lock ${Number(lock) + 1}: ${side === 'low' ? 'Lower' : 'Upper'} gate.`;
  }
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
const lockJumps = $('lock-jumps');
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
const comparisonIds = ['cold-return', 'prepared-return', 'lower-ready', 'upper-ready'];
const comparisonBody = $('prepared-comparison').querySelector('tbody');
for (const id of comparisonIds) {
  const trip = trips.find(item => item.id === id);
  if (!trip) throw new Error(`Missing preparation trip: ${id}`);
  const row = document.createElement('tr');
  for (const text of [trip.name, trip.spec.water.join(' / '), String(trip.spec.budget)]) {
    const cell = document.createElement('td');
    cell.textContent = text;
    row.append(cell);
  }
  const actionCell = document.createElement('td');
  const start = document.createElement('button');
  start.type = 'button';
  start.dataset.trip = trip.id;
  start.textContent = 'Start';
  start.setAttribute('aria-label', `Start ${trip.name}`);
  start.addEventListener('click', () => {
    selectedTrip = trip;
    $('trip').value = trip.id;
    resetTrip();
  });
  actionCell.append(start);
  row.append(actionCell);
  comparisonBody.append(row);
}
const secureComparisonIds = ['secure-cold-return', 'secure-ready-return'];
const secureComparisonBody = $('secure-comparison').querySelector('tbody');
for (const id of secureComparisonIds) {
  const trip = trips.find(item => item.id === id);
  if (!trip) throw new Error(`Missing secure comparison trip: ${id}`);
  const row = document.createElement('tr');
  for (const text of [trip.name, trip.spec.water.join(' / '), String(trip.spec.budget)]) {
    const cell = document.createElement('td');
    cell.textContent = text;
    row.append(cell);
  }
  const actionCell = document.createElement('td');
  const start = document.createElement('button');
  start.type = 'button';
  start.dataset.trip = trip.id;
  start.textContent = 'Start';
  start.setAttribute('aria-label', `Start ${trip.name}`);
  start.addEventListener('click', () => {
    selectedTrip = trip;
    $('trip').value = trip.id;
    resetTrip();
  });
  actionCell.append(start);
  row.append(actionCell);
  secureComparisonBody.append(row);
}
$('restart').addEventListener('click', resetTrip);
function resetTrip() {
  state = create(selectedTrip.spec);
  history.length = 0;
  $('trip-name').textContent = selectedTrip.name;
  $('trip-description').textContent = selectedTrip.description;
  $('mooring-rule').hidden = selectedTrip.spec.finishClosed !== true;
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
  const itinerary = $('journey-itinerary');
  itinerary.hidden = !state.stops;
  const stopList = itinerary.querySelector('ol');
  stopList.replaceChildren();
  if (state.stops) {
    state.stops.forEach((stop, index) => {
      const item = document.createElement('li');
      item.textContent = stop % 2 === 0 ? `Reach ${stop / 2 + 1}` : `Lock ${(stop + 1) / 2}`;
      if (pendingClosure(state) || state.won || index < state.stopIndex) {
        item.className = 'visited';
      } else if (!state.won && index === state.stopIndex) {
        item.className = 'current';
        item.setAttribute('aria-current', 'step');
      }
      stopList.append(item);
    });
  }
  $('journey-stage').hidden = !state.stops;
  if (state.stops) {
    $('journey-stage').textContent = pendingClosure(state)
      ? 'All stops visited. Close every gate.'
      : state.won
        ? 'All stops visited.'
        : `Stop ${state.stopIndex + 1} of ${state.stops.length} · ${state.target % 2 === 0 ? `Reach ${state.target / 2 + 1}` : `Lock ${(state.target + 1) / 2}`}`;
  }
  $('water-budget').hidden = state.budget === null;
  if (state.budget !== null) $('water-budget').textContent = `Water tokens: ${state.budget - state.fills} / ${state.budget}`;
  $('status').textContent = state.won
    ? `Moored! You brought the boat home in ${state.moves} moves.`
    : pendingClosure(state)
      ? 'Boat at the mooring. Close every gate.'
      : state.boat % 2 === 0
        ? `Boat in reach ${state.boat / 2 + 1}.`
        : `Boat in lock ${(state.boat + 1) / 2}.`;
  $('moves-state').textContent = `Moves: ${state.moves}`;
  const mooringState = $('mooring-state');
  mooringState.hidden = state.finishClosed !== true;
  if (!mooringState.hidden) mooringState.textContent = state.won
    ? 'Every gate is shut.'
    : pendingClosure(state)
      ? `Open gates to close: ${openGateCount(state)}.`
      : 'Finish with every gate shut.';
  $('undo').disabled = history.length === 0;
  for (const button of [$('sail-forward'), $('sail-back')]) button.disabled = state.won || pendingClosure(state);
  renderLocks();
  renderLockJumps();
  renderCanal();
  updateHint();
}
function updateHint() {
  for (const marker of document.querySelectorAll('.hint-next')) {
    marker.classList.remove('hint-next');
    if (marker.getAttribute('aria-describedby') === 'hint') marker.removeAttribute('aria-describedby');
  }
  $('hint').textContent = nextHint(state);
  if (!hintVisible) return;
  const id = nextHintControl(state);
  const target = id && $(id);
  if (target) {
    target.classList.add('hint-next');
    target.setAttribute('aria-describedby', 'hint');
  }
}
function renderLockJumps() {
  lockJumps.replaceChildren();
  state.chambers.forEach((_, lock) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.id = `jump-lock-${lock}`;
    button.textContent = `Lock ${lock + 1}`;
    button.addEventListener('click', () => {
      const heading = $(`lock-heading-${lock}`);
      if (!heading) return;
      heading.scrollIntoView({ block: 'center', behavior: 'auto' });
      heading.focus({ preventScroll: true });
    });
    lockJumps.append(button);
  });
}
function renderLocks() {
  lockControls.replaceChildren();
  state.chambers.forEach((chamber, lock) => {
    const card = document.createElement('article');
    const occupied = state.boat === 2 * lock + 1;
    card.className = occupied ? 'lock-card boat-lock' : 'lock-card';
    const heading = document.createElement('h3');
    heading.id = `lock-heading-${lock}`;
    heading.tabIndex = -1;
    heading.textContent = `Lock ${lock + 1}`;
    card.append(heading);
    if (occupied) {
      const presence = document.createElement('p');
      presence.className = 'boat-presence';
      presence.textContent = 'Boat here';
      card.append(presence);
    }
    const ends = document.createElement('p');
    ends.id = `lock-ends-${lock}`;
    ends.className = 'lock-ends';
    ends.textContent = `Reach ${lock + 1}: level ${state.reaches[lock]} → Reach ${lock + 2}: level ${state.reaches[lock + 1]}`;
    card.append(ends);
    const lift = document.createElement('p');
    lift.id = `lift-size-${lock}`;
    lift.className = 'lift-size';
    lift.textContent = `Lift: ${state.reaches[lock + 1] - state.reaches[lock]} level steps.`;
    card.append(lift);
    const buttons = document.createElement('div');
    buttons.className = 'lock-buttons';
    const gateLow = control(`gate-${lock}-low`, 'Lower gate', () => order({ type: 'gate', lock, side: 'low' }), buttons);
    const gateHigh = control(`gate-${lock}-high`, 'Upper gate', () => order({ type: 'gate', lock, side: 'high' }), buttons);
    gateLow.setAttribute('aria-pressed', String(chamber.low));
    gateHigh.setAttribute('aria-pressed', String(chamber.high));
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
    gateLow.disabled = state.won || (pendingClosure(state) && !chamber.low);
    gateHigh.disabled = state.won || (pendingClosure(state) && !chamber.high);
    drain.disabled = state.won || pendingClosure(state);
    fill.disabled = state.won || pendingClosure(state);
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
    if (zone.type === 'reach') {
      add('text', { x: x + zoneWidth / 2, y: 65, 'text-anchor': 'middle', 'font-size': 20, 'font-family': 'system-ui, sans-serif', fill: '#183b43', class: 'reach-level' }).textContent = `Level ${zone.level}`;
    }
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
