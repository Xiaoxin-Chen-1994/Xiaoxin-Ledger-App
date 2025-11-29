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
let inputTypeIndex = 0;
let inputTransactionTime = null;
let inputHouseholdId = null;
let inputPerson = null;
let inputStore = null;
let inputCategory = null;
let inputItems = null;

if (isMobileBrowser()) { // use a smaller font for mobile
  // Get current value of --font-size
  let current = getComputedStyle(document.documentElement)
                  .getPropertyValue("--font-size");
  // Trim and parse (assumes it's in rem)
  current = parseFloat(current);
  // Subtract 0.1
  let newSize = current - 0.1;
  // Set it back with unit
  document.documentElement.style.setProperty("--font-size", newSize + "rem");
}

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
          homeImages: "",
          fontsize: "",
          settings: {}
        },
        personalHouseholdId: householdId,
        households: [householdId]
      });
    })
    .catch(error => showStatusMessage(error.message, 'error'));
}

function login() {
  const email = document.getElementById("username").value;
  const password = document.getElementById("password").value;
  auth.signInWithEmailAndPassword(email, password)
  .catch(error => {
    let message;
    switch (error.code) {
      case 'auth/user-not-found':
        message = 'No account exists with this email.';
        break;
      case 'auth/invalid-login-credentials':
        message = 'Incorrect password. Please try again.';
        break;
      case 'auth/invalid-email':
        message = 'The email address is not valid.';
        break;
      case 'auth/user-disabled':
        message = 'This account has been disabled. Contact support.';
        break;
      default:
        message = error.message;
        console.log(error)
    }
    showStatusMessage(message, 'error');
  });

}

function resetPassword() {
  const email = document.getElementById("username").value;

  auth.sendPasswordResetEmail(email)
    .then(() => {
      // Success: email sent
      alert("Password reset email sent!");
    })
    .catch((error) => {
      // Handle Errors here.
      console.error(error.code, error.message);
      alert("Error: " + error.message);
    });
}

function logout() {
  auth.signOut();
}

// --- Persistent login state ---
auth.onAuthStateChanged(async user => {
  if (user) {
    currentUser = user;

    console.time("Load userDoc");
    const userDoc = await firebase.firestore()
      .collection("users")
      .doc(user.uid)
      .get();
    console.timeEnd("Load userDoc");
    // ✅ Load profile subdocument
    const profile = userDoc.data().profile

    // ✅ Load household membership array
    householdIds = userDoc.exists ? (userDoc.data().households || []) : [];

    // ✅ Load household documents
    console.time("Load household documents");
    const householdDocs = await Promise.all(
      householdIds.map(hid =>
        firebase.firestore().collection("households").doc(hid).get()
      )
    );
    console.timeEnd("Load household documents");

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
    document.querySelector(".bottom-nav").style.display = "flex";

    // ✅ Welcome text
    document.getElementById("settings-welcome").textContent =
      `${translations[currentLang].welcome}, ${profile.email || currentUser.email}`;

    // ✅ Apply profile settings
    if (profile.homeImages && Array.isArray(profile.homeImages) && profile.homeImages.length > 0) {
      const img = document.getElementById("home-image");

      const randomIndex = Math.floor(Math.random() * profile.homeImages.length);
      const randomUrl = profile.homeImages[randomIndex].trim();

      if (randomUrl !== "") {
        // Create a new Image object to preload
        const preloader = new Image();
        preloader.onload = () => {
          // Once loaded in background, show it
          img.src = randomUrl;
          img.style.display = "block";
        };
        preloader.onerror = () => {
          // If loading fails, hide
          img.style.display = "none";
        };

        // Start loading in background
        preloader.src = randomUrl;
      } else {
        img.style.display = "none";
      }
    } else {
      const img = document.getElementById("home-image");
      img.style.display = "none";
    }

    if (profile.language) {
      currentLang = profile.language;
      setLanguage(currentLang);
    }

    
    if (isMobileBrowser()) {
      if (profile.fontsizeMobile) {
        document.documentElement.style.setProperty("--font-size", profile.fontsizeMobile);
      }
    } else {
      if (profile.fontsizeDesktop) {
        document.documentElement.style.setProperty("--font-size", profile.fontsizeDesktop);
      }
    }

    if (profile.colorScheme) {
      setColorScheme(profile.colorScheme);
      document.getElementById("color-scheme-select").value = profile.colorScheme;
    }

    // ✅ Load main app
    showPage("home", "nav-home");
    loadLedger(currentUser.uid);
    updateHomeKanban();
  } else {
    currentUser = null;
    document.getElementById("login-section").style.display = "block";
    document.getElementById("home-page").style.display = "none";
    document.getElementById("return-btn").style.display = "none";
    document.getElementById("transaction-page").style.display = "none";
    document.getElementById("settings-page").style.display = "none";
    document.querySelector(".bottom-nav").style.display = "none";
    document.getElementById("settings-welcome").textContent = "";
  }
});

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

  inputTransactionTime = `${prefix}${yyyy}-${mm}-${dd} ${hh}:${min}`

  button.textContent = inputTransactionTime;
  button.dataset.value = now.toISOString();
}

function setCurrentHousehold(button) {
  inputHouseholdId = households[0].id;
  button.textContent = households[0].name;
  button.dataset.value = households[0].id;
}

