// ioredis-mock ships no type declarations. It aims to be a drop-in replacement
// for ioredis, so declaring its default export as an ioredis client constructor
// is both the smallest declaration that works and an accurate description of
// what the package promises.

declare module "ioredis-mock" {
  import type { Redis } from "ioredis";

  const RedisMock: new (...args: unknown[]) => Redis;
  export default RedisMock;
}
