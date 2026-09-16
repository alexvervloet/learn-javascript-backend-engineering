import type { Queue } from "./custom_queue.js";

// A union type for the action rules out typos like "joined" at compile time,
// which is most of the value types add to a small function like this.
type Action = "join" | "leave";
type UserEvent = [name: string, action: Action];

function matchmake(queue: Queue<string>, user: UserEvent): string {
  const [name, action] = user;
  if (action === "leave") {
    queue.searchAndRemove(name);
  }
  if (action === "join") {
    queue.push(name);
  }
  if (queue.size() >= 4) {
    const user1 = queue.pop();
    const user2 = queue.pop();
    return `${user1} matched ${user2}!`;
  }
  return "No match found";
}

export { matchmake };
export type { Action, UserEvent };
