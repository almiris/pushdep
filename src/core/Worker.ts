import { promisify } from "util";
import { PushDep, PushDepTask } from "./PushDep";
import { v4 as uuidv4 } from "uuid";

const sleep = promisify(setTimeout);

export const enum PushDepWorkerRunningMode {
    always,
    stop,
    wait
}

const DEFAULT_IDLE_TIMEOUT_MS = 1000;

const DEFAULT_WAIT_FOR_TERMINATION_SLEEP_MS = 10;

export class PushDepWorkerOptions {
    kindId: string;
    idleTimeoutMs = DEFAULT_IDLE_TIMEOUT_MS;
    runningMode? = PushDepWorkerRunningMode.always;
}

export type PushDepWorkerDelegateFunction = (worker: PushDepWorker, task: PushDepTask, pushDep: PushDep) => Promise<void>;

export class PushDepWorker {
    isRunning = false;
    isTerminated = true;
    id = uuidv4();

    constructor(private pushDep: PushDep, private options: PushDepWorkerOptions, private workerDelegate?: PushDepWorkerDelegateFunction) {}

    async startAsync(): Promise<void> {
        if (!this.isRunning) {
            this.isRunning = true;
            this.isTerminated = false;
            while (this.isRunning) {
                const task = await this.pushDep.startAsync(this.options.kindId);
                await (task ? this.onTask(task) : this.onTaskNotFound());
            }
            this.isTerminated = true;
        }
    }

    async onTask(task: PushDepTask): Promise<void> {
        if (this.workerDelegate) {
            await this.workerDelegate(this, task, this.pushDep);
        }
    }

    async onTaskNotFound(): Promise<void> {
        const runningMode = this.options.runningMode || PushDepWorkerRunningMode.always;
        if (runningMode === PushDepWorkerRunningMode.always 
            || (runningMode === PushDepWorkerRunningMode.wait && !!await this.pushDep.hasPendingOrActiveAsync(this.options.kindId))) {
            await sleep(this.options.idleTimeoutMs || DEFAULT_IDLE_TIMEOUT_MS);
        } else {
            await this.stopAsync();
        }                
    }

    async stopAsync(): Promise<void> {
        this.isRunning = false;
    }

    async waitForTerminationAsync(): Promise<void> {
        while (!this.isTerminated) {
            await sleep(DEFAULT_WAIT_FOR_TERMINATION_SLEEP_MS);
        }
    }
}
