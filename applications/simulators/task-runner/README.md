# Task Runner
This Node.js application is used for Use case 2: Temporal Workload Offloading. The application acts as a Kafka message consumer, listening to a specified topic for incoming tasks. Each received message triggers a simulated task that runs for a specified duration, simulating real-world computational work.

Since the application might be forced to stop by operators's decision at any time, it implements a shutdown mechanism that initiates a graceful shutdown process when the system receives termination signals like SIGTERM or SIGINT. This ensures that any currently running task completes before the application stops, preventing interruptions that could lead to data loss or incomplete computations.

The `.env.example` file represents enviroment variables that are provided to application during runtime. WHen deployed to cluster, these values are loaded from COnfigMap within kubernetes.