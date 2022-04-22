export class PushDepKind {
    kind: string;
    concurrency?: number = 1;
    retry?: number;
}

export class PushDepTask {
    id?: string;
    kind: string;
    dependencyIds?: string[];
    args?: any;
    // retry?: number; // TODO
}

export enum PushDepLifecycleState {
    pending,
    active,
    completed,
    canceled,
    failed
}

export class PushDepTaskExecutionLifecycle {
    task: PushDepTask;
    state: PushDepLifecycleState;
    createdAt: Date;
    startedAt: Date;
    completedAt: Date;
    canceledAt: Date;
    failedAt: Date;
    error: any;
}

export interface PushDep {
    pushAsync(options: PushDepTask): Promise<string>;
    popAsync(kind: string): Promise<PushDepTask>;
}
