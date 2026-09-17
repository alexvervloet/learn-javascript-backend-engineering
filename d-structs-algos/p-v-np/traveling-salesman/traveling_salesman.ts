// Cities are indexes into `paths`, so paths[a][b] is the distance from a to b.
type DistanceMatrix = number[][];

// A note on what this actually decides.
//
// The textbook travelling salesman problem asks for a *tour*: visit every city
// once and return to where you started. This solves the open variant — a
// Hamiltonian *path*, with no return leg — because that is what the test cases
// were built against. Both are NP-complete and the point of the module is the
// same either way: `tsp` searches n! orderings, while `verifyTsp` checks a
// proposed answer in O(n). Solving is hard, checking is easy.
//
// To make it a true tour, add the closing edge to both functions:
//     totalDist += paths[perm[perm.length - 1]][perm[0]];

// The hard direction: try every ordering until one comes in under `dist`.
// n! permutations, so 10 cities is 3.6M orderings and 15 is over a trillion.
function tsp(cities: number[], paths: DistanceMatrix, dist: number): boolean {
  const perms = permutations(cities);
  for (const perm of perms) {
    let totalDist = 0;
    for (let i = 0; i < perm.length - 1; i++) {
      totalDist += paths[perm[i]][perm[i + 1]];
    }
    if (totalDist <= dist) {
      return true;
    }
  }
  return false;
}

// The easy direction: given someone else's answer, add up the edges. One pass,
// no search. This asymmetry between finding and checking is what NP means.
function verifyTsp(paths: DistanceMatrix, dist: number, actualPath: number[]): boolean {
  let totalDist = 0;
  for (let i = 0; i < actualPath.length - 1; i++) {
    totalDist += paths[actualPath[i]][actualPath[i + 1]];
  }
  return totalDist <= dist;
}

function permutations(arr: number[]): number[][] {
  return helper([], [...arr], arr.length);
}

function helper(res: number[][], arr: number[], n: number): number[][] {
  if (n === 1) {
    res.push([...arr]);
  } else {
    for (let i = 0; i < n; i++) {
      helper(res, arr, n - 1);
      if (n % 2 === 1) {
        [arr[n - 1], arr[i]] = [arr[i], arr[n - 1]];
      } else {
        [arr[0], arr[n - 1]] = [arr[n - 1], arr[0]];
      }
    }
  }
  return res;
}

export { tsp, verifyTsp, permutations };
export type { DistanceMatrix };
