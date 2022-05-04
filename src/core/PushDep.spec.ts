import "dotenv/config";
import { InMemoryPushDep } from "src/impl/inmemory/InMemoryPushDep";
import { TypeORMPushDep } from "src/impl/typeorm/TypeORMPushDep";
import { DataSource } from "typeorm";
import { Kind as TypeORMKind } from "src/impl/typeorm/entity/Kind.entity";
import { Task as TypeORMTask } from "src/impl/typeorm/entity/Task.entity";
import { TaskExecution as TypeORMTaskExecution }from "src/impl/typeorm/entity/TaskExecution.entity";
import { PushDep } from "./PushDep";
import { Kind as SequelizeKind } from "src/impl/sequelize/model/Kind.model";
import { Task as SequelizeTask } from "src/impl/sequelize/model/Task.model";
import { TaskExecution as SequelizeTaskExecution }from "src/impl/sequelize/model/TaskExecution.model";
import { TaskDependency as SequelizeTaskDependency }from "src/impl/sequelize/model/TaskDependency.model";
import { Sequelize } from "sequelize-typescript";
import { SequelizePushDep } from "src/impl/sequelize/SequelizePushDep";

let dataSource: DataSource;
let sequelize: Sequelize;
let pushDep: PushDep;

const pushDepClassCLIArg: string = process.argv.map(arg => arg.startsWith("--pushDepClass=") ? arg.substring("--pushDepClass=".length) : null).filter(arg => arg)[0];

const PUSHDEP_CLASSES = {
    "InMemoryPushDep": InMemoryPushDep,
    "SequelizePushDep": SequelizePushDep,
    "TypeORMPushDep": TypeORMPushDep
};

