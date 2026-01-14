import firebase_admin
from firebase_admin import credentials, firestore, auth

cred = credentials.Certificate('homewise-77-firebase-adminsdk-fbsvc-afe24f499a.json')
try:
    firebase_admin.initialize_app(cred)
except ValueError:
    pass  # Ya inicializado

db = firestore.client()

# Crear usuario en Firebase Auth
user = auth.create_user(
    email='rubn70@gmail.com',
    password='Kolbi200',
    display_name='Usuario de Prueba',
    disabled=False
)

# Crear perfil en Firestore
profile = {
    'email': 'rubn70@gmail.com',
    'nombre': 'Usuario de Prueba',
    'admin': False
}
db.collection('users').document('rubn70@gmail.com').set(profile)
print('Usuario creado y perfil guardado.')
