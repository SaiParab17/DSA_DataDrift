import pandas as pd
import numpy as np

# Set random seed
np.random.seed(42)

# Generate Reference Data
n_rows = 1000
reference = pd.DataFrame({
    'age': np.random.normal(35, 10, n_rows),
    'salary': np.random.normal(60000, 15000, n_rows),
    'credit_score': np.random.normal(700, 50, n_rows),
    'category': np.random.choice(['A', 'B', 'C', 'D'], n_rows, p=[0.4, 0.3, 0.2, 0.1])
})
reference.to_csv('reference.csv', index=False)

# Generate Current Data with DRIFT
current = pd.DataFrame({
    'age': np.random.normal(36, 11, n_rows), # slightly drifted
    'salary': np.random.normal(80000, 20000, n_rows), # hugely drifted!
    'credit_score': np.random.normal(700, 50, n_rows), # no drift
    'category': np.random.choice(['A', 'B', 'C', 'D'], n_rows, p=[0.1, 0.2, 0.3, 0.4]) # huge drift
})
current.to_csv('current.csv', index=False)

print("Generated reference.csv and current.csv")
