// Data structure: 
// users/{userId}
//   - profile
//       email: string
//       language: string
//       homeImage: string
//   - households: [householdId]   // membership links

// households/{householdId}
//   - name: string
//   - members: [userId]           // array of user IDs

//   accounts (subcollection)
//     accounts/{accountId}
//       name: string
//       type: string ("cash" | "bank" | "credit")

//   categories (subcollection)
//     categories/{categoryId}
//       primary: string
//       secondary: [string]

//   collections (subcollection)
//     collections/{collectionId}
//       primary: string
//       secondary: [string]

//   entries (subcollection)
//     entries/{entryId}
//       type: string ("income" | "expense" | "transfer")
//       categoryId: string         // reference to categories/{categoryId}
//       collectionId: string       // reference to collections/{collectionId}
//       accountId: string          // reference to accounts/{accountId}
//       personId: string           // reference to household member
//       store: string
//       datetime: timestamp
//       items: [ { name: string, notes: string, amount: number } ]
//       amount: number
//       createdBy: string          // userId


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
let households = [];
let householdIds = [];

// --- Authentication ---
function signup() {
  const email = document.getElementById("username").value;
  const password = document.getElementById("password").value;

  firebase.auth().createUserWithEmailAndPassword(email, password)
    .then(cred => {
      const user = cred.user;
      const householdId = user.uid; // personal household id

      // Create household
      const householdName = currentLang === "en"
        ? `${email}'s Ledger`
        : `${email}的账本`;

      firebase.firestore().collection("households").doc(householdId).set({
        name: householdName,
        admin: user.uid,
        members: [user.uid]
      });

      // Create user doc
      firebase.firestore().collection("users").doc(user.uid).set({
        profile: {
          email: email,
          language: currentLang,
          homeImage: "",
          settings: {}
        },
        personalHouseholdId: householdId,
        households: [householdId]
      });
    })
    .catch(error => showStatusMessage(error.message, 'error'));
}

function selectHousehold(householdId, containerId) {
  console.log(`Selected household ${householdId} in ${containerId}`);
  showStatusMessage(`Switched to household ${householdId}`, "success");
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
auth.onAuthStateChanged(async user => {
  if (user) {
    currentUser = user;

    const userRef = firebase.firestore().collection("users").doc(user.uid);

    // ✅ Load profile subdocument
    const profileSnap = await userRef.collection("profile").doc("profile").get();
    const profile = profileSnap.exists ? profileSnap.data() : {};

    // ✅ Load household membership array
    const userDoc = await userRef.get();
    householdIds = userDoc.exists ? (userDoc.data().households || []) : [];

    // ✅ Load household documents
    const householdDocs = await Promise.all(
      householdIds.map(hid =>
        firebase.firestore().collection("households").doc(hid).get()
      )
    );

    // ✅ Convert to array of { id, name }
    households = householdDocs
      .filter(doc => doc.exists)
      .map(doc => ({
        id: doc.id,
        name: doc.data().name
      }));

    // ✅ Initialize household selector
    initHouseholdSelector(households);

    // ✅ UI updates
    document.getElementById("login-section").style.display = "none";
    document.getElementById("login-lang-switch").style.display = "none";
    document.querySelector(".bottom-nav").style.display = "flex";

    // ✅ Welcome text
    document.getElementById("settings-welcome").textContent =
      `${translations[currentLang].welcome}, ${profile.email || currentUser.email}`;

    // ✅ Apply profile settings
    if (profile.homeImage) {
      const img = document.getElementById("home-image");
      img.src = profile.homeImage;
      img.style.display = "block";
    }

    if (profile.language) {
      currentLang = profile.language;
      setLanguage(currentLang);
    }

    if (profile.colorScheme) {
      setColorScheme(profile.colorScheme);
      document.getElementById("color-scheme-select").value = profile.colorScheme;
    }

    // ✅ Load main app
    showPage("home-page");
    loadLedger(currentUser.uid);
    updateHomeKanban();
  } else {
    currentUser = null;
    document.getElementById("login-section").style.display = "block";
    document.getElementById("home-page").style.display = "none";
    document.getElementById("transaction-page").style.display = "none";
    document.getElementById("settings-page").style.display = "none";
    document.querySelector(".bottom-nav").style.display = "none";
    document.getElementById("settings-welcome").textContent = "";
  }
});

function initHouseholdSelector(households) {
  const col = document.querySelector("#household-selector .household-col");

  // Use names for display
  const names = households.map(h => h.name);

  createList(col, names);
  enableSnap(col);

  // Save for later lookup (ID ↔ name)
  window._householdList = households;
}


function isTransactionFormEmpty(formId) {
  const form = document.querySelector(`#${formId} .transaction-form`);
  if (!form) return true;

  // All text-like inputs
  const inputs = form.querySelectorAll("input[type='text'], input[type='search'], input[list]");

  for (let input of inputs) {
    if (input.value.trim() !== "") return false;
  }

  // Check item rows
  const itemNames = form.querySelectorAll(".item-name");
  const itemNotes = form.querySelectorAll(".item-notes");

  for (let i = 0; i < itemNames.length; i++) {
    if (itemNames[i].value.trim() !== "") return false;
    if (itemNotes[i].value.trim() !== "") return false;
  }

  return true;
}

function setCurrentTime(button) {
  const now = new Date();

  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const hh = String(now.getHours()).padStart(2, "0");
  const min = String(now.getMinutes()).padStart(2, "0");

  const prefix = getDatePrefix(now);

  button.textContent = `${prefix}${yyyy}-${mm}-${dd} ${hh}:${min}`;
  button.dataset.value = now.toISOString();
}

function setCurrentHousehold(button) {
  button.textContent = households[0].name;
  button.dataset.value = households[0].id;
}


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

const wrapper = document.getElementById("transaction-wrapper");
const tabButtons = document.querySelectorAll(".tab-btn");

let currentIndex = 0;

function switchTab(index) {
  currentIndex = index;
  wrapper.style.transform = `translateX(-${index * 100}%)`;

  tabButtons.forEach(btn => btn.classList.remove("active"));
  tabButtons[index].classList.add("active");
}

// Button click
tabButtons.forEach(btn => {
  btn.addEventListener("click", () => {
    switchTab(parseInt(btn.dataset.index));
  });
});

// Swipe support
let startX = 0;

wrapper.addEventListener("touchstart", e => {
  startX = e.touches[0].clientX;
});

wrapper.addEventListener("touchend", e => {
  let endX = e.changedTouches[0].clientX;
  let diff = startX - endX;

  if (Math.abs(diff) > 50) {
    if (diff > 0 && currentIndex < 2) switchTab(currentIndex + 1);
    if (diff < 0 && currentIndex > 0) switchTab(currentIndex - 1);
  }
});

const fieldMap = {
  income: {
    account: "income-account",
    datetime: "income-datetime",
    person: "income-person",
    store: "income-source",
    category: "income-category"
  },
  expense: {
    account: "expense-account",
    datetime: "expense-datetime",
    person: "expense-person",
    store: "expense-store",
    category: "expense-category"
  },
  transfer: {
    datetime: "transfer-datetime",
    fromAccount: "transfer-from",
    toAccount: "transfer-to"
  }
};

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

  // Read fields depending on type
  let account, person, store, category, fromAccount, toAccount;

  if (type === "income" || type === "expense") {
    const map = fieldMap[type];

    datetime = removeDatePrefix(document.getElementById(map.datetime).textContent);
    account = document.getElementById(map.account).value.trim();
    person = document.getElementById(map.person).value.trim();
    store = document.getElementById(map.store).value.trim();
    category = document.getElementById(map.category).value.trim();
  }

  if (type === "transfer") {
    const map = fieldMap.transfer;

    datetime = removeDatePrefix(document.getElementById(map.datetime).textContent);
    fromAccount = document.getElementById(map.fromAccount).value.trim();
    toAccount = document.getElementById(map.toAccount).value.trim();
  }

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
  const list = document.getElementById("ledger-list"); // or new ID
  if (!list) return; // safety check

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
      document.getElementById("today-sub").textContent = latest
        ? formatLatest(latest)
        : "暂无交易";
      updateHomeKanban();
    });
}


