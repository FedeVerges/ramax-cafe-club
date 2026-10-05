// Historial de la instalación local anterior, identificado antes de su adaptación.
// Solo este historial completo puede convivir con las migraciones versionadas actuales.
export const LEGACY_LOCAL_HASHES = [
  "4a0cb1211cfcb82023769f329033ab8c0400fd9a3cc350a5b960ecfe757dde8d",
  "5aa0d75ddc1a8aa38021689cfc11bed57ba397a571f4e68b11a3924bbec7341c",
  "94ce0681b1591a0c0ced448308861f788f3155d6920739bc6189d7cbac8c5e96",
  "fa197d1daa4d4a47b6f9d150479414a6b4c620a1c2babd1bf67170b5b2dbc8f4",
  "fd0e734136c38ae1d614ad58aceaf35bfdfb84d3f17d97b7e1e534ae5b5146bb",
  "761658f6757407fff54735fe5881956cde63253091b601c18809b34107b2fb46",
  "eacaa75f495bac2f08318884fcf5c9cdfcc123cb31caddfa8e83d1def8e4b974",
];

export function matchesMigrationHistory(actual: string[], expected: string[]): boolean {
  const equal = (candidate: string[]) =>
    actual.length === candidate.length && actual.every((hash, i) => hash === candidate[i]);
  return equal(expected) ||
    (expected.length >= 3 && equal([
      ...expected.slice(0, 2),
      ...LEGACY_LOCAL_HASHES,
      ...expected.slice(2),
    ]));
}
