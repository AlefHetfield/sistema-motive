export const PROPERTY_STATUSES = ['Disponível', 'Reservado', 'Vendido', 'Indisponível', 'Confirmar disponibilidade'];

export const PROPERTY_STATUS_COLORS = {
  'Disponível': '#0ea5e9',
  'Reservado': '#f59e0b',
  'Vendido': '#16a34a',
  'Indisponível': '#64748b',
  'Confirmar disponibilidade': '#e11d48',
};

const normalizeCity = value => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .trim()
  .toLocaleLowerCase('pt-BR');

const PROPERTY_CITY_COLORS = {
  sumare: '#0288d1',
  'nova odessa': '#9c27b0',
  hortolandia: '#ffea00',
  americana: '#0f9d58',
  paulinia: '#757575',
  campinas: '#000000',
  'monte mor': '#ff5252',
};

export const PROPERTY_CITY_PRIORITY = ['Sumaré', 'Nova Odessa', 'Hortolândia', 'Americana', 'Paulínia', 'Campinas', 'Monte Mor'];
export const DEFAULT_PROPERTY_CITY_COLOR = '#757575';
export const propertyCityColor = city => PROPERTY_CITY_COLORS[normalizeCity(city)] || DEFAULT_PROPERTY_CITY_COLOR;
