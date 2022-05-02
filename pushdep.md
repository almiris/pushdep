# Notes

idt0 = push(tech(0))
for (i in 10..100 step 10)
  idt = push(tech(i))
  ide = push(eco(idt0, idt))

transactioner ?
actioner ?

push task 
  id
  when = asap, not after, cron ... => maybe later; as of now, it is the concern of the caller
  retry = max every ... or method
  type / kind / sort / class 
  depends on = [ tasks ]
  status = pending / active / completed / canceled / failed
  createdAt
  createdBy
  startedBy
  startedAt
  completedAt
  failedAt
  canceledAt
  reason
  worker
  token (uuid) works with maxExecutionTime; if maxExecutionTime is exceeded and the task has a retry then another worker may take the task => V2
  maxExecutionTime => V2
  args (args or argsProvider + args) argsProvider is searching args elsewhere (in a file, a DB, a cache). a mecanism should allow args sharing (not needed if args are external and located using a URL / URI)

task = select * from task where kind = ... and status = pending or (status = started and now() - startedAt > maxExecutionTime) limit 1 for update and count(select * from task ...) < max_parallelism
update task set startedAt = now(), startedBy = <me>, token = uuid where id = task.id
execTask (or Tx) may be interrupted
select token from task where task.id = id
if (token != task.token)
rollback
else 

taskHandler(execute, rollback)

https://hackernoon.com/database-concurrencies-with-typeorm-6b1631k8

https://orkhan.gitbook.io/typeorm/docs/transactions

https://typeorm.io/find-options




worker:
    with queue
    if count(get todo jobs) > 0
        if count(get active jobs) != queue concurrency
            get master lock
            get jobs where !started and (count(get job dependencies) = 0 or count(get job !completed dependencies) = 0)
            set jobs ready
            release master lock




  get master lock
  set executable jobs to max executable


## Todo
- cyclic redondancy check, needed ? => no, user's responsibility
- child -> parent relationship, or isRoot (or hasParent) on task could help clean tasks for
in memory storage; or TTL, or parent counter (to supported multiple unrelated parents)
- when popping a task, the dependencies results are not sent automatically. it is the worker responsibility to call getDependenciesResults()
- implement shared task store : sql database, redis...
- implement bindings in other programming languages
- re-pushing tasks may lead to have orphin tasks - should we check that or do we leave the responsability to the user?
- move priority to taskExecution to make it invariant unless task is repushed
- auto deletion of completed as soon as it is completed, using a TTL. TTL = 0 auto deletion, TTL > 0 will be deleted from time to time (depending on the number of tasks in the system or some periodicity), TTL = -1 keep the task => cleaning will be realized by a worker or an external system using the pushdep directly
- add tags to task - could help search task in the DB instead of having to use JSON searching; using a table like (task_id, tag, value) with (task_id, tag) as PK
- if a task needs to have multiple executions, for example a recurring task, we would have n tasks and we could link those tasks (for example, using a tag with the same value?)
- we could extends the simple task execution log we have now to a full log (pending -> active -> pending -> active -> ... -> active -> completed)
- change active task from worker - change dependencies, change args, change results
- manager task removal (only by workers or by time ?)
- add time schedule for tasks (@see retry at below)
- allow "back to pending" from workers (only for active tasks)
- retryAt, could replace createdAt to find the next task. Initially, retryAt == createdAt. If a worker can't complete a task and would like a retry, then it can set the retryAt at a later timestamp; add a retried counter <=> The worker can track the retries in the results field if wanted.
- clean the returned PushDepTasks (remove createdAt, updatedAt, deletedAt, version)
- on the front side : inmemorypushdep, or typeorm pushdep through delegated pushdep via controller
- auto delete on complete / failed / cancel? (or we leave this to the worker providing methods to delete / remove a task and its dependencies). May be enough for inmemory, not for db (in case of a crash of the worker while executing a task, or a page reload, of a connection loss). for db, we need to ensure
that the task will be completed and/or cleaned. this could be the role of a dedicated worker using
a max execution time; if now - last state time > max execution time, then clean(kind) would return the task that could then be returned (to pending) or deleted. The worker is should be written in the task allowing the worker to control if it still owns the task when it try to update the task (a slow worker could have lost the ownership of the task)
- Worker auto stop - worker would automatically stop as soon as their is no more task of the worker's kind available
- Add indexes (for example, taskexecution.state, task.priority)

## Notes
- If a child completes / is canceled / fails, it's the parent responsability to do what it needs to do (complete / cancel / fail)
- task lifecycle: pending -> active -> (pending | completed | canceled | failed). A task cannot be recurrent. For recurring task, re-push the task periodically (with the historical data as args when needed)
- max retries <=> concern left to the worker. the worker can attach a max retry arg / result to the task then fail the task if the max number of retries is reached (@see retryAt above)
- no repush for now, meaning no modification of a task after it has been pushed. accepting modification would mean modifiying dependencies and their dependencies, removing previous dependencies not used anymore and creating new ones.
- Future changes may impact the db model. It could be recommended to use task.results to store a link to the real results if this results is meant to be reused instead of storing the result itself in the db

## Useful requests

### Clear connections
SELECT
	pg_terminate_backend(pg_stat_activity.pid)
FROM
	pg_stat_activity
WHERE
	pg_stat_activity.datname = '<database>'
	AND pid <> pg_backend_pid();

