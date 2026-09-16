// Cities are indexes into `paths`, so paths[a][b] is the distance from a to b.
type DistanceMatrix = number[][];

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
