from fastapi import FastAPI
from database import collection
from fastapi.middleware.cors import CORSMiddleware


app = FastAPI()
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

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
    discount_per_range = {
        "0-25": 0,
        "25-50": 0,
        "50-75": 0,
        "75-100": 0
    }
    price_per_range = {
        ">R$20": 0,
        "R$20-50": 0,
        "R$50-100": 0,
        "R$100+": 0,
    }

    latest = max(collection.distinct("collected_date"))
    games = list(collection.find({"collected_date": latest}, {"_id": 0}))
    for g in games:
        original_amount += g["original_price"] 
        discount_amount += g["discounted_price"] 

        if g["discounted_price"] < 20:
            price_per_range[">R$20"] += 1
        elif g["discounted_price"] < 50:
            price_per_range["R$20-50"] += 1
        elif g["discounted_price"] < 100:
            price_per_range["R$50-100"] += 1
        elif g["discounted_price"] >= 100:
            price_per_range["R$100+"] += 1
        
        total_discount_pct += g["discount_pct"]

        if g["discount_pct"] < 25:
            discount_per_range["0-25"] += 1
        elif g["discount_pct"] < 50:
            discount_per_range["25-50"] += 1
        elif g["discount_pct"] < 75:
            discount_per_range["50-75"] += 1
        elif g["discount_pct"] <= 100:
            discount_per_range["75-100"] += 1


    total_savings = (original_amount - discount_amount)
    average_savings = (total_discount_pct / len(games))

    return {
        "date": latest, 
        "total_games": len(games), 
        "total_savings": total_savings, 
        "average_discount": average_savings, 
        "range 0-25": discount_per_range["0-25"], 
        "range 25-50": discount_per_range["25-50"], 
        "range 50-75": discount_per_range["50-75"],
        "range 75-100": discount_per_range["75-100"],
        "price: <R$20": price_per_range[">R$20"],
        "price: R$20-50": price_per_range["R$20-50"],
        "price: R$50-100": price_per_range["R$50-100"],
        "price: R$100+": price_per_range["R$100+"],
        }