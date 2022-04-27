import "reflect-metadata";
import { DataSource, Repository } from "typeorm";
import { v4 as uuidv4 } from "uuid";
import { PushDep, PushDepExecutionState, PushDepKind, PushDepTask, PushDepTaskCount, PushDepTaskExecution, PushDepTaskExecutionBuilder } from "../core/PushDep";
import { Kind } from "./Kind.entity";
import { Task } from "./Task.entity";

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

class TypeORMTasks {
    kinds: KindsMappedByKind = {};
    pendingTasks: TasksMappedByPriority = {};
    activeTasks: TasksMappedByPriority = {};
    completedTasks: TasksMappedByPriority = {};
    canceledTasks: TasksMappedByPriority = {};
    failedTasks: TasksMappedByPriority = {};
    allTasks: TasksMappedById = {};

    kindRepository: Repository<Kind>;

    constructor(private dataSource: DataSource) {
        this.kindRepository = dataSource.getRepository(Kind);
    }
    
    async setKind(kind: PushDepKind): Promise<void> {
        await this.kindRepository.save(kind);
    }

    async getKind(kind: string): Promise<PushDepKind> {
        return (await this.kindRepository.find({
            select: {
                name: true,
                concurrency : true
            },
            where: {
                name: kind
            }
        }))[0] || null;
    }
    
    async push(task: PushDepTask): Promise<void> {
        const taskExecution = this.allTasks[task.id];
        if (!taskExecution) {
            task.priority = task.priority || 1;
            const taskExecution = PushDepTaskExecutionBuilder.build(task);
            await this.pushByPriority(taskExecution, this.pendingTasks);
            this.allTasks[task.id] = taskExecution;
        } 
        else if (taskExecution.state === PushDepExecutionState.active) {
            await this.changeTaskState(taskExecution.task, PushDepExecutionState.pending);
        } 
        else if (taskExecution.state === PushDepExecutionState.pending) {
            if (task.kindId !== taskExecution.task.kindId
                || task.priority !== taskExecution.task.priority) {
                await this.remove(taskExecution, this.pendingTasks);
                taskExecution.task = task;
                await this.pushByPriority(taskExecution, this.pendingTasks);
            }
            else {
                taskExecution.task = task;
            }
        }
    }

    async pushByPriority(taskExecution: PushDepTaskExecution, tasks: TasksMappedByPriority): Promise<void> {
        const tasksForPriority = tasks[taskExecution.task.priority] || {};
        await this.pushByKind(taskExecution, tasksForPriority);
        tasks[taskExecution.task.priority] = tasksForPriority;
    }

    async pushByKind(taskExecution: PushDepTaskExecution, tasks: TasksMappedByKindOrderedByPushTime): Promise<void> {
        const tasksForKind = tasks[taskExecution.task.kindId] || [];
        tasksForKind.push(taskExecution);
        tasks[taskExecution.task.kindId] = tasksForKind;
    }

    async count(kind: string): Promise<PushDepTaskCount> {
        return {
            pending: await this.countByKind(kind, this.pendingTasks),
            active: await this.countByKind(kind, this.activeTasks),
            completed: await this.countByKind(kind, this.completedTasks),
            canceled: await this.countByKind(kind, this.canceledTasks),
            failed: await this.countByKind(kind, this.failedTasks),
            all: Object.keys(this.allTasks).length
        };
    }

    async countByKind(kind: string, tasks: TasksMappedByPriority): Promise<number> {
        return Object.keys(tasks).reduce((result: number, priority: string) => 
            result + (tasks[priority][kind]?.length || 0), 0);
    }

    async peek(kind: string): Promise<PushDepTask> {
        return (await this.findByKind(kind, this.pendingTasks, false))?.task || null;
    }

    /**
     * Important: if a task is popped, it is not deleted in other task dependencies
     * (else we would have to maintain a parent array in each tasks)
     * @param kind
     * @returns 
     */
    async pop(kind: string): Promise<PushDepTask> {
        const task = await this.findByKind(kind, this.pendingTasks, true);
        if (task) {
            delete this.allTasks[task.task.id];
        }
        return task?.task || null;
    }

