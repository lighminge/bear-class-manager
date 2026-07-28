import { initializeApp } from "firebase/app";
import { getAuth, signInAnonymously, onAuthStateChanged } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { initializeAppCheck, ReCaptchaV3Provider } from "firebase/app-check";

// 系統變數 (強制綁定專案資料庫)
const firebaseConfig = {
  apiKey: "AIzaSyC0jlWhJ-9J969SuuHt3uZVaHJaoOXTMus",
  authDomain: "github-class-info.firebaseapp.com",
  projectId: "github-class-info",
  storageBucket: "github-class-info.firebasestorage.app",
  messagingSenderId: "875585105725",
  appId: "1:875585105725:web:9d2c3ffc03f4e9b2fbdf54",
  measurementId: "G-HM8WZTSBVN"
};

const app = initializeApp(firebaseConfig);

// 🛡️ reCAPTCHA v3 (Firebase App Check) 安全設定 🛡️
const recaptchaSiteKey = "6Lemz84sAAAAANdzXXLXB5IDIikNbII4BQDQebCY"; 

let globalAppCheck = null;

if (typeof window !== "undefined") {
  globalAppCheck = initializeAppCheck(app, {
    provider: new ReCaptchaV3Provider(recaptchaSiteKey),
    isTokenAutoRefreshEnabled: true
  });
}

const auth = getAuth(app);
const db = getFirestore(app);

export { app, auth, db, signInAnonymously, onAuthStateChanged };
