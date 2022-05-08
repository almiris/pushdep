# PushDep

*PushDep* is a concurrent executor for hierarchical tasks (tasks that *depend* on other tasks). It can also be used as a message queue, a workflow engine or a process manager.

It has a learning curve of 5 minutes and is up and runnning as soon as you *npm-installed* it in your project.

The library targets small to mid size projects that may not want to use a database, or a distributed in-memory cache. Nevertheless, it works well with some of the databases supported by typeORM or Sequelize.

It is built using TypeScript and targets Node JS.

It implements an internal in-memory in-process store that can be used for single process implementation use cases. For more complex use cases, *PushDep* uses a shared SQL storage supporting some of the SQL datasources supported by typeORM or Sequelize (as of today, this has only been tested with PostgreSQL).

## Installation

```bash
npm install @almiris/pushdep 
```

## Quickstart
This quickstart illustrates how to execute the following tasks hierarchy:

```mermaid
flowchart TB
    classDef subgraph_padding fill:none,stroke:none
    subgraph combining_models3["Simple demo"]
        subgraph pad [ ]
            direction BT
            task0 --- root(( ))
            task1 --- root(( ))
            task2 --- root(( ))
            task3 --- task0
            task3 --- task1
            task4 --- task0
            task4 --- task2
            task5 --- task3
            task5 --- task4
        end
    end
    class pad subgraph_padding
```

