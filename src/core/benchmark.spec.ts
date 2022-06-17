import "dotenv/config";
import { promisify } from "util";
import { afterAllAsync, beforeAllAsync, beforeEachAsync, pushDep, TESTED_PUSHDEPS } from "./commons.spec";
import { PushDep, PushDepTask } from "./PushDep";
import { PushDepWorker, PushDepWorkerOptions } from "./Worker";

const sleep = promisify(setTimeout);

describe.each(TESTED_PUSHDEPS)('Worker tests using $pushDepClass pushDep', ({ pushDepClass }) => {

    beforeAll(async () => /* await */ beforeAllAsync(pushDepClass));

    afterAll(async () => /* await */ afterAllAsync(pushDepClass));

    beforeEach(async () => /* await */ beforeEachAsync(pushDepClass));

    it('It should test pushing 100_000 tasks checking concurrency', async () => {
        const numberOfRootTasks = 1_000;
        const insertChunkSize = 40; // numberOfRootTasks must be a multiple of insertChunkSize
        const numberOfWorkers = 40;
        const concurrency = 40;
        const kindIdA = "a";
        const kindIdB = "b";
        const kindIdC = "c";
        let totalNumberOfTasks = numberOfRootTasks * (1 + 5 + 5 * 5); // 1 root, 5 deps per root, 5 deps per dep
        let numberOfRemainingTasks = totalNumberOfTasks;
        const consoleWorkerFunction = async (_worker: PushDepWorker, task: PushDepTask, _pushDep: PushDep) => {
            try {
                await sleep(100);
                await pushDep.completeAsync(task);
                numberOfRemainingTasks--;
            }
            catch (err) {
                fail(err);
            }
        };

        await pushDep.setKindAsync({ id: kindIdA, concurrency: concurrency, lockTimeoutMs: 5000 });
        await pushDep.setKindAsync({ id: kindIdB, concurrency: concurrency, lockTimeoutMs: 5000 });
        await pushDep.setKindAsync({ id: kindIdC, concurrency: concurrency, lockTimeoutMs: 5000 });
        
        for (let i = 0; i < numberOfRootTasks / insertChunkSize; i++) {
            const promises = new Array(insertChunkSize).fill(0).map(_ => pushDep.pushAsync({ 
                kindId: kindIdA,
                dependencies: new Array(5).fill(0).map(() => ({ 
                    kindId: kindIdB, 
                    dependencies: new Array(5).fill(0).map(() => ({
                        kindId: kindIdC
                    }))
                }))
            }));
            await Promise.all(promises);
        }

        const workerOptionsA = {
            kindId: kindIdA,
            idleTimeoutMs: 100
        }; 

        const workerOptionsB = {
            kindId: kindIdB,
            idleTimeoutMs: 100
        }; 

        const workerOptionsC = {
            kindId: kindIdC,
            idleTimeoutMs: 100
        }; 

        const workers: PushDepWorker[] = [
            ...new Array(numberOfWorkers).fill(0).map(_ => {
                const worker = new PushDepWorker(pushDep, workerOptionsA, consoleWorkerFunction);
                worker.startAsync();
                return worker;
            }), ...new Array(numberOfWorkers).fill(0).map(_ => {
                const worker = new PushDepWorker(pushDep, workerOptionsB, consoleWorkerFunction);
                worker.startAsync();
                return worker;
            }), ...new Array(numberOfWorkers).fill(0).map(_ => {
                const worker = new PushDepWorker(pushDep, workerOptionsC, consoleWorkerFunction);
                worker.startAsync();
                return worker;
            })];

        while (numberOfRemainingTasks) {
            let counts = {};
            for (const kind of [kindIdA, kindIdB, kindIdC]) {
                const c = await pushDep.countAsync(kind);
                counts[kind] = c.active;
                if (c.active > concurrency) {
                    throw new Error(`Illegal concurrency state for kind ${kind}: ${c.active}`);
                }
            }
            console.log(`remaining: ${numberOfRemainingTasks} number of active tasks: ${JSON.stringify(counts , null, 2)}`);
            await sleep(200);
        }

        const count = await pushDep.countAsync(kindIdA);
        expect(count).toEqual({
            pending: 0,
            active: 0,
            completed: numberOfRootTasks,
            canceled: 0,
            failed: 0,
            all: numberOfRootTasks
        });

        for (let worker of workers) {
            await worker.stopAsync();
        }

        for (let worker of workers) {
            await worker.waitForTerminationAsync();
        }

        expect.assertions(1);
    }, 50_000_000);
});
