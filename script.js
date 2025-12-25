// Data structure: 
// profiles/{userId} // accessible to all
//   - email: string

// users/{userId} // accessible only to the current user
//   - profile
//       email: string
//       language: string
//       homeImages: string
//       fontsize: string
//   - households: [householdId]   // membership links

//   - defaults
//       /expense
//          householdId: string
//          categoryId: string
//          collectionId: string
//          accountId: string
//          personId: string
//       /income
//          householdId: string
//          categoryId: string
//          collectionId: string
//          accountId: string
//          personId: string
//       /transfer
//          fromAccountId: string
//          toAccountId: string
//          personId: string

// households/{householdId} // accessible to all users in the current household
//   - name: string
//   - members: [userId]           // array of user IDs

//   accounts (subcollection)
//     accounts/{accountId}
//       name: string
//       type: string ("cash" | "bank" | "credit")

//   expense-categories (subcollection) /{categoryId}
//       primary: string
//       secondary: [string]

//   income-categories (subcollection) /{categoryId}
//       primary: string
//       secondary: [string]

//   collections (subcollection) /{collectionId}
//       primary: string
//       secondary: [string]
// 
//   subjects (subcollection) /{personId}
//       name: string

//   tags (subcollection)/{tagId}
//     name: string
//     entryIds: list of entryIds

//   entries (subcollection)
//     entries/{entryId}
//       type: string ("income" | "expense" | "transfer")
//       category: string         // reference to categories/{categoryId}
//       accountId: string          // reference to accounts/{accountId}
//       personId: string           // reference to predefined persons
//       collection: string       // reference to collections/{collectionId}
//       datetime: timestamp
//       items: [ { name: string, notes: string, amount: number } ]
//       amount: number
//       createdBy: string          // userId
//       lastModifiedBy: string     // userId

let currentUser = null;
let userEmail = null;
let currentLang = 'zh';
let userDoc = null; // this variable will contain all data under this userId in the Users collection
let householdDocs = {}; // this variable will contain all data of each household to which this userId has access

let workspace = {} // use this variable to store temporary transaction data before being saved
//workspace = [
//   {
//     create: {
//       expense: {
//          typeIndex, 
//          type, 
//          householdId, 
//          datetime, 
//          primaryCategory, 
//          secondaryCategory, 
//          primaryAccount, 
//          secondaryAccount, 
//          subject, 
//          collection, 
//          tags, 
//          notes
//       },
//       income: {},
//       transfer: {},
//       balance: {},
//     }
//   }
// ];
const transactionTypes = ["expense", "income", "transfer", "balance"];
let expenseInputCategoryInnerHTML= "";
let incomeInputCategoryInnerHTML= "";
let inputNotes = null;

let currentBase = "home";
let latestPage = null;
let latestNavBtn = null;
let latestTitle = null;

const translations = {
  en: {
    loginTitle: "Login or Signup",
    email: "Email",
    password: "Password",
    signup: "Sign Up",
    login: "Login",
    forgotBtn: "Reset password",
    resetHint: "To reset your password, enter your email address above and click the reset button. Then check your inbox for further instructions.",
    back: "< Back",
    search: "🔍Search",
    welcome: "Welcome, ",
    homeTitle: "Home",
    monthBalance: "Nov · Balance",
    incomeMinusExpense: "Income - Expense",
    monthlySummary: "Income this month 0 | Expense this month 0",
    today: "Today",
    thisMonth: "This Month",
    thisYear: "This Year",
    transaction: "Transaction",
    expense: "Expense",
    income: "Income",
    transfer: "Transfer",
    balance: "Balance",
    type: "Type",
    household: "👥Household",
    category: "📁Category",
    account: "💳Account",
    time: "🕒Time",
    now: "Now",
    dismiss: "Dismiss ▼",
    datePrefixes: ["2 days ago ", "Yesterday ", "Today ", "Tomorrow ", "In 2 days "],
    subject: "👤subject",
    collection: "🗂Collection",
    tags: "🏷Tags",
    enterTagName: "Enter tag name",
    exchangeRate: "Ex. Rate",
    transferFrom: "From",
    transferTo: "To",
    notes: "📝Notes",
    save: "✔️Save",
    basicSettingsTitle: "Basic Settings",
    openBasicSettings: "Open Basic Settings",
    timestampNotes: "The timestamps below indicate the most recent edit times of data retrieved during your last online session. Please note that, if you are offline, these timestamps do not reflect edits made on this device, nor do they represent the latest edits on the server.",
    labels: "Labels",
    manageExpenseCategories: "Manage expense categories",
    manageIncomeCategories: "Manage income categories",
    manageCollections: "Manage collections",
    manageSubjects: "Manage subjects",
    primaryCategoryName: "Name for a primary category",
    secondaryCategoryName: "Name for a secondary category",
    createPrimaryCategory: "Create a new primary category",
    createSecondaryCategory: "Create a new secondary category",
    noPrimaryCategories: "No primary categories yet.",
    noSecondaryCategories: "No secondary categories yet.",
    cancel: "Cancel",
    myHouseholdsTitle: "My Households",
    renameHousehold: "Rename My household",
    confirmRename: "Confirm",
    householdRenamed: "Your household has been renamed",
    householdRenameFailed: "Failed to rename household",
    inviteHousehold: "Invite users to my household",
    inviteNote: "Note: Invitees may only join the household that you created, not the ones that you were invited to.",
    inviteEmailPlaceholder: "Enter invitee email",
    confirmInvite: "Confirm invitation",
    manageHousehold: "Remove users from my household",
    memberManagement: "Manage members",
    leaveHousehold: "Remove myself from other users' households",
    othersHousehold: "Other users' households",
    leave: "Leave",
    language: "Language",
    languageSwitched: "Language switched to English",
    languageSwitchFailed: "Failed to save language",
    fontsizeTitle: "Fontsize",
    fontsizeChanged: "Fontsize changed",
    fontsizeChangeFailed: "Failed to save fontsize",
    themeColorTitle: "Theme Color",
    themeColorChange: "Change theme color",
    restoreDefault: "Restore default",
    themeColorChanged: "Theme color changed",
    themeColorChangeFailed: "Failed to save theme color",
    colorSchemeTitle: "Color Scheme",
    colorSchemeOptions: ["Income Red / Expense Blue", "Income Blue / Expense Red"],
    colorSchemeSwitched: "Color scheme is now changed",
    colorSchemeSwitchFailed: "Failed to save color scheme",
    homeImageTitle: "Homepage Image",
    manage: "Manage",
    add: "Add",
    delete: "Delete",
    homeImageInstruction: "You may add the URL links to the online pictures you would like to use here.",
    homeImageSaved: "Homepage images saved",
    homeImageSaveFailed: "Failed to save homepage images",
    logout: "Logout",
    deleteAccount: "Delete my account",
    navHome: "Home",
    navAccounts: "Accounts",
    navTransaction: "Create",
    navUtilities: "Utilities",
    settings: "Settings",
    about: "About",
    help: "Help",
    helpContent: `
      <h2>Help</h2>
      <p>A <strong>collection</strong> groups <strong>entries</strong> of the same nature across different <strong>types</strong> togother. You can view <strong>entries</strong> organized by <strong>collections</strong> in <strong>dashboards</strong>.</p>
      <p><strong>Tags</strong> are flexible labels you can assign to <strong>entries</strong>. When you search for a keyword, any <strong>tags</strong> containing that keyword will appear in the results.</p>
      <p>While <strong>collections</strong> and <strong>tags</strong> may look similar, they serve different purposes:
      <ul>
        <li>The <strong>collection</strong> of an <strong>entry</strong> is usually fixed and used for categorization. Each <strong>entry</strong> belongs to only one <strong>collection</strong>.</li>
        <li><strong>Tags</strong> are flexible and used for temporary and miscellaneous grouping. You may attach any <strong>tag</strong> to an <strong>entry</strong>. Each <strong>entry</strong> can carry multiple <strong>tags</strong>.</li>
      </ul>
      </p>
    `,
    acknowledgements: "Acknowledgements", 
    acknowledgementsContent: `
      <h2>Acknowledgements</h2>
      <p>This web app would not have been possible without the following services:</p>
      <ul>
        <li><strong><a href="https://github.com" target="_blank" rel="noopener noreferrer">GitHub</a></strong> — for hosting the webpage code repository</li>
        <li><strong><a href="https://firebase.google.com" target="_blank" rel="noopener noreferrer">Firebase</a></strong> — for hosting and managing user data</li>
        <li><strong><a href="https://vercel.com" target="_blank" rel="noopener noreferrer">Vercel</a></strong> — for deploying and hosting the live web app</li>
        <li><strong><a href="https://copilot.microsoft.com" target="_blank" rel="noopener noreferrer">Copilot</a></strong> — for assisting with coding and development</li>
      </ul>
    `,
    privacy: "Privacy Statement",
    privacyContent: `
      <h2>Privacy Statement</h2>
      <p>User data are <strong>securely stored in Firebase</strong>. Access permissions are as follows:</p>
      <ul>
        <li><strong>Personal preferences</strong> — visible only to the individual user and the project owner (Xiaoxin Chen).</li>
        <li><strong>Household data</strong> — visible to users within the same household and the project owner (Xiaoxin Chen).</li>
      </ul>
      <p>
        Xiaoxin Chen is currently the sole administrator of this app and therefore the only person with access to data through the Firebase Console. 
        By <a href="https://firebase.google.com/docs/projects/iam/roles-basic" target="_blank" rel="noopener noreferrer">Firebase’s design and policy</a>, the project owner <strong>must have full administrative access</strong> to all hosted data. 
        Therefore, Xiaoxin Chen can access all data through the console. 
        However, he is committed to strictly following his personal ethical code and <strong>will not view or disclose any user or household data</strong>.
      </p>
      <p>
        To protect against unauthorized access, the project owner’s Firebase account is secured through Google login with 
        <strong>two‑step verification enabled</strong>. This means that even if hackers attempt to break in, they cannot gain access without the second verification step.
      </p>
      <p>
        For any concerns or questions, please contact the project owner at: 
        <a href="mailto:jerryc1994@hotmail.com" target="_blank" rel="noopener noreferrer">jerryc1994@hotmail.com</a>.
      </p>
    `
  },
  zh: {
    loginTitle: "登录或注册",
    email: "邮箱",
    password: "密码",
    signup: "注册",
    login: "登录",
    forgotBtn: "重置密码",
    resetHint: "如需重置密码，请先输入您的邮箱地址并点击重置按钮，然后查看您的邮箱，按照邮件中的提示完成操作",
    back: "< 返回",
    search: "🔍搜索",
    welcome: "欢迎，",
    homeTitle: "首页",
    monthBalance: "11月·结余",
    incomeMinusExpense: "收入 - 支出",
    monthlySummary: "本月收入 0 | 本月支出 0",
    today: "今天",
    thisMonth: "本月",
    thisYear: "本年",
    transaction: "交易",
    expense: "支出",
    income: "收入",
    transfer: "转账",
    balance: "余额",
    household: "👥家庭",
    category: "📁分类",
    account: "💳账户",
    time: "🕒时间",
    now: "现在",
    dismiss: "收起 ▼",
    datePrefixes: ["前天 ", "昨天 ", "今天 ", "明天 ", "后天 "],
    subject: "👤主体",
    collection: "🗂项目",
    tags: "🏷标签",
    enterTagName: "输入标签名称",
    exchangeRate: "汇率",
    transferFrom: "转出",
    transferFrom: "转入",
    notes: "📝备注",
    save: "✔️保存",
    basicSettingsTitle: "基础设置",
    openBasicSettings: "打开基础设置",
    timestampNotes: "以下时间戳表示上次联网时获取的数据的最新编辑时间。请注意，如果您正处于离线状态，这些时间戳既不代表本设备上的最新编辑时间，也不代表服务器端的最新编辑时间。",
    labels: "类别",
    manageExpenseCategories: "管理支出分类",
    manageIncomeCategories: "管理收入分类",
    manageCollections: "管理项目",
    manageSubjects: "管理交易对象（交易主体）",
    primaryCategoryName: "一级分类名称",
    secondaryCategoryName: "二级分类名称",
    createPrimaryCategory: "新建一级分类",
    createSecondaryCategory: "新建二级分类",
    noPrimaryCategories: "暂无一级分类",
    noSecondaryCategories: "暂无二级分类",
    cancel: "取消",
    myHouseholdsTitle: "我的家庭",
    renameHousehold: "重命名我的家庭",
    confirmRename: "确认修改",
    householdRenamed: "家庭名称已修改",
    householdRenameFailed: "家庭名称保存出错",
    inviteHousehold: "邀请加入我的家庭",
    inviteNote: "注意：受邀用户只能加入您创建的家庭，不能加入您受邀参与的家庭。",
    inviteEmailPlaceholder: "输入对方的邮箱",
    confirmInvite: "确认邀请",
    manageHousehold: "从我的家庭中移除用户",
    memberManagement: "成员管理",
    leaveHousehold: "将我从他人的家庭中移除",
    othersHousehold: "他人的家庭",
    leave: "离开",
    language: "语言",
    languageSwitched: "语言已切换为 中文",
    languageSwitchFailed: "语言保存出错",
    fontsizeTitle: "字体大小",
    fontsizeChanged: "字体大小已更改",
    fontsizeChangeFailed: "字体大小保存出错",
    themeColorTitle: "主题色",
    themeColorChange: "更换主题色",
    restoreDefault: "恢复默认",
    themeColorChanged: "主题色已更改",
    themeColorChangeFailed: "主题色保存出错",
    colorSchemeTitle: "颜色方案",
    colorSchemeOptions: ["收入红 / 支出蓝", "收入蓝 / 支出红"],
    colorSchemeSwitched: "颜色方案已更新",
    colorSchemeSwitchFailed: "颜色方案保存出错",
    homeImageTitle: "首页图",
    manage: "管理",
    add: "增加",
    delete: "删除",
    homeImageInstruction: "您可在此处添加您想要使用的在线图片链接。",
    homeImageSaved: "首页图链接已保存",
    homeImageSaveFailed: "首页图保存出错",
    logout: "退出登录",
    deleteAccount: "删除账户",
    navHome: "首页",
    navAccounts: "账户",
    navTransaction: "记一笔",
    navUtilities: "工具",
    settings: "设置",
    about: "关于",
    help: "使用帮助",
    helpContent: `
      <h2>使用帮助</h2>
      <p><strong>项目</strong>可将性质相同的<strong>条目</strong>组合在一起，不论<strong>类型</strong>。你可以在<strong>看板</strong>中按<strong>项目</strong>类别查看<strong>条目</strong>。</p>
      <p><strong>标签</strong>可用于灵活地标记<strong>条目</strong>。当你搜索某个关键词时，任何包含该关键词的<strong>标签</strong>都会出现在结果中。</p>
      <p><strong>项目</strong>和<strong>标签</strong>乍一看很相似，但它们并不一样：
      <ul>
        <li><strong>项目</strong>通常是固定的，作分类用途。每个<strong>条目</strong>只属于一个<strong>项目</strong>。</li>
        <li><strong>标签</strong>较为灵活，可用于暂时的、各种各样的分组。你可以通过<strong>标签</strong>来随意标记每个<strong>条目</strong>。一个<strong>条目</strong>可同时拥有多个<strong>标签</strong>。</li>
      </ul>
      </p>
    `,
    acknowledgements: "致谢", 
    acknowledgementsContent: `
      <h2>致谢</h2>
      <p>本网页应用的实现离不开以下服务：</p>
      <ul>
        <li><strong><a href="https://github.com" target="_blank" rel="noopener noreferrer">GitHub</a></strong> —— 用于托管网页代码仓库</li>
        <li><strong><a href="https://firebase.google.com" target="_blank" rel="noopener noreferrer">Firebase</a></strong> —— 用于托管和管理用户数据</li>
        <li><strong><a href="https://vercel.com" target="_blank" rel="noopener noreferrer">Vercel</a></strong> —— 用于部署和托管线上网页应用</li>
        <li><strong><a href="https://copilot.microsoft.com" target="_blank" rel="noopener noreferrer">Copilot</a></strong> —— 用于协助编码与开发</li>
      </ul>
    `,
    privacy: "隐私",
    privacyContent: `
      <h2>隐私声明</h2>
      <p>用户数据<strong>安全地存储在 Firebase</strong>。访问权限如下：</p>
      <ul>
        <li><strong>个人偏好</strong> —— 仅用户本人和项目所有者（Xiaoxin Chen）可见。</li>
        <li><strong>家庭数据</strong> —— 同一家庭的用户以及项目所有者（Xiaoxin Chen）可见。</li>
      </ul>
      <p>
        Xiaoxin Chen 目前是本应用的唯一管理员，因此也是唯一能够通过 Firebase 控制台访问数据的人。 
        根据 <a href="https://firebase.google.com/docs/projects/iam/roles-basic" target="_blank" rel="noopener noreferrer">Firebase 的设计和政策</a>，项目所有者<strong>必须拥有对所有托管数据的完整管理权限</strong>。 
        因此，Xiaoxin Chen 可以通过控制台访问所有数据。 
        然而，他承诺严格遵守个人的道德准则，<strong>不会查看或泄露任何用户或家庭数据</strong>。
      </p>
      <p>
        为防止未经授权的访问，项目所有者的 Firebase 帐号通过 Google 登录并启用了<strong>双重验证</strong>。 
        这意味着即使黑客尝试入侵，没有第二步验证也无法获得帐号访问权限。
      </p>
      <p>
        如有任何疑问或问题，请联系项目所有者： 
        <a href="mailto:jerryc1994@hotmail.com" target="_blank" rel="noopener noreferrer">jerryc1994@hotmail.com</a>。
      </p>
    `
  }
};

