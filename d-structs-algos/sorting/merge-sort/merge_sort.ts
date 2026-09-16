function mergeSort(nums: number[]): number[] {
  if (nums.length < 2) {
    return nums;
  }
  const mid = Math.floor(nums.length / 2);
  const arr1 = nums.slice(0, mid);
  const arr2 = nums.slice(mid);
  const sortedLeft = mergeSort(arr1);
  const sortedRight = mergeSort(arr2);
  return merge(sortedLeft, sortedRight);
}

function merge(first: number[], second: number[]): number[] {
  let merged: number[] = [];
  let i = 0;
  let j = 0;
  while (i < first.length && j < second.length) {
    if (first[i] <= second[j]) {
      merged.push(first[i]);
      i += 1;
    } else {
      merged.push(second[j]);
      j += 1;
    }
  }
  if (i < first.length) {
    merged = merged.concat(first.slice(i));
  }
  if (j < second.length) {
    merged = merged.concat(second.slice(j));
  }
  return merged;
}

export { mergeSort, merge };
