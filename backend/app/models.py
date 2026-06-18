import datetime
from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Boolean
from sqlalchemy.orm import relationship
from backend.app.database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, nullable=False, index=True)
    password_hash = Column(String, nullable=False)
    role = Column(String, nullable=False) # 'Investigator', 'Analyst', 'Supervisor', 'Policymaker'
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    # Relationships
    audit_logs = relationship("AuditLog", back_populates="user")
    conversations = relationship("Conversation", back_populates="user")

class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    action = Column(String, nullable=False) # e.g. "VIEW_GRAPH", "QUERY_CHATBOT", "LOGIN"
    query_text = Column(String, nullable=True) # The query typed by the user, if applicable
    timestamp = Column(DateTime, default=datetime.datetime.utcnow)

    # Relationships
    user = relationship("User", back_populates="audit_logs")

class BankAccount(Base):
    __tablename__ = "bank_accounts"

    account_number = Column(String, primary_key=True, index=True)
    suspect_id = Column(String, nullable=True, index=True) # References Suspect_ID in CSV
    suspect_name = Column(String, nullable=False, index=True) # Moniker
    bank_name = Column(String, nullable=False)
    balance = Column(Float, default=10000.0)
    account_status = Column(String, default="Active") # 'Active', 'Flagged', 'Frozen'

class Transaction(Base):
    __tablename__ = "transactions"

    transaction_id = Column(String, primary_key=True, index=True)
    sender_account = Column(String, ForeignKey("bank_accounts.account_number"), nullable=True)
    receiver_account = Column(String, ForeignKey("bank_accounts.account_number"), nullable=True)
    amount = Column(Float, nullable=False)
    timestamp = Column(DateTime, nullable=False, default=datetime.datetime.utcnow)
    transaction_type = Column(String, default="Transfer") # 'Transfer', 'Cash Deposit', 'Wire', 'Hawala suspect'
    is_suspicious = Column(Boolean, default=False)

    # Relationships
    sender = relationship("BankAccount", foreign_keys=[sender_account])
    receiver = relationship("BankAccount", foreign_keys=[receiver_account])

class Conversation(Base):
    __tablename__ = "conversations"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    session_id = Column(String, nullable=False, index=True)
    sender = Column(String, nullable=False) # 'User' or 'Agent'
    message_text = Column(String, nullable=False)
    language = Column(String, default="EN") # 'EN' or 'KN'
    timestamp = Column(DateTime, default=datetime.datetime.utcnow)

    # Relationships
    user = relationship("User", back_populates="conversations")
