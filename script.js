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
    .then(() => alert("注册成功"))
    .catch(error => alert(error.message));
}

function login() {
  const email = document.getElementById("username").value;
  const password = document.getElementById("password").value;
  auth.signInWithEmailAndPassword(email, password)
    .catch(error => alert(error.message));
}

function logout() {
  auth.signOut();
}

// --- Persistent login state ---
auth.onAuthStateChanged(user => {
  if (user) {
    currentUser = user;
    document.getElementById("login-section").style.display = "none";
    document.querySelector(".bottom-nav").style.display = "flex";
    document.getElementById("welcome").textContent =
      `${translations[currentLang].welcome}, ${currentUser.email}`;
    showPage("home", document.getElementById("nav-home"));
    loadLedger(currentUser.uid);
    updateHomeKanban();
  } else {
    currentUser = null;
    document.getElementById("login-section").style.display = "block";
    document.getElementById("home-section").style.display = "none";
    document.getElementById("ledger-section").style.display = "none";
    document.getElementById("settings-section").style.display = "none";
    document.querySelector(".bottom-nav").style.display = "none";
  }
});

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

// --- Ledger add entry ---
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

  if (account && !accounts.includes(account)) {
    accounts.push(account);
    updateDatalist("account-list", accounts);
  }
  if (person && !persons.includes(person)) {
    persons.push(person);
    updateDatalist("person-list", persons);
  }

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
    document.getElementById("items-container").innerHTML = `
      <div class="item-row">
        <input type="text" class="item-name" placeholder="项目名称">
        <input type="number" step="0.01" class="item-unit-price" placeholder="单价 (可选)">
        <input type="number" step="0.01" class="item-total-price" placeholder="总价 (可选)">
      </div>
    `;
    updateHomeKanban();
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
      let latest = null;
      snapshot.forEach(doc => {
        const data = doc.data();
        const li = document.createElement("li");
        li.textContent = `${data.type} | ${data.account} | ${data.person || ""} | ${data.store || ""} | ${data.category || ""} | ${data.datetime}`;
        list.appendChild(li);
        latest = data;
      });
      if (latest) {
        document.getElementById("today-sub").textContent = formatLatest(latest);
      } else {
        document.getElementById("today-sub").textContent = "暂无交易";
      }
      updateHomeKanban();
    });
}

function formatLatest(data) {
  const typeLabel = data.type === "incoming" ? "收入"
                    : data.type === "outgoing" ? "支出"
                    : "转账";
  return `${typeLabel} | ${data.account} | ${data.store || ""} | ${data.datetime || ""}`.trim();
}

// --- Navigation ---
function showPage(page, clickedButton) {
  document.getElementById("login-section").style.display = "none";
  document.getElementById("home-section").style.display = "none";
  document.getElementById("ledger-section").style.display = "none";
  document.getElementById("settings-section").style.display = "none";

  if (page === "transaction") {
    document.getElementById("ledger-section").style.display = "block";
  } else if (page === "home") {
    document.getElementById("home-section").style.display = "block";
  } else if (page === "accounts") {
    alert("账户 page placeholder");
  } else if (page === "charts") {
    alert("图表 page placeholder");
  } else if (page === "settings") {
    document.getElementById("settings-section").style.display = "block";
  }

  const buttons = document.querySelectorAll(".bottom-nav button");
  buttons.forEach(btn => btn.classList.remove("active"));
  if (clickedButton) clickedButton.classList.add("active");
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
    homeTitle: "Home",
    monthBalance: "Nov · Balance",
    incomeMinusExpense: "Income - Expense",
    monthlySummary: "Income this month 0 | Expense this month 0",
    today: "Today",
    thisMonth: "This Month",
    thisYear: "This Year",
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
    homeTitle: "首页",
    monthBalance: "11月·结余",
    incomeMinusExpense: "收入 - 支出",
    monthlySummary: "本月收入 0 | 本月支出 0",
    today: "今天",
    thisMonth: "本月",
    thisYear: "本年",
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

let currentLang = "zh";

function setLanguage(lang) {
  currentLang = lang;
  const t = translations[lang];

  // Login text
  document.getElementById("login-title").textContent = t.loginTitle;
  document.getElementById("username").placeholder = t.email;
  document.getElementById("password").placeholder = t.password;
  document.getElementById("signup-btn").textContent = t.signup;
  document.getElementById("login-btn").textContent = t.login;

  // Home text
  document.getElementById("home-title").textContent = t.homeTitle;
  document.getElementById("home-month").textContent = t.monthBalance;
  document.getElementById("home-balance").textContent = t.incomeMinusExpense;
  document.getElementById("home-summary").textContent = t.monthlySummary;

  document.getElementById("kanban-today-title").textContent = t.today;
  document.getElementById("kanban-month-title").textContent = t.thisMonth;
  document.getElementById("kanban-year-title").textContent = t.thisYear;

  // Ledger labels
  document.getElementById("label-type").textContent = t.type;
  document.getElementById("label-account").textContent = t.account;
  document.getElementById("label-datetime").textContent = t.datetime;
  document.getElementById("label-person").textContent = t.person;
  document.getElementById("label-store").textContent = t.store;
  document.getElementById("label-category").textContent = t.category;
  document.getElementById("label-items").textContent = t.items;

  // Buttons
  document.getElementById("add-item-btn").textContent = t.addItem;
  document.getElementById("add-transaction-btn").textContent = t.addTransaction;
  document.getElementById("logout-btn").textContent = t.logout;

  // Nav
  document.getElementById("nav-home").textContent = t.navHome;
  document.getElementById("nav-accounts").textContent = t.navAccounts;
  document.getElementById("nav-transaction").textContent = t.navTransaction;
  document.getElementById("nav-charts").textContent = t.navCharts;
  document.getElementById("nav-settings").textContent = t.navSettings;
}

// --- Home: image preview ---
function previewHomeImage(event) {
  const file = event.target.files[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = e => {
      const img = document.getElementById("home-image");
      img.src = e.target.result;
      img.style.display = "block";
    };
    reader.readAsDataURL(file);
  }
}

// Right-click triggers upload
function triggerHomeUpload(event) {
  event.preventDefault();
  document.getElementById("home-image-upload").click();
}

// Long press (hold) triggers upload
let holdTimer;
function handleHold(event) {
  if (event.button === 0) { // left mouse or touch
    holdTimer = setTimeout(() => {
      document.getElementById("home-image-upload").click();
    }, 800);
  }
}
document.addEventListener("mouseup", () => clearTimeout(holdTimer));
document.addEventListener("touchend", () => clearTimeout(holdTimer));

// --- Home: Kanban summaries ---
async function updateHomeKanban() {
  if (!currentUser) return;
  const entriesSnap = await db.collection("ledgers").doc(currentUser.uid).collection("entries").get();
  const entries = entriesSnap.docs.map(d => d.data());

  const sumBy = (filterFn) => {
    let income = 0, expense = 0;
    entries.filter(filterFn).forEach(e => {
      const total = (e.items || [])
        .map(i => parseFloat(i.totalPrice))
        .filter(v => !isNaN(v))
        .reduce((a,b)=>a+b,0);
      if (e.type === "incoming") income += total;
      if (e.type === "outgoing") expense += total;
    });
    return { income, expense };
  };

  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const startOfDay = new Date(y, m, now.getDate(), 0, 0, 0);
  const endOfDay = new Date(y, m, now.getDate(), 23, 59, 59);
  const startOfMonth = new Date(y, m, 1, 0, 0, 0);
  const endOfMonth = new Date(y, m + 1, 0, 23, 59, 59);
  const startOfYear = new Date(y, 0, 1, 0, 0, 0);
  const endOfYear = new Date(y, 11, 31, 23, 59, 59);

  const parseEntryDate = (e) => e.datetime ? new Date(e.datetime) : null;
  const inRange = (date, start, end) => date && date >= start && date <= end;

  const todaySums = sumBy(e => inRange(parseEntryDate(e), startOfDay, endOfDay));
  const monthSums = sumBy(e => inRange(parseEntryDate(e), startOfMonth, endOfMonth));
  const yearSums = sumBy(e => inRange(parseEntryDate(e), startOfYear, endOfYear));

  const monthLabel = `${m + 1}月·结余`;
  document.getElementById("home-month").textContent = monthLabel;
  document.getElementById("home-summary").textContent =
    `本月收入 ${monthSums.income.toFixed(2)} | 本月支出 ${monthSums.expense.toFixed(2)}`;
  document.getElementById("home-balance").textContent =
    `${(monthSums.income - monthSums.expense).toFixed(2)}`;

  document.getElementById("month-sub").textContent =
    `${m + 1}月 1日–${new Date(y, m + 1, 0).getDate()}日`;
  document.getElementById("year-sub").textContent = `${y}`;

  document.getElementById("today-income").textContent = `收入 ${todaySums.income.toFixed(2)}`;
  document.getElementById("today-expense").textContent = `支出 ${todaySums.expense.toFixed(2)}`;
  document.getElementById("month-income").textContent = `收入 ${monthSums.income.toFixed(2)}`;
  document.getElementById("month-expense").textContent = `支出 ${monthSums.expense.toFixed(2)}`;
  document.getElementById("year-income").textContent = `收入 ${yearSums.income.toFixed(2)}`;
  document.getElementById("year-expense").textContent = `支出 ${yearSums.expense.toFixed(2)}`;
}

// --- Color Scheme ---
function setColorScheme(scheme) {
  if (scheme === "alt") {
    document.documentElement.classList.add("alt-scheme");
  } else {
    document.documentElement.classList.remove("alt-scheme");
  }
}

// Initial language
setLanguage('zh');
