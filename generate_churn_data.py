"""
Generates realistic benchmark Telco Customer Churn datasets for ML Model Impact testing and faculty demonstration.
- churn_reference.csv: Baseline training/reference dataset with known ground-truth 'Churn' labels (Yes / No).
- churn_current.csv: Production dataset with real ground-truth 'Churn' labels, featuring distribution drift in MonthlyCharges and Contract type.
"""
import numpy as np
import pandas as pd

np.random.seed(42)
n_ref = 1000
n_cur = 1000

# ----------------- REFERENCE DATASET -----------------
ref_ids = [f"CUST-{10000 + i}" for i in range(n_ref)]
ref_tenure = np.random.randint(1, 72, size=n_ref)
ref_monthly = np.round(np.random.normal(65.0, 20.0, size=n_ref).clip(20.0, 120.0), 2)
ref_total = np.round(ref_tenure * ref_monthly * np.random.uniform(0.95, 1.05, size=n_ref), 2)
ref_contract = np.random.choice(["Month-to-month", "One year", "Two year"], size=n_ref, p=[0.55, 0.25, 0.20])
ref_internet = np.random.choice(["DSL", "Fiber optic", "No"], size=n_ref, p=[0.35, 0.45, 0.20])
ref_payment = np.random.choice(["Electronic check", "Mailed check", "Bank transfer", "Credit card"], size=n_ref)

# Realistic ground-truth probability of churn
# Higher monthly charges, shorter tenure, month-to-month contract -> higher churn
ref_log_odds = (
    -0.5
    - 0.05 * ref_tenure
    + 0.02 * ref_monthly
    + np.where(ref_contract == "Month-to-month", 1.2, -0.8)
    + np.where(ref_internet == "Fiber optic", 0.5, -0.3)
)
ref_prob = 1.0 / (1.0 + np.exp(-ref_log_odds))
ref_churn = np.where(np.random.uniform(0, 1, size=n_ref) < ref_prob, "Yes", "No")

df_ref = pd.DataFrame({
    "customer_id": ref_ids,
    "tenure": ref_tenure,
    "MonthlyCharges": ref_monthly,
    "TotalCharges": ref_total,
    "Contract": ref_contract,
    "InternetService": ref_internet,
    "PaymentMethod": ref_payment,
    "Churn": ref_churn,
})
df_ref.to_csv("churn_reference.csv", index=False)

# ----------------- CURRENT DATASET -----------------
cur_ids = [f"CUST-{20000 + i}" for i in range(n_cur)]
# Drift: shorter tenure distribution, higher monthly charges (e.g. price increase), more month-to-month
cur_tenure = np.random.randint(1, 55, size=n_cur)
cur_monthly = np.round(np.random.normal(78.0, 22.0, size=n_cur).clip(25.0, 130.0), 2)
cur_total = np.round(cur_tenure * cur_monthly * np.random.uniform(0.95, 1.05, size=n_cur), 2)
cur_contract = np.random.choice(["Month-to-month", "One year", "Two year"], size=n_cur, p=[0.75, 0.15, 0.10])
cur_internet = np.random.choice(["DSL", "Fiber optic", "No"], size=n_cur, p=[0.25, 0.65, 0.10])
cur_payment = np.random.choice(["Electronic check", "Mailed check", "Bank transfer", "Credit card"], size=n_cur)

# Production true churn labels under shifted market conditions
cur_log_odds = (
    -0.2
    - 0.04 * cur_tenure
    + 0.025 * cur_monthly
    + np.where(cur_contract == "Month-to-month", 1.4, -0.6)
    + np.where(cur_internet == "Fiber optic", 0.7, -0.4)
)
cur_prob = 1.0 / (1.0 + np.exp(-cur_log_odds))
cur_churn = np.where(np.random.uniform(0, 1, size=n_cur) < cur_prob, "Yes", "No")

df_cur = pd.DataFrame({
    "customer_id": cur_ids,
    "tenure": cur_tenure,
    "MonthlyCharges": cur_monthly,
    "TotalCharges": cur_total,
    "Contract": cur_contract,
    "InternetService": cur_internet,
    "PaymentMethod": cur_payment,
    "Churn": cur_churn,
})
df_cur.to_csv("churn_current.csv", index=False)

print(f"Generated churn_reference.csv ({len(df_ref)} rows, Churn rate: {(df_ref.Churn == 'Yes').mean():.2%})")
print(f"Generated churn_current.csv ({len(df_cur)} rows, Churn rate: {(df_cur.Churn == 'Yes').mean():.2%})")
