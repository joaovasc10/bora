"""
config/__init__.py — import Celery app so it's loaded with Django.
"""
from .celery import app as celery_app

__all__ = ("celery_app",)
