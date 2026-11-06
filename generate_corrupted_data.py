import pandas as pd
import numpy as np

# Load original data
ref_df = pd.read_csv("reference.csv")
cur_df = pd.read_csv("current.csv")

# Corrupt some values to fail GX expectations
# 1. Null values in salary
cur_df.loc[10:46, "salary"] = np.nan  # 37 nulls

# 2. Invalid age (out of reasonable bounds derived from ref)
# ref_age is normal(40, 10). Min should be around 10, max around 70.
# Let's add crazy ages.
cur_df.loc[100:110, "age"] = 1000

# 3. Add an ID column to both, then duplicate it in current
ref_df["id"] = range(1, len(ref_df) + 1)
cur_df["id"] = range(1, len(cur_df) + 1)
# Duplicate IDs
cur_df.loc[5, "id"] = 1
cur_df.loc[6, "id"] = 1

ref_df.to_csv("reference_corrupted.csv", index=False)
cur_df.to_csv("current_corrupted.csv", index=False)
print("Corrupted data generated.")
