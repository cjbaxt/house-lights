"""
One-time script to populate venue/company enrichment fields.
Run: python3 enrich_venues.py
"""
from sqlmodel import Session, select
from app.db import engine
from app.models.core import Venue, Company

VENUE_DATA = {
    "Paradiso": {
        "address": "Weteringschans 6-8, 1017 SG Amsterdam",
        "neighbourhood": "Leidseplein",
        "venue_type": "concert_hall",
        "capacity": 1500,
        "description": "Converted 19th-century church turned iconic music venue. Hosts international and local acts across rock, pop, electronic, and world music. The main hall and smaller Kleine Zaal (300 cap) run parallel programmes most nights.",
        "image_url": "https://upload.wikimedia.org/wikipedia/commons/thumb/0/05/Paradiso_Amsterdam.jpg/1280px-Paradiso_Amsterdam.jpg",
    },
    "Melkweg": {
        "address": "Lijnbaansgracht 234a, 1017 PH Amsterdam",
        "neighbourhood": "Leidseplein",
        "venue_type": "concert_hall",
        "capacity": 1500,
        "description": "Former dairy factory turned multi-room arts complex. Two concert halls (Max and OZ), a cinema, gallery, and café. Programmes span indie, hip-hop, electronic, and world music, plus theatre and club nights.",
        "image_url": "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a9/Melkweg_Amsterdam.jpg/1280px-Melkweg_Amsterdam.jpg",
    },
    "Royal Concertgebouw": {
        "address": "Concertgebouwplein 10, 1071 LN Amsterdam",
        "neighbourhood": "Museumplein",
        "venue_type": "concert_hall",
        "capacity": 2037,
        "description": "One of the world's finest concert halls, opened in 1888. Home of the Royal Concertgebouw Orchestra. The Main Hall is renowned for its acoustic perfection; the smaller Recital Hall hosts chamber music and solo recitals.",
        "image_url": "https://upload.wikimedia.org/wikipedia/commons/thumb/6/64/Concertgebouw_Amsterdam.jpg/1280px-Concertgebouw_Amsterdam.jpg",
    },
    "Nationale Opera & Ballet": {
        "address": "Amstel 3, 1011 PN Amsterdam",
        "neighbourhood": "Waterlooplein",
        "venue_type": "theatre",
        "capacity": 1689,
        "description": "The Dutch National Opera and National Ballet share this purpose-built theatre on the Amstel, opened in 1986. Main stage productions run alongside smaller-scale work in the Rabozaal. Home to the largest opera and ballet programme in the Netherlands.",
        "image_url": "https://upload.wikimedia.org/wikipedia/commons/thumb/3/3e/Stopera_Amsterdam.jpg/1280px-Stopera_Amsterdam.jpg",
    },
    "Koninklijk Theater Carré": {
        "address": "Amstel 115-125, 1018 EM Amsterdam",
        "neighbourhood": "Weesperplein",
        "venue_type": "theatre",
        "capacity": 1772,
        "description": "Landmark circular theatre on the Amstel, built in 1887 as a permanent home for Oscar Carré's circus. Now hosts large-scale musicals, cabaret, comedy, and visiting international productions. The ornate Victorian interior is a landmark in itself.",
        "image_url": "https://upload.wikimedia.org/wikipedia/commons/thumb/0/03/Theater_Carr%C3%A9_Amsterdam.jpg/1280px-Theater_Carr%C3%A9_Amsterdam.jpg",
    },
    "Muziekgebouw aan 't IJ": {
        "address": "Piet Heinkade 1, 1019 BR Amsterdam",
        "neighbourhood": "Eastern Docklands",
        "venue_type": "concert_hall",
        "capacity": 735,
        "description": "Modern glass-fronted concert hall on the IJ waterfront, opened in 2005. Specialises in contemporary classical, new music, and experimental sound. The main hall (735) and smaller Bimhuis (next door) together form Amsterdam's hub for adventurous music.",
        "image_url": "https://upload.wikimedia.org/wikipedia/commons/thumb/8/8c/Muziekgebouw_aan_het_IJ.jpg/1280px-Muziekgebouw_aan_het_IJ.jpg",
    },
    "Bimhuis": {
        "address": "Piet Heinkade 3, 1019 BR Amsterdam",
        "neighbourhood": "Eastern Docklands",
        "venue_type": "concert_hall",
        "capacity": 300,
        "description": "The Netherlands' leading jazz and improvised music venue, physically attached to the Muziekgebouw. Intimate black-box space with excellent sightlines. Programmes local and international jazz, improvisation, and creative music nightly.",
        "image_url": "https://upload.wikimedia.org/wikipedia/commons/thumb/8/8c/Muziekgebouw_aan_het_IJ.jpg/1280px-Muziekgebouw_aan_het_IJ.jpg",
    },
    "Boom Chicago": {
        "address": "Rozengracht 117, 1016 LV Amsterdam",
        "neighbourhood": "Jordaan",
        "venue_type": "theatre",
        "capacity": 305,
        "description": "Amsterdam's long-running English-language comedy theatre, founded in 1993 by American expats. Known for fast-paced improv and sketch comedy with sharp political and cultural commentary. Also a launchpad for alumni who went on to SNL and beyond.",
        "image_url": "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e3/Rozengracht_Amsterdam.jpg/1280px-Rozengracht_Amsterdam.jpg",
    },
    "Badhuistheater": {
        "address": "Dijksgracht 4, 1019 BS Amsterdam",
        "neighbourhood": "Eastern Docklands",
        "venue_type": "theatre",
        "capacity": 80,
        "description": "Intimate theatre in a converted bathhouse on the docklands waterfront. Programmes contemporary theatre, dance, and performance by emerging makers. One of Amsterdam's most atmospheric small stages.",
        "image_url": None,
    },
    "Rozentheater": {
        "address": "Rozengracht 133, 1016 LV Amsterdam",
        "neighbourhood": "Jordaan",
        "venue_type": "theatre",
        "capacity": 150,
        "description": "Community and fringe theatre in the Jordaan neighbourhood. Hosts a mix of Dutch-language theatre, cabaret, and spoken word, with a focus on accessible, locally rooted programming.",
        "image_url": None,
    },
    "DeLaMar": {
        "address": "Marnixstraat 402, 1017 PL Amsterdam",
        "neighbourhood": "Leidseplein",
        "venue_type": "theatre",
        "capacity": 900,
        "description": "Modern theatre opened in 2010 near Leidseplein. Two halls (900 and 300 seats) programme mainstream Dutch theatre, musicals, and cabaret. One of Amsterdam's busiest commercial theatre venues.",
        "image_url": "https://upload.wikimedia.org/wikipedia/commons/thumb/8/8c/DeLaMar_theater_Amsterdam.jpg/1280px-DeLaMar_theater_Amsterdam.jpg",
    },
    "ITA – Internationaal Theater Amsterdam": {
        "address": "Leidseplein 26, 1017 PT Amsterdam",
        "neighbourhood": "Leidseplein",
        "venue_type": "theatre",
        "capacity": 900,
        "description": "Amsterdam's flagship repertory theatre, home to one of Europe's leading ensembles under artistic director Ivo van Hove until 2024. The main Stadsschouwburg building dates from 1894; a modern Rabozaal extension adds a flexible studio space. Programmes ambitious European theatre and international co-productions.",
        "image_url": "https://upload.wikimedia.org/wikipedia/commons/thumb/5/5d/Stadsschouwburg_Amsterdam.jpg/1280px-Stadsschouwburg_Amsterdam.jpg",
    },
    "AFAS Live": {
        "address": "ArenA Boulevard 590, 1101 DS Amsterdam",
        "neighbourhood": "Amsterdam Southeast",
        "venue_type": "concert_hall",
        "capacity": 6000,
        "description": "Large indoor arena adjacent to the Johan Cruijff Arena in Amsterdam Southeast. Hosts major international pop, rock, and hip-hop tours. One of the Netherlands' main touring concert stops.",
        "image_url": "https://upload.wikimedia.org/wikipedia/commons/thumb/2/24/AFAS_Live_Amsterdam.jpg/1280px-AFAS_Live_Amsterdam.jpg",
    },
    "Bostheater": {
        "address": "Bosbaan 5, 1182 AG Amstelveen",
        "neighbourhood": "Amsterdamse Bos",
        "venue_type": "outdoor",
        "capacity": 1500,
        "description": "Open-air summer theatre in the Amsterdamse Bos, the large forest park south of the city. Programmes theatre, comedy, children's shows, and music from June to August. An Amsterdam summer institution.",
        "image_url": None,
    },
    "Cinetol": {
        "address": "Tolstraat 182, 1074 VM Amsterdam",
        "neighbourhood": "De Pijp",
        "venue_type": "other",
        "capacity": 200,
        "description": "Cultural venue in De Pijp combining an independent cinema with a concert and event space. Programmes indie film, live music, club nights, and community events. Known for its relaxed, neighbourhood feel.",
        "image_url": None,
    },
    "De Duif": {
        "address": "Prinsengracht 756, 1017 LE Amsterdam",
        "neighbourhood": "Grachtengordel",
        "venue_type": "concert_hall",
        "capacity": 350,
        "description": "Former Catholic church on the Prinsengracht, now a concert and events venue. The grand neo-classical interior makes it a popular spot for classical concerts, choir performances, and intimate seated shows.",
        "image_url": "https://upload.wikimedia.org/wikipedia/commons/thumb/4/4e/De_Duif_Amsterdam.jpg/1280px-De_Duif_Amsterdam.jpg",
    },
    "Felix Meritis": {
        "address": "Keizersgracht 324, 1016 EZ Amsterdam",
        "neighbourhood": "Grachtengordel",
        "venue_type": "theatre",
        "capacity": 300,
        "description": "18th-century cultural centre on the Keizersgracht, historically home to Amsterdam's Enlightenment society. Now a hub for experimental theatre, performance, debate, and interdisciplinary arts. Beautiful neoclassical rooms and a flexible theatre space.",
        "image_url": "https://upload.wikimedia.org/wikipedia/commons/thumb/8/87/Felix_Meritis_Amsterdam.jpg/1280px-Felix_Meritis_Amsterdam.jpg",
    },
    "Frascati": {
        "address": "Nes 63, 1012 KD Amsterdam",
        "neighbourhood": "Centrum",
        "venue_type": "theatre",
        "capacity": 250,
        "description": "Contemporary theatre on the Nes, Amsterdam's theatre street. Focuses on new Dutch drama and emerging makers, with multiple small stages. A key venue for the development of new work in the Netherlands.",
        "image_url": None,
    },
    "Het Amsterdams Theaterhuis": {
        "address": "Amsteldijk 6-D, 1074 HP Amsterdam",
        "neighbourhood": "De Pijp",
        "venue_type": "theatre",
        "capacity": 100,
        "description": "Small independent theatre space in De Pijp. Programmes English and Dutch-language theatre, often by independent companies and new makers.",
        "image_url": None,
    },
    "KIT LIVE": {
        "address": "Mauritskade 63, 1092 AD Amsterdam",
        "neighbourhood": "Oost",
        "venue_type": "theatre",
        "capacity": 500,
        "description": "Performance space within the Royal Tropical Institute (KIT), a grand 1926 building in Amsterdam East. Hosts world music, dance, spoken word, and cultural events with a strong international and postcolonial perspective.",
        "image_url": "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a5/KIT_Amsterdam.jpg/1280px-KIT_Amsterdam.jpg",
    },
    "OT301": {
        "address": "Overtoom 301, 1054 HW Amsterdam",
        "neighbourhood": "Oud-West",
        "venue_type": "other",
        "capacity": 250,
        "description": "Squat-turned-cultural-centre on the Overtoom, running since 2000. A DIY arts hub with a cinema, rehearsal spaces, a vegan café, and a concert/club room. Known for experimental, underground, and activist programming.",
        "image_url": None,
    },
    "Shelter Amsterdam": {
        "address": "Overhoeksplein 3, 1031 KS Amsterdam",
        "neighbourhood": "Noord",
        "venue_type": "other",
        "capacity": 800,
        "description": "Underground club and concert venue in Amsterdam Noord, built in a nuclear bunker beneath the A'DAM Tower. Known for serious electronic music programming — techno, house, and experimental club nights — with a no-phone policy.",
        "image_url": "https://upload.wikimedia.org/wikipedia/commons/thumb/b/b0/ADAM_Toren_Amsterdam.jpg/1280px-ADAM_Toren_Amsterdam.jpg",
    },
    "Johan Cruijff Arena": {
        "address": "ArenA Boulevard 1, 1101 AX Amsterdam",
        "neighbourhood": "Amsterdam Southeast",
        "venue_type": "arena",
        "capacity": 55000,
        "description": "Amsterdam's main football stadium and the largest live event arena in the Netherlands. Home of AFC Ajax. Hosts stadium-scale concerts and major international tours when not in use for football.",
        "image_url": "https://upload.wikimedia.org/wikipedia/commons/thumb/8/8d/Johan_Cruyff_Arena_2019.jpg/1280px-Johan_Cruyff_Arena_2019.jpg",
    },
    "Ziggo Dome": {
        "address": "De Passage 100, 1101 AX Amsterdam",
        "neighbourhood": "Amsterdam Southeast",
        "venue_type": "arena",
        "capacity": 17000,
        "description": "The Netherlands' largest indoor arena, opened in 2012 next to the Johan Cruijff Arena. Hosts major international arena tours across pop, rock, hip-hop, and electronic music. One of the top-grossing venues in Europe.",
        "image_url": "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c2/Ziggo_Dome_Amsterdam.jpg/1280px-Ziggo_Dome_Amsterdam.jpg",
    },
    "Zonnehuis": {
        "address": "Amsteldijk 6, 1074 HP Amsterdam",
        "neighbourhood": "De Pijp",
        "venue_type": "concert_hall",
        "capacity": 700,
        "description": "A Paradiso-operated venue in Amsterdam South, programming pop, rock, and world music in a more neighbourhood setting. Also home to events by the broader Paradiso group, including the Zonnehuis Concerts series.",
        "image_url": None,
    },
    "De Meervaart": {
        "address": "Meer en Vaart 300, 1068 LE Amsterdam",
        "neighbourhood": "Nieuw-West",
        "venue_type": "theatre",
        "capacity": 650,
        "description": "Theatre and cultural centre in Amsterdam Nieuw-West, serving one of the city's most diverse communities. Programmes mainstream Dutch theatre, cabaret, dance, world music, and community events. The largest cultural venue in the west of Amsterdam.",
        "image_url": None,
    },
}

