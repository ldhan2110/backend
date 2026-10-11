/** Hashing algorithm used to content-address stored files. */
export const HASH_ALGO = 'sha256';

/** Number of two-hex-char directory levels the hash shards into (e.g. ab/cd/<hash>). */
export const SHARD_DEPTH = 2;
