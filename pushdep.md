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


  