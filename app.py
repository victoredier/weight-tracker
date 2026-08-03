import os
import json
import csv
import io
from datetime import datetime, timezone, timedelta
from flask import Flask, render_template, redirect, url_for, request, flash, jsonify, Response

COLOMBIA_TZ = timezone(timedelta(hours=-5))
from flask_sqlalchemy import SQLAlchemy
from flask_login import LoginManager, login_user, logout_user, login_required, current_user
from authlib.integrations.flask_client import OAuth

from database import db
from config import Config
from models import User, WeightLog

app = Flask(__name__)
app.config.from_object(Config)

# Trust proxy headers (X-Forwarded-For, X-Forwarded-Proto, etc.) when running behind a proxy like Traefik
from werkzeug.middleware.proxy_fix import ProxyFix
app.wsgi_app = ProxyFix(app.wsgi_app, x_for=1, x_proto=1, x_host=1, x_port=1, x_prefix=1)

# Initialize Database
db.init_app(app)

# Initialize Login Manager
login_manager = LoginManager()
login_manager.init_app(app)
login_manager.login_view = 'login'

# Initialize OAuth
oauth = OAuth(app)
if app.config['GOOGLE_CLIENT_ID'] and app.config['GOOGLE_CLIENT_SECRET']:
    oauth.register(
        name='google',
        client_id=app.config['GOOGLE_CLIENT_ID'],
        client_secret=app.config['GOOGLE_CLIENT_SECRET'],
        server_metadata_url='https://accounts.google.com/.well-known/openid-configuration',
        client_kwargs={
            'scope': 'openid email profile'
        }
    )

@login_manager.user_loader
def load_user(user_id):
    return User.query.get(int(user_id))

# --- Helper Functions ---

def parse_weight_input(input_str):
    """
    Parses a string representing weight in kg.
    - If contains . or , (e.g. "82.5" or "82,5"), parses as float directly.
    - If it's a pure integer of 3+ digits (e.g. "825" or "1025"), inserts a decimal point before the last digit (82.5 or 102.5).
    - If it's a 1- or 2-digit integer (e.g. "82"), treats as whole number (82.0).
    """
    if not input_str:
        return None
    
    # Clean and standardize string
    clean_str = input_str.strip().replace(',', '.')
    
    if '.' in clean_str:
        try:
            val = float(clean_str)
            return val if val > 0 else None
        except ValueError:
            return None
            
    if clean_str.isdigit():
        val = int(clean_str)
        if len(clean_str) >= 3:
            parsed = val / 10.0
        else:
            parsed = float(val)
        return parsed if parsed > 0 else None
        
    return None

