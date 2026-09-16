function binarySearch(target: number, arr: number[]): boolean {
  let low = 0;
  let high = arr.length - 1;
  while (low <= high) {
    const median = Math.floor((low + high) / 2);
    if (arr[median] === target) {
      return true;
    } else if (arr[median] < target) {
      low = median + 1;
    } else {
      high = median - 1;
    }
  }
  return false;
}

export { binarySearch };
