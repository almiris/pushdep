# PushDep

*PushDep* is a concurrent executor for hierarchical tasks (tasks that *depend* on other tasks). It can also be used as a message queue, a workflow engine or a process manager.

It has a learning curve of 5 minutes and is up and runnning as soon as you *npm-installed* it in your project.

The library targets small to mid size projects that may not want to use a database, or a distributed in-memory cache. Nevertheless, it works well with some of the databases supported by typeORM.

It is built using TypeScript and targets Node JS.

It implements an internal in-memory in-process store that can be used for single processor implementation use cases. For more complex use cases, *PushDep* implements a central SQL store supporting some of the SQL datasources supported by typeORM (as of today, this has only been tested with PostgreSQL).

## Installation

```bash
npm install @almiris/pushdep 
```

## Quickstart
The quickstart executes the tasks hierarchy described below.
```mermaid
graph TD
    A[Hard] -->|Text| B(Round)
    B --> C{Decision}
    C -->|One| D[Result 1]
    C -->|Two| E[Result 2]
```

```typescript 
it('It should execute a simple demo', async () => {
    const pushDep = new InMemoryPushDep();

    const executionPath = [];

    const workerFunction = async (worker: PushDepWorker, task: PushDepTask, pushDep: PushDep) => {
        executionPath.push(task.id);
        await pushDep.completeAsync(task);
    };

    const workerFoo = new PushDepWorker(pushDep, { kind: "foo", idleTimeoutMs: 100 }, workerFunction);
    workerFoo.startAsync();

    const workerBar = new PushDepWorker(pushDep, { kind: "bar", idleTimeoutMs: 100 }, workerFunction);
    workerBar.startAsync();

    await pushDep.pushAsync({ kind: "foo", id: "1" });
    await pushDep.pushAsync({ kind: "foo", id: "2" });
    await pushDep.pushAsync({ kind: "foo", id: "3" });
    await pushDep.pushAsync({ kind: "bar", id: "4", dependencyIds: ["1", "2"] });
    await pushDep.pushAsync({ kind: "bar", id: "5", dependencyIds: ["1", "3"]});
    await pushDep.pushAsync({ kind: "foo", id: "6", dependencyIds: ["4", "5"] });

    await sleep(1000);

    await workerFoo.stopAsync();
    await workerBar.stopAsync();

    expect(executionPath.join("")).toBe("123456");
    expect.assertions(1);
});
```

## In-memory PushDep

## SQL PushDep

## Workers

## Concurrency

## Task lifecycle
```mermaid
stateDiagram-v2
    [*] --> pending: push
    pending --> active: start
    active --> pending: return
    active --> completed: complete
    completed --> [*]
    active --> canceled: cancel
    canceled --> [*]
    active --> failed: fail
    failed --> [*]
```
### Task with dependencies
```mermaid 
stateDiagram-v2
    [*] --> task0: push
    [*] --> task1: push
    [*] --> task2: push
    task0: dependency 1
    task1: dependency 2
    task2: task
    state task0 {
        p0: pending
        a0: active
        co0: completed
        ca0: canceled
        f0: failed
        [*] --> p0
        p0 --> a0: start
        a0 --> co0: complete
        a0 --> ca0: cancel
        a0 --> f0: fail
        co0 --> [*]
        ca0 --> [*]
        f0 --> [*]
    }
    state task1 {
        p1: pending
        a1: active
        co1: completed
        ca1: canceled
        f1: failed
        [*] --> p1
        p1 --> a1: start
        a1 --> co1: complete
        a1 --> ca1: cancel
        a1 --> f1: fail
        co1 --> [*]
        ca1 --> [*]
        f1 --> [*]
    }
    state task2 {
        p2: pending
        a2: active
        co2: completed
        ca2: canceled
        f2: failed
        [*] --> p2
        p2 --> a2: start
        a2 --> co2: complete
        a2 --> ca2: cancel
        a2 --> f2: fail
        co2 --> [*]
        ca2 --> [*]
        f2 --> [*]
    }
    task0 --> task2
    task1 --> task2
    task2 --> [*]
```
## In-process deployment

## Multi-process deployment

