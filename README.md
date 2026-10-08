# CP05 — Web Crawler, API & Data Dashboard · Steam Sales Radar

A data collection and analysis platform for **Steam sales**: a Python crawler
visits the store, extracts the games on sale, cleans the data and stores it in
MongoDB; a FastAPI API serves that data; and a web dashboard presents it as
indicators, charts and a table.

```
Steam (site)  →  crawler.py  →  MongoDB  →  api.py (FastAPI)  →  dashboard/
  collection      collection    persistence       API             interface
```

> [!IMPORTANT]
> **AI usage notice.** This project was built with the help of the AI assistant
> **Claude (Anthropic)**, as follows:
>
> - **Crawler, database and API (`crawler.py`, `auxiliary.py`, `database.py`, `api.py`)
>   — written by the student.** The AI acted as a tutor: it explained concepts (HTTP
>   requests, BeautifulSoup and CSS selectors, finding pagination through DevTools,
>   MongoDB upserts, projections, FastAPI path and query parameters, CORS), reviewed the
>   code, pointed out bugs through questions and examples, and on a few specific syntax
>   points gave the exact line (e.g. reading the `data-ds-appid` attribute, the
>   `{"_id": 0}` projection, the `$regex`/`$gte` operators and the filter-dict skeleton).
> - **Machine learning (`ml.py`, `/predict` endpoint) — written by the student**, with
>   the AI explaining supervised learning (features/target, train/test split, MAE, baseline)
>   and providing the standard scikit-learn training boilerplate and the pandas syntax for
>   date splitting and row filtering.
> - **Design decisions** (the site, the `appid` + `collected_date` dedup key, keeping
>   sale history, computing stats on the latest collection only, which indicators and
>   charts to show) were discussed with the AI and made by the student.
> - **Dashboard (`src/dashboard/`) — written by the AI** (HTML, CSS and JavaScript), at
>   the student's request, since the visual layer is outside the course's scope. It
>   consumes the endpoints the student built.
> - **This README — drafted by the AI** from the project's code and reviewed by the student.

---

## Contents