function formatLatest(data) {
  const typeLabel = data.type === "incoming" ? "收入"
    : data.type === "outgoing" ? "支出"
      : "转账";
  return `${typeLabel} | ${data.account} | ${data.store || ""} | ${data.datetime || ""}`.trim();
}


const pagesWrapper = document.getElementById("pages-wrapper");
// define base pages
const basePages = ["home-page", "accounts-page", "charts-page", "settings-page"];

// history stacks for each base page
let historyStacks = {
  home: ["home-page"],
  accounts: ["accounts-page"],
  charts: ["charts-page"],
  settings: ["settings-page"]
};

// track which base we’re currently in
let currentBase = "home-page";

function showPage(name) {
  const target = document.getElementById(name);
  if (!target) return;

  if (name === "transaction-page") {
    const activeIndex = currentIndex; // income=0, expense=1, transfer=2
    const formIds = ["income-form", "expense-form", "transfer-form"];
    const formId = formIds[activeIndex];

    if (isTransactionFormEmpty(formId)) {
      let btn = document.querySelector(`#${formId} .selector-button[data-type='datetime']`);
      if (btn) setCurrentTime(btn);
      btn = document.querySelector(`#${formId} .selector-button[data-type='household']`);
      if (btn) setCurrentHousehold(btn);
    }
  }

  // ✅ If the page is already active, do nothing
  if (target.classList.contains('active')) {
    return;
  }

  if (basePages.includes(name)) {
    // reset stack if navigating to a base page
    currentBase = name;
    historyStacks[name] = [name];
  } else {
    // push child page onto current base stack
    historyStacks[currentBase].push(name);
  }

  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  if (target) {
    target.classList.add('active');
  } else {
    console.error("Page not found:", name);
  }
}

function goBack() {
  const stack = historyStacks[currentBase];
  if (stack.length > 1) {
    stack.pop(); // remove current page
    const prev = stack[stack.length - 1];
    stack.pop(); // remove previous page as well because it will be appended again
    showPage(prev);
  }
}

window.addEventListener("popstate", goBack);
document.addEventListener("keydown", e => {
  if (e.key === "Backspace") goBack();
});


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


  // Buttons
  // document.getElementById("add-item-btn").textContent = t.addItem;
  // document.getElementById("add-transaction-btn").textContent = t.addTransaction;
  // document.getElementById("logout-btn").textContent = t.logout;

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

document.getElementById("invite-btn").onclick = () => {
  document.getElementById("invite-panel").style.display = "block";
  document.getElementById("manage-panel").style.display = "none";
};

document.getElementById("manage-btn").onclick = () => {
  document.getElementById("invite-panel").style.display = "none";
  document.getElementById("manage-panel").style.display = "block";
  loadHouseholdMembers();
};

document.getElementById("leave-btn").onclick = () => {
  leaveHousehold();
};

document.getElementById("invite-confirm").onclick = async () => {
  const email = document.getElementById("invite-email").value.trim();
  if (!email) return alert("请输入邮箱");

  const myHouseholdId = householdIds[0]; // you already track this

  // 1. Find user by email
  const userQuery = await firebase.firestore()
    .collection("users")
    .where("profile.email", "==", email)
    .get();

  if (userQuery.empty) {
    alert("未找到该用户");
    return;
  }

  const invitedUserDoc = userQuery.docs[0];
  const invitedUserId = invitedUserDoc.id;

  // 2. Add household to invited user
  await invitedUserDoc.ref.update({
    households: firebase.firestore.FieldValue.arrayUnion(myHouseholdId)
  });

  // 3. Add invited user to household members
  await firebase.firestore()
    .collection("households")
    .doc(myHouseholdId)
    .update({
      members: firebase.firestore.FieldValue.arrayUnion(invitedUserId)
    });

  alert("邀请成功，对方已加入您的 household");
  document.getElementById("invite-email").value = "";
};

