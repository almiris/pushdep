import { promisify } from "util";
import { PushDep, PushDepTask } from "./PushDep";
import { v4 as uuidv4 } from 'uuid';

const sleep = promisify(setTimeout);

export class PushDepWorkerOptions {
    kind: string;
    idleTimeoutMs = 200;
}

export type PushDepWorkerFunction = (worker: PushDepWorker, task: PushDepTask, pushDep: PushDep) => Promise<void>;

export class PushDepWorker {
    isRunning = false;
    id = uuidv4();

    constructor(private pushDep: PushDep, private options: PushDepWorkerOptions, private worker: PushDepWorkerFunction) {}

    async startAsync(): Promise<void> {
        if (!this.isRunning) {
            this.isRunning = true;
            while (this.isRunning) {
                const task = await this.pushDep.startAsync(this.options.kind);
                if (!task) {
                    await sleep(this.options.idleTimeoutMs);
                }
                else {
                    await this.worker(this, task, this.pushDep);
                }
            }
        }
    }

    async stopAsync(): Promise<void> {
        this.isRunning = false;
    }
}
