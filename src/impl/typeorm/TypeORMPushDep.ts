import { create } from "domain";
import "reflect-metadata";
import { DataSource, EntityManager } from "typeorm";
import { AllowedStateTransitions, PushDep, PushDepExecutionState, PushDepKind, PushDepTask, PushDepTaskCount } from "../../core/PushDep";
import { Kind } from "./entity/Kind.entity";
import { KindActivityLock } from "./entity/KindActivityLock.entity";
import { Task } from "./entity/Task.entity";
import { TaskDependency } from "./entity/TaskDependency.entity";
import { KindActivityLockRepository } from "./repository/KindActivityLockRepository";
import { KindRepository } from "./repository/KindRepository";
import { TaskDependencyRepository } from "./repository/TaskDependencyRepository";
import { TaskRepository } from "./repository/TaskRepository";

class TypeORMTaskService {
    kindRepository: KindRepository;
    taskRepository: TaskRepository;

    constructor(private dataSource: DataSource) {
        this.kindRepository = new KindRepository(dataSource.getRepository(Kind));
        this.taskRepository = new TaskRepository(dataSource.getRepository(Task));
    }
    
    async setKindAsync(kind: PushDepKind): Promise<void> {
        await this.dataSource.transaction<void>("SERIALIZABLE", async (transactionalEntityManager: EntityManager): Promise<void> => {
            const kindRepository = new KindRepository(transactionalEntityManager.getRepository(Kind));
            const kindActivityLockRepository = new KindActivityLockRepository(transactionalEntityManager.getRepository(KindActivityLock));
            await kindRepository.saveAsync(kind);
            await kindActivityLockRepository.deleteAllAsync(kind.id);
            for (let i = 0; i < kind.concurrency; i++) {
                await kindActivityLockRepository.insertAsync({ kindId : kind.id });
            }
        });
    }

    async getKindAsync(kindId: string): Promise<PushDepKind> {
        return /* await */ this.kindRepository.findAsync(kindId);
    }
    
    async pushAsync(task: PushDepTask): Promise<PushDepTask> {
        return /* await */ this.dataSource.transaction<Task>(async (transactionalEntityManager: EntityManager): Promise<Task> => {
            const taskRepository = new TaskRepository(transactionalEntityManager.getRepository(Task));
            const taskDependencyRepository = new TaskDependencyRepository(transactionalEntityManager.getRepository(TaskDependency));
            return /* await */ this.doPushAsync(taskRepository, taskDependencyRepository, task);
        });
    }

    async doPushAsync(taskRepository: TaskRepository, taskDependencyRepository: TaskDependencyRepository, task: PushDepTask): Promise<Task> {
        const taskEntity = task as Task;
        if (!taskEntity.id) {
            taskEntity.dependencies = await this.doPushDependenciesAsync(taskRepository, taskDependencyRepository, taskEntity.dependencies);
            taskEntity.priority = task.priority || 1;
            taskEntity.state = PushDepExecutionState.pending;
            taskEntity.createdAt = new Date();
            const createdTaskEntity = await taskRepository.insertAsync(taskEntity);
            if (taskEntity.dependencies) {
                await taskDependencyRepository.bulkInsertAsync(taskEntity.dependencies.map(dependency => ({
                    taskId: createdTaskEntity[0].id,
                    dependencyId: dependency.id
                })));
            }
            taskEntity.id = createdTaskEntity[0].id;
        }
        return taskEntity;
    }

    async doPushDependenciesAsync(taskRepository: TaskRepository, taskDependencyRepository: TaskDependencyRepository, dependencies?: PushDepTask[]): Promise<Task[]> {
        if (!dependencies) {
            return null;
        }
        const tasks: Task[] = [];
        for (const task of dependencies) {
            tasks.push(task.id ? task as Task : await this.doPushAsync(taskRepository, taskDependencyRepository, task));
        }
        return tasks;
    }

    async countAsync(kindId?: string): Promise<PushDepTaskCount> {
        return /* await */ this.taskRepository.countAsync(kindId); 
    }

    async peekAsync(kindId: string): Promise<PushDepTask> {
        return /* await */ this.taskRepository.findPendingTaskWithHighestPriorityAndNoPendingOrActiveDependencyAsync(kindId);
    }

