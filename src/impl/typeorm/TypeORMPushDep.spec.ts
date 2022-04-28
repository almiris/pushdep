import "dotenv/config";
import { DataSource, EntityManager } from "typeorm"
import { TypeORMPushDep } from "src/impl/typeorm/TypeORMPushDep";
import { Kind } from "./entity/Kind.entity";
import { Task } from "./entity/Task.entity";
import { TaskExecution } from "./entity/TaskExecution.entity";

let dataSource: DataSource;
let pushDep: TypeORMPushDep;

describe('TypeORMPushDep tests', () => {

    beforeAll(async () => {
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
    });

    afterAll(async () => {
        await dataSource.destroy();
    });

    beforeEach(async () => {
        await dataSource.manager.delete(TaskExecution, {});
        await dataSource.manager.delete(Task, {});
        await dataSource.manager.delete(Kind, {});
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
      await pushDep.pushAsync({ kindId: "a" });
      await pushDep.pushAsync({ kindId: "a" });
      await pushDep.pushAsync({ kindId: "a" });
      let count = await pushDep.countAsync("a");

      expect(count).toEqual({
        pending: 3,
        active: 0,
        completed: 0,
        canceled: 0,
        failed: 0,
        all: 3
      });
  
      pushDep.setKindAsync({ id: "b", concurrency: 1 });
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
      
      expect.assertions(3);
    });

    it('It should peek nothing', async () => {
        expect(await pushDep.peekAsync("a")).toBeNull();
        expect.assertions(1);
    });

    it('It should peek a task using priority', async () => {
      const task0 = await pushDep.pushAsync({ kindId: "a" });
  
      let task = await pushDep.peekAsync("a");
      expect(task.id).toBe(task0.id);
  
      const task2 = await pushDep.pushAsync({ kindId: "a", priority: 2 });
      task = await pushDep.peekAsync("a");
      expect(task.id).toBe(task2.id);
  
      const task10 = await pushDep.pushAsync({ kindId: "a", priority: 10 });
      task = await pushDep.peekAsync("a");
      expect(task.id).toBe(task10.id);
  
      expect.assertions(3);
    });
  
    it('It should peek a task using priority and dependencies', async () => {
      const task0 = await pushDep.pushAsync({ kindId: "a" });
      const task2 = await pushDep.pushAsync({ kindId: "a", priority: 2, dependencies: [ task0 ]});
      await pushDep.pushAsync({ kindId: "a", priority: 10, dependencies: [ task2 ]});
  
      const task = await pushDep.peekAsync("a");
      expect(task.id).toBe(task0.id);
      expect.assertions(1);
    });
  
    fit('It should start then complete a task', async () => {
      await pushDep.pushAsync({
        kindId: "a"
      });
  
      const task = await pushDep.startAsync("a");
  
      let count = await pushDep.countAsync("a");
      expect(count).toEqual({
        pending: 0,
        active: 1,
        completed: 0,
        canceled: 0,
        failed: 0,
        all: 1
      });
  
      await pushDep.completeAsync(task);
  
      count = await pushDep.countAsync("a");
      expect(count).toEqual({
        pending: 0,
        active: 0,
        completed: 1,
        canceled: 0,
        failed: 0,
        all: 1
      });
  
      expect.assertions(2);
    });
  
    fit('It should start then cancel a task', async () => {
      await pushDep.pushAsync({
        kindId: "a"
      });
  
      const task = await pushDep.startAsync("a");
  
      let count = await pushDep.countAsync("a");
      expect(count).toEqual({
        pending: 0,
        active: 1,
        completed: 0,
        canceled: 0,
        failed: 0,
        all: 1
      });
  
      await pushDep.cancelAsync(task);
  
      count = await pushDep.countAsync("a");
      expect(count).toEqual({
        pending: 0,
        active: 0,
        completed: 0,
        canceled: 1,
        failed: 0,
        all: 1
      });
  
      expect.assertions(2);
    });
  
    fit('It should start then fail a task', async () => {
      await pushDep.pushAsync({
        kindId: "a"
      });
  
      const task = await pushDep.startAsync("a");
  
      let count = await pushDep.countAsync("a");
      expect(count).toEqual({
        pending: 0,
        active: 1,
        completed: 0,
        canceled: 0,
        failed: 0,
        all: 1
      });
  
      await pushDep.failAsync(task);
  
      count = await pushDep.countAsync("a");
      expect(count).toEqual({
        pending: 0,
        active: 0,
        completed: 0,
        canceled: 0,
        failed: 1,
        all: 1
      });
  
      expect.assertions(2);
    });
  
    // it('It should start then repush or return a task', async () => {
    //   const pushDep = new TypeORMPushDep();
    //   await pushDep.pushAsync({
    //     kind: "a"
    //   });
  
    //   const task = await pushDep.startAsync("a");
  
    //   let count = await pushDep.countAsync("a");
    //   expect(count).toEqual({
    //     pending: 0,
    //     active: 1,
    //     completed: 0,
    //     canceled: 0,
    //     failed: 0,
    //     all: 1
    //   });
  
    //   await pushDep.pushAsync(task);
  
    //   count = await pushDep.countAsync("a");
    //   expect(count).toEqual({
    //     pending: 1,
    //     active: 0,
    //     completed: 0,
    //     canceled: 0,
    //     failed: 0,
    //     all: 1
    //   });
  
    //   expect.assertions(2);
    // });
    
    // it('It should test kind concurrency', async () => {
    //   let pushDep = new TypeORMPushDep();
      
    //   // eslint-disable-next-line @typescript-eslint/no-unused-vars
    //   for (const i in [1, 2, 3, 4]) {
    //     await pushDep.pushAsync({ kind: "a" });
    //     await pushDep.startAsync("a");
    //   }
  
    //   let count = await pushDep.countAsync("a");
    //   expect(count).toEqual({
    //     pending: 0,
    //     active: 4,
    //     completed: 0,
    //     canceled: 0,
    //     failed: 0,
    //     all: 4
    //   });
  
    //   pushDep = new TypeORMPushDep();
    //   await pushDep.setKindAsync({ kind: "a", concurrency: 3 });
  
    //   // eslint-disable-next-line @typescript-eslint/no-unused-vars
    //   for (const i in [1, 2, 3, 4]) {
    //     await pushDep.pushAsync({ kind: "a" });
    //     await pushDep.startAsync("a");
    //   }
  
    //   count = await pushDep.countAsync("a");
    //   expect(count).toEqual({
    //     pending: 1,
    //     active: 3,
    //     completed: 0,
    //     canceled: 0,
    //     failed: 0,
    //     all: 4
    //   });
  
    //   expect.assertions(2);
    // });
});