window.translations = translations;
window.currentLang = currentLang;

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/service-worker.js')
    .then(() => console.log('Service Worker registered'));
}

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

// --- Firebase Initialization ---
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyChPQagMV5rQ9CmHA2vJZ8BUw8sojAbFDo",
  authDomain: "xiaoxin-s-ledger-app-ed5ea.firebaseapp.com",
  projectId: "xiaoxin-s-ledger-app-ed5ea",
  storageBucket: "xiaoxin-s-ledger-app-ed5ea.firebasestorage.app",
  messagingSenderId: "571079523490",
  appId: "1:571079523490:web:039d2d334230a764f2abfb",
  measurementId: "G-RXX64YWRZX"
};

// import functions
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";
import { 
  getAuth, 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  sendPasswordResetEmail, 
  signOut, 
  onAuthStateChanged,
  EmailAuthProvider, 
  reauthenticateWithCredential
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";

import { 
  getFirestore, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs,
  updateDoc,
  deleteDoc,
  collection,
  query,
  where,
  arrayUnion,
  arrayRemove,
  enableIndexedDbPersistence 
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Get references to services
const auth = getAuth(app);
const db = getFirestore(app);

// Enable offline persistence
enableIndexedDbPersistence(db)
  .catch(err => {
    console.error("Persistence error:", err);
  });

navigator.serviceWorker.ready.then(() => {
  navigator.serviceWorker.addEventListener('message', event => {
    const banner = document.getElementById('offline-banner');
    const data = event.data;

    if (data.offline) {
      banner.textContent = `You are in offline mode. Check the data version you are using in Settings. New data will be uploaded when the internet becomes available.`;

      banner.style.display = 'block';
      const h = banner.offsetHeight; 
      document.documentElement.style.setProperty("--banner-height", h + "px")
    } else {
      banner.textContent = "";
      banner.style.display = 'none';
      document.documentElement.style.setProperty("--banner-height", "0px")
      }
  });
});

// --- Authentication ---
async function signup() {
  const email = document.getElementById("username").value;
  const password = document.getElementById("password").value;

  try {
    // ✅ Create user
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    const user = cred.user;
    const myHouseholdId = user.uid;

    // Localized household name
    const householdName = currentLang === "en"
      ? `${email}'s Ledger`
      : `${email}的账本`;

    // Document references
    const householdRef = doc(db, "households", myHouseholdId);
    const userRef = doc(db, "users", user.uid);
    const profileRef = doc(db, "profiles", user.uid);

    // Create all documents in parallel
    await Promise.all([
      // Household doc
      setDoc(householdRef, {
        name: householdName,
        admin: user.uid,
        members: [user.uid],
        lastSynced: "",

        accounts: {
          'Cash Accounts': [
            {name: 'Cash', icon: "", currency: "CNY", exclude: false, notes: "", "sub-accounts": []}
          ], 
          'Credit Cards': [
            {name: 'Credit Card', icon: "", currency: "CNY", statementDate: null, dueDate: null, creditLimit: null, exclude: false, notes: "", "sub-accounts": []}
          ],
          'Depository Accounts': [
            {name: 'Bank Acount', icon: "", currency: "CNY", exclude: false, notes: "", "sub-accounts": []}
          ],
          'Stored-Value Cards': [
            {name: 'Stored Value Card', icon: "", currency: "CNY", cardNumber: null, pin: null, exclude: false, notes: "", "sub-accounts": []}
          ],
          'Investment Accounts': [
            {name: 'Investment Acount', icon: "", currency: "CNY", exclude: false, notes: "", "sub-accounts": []}
          ]
        },
        "expense-categories": [
          {primary: "Shopping", icon: "🛍️", secondaries: [
            {name: "Offline Expenditure", icon: "🛒"},
            {name: "Online Shopping", icon: "🛒"},
          ]},
          {primary: "Travel", icon: "🚗", secondaries: [
            {name: "Public Transit", icon: "🚇"},
            {name: "Ride Services", icon: "🚕"},
            {name: "Fuel Costs", icon: "⛽"},
            {name: "Parking Costs", icon: "🅿️"},
            {name: "Auto Insurance", icon: "🚗"},
            {name: "Vechicle Purchase", icon: "🚗"},
            {name: "Vechicle Repair", icon: "🔧"},
            {name: "Flight & Train Tickets", icon: "✈️"},
            {name: "Lodging", icon: "🏨"},
          ]},
          {primary: "Entertainment", icon: "🎭", secondaries: [
            {name: "Music & Films", icon: "🎬"},
            {name: "Sightseeing", icon: "🗺️"},
          ]},
          {primary: "Subscriptions", icon: "🔄", secondaries: [
            {name: "Phone Bills", icon: "📱"},
            {name: "Streaming", icon: "📺"},
          ]},
          {primary: "Home", icon: "🏡", secondaries: [
            {name: "Housing", icon: "🏠"},
            {name: "Utilities", icon: "💡"},
            {name: "Home Insurance", icon: "🏠"},
            {name: "Decoration", icon: "🖼️"},
          ]},
          {primary: "Health", icon: "🏥", secondaries: [
            {name: "Hospitals & Clinics", icon: "🏥"},
            {name: "Medication", icon: "💊"},
            {name: "Health Insurance Premiums", icon: "🛡️"},
          ]},
          {primary: "Public Fees", icon: "🏛️", secondaries: [
            {name: "Tuition & Exams", icon: "🎓"},
            {name: "Tax Payment", icon: "🧾"},
            {name: "Pension Contribution", icon: "🪙"},
            {name: "Professional Expenses", icon: "🏛️"},
          ]},
          {primary: "Personal Spending", icon: "💇", secondaries: [
            {name: "Haircut", icon: "💇"},
            {name: "Laundry", icon: "🧺"},
          ]},
          {primary: "Gifts & Investments", icon: "💸", secondaries: [
            {name: "Outgoing Transfer", icon: "💸"},
            {name: "Gifts", icon: "🎁"},
            {name: "Donations", icon: "🎁"},
            {name: "Insurance Payments", icon: "💵"},
            {name: "Investment Loss", icon: "📉"},
          ]},
        ],
        "income-categories": [
          {primary: "Professional Income", icon: "💼", secondaries: [
            {name: "Pay", icon: "💵"},
            {name: "Scholarships & Awards", icon: "🏅"},
          ]},
          {primary: "Floating Income", icon: "🎉", secondaries: [
            {name: "Investment Earnings", icon: "📈"},
            {name: "Giveaways", icon: "🎉"},
            {name: "Red Packet Receipts", icon: "🧧"},
          ]},
          {primary: "Refunds", icon: "💰", secondaries: [
            {name: "Tax Credits", icon: "💰"},
            {name: "Reimbursement", icon: "↩️"},
            {name: "Insurance Payout", icon: "💰"},
          ]},
          {primary: "Pocket Money", icon: "🪙", secondaries: [
            {name: "Incoming Transfer", icon: "💰"},
          ]},
        ],
        collections: [
          {name: "Food & Drinks", icon: "🍽️"},
          {name: "Life Expenditure", icon: "🧩"},
          {name: "Housing", icon: "🏡"},
          {name: "Pay", icon: "💵"},
          {name: "Scholarships & Awards", icon: "🏅"},
          {name: "Tax-Free Investments", icon: "📈"},
          {name: "Taxable Investments", icon: "📈"},
          {name: "Gifts", icon: "🎁"},
          {name: "Medical Expenses", icon: "🏥"},
          {name: "Transportation", icon: "🚗"},
          {name: "Travel Expenses", icon: "✈️"},
          {name: "Entertainment", icon: "🎭"},
          {name: "Phone Bills", icon: "📱"},
          {name: "Electronic Devices", icon: "💻"},
          {name: "Subscriptions", icon: "🔄"},
          {name: "Pension", icon: "💰"},
          {name: "Tax & Credits", icon: "🧾"},
          {name: "Public Fees", icon: "🏛️"},
          {name: "Incoming Transfer", icon: "💰"},
          {name: "Outgoing Transfer", icon: "💸"},
          {name: "Refunds", icon: "🔄"},
          {name: "Work Expenses", icon: "💼"},
        ],
        subjects: [
          {name: "Myself", icon: "🙂"},
          {name: "Partner", icon: "❤️"},
          {name: "Children", icon: "🧒"},
          {name: "Parents", icon: "👨‍👩‍👦"},
          {name: "Family", icon: "👪"},
          {name: "Friends", icon: "🧑‍🤝‍🧑"},
          {name: "Neighbourhood", icon: "🏘️"},
        ],
        tags: [],
        entries: [],
      }),

      // Profile doc
      setDoc(profileRef, { email }),

      // User doc
      setDoc(userRef, {
        profile: {
          email,
          language: currentLang,
          homeImages: [],
          fontsize: "",
          themeColor: "",
          settings: {}
        },
        personalHouseholdId: myHouseholdId,
        households: [myHouseholdId],

        defaults: {
          expense: {},
          income: {},
          transfer: {},
          balance: {}
        }
      })
    ]);

  } catch (error) {
    showStatusMessage(error.message, "error");
  }
}
window.signup = signup;

function login() {
  const email = document.getElementById("username").value;
  const password = document.getElementById("password").value;

  signInWithEmailAndPassword(auth, email, password)
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
          console.log(error);
      }

      showStatusMessage(message, 'error');
    });
}
window.login = login;

function resetPassword() {
  const email = document.getElementById("username").value;

  sendPasswordResetEmail(auth, email)
    .then(() => {
      alert("Password reset email sent!");
    })
    .catch((error) => {
      console.error(error.code, error.message);
      alert("Error: " + error.message);
    });
}
window.resetPassword = resetPassword;

function logout() {
  signOut(auth).then(() => {
    window.location.reload();
  });
}
window.logout = logout;

