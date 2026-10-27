export const noteColors = [
  { id: 'default', label: 'Sem cor', value: '#ffffff' },
  { id: 'yellow', label: 'Amarelo', value: '#fff7da' },
  { id: 'green', label: 'Verde', value: '#eaf5ed' },
  { id: 'blue', label: 'Azul', value: '#eaf2fa' },
  { id: 'pink', label: 'Rosa', value: '#fceef1' },
  { id: 'purple', label: 'Lilás', value: '#f2edfa' },
];
export const noteBackground = color => {
  const selected = noteColors.find(item => item.id === color) || noteColors[0];
  return `var(--note-color-${selected.id}, ${selected.value})`;
};
