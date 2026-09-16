// Small helpers to package Lambda code into a zip buffer in memory.
// AWS Lambda always wants a zip; adm-zip builds one without touching disk.

import AdmZip from "adm-zip";

// Zip a file on disk under the archive name "handler.js".
function zipFile(path: string): Buffer {
  const zip = new AdmZip();
  zip.addLocalFile(path, "", "handler.js");
  return zip.toBuffer();
}

// Zip an in-memory string as "handler.js" (used for re-deploys / inline code).
function zipCode(code: string): Buffer {
  const zip = new AdmZip();
  zip.addFile("handler.js", Buffer.from(code));
  return zip.toBuffer();
}

export { zipFile, zipCode };
