function bubbleSort(nums: number[]): number[] {
  let swapping = true;
  let end = nums.length;
  while (swapping === true) {
    swapping = false;
    for (let i = 1; i < end; i++) {
      if (nums[i - 1] > nums[i]) {
        const higher = nums[i - 1];
        nums[i - 1] = nums[i];
        nums[i] = higher;
        swapping = true;
      }
    }
    end -= 1;
  }
  return nums;
}

export { bubbleSort };
