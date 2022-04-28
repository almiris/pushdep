import "reflect-metadata";
import { DataSource, EntityManager } from "typeorm";
import { v4 as uuidv4 } from "uuid";
import { PushDep, PushDepExecutionState, PushDepKind, PushDepTask, PushDepTaskCount, PushDepTaskExecution, PushDepTaskExecutionBuilder } from "../../core/PushDep";
import { Kind } from "./entity/Kind.entity";
import { Task } from "./entity/Task.entity";
import { TaskExecution } from "./entity/TaskExecution.entity";
import { KindService } from "./service/KindService";
import { TaskExecutionService } from "./service/TaskExecutionService";
import { TaskService } from "./service/TaskService";

class TypeORMTaskManager {
    kindService: KindService;
    taskService: TaskService;
    taskExecutionService:TaskExecutionService;

    constructor(private dataSource: DataSource) {
        this.kindService = new KindService(dataSource.getRepository(Kind));
        this.taskService = new TaskService(dataSource.getRepository(Task));
        this.taskExecutionService = new TaskExecutionService(dataSource.getRepository(TaskExecution));
    }
    
    async setKindAsync(kind: PushDepKind): Promise<void> {
        await this.kindService.saveAsync(kind as Kind);
    }

    async getKindAsync(kindId: string): Promise<PushDepKind> {
        return await this.kindService.findAsync(kindId);
    }
    
    async pushAsync(task: PushDepTask): Promise<PushDepTask> {
        return await this.dataSource.transaction(async (transactionalEntityManager: EntityManager) => {
            const taskService = new TaskService(transactionalEntityManager.getRepository(Task));
            const taskExecutionService = new TaskExecutionService(transactionalEntityManager.getRepository(TaskExecution));
            return await this.doPushAsync(taskService, taskExecutionService, task);
        });
    }

    async doPushAsync(taskService: TaskService, taskExecutionService: TaskExecutionService, task: PushDepTask): Promise<Task> {
        if (!task.id) {
            task.dependencies = await this.doPushDependenciesAsync(taskService, taskExecutionService, task.dependencies);
            task.priority = task.priority || 1;
            const taskExecution = PushDepTaskExecutionBuilder.build(task);
            await taskService.saveAsync(task as Task);
            await taskExecutionService.saveAsync(taskExecution as TaskExecution);
            return task as Task;
        }
        else {
            return null;
        }
    }

    async doPushDependenciesAsync(taskService: TaskService, taskExecutionService: TaskExecutionService, dependencies?: PushDepTask[]): Promise<Task[]> {
        if (!dependencies) {
            return null;
        }

        const tasks: Task[] = [];
        for (const task of dependencies) {
            tasks.push(task.id ? task as Task : await this.doPushAsync(taskService, taskExecutionService, task));
        }
        return tasks;
    }

    async count(kindId?: string): Promise<PushDepTaskCount> {
        return await this.taskExecutionService.countAsync(kindId); 
    }

    async peek(kindId: string): Promise<PushDepTask> {
        return await this.taskService.findPendingTaskWithHighestPriorityAndNoPendingOrActiveDependency(kindId);
    }

    // async start(kindId: string): Promise<PushDepTask> {
    //     const concurrency = this.kinds[kind]?.concurrency;
    //     if (await this.countByKind(kind, this.activeTasks) >= concurrency) {
    //         return null;
    //     }

    //     const task = (await this.findByKind(kind, this.pendingTasks, true))?.task || null;
    //     if (task) {
    //         await this.changeTaskState(task, PushDepExecutionState.active);
    //     }
    //     return task;
    // }

    // async complete(task: PushDepTask): Promise<void> {
    //     await this.changeTaskState(task, PushDepExecutionState.completed);
    // }

    // async cancel(task: PushDepTask): Promise<void> {
    //     await this.changeTaskState(task, PushDepExecutionState.canceled);
    // }

    // async fail(task: PushDepTask): Promise<void> {
    //     await this.changeTaskState(task, PushDepExecutionState.failed);
    // }

