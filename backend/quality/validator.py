import pandas as pd
from typing import List, Dict, Any, Optional

# IMPORTANT: apply our patch FIRST
import quality.patch

import great_expectations as gx
from great_expectations.dataset.pandas_dataset import PandasDataset
from quality.models import ExpectationResult, QualitySummary

class QualityValidator:
    def __init__(self):
        pass

    def _is_identifier_column(self, name: str, series: pd.Series) -> bool:
        """
        Conservative heuristic for identifiers.
        Must match naming convention (id, *_id, etc) AND be highly unique.
        """
        lower_name = name.lower()
        if lower_name == "id" or lower_name.endswith("_id") or lower_name in ("customer_id", "user_id", "entity_id", "transaction_id"):
            clean = series.dropna()
            if len(clean) == 0:
                return True
            unique_ratio = clean.nunique() / len(clean)
            return unique_ratio >= 0.8
        return False

    def validate(self, reference_df: pd.DataFrame, current_df: pd.DataFrame) -> QualitySummary:
        # We need a PandasDataset for great expectations
        ds = PandasDataset(current_df)
        
        results = []
        
        # 1. Required Columns (Columns in reference should exist in current)
        for col in reference_df.columns:
            res = ds.expect_column_to_exist(column=col)
            success = bool(res.success)
            results.append(ExpectationResult(
                expectation="column_exists",
                column=col,
                success=success,
                status="PASS" if success else "FAIL",
                severity="INFO" if success else "CRITICAL",
                observed_value="Present" if success else "Missing",
                expected_value="Present"
            ))

        common_cols = set(reference_df.columns) & set(current_df.columns)
        
        # 2. Not-Null Checks
        for col in common_cols:
            if reference_df[col].isnull().sum() == 0:
                res = ds.expect_column_values_to_not_be_null(column=col)
                success = bool(res.success)
                missing_count = int(res.result.get('unexpected_count', current_df[col].isnull().sum()))
                results.append(ExpectationResult(
                    expectation="column_values_to_not_be_null",
                    column=col,
                    success=success,
                    status="PASS" if success else "FAIL",
                    severity="INFO" if success else "WARNING",
                    observed_value=missing_count,
                    expected_value=0
                ))

        # 3. Numeric Column Validation (Range)
        for col in common_cols:
            if self._is_identifier_column(col, reference_df[col]):
                continue  # skip numeric range expectations for identifiers

            if pd.api.types.is_numeric_dtype(reference_df[col]) and pd.api.types.is_numeric_dtype(current_df[col]):
                # Derive reasonable bounds from reference
                min_val = float(reference_df[col].min())
                max_val = float(reference_df[col].max())
                
                # Let's add a tiny margin for floats
                margin = (max_val - min_val) * 0.05
                min_bound = min_val - margin
                max_bound = max_val + margin
                
                res = ds.expect_column_values_to_be_between(
                    column=col, 
                    min_value=min_bound, 
                    max_value=max_bound
                )
                success = bool(res.success)
                unexpected_count = int(res.result.get('unexpected_count', 0))
                
                results.append(ExpectationResult(
                    expectation="column_values_to_be_between",
                    column=col,
                    success=success,
                    status="PASS" if success else "FAIL",
                    severity="INFO" if success else "WARNING",
                    observed_value=f"{unexpected_count} out of bounds",
                    expected_value=f"between {min_bound:.2f} and {max_bound:.2f}"
                ))

        # 4. Data Type Validation
        for col in common_cols:
            if self._is_identifier_column(col, reference_df[col]):
                # Allow typical identifier types (int, string, object) but we don't enforce strictly.
                pass
            
            # We just verify that if it was numeric in reference, it's numeric in current
            elif pd.api.types.is_numeric_dtype(reference_df[col]):
                res = ds.expect_column_values_to_be_in_type_list(
                    column=col, 
                    type_list=["int", "int32", "int64", "float", "float32", "float64"]
                )
                success = bool(res.success)
                
                # Check actual type
                current_type = str(current_df[col].dtype)
                
                results.append(ExpectationResult(
                    expectation="column_values_to_be_of_type",
                    column=col,
                    success=success,
                    status="PASS" if success else "FAIL",
                    severity="INFO" if success else "CRITICAL",
                    observed_value=current_type,
                    expected_value="numeric"
                ))
            elif pd.api.types.is_string_dtype(reference_df[col]):
                res = ds.expect_column_values_to_be_in_type_list(
                    column=col, 
                    type_list=["str", "object"]
                )
                success = bool(res.success)
                
                results.append(ExpectationResult(
                    expectation="column_values_to_be_of_type",
                    column=col,
                    success=success,
                    status="PASS" if success else "FAIL",
                    severity="INFO" if success else "CRITICAL",
                    observed_value=str(current_df[col].dtype),
                    expected_value="string"
                ))
                
        # 5. Row Count Validation
        ref_rows = len(reference_df)
        cur_rows = len(current_df)
        
        # We don't fail just because they are different, maybe a warning if it's > 50% different
        diff_pct = abs(cur_rows - ref_rows) / ref_rows if ref_rows > 0 else 0
        success = diff_pct <= 0.5
        
        results.append(ExpectationResult(
            expectation="row_count_match",
            column=None,
            success=success,
            status="PASS" if success else "WARNING",
            severity="INFO" if success else "WARNING",
            observed_value=f"{cur_rows} rows",
            expected_value=f"~{ref_rows} rows (±50%)"
        ))

        # 6. Duplicate Detection
        for col in common_cols:
            if self._is_identifier_column(col, reference_df[col]):
                res = ds.expect_column_values_to_be_unique(column=col)
                success = bool(res.success)
                unexpected_count = int(res.result.get('unexpected_count', 0))
                
                results.append(ExpectationResult(
                    expectation="column_values_to_be_unique",
                    column=col,
                    success=success,
                    status="PASS" if success else "FAIL",
                    severity="INFO" if success else "CRITICAL",
                    observed_value=f"{unexpected_count} duplicates",
                    expected_value="0 duplicates"
                ))
            
        # Calculate summary
        total = len(results)
        passed = sum(1 for r in results if r.success)
        failed = sum(1 for r in results if not r.success and r.status == "FAIL")
        warnings = sum(1 for r in results if not r.success and r.status == "WARNING")
        
        success_percent = (passed / total * 100) if total > 0 else 100.0
        
        overall_status = "PASS"
        if failed > 0:
            overall_status = "FAIL"
        elif warnings > 0:
            overall_status = "ATTENTION"
            
        summary = QualitySummary(
            total_expectations=total,
            passed=passed,
            failed=failed,
            warnings=warnings,
            success_percent=success_percent,
            overall_status=overall_status,
            expectations=results
        )
        return summary
