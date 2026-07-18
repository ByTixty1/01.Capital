"""Transactional email via Gmail SMTP. Falls back to console log when password is absent."""

import logging
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

import aiosmtplib

from app.core.config import settings

logger = logging.getLogger("01capital.email")


async def send_verification_email(to_email: str, otp: str) -> None:
    """Send OTP verification email via Gmail SMTP. Logs to console if SMTP_PASSWORD is not set."""
    if not settings.smtp_password:
        logger.info(
            "DEV — verification OTP for %s: %s (set SMTP_PASSWORD to send real emails)",
            to_email,
            otp,
        )
        return

    html = f"""
    <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:40px 24px">
      <h2 style="font-size:24px;font-weight:700;margin-bottom:8px">Verify your email</h2>
      <p style="color:#666;margin-bottom:32px">Enter this code to complete your 01 Capital registration.</p>
      <div style="background:#f4f4f5;border-radius:12px;padding:24px;text-align:center;
                  font-size:36px;font-weight:700;letter-spacing:12px;font-family:monospace">
        {otp}
      </div>
      <p style="color:#999;font-size:13px;margin-top:24px">
        This code expires in 15 minutes. If you didn't create an account, ignore this email.
      </p>
    </div>
    """

    msg = MIMEMultipart("alternative")
    msg["Subject"] = "Your 01 Capital verification code"
    msg["From"] = settings.email_from
    msg["To"] = to_email
    msg.attach(MIMEText(html, "html"))

    await aiosmtplib.send(
        msg,
        hostname=settings.smtp_host,
        port=settings.smtp_port,
        username=settings.smtp_user,
        password=settings.smtp_password,
        start_tls=True,
    )
    logger.info("Verification email sent to %s", to_email)
