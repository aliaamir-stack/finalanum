"""
WhatsApp Integration — Pluggable Adapter Pattern
=================================================
Supports multiple providers: Meta Business API, Twilio, or custom.
Configure via environment variables. No provider-specific code is required
until you plug in your API credentials.

Environment variables:
  WHATSAPP_PROVIDER    = "meta" | "twilio" | "custom" (default: not set = disabled)
  WHATSAPP_API_KEY     = your API key / access token
  WHATSAPP_API_SECRET  = secondary secret (Twilio auth token, etc.)
  WHATSAPP_FROM_NUMBER = sender phone number (with country code, e.g. +923001234567)
  WHATSAPP_API_URL     = (optional) custom API endpoint URL

For Meta Business API:
  WHATSAPP_PROVIDER=meta
  WHATSAPP_API_KEY=<Meta access token>
  WHATSAPP_PHONE_NUMBER_ID=<Phone number ID from Meta dashboard>

For Twilio:
  WHATSAPP_PROVIDER=twilio
  WHATSAPP_API_KEY=<Twilio Account SID>
  WHATSAPP_API_SECRET=<Twilio Auth Token>
  WHATSAPP_FROM_NUMBER=+14155238886

For custom:
  WHATSAPP_PROVIDER=custom
  WHATSAPP_API_URL=https://your-custom-api.com/send
  WHATSAPP_API_KEY=<your key>
"""

import os
import logging
from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Optional

logger = logging.getLogger(__name__)


@dataclass
class WhatsAppMessage:
    to: str  # phone number with country code
    body: str
    occupant_id: Optional[int] = None


@dataclass
class SendResult:
    success: bool
    message_id: Optional[str] = None
    error: Optional[str] = None


class WhatsAppAdapter(ABC):
    """Base adapter — implement send_message for your provider."""

    @abstractmethod
    def send_message(self, msg: WhatsAppMessage) -> SendResult:
        ...

    def send_bulk(self, messages: list[WhatsAppMessage]) -> list[SendResult]:
        """Default bulk: sequential sends. Override for batch APIs."""
        return [self.send_message(m) for m in messages]


class MetaWhatsAppAdapter(WhatsAppAdapter):
    """Meta (Facebook) Cloud API adapter."""

    def __init__(self):
        self.access_token = os.getenv("WHATSAPP_API_KEY", "")
        self.phone_number_id = os.getenv("WHATSAPP_PHONE_NUMBER_ID", "")
        self.api_version = os.getenv("WHATSAPP_META_API_VERSION", "v17.0")
        self.base_url = f"https://graph.facebook.com/{self.api_version}/{self.phone_number_id}/messages"

    def send_message(self, msg: WhatsAppMessage) -> SendResult:
        try:
            import requests
            resp = requests.post(
                self.base_url,
                headers={
                    "Authorization": f"Bearer {self.access_token}",
                    "Content-Type": "application/json",
                },
                json={
                    "messaging_product": "whatsapp",
                    "to": msg.to.replace("+", "").replace(" ", "").replace("-", ""),
                    "type": "text",
                    "text": {"body": msg.body},
                },
                timeout=30,
            )
            data = resp.json()
            if resp.status_code == 200 and "messages" in data:
                return SendResult(success=True, message_id=data["messages"][0].get("id"))
            return SendResult(success=False, error=data.get("error", {}).get("message", str(data)))
        except Exception as e:
            logger.exception("Meta WhatsApp send failed")
            return SendResult(success=False, error=str(e))


class TwilioWhatsAppAdapter(WhatsAppAdapter):
    """Twilio WhatsApp adapter."""

    def __init__(self):
        self.account_sid = os.getenv("WHATSAPP_API_KEY", "")
        self.auth_token = os.getenv("WHATSAPP_API_SECRET", "")
        self.from_number = os.getenv("WHATSAPP_FROM_NUMBER", "")

    def send_message(self, msg: WhatsAppMessage) -> SendResult:
        try:
            import requests
            url = f"https://api.twilio.com/2010-04-01/Accounts/{self.account_sid}/Messages.json"
            resp = requests.post(
                url,
                auth=(self.account_sid, self.auth_token),
                data={
                    "From": f"whatsapp:{self.from_number}",
                    "To": f"whatsapp:{msg.to}",
                    "Body": msg.body,
                },
                timeout=30,
            )
            data = resp.json()
            if resp.status_code in (200, 201):
                return SendResult(success=True, message_id=data.get("sid"))
            return SendResult(success=False, error=data.get("message", str(data)))
        except Exception as e:
            logger.exception("Twilio WhatsApp send failed")
            return SendResult(success=False, error=str(e))


class CustomWhatsAppAdapter(WhatsAppAdapter):
    """Generic HTTP adapter — POST JSON to a custom endpoint."""

    def __init__(self):
        self.api_url = os.getenv("WHATSAPP_API_URL", "")
        self.api_key = os.getenv("WHATSAPP_API_KEY", "")

    def send_message(self, msg: WhatsAppMessage) -> SendResult:
        try:
            import requests
            resp = requests.post(
                self.api_url,
                headers={
                    "Authorization": f"Bearer {self.api_key}",
                    "Content-Type": "application/json",
                },
                json={"to": msg.to, "message": msg.body},
                timeout=30,
            )
            if resp.status_code in (200, 201):
                data = resp.json()
                return SendResult(success=True, message_id=data.get("id") or data.get("message_id"))
            return SendResult(success=False, error=f"HTTP {resp.status_code}: {resp.text[:200]}")
        except Exception as e:
            logger.exception("Custom WhatsApp send failed")
            return SendResult(success=False, error=str(e))


class DisabledAdapter(WhatsAppAdapter):
    """Stub when no provider is configured."""

    def send_message(self, msg: WhatsAppMessage) -> SendResult:
        return SendResult(success=False, error="WhatsApp not configured. Set WHATSAPP_PROVIDER in .env")


def get_adapter() -> WhatsAppAdapter:
    """Factory: returns the correct adapter based on WHATSAPP_PROVIDER env var."""
    provider = os.getenv("WHATSAPP_PROVIDER", "").lower().strip()
    if provider == "meta":
        return MetaWhatsAppAdapter()
    elif provider == "twilio":
        return TwilioWhatsAppAdapter()
    elif provider == "custom":
        return CustomWhatsAppAdapter()
    else:
        return DisabledAdapter()


def is_configured() -> bool:
    provider = os.getenv("WHATSAPP_PROVIDER", "").strip()
    return provider in ("meta", "twilio", "custom")


def get_provider_name() -> Optional[str]:
    provider = os.getenv("WHATSAPP_PROVIDER", "").strip()
    return provider if provider else None
