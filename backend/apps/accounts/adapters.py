"""
Custom allauth adapters — handle account creation hooks and Google OAuth.
"""
import structlog
from allauth.account.adapter import DefaultAccountAdapter
from allauth.socialaccount.adapter import DefaultSocialAccountAdapter

logger = structlog.get_logger(__name__)


class CustomAccountAdapter(DefaultAccountAdapter):
    """
    Override default account creation to auto-create UserProfile.
    """

    def save_user(self, request, user, form, commit=True):
        user = super().save_user(request, user, form, commit=commit)
        if commit and not hasattr(user, "profile"):
            from apps.accounts.models import UserProfile
            UserProfile.objects.get_or_create(user=user)
            logger.info("user_profile_created", user_id=str(user.id), email=user.email)
        return user


class CustomSocialAccountAdapter(DefaultSocialAccountAdapter):
    """
    Override Google OAuth flow to populate UserProfile with avatar from Google.
    """

    def save_user(self, request, sociallogin, form=None):
        user = super().save_user(request, sociallogin, form=form)
        from apps.accounts.models import UserProfile

        profile, _ = UserProfile.objects.get_or_create(user=user)

        extra_data = sociallogin.account.extra_data
        if not profile.avatar_url and extra_data.get("picture"):
            profile.avatar_url = extra_data["picture"]
            profile.save(update_fields=["avatar_url"])
            logger.info(
                "profile_avatar_set_from_google",
                user_id=str(user.id),
                email=user.email,
            )
        return user
