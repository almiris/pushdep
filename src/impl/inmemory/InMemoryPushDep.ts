import { v4 as uuidv4 } from "uuid";
import { AllowedStateTransitions, PushDep, PushDepExecutionState, PushDepKind, PushDepTask, PushDepTaskCount, PushDepTaskExecution, PushDepTaskExecutionBuilder } from "../../core/PushDep";

type KindsMappedByKind = Record<string, PushDepKind>;

type TaskExecutionsMappedByTaskId = Record<string, PushDepTaskExecution>;

type TaskExecutionsMappedByTaskKindOrderedByPushTime = Record<string, PushDepTaskExecution[]>;

type TaskExecutionsMappedByTaskKindMappedByTaskId = Record<string, TaskExecutionsMappedByTaskId>;

type TaskExecutionsMappedByTaskPriorityMappedByTaskKindOrderedByPushTime = Record<string, TaskExecutionsMappedByTaskKindOrderedByPushTime>;

type TaskExecutionsMappedByTaskPriorityMappedByTaskKindMappedByTaskId = Record<string, TaskExecutionsMappedByTaskKindMappedByTaskId>;

interface InMemoryTask extends PushDepTask {
    id: string;
}

class InMemoryTaskExecutionService {
    kinds: KindsMappedByKind = {};
    pendingTaskExecutions: TaskExecutionsMappedByTaskPriorityMappedByTaskKindOrderedByPushTime = {};
    activeTaskExecutions: TaskExecutionsMappedByTaskPriorityMappedByTaskKindMappedByTaskId = {};
    completedTaskExecutions: TaskExecutionsMappedByTaskPriorityMappedByTaskKindMappedByTaskId = {};
    canceledTaskExecutions: TaskExecutionsMappedByTaskPriorityMappedByTaskKindMappedByTaskId = {};
    failedTaskExecutions: TaskExecutionsMappedByTaskPriorityMappedByTaskKindMappedByTaskId = {};
    allTaskExecutions: TaskExecutionsMappedByTaskId = {};

    setKind(kind: PushDepKind): void {
        this.kinds[kind.id] = kind;
    }

    getKind(kindId: string): PushDepKind {
        return this.kinds[kindId] || null;
    }

    push(task: PushDepTask): PushDepTask {
        return this.doPush(task);
    }

    doPush(task: PushDepTask): PushDepTask {
        if (!task.id) {
            (task as InMemoryTask).id = uuidv4();
            task.dependencies = this.doPushDependencies(task.dependencies);
            task.priority = task.priority || 1;
            const taskExecution = PushDepTaskExecutionBuilder.build(task);
            this.doPushMappedByTaskKindOrderedByPushTime(taskExecution, this.pendingTaskExecutions);
            this.allTaskExecutions[task.id] = taskExecution;
        } 
        return task;
    }

    doPushMappedByTaskKindOrderedByPushTime(taskExecution: PushDepTaskExecution, taskExecutions: TaskExecutionsMappedByTaskPriorityMappedByTaskKindOrderedByPushTime): void {
        this.ensurePriorityAndKind(taskExecution, taskExecutions);
        taskExecutions[taskExecution.task.priority][taskExecution.task.kindId].push(taskExecution);
    }

    doPushMappedByTaskKindMappedByTaskId(taskExecution: PushDepTaskExecution, taskExecutions: TaskExecutionsMappedByTaskPriorityMappedByTaskKindMappedByTaskId): void {
        this.ensurePriorityAndKind(taskExecution, taskExecutions);
        taskExecutions[taskExecution.task.priority][taskExecution.task.kindId][taskExecution.task.id] = taskExecution;
    }

    ensurePriorityAndKind(taskExecution: PushDepTaskExecution, taskExecutions: TaskExecutionsMappedByTaskPriorityMappedByTaskKindOrderedByPushTime | TaskExecutionsMappedByTaskPriorityMappedByTaskKindMappedByTaskId): void {
        const priority = String(taskExecution.task.priority);
        const kindId = taskExecution.task.kindId;
        taskExecutions[priority] = taskExecutions[priority] || {};
        taskExecutions[priority][kindId] = taskExecutions[priority][kindId] || [];
    }

    doPushDependencies(dependencies?: PushDepTask[]): PushDepTask[] {
        if (!dependencies) {
            return null;
        }

        const tasks: PushDepTask[] = [];
        for (const task of dependencies) {
            tasks.push(task.id ? task : this.doPush(task));
        }
        return tasks;
    }

    count(kindId: string): PushDepTaskCount {
        const count: PushDepTaskCount = {
            pending: this.countMappedByTaskKindOrderedByPushTime(kindId, this.pendingTaskExecutions),
            active: this.countMappedByTaskKindMappedByTaskId(kindId, this.activeTaskExecutions),
            completed: this.countMappedByTaskKindMappedByTaskId(kindId, this.completedTaskExecutions),
            canceled: this.countMappedByTaskKindMappedByTaskId(kindId, this.canceledTaskExecutions),
            failed: this.countMappedByTaskKindMappedByTaskId(kindId, this.failedTaskExecutions),
            all: 0
        };
        count.all = count.pending + count.active + count.completed + count.canceled + count.failed;
        return count;
    }

    countMappedByTaskKindOrderedByPushTime(kindId: string, taskExecutions: TaskExecutionsMappedByTaskPriorityMappedByTaskKindOrderedByPushTime): number {
        return Object.keys(taskExecutions).reduce((result: number, priority: string) => 
            result + (taskExecutions[priority][kindId]?.length || 0), 0);
    }