function createItemRow() {
  const row = document.createElement("div");
  row.className = "item-row";

  const content = document.createElement("div");
  content.className = "item-content";

  const nameInput = document.createElement("input");
  nameInput.type = "text";
  nameInput.className = "item-name";
  nameInput.placeholder = "条目";

  const notesInput = document.createElement("input");
  notesInput.type = "text";
  notesInput.className = "item-notes";
  notesInput.placeholder = "价格";

  content.appendChild(nameInput);
  content.appendChild(notesInput);

  const deleteBtn = document.createElement("button");
  deleteBtn.type = "button";
  deleteBtn.className = "delete-btn";
  deleteBtn.textContent = "删除";

  row.appendChild(content);
  row.appendChild(deleteBtn);

  row.addEventListener("contextmenu", e => {
    e.preventDefault();   // stop the browser from scrolling the page
    e.stopPropagation();  // stop the event from bubbling up to parent elements
    row.classList.add("show-delete"); // reveal delete button
  });

  row.addEventListener("click", e => {
    e.preventDefault();   // stop the browser from scrolling the page
    e.stopPropagation();  // stop the event from bubbling up to parent elements
    // only hide if clicking outside the delete button
    if (!e.target.classList.contains("delete-btn")) {
      row.classList.remove("show-delete");
    }
  });

  // Swipe detection
  let startX = 0;
  row.addEventListener("touchstart", e => {
    e.preventDefault();   // stop the browser from scrolling the page
    e.stopPropagation();  // stop the event from bubbling up to parent elements
    startX = e.touches[0].clientX;
  });
  row.addEventListener("touchend", e => {
    e.preventDefault();   // stop the browser from scrolling the page
    e.stopPropagation();  // stop the event from bubbling up to parent elements
    const endX = e.changedTouches[0].clientX;
    const diff = startX - endX;
    if (diff > 50) {
      row.classList.add("show-delete");   // swipe left
    } else if (diff < -50) {
      row.classList.remove("show-delete"); // swipe right
    }
  });

  // Delete button
  deleteBtn.addEventListener("click", () => {
    row.remove();
  });

  return row;
}

// Attach to all add-item buttons
document.querySelectorAll("button[id$='add-item-btn']").forEach(addBtn => {
  addBtn.addEventListener("click", () => {
    const group = addBtn.closest(".item-group");
    const newRow = createItemRow();
    group.insertBefore(newRow, addBtn);
  });
});

// Upgrade any existing rows in HTML
document.querySelectorAll(".item-row").forEach(row => {
  const name = row.querySelector(".item-name")?.value || "";
  const notes = row.querySelector(".item-notes")?.value || "";
  const upgraded = createItemRow(name, notes);
  row.replaceWith(upgraded);
});

const wrapper = document.getElementById("transaction-wrapper");
const tabButtons = document.querySelectorAll(".tab-btn");

function switchTab(index) {
  inputTypeIndex = index;
  wrapper.style.transform = `translateX(-${index * 100}%)`;

  // Update active button
  tabButtons.forEach(btn => btn.classList.remove("active"));
  tabButtons[index].classList.add("active");

  // Find the active tab container
  const activeTab = document.querySelectorAll(".transaction-page")[index];

  // datetime
  const datetimeEl = activeTab.querySelector(".selector-button[data-type='datetime']");
  if (datetimeEl && inputTransactionTime) {
    datetimeEl.textContent = inputTransactionTime;
  }

  // person
  const personEl = activeTab.querySelector("input[list='person-list']");
  if (personEl && inputPerson) {
    personEl.value = inputPerson;
  }

  // household
  const householdEl = activeTab.querySelector(".selector-button[data-type='household']");
 
  const household = households.find(h => h.id === inputHouseholdId);

  if (household) {
    householdEl.textContent = household.name;   // show the name on the button
    householdEl.dataset.value = household.id;   // keep the id in data-value
  }

  // category
  const categoryEl = activeTab.querySelector("input[type='search'][id$='category']");
  if (categoryEl && inputCategory) {
    categoryEl.value = inputCategory;
  }

  // store
  const storeEl = activeTab.querySelector("input[type='search'][id$='store']");
  if (storeEl && inputStore) {
    storeEl.value = inputStore;
  }

  // Parse the string into an array of {name, notes}
  let parsedItems = (inputItems || "")
    .split("|")
    .filter(pair => pair) // remove empty strings
    .map(pair => {
      const [name, notes] = pair.split(":");
      return { name: name || "", notes: notes || "" };
    });
  // Keep at least one empty row
  if (parsedItems.length === 0) {
    parsedItems = [{ name: "", notes: "" }];
  }
  // Render all items into that tab
  renderItems(parsedItems, activeTab);
}

