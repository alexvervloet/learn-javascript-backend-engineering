function subsetSum(nums: number[], target: number): boolean {
  return findSubsetSum(nums, target, 0);
}

function findSubsetSum(nums: number[], target: number, index: number): boolean {
  if (target === 0) {
    return true;
  }
  if (index >= nums.length) {
    return false;
  }
  if (nums[index] > target) {
    return findSubsetSum(nums, target, index + 1);
  }
  return (
    findSubsetSum(nums, target - nums[index], index + 1) ||
    findSubsetSum(nums, target, index + 1)
  );
}

export { subsetSum, findSubsetSum };
