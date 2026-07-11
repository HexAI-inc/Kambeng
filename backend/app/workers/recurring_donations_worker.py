"""Deprecated entrypoint — jobs moved to app.workers.scheduler_worker.

Kept so a deployment still running the old docker-compose command keeps
working (it now runs the full consolidated worker, including recurring
donations). Update the compose command to `python -m app.workers.scheduler_worker`.
"""

import asyncio
import logging

from app.workers.scheduler_worker import run_scheduler_worker

logger = logging.getLogger(__name__)


async def run_recurring_donations_worker() -> None:
    logger.warning(
        "recurring_donations_worker is deprecated; running scheduler_worker instead",
        extra={"action": "deprecated_worker_entrypoint"},
    )
    await run_scheduler_worker()


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
    asyncio.run(run_recurring_donations_worker())