// parsedItems is now an array of { name, notes }
function renderItems(parsedItems, activeTab) {
  const itemGroup = activeTab.querySelector(".item-group");
  if (!itemGroup) return;

  // Find the "Add another item" button so we can keep it at the bottom
  const addBtn = itemGroup.querySelector("button[id$='add-item-btn']");

  // Clear everything
  itemGroup.innerHTML = "";

  // Rebuild rows from parsedItems
  parsedItems.forEach(item => {
    const row = document.createElement("div");
    row.className = "item-row";

    const content = document.createElement("div");
    content.className = "item-content";

    const nameInput = document.createElement("input");
    nameInput.type = "text";
    nameInput.className = "item-name";
    nameInput.placeholder = "条目";
    nameInput.value = item.name;

    const notesInput = document.createElement("input");
    notesInput.type = "text";
    notesInput.className = "item-notes";
    notesInput.placeholder = "价格";
    notesInput.value = item.notes;

    content.appendChild(nameInput);
    content.appendChild(notesInput);

    const deleteBtn = document.createElement("button");
    deleteBtn.type = "button";
    deleteBtn.className = "delete-btn";
    deleteBtn.textContent = "删除";

    row.appendChild(content);
    row.appendChild(deleteBtn);

    // --- Swipe detection ---
    let startX = 0;
    row.addEventListener("touchstart", e => {
      e.preventDefault();   // stop the browser from scrolling the page
      e.stopPropagation();  // stop the event from bubbling up to parent elements
      startX = e.touches[0].clientX;
    });
    row.addEventListener("touchend", e => {
      e.preventDefault();   // stop the browser from scrolling the page
      e.stopPropagation();  // stop the event from bubbling up to parent elements
      const endX = e.changedTouches[0].clientX;
      const diff = startX - endX;
      if (diff > 50) {
        row.classList.add("show-delete");   // swipe left
      } else if (diff < -50) {
        row.classList.remove("show-delete"); // swipe right
      }
    });

    // --- Right‑click (desktop) ---
    row.addEventListener("contextmenu", e => {
      e.preventDefault();   // stop the browser from scrolling the page
      e.stopPropagation();  // stop the event from bubbling up to parent elements
      row.classList.add("show-delete");
    });

    row.addEventListener("click", e => {
      e.preventDefault();   // stop the browser from scrolling the page
      e.stopPropagation();  // stop the event from bubbling up to parent elements
      // only hide if clicking outside the delete button
      if (!e.target.classList.contains("delete-btn")) {
        row.classList.remove("show-delete");
      }
    });

    // --- Delete button ---
    deleteBtn.addEventListener("click", () => {
      row.remove();
      document.querySelectorAll(".item-group").forEach(group => {
        // Collect all rows in this group
        const rows = group.querySelectorAll(".item-row");

        // Build array of {name, notes}
        const itemsArray = Array.from(rows).map(row => ({
          name: row.querySelector(".item-name").value.trim(),
          notes: row.querySelector(".item-notes").value.trim()
        }));

        // Merge into string
        inputItems = itemsArray.map(item => `${item.name}:${item.notes}`).join("|");
      });
    });

    itemGroup.appendChild(row);
  });

  // Re‑append the add button at the end
  if (addBtn) itemGroup.appendChild(addBtn);
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
  // do not add preventDefault otherwise the selectors won't show!
  // e.preventDefault();   // stop the browser from scrolling the page
  startX = e.touches[0].clientX;
});

