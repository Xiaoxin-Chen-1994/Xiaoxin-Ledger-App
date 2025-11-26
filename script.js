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
let currentLang = 'zh';
let accounts = [];
let persons = [];

// --- Authentication ---
function signup() {
  const email = document.getElementById("username").value;
  const password = document.getElementById("password").value;

  firebase.auth().createUserWithEmailAndPassword(email, password)
    .then(cred => {
      const user = cred.user;
      const householdId = user.uid; // personal household id

      // Create household
      firebase.firestore().collection("households").doc(householdId).set({
        name: `${email}的账本`,
        admin: user.uid,
        members: [user.uid]
      });

      // Create user doc
      firebase.firestore().collection("users").doc(user.uid).set({
        email: email,
        personalHouseholdId: householdId,
        households: [householdId]
      });
    })
    .catch(error => showStatusMessage(error.message, 'error'));
}

function loadHouseholds(userUid) {
  firebase.firestore().collection("users").doc(userUid).get().then(doc => {
    if (!doc.exists) return;
    const data = doc.data();
    const select = document.getElementById("household-select");
    select.innerHTML = "";

    data.households.forEach(hid => {
      firebase.firestore().collection("households").doc(hid).get().then(hdoc => {
        if (hdoc.exists) {
          const opt = document.createElement("option");
          opt.value = hid;
          opt.textContent = hdoc.data().name;
          select.appendChild(opt);
        }
      });
    });
  });
}

function showHouseholds(userUid) {
  const list = document.getElementById("household-list");
  list.innerHTML = "";

  db.collection("users").doc(userUid).get().then(doc => {
    if (!doc.exists) return;
    const data = doc.data();

    data.households.forEach(hid => {
      db.collection("households").doc(hid).get().then(hdoc => {
        if (hdoc.exists) {
          const li = document.createElement("li");
          const hdata = hdoc.data();
          li.textContent = hdata.name;

          // Leave button (disabled for personal household)
          if (hdata.admin !== userUid) {
            const btn = document.createElement("button");
            btn.textContent = "退出 / Leave";
            btn.className = "secondary";
            btn.onclick = () => leaveHousehold(hid, userUid);
            li.appendChild(btn);
          } else {
            const span = document.createElement("span");
            span.textContent = " (个人账本)";
            li.appendChild(span);
          }

          list.appendChild(li);
        }
      });
    });
  });
}


function login() {
  const email = document.getElementById("username").value;
  const password = document.getElementById("password").value;
  auth.signInWithEmailAndPassword(email, password)
    .catch(error => showStatusMessage(error.message, 'error'));
}

function logout() {
  auth.signOut();
}

// --- Persistent login state ---
auth.onAuthStateChanged(user => {
  if (user) {
    loadHouseholds(user.uid);
    showHouseholds(user.uid);
    
    currentUser = user;
    document.getElementById("login-section").style.display = "none";
    document.getElementById("login-lang-switch").style.display = "none";
    document.querySelector(".bottom-nav").style.display = "flex";
    document.getElementById("settings-welcome").textContent =
      `${translations[currentLang].welcome}, ${currentUser.email}`;

    db.collection("users").doc(user.uid).get().then(doc => {
      if (doc.exists) {
        const data = doc.data();
        if (data.homeImageUrl) {
          const img = document.getElementById("home-image");
          img.src = data.homeImageUrl;
          img.style.display = "block";
        }
        if (data.colorScheme) {
          setColorScheme(data.colorScheme);
          document.getElementById("color-scheme-select").value = data.colorScheme;
        }
        if (data.language) {
          currentLang = data.language;  
        }
        setLanguage(currentLang);
      }
    });


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
    document.getElementById("settings-welcome").textContent = "";
  }
});

// --- Items helper ---
function addItemRow() {
  const container = document.getElementById("items-container");
  const row = document.createElement("div");
  row.className = "item-row";
  row.innerHTML = `
    <input type="text" class="item-name" placeholder="项目名称">
    <input type="text" class="item-notes" placeholder="价格">
  `;
  container.appendChild(row);
}

