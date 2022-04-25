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

## Notes
- If a child completes / is canceled / fails, it's the parent responsability to do what it needs to do (complete / cancel / fail)
- task lifecycle: pending -> active -> (pending | completed | canceled | failed). A task cannot be recurrent. For recurring task, re-push the task periodically (with the historical data as args when needed)
- max retries <=> concern left to the worker. the worker can attach a max retry arg / result to the task then fail the task if the max number of retries is reached


