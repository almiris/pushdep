import "reflect-metadata";
import { Sequelize } from "sequelize-typescript";
import { PushDep, PushDepExecutionState, PushDepKind, PushDepTask, PushDepTaskCount } from "../../core/PushDep";
import { Kind } from "./model/Kind.model";
import { Task } from "./model/Task.model";
import { KindRepository } from "./repository/KindRepository";
import { TaskExecutionRepository } from "./repository/TaskExecutionRepository";
import { TaskRepository } from "./repository/TaskRepository";

class SequelizeTaskExecutionService {
    kindRepository: KindRepository;
    // taskRepository: TaskRepository;
    // taskExecutionRepository:TaskExecutionRepository;

    constructor(private sequelize: Sequelize) {
        // sequelize.repositoryMode = true;
        this.kindRepository = new KindRepository(sequelize.getRepository(Kind));
        // this.taskRepository = new TaskRepository(dataSource.getRepository(Task));
        // this.taskExecutionRepository = new TaskExecutionRepository(dataSource.getRepository(TaskExecution));
    }
    
    async setKindAsync(kind: PushDepKind): Promise<void> {
        await Kind.upsert(kind as any);
    }

    async getKindAsync(kindId: string): Promise<PushDepKind> {
        return await this.kindRepository.findAsync(kindId);
    }
    
    async pushAsync(task: PushDepTask): Promise<PushDepTask> {
        return task;
        // return await this.dataSource.transaction<Task>(async (transactionalEntityManager: EntityManager): Promise<Task> => {
        //     const taskRepository = new TaskRepository(transactionalEntityManager.getRepository(Task));
        //     const taskExecutionRepository = new TaskExecutionRepository(transactionalEntityManager.getRepository(TaskExecution));
        //     return await this.doPushAsync(taskRepository, taskExecutionRepository, task);
        // });
    }

    async doPushAsync(taskRepository: TaskRepository, taskExecutionRepository: TaskExecutionRepository, task: PushDepTask): Promise<Task> {
        throw new Error("not implemented");
        // if (!task.id) {
        //     task.dependencies = await this.doPushDependenciesAsync(taskRepository, taskExecutionRepository, task.dependencies);
        //     task.priority = task.priority || 1;
        //     const taskExecution = PushDepTaskExecutionBuilder.build(task);
        //     await taskRepository.saveAsync(task as Task);
        //     await taskExecutionRepository.saveAsync(taskExecution as TaskExecution);
        // }
        // return task as Task;
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
        throw new Error("not implemented");
        // return await this.taskExecutionRepository.countAsync(kindId); 
    }

    async peekAsync(kindId: string): Promise<PushDepTask> {
        throw new Error("not implemented");
        // return await this.taskRepository.findPendingTaskWithHighestPriorityAndNoPendingOrActiveDependencyAsync(kindId);
    }

    async startAsync(kindId: string): Promise<PushDepTask> {
        throw new Error("not implemented");
        // return await this.dataSource.transaction<Task>(async (transactionalEntityManager: EntityManager): Promise<Task> => {
        //     const taskRepository = new TaskRepository(transactionalEntityManager.getRepository(Task));
        //     const taskExecutionRepository = new TaskExecutionRepository(transactionalEntityManager.getRepository(TaskExecution));
        //     let task: Task = null;
        //     const kindRepository = new KindRepository(transactionalEntityManager.getRepository(Kind));
        //     const concurrency = (await kindRepository.findAsync(kindId))?.concurrency || 1;
        //     if (await taskRepository.countActiveTasks(kindId) < concurrency) {
        //         task = await taskRepository.findPendingTaskWithHighestPriorityAndNoPendingOrActiveDependencyAsync(kindId, true);
        //         if (task) {
        //             await taskExecutionRepository.startAsync(task.id);
        //         }
        //     }
        //     return task;
        // });
    }

    async completeAsync(task: PushDepTask): Promise<void> {
        throw new Error("not implemented");
        // await this.allowTaskExecutionStateTransition(task, PushDepExecutionState.completed);
        // await this.taskExecutionRepository.completeAsync(task.id)
    }

    async cancelAsync(task: PushDepTask): Promise<void> {
        throw new Error("not implemented");
        // await this.allowTaskExecutionStateTransition(task, PushDepExecutionState.canceled);
        // await this.taskExecutionRepository.cancelAsync(task.id)
    }

    async failAsync(task: PushDepTask): Promise<void> {
        throw new Error("not implemented");
        // await this.allowTaskExecutionStateTransition(task, PushDepExecutionState.failed);
        // await this.taskExecutionRepository.failAsync(task.id)
    }

    async returnAsync(task: PushDepTask): Promise<void> {
        throw new Error("not implemented");
        // await this.allowTaskExecutionStateTransition(task, PushDepExecutionState.pending);
        // await this.taskExecutionRepository.returnAsync(task.id)
    }

    async allowTaskExecutionStateTransition(task: PushDepTask, state: PushDepExecutionState): Promise<void> {
        throw new Error("not implemented");
        // const taskExecution = await this.taskExecutionRepository.findByTaskIdAsync(task.id);
        // if (!taskExecution) {
        //     throw new Error(`Illegal state for task ${task.id}`);
        // }
        // if (!AllowedStateTransitions[taskExecution.state]?.includes(state)) {
        //     throw new Error(`Illegal state transition: ${PushDepExecutionState[taskExecution.state]} -> ${PushDepExecutionState[state]}`);
        // }
    }
}

export class SequelizePushDep implements PushDep {
    taskExecutionService: SequelizeTaskExecutionService;

    constructor(private sequelize: Sequelize) {
        this.taskExecutionService = new SequelizeTaskExecutionService(sequelize);
    }
    
    async setKindAsync(kind: PushDepKind): Promise<void> {
        await this.taskExecutionService.setKindAsync(kind);
    }

    async getKindAsync(kindId: string): Promise<PushDepKind> {
        return await this.taskExecutionService.getKindAsync(kindId);
    }

    async pushAsync(task: PushDepTask): Promise<PushDepTask> {
        return await this.taskExecutionService.pushAsync(task);
    }

    async countAsync(kindId?: string): Promise<PushDepTaskCount> {
        return await this.taskExecutionService.countAsync(kindId);
    }

    async peekAsync(kindId: string): Promise<PushDepTask> {
        return await this.taskExecutionService.peekAsync(kindId);
    }

    async startAsync(kindId: string): Promise<PushDepTask> {
        return await this.taskExecutionService.startAsync(kindId);
    }

    async completeAsync(task: PushDepTask): Promise<void> {
        await this.taskExecutionService.completeAsync(task);
    }

    async cancelAsync(task: PushDepTask): Promise<void> {
        await this.taskExecutionService.cancelAsync(task);
    }

    async failAsync(task: PushDepTask): Promise<void> {
        await this.taskExecutionService.failAsync(task);
    }

    async returnAsync(task: PushDepTask): Promise<void> {
        await this.taskExecutionService.returnAsync(task);
    }
}
