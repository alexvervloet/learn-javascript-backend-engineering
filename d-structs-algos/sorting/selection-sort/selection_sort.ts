function selectionSort(nums: number[]): number[] {
  for (let i = 0; i < nums.length; i++) {
    let smallestIdx = i;
    for (let j = i + 1; j < nums.length; j++) {
      if (nums[j] < nums[smallestIdx]) {
        smallestIdx = j;
      }
    }
    [nums[i], nums[smallestIdx]] = [nums[smallestIdx], nums[i]];
  }
  return nums;
}

export { selectionSort };
