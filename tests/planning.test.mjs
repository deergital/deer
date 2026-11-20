import test from 'node:test';
import assert from 'node:assert/strict';
import {addDays,dateWindow,scheduledOn,progress} from '../src/lib/planning.mjs';
test('calendar windows cross months and leap-year boundaries',()=>{assert.equal(addDays('2028-02-28',2),'2028-03-01');const days=dateWindow('2026-12-28',7);assert.equal(days.length,7);assert.equal(days.at(-1),'2027-01-03');assert.equal(dateWindow('2026-11-20',30).at(-1),'2026-12-19');});
test('scheduled tasks include endpoints and single dates, excluding undated tasks',()=>{assert.equal(scheduledOn({start_date:'2026-11-20',due_date:'2026-11-22'},'2026-11-22'),true);assert.equal(scheduledOn({due_date:'2026-11-20'},'2026-11-20'),true);assert.equal(scheduledOn({},'2026-11-20'),false);assert.equal(scheduledOn({due_date:'2026-11-20'},'2026-11-21'),false);});
test('project progress handles empty projects and completed tasks',()=>{assert.equal(progress([]),0);assert.equal(progress([{status:'done'},{status:'todo'},{status:'in_review'}]),33);});