Below is a simple unit test using an *InMemoryPushDep* to execute the tasks. [Read the full documentation](https://github.com/almiris/pushdep/blob/master/doc/documentation.md) to see how you can store the tasks in a shared SQL storage using the *TypeORMPushDep* or the *SequelizePushDep*.

```typescript 
it('It should execute a simple demo', async () => {
    const pushDep = new InMemoryPushDep();

    await pushDep.setKindAsync({ id: "foo", concurrency: 3 });
    await pushDep.setKindAsync({ id: "bar", concurrency: 3 });

    let numberOfTasks = 6;
    const executionPath = [];

    // The worker functions is where your application treats the tasks
    const workerFunction = async (worker: PushDepWorker, task: PushDepTask, pushDep: PushDep) => {
        executionPath.push(task.args.step);
        await pushDep.completeAsync(task);
        numberOfTasks--;
    };

    // A worker that will treat tasks of kind "foo" using the "workerFunction" defined above
    const workerFoo = new PushDepWorker(pushDep, { kindId: "foo", idleTimeoutMs: 10 }, workerFunction);
    workerFoo.startAsync();

    const workerBar = new PushDepWorker(pushDep, { kindId: "bar", idleTimeoutMs: 10 }, workerFunction);
    workerBar.startAsync();

    // Pushing tasks and their dependencies to the pushDep
    const task0 = await pushDep.pushAsync({ kindId: "foo", args: { step: 0 } });
    const task1 = await pushDep.pushAsync({ kindId: "foo", args: { step: 1 } });
    const task2 = await pushDep.pushAsync({ kindId: "foo", args: { step: 2 } });
    const task3 = await pushDep.pushAsync({ kindId: "bar", args: { step: 3 }, dependencies: [task0, task1] };
    const task4 = await pushDep.pushAsync({ kindId: "bar", args: { step: 4 }, dependencies: [task0, task2] };
    const task5 = await pushDep.pushAsync({ kindId: "foo", args: { step: 5 }, dependencies: [task3, task4] };

    // We're waiting for all tasks to complete - Depending on the use case, your application will wait or not
    while (numberOfTasks) {
        await sleep(10);
    }

    // Asking the workers to stop - The worker lifecycle depends on the use cae
    await workerFoo.stopAsync();
    await workerBar.stopAsync();

    // Stopping the workers is a two step process - first, your application asks the worker to stop, then your application waits for the workers to really stop (the worker treating a task may only stop after treating the task)
    await workerFoo.waitForTerminationAsync();
    await workerBar.waitForTerminationAsync();

    expect(["012345", "013245"]).toContain(executionPath.join(""));
    expect.assertions(1);
});
```

## In-memory PushDep

## SQL PushDep

## Workers

## Concurrency

## Building the task dependency tree
```mermaid
flowchart TB
    classDef subgraph_padding fill:none,stroke:none
    subgraph single_with_dependencies["Multiple dependencies"]
        subgraph pad4 [ ]
            direction BT
            A43[A3] --> A41[A1] --- root4(( ))
            A43[A3] --> A42[A2] --- root4(( ))
        end
    end
    subgraph single_with_dependency["Single dependency"]
        subgraph pad3 [ ]
            direction BT
            A31[A2] --> A32[A1] --- root3(( ))
        end
    end
    subgraph multiple["Multiple tasks"]
        subgraph pad2 [ ]
            direction BT
            A21[A1] --- root2(( ))
            A22[A2] --- root2(( ))
            A23[A3] --- root2(( ))
        end
    end
    subgraph single["Single task"]
        subgraph pad1 [ ]
            direction BT
            A1[A] --- root1(( ))
        end
    end
    class pad4 subgraph_padding
    class pad3 subgraph_padding
    class pad2 subgraph_padding
    class pad1 subgraph_padding
```
```mermaid
flowchart TB
    classDef subgraph_padding fill:none,stroke:none
    subgraph combining_models3["Combination 3"]
        subgraph pad8 [ ]
            direction BT
            A84[A4] --- A81[A1] --- root8(( ))
            A86[A6] --- A84[A4] --- A82[A2] --- root8(( ))
            A86[A6] --- A85[A5] --- A81[A1]
            A85[A5] --- A83[A3] --- root8(( ))
        end
    end
    subgraph combining_models2["Combination 2"]
        subgraph pad7 [ ]
            direction BT
            A74[A4] --> A71[A1] --- root7(( ))
            A74[A4] --> A73[A3] --> A72[A2] --- root7(( ))
            A75[A5] --> A73[A3]
        end
    end
    subgraph combining_models1["Combination 1"]
        subgraph pad6 [ ]
            direction BT
            A63[A3] --> A61[A1] --- root6(( ))
            A64[A4] --> A63[A3] --> A62[A2] --- root6(( ))
        end
    end
    subgraph multiple_sharing_dependency["Dependency sharing"]
        subgraph pad5 [ ]
            direction BT
            A52[A2] --> A51[A1] --- root5(( ))
            A53[A3] --> A51[A1] --- root5(( ))
        end
    end
    class pad8 subgraph_padding
    class pad7 subgraph_padding
    class pad6 subgraph_padding
    class pad5 subgraph_padding
```

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
## In-memory per process deployment
```mermaid 
flowchart TB
    classDef subgraph_padding fill:none,stroke:none
    subgraph app1 [Application 1]
        direction LR
        subgraph space1 [ ]
        direction LR
            subgraph p1 [Process 1]
                direction LR
                f1[[Functions of the app]] --> |"push(task of kind A)"| pushdep1[[InMemoryPushDep]]
                f1[[Functions of the app]] --> |"push(task of kind B)"| pushdep1[[InMemoryPushDep]]
                pushdep1[[InMemoryPushDep]] --> |"start(task of kind A)"| wA1[[Workers for kind A]]
                wA1[[Workers for kind A]] --> |"complete | cancel | fail | return(task of kind A)"| pushdep1[[InMemoryPushDep]]
                pushdep1[[InMemoryPushDep]] --> |"start(task of kind B)"| wB1[[Workers for kind B]]
                wB1[[Workers for kind B]] --> |"complete | cancel | fail | return(task of kind B)"| pushdep1[[InMemoryPushDep]]
            end
        end
        subgraph p2 [Process 2]
            direction LR
            f2[[Functions of the app]] --> |"push(task of kind A)"| pushdep2[[InMemoryPushDep]]
            f2[[Functions of the app]] --> |"push(task of kind B)"| pushdep2[[InMemoryPushDep]]
            pushdep2[[InMemoryPushDep]] --> |"start(task of kind A)"| wA2[[Workers for kind A]]
            wA2[[Workers for kind A]] --> |"complete | cancel | fail | return(task of kind A)"| pushdep2[[InMemoryPushDep]]
            pushdep2[[InMemoryPushDep]] --> |"start(task of kind B)"| wB2[[Workers for kind B]]
            wB2[[Workers for kind B]] --> |"complete | cancel | fail | return(task of kind B)"| pushdep2[[InMemoryPushDep]]
        end
    end
    class space1 subgraph_padding
```

## Shared storage multi-process deployment
```mermaid 
flowchart LR
    classDef subgraph_padding fill:none,stroke:none
    subgraph app1 [Application 1]
        direction LR
        subgraph space1 [ ]
        direction LR
            subgraph p1 [Process 1]
                direction LR
                f1[[Functions of the app]] --> |"push(task of kind A)"| pushdep1[[PushDep]]
                f1[[Functions of the app]] --> |"push(task of kind B)"| pushdep1[[PushDep]]
                wA1[[Workers for kind A]]
            end
            subgraph p2 [Process 2]
                direction LR
                f2[[Functions of the app]] --> |"push(task of kind A)"| pushdep2[[PushDep]]
                f2[[Functions of the app]] --> |"push(task of kind B)"| pushdep2[[PushDep]]
                wA2[[Workers for kind A]]
            end
        end
    end
    subgraph app2 [Application 2]
        direction LR
        subgraph space2 [ ]
        direction LR
            subgraph p4 [Process 2]
            direction LR
                wB4[[Workers for kind B]]
            end
            subgraph p3 [Process 1]
            direction LR
                wB3[[Workers for kind B]]
            end
        end
    end
    pushdep1 --> |insert| DB[(Database)]
    pushdep2 --> |insert| DB[(Database)] 
    DB --> |"start(task of kind A)"|wA1
    wA1 --> |"complete | cancel | fail | return(task of kind A)"|DB
    DB --> |"start(task of kind A)"|wA2
    wA2 --> |"complete | cancel | fail | return(task of kind A)"|DB
    DB --> |"start(task of kind B)"|wB3
    wB3 --> |"complete | cancel | fail | return(task of kind B)"|DB
    DB --> |"start(task of kind B)"|wB4
    wB4 --> |"complete | cancel | fail | return(task of kind B)"|DB
    class space1 subgraph_padding
    class space2 subgraph_padding
```

## Class diagram
```mermaid
classDiagram
    direction TB
    PushDepTask --* PushDepTask: has dependencies
    %%InMemoryPushDep --* PushDepTask: has
    %%InMemoryPushDep --* PushDepKind: has
    PushDep <|.. InMemoryPushDep: implements
    PushDep <|.. TypeORMPushDep: implements
    PushDep <|.. SequelizePushDep: implements
    PushDep ..> PushDepKind: uses
    PushDep ..> PushDepTask: uses
    PushDep ..> PushDepTaskCount: uses
    PushDepWorker --* PushDep: has
    PushDepWorker --* PushDepWorkerOptions: has
    PushDepWorker ..> PushDepTask: uses
    PushDepWorker ..> PushDepKind: uses
    PushDepWorker ..> PushDepTaskCount: uses
    class PushDep {
        <<interface>>
        +setKindAsync(kind: PushDepKind)Promise~void~
        +getKindAsync(kindId: string)Promise~PushDepKind~
        +pushAsync(task: PushDepTask)Promise~PushDepTask~
        +countAsync(kindId?: string)Promise~PushDepTaskCount~
        +peekAsync(kindId: string)Promise~PushDepTask~
        +startAsync(kindId: string)Promise~PushDepTask~
        +completeAsync(task: PushDepTask)Promise~void~
        +cancelAsync(task: PushDepTask)Promise~void~
        +failAsync(task: PushDepTask)Promise~void~
        +returnAsync(task: PushDepTask)Promise~void~
    }
    class InMemoryPushDep {
        +setKind(kind: PushDepKind)~void~
        +getKind(kindId: string)~PushDepKind~
        +push(task: PushDepTask)~PushDepTask~
        +count(kindId?: string)~PushDepTaskCount~
        +peek(kindId: string)~PushDepTask~
        +start(kindId: string)~PushDepTask~
        +complete(task: PushDepTask)~void~
        +cancel(task: PushDepTask)~void~
        +fail(task: PushDepTask)~void~
        +return(task: PushDepTask)~void~
    }
    class TypeORMPushDep {
        +constructor(datasource: Datasource)
        +setKindAsync(kind: PushDepKind)Promise~void~
        +getKindAsync(kindId: string)Promise~PushDepKind~
        +pushAsync(task: PushDepTask)Promise~PushDepTask~
        +countAsync(kindId?: string)Promise~PushDepTaskCount~
        +peekAsync(kindId: string)Promise~PushDepTask~
        +startAsync(kindId: string)Promise~PushDepTask~
        +completeAsync(task: PushDepTask)Promise~void~
        +cancelAsync(task: PushDepTask)Promise~void~
        +failAsync(task: PushDepTask)Promise~void~
        +returnAsync(task: PushDepTask)Promise~void~
    } 
    class SequelizePushDep {
        +constructor(sequelize: Sequelize)
        +setKindAsync(kind: PushDepKind)Promise~void~
        +getKindAsync(kindId: string)Promise~PushDepKind~
        +pushAsync(task: PushDepTask)Promise~PushDepTask~
        +countAsync(kindId?: string)Promise~PushDepTaskCount~
        +peekAsync(kindId: string)Promise~PushDepTask~
        +startAsync(kindId: string)Promise~PushDepTask~
        +completeAsync(task: PushDepTask)Promise~void~
        +cancelAsync(task: PushDepTask)Promise~void~
        +failAsync(task: PushDepTask)Promise~void~
        +returnAsync(task: PushDepTask)Promise~void~
    }       
    class PushDepTask {
        <<interface>>
        +string readonly id?
        +string kindId
        +PushDepTask[] dependencies?
        +any args?
        +number priority?
        +any results?
    }
    class PushDepKind {
        <<interface>>
        +string id
        +number concurrency
    }
    class PushDepTaskCount {
        <<interface>>
        +number pending
        +number active
        +number completed
        +number canceled
        +number failed
        +number all
    }
    class PushDepWorkerOptions {
        +string kindId
        +number idleTimeoutMs
    }
    class PushDepWorker {
        +constructor(pushDep: PushDep, options: PushDepWorkerOptions, worker: PushDepWorkerFunction)
        +startAsync()Promise~void~
        +stopAsync()Promise~void~
        +waitForTerminationAsync()Promise~void~
    }
```