describe.each(pushDepClassCLIArg ? [{ pushDepClass: pushDepClassCLIArg }] : [{
    pushDepClass: "InMemoryPushDep"
}, {
    pushDepClass: "SequelizePushDep"
}, {
    pushDepClass: "TypeORMPushDep"
}])('PushDep tests using $pushDepClass pushDep', ({ pushDepClass }) => {

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
                entities: [TypeORMKind, TypeORMTask, TypeORMTaskExecution],
                migrations: [],
                subscribers: [],
            });
            await dataSource.initialize();
            pushDep = new TypeORMPushDep(dataSource);
        }
        else if (PUSHDEP_CLASSES[pushDepClass] === SequelizePushDep) {
            sequelize = new Sequelize({
                dialect: process.env.DB_TYPE as any,
                host: process.env.DB_HOST,
                port: Number(process.env.DB_PORT),
                username: process.env.DB_USERNAME,
                password: process.env.DB_PASSWORD,
                database: process.env.DB_NAME,
                ssl: process.env.DB_SSL ? JSON.parse(process.env.DB_SSL) : undefined,
                pool: process.env.DB_EXTRA ? JSON.parse(process.env.DB_EXTRA) : undefined, // pool parameters!,
                sync: { alter: false, force: false },
                logging: (...msg) => console.log(msg), // true,
                models: [SequelizeKind, SequelizeTask, SequelizeTaskExecution, SequelizeTaskDependency]
            });         
            pushDep = new SequelizePushDep(sequelize);
        }
    });

    afterAll(async () => {
        if (PUSHDEP_CLASSES[pushDepClass] === TypeORMPushDep) {
            await dataSource.destroy();
        }
        else if (PUSHDEP_CLASSES[pushDepClass] === SequelizePushDep) {
            await sequelize.close();
        }
    });

    beforeEach(async () => {
        if (PUSHDEP_CLASSES[pushDepClass] === TypeORMPushDep) {
            await dataSource.manager.delete(TypeORMTaskExecution, {});
            await dataSource.manager.delete(TypeORMTask, {});
            await dataSource.manager.delete(TypeORMKind, {});
        }
        else if (PUSHDEP_CLASSES[pushDepClass] === SequelizePushDep) {
            // await SequelizeTaskExecution.truncate({ force: true });
            // await SequelizeTaskDependency.truncate({ force: true });
            await SequelizeTask.truncate({ force: true, cascade: true });
            await SequelizeKind.truncate({ force: true, cascade: true });
        }
        else if (PUSHDEP_CLASSES[pushDepClass] === InMemoryPushDep) {
            pushDep = new InMemoryPushDep();
        }
        await pushDep.setKindAsync({ id: "a", concurrency: 3 });
    });

    it('It should set then get a kind', async () => {
        await pushDep.setKindAsync({ id: "b", concurrency: 3 });
        const kind = await pushDep.getKindAsync("b");

        expect(kind).not.toBeNull();
        expect(kind).toEqual({
            id: "b",
            concurrency: 3
        });
        expect.assertions(2);
    });

    it('It should receive null getting an unknown kind', async () => {
        const kind = await pushDep.getKindAsync("c");

        expect(kind).toBeNull();
        expect.assertions(1);
    });

    it('It should push a task', async () => {
        const task = await pushDep.pushAsync({
            kindId: "a"
        });

        expect(task.id).not.toBeNull();
        expect(task.id.length).toBe(36);

        const count = await pushDep.countAsync("a");
        console.log(count);
        expect(count.pending).toBe(1);
        expect.assertions(3);
    });

    it('It should not push a task that already has an id', async () => {
        const task = await pushDep.pushAsync({
            kindId: "a"
        });
        await pushDep.pushAsync(task); // this will not add a task
        const count = await pushDep.countAsync("a");

        expect(count.pending).toBe(1);
        expect.assertions(1);
    });

    it('It should push tasks with dependencies', async () => {
        const task0 = await pushDep.pushAsync({
            kindId: "a", dependencies: [{
                kindId: "a"
            }]
        });
        const task0Id = task0.id;
        const task00Id = task0.dependencies[0].id;

        expect(task00Id).not.toBeNull();
        expect(task00Id.length).toBe(36);

        const task = await pushDep.pushAsync({
            kindId: "a", dependencies: [{
                kindId: "a",
                dependencies: [{
                    kindId: "a"
                }]
            }, task0]
        });

        expect(task0.id).toBe(task0Id);
        expect(task0.dependencies[0].id).toBe(task00Id);

        const count = await pushDep.countAsync("a");

        expect(count.pending).toBe(5);
        expect.assertions(5);

        console.log(JSON.stringify(task, null, 2));
        console.log(count);
    });

    it('It should count tasks', async () => {
        let count = await pushDep.countAsync("a");
        expect(count).toEqual({
            pending: 0,
            active: 0,
            completed: 0,
            canceled: 0,
            failed: 0,
            all: 0
        });

        await pushDep.pushAsync({ kindId: "a" });
        await pushDep.pushAsync({ kindId: "a" });
        await pushDep.pushAsync({ kindId: "a" });
        count = await pushDep.countAsync("a");

        expect(count).toEqual({
            pending: 3,
            active: 0,
            completed: 0,
            canceled: 0,
            failed: 0,
            all: 3
        });

        await pushDep.setKindAsync({ id: "b", concurrency: 1 });
        await pushDep.pushAsync({ kindId: "b" });
        count = await pushDep.countAsync("b");

        expect(count).toEqual({
            pending: 1,
            active: 0,
            completed: 0,
            canceled: 0,
            failed: 0,
            all: 1
        });

        count = await pushDep.countAsync("c");

        expect(count).toEqual({
            pending: 0,
            active: 0,
            completed: 0,
            canceled: 0,
            failed: 0,
            all: 0
        });

        expect.assertions(4);
    });

    // it('It should peek nothing', async () => {
    //     expect(await pushDep.peekAsync("a")).toBeNull();
    //     expect.assertions(1);
    // });

    // it('It should peek a task using priority', async () => {
    //     const task0 = await pushDep.pushAsync({ kindId: "a" });

    //     let task = await pushDep.peekAsync("a");
    //     expect(task.id).toBe(task0.id);

    //     const task2 = await pushDep.pushAsync({ kindId: "a", priority: 2 });
    //     task = await pushDep.peekAsync("a");
    //     expect(task.id).toBe(task2.id);

    //     const task10 = await pushDep.pushAsync({ kindId: "a", priority: 10 });
    //     task = await pushDep.peekAsync("a");
    //     expect(task.id).toBe(task10.id);

    //     expect.assertions(3);
    // });

    // it('It should peek a task using priority and dependencies', async () => {
    //     const task0 = await pushDep.pushAsync({ kindId: "a" });
    //     const task2 = await pushDep.pushAsync({ kindId: "a", priority: 2, dependencies: [task0] });
    //     await pushDep.pushAsync({ kindId: "a", priority: 10, dependencies: [task2] });

    //     const task = await pushDep.peekAsync("a");
    //     expect(task.id).toBe(task0.id);
    //     expect.assertions(1);
    // });

    // it('It should start then complete a task', async () => {
    //     await pushDep.pushAsync({
    //         kindId: "a"
    //     });

    //     const task = await pushDep.startAsync("a");

    //     let count = await pushDep.countAsync("a");
    //     expect(count).toEqual({
    //         pending: 0,
    //         active: 1,
    //         completed: 0,
    //         canceled: 0,
    //         failed: 0,
    //         all: 1
    //     });

    //     await pushDep.completeAsync(task);

    //     count = await pushDep.countAsync("a");
    //     expect(count).toEqual({
    //         pending: 0,
    //         active: 0,
    //         completed: 1,
    //         canceled: 0,
    //         failed: 0,
    //         all: 1
    //     });

    //     expect.assertions(2);
    // });

    // it('It should start then cancel a task', async () => {
    //     await pushDep.pushAsync({
    //         kindId: "a"
    //     });

    //     const task = await pushDep.startAsync("a");

    //     let count = await pushDep.countAsync("a");
    //     expect(count).toEqual({
    //         pending: 0,
    //         active: 1,
    //         completed: 0,
    //         canceled: 0,
    //         failed: 0,
    //         all: 1
    //     });

    //     await pushDep.cancelAsync(task);

    //     count = await pushDep.countAsync("a");
    //     expect(count).toEqual({
    //         pending: 0,
    //         active: 0,
    //         completed: 0,
    //         canceled: 1,
    //         failed: 0,
    //         all: 1
    //     });

    //     expect.assertions(2);
    // });

    // it('It should start then fail a task', async () => {
    //     await pushDep.pushAsync({
    //         kindId: "a"
    //     });

    //     const task = await pushDep.startAsync("a");

    //     let count = await pushDep.countAsync("a");
    //     expect(count).toEqual({
    //         pending: 0,
    //         active: 1,
    //         completed: 0,
    //         canceled: 0,
    //         failed: 0,
    //         all: 1
    //     });

    //     await pushDep.failAsync(task);

    //     count = await pushDep.countAsync("a");
    //     expect(count).toEqual({
    //         pending: 0,
    //         active: 0,
    //         completed: 0,
    //         canceled: 0,
    //         failed: 1,
    //         all: 1
    //     });

    //     expect.assertions(2);
    // });

    // it('It should start then return a task', async () => {
    //     await pushDep.pushAsync({
    //         kindId: "a"
    //     });

    //     const task = await pushDep.startAsync("a");

    //     let count = await pushDep.countAsync("a");
    //     expect(count).toEqual({
    //         pending: 0,
    //         active: 1,
    //         completed: 0,
    //         canceled: 0,
    //         failed: 0,
    //         all: 1
    //     });

    //     await pushDep.returnAsync(task);

    //     count = await pushDep.countAsync("a");
    //     expect(count).toEqual({
    //         pending: 1,
    //         active: 0,
    //         completed: 0,
    //         canceled: 0,
    //         failed: 0,
    //         all: 1
    //     });

    //     expect.assertions(2);
    // });

    // it('It should test kind concurrency', async () => {
    //     await pushDep.setKindAsync({ id: "a", concurrency: 3 });

    //     // eslint-disable-next-line @typescript-eslint/no-unused-vars
    //     for (const i in [1, 2, 3, 4]) {
    //         await pushDep.pushAsync({ kindId: "a" });
    //         await pushDep.startAsync("a");
    //     }

    //     let count = await pushDep.countAsync("a");
    //     expect(count).toEqual({
    //         pending: 1,
    //         active: 3,
    //         completed: 0,
    //         canceled: 0,
    //         failed: 0,
    //         all: 4
    //     });

    //     await pushDep.setKindAsync({ id: "a", concurrency: 4 });
    //     await pushDep.startAsync("a");

    //     count = await pushDep.countAsync("a");
    //     expect(count).toEqual({
    //         pending: 0,
    //         active: 4,
    //         completed: 0,
    //         canceled: 0,
    //         failed: 0,
    //         all: 4
    //     });

    //     expect.assertions(2);
    // }, 10000);
}, 60000);
