// --- Firebase Initialization ---
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyB4FZpY8sSdAzOkwju1D9K0zVVEEOIChJg",
  authDomain: "xiaoxin-s-ledger-app.firebaseapp.com",
  projectId: "xiaoxin-s-ledger-app",
  storageBucket: "xiaoxin-s-ledger-app.firebasestorage.app",
  messagingSenderId: "492104644894",
  appId: "1:492104644894:web:985a1fb62f56c92bf0310f",
  measurementId: "G-92YC1R2E84"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

// Get references to services
const auth = firebase.auth();
const db = firebase.firestore();

let currentUser = null;

// --- Authentication Functions ---

// Sign up new user
function signup() {
  const email = document.getElementById("username").value;
  const password = document.getElementById("password").value;

  auth.createUserWithEmailAndPassword(email, password)
    .then(userCredential => {
      alert("User registered successfully!");
    })
    .catch(error => {
      alert(error.message);
    });
}

// Login existing user
function login() {
  const email = document.getElementById("username").value;
  const password = document.getElementById("password").value;

  auth.signInWithEmailAndPassword(email, password)
    .then(userCredential => {
      currentUser = userCredential.user;
      document.getElementById("login-section").style.display = "none";
      document.getElementById("ledger-section").style.display = "block";
      document.getElementById("welcome").textContent = `Welcome, ${currentUser.email}`;
      loadLedger(currentUser.uid);
    })
    .catch(error => {
      alert(error.message);
    });
}

// Logout
function logout() {
  auth.signOut().then(() => {
    currentUser = null;
    document.getElementById("login-section").style.display = "block";
    document.getElementById("ledger-section").style.display = "none";
  });
}

// --- Ledger Functions ---

// Add entry to Firestore
function addEntry() {
  const entry = document.getElementById("entry").value;
  if (entry && currentUser) {
    db.collection("ledgers").doc(currentUser.uid).collection("entries").add({
      text: entry,
      timestamp: firebase.firestore.FieldValue.serverTimestamp()
    }).then(() => {
      document.getElementById("entry").value = "";
    });
  }
}

// Load entries from Firestore
function loadLedger(userId) {
  const list = document.getElementById("ledger-list");
  list.innerHTML = "";
  db.collection("ledgers").doc(userId).collection("entries")
    .orderBy("timestamp")
    .onSnapshot(snapshot => {
      list.innerHTML = "";
      snapshot.forEach(doc => {
        const li = document.createElement("li");
        li.textContent = doc.data().text;
        list.appendChild(li);
      });
    });
}
