import { v4 as uuidv4 } from "uuid";
import { AllowedStateTransitions, PushDep, PushDepExecutionState, PushDepKind, PushDepTask, PushDepTaskCount, PushDepTaskExecution } from "../../core/PushDep";

type KindsMappedByKind = Record<string, PushDepKind>;

type TasksMappedByTaskId = Record<string, InMemoryTask>;

type TasksMappedByTaskKindOrderedByPushTime = Record<string, InMemoryTask[]>;

type TasksMappedByTaskKindMappedByTaskId = Record<string, TasksMappedByTaskId>;

type TasksMappedByTaskPriorityMappedByTaskKindOrderedByPushTime = Record<string, TasksMappedByTaskKindOrderedByPushTime>;

type TasksMappedByTaskPriorityMappedByTaskKindMappedByTaskId = Record<string, TasksMappedByTaskKindMappedByTaskId>;

interface InMemoryTask extends PushDepTask, PushDepTaskExecution {
    id: string;
}

class InMemoryTaskService {
    kinds: KindsMappedByKind = {};
    pendingTasks: TasksMappedByTaskPriorityMappedByTaskKindOrderedByPushTime = {};
    activeTasks: TasksMappedByTaskPriorityMappedByTaskKindMappedByTaskId = {};
    completedTasks: TasksMappedByTaskPriorityMappedByTaskKindMappedByTaskId = {};
    canceledTasks: TasksMappedByTaskPriorityMappedByTaskKindMappedByTaskId = {};
    failedTasks: TasksMappedByTaskPriorityMappedByTaskKindMappedByTaskId = {};
    allTasks: TasksMappedByTaskId = {};

    setKind(kind: PushDepKind): void {
        this.kinds[kind.id] = kind;
    }

    getKind(kindId: string): PushDepKind {
        return this.kinds[kindId] || null;
    }

    push(task: PushDepTask): PushDepTask {
        return this.doPush(task as InMemoryTask);
    }

    doPush(task: InMemoryTask): InMemoryTask {
        if (!task.id) {
            task.id= uuidv4();
            task.dependencies = this.doPushDependencies(task.dependencies as InMemoryTask[]);
            task.priority = task.priority || 1;
            task.state = PushDepExecutionState.pending;
            task.createdAt = new Date();
            this.doPushMappedByTaskKindOrderedByPushTime(task, this.pendingTasks);
            this.allTasks[task.id] = task;
        } 
        return task;
    }

    doPushMappedByTaskKindOrderedByPushTime(task: InMemoryTask, tasks: TasksMappedByTaskPriorityMappedByTaskKindOrderedByPushTime): void {
        this.ensurePriorityAndKind(task, tasks);
        tasks[task.priority][task.kindId].push(task);
    }

    doPushMappedByTaskKindMappedByTaskId(task: InMemoryTask, tasks: TasksMappedByTaskPriorityMappedByTaskKindMappedByTaskId): void {
        this.ensurePriorityAndKind(task, tasks);
        tasks[task.priority][task.kindId][task.id] = task;
    }

    ensurePriorityAndKind(task: InMemoryTask, tasks: TasksMappedByTaskPriorityMappedByTaskKindOrderedByPushTime | TasksMappedByTaskPriorityMappedByTaskKindMappedByTaskId): void {
        const priority = String(task.priority);
        const kindId = task.kindId;
        tasks[priority] = tasks[priority] || {};
        tasks[priority][kindId] = tasks[priority][kindId] || [];
    }

    doPushDependencies(dependencies?: InMemoryTask[]): InMemoryTask[] {
        if (!dependencies) {
            return null;
        }

        const tasks: InMemoryTask[] = [];
        for (const task of dependencies) {
            tasks.push(task.id ? task : this.doPush(task));
        }
        return tasks;
    }

    count(kindId: string): PushDepTaskCount {
        const count: PushDepTaskCount = {
            pending: this.countMappedByTaskKindOrderedByPushTime(kindId, this.pendingTasks),
            active: this.countMappedByTaskKindMappedByTaskId(kindId, this.activeTasks),
            completed: this.countMappedByTaskKindMappedByTaskId(kindId, this.completedTasks),
            canceled: this.countMappedByTaskKindMappedByTaskId(kindId, this.canceledTasks),
            failed: this.countMappedByTaskKindMappedByTaskId(kindId, this.failedTasks),
            all: 0
        };
        count.all = count.pending + count.active + count.completed + count.canceled + count.failed;
        return count;
    }

    countMappedByTaskKindOrderedByPushTime(kindId: string, tasks: TasksMappedByTaskPriorityMappedByTaskKindOrderedByPushTime): number {
        return Object.keys(tasks).reduce((result: number, priority: string) => 
            result + (tasks[priority][kindId]?.length || 0), 0);
    }

    countMappedByTaskKindMappedByTaskId(kindId: string, tasks: TasksMappedByTaskPriorityMappedByTaskKindMappedByTaskId): number {
        return Object.keys(tasks).reduce((result: number, priority: string) => 
            result + (tasks[priority][kindId] ? Object.keys(tasks[priority][kindId]).length : 0), 0);
    }

    peek(kindId: string): PushDepTask {
        return this.findByKind(kindId, this.pendingTasks, false) as PushDepTask;
    }