COMPANY_DATA = {
    "English Theatre Netherlands": {
        "description": "The main producing organisation for professional English-language theatre in the Netherlands. Produces and presents shows across Amsterdam and tours nationally. Also the umbrella for several smaller English-language companies.",
    },
    "Strike Me Pink": {
        "description": "Amsterdam-based English-language theatre company making original contemporary productions. Known for devised and text-based work exploring personal and political themes.",
    },
    "Actor's Anonymous": {
        "description": "Amsterdam English-language theatre company producing classic and contemporary plays, often with a Dutch-international cast mix.",
    },
    "QETC": {
        "description": "Queer English Theatre Company — Amsterdam-based company making theatre by and for the LGBTQ+ community, in English.",
    },
    "Reckless Shakespeare": {
        "description": "Amsterdam company specialising in Shakespeare and classic texts, performed in English with a characteristically energetic, physical style.",
    },
    "Sismo": {
        "description": "International performance company based in Amsterdam making multilingual, physical theatre and dance-theatre work for adult and young audiences.",
    },
    "Park Avenue Theater": {
        "description": "Amsterdam English-language company producing American musicals and drama, often staging Broadway and Off-Broadway titles for Dutch audiences.",
    },
    "Birdbrain Theatre": {
        "description": "Amsterdam-based English-language company under the English Theatre Netherlands umbrella. Focuses on new writing and contemporary plays.",
    },
    "Orange Theatre Company": {
        "description": "Amsterdam English-language theatre company producing contemporary plays and new works, with a mix of expat and Dutch performers.",
    },
    "Down Stage Left": {
        "description": "Amsterdam English-language community and semi-professional theatre company producing musicals and plays.",
    },
    "Happily Ever After Productions": {
        "description": "Amsterdam-based production company making English-language pantomime, family theatre, and festive shows.",
    },
    "Inplayers": {
        "description": "Amsterdam English-language theatre group producing contemporary and classic plays in intimate venues across the city.",
    },
    "The Cauldron": {
        "description": "Amsterdam English-language performing arts company with a focus on immersive and experimental theatre, circus, and physical performance.",
    },
}


def main():
    with Session(engine) as session:
        venues = session.exec(select(Venue)).all()
        companies = session.exec(select(Company)).all()

        updated_v = 0
        for v in venues:
            data = VENUE_DATA.get(v.name)
            if data:
                v.address = data.get("address")
                v.neighbourhood = data.get("neighbourhood")
                v.venue_type = data.get("venue_type")
                v.capacity = data.get("capacity")
                v.description = data.get("description")
                v.image_url = data.get("image_url")
                session.add(v)
                updated_v += 1
            else:
                print(f"  [WARN] no data for venue: {v.name!r}")

        updated_c = 0
        for c in companies:
            data = COMPANY_DATA.get(c.name)
            if data:
                c.description = data.get("description")
                session.add(c)
                updated_c += 1
            else:
                print(f"  [WARN] no data for company: {c.name!r}")

        session.commit()
        print(f"Updated {updated_v} venues, {updated_c} companies")


if __name__ == "__main__":
    from sqlmodel import select
    main()
