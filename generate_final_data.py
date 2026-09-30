import pandas as pd
import numpy as np

np.random.seed(42)
n = 1000

# salary: numeric (substantial shift)
ref_salary = np.random.normal(50000, 10000, n)
cur_salary = np.random.normal(70000, 15000, n)

# category: categorical (substantial shift)
ref_cat = np.random.choice(["A", "B", "C"], n, p=[0.5, 0.3, 0.2])
cur_cat = np.random.choice(["A", "B", "C"], n, p=[0.2, 0.7, 0.1])

# age: numeric (stable)
ref_age = np.random.normal(40, 10, n)
cur_age = np.random.normal(40, 10, n)

# credit_score: numeric (stable)
ref_credit = np.random.normal(700, 50, n)
cur_credit = np.random.normal(700, 50, n)

ref_df = pd.DataFrame({
    "salary": ref_salary,
    "category": ref_cat,
    "age": ref_age,
    "credit_score": ref_credit
})

cur_df = pd.DataFrame({
    "salary": cur_salary,
    "category": cur_cat,
    "age": cur_age,
    "credit_score": cur_credit
})

ref_df.to_csv("reference.csv", index=False)
cur_df.to_csv("current.csv", index=False)
print("Data generated.")
