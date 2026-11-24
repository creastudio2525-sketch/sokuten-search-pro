import type {Route} from './core';

export const MAX_XML_FILES = 10;
export function importedFileCount(routes: Route[]): number {
  return new Set(routes.map(r => r.sourceId ? `id:${r.sourceId}` : `legacy:${r.fileName}`)).size;
}

/** Names are not identities: separate folders commonly contain Land.xml. */
export async function prepareImportedRoutes(existing: Route[], parsed: Route[], text: string): Promise<Route[]> {
  if (!parsed.length) throw Error('路線の入ったLand.XMLを入力してください');
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  const sourceHash = Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
  if (existing.some(r => r.sourceHash === sourceHash)) throw Error('同じ内容のLandXMLを取り込み済みです');
  if (importedFileCount(existing) >= MAX_XML_FILES) throw Error('LandXMLは合計10個まで取り込めます。不要なファイルの路線を削除してから追加してください');
  const sourceId = crypto.randomUUID();
  return parsed.map(r => ({...r, id: crypto.randomUUID(), sourceId, sourceHash}));
}
