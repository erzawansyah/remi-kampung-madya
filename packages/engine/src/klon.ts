/** Salinan dalam. State hanya berisi data JSON, jadi ini sekaligus menjamin bisa diserialisasi. */
export function klon<T>(x: T): T {
  return JSON.parse(JSON.stringify(x)) as T;
}
