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
let accounts = [];
let persons = [];

// --- Authentication ---
function signup() {
  const email = document.getElementById("username").value;
  const password = document.getElementById("password").value;
  auth.createUserWithEmailAndPassword(email, password)
    .then(() => alert("User registered successfully!"))
    .catch(error => alert(error.message));
}

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
    .catch(error => alert(error.message));
}

function logout() {
  auth.signOut().then(() => {
    currentUser = null;
    document.getElementById("login-section").style.display = "block";
    document.getElementById("ledger-section").style.display = "none";
  });
}

// --- Items helper ---
function addItemRow() {
  const container = document.getElementById("items-container");
  const row = document.createElement("div");
  row.className = "item-row";
  row.innerHTML = `
    <input type="text" class="item-name" placeholder="Item name">
    <input type="number" step="0.01" class="item-unit-price" placeholder="Price per unit (optional)">
    <input type="number" step="0.01" class="item-total-price" placeholder="Total price (optional)">
  `;
  container.appendChild(row);
}

// --- Ledger ---
function addEntry() {
  if (!currentUser) return;

  const type = document.getElementById("type").value;
  const account = document.getElementById("account").value.trim();
  const datetime = document.getElementById("datetime").value;
  const person = document.getElementById("person").value.trim();
  const store = document.getElementById("store").value.trim();
  const category = document.getElementById("category").value.trim();

  if (!type || !account || !datetime) {
    alert("Type, account, and date/time are required.");
    return;
  }

  // Add new account/person to lists if not already present
  if (account && !accounts.includes(account)) {
    accounts.push(account);
    updateDatalist("account-list", accounts);
  }
  if (person && !persons.includes(person)) {
    persons.push(person);
    updateDatalist("person-list", persons);
  }

  // Collect items
  const itemRows = document.querySelectorAll("#items-container .item-row");
  const items = [];
  itemRows.forEach(row => {
    const name = row.querySelector(".item-name").value.trim();
    const unitPrice = row.querySelector(".item-unit-price").value;
    const totalPrice = row.querySelector(".item-total-price").value;
    if (name) {
      items.push({
        name,
        unitPrice: unitPrice || null,
        totalPrice: totalPrice || null
      });
    }
  });

  db.collection("ledgers").doc(currentUser.uid).collection("entries").add({
    type,
    account,
    datetime,
    person,
    store,
    category,
    items,
    timestamp: firebase.firestore.FieldValue.serverTimestamp()
  }).then(() => {
    document.getElementById("transaction-form").reset();
    // Reset items section to a single blank row
    document.getElementById("items-container").innerHTML = `
      <div class="item-row">
        <input type="text" class="item-name" placeholder="Item name">
        <input type="number" step="0.01" class="item-unit-price" placeholder="Price per unit (optional)">
        <input type="number" step="0.01" class="item-total-price" placeholder="Total price (optional)">
      </div>
    `;
  });
}

function updateDatalist(id, values) {
  const datalist = document.getElementById(id);
  datalist.innerHTML = "";
  values.forEach(v => {
    const option = document.createElement("option");
    option.value = v;
    datalist.appendChild(option);
  });
}

function loadLedger(userId) {
  const list = document.getElementById("ledger-list");
  list.innerHTML = "";
  db.collection("ledgers").doc(userId).collection("entries")
    .orderBy("timestamp")
    .onSnapshot(snapshot => {
      list.innerHTML = "";
      snapshot.forEach(doc => {
        const data = doc.data();
        const li = document.createElement("li");

        // Format items
        let itemText = "";
        if (data.items && data.items.length) {
          itemText = data.items.map(i =>
            `${i.name}${i.unitPrice ? ` @ ${i.unitPrice}` : ""}${i.totalPrice ? ` = ${i.totalPrice}` : ""}`
          ).join(", ");
        }

        li.textContent = `${data.type} | ${data.account} | ${data.person || ""} | ${data.store || ""} | ${data.category || ""} | ${itemText} | ${data.datetime}`;
        list.appendChild(li);
      });
    });
}