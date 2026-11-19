import {test} from 'node:test';import assert from 'node:assert/strict';
import {validateTask,validDate,dateLabel} from '../src/lib/domain.mjs';
const base={title:'Definir alcance',status:'todo',importance:'high'};
test('date validation handles leap years and impossible days',()=>{assert.equal(validDate('2024-02-29'),true);assert.equal(validDate('2026-02-29'),false);assert.equal(validDate('2026-13-01'),false);assert.equal(validDate('2026-11-20'),true);});
test('task validation preserves field-specific date errors',()=>{assert.deepEqual(validateTask(base),{});assert.ok(validateTask({...base,title:' '}).title);assert.ok(validateTask({...base,start_date:'2026-11-22',due_date:'2026-11-21'}).due_date);assert.ok(validateTask({...base,status:'fake'}).status);});
test('date labels do not parse day-only values in local midnight',()=>{assert.match(dateLabel('2026-11-20'),/20/);assert.equal(dateLabel(null),'Sin fecha');});