async function syncData(userId) {
  let lastSyncStatus = {};

  console.time("Retrieve data from Firebase");

  // --- Fetch user doc ---
  const userRef = doc(db, "users", userId);
  const userSnap = await getDoc(userRef);
  const userDoc = userSnap.data();

  // Track whether the user document came from server
  let freshFromServer = userSnap.metadata.fromCache === false;
  if (freshFromServer) {
    lastSyncStatus["个人偏好（基础设置）"] = userDoc.profile.lastSynced
  }

  const householdIds = userDoc.households

  // --- Fetch household docs ---
  const householdDocs = {};
  await Promise.all(
    householdIds.map(async (hid) => {
      freshFromServer = false; // initialize this variable for every household

      const hRef = doc(db, "households", hid);
      const hSnap = await getDoc(hRef);

      householdDocs[hid] = hSnap.exists() ? hSnap.data() : null;

      // If a household doc came from server, mark it as fresh
      if (hSnap.metadata.fromCache === false) {
        freshFromServer = true;
        if (freshFromServer) {
          lastSyncStatus[householdDocs[hid].name] = householdDocs[hid].lastSynced
        }
      }
    })
  );

  console.timeEnd("Retrieve data from Firebase");

  // assuming userDoc and householdDocs will always face the same online/offline connection
  if (Object.keys(lastSyncStatus).length > 0) {// if it's not empty
    localStorage.setItem("lastSyncStatus", JSON.stringify(lastSyncStatus));
  }

  return { userDoc, householdDocs };
}

// --- Persistent login state ---
onAuthStateChanged(auth, async (user) => {
  if (user) {
    currentUser = user;

    ({ userDoc, householdDocs } = await syncData(user.uid));

    // Initialize household selector
    initHouseholdSelector();
    toggleHouseholdFormRows();

    userEmail = userDoc.profile.email;

    // UI updates
    document.getElementById("login-section").style.display = "none";
    document.querySelector(".bottom-nav").style.display = "flex";

    // Apply profile settings
    displayHomeImage()

    if (userDoc.profile.language) {
      currentLang = userDoc.profile.language;
      setLanguage(currentLang, false, false);
    }

    if (isMobileBrowser()) {
      if (userDoc.profile.fontsizeMobile) {
        document.documentElement.style.setProperty("--font-size", userDoc.profile.fontsizeMobile);
      }
    } else {
      if (userDoc.profile.fontsizeDesktop) {
        document.documentElement.style.setProperty("--font-size", userDoc.profile.fontsizeDesktop);
      }
    }

    if (userDoc.profile.themeColor) {
      applyThemeColor(userDoc.profile.themeColor, false)
    }

    if (userDoc.profile.colorScheme) {
      setColorScheme(userDoc.profile.colorScheme, false, false);
      document.getElementById("color-scheme-select").value = userDoc.profile.colorScheme;
    }

    // ✅ Load main app
    showPage("home", "nav-home", "Xiaoxin's Ledger App");
    updateHomeKanban();
  } else {
    window.scrollTo(0, 0);
  }
});

function toggleHouseholdFormRows() {
  // Hide the form row if only one household
  const householdCount = Object.keys(householdDocs).length;
  if (householdCount === 1) {
    document.querySelectorAll('[id$="-household-form-row"]').forEach(row => {
      row.style.display = "none";
    });
  } else {
    document.querySelectorAll('[id$="-household-form-row"]').forEach(row => {
      row.style.display = "flex";
    });
  }
}

function displayHomeImage() {
  if (Array.isArray(userDoc.profile.homeImages) && userDoc.profile.homeImages.length > 0) {
      const img = document.getElementById("home-image");

      const randomIndex = Math.floor(Math.random() * userDoc.profile.homeImages.length);
      const randomUrl = userDoc.profile.homeImages[randomIndex].trim();

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
}

function timeAgo(rawTime) {
  const now = Date.now();
  const past = new Date(rawTime).getTime();
  const diff = Math.floor((now - past) / 1000); // seconds

  if (currentLang === "zh") {
    if (diff < 60) return `${diff} 秒前`;
    const minutes = Math.floor(diff / 60);
    if (minutes < 60) return `${minutes} 分钟前`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} 小时前`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days} 天前`;
    const weeks = Math.floor(days / 7);
    if (weeks < 4) return `${weeks} 周前`;
    const months = Math.floor(days / 30);
    if (months < 12) return `${months} 个月前`;
    const years = Math.floor(days / 365);
    return `${years} 年前`;
  } else { // English
    if (diff < 60) return `${diff} seconds ago`;
    const minutes = Math.floor(diff / 60);
    if (minutes < 60) return `${minutes} minutes ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} hours ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days} days ago`;
    const weeks = Math.floor(days / 7);
    if (weeks < 4) return `${weeks} weeks ago`;
    const months = Math.floor(days / 30);
    if (months < 12) return `${months} months ago`;
    const years = Math.floor(days / 365);
    return `${years} years ago`;
  }
}

document.getElementById("display-last-synced").addEventListener("click", () => {
  const t = translations[currentLang];

  const container = document.getElementById("last-synced-text");
  
  // If already visible → hide it 
  if (container.innerHTML.trim() !== "") { 
    container.innerHTML = ""; 
    return; 
  }
  
  const lastSyncStatus = JSON.parse(localStorage.getItem("lastSyncStatus"));
  
  const notes = document.createElement("div"); 
  notes.style.color = "var(--muted)"; 
  notes.style.fontStyle = "italic"; 
  container.appendChild(notes);

  if (lastSyncStatus !== null) { // it exists   
    notes.textContent = t.timestampNotes;
    
    const blank = document.createElement("div"); 
    blank.style.height = "0.8em";
    container.appendChild(blank);

    for (const label in lastSyncStatus) { 
      const syncInfo = lastSyncStatus[label];
      if (!syncInfo) continue;

      const local = syncInfo.formattedTime; // already formatted local time
      const ago = timeAgo(syncInfo.rawTime);

      const block = document.createElement("div");
      block.className = "last-synced-entry";

      block.innerHTML = `
        <div><strong>${label}</strong></div>
        <div style="margin-left: 1.2em;">
          <span style="color: var(--muted); font-style: italic;">${ago} · </span>  
          ${local}
        </div>
      `;

      container.appendChild(block);
    }
  } else { // it does not exist 
    console.log("lastSyncStatus is not found in localStorage"); 
    notes.textContent = "Last sync status is not found in the browser's localStorage."
  }  
});

