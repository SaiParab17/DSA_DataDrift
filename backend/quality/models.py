from pydantic import BaseModel
from typing import Optional, Any

class ExpectationResult(BaseModel):
    expectation: str
    column: Optional[str]
    success: bool
    status: str       # "PASS" | "FAIL"
    severity: str     # "INFO" | "WARNING" | "CRITICAL"
    observed_value: Any
    expected_value: Any

class QualitySummary(BaseModel):
    total_expectations: int
    passed: int
    failed: int
    warnings: int
    success_percent: float
    overall_status: str
    expectations: list[ExpectationResult]
