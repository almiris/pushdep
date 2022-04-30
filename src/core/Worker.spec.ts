import "dotenv/config";
import { InMemoryPushDep } from "src/impl/inmemory/InMemoryPushDep";
import { Kind } from "src/impl/typeorm/entity/Kind.entity";
import { Task } from "src/impl/typeorm/entity/Task.entity";
import { TaskExecution } from "src/impl/typeorm/entity/TaskExecution.entity";
import { TypeORMPushDep } from "src/impl/typeorm/TypeORMPushDep";
import { DataSource } from "typeorm";
import { promisify } from "util";
import { PushDep, PushDepTask } from "./PushDep";
import { PushDepWorker, PushDepWorkerOptions } from "./Worker";

const sleep = promisify(setTimeout);

let dataSource: DataSource;
let pushDep: PushDep;

const pushDepClassCLIArg: string = process.argv.map(arg => arg.startsWith("--pushDepClass=") ? arg.substring("--pushDepClass=".length) : null).filter(arg => arg)[0];

const PUSHDEP_CLASSES = {
    "InMemoryPushDep": InMemoryPushDep,
    "TypeORMPushDep": TypeORMPushDep
};

describe.each(pushDepClassCLIArg ? [{ pushDepClass: pushDepClassCLIArg }] : [{
    pushDepClass: "InMemoryPushDep"
}, {
    pushDepClass: "TypeORMPushDep"
}])('Worker tests using $pushDepClass pushDep', ({ pushDepClass }) => {

    beforeAll(async () => {
        if (PUSHDEP_CLASSES[pushDepClass] === TypeORMPushDep) {
            dataSource = new DataSource({
                type: process.env.DB_TYPE as any,
                host: process.env.DB_HOST,
                port: Number(process.env.DB_PORT),
                username: process.env.DB_USERNAME,
                password: process.env.DB_PASSWORD,
                database: process.env.DB_NAME,
                ssl: process.env.DB_SSL ? JSON.parse(process.env.DB_SSL) : undefined,
                extra: process.env.DB_EXTRA ? JSON.parse(process.env.DB_EXTRA) : undefined, // pool parameters!
                synchronize: true,
                logging: true,
                entities: [Kind, Task, TaskExecution],
                migrations: [],
                subscribers: [],
            });
            await dataSource.initialize();
            pushDep = new TypeORMPushDep(dataSource);
        }
    });

    afterAll(async () => {
        if (PUSHDEP_CLASSES[pushDepClass] === TypeORMPushDep) {
            await dataSource.destroy();
        }
    });

    beforeEach(async () => {
        if (PUSHDEP_CLASSES[pushDepClass] === TypeORMPushDep) {
            await dataSource.manager.delete(TaskExecution, {});
            await dataSource.manager.delete(Task, {});
            await dataSource.manager.delete(Kind, {});
        }
        else if (PUSHDEP_CLASSES[pushDepClass] === InMemoryPushDep) {
            pushDep = new InMemoryPushDep();
        }
        await pushDep.setKindAsync({ id: "a", concurrency: 3 });
        await pushDep.setKindAsync({ id: "b", concurrency: 3 });
    });

    it('It should work ;-)', async () => {
        const consoleWorkerFunction = async (worker: PushDepWorker, task: PushDepTask, pushDep: PushDep) => {
            console.log(`worker ${worker.id} treating task ${task.id}`);
            await sleep(100);
            await pushDep.completeAsync(task);
        };

        const workerOptionsA = new PushDepWorkerOptions();
        workerOptionsA.kindId = "a";

        const workerA = new PushDepWorker(pushDep, workerOptionsA, consoleWorkerFunction);
        workerA.startAsync();

        const workerOptionsB = new PushDepWorkerOptions();
        workerOptionsB.kindId = "b";

        const workerB = new PushDepWorker(pushDep, workerOptionsB, consoleWorkerFunction);
        workerB.startAsync();

        await pushDep.pushAsync({ kindId: "a" });
        await pushDep.pushAsync({ kindId: "a" });
        await pushDep.pushAsync({ kindId: "a" });

        await sleep(1000);

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

        await sleep(1000);

        expect.assertions(1);
    }, 20000);

    it('It should execute a hierarchical job using multiple workers', async () => {
        const start = new Date().getTime();

        let numberOfTasks = 6;

        const consoleWorkerFunction = async (worker: PushDepWorker, task: PushDepTask, pushDep: PushDep) => {
            console.log(`worker ${worker.id} treating task ${task.id}`);
            await sleep(10);
            await pushDep.completeAsync(task);
            numberOfTasks--;
        };

        const worker1 = new PushDepWorker(pushDep, {
            kindId: "a",
            idleTimeoutMs: 100
        }, consoleWorkerFunction);
        worker1.startAsync();

        const worker2 = new PushDepWorker(pushDep, {
            kindId: "a",
            idleTimeoutMs: 100
        }, consoleWorkerFunction);
        worker2.startAsync();

        const worker3 = new PushDepWorker(pushDep, {
            kindId: "b",
            idleTimeoutMs: 100
        }, consoleWorkerFunction);
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
        console.log(count);
        expect(count).toEqual({
            pending: 0,
            active: 0,
            completed: 4,
            canceled: 0,
            failed: 0,
            all: 4
        });

        count = await pushDep.countAsync("b");
        console.log(count);
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

        await sleep(10);

        expect.assertions(2);

        console.log(`executed in ${new Date().getTime() - start} ms`);
    }, 10000);

    it('It should execute a simple dummy demo', async () => {
        await pushDep.setKindAsync({ id: "foo", concurrency: 3 });
        await pushDep.setKindAsync({ id: "bar", concurrency: 3 });

        const executionPath = [];

        const workerFunction = async (worker: PushDepWorker, task: PushDepTask, pushDep: PushDep) => {
            executionPath.push(task.args.step);
            await pushDep.completeAsync(task);
        };

        const workerFoo = new PushDepWorker(pushDep, { kindId: "foo", idleTimeoutMs: 10 }, workerFunction);
        workerFoo.startAsync();

        const workerBar = new PushDepWorker(pushDep, { kindId: "bar", idleTimeoutMs: 10 }, workerFunction);
        workerBar.startAsync();

        const task0 = await pushDep.pushAsync({ kindId: "foo", args: { step: 0 } });
        const task1 = await pushDep.pushAsync({ kindId: "foo", args: { step: 1 } });
        const task2 = await pushDep.pushAsync({ kindId: "foo", args: { step: 2 } });
        const task3 = await pushDep.pushAsync({ kindId: "bar", args: { step: 3 }, dependencies: [task0, task1] });
        const task4 = await pushDep.pushAsync({ kindId: "bar", args: { step: 4 }, dependencies: [task0, task2] });
        await pushDep.pushAsync({ kindId: "foo", args: { step: 5 }, dependencies: [task3, task4] });

        await sleep(200);

        await workerFoo.stopAsync();
        await workerBar.stopAsync();

        await sleep(200);

        expect(["012345", "013245"]).toContain(executionPath.join(""));
        expect.assertions(1);
    });
});
