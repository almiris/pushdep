import "dotenv/config";
import { promisify } from "util";
import { afterAllAsync, beforeAllAsync, beforeEachAsync, pushDep, TESTED_PUSHDEPS } from "./commons.spec";
import { PushDep, PushDepTask } from "./PushDep";
import { PushDepWorker, PushDepWorkerOptions } from "./Worker";

const sleep = promisify(setTimeout);

describe.each(TESTED_PUSHDEPS)('Worker tests using $pushDepClass pushDep', ({ pushDepClass }) => {

    beforeAll(async () => await beforeAllAsync(pushDepClass));

    afterAll(async () => await afterAllAsync(pushDepClass));

    beforeEach(async () => await beforeEachAsync(pushDepClass));

    it('It should test pushing 100_000 tasks checking concurrency', async () => {
        const numberOfTasks = 200;//1000;//100_000;
        const insertChunkSize = 50;
        const numberOfWorkers = 20;// 10;
        const concurrency = 10;
        const kindId = "a";
        let numberOfRemainingTasks = numberOfTasks;
        const consoleWorkerFunction = async (worker: PushDepWorker, task: PushDepTask, pushDep: PushDep) => {
            try {
                await sleep(1000);
                await pushDep.completeAsync(task);
                numberOfRemainingTasks--;
            }
            catch (err) {
                console.error(err);
            }
        };

        await pushDep.setKindAsync({ id: kindId, concurrency: concurrency, lockTimeoutMs: 5000 });
        
        for (let i = 0; i < numberOfTasks / insertChunkSize; i++) {
            const promises = new Array(insertChunkSize).fill(0).map(_ => pushDep.pushAsync({ kindId: kindId }));
            await Promise.all(promises);
        }

        const workerOptionsA = new PushDepWorkerOptions();
        workerOptionsA.kindId = kindId;
        workerOptionsA.idleTimeoutMs = 100;

        // const workers: PushDepWorker[] = new Array(numberOfWorkers).fill(0).map(_ => {
        //     const worker = new PushDepWorker(pushDep, workerOptionsA, consoleWorkerFunction);
        //     worker.startAsync();
        //     return worker;
        // });

        const workers: PushDepWorker[] = new Array();
        for (let i = 0; i < numberOfWorkers; i++) {
            const worker = new PushDepWorker(pushDep, workerOptionsA, consoleWorkerFunction);
            workers.push(worker);
            worker.startAsync();
        }

        while (numberOfRemainingTasks) {
            const count = await pushDep.countAsync(kindId);
            if (count.active > concurrency) {
                throw new Error(`Illegal concurrency state: ${count.active}`);
            }
            console.log(`remaining: ${numberOfRemainingTasks} number of active tasks: ${count.active}`);
            // if (numberOfRemainingTasks % 1000 == 0) {
            //     console.log(`remaining: ${numberOfRemainingTasks} number of active tasks: ${count.active}`);
            // }
            await sleep(100);
        }

        console.log("after while");

        const count = await pushDep.countAsync(kindId);
        expect(count).toEqual({
            pending: 0,
            active: 0,
            completed: numberOfTasks,
            canceled: 0,
            failed: 0,
            all: numberOfTasks
        });

        console.log("after count");

        for (let worker of workers) {
            await worker.stopAsync();
        }

        console.log("after stop");

        for (let worker of workers) {
            await worker.waitForTerminationAsync();
        }

        console.log("after wait");

        expect.assertions(1);
    }, 5_000_000);
});
