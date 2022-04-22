export class PushDepKind {
    kind: string;
    concurrency?: number = 1;
    // retry?: number; // TODO
}

export class PushDepTask {
    id?: string;
    kind: string;
    dependencyIds?: string[];
    args?: any;
    priority?: number = 0;
    results?: any;
    // retry?: number; // TODO
}

export enum PushDepExecutionState {
    pending,
    active,
    completed,
    canceled,
    failed
}

export interface PushDepTaskCount {
    pending: number;
    active: number;
    completed: number;
    canceled: number;
    failed: number;
    all: number;
}

export class PushDepTaskExecution {
    task: PushDepTask;
    state?: PushDepExecutionState = PushDepExecutionState.pending;
    createdAt?: Date = new Date();
    startedAt?: Date;
    completedAt?: Date;
    canceledAt?: Date;
    failedAt?: Date;

    static build(task: PushDepTask) {
        const taskExecution = new PushDepTaskExecution();
        taskExecution.task = task;
        return taskExecution;
    }
}

export interface PushDep {
    pushAsync(task: PushDepTask): Promise<string>;
    peekAsync(kind: string): Promise<PushDepTask>;
    countAsync(kind: string): Promise<PushDepTaskCount>;
    popAsync(kind: string): Promise<PushDepTask>;
    startAsync(kind: string): Promise<PushDepTask>;
    completeAsync(task: PushDepTask): Promise<void>;
    cancelAsync(task: PushDepTask): Promise<void>;
    failAsync(task: PushDepTask): Promise<void>;
}
