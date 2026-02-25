"""Celery application configuration for POA Eventos."""
import os
from celery import Celery
from celery.schedules import crontab

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.development")

app = Celery("poa_eventos")
app.config_from_object("django.conf:settings", namespace="CELERY")
app.autodiscover_tasks()

# ----------------------------------------------------------------
# Periodic tasks (Celery Beat)
# ----------------------------------------------------------------
app.conf.beat_schedule = {
    # Run every hour: expire events whose end_datetime has passed
    "expire-old-events": {
        "task": "apps.events.tasks.expire_old_events",
        "schedule": crontab(minute=0),  # top of every hour
    },
    # Run daily: send 24h reminders to GOING/INTERESTED users
    "send-event-reminders": {
        "task": "apps.events.tasks.send_event_reminders",
        "schedule": crontab(hour=9, minute=0),  # 09:00 UTC daily
    },
}
