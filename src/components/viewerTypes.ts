export type ENH = [number, number, number | null];
export type RouteView = { id: string; name: string; color: string; active?: boolean; points: ENH[] };
export type PinView = { id: string; routeId: string; position: ENH; selected?: boolean; label?: string };
export type CrossLine = ENH[];
export type ViewerCommonProps = {
  routes: RouteView[];
  pins?: PinView[];
  crossLines?: CrossLine[];
  projectionDefinition?: string;
  zone?: number;
  mapboxToken?: string;
  mode?: "select" | "add";
  fitRevision?: number;
  onSelectRoute?: (id: string) => void;
  onSelectPin?: (id: string) => void;
  onAddPinEN?: (position: [number, number]) => void;
  onMovePinEN?: (id: string, position: [number, number]) => void;
  onPinMoveStart?: () => void;
};
