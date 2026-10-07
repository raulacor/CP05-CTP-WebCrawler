from fastapi import FastAPI
from database import collection


app = FastAPI()

@app.get("/games")
async def list_games(title: str | None = None, min_discount: int | None = None):
    filters = {}
    if title:
        filters["title"] = {"$regex": title, "$options": "i"}
    if min_discount:
        filters["discount_pct"] = {"$gte": min_discount}
    return list(collection.find(filters, {"_id": 0}))
    

@app.get("/games/{appid}")
async def game_page(appid: str):
    return list(collection.find({"appid": appid}, {"_id": 0}).sort("collected_date", -1))

@app.get("/stats")
async def discount_stats():
    original_amount = 0
    discount_amount = 0
    total_discount_pct = 0
    
    latest = max(collection.distinct("collected_date"))
    games = list(collection.find({"collected_date": latest}, {"_id": 0}))
    for g in games:
        original_amount += g["original_price"] 
        discount_amount += g["discounted_price"] 
        total_discount_pct += g["discount_pct"]

    total_savings = (original_amount - discount_amount)
    average_savings = (total_discount_pct / len(games))

    return {"date": latest, "total_games": len(games), "total_savings": total_savings, "average_discount": average_savings}