    findByKind(kindId: string, tasks: TasksMappedByTaskPriorityMappedByTaskKindOrderedByPushTime, pop = false): InMemoryTask {
        const prioritiesDesc = Object.keys(tasks).map(p => Number(p)).sort((a, b) => b - a);
        for (const priority of prioritiesDesc) {
            const tasksForPriorityAndKind: InMemoryTask[] = tasks[priority][kindId];
            if (tasksForPriorityAndKind) {
                const index = tasksForPriorityAndKind.findIndex((task: InMemoryTask) => !task.dependencies 
                || task.dependencies.every(t => !this.allTasks[t.id] || (this.allTasks[t.id].state !== PushDepExecutionState.pending && this.allTasks[t.id].state !== PushDepExecutionState.active)));
                if (index !== -1) {
                    const task = tasksForPriorityAndKind[index];
                    if (pop) {
                        tasksForPriorityAndKind.splice(index, 1);
                    }
                    return task;
                }
            }
        }
        return null;
    }

    start(kindId: string): PushDepTask {
        const concurrency = this.kinds[kindId]?.concurrency;
        let task: PushDepTask = null;
        if (this.countMappedByTaskKindMappedByTaskId(kindId, this.activeTasks) < concurrency) {
            task = this.findByKind(kindId, this.pendingTasks, true);
            if (task) {
                this.changeTaskExecutionState(task, PushDepExecutionState.active);
            }
        }
        return task;
    }

    complete(task: PushDepTask): void {
        this.changeTaskExecutionState(task, PushDepExecutionState.completed);
    }

    cancel(task: PushDepTask): void {
        this.changeTaskExecutionState(task, PushDepExecutionState.canceled);
    }

    fail(task: PushDepTask): void {
        this.changeTaskExecutionState(task, PushDepExecutionState.failed);
    }

    return(task: PushDepTask): void {
        this.changeTaskExecutionState(task, PushDepExecutionState.pending);
    }

    /**
     * pending => active => pending | completed | canceled | failed
     * @param task 
     * @param state 
     */
    changeTaskExecutionState(task: PushDepTask, state: PushDepExecutionState): void {
        const t = this.allowTaskExecutionStateTransition(task, state);
        if (t.state === PushDepExecutionState.active) { // deleting a pending task is already done by start()
            delete this.activeTasks[task.priority][task.kindId][task.id];
        }
        t.state = state;
        switch (state) {
            case PushDepExecutionState.pending: 
                t.startedAt = null;
                t.completedAt = null;
                t.canceledAt = null;
                t.failedAt = null;
                this.doPushMappedByTaskKindOrderedByPushTime(t, this.pendingTasks);
                break;
            case PushDepExecutionState.active: 
                t.startedAt = new Date();
                this.doPushMappedByTaskKindMappedByTaskId(t, this.activeTasks);
                break;
            case PushDepExecutionState.completed: 
                t.completedAt = new Date();
                this.doPushMappedByTaskKindMappedByTaskId(t, this.completedTasks);
                break;
            case PushDepExecutionState.canceled: 
                t.canceledAt = new Date();
                this.doPushMappedByTaskKindMappedByTaskId(t, this.canceledTasks);
                break;
            case PushDepExecutionState.failed: 
                t.failedAt = new Date();
                this.doPushMappedByTaskKindMappedByTaskId(t, this.failedTasks);
                break;
        }
    }

    allowTaskExecutionStateTransition(task: PushDepTask, state: PushDepExecutionState): InMemoryTask {
        const t = this.allTasks[task.id];
        if (!t) {
            throw new Error(`Illegal state for task ${task.id}`);
        }
        if (!AllowedStateTransitions[t.state]?.includes(state)) {
            throw new Error(`Illegal state transition: ${PushDepExecutionState[t.state]} -> ${PushDepExecutionState[state]}`);
        }
        return t;
    }

    getTaskDependencies(task: PushDepTask): PushDepTask[] | null {
        let dependencies = null;
        if (task.id) {
            const t = this.allTasks[task.id];
            dependencies = t ? t.dependencies : null;
        }
        return dependencies;
    }
}

export class InMemoryPushDep implements PushDep {
    taskService: InMemoryTaskService = new InMemoryTaskService();

    async setKindAsync(kind: PushDepKind): Promise<void> {
        this.taskService.setKind(kind);
    }

    async getKindAsync(kindId: string): Promise<PushDepKind> {
        return this.taskService.getKind(kindId);
    }

    async pushAsync(task: PushDepTask): Promise<PushDepTask> {
        return this.taskService.push(task);
    }

    async countAsync(kindId: string): Promise<PushDepTaskCount> {
        return this.taskService.count(kindId);
    }

    async peekAsync(kindId: string): Promise<PushDepTask> {
        return this.taskService.peek(kindId);
    }

    async startAsync(kindId: string): Promise<PushDepTask> {
        return this.taskService.start(kindId);
    }

    async completeAsync(task: PushDepTask): Promise<void> {
        this.taskService.complete(task);
    }

    async cancelAsync(task: PushDepTask): Promise<void> {
        this.taskService.cancel(task);
    }

    async failAsync(task: PushDepTask): Promise<void> {
        this.taskService.fail(task);
    }

    async returnAsync(task: PushDepTask): Promise<void> {
        this.taskService.return(task);
    }

    async getTaskDependenciesAsync(task: PushDepTask): Promise<PushDepTask[] | null> {
        return this.taskService.getTaskDependencies(task);
    }
}
