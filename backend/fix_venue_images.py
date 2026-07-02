"""Fix venue image URLs — replace broken Wikimedia guesses with verified ones."""
from sqlmodel import Session, select
from app.db import engine
from app.models.core import Venue

# Verified URLs (either curl 200 or returned directly by Wikipedia pageimages API)
IMAGES = {
    "Paradiso": "https://upload.wikimedia.org/wikipedia/commons/8/8c/Paradiso_Amsterdam.jpg",
    "Melkweg": "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e8/Melkweg_en_Rabozaal.jpg/960px-Melkweg_en_Rabozaal.jpg",
    "Royal Concertgebouw": "https://upload.wikimedia.org/wikipedia/commons/c/c6/Concertgebouw_Amsterdam.jpg",
    "Nationale Opera & Ballet": "https://upload.wikimedia.org/wikipedia/commons/thumb/0/04/Amsterdam_-_Stopera_%2830213475601%29.jpg/960px-Amsterdam_-_Stopera_%2830213475601%29.jpg",
    "Muziekgebouw aan 't IJ": "https://upload.wikimedia.org/wikipedia/commons/3/38/Muziekgebouw_aan_het_IJ.jpg",
    "Bimhuis": "https://upload.wikimedia.org/wikipedia/commons/thumb/a/af/Bimhuis_by_day.JPG/960px-Bimhuis_by_day.JPG",
    "ITA – Internationaal Theater Amsterdam": "https://upload.wikimedia.org/wikipedia/commons/a/ab/Stadsschouwburg_Amsterdam.jpg",
    "DeLaMar": "https://upload.wikimedia.org/wikipedia/commons/thumb/5/5b/DeLaMar.jpg/960px-DeLaMar.jpg",
    "Ziggo Dome": "https://upload.wikimedia.org/wikipedia/commons/thumb/7/74/Ziggo_Dome.JPG/960px-Ziggo_Dome.JPG",
    "AFAS Live": "https://upload.wikimedia.org/wikipedia/commons/thumb/d/d4/AFAS_Live_voorgevel.jpg/960px-AFAS_Live_voorgevel.jpg",
    "Johan Cruijff Arena": "https://upload.wikimedia.org/wikipedia/commons/thumb/d/d1/Arena%2C_Ajax_stadion%2C_Amsterdam.JPG/960px-Arena%2C_Ajax_stadion%2C_Amsterdam.JPG",
    "Felix Meritis": "https://upload.wikimedia.org/wikipedia/commons/thumb/f/f6/FelixM.jpg/960px-FelixM.jpg",
    # Clear broken URLs
    "Shelter Amsterdam": None,
    "Boom Chicago": None,
    "Koninklijk Theater Carré": None,
}

with Session(engine) as session:
    venues = session.exec(select(Venue)).all()
    for v in venues:
        if v.name in IMAGES:
            old = v.image_url
            v.image_url = IMAGES[v.name]
            session.add(v)
            print(f"{v.name}: {old and old[:50]} -> {v.image_url and v.image_url[:50]}")
    session.commit()
    print("Done.")