async function loadHouseholdMembers() {
  const list = document.getElementById("member-list");
  list.innerHTML = "";

  const householdDoc = await firebase.firestore()
    .collection("households")
    .doc(householdIds[0])
    .get();

  const members = (householdDoc.data().members || []).slice(1);

  for (const uid of members) {
    const userDoc = await firebase.firestore()
      .collection("users")
      .doc(uid)
      .get();
    const profileSnap = userDoc.data().profile;

    const email = profileSnap.email;

    const li = document.createElement("li");
    li.textContent = email;
    li.style.padding = "10px";
    li.style.borderBottom = "1px solid #eee";
    li.style.position = "relative";

    document.addEventListener("contextmenu", e => {
  console.log("GLOBAL contextmenu fired on:", e.target);
});

    // Right-click to show delete
    li.oncontextmenu = e => {
  console.log("contextmenu fired for", uid); // debug
  e.preventDefault();
  showDeleteButton(li, uid);
};


    // Swipe left (mobile)
    li.addEventListener("touchstart", e => {
      li._startX = e.touches[0].clientX;
    });

    li.addEventListener("touchend", e => {
      const dx = e.changedTouches[0].clientX - li._startX;
      let deleteBtn = null;
      if (dx < -50) {
        deleteBtn = showDeleteButton(li, uid);
      }
      if (dx < -50) {
        deleteBtn.style.display = 'none';
      }
    });

    list.appendChild(li);
  }
}

function showDeleteButton(li, uid) {
  let btn = li.querySelector(".delete-btn");
  if (btn) return;

  btn = document.createElement("button");
  btn.textContent = "删除";
  btn.className = "delete-btn";
  btn.style.position = "absolute";
  btn.style.right = "10px";
  btn.style.top = "8px";
  btn.style.background = "#c00";
  btn.style.color = "#fff";

  btn.onclick = () => confirmRemoveMember(uid);

  li.appendChild(btn);

  return btn
}

async function confirmRemoveMember(uid) {
  if (!confirm("确定要将该成员移出 household 吗？")) return;

  const hid = householdIds[0];

  // Remove from household members
  await firebase.firestore()
    .collection("households")
    .doc(hid)
    .update({
      members: firebase.firestore.FieldValue.arrayRemove(uid)
    });

  // Remove household from user
  await firebase.firestore()
    .collection("users")
    .doc(uid)
    .update({
      households: firebase.firestore.FieldValue.arrayRemove(hid)
    });

  loadHouseholdMembers();
}