def seed_mock_user_data(user, profile_name):
    """
    Seeds realistic initial weight logs for mock profiles to present beautiful charts instantly.
    """
    # Check if user already has logs, if so, do not duplicate
    if WeightLog.query.filter_by(user_id=user.id).first():
        return

    def to_utc_naive(dt_local):
        return dt_local.replace(tzinfo=COLOMBIA_TZ).astimezone(timezone.utc).replace(tzinfo=None)

    # Seed configurations depending on family member profile
    logs_to_seed = []
    import datetime as dt
    
    if profile_name == 'papa':
        user.height = 178.0
        user.age = 45
        user.gender = 'Masculino'
        
        # papa: log two weights per day for the last 7 days
        # AM weight is generally lower than PM weight
        base_weights = [85.0, 84.5, 83.8, 83.3, 83.0, 82.4, 81.7]
        for idx, w in enumerate(base_weights):
            days_ago = len(base_weights) - 1 - idx
            date_base = datetime.now() - dt.timedelta(days=days_ago)
            
            # AM weight (Despertar - hour 7:30)
            date_am = to_utc_naive(datetime(date_base.year, date_base.month, date_base.day, 7, 30))
            logs_to_seed.append(WeightLog(user_id=user.id, weight=w, date=date_am, notes="Ayunas al despertar"))
            
            # PM weight (Dormir - hour 22:15) - slightly heavier
            date_pm = to_utc_naive(datetime(date_base.year, date_base.month, date_base.day, 22, 15))
            logs_to_seed.append(WeightLog(user_id=user.id, weight=w + 0.6, date=date_pm, notes="Antes de acostarse"))
            
    elif profile_name == 'mama':
        user.height = 164.0
        user.age = 42
        user.gender = 'Femenino'
        
        # mama starting weight: 64.5kg down to 62.0kg
        base_weights = [64.2, 63.8, 63.5, 63.0, 62.7, 62.2, 61.8]
        for idx, w in enumerate(base_weights):
            days_ago = len(base_weights) - 1 - idx
            date_base = datetime.now() - dt.timedelta(days=days_ago)
            
            # AM weight
            date_am = to_utc_naive(datetime(date_base.year, date_base.month, date_base.day, 8, 0))
            logs_to_seed.append(WeightLog(user_id=user.id, weight=w, date=date_am, notes="Ayunas"))
            
            # PM weight
            date_pm = to_utc_naive(datetime(date_base.year, date_base.month, date_base.day, 21, 45))
            logs_to_seed.append(WeightLog(user_id=user.id, weight=w + 0.5, date=date_pm, notes="Después de cenar"))
            
    elif profile_name == 'hijo':
        user.height = 142.0
        user.age = 11
        user.gender = 'Masculino'
        
        base_weights = [39.3, 39.5, 39.7, 39.9, 40.1, 40.2, 40.4]
        for idx, w in enumerate(base_weights):
            days_ago = len(base_weights) - 1 - idx
            date_base = datetime.now() - dt.timedelta(days=days_ago)
            
            # AM weight
            date_am = to_utc_naive(datetime(date_base.year, date_base.month, date_base.day, 7, 45))
            logs_to_seed.append(WeightLog(user_id=user.id, weight=w, date=date_am, notes="Despertando"))
            
            # PM weight
            date_pm = to_utc_naive(datetime(date_base.year, date_base.month, date_base.day, 21, 30))
            logs_to_seed.append(WeightLog(user_id=user.id, weight=w + 0.4, date=date_pm, notes="Noche"))

    db.session.add(user)
    for log in logs_to_seed:
        db.session.add(log)
    
    db.session.commit()

# --- Routes ---

@app.route('/')
@login_required
def index():
    # Fetch all weight logs for this user, sorted oldest to newest for statistics
    logs = WeightLog.query.filter_by(user_id=current_user.id).order_by(WeightLog.date.asc(), WeightLog.created_at.asc()).all()
    logs_count = len(logs)
    
    latest_weight = None
    latest_weight_date = None
    total_change = None
    
    if logs_count > 0:
        latest_log = logs[-1]
        latest_weight = latest_log.weight
        latest_weight_date = latest_log.local_date
        
        if logs_count > 1:
            first_weight = logs[0].weight
            total_change = latest_weight - first_weight
            
    stats = {
        'latest_weight': latest_weight,
        'latest_weight_date': latest_weight_date,
        'total_change': total_change,
        'logs_count': logs_count,
        'bmi': current_user.bmi,
        'bmi_category': current_user.bmi_category
    }
    
    # Sort weight logs newest first for display (recent logs list)
    recent_logs = sorted(logs, key=lambda l: (l.date, l.created_at), reverse=True)[:3]
    
    # JSON array for Chart.js (needs chronologically sorted data)
    chart_data = []
    for log in logs:
        chart_data.append({
            'date': log.local_date.strftime('%Y-%m-%d %H:%M:%S'),
            'weight': log.weight
        })
        
    return render_template(
        'dashboard.html',
        stats=stats,
        recent_logs=recent_logs,
        chart_data_json=json.dumps(chart_data)
    )

@app.route('/login')
def login():
    if current_user.is_authenticated:
        return redirect(url_for('index'))
    return render_template('login.html', mock_login_enabled=app.config['MOCK_LOGIN'])

@app.route('/login/google')
def login_google():
    if not app.config['GOOGLE_CLIENT_ID'] or not app.config['GOOGLE_CLIENT_SECRET']:
        flash('El inicio de sesión con Google no está configurado en el servidor. Contacta al administrador o usa el Modo de Desarrollo (Mock).', 'error')
        return redirect(url_for('login'))
    
    redirect_uri = url_for('login_google_authorized', _external=True)
    return oauth.google.authorize_redirect(redirect_uri)

