import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { SpreadsheetFile, Workbook, FileBlob } from '@oai/artifact-tool';

const workDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(workDir, '../..');
const outputDir = path.join(root, 'outputs', '01a13ce9-5764-7a21-9407-956bbec1ab43');
await fs.mkdir(outputDir, { recursive: true });

function parseMarkdown(text) {
  let category = '';
  const rows = [];
  for (const line of text.split(/\r?\n/)) {
    if (line.startsWith('## ')) category = line.slice(3).trim();
    if (!/^\| [A-W]\d+ \|/.test(line)) continue;
    const cells = line.split(/(?<!\\)\|/).slice(1, -1).map(s => s.trim().replace(/\\\|/g, '|'));
    assert.equal(cells.length, 3);
    rows.push([cells[0], category, cells[1], cells[2]]);
  }
  assert.equal(new Set(rows.map(r => r[0])).size, rows.length);
  return rows;
}

function linesFor(text, maxChars) {
  let count = 1, used = 0;
  for (const word of text.split(/\s+/)) {
    if (used && used + word.length + 1 > maxChars) { count++; used = 0; }
    if (word.length > maxChars) { count += Math.floor(word.length / maxChars); used = word.length % maxChars; }
    else used += word.length + (used ? 1 : 0);
  }
  return count;
}

const configs = [
  { sheet: 'Partial Features', file: 'DTS-PARTIAL-FEATURES-2026-10-15.md', count: 170, table: 'PartialFeaturesTable', accent: '#9A6700' },
  { sheet: 'Missing Features', file: 'DTS-MISSING-FEATURES-2026-10-15.md', count: 122, table: 'MissingFeaturesTable', accent: '#A4262C' },
];
const workbook = Workbook.create();
const checks = [];

for (const config of configs) {
  const rows = parseMarkdown(await fs.readFile(path.join(root, config.file), 'utf8'));
  assert.equal(rows.length, config.count);
  const sheet = workbook.worksheets.add(config.sheet);
  sheet.showGridLines = false;
  sheet.tabColor = config.accent;
  const lastRow = rows.length + 6;
  const area = sheet.getRange(`A1:D${lastRow}`);
  area.format.font = { name: 'Arial', size: 10, color: '#202936' };
  area.format.verticalAlignment = 'center';
  sheet.getRange(`A1:A${lastRow}`).format.columnWidth = 8;
  sheet.getRange(`B1:B${lastRow}`).format.columnWidth = 36;
  sheet.getRange(`C1:C${lastRow}`).format.columnWidth = 65;
  sheet.getRange(`D1:D${lastRow}`).format.columnWidth = 96;

  sheet.getRange('A2').values = [[`DTS ${config.sheet.toLowerCase()}`]];
  sheet.getRange('A2').format.font = { name: 'Arial', size: 16, bold: true, color: '#172B4D' };
  sheet.getRange('A2:D2').format.rowHeight = 27;
  sheet.getRange('A2:D2').format.borders = { bottom: { style: 'thin', color: config.accent } };
  sheet.getRange('A3').values = [[`${rows.length} roadmap items. Repeated requirements retain their original IDs.`]];
  sheet.getRange('A3').format.font = { name: 'Arial', size: 10, italic: true, color: '#596579' };
  sheet.getRange('A3:D3').format.rowHeight = 23;
  sheet.getRange('A4').values = [[`Source: ${config.file}`]];
  sheet.getRange('A4').format.font = { name: 'Arial', size: 10, color: '#596579' };
  sheet.getRange('A4:D4').format.rowHeight = 21;
  sheet.getRange('A5:D5').format.rowHeight = 10;

  sheet.getRange(`A6:D${lastRow}`).values = [
    ['ID', 'Category', 'Roadmap requirement', 'Existing behavior / remaining gap'], ...rows
  ];
  const table = sheet.tables.add(`A6:D${lastRow}`, true, config.table);
  table.showFilterButton = true;
  sheet.getRange('A6:D6').format = {
    fill: '#243A55',
    font: { name: 'Arial', size: 10, bold: true, color: '#FFFFFF' },
    horizontalAlignment: 'center', verticalAlignment: 'center', wrapText: true,
    rowHeight: 31,
    borders: { insideVertical: { style: 'thin', color: '#FFFFFF' } },
  };
  sheet.getRange(`A7:D${lastRow}`).format.wrapText = true;
  sheet.getRange(`A7:D${lastRow}`).format.verticalAlignment = 'top';
  sheet.getRange(`A7:A${lastRow}`).format.font = { name: 'Arial', size: 10, bold: true, color: config.accent };

  let largestRow = 7, largestHeight = 0;
  rows.forEach((row, index) => {
    const excelRow = index + 7;
    const range = sheet.getRange(`A${excelRow}:D${excelRow}`);
    const lines = Math.max(linesFor(row[1], 32), linesFor(row[2], 59), linesFor(row[3], 86));
    const height = Math.max(37, lines * 15 + 10);
    range.format.rowHeight = height;
    range.format.fill = index % 2 === 0 ? '#FFFFFF' : '#F2F5F9';
    if (!index || row[1] !== rows[index - 1][1]) {
      range.format.borders = { top: { style: 'thin', color: '#AEBCCE' } };
    }
    if (height > largestHeight) { largestHeight = height; largestRow = excelRow; }
  });
  sheet.freezePanes.freezeRows(6);
  assert.deepEqual(sheet.getRange(`A7:D${lastRow}`).values, rows);
  checks.push({ ...config, lastRow, largestRow, rows });
}

workbook.recalculate();
for (const config of checks) {
  const inspected = await workbook.inspect({
    kind: 'table', range: `'${config.sheet}'!A6:D9`, include: 'values,formulas',
    tableMaxRows: 4, tableMaxCols: 4, tableMaxCellChars: 100, maxChars: 1300,
  });
  console.log(inspected.ndjson);
  const preview = await workbook.render({ sheetName: config.sheet, range: 'A1:D12', scale: 1.3, format: 'png' });
  await fs.writeFile(path.join(workDir, config.table + '-preview.png'), new Uint8Array(await preview.arrayBuffer()));
  const from = Math.max(7, config.largestRow - 1), to = Math.min(config.lastRow, config.largestRow + 1);
  const longPreview = await workbook.render({ sheetName: config.sheet, range: `A${from}:D${to}`, scale: 1.3, format: 'png' });
  await fs.writeFile(path.join(workDir, config.table + '-long-row.png'), new Uint8Array(await longPreview.arrayBuffer()));
}
const errors = await workbook.inspect({
  kind: 'match', searchTerm: '#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A|#NUM!|#NULL!|#SPILL!|#CALC!',
  options: { useRegex: true, maxResults: 20 }, maxChars: 1200,
});
console.log(errors.ndjson);

const outputPath = path.join(outputDir, 'DTS-Partial-and-Missing-Features.xlsx');
const output = await SpreadsheetFile.exportXlsx(workbook);
await output.save(outputPath);

const reopened = await SpreadsheetFile.importXlsx(await FileBlob.load(outputPath));
for (const config of checks) {
  const sheet = reopened.worksheets.getItem(config.sheet);
  assert.deepEqual(sheet.getRange(`A7:D${config.lastRow}`).values, config.rows);
  assert.equal(sheet.tables.items.length, 1);
}
console.log(JSON.stringify({ outputPath, worksheets: checks.map(c => ({ name: c.sheet, records: c.rows.length })), sourceAndExportValuesVerified: true }));
