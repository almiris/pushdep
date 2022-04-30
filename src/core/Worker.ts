import { promisify } from "util";
import { PushDep, PushDepTask } from "./PushDep";
import { v4 as uuidv4 } from "uuid";

const sleep = promisify(setTimeout);

export class PushDepWorkerOptions {
    kindId: string;
    idleTimeoutMs = 200;
}

export type PushDepWorkerFunction = (worker: PushDepWorker, task: PushDepTask, pushDep: PushDep) => Promise<void>;

export class PushDepWorker {
    isRunning = false;
    isTerminated = true;
    id = uuidv4();

    constructor(private pushDep: PushDep, private options: PushDepWorkerOptions, private worker: PushDepWorkerFunction) {}

    async startAsync(): Promise<void> {
        if (!this.isRunning) {
            this.isRunning = true;
            this.isTerminated = false;
            while (this.isRunning) {
                const task = await this.pushDep.startAsync(this.options.kindId);
                if (!task) {
                    await sleep(this.options.idleTimeoutMs);
                }
                else {
                    await this.worker(this, task, this.pushDep);
                }
            }
            this.isTerminated = true;
        }
    }

    async stopAsync(): Promise<void> {
        this.isRunning = false;
    }

    async waitForTermination(): Promise<void> {
        while (!this.isTerminated) {
            await sleep(10);
        }
    }
}
