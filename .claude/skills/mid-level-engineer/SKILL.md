---
name: mid-level-engineer
description: Write code the way a competent engineer with about two years of experience would — clean, readable, minimal abstraction, medium complexity. Use this skill whenever writing, refactoring, or reviewing application code in this repository, including implementing a ticket, adding an endpoint, writing a service or repository method, building a React component, or reviewing a diff. Apply it even when the request doesn't mention style, since the default tendency toward over-engineering is exactly what this skill exists to prevent.
---

# Mid-Level Engineer

Write like someone two years in: fluent enough to build the thing properly, not yet
tempted to build a framework around it.

## The test

Before finishing any piece of code, ask: **could a competent engineer read this once and
know exactly what it does?**

If understanding it requires jumping between four files, tracing a generic type, or
holding a layer of indirection in your head — it's too clever. Rewrite it flatter.

## Do

- **Write the obvious solution first.** Most problems here are genuinely simple. Solve
  them simply. A 20-line function that reads top to bottom beats four 5-line functions
  that don't.
- **Name things fully.** `estimatedHoursOnActiveTasks`, not `hrs` or `data` or `result`.
  A long clear name is free; a short cryptic one costs every future reader.
- **Keep functions doing one job**, but define "one job" generously. Extract when a chunk
  has a name and gets reused — not because a function crossed some line count.
- **Handle errors where they happen.** Throw a specific domain error at the point the rule
  is broken. Let the central handler map it to a status code.
- **Return early.** Guard clauses at the top, happy path unindented below. Avoid nested
  `if` pyramids.
- **Comment the _why_, never the _what_.** `// blocked tasks still count — they occupy the
person` is useful. `// loop through tasks` is noise.
- **Prefer explicit over dynamic.** A visible `switch` beats a lookup object built at
  runtime. A named parameter beats an options bag.
- **Use the language plainly.** `map`, `filter`, `find`, `async/await`. Reach for nothing
  more exotic than that unless the plain version genuinely fails.

## Don't

- **No abstraction with one implementation.** No interface for a single class. No factory
  producing one type. No strategy pattern with one strategy. If it's used once, inline it.
- **No premature generalisation.** Do not add a parameter, a config flag, or a hook for a
  case that doesn't exist yet. When that case arrives, change the code then.
- **No deep inheritance.** Composition, or just a plain function. Two levels is already
  suspicious.
- **No clever one-liners.** Nested ternaries, chained optional calls that hide a null path,
  reduce-with-an-accumulator-object where a `for` loop would be clear — all rewrite.
- **No barrel files or re-export layers** beyond what already exists. Import from the real
  path.
- **No utility grab-bags.** A `helpers.ts` accumulating unrelated functions is where code
  goes to become unfindable. Put the function next to what uses it.
- **No defensive programming against impossible states.** If validation upstream guarantees
  a value, don't re-check it three layers down. Trust the boundary.
- **No dependency you weren't asked for.** If the standard library or an existing package
  covers it, use that. Flag it and wait if you think a new one is genuinely needed.

## Complexity ceiling

Medium. Concretely:

|                             | Limit                                           |
| --------------------------- | ----------------------------------------------- |
| Function length             | ~40 lines. Longer needs a reason.               |
| Nesting depth               | 3 levels. Deeper means extract or return early. |
| Function parameters         | 4. More means pass an object.                   |
| Files touched per feature   | The layers it needs, no more.                   |
| New abstractions per ticket | Usually zero.                                   |

These are guides, not lint rules. A 50-line function that reads cleanly beats two that
don't.

## Examples

**Over-engineered — don't:**

```ts
interface IWorkloadStrategy {
	classify(u: number): WorkloadLevel;
}

class ThresholdWorkloadStrategy implements IWorkloadStrategy {
	constructor(private readonly thresholds: ReadonlyMap<WorkloadLevel, number>) {}
	classify(u: number): WorkloadLevel {
		return [...this.thresholds.entries()].sort(([, a], [, b]) => a - b).find(([, limit]) => u <= limit)?.[0] ?? WorkloadLevel.Overloaded;
	}
}
```

**Right:**

```ts
export function classifyWorkload(estimatedHours: number, capacityHours: number): Workload {
	const utilisation = (estimatedHours / capacityHours) * 100;

	if (utilisation <= WORKLOAD_AVAILABLE_MAX) return 'AVAILABLE';
	if (utilisation <= WORKLOAD_BALANCED_MAX) return 'BALANCED';
	return 'OVERLOADED';
}
```

Same behaviour. One file, no indirection, thresholds visible, trivially testable.

---

**Nested and defensive — don't:**

```ts
async function logTime(dto: LogTimeDto, caller: User) {
	if (dto) {
		if (dto.taskId) {
			const task = await this.taskRepo.findById(dto.taskId);
			if (task) {
				if (task.assigneeId === caller.id) {
					if (dto.hoursSpent > 0) {
						// ... the actual work, five levels deep
					}
				}
			}
		}
	}
}
```

**Right:**

```ts
async function logTime(dto: LogTimeDto, caller: User) {
	const task = await this.taskRepo.findById(dto.taskId);
	if (!task) throw new NotFoundError('Task not found');
	if (task.assigneeId !== caller.id) {
		throw new ForbiddenError('You can only log time against your own tasks');
	}

	await this.assertWithinDailyLimit(caller.id, dto.workDate, dto.hoursSpent);

	return this.timesheetRepo.create({ ...dto, employeeId: caller.id });
}
```

Guards first, happy path flat, each error saying what actually went wrong.

## React

Same principles, plus:

- Component does one thing. If it renders a list _and_ manages a form _and_ fetches data,
  split it.
- `useState` and `useEffect` cover almost everything here. No custom hook until the logic
  is genuinely reused in two places.
- No state management library. Props and local state are enough at this size.
- Fetch in the component that needs the data. No abstract data layer.
- Keep the JSX readable — pull complex conditionals into a named variable above the return
  rather than burying a ternary in the markup.

## When you're unsure

Pick the version you'd be comfortable explaining out loud in a code review. If the
explanation starts with "so the reason I did it this way is…" and runs more than a
sentence, take the simpler path.
