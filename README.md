# PushDep

A concurrent executor for hierarchical tasks built with TypeScript and targeting Node JS. It can also be used as a simple message queue.

The library targets small to mid size projects that may not want to use a database, or a distributed in-memory cache. Nevertheless, it works well with a typeORM supported database.

Concurrency is set at the tasks level and at the workers level.

Usage: 

Available implementations:
1. In-memory
2. TypeORM

Deployment examples:

