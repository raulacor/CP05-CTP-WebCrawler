from fastapi import FastAPI
from database import collection


app = FastAPI()

@app.get("/games")
async def list_games(title: str | None = None):
    return list(collection.find({}, {"_id": 0}))

@app.get("/games/{appid}")
async def game_page(appid: str):
    return list(collection.find({"appid": appid}, {"_id": 0}).sort("collected_date", -1))

