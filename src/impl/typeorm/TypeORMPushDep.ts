import "reflect-metadata";
import { DataSource, EntityManager } from "typeorm";
import { PushDep, PushDepKind, PushDepTask, PushDepTaskCount, PushDepTaskExecutionBuilder } from "../../core/PushDep";
import { Kind } from "./entity/Kind.entity";
import { Task } from "./entity/Task.entity";
import { TaskExecution } from "./entity/TaskExecution.entity";
import { KindRepository } from "./repository/KindRepository";
import { TaskExecutionRepository } from "./repository/TaskExecutionRepository";
import { TaskRepository } from "./repository/TaskRepository";

class TypeORMTaskService {
    kindRepository: KindRepository;
    taskRepository: TaskRepository;
    taskExecutionRepository:TaskExecutionRepository;

    constructor(private dataSource: DataSource) {
        this.kindRepository = new KindRepository(dataSource.getRepository(Kind));
        this.taskRepository = new TaskRepository(dataSource.getRepository(Task));
        this.taskExecutionRepository = new TaskExecutionRepository(dataSource.getRepository(TaskExecution));
    }
    
    async setKindAsync(kind: PushDepKind): Promise<void> {
        await this.kindRepository.saveAsync(kind as Kind);
    }

    async getKindAsync(kindId: string): Promise<PushDepKind> {
        return await this.kindRepository.findAsync(kindId);
    }
    
    async pushAsync(task: PushDepTask): Promise<PushDepTask> {
        return await this.dataSource.transaction(async (transactionalEntityManager: EntityManager) => {
            const taskRepository = new TaskRepository(transactionalEntityManager.getRepository(Task));
            const taskExecutionRepository = new TaskExecutionRepository(transactionalEntityManager.getRepository(TaskExecution));
            return await this.doPushAsync(taskRepository, taskExecutionRepository, task);
        });
    }

    async doPushAsync(taskRepository: TaskRepository, taskExecutionRepository: TaskExecutionRepository, task: PushDepTask): Promise<Task> {
        if (!task.id) {
            task.dependencies = await this.doPushDependenciesAsync(taskRepository, taskExecutionRepository, task.dependencies);
            task.priority = task.priority || 1;
            const taskExecution = PushDepTaskExecutionBuilder.build(task);
            await taskRepository.saveAsync(task as Task);
            await taskExecutionRepository.saveAsync(taskExecution as TaskExecution);
            return task as Task;
        }
        else {
            return null;
        }
    }

    async doPushDependenciesAsync(taskRepository: TaskRepository, taskExecutionRepository: TaskExecutionRepository, dependencies?: PushDepTask[]): Promise<Task[]> {
        if (!dependencies) {
            return null;
        }

        const tasks: Task[] = [];
        for (const task of dependencies) {
            tasks.push(task.id ? task as Task : await this.doPushAsync(taskRepository, taskExecutionRepository, task));
        }
        return tasks;
    }

    async countAsync(kindId?: string): Promise<PushDepTaskCount> {
        return await this.taskExecutionRepository.countAsync(kindId); 
    }

    async peekAsync(kindId: string): Promise<PushDepTask> {
        return await this.taskRepository.findPendingTaskWithHighestPriorityAndNoPendingOrActiveDependencyAsync(kindId);
    }

    async startAsync(kindId: string): Promise<PushDepTask> {
        return await this.dataSource.transaction(async (transactionalEntityManager: EntityManager) => {
            const taskRepository = new TaskRepository(transactionalEntityManager.getRepository(Task));
            const taskExecutionRepository = new TaskExecutionRepository(transactionalEntityManager.getRepository(TaskExecution));
            let task = null;
            const kindRepository = new KindRepository(transactionalEntityManager.getRepository(Kind));
            const concurrency = (await kindRepository.findAsync(kindId))?.concurrency || 1;
            if (await taskRepository.countActiveTasks(kindId) < concurrency) {
                try {
                    task = await taskRepository.findPendingTaskWithHighestPriorityAndNoPendingOrActiveDependencyAsync(kindId, true);
                    if (task) {
                        await taskExecutionRepository.startAsync(task.id);
                    }
                }
                // catch(_) {}
                catch(err) { console.log(err); }
            }
            return task;
        });
    }

    async completeAsync(task: PushDepTask): Promise<void> {
        await this.taskExecutionRepository.completeAsync(task.id)
    }

    async cancelAsync(task: PushDepTask): Promise<void> {
        await this.taskExecutionRepository.cancelAsync(task.id)
    }

    async failAsync(task: PushDepTask): Promise<void> {
        await this.taskExecutionRepository.failAsync(task.id)
    }

    async returnAsync(task: PushDepTask): Promise<void> {
        await this.taskExecutionRepository.returnAsync(task.id)
    }
}

export class TypeORMPushDep implements PushDep {
    typeORMTaskService: TypeORMTaskService;

    constructor(private dataSource: DataSource) {
        this.typeORMTaskService = new TypeORMTaskService(dataSource);
    }
    
    async setKindAsync(kind: PushDepKind): Promise<void> {
        await this.typeORMTaskService.setKindAsync(kind);
    }

    async getKindAsync(kindId: string): Promise<PushDepKind> {
        return await this.typeORMTaskService.getKindAsync(kindId);
    }

    async pushAsync(task: PushDepTask): Promise<PushDepTask> {
        return await this.typeORMTaskService.pushAsync(task);
    }

    async countAsync(kindId?: string): Promise<PushDepTaskCount> {
        return await this.typeORMTaskService.countAsync(kindId);
    }

    async peekAsync(kindId: string): Promise<PushDepTask> {
        return await this.typeORMTaskService.peekAsync(kindId);
    }

    async startAsync(kindId: string): Promise<PushDepTask> {
        return await this.typeORMTaskService.startAsync(kindId);
    }

    async completeAsync(task: PushDepTask): Promise<void> {
        return await this.typeORMTaskService.completeAsync(task);
    }

    async cancelAsync(task: PushDepTask): Promise<void> {
        return await this.typeORMTaskService.cancelAsync(task);
    }

    async failAsync(task: PushDepTask): Promise<void> {
        return await this.typeORMTaskService.failAsync(task);
    }

    async returnAsync(task: PushDepTask): Promise<void> {
        return await this.typeORMTaskService.returnAsync(task);
    }
}
