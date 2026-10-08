import pandas as pd
from sklearn.ensemble import RandomForestRegressor
from sklearn.model_selection import train_test_split
from sklearn.metrics import mean_absolute_error
from database import collection


data = list(collection.find({}, {"_id": 0}))

df = pd.DataFrame(data)

df["collected_date"] = pd.to_datetime(df["collected_date"])
df["month"] = df["collected_date"].dt.month
df["day"] = df["collected_date"].dt.day
df = df[~df["appid"].str.contains(",")]
df["appid"] = df["appid"].astype(int)
df["a"] = df["appid"].astype(int)

X = df[["month", "day", "appid"]]
Y = df["discount_pct"]

X_train, X_test, y_train, y_test = train_test_split(X, Y, test_size=0.2, random_state=42)
model = RandomForestRegressor(random_state=42)
model.fit(X_train, y_train)
predictions = model.predict(X_test)


def predict_discount(appid, date):
    d = pd.to_datetime(date)
    row = pd.DataFrame([{"month": d.month, "day": d.day, "appid": int(appid)}])
    return model.predict(row)[0]

def main():
    print("Baseline MAE:", mean_absolute_error(y_test, [y_train.mean()] * len(y_test)))
    print("MAE:", mean_absolute_error(y_test, predictions)) 
    predict_discount("271590", "2026-10-31")

if __name__=="__main__":
    main()