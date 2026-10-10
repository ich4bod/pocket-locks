import { create, act } from './engine.mjs?v=3';
import { trips } from './trips.mjs?v=97';

let selectedTrip = trips[0];
let state = create(selectedTrip.spec);
const history = [];
let keptCanal = null;
function finalArrival(state) {
  return state.finishClosed === true
    && state.boat === state.target
    && (!state.stops || state.stopIndex === state.stops.length - 1);
}
function pendingClosure(state) {
  return finalArrival(state) && !state.won;
}
function pendingIntermediateMooring(state) {
  return state.closeAtStops === true
    && state.stops
    && state.stopIndex + 1 < state.stops.length
    && state.boat === state.target
    && state.chambers.some(chamber => chamber.low || chamber.high);
}
function pendingGateClosure(state) {
  return pendingClosure(state) || pendingIntermediateMooring(state);
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
  if (pendingGateClosure(state)) return firstOpenGate(state);
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
  if (pendingGateClosure(state)) {
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
const previewLockSelect = $('preview-lock');
const twoOrderLockSelect = $('two-order-lock');
const twoOrderFirstSelect = $('two-order-first');
const twoOrderSecondSelect = $('two-order-second');
const twoOrderThirdSelect = $('two-order-third');
let previewLock = 0;
let twoOrderLock = 0;
let twoOrderFirst = 'gate-low';
let twoOrderSecond = 'sail-forward';
let twoOrderThird = 'none';
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
$('undo-sail').addEventListener('click', () => {
  let index = -1;
  for (let i = 0; i < history.length; i++) {
    if (history[i].boat !== state.boat) index = i;
  }
  if (index === -1) return;
  state = history[index];
  history.splice(index);
  render();
});
$('trip').addEventListener('change', () => {
  selectedTrip = trips.find(trip => trip.id === $('trip').value);
  resetTrip();
});
const chamberComparisonFamilies = {
  banks: {
    ids: ['chamber-three-banks-low', 'chamber-three-banks-high'],
    copy: 'Lock 2 → Reach 3 → Reach 2 → Lock 2. Starting high lets you leave for Reach 3 without a fill. Shut every gate to finish.',
  },
  'three-first': {
    ids: ['chamber-three-first-low', 'chamber-three-first-high'],
    copy: 'Lock 1 → Reach 4 → Reach 1 → Lock 1. Compare the same round trip from low and high water. Shut every gate to finish.',
  },
  'three-middle': {
    ids: ['chamber-three-middle-low', 'chamber-three-middle-high'],
    copy: 'Lock 2 → Reach 1 → Reach 4 → Lock 2. Compare the same round trip from low and high water. Shut every gate to finish.',
  },
  'three-last': {
    ids: ['chamber-three-last-low', 'chamber-three-last-high'],
    copy: 'Lock 3 → Reach 2 → Reach 4 → Lock 3. Compare the same round trip from low and high water. Shut every gate to finish.',
  },
  'four-first': {
    ids: ['chamber-four-first-low', 'chamber-four-first-high'],
    copy: 'Lock 1 → Reach 5 → Reach 2 → Lock 1. Compare the same round trip from low and high water. Shut every gate to finish.',
  },
  'four-second': {
    ids: ['chamber-four-second-low', 'chamber-four-second-high'],
    copy: 'Lock 2 → Reach 4 → Reach 1 → Lock 2. Compare the same round trip from low and high water. Shut every gate to finish.',
  },
  'four-third': {
    ids: ['chamber-four-third-low', 'chamber-four-third-high'],
    copy: 'Lock 3 → Reach 1 → Reach 5 → Lock 3. Compare the same round trip from low and high water. Shut every gate to finish.',
  },
  'four-last': {
    ids: ['chamber-four-last-low', 'chamber-four-last-high'],
    copy: 'Lock 4 → Reach 3 → Reach 1 → Lock 4. Compare the same round trip from low and high water. Shut every gate to finish.',
  },
  zigzag: {
    ids: ['moor-zigzag-low', 'moor-zigzag-high'],
    copy: 'Lock 2 → Reach 4 → Reach 2 → Reach 3 → Lock 2. Starting water changes the first exit. Shut every gate at each stop.',
  },
  'upper-door': {
    ids: ['upper-door-low', 'upper-door-high'],
    copy: 'Lock 2 → Reach 3 → Lock 1 → Lock 2. Starting high saves the first fill; shut every gate at each stop.',
  },
};
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
const threeReturnComparisonIds = ['summit-three-return-low', 'mixed-three-middle', 'mixed-three-outer', 'summit-three-return-high'];
const threeReturnComparisonBody = $('three-return-comparison').querySelector('tbody');
for (const id of threeReturnComparisonIds) {
  const trip = trips.find(item => item.id === id);
  if (!trip) throw new Error(`Missing three-return comparison trip: ${id}`);
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
  threeReturnComparisonBody.append(row);
}
const fourReturnComparisonIds = ['summit-four-return-low', 'summit-four-return-high'];
const fourReturnComparisonBody = $('four-return-comparison').querySelector('tbody');
for (const id of fourReturnComparisonIds) {
  const trip = trips.find(item => item.id === id);
  if (!trip) throw new Error(`Missing four-return comparison trip: ${id}`);
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
  fourReturnComparisonBody.append(row);
}
const threeInspectionComparisonIds = ['summit-three-middle-low', 'summit-three-middle-high'];
const threeInspectionComparisonBody = $('three-inspection-comparison').querySelector('tbody');
for (const id of threeInspectionComparisonIds) {
  const trip = trips.find(item => item.id === id);
  if (!trip) throw new Error(`Missing three-inspection comparison trip: ${id}`);
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
  threeInspectionComparisonBody.append(row);
}
const fourInspectionComparisonIds = ['summit-four-middle-low', 'summit-four-middle-high'];
const fourInspectionComparisonBody = $('four-inspection-comparison').querySelector('tbody');
for (const id of fourInspectionComparisonIds) {
  const trip = trips.find(item => item.id === id);
  if (!trip) throw new Error(`Missing four-inspection comparison trip: ${id}`);
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
  fourInspectionComparisonBody.append(row);
}
function renderChamberComparison() {
  const key = $('chamber-route').value;
  const family = chamberComparisonFamilies[key];
  if (!family) throw new Error(`Missing chamber comparison family: ${key}`);
  $('chamber-route-copy').textContent = family.copy;
  const body = $('chamber-comparison').querySelector('tbody');
  const rows = family.ids.map(id => {
    const trip = trips.find(item => item.id === id);
    if (!trip) throw new Error(`Missing chamber comparison trip: ${id}`);
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
    return row;
  });
  body.replaceChildren(...rows);
}
$('chamber-route').addEventListener('change', renderChamberComparison);
renderChamberComparison();
previewLockSelect.addEventListener('change', () => {
  previewLock = Number(previewLockSelect.value);
  renderOrderPreview();
});
twoOrderLockSelect.addEventListener('change', () => {
  twoOrderLock = Number(twoOrderLockSelect.value);
  renderTwoOrderControls();
});
$('two-order-apply').addEventListener('click', () => {
  const evaluation = evaluateTwoOrders(state, twoOrderFirst, twoOrderSecond, twoOrderThird, twoOrderLock);
  renderTwoOrderResults(evaluation);
  if (evaluation.first.error || !evaluation.second || evaluation.second.error
    || (twoOrderThird !== 'none' && (!evaluation.third || evaluation.third.error))) return;
  history.push(state);
  state = evaluation.third?.state ?? evaluation.second.state;
  render();
});
twoOrderFirstSelect.addEventListener('change', () => {
  twoOrderFirst = twoOrderFirstSelect.value;
  renderTwoOrderControls();
});
twoOrderSecondSelect.addEventListener('change', () => {
  twoOrderSecond = twoOrderSecondSelect.value;
  renderTwoOrderControls();
});
twoOrderThirdSelect.addEventListener('change', () => {
  twoOrderThird = twoOrderThirdSelect.value;
  renderTwoOrderControls();
});
$('restart').addEventListener('click', resetTrip);
$('keep-canal').addEventListener('click', () => {
  keptCanal = {
    tripId: selectedTrip.id,
    tripName: selectedTrip.name,
    state: structuredClone(state),
  };
  renderCanalMemory();
});
$('forget-canal').addEventListener('click', () => {
  if (keptCanal === null) return;
  keptCanal = null;
  renderCanalMemory();
});
$('return-canal').addEventListener('click', () => {
  if (!canReturnCanal()) return;
  history.push(structuredClone(state));
  state = structuredClone(keptCanal.state);
  render();
});
function canReturnCanal() {
  return keptCanal !== null
    && keptCanal.tripId === selectedTrip.id
    && JSON.stringify(keptCanal.state) !== JSON.stringify(state);
}
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
  $('intermediate-mooring-note').hidden = !pendingIntermediateMooring(state);
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
  $('undo-sail').disabled = !history.some(snapshot => snapshot.boat !== state.boat);
  for (const button of [$('sail-forward'), $('sail-back')]) button.disabled = state.won || pendingGateClosure(state);
  renderLocks();
  renderLockJumps();
  renderOrderPreview();
  renderTwoOrderControls();
  renderCanal();
  renderCanalMemory();
  updateHint();
}
function renderCanalMemory() {
  const info = $('canal-kept-info');
  const note = $('canal-comparison-note');
  const table = $('canal-memory-table');
  const forget = $('forget-canal');
  const returnCanal = $('return-canal');
  forget.disabled = keptCanal === null;
  returnCanal.disabled = !canReturnCanal();
  if (keptCanal === null) {
    info.textContent = 'No canal arrangement kept.';
    note.textContent = 'Keep one arrangement to compare.';
    table.hidden = true;
    table.querySelector('tbody').replaceChildren();
    return;
  }
  const keptState = keptCanal.state;
  const boatZone = keptState.boat % 2 === 0
    ? `Reach ${keptState.boat / 2 + 1}`
    : `Lock ${(keptState.boat + 1) / 2}`;
  info.textContent = `Kept ${keptCanal.tripName} · boat in ${boatZone} · moves ${keptState.moves} · fills ${keptState.fills}.`;
  if (keptCanal.tripId !== selectedTrip.id) {
    note.textContent = 'Kept from another trip. Choose that trip to compare.';
    table.hidden = true;
    table.querySelector('tbody').replaceChildren();
    return;
  }
  note.textContent = 'The kept gates and water stay put while you try another order.';
  table.hidden = false;
  const body = table.querySelector('tbody');
  const rows = state.chambers.map((chamber, lock) => {
    const keptChamber = keptState.chambers[lock];
    const cellText = item => `Water ${item.water} · lower ${item.low ? 'open' : 'shut'} · upper ${item.high ? 'open' : 'shut'}`;
    const row = document.createElement('tr');
    for (const text of [`Lock ${lock + 1}`, cellText(chamber), cellText(keptChamber)]) {
      const cell = document.createElement('td');
      cell.textContent = text;
      row.append(cell);
    }
    return row;
  });
  body.replaceChildren(...rows);
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
    gateLow.disabled = state.won || (pendingGateClosure(state) && !chamber.low);
    gateHigh.disabled = state.won || (pendingGateClosure(state) && !chamber.high);
    drain.disabled = state.won || pendingGateClosure(state);
    fill.disabled = state.won || pendingGateClosure(state);
    lockControls.append(card);
  });
}
function renderOrderPreview() {
  if (previewLock < 0 || previewLock >= state.chambers.length) previewLock = 0;
  const options = state.chambers.map((_, lock) => {
    const option = document.createElement('option');
    option.value = String(lock);
    option.textContent = `Lock ${lock + 1}`;
    option.selected = lock === previewLock;
    return option;
  });
  previewLockSelect.replaceChildren(...options);
  const body = $('lock-preview').querySelector('tbody');
  const orders = [
    { type: 'gate', side: 'low', label: 'Lower gate' },
    { type: 'gate', side: 'high', label: 'Upper gate' },
    { type: 'water', side: 'low', label: 'Drain to lower reach' },
    { type: 'water', side: 'high', label: 'Fill from upper reach' },
  ];
  const rows = orders.map((spec, index) => {
    const action = { type: spec.type, lock: previewLock, side: spec.side };
    const result = act(state, action);
    const message = result.error ?? (spec.type === 'gate'
      ? `${spec.side === 'low' ? 'Lower' : 'Upper'} gate ${result.state.chambers[previewLock][spec.side] ? 'open' : 'shut'}.`
      : `Water level: ${result.state.chambers[previewLock].water}. Fill tokens used: ${result.state.fills - state.fills}.`);
    const row = document.createElement('tr');
    for (const text of [spec.label, message]) {
      const cell = document.createElement('td');
      cell.textContent = text;
      row.append(cell);
    }
    const actionCell = document.createElement('td');
    const button = document.createElement('button');
    button.type = 'button';
    button.id = `preview-try-${index}`;
    button.textContent = 'Try';
    button.setAttribute('aria-label', `Try ${spec.label}`);
    button.disabled = Boolean(result.error);
    button.addEventListener('click', () => order({ ...action }));
    actionCell.append(button);
    row.append(actionCell);
    return row;
  });
  body.replaceChildren(...rows);
}
function renderTwoOrderControls() {
  if (twoOrderLock < 0 || twoOrderLock >= state.chambers.length) twoOrderLock = 0;
  const options = state.chambers.map((_, lock) => {
    const option = document.createElement('option');
    option.value = String(lock);
    option.textContent = `Lock ${lock + 1}`;
    option.selected = lock === twoOrderLock;
    return option;
  });
  twoOrderLockSelect.replaceChildren(...options);
  twoOrderLockSelect.value = String(twoOrderLock);
  twoOrderFirstSelect.value = twoOrderFirst;
  twoOrderSecondSelect.value = twoOrderSecond;
  twoOrderThirdSelect.value = twoOrderThird;
  renderTwoOrderResults(evaluateTwoOrders(state, twoOrderFirst, twoOrderSecond, twoOrderThird, twoOrderLock));
}
function twoOrderAction(value, lock) {
  if (value === 'gate-low') return { type: 'gate', lock, side: 'low' };
  if (value === 'gate-high') return { type: 'gate', lock, side: 'high' };
  if (value === 'water-low') return { type: 'water', lock, side: 'low' };
  if (value === 'water-high') return { type: 'water', lock, side: 'high' };
  if (value === 'sail-forward') return { type: 'sail', direction: 1 };
  if (value === 'sail-back') return { type: 'sail', direction: -1 };
  return { type: 'unknown' };
}
function evaluateTwoOrders(source, firstValue, secondValue, thirdValue, lock) {
  const first = act(source, twoOrderAction(firstValue, lock));
  const second = first.error ? null : act(first.state, twoOrderAction(secondValue, lock));
  const third = thirdValue === 'none' || !second || second.error
    ? null
    : act(second.state, twoOrderAction(thirdValue, lock));
  return { first, second, third };
}
function renderTwoOrderResults(evaluation) {
  $('two-order-first-result').textContent = evaluation.first.error
    ? `First order: ${evaluation.first.error}`
    : 'First order: accepted.';
  $('two-order-second-result').textContent = evaluation.first.error
    ? 'Second order: not tried because the first was rejected.'
    : evaluation.second.error
      ? `Second order: ${evaluation.second.error}`
      : 'Second order: accepted.';
  $('two-order-third-result').textContent = twoOrderThird === 'none'
    ? 'Third order: not chosen.'
    : evaluation.first.error || evaluation.second?.error
      ? 'Third order: not tried because an earlier order was rejected.'
      : evaluation.third.error
        ? `Third order: ${evaluation.third.error}`
        : 'Third order: accepted.';
  $('two-order-apply').textContent = twoOrderThird === 'none' ? 'Do both orders' : 'Do all three orders';
  $('two-order-apply').disabled = Boolean(evaluation.first.error || !evaluation.second || evaluation.second.error
    || (twoOrderThird !== 'none' && (!evaluation.third || evaluation.third.error)));
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
  const flagTop = Math.max(125, waterY - 75);
  const marker = add('g', { id: 'destination-marker', 'data-zone': state.target });
  add('line', { x1: flagPoleX, y1: flagTop, x2: flagPoleX, y2: waterY, stroke: '#183b43', 'stroke-width': 4 }, marker);
  add('path', { d: `M${flagPoleX} ${flagTop} h32 v22 Z`, fill: '#e56b54' }, marker);
  add('text', { id: 'destination-label', x: flagPoleX, y: 105, 'text-anchor': 'middle', 'font-size': 20, 'font-family': 'system-ui, sans-serif', fill: '#183b43' }, marker).textContent = state.stops && state.stopIndex < state.stops.length - 1 ? 'Stop' : 'Home';
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