    async findByKind(kind: string, tasks: TasksMappedByPriority, pop = false): Promise<PushDepTaskExecution> {
        const keys = Object.keys(this.pendingTasks);
        if (keys.length !== 0) {
            const prioritiesDesc = keys.map(p => Number(p)).sort((a, b) => b - a);
            for (const priority of prioritiesDesc) {
                const tasksForPriorityAndKind: PushDepTaskExecution[] = tasks[priority][kind];
                if (tasksForPriorityAndKind) {
                    const index = tasksForPriorityAndKind.findIndex((taskExecution: PushDepTaskExecution) => !taskExecution.task.dependencies 
                    || taskExecution.task.dependencies.every(id => !this.allTasks[id] || (this.allTasks[id].state !== PushDepExecutionState.pending && this.allTasks[id].state !== PushDepExecutionState.active)));
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

    async start(kind: string): Promise<PushDepTask> {
        const concurrency = this.kinds[kind]?.concurrency;
        if (await this.countByKind(kind, this.activeTasks) >= concurrency) {
            return null;
        }

        const task = (await this.findByKind(kind, this.pendingTasks, true))?.task || null;
        if (task) {
            await this.changeTaskState(task, PushDepExecutionState.active);
        }
        return task;
    }

    async complete(task: PushDepTask): Promise<void> {
        await this.changeTaskState(task, PushDepExecutionState.completed);
    }

    async cancel(task: PushDepTask): Promise<void> {
        await this.changeTaskState(task, PushDepExecutionState.canceled);
    }

    async fail(task: PushDepTask): Promise<void> {
        await this.changeTaskState(task, PushDepExecutionState.failed);
    }

    /**
     * This will not be efficient with a lot of tasks...
     * TODO use treemap for pending tasks and simple maps for other collections? set taskExecution.task to null?
     * @param taskExecution 
     * @param tasks 
     */
    async remove(taskExecution: PushDepTaskExecution, tasks: TasksMappedByPriority): Promise<void> {
        const index = tasks[taskExecution.task.priority][taskExecution.task.kindId].findIndex(te => te.task.id === taskExecution.task.id);
        tasks[taskExecution.task.priority][taskExecution.task.kindId].splice(index, 1);
    }

    async changeTaskState(task: PushDepTask, state: PushDepExecutionState): Promise<void> {
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
                    await this.remove(taskExecution, this.activeTasks);
                    taskExecution.startedAt = null;
                    await this.pushByPriority(taskExecution, this.pendingTasks);
                }
                else if (previousState === PushDepExecutionState.pending) {
                    await this.remove(taskExecution, this.pendingTasks);
                    await this.pushByPriority(taskExecution, this.pendingTasks);    
                }
                break;
            case PushDepExecutionState.active: 
                // already removed from pendings by findByKind()
                taskExecution.startedAt = new Date();
                await this.pushByPriority(taskExecution, this.activeTasks);
                break;
            case PushDepExecutionState.completed: 
                await this.remove(taskExecution, this.activeTasks);
                taskExecution.completedAt = new Date();
                await this.pushByPriority(taskExecution, this.completedTasks);
                break;
            case PushDepExecutionState.canceled: 
                await this.remove(taskExecution, this.activeTasks);
                taskExecution.canceledAt = new Date();
                await this.pushByPriority(taskExecution, this.canceledTasks);
                break;
            case PushDepExecutionState.failed: 
                await this.remove(taskExecution, this.activeTasks);
                taskExecution.failedAt = new Date();
                await this.pushByPriority(taskExecution, this.failedTasks);
                break;
            default:
                throw new Error(`Incorrect task state: ${state}`);
        }
    }
}

export class TypeORMPushDep implements PushDep {
    tasks: TypeORMTasks;

    constructor(private dataSource: DataSource) {
        this.tasks = new TypeORMTasks(dataSource);
    }
    
    async setKindAsync(kind: PushDepKind): Promise<void> {
        await this.tasks.setKind(kind);
    }

    async getKindAsync(kind: string): Promise<PushDepKind> {
        return await this.tasks.getKind(kind);
    }

    async pushAsync(task: PushDepTask): Promise<string> {
        const ormTask = task as Task;
        ormTask.id = ormTask.id || uuidv4(); // TODO supress || uuidv4()
        await this.tasks.push(ormTask);
        return ormTask.id;
    }

    async peekAsync(kind: string): Promise<PushDepTask> {
        return await this.tasks.peek(kind);
    }

    async countAsync(kind: string): Promise<PushDepTaskCount> {
        return await this.tasks.count(kind);
    }

    async popAsync(kind: string): Promise<PushDepTask> {
        return await this.tasks.pop(kind);
    }

    async startAsync(kind: string): Promise<PushDepTask> {
        return await this.tasks.start(kind);
    }

    async completeAsync(task: PushDepTask): Promise<void> {
        return await this.tasks.complete(task);
    }

    async cancelAsync(task: PushDepTask): Promise<void> {
        return await this.tasks.cancel(task);
    }

    async failAsync(task: PushDepTask): Promise<void> {
        return await this.tasks.fail(task);
    }
}