    countMappedByTaskKindMappedByTaskId(kindId: string, taskExecutions: TaskExecutionsMappedByTaskPriorityMappedByTaskKindMappedByTaskId): number {
        return Object.keys(taskExecutions).reduce((result: number, priority: string) => 
            result + (taskExecutions[priority][kindId] ? Object.keys(taskExecutions[priority][kindId]).length : 0), 0);
    }

    peek(kindId: string): PushDepTask {
        return this.findByKind(kindId, this.pendingTaskExecutions, false)?.task || null;
    }

    findByKind(kindId: string, taskExecutions: TaskExecutionsMappedByTaskPriorityMappedByTaskKindOrderedByPushTime, pop = false): PushDepTaskExecution {
        const priorities = Object.keys(taskExecutions);
        if (priorities.length !== 0) {
            const prioritiesDesc = priorities.map(p => Number(p)).sort((a, b) => b - a);
            for (const priority of prioritiesDesc) {
                const taskExecutionsForPriorityAndKind: PushDepTaskExecution[] = taskExecutions[priority][kindId];
                if (taskExecutionsForPriorityAndKind) {
                    const index = taskExecutionsForPriorityAndKind.findIndex((taskExecution: PushDepTaskExecution) => !taskExecution.task.dependencies 
                    || taskExecution.task.dependencies.every(task => !this.allTaskExecutions[task.id] || (this.allTaskExecutions[task.id].state !== PushDepExecutionState.pending && this.allTaskExecutions[task.id].state !== PushDepExecutionState.active)));
                    if (index !== -1) {
                        const taskExecution = taskExecutionsForPriorityAndKind[index];
                        if (pop) {
                            taskExecutionsForPriorityAndKind.splice(index, 1);
                        }
                        return taskExecution;
                    }
                }
            }
        }
        return null;
    }

    start(kindId: string): PushDepTask {
        const concurrency = this.kinds[kindId]?.concurrency;
        let task: PushDepTask = null;
        if (this.countMappedByTaskKindMappedByTaskId(kindId, this.activeTaskExecutions) < concurrency) {
            task = this.findByKind(kindId, this.pendingTaskExecutions, true)?.task || null;
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
        const taskExecution = this.allowTaskExecutionStateTransition(task, state);
        if (taskExecution.state === PushDepExecutionState.active) { // deleting a pending task is already done by start()
            delete this.activeTaskExecutions[task.priority][task.kindId][task.id];
        }
        taskExecution.state = state;
        taskExecution.task = task;
        switch (state) {
            case PushDepExecutionState.pending: 
                taskExecution.startedAt = null;
                taskExecution.completedAt = null;
                taskExecution.canceledAt = null;
                taskExecution.failedAt = null;
                this.doPushMappedByTaskKindOrderedByPushTime(taskExecution, this.pendingTaskExecutions);
                break;
            case PushDepExecutionState.active: 
                taskExecution.startedAt = new Date();
                this.doPushMappedByTaskKindMappedByTaskId(taskExecution, this.activeTaskExecutions);
                break;
            case PushDepExecutionState.completed: 
                taskExecution.completedAt = new Date();
                this.doPushMappedByTaskKindMappedByTaskId(taskExecution, this.completedTaskExecutions);
                break;
            case PushDepExecutionState.canceled: 
                taskExecution.canceledAt = new Date();
                this.doPushMappedByTaskKindMappedByTaskId(taskExecution, this.canceledTaskExecutions);
                break;
            case PushDepExecutionState.failed: 
                taskExecution.failedAt = new Date();
                this.doPushMappedByTaskKindMappedByTaskId(taskExecution, this.failedTaskExecutions);
                break;
        }
    }

    allowTaskExecutionStateTransition(task: PushDepTask, state: PushDepExecutionState): PushDepTaskExecution {
        const taskExecution = this.allTaskExecutions[task.id];
        if (!taskExecution) {
            throw new Error(`Illegal state for task ${task.id}`);
        }
        if (!AllowedStateTransitions[taskExecution.state]?.includes(state)) {
            throw new Error(`Illegal state transition: ${PushDepExecutionState[taskExecution.state]} -> ${PushDepExecutionState[state]}`);
        }
        return taskExecution;
    }
}

export class InMemoryPushDep implements PushDep {
    inMemoryTaskExecutionService: InMemoryTaskExecutionService = new InMemoryTaskExecutionService();
    
    async setKindAsync(kind: PushDepKind): Promise<void> {
        this.inMemoryTaskExecutionService.setKind(kind);
    }

    async getKindAsync(kindId: string): Promise<PushDepKind> {
        return this.inMemoryTaskExecutionService.getKind(kindId);
    }

    async pushAsync(task: PushDepTask): Promise<PushDepTask> {
        return this.inMemoryTaskExecutionService.push(task);
    }

    async countAsync(kindId: string): Promise<PushDepTaskCount> {
        return this.inMemoryTaskExecutionService.count(kindId);
    }

    async peekAsync(kindId: string): Promise<PushDepTask> {
        return this.inMemoryTaskExecutionService.peek(kindId);
    }

    async startAsync(kindId: string): Promise<PushDepTask> {
        return this.inMemoryTaskExecutionService.start(kindId);
    }

    async completeAsync(task: PushDepTask): Promise<void> {
        return this.inMemoryTaskExecutionService.complete(task);
    }

    async cancelAsync(task: PushDepTask): Promise<void> {
        return this.inMemoryTaskExecutionService.cancel(task);
    }

    async failAsync(task: PushDepTask): Promise<void> {
        return this.inMemoryTaskExecutionService.fail(task);
    }

    async returnAsync(task: PushDepTask): Promise<void> {
        return this.inMemoryTaskExecutionService.return(task);
    }
}
