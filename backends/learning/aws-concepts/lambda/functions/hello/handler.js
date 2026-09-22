// NOTE: this file stays CommonJS JavaScript on purpose, and is the only
// place in the repo that does.
//
// It is not repo source — 01_deploy.ts zips it and uploads it to Lambda,
// where it runs under the nodejs22.x runtime. That runtime executes
// JavaScript, and the function's configured Handler is "handler.handler",
// which means a file literally named handler.js inside the zip. Converting
// it to TypeScript would need a bundling step before upload, which is a
// different lesson than the one this module is teaching.
// Node Lambda handler. Runtime nodejs22.x, configured handler "handler.handler".
exports.handler = async (event) => {
  const name = event.name ?? "world";
  return {
    statusCode: 200,
    body: JSON.stringify({ message: `Hello, ${name}!` }),
  };
};
