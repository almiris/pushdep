import "dotenv/config";
import { promisify } from "util";
import { Sequelize } from "sequelize-typescript";
import { Kind as SequelizeKind } from "../impl/sequelize/model/Kind.model";
import { KindActivityLock as SequelizeKindActivityLock } from "../impl/sequelize/model/KindActivityLock.model";
import { Task as SequelizeTask } from "../impl/sequelize/model/Task.model";
import { TaskDependency as SequelizeTaskDependency } from "../impl/sequelize/model/TaskDependency.model";
import { SequelizePushDep } from "../impl/sequelize/SequelizePushDep";
import { PushDep, PushDepTask } from "./PushDep";
import { PushDepWorker, PushDepWorkerOptions } from "./Worker";

const sleep = promisify(setTimeout);

const ONE_HOUR_MS = 60 * 60 * 1000;

xdescribe('Worker tests using $pushDepClass pushDep', () => {

    // does not improve concurrency during local benchmarking
    xit('It should test pushing 100_000 tasks checking concurrency', async () => {
        const sequelize = new Sequelize({
            dialect: process.env.DB_TYPE as any,
            host: process.env.DB_HOST,
            port: Number(process.env.DB_PORT),
            username: process.env.DB_USERNAME,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME,
            ssl: process.env.DB_SSL ? JSON.parse(process.env.DB_SSL) : undefined,
            pool: process.env.DB_EXTRA ? JSON.parse(process.env.DB_EXTRA) : undefined, // pool parameters!,
            sync: { alter: false, force: false },
            logging: false,
            // logging: (...msg) => console.log(msg), // true,
            // repositoryMode: true,
            models: [SequelizeKind, SequelizeKindActivityLock, SequelizeTask, SequelizeTaskDependency]
        });
        await sequelize.sync();

        const pushDep = new SequelizePushDep(sequelize);
        const kindId = "a";
        const consoleWorkerFunction = async (_worker: PushDepWorker, task: PushDepTask, _pushDep: PushDep) => {
            try {
                await sleep(5000);
                await pushDep.completeAsync(task);
                console.log("worked !");
            }
            catch (err) {
                fail(err);
            }
        };

        const workerOptionsA = new PushDepWorkerOptions();
        workerOptionsA.kindId = kindId;
        workerOptionsA.idleTimeoutMs = 100;

        const numberOfWorkers = 10;
        new Array(numberOfWorkers).fill(0).forEach(_ => {
            const worker = new PushDepWorker(pushDep, workerOptionsA, consoleWorkerFunction);
            worker.startAsync();
        });

        await sleep(ONE_HOUR_MS);
    }, ONE_HOUR_MS);

});