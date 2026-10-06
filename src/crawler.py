import requests
from bs4 import BeautifulSoup


start = 0
parsed = []
titles = []

for _ in range(5):
    steam_promotions_url = f"https://store.steampowered.com/search/results/?query&start={start}&count=50&dynamic_data=&sort_by=_ASC&hwtype=0&supportedlang=english&snr=1_7_7_2300_7&specials=1&hidef2p=1&infinite=1"
    print(steam_promotions_url)

    data_response = requests.get(steam_promotions_url)
    data_json = data_response.json()


    soup = BeautifulSoup(data_json["results_html"], "html.parser")
    search_result = soup.select("a")
    parsed.extend(search_result)
    search_title = soup.select("span.title")
    for t in search_title:
        titles.extend(t)


    start += 50

print(titles)
print(len(titles))
print(len(set(titles)))