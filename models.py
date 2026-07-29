from datetime import datetime
from flask_login import UserMixin
from database import db

class User(UserMixin, db.Model):
    __tablename__ = 'users'
    
    id = db.Column(db.Integer, primary_key=True)
    google_id = db.Column(db.String(100), unique=True, nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    name = db.Column(db.String(100), nullable=True)
    picture = db.Column(db.String(255), nullable=True)
    
    # User Profile (Metric)
    age = db.Column(db.Integer, nullable=True)
    gender = db.Column(db.String(20), nullable=True) # e.g., Masculino, Femenino, Otro
    height = db.Column(db.Float, nullable=True) # in cm
    
    # Relationships
    weight_logs = db.relationship('WeightLog', backref='user', lazy=True, cascade='all, delete-orphan')

    @property
    def latest_weight_log(self):
        # Query the latest weight log based on date and creation time
        return WeightLog.query.filter_by(user_id=self.id).order_by(WeightLog.date.desc(), WeightLog.created_at.desc()).first()

    @property
    def latest_weight(self):
        log = self.latest_weight_log
        return log.weight if log else None

    @property
    def bmi(self):
        if not self.height or not self.latest_weight:
            return None
        # BMI = weight (kg) / (height (m) ^ 2)
        height_m = self.height / 100.0
        return round(self.latest_weight / (height_m ** 2), 1)

    @property
    def bmi_category(self):
        val = self.bmi
        if val is None:
            return None
        if val < 18.5:
            return {
                "name": "Bajo peso",
                "color": "#38bdf8", # sky blue
                "class": "underweight"
            }
        elif val < 25.0:
            return {
                "name": "Normal",
                "color": "#10b981", # emerald green
                "class": "normal"
            }
        elif val < 30.0:
            return {
                "name": "Sobrepeso",
                "color": "#f59e0b", # amber
                "class": "overweight"
            }
        else:
            return {
                "name": "Obesidad",
                "color": "#ef4444", # red
                "class": "obese"
            }

class WeightLog(db.Model):
    __tablename__ = 'weight_logs'
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    weight = db.Column(db.Float, nullable=False) # in kg
    date = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    notes = db.Column(db.Text, nullable=True)
