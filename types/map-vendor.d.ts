/**
 * Minimal local type declarations for the two map libraries (Thread 35).
 *
 * d3-geo and topojson-client ship without types, and only the six packages the
 * author approved were installed, so the @types packages were not added. These
 * cover exactly the functions components/MapPanel uses; widen them here if the
 * panel starts using more.
 */
declare module 'd3-geo' {
  type Pt = [number, number];
  export interface GeoProjection {
    (p: Pt): Pt | null;
    invert?(p: Pt): Pt | null;
    rotate(r: [number, number] | [number, number, number]): GeoProjection;
    scale(): number;
    scale(k: number): GeoProjection;
    translate(): Pt;
    translate(t: Pt): GeoProjection;
    fitExtent(extent: [Pt, Pt], object: unknown): GeoProjection;
  }
  export interface GeoPath {
    (object: unknown): string | null;
    bounds(object: unknown): [Pt, Pt];
  }
  export function geoNaturalEarth1(): GeoProjection;
  export function geoPath(projection?: GeoProjection): GeoPath;
  export function geoGraticule(): { step(s: Pt): { (): unknown } } & { (): unknown };
  export function geoInterpolate(a: Pt, b: Pt): (t: number) => Pt;
  export function geoCircle(): { center(c: Pt): { radius(r: number): { (): unknown } } };
}
declare module 'topojson-client' {
  export function feature(topology: unknown, object: unknown): unknown;
}
