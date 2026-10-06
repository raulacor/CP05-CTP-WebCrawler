import requests
from bs4 import BeautifulSoup


def parse_row(row):
    return {
        "title": row.select_one("span.title").text,
        "release_date": row.select_one("div.search_released").text,
        "discount_pct": row.select_one("div.discount_pct").text,
        "discounted_price": row.select_one("div.discount_final_price").text,
        "original_price": row.select_one("div.discount_original_price").text,
        "image": row.select_one("div.search_capsule > img")["src"]
        }

def gather_games():
    start = 0
    games = []

    for _ in range(5):
        steam_promotions_url = f"https://store.steampowered.com/search/results/?query&start={start}&count=50&dynamic_data=&sort_by=_ASC&hwtype=0&supportedlang=english&snr=1_7_7_2300_7&specials=1&hidef2p=1&infinite=1"
        data_response = requests.get(steam_promotions_url)
        data_json = data_response.json()

        soup = BeautifulSoup(data_json["results_html"], "html.parser")
        search_result = soup.select("a")
        for row in search_result:
            games.append(parse_row(row))

        start += 50
    return games

def main():
    games = gather_games()
    print(len(games))
    print(games)

if __name__=="__main__":
    main()