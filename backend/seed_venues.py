"""Seed venues and companies. Run once after creating the DB."""
from sqlmodel import Session, select
from app.db import engine
from app.models.core import Venue, Company


VENUES = [
    # High priority
    dict(name="Paradiso", scraper_key="paradiso", scrape_url="https://www.paradiso.nl/nl/agenda/", website_url="https://www.paradiso.nl", priority="high"),
    dict(name="Melkweg", scraper_key="melkweg", scrape_url="https://www.melkweg.nl/nl/agenda/", website_url="https://www.melkweg.nl", priority="high"),
    dict(name="Royal Concertgebouw", scraper_key="concertgebouw", website_url="https://www.concertgebouw.nl", priority="high"),
    dict(name="Nationale Opera & Ballet", scraper_key="operaballet", website_url="https://www.operaballet.nl", priority="high"),
    dict(name="Koninklijk Theater Carré", scraper_key="carre", website_url="https://www.theatercarre.nl", priority="high"),
    dict(name="ITA – Internationaal Theater Amsterdam", scraper_key="ita", website_url="https://www.ita.nl", priority="high"),
    dict(name="DeLaMar", scraper_key="delamar", website_url="https://www.delamar.nl", priority="high"),
    dict(name="Muziekgebouw aan 't IJ", scraper_key="muziekgebouw", website_url="https://www.muziekgebouw.nl", priority="high"),
    # Medium priority
    dict(name="Bimhuis", scraper_key="bimhuis", website_url="https://www.bimhuis.nl", priority="medium"),
    dict(name="AFAS Live", scraper_key="afaslive", website_url="https://www.afaslive.nl", priority="medium"),
    dict(name="Boom Chicago", scraper_key="boomchicago", website_url="https://www.boomchicago.nl", priority="medium"),
    dict(name="Shelter Amsterdam", scraper_key="shelter", website_url="https://www.shelteramsterdam.nl", priority="medium"),
    dict(name="Frascati", scraper_key="frascati", website_url="https://www.frascatitheater.nl", priority="medium"),
    dict(name="OT301", scraper_key="ot301", website_url="https://www.ot301.nl", priority="medium"),
    dict(name="Cinetol", scraper_key="cinetol", website_url="https://www.cinetol.nl", priority="medium"),
    dict(name="De Duif", scraper_key="deduif", website_url="https://www.deduif.nl", priority="medium"),
    dict(name="Felix Meritis", scraper_key="felixmeritis", website_url="https://www.felixmeritis.nl", priority="medium"),
    dict(name="Bostheater", scraper_key="bostheater", website_url="https://www.bostheater.nl", priority="medium"),
    dict(name="KIT LIVE", scraper_key="kitlive", website_url="https://www.kit.nl", priority="medium"),
    dict(name="Het Amsterdams Theaterhuis", scraper_key="theaterhuis", website_url="https://www.hetamsterdamstheaterhuis.nl", priority="medium"),
    dict(name="Badhuistheater", scraper_key="badhuistheater", scrape_url="https://www.badhuistheater.nl/agenda", website_url="https://www.badhuistheater.nl", priority="medium"),
    # Low priority
    dict(name="Ziggo Dome", scraper_key="ziggodome", website_url="https://www.ziggodome.nl", priority="low"),
    dict(name="Johan Cruijff Arena", scraper_key="arena", website_url="https://www.johancruijffarena.nl", priority="low"),
    dict(name="AFAS Live", scraper_key="afaslive", website_url="https://www.afaslive.nl", priority="low"),
    dict(name="Zonnehuis", website_url=None, priority="low"),
    dict(name="Rozentheater", website_url=None, priority="low"),
    dict(name="De Meervaart", scraper_key="meervaart", website_url="https://www.demeervaart.nl", priority="low"),
]

COMPANIES = [
    dict(name="Orange Theatre Company", scraper_key="otc", scrape_url="https://www.orangetheatrecompany.com/upcomingproductions", website_url="https://www.orangetheatrecompany.com", priority="high"),
    dict(name="English Theatre Netherlands", scraper_key="englishtheatrenetherlands", scrape_url="https://englishtheatrenetherlands.com/shows-and-plays/", website_url="https://englishtheatrenetherlands.com", priority="medium"),
    dict(name="Happily Ever After Productions", scraper_key="hea", scrape_url="https://heaproductions.nl", website_url="https://heaproductions.nl", priority="medium"),
    dict(name="Inplayers", scraper_key="inplayers", scrape_url="https://inplayers.org", website_url="https://inplayers.org", priority="medium"),
    dict(name="The Cauldron", scraper_key="cauldron", scrape_url="https://www.cauldronperformingarts.com", website_url="https://www.cauldronperformingarts.com", priority="medium"),
    dict(name="Down Stage Left", scraper_key="downstageleft", scrape_url="https://downstageleft.org", website_url="https://downstageleft.org", priority="medium"),
    dict(name="Strike Me Pink", website_url="https://www.strikemepinkproductions.com", priority="low"),
    dict(name="Actor's Anonymous", website_url="https://www.actorsanonymous.nl", priority="low"),
    dict(name="QETC", website_url="https://www.qetc.nl", priority="low"),
    dict(name="Reckless Shakespeare", priority="low"),
    dict(name="Sismo", website_url="https://sismo.nl", priority="low"),
    dict(name="Park Avenue Theater", website_url="https://www.parkavenuetheater.nl", priority="low"),
    dict(name="Birdbrain Theatre", website_url="https://englishtheatrenetherlands.com/event-organizer/bird-brain-theatre", priority="low"),
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