@app.route('/login/google/authorized')
def login_google_authorized():
    try:
        token = oauth.google.authorize_access_token()
        user_info = token.get('userinfo')
    except Exception as e:
        flash(f'Error al autenticar con Google: {str(e)}', 'error')
        return redirect(url_for('login'))
        
    if not user_info:
        flash('No se pudo obtener información del perfil de Google.', 'error')
        return redirect(url_for('login'))
        
    google_id = user_info.get('sub')
    email = user_info.get('email')
    name = user_info.get('name')
    picture = user_info.get('picture')
    
    # Find or create user
    user = User.query.filter_by(google_id=google_id).first()
    if not user:
        user = User(google_id=google_id, email=email, name=name, picture=picture)
        db.session.add(user)
        db.session.commit()
    else:
        # Update user name and avatar just in case it changed
        user.name = name
        user.picture = picture
        db.session.commit()
        
    login_user(user, remember=True)
    flash(f'¡Bienvenido, {user.name}!', 'success')
    return redirect(url_for('index'))

@app.route('/login/mock/<user_profile>')
def login_mock(user_profile):
    if not app.config['MOCK_LOGIN']:
        flash('El login de desarrollo está desactivado.', 'error')
        return redirect(url_for('login'))
        
    profiles = {
        'papa': {
            'google_id': 'mock-google-id-papa',
            'email': 'carlos.parent@familia.com',
            'name': 'Papá (Carlos)',
            'picture': ''
        },
        'mama': {
            'google_id': 'mock-google-id-mama',
            'email': 'laura.parent@familia.com',
            'name': 'Mamá (Laura)',
            'picture': ''
        },
        'hijo': {
            'google_id': 'mock-google-id-hijo',
            'email': 'mateo.kid@familia.com',
            'name': 'Hijo (Mateo)',
            'picture': ''
        }
    }
    
    profile = profiles.get(user_profile)
    if not profile:
        flash('Perfil de desarrollo no válido.', 'error')
        return redirect(url_for('login'))
        
    user = User.query.filter_by(google_id=profile['google_id']).first()
    if not user:
        user = User(
            google_id=profile['google_id'],
            email=profile['email'],
            name=profile['name'],
            picture=profile['picture']
        )
        db.session.add(user)
        db.session.commit()
        
    # Seed initial logs for the mock user so it shows data immediately
    seed_mock_user_data(user, user_profile)
    
    login_user(user, remember=True)
    flash(f'Sesión iniciada (Modo de Desarrollo) como: {user.name}', 'info')
    return redirect(url_for('index'))

@app.route('/logout')
@login_required
def logout():
    logout_user()
    flash('Has cerrado tu sesión.', 'success')
    return redirect(url_for('login'))

@app.route('/weight/add', methods=['POST'])
@login_required
def add_weight():
    weight_raw = request.form.get('weight')
    notes = request.form.get('notes')
    custom_date_str = request.form.get('custom_date')
    custom_time_str = request.form.get('custom_time')
    
    weight = parse_weight_input(weight_raw)
    if weight is None:
        flash('Peso no válido. Por favor, introduce un número positivo (ej. 825 para 82.5 kg).', 'error')
        return redirect(url_for('index'))
        
    # Parse custom date if provided
    if custom_date_str and custom_time_str:
        try:
            local_date = datetime.strptime(f"{custom_date_str} {custom_time_str}", "%Y-%m-%d %H:%M")
            log_date = local_date.replace(tzinfo=COLOMBIA_TZ).astimezone(timezone.utc).replace(tzinfo=None)
        except ValueError:
            flash('Fecha u hora manual no válida. Se usará la fecha actual.', 'error')
            log_date = datetime.utcnow()
    else:
        log_date = datetime.utcnow()
            
    new_log = WeightLog(
        user_id=current_user.id,
        weight=weight,
        date=log_date,
        notes=notes
    )
    
    db.session.add(new_log)
    db.session.commit()
    
    flash(f'Registro guardado: {weight:.1f} kg', 'success')
    return redirect(url_for('index'))

@app.route('/history')
@login_required
def history():
    edit_id = request.args.get('edit', type=int)
    edit_log = None
    
    if edit_id:
        # Load specific log for editing, ensuring it belongs to current user
        edit_log = WeightLog.query.filter_by(id=edit_id, user_id=current_user.id).first()
        if not edit_log:
            flash('No se encontró el registro solicitado o no tienes permiso para editarlo.', 'error')
            return redirect(url_for('history'))

    # Load all logs sorted by date descending (newest first)
    logs = WeightLog.query.filter_by(user_id=current_user.id).order_by(WeightLog.date.desc(), WeightLog.created_at.desc()).all()
    return render_template('history.html', logs=logs, edit_log=edit_log)

