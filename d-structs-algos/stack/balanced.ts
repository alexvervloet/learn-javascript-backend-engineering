import { Stack } from "./stack.js";

function isBalanced(inputStr: string): boolean {
  const stack = new Stack<string>();
  for (const char of inputStr) {
    if (char === "(") {
      stack.push(char);
    } else if (char === ")") {
      if (stack.pop() === null) {
        return false;
      }
    }
  }
  return stack.peek() === null;
}

export { isBalanced };
