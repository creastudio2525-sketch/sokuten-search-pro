import { describe, expect, it } from 'vitest';
import { createWorkbook } from './xlsx';

const textDecoder = new TextDecoder();
function u16(bytes: Uint8Array, p: number): number { return bytes[p] | (bytes[p + 1] << 8); }
function u32(bytes: Uint8Array, p: number): number { return (bytes[p] | (bytes[p + 1] << 8) | (bytes[p + 2] << 16) | (bytes[p + 3] << 24)) >>> 0; }

// The exporter intentionally uses ZIP "store" entries, so tests inspect the emitted bytes directly.
function entries(bytes: Uint8Array): Map<string, string> {
  const result = new Map<string, string>();
  let p = 0;
  while (p + 30 <= bytes.length && u32(bytes, p) === 0x04034b50) {
    const nameLength = u16(bytes, p + 26); const extraLength = u16(bytes, p + 28); const size = u32(bytes, p + 18);
    const name = textDecoder.decode(bytes.subarray(p + 30, p + 30 + nameLength));
    const start = p + 30 + nameLength + extraLength;
    result.set(name, textDecoder.decode(bytes.subarray(start, start + size)));
    p = start + size;
  }
  return result;
}

describe('createWorkbook', () => {
  it('emits a valid Office Open XML package with the route columns followed by height and comment', async () => {
    const bytes = await createWorkbook([
      { stations: ['SP 10', 'SP 20'], station: 'No.1+0.000', height: 0, comment: '確認\n=SUM(1,1)' },
      { stations: ['SP 11', '交点なし'], station: '交点なし', height: -1.25, comment: '' },
      { stations: ['SP 12', 'SP 22'], station: '未確定（複数候補）', height: null, comment: '' },
    ], ['=危険路線', '市道'], 'T.P');
    expect(bytes[0]).toBe(0x50); expect(bytes[1]).toBe(0x4b);
    const files = entries(bytes);
    expect(files.has('[Content_Types].xml')).toBe(true);
    expect(files.get('xl/workbook.xml')).toContain('name="測点一覧"');
    const sheet = files.get('xl/worksheets/sheet1.xml')!;
    expect(sheet).toContain('A1'); expect(sheet).toContain('路線'); expect(sheet).toContain('B1'); expect(sheet).toContain('測点');
    expect(sheet).toContain('C1'); expect(sheet).toContain('市道'); expect(sheet).toContain('D1'); expect(sheet).toContain('高さ'); expect(sheet).toContain('E1'); expect(sheet).toContain('コメント');
    expect(sheet).toContain('state="frozen"'); expect(sheet).toContain('autoFilter ref="A1:E4"'); expect(sheet).toContain('t="inlineStr"');
    expect(sheet).toContain('<v>0</v>'); expect(sheet).toContain('<v>-1.25</v>'); expect(sheet).toContain('r="D4" s="2"/>');
    expect(sheet).toContain('=危険路線'); expect(sheet).toContain('=SUM(1,1)'); expect(sheet).not.toContain('<f>');
    expect(files.get('xl/styles.xml')).toContain('name val="Meiryo"');
    expect(files.get('xl/styles.xml')).toContain('<sz val="12"/>'); expect(files.get('xl/styles.xml')).toContain('formatCode="0.000"');
    expect(files.get('xl/comments1.xml')).toContain('標高H、単位m、標高基準: T.P'); expect(files.get('xl/comments1.xml')).toContain('ref="D1"'); expect(files.get('xl/drawings/vmlDrawing1.vml')).toContain('<x:Column>3</x:Column>');
    expect(files.get('xl/worksheets/_rels/sheet1.xml.rels')).toContain('comments');
  });

  it('preserves Japanese text, multiline comments and empty output range', async () => {
    const files = entries(await createWorkbook([], ['A路線']));
    expect(files.get('xl/worksheets/sheet1.xml')).toContain('autoFilter ref="A1:D1"');
    expect(files.get('xl/worksheets/sheet1.xml')).toContain('ht="60"');
  });
});

it('keeps route values aligned and moves trailing columns beyond Z', async () => {
  const routes = Array.from({length: 26}, (_, i) => '路線' + i);
  const files = entries(await createWorkbook([{station:'SP 100', stations:routes.map((_, i) => 'SP ' + i), height:12.3456, comment:'末尾'}], routes));
  const sheet = files.get('xl/worksheets/sheet1.xml')!;
  expect(sheet).toContain('r="AA2" s="1" t="inlineStr"><is><t xml:space="preserve">SP 25</t>');
  expect(sheet).toContain('r="AB2" s="2"><v>12.3456</v>');
  expect(sheet).toContain('r="AC2" s="1" t="inlineStr"><is><t xml:space="preserve">末尾</t>');
  expect(sheet).toContain('autoFilter ref="A1:AC2"');
  expect(files.get('xl/comments1.xml')).toContain('ref="AB1"');
});