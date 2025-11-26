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
      document.getElementById("ledger-section").style.display = "none"; // hide ledger initially
      document.querySelector(".bottom-nav").style.display = "flex"; // show nav bar

      document.getElementById("welcome").textContent =
        `${translations[currentLang].welcome}, ${currentUser.email}`;

      // Default to home page
      showPage("home");
    })
    .catch(error => alert(error.message));
}


function logout() {
  auth.signOut().then(() => {
    currentUser = null;
    document.getElementById("login-section").style.display = "block";
    document.getElementById("ledger-section").style.display = "none";
    document.querySelector(".bottom-nav").style.display = "none"; // hide nav bar
  });
}

function showPage(page) {
  // Hide all main sections
  document.getElementById("login-section").style.display = "none";
  document.getElementById("ledger-section").style.display = "none";

  if (page === "transaction") {
    document.getElementById("ledger-section").style.display = "block";
  } else if (page === "home") {
    // For now, just show a placeholder alert or create a home section
    alert("首页 page placeholder");
  } else if (page === "accounts") {
    alert("账户 page placeholder");
  } else if (page === "charts") {
    alert("图表 page placeholder");
  } else if (page === "settings") {
    alert("设置 page placeholder");
  }

  // Highlight active button
  const buttons = document.querySelectorAll(".bottom-nav button");
  buttons.forEach(btn => btn.classList.remove("active"));
  event.target.classList.add("active");
}


// --- Items helper ---
function addItemRow() {
  const container = document.getElementById("items-container");
  const row = document.createElement("div");
  row.className = "item-row";
  row.innerHTML = `
    <input type="text" class="item-name" placeholder="项目名称">
    <input type="number" step="0.01" class="item-unit-price" placeholder="单价 (可选)">
    <input type="number" step="0.01" class="item-total-price" placeholder="总价 (可选)">
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
        <input type="text" class="item-name" placeholder="项目名称">
        <input type="number" step="0.01" class="item-unit-price" placeholder="单价 (可选)">
        <input type="number" step="0.01" class="item-total-price" placeholder="总价 (可选)">
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

        li.textContent =
          `${data.type} | ${data.account} | ${data.person || ""} | ${data.store || ""} | ${data.category || ""} | ${itemText} | ${data.datetime}`;
        list.appendChild(li);
      });
    });
}

// --- Navigation ---
function showPage(page) {
  document.getElementById("login-section").style.display = "none";
  document.getElementById("ledger-section").style.display = "none";

  if (page === "transaction") {
    document.getElementById("ledger-section").style.display = "block";
  } else {
    alert(`${page} page placeholder`);
  }

  const buttons = document.querySelectorAll(".bottom-nav button");
  buttons.forEach(btn => btn.classList.remove("active"));
  event.target.classList.add("active");
}

// --- Language Switcher ---
const translations = {
  en: {
    loginTitle: "Login or Signup",
    email: "Email",
    password: "Password",
    signup: "Sign Up",
    login: "Login",
    welcome: "Welcome",
    type: "Type",
    account: "Account",
    datetime: "Date & Time",
    person: "Person",
    store: "Store Name",
    category: "Category",
    items: "Items",
    addItem: "+ Add Item",
    addTransaction: "Add Transaction",
    logout: "Logout",
    navHome: "Home",
    navAccounts: "Accounts",
    navTransaction: "Add",
    navCharts: "Charts",
    navSettings: "Settings"
  },
  zh: {
    loginTitle: "登录或注册",
    email: "邮箱",
    password: "密码",
    signup: "注册",
    login: "登录",
    welcome: "欢迎",
    type: "类型",
    account: "账户",
    datetime: "日期与时间",
    person: "相关人",
    store: "商店名称",
    category: "类别",
    items: "项目",
    addItem: "+ 添加项目",
    addTransaction: "添加交易",
    logout: "退出",
    navHome: "首页",
    navAccounts: "账户",
    navTransaction: "记一笔",
    navCharts: "图表",
    navSettings: "设置"
  }
};

let currentLang = "zh"

function setLanguage(lang) {
  currentLang = lang;
  const t = translations[lang];

  // Login section
  document.getElementById("login-title").textContent = t.loginTitle;
  document.getElementById("username").placeholder = t.email;
  document.getElementById("password").placeholder = t.password;
  document.getElementById("signup-btn").textContent = t.signup;
  document.getElementById("login-btn").textContent = t.login;

  // Ledger form labels
  document.getElementById("label-type").textContent = t.type;
  document.getElementById("label-account").textContent = t.account;
  document.getElementById("label-datetime").textContent = t.datetime;
  document.getElementById("label-person").textContent = t.person;
  document.getElementById("label-store").textContent = t.store;
  document.getElementById("label-category").textContent = t.category;
  document.getElementById("label-items").textContent = t.items;

  // Buttons inside form
  document.getElementById("add-item-btn").textContent = t.addItem;
  document.getElementById("add-transaction-btn").textContent = t.addTransaction;
  document.getElementById("logout-btn").textContent = t.logout;

  // Navigation bar
  document.getElementById("nav-home").textContent = t.navHome;
  document.getElementById("nav-accounts").textContent = t.navAccounts;
  document.getElementById("nav-transaction").textContent = t.navTransaction;
  document.getElementById("nav-charts").textContent = t.navCharts;
  document.getElementById("nav-settings").textContent = t.navSettings;
}
