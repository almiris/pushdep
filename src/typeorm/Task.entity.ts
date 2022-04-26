import { PushDepTask } from "src/core/PushDep";
import { Column, CreateDateColumn, DeleteDateColumn, Entity, Generated, JoinColumn, JoinTable, ManyToMany, ManyToOne, OneToMany, PrimaryColumn, PrimaryGeneratedColumn, UpdateDateColumn, VersionColumn } from "typeorm";
import { Kind } from "./Kind.entity";
import { TaskExecution } from "./TaskExecution.entity";

@Entity()
export class Task implements PushDepTask {

    @PrimaryColumn({
        name: "id",
        type: "uuid"
      })
    @Generated("uuid")
    id: string;

    @Column({
        name: "priority", // TODO move priority to task execution?
        type: "int",
        nullable: false,
        comment: "Priority of the task"
    })
    priority: number;

    @Column({
        name: "args",
        type: "jsonb",
        nullable: true,
        comment: "Arguments of the task"
    })
    args: any;

    @Column({
        name: "results",
        type: "jsonb",
        nullable: true,
        comment: "Results of the task"
    })
    results: any;
          
    @CreateDateColumn({
        name: "created_at",
        type: "timestamp with time zone",
        nullable: false,
      })
      createdAt: Date;
    
    @UpdateDateColumn({
        name: "updated_at",
        type: "timestamp with time zone",
        nullable: false,
    })
    updatedAt: Date;
    
    @DeleteDateColumn({
        name: "deleted_at",
        type: "timestamp with time zone",
        nullable: true
    })
    deletedAt: Date;
    
    @VersionColumn({
        name: "version",
        type: "int",
        nullable: false
    })
    version: number;       

    @Column({
        name: "kind_id",
        nullable: false
    })
    kindId: string;
    
    @ManyToOne(() => Kind, kind => kind.tasks, {
        nullable: true
    })
    @JoinColumn({ name: "kind_id" })
    kind: Kind;    

    @ManyToMany(() => Task)
    @JoinTable({
        name: "task_dependencies",
        joinColumn: {
            name: "task",
            referencedColumnName: "id"
        },
        inverseJoinColumn: {
            name: "dependency",
            referencedColumnName: "id"
        }
    })
    dependencies: Task[];

    @ManyToMany(() => Task, task => task.dependencies)
    children: Task[];

    @OneToMany(() => TaskExecution, taskExecution => taskExecution.task)
    taskExecutions: Promise<TaskExecution[]>;
}