@app.route('/weight/edit/<int:log_id>', methods=['POST'])
@login_required
def edit_weight(log_id):
    log = WeightLog.query.filter_by(id=log_id, user_id=current_user.id).first()
    if not log:
        flash('Registro no encontrado o sin autorización.', 'error')
        return redirect(url_for('history'))
        
    weight_raw = request.form.get('weight')
    notes = request.form.get('notes')
    custom_date_str = request.form.get('custom_date')
    custom_time_str = request.form.get('custom_time')
    
    weight = parse_weight_input(weight_raw)
    if weight is None:
        flash('Peso modificado no válido. Inténtalo de nuevo.', 'error')
        return redirect(url_for('history', edit=log_id))
        
    # Parse date/time
    if custom_date_str and custom_time_str:
        try:
            local_date = datetime.strptime(f"{custom_date_str} {custom_time_str}", "%Y-%m-%d %H:%M")
            log.date = local_date.replace(tzinfo=COLOMBIA_TZ).astimezone(timezone.utc).replace(tzinfo=None)
        except ValueError:
            flash('Error en el formato de fecha/hora.', 'error')
            return redirect(url_for('history', edit=log_id))
            
    log.weight = weight
    log.notes = notes
    db.session.commit()
    
    flash('Registro actualizado correctamente.', 'success')
    return redirect(url_for('history'))

@app.route('/weight/delete/<int:log_id>', methods=['POST'])
@login_required
def delete_weight(log_id):
    log = WeightLog.query.filter_by(id=log_id, user_id=current_user.id).first()
    if not log:
        flash('Registro no encontrado o sin autorización.', 'error')
        return redirect(url_for('history'))
        
    db.session.delete(log)
    db.session.commit()
    
    flash('El peso ha sido eliminado.', 'success')
    return redirect(url_for('history'))

@app.route('/profile', methods=['GET', 'POST'])
@login_required
def profile():
    if request.method == 'POST':
        age_raw = request.form.get('age')
        gender = request.form.get('gender')
        height_raw = request.form.get('height')
        
        try:
            current_user.age = int(age_raw) if age_raw else None
        except ValueError:
            flash('La edad debe ser un número entero.', 'error')
            return redirect(url_for('profile'))
            
        current_user.gender = gender if gender in ['Masculino', 'Femenino', 'Otro'] else None
        
        try:
            current_user.height = float(height_raw) if height_raw else None
        except ValueError:
            flash('La altura debe ser un número decimal/entero.', 'error')
            return redirect(url_for('profile'))
            
        db.session.commit()
        flash('Datos de perfil actualizados con éxito.', 'success')
        return redirect(url_for('index'))
        
    return render_template('profile.html')

@app.route('/export')
@login_required
def export_csv():
    # Load all logs sorted chronologically
    logs = WeightLog.query.filter_by(user_id=current_user.id).order_by(WeightLog.date.asc()).all()
    
    # Generate CSV in memory
    output = io.StringIO()
    writer = csv.writer(output)
    
    # Header
    writer.writerow(['Fecha y Hora', 'Peso (kg)', 'Notas'])
    
    # Rows
    for log in logs:
        writer.writerow([
            log.local_date.strftime('%Y-%m-%d %H:%M:%S'),
            f"{log.weight:.1f}",
            log.notes or ''
        ])
        
    # Return as response attachment
    output.seek(0)
    return Response(
        output.getvalue(),
        mimetype="text/csv",
        headers={"Content-disposition": f"attachment; filename=historial_peso_{current_user.name or 'usuario'}.csv"}
    )

# --- App Init Hook ---

with app.app_context():
    import time
    # Retry database connection on startup (e.g. waiting for MySQL to boot)
    retries = 10
    connected = False
    while retries > 0:
        try:
            db.create_all()
            connected = True
            break
        except Exception as e:
            retries -= 1
            print(f"Error connecting to database: {e}")
            print(f"Database not ready yet. Retrying in 3 seconds... ({retries} retries left)")
            time.sleep(3)
    if not connected:
        print("Could not connect to database after several attempts. Exiting.")

if __name__ == '__main__':
    # Bind to 0.0.0.0 for easier mobile devices testing on local Wi-Fi
    app.run(host='0.0.0.0', port=5000, debug=True)
