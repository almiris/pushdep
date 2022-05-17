import { Repository } from "sequelize-typescript";
import { Op, Transaction } from "sequelize";
import { PushDepExecutionState } from "../../../core/PushDep";
import { GenericRepository } from "../helper/GenericRepository";
import { Task } from "../model/Task.model";
import { TaskExecution } from "../model/TaskExecution.model";

export class TaskRepository extends GenericRepository<Task> {
    constructor(taskRepository: Repository<Task>) {
        super(taskRepository);
    }

    async findPendingTaskWithHighestPriorityAndNoPendingOrActiveDependencyAsync(transaction: Transaction | null, kindId: string, lock = false): Promise<Task> {
        return await this.repository.findOne({
            transaction: transaction,
            lock: lock ? transaction.LOCK.UPDATE /*{
                level: transaction.LOCK.UPDATE,
                // of: Task
             }*/ : false,
            skipLocked: lock ? true : false,
            where: {
                [Op.and]: [{
                        kindId: kindId
                    },
                    this.repository.sequelize.literal(`(SELECT COUNT(td.task_id) FROM task_dependency AS td
                        INNER JOIN task_execution as tde ON td.dependency_id = tde.task_id 
                        WHERE td.task_id = "Task".id
                        AND (tde.state = ${PushDepExecutionState.pending} OR tde.state = ${PushDepExecutionState.active})) = 0`)
                ]
            }, 
            include: {
                model: TaskExecution,
                required: true,
                attributes: [],
                where: {
                    state: PushDepExecutionState.pending
                }
            },
            order: [
                ["priority", "DESC"], 
                [Task.associations.taskExecutions, "createdAt", "ASC"]
            ]
        });
    }

    async countActiveTasks(transaction: Transaction, kindId: string): Promise<number> {
        return await this.repository.count({
            transaction: transaction,
            where: {
                kindId: kindId
            },
            include: {
                model: TaskExecution,
                required: true,
                where: {
                    state: PushDepExecutionState.active
                }
            }
        });
    }
}
