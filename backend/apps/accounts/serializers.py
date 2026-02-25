"""
Accounts serializers — registration, user detail, profile update.
"""
from dj_rest_auth.registration.serializers import RegisterSerializer
from dj_rest_auth.serializers import UserDetailsSerializer
from rest_framework import serializers

from .models import User, UserProfile


class CustomRegisterSerializer(RegisterSerializer):
    """
    Extended registration serializer.
    Removes `username` requirement (email-only registration).
    """

    username = None

    def get_cleaned_data(self):
        data = super().get_cleaned_data()
        data.pop("username", None)
        return data


class UserProfileSerializer(serializers.ModelSerializer):
    """Serializer for UserProfile — exposed as nested object."""

    city_name = serializers.CharField(source="city.name", read_only=True)

    class Meta:
        model = UserProfile
        fields = ["id", "avatar_url", "bio", "city", "city_name", "is_verified", "created_at"]
        read_only_fields = ["id", "is_verified", "created_at"]


class UserDetailSerializer(UserDetailsSerializer):
    """
    Full user detail serializer — returned by GET /api/auth/me/.
    Includes nested profile data.
    """

    profile = UserProfileSerializer(read_only=True)

    class Meta(UserDetailsSerializer.Meta):
        model = User
        fields = ["id", "email", "first_name", "last_name", "profile", "date_joined"]
        read_only_fields = ["id", "email", "date_joined"]


class UserUpdateSerializer(serializers.ModelSerializer):
    """
    Serializer for PATCH /api/auth/me/ — allows updating basic user + profile fields.
    """

    avatar_url = serializers.URLField(source="profile.avatar_url", required=False)
    bio = serializers.CharField(source="profile.bio", required=False, allow_blank=True)
    city = serializers.UUIDField(source="profile.city_id", required=False, allow_null=True)

    class Meta:
        model = User
        fields = ["first_name", "last_name", "avatar_url", "bio", "city"]

    def update(self, instance, validated_data):
        profile_data = validated_data.pop("profile", {})
        # Update User fields
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        # Update profile fields
        if profile_data:
            profile = instance.profile
            for attr, value in profile_data.items():
                setattr(profile, attr, value)
            profile.save()
        return instance
