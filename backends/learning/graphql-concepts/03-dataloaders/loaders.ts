/**
 * DataLoader implementations for section 03.
 *
 * The canonical JS DataLoader is the `dataloader` package (the same library and
 * author as the GraphQL reference implementation). A DataLoader:
 *   1. Collects all .load(key) calls made during one event-loop tick
 *   2. Calls the batch function ONCE with all collected keys
 *   3. Returns each result to its original caller
 *
 * This collapses N individual queries into 1 batch query.
 */

import DataLoader from "dataloader";
import * as db from "./data.js";
import type { Author } from "./data.js";

/**
 * The batch function. Contract (enforced by DataLoader):
 *   - Input:  array of keys, in any order
 *   - Output: a Promise of an array of values in THE SAME ORDER as the keys
 *             (null/Error for keys not found)
 * DataLoader matches results to callers by position, so order matters.
 */
// DataLoader hands the batch function a readonly array of keys and expects
// values back in the same order — that ordering contract is what the type
// signature pins down.
async function batchLoadAuthors(keys: readonly string[]): Promise<(Author | null)[]> {
  return db.getAuthorsByIds(keys);
}

/**
 * Create a FRESH DataLoader per request. Loaders must not be singletons: they
 * cache within their lifetime to avoid loading the same id twice, and that cache
 * must be cleared between requests so you never serve stale data.
 */
function makeAuthorLoader() {
  return new DataLoader(batchLoadAuthors);
}

export { batchLoadAuthors, makeAuthorLoader };
