import assert from 'node:assert/strict';
import { test } from 'node:test';
import { taskToday, addTaskDays, taskDateLabel } from '../frontend/src/utils/taskDates.js';

test('hoje respeita a meia-noite em São Paulo', () => {
  assert.equal(taskToday(new Date('2026-09-10T02:59:59Z')), '2026-09-09');
  assert.equal(taskToday(new Date('2026-09-10T03:00:00Z')), '2026-09-10');
});
test('atalhos atravessam meses, anos e fevereiro bissexto', () => {
  assert.equal(addTaskDays('2026-09-30', 1), '2026-10-01');
  assert.equal(addTaskDays('2026-12-28', 7), '2027-01-04');
  assert.equal(addTaskDays('2028-02-28', 1), '2028-02-29');
  assert.equal(addTaskDays('2026-02-28', 1), '2026-03-01');
});
test('datas exibem Hoje, Amanhã ou data sem deslocamento de fuso', () => {
  assert.equal(taskDateLabel(null, '2026-09-10'), 'Adicionar prazo');
  assert.equal(taskDateLabel('2026-09-10T00:00:00.000Z', '2026-09-10'), 'Hoje');
  assert.equal(taskDateLabel('2026-09-11', '2026-09-10'), 'Amanhã');
  assert.equal(taskDateLabel('2026-09-17', '2026-09-10'), '17/09/2026');
});
