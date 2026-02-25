"""
Custom DRF permission classes for POA Eventos.
"""
from rest_framework.permissions import BasePermission, SAFE_METHODS


class IsOwnerOrReadOnly(BasePermission):
    """
    Object-level permission: only the owner of an object may modify it.
    Read-only access (GET, HEAD, OPTIONS) is allowed for everyone.

    The object must have an `organizer_user` or `user` attribute.
    """

    def has_object_permission(self, request, view, obj):
        if request.method in SAFE_METHODS:
            return True
        owner = getattr(obj, "organizer_user", None) or getattr(obj, "user", None)
        return owner == request.user


class IsVerifiedOrganizer(BasePermission):
    """Only verified organizers (profile.is_verified) can use this view."""

    message = "Only verified organizers have access."

    def has_permission(self, request, view):
        return (
            request.user
            and request.user.is_authenticated
            and hasattr(request.user, "profile")
            and request.user.profile.is_verified
        )


class IsAdminOrReadOnly(BasePermission):
    """Admin users can write; everyone else read-only."""

    def has_permission(self, request, view):
        if request.method in SAFE_METHODS:
            return True
        return request.user and request.user.is_staff