    async startAsync(kindId: string): Promise<PushDepTask> {
        return /* await */ this.dataSource.transaction<Task>("READ COMMITTED", async (transactionalEntityManager: EntityManager): Promise<Task> => {
            const kindActivityLockRepository = new KindActivityLockRepository(transactionalEntityManager.getRepository(KindActivityLock));
            const taskRepository = new TaskRepository(transactionalEntityManager.getRepository(Task));
            let task = null;
            const lock = await kindActivityLockRepository.acquireLockAsync(kindId);
            if (lock) {
                const start = new Date().getTime();
                task = await taskRepository.findPendingTaskWithHighestPriorityAndNoPendingOrActiveDependencyAsync(kindId, true);
                const stop = new Date().getTime() - start;
                console.log("task " + (task ? "found; " : "not found; ") + stop + " ms");
                if (task) {
                    await kindActivityLockRepository.reserveLockAsync(lock.id, task.id);
                    await taskRepository.startAsync(task.id);
                }
            }
            return task;
        });
    }

    async completeAsync(task: PushDepTask): Promise<void> {
        await this.dataSource.transaction<void>("READ COMMITTED", async (transactionalEntityManager: EntityManager): Promise<void> => {
            const kindActivityLockRepository = new KindActivityLockRepository(transactionalEntityManager.getRepository(KindActivityLock));
            const taskRepository = new TaskRepository(transactionalEntityManager.getRepository(Task));
            await kindActivityLockRepository.releaseLockAsync(task.kindId, task.id);
            await this.allowTaskExecutionStateTransition(task, PushDepExecutionState.completed);
            await taskRepository.completeAsync(task.id, task.results);
        });
    }

    async cancelAsync(task: PushDepTask): Promise<void> {
        await this.dataSource.transaction<void>("READ COMMITTED", async (transactionalEntityManager: EntityManager): Promise<void> => {
            const kindActivityLockRepository = new KindActivityLockRepository(transactionalEntityManager.getRepository(KindActivityLock));
            const taskRepository = new TaskRepository(transactionalEntityManager.getRepository(Task));
            await kindActivityLockRepository.releaseLockAsync(task.kindId, task.id);
            await this.allowTaskExecutionStateTransition(task, PushDepExecutionState.canceled);
            await taskRepository.cancelAsync(task.id, task.results);
        });
    }

    async failAsync(task: PushDepTask): Promise<void> {
        await this.dataSource.transaction<void>("READ COMMITTED", async (transactionalEntityManager: EntityManager): Promise<void> => {
            const kindActivityLockRepository = new KindActivityLockRepository(transactionalEntityManager.getRepository(KindActivityLock));
            const taskRepository = new TaskRepository(transactionalEntityManager.getRepository(Task));
            await kindActivityLockRepository.releaseLockAsync(task.kindId, task.id);
            await this.allowTaskExecutionStateTransition(task, PushDepExecutionState.failed);
            await taskRepository.failAsync(task.id, task.results);
        });
    }

    async returnAsync(task: PushDepTask): Promise<void> {
        await this.dataSource.transaction<void>("READ COMMITTED", async (transactionalEntityManager: EntityManager): Promise<void> => {
            const kindActivityLockRepository = new KindActivityLockRepository(transactionalEntityManager.getRepository(KindActivityLock));
            const taskRepository = new TaskRepository(transactionalEntityManager.getRepository(Task));
            await kindActivityLockRepository.releaseLockAsync(task.kindId, task.id);
            await this.allowTaskExecutionStateTransition(task, PushDepExecutionState.pending);
            await taskRepository.returnAsync(task.id, task.results);
        });
    }

    async allowTaskExecutionStateTransition(task: PushDepTask, state: PushDepExecutionState): Promise<void> {
        const taskEntity = await this.taskRepository.findByTaskIdAsync(task.id);
        if (!taskEntity) {
            throw new Error(`Illegal state for task ${task.id}`);
        }
        if (!AllowedStateTransitions[taskEntity.state]?.includes(state)) {
            throw new Error(`Illegal state transition: ${PushDepExecutionState[taskEntity.state]} -> ${PushDepExecutionState[state]}`);
        }
    }

    async getTaskDependenciesAsync(task: PushDepTask): Promise<PushDepTask[] | null> {
        return task.id ? /* await */ this.taskRepository.getTaskDependenciesAsync(task.id) : null;
    }
}

export class TypeORMPushDep implements PushDep {
    taskService: TypeORMTaskService;

    constructor(private dataSource: DataSource) {
        this.taskService = new TypeORMTaskService(dataSource);
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