    // /**
    //  * This will not be efficient with a lot of tasks...
    //  * TODO use treemap for pending tasks and simple maps for other collections? set taskExecution.task to null?
    //  * @param taskExecution 
    //  * @param tasks 
    //  */
    // async remove(taskExecution: PushDepTaskExecution, tasks: TasksMappedByPriority): Promise<void> {
    //     const index = tasks[taskExecution.task.priority][taskExecution.task.kindId].findIndex(te => te.task.id === taskExecution.task.id);
    //     tasks[taskExecution.task.priority][taskExecution.task.kindId].splice(index, 1);
    // }

    // async changeTaskState(task: PushDepTask, state: PushDepExecutionState): Promise<void> {
    //     // const taskExecution = this.allTasks[task.id];
    //     // if (!taskExecution) {
    //     //     throw new Error(`Incorrect state change for task ${task.id}`);
    //     // }
    //     // const previousState = taskExecution.state;
    //     // taskExecution.state = state;
    //     // taskExecution.task = task;
    //     // switch (state) {
    //     //     case PushDepExecutionState.pending: 
    //     //         if (previousState === PushDepExecutionState.active) {
    //     //             await this.remove(taskExecution, this.activeTasks);
    //     //             taskExecution.startedAt = null;
    //     //             await this.pushByPriority(taskExecution, this.pendingTasks);
    //     //         }
    //     //         else if (previousState === PushDepExecutionState.pending) {
    //     //             await this.remove(taskExecution, this.pendingTasks);
    //     //             await this.pushByPriority(taskExecution, this.pendingTasks);    
    //     //         }
    //     //         break;
    //     //     case PushDepExecutionState.active: 
    //     //         // already removed from pendings by findByKind()
    //     //         taskExecution.startedAt = new Date();
    //     //         await this.pushByPriority(taskExecution, this.activeTasks);
    //     //         break;
    //     //     case PushDepExecutionState.completed: 
    //     //         await this.remove(taskExecution, this.activeTasks);
    //     //         taskExecution.completedAt = new Date();
    //     //         await this.pushByPriority(taskExecution, this.completedTasks);
    //     //         break;
    //     //     case PushDepExecutionState.canceled: 
    //     //         await this.remove(taskExecution, this.activeTasks);
    //     //         taskExecution.canceledAt = new Date();
    //     //         await this.pushByPriority(taskExecution, this.canceledTasks);
    //     //         break;
    //     //     case PushDepExecutionState.failed: 
    //     //         await this.remove(taskExecution, this.activeTasks);
    //     //         taskExecution.failedAt = new Date();
    //     //         await this.pushByPriority(taskExecution, this.failedTasks);
    //     //         break;
    //     //     default:
    //     //         throw new Error(`Incorrect task state: ${state}`);
    //     // }
    // }
}

export class TypeORMPushDep implements PushDep {
    taskManager: TypeORMTaskManager;

    constructor(private dataSource: DataSource) {
        this.taskManager = new TypeORMTaskManager(dataSource);
    }
    
    async setKindAsync(kind: PushDepKind): Promise<void> {
        await this.taskManager.setKindAsync(kind);
    }

    async getKindAsync(kindId: string): Promise<PushDepKind> {
        return await this.taskManager.getKindAsync(kindId);
    }

    async pushAsync(task: PushDepTask): Promise<PushDepTask> {
        return await this.taskManager.pushAsync(task);
    }

    async countAsync(kindId?: string): Promise<PushDepTaskCount> {
        return await this.taskManager.count(kindId);
    }

    async peekAsync(kindId: string): Promise<PushDepTask> {
        return await this.taskManager.peek(kindId);
    }

    async startAsync(kindId: string): Promise<PushDepTask> {
        throw new Error("not implemented");
        // return await this.taskManager.start(kindId);
    }

    async completeAsync(task: PushDepTask): Promise<void> {
        throw new Error("not implemented");
        // return await this.taskManager.complete(task);
    }

    async cancelAsync(task: PushDepTask): Promise<void> {
        throw new Error("not implemented");
        // return await this.taskManager.cancel(task);
    }

    async failAsync(task: PushDepTask): Promise<void> {
        throw new Error("not implemented");
        // return await this.taskManager.fail(task);
    }
}
