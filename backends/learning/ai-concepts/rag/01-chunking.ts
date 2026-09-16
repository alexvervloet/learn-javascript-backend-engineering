/**
 * Chunking: split a document into overlapping pieces for retrieval.
 *
 * Run: `npx tsx 01-chunking.ts`  (no API calls — pure text handling)
 *
 * Before you can embed and retrieve a document, you cut it into chunks small enough
 * to be specific but large enough to be self-contained. Overlap carries a little
 * context across the boundary so a sentence split between two chunks still appears
 * whole in at least one of them.
 *
 * This is a simple character-based splitter. Real systems often split on sentence or
 * paragraph boundaries (or token counts), but the size/overlap trade-off is the same
 * idea everywhere.
 */

import { fileURLToPath } from "node:url";

const DOCUMENT =
  "Our return policy allows refunds within 30 days of purchase. " +
  "Items must be unused and in original packaging. " +
  "Refunds are issued to the original payment method within 5 business days. " +
  "Sale items are final and cannot be returned. " +
  "To start a return, email support@example.com with your order number.";

/**
 * Slide a window of `size` characters across the text, stepping by `size - overlap`
 * so consecutive chunks share `overlap` characters.
 */
function chunkText(text: string, size: number, overlap: number) {
  if (overlap >= size) throw new Error("overlap must be smaller than size");
  const step = size - overlap;
  const chunks = [];
  for (let i = 0; i < text.length; i += step) {
    const piece = text.slice(i, i + size);
    if (piece) chunks.push(piece);
  }
  return chunks;
}

function main() {
  const chunks = chunkText(DOCUMENT, 120, 30);
  console.log(`document length: ${DOCUMENT.length} chars`);
  console.log(`produced ${chunks.length} chunks (size=120, overlap=30):\n`);
  chunks.forEach((c, i) => console.log(`[${i}] ${JSON.stringify(c)}`));
  console.log("\nNote how the start of each chunk repeats the tail of the previous one —");
  console.log("that overlap is what keeps a boundary-straddling sentence retrievable.");
}

// ESM has no require.main === module. Comparing the script Node was handed
// against this module's own path is the equivalent.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}

export { chunkText };
