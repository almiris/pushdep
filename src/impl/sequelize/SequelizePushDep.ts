import "reflect-metadata";
import { Transaction } from "sequelize";
import { Sequelize } from "sequelize-typescript";
import { AllowedStateTransitions, PushDep, PushDepExecutionState, PushDepKind, PushDepTask, PushDepTaskCount } from "../../core/PushDep";
import { Kind } from "./model/Kind.model";
import { KindActivityLock } from "./model/KindActivityLock.model";
import { Task } from "./model/Task.model";
import { TaskDependency } from "./model/TaskDependency.model";
import { KindActivityLockRepository } from "./repository/KindActivityLockRepository";
import { KindRepository } from "./repository/KindRepository";
import { TaskDependencyRepository } from "./repository/TaskDependencyRepository";
import { TaskRepository } from "./repository/TaskRepository";

class SequelizeTaskService {
    kindRepository: KindRepository;
    kindActivityLockRepository: KindActivityLockRepository;
    taskRepository: TaskRepository;
    taskDependencyRepository: TaskDependencyRepository;

    constructor(private sequelize: Sequelize) {
        // sequelize.repositoryMode = true;
        this.kindRepository = new KindRepository(sequelize.getRepository(Kind));
        this.kindActivityLockRepository = new KindActivityLockRepository(sequelize.getRepository(KindActivityLock));
        this.taskRepository = new TaskRepository(sequelize.getRepository(Task));
        this.taskDependencyRepository = new TaskDependencyRepository(sequelize.getRepository(TaskDependency));
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
        return /* await */ this.kindRepository.findAsync(null, kindId);
    }
    
    async pushAsync(task: PushDepTask): Promise<PushDepTask> {
        return /* await */ this.sequelize.transaction<Task>(async (transaction: Transaction): Promise<Task> => {
            return /* await */ this.doPushAsync(transaction, task);
        });
    }

    async doPushAsync(transaction: Transaction, task: PushDepTask): Promise<Task> {
        const taskEntity = task as Task;
        if (!taskEntity.id) {
            taskEntity.dependencies = await this.doPushDependenciesAsync(transaction, taskEntity.dependencies);
            taskEntity.priority = taskEntity.priority || 1;
            taskEntity.state = PushDepExecutionState.pending;
            taskEntity.createdAt = new Date();
            const taskModel = await this.taskRepository.createAsync(transaction, taskEntity);
            if (taskEntity.dependencies) {
                await this.taskDependencyRepository.bulkCreateAsync(transaction, taskEntity.dependencies.map(dependency => ({
                    taskId: taskModel.id,
                    dependencyId: dependency.id
                })) as TaskDependency[]);
            }
            taskEntity.id = taskModel.id;
        }
        return taskEntity;
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
        return /* await */ this.taskRepository.countAsync(kindId); 
    }

    async peekAsync(kindId: string): Promise<PushDepTask> {
        return /* await */ this.taskRepository.findPendingTaskWithHighestPriorityAndNoPendingOrActiveDependencyAsync(null, kindId);
    }

    async startAsync(kindId: string): Promise<PushDepTask> {
        return /* await */ this.sequelize.transaction<Task>({isolationLevel: Transaction.ISOLATION_LEVELS.READ_COMMITTED}, async (transaction: Transaction): Promise<Task> => {
            let task = null;
            const lock = await this.kindActivityLockRepository.acquireLockAsync(transaction, kindId);
            if (lock) {
                const start = new Date().getTime();
                task = await this.taskRepository.findPendingTaskWithHighestPriorityAndNoPendingOrActiveDependencyAsync(transaction, kindId, true);
                const stop = new Date().getTime() - start;
                // console.log("task " + (task ? "found; " : "not found; ") + stop + " ms");
                if (task) {
                    await this.kindActivityLockRepository.reserveLockAsync(transaction, lock.id, task.id);
                    await this.taskRepository.startAsync(transaction, task.id);
                }
            }
            return task;
        });
    }

    async completeAsync(task: PushDepTask): Promise<void> {
        await this.sequelize.transaction<void>({isolationLevel: Transaction.ISOLATION_LEVELS.READ_COMMITTED}, async (transaction: Transaction): Promise<void> => {
            await this.kindActivityLockRepository.releaseLockAsync(transaction, task.kindId, task.id);
            await this.allowTaskExecutionStateTransition(transaction, task, PushDepExecutionState.completed);
            await this.taskRepository.completeAsync(transaction, task.id, task.results);
        });
    }

