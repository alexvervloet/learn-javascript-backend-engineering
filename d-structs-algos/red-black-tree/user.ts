const USER_NAMES = [
  "Blake",
  "Ricky",
  "Shelley",
  "Dave",
  "George",
  "John",
  "James",
  "Mitch",
  "Williamson",
  "Burry",
  "Vennett",
  "Shipley",
  "Geller",
  "Rickert",
  "Carrell",
  "Baum",
  "Brownfield",
  "Lippmann",
  "Moses",
];

class User {
  id: number;
  userName: string;

  constructor(id: number) {
    this.id = id;
    this.userName = `${USER_NAMES[id % USER_NAMES.length]}#${id}`;
  }

  // Lets the tree compare users numerically by id (a < b, a > b).
  valueOf(): number {
    return this.id;
  }

  toString(): string {
    return this.userName;
  }
}

// Deterministic PRNG so test runs are reproducible (a seeded random source).
function mulberry32(seed: number): () => number {
  return function (): number {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function getUsers(num: number): User[] {
  const rng = mulberry32(1);
  const ids: number[] = [];
  for (let i = 0; i < num * 3; i++) {
    ids.push(i);
  }
  for (let i = ids.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [ids[i], ids[j]] = [ids[j], ids[i]];
  }
  return ids.slice(0, num).map((id) => new User(id));
}

export { User, getUsers };
