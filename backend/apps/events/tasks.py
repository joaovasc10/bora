"""
Celery tasks for the events app.
"""
import structlog
from celery import shared_task
from django.utils import timezone

logger = structlog.get_logger(__name__)


@shared_task(name="apps.events.tasks.increment_view_count")
def increment_view_count(event_id: str) -> None:
    """
    Asynchronously increment the view_count of an event.
    Decouples the analytics write from the HTTP response cycle.
    """
    from .models import Event
    updated = Event.objects.filter(id=event_id, deleted_at__isnull=True).update(
        view_count=__import__("django.db.models", fromlist=["F"]).F("view_count") + 1
    )
    if updated:
        logger.debug("view_count_incremented", event_id=event_id)


@shared_task(name="apps.events.tasks.expire_old_events")
def expire_old_events() -> int:
    """
    Mark events as EXPIRED when their end_datetime has passed.
    Runs hourly via Celery Beat.
    Returns the number of events expired.
    """
    from .models import Event, EventStatus
    now = timezone.now()
    expired = Event.objects.filter(
        end_datetime__lt=now,
        status=EventStatus.PUBLISHED,
        deleted_at__isnull=True,
    ).update(status=EventStatus.EXPIRED)
    if expired:
        logger.info("events_expired", count=expired, run_at=now.isoformat())
    return expired


@shared_task(name="apps.events.tasks.send_event_reminders")
def send_event_reminders() -> int:
    """
    Send email reminders to users who are GOING or INTERESTED in events
    starting in approximately 24 hours.
    Runs daily at 09:00 UTC via Celery Beat.
    """
    from datetime import timedelta
    from django.core.mail import send_mail
    from django.conf import settings
    from .models import Event, EventInteraction, EventStatus

    now = timezone.now()
    window_start = now + timedelta(hours=23)
    window_end = now + timedelta(hours=25)

    upcoming = Event.objects.filter(
        start_datetime__gte=window_start,
        start_datetime__lte=window_end,
        status=EventStatus.PUBLISHED,
        deleted_at__isnull=True,
    )

    sent = 0
    for event in upcoming:
        interested_users = (
            EventInteraction.objects.filter(
                event=event,
                interaction_type__in=[
                    EventInteraction.InteractionType.GOING,
                    EventInteraction.InteractionType.INTERESTED,
                ],
            )
            .select_related("user")
            .values_list("user__email", flat=True)
        )

        recipients = list(set(interested_users))
        if not recipients:
            continue

        try:
            send_mail(
                subject=f"🗓️ Lembrete: {event.title} começa amanhã!",
                message=(
                    f"Olá!\n\n"
                    f"O evento que você marcou interesse está chegando:\n\n"
                    f"📍 {event.title}\n"
                    f"📅 {event.start_datetime.strftime('%d/%m/%Y às %H:%M')}\n"
                    f"📌 {event.address or event.neighborhood}\n\n"
                    f"Veja mais detalhes em: {settings.FRONTEND_URL}/events/{event.id}\n\n"
                    f"Equipe POA Eventos"
                ),
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=recipients,
                fail_silently=False,
            )
            sent += len(recipients)
            logger.info(
                "reminder_emails_sent",
                event_id=str(event.id),
                recipients_count=len(recipients),
            )
        except Exception as exc:
            logger.error("reminder_email_failed", event_id=str(event.id), error=str(exc))

    return sent


@shared_task(name="apps.events.tasks.notify_event_published")
def notify_event_published(event_id: str) -> None:
    """
    Notify the organizer that their event has been approved and published.
    Triggered manually by admin when they approve an event.
    """
    from django.core.mail import send_mail
    from django.conf import settings
    from .models import Event

    try:
        event = Event.objects.select_related("organizer_user").get(id=event_id)
    except Event.DoesNotExist:
        logger.warning("notify_published_event_not_found", event_id=event_id)
        return

    if not event.organizer_user or not event.organizer_user.email:
        return

    send_mail(
        subject=f"✅ Seu evento foi aprovado: {event.title}",
        message=(
            f"Parabéns, {event.organizer_name}!\n\n"
            f"Seu evento '{event.title}' foi aprovado e já aparece no mapa do POA Eventos.\n\n"
            f"Veja em: {settings.FRONTEND_URL}/events/{event.id}\n\n"
            f"Equipe POA Eventos"
        ),
        from_email=settings.DEFAULT_FROM_EMAIL,
        recipient_list=[event.organizer_user.email],
        fail_silently=True,
    )
    logger.info("event_published_notification_sent", event_id=event_id)
