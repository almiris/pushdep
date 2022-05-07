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
## In-process deployment
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

## Multi-process deployment
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
