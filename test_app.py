import unittest
from app import parse_weight_input
from database import db
from models import User, WeightLog
from flask import Flask

class WeightTrackerTestCase(unittest.TestCase):
    def setUp(self):
        # Create a mock flask application context for SQLAlchemy testing
        self.app = Flask(__name__)
        self.app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///:memory:'
        self.app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
        db.init_app(self.app)
        
        self.app_context = self.app.app_context()
        self.app_context.push()
        db.create_all()

    def tearDown(self):
        db.session.remove()
        db.drop_all()
        self.app_context.pop()

    def test_weight_parsing_decimals(self):
        # Weight with point
        self.assertEqual(parse_weight_input("82.5"), 82.5)
        # Weight with comma (European/Latin style)
        self.assertEqual(parse_weight_input("82,5"), 82.5)
        # Decimal float
        self.assertEqual(parse_weight_input("102.7"), 102.7)

    def test_weight_parsing_no_decimals_three_plus_digits(self):
        # 3 digits should parse with decimal on the 3rd value
        self.assertEqual(parse_weight_input("825"), 82.5)
        self.assertEqual(parse_weight_input("750"), 75.0)
        # 4 digits should parse with decimal before the last digit
        self.assertEqual(parse_weight_input("1025"), 102.5)
        self.assertEqual(parse_weight_input("1200"), 120.0)

    def test_weight_parsing_no_decimals_less_digits(self):
        # 2 digits should parse as a whole float
        self.assertEqual(parse_weight_input("82"), 82.0)
        self.assertEqual(parse_weight_input("70"), 70.0)
        # 1 digit
        self.assertEqual(parse_weight_input("8"), 8.0)

    def test_weight_parsing_invalid(self):
        self.assertIsNone(parse_weight_input("abc"))
        self.assertIsNone(parse_weight_input("-825"))
        self.assertIsNone(parse_weight_input(""))
        self.assertIsNone(parse_weight_input("   "))
        self.assertIsNone(parse_weight_input("82.5.5"))

    def test_bmi_calculation(self):
        # Create a test user
        user = User(google_id="test-id", email="test@test.com", name="Test User")
        user.height = 175.0  # 1.75 meters
        db.session.add(user)
        db.session.commit()
        
        # Test BMI when no weight logs exist (should be None)
        self.assertIsNone(user.bmi)
        self.assertIsNone(user.bmi_category)
        
        # Log a weight of 80 kg
        log = WeightLog(user_id=user.id, weight=80.0)
        db.session.add(log)
        db.session.commit()
        
        # BMI = 80 / (1.75 * 1.75) = 80 / 3.0625 = 26.122...
        # Rounds to 26.1
        self.assertEqual(user.bmi, 26.1)
        self.assertEqual(user.bmi_category['name'], 'Sobrepeso')
        
        # Log a newer weight of 70 kg
        log2 = WeightLog(user_id=user.id, weight=70.0)
        db.session.add(log2)
        db.session.commit()
        
        # BMI = 70 / (1.75 * 1.75) = 70 / 3.0625 = 22.857...
        # Rounds to 22.9
        self.assertEqual(user.bmi, 22.9)
        self.assertEqual(user.bmi_category['name'], 'Normal')

    def test_timezone_conversion(self):
        from datetime import datetime, timezone, timedelta
        # Create a test log with a specific UTC date
        utc_date = datetime(2026, 8, 3, 0, 0, 0)
        log = WeightLog(user_id=1, weight=75.0, date=utc_date)
        
        # Colombia timezone is UTC-5, so 2026-08-03 00:00:00 UTC should be 2026-08-02 19:00:00
        local_dt = log.local_date
        self.assertEqual(local_dt.year, 2026)
        self.assertEqual(local_dt.month, 8)
        self.assertEqual(local_dt.day, 2)
        self.assertEqual(local_dt.hour, 19)
        self.assertEqual(local_dt.minute, 0)
        self.assertEqual(local_dt.tzinfo.utcoffset(local_dt), timedelta(hours=-5))

if __name__ == '__main__':
    unittest.main()
