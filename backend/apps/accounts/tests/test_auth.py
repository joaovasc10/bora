"""
Tests for authentication endpoints.
"""
import pytest
from django.urls import reverse


@pytest.mark.django_db
class TestRegister:
    url = "/api/auth/register/"

    def test_register_success(self, api_client):
        payload = {
            "email": "newuser@example.com",
            "password1": "StrongPass123!",
            "password2": "StrongPass123!",
        }
        resp = api_client.post(self.url, payload)
        assert resp.status_code == 201
        data = resp.json()
        assert "access" in data
        assert "refresh" in data

    def test_register_duplicate_email(self, api_client, user):
        payload = {
            "email": user.email,
            "password1": "StrongPass123!",
            "password2": "StrongPass123!",
        }
        resp = api_client.post(self.url, payload)
        assert resp.status_code == 400

    def test_register_weak_password(self, api_client):
        payload = {"email": "weak@example.com", "password1": "123", "password2": "123"}
        resp = api_client.post(self.url, payload)
        assert resp.status_code == 400

    def test_register_password_mismatch(self, api_client):
        payload = {
            "email": "mis@example.com",
            "password1": "StrongPass123!",
            "password2": "DifferentPass123!",
        }
        resp = api_client.post(self.url, payload)
        assert resp.status_code == 400


@pytest.mark.django_db
class TestLogin:
    url = "/api/auth/login/"

    def test_login_success(self, api_client, user):
        resp = api_client.post(self.url, {"email": user.email, "password": "TestPass123!"})
        assert resp.status_code == 200
        data = resp.json()
        assert "access" in data
        assert "refresh" in data

    def test_login_wrong_password(self, api_client, user):
        resp = api_client.post(self.url, {"email": user.email, "password": "WrongPass!"})
        assert resp.status_code == 400

    def test_login_nonexistent_user(self, api_client):
        resp = api_client.post(self.url, {"email": "ghost@nowhere.com", "password": "pass"})
        assert resp.status_code == 400


@pytest.mark.django_db
class TestLogout:
    url = "/api/auth/logout/"

    def test_logout_success(self, auth_client, user):
        from rest_framework_simplejwt.tokens import RefreshToken

        refresh = str(RefreshToken.for_user(user))
        resp = auth_client.post(self.url, {"refresh": refresh})
        assert resp.status_code == 205

    def test_logout_missing_token(self, auth_client):
        resp = auth_client.post(self.url, {})
        assert resp.status_code == 400

    def test_logout_requires_auth(self, api_client, user):
        from rest_framework_simplejwt.tokens import RefreshToken

        refresh = str(RefreshToken.for_user(user))
        resp = api_client.post(self.url, {"refresh": refresh})
        assert resp.status_code == 401


@pytest.mark.django_db
class TestMeEndpoint:
    url = "/api/auth/me/"

    def test_get_me_authenticated(self, auth_client, user):
        resp = auth_client.get(self.url)
        assert resp.status_code == 200
        data = resp.json()
        assert data["email"] == user.email
        assert "profile" in data

    def test_get_me_unauthenticated(self, api_client):
        resp = api_client.get(self.url)
        assert resp.status_code == 401

    def test_patch_me(self, auth_client):
        resp = auth_client.patch(self.url, {"first_name": "Updated"})
        assert resp.status_code == 200


@pytest.mark.django_db
class TestTokenRefresh:
    url = "/api/auth/token/refresh/"

    def test_refresh_success(self, api_client, user):
        from rest_framework_simplejwt.tokens import RefreshToken

        refresh = str(RefreshToken.for_user(user))
        resp = api_client.post(self.url, {"refresh": refresh})
        assert resp.status_code == 200
        assert "access" in resp.json()