async function leaveHousehold() {
  const hid = currentHouseholdId;
  const uid = currentUser.uid;

  if (!confirm("确定要退出该 household 吗？")) return;

  // Remove myself from household members
  await firebase.firestore()
    .collection("households")
    .doc(hid)
    .update({
      members: firebase.firestore.FieldValue.arrayRemove(uid)
    });

  // Remove household from my user doc
  await firebase.firestore()
    .collection("users")
    .doc(uid)
    .update({
      households: firebase.firestore.FieldValue.arrayRemove(hid)
    });

  alert("已退出该 household");
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

const datePrefixes = {
  zh: ["前天", "昨天", "今天", "明天", "后天"],
  en: ["2 days ago", "yesterday", "today", "tomorrow", "in 2 days"]
};

function getDatePrefix(targetDate) {
  const today = new Date();

  // Normalize both dates to midnight
  today.setHours(0, 0, 0, 0);
  const t = new Date(targetDate);
  t.setHours(0, 0, 0, 0);

  // Difference in days
  const diffDays = Math.round((t - today) / (1000 * 60 * 60 * 24));

  let prefix = "";
  switch (diffDays) {
    case -2: prefix = "前天 "; break;
    case -1: prefix = "昨天 "; break;
    case 0: prefix = "今天 "; break;
    case 1: prefix = "明天 "; break;
    case 2: prefix = "后天 "; break;
    default: prefix = ""; break;
  }

  return prefix;
}

const datetimeSelector = document.getElementById("datetime-selector");
const householdSelector = document.getElementById("household-selector");
let lastButton = null;

function createList(col, values) {
  col.innerHTML = ""; // clear existing items

  // top spacer
  const topSpacerCount = 1; // number of empty rows to allow centering
  for (let i = 0; i < topSpacerCount; i++) {
    const div = document.createElement("div");
    div.className = "dt-item spacer";
    col.appendChild(div);
  }

  // real items
  values.forEach(v => {
    const div = document.createElement("div");
    div.className = "dt-item";
    div.textContent = v;
    col.appendChild(div);
  });

  // bottom spacer
  const bottomSpacerCount = 2; // number of empty rows to allow centering
  for (let i = 0; i < bottomSpacerCount; i++) {
    const div = document.createElement("div");
    div.className = "dt-item spacer";
    col.appendChild(div);
  }
}


/* Snap after scroll stops */
function enableSnap(col) {
  let timeout;

  col.addEventListener("scroll", () => {
    clearTimeout(timeout);

    const items = [...col.querySelectorAll(".dt-item")];
    const center = col.scrollTop + col.clientHeight / 2;

    // ✅ LIVE highlight while scrolling
    let closest = null;
    let minDist = Infinity;

    items.forEach(item => {
      const itemCenter = item.offsetTop + item.clientHeight / 2;
      const dist = Math.abs(itemCenter - center);
      if (dist < minDist) {
        minDist = dist;
        closest = item;
      }
    });

    if (closest) {
      items.forEach(i => i.classList.remove("selected"));
      closest.classList.add("selected");
    }

    // ✅ Snap AFTER scrolling stops
    timeout = setTimeout(() => {
      col.scrollTop =
        closest.offsetTop - (col.clientHeight / 2 - closest.clientHeight / 2);
    }, 80);
  });

}

const dtCols = datetimeSelector.querySelectorAll(".year-col, .month-col, .day-col, .hour-col, .minute-col");

dtCols.forEach(col => {
  col.addEventListener("scroll", () => {
    // debounce so it fires after snapping
    clearTimeout(col._timer);
    col._timer = setTimeout(() => {
      if (col === datetimeSelector.querySelector(".year-col") || col === datetimeSelector.querySelector(".month-col")) {
        const day = getSelectedValue(".day-col")
        updateDayColumn();
        scrollToValue(datetimeSelector.querySelector(".day-col"), day)
      }
      updateSelectorPreview();
    }, 80);
  });
});

const hhCols = householdSelector.querySelectorAll(".household-col");

hhCols.forEach(col => {
  col.addEventListener("scroll", () => {
    // debounce so it fires after snapping
    clearTimeout(col._timer);
    col._timer = setTimeout(() => {
      updateSelectorPreview();
    }, 80);
  });
});

function updateSelectorPreview() {
  if (!lastButton) return;
  if (lastButton.dataset.type === "datetime") {
    const yEl = datetimeSelector.querySelector(".year-col .selected");
    const mEl = datetimeSelector.querySelector(".month-col .selected");
    const dEl = datetimeSelector.querySelector(".day-col .selected");
    const hEl = datetimeSelector.querySelector(".hour-col .selected");
    const minEl = datetimeSelector.querySelector(".minute-col .selected");

    if (!yEl || !mEl || !dEl || !hEl || !minEl) return;

    const y = Number(yEl.textContent);
    const m = Number(mEl.textContent);
    const d = Number(dEl.textContent);
    const h = Number(hEl.textContent);
    const min = Number(minEl.textContent);

    const dateObj = new Date(y, m - 1, d, h, min);
    const prefix = getDatePrefix(dateObj); // assumes you already have this

    lastButton.textContent =
      `${prefix}${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")} ` +
      `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;

    lastButton.dataset.value = dateObj.toISOString();

  } else if (lastButton.dataset.type === "household") {
    const hhEl = householdSelector.querySelector(".household-col .selected");

    if (!hhEl) return;

    lastButton.textContent = hhEl.textContent;
  }
}

/* Scroll to a specific value */
function scrollToValue(col, value) {
  const items = [...col.querySelectorAll(".dt-item")];
  let target = items.find(i => i.textContent == value);
  if (!target) return;

  items.forEach(i => i.classList.remove("selected"));
  target.classList.add("selected");

  col.scrollTop =
    target.offsetTop - (col.clientHeight / 2 - target.clientHeight / 2);
}

// Remove known prefixes
function removeDatePrefix(text) {
  const prefixes = datePrefixes[currentLang] || [];
  if (prefixes.length === 0) return text;

  // Escape special regex characters in prefixes
  const escaped = prefixes.map(p => p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));

  const regex = new RegExp(`^(${escaped.join("|")})\\s*`, "i");

  return text.replace(regex, "");
}

/* Parse datetime from button */
function parseButtonDate(btn) {
  let text = btn.textContent.trim();

  text = removeDatePrefix(text);

  const [datePart, timePart] = text.split(" ");
  const [y, m, d] = datePart.split("-").map(Number);
  const [h, min] = timePart.split(":").map(Number);

  return { year: y, month: m, day: d, hour: h, minute: min };
}

/* Initialize selector */
(function initSelector() {
  const yearCol = datetimeSelector.querySelector(".year-col");
  const monthCol = datetimeSelector.querySelector(".month-col");
  const hourCol = datetimeSelector.querySelector(".hour-col");
  const minuteCol = datetimeSelector.querySelector(".minute-col");

  createList(yearCol, Array.from({ length: 2100 - 2010 + 1 }, (_, i) => 2010 + i));
  createList(monthCol, Array.from({ length: 12 }, (_, i) => i + 1));
  createList(hourCol, Array.from({ length: 24 }, (_, i) => i));
  createList(minuteCol, Array.from({ length: 60 }, (_, i) => i));
  updateDayColumn();

  enableSnap(datetimeSelector.querySelector(".year-col"));
  enableSnap(datetimeSelector.querySelector(".month-col"));
  enableSnap(datetimeSelector.querySelector(".day-col"));
  enableSnap(datetimeSelector.querySelector(".hour-col"));
  enableSnap(datetimeSelector.querySelector(".minute-col"));

  enableSnap(householdSelector.querySelector(".household-col"));
})();

function updateDayColumn() {
  const year = getSelectedValue(".year-col");
  const month = getSelectedValue(".month-col");

  const days = daysInMonth(year, month);

  const dayCol = datetimeSelector.querySelector(".day-col");
  createList(dayCol, Array.from({ length: days }, (_, i) => i + 1));

  enableSnap(dayCol); // re-enable snapping after rebuilding
}

function getSelectedValue(selector) {
  const col = datetimeSelector.querySelector(selector);
  const selected = col.querySelector(".selected");
  return selected ? Number(selected.textContent) : null;
}

function daysInMonth(year, month) {
  return new Date(year, month, 0).getDate(); // elegant JS trick
}

/* Open selector */
document.querySelectorAll(".selector-button[data-type='datetime']").forEach(btn => {
  btn.addEventListener("click", e => {
    e.stopPropagation();
    lastButton = btn;

    datetimeSelector.style.display = "flex";

    const { year, month, day, hour, minute } = parseButtonDate(btn);

    scrollToValue(datetimeSelector.querySelector(".year-col"), year);
    scrollToValue(datetimeSelector.querySelector(".month-col"), month);
    scrollToValue(datetimeSelector.querySelector(".day-col"), day);
    scrollToValue(datetimeSelector.querySelector(".hour-col"), hour);
    scrollToValue(datetimeSelector.querySelector(".minute-col"), minute);
  });
});

document.querySelectorAll(".selector-button[data-type='household']")
  .forEach(btn => {
    btn.addEventListener("click", e => {
      e.stopPropagation();
      lastButton = btn;

      householdSelector.style.display = "flex";

      scrollToValue(householdSelector.querySelector(".household-col"), btn.textContent);
    });
  });

/* Close when clicking outside */
document.addEventListener("click", e => {
  if (!datetimeSelector.contains(e.target)) {
    datetimeSelector.style.display = "none";
  }
});
