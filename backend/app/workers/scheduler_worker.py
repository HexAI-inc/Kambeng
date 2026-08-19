"""Consolidated background scheduler worker.

Runs as a dedicated process (see docker-compose `worker` service). All
scheduled jobs live here — the API process must NOT schedule jobs, otherwise
every API replica would run them too (which is how recurring charges ended up
double-processed).

Architecture:
  - APScheduler cron triggers only *enqueue* job ids onto an asyncio.Queue.
  - A pool of consumer tasks pulls from the queue and executes jobs with
    per-job timeout, retries, and backoff.
  - A job already queued or running is not enqueued again (dedup), so a slow
    run can never stack duplicate executions.
"""

import asyncio
import importlib
import logging
import pkgutil
import signal
from dataclasses import dataclass, field
from typing import Awaitable, Callable

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

logger = logging.getLogger(__name__)

QUEUE_MAXSIZE = 100
CONSUMER_COUNT = 2  # jobs that overlap (rare) run concurrently instead of blocking


def _load_all_models() -> None:
    """Import every model module so SQLAlchemy can resolve string-named
    relationships (e.g. Campaign -> "RecurringDonation") in this standalone
    process, where the API routes that normally import them never load."""
    import app.models

    for module in pkgutil.iter_modules(app.models.__path__):
        importlib.import_module(f"app.models.{module.name}")


@dataclass
class Job:
    id: str
    name: str
    func: Callable[[], Awaitable[None]]
    trigger: CronTrigger
    timeout_seconds: int = 1800
    max_attempts: int = 3
    retry_backoff_seconds: int = 60
    misfire_grace_time: int = 3600


def build_job_registry() -> list[Job]:
    # Imported here, after _load_all_models(), so mapper configuration succeeds.
    from app.services.kyc_reminder_service import send_pending_kyc_reminders
    from app.services.marketing_service import process_marketing_sequences
    from app.services.recurring_charge_service import process_recurring_charges

    return [
        Job(
            id="process_recurring_charges",
            name="Process Recurring Donations",
            func=process_recurring_charges,
            trigger=CronTrigger(hour=2, minute=0, timezone="UTC"),
        ),
        Job(
            id="process_marketing_sequences",
            name="Send Marketing Nurture Sequence Emails",
            func=process_marketing_sequences,
            trigger=CronTrigger(hour=10, minute=0, timezone="UTC"),
        ),
        Job(
            id="send_pending_kyc_reminders",
            name="Send Pending KYC Reminders",
            func=send_pending_kyc_reminders,
            trigger=CronTrigger(hour=8, minute=0, timezone="UTC"),
        ),
    ]


@dataclass
class JobRunner:
    jobs: dict[str, Job]
    queue: asyncio.Queue = field(default_factory=lambda: asyncio.Queue(maxsize=QUEUE_MAXSIZE))
    _in_flight: set = field(default_factory=set)  # job ids queued or running

    def enqueue(self, job_id: str) -> None:
        """Called by APScheduler at each cron tick. Never blocks the scheduler."""
        if job_id in self._in_flight:
            logger.warning(
                "Job already queued or running; skipping duplicate enqueue",
                extra={"action": "job_enqueue_skipped", "job_id": job_id},
            )
            return
        try:
            self.queue.put_nowait(job_id)
            self._in_flight.add(job_id)
            logger.info("Job enqueued", extra={"action": "job_enqueued", "job_id": job_id})
        except asyncio.QueueFull:
            logger.error("Job queue full; dropping job", extra={"action": "job_queue_full", "job_id": job_id})

    async def consume(self, consumer_id: int) -> None:
        while True:
            job_id = await self.queue.get()
            job = self.jobs[job_id]
            try:
                await self._run_with_retries(job, consumer_id)
            finally:
                self._in_flight.discard(job_id)
                self.queue.task_done()

    async def _run_with_retries(self, job: Job, consumer_id: int) -> None:
        for attempt in range(1, job.max_attempts + 1):
            try:
                async with asyncio.timeout(job.timeout_seconds):
                    await job.func()
                logger.info(
                    "Job completed",
                    extra={"action": "job_completed", "job_id": job.id, "attempt": attempt, "consumer": consumer_id},
                )
                return
            except asyncio.CancelledError:
                raise  # shutting down; don't swallow
            except Exception:
                logger.exception(
                    "Job attempt failed",
                    extra={"action": "job_attempt_failed", "job_id": job.id, "attempt": attempt},
                )
                if attempt < job.max_attempts:
                    await asyncio.sleep(job.retry_backoff_seconds * attempt)
        logger.error(
            "Job failed after all attempts",
            extra={"action": "job_failed", "job_id": job.id, "attempts": job.max_attempts},
        )


async def run_scheduler_worker() -> None:
    _load_all_models()

    registry = build_job_registry()
    runner = JobRunner(jobs={job.id: job for job in registry})

    scheduler = AsyncIOScheduler(timezone="UTC")
    for job in registry:
        scheduler.add_job(
            runner.enqueue,
            job.trigger,
            args=[job.id],
            id=job.id,
            name=job.name,
            replace_existing=True,
            misfire_grace_time=job.misfire_grace_time,
        )
    scheduler.start()

    consumers = [asyncio.create_task(runner.consume(i)) for i in range(CONSUMER_COUNT)]
    logger.info(
        "Scheduler worker started",
        extra={"action": "scheduler_worker_startup", "jobs": [job.id for job in registry]},
    )

    stop_event = asyncio.Event()
    loop = asyncio.get_running_loop()
    for sig in (signal.SIGINT, signal.SIGTERM):
        try:
            loop.add_signal_handler(sig, stop_event.set)
        except NotImplementedError:
            pass

    try:
        await stop_event.wait()
    finally:
        if scheduler.running:
            scheduler.shutdown(wait=False)
        for task in consumers:
            task.cancel()
        await asyncio.gather(*consumers, return_exceptions=True)
        logger.info("Scheduler worker shut down", extra={"action": "scheduler_worker_shutdown"})


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
    asyncio.run(run_scheduler_worker())
