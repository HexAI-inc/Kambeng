from sqlalchemy import Column, Integer, String, ForeignKey, DateTime
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.db.database import Base


class UpdateAttachment(Base):
    __tablename__ = "update_attachments"

    id = Column(Integer, primary_key=True, index=True)
    update_id = Column(Integer, ForeignKey("campaign_updates.id"), index=True)
    campaign_id = Column(Integer, ForeignKey("campaigns.id"), index=True)
    file_url = Column(String)
    file_name = Column(String)
    content_type = Column(String, nullable=True)
    uploaded_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    update = relationship("CampaignUpdate", back_populates="attachments")
