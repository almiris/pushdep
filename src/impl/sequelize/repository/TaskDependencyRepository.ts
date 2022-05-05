import { Repository } from "sequelize-typescript";
import { GenericRepository } from "../helper/GenericRepository";
import { TaskDependency } from "../model/TaskDependency.model";

export class TaskDependencyRepository extends GenericRepository<TaskDependency> {
    constructor(taskDependencyRepository: Repository<TaskDependency>) {
        super(taskDependencyRepository);
    }
}