function getFormattedTime() {
  const now = new Date();

  const localTime = now.toLocaleString(currentLang, {
    weekday: 'long',
    month: 'short',
    day: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZoneName: "short"
  })

  return {
    rawTime: now.getTime(),
    formattedTime: localTime
  };
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

function setDefaultHousehold(button) {
  // Only set default if the button has no content
  if (button && button.textContent.trim() === "") {
    inputHouseholdId = households[0].id;
    button.textContent = households[0].name;
    button.dataset.value = households[0].id;
  } else {
    const type = transactionTypes[inputTypeIndex];
    const activeForm = type + "-form";
    let householdBtn = document.querySelector(`#${activeForm} .selector-button[data-type='household']`);
    const household = households.find(
      h => h.name.toLowerCase() === householdBtn.textContent.toLowerCase()
    );

    if (household) {
      inputHouseholdId = household.id;           // use the id directly
    }
  }
  console.log(inputHouseholdId)
}

function setDefaultCategory(button, type) {
  const cats = categoriesByHousehold[inputHouseholdId][type];

  let primaryCat = null;
  let secondaryCat = null;

  if (cats && cats.length > 0) {
    primaryCat = cats[0]; // first primary category

    if (primaryCat.secondaries && primaryCat.secondaries.length > 0) {
      secondaryCat = primaryCat.secondaries[0]; // first secondary category
    } else {
      secondaryCat = { emoji: "", name: "" };
    }
  } else {
    // no categories at all
    primaryCat = { emoji: "", primary: "" };
    secondaryCat = { emoji: "", name: "" };
  }

  // Safely extract values, defaulting to ""
  const primaryEmoji = primaryCat.emoji ? primaryCat.emoji : "";
  const secondaryEmoji = secondaryCat.emoji ? secondaryCat.emoji : "";

  // prepare the category columns
  const primaryCol   = categorySelector.querySelector(".primary-col");
  const secondaryCol = categorySelector.querySelector(".secondary-col");

  const primaryList = cats.map(cat => ({
    emoji: cat.emoji || "",
    name:  cat.primary || ""
  }));

  createList(primaryCol, primaryList);
  updateSecondaryColumn(button, secondaryCol);

  // Only set default if the button has no innerHTML (or only whitespace)
  if (button && button.innerHTML.trim() === "") {
    if (type === "expense") {
      expenseInputPrimaryCategory   = primaryCat.primary;
      expenseInputSecondaryCategory = secondaryCat.name;

      expenseInputCategoryInnerHTML = `
        <span class="cat-part">${primaryEmoji} ${expenseInputPrimaryCategory}</span>
        <span class="cat-separator">&gt;</span>
        <span class="cat-part">${secondaryEmoji} ${expenseInputSecondaryCategory}</span>
      `;

      button.innerHTML = expenseInputCategoryInnerHTML;

    } else if (type === "income") {
      incomeInputPrimaryCategory   = primaryCat.primary;
      incomeInputSecondaryCategory = secondaryCat.name;

      incomeInputCategoryInnerHTML = `
        <span class="cat-part">${primaryEmoji} ${incomeInputPrimaryCategory}</span>
        <span class="cat-separator">&gt;</span>
        <span class="cat-part">${secondaryEmoji} ${incomeInputSecondaryCategory}</span>
      `;

      button.innerHTML = incomeInputCategoryInnerHTML;
    }
  }
}

const wrapper = document.getElementById("transaction-wrapper");
const tabButtons = document.querySelectorAll(".tab-btn");

function vibrate(ms) {
  if (typeof navigator.vibrate === "function") { // checks whether the browser supports vibration
    navigator.vibrate(ms); // milliseconds
  }
}

function switchTab(index) {
  inputTypeIndex = index;
  wrapper.style.transform = `translateX(-${index * 105}%)`; // this includes the 5% gap in class .transaction-wrapper

  // Update active button
  tabButtons.forEach(btn => btn.classList.remove("active"));
  tabButtons[index].classList.add("active");

  vibrate(30); // milliseconds

  // Find the active tab container
  const activeTab = document.querySelectorAll(".transaction-page")[index];

  // household
  const householdEl = activeTab.querySelector(".selector-button[data-type='household']");

  setDefaultHousehold(householdEl);

  // initialize category columns and button text
  const type = transactionTypes[inputTypeIndex];
  const activeForm = type + "-form";
  if (type === "income" || type === "expense") {
    let categoryBtn = document.querySelector(`#${activeForm} .selector-button[data-type='category']`);
    setDefaultCategory(categoryBtn, type);
  }

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

  // notes
  const notesEl = activeTab.querySelector("textarea[id$='notes']");
  if (notesEl && inputNotes) {
    notesEl.value = inputNotes;
  }
}

// Button click
tabButtons.forEach(btn => {
  btn.addEventListener("click", () => {
    switchTab(parseInt(btn.dataset.index));
  });
});

// Swipe support
let startX = 0;
let endX = 0;

wrapper.addEventListener("touchstart", e => {
  // do not add preventDefault otherwise the selectors won't show!
  // e.preventDefault();   // stop the browser from scrolling the page
  startX = e.touches[0].clientX;
});

wrapper.addEventListener("touchend", e => {
  // do not add preventDefault otherwise the selectors won't show!
  // e.preventDefault();   // stop the browser from scrolling the page
  endX = e.changedTouches[0].clientX;
  let diff = startX - endX;

  if (Math.abs(diff) > 50) {
    if (diff > 0 && inputTypeIndex < (tabButtons.length - 1)) switchTab(inputTypeIndex + 1);
    if (diff < 0 && inputTypeIndex > 0) switchTab(inputTypeIndex - 1);
  }

  startX = 0;
  endX = 0;
});

const fieldMap = {
  expense: {
    household: "expense-household",
    amount: "expense-amount",
    account: "expense-account",
    datetime: "expense-datetime",
    person: "expense-person",
    notes: "expense-notes"
  },
  income: {
    household: "income-household",
    amount: "income-amount",
    account: "income-account",
    datetime: "income-datetime",
    person: "income-person",
    notes: "income-notes"
  },
  transfer: {
    household: "transfer-household",
    amountSimple: "transfer-amount",
    amountFrom: "transfer-from-amount",
    amountTo: "transfer-to-amount",
    datetime: "transfer-datetime",
    fromAccount: "transfer-from",
    toAccount: "transfer-to",
    notes: "transfer-notes"
  },
  balance: {
    household: "balance-household",
    amount: "balance-amount",
    notes: "balance-notes"
  }
};

// Loop through each tag input container
document.querySelectorAll(".tag-input-container").forEach(container => {
  const input = container.querySelector("input");
  const button = container.querySelector("button");
  const suggestionsDiv = container.querySelector("div");

  // Listen for typing
  input.addEventListener("input", async (e) => {
    const text = e.target.value.trim();
    suggestionsDiv.innerHTML = "";

    if (text.length === 0) return;

    // v8 style: households/{householdId}/tags
    const tagsRef = db
      .collection("households")
      .doc(inputHouseholdId)
      .collection("tags");

    const snapshot = await tagsRef.get();

    snapshot.forEach(doc => {
      const tag = doc.data(); // { name, entryIds }
      if (tag.name && tag.name.includes(text)) {
        const span = document.createElement("span");
        span.textContent = tag.name;
        span.addEventListener("click", () => {
          input.value = tag.name;
        });
        suggestionsDiv.appendChild(span);
      }
    });
  });

  // Add button handler
  button.addEventListener("click", () => {
    const newTag = input.value.trim();
    if (!newTag) return;
    console.log("Add tag:", newTag, "for", container.className);
    // TODO: update Firestore entryIds here
  });
});

document.querySelectorAll('textarea').forEach(textarea => {
  textarea.addEventListener('input', function () {
    this.style.height = 'auto';              // reset height
    this.style.height = this.scrollHeight + 'px'; // set to content height

    inputNotes = this.value; // copy content into inputNotes
  });
});

// --- Ledger add entry ---
function addEntry() {
  if (!currentUser) return;

  const householdId = inputHouseholdId; // regardless of household name
  const type = transactionTypes[inputTypeIndex];

  // Read fields depending on type
  let inputPrimaryCategory, inputSecondaryCategory, account, person, fromAccount, toAccount;

  if (type === "expense") {
    const map = fieldMap[type];

    inputPrimaryCategory = expenseInputPrimaryCategory;
    inputSecondaryCategory = expenseInputSecondaryCategory;
    datetime = removeDatePrefix(document.getElementById(map.datetime).textContent);
    account = document.getElementById(map.account).value.trim();
    person = document.getElementById(map.person).value.trim();
    notes = document.getElementById(map.notes).value.trim();
  } else if (type === "income") {
    const map = fieldMap[type];

    inputPrimaryCategory = incomeInputPrimaryCategory;
    inputSecondaryCategory = incomeInputSecondaryCategory;
    datetime = removeDatePrefix(document.getElementById(map.datetime).textContent);
    account = document.getElementById(map.account).value.trim();
    person = document.getElementById(map.person).value.trim();
    notes = document.getElementById(map.notes).value.trim();
  } else if (type === "transfer") {
    const map = fieldMap.transfer;

    inputPrimaryCategory = "";
    inputSecondaryCategory = "";
    datetime = removeDatePrefix(document.getElementById(map.datetime).textContent);
    fromAccount = document.getElementById(map.fromAccount).value.trim();
    toAccount = document.getElementById(map.toAccount).value.trim();
    notes = document.getElementById(map.notes).value.trim();
  } else if (type === "balance") {
    const map = fieldMap.balance;

    inputPrimaryCategory = "";
    inputSecondaryCategory = "";
    notes = document.getElementById(map.notes).value.trim();
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

  // 🔑 Store transaction under selected household
  db.collection("households").doc(householdId).collection("entries").add({
    type,
    inputPrimaryCategory,
    inputSecondaryCategory,
    account,
    datetime,
    person,
    notes,
    createdBy: currentUser.uid,
    timestamp: firebase.firestore.FieldValue.serverTimestamp()
  }).then(() => {
    // Reset form
    document.getElementById("transaction-form").reset();
    updateHomeKanban(householdId); // pass householdId so kanban updates for that household
  }).catch(err => {
    console.error("Error adding transaction:", err);
    showStatus("添加交易失败");
  });
}
window.addEntry = addEntry;

function updateDatalist(id, values) {
  const datalist = document.getElementById(id);
  datalist.innerHTML = "";
  values.forEach(v => {
    const option = document.createElement("option");
    option.value = v;
    datalist.appendChild(option);
  });
}

// define base pages
const basePages = ["home", "accounts", "transaction", "utilities", "settings"];

// history stacks for each base page
let historyStacks = {
  home: [["home", "nav-home", "Xiaoxin's Ledger App"]],
  accounts: [["accounts", "nav-accounts", translations[currentLang].navAccounts]],
  transaction: [["transaction", "nav-transaction", translations[currentLang].navTransaction]],
  utilities: [["utilities", "nav-utilities", translations[currentLang].navUtilities]],
  settings: [["settings", "nav-settings", "Xiaoxin's Ledger App"]]
};

function showPage(name, navBtn = currentBase, title = latestTitle) {
  const t = translations[currentLang];

  // hide all pages
  document.getElementById("login-section").style.display = "none";
  document.querySelectorAll('.base-page').forEach(p => {
    if (p.id !== currentBase + "-page") {
      p.style.display = "none";
      p.classList.remove("active");
    }
  });
  document.getElementById("save-btn-headerbar").style.display = "none";
  document.getElementById("search-btn-headerbar").style.display = "none";
  document.getElementById("add-btn-headerbar").style.display = "none";

  let stack = null;
  let target = null;
  let latest = null;

  // reset nav button colors
  basePages.forEach(page => {
    document.getElementById(`nav-${page}`).style.background = "";
    document.getElementById(`nav-${page}`).classList.remove("active");
  });

  vibrate(30); // milliseconds

  if (basePages.includes(name)) { // when switching base nav, look for the latest stack
    if (currentBase !== name && latestPage != null) {
      // hide the current page
      document.getElementById(latestPage + "-page").style.display = "none";
      document.getElementById(currentBase + "-page").style.display = "none";
    }

    currentBase = name;
    stack = historyStacks[name];
    latest = stack ? stack[stack.length - 1] : [name, navBtn, title];
    [latestPage, latestNavBtn, latestTitle] = latest;
    target = document.getElementById(latestPage + "-page");

    if (!target) return;

    target.style.display = "block";
    if (basePages.includes(latestPage)) {
      target.classList.add('active');
    }

    if (stack.length < 2) { // if already returned to base
      document.getElementById("return-btn").style.display = "none";
    } else {
      document.getElementById("return-btn").style.display = "block";
    };

    if (stack.length < 3 && name === "home") { // at home page
      document.getElementById("search-btn-headerbar").style.display = "block";
    };

  } else { // if switching pages at the same base nav
    stack = historyStacks[currentBase];

    latestPage = name;
    latestTitle = title;
    target = document.getElementById(latestPage + "-page");

    if (!target) return;

    target.style.transform = "translateX(0%)";
    target.style.display = "block";
    target.zIndex = stack.length;
    enablePageSwipe(target);

    document.getElementById("return-btn").style.display = "block";

    // push a new history entry for this non-base page
    history.pushState({ page: latestPage, base: currentBase }, "", location.href);
  }

  document.getElementById("app-title").textContent = latestTitle;
  document.getElementById(navBtn).style.background = "var(--primary)";
  document.getElementById(navBtn).classList.add("active");

  let dateTimeBtn = null;

  // transaction page special handling
  if (latestPage.includes("transaction")) {        
    if (latestNavBtn === "nav-transaction") { // when creating an entry
      document.getElementById("app-title").textContent = t.navTransaction;

      const type = transactionTypes[0]; // start with expense
      const activeForm = type + "-form";
      dateTimeBtn = document.querySelector(`#${activeForm} .selector-button[data-type='datetime']`);
      let householdBtn = document.querySelector(`#${activeForm} .selector-button[data-type='household']`);
      let categoryBtn = document.querySelector(`#${activeForm} .selector-button[data-type='category']`);

      if (creatingTransaction === false) { // reset button texts when creating a new entry
        if (dateTimeBtn) {setCurrentTime(dateTimeBtn);};
        if (householdBtn) setDefaultHousehold(householdBtn);
        if (categoryBtn) setDefaultCategory(categoryBtn, type);
        creatingTransaction = true;
      }

    } else { // when loading an existing entry
      document.getElementById("app-title").textContent = t.transaction;

      // here there should be a line that reads inputType from record

      const type = transactionTypes[inputTypeIndex];
      const activeForm = type + "-form";
      dateTimeBtn = document.querySelector(`#${activeForm} .selector-button[data-type='datetime']`);
      switchTab(inputTypeIndex);
    }

    // prepare date time selector columns in advance
    const { year, month, day, hour, minute } = parseButtonDate(dateTimeBtn);
    ScrollToSelectItem(datetimeSelector.querySelector(".year-col"), year);
    ScrollToSelectItem(datetimeSelector.querySelector(".month-col"), month);
    updateDayColumn();
    ScrollToSelectItem(datetimeSelector.querySelector(".day-col"), day);
    ScrollToSelectItem(datetimeSelector.querySelector(".hour-col"), hour);
    ScrollToSelectItem(datetimeSelector.querySelector(".minute-col"), minute);
    
    document.getElementById("save-btn-headerbar").style.display = "block";
    document.querySelectorAll('.form-row label').forEach(label => {
      label.style.width = (currentLang === 'zh') ? '20%' : '25%';
    });

  } else if (latestPage === "manage-labels") {
    document.getElementById("add-btn-headerbar").style.display = "block";
  } else { // for all other pages

  }

  if (latestPage === "settings") {
    document.getElementById("settings-welcome").textContent = `${t.welcome}${userEmail}`;
  }

  stack = historyStacks[currentBase];
  // If reaching base page or the page is already active, do nothing
  const isBaseAndFresh = basePages.includes(latestPage) && stack.length < 2;
  const isAlreadyActive = stack?.[stack.length - 1]?.[0] === latestPage;
  if (!isBaseAndFresh && !isAlreadyActive) {
    historyStacks[currentBase].push([latestPage, navBtn, latestTitle]); // add to the history stacks
  }
}
window.showPage = showPage;

function goBack() {
  closeSelector();

  const stack = historyStacks[currentBase];
  if (stack.length > 1) {
    const target = document.getElementById(latestPage + "-page");
    target.style.transform = "translateX(110%)";
    stack.pop(); // remove current page

    const [prevPage, prevNavBtn, prevTitle] = stack[stack.length - 1]; // get the previous entry

    if (stack.length > 1) {
      stack.pop(); // remove the previous page as well because it will be added later if it is not a base nav page
    }

    showPage(prevPage, prevNavBtn, prevTitle);

    // replace state to reflect the new top of stack
    history.back();
  }
}
window.goBack = goBack;

async function loadLabels(type, title) {
  const t = translations[currentLang];

  const container = document.getElementById("labels-container");
  container.innerHTML = "";

  for (const householdId of userDoc.households) {
    const householdData = householdDocs[householdId];

    const block = document.createElement("div");
    block.classList.add("household-block");

    // Household name header
    const header = document.createElement("h3");
    header.textContent = householdData.name;
    block.appendChild(header);

    let primaryCategories = householdDocs[householdId][type];

    if (!primaryCategories || primaryCategories.length === 0) {
      const emptyMsg = document.createElement("button");
      emptyMsg.classList.add("primary-category");
      emptyMsg.textContent = t.noPrimaryCategories;
      emptyMsg.style.background = "none";
      block.appendChild(emptyMsg);
    } else {
      if (["expense-categories", "income-categories"].includes(type)) {
        for (const category of householdDocs[householdId][type]) {
          const [row, primaryWrapper] = createCategoryRow(category.primary, category.icon, block, block, householdId, type, title, false);

          let secondaryCategories = category.secondaries;
          if (!secondaryCategories || secondaryCategories.length === 0) {
            const emptyMsg = document.createElement("button");
            emptyMsg.classList.add("secondary-category");
            emptyMsg.textContent = t.noSecondaryCategories;

            const categoryWrapper = document.createElement("div");
            categoryWrapper.classList.add("secondary-wrapper");
            categoryWrapper.appendChild(emptyMsg);
            primaryWrapper.appendChild(categoryWrapper);

          } else {
            for (const secondaryCategory of category.secondaries) {
              const [secRow, secondaryWrapper] = createCategoryRow(secondaryCategory.name, secondaryCategory.icon, primaryWrapper, block, householdId, type, title, true, category.primary);
            }
          }

          // Allow adding a secondary
          const [secAddRow, secAddWrapper] = createAddCategoryRow(t.createSecondaryCategory, "➕", primaryWrapper, block, householdId, type, title, true, category.primary);
          primaryWrapper.appendChild(secAddWrapper);
        }
      } else {
        for (const label of householdDocs[householdId][type]) {
          console.log(type, label.name);
        };
      }
    }
    
    // Allow adding a primary
    const [addRow, addWrapper] = createAddCategoryRow(t.createPrimaryCategory, "➕", block, block, householdId, type, title, false);
    block.appendChild(addWrapper);
    
    container.appendChild(block);
    container.appendChild(document.createElement("hr"));
  }

  showPage("manage-labels", latestNavBtn, title);
}
window.loadLabels = loadLabels;

function createAddCategoryRow(name, icon, parentWrapper, block, householdId, type, title, isSecondary = false, parentName = null) {
  // wrapper for one row
  const categoryWrapper = document.createElement("div");
  categoryWrapper.classList.add(isSecondary ? "secondary-wrapper" : "category-wrapper");

  // inner row container
  const rowContent = document.createElement("div");
  rowContent.classList.add(isSecondary ? "secondary-category-row" : "primary-category-row");

  // main button
  const addBtn = document.createElement("button");
  addBtn.textContent = `${icon} ${name}`.trim();
  addBtn.classList.add(isSecondary ? "secondary-category" : "primary-category");
  
  // assemble row
  rowContent.appendChild(addBtn);

  // attach to wrapper
  categoryWrapper.appendChild(rowContent);
  parentWrapper.appendChild(categoryWrapper);

  addBtn.addEventListener("click", () => {
    // remove any existing input row
    const existingRow = block.querySelector(".labels-input-row");
    if (existingRow) existingRow.remove();

    // create a new empty input row
    const inputRow = createCategoryInputRow(householdId, type, title, {
      label: "",
      icon: "",
      isSecondary,
      parentName
    });

    rowContent.after(inputRow);
  });

  return [rowContent, categoryWrapper];
}

function createCategoryInputRow(householdId, type, title, options = {}) {
  // options: { primaryDocId, isSecondary, parentId, label, icon, onSave }
  const t = translations[currentLang];

  const inputRow = document.createElement("div");
  inputRow.classList.add("labels-input-row");

  // icon button
  const iconBtn = document.createElement("button");
  iconBtn.textContent = options.icon || "Icon";
  iconBtn.classList.add("labels-emoji-btn");

  iconBtn.addEventListener("click", (e) => {
    e.stopPropagation();

    // Always remove any existing wrapper before creating a new one
    const existingWrapper = document.querySelector(".emoji-picker-wrapper");
    if (existingWrapper) existingWrapper.remove();

    const wrapper = document.createElement("div");
    wrapper.classList.add("emoji-picker-wrapper");

    const picker = document.createElement("emoji-picker");
    picker.addEventListener("emoji-click", event => {
      iconBtn.textContent = event.detail.unicode;
      hideWrapper(wrapper);
    });

    const cancelBtn = document.createElement("button");
    cancelBtn.textContent = "Cancel";
    cancelBtn.addEventListener("click", () => hideWrapper(wrapper));

    wrapper.appendChild(picker);
    wrapper.appendChild(cancelBtn);

    inputRow.insertAdjacentElement("afterend", wrapper);
    requestAnimationFrame(() => wrapper.classList.add("show"));

    const outsideClickHandler = (ev) => {
      if (!wrapper.contains(ev.target) && ev.target !== emojiBtn) {
        hideWrapper(wrapper);
        document.removeEventListener("click", outsideClickHandler);
      }
    };
    document.addEventListener("click", outsideClickHandler);
  });

  // Text input
  const nameInput = document.createElement("input");
  nameInput.type = "text";
  if (options.isSecondary) {
    nameInput.placeholder = t.secondaryCategoryName;
  } else {
    nameInput.placeholder = t.primaryCategoryName;
  }
  nameInput.classList.add("labels-primary-input");
  if (options.label) {
    nameInput.value = options.label;
  }

  // Tick button
  const tickBtn = document.createElement("button");
  tickBtn.textContent = "✔︎";
  tickBtn.classList.add("labels-tick-btn");

  // Cancel button
  const cancelBtn = document.createElement("button");
  cancelBtn.textContent = "✘";
  cancelBtn.classList.add("labels-cancel-btn");
  
  cancelBtn.addEventListener("click", async () => {
    loadLabels(type, title);
  })

  tickBtn.addEventListener("click", async () => {
    const icon = iconBtn.textContent !== "Icon" ? iconBtn.textContent : "🏷️";
    const name = nameInput.value.trim();
    if (!name) {
      showStatusMessage("The input name must not be empty.", "error")
      return;
    }

    // check if this name is available
    const allCategories = householdDocs[householdId][type];
    const primaryNames = allCategories.map(c => c.primary); 
    console.log(allCategories)
    const secondaryNames = allCategories.flatMap(c => c.secondaries.map(s => s.name));
    console.log(secondaryNames)
    const allNames = [...primaryNames, ...secondaryNames];
    console.log(allNames)
    const valid = name === options.label || !allNames.includes(name)
    // valid if the new name is not same as any existing names, except the current name being edited

    if (!valid) {
      showStatusMessage("The input name must not match any existing catogories.", "error")
      return;
    }

    const categories = householdDocs[householdId][type];
    const householdRef = doc(db, "households", householdId);

    try {
      if (options.label && !options.isSecondary) {
        // Editing existing primary
        const updatedCategories = categories.map(cat => {
          if (cat.primary === options.label) {
            return {
              ...cat,
              primary: name,
              icon: icon,
            };
          }
          return cat;
        });

        await updateDoc(householdRef, {
          [type]: updatedCategories,
          lastSynced: getFormattedTime()
        });
      
      } else if (options.label && options.isSecondary) {
        // Editing existing secondary
        const updatedCategories = categories.map(cat => {
          if (cat.primary === options.parentName) {
            // update only the secondaries of this parent
            const updatedSecondaries = cat.secondaries.map(sec => {
              if (sec.name === options.label) {
                return {
                  ...sec,
                  name: name,
                  icon: icon,
                };
              }
              return sec;
            });

            return {
              ...cat,
              secondaries: updatedSecondaries
            };
          }

          return cat;
        });

        await updateDoc(householdRef, {
          [type]: updatedCategories,
          lastSynced: getFormattedTime()
        });

      } else if (!options.isSecondary) {
        // Adding a new primary
        const newCategory = {
          primary: name,
          icon: icon,
          secondaries: []
        };

        const updatedCategories = [...categories, newCategory];

        await updateDoc(householdRef, {
          [type]: updatedCategories,
          lastSynced: getFormattedTime()
        });

      } else {
        // Adding a new secondary under a primary
        const newSecondary = {
          name: name, 
          icon: icon
        };

        const updatedCategories = categories.map(cat => {
          if (cat.primary === options.parentName) {
            // append the new secondary
            return {
              ...cat,
              secondaries: [...cat.secondaries, newSecondary]
            };
          }
          return cat;
        });

        await updateDoc(householdRef, {
          [type]: updatedCategories,
          lastSynced: getFormattedTime()
        });

      }
      ({ userDoc, householdDocs } = await syncData(currentUser.uid));

      loadLabels(type, title);
    } catch (err) {
      console.error("Error saving category:", err);
    }
  });

  inputRow.appendChild(iconBtn);
  inputRow.appendChild(nameInput);
  inputRow.appendChild(tickBtn);
  inputRow.appendChild(cancelBtn);

  return inputRow;
}

function hideWrapper(wrapper) {
  wrapper.classList.remove("show"); // start fade out
  wrapper.addEventListener("transitionend", () => wrapper.remove(), { once: true });
}

function createCategoryRow(name, icon, parentWrapper, block, householdId, type, title, isSecondary = false, parentName = null) {
  // wrapper for one row
  const categoryWrapper = document.createElement("div");
  categoryWrapper.classList.add(isSecondary ? "secondary-wrapper" : "category-wrapper");

  // inner row container
  const rowContent = document.createElement("div");
  rowContent.classList.add(isSecondary ? "secondary-category-row" : "primary-category-row");

  // main button
  const btn = document.createElement("button");
  btn.textContent = `${icon} ${name}`.trim();
  btn.classList.add(isSecondary ? "secondary-category" : "primary-category");
  // Add identifiers 
  btn.dataset.name = name; 
  btn.dataset.type = isSecondary ? "secondary" : "primary";
  btn.dataset.parentName = parentName; 

  // edit + delete buttons
  const editBtn = document.createElement("button");
  editBtn.textContent = "✏️";
  editBtn.classList.add("label-edit-btn");

  const deleteBtn = document.createElement("button");
  deleteBtn.textContent = "🗑️";
  deleteBtn.classList.add("label-delete-btn");

  // assemble row
  rowContent.appendChild(btn);
  rowContent.appendChild(editBtn);
  rowContent.appendChild(deleteBtn);

  // attach to wrapper
  categoryWrapper.appendChild(rowContent);
  parentWrapper.appendChild(categoryWrapper);

  // === EDIT HANDLER ===
  editBtn.addEventListener("click", () => {
    // remove any existing input row
    const existingRow = block.querySelector(".labels-input-row");
    if (existingRow) existingRow.remove();

    // create a new input row with current values
    const inputRow = createCategoryInputRow(householdId, type, title, {
      label: name,
      icon: icon,
      isSecondary,
      parentName
    });

    rowContent.after(inputRow);
  });

  // === DELETE HANDLER ===
  deleteBtn.addEventListener("click", async () => {
    if (!confirm("Delete this category?")) return;
    const categories = householdDocs[householdId][type];
    const householdRef = doc(db, "households", householdId)

    try {
      if (isSecondary) {
        
        const updatedCategories = categories.map(cat => {
          if (cat.primary === parentName) {
            return {
              ...cat,
              secondaries: cat.secondaries.filter(sec => sec.name !== name)
            };
          }
          return cat;
        });

        await updateDoc(householdRef, {
          [type]: updatedCategories,
          lastSynced: getFormattedTime()
        });

      } else {
        const updatedCategories = categories.filter(cat => cat.primary !== name);

        await updateDoc(householdRef, {
          [type]: updatedCategories,
          lastSynced: getFormattedTime()
        });
      }
    } catch (err) {
      console.error("Error deleting category:", err);
    }

    ({ userDoc, householdDocs } = await syncData(currentUser.uid));

    loadLabels(type, title);
  });

  // gesture handling: swipe, right-click, or long press
  let startX = 0;
  btn.addEventListener("touchstart", e => {
    startX = e.touches[0].clientX;
  });
  btn.addEventListener("touchend", e => {
    const endX = e.changedTouches[0].clientX;
    if (startX - endX > 50) {
      // Remove "has-actions" from any wrapper
      block.querySelectorAll(".has-actions").forEach(wrapper => {
        wrapper.classList.remove("has-actions");
      });

      // Remove "show" from any edit/delete buttons
      block.querySelectorAll(".show").forEach(btn => {
        btn.classList.remove("show");
      });

      showActions(categoryWrapper, editBtn, deleteBtn);
    } else {
      hideActions(categoryWrapper, editBtn, deleteBtn);
    }
  });

  let pressTimer;
  let longPress = false;
  let isDragging = false;

  // RIGHT CLICK
  btn.addEventListener("contextmenu", e => {
    if (longPress) {
      // ignore the click triggered after long press
      longPress = false;
      e.preventDefault();
      return;
    }

    e.preventDefault();
    const isVisible = categoryWrapper.classList.contains("has-actions"); 
    if (isVisible) { 
      hideActions(categoryWrapper, editBtn, deleteBtn); 
    } else { 
      // Remove "has-actions" from any wrapper
      block.querySelectorAll(".has-actions").forEach(wrapper => {
        wrapper.classList.remove("has-actions");
      });

      // Remove "show" from any edit/delete buttons
      block.querySelectorAll(".show").forEach(btn => {
        btn.classList.remove("show");
      });

      showActions(categoryWrapper, editBtn, deleteBtn); 
    }
  });

  // LEFT CLICK
  btn.addEventListener("click", e => {
    if (longPress) {
      // ignore the click triggered after long press
      longPress = false;
      return;
    }

    e.preventDefault();
    hideActions(categoryWrapper, editBtn, deleteBtn);
  });

  // LONG PRESS
  btn.addEventListener("mousedown", () => {
    longPress = false;

    pressTimer = setTimeout(() => {
      if (isDragging) return; // prevent long press during drag

      longPress = true;

      // Clear any existing actions
      block.querySelectorAll(".has-actions").forEach(w => w.classList.remove("has-actions"));
      block.querySelectorAll(".show").forEach(b => b.classList.remove("show"));

      showActions(categoryWrapper, editBtn, deleteBtn);
    }, 600);
  });

  btn.addEventListener("mouseup", () => clearTimeout(pressTimer));
  btn.addEventListener("mouseleave", () => clearTimeout(pressTimer));

  let lastPointerType = "mouse";

  btn.addEventListener("pointerdown", e => {
    lastPointerType = e.pointerType; // "mouse" | "touch" | "pen"
  });

  // === Dragging ===
  btn.setAttribute("draggable", true);

  btn.addEventListener("dragstart", e => {
    if (lastPointerType !== "mouse") { 
      e.preventDefault(); 
      return; // skip drag on touch or pen 
    }

    isDragging = true; // mark drag started 
    clearTimeout(pressTimer); // cancel long press immediately 
    longPress = false; // ensure no long-press logic fires

    if (!isSecondary) {
      block.querySelectorAll(".secondary-wrapper").forEach(w => {
        w.style.display = "none";
      });
    }

    // On dragstart, store what is being dragged
    e.dataTransfer.setData("drag-name", btn.dataset.name); 
    e.dataTransfer.setData("drag-type", btn.dataset.type);
    e.dataTransfer.setData("drag-parent", btn.dataset.parentName);

    btn.classList.add("dragging");
  });

  btn.addEventListener("dragover", e => {
    if (lastPointerType !== "mouse") return;
    e.preventDefault(); // required
  });

  btn.addEventListener("drop", async e => {
    if (lastPointerType !== "mouse") return;
    e.preventDefault();

    const draggedName   = e.dataTransfer.getData("drag-name");
    const draggedType   = e.dataTransfer.getData("drag-type");   // "primary" | "secondary"
    const draggedParent = e.dataTransfer.getData("drag-parent"); // primary name for secondary

    const targetName    = btn.dataset.name;
    const targetType    = btn.dataset.type;                      // "primary" | "secondary"
    const targetParent  = btn.dataset.parentName;                // primary name for secondary

    const rect = btn.getBoundingClientRect();
    const dropY = e.clientY;
    const midpoint = rect.top + rect.height / 2;
    const position = dropY < midpoint ? "before" : "after";

    // Enforce rules
    if (draggedType === "secondary" && targetType === "primary") return;
    if (draggedType === "primary" && targetType === "secondary") return;
    if (draggedName === targetName) return;

    const categories = householdDocs[householdId][type];
    const householdRef = doc(db, "households", householdId);

    // ============================================================
    // PRIMARY MOVE
    // ============================================================
    if (draggedType === "primary") {
      // Find dragged primary object + index
      const oldIndex = categories.findIndex(p => p.primary === draggedName);
      if (oldIndex === -1) return;

      const draggedObj = categories[oldIndex];

      // Remove it
      categories.splice(oldIndex, 1);

      // Find target index
      let newIndex = categories.findIndex(p => p.primary === targetName);
      if (newIndex === -1) return;

      if (position === "after") newIndex++;

      // Insert at new position
      categories.splice(newIndex, 0, draggedObj);

      await updateDoc(householdRef, {
        [type]: categories
      });
    }

    // ============================================================
    // SECONDARY MOVE
    // ============================================================
    if (draggedType === "secondary") {
      // Find source primary
      const fromPrimary = categories.find(p => p.primary === draggedParent);
      if (!fromPrimary) return;

      // Find target primary
      const toPrimary = categories.find(p => p.primary === targetParent);
      if (!toPrimary) return;

      const fromArr = fromPrimary.secondaries;
      const toArr   = toPrimary.secondaries;

      // Find dragged secondary object + index
      const oldIndex = fromArr.findIndex(s => s.name === draggedName);
      if (oldIndex === -1) return;

      const draggedObj = fromArr[oldIndex];

      // Remove from old parent
      fromArr.splice(oldIndex, 1);

      // Find target secondary index in new parent
      let newIndex = toArr.findIndex(s => s.name === targetName);
      if (newIndex === -1) return;

      if (position === "after") newIndex++;

      // Insert into new parent
      toArr.splice(newIndex, 0, draggedObj);

      await updateDoc(householdRef, {
        [type]: categories
      });
    }

    isDragging = false;
    btn.classList.remove("dragging");

    ({ userDoc, householdDocs } = await syncData(currentUser.uid));

    loadLabels(type, title);

  });

  return [rowContent, categoryWrapper];
}

function showActions(wrapper, editBtn, deleteBtn) {
  wrapper.classList.add("has-actions");
  editBtn.classList.add("show");
  deleteBtn.classList.add("show");
}

function hideActions(wrapper, editBtn, deleteBtn) {
  wrapper.classList.remove("has-actions");
  editBtn.classList.remove("show");
  deleteBtn.classList.remove("show");
}

function getDragAfterElement(container, y, mode) {
  const targetClass = mode === "primary" ? "primary-category-row" : "secondary-category-row";
console.log("container", container)
  console.log("children", container.children)
  // Only consider direct children that match the target class and are not being dragged
  const children = Array.from(container.children).filter(
    el => el.classList.contains(targetClass) && !el.classList.contains("dragging")
  );
  if (children.length === 0) return null;

  let closest = { offset: Number.NEGATIVE_INFINITY, element: null };
  for (const child of children) {
    const box = child.getBoundingClientRect();
    const offset = y - (box.top + box.height / 2);
    if (offset < 0 && offset > closest.offset) {
      closest = { offset, element: child };
    }
  }
  return closest.element;
}

async function reorderPrimaries(householdRef, type, orderedIds) {
  const batch = householdRef.firestore.batch();
  orderedIds.forEach((docId, index) => {
    const ref = householdRef.collection(type).doc(docId);
    batch.update(ref, { orderIndex: index });
  });
  await batch.commit();
}

async function reorderSecondaries(householdRef, type, parentId, orderedIds) {
  const batch = householdRef.firestore.batch();
  orderedIds.forEach((docId, index) => {
    const ref = householdRef.collection(type).doc(parentId)
                            .collection("secondaries").doc(docId);
    batch.update(ref, { orderIndex: index });
  });
  await batch.commit();
}

async function moveSecondary(householdRef, type, fromParentId, toParentId, secondaryId) {
  const fromRef = householdRef.collection(type).doc(fromParentId)
                              .collection("secondaries").doc(secondaryId);
  const toRef = householdRef.collection(type).doc(toParentId)
                            .collection("secondaries").doc(secondaryId);

  const snap = await fromRef.get();
  if (!snap.exists) return;
  const data = snap.data();

  await fromRef.delete();

  const toListSnap = await householdRef.collection(type).doc(toParentId)
                                       .collection("secondaries").orderBy("orderIndex").get();
  const nextIndex = toListSnap.size;
  await toRef.set({ ...data, orderIndex: nextIndex });
}

// Attach swipe detection to the whole nav
const nav = document.querySelector('.bottom-nav');
const buttons = Array.from(nav.querySelectorAll('button'));

nav.addEventListener('touchstart', (e) => {
  startX = e.touches[0].clientX;
});

nav.addEventListener('touchend', (e) => {
  endX = e.changedTouches[0].clientX;
  handleSwipe();

  startX = 0;
  endX = 0;
});

function handleSwipe() {
  const activeIndex = buttons.findIndex(btn => btn.classList.contains('active'));
  const threshold = 50; // minimum px swipe distance

  if (endX - startX > threshold) {
    // swipe right → go to previous tab
    if (activeIndex > 0) {
      const prevBtn = buttons[activeIndex - 1];
      prevBtn.click(); // triggers showPage()
    }
  } else if (startX - endX > threshold) {
    // swipe left → go to next tab
    if (activeIndex < buttons.length - 1) {
      const nextBtn = buttons[activeIndex + 1];
      nextBtn.click(); // triggers showPage()
    }
  }
}

function enablePageSwipe(pageEl) {
  let startX = 0, currentX = 0, isDragging = false;

  pageEl.addEventListener("touchstart", e => {
    e.stopPropagation();
    startX = e.touches[0].clientX;
    isDragging = true;
    pageEl.style.transition = "none";
  });

  pageEl.addEventListener("touchmove", e => {
    e.stopPropagation();
    if (!isDragging) return;
    currentX = e.touches[0].clientX - startX;
    if (currentX > 0) {
      pageEl.style.transform = `translateX(${currentX}px)`;
    }
  });

  pageEl.addEventListener("touchend", () => {
    if (!isDragging) return;
    isDragging = false;
    const threshold = 100;
    pageEl.style.transition = "transform 0.3s ease";

    if (currentX > threshold) {
      pageEl.style.transform = "translateX(110%)";
      setTimeout(() => goBack(), 300);
    } else {
      pageEl.style.transform = "translateX(0)";
    }
    currentX = 0; // reset here
  });
}

// --- Language Switcher ---
async function setLanguage(lang, showMessage = false, upload = true) {
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
  document.getElementById("return-btn").textContent = t.back;
  document.getElementById("save-btn-headerbar").textContent = t.save;

  // Home text
  document.getElementById("home-month").textContent = t.monthBalance;
  document.getElementById("home-balance").textContent = t.incomeMinusExpense;
  document.getElementById("home-summary").textContent = t.monthlySummary;

  document.getElementById("kanban-today-title").textContent = t.today;
  document.getElementById("kanban-month-title").textContent = t.thisMonth;
  document.getElementById("kanban-year-title").textContent = t.thisYear;

  // Transaction page
  document.getElementById("save-btn-expense").textContent = t.save;
  document.getElementById("save-btn-income").textContent = t.save;
  document.getElementById("save-btn-transfer").textContent = t.save;
  document.getElementById("save-btn-balance").textContent = t.save;
  const tabs = document.querySelectorAll('.transaction-tabs .tab-btn');
  tabs[0].textContent = t.expense;
  tabs[1].textContent = t.income;
  tabs[2].textContent = t.transfer;
  tabs[3].textContent = t.balance;
  document.querySelectorAll('.transaction-household-title')
    .forEach(el => el.textContent = t.household);
  document.querySelectorAll('.transaction-category-title')
    .forEach(el => el.textContent = t.category);
  document.querySelectorAll('.transaction-account-title')
    .forEach(el => el.textContent = t.account);
  document.querySelectorAll('.transaction-time-title')
    .forEach(el => el.textContent = t.time);
  document.getElementById("now-btn").textContent = t.now;
  document.querySelectorAll('.selector-close')
    .forEach(el => el.textContent = t.dismiss);
  document.querySelectorAll('.transaction-subject-title')
    .forEach(el => el.textContent = t.subject);
  document.querySelectorAll('.transaction-collection-title')
    .forEach(el => el.textContent = t.collection);
  document.getElementById("exchange-rate-from-label").textContent = `⇂ ${t.exchangeRate}: ${5.10}`;
  document.getElementById("exchange-rate-to-label").textContent = `↿ ${t.exchangeRate}: ${0.20}`;
  document.getElementById("transfer-from-title").textContent = t.transferFrom;
  document.getElementById("transfer-to-title").textContent = t.transferTo;
  document.querySelectorAll('.transaction-tags-title')
    .forEach(el => el.textContent = t.tags);
  document.getElementById("expense-tag-input").placeholder = t.enterTagName;
  document.getElementById("income-tag-input").placeholder = t.enterTagName;
  document.getElementById("transfer-tag-input").placeholder = t.enterTagName;
  document.getElementById("balance-tag-input").placeholder = t.enterTagName;
  document.querySelectorAll('.transaction-notes-title')
    .forEach(el => el.textContent = t.notes);

  // Settings
  document.getElementById("settings-title").textContent = t.settings;
  document.getElementById("basic-settings-title").textContent = t.basicSettingsTitle;
  document.getElementById("open-basic-settings").textContent = t.openBasicSettings;
  document.getElementById("labels-title").textContent = t.labels;
  document.getElementById("manage-expense-categories-btn").textContent = t.manageExpenseCategories;
  document.getElementById("manage-income-categories-btn").textContent = t.manageIncomeCategories;
  document.getElementById("manage-collections-btn").textContent = t.manageCollections;
  document.getElementById("manage-subjects-btn").textContent = t.manageSubjects;
  document.getElementById("households-title").textContent = t.myHouseholdsTitle;
  document.getElementById("rename-btn").textContent = t.renameHousehold;
  document.getElementById("rename-confirm").textContent = t.confirmRename;
  document.getElementById("invite-btn").textContent = t.inviteHousehold;
  document.getElementById("invite-panel-notes").textContent = t.inviteNote;
  document.getElementById("invite-email").setAttribute("placeholder", t.inviteEmailPlaceholder);
  document.getElementById("invite-confirm").textContent = t.confirmInvite;
  document.getElementById("manage-btn").textContent = t.manageHousehold;
  document.querySelector("#manage-panel h4").textContent = t.memberManagement;
  document.getElementById("leave-btn").textContent = t.leaveHousehold;
  document.querySelector("#leave-household-panel h4").textContent = t.othersHousehold;
  document.querySelectorAll('.leave-btn').forEach(el => el.textContent = t.leave);
  document.getElementById("about-title").textContent = t.about;
  document.getElementById("open-help").textContent = t.help;
  document.getElementById("help-content").innerHTML = t.helpContent;
  document.getElementById("open-acknowledgements").textContent = t.acknowledgements;
  document.getElementById("acknowledgements-content").innerHTML = t.acknowledgementsContent;
  document.getElementById("open-privacy").textContent = t.privacy;
  document.getElementById("privacy-content").innerHTML = t.privacyContent;

  // Basic settings
  document.getElementById("basic-settings-header").textContent = t.basicSettingsTitle;
  document.querySelectorAll('[id$="-language-title"]').forEach(el => {
    el.textContent = t.language;
  });
  document.querySelectorAll('[id$="-fontsize-title"]').forEach(el => {
    el.textContent = t.fontsizeTitle;
  });
  document.getElementById("theme-color-title").textContent = t.themeColorTitle;
  document.getElementById("change-theme-color-btn").textContent = t.themeColorChange;
  document.getElementById("restore-theme-color-btn").textContent = t.restoreDefault;
  document.getElementById("color-scheme-title").textContent = t.colorSchemeTitle;
  document.getElementById("color-scheme-select").querySelectorAll("option").forEach((opt, i) => {
    opt.textContent = t.colorSchemeOptions[i];
  });
  document.getElementById("home-image-title").textContent = t.homeImageTitle;
  document.getElementById("manage-home-image-btn").textContent = t.manage;
  document.getElementById("home-image-instruction").textContent = t.homeImageInstruction;
  document.querySelectorAll('.home-image-row button').forEach(btn => {
    btn.textContent = t.delete;
  });
  document.getElementById("add-home-image-btn").textContent = t.add;
  document.getElementById("save-home-image-btn").textContent = t.save;
  document.getElementById("logout-btn").textContent = t.logout;
  document.getElementById("delete-account-btn").textContent = t.deleteAccount;

  // Nav
  document.getElementById("nav-home").textContent = t.navHome;
  document.getElementById("nav-accounts").textContent = t.navAccounts;
  document.getElementById("nav-transaction").textContent = t.navTransaction;
  document.getElementById("nav-utilities").textContent = t.navUtilities;
  document.getElementById("nav-settings").textContent = t.settings;

  if (upload) {
    if (currentUser) {
      try {
        const userRef = doc(db, "users", currentUser.uid);

        // Update nested field
        await updateDoc(userRef, {
          "profile.language": lang, 
          "profile.lastSynced": getFormattedTime()
        });

        ({ userDoc, householdDocs } = await syncData(currentUser.uid));

        if (showMessage) {
          showStatusMessage(t.languageSwitched, "success");
        }

      } catch (err) {
        console.error("Error saving language:", err);
        showStatusMessage(t.languageSwitchFailed, "error");
      }
    }
  }
}
window.setLanguage = setLanguage;

function isMobileBrowser() {
  return /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}

function increaseFontsize() {
  adjustFontsize(0.05); // increase fontsize
}
window.increaseFontsize = increaseFontsize;

function decreaseFontsize() {
  adjustFontsize(-0.05); // decrease fontsize
}
window.decreaseFontsize = decreaseFontsize;

async function adjustFontsize(delta) {
  const t = translations[currentLang];

  // Get current value from CSS variable
  const current = getComputedStyle(document.documentElement)
    .getPropertyValue("--font-size")
    .trim();

  // Parse numeric part (assumes rem unit)
  let value = parseFloat(current.replace("rem", ""));
  value = Math.max(0.5, value + delta); // clamp to minimum 0.5rem

  const newSize = value.toFixed(2) + "rem";

  // Apply to CSS variable
  document.documentElement.style.setProperty("--font-size", newSize);

  // Save to Firestore
  if (currentUser) {
    const field = isMobileBrowser() ? "profile.fontsizeMobile" : "profile.fontsizeDesktop";
    try {
      const userRef = doc(db, "users", currentUser.uid);

      // Update nested field
      await updateDoc(userRef, {
        [field]: newSize, 
        "profile.lastSynced": getFormattedTime()
      });

      ({ userDoc, householdDocs } = await syncData(currentUser.uid));
      showStatusMessage(t.fontsizeChanged, "success");

    } catch (err) {
      console.error("Error saving font size:", err);
      showStatusMessage(t.fontsizeChangeFailed, "error");
    }
  }
}

function openColorPicker() {
  const picker = document.getElementById('themeColorPicker');

  let currentColor = getComputedStyle(document.documentElement)
    .getPropertyValue('--primary-base')
    .trim();

  // If it's already hex (#rrggbb), use directly
  if (/^#[0-9A-Fa-f]{6}$/.test(currentColor)) {
    picker.value = currentColor;
  }
  // If it's rgb(...), convert
  else if (currentColor.startsWith('rgb')) {
    picker.value = rgbToHex(currentColor);
  }
  // Fallback
  else {
    picker.value = '#4caf50';
  }

  picker.click(); // open native color palette

  picker.oninput = function () {
    const chosenColor = picker.value;
    applyThemeColor(chosenColor);
  };
}
window.openColorPicker = openColorPicker;

function rgbToHex(rgb) {
  const result = rgb.match(/\d+/g);
  if (!result) return "#4caf50";
  return "#" + result.slice(0, 3).map(x =>
    ("0" + Number(x).toString(16)).slice(-2)
  ).join('');
}

function resetThemeColor() {
  // Define your default color (same as in CSS :root)
  const defaultColor = "#e88b1a";
  applyThemeColor(defaultColor);
}
window.resetThemeColor = resetThemeColor;

async function applyThemeColor(color, upload = true) {
  // Update CSS variable
  document.documentElement.style.setProperty('--primary-base', color);

  // Update meta tag
  let metaThemeColor = document.querySelector("meta[name=theme-color]");
  if (metaThemeColor) {
    metaThemeColor.setAttribute("content", color);
  } else {
    metaThemeColor = document.createElement("meta");
    metaThemeColor.name = "theme-color";
    metaThemeColor.content = color;
    document.head.appendChild(metaThemeColor);
  }

  if (upload) {
    if (currentUser) {
      try { // Save to Firestore
        const userRef = doc(db, "users", currentUser.uid);

        // Update nested field
        await updateDoc(userRef, {
          "profile.themeColor": color, 
          "profile.lastSynced": getFormattedTime()
        });

        // Refresh local cache
        ({ userDoc, householdDocs } = await syncData(currentUser.uid));

      } catch (err) {
        console.error("Error changing theme color:", err);
        showStatusMessage(t.themeColorChangeFailed, "error");
      }
    }
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

    if (currentUser) {
      homeImages = Array.isArray(userDoc.profile.homeImages) ? userDoc.profile.homeImages : [];

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
  const t = translations[currentLang];

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
    del.textContent = t.delete;
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

async function saveHomeImages() {
  const t = translations[currentLang];

  const inputs = document.querySelectorAll("#home-image-list input[type='url']");
  const urls = Array.from(inputs)
    .map(input => input.value.trim())
    .filter(url => url.length > 0);

  homeImages = urls;

  if (!currentUser) return;

  try {
    const userRef = doc(db, "users", currentUser.uid);

    // Update nested field
    await updateDoc(userRef, {
      "profile.homeImages": homeImages, 
      "profile.lastSynced": getFormattedTime()
    });

    // Refresh local cache
    ({ userDoc, householdDocs } = await syncData(currentUser.uid));

    showStatusMessage(t.homeImageSaved, "success");

    // Pick a random image to display
    const img = document.getElementById("home-image");
    const randomIndex = Math.floor(Math.random() * homeImages.length);
    const randomUrl = homeImages[randomIndex].trim();

    img.src = randomUrl;
    img.style.display = "block";

  } catch (err) {
    console.error("Error saving home images:", err);
    showStatusMessage(t.homeImageSaveFailed, "error");
  }
}

// --- Home: Kanban summaries ---
async function updateHomeKanban() {
  const entries = Object.values(householdDocs)
  .flatMap(h => Object.values(h.entries || {}));

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
async function setColorScheme(scheme, showMessage = false, upload = true) {
  const t = translations[currentLang];

  if (scheme === "alt") {
    document.documentElement.classList.add("alt-scheme");
  } else {
    document.documentElement.classList.remove("alt-scheme");
  }

  if (upload) {
    if (currentUser) {
      try { // Save to Firestore
        const userRef = doc(db, "users", currentUser.uid);

        // Update nested field
        await updateDoc(userRef, {
          "profile.colorScheme": scheme, 
          "profile.lastSynced": getFormattedTime()
        });

        // Refresh local cache
        ({ userDoc, householdDocs } = await syncData(currentUser.uid));
        if (showMessage) {
          showStatusMessage(t.colorSchemeSwitched, "success");
        }

      } catch (err) {
        console.error("Error changing color scheme:", err);
        showStatusMessage(t.colorSchemeSwitchFailed, "error");
      }
    }
  }
}
window.setColorScheme = setColorScheme;

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
    document.getElementById("rename-household").value = householdDocs[userDoc.personalHouseholdId].name;
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
  const t = translations[currentLang];

  const newName = document.getElementById("rename-household").value.trim();

  if (!newName) {
    alert("请输入新的家庭名称");
    return;
  }

  try {
    // Reference to the household document
    const householdRef = doc(db, "households", userDoc.personalHouseholdId);
    await updateDoc(householdRef, {
      name: newName,
      lastSynced: getFormattedTime()
    });

    ({ userDoc, householdDocs } = await syncData(currentUser.uid));
    console.log("Household renamed successfully!");
    showStatusMessage(t.householdRenamed, "success");
  } catch (err) {
    showStatusMessage(t.householdRenameFailed, "error");
    console.error("Error renaming household:", err);
  }
});

document.getElementById("invite-confirm").onclick = async () => {
  const email = document.getElementById("invite-email").value.trim();
  if (!email) {
    alert("请输入邮箱");
    return;
  }

  if (email === userDoc.profile.email) {
    alert("您已在自己的家庭中，无需邀请");
    return;
  }

  const myHouseholdId = userDoc.personalHouseholdId;

  try {
    // 1. Find user by email
    const profilesRef = collection(db, "profiles");
    const q = query(profilesRef, where("email", "==", email));
    const userQuery = await getDocs(q);

    if (userQuery.empty) {
      alert("未找到该用户");
      return;
    }

    const invitedUserProfileDoc = userQuery.docs[0];
    const invitedUserId = invitedUserProfileDoc.id;

    if (householdDocs[myHouseholdId].members.includes(invitedUserId)) {
      alert("对方已在您的家庭中，无需再次邀请");
      return;
    }
    
    const userRef = doc(db, "users", currentUser.uid);
    
    // 2. Add household to invited user
    const invitedUserRef = doc(db, "users", invitedUserId);
    await updateDoc(invitedUserRef, {
      households: arrayUnion(myHouseholdId),
      lastHouseholdChange: myHouseholdId
    });

    // 3. Add invited user to household members
    const householdRef = doc(db, "households", myHouseholdId);
    await updateDoc(householdRef, {
      members: arrayUnion(invitedUserId),
      lastSynced: getFormattedTime()
    });

    alert("邀请成功，对方已加入您的 household");
    ({ userDoc, householdDocs } = await syncData(currentUser.uid));
    document.getElementById("invite-email").value = "";

  } catch (err) {
    console.error("Error inviting user:", err);
    alert("邀请失败，请稍后再试");
  }
};

async function loadHouseholdMembers() {
  const list = document.getElementById("member-list");
  list.innerHTML = "";

  const myHouseholdId = userDoc.personalHouseholdId;
  const members = householdDocs[myHouseholdId].members.slice(1); // slice(1) excludes the household owner

  // ✅ If no other user in the household
  if (members.length < 1) {
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
    const profileRef = doc(db, "profiles", uid);
    const userProfileDoc = await getDoc(profileRef);

    if (!userProfileDoc.exists()) {
      console.warn(`Profile missing for uid: ${uid}`);
      continue; // skip this one
    }

    const email = userProfileDoc.data().email;

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
      e.stopPropagation();  // stop the event from bubbling up to parent elements
      li._startX = e.touches[0].clientX;
    });

    li.addEventListener("touchend", e => {
      e.stopPropagation();  // stop the event from bubbling up to parent elements
      const dx = e.changedTouches[0].clientX - li._startX;
      if (dx < -50) showDeleteButton(li, uid); // swipe left
      if (dx > 50) hideDeleteButton(li); // swipe right
    });

    list.appendChild(li);
  }
}

function showDeleteButton(li, uid) {
  const t = translations[currentLang];

  let btn = li.querySelector(".delete-btn");
  if (btn) {
    btn.style.display = "block"; // display again
    return;
  }

  btn = document.createElement("button");
  btn.textContent = t.delete;
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

  const myHouseholdId = userDoc.personalHouseholdId;
  const householdRef = doc(db, "households", myHouseholdId);

  // 1. Remove user from household members
  await updateDoc(householdRef,{
    members: arrayRemove(uid),
    lastSynced: getFormattedTime()
  });

  // 2. Remove household from user
  await updateDoc(doc(db, "users", uid), {
    households: arrayRemove(myHouseholdId),
    lastHouseholdChange: myHouseholdId
  });

  ({ userDoc, householdDocs } = await syncData(currentUser.uid));
  loadHouseholdMembers();
}

async function loadMyHouseholds() {
  const list = document.getElementById("leave-household-list");
  list.innerHTML = "";

  // ✅ If user is only in 1 household (their own)
  if (userDoc.households.length <= 1) {
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
  const leaveable = userDoc.households.slice(1);

  for (const hid of leaveable) {
    const hname = householdDocs[[hid]].name;

    const li = document.createElement("li");
    li.textContent = hname;
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
      e.stopPropagation();  // stop the event from bubbling up to parent elements
      li._startX = e.touches[0].clientX;
    });

    li.addEventListener("touchend", e => {
      e.stopPropagation();  // stop the event from bubbling up to parent elements
      const dx = e.changedTouches[0].clientX - li._startX;
      if (dx < -50) showLeaveButton(li, hid); // swipe left
      if (dx > 50) hideLeaveButton(li); // swipe right
    });

    list.appendChild(li);
  }
}

function showLeaveButton(li, hid) {
  const t = translations[currentLang];
  let btn = li.querySelector(".delete-btn");
  if (btn) {
    btn.style.display = "block"; // display again
    return;
  }

  btn = document.createElement("button");
  btn.textContent = t.leave;
  btn.className = "delete-btn leave-btn";
  btn.style.width = "4rem";
  btn.style.transform = "translateX(-1rem)"; // display
  btn.style.alignItems = "center";      /* vertical centering */
  btn.style.justifyContent = "center";  /* horizontal centering */

  btn.onclick = () => confirmLeaveHousehold(hid);

  li.appendChild(btn);
}

function hideLeaveButton(li) {
  const btn = li.querySelector(".delete-btn");
  if (btn) {
    btn.style.display = "none";
  }
}

async function confirmLeaveHousehold(hid) {
  if (!confirm("您确定要退出该家庭吗？退出后页面将自动刷新，请确保已保存所有数据")) return;

  const userRef = doc(db, "users", currentUser.uid);

  // Remove myself from household members
  await updateDoc(doc(db, "households", hid), {
    members: arrayRemove(currentUser.uid), 
    lastSynced: getFormattedTime()
  });

  // Remove household from my user doc
  await updateDoc(userRef, {
    households: arrayRemove(hid),
    "profile.lastSynced": getFormattedTime()
  });

  toggleHouseholdFormRows();

  alert("已退出该家庭");
  ({ userDoc, householdDocs } = await syncData(currentUser.uid));

  window.location.reload();
}

async function deleteAccount() {
  // Confirmation dialog
  if (!confirm("确定要删除您的账户吗？此操作不可撤销。")) return;

  const user = auth.currentUser;

  if (!user) {
    alert("用户未登录");
    return;
  }

  // Ask for password
  const userPassword = prompt("请输入您的密码以确认删除账户：");
  if (!userPassword) return; // user cancelled

  try {
    // Create credential
    const credential = EmailAuthProvider.credential(user.email, userPassword);

    // Reauthenticate
    await reauthenticateWithCredential(user, credential);

    // Continue with deletion logic
    await confirmDeleteAccount();

  } catch (err) {
    console.error("Reauthentication failed:", err);
    alert("密码错误或验证失败，请重试");
  }
}
window.deleteAccount = deleteAccount;

async function confirmDeleteAccount() {
  const uid = currentUser.uid;

  // Identify households from the global variable householdDocs
  const allHouseholds = Object.entries(householdDocs);

  const myHousehold = allHouseholds.find(([hid, data]) => data.admin === uid);
  const myHouseholdId = myHousehold?.[0];

  const otherHouseholds = allHouseholds
    .filter(([hid, data]) => data.members?.includes(uid) && data.admin !== uid)
    .map(([hid]) => hid);

  const userRef = doc(db, "users", uid);
  const myProfileRef = doc(db, "profiles", uid);
  const myHouseholdRef = myHouseholdId
    ? doc(db, "households", myHouseholdId)
    : null;

  try {
    const userSnap = await getDoc(userRef);
    if (!userSnap.exists()) throw new Error("User not found");

    // 1. Remove user from all other households
    for (const hid of otherHouseholds) {
      const householdRef = doc(db, "households", hid);
      await updateDoc(householdRef, {
        members: arrayRemove(uid),
        lastSynced: getFormattedTime()
      });
    }

    // 2. For each member of the user's own household, remove this household from their user doc
    if (myHouseholdRef) {
      const householdSnap = await getDoc(myHouseholdRef);
      const householdData = householdSnap.data();
      const members = householdData?.members || [];

      for (const memberUid of members) {
        const memberRef = doc(db, "users", memberUid);
        await updateDoc(memberRef, {
          households: arrayRemove(myHouseholdId),
          lastHouseholdChange: myHouseholdId
        });
      }
    }

    // 3. Delete profile
    await deleteDoc(myProfileRef);

    // 4. Delete user's own household
    if (myHouseholdRef) {
      await deleteDoc(myHouseholdRef);
    }

    // 5. Delete user document
    await deleteDoc(userRef);

    // 6. Delete from Firebase Authentication
    const auth = getAuth();
    const authUser = auth.currentUser;
    await authUser.delete();

    alert("账户已成功删除");
    window.location.reload();

  } catch (err) {
    console.error("Error deleting account:", err);
    alert("删除失败: " + err.message);
  }
}

function showStatusMessage(message, type = 'info', duration = 2000) {

  const status = document.getElementById('statusMessage');
  const bottomNav = document.querySelector('.bottom-nav');

  const navHeight = bottomNav.offsetHeight; // px value 
  const navStyles = getComputedStyle(bottomNav); 
  const navBottom = navStyles.bottom;
  const offset = `calc(${navHeight}px + ${navBottom} + 0.2rem)`; 
  status.style.bottom = offset;

  status.textContent = message;
  status.style.display = 'inline-block';

  // Reset styles
  status.style.background = '';
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
  const t = translations[currentLang];

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
const categorySelector = document.getElementById("category-selector");

const selectorList = [
  datetimeSelector,
  householdSelector,
  categorySelector
];

let lastButton = null;

function createList(col, values) {
  col.innerHTML = ""; // clear existing items

  values.forEach(v => {
    const div = document.createElement("div");
    div.className = "dt-item";

    if (typeof v === "string" || typeof v === "number") {
      // Simple case: just one value
      div.textContent = v;
    } else if (v && typeof v === "object") {
      // Object case: emoji + name
      if (v.emoji) {
        const emojiSpan = document.createElement("span");
        emojiSpan.className = "emoji";
        emojiSpan.textContent = v.emoji;
        div.appendChild(emojiSpan);
      }

      const labelSpan = document.createElement("span");
      labelSpan.className = "label";
      labelSpan.textContent = v.name || "";
      div.appendChild(labelSpan);
    }

    col.appendChild(div);
  });
}

/* Snap after scroll stops */
function ScrollToSelectItem(col, value = null) {
  // Helper to update selection
  function selectItem(item) {
    if (!item) return;
    [...col.querySelectorAll(".dt-item")].forEach(i => i.classList.remove("selected"));
    item.classList.add("selected");
    item.scrollIntoView({ block: "center", behavior: "smooth" });
  }

  // If a value was passed in, find the matching item
  const items = [...col.querySelectorAll(".dt-item")];
  let target;

  if (typeof value === "number") {
    // Try to find numeric match
    target = items.find(i => {
      const labelEl = i.querySelector(".label");
      const text = labelEl ? labelEl.textContent.trim() : i.textContent.trim();
      return parseInt(text, 10) === value;
    });

    // If no match, take the last item
    if (!target) {
      target = items[items.length - 1];
    }
  } else {
    // Try to find string match
    target = items.find(i => {
      const labelEl = i.querySelector(".label");
      const text = labelEl ? labelEl.textContent.trim() : i.textContent.trim();
      return text === String(value).trim();
    });

    // If no match OR value is null/undefined, take the first item
    if (!target) {
      target = items[0];
    }
  }

  if (target) {
    selectItem(target);
  }

  let touchMoved = false;

  // ✅ Click selection
  col.addEventListener("click", (e) => {
    if (!touchMoved) { // run only if it was a tap, not a drag
      const item = e.target.closest(".dt-item");
      if (item && col.contains(item)) {
        selectItem(item);
        updateSelectorPreview(col);
      }
    }
  });

  // Wheel / trackpad scroll
  let wheelDelta = 0;
  col.addEventListener("wheel", (e) => {
    e.preventDefault();
    wheelDelta += e.deltaY;

    const itemHeight = col.querySelector(".dt-item")?.offsetHeight || 40;
    if (wheelDelta >= itemHeight) {
      selectItem(col.querySelector(".dt-item.selected")?.nextElementSibling);
      wheelDelta = 0;
    } else if (wheelDelta <= -itemHeight) {
      selectItem(col.querySelector(".dt-item.selected")?.previousElementSibling);
      wheelDelta = 0;
    }
    updateSelectorPreview(col)
  }, { passive: false });

  // Touch swipe
  let touchStartY = null;
  let touchStartTime = null;
  let lastStep = 0;

  col.addEventListener("touchstart", (e) => {
    touchMoved = false;
    touchStartY = e.touches[0].clientY;
    touchStartTime = getFormattedTime();
    lastStep = 0;
  }, { passive: false });

  col.addEventListener("touchmove", (e) => {
    e.preventDefault();
    touchMoved = true;

    const currentY = e.touches[0].clientY;
    const dy = currentY - touchStartY;
    const dt = getFormattedTime() - touchStartTime;

    const itemHeight = col.querySelector(".dt-item")?.offsetHeight || 40;
    const distanceSteps = dy / itemHeight;

    const velocity = dy / dt; // px per ms

    // Thresholds
    const FAST_SWIPE_THRESHOLD = 0.5;   // px/ms
    const DISTANCE_THRESHOLD = itemHeight * 2; // at least 2 items worth of movement

    let velocitySteps = 0;
    if (Math.abs(velocity) > FAST_SWIPE_THRESHOLD && Math.abs(dy) > DISTANCE_THRESHOLD) {
      velocitySteps = velocity * 3; // apply multiplier only if both conditions met
    }

    const steps = Math.round((distanceSteps + velocitySteps));

    if (steps !== lastStep) {
      const items = [...col.querySelectorAll(".dt-item")];
      const selected = col.querySelector(".dt-item.selected");
      if (!selected) return;

      let index = items.indexOf(selected);
      let newIndex = index - (steps - lastStep); // move only the delta
      newIndex = Math.max(0, Math.min(items.length - 1, newIndex));

      selectItem(items[newIndex]);
      lastStep = steps;
      updateSelectorPreview(col);
    }
  }, { passive: false });

  col.addEventListener("touchend", (e) => {
    touchStartY = null;
    touchStartTime = null;
    lastStep = 0;
  }, { passive: false });
}

function updateSelectorPreview(updatedCol) {
  if (!lastButton) return;

  const type = transactionTypes[inputTypeIndex];
  const activeForm = type + "-form";

  if (lastButton.dataset.type === "datetime") {

    // update day column when year and month are changed
    if (
      updatedCol.classList.contains("year-col") ||
      updatedCol.classList.contains("month-col")
    ) {
      day = getSelectedValue(datetimeSelector, ".day-col");
      updateDayColumn();
      ScrollToSelectItem(datetimeSelector.querySelector(".day-col"), day);
    }

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
    const prefix = getDatePrefix(dateObj);

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

      // update other buttons when household change
      let categoryBtn = document.querySelector(`#${activeForm} .selector-button[data-type='category']`);
      if (categoryBtn) {setDefaultCategory(categoryBtn, type)};
    }
    
  } else { // assuming all other selectors are categorySelectors
    const primaryCol = categorySelector.querySelector(".primary-col");
    const secondaryCol = categorySelector.querySelector(".secondary-col");

    // update secondary column if primary is changed
    if (updatedCol.classList.contains("primary-col")) {
      updateSecondaryColumn(lastButton, secondaryCol);
      ScrollToSelectItem(secondaryCol);
    }

    const { emoji: pEmoji, name: pName } =
      getSelectedValue(categorySelector, ".primary-col", true);
    const { emoji: sEmoji, name: sName } =
      getSelectedValue(categorySelector, ".secondary-col", true);

    const primaryEmoji = pEmoji;
    const secondaryEmoji = sEmoji;

    if (type === "expense") {
      expenseInputPrimaryCategory   = pName;
      expenseInputSecondaryCategory = sName;

      expenseInputCategoryInnerHTML = `
        <span class="cat-part">${primaryEmoji} ${expenseInputPrimaryCategory}</span>
        <span class="cat-separator">&gt;</span>
        <span class="cat-part">${secondaryEmoji} ${expenseInputSecondaryCategory}</span>
      `;

      lastButton.innerHTML = expenseInputCategoryInnerHTML;

    } else if (type === "income") {
      incomeInputPrimaryCategory   = pName;
      incomeInputSecondaryCategory = sName;

      incomeInputCategoryInnerHTML = `
        <span class="cat-part">${primaryEmoji} ${incomeInputPrimaryCategory}</span>
        <span class="cat-separator">&gt;</span>
        <span class="cat-part">${secondaryEmoji} ${incomeInputSecondaryCategory}</span>
      `;

      lastButton.innerHTML = incomeInputCategoryInnerHTML;
    }

  }
}

// Remove known prefixes
function removeDatePrefix(text) {
  const t = translations[currentLang];

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
(function initDatetimeSelector() {
  const yearCol = datetimeSelector.querySelector(".year-col");
  const monthCol = datetimeSelector.querySelector(".month-col");
  const hourCol = datetimeSelector.querySelector(".hour-col");
  const minuteCol = datetimeSelector.querySelector(".minute-col");

  createList(yearCol, Array.from({ length: 2100 - 2010 + 1 }, (_, i) => 2010 + i));
  createList(monthCol, Array.from({ length: 12 }, (_, i) => i + 1));
  createList(hourCol, Array.from({ length: 24 }, (_, i) => i));
  createList(minuteCol, Array.from({ length: 60 }, (_, i) => i));
})();

function initHouseholdSelector() {
  const col = document.querySelector("#household-selector .household-col");

  // Use names for display
  const householdNames = Object.values(householdDocs)
    .filter(data => data)   // remove nulls
    .map(data => data.name);


  createList(col, householdNames);
}

function updateDayColumn() {
  const year = getSelectedValue(datetimeSelector, ".year-col");
  const month = getSelectedValue(datetimeSelector, ".month-col");

  const days = daysInMonth(year, month);
  const dayCol = datetimeSelector.querySelector(".day-col");
  createList(dayCol, Array.from({ length: days }, (_, i) => i + 1));
}

function updateSecondaryColumn(lastButton, secondaryCol) {
  let cats = null;
  let inputPrimary = null;
  const type = transactionTypes[inputTypeIndex];

  if (lastButton.dataset.type === "category") {
    cats = categoriesByHousehold[inputHouseholdId][type];
    if (type === "expense") {
      inputPrimary = expenseInputPrimaryCategory;

    } else if (type === "income") {
      inputPrimary = incomeInputPrimaryCategory;
    }
  }

  // Find the primary category object that matches the selected primary name
  const primaryCat = cats.find(cat => cat.primary === inputPrimary);

  // If found, use its secondaries; otherwise fallback to empty list
  const secondaries = primaryCat ? primaryCat.secondaries : [];

  // Build the list of secondary items as objects
  const secondaryList = secondaries.map(sec => ({
    emoji: sec.emoji || "",
    name:  sec.name || ""
  }));

  // Populate the secondary column
  createList(secondaryCol, secondaryList);
}

function getSelectedValue(selector, colName, strip = false) {
  const col = selector.querySelector(colName);
  if (!col) return "";

  // Prefer a .selected item; fall back to the column root if needed
  const selectedItem = col.querySelector(".selected") || col;

  // If strip=true, return structured parts from separate elements
  if (strip) {
    const emojiEl = selectedItem.querySelector(".emoji");
    const iconEl  = selectedItem.querySelector(".icon"); // <img class="icon">

    const labelEl = selectedItem.querySelector(".label") || selectedItem;

    const emoji = emojiEl ? emojiEl.textContent.trim() : "";
    const icon  = iconEl && iconEl.getAttribute("src") ? iconEl.getAttribute("src") : "";
    const name  = labelEl.textContent.trim();

    return { emoji, icon, name };
  }

  // Otherwise, return the full text (legacy behavior)
  const labelEl = selectedItem.querySelector(".label") || selectedItem;
  const text = labelEl.textContent.trim();

  // Return number if purely numeric, else string
  return (/^-?\d+(\.\d+)?$/.test(text)) ? Number(text) : text;
}

function daysInMonth(year, month) {
  return new Date(year, month, 0).getDate(); // elegant JS trick
}

function clickToSetNow() {
  const type = transactionTypes[inputTypeIndex];
  const activeForm = type + "-form";

  let btn = document.querySelector(`#${activeForm} .selector-button[data-type='datetime']`);
  if (btn) setCurrentTime(btn);

  const { year, month, day, hour, minute } = parseButtonDate(btn);

  ScrollToSelectItem(datetimeSelector.querySelector(".year-col"), year);
  ScrollToSelectItem(datetimeSelector.querySelector(".month-col"), month);
  ScrollToSelectItem(datetimeSelector.querySelector(".day-col"), day);
  ScrollToSelectItem(datetimeSelector.querySelector(".hour-col"), hour);
  ScrollToSelectItem(datetimeSelector.querySelector(".minute-col"), minute);
}

let openSelector = null;

function showSelector(selName) {
  // Case 1: same selector already open → do nothing
  if (openSelector === selName) {
    return;
  }

  // Case 2: another selector is open → close it
  if (openSelector) {
    const prevSel = document.getElementById(openSelector + '-selector');
    if (prevSel) {
      prevSel.style.transform = 'translateY(120%)';
    }
  }

  history.pushState({ selector: true }, '', location.href);

  // Open the new selector in cases 2 and 3
  openSelector = selName;

  const sel = document.getElementById(selName + '-selector');
  if (sel) {
    sel.style.transform = 'translateY(0)';
  }
}

function closeSelector() {
  if (!openSelector) return;

  const sel = document.getElementById(openSelector + '-selector');
  if (sel) {
    sel.style.transform = 'translateY(120%)';
  }
  openSelector = null;

  // Clear dummy state so further back presses exit normally
  history.back();
}

window.addEventListener('popstate', () => {
  if (openSelector) {
    closeSelector();
    return;
  }

  const stack = historyStacks[currentBase];
  if (stack.length > 1) {
    goBack();
    return;
  }

  // At base page: let Android handle back (exit to home)
});

/* Open selector */
document.querySelectorAll(".selector-button[data-type='datetime']").forEach(btn => {
  btn.addEventListener("click", e => {
    e.stopPropagation();
    lastButton = btn;

    // Show the desired selector
    showSelector('datetime')

  });
});

document.querySelectorAll(".selector-button[data-type='household']")
  .forEach(btn => {
    btn.addEventListener("click", e => {
      e.stopPropagation();
      lastButton = btn;

      showSelector('household')

      ScrollToSelectItem(householdSelector.querySelector(".household-col"), btn.textContent);
    });
  });

document.querySelectorAll(".selector-button[data-type='category']")
  .forEach(btn => {
    btn.addEventListener("click", e => {
      e.stopPropagation();
      lastButton = btn;

      showSelector('category')

      const type = transactionTypes[inputTypeIndex];

      if (type === "expense") {
        ScrollToSelectItem(categorySelector.querySelector(".primary-col"), expenseInputPrimaryCategory);
        ScrollToSelectItem(categorySelector.querySelector(".secondary-col"), expenseInputSecondaryCategory);
      } else {
        ScrollToSelectItem(categorySelector.querySelector(".primary-col"), incomeInputPrimaryCategory);
        ScrollToSelectItem(categorySelector.querySelector(".secondary-col"), incomeInputSecondaryCategory);
      }
    });
  });
  
/* Close when clicking outside */
document.addEventListener("click", e => {
  if (!openSelector) return; // nothing open → do nothing

  const sel = document.getElementById(openSelector + "-selector");
  if (sel && !sel.contains(e.target)) {
    // Click was outside the currently open selector
    closeSelector();
  }
});