// --- Ledger add entry ---
function addEntry() {
  if (!currentUser) return;

  // Household selector dropdown
  const householdId = document.getElementById("household-select").value;
  if (!householdId) {
    showStatus("请选择账本 / Please select a household");
    return;
  }

  const type = document.getElementById("type").value;
  const account = document.getElementById("account").value.trim();
  const datetime = document.getElementById("datetime-display").textContent; // use textContent if you display formatted date
  const person = document.getElementById("person").value.trim();
  const store = document.getElementById("store").value.trim();
  const category = document.getElementById("category").value.trim();

  // Update datalists
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
    const notes = row.querySelector(".item-notes").value;
    if (name) {
      items.push({
        name,
        notes: notes || null
      });
    }
  });

  // 🔑 Store transaction under selected household
  db.collection("households").doc(householdId).collection("transactions").add({
    type,
    account,
    datetime,
    person,
    store,
    category,
    items,
    createdBy: currentUser.uid,
    timestamp: firebase.firestore.FieldValue.serverTimestamp()
  }).then(() => {
    // Reset form
    document.getElementById("transaction-form").reset();
    document.getElementById("items-container").innerHTML = `
      <div class="item-row">
        <input type="text" class="item-name" placeholder="项目名称">
        <input type="text" class="item-notes" placeholder="价格">
      </div>
    `;
    updateHomeKanban(householdId); // pass householdId so kanban updates for that household
  }).catch(err => {
    console.error("Error adding transaction:", err);
    showStatus("添加交易失败");
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
    showStatusMessage("账户 page placeholder", 'info');
  } else if (page === "charts") {
    showStatusMessage("图表 page placeholder", 'info');
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
    datetime: "Time",
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
    datetime: "时间",
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

function setLanguage(lang, showMessage = false) {
  currentLang = lang;
  const t = translations[lang];

  // Login text
  document.getElementById("login-title").textContent = t.loginTitle;
  document.getElementById("username").placeholder = t.email;
  document.getElementById("password").placeholder = t.password;
  document.getElementById("signup-btn").textContent = t.signup;
  document.getElementById("login-btn").textContent = t.login;

  // Home text
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

  if (currentUser) {
    db.collection("users").doc(currentUser.uid).set({
      language: lang
    }, { merge: true });
  }

  // Only show message if explicitly requested
  if (showMessage) {
    if (lang === "en") {
      showStatusMessage("Language set to English", "success");
    } else if (lang === "zh") {
      showStatusMessage("语言已切换为 中文", "success");
    }
  }
}

const storage = firebase.storage();

async function uploadHomeImage(file) {
  if (!currentUser) return;

  // Create a storage ref under the user’s folder
  const storageRef = storage.ref(`users/${currentUser.uid}/homeImage.jpg`);

  // Upload file
  await storageRef.put(file);

  // Get download URL
  const url = await storageRef.getDownloadURL();

  // Save URL in Firestore under user settings
  await db.collection("users").doc(currentUser.uid).set({
    homeImageUrl: url
  }, { merge: true });

  // Show status message
  if (currentLang === "en") {
    showStatusMessage("User image has been uploaded to database", 'success');
  } else if (currentLang === "zh") {
    showStatusMessage("图片已成功上传至数据库", "success");
  }

  // Update UI
  const img = document.getElementById("home-image");
  img.src = url;
  img.style.display = "block";
}


// --- Home: image preview ---
function previewHomeImage(event) {
  const file = event.target.files[0];
  if (file) {
    uploadHomeImage(file);
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
        .reduce((a, b) => a + b, 0);
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
function setColorScheme(scheme, showMessage = false) {
  if (scheme === "alt") {
    document.documentElement.classList.add("alt-scheme");
  } else {
    document.documentElement.classList.remove("alt-scheme");
  }
  if (currentUser) {
    db.collection("users").doc(currentUser.uid).set({
      colorScheme: scheme
    }, { merge: true });
  }

  // Only show message if explicitly requested
  if (showMessage) {
    if (currentLang === "en") {
      showStatusMessage("Color scheme is now changed", 'success');
    } else if (currentLang === "zh") {
      showStatusMessage("颜色方案已更新", "success");
    }
  }
}

function joinHousehold(householdId, userUid) {
  firebase.firestore().collection("households").doc(householdId).update({
    members: firebase.firestore.FieldValue.arrayUnion(userUid)
  });
  firebase.firestore().collection("users").doc(userUid).update({
    households: firebase.firestore.FieldValue.arrayUnion(householdId)
  });
}

function leaveHousehold(householdId, userUid) {
  db.collection("households").doc(householdId).get().then(doc => {
    if (doc.exists && doc.data().admin === userUid) {
      showStatus("不能退出个人账本 / Cannot leave personal household");
      return;
    }
    doc.ref.update({
      members: firebase.firestore.FieldValue.arrayRemove(userUid)
    });
    db.collection("users").doc(userUid).update({
      households: firebase.firestore.FieldValue.arrayRemove(householdId)
    }).then(() => {
      showStatus("已退出该账本 / Left household");
      showHouseholds(userUid); // refresh list
    });
  });
}


function showStatusMessage(message, type = 'info', duration = 2000) {
  const status = document.getElementById('statusMessage');
  status.textContent = message;
  status.style.display = 'inline-block';

  // Reset styles
  status.style.backgroundColor = '';
  status.style.color = '';

  // Apply color based on type
  switch (type) {
    case 'success':
      status.style.color = 'green';
      break;
    case 'error':
      status.style.color = '#B22222';
      break;
    default: // 'info'
      status.style.color = '';
      break;
  }

  setTimeout(() => {
    status.style.display = 'none';
  }, duration);

}

const selector = document.getElementById("datetime-selector");
const dateBtn = document.getElementById("datetime-display");
const hideBtn = document.getElementById("hide-datetime");

// Toggle on date button click
dateBtn.addEventListener("click", (e) => {
  e.stopPropagation(); // don't trigger outside click handlers
  const isOpen = selector.style.display === "flex";
  selector.style.display = isOpen ? "none" : "flex";
});

// Hide with ▼ button
hideBtn.addEventListener("click", (e) => {
  e.stopPropagation();
  selector.style.display = "none";
});

// Prevent clicks inside the selector from closing it
selector.addEventListener("click", (e) => {
  e.stopPropagation();
});

// Clicking anywhere else (inputs, buttons, body) hides the selector
document.addEventListener("click", () => {
  selector.style.display = "none";
});

// Optional: focusing other inputs also hides it
document.querySelectorAll("input, select, textarea, button:not(#datetime-display)").forEach(el => {
  el.addEventListener("focus", () => {
    selector.style.display = "none";
  });
});


let selected = {};

// Update display with prefix
function updateDateTimeDisplay(date = new Date(selected.year, selected.month - 1, selected.day, selected.hour, selected.minute)) {
  const display = document.getElementById("datetime-display");
  if (!display) return;

  const now = new Date();
  const selectedDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const todayDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diffDays = Math.round((selectedDate - todayDate) / (1000 * 60 * 60 * 24));

  let prefix = "";
  switch (diffDays) {
    case -2: prefix = "前天 "; break;
    case -1: prefix = "昨天 "; break;
    case 0:  prefix = "今天 "; break;
    case 1:  prefix = "明天 "; break;
    case 2:  prefix = "后天 "; break;
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');

  display.textContent = `${prefix}${year}-${month}-${day} ${hours}:${minutes}`;
}

// Generic scroll column
function createScrollColumn(id, values, selectedVal, unit, onSelect) {
  const container = document.getElementById(id);
  container.innerHTML = "";
  values.forEach(val => {
    const item = document.createElement("div");
    item.textContent = `${val}${unit}`;
    item.className = val === selectedVal ? "selected" : "";
    item.onclick = () => {
      container.querySelectorAll("div").forEach(d => d.classList.remove("selected"));
      item.classList.add("selected");
      onSelect(val);
      updateDateTimeDisplay();
    };
    container.appendChild(item);
  });
}

// Circular day column
function createCircularDayColumn(selectedDay) {
  const container = document.getElementById("day-column");
  container.innerHTML = "";

  const days = Array.from({length: 31}, (_, i) => i + 1);
  const repeated = [...days, ...days, ...days]; // 3x loop

  repeated.forEach(day => {
    const div = document.createElement("div");
    div.textContent = `${day}日`;
    div.dataset.day = day;
    if (day === selectedDay) div.classList.add("selected");
    container.appendChild(div);
  });

  // Scroll to middle set
  const itemHeight = 24; // adjust to your CSS line-height
  container.scrollTop = days.length * itemHeight;

  container.addEventListener("scroll", () => {
    const maxScroll = container.scrollHeight - container.clientHeight;
    const threshold = itemHeight * 5;

    if (container.scrollTop < threshold) {
      container.scrollTop += days.length * itemHeight;
    } else if (container.scrollTop > maxScroll - threshold) {
      container.scrollTop -= days.length * itemHeight;
    }

    highlightDayFromScroll();
  });
}

function highlightDayFromScroll() {
  const container = document.getElementById("day-column");
  const itemHeight = 24;
  const index = Math.round(container.scrollTop / itemHeight);
  const items = container.querySelectorAll("div");
  items.forEach(d => d.classList.remove("selected"));

  const selectedItem = items[index];
  if (selectedItem) {
    selectedItem.classList.add("selected");
    selected.day = parseInt(selectedItem.dataset.day);
    updateDateTimeDisplay();
  }
}

// Populate all selectors
function populateDateTimeSelectors() {
  const now = new Date();
  selected = {
    year: now.getFullYear(),
    month: now.getMonth() + 1,
    day: now.getDate(),
    hour: now.getHours(),
    minute: now.getMinutes()
  };

  createScrollColumn("year-column", Array.from({length: 9}, (_, i) => now.getFullYear() - 2 + i), selected.year, "年", val => selected.year = val);
  createScrollColumn("month-column", Array.from({length: 12}, (_, i) => i + 1), selected.month, "月", val => selected.month = val);
  createCircularDayColumn(selected.day); // looped day column
  createScrollColumn("hour-column", Array.from({length: 24}, (_, i) => i), selected.hour, "时", val => selected.hour = val);
  createScrollColumn("minute-column", Array.from({length: 60}, (_, i) => i), selected.minute, "分", val => selected.minute = val);

  updateDateTimeDisplay();
}

// Initialize
window.addEventListener("DOMContentLoaded", () => {
  populateDateTimeSelectors();
});