1. [Chosen site and collected data](#1-chosen-site-and-collected-data)
2. [Project structure](#2-project-structure)
3. [Installation](#3-installation)
4. [Running](#4-running)
5. [Database structure](#5-database-structure)
6. [API documentation](#6-api-documentation)
7. [Dashboard](#7-dashboard)
8. [Machine Learning](#8-machine-learning)
9. [Technologies](#9-technologies)

---

## 1. Chosen site and collected data

**Site:** [Steam Store](https://store.steampowered.com/search?hwtype=0&supportedlang=english&specials=1&hidef2p=1&ndl=1) — the search page, filtered to:

| Filter                | Parameter               | Why                                     |
| --------------------- | ----------------------- | --------------------------------------- |
| Games on sale only    | `specials=1`            | the project is about discounts          |
| No free-to-play games | `hidef2p=1`             | they cost 0 and would skew the averages |
| English               | `supportedlang=english` | keeps titles consistent                 |

This is **public catalog data** (titles, prices, discounts, release dates and
cover images). **No personal data** is collected.

### How collection works

As you scroll, Steam loads games in batches of 50 through
`/search/results/?start=N&count=50&...&infinite=1`. That URL returns JSON whose
`results_html` field holds the **HTML of the game rows**. The crawler:

1. requests 5 batches (`start` = 0, 50, 100, 150, 200) → **250 games per run**;
2. reads each response's `results_html` with BeautifulSoup;
3. extracts the fields from each row (`<a class="search_result_row">`);
4. cleans the data (see below) and saves it to MongoDB.

### Extracted fields and basic cleaning

| Field              | Source in the HTML                                | Cleaning                                                               |
| ------------------ | ------------------------------------------------- | ---------------------------------------------------------------------- |
| `appid`            | the row's `data-ds-appid` attribute               | — (Steam's unique game ID)                                             |
| `title`            | `span.title`                                      | —                                                                      |
| `release_date`     | `div.search_released`                             | `.strip()` removes spaces and line breaks                              |
| `discount_pct`     | `div.discount_pct` (e.g. `-75%`)                  | removes `-` and `%` → int `75`                                         |
| `original_price`   | `div.discount_original_price` (e.g. `R$1.299,90`) | removes `R$` and the thousands `.`, swaps `,` for `.` → float `1299.9` |
| `discounted_price` | `div.discount_final_price`                        | same cleaning → float                                                  |
| `image`            | `src` attribute of the cover `img`                | —                                                                      |
| `collected_date`   | date of the run                                   | `date.today().isoformat()` → `"2026-10-08"`                            |
| `source`           | constant                                          | identifies where the data came from                                    |

> Prices are in **Brazilian reais (BRL)** because Steam uses the visitor's region.

---

## 2. Project structure

The code is split into the four required responsibilities: **collection, persistence, API and interface**.

```
CP05-CTP-WebCrawler/
├── README.md
├── requirements.txt
└── src/
    ├── crawler.py       # COLLECTION — fetches the batches from Steam and builds each game (parse_row)
    ├── auxiliary.py     # COLLECTION — cleaning helpers (clean_price, clean_pct, clean_release)
    ├── database.py      # PERSISTENCE — MongoDB connection and save_games (upsert)
    ├── api.py           # API — FastAPI endpoints
    ├── ml.py            # MACHINE LEARNING — trains the discount model, predict_discount()
    └── dashboard/       # INTERFACE — talks only to the API
        ├── index.html
        ├── style.css
        └── app.js
```

The crawler runs **independently of the API**: it only depends on MongoDB.

---

## 3. Installation

**Requirements:** Python 3.10+ and MongoDB Community.

```bash
# 1. Clone the repository
git clone <repository-url>
cd CP05-CTP-WebCrawler

# 2. (optional) Virtual environment
python3 -m venv .venv
source .venv/bin/activate

# 3. Dependencies
pip install -r requirements.txt
```

MongoDB on macOS (Homebrew), if it isn't installed yet:

```bash
brew tap mongodb/brew
brew install mongodb-community
```

---

## 4. Running

All Python commands run **from inside `src/`**.

### 4.1 Start MongoDB

```bash
brew services list | grep mongo               # shows the installed service name
brew services start mongodb-community         # starts on localhost:27017
mongosh --eval "db.runCommand({ ping: 1 })"   # should answer { ok: 1 }

# to stop:
brew services stop mongodb-community
```

### 4.2 Run the crawler

```bash
cd src
python crawler.py
```

Collects 250 games into the `cp05_db` database, `games` collection. It can run
any number of times: on the **same day** it updates the existing records (no
duplicates); on **different days** it adds new records, building the price
history.

### 4.3 (optional) Evaluate the model

```bash
cd src
python ml.py
```

Trains the model and prints its error next to a baseline, plus a sample prediction.

### 4.4 Start the API

```bash
cd src
uvicorn api:app --reload
```

The API runs at `http://localhost:8000`, with interactive docs (Swagger) at
`http://localhost:8000/docs`.

### 4.5 Open the dashboard

With the API running, open `src/dashboard/index.html` in the browser.

---

## 5. Database structure

- **Database:** `cp05_db`
- **Collection:** `games`
- **One document = one game on one collection date**

### Example document

```json
{
  "_id": "ObjectId(...)",
  "appid": "1091500",
  "title": "Cyberpunk 2077",
  "release_date": "9 Dec, 2020",
  "discount_pct": 65,
  "discounted_price": 69.96,
  "original_price": 199.9,
  "image": "https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1091500/capsule_sm_120.jpg",
  "collected_date": "2026-10-08",
  "source": "https://store.steampowered.com/search?"
}
```

### Fields

| Field              | Type                | Description                                      |
| ------------------ | ------------------- | ------------------------------------------------ |
| `_id`              | ObjectId            | generated by MongoDB (left out of API responses) |
| `appid`            | string              | Steam game ID                                    |
| `title`            | string              | game name                                        |
| `release_date`     | string              | release date as Steam displays it                |
| `discount_pct`     | int                 | discount in % (0–100)                            |
| `discounted_price` | float               | final price after discount, in R$                |
| `original_price`   | float               | full price, in R$                                |
| `image`            | string              | cover image URL                                  |
| `collected_date`   | string `YYYY-MM-DD` | **when** the data was collected                  |
| `source`           | string              | **where** the data was collected from            |

### Duplicates and history

A record's key is the pair **`appid` + `collected_date`**. `save_games` uses an
_upsert_:

```python
collection.update_one(
    {"appid": game["appid"], "collected_date": game["collected_date"]},
    {"$set": game},
    upsert=True,
)
```

- Same game, **same day** → the existing record is updated (no duplicate).
- Same game, **another day** → a new record is created.

So new collections **never erase** earlier ones, and each game builds up its
own sale history (e.g. GTA V at 40% off one day and 60% off another).

---

## 6. API documentation

Base URL: `http://localhost:8000` · Swagger: `/docs` · All responses are JSON.

### `GET /games` — list and filter records

| Query parameter | Type   | Required | Description                                      |
| --------------- | ------ | -------- | ------------------------------------------------ |
| `title`         | string | no       | case-insensitive search in the title (`$regex`)  |
| `min_discount`  | int    | no       | only games with a discount ≥ this value (`$gte`) |

Filters can be combined. Returns records from every collected date.

```
GET /games
GET /games?title=souls
GET /games?min_discount=75
GET /games?title=grand&min_discount=50
```

```json
[
  {
    "appid": "271590",
    "title": "Grand Theft Auto V",
    "release_date": "13 Apr, 2015",
    "discount_pct": 60,
    "discounted_price": 39.96,
    "original_price": 99.9,
    "image": "https://...",
    "collected_date": "2026-10-08",
    "source": "https://store.steampowered.com/search?"
  }
]
```

### `GET /games/{appid}` — get a specific record

Returns the game's **history**: one item per collection date, newest first.

```
GET /games/271590
```

```json
[
  {
    "appid": "271590",
    "title": "Grand Theft Auto V",
    "discount_pct": 60,
    "discounted_price": 39.96,
    "collected_date": "2026-10-08",
    "...": "..."
  },
  {
    "appid": "271590",
    "title": "Grand Theft Auto V",
    "discount_pct": 40,
    "discounted_price": 59.94,
    "collected_date": "2026-10-07",
    "...": "..."
  }
]
```

An unknown `appid` returns `[]`.

### `GET /stats` — statistics (feeds the dashboard)

Computed on the **latest collection only**, so a game isn't counted once per
day it was collected.

```json
{
  "date": "2026-10-08",
  "total_games": 250,
  "total_savings": 13569.86,
  "average_discount": 52.68,
  "range 0-25": 66,
  "range 25-50": 27,
  "range 50-75": 60,
  "range 75-100": 97,
  "price: <R$20": 96,
  "price: R$20-50": 70,
  "price: R$50-100": 50,
  "price: R$100+": 34
}
```

| Field              | Meaning                                         |
| ------------------ | ----------------------------------------------- |
| `date`             | date of the latest collection                   |
| `total_games`      | number of games in that collection              |
| `total_savings`    | sum of `original_price − discounted_price` (R$) |
| `average_discount` | mean of `discount_pct` (%)                      |
| `range ...`        | number of games per discount range              |
| `price: ...`       | number of games per final-price range           |

### `GET /predict/{appid}` — predicted discount (machine learning)

| Parameter | Where | Type                | Description         |
| --------- | ----- | ------------------- | ------------------- |
| `appid`   | path  | string              | Steam game ID       |
| `date`    | query | string `YYYY-MM-DD` | date to predict for |

```
GET /predict/271590?date=2026-10-31
```

```json
{ "appid": "271590", "date": "2026-10-31", "predicted_discount": 68.0 }
```

See [Machine Learning](#8-machine-learning) for how the prediction is made and its current limits.

---

## 7. Dashboard

A web page in HTML, CSS and JavaScript (charts with Chart.js) that consumes
**only the API**:

| Element                                               | Endpoint                          |
| ----------------------------------------------------- | --------------------------------- |
| Total records — games on sale                         | `GET /stats`                      |
| Indicator — average discount                          | `GET /stats`                      |
| Indicator — total savings                             | `GET /stats`                      |
| Pie chart — games per discount range                  | `GET /stats`                      |
| Pie chart — games per final-price range               | `GET /stats`                      |
| Title search + minimum-discount filter                | `GET /games?title=&min_discount=` |
| Games table (cover, title, release, discount, prices) | `GET /games`                      |
| Price history when clicking a game                    | `GET /games/{appid}`              |

Supports light/dark mode (follows the system) and phone screens.

---

## 8. Machine Learning

**Goal:** answer _"when is the best time to buy game X?"_ by predicting how big a
game's discount will be on a given date.

Design choices:

- **The date is split into `month` and `day`** instead of used as a full date, because
  `2027-10-31` never appears in training, while "month 10, day 31" repeats every year.
  That's what lets the model learn seasonal sales (e.g. Halloween).
- **`discount_pct` instead of price** as the target, because base prices change over
  time, while the discount is comparable across years.
- **Bundles are excluded** (rows whose `appid` lists several games, like
  `"1880360,1446780"`). A bundle's discount isn't the discount of one game, and keeping
  it would give the model conflicting answers for the same game and day. Bundles stay in
  MongoDB, the API and the dashboard.

### Model and evaluation

- **Model:** `RandomForestRegressor` (scikit-learn), an average of many decision trees
  that predicts a number.
- **Evaluation:** 80% of rows train the model, and 20% are held out and used only for
  testing. The metric is **MAE** (mean absolute error): the average distance between the
  predicted and the real discount, in percentage points.
- **Baseline:** always predicting the average discount.

|                               | MAE         |
| ----------------------------- | ----------- |
| Baseline (always the average) | ≈ 19 points |
| Random forest                 | ≈ 9 points  |

_(Measured with 3 daily collections, Oct 6–8, 2026.)_

---

## 9. Technologies

| Layer            | Technology                                                                                                                    |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Collection       | Python, [requests](https://requests.readthedocs.io/), [BeautifulSoup](https://www.crummy.com/software/BeautifulSoup/bs4/doc/) |
| Persistence      | [MongoDB](https://www.mongodb.com/), [pymongo](https://pymongo.readthedocs.io/)                                               |
| API              | [FastAPI](https://fastapi.tiangolo.com/), [uvicorn](https://www.uvicorn.org/)                                                 |
| Interface        | HTML, CSS, JavaScript, [Chart.js](https://www.chartjs.org/)                                                                   |
| Machine learning | [pandas](https://pandas.pydata.org/), [scikit-learn](https://scikit-learn.org/)                                               |
