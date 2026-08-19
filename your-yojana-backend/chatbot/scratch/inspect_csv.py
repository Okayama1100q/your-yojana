import pandas as pd
csv_path = "../swasthika/data/processed/Swasthika_Eligibility_Normalized.csv"
try:
    df = pd.read_csv(csv_path)
    print("Shape:", df.shape)
    print("Columns:", list(df.columns))
    print("Sample Names:", list(df['name'].head(5)))
except Exception as e:
    print("Error:", e)
