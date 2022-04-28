import { PushDepExecutionState } from "src/core/PushDep";
import { Repository } from "typeorm";
import { Task } from "../entity/Task.entity";
import { GenericService } from "../helper/GenericService";

export class TaskService extends GenericService<Task> {
    constructor(private taskRepository: Repository<Task>) {
        super(taskRepository);
    }

    async findPendingTaskWithHighestPriorityAndNoPendingOrActiveDependency(kindId: string) {
        return this.taskRepository
            .createQueryBuilder("task")
            .innerJoin("task.taskExecutions", "taskExecutions", "task.kindId = :kindId and taskExecutions.state = :state", { kindId: kindId, state: PushDepExecutionState.pending })
            .where((qb) => {
                return `${qb
                    .subQuery()
                    .select("COUNT(subtask.id)")
                    .from("Task", "subtask")
                    .innerJoin("subtask.dependencies", "subtaskDependencies", "subtask.id = task.id")
                    .innerJoin("subtaskDependencies.taskExecutions", "subtaskExecutions", "subtaskExecutions.state = :pendingState or subtaskExecutions.state = :activeState", { pendingState: PushDepExecutionState.pending, activeState: PushDepExecutionState.active })
                    .getQuery()}=0`;
            })
            .orderBy("task.priority", "DESC")
            .addOrderBy("task.createdAt", "DESC")
            .getOne();
    }
}
