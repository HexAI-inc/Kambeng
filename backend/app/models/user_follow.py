from sqlalchemy import CheckConstraint, Column, DateTime, ForeignKey, Integer, UniqueConstraint
from sqlalchemy.sql import func

from app.db.database import Base


class UserFollow(Base):
    """A user following an organizer — they're emailed when the organizer
    launches a new campaign."""

    __tablename__ = "user_follows"
    __table_args__ = (
        UniqueConstraint("follower_id", "followed_id", name="uq_user_follows_pair"),
        CheckConstraint("follower_id <> followed_id", name="ck_user_follows_not_self"),
    )

    id = Column(Integer, primary_key=True)
    follower_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    followed_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
