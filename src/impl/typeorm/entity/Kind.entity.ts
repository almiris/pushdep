import { PushDepKind } from "src/core/PushDep";
import { Column, CreateDateColumn, DeleteDateColumn, Entity, OneToMany, PrimaryColumn, UpdateDateColumn, VersionColumn } from "typeorm";
import { Task } from "./Task.entity";

@Entity("kind")
export class Kind implements PushDepKind {

    @PrimaryColumn({
        name: "id",
        type: "text",
        comment: "Id of this kind"
    })
    id: string;

    @Column({
        name: "concurrency",
        type: "int",
        nullable: false,
        comment: "Max concurrency for this kind - Multiple workers will only be able to execute this number of tasks concurrently"
    })
    concurrency: number;

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

      @OneToMany(() => Task, task => task.kind)
      tasks: Promise<Task[]>;
}
