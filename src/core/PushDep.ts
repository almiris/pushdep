export interface PushDepKind {
    id: string;
    concurrency: number;
    // retry?: number; // TODO
}

export interface PushDepTask {
    readonly id?: string;
    kindId: string;
    dependencies?: PushDepTask[];
    args?: any;
    priority?: number;
    results?: any;
    // retry?: number; // TODO
}

export const PushDepTaskProperties: PushDepTask = {
    id: null,
    kindId: null,
    dependencies: null,
    args: null,
    priority: null,
    results: null
};

export enum PushDepExecutionState {
    pending = 1,
    active = 2,
    completed = 3,
    canceled = 4,
    failed = 5
}

export const AllowedStateTransitions: Partial<Record<PushDepExecutionState, PushDepExecutionState[]>> = {
    [PushDepExecutionState.pending]: [ PushDepExecutionState.active ],
    [PushDepExecutionState.active]: [ PushDepExecutionState.pending, PushDepExecutionState.completed, PushDepExecutionState.canceled, PushDepExecutionState.failed]
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
    getKindAsync(kindId: string): Promise<PushDepKind>;
    pushAsync(task: PushDepTask): Promise<PushDepTask>;
    countAsync(kindId?: string): Promise<PushDepTaskCount>;
    peekAsync(kindId: string): Promise<PushDepTask>;
    startAsync(kindId: string): Promise<PushDepTask>;
    completeAsync(task: PushDepTask): Promise<void>;
    cancelAsync(task: PushDepTask): Promise<void>;
    failAsync(task: PushDepTask): Promise<void>;
    returnAsync(task: PushDepTask): Promise<void>;
}
