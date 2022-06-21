import { Repository } from "typeorm";
import { TaskDependency } from "../entity/TaskDependency.entity";
import { GenericRepository } from "../helper/GenericRepository";

export class TaskDependencyRepository extends GenericRepository<TaskDependency> {
    constructor(taskDependencyRepository: Repository<TaskDependency>) {
        super(taskDependencyRepository);
    }
}
