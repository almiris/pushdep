import "reflect-metadata";
import { DataSource, EntityManager, TableExclusion } from "typeorm";
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

    async countAsync(kindId?: string): Promise<PushDepTaskCount> {
        return await this.taskExecutionService.countAsync(kindId); 
    }

    async peekAsync(kindId: string): Promise<PushDepTask> {
        return await this.taskService.findPendingTaskWithHighestPriorityAndNoPendingOrActiveDependencyAsync(kindId);
    }

    async startAsync(kindId: string): Promise<PushDepTask> {
        return await this.dataSource.transaction(async (transactionalEntityManager: EntityManager) => {
            const taskService = new TaskService(transactionalEntityManager.getRepository(Task));
            const taskExecutionService = new TaskExecutionService(transactionalEntityManager.getRepository(TaskExecution));
            let task = null;
            const kindService = new KindService(transactionalEntityManager.getRepository(Kind));
            const concurrency = (await kindService.findAsync(kindId))?.concurrency || 1;
            if (await taskService.countActiveTasks(kindId) < concurrency) {
                try {
                    task = await taskService.findPendingTaskWithHighestPriorityAndNoPendingOrActiveDependencyAsync(kindId, true);
                    if (task) {
                        await taskExecutionService.startAsync(task.id);
                    }
                }
                // catch(_) {}
                catch(err) { console.log(err); }
            }
            return task;
        });
    }

    async completeAsync(task: PushDepTask): Promise<void> {
        await this.taskExecutionService.completeAsync(task.id)
    }

    async cancelAsync(task: PushDepTask): Promise<void> {
        await this.taskExecutionService.cancelAsync(task.id)
    }

    async failAsync(task: PushDepTask): Promise<void> {
        await this.taskExecutionService.failAsync(task.id)
    }

    async returnAsync(task: PushDepTask): Promise<void> {
        await this.taskExecutionService.returnAsync(task.id)
    }
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
        return await this.taskManager.countAsync(kindId);
    }

    async peekAsync(kindId: string): Promise<PushDepTask> {
        return await this.taskManager.peekAsync(kindId);
    }

    async startAsync(kindId: string): Promise<PushDepTask> {
        return await this.taskManager.startAsync(kindId);
    }

    async completeAsync(task: PushDepTask): Promise<void> {
        return await this.taskManager.completeAsync(task);
    }

    async cancelAsync(task: PushDepTask): Promise<void> {
        return await this.taskManager.cancelAsync(task);
    }

    async failAsync(task: PushDepTask): Promise<void> {
        return await this.taskManager.failAsync(task);
    }

    async returnAsync(task: PushDepTask): Promise<void> {
        return await this.taskManager.returnAsync(task);
    }
}
