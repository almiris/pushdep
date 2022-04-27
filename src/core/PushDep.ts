export interface PushDepKind {
    name: string;
    concurrency: number;
    // retry?: number; // TODO
}

export interface PushDepTask {
    readonly id?: string; // should be readonly
    kindId: string;
    dependencies?: any[];
    args?: any;
    priority?: number;
    results?: any;
    // retry?: number; // TODO
}

export enum PushDepExecutionState {
    pending = 1,
    active = 2,
    completed = 3,
    canceled = 4,
    failed = 5
}

export interface PushDepTaskCount {
    pending: number;
    active: number;
    completed: number;
    canceled: number;
    failed: number;
    all: number;
}

export interface PushDepTaskExecution {
    task: PushDepTask;
    state?: PushDepExecutionState;
    createdAt?: Date;
    startedAt?: Date;
    completedAt?: Date;
    canceledAt?: Date;
    failedAt?: Date;
}

export class PushDepTaskExecutionBuilder {
    static build(task: PushDepTask): PushDepTaskExecution {
        return {
            task: task,
            state: PushDepExecutionState.pending,
            createdAt: new Date()
        }
    }
}

export interface PushDep {
    setKindAsync(kind: PushDepKind): Promise<void>;
    getKindAsync(kind: string): Promise<PushDepKind>;
    pushAsync(task: PushDepTask): Promise<string>;
    peekAsync(kind: string): Promise<PushDepTask>;
    countAsync(kind: string): Promise<PushDepTaskCount>;
    popAsync(kind: string): Promise<PushDepTask>;
    startAsync(kind: string): Promise<PushDepTask>;
    completeAsync(task: PushDepTask): Promise<void>;
    cancelAsync(task: PushDepTask): Promise<void>;
    failAsync(task: PushDepTask): Promise<void>;
}
