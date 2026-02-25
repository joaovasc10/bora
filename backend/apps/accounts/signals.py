"""
Accounts signals — auto-create UserProfile on User creation.
"""
from django.contrib.auth import get_user_model
from django.db.models.signals import post_save
from django.dispatch import receiver

User = get_user_model()


@receiver(post_save, sender=User)
def create_user_profile(sender, instance, created, **kwargs):
    """Ensure every new User gets a UserProfile automatically."""
    if created:
        from apps.accounts.models import UserProfile
        UserProfile.objects.get_or_create(user=instance)
