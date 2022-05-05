import { PushDepExecutionState } from "src/core/PushDep";
import { Repository } from "typeorm";
import { Task } from "../entity/Task.entity";
import { GenericRepository } from "../helper/GenericRepository";

export class TaskRepository extends GenericRepository<Task> {
    constructor(taskRepository: Repository<Task>) {
        super(taskRepository);
    }

    async findPendingTaskWithHighestPriorityAndNoPendingOrActiveDependencyAsync(kindId: string, lock = false): Promise<Task> {
        const queryBuilder = this.repository.createQueryBuilder("task");
        if (lock) {
            queryBuilder.setLock("pessimistic_write")
        }
        return await queryBuilder.innerJoin("task.taskExecutions", "taskExecutions", "task.kindId = :kindId and taskExecutions.state = :state", { kindId: kindId, state: PushDepExecutionState.pending })
            .where((qb) => {
                return `${qb
                    .subQuery()
                    .select("COUNT(td.task_id)")
                    .from("task_dependency", "td")
                    .innerJoin("task_execution", "tde", "td.dependency_id = tde.task_id and td.task_id = task.id and (tde.state = :pendingState or tde.state = :activeState)", { pendingState: PushDepExecutionState.pending, activeState: PushDepExecutionState.active })
                    .getQuery()}=0`;
            })
            .orderBy("task.priority", "DESC")
            .addOrderBy("taskExecutions.createdAt", "ASC")
            .getOne();
    }

    async countActiveTasks(kindId: string): Promise<number> {
        return await this.repository
            .createQueryBuilder("task")
            .innerJoin("task.taskExecutions", "taskExecutions", "task.kindId = :kindId and taskExecutions.state = :state", { kindId: kindId, state: PushDepExecutionState.active })
            .getCount();
    }
}
