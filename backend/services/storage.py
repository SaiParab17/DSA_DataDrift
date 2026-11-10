"""
DataWatch — AWS S3 object storage integration service.

Handles secure streaming uploads of reference and current CSV datasets
to Amazon S3 buckets (including AWS Academy / Student Learner Lab accounts)
with safe key generation, non-blocking background thread execution,
and graceful fallback during unconfigured local development.
"""
from __future__ import annotations

import asyncio
import logging
import os
import re
import uuid
from typing import Optional

logger = logging.getLogger(__name__)


def sanitize_filename(filename: str) -> str:
    """
    Sanitize an uploaded filename to prevent directory traversal or invalid characters.
    Strips path prefixes, converts whitespace to underscores, and retains only
    alphanumeric characters, underscores, hyphens, and periods.
    """
    base = os.path.basename(filename or "dataset.csv")
    base = re.sub(r"\s+", "_", base)
    cleaned = re.sub(r"[^a-zA-Z0-9_.-]", "", base)
    if not cleaned.lower().endswith(".csv"):
        cleaned = f"{cleaned}.csv"
    return cleaned or "dataset.csv"


def get_s3_client():
    """
    Initialize an AWS S3 client using credentials from environment variables.
    Supports standard IAM credentials and AWS Academy Learner Lab session tokens.
    Returns None if required credentials are not configured.
    """
    access_key_id = os.getenv("AWS_ACCESS_KEY_ID")
    secret_access_key = os.getenv("AWS_SECRET_ACCESS_KEY")
    region_name = os.getenv("AWS_REGION", "us-east-1")
    session_token = os.getenv("AWS_SESSION_TOKEN")  # Used for AWS Academy Learner Lab accounts

    if not access_key_id or not secret_access_key:
        return None

    try:
        import boto3
        from botocore.config import Config

        client_kwargs = {
            "service_name": "s3",
            "region_name": region_name,
            "aws_access_key_id": access_key_id,
            "aws_secret_access_key": secret_access_key,
            "config": Config(signature_version="s3v4"),
        }
        if session_token:
            client_kwargs["aws_session_token"] = session_token

        return boto3.client(**client_kwargs)
    except Exception as exc:
        logger.warning("Failed to initialize AWS S3 client: %s", exc)
        return None


async def upload_csv_to_s3(file_path: str, original_filename: str) -> Optional[str]:
    """
    Asynchronously upload a local CSV file to an AWS S3 bucket.

    - Generates a unique, sanitized storage key: `datasets/{uuid}/{safe_filename}`
    - Executes the synchronous boto3 upload in a separate thread (asyncio.to_thread)
      to prevent blocking the FastAPI async event loop
    - Returns the storage key (e.g., `datasets/123e4567.../data.csv`)
    - Returns None if AWS credentials are unconfigured or upload fails, logging a warning
    """
    bucket_name = os.getenv("AWS_S3_BUCKET_NAME") or os.getenv("AWS_BUCKET_NAME")
    if not bucket_name:
        logger.debug("AWS_S3_BUCKET_NAME is not configured; skipping S3 object storage upload.")
        return None

    client = get_s3_client()
    if client is None:
        logger.debug("AWS S3 credentials not configured; skipping object storage upload.")
        return None

    if not os.path.exists(file_path):
        logger.error("Local file does not exist for S3 upload: %s", file_path)
        return None

    safe_name = sanitize_filename(original_filename)
    key = f"datasets/{uuid.uuid4()}/{safe_name}"

    def _sync_upload():
        client.upload_file(
            Filename=file_path,
            Bucket=bucket_name,
            Key=key,
            ExtraArgs={"ContentType": "text/csv"},
        )

    try:
        await asyncio.to_thread(_sync_upload)
        logger.info("Successfully uploaded %s to AWS S3 bucket '%s' at key: %s", original_filename, bucket_name, key)
        return key
    except Exception as exc:
        logger.warning("Failed to upload %s to AWS S3: %s", original_filename, exc)
        return None


# Backward compatibility alias
upload_csv_to_r2 = upload_csv_to_s3
