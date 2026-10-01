/** A fresh seed for a new game's generator. */
export const newSeed = (): number => crypto.getRandomValues(new Uint32Array(1))[0];
