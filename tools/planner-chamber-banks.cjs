const assert = require('node:assert/strict');
const {chromium} = require('playwright-core');
const rows = require('./planner-chamber-banks.json');
const mode = process.argv[2], url = process.argv[3];
const action = id => {const [type,part,side] = id.split('-'); return type === 'sail' ? {type,direction:part === 'forward' ? 1 : -1} : {type,lock:Number(part),side};};
(async () => {
  const {create,act} = await import('../site/engine.mjs');
  for (const row of rows) {
    let state = create(row.spec);
    assert.equal(state.boat % 2, 1);
    assert.equal(state.boat, row.spec.target);
    assert.equal(state.won, false);
    const ids = row.path.split(',');
    for (let k = 0; k < ids.length; k++) {
      const out = act(state, action(ids[k]));
      assert.equal(out.error, null, row.id + ':' + ids[k]);
      state = out.state;
      assert.equal(state.won, k === ids.length - 1);
      if (k + 1 === row.arrivalMoves) {
        assert.equal(state.boat, row.spec.start);
        assert.deepEqual(state.chambers.flatMap((c,i) => ['low','high'].filter(side => c[side]).map(side => `gate-${i}-${side}`)),row.arrivalOpen);
      }
    }
    assert.equal(state.moves,row.moves);
    assert.equal(state.fills,row.fills);
    assert.equal(state.fills,row.spec.budget);
    assert.equal(state.stopIndex,row.spec.stops.length-1);
    assert(state.chambers.every(c => !c.low && !c.high));
  }
  if (mode === 'facts') {console.log('high-water both-banks journey replays without a fill and with shut gates');return;}
  const row = rows.find(r => r.id === mode);
  assert(row,'Unknown contract mode');
  const {trips} = await import('../site/trips.mjs');
  assert.equal(trips.filter(t => t.id === row.id).length,1);
  assert.deepEqual(trips.find(t => t.id === row.id),{id:row.id,name:row.name,description:row.description,spec:row.spec});
  const browser = await chromium.launch();
  try {
    for (const width of [390,1280]) {
      const page = await browser.newPage({viewport:{width,height:900}});
      assert.equal((await page.goto(url)).status(),200);
      const click = id => page.locator('#'+id).click();
      const state = () => page.evaluate(() => __locks.state());
      await page.selectOption('#trip',row.id);
      assert.equal(await page.locator('#trip option[value="'+row.id+'"]').count(),1);
      assert.equal(await page.locator('#trip option[value="'+row.id+'"]').textContent(),row.name);
      assert.equal(await page.locator('#trip option[value="'+row.id+'"]').evaluate(e => e.parentElement.label),'Close up the canal');
      assert.equal(await page.textContent('#trip-description'),row.description);
      assert.equal((await state()).boat,row.spec.start);
      assert.equal((await state()).target,row.spec.stops[0]);
      assert.equal((await state()).stopIndex,0);
      assert.deepEqual((await state()).chambers.map(c => c.water),row.spec.water);
      const ids = row.path.split(',');
      for (let k = 0; k < ids.length; k++) {
        await click(ids[k]);
        const current = await state();
        assert.equal(current.moves,k+1);
        assert.equal(current.won,k === ids.length-1);
        if (k+1 === row.arrivalMoves) {
          assert.equal(current.boat,row.spec.start);
          assert.equal(await page.textContent('#status'),'Boat at the mooring. Close every gate.');
          assert(await page.locator('#sail-forward').isDisabled());
          assert(await page.locator('#sail-back').isDisabled());
          await click('show-hint');
          assert.deepEqual(await page.locator('.hint-next').evaluateAll(es => es.map(e => e.id)),row.arrivalOpen);
          await click('show-hint');
        }
      }
      const final = await state();
      assert.equal(final.fills,row.fills);
      assert.equal(final.stopIndex,2);
      assert(final.chambers.every(c => !c.low && !c.high));
      assert.equal(await page.textContent('#mooring-state'),'Every gate is shut.');
      await click('undo');
      assert.equal((await state()).won,false);
      const button = page.locator('#'+ids.at(-1));
      await button.scrollIntoViewIfNeeded();
      assert((await button.boundingBox()).height>=44);
      assert(await button.evaluate(e => {const r=e.getBoundingClientRect();return e.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));}));
      await button.focus();
      await page.keyboard.press('Enter');
      assert.equal((await state()).won,true);
      await click('restart');
      assert.equal((await state()).moves,0);
      assert.equal((await state()).boat,row.spec.start);
      assert.equal((await state()).stopIndex,0);
      assert.deepEqual((await state()).chambers.map(c => c.water),row.spec.water);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth>innerWidth),false);
      await page.close();
    }
    console.log(row.output);
  } finally {await browser.close();}
})().catch(error => {console.error(error);process.exitCode=1;});
