import { v4 as uuidv4 } from 'uuid';
import { PushDep, PushDepExecutionState, PushDepKind, PushDepTask, PushDepTaskCount, PushDepTaskExecution } from "./PushDep";

type KindsMappedByKind = { 
    [kind: string]: PushDepKind
}

type TasksMappedByKindOrderedByPushTime = {
    [kind: string]: PushDepTaskExecution[]
}

type TasksMappedByPriority = {
    [priority: number]: TasksMappedByKindOrderedByPushTime
}

type TasksMappedById = { 
    [id: string]: PushDepTaskExecution 
}

class InMemoryTasks {
    kinds: KindsMappedByKind = {};
    pendingTasks: TasksMappedByPriority = {};
    activeTasks: TasksMappedByPriority = {};
    completedTasks: TasksMappedByPriority = {};
    canceledTasks: TasksMappedByPriority = {};
    failedTasks: TasksMappedByPriority = {};
    allTasks: TasksMappedById = {};

    constructor() {}

    setKind(kind: PushDepKind): void {
        this.kinds[kind.kind] = kind;
    }

    push(task: PushDepTask): void {
        const taskExecution = this.allTasks[task.id];
        if (!taskExecution) {
            const taskExecution = PushDepTaskExecution.build(Object.assign(new PushDepTask(), task));
            this.pushByPriority(taskExecution, this.pendingTasks);
            this.allTasks[task.id] = taskExecution;
        } 
        else if (taskExecution.state === PushDepExecutionState.active) {
            this.changeTaskState(taskExecution.task, PushDepExecutionState.pending);
        } 
        else if (taskExecution.state === PushDepExecutionState.pending) {
            if (task.kind !== taskExecution.task.kind
                || task.priority !== taskExecution.task.priority) {
                this.remove(taskExecution, this.pendingTasks);
                taskExecution.task = task;
                this.pushByPriority(taskExecution, this.pendingTasks);
            }
            else {
                taskExecution.task = task;
            }
        }
    }

    pushByPriority(taskExecution: PushDepTaskExecution, tasks: TasksMappedByPriority): void {
        const tasksForPriority = tasks[taskExecution.task.priority] || {};
        this.pushByKind(taskExecution, tasksForPriority);
        tasks[taskExecution.task.priority] = tasksForPriority;
    }

    pushByKind(taskExecution: PushDepTaskExecution, tasks: TasksMappedByKindOrderedByPushTime): void {
        const tasksForKind = tasks[taskExecution.task.kind] || [];
        tasksForKind.push(taskExecution);
        tasks[taskExecution.task.kind] = tasksForKind;
    }

    count(kind: string): PushDepTaskCount {
        return {
            pending: this.countByKind(kind, this.pendingTasks),
            active: this.countByKind(kind, this.activeTasks),
            completed: this.countByKind(kind, this.completedTasks),
            canceled: this.countByKind(kind, this.canceledTasks),
            failed: this.countByKind(kind, this.failedTasks),
            all: Object.keys(this.allTasks).length
        };
    }

    countByKind(kind: string, tasks: TasksMappedByPriority): number {
        return Object.keys(tasks).reduce((result: number, priority: string) => 
            result + (tasks[priority][kind]?.length || 0), 0);
    }

    peek(kind: string): PushDepTask {
        return this.findByKind(kind, this.pendingTasks, false)?.task || null;
    }

    /**
     * Important: if a task is popped, it is not deleted in other task dependencies
     * (else we would have to maintain a parent array in each tasks)
     * @param kind
     * @returns 
     */
    pop(kind: string): PushDepTask {
        const task = this.findByKind(kind, this.pendingTasks, true);
        if (task) {
            delete this.allTasks[task.task.id];
        }
        return task?.task || null;
    }

    findByKind(kind: string, tasks: TasksMappedByPriority, pop: boolean = false): PushDepTaskExecution {
        const keys = Object.keys(this.pendingTasks);
        if (keys.length !== 0) {
            const prioritiesDesc = keys.map(p => Number(p)).sort((a, b) => b - a);
            for (let priority of prioritiesDesc) {
                const tasksForPriorityAndKind: PushDepTaskExecution[] = tasks[priority][kind];
                if (tasksForPriorityAndKind) {
                    const index = tasksForPriorityAndKind.findIndex((taskExecution: PushDepTaskExecution, i: number) => !taskExecution.task.dependencyIds 
                    || taskExecution.task.dependencyIds.every(id => !this.allTasks[id] || (this.allTasks[id].state !== PushDepExecutionState.pending && this.allTasks[id].state !== PushDepExecutionState.active)));
                    if (index !== -1) {
                        const task = tasksForPriorityAndKind[index];
                        if (pop) {
                            tasksForPriorityAndKind.splice(index, 1);
                        }
                        return task;
                    }
                }
            }
        }
        return null;
    }

