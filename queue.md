
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

