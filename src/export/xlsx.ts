export type WorkbookRow = {
  stations: string[];
  station: string;
  height: number | null;
  comment: string;
};

const encoder = new TextEncoder();

function esc(value: string): string {
  return value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

function xmlText(value: string): string {
  return `<is><t xml:space="preserve">${esc(value)}</t></is>`;
}

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function putU16(out: number[], value: number): void {
  out.push(value & 255, (value >>> 8) & 255);
}

function putU32(out: number[], value: number): void {
  out.push(value & 255, (value >>> 8) & 255, (value >>> 16) & 255, (value >>> 24) & 255);
}

function append(out: number[], bytes: Uint8Array): void {
  for (const byte of bytes) out.push(byte);
}

/** A small ZIP writer using stored entries, suitable for browser downloads. */
function zip(entries: Record<string, string>): Uint8Array {
  const local: number[] = [];
  const central: number[] = [];
  let offset = 0;
  for (const [name, text] of Object.entries(entries)) {
    const nameBytes = encoder.encode(name);
    const data = encoder.encode(text);
    const crc = crc32(data);
    putU32(local, 0x04034b50); putU16(local, 20); putU16(local, 0x800); putU16(local, 0);
    putU16(local, 0); putU16(local, 0); putU32(local, crc); putU32(local, data.length); putU32(local, data.length);
    putU16(local, nameBytes.length); putU16(local, 0); append(local, nameBytes); append(local, data);
    putU32(central, 0x02014b50); putU16(central, 20); putU16(central, 20); putU16(central, 0x800); putU16(central, 0);
    putU16(central, 0); putU16(central, 0); putU32(central, crc); putU32(central, data.length); putU32(central, data.length);
    putU16(central, nameBytes.length); putU16(central, 0); putU16(central, 0); putU16(central, 0); putU16(central, 0); putU32(central, 0); putU32(central, offset);
    append(central, nameBytes);
    offset = local.length;
  }
  const result: number[] = [...local, ...central];
  putU32(result, 0x06054b50); putU16(result, 0); putU16(result, 0); putU16(result, Object.keys(entries).length); putU16(result, Object.keys(entries).length);
  putU32(result, central.length); putU32(result, local.length); putU16(result, 0);
  return new Uint8Array(result);
}

function cell(ref: string, value: string, style = 1): string {
  return `<c r="${ref}" s="${style}" t="inlineStr">${xmlText(value)}</c>`;
}

function numberCell(ref: string, value: number): string {
  if (!Number.isFinite(value)) return `<c r="${ref}" s="2"/>`;
  return `<c r="${ref}" s="2"><v>${String(value)}</v></c>`;
}

function columnName(index: number): string {
  let name = '';
  for (let n = index + 1; n > 0; n = Math.floor((n - 1) / 26)) name = String.fromCharCode(65 + (n - 1) % 26) + name;
  return name;
}

function sheetXml(rows: WorkbookRow[], routeNames: string[]): string {
  const headers = ['測点名', ...routeNames, '高さ', 'コメント'];
  const heightCol = columnName(routeNames.length + 1), commentCol = columnName(routeNames.length + 2);
  const body: string[] = [];
  body.push('<row r="1" ht="60" customHeight="1">', ...headers.map((name, i) => cell(columnName(i) + '1', name, 3)), '</row>');
  rows.forEach((row, index) => {
    const r = index + 2;
    const height = Math.min(180, Math.max(24, row.comment.split(/\r?\n/).length * 18));
    body.push(`<row r="${r}" ht="${height}" customHeight="1">`, cell(`A${r}`, row.station),
      ...routeNames.map((_, i) => cell(`${columnName(i + 1)}${r}`, row.stations[i] ?? '')),
      row.height == null ? `<c r="${heightCol}${r}" s="2"/>` : numberCell(`${heightCol}${r}`, row.height),
      cell(`${commentCol}${r}`, row.comment), '</row>');
  });
  const last = Math.max(1, rows.length + 1);
  const cols = headers.map((_, i) => `<col min="${i + 1}" max="${i + 1}" width="${i === headers.length - 1 ? 60 : i === headers.length - 2 ? 14 : 28}" customWidth="1"/>`).join('');
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/><selection pane="bottomLeft" activeCell="A2" sqref="A2"/></sheetView></sheetViews><sheetFormatPr defaultRowHeight="18"/><cols>${cols}</cols><sheetData>${body.join('')}</sheetData><autoFilter ref="A1:${commentCol}${last}"/><legacyDrawing r:id="rId2"/></worksheet>`;
}
const stylesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="1"><numFmt numFmtId="164" formatCode="0.000"/></numFmts><fonts count="2"><font><sz val="12"/><name val="Meiryo"/><family val="2"/></font><font><b/><sz val="12"/><name val="Meiryo"/><family val="2"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border><border><left style="thin"/><right style="thin"/><top style="thin"/><bottom style="thin"/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="4"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="0" borderId="1" applyBorder="1" xfId="0"><alignment vertical="top" wrapText="1"/></xf><xf numFmtId="164" fontId="0" borderId="1" applyBorder="1" xfId="0"><alignment vertical="top" wrapText="1"/></xf><xf numFmtId="0" fontId="1" borderId="1" applyBorder="1" xfId="0"><alignment horizontal="center" vertical="center" wrapText="1"/></xf></cellXfs></styleSheet>`;

export async function createWorkbook(rows: WorkbookRow[], routeNames: string[], verticalReference?: string): Promise<Uint8Array> {
  const heightIndex = routeNames.length + 1;
  const note = `標高H、単位m${verticalReference ? `、標高基準: ${verticalReference}` : ''}`;
  const comments = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><comments xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><authors><author>測点サーチPro</author></authors><commentList><comment ref="${columnName(heightIndex)}1" authorId="0"><text><t>${esc(note)}</t></text></comment></commentList></comments>`;
  const vml = `<?xml version="1.0" encoding="UTF-8"?><xml xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel"><o:shapelayout v:ext="edit"><o:idmap v:ext="edit" data="1"/></o:shapelayout><v:shapetype id="_x0000_t202" coordsize="21600,21600" o:spt="202" path="m,l,21600r21600,l21600,xe"><v:stroke joinstyle="miter"/><v:path gradientshapeok="t" o:connecttype="rect"/></v:shapetype><v:shape id="_x0000_s1026" type="#_x0000_t202" style="position:absolute; margin-left:59.25pt;margin-top:1.5pt;width:108pt;height:59.25pt;z-index:1;visibility:hidden" fillcolor="#ffffe1" o:insetmode="auto"><v:fill color2="#ffffe1"/><v:shadow color="black" obscured="t"/><v:path o:connecttype="none"/><v:textbox style="mso-direction-alt:auto"/><x:ClientData ObjectType="Note"><x:MoveWithCells/><x:SizeWithCells/><x:Anchor>${heightIndex}, 0, 2, 0, ${heightIndex + 2}, 0, 6, 0</x:Anchor><x:AutoFill>False</x:AutoFill><x:Row>0</x:Row><x:Column>${heightIndex}</x:Column></x:ClientData></v:shape></xml>`;
  return zip({
    '[Content_Types].xml': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="vml" ContentType="application/vnd.openxmlformats-officedocument.vmlDrawing"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/><Override PartName="/xl/comments1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.comments+xml"/></Types>`,
    '_rels/.rels': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
    'xl/workbook.xml': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="測点一覧" sheetId="1" r:id="rId1"/></sheets></workbook>`,
    'xl/_rels/workbook.xml.rels': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`,
    'xl/worksheets/sheet1.xml': sheetXml(rows, routeNames),
    'xl/worksheets/_rels/sheet1.xml.rels': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/comments" Target="../comments1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/vmlDrawing" Target="../drawings/vmlDrawing1.vml"/></Relationships>`,
    'xl/styles.xml': stylesXml.replace('</cellXfs>', '</cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>'),
    'xl/comments1.xml': comments,
    'xl/drawings/vmlDrawing1.vml': vml,
  });
}
