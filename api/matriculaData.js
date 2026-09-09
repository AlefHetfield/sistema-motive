// Store each distinct field once. Row references use fixed-width little-endian
// integers, so loading the dataset does not allocate 171,239 arrays of strings.
export function encodeMatriculaData({ records, ...metadata }) {
  const width = metadata.columns.length;
  const dictionaries = metadata.columns.map(() => []);
  const lookups = metadata.columns.map(() => new Map());
  const bytes = Buffer.alloc(records.length * width * 4);
  records.forEach((row, rowIndex) => {
    for (let column = 0; column < width; column++) {
      const value = String(row[column] ?? '');
      let id = lookups[column].get(value);
      if (id === undefined) {
        id = dictionaries[column].length;
        dictionaries[column].push(value);
        lookups[column].set(value, id);
      }
      bytes.writeUInt32LE(id, (rowIndex * width + column) * 4);
    }
  });
  return { ...metadata, version: 2, rowCount: records.length, dictionaries, rowData: bytes.toString('base64') };
}

export function decodeMatriculaData(dataset) {
  if (dataset.version !== 2 || dataset.columns?.length !== 10 || dataset.dictionaries?.length !== 10 ||
      !Number.isSafeInteger(dataset.rowCount) || dataset.rowCount < 0 || typeof dataset.rowData !== 'string' ||
      !dataset.dictionaries.every(values => Array.isArray(values) && values.every(value => typeof value === 'string'))) {
    throw new Error('Formato inválido da base de matrículas. Execute a importação novamente.');
  }
  const bytes = Buffer.from(dataset.rowData, 'base64');
  if (bytes.length !== dataset.rowCount * 10 * 4) throw new Error('Base de matrículas incompleta.');
  const rows = new Uint32Array(dataset.rowCount * 10);
  for (let index = 0; index < rows.length; index++) {
    const value = bytes.readUInt32LE(index * 4);
    if (value >= dataset.dictionaries[index % 10].length) throw new Error('Referência inválida na base de matrículas.');
    rows[index] = value;
  }
  return { rows, dictionaries: dataset.dictionaries, columns: dataset.columns, rowCount: dataset.rowCount };
}
