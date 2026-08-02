import uuid
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlmodel import Session, select
from app.db import get_session
from app.models.core import Venue, Company

router = APIRouter(tags=["venues"])


class VenueUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    image_url: str | None = None
    website_url: str | None = None
    address: str | None = None
    neighbourhood: str | None = None


@router.get("/venues")
def list_venues(session: Session = Depends(get_session)):
    return session.exec(select(Venue).where(Venue.active == True).order_by(Venue.name)).all()


@router.patch("/venues/{venue_id}")
def update_venue(venue_id: uuid.UUID, data: VenueUpdate, session: Session = Depends(get_session)):
    venue = session.get(Venue, venue_id)
    if not venue:
        raise HTTPException(status_code=404)
    if data.name is not None:
        venue.name = data.name.strip()
    if data.description is not None:
        venue.description = data.description.strip() or None
    if data.image_url is not None:
        venue.image_url = data.image_url.strip() or None
    if data.website_url is not None:
        venue.website_url = data.website_url.strip() or None
    if data.address is not None:
        venue.address = data.address.strip() or None
    if data.neighbourhood is not None:
        venue.neighbourhood = data.neighbourhood.strip() or None
    session.add(venue)
    session.commit()
    session.refresh(venue)
    return venue


@router.get("/companies")
def list_companies(session: Session = Depends(get_session)):
    return session.exec(select(Company).where(Company.active == True).order_by(Company.name)).all()
