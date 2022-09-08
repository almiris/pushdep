export interface PushDepKind {
    id: string;
    concurrency: number;
    lockTimeoutMs?: number;
    // retry?: number; // TODO
}

export interface PushDepTask {
    readonly id?: string;
    kindId: string;
    priority?: number;
    startAt?: Date;
    tag?: string;
    args?: any; // Must be an object, do not use simple string!
    results?: any; // Must be an object, do not use simple string!
    // retry?: number; // TODO
    dependencies?: PushDepTask[];
}

export const PushDepTaskProperties: PushDepTask = {
    id: null,
    kindId: null,
    priority: null,
    startAt: null,
    tag: null,
    args: null,
    results: null,
    dependencies: null
}

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
    getTaskDependenciesAsync(task: PushDepTask): Promise<PushDepTask[] | null>
}
