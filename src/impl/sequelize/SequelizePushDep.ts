import { readlinkSync } from "fs";
import "reflect-metadata";
import { Transaction } from "sequelize";
import { Sequelize } from "sequelize-typescript";
import { AllowedStateTransitions, PushDep, PushDepExecutionState, PushDepKind, PushDepTask, PushDepTaskCount, PushDepTaskExecutionBuilder } from "../../core/PushDep";
import { Kind } from "./model/Kind.model";
import { KindActivityLock } from "./model/KindActivityLock.model";
import { Task } from "./model/Task.model";
import { TaskDependency } from "./model/TaskDependency.model";
import { TaskExecution } from "./model/TaskExecution.model";
import { KindActivityLockRepository } from "./repository/KindActivityLockRepository";
import { KindRepository } from "./repository/KindRepository";
import { TaskDependencyRepository } from "./repository/TaskDependencyRepository";
import { TaskExecutionRepository } from "./repository/TaskExecutionRepository";
import { TaskRepository } from "./repository/TaskRepository";

class SequelizeTaskExecutionService {
    kindRepository: KindRepository;
    kindActivityLockRepository: KindActivityLockRepository;
    taskRepository: TaskRepository;
    taskDependencyRepository: TaskDependencyRepository;
    taskExecutionRepository:TaskExecutionRepository;

    constructor(private sequelize: Sequelize) {
        // sequelize.repositoryMode = true;
        this.kindRepository = new KindRepository(sequelize.getRepository(Kind));
        this.kindActivityLockRepository = new KindActivityLockRepository(sequelize.getRepository(KindActivityLock));
        this.taskRepository = new TaskRepository(sequelize.getRepository(Task));
        this.taskDependencyRepository = new TaskDependencyRepository(sequelize.getRepository(TaskDependency));
        this.taskExecutionRepository = new TaskExecutionRepository(sequelize.getRepository(TaskExecution));
    }
    
    async setKindAsync(kind: PushDepKind): Promise<void> {
        await this.sequelize.transaction<void>({isolationLevel: Transaction.ISOLATION_LEVELS.SERIALIZABLE}, async (transaction: Transaction): Promise<void> => {
            await this.kindRepository.upsertAsync(transaction, kind as Kind);
            await this.kindActivityLockRepository.deleteAllAsync(transaction, kind.id);
            for (let i = 0; i < kind.concurrency; i++) {
                await this.kindActivityLockRepository.createAsync(transaction, { kindId : kind.id } as KindActivityLock);
            }
        });
    }

    async getKindAsync(kindId: string): Promise<PushDepKind> {
        return await this.kindRepository.findAsync(null, kindId);
    }
    
    async pushAsync(task: PushDepTask): Promise<PushDepTask> {
        return await this.sequelize.transaction<Task>(async (transaction: Transaction): Promise<Task> => {
            return await this.doPushAsync(transaction, task);
        });
    }

    async doPushAsync(transaction: Transaction, task: PushDepTask): Promise<Task> {
        if (!task.id) {
            task.dependencies = await this.doPushDependenciesAsync(transaction, task.dependencies);
            task.priority = task.priority || 1;
            const taskModel = await this.taskRepository.createAsync(transaction, task as Task);
            if (task.dependencies) {
                await this.taskDependencyRepository.bulkCreateAsync(transaction, task.dependencies.map(dependency => ({
                    taskId: taskModel.id,
                    dependencyId: dependency.id
                })) as TaskDependency[]);
            }
            const taskExecution = PushDepTaskExecutionBuilder.build(task);
            delete taskExecution.task;
            (taskExecution as any).taskId = taskModel.id;
            await this.taskExecutionRepository.createAsync(transaction, taskExecution as TaskExecution);
            (task as any).id = taskModel.id;
        }
        return task as Task;
    }

    async doPushDependenciesAsync(transaction: Transaction, dependencies?: PushDepTask[]): Promise<Task[]> {
        if (!dependencies) {
            return null;
        }

        const tasks: Task[] = [];
        for (const task of dependencies) {
            tasks.push(task.id ? task as Task : await this.doPushAsync(transaction, task));
        }
        return tasks;
    }

    async countAsync(kindId?: string): Promise<PushDepTaskCount> {
        return await this.taskExecutionRepository.countAsync(kindId); 
    }

    async peekAsync(kindId: string): Promise<PushDepTask> {
        return await this.taskRepository.findPendingTaskWithHighestPriorityAndNoPendingOrActiveDependencyAsync(null, kindId);
    }

    // async startAsync(kindId: string): Promise<PushDepTask> {
    //     const concurrency = (await this.kindRepository.findAsync(null, kindId))?.concurrency || 1;
    //     let task = null;
    //     if (await this.taskRepository.countActiveTasks(null, kindId) < concurrency) {
    //         task = await this.sequelize.transaction<Task>({isolationLevel: Transaction.ISOLATION_LEVELS.READ_COMMITTED}, async (transaction: Transaction): Promise<Task> => {
    //             let task = null;
    //             if (await this.taskRepository.countActiveTasks(transaction, kindId) < concurrency) {
    //                 task = await this.taskRepository.findPendingTaskWithHighestPriorityAndNoPendingOrActiveDependencyAsync(transaction, kindId, true);
    //                 if (task) {
    //                     await this.taskExecutionRepository.startAsync(transaction, task.id);
    //                 }
    //             }
    //             return task;
    //         });
    //     }
    //     return task;
    // }

