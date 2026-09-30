export function create(spec) {
  const reaches = [...spec.reaches];
  const water = [...spec.water];
  return {
    reaches,
    chambers: water.map(level => ({ water: level, low: false, high: false })),
    boat: spec.start,
    start: spec.start,
    target: spec.target,
    moves: 0,
    fills: 0,
    budget: spec.budget,
    won: false,
  };
}

export function act(state, action) {
  const reject = error => ({ state, error });
  if (state.won) return reject('This trip is finished.');
  if (!action || typeof action !== 'object') return reject('Unknown order.');

  if (action.type === 'gate') {
    const { lock, side } = action;
    if (!Number.isInteger(lock) || lock < 0 || lock >= state.chambers.length || !['low', 'high'].includes(side)) {
      return reject('Unknown order.');
    }
    const chamber = state.chambers[lock];
    const opening = !chamber[side];
    if (opening) {
      const other = side === 'low' ? 'high' : 'low';
      if (chamber[other]) return reject('Close the other gate first.');
      const level = side === 'low' ? state.reaches[lock] : state.reaches[lock + 1];
      if (chamber.water !== level) return reject('Match water levels before opening this gate.');
    }
    const chambers = state.chambers.map((item, index) => index === lock
      ? { ...item, [side]: !item[side] }
      : { ...item });
    return succeed(state, { chambers });
  }

  if (action.type === 'water') {
    const { lock, side } = action;
    if (!Number.isInteger(lock) || lock < 0 || lock >= state.chambers.length || !['low', 'high'].includes(side)) {
      return reject('Unknown order.');
    }
    const chamber = state.chambers[lock];
    if (chamber.low || chamber.high) return reject('Close both gates before changing the water.');
    const level = side === 'low' ? state.reaches[lock] : state.reaches[lock + 1];
    if (chamber.water === level) return reject('The water is already at that level.');
    const chambers = state.chambers.map((item, index) => index === lock
      ? { ...item, water: level }
      : { ...item });
    return succeed(state, { chambers, fills: state.fills + (level > chamber.water ? 1 : 0) });
  }

  if (action.type === 'sail') {
    const { direction } = action;
    if (direction !== 1 && direction !== -1) return reject('Unknown order.');
    const next = state.boat + direction;
    const maxZone = state.chambers.length * 2;
    if (next < 0 || next > maxZone) return reject('The boat cannot sail that way.');

    let lock;
    let side;
    if (state.boat % 2 === 0) {
      lock = direction === 1 ? state.boat / 2 : state.boat / 2 - 1;
      side = direction === 1 ? 'low' : 'high';
    } else {
      lock = (state.boat - 1) / 2;
      side = direction === 1 ? 'high' : 'low';
    }
    if (!state.chambers[lock][side]) return reject('Open the gate ahead of the boat.');
    return succeed(state, { boat: next });
  }

  return reject('Unknown order.');
}

function succeed(state, changes) {
  const next = { ...state, ...changes, moves: state.moves + 1 };
  next.won = next.boat === next.target;
  return { state: next, error: null };
}
