"""
DataWatch — Tests for AWS S3 storage service.
"""
import asyncio
import os
import sys
import tempfile
import pytest

# Ensure backend directory is in sys.path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from services.storage import sanitize_filename, upload_csv_to_s3, get_s3_client


def test_sanitize_filename_traversal():
    """Verify that path traversal sequences and spaces are safely stripped."""
    assert sanitize_filename("../../etc/passwd.csv") == "passwd.csv"
    assert sanitize_filename("my test dataset (1).csv") == "my_test_dataset_1.csv"
    assert sanitize_filename("safe_name.csv") == "safe_name.csv"
    assert sanitize_filename("no_extension") == "no_extension.csv"


def test_upload_csv_to_s3_unconfigured():
    """When AWS environment variables are unset, upload_csv_to_s3 returns None gracefully."""
    async def _run():
        orig_bucket = os.environ.pop("AWS_S3_BUCKET_NAME", None)
        orig_key = os.environ.pop("AWS_ACCESS_KEY_ID", None)
        try:
            with tempfile.NamedTemporaryFile(delete=False, suffix=".csv") as tf:
                tf.write(b"colA,colB\n1,2\n")
                temp_path = tf.name

            try:
                key = await upload_csv_to_s3(temp_path, "sample.csv")
                assert key is None
            finally:
                if os.path.exists(temp_path):
                    os.unlink(temp_path)
        finally:
            if orig_bucket:
                os.environ["AWS_S3_BUCKET_NAME"] = orig_bucket
            if orig_key:
                os.environ["AWS_ACCESS_KEY_ID"] = orig_key

    asyncio.run(_run())
