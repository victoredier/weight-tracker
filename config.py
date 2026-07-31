import os
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

class Config:
    SECRET_KEY = os.environ.get('SECRET_KEY', 'default-dev-secret-key-12345')
    
    # Database Configuration
    # If the URL starts with postgres://, replace it with postgresql:// for SQLAlchemy compatibility
    # If the URL starts with mysql://, replace it with mysql+pymysql:// to use the installed PyMySQL driver
    db_url = os.environ.get('DATABASE_URL', 'sqlite:///weight_tracker.db')
    if db_url.startswith("postgres://"):
        db_url = db_url.replace("postgres://", "postgresql://", 1)
    elif db_url.startswith("mysql://"):
        db_url = db_url.replace("mysql://", "mysql+pymysql://", 1)
    
    SQLALCHEMY_DATABASE_URI = db_url
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    
    # Google OAuth Config
    GOOGLE_CLIENT_ID = os.environ.get('GOOGLE_CLIENT_ID')
    GOOGLE_CLIENT_SECRET = os.environ.get('GOOGLE_CLIENT_SECRET')
    
    # Mock Login Configuration (allows testing OAuth bypass)
    MOCK_LOGIN = os.environ.get('MOCK_LOGIN', 'True').lower() in ('true', '1', 't', 'y', 'yes')