wrapper.addEventListener("touchend", e => {
  // do not add preventDefault otherwise the selectors won't show!
  // e.preventDefault();   // stop the browser from scrolling the page
  let endX = e.changedTouches[0].clientX;
  let diff = startX - endX;

  if (Math.abs(diff) > 50) {
    if (diff > 0 && inputTypeIndex < 2) switchTab(inputTypeIndex + 1);
    if (diff < 0 && inputTypeIndex > 0) switchTab(inputTypeIndex - 1);
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

  const householdId = inputHouseholdId; // regardless of household name
  const type = inputTypeIndex; // regardless of language

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

// define base pages
const basePages = ["home", "accounts", "transaction", "values", "settings"];

// history stacks for each base page
let historyStacks = {
  home: [["home", "nav-home"]],
  accounts: [["accounts", "nav-accounts"]],
  transaction: [["transaction", "nav-transaction"]],
  values: [["values", "nav-values"]],
  settings: [["settings", "nav-settings"]]
};

// track which base we’re currently in
let currentBase = "home";

function showPage(name, navBtn=null) {
  let stack = null;
  let target = null;
  let latest = null;
  let latestPage = null;
  let latestNavBtn = null;

  // reset nav button colors
  document.getElementById("nav-home").style.backgroundColor = "";
  document.getElementById("nav-accounts").style.backgroundColor = "";
  document.getElementById("nav-transaction").style.backgroundColor = "";
  document.getElementById("nav-values").style.backgroundColor = "";
  document.getElementById("nav-settings").style.backgroundColor = "";

  if (basePages.includes(name)) { // when clicking the base nav buttons, look for the latest stack
    currentBase = name;
    stack = historyStacks[name];
    latest = stack ? stack[stack.length - 1] : [name, navBtn];
    [latestPage, latestNavBtn] = latest;
    target = document.getElementById(latestPage + "-page");

    if (!target) return;

    if (navBtn && stack.length < 2) { // if already returned to base
      document.getElementById(navBtn).style.backgroundColor = "var(--primary)";
      document.getElementById("return-btn").style.display = "none";
    } else {
      document.getElementById("return-btn").style.display = "block";
    };

  } else {
    latestPage = name;
    target = document.getElementById(latestPage + "-page");

    if (!target) return;
    
    if (name+"-page" === "transaction-page") {
      document.getElementById("nav-transaction").style.backgroundColor = "var(--primary)";
    }
    document.getElementById("return-btn").style.display = "block";
  }
  
  // hide all pages
  document.getElementById("login-section").style.display = "none";
  document.getElementById("home-page").style.display = "none";
  document.getElementById("transaction-page").style.display = "none";
  document.getElementById("settings-page").style.display = "none";

  // show the latest page
  target.style.display = "block";

  // transaction page special handling
  if (latestPage+"-page" === "transaction-page") {
    const activeIndex = inputTypeIndex; // income=0, expense=1, transfer=2
    const formIds = ["expense-form", "income-form", "transfer-form"];
    const formId = formIds[activeIndex];

    if (isTransactionFormEmpty(formId)) {
      let btn = document.querySelector(`#${formId} .selector-button[data-type='datetime']`);
      if (btn) setCurrentTime(btn);
      btn = document.querySelector(`#${formId} .selector-button[data-type='household']`);
      if (btn) setCurrentHousehold(btn);
    }
  }

  stack = historyStacks[currentBase];
  // If reaching base page or the page is already active, do nothing
  const isBaseAndFresh = basePages.includes(latestPage) && stack.length < 2;
  const isAlreadyActive = stack?.[stack.length - 1]?.[0] === latestPage;
  if (!isBaseAndFresh && !isAlreadyActive) {
    historyStacks[currentBase].push([latestPage, navBtn]); // add to the history stacks
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
    const [prevPage, prevNavBtn] = stack[stack.length - 1]; // get the previous entry
    
    if (stack.length > 1) {
      stack.pop(); // remove the previous page as well because it will be added later if it is not a base nav page
    }

    showPage(prevPage, prevNavBtn);
  }
}

window.addEventListener("popstate", goBack);

// --- Language Switcher ---
const translations = {
  en: {
    loginTitle: "Login or Signup",
    email: "Email",
    password: "Password",
    signup: "Sign Up",
    login: "Login",
    forgotBtn: "Reset password",
    resetHint: "To reset your password, enter your email address above and click the reset button. Then check your inbox for further instructions.",
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
    datePrefixes: ["2 days ago ", "Yesterday ", "Today ", "Tomorrow ", "In 2 days "],
    person: "Person",
    store: "Store Name",
    category: "Category",
    items: "Items",
    addItem: "+ Add Item",
    addTransaction: "Add Transaction",
    languageSwitched:"Language switched to English",
    languageSwitchFailed: "Failed to save language",
    fontsizeChanged: "Fontsize changed",
    fontsizeChangeFailed: "Failed to save fontsize",
    colorSchemeTitle:"Color Scheme", 
    colorSchemeSwitched:"Color scheme is now changed",
    colorSchemeSwitchFailed: "Failed to save color scheme",
    homeImageTitle: "Homepage Image",
    homeImageInstruction: "You may add the URL links to the online pictures you would like to use here.",
    homeImageSaved: "Homepage images saved",
    homeImageSaveFailed: "Failed to save homepage images",
    logout: "Logout",
    navHome: "Home",
    navAccounts: "Accounts",
    navTransaction: "Create",
    navValues: "Values",
    navSettings: "Settings"
  },
  zh: {
    loginTitle: "登录或注册",
    email: "邮箱",
    password: "密码",
    signup: "注册",
    login: "登录",
    forgotBtn: "重置密码",
    resetHint: "如需重置密码，请先输入您的邮箱地址并点击重置按钮，然后查看您的邮箱，按照邮件中的提示完成操作",
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
    datePrefixes: ["前天 ", "昨天 ", "今天 ", "明天 ", "后天 "],
    person: "相关人",
    store: "商店名称",
    category: "类别",
    items: "项目",
    addItem: "+ 添加项目",
    addTransaction: "添加交易",
    languageSwitched:"语言已切换为 中文",
    languageSwitchFailed: "语言保存出错",
    fontsizeChanged: "字体大小已更改",
    fontsizeChangeFailed: "字体大小保存出错",
    colorSchemeTitle:"颜色方案", 
    colorSchemeSwitched:"颜色方案已更新",
    colorSchemeSwitchFailed: "颜色方案保存出错",
    homeImageTitle: "首页图",
    homeImageInstruction: "您可在此处添加您想要使用的在线图片链接。",
    homeImageSaved: "首页图链接已保存",
    homeImageSaveFailed: "首页图保存出错",
    logout: "退出",
    navHome: "首页",
    navAccounts: "账户",
    navTransaction: "记一笔",
    navValues: "价值",
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
  document.getElementById("forgot-btn").textContent = t.forgotBtn;
  document.getElementById("reset-hint").textContent = t.resetHint;

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

  // Settings
  document.getElementById("color-scheme-title").textContent = t.colorSchemeTitle;
  document.getElementById("home-image-title").textContent = t.homeImageTitle;
  document.getElementById("home-image-instruction").textContent = t.homeImageInstruction;

  // Nav
  document.getElementById("nav-home").textContent = t.navHome;
  document.getElementById("nav-accounts").textContent = t.navAccounts;
  document.getElementById("nav-transaction").textContent = t.navTransaction;
  document.getElementById("nav-values").textContent = t.navValues;
  document.getElementById("nav-settings").textContent = t.navSettings;

  if (currentUser) {
    firebase.firestore()
      .collection("users")
      .doc(currentUser.uid)
      .update({
        "profile.language": lang   // update only this nested field
      })
      .then(() => {
        if (showMessage) {
          showStatusMessage(t.languageSwitched, "success");
        }
      })
      .catch(err => {
        console.error("Error saving language:", err);
        showStatusMessage(t.languageSwitchFailed, "error");
      });
  }
  
}

function isMobileBrowser() {
  return /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}

function increaseFontsize() {
  adjustFontsize(0.1); // increase by 0.1rem
}

function decreaseFontsize() {
  adjustFontsize(-0.1); // decrease by 0.1rem
}

function adjustFontsize(delta) {
  const t = translations[currentLang];

  // Get current value from CSS variable
  const current = getComputedStyle(document.documentElement)
    .getPropertyValue("--font-size")
    .trim();

  // Parse numeric part (assumes rem unit)
  let value = parseFloat(current.replace("rem", ""));
  value = Math.max(0.5, value + delta); // clamp to minimum 0.5rem

  const newSize = value.toFixed(1) + "rem";

  // Apply to CSS variable
  document.documentElement.style.setProperty("--font-size", newSize);

  // Save to Firestore
  const currentUser = firebase.auth().currentUser;
  if (currentUser) {
    const field = isMobileBrowser() ? "profile.fontsizeMobile" : "profile.fontsizeDesktop";
    firebase.firestore()
      .collection("users")
      .doc(currentUser.uid)
      .update({
        [field]: newSize
      })
      .then(() => {
        showStatusMessage(t.fontsizeChanged, "success");
      })
      .catch(err => {
        console.error("Error saving language:", err);
        showStatusMessage(t.fontsizeChangeFailed, "error");
      });
  }
}

// Ensure this runs after DOM is ready
document.addEventListener("DOMContentLoaded", () => {
  wireHomeImageSettings();
});

let homeImages = []; // start empty; load later

function wireHomeImageSettings() {
  const manageBtn = document.getElementById("manage-home-image-btn");
  const addBtn = document.getElementById("add-home-image-btn");
  const saveBtn = document.getElementById("save-home-image-btn");

  manageBtn?.addEventListener("click", toggleHomeImageEditor);
  addBtn?.addEventListener("click", addHomeImageRow);
  saveBtn?.addEventListener("click", saveHomeImages);
}

async function toggleHomeImageEditor() {
  const editor = document.getElementById("home-image-panel");

  if (editor.style.display === "none" || editor.style.display === "") {
    editor.style.display = "block";

    // 🔑 Load latest data from Firestore before rendering
    if (currentUser) {
      const userDoc = await firebase.firestore()
        .collection("users")
        .doc(currentUser.uid)
        .get();

      const profile = userDoc.data()?.profile || {};
      homeImages = Array.isArray(profile.homeImages) ? profile.homeImages : [];

      renderHomeImageList(homeImages);
    } else {
      // fallback if no user
      renderHomeImageList(homeImages);
    }
  } else {
    editor.style.display = "none";
  }
}


function renderHomeImageList(urls = []) {
  const list = document.getElementById("home-image-list");
  list.innerHTML = "";

  urls.forEach((url, index) => {
    const row = document.createElement("div");
    row.className = "home-image-row";

    const input = document.createElement("input");
    input.type = "url";
    input.value = url;
    input.addEventListener("change", () => (homeImages[index] = input.value));

    const del = document.createElement("button");
    del.type = "button";
    del.textContent = "Delete";
    del.addEventListener("click", () => {
      homeImages.splice(index, 1);
      renderHomeImageList(homeImages);
    });

    row.appendChild(input);
    row.appendChild(del);
    list.appendChild(row);
  });
}

function addHomeImageRow() {
  homeImages.push("");
  renderHomeImageList(homeImages);
}

function saveHomeImages() {
  const t = translations[currentLang];

  const inputs = document.querySelectorAll("#home-image-list input[type='url']");
  const urls = Array.from(inputs)
    .map(input => input.value.trim())
    .filter(url => url.length > 0);

  homeImages = urls;

  firebase.firestore()
    .collection("users")
    .doc(currentUser.uid)
    .update({
      "profile.homeImages": homeImages   // update just this nested field
    })
    .then(() => {
      showStatusMessage(t.homeImageSaved, "success");

      const img = document.getElementById("home-image");
      const randomIndex = Math.floor(Math.random() * homeImages.length);
      const randomUrl = homeImages[randomIndex].trim();
      img.src = randomUrl;
      img.style.display = "block";
    })
    .catch(err => {
      showStatusMessage(t.homeImageSaveFailed, "error");
    });
}

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
  t = translations[currentLang];

  if (scheme === "alt") {
    document.documentElement.classList.add("alt-scheme");
  } else {
    document.documentElement.classList.remove("alt-scheme");
  }

  if (currentUser) {
    firebase.firestore()
      .collection("users")
      .doc(currentUser.uid)
      .update({
        "profile.colorScheme": scheme   // update only this nested field
      })
      .then(() => {
        if (showMessage) {
          showStatusMessage(t.colorSchemeSwitched, "success");
        }
      })
      .catch(err => {
        console.error("Error saving color scheme:", err);
        showStatusMessage(t.colorSchemeSwitchFailed, "error");
      });
  }
}

document.getElementById("rename-btn").onclick = () => {
  const panel = document.getElementById("rename-panel");
  const isVisible = panel.style.display === "block";

  // hide all panels first
  document.getElementById("invite-panel").style.display = "none";
  document.getElementById("manage-panel").style.display = "none";
  document.getElementById("leave-household-panel").style.display = "none";

  if (isVisible) {
    panel.style.display = "none"; // toggle off
  } else {
    panel.style.display = "block"; // toggle on
    document.getElementById("rename-household").value = households[0].name;
  }
};

document.getElementById("invite-btn").onclick = () => {
  const panel = document.getElementById("invite-panel");
  const isVisible = panel.style.display === "block";

  document.getElementById("rename-panel").style.display = "none";
  document.getElementById("manage-panel").style.display = "none";
  document.getElementById("leave-household-panel").style.display = "none";

  panel.style.display = isVisible ? "none" : "block";
};

document.getElementById("manage-btn").onclick = () => {
  const panel = document.getElementById("manage-panel");
  const isVisible = panel.style.display === "block";

  document.getElementById("rename-panel").style.display = "none";
  document.getElementById("invite-panel").style.display = "none";
  document.getElementById("leave-household-panel").style.display = "none";

  if (isVisible) {
    panel.style.display = "none";
  } else {
    panel.style.display = "block";
    loadHouseholdMembers();
  }
};

document.getElementById("leave-btn").onclick = () => {
  const panel = document.getElementById("leave-household-panel");
  const isVisible = panel.style.display === "block";

  document.getElementById("rename-panel").style.display = "none";
  document.getElementById("invite-panel").style.display = "none";
  document.getElementById("manage-panel").style.display = "none";

  if (isVisible) {
    panel.style.display = "none";
  } else {
    panel.style.display = "block";
    loadMyHouseholds();
  }
};


document.getElementById("rename-confirm").addEventListener("click", async () => {
  const newName = document.getElementById("rename-household").value.trim();

  if (!newName) {
    alert("请输入新的家庭名称");
    return;
  }

  try {
    // Reference to the household document
    const householdRef = db.collection("households").doc(households[0].id);
    householdRef.update({ name: newName });

    console.log("Household renamed successfully!");
  } catch (err) {
    console.error("Error renaming household:", err);
  }
});

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

  // ✅ If user is only in 1 household (their own)
  if (members.length <= 1) {
    const msg = document.createElement("div");
    msg.textContent = "您的家庭中没有其他成员";
    msg.style.padding = "12px";
    msg.style.color = "#666";
    msg.style.textAlign = "center";
    msg.style.fontSize = "calc(var(--font-size) * 0.9)";
    list.appendChild(msg);
    return; // ✅ Stop here — nothing else to load
  }

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

    // Right-click to show delete
    li.oncontextmenu = e => {
      e.preventDefault();   // stop the browser from scrolling the page
      e.stopPropagation();  // stop the event from bubbling up to parent elements
      showDeleteButton(li, uid);
    };

    li.onclick = () => {
      hideDeleteButton(li);
    };

    // Swipe left (mobile)
    li.addEventListener("touchstart", e => {
      e.preventDefault();   // stop the browser from scrolling the page
      e.stopPropagation();  // stop the event from bubbling up to parent elements
      li._startX = e.touches[0].clientX;
    });

    li.addEventListener("touchend", e => {
      e.preventDefault();   // stop the browser from scrolling the page
      e.stopPropagation();  // stop the event from bubbling up to parent elements
      const dx = e.changedTouches[0].clientX - li._startX;
      if (dx < -50) showDeleteButton(li, uid); // swipe left
      if (dx > 50) hideDeleteButton(li); // swipe right
    });

    list.appendChild(li);
  }
}

function showDeleteButton(li, uid) {
  let btn = li.querySelector(".delete-btn");
  if (btn) {
    btn.style.display = "block"; // display again
    return;
  }

  btn = document.createElement("button");
  btn.textContent = "删除";
  btn.className = "delete-btn";
  btn.style.width = "4rem";
  btn.style.transform = "translateX(-1rem)"; // display
  btn.style.alignItems = "center";      /* vertical centering */
  btn.style.justifyContent = "center";  /* horizontal centering */


  btn.onclick = () => confirmRemoveMember(uid);

  li.appendChild(btn);
}

function hideDeleteButton(li) {
  const btn = li.querySelector(".delete-btn");
  if (btn) {
    btn.style.display = "none";   // ✅ slide out of view
  }
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

async function loadMyHouseholds() {
  const list = document.getElementById("leave-household-list");
  list.innerHTML = "";

  // ✅ If user is only in 1 household (their own)
  if (householdIds.length <= 1) {
    const msg = document.createElement("div");
    msg.textContent = "您没有加入其他人的家庭";
    msg.style.padding = "12px";
    msg.style.color = "#666";
    msg.style.textAlign = "center";
    msg.style.fontSize = "calc(var(--font-size) * 0.9)";
    list.appendChild(msg);
    return; // ✅ Stop here — nothing else to load
  }

  // ✅ Skip the first household (primary)
  const leaveable = householdIds.slice(1);

  for (const hid of leaveable) {
    const householdDoc = await firebase.firestore()
      .collection("households")
      .doc(hid)
      .get();

    const name = householdDoc.data().name;

    const li = document.createElement("li");
    li.textContent = name;
    li.style.padding = "10px";
    li.style.borderBottom = "1px solid #eee";
    li.style.position = "relative";

    // Right-click to show delete
    li.oncontextmenu = e => {
      e.preventDefault();   // stop the browser from scrolling the page
      e.stopPropagation();  // stop the event from bubbling up to parent elements
      showLeaveButton(li, hid);
    };

    li.onclick = () => {
      hideLeaveButton(li);
    };

    // Swipe left (mobile)
    li.addEventListener("touchstart", e => {
      e.preventDefault();   // stop the browser from scrolling the page
      e.stopPropagation();  // stop the event from bubbling up to parent elements
      li._startX = e.touches[0].clientX;
    });

    li.addEventListener("touchend", e => {
      e.preventDefault();   // stop the browser from scrolling the page
      e.stopPropagation();  // stop the event from bubbling up to parent elements
      const dx = e.changedTouches[0].clientX - li._startX;
      if (dx < -50) showLeaveButton(li, hid); // swipe left
      if (dx > 50) hideLeaveButton(li); // swipe right
    });

    list.appendChild(li);
  }
}

function showLeaveButton(li, uid) {
  let btn = li.querySelector(".delete-btn");
  if (btn) {
    btn.style.display = "block"; // display again
    return;
  }

  btn = document.createElement("button");
  btn.textContent = "离开";
  btn.className = "delete-btn";
  btn.style.width = "4rem";
  btn.style.transform = "translateX(-1rem)"; // display
  btn.style.alignItems = "center";      /* vertical centering */
  btn.style.justifyContent = "center";  /* horizontal centering */

  btn.onclick = () => confirmLeaveHousehold(uid);

  li.appendChild(btn);
}

function hideLeaveButton(li) {
  const btn = li.querySelector(".delete-btn");
  if (btn) {
    btn.style.display = "none"; 
  }
}

async function confirmLeaveHousehold(hid) {
  if (!confirm("确定要退出该 household 吗？")) return;

  const uid = currentUser.uid;

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

  const updatedUserDoc = await firebase.firestore()
  .collection("users")
  .doc(uid)
  .get();

  householdIds = updatedUserDoc.data().households || [];

  alert("已退出该 household");
  
  // Refresh list
  loadMyHouseholds();
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

function getDatePrefix(targetDate) {
  t = translations[currentLang];

  const today = new Date();

  // Normalize both dates to midnight
  today.setHours(0, 0, 0, 0);
  const time = new Date(targetDate);
  time.setHours(0, 0, 0, 0);

  // Difference in days
  const diffDays = Math.round((time - today) / (1000 * 60 * 60 * 24));

  let prefix = "";
  switch (diffDays) {
    case -2: prefix = t.datePrefixes[0]; break;
    case -1: prefix = t.datePrefixes[1]; break;
    case 0: prefix = t.datePrefixes[2]; break;
    case 1: prefix = t.datePrefixes[3]; break;
    case 2: prefix = t.datePrefixes[4]; break;
    default: prefix = ""; break;
  }

  return prefix;
}

const datetimeSelector = document.getElementById("datetime-selector");
const householdSelector = document.getElementById("household-selector");

const selectorList = [
  datetimeSelector,
  householdSelector,
];

let lastButton = null;

function createList(col, values) {
  col.innerHTML = ""; // clear existing items

  values.forEach(v => {
    const div = document.createElement("div");
    div.className = "dt-item";
    div.textContent = v;
    col.appendChild(div);
  });
}

/* Snap after scroll stops */
function ScrollToSelectItem(col, value=null) {
  // Helper to update selection
  function selectItem(item) {
    if (!item) return;
    [...col.querySelectorAll(".dt-item")].forEach(i => i.classList.remove("selected"));
    item.classList.add("selected");
    item.scrollIntoView({ block: "center", behavior: "smooth" });
  }

  // If a value was passed in, find the matching item
  if (value) {
    const items = [...col.querySelectorAll(".dt-item")];
    // If value is a number, compare numerically
    let target;
    if (typeof value === "number") {
      target = items.find(i => parseInt(i.textContent, 10) === value);
    } else {
      // Otherwise compare as string (trim to avoid whitespace issues)
      target = items.find(i => i.textContent.trim() === String(value));
    }

    if (target) {
      selectItem(target);
    }
  }

  // Wheel / trackpad scroll
  col.addEventListener("wheel", (e) => {
    e.preventDefault();   // stop the browser from scrolling the page
    e.stopPropagation();  // stop the event from bubbling up to parent elements
    const selected = col.querySelector(".dt-item.selected");
    if (!selected) return;

    if (e.deltaY > 0) {
      // scrolling down → next item
      selectItem(selected.nextElementSibling);
    } else if (e.deltaY < 0) {
      // scrolling up → previous item
      selectItem(selected.previousElementSibling);
    }

    updateSelectorPreview()
  }, { passive: false });

  // Touch swipe
  let touchStartY = null;
  col.addEventListener("touchstart", (e) => {
    e.preventDefault();   // stop the browser from scrolling the page
    e.stopPropagation();  // stop the event from bubbling up to parent elements
    touchStartY = e.touches[0].clientY;
    updateSelectorPreview()
  }, { passive: false });

  col.addEventListener("touchend", (e) => {
    e.preventDefault();   // stop the browser from scrolling the page
    e.stopPropagation();  // stop the event from bubbling up to parent elements
    if (touchStartY == null) return;
    const dy = e.changedTouches[0].clientY - touchStartY;
    const selected = col.querySelector(".dt-item.selected");
    if (!selected) return;

    if (dy < 0) {
      // finger moved up → content intended to scroll down → next item
      selectItem(selected.nextElementSibling);
    } else if (dy > 0) {
      // finger moved down → content intended to scroll up → previous item
      selectItem(selected.previousElementSibling);
    }
    touchStartY = null;
    updateSelectorPreview()
  }, { passive: false });
}

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

    inputTransactionTime = `${prefix}${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")} ` +
      `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;

    lastButton.textContent = inputTransactionTime;

    lastButton.dataset.value = dateObj.toISOString();

  } else if (lastButton.dataset.type === "household") {
    const hhEl = householdSelector.querySelector(".household-col .selected");

    if (!hhEl) return;

    const household = households.find(
      h => h.name.toLowerCase() === hhEl.textContent.toLowerCase()
    );

    if (household) {
      inputHouseholdId = household.id;           // use the id directly
      lastButton.textContent = household.name;
    }
  }
}

// Remove known prefixes
function removeDatePrefix(text) {
  t = translations[currentLang];

  const prefixes = t.datePrefixes || [];

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
})();

function initHouseholdSelector(households) {
  const col = document.querySelector("#household-selector .household-col");

  // Use names for display
  const names = households.map(h => h.name);

  createList(col, names);
}

function updateDayColumn() {
  const year = getSelectedValue(".year-col");
  const month = getSelectedValue(".month-col");

  const days = daysInMonth(year, month);

  const dayCol = datetimeSelector.querySelector(".day-col");
  createList(dayCol, Array.from({ length: days }, (_, i) => i + 1));
}

function getSelectedValue(selector) {
  const col = datetimeSelector.querySelector(selector);
  const selected = col.querySelector(".selected");
  return selected ? Number(selected.textContent) : null;
}

function daysInMonth(year, month) {
  return new Date(year, month, 0).getDate(); // elegant JS trick
}

function clickToSetNow() {
  const activeIndex = inputTypeIndex; // income=0, expense=1, transfer=2
  const formIds = ["expense-form", "income-form", "transfer-form"];
  const formId = formIds[activeIndex];

  let btn = document.querySelector(`#${formId} .selector-button[data-type='datetime']`);
  if (btn) setCurrentTime(btn);

  const { year, month, day, hour, minute } = parseButtonDate(btn);

  ScrollToSelectItem(datetimeSelector.querySelector(".year-col"), year);
  ScrollToSelectItem(datetimeSelector.querySelector(".month-col"), month);
  ScrollToSelectItem(datetimeSelector.querySelector(".day-col"), day);
  ScrollToSelectItem(datetimeSelector.querySelector(".hour-col"), hour);
  ScrollToSelectItem(datetimeSelector.querySelector(".minute-col"), minute);
}

/* Open selector */
document.querySelectorAll(".selector-button[data-type='datetime']").forEach(btn => {
  btn.addEventListener("click", e => {
    e.stopPropagation();
    lastButton = btn;

    // first hide all selectors
    selectorList.forEach(sel => {
      if (!sel.contains(e.target)) {
        sel.style.display = "none";
      }
    });

    // Show the desired selector
    datetimeSelector.style.display = "flex";

    const { year, month, day, hour, minute } = parseButtonDate(btn);

    ScrollToSelectItem(datetimeSelector.querySelector(".year-col"), year);
    ScrollToSelectItem(datetimeSelector.querySelector(".month-col"), month);
    updateDayColumn();
    ScrollToSelectItem(datetimeSelector.querySelector(".day-col"), day);
    ScrollToSelectItem(datetimeSelector.querySelector(".hour-col"), hour);
    ScrollToSelectItem(datetimeSelector.querySelector(".minute-col"), minute);
  });
});

document.querySelectorAll(".selector-button[data-type='household']")
  .forEach(btn => {
    btn.addEventListener("click", e => {
      e.stopPropagation();
      lastButton = btn;

      selectorList.forEach(sel => {
        if (!sel.contains(e.target)) {
          sel.style.display = "none";
        }
      });
      
      householdSelector.style.display = "flex";

      ScrollToSelectItem(householdSelector.querySelector(".household-col"), btn.textContent);
    });
  });

/* Close when clicking outside */
document.addEventListener("click", e => {
  if (!datetimeSelector.contains(e.target)) {
    datetimeSelector.style.display = "none";
  }
  if (!householdSelector.contains(e.target)) {
    householdSelector.style.display = "none";
  }
});

const itemGroup = document.querySelector(".item-group");

document.querySelectorAll(".item-group").forEach(group => {
  group.addEventListener("input", () => {
    // Collect all rows in this group
    const rows = group.querySelectorAll(".item-row");

    // Build array of {name, notes}
    const itemsArray = Array.from(rows).map(row => ({
      name: row.querySelector(".item-name").value.trim(),
      notes: row.querySelector(".item-notes").value.trim()
    }));

    // Merge into string
    inputItems = itemsArray.map(item => `${item.name}:${item.notes}`).join("|");
  });
});
