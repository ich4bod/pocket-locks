export const trips = [
  {
    id: 'uphill',
    name: 'First hill',
    description: 'Lift the boat into the upper reach.',
    spec: { reaches: [0, 1], water: [0], start: 0, target: 2, budget: null },
  },
  {
    id: 'downhill',
    name: 'Downhill delivery',
    description: 'Let the water out and bring the boat down.',
    spec: { reaches: [0, 1], water: [1], start: 2, target: 0, budget: null },
  },
  {
    id: 'two-step',
    name: 'Two-step hill',
    description: 'Two chambers, two climbs. Close the gate behind you.',
    spec: { reaches: [0, 1, 2], water: [0, 1], start: 0, target: 4, budget: null },
  },
  {
    id: 'thirsty',
    name: 'Thirsty hill',
    description: 'Only two fills. An unnecessary refill spends water you will need later.',
    spec: { reaches: [0, 1, 2], water: [0, 1], start: 0, target: 4, budget: 2 },
  },
  {id:'chamber-home',name:'Chamber home',description:'Already inside the lock. Bring the boat back to the low reach without a fill.',spec:{reaches:[0,1],water:[1],start:1,target:0,budget:null}},
  {id:'long-descent',name:'Long descent',description:'Two locks downhill. Drain each chamber; this trip needs no fills.',spec:{reaches:[0,1,2],water:[1,2],start:4,target:0,budget:0}},
  {id:'ready-water',name:'Ready water',description:'Both chambers start full. Drain before entering, then climb with two fills.',spec:{reaches:[0,1,2],water:[1,2],start:0,target:4,budget:2}},
];