    async cancelAsync(task: PushDepTask): Promise<void> {
        await this.sequelize.transaction<void>({isolationLevel: Transaction.ISOLATION_LEVELS.READ_COMMITTED}, async (transaction: Transaction): Promise<void> => {
            await this.kindActivityLockRepository.releaseLockAsync(transaction, task.kindId, task.id);
            await this.allowTaskExecutionStateTransition(transaction, task, PushDepExecutionState.canceled);
            await this.taskRepository.cancelAsync(transaction, task.id, task.results);
        });
    }

    async failAsync(task: PushDepTask): Promise<void> {
        await this.sequelize.transaction<void>({isolationLevel: Transaction.ISOLATION_LEVELS.READ_COMMITTED}, async (transaction: Transaction): Promise<void> => {
            await this.kindActivityLockRepository.releaseLockAsync(transaction, task.kindId, task.id);
            await this.allowTaskExecutionStateTransition(transaction, task, PushDepExecutionState.failed);
            await this.taskRepository.failAsync(transaction, task.id, task.results);
        });
    }

    async returnAsync(task: PushDepTask): Promise<void> {
        await this.sequelize.transaction<void>({isolationLevel: Transaction.ISOLATION_LEVELS.READ_COMMITTED}, async (transaction: Transaction): Promise<void> => {
            await this.kindActivityLockRepository.releaseLockAsync(transaction, task.kindId, task.id);
            await this.allowTaskExecutionStateTransition(transaction, task, PushDepExecutionState.pending);
            await this.taskRepository.returnAsync(transaction, task.id, task.results);
        });
    }

    async allowTaskExecutionStateTransition(transaction: Transaction, task: PushDepTask, state: PushDepExecutionState): Promise<void> {
        const taskEntity = await this.taskRepository.findByTaskIdAsync(transaction, task.id);
        if (!taskEntity) {
            throw new Error(`Illegal state for task ${task.id}`);
        }
        if (!AllowedStateTransitions[taskEntity.state]?.includes(state)) {
            throw new Error(`Illegal state transition: ${PushDepExecutionState[taskEntity.state]} -> ${PushDepExecutionState[state]}`);
        }
    }

    async getTaskDependenciesAsync(task: PushDepTask): Promise<PushDepTask[] | null> {
        return task.id ? /* await */ this.taskRepository.getTaskDependenciesAsync(null, task.id) : null;
    }
}

export class SequelizePushDep implements PushDep {
    taskService: SequelizeTaskService;

    constructor(private sequelize: Sequelize) {
        this.taskService = new SequelizeTaskService(sequelize);
    }
    
    async setKindAsync(kind: PushDepKind): Promise<void> {
        await this.taskService.setKindAsync(kind);
    }

    async getKindAsync(kindId: string): Promise<PushDepKind> {
        return /* await */ this.taskService.getKindAsync(kindId);
    }

    async pushAsync(task: PushDepTask): Promise<PushDepTask> {
        return /* await */ this.taskService.pushAsync(task);
    }

    async countAsync(kindId?: string): Promise<PushDepTaskCount> {
        return /* await */ this.taskService.countAsync(kindId);
    }

    async peekAsync(kindId: string): Promise<PushDepTask> {
        return /* await */ this.taskService.peekAsync(kindId);
    }

    async startAsync(kindId: string): Promise<PushDepTask> {
        return /* await */ this.taskService.startAsync(kindId);
    }

    async completeAsync(task: PushDepTask): Promise<void> {
        await this.taskService.completeAsync(task);
    }

    async cancelAsync(task: PushDepTask): Promise<void> {
        await this.taskService.cancelAsync(task);
    }

    async failAsync(task: PushDepTask): Promise<void> {
        await this.taskService.failAsync(task);
    }

    async returnAsync(task: PushDepTask): Promise<void> {
        await this.taskService.returnAsync(task);
    }

    async getTaskDependenciesAsync(task: PushDepTask): Promise<PushDepTask[] | null> {
        return /* await */ this.taskService.getTaskDependenciesAsync(task);
    }
}
