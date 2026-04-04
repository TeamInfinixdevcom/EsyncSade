// Script para crear un usuario en Firebase Auth usando firebase-admin (CommonJS)
const admin = require('firebase-admin');
const serviceAccount = require('./homewise-77-firebase-adminsdk-fbsvc-afe24f499a.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const email = 'cobandoa@ice.go.cr';
const password = 'Kolbi200';

admin.auth().createUser({
  email,
  password
})
  .then((userRecord) => {
    console.log('Usuario creado exitosamente:', userRecord.uid);
  })
  .catch((error) => {
    console.error('Error al crear el usuario:', error);
  });
