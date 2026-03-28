const admin = require('firebase-admin');
const CryptoJS = require('crypto-js');
require('dotenv').config();

// Initialize Firebase with only the database URL (Realtime Database)
// Since we don't have service account JSON, we'll use public access if allowed, 
// or the user might have set up rules. In a real scenario, we'd need credentials.
// For this sandbox, we'll try to initialize with the URL.
if (!admin.apps.length) {
    admin.initializeApp({
        databaseURL: process.env.FIREBASE_DATABASE_URL
    });
}

const db = admin.database();
const encryptionKey = process.env.ENCRYPTION_KEY || 'default_secret';

const encrypt = (text) => {
    return CryptoJS.AES.encrypt(text, encryptionKey).toString();
};

const decrypt = (ciphertext) => {
    const bytes = CryptoJS.AES.decrypt(ciphertext, encryptionKey);
    return bytes.toString(CryptoJS.enc.Utf8);
};

const getUser = async (userId) => {
    const snapshot = await db.ref(`users/${userId}`).once('value');
    return snapshot.val() || {
        userId,
        messageCount: 0,
        connectors: {},
        aiConfig: { type: 'default' },
        setupStep: null
    };
};

const saveUser = async (userId, data) => {
    await db.ref(`users/${userId}`).update(data);
};

const saveConnector = async (userId, connector, apiKey) => {
    const encryptedKey = encrypt(apiKey);
    await db.ref(`users/${userId}/connectors/${connector}`).set(encryptedKey);
};

const getConnector = async (userId, connector) => {
    const snapshot = await db.ref(`users/${userId}/connectors/${connector}`).once('value');
    const encryptedKey = snapshot.val();
    return encryptedKey ? decrypt(encryptedKey) : null;
};

module.exports = {
    getUser,
    saveUser,
    saveConnector,
    getConnector,
    encrypt,
    decrypt
};