    // async startAsync(kindId: string): Promise<PushDepTask> {
    //     const lock = await this.sequelize.transaction<KindActivityLock>({isolationLevel: Transaction.ISOLATION_LEVELS.READ_COMMITTED}, async (transaction: Transaction): Promise<KindActivityLock> => {
    //         const lock = await this.kindActivityLockRepository.acquireLockAsync(transaction, kindId);
    //         return lock;
    //     });
    //     if (lock) {
    //         console.log("lock found");
    //         return await this.sequelize.transaction<Task>({isolationLevel: Transaction.ISOLATION_LEVELS.SERIALIZABLE}, async (transaction: Transaction): Promise<Task> => {
    //             let task = null;
    //             // const concurrency = (await this.kindRepository.findAsync(transaction, kindId))?.concurrency || 1;
    //             // if (await this.taskRepository.countActiveTasks(transaction, kindId) < concurrency) {
    //                 task = await this.taskRepository.findPendingTaskWithHighestPriorityAndNoPendingOrActiveDependencyAsync(transaction, kindId, true);
    //                 if (task) {
    //                     await this.taskExecutionRepository.startAsync(transaction, task.id);
    //                 }
    //             // }
    //             return task;
    //         });
    //         return null;
    //     }
    //     else {
    //         console.log("no lock found");
    //         return null;
    //     }
    // }

    async startAsync(kindId: string): Promise<PushDepTask> {
        const task = await this.sequelize.transaction<Task>({isolationLevel: Transaction.ISOLATION_LEVELS.READ_COMMITTED}, async (transaction: Transaction): Promise<Task> => {
            let task = null;
            const lock = await this.kindActivityLockRepository.acquireLockAsync(transaction, kindId);
            if (lock) {
                task = await this.taskRepository.findPendingTaskWithHighestPriorityAndNoPendingOrActiveDependencyAsync(transaction, kindId, true);
                if (task) {
                    await this.kindActivityLockRepository.reserveLockAsync(transaction, lock.id, task.id);
                    await this.taskExecutionRepository.startAsync(transaction, task.id);
                }
            }
            return task;
        });
        return task;
    }

    // async startAsync(kindId: string): Promise<PushDepTask> {
    //     const lock = await this.sequelize.transaction<KindActivityLock>({isolationLevel: Transaction.ISOLATION_LEVELS.READ_COMMITTED}, async (transaction: Transaction): Promise<KindActivityLock> => {
    //         return await this.kindActivityLockRepository.acquireLockAsync(transaction, kindId);
    //     });
    //     if (lock) {
    //         return await this.sequelize.transaction<Task>({isolationLevel: Transaction.ISOLATION_LEVELS.READ_COMMITTED}, async (transaction: Transaction): Promise<Task> => {
    //             let task = null;
    //             task = await this.taskRepository.findPendingTaskWithHighestPriorityAndNoPendingOrActiveDependencyAsync(transaction, kindId, true);
    //             if (task) {
    //                 await this.taskExecutionRepository.startAsync(transaction, task.id);
    //             }
    //             return task;
    //         });
    //     }
    //     else {
    //         return null;
    //     }
    // }

    async completeAsync(task: PushDepTask): Promise<void> {
        console.log("completing");
        await this.sequelize.transaction<void>({isolationLevel: Transaction.ISOLATION_LEVELS.READ_COMMITTED}, async (transaction: Transaction): Promise<void> => {
            const lock = await this.kindActivityLockRepository.releaseLockAsync(transaction, task.kindId, task.id);
            await this.allowTaskExecutionStateTransition(transaction, task, PushDepExecutionState.completed);
            await this.taskExecutionRepository.completeAsync(transaction, task.id)
        });
    }

    // async completeAsync(task: PushDepTask): Promise<void> {
    //     const lock = await this.sequelize.transaction<KindActivityLock>({isolationLevel: Transaction.ISOLATION_LEVELS.READ_COMMITTED}, async (transaction: Transaction): Promise<KindActivityLock> => {
    //         return await this.kindActivityLockRepository.releaseOldestLockAsync(transaction, task.kindId);
    //     });
    //     await this.allowTaskExecutionStateTransition(null, task, PushDepExecutionState.completed);
    //     await this.taskExecutionRepository.completeAsync(null, task.id)
    // }

    async cancelAsync(task: PushDepTask): Promise<void> {
        await this.allowTaskExecutionStateTransition(null, task, PushDepExecutionState.canceled);
        await this.taskExecutionRepository.cancelAsync(null, task.id)
    }

    async failAsync(task: PushDepTask): Promise<void> {
        await this.allowTaskExecutionStateTransition(null, task, PushDepExecutionState.failed);
        await this.taskExecutionRepository.failAsync(null, task.id)
    }

    async returnAsync(task: PushDepTask): Promise<void> {
        await this.allowTaskExecutionStateTransition(null, task, PushDepExecutionState.pending);
        await this.taskExecutionRepository.returnAsync(null, task.id)
    }

    async allowTaskExecutionStateTransition(transaction: Transaction, task: PushDepTask, state: PushDepExecutionState): Promise<void> {
        const taskExecution = await this.taskExecutionRepository.findByTaskIdAsync(transaction, task.id);
        if (!taskExecution) {
            throw new Error(`Illegal state for task ${task.id}`);
        }
        if (!AllowedStateTransitions[taskExecution.state]?.includes(state)) {
            throw new Error(`Illegal state transition: ${PushDepExecutionState[taskExecution.state]} -> ${PushDepExecutionState[state]}`);
        }
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
