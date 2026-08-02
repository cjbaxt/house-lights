"""Seed venues and companies. Run once after creating the DB."""
from sqlmodel import Session, select
from app.db import engine
from app.models.core import Venue, Company


VENUES = [
    dict(name="Paradiso", scraper_key="paradiso", scrape_url="https://www.paradiso.nl/nl/agenda/", website_url="https://www.paradiso.nl"),
    dict(name="Melkweg", scraper_key="melkweg", scrape_url="https://www.melkweg.nl/nl/agenda/", website_url="https://www.melkweg.nl"),
    dict(name="Royal Concertgebouw", scraper_key="concertgebouw", website_url="https://www.concertgebouw.nl"),
    dict(name="Nationale Opera & Ballet", scraper_key="operaballet", website_url="https://www.operaballet.nl"),
    dict(name="Koninklijk Theater Carré", scraper_key="carre", website_url="https://www.theatercarre.nl"),
    dict(name="ITA – Internationaal Theater Amsterdam", scraper_key="ita", website_url="https://www.ita.nl"),
    dict(name="DeLaMar", scraper_key="delamar", website_url="https://www.delamar.nl"),
    dict(name="Muziekgebouw aan 't IJ", scraper_key="muziekgebouw", website_url="https://www.muziekgebouw.nl"),
    dict(name="Bimhuis", scraper_key="bimhuis", website_url="https://www.bimhuis.nl"),
    dict(name="AFAS Live", scraper_key="afaslive", website_url="https://www.afaslive.nl"),
    dict(name="Boom Chicago", scraper_key="boomchicago", website_url="https://www.boomchicago.nl"),
    dict(name="Shelter Amsterdam", scraper_key="shelter", website_url="https://www.shelteramsterdam.nl"),
    dict(name="Frascati", scraper_key="frascati", website_url="https://www.frascatitheater.nl"),
    dict(name="OT301", scraper_key="ot301", website_url="https://www.ot301.nl"),
    dict(name="Cinetol", scraper_key="cinetol", website_url="https://www.cinetol.nl"),
    dict(name="De Duif", scraper_key="deduif", website_url="https://www.deduif.nl"),
    dict(name="Felix Meritis", scraper_key="felixmeritis", website_url="https://www.felixmeritis.nl"),
    dict(name="Bostheater", scraper_key="bostheater", website_url="https://www.bostheater.nl"),
    dict(name="KIT LIVE", scraper_key="kitlive", website_url="https://www.kit.nl"),
    dict(name="Het Amsterdams Theaterhuis", scraper_key="theaterhuis", website_url="https://www.hetamsterdamstheaterhuis.nl"),
    dict(name="Badhuistheater", scraper_key="badhuistheater", scrape_url="https://www.badhuistheater.nl/agenda", website_url="https://www.badhuistheater.nl"),
    dict(name="Ziggo Dome", scraper_key="ziggodome", website_url="https://www.ziggodome.nl"),
    dict(name="Johan Cruijff Arena", scraper_key="arena", website_url="https://www.johancruijffarena.nl"),
    dict(name="Zonnehuis"),
    dict(name="Rozentheater"),
    dict(name="De Meervaart", scraper_key="meervaart", website_url="https://www.demeervaart.nl"),
]

COMPANIES = [
    dict(name="Orange Theatre Company", scraper_key="otc", scrape_url="https://www.orangetheatrecompany.com/upcomingproductions", website_url="https://www.orangetheatrecompany.com"),
    dict(name="English Theatre Netherlands", scraper_key="englishtheatrenetherlands", scrape_url="https://englishtheatrenetherlands.com/shows-and-plays/", website_url="https://englishtheatrenetherlands.com"),
    dict(name="Happily Ever After Productions", scraper_key="hea", scrape_url="https://heaproductions.nl", website_url="https://heaproductions.nl"),
    dict(name="Inplayers", scraper_key="inplayers", scrape_url="https://inplayers.org", website_url="https://inplayers.org"),
    dict(name="The Cauldron", scraper_key="cauldron", scrape_url="https://www.cauldronperformingarts.com", website_url="https://www.cauldronperformingarts.com"),
    dict(name="Down Stage Left", scraper_key="downstageleft", scrape_url="https://downstageleft.org", website_url="https://downstageleft.org"),
    dict(name="Strike Me Pink", website_url="https://www.strikemepinkproductions.com"),
    dict(name="Actor's Anonymous", website_url="https://www.actorsanonymous.nl"),
    dict(name="QETC", website_url="https://www.qetc.nl"),
    dict(name="Reckless Shakespeare"),
    dict(name="Sismo", website_url="https://sismo.nl"),
    dict(name="Park Avenue Theater", website_url="https://www.parkavenuetheater.nl"),
    dict(name="Birdbrain Theatre", website_url="https://englishtheatrenetherlands.com/event-organizer/bird-brain-theatre"),
]


def seed():
    with Session(engine) as session:
        for v in VENUES:
            exists = session.exec(select(Venue).where(Venue.name == v["name"])).first()
            if not exists:
                session.add(Venue(**v))
        for c in COMPANIES:
            exists = session.exec(select(Company).where(Company.name == c["name"])).first()
            if not exists:
                session.add(Company(**c))
        session.commit()
    print("Seeded venues and companies.")


if __name__ == "__main__":
    seed()
