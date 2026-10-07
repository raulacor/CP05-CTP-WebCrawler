from pymongo import MongoClient

client = MongoClient("mongodb://localhost:27017")
collection = client["cp05_db"]["games"]

def save_games(games):
    for game in games:
        collection.update_one(
            {"appid": game["appid"], "collected_date":game["collected_date"],},
            {"$set": game},
            upsert=True,
        )