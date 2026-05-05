import asyncio
import logging
import signal

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

from app.services.recurring_charge_service import process_recurring_charges

logger = logging.getLogger(__name__)


async def run_recurring_donations_worker() -> None:
    """Run recurring donation processing in a dedicated background worker process."""
    scheduler = AsyncIOScheduler(timezone="UTC")
    scheduler.add_job(
        process_recurring_charges,
        CronTrigger(hour=2, minute=0, timezone="UTC"),
        id="process_recurring_charges",
        name="Process Recurring Donations",
        replace_existing=True,
    )
    scheduler.start()
    logger.info("Recurring donation worker started", extra={"action": "recurring_worker_startup"})

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
            logger.info("Recurring donation worker shut down", extra={"action": "recurring_worker_shutdown"})


if __name__ == "__main__":
    asyncio.run(run_recurring_donations_worker())