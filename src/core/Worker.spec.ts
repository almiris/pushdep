// npx jest --testPathPattern Worker.spec --pushDepClass=InMemoryPushDep
// npx jest --testPathPattern Worker.spec --pushDepClass=TypeORMPushDep
// npx jest --testPathPattern Worker.spec --pushDepClass=SequelizePushDep
import "dotenv/config";
import { promisify } from "util";
import { afterAllAsync, beforeAllAsync, beforeEachAsync, pushDep, TESTED_PUSHDEPS } from "./commons.spec";
import { PushDep, PushDepTask } from "./PushDep";
import { PushDepWorker, PushDepWorkerOptions, PushDepWorkerRunningMode } from "./Worker";

const sleep = promisify(setTimeout);

describe.each(TESTED_PUSHDEPS)('Worker tests using $pushDepClass pushDep', ({ pushDepClass }) => {

    beforeAll(async () => /* await */ beforeAllAsync(pushDepClass));

    afterAll(async () => /* await */ afterAllAsync(pushDepClass));

    beforeEach(async () => /* await */ beforeEachAsync(pushDepClass));

    it('It should work ;-)', async () => {
        let numberOfTasks = 3;
        const consoleWorkerDelegateFunction = async (worker: PushDepWorker, task: PushDepTask, pushDep: PushDep) => {
            console.log(`worker ${worker.id} treating task ${task.id}`);
            await sleep(100);
            await pushDep.completeAsync(task);
            numberOfTasks--;
        };

        const workerOptionsA = new PushDepWorkerOptions();
        workerOptionsA.kindId = "a";

        const workerA = new PushDepWorker(pushDep, workerOptionsA, consoleWorkerDelegateFunction);
        workerA.startAsync();

        const workerOptionsB = new PushDepWorkerOptions();
        workerOptionsB.kindId = "b";

        const workerB = new PushDepWorker(pushDep, workerOptionsB, consoleWorkerDelegateFunction);
        workerB.startAsync();

        await pushDep.pushAsync({ kindId: "a" });
        await pushDep.pushAsync({ kindId: "a" });
        await pushDep.pushAsync({ kindId: "a" });

        while (numberOfTasks) {
            await sleep(10);
        }

        const count = await pushDep.countAsync("a");
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

        await workerA.waitForTerminationAsync();
        await workerB.waitForTerminationAsync();

        expect.assertions(1);
    }, 30000);

    it('It should work even if dependencies fail ;-)', async () => {
        let numberOfTasks = 5;
        const task = {
            kindId: "a" , 
            args: { executionStatus: "fail" }, // don't use simple strings! args: "complete" works with typeORM but Sequelize needs '"complete"'!
            dependencies: [{
                kindId: "a", 
                args: { executionStatus: "complete" }, 
                dependencies: [{
                    kindId: "a", 
                    args: { executionStatus: "fail" }
                }, {
                    kindId: "a", 
                    args: { executionStatus: "cancel" },
                    dependencies: [{
                        kindId: "a", 
                        args: { executionStatus: "complete" }
                    }]
                }]
            }]
        };
        const consoleWorkerDelegateFunction = async (worker: PushDepWorker, task: PushDepTask, pushDep: PushDep) => {
            console.log(`worker ${worker.id} treating task ${task.id}`);
            await sleep(10);
            task.results = { result: "Execution status: " + task.args.executionStatus };
            switch (task.args.executionStatus) {
                case "complete": await pushDep.completeAsync(task); break;
                case "fail": await pushDep.failAsync(task); break;
                case "cancel": await pushDep.cancelAsync(task); break;
            }
            numberOfTasks--;
        };

        const workerOptionsA = new PushDepWorkerOptions();
        workerOptionsA.kindId = "a";

        const workerA = new PushDepWorker(pushDep, workerOptionsA, consoleWorkerDelegateFunction);
        workerA.startAsync();

        await pushDep.pushAsync(task);

        while (numberOfTasks) {
            await sleep(10);
        }

        const count = await pushDep.countAsync("a");
        expect(count).toEqual({
            pending: 0,
            active: 0,
            completed: 2,
            canceled: 1,
            failed: 2,
            all: 5
        });

        await workerA.stopAsync();
        await workerA.waitForTerminationAsync();

        expect.assertions(1);
    }, 30000);

    it('It should execute a hierarchical job using multiple workers', async () => {
        const start = new Date().getTime();

        let numberOfTasks = 6;

        const consoleWorkerDelegateFunction = async (worker: PushDepWorker, task: PushDepTask, pushDep: PushDep) => {
            console.log(`worker ${worker.id} treating task ${task.id}`);
            await sleep(1000);
            await pushDep.completeAsync(task);
            numberOfTasks--;
        };

        await pushDep.setKindAsync({ id: "b", concurrency: 3 });
        
        const worker1 = new PushDepWorker(pushDep, {
            kindId: "a",
            idleTimeoutMs: 100
        }, consoleWorkerDelegateFunction);
        worker1.startAsync();

        const worker2 = new PushDepWorker(pushDep, {
            kindId: "a",
            idleTimeoutMs: 100
        }, consoleWorkerDelegateFunction);
        worker2.startAsync();

        const worker3 = new PushDepWorker(pushDep, {
            kindId: "b",
            idleTimeoutMs: 100
        }, consoleWorkerDelegateFunction);
        worker3.startAsync();

        const task0 = await pushDep.pushAsync({ kindId: "a" });
        const task1 = await pushDep.pushAsync({ kindId: "a" });
        const task2 = await pushDep.pushAsync({ kindId: "a" });
        const task3 = await pushDep.pushAsync({ kindId: "b", dependencies: [task0, task1] });
        const task4 = await pushDep.pushAsync({ kindId: "b", dependencies: [task0, task2] });
        await pushDep.pushAsync({ kindId: "a", dependencies: [task3, task4] });

        while (numberOfTasks) {
            await sleep(10);
        }

        let count = await pushDep.countAsync("a");
        expect(count).toEqual({
            pending: 0,
            active: 0,
            completed: 4,
            canceled: 0,
            failed: 0,
            all: 4
        });

        count = await pushDep.countAsync("b");
        expect(count).toEqual({
            pending: 0,
            active: 0,
            completed: 2,
            canceled: 0,
            failed: 0,
            all: 2
        });

        await worker1.stopAsync();
        await worker2.stopAsync();
        await worker3.stopAsync();

        await worker1.waitForTerminationAsync();
        await worker2.waitForTerminationAsync();
        await worker3.waitForTerminationAsync();

        expect.assertions(2);
        
        console.log(`executed in ${new Date().getTime() - start} ms`);
    }, 30000);

    it('It should run in stop mode', async () => {
        let numberOfTasks = 3;
        const consoleWorkerDelegateFunction = async (worker: PushDepWorker, task: PushDepTask, pushDep: PushDep) => {
            console.log(`worker ${worker.id} treating task ${task.id}`);
            await sleep(100);
            await pushDep.completeAsync(task);
            numberOfTasks--;
        };

        // Important: if the worker is in stop mode, the tasks have to be created before starting the worker!
        await pushDep.pushAsync({ kindId: "a" });
        await pushDep.pushAsync({ kindId: "a" });
        await pushDep.pushAsync({ kindId: "a" });

        const workerOptionsA = new PushDepWorkerOptions();
        workerOptionsA.kindId = "a";
        workerOptionsA.runningMode = PushDepWorkerRunningMode.stop;

        const workerA = new PushDepWorker(pushDep, workerOptionsA, consoleWorkerDelegateFunction);
        workerA.startAsync();

        while (numberOfTasks) {
            await sleep(10);
        }

        const count = await pushDep.countAsync("a");
        expect(count).toEqual({
            pending: 0,
            active: 0,
            completed: 3,
            canceled: 0,
            failed: 0,
            all: 3
        });

        await sleep(500);
        expect(workerA.isRunning).toBeFalsy();
        expect(workerA.isTerminated).toBeTruthy();
        expect.assertions(3);
    }, 30000);

    it('It should run in wait mode', async () => {
        let numberOfTasks = 3;
        const consoleWorkerDelegateFunction = async (worker: PushDepWorker, task: PushDepTask, pushDep: PushDep) => {
            console.log(`worker ${worker.id} treating task ${task.id}`);
            await sleep(100);
            await pushDep.completeAsync(task);
            numberOfTasks--;
        };

        // Important: if the worker is in wait mode, the tasks have to be created before starting the worker!
        await pushDep.setKindAsync({ id: "b", concurrency: 1 });
        await pushDep.pushAsync({ kindId: "a" });
        await pushDep.pushAsync({ kindId: "a" });
        await pushDep.pushAsync({ kindId: "a", dependencies: [{ kindId: "b" }] }); // the dependency will block the "a" task

        const workerOptionsA = new PushDepWorkerOptions();
        workerOptionsA.kindId = "a";
        workerOptionsA.runningMode = PushDepWorkerRunningMode.wait;

        const workerA = new PushDepWorker(pushDep, workerOptionsA, consoleWorkerDelegateFunction);
        workerA.startAsync();

        while (numberOfTasks > 1) {
            await sleep(10);
        }

        let count = await pushDep.countAsync("a");
        expect(count).toEqual({
            pending: 1,
            active: 0,
            completed: 2,
            canceled: 0,
            failed: 0,
            all: 3
        });

        expect(workerA.isRunning).toBeTruthy();
        expect(workerA.isTerminated).toBeFalsy();

        const taskB = await pushDep.startAsync("b");
        await pushDep.completeAsync(taskB);

        while (numberOfTasks) {
            await sleep(10);
        }

        count = await pushDep.countAsync("a");
        expect(count).toEqual({
            pending: 0,
            active: 0,
            completed: 3,
            canceled: 0,
            failed: 0,
            all: 3
        });

        await sleep(500);
        expect(workerA.isRunning).toBeFalsy();
        expect(workerA.isTerminated).toBeTruthy();
        expect.assertions(6);
    }, 30000);

    it('It should execute a simple dummy demo', async () => {
        await pushDep.setKindAsync({ id: "foo", concurrency: 3 });
        await pushDep.setKindAsync({ id: "bar", concurrency: 3 });

        let numberOfTasks = 6;
        const executionPath = [];

        const workerDelegateFunction = async (_worker: PushDepWorker, task: PushDepTask, _pushDep: PushDep) => {
            executionPath.push(task.args.step);
            await pushDep.completeAsync(task);
            numberOfTasks--;
        };

        const workerFoo = new PushDepWorker(pushDep, { kindId: "foo", idleTimeoutMs: 10 }, workerDelegateFunction);
        workerFoo.startAsync();

        const workerBar = new PushDepWorker(pushDep, { kindId: "bar", idleTimeoutMs: 10 }, workerDelegateFunction);
        workerBar.startAsync();

        const task0 = await pushDep.pushAsync({ kindId: "foo", args: { step: 0 } });
        const task1 = await pushDep.pushAsync({ kindId: "foo", args: { step: 1 } });
        const task2 = await pushDep.pushAsync({ kindId: "foo", args: { step: 2 } });
        const task3 = await pushDep.pushAsync({ kindId: "bar", args: { step: 3 }, dependencies: [task0, task1] });
        const task4 = await pushDep.pushAsync({ kindId: "bar", args: { step: 4 }, dependencies: [task0, task2] });
        await pushDep.pushAsync({ kindId: "foo", args: { step: 5 }, dependencies: [task3, task4] });

        while (numberOfTasks) {
            await sleep(10);
        }

        await workerFoo.stopAsync();
        await workerBar.stopAsync();

        await workerFoo.waitForTerminationAsync();
        await workerBar.waitForTerminationAsync();

        const path = executionPath.join("");

        expect(path.indexOf("0")).not.toBe(-1);
        expect(path.indexOf("1")).not.toBe(-1);
        expect(path.indexOf("2")).not.toBe(-1);
        expect(path.indexOf("3")).not.toBe(-1);
        expect(path.indexOf("4")).not.toBe(-1);
        expect(path.indexOf("5")).not.toBe(-1);
        expect(path.indexOf("3")).toBeGreaterThan(path.indexOf("0"));
        expect(path.indexOf("3")).toBeGreaterThan(path.indexOf("1"));
        expect(path.indexOf("4")).toBeGreaterThan(path.indexOf("1"));
        expect(path.indexOf("4")).toBeGreaterThan(path.indexOf("2"));
        expect(path.indexOf("5")).toBeGreaterThan(path.indexOf("3"));
        expect(path.indexOf("5")).toBeGreaterThan(path.indexOf("4"));

        expect.assertions(12);
    }, 30000);
});