    start(kind: string): PushDepTask {
        const concurrency = this.kinds[kind]?.concurrency;
        if (this.countByKind(kind, this.activeTasks) >= concurrency) {
            return null;
        }

        const task = this.findByKind(kind, this.pendingTasks, true)?.task || null;
        if (task) {
            this.changeTaskState(task, PushDepExecutionState.active);
        }
        return task;
    }

    complete(task: PushDepTask): void {
        this.changeTaskState(task, PushDepExecutionState.completed);
    }

    cancel(task: PushDepTask): void {
        this.changeTaskState(task, PushDepExecutionState.canceled);
    }

    fail(task: PushDepTask): void {
        this.changeTaskState(task, PushDepExecutionState.failed);
    }

    /**
     * This will not be efficient with a lot of tasks...
     * TODO use treemap for pending tasks and simple maps for other collections? set taskExecution.task to null?
     * @param taskExecution 
     * @param tasks 
     */
    remove(taskExecution: PushDepTaskExecution, tasks: TasksMappedByPriority): void {
        const index = tasks[taskExecution.task.priority][taskExecution.task.kind].findIndex(te => te.task.id === taskExecution.task.id);
        tasks[taskExecution.task.priority][taskExecution.task.kind].splice(index, 1);
    }

    changeTaskState(task: PushDepTask, state: PushDepExecutionState): void {
        const taskExecution = this.allTasks[task.id];
        if (!taskExecution) {
            throw new Error(`Incorrect state change for task ${task.id}`);
        }
        const previousState = taskExecution.state;
        taskExecution.state = state;
        taskExecution.task = task;
        switch (state) {
            case PushDepExecutionState.pending: 
                if (previousState === PushDepExecutionState.active) {
                    this.remove(taskExecution, this.activeTasks);
                    taskExecution.startedAt = null;
                    this.pushByPriority(taskExecution, this.pendingTasks);
                }
                else if (previousState === PushDepExecutionState.pending) {
                    this.remove(taskExecution, this.pendingTasks);
                    this.pushByPriority(taskExecution, this.pendingTasks);    
                }
                break;
            case PushDepExecutionState.active: 
                // already removed from pendings by findByKind()
                taskExecution.startedAt = new Date();
                this.pushByPriority(taskExecution, this.activeTasks);
                break;
            case PushDepExecutionState.completed: 
                this.remove(taskExecution, this.activeTasks);
                taskExecution.completedAt = new Date();
                this.pushByPriority(taskExecution, this.completedTasks);
                break;
            case PushDepExecutionState.canceled: 
                this.remove(taskExecution, this.activeTasks);
                taskExecution.canceledAt = new Date();
                this.pushByPriority(taskExecution, this.canceledTasks);
                break;
            case PushDepExecutionState.failed: 
                this.remove(taskExecution, this.activeTasks);
                taskExecution.failedAt = new Date();
                this.pushByPriority(taskExecution, this.failedTasks);
                break;
            default:
                throw new Error(`Incorrect task state: ${state}`);
        };
    }
}

export class InMemoryPushDep implements PushDep {
    tasks: InMemoryTasks = new InMemoryTasks();
    
    async setKindAsync(kind: PushDepKind): Promise<void> {
        this.tasks.setKind(kind);
    }

    async pushAsync(task: PushDepTask): Promise<string> {
        task.id = task.id || uuidv4();
        this.tasks.push(task);
        return task.id;
    }

    async peekAsync(kind: string): Promise<PushDepTask> {
        return this.tasks.peek(kind);
    }

    async countAsync(kind: string): Promise<PushDepTaskCount> {
        return this.tasks.count(kind);
    }

    async popAsync(kind: string): Promise<PushDepTask> {
        return this.tasks.pop(kind);
    }

    async startAsync(kind: string): Promise<PushDepTask> {
        return this.tasks.start(kind);
    }

    async completeAsync(task: PushDepTask): Promise<void> {
        return this.tasks.complete(task);
    }

    async cancelAsync(task: PushDepTask): Promise<void> {
        return this.tasks.cancel(task);
    }

    async failAsync(task: PushDepTask): Promise<void> {
        return this.tasks.fail(task);
    }
}
