"""In-memory server-side session vault; tokens never enter browser storage or disk."""
from __future__ import annotations

import time
from dataclasses import dataclass
from threading import RLock

from .supabase_gateway import SupabaseGateway, SupabaseError


@dataclass
class SessionEntry:
    auth: dict
    touched_at: float


class SessionVault:
    def __init__(self, idle_timeout_seconds: int = 0, max_sessions: int = 80):
        self.idle_timeout_seconds = max(0, int(idle_timeout_seconds))
        self.max_sessions = max_sessions
        self._lock = RLock()
        self._sessions: dict[str, SessionEntry] = {}

    def add(self, session_id: str, auth: dict) -> None:
        now = time.time()
        with self._lock:
            self._remove_expired(now)
            if session_id in self._sessions:
                self._sessions.pop(session_id, None)
            if len(self._sessions) >= self.max_sessions:
                raise SupabaseError(
                    "The local application has reached its session limit. Sign out another session.",
                    429,
                    "local_session_limit",
                )
            self._sessions[session_id] = SessionEntry(dict(auth), now)

    def _remove_expired(self, now: float) -> None:
        if not self.idle_timeout_seconds:
            return
        for key, entry in list(self._sessions.items()):
            if now - entry.touched_at > self.idle_timeout_seconds:
                self._sessions.pop(key, None)

    def get(self, session_id: str | None, gateway: SupabaseGateway) -> dict:
        if not session_id:
            raise SupabaseError("Please sign in to TFI.", 401, "session_missing")

        with self._lock:
            entry = self._sessions.get(session_id)
            if not entry:
                raise SupabaseError("Your TFI session has expired. Sign in again.", 401, "session_expired")

            now = time.time()
            if self.idle_timeout_seconds and now - entry.touched_at > self.idle_timeout_seconds:
                self._sessions.pop(session_id, None)
                raise SupabaseError("Your TFI session timed out. Sign in again.", 401, "session_idle_timeout")

            if now >= float(entry.auth.get("expires_at", 0)) - 120:
                try:
                    refreshed = gateway.refresh_session(entry.auth["refresh_token"])
                except SupabaseError:
                    self._sessions.pop(session_id, None)
                    raise
                entry.auth.update(refreshed)

            entry.touched_at = now
            return dict(entry.auth)

    def remove(self, session_id: str | None) -> None:
        if not session_id:
            return
        with self._lock:
            self._sessions.pop(session_id, None)

    def clear(self) -> None:
        with self._lock:
            self._sessions.clear()

    def count(self) -> int:
        with self._lock:
            self._remove_expired(time.time())
            return len(self._sessions)


@dataclass
class RecoveryEntry:
    auth: dict
    expires_at: float


class RecoveryVault:
    """Short-lived server-side store for verified password-recovery tokens."""

    def __init__(self, ttl_seconds: int = 600, max_sessions: int = 10):
        self.ttl_seconds = max(60, int(ttl_seconds))
        self.max_sessions = max_sessions
        self._lock = RLock()
        self._sessions: dict[str, RecoveryEntry] = {}

    def add(self, recovery_id: str, auth: dict) -> None:
        now = time.time()
        with self._lock:
            self._remove_expired(now)
            if len(self._sessions) >= self.max_sessions:
                raise SupabaseError(
                    "Too many password-recovery attempts are active. Request a new link later.",
                    429,
                    "recovery_session_limit",
                )
            self._sessions[recovery_id] = RecoveryEntry(
                auth=dict(auth),
                expires_at=now + self.ttl_seconds,
            )

    def _remove_expired(self, now: float) -> None:
        for key, entry in list(self._sessions.items()):
            if now >= entry.expires_at:
                self._sessions.pop(key, None)

    def get(self, recovery_id: str | None) -> dict:
        if not recovery_id:
            raise SupabaseError(
                "The password-recovery session is missing. Request a new reset link.",
                401,
                "recovery_session_missing",
            )
        with self._lock:
            entry = self._sessions.get(recovery_id)
            if not entry:
                raise SupabaseError(
                    "The password-recovery session expired. Request a new reset link.",
                    401,
                    "recovery_session_expired",
                )
            if time.time() >= entry.expires_at:
                self._sessions.pop(recovery_id, None)
                raise SupabaseError(
                    "The password-recovery session expired. Request a new reset link.",
                    401,
                    "recovery_session_expired",
                )
            return dict(entry.auth)

    def remove(self, recovery_id: str | None) -> None:
        if not recovery_id:
            return
        with self._lock:
            self._sessions.pop(recovery_id, None)

    def count(self) -> int:
        with self._lock:
            self._remove_expired(time.time())
            return len(self._sessions)
