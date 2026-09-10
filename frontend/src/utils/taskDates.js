export function taskToday(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}
export function addTaskDays(date, days) {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}
export function taskDateLabel(date, today = taskToday()) {
  const value = date?.slice(0, 10);
  if (!value) return 'Adicionar prazo';
  if (value === today) return 'Hoje';
  if (value === addTaskDays(today, 1)) return 'Amanhã';
  return new Date(`${value}T12:00:00Z`).toLocaleDateString('pt-BR', { timeZone: 'UTC' });
}
