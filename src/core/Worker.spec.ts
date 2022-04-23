import { InMemoryPushDep } from "src/core/InMemoryPushDep";
import { promisify } from "util";
import { PushDep, PushDepTask } from "./PushDep";
import { PushDepWorker, PushDepWorkerOptions } from "./Worker";

const sleep = promisify(setTimeout);

describe('Worker tests', () => {

  beforeEach(async () => {
  });

  it('It should work ;-)', async () => {
    const pushDep = new InMemoryPushDep();

    const consoleWorkerFunction = async (worker: PushDepWorker, task: PushDepTask, pushDep: PushDep) => {
      console.log(`worker ${worker.id} treating task ${task.id}`);
      await sleep(100);
      await pushDep.completeAsync(task);
    };

    const workerOptionsA = new PushDepWorkerOptions();
    workerOptionsA.kind = "a";
    
    const workerA = new PushDepWorker(pushDep, workerOptionsA, consoleWorkerFunction);
    workerA.startAsync();

    const workerOptionsB = new PushDepWorkerOptions();
    workerOptionsB.kind = "b";
    
    const workerB = new PushDepWorker(pushDep, workerOptionsB, consoleWorkerFunction);
    workerB.startAsync();

    await pushDep.pushAsync({ kind: "a", id: "1" });
    await pushDep.pushAsync({ kind: "a", id: "2" });
    await pushDep.pushAsync({ kind: "a", id: "3" });

    await sleep(1000);

    let count = await pushDep.countAsync("a");
    expect(count).toEqual({
      pending: 0,
      active: 0,
      completed: 3,
      canceled: 0,
      failed: 0,
      all: 3
    });

    await workerA.stopAsync();
    await workerB.stopAsync();

    expect.assertions(1);
  });

  it('It should execute a hierarchical job using multiple workers', async () => {
    const pushDep = new InMemoryPushDep();
    
    const consoleWorkerFunction = async (worker: PushDepWorker, task: PushDepTask, pushDep: PushDep) => {
      console.log(`worker ${worker.id} treating task ${task.id}`);
      await sleep(100);
      await pushDep.completeAsync(task);
    };

    const worker1 = new PushDepWorker(pushDep, {
      kind: "a",
      idleTimeoutMs: 100
    }, consoleWorkerFunction);
    worker1.startAsync();

    const worker2 = new PushDepWorker(pushDep, {
      kind: "a",
      idleTimeoutMs: 100
    }, consoleWorkerFunction);
    worker2.startAsync();

    const worker3 = new PushDepWorker(pushDep, {
      kind: "b",
      idleTimeoutMs: 100
    }, consoleWorkerFunction);
    worker3.startAsync();

    await pushDep.pushAsync({ kind: "a", id: "1" });
    await pushDep.pushAsync({ kind: "a", id: "2" });
    await pushDep.pushAsync({ kind: "a", id: "3" });
    await pushDep.pushAsync({ kind: "b", id: "4", dependencyIds: ["1", "2"] });
    await pushDep.pushAsync({ kind: "b", id: "5", dependencyIds: ["1", "3"]});
    await pushDep.pushAsync({ kind: "a", id: "6", dependencyIds: ["4", "5"] });

    await sleep(1000);

    let count = await pushDep.countAsync("a");
    console.log(count);
    expect(count).toEqual({
      pending: 0,
      active: 0,
      completed: 4,
      canceled: 0,
      failed: 0,
      all: 6
    });

    count = await pushDep.countAsync("b");
    console.log(count);
    expect(count).toEqual({
      pending: 0,
      active: 0,
      completed: 2,
      canceled: 0,
      failed: 0,
      all: 6
    });

    await worker1.stopAsync();
    await worker2.stopAsync();
    await worker3.stopAsync();

    expect.assertions(2);
  }, 10000);
});
