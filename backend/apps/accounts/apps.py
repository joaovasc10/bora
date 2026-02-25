"""Accounts Django AppConfig."""
from django.apps import AppConfig


class AccountsConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.accounts"
    label = "accounts"

    def ready(self):
        import apps.accounts.signals  # noqa: F401
    label = "accounts"

    def ready(self):
        import apps.accounts.signals  # noqa — registers signal handlers
