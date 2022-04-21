idt0 = push(tech(0))
for (i in 10..100 step 10)
  idt = push(tech(i))
  ide = push(eco(idt0, idt))

transactioner ?
actioner ?

push task 
  id
  when = asap, not after ...
  retry = max every ... or method
  type / kind / sort / class 
  depends on = [ tasks ]
  status = pending / started / completed / canceled
  createdAt
  createdBy
  startedBy
  startedAt
  completedAt
  failedAt
  canceledAt
  reason
  worker
  token (uuid)
  maxExecutionTime
  args (args or argsProvider + args)


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




