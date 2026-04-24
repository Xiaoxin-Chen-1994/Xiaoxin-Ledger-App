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
//       notes: notes
//       amount: number
//       createdBy: string          // userId
//       lastModifiedBy: string     // userId

let db = null;
let currentUser = null;
let userEmail = null;
let currentLang = 'zh';
let userDoc = null; // this variable will contain all data under this userId in the Users collection
let householdDocs = {}; // this variable will contain all data of each household to which this userId has access

let workspace = {} // use this variable to store temporary transaction data before being saved
//workspace = {
//   create: {
//     amount: amount, 
//     amountCalulation: string,
//     inputTransactionTime: datetime,
//     inputTypeIndex: typeIndex,
//     inputType: type, 
//     inputNotes: notes,
//     tags: array, 
//     expense: {
//        householdId, 
//        primaryCategory, 
//        secondaryCategory, 
//        primaryAccount, 
//        secondaryAccount, 
//        subject, 
//        collection
//     },
//     income: {},
//     transfer: {
//        toAmount: amount, 
//        toAmountCalculation: string,
//       },
//     balance: {},
//   }
// }
const transactionTypes = ["expense", "income", "transfer", "balance"];
const accountTypes = ["cashAccounts", "creditCards", "depositoryAccounts", "storedValueCards", "investmentAccounts"];

let currentBase = "home";
let latestPage = null;
let latestNavBtn = null;
let latestTitle = null;
let latestOptions = null;
let entryData_original = {};

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
    cashAccounts: "Cash Accounts", 
    creditCards: "Credit Cards",
    depositoryAccounts: "Depository Accounts",
    storedValueCards: "Stored-Value Cards",
    investmentAccounts: "Investment Accounts",
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
    personalSettingsTitle: "Personal Settings",
    openPersonalSettings: "Open Personal Settings",
    timestampNotes: "The timestamps below indicate the most recent edit times of data retrieved during your last online session. Please note that, if you are offline, these timestamps do not reflect edits made on this device, nor do they represent the latest edits on the server.",
    labels: "Labels",
    manageExpenseCategories: "Manage expense categories",
    manageIncomeCategories: "Manage income categories",
    manageCollections: "Manage collections",
    manageSubjects: "Manage subjects",
    primaryCategoryName: "Name for a primary category",
    secondaryCategoryName: "Name for a secondary category",
    labelName: "Name for a label",
    createPrimaryCategory: "Create a new primary category",
    createSecondaryCategory: "Create a new secondary category",
    createLabel: "Create a new label",
    noPrimaryCategories: "No primary categories yet.",
    noSecondaryCategories: "No secondary categories yet.",
    cancel: "Cancel",
    reorderInstructions: `
      <p>Drag the ≡ icon on the right to <strong>reorder items</strong>. Use the checkboxes on the left to <strong>select multiple items for deletion</strong>.</p>
      <p><strong>Please note:</strong> deleting a label will <strong>permanently remove all associated transactions</strong>. Deleting a <strong>primary category</strong> will also <strong>permanently remove all of its secondary categories and their associated transactions</strong>.</p>`,
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
    manageHomeImage: "Manage homepage images",
    add: "Add",
    delete: "Delete",
    homeImageInstruction: "You may add the URL links to the online pictures you would like to use here.",
    homeImageSaved: "Homepage images saved",
    homeImageSaveFailed: "Failed to save homepage images",
    defaults: 'Templates',
    manageDefaults: 'Manage transaction templates',
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
    cashAccounts: "现金账户",
    creditCards: "信用卡",
    depositoryAccounts: "银行账户",
    storedValueCards: "储值卡",
    investmentAccounts: "投资账户",
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
    transferTo: "转入",
    notes: "📝备注",
    save: "✔️保存",
    personalSettingsTitle: "个人偏好",
    openPersonalSettings: "打开个人偏好",
    timestampNotes: "以下时间戳表示上次联网时获取的数据的最新编辑时间。请注意，如果您正处于离线状态，这些时间戳既不代表本设备上的最新编辑时间，也不代表服务器端的最新编辑时间。",
    labels: "类别",
    manageExpenseCategories: "管理支出分类",
    manageIncomeCategories: "管理收入分类",
    manageCollections: "管理项目",
    manageSubjects: "管理交易对象（交易主体）",
    primaryCategoryName: "一级分类名称",
    secondaryCategoryName: "二级分类名称",
    labelName: "标签名称",
    createPrimaryCategory: "新建一级分类",
    createSecondaryCategory: "新建二级分类",
    createLabel: "新建标签",
    noPrimaryCategories: "暂无一级分类",
    noSecondaryCategories: "暂无二级分类",
    cancel: "取消",
    reorderInstructions: `
      <p>拖动右侧的 ≡ 图标即可<strong>重新排序</strong>。使用左侧的复选框可<strong>一次选择多个项目进行删除</strong>。</p>
      <p><strong>请注意：</strong> 删除标签将<strong>永久删除其关联的所有交易</strong>。删除<strong>一级分类</strong>时，其下所有<strong>二级分类</strong>及其关联的交易也会被<strong>永久删除</strong>。</p>`,
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
    manageHomeImage: "管理首页图",
    add: "增加",
    delete: "删除",
    homeImageInstruction: "您可在此处添加您想要使用的在线图片链接。",
    homeImageSaved: "首页图链接已保存",
    homeImageSaveFailed: "首页图保存出错",
    defaults: '交易模版',
    manageDefaults: '管理交易模版',
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

import { get, set, del } from "https://cdn.jsdelivr.net/npm/idb-keyval@6/+esm";

document.getElementById("githubLogin").onclick = () => {
  window.location.href = "/api/auth/login";
};

async function listPrivateRepos() {
  const token = await get("github_token");
  console.log("Token:", token);

  const repos = await fetch("https://api.github.com/user/repos?visibility=private", {
    headers: { Authorization: `token ${token}` }
  }).then(r => r.json());

  console.log(repos);

  // Render UI
  const container = document.getElementById("repoList");

  if (!repos || repos.length === 0) {
    container.innerHTML = "<p>No private repos found.</p>";
    return;
  }

  container.innerHTML = `
    <h3>Select a repository</h3>
    <ul>
      ${repos
        .map(
          repo => `
            <li>
              <button class="repo-select" data-name="${repo.full_name}">
                ${repo.full_name}
              </button>
            </li>
          `
        )
        .join("")}
    </ul>
  `;

  // Add click handlers
  document.querySelectorAll(".repo-select").forEach(btn => {
    btn.onclick = async () => {
      const repo = btn.dataset.name;
      console.log("Selected repo:", repo);

      await set("selected_repo", repo);

      const token = await get("github_token");
      db = await smartLoadDb(repo, token);

      showPage("home", "nav-home", "Xiaoxin's Ledger App");
    };
  });
}

const SQL = await initSqlJs({
  locateFile: file => `https://sql.js.org/dist/${file}`
});

async function downloadDbFromGitHub(repo, token) {
  const path = "ledger.db";

  const res = await fetch(
    `https://api.github.com/repos/${repo}/contents/${path}`,
    { headers: { Authorization: `token ${token}` } }
  );

  if (res.status === 404) return null;

  const file = await res.json();
  const binary = atob(file.content);
  const bytes = new Uint8Array(binary.length);

  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }

  return bytes;
}

async function uploadDbToGitHub(repo, token, dbBytes) {
  const path = "ledger.db";
  const content = btoa(String.fromCharCode(...dbBytes));

  const existing = await fetch(
    `https://api.github.com/repos/${repo}/contents/${path}`,
    { headers: { Authorization: `token ${token}` } }
  ).then(r => r.json());

  const body = {
    message: "Update ledger database",
    content,
    sha: existing.sha
  };

  const res = await fetch(
    `https://api.github.com/repos/${repo}/contents/${path}`,
    {
      method: "PUT",
      headers: {
        Authorization: `token ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    }
  );

  return res.json();
}

async function smartLoadDb(repo, token) {
  // 1. Try GitHub
  const remote = await downloadDbFromGitHub(repo, token);

  if (remote) {
    console.log("Loaded DB from GitHub");
    await set("ledger_db", remote);
    return new SQL.Database(remote);
  }

  // 2. Try local IndexedDB
  const local = await get("ledger_db");

  if (local) {
    console.log("Loaded DB from local IndexedDB");
    return new SQL.Database(local);
  }

  // 3. Create new DB
  console.log("No DB found, creating new one");
  db = new SQL.Database();
  const emptyBytes = db.export();
  await set("ledger_db", emptyBytes);
  return db;
}

async function init() {
  const token = await get("github_token");

  if (!token) {
    console.log("Not logged in");
    return;
  }

  const selectedRepo = await get("selected_repo");

  if (!selectedRepo) {
    console.log("No repo selected, showing repo picker");
    listPrivateRepos();
    return;
  }

  db = await smartLoadDb(selectedRepo, token);

  showPage("home", "nav-home", "Xiaoxin's Ledger App");
}

init();

if (navigator.serviceWorker.controller) {
  navigator.serviceWorker.controller.postMessage({ type: "UPDATE_CACHE" });
}

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

    // Household doc
    await setDoc(householdRef, {
      name: householdName,
      admin: user.uid,
      members: [user.uid],
      lastSynced: getFormattedTime(),

      accounts: {
        cashAccounts: [
          { name: currentLang === "en" ? "Cash" : "现金", icon: "💰", currency: "CNY", exclude: false, notes: "", "sub-accounts": [] }
        ],
        creditCards: [
          { name: currentLang === "en" ? "Credit Card" : "信用卡", icon: "💳", currency: "CNY", statementDate: null, dueDate: null, creditLimit: null, exclude: false, notes: "", "sub-accounts": [] }
        ],
        depositoryAccounts: [
          { name: currentLang === "en" ? "Bank Account" : "银行账户", icon: "🏦", currency: "CNY", exclude: false, notes: "", "sub-accounts": [] }
        ],
        storedValueCards: [
          { name: currentLang === "en" ? "Stored Value Card" : "储值卡", icon: "🎫", currency: "CNY", cardNumber: null, pin: null, exclude: false, notes: "", "sub-accounts": [] }
        ],
        investmentAccounts: [
          { name: currentLang === "en" ? "Investment Account" : "投资账户", icon: "📈", currency: "CNY", exclude: false, notes: "", "sub-accounts": [] }
        ]
      },
      "expense-categories": [
        { primary: currentLang === "en" ? "Shopping" : "购物", icon: "🛍️", secondaries: [
          { name: currentLang === "en" ? "Offline Expenditure" : "线下消费", icon: "🛒" },
          { name: currentLang === "en" ? "Online Shopping" : "网购", icon: "🛒" }
        ]},

        { primary: currentLang === "en" ? "Travel" : "出行", icon: "🚗", secondaries: [
          { name: currentLang === "en" ? "Public Transit" : "公共交通", icon: "🚇" },
          { name: currentLang === "en" ? "Ride Services" : "网约车", icon: "🚕" },
          { name: currentLang === "en" ? "Fuel Costs" : "燃油费", icon: "⛽" },
          { name: currentLang === "en" ? "Parking Costs" : "停车费", icon: "🅿️" },
          { name: currentLang === "en" ? "Auto Insurance" : "车险", icon: "🚗" },
          { name: currentLang === "en" ? "Vechicle Purchase" : "购车", icon: "🚗" },
          { name: currentLang === "en" ? "Vechicle Repair" : "车辆维修", icon: "🔧" },
          { name: currentLang === "en" ? "Flight & Train Tickets" : "机票/火车票", icon: "✈️" },
          { name: currentLang === "en" ? "Lodging" : "住宿", icon: "🏨" }
        ]},

        { primary: currentLang === "en" ? "Entertainment" : "娱乐", icon: "🎭", secondaries: [
          { name: currentLang === "en" ? "Music & Films" : "音乐/电影", icon: "🎬" },
          { name: currentLang === "en" ? "Sightseeing" : "观光", icon: "🗺️" }
        ]},

        { primary: currentLang === "en" ? "Subscriptions" : "订阅", icon: "🔄", secondaries: [
          { name: currentLang === "en" ? "Phone Bills" : "电话费", icon: "📱" },
          { name: currentLang === "en" ? "Streaming" : "流媒体订阅", icon: "📺" }
        ]},

        { primary: currentLang === "en" ? "Home" : "家庭", icon: "🏡", secondaries: [
          { name: currentLang === "en" ? "Housing" : "住房", icon: "🏠" },
          { name: currentLang === "en" ? "Utilities" : "水电煤气", icon: "💡" },
          { name: currentLang === "en" ? "Home Insurance" : "家财险", icon: "🏠" },
          { name: currentLang === "en" ? "Decoration" : "装修/装饰", icon: "🖼️" }
        ]},

        { primary: currentLang === "en" ? "Health" : "健康", icon: "🏥", secondaries: [
          { name: currentLang === "en" ? "Hospitals & Clinics" : "医院/诊所", icon: "🏥" },
          { name: currentLang === "en" ? "Medication" : "药品", icon: "💊" },
          { name: currentLang === "en" ? "Health Insurance Premiums" : "医疗保险费", icon: "🛡️" }
        ]},

        { primary: currentLang === "en" ? "Public Fees" : "公共费用", icon: "🏛️", secondaries: [
          { name: currentLang === "en" ? "Tuition & Exams" : "学费/考试费", icon: "🎓" },
          { name: currentLang === "en" ? "Tax Payment" : "税款", icon: "🧾" },
          { name: currentLang === "en" ? "Pension Contribution" : "养老金缴纳", icon: "🪙" },
          { name: currentLang === "en" ? "Professional Expenses" : "职业相关费用", icon: "🏛️" }
        ]},

        { primary: currentLang === "en" ? "Personal Spending" : "个人消费", icon: "💇", secondaries: [
          { name: currentLang === "en" ? "Haircut" : "理发", icon: "💇" },
          { name: currentLang === "en" ? "Laundry" : "洗衣", icon: "🧺" }
        ]},

        { primary: currentLang === "en" ? "Gifts & Investments" : "礼金与投资", icon: "💸", secondaries: [
          { name: currentLang === "en" ? "Outgoing Transfer" : "转账支出", icon: "💸" },
          { name: currentLang === "en" ? "Gifts" : "礼物", icon: "🎁" },
          { name: currentLang === "en" ? "Donations" : "捐赠", icon: "🎁" },
          { name: currentLang === "en" ? "Insurance Payments" : "保险缴费", icon: "💵" },
          { name: currentLang === "en" ? "Investment Loss" : "投资亏损", icon: "📉" }
        ]}
      ],
      "income-categories": [
        { primary: currentLang === "en" ? "Professional Income" : "职业收入", icon: "💼", secondaries: [
          { name: currentLang === "en" ? "Pay" : "工资", icon: "💵" },
          { name: currentLang === "en" ? "Scholarships & Awards" : "奖学金/奖金", icon: "🏅" }
        ]},

        { primary: currentLang === "en" ? "Floating Income" : "浮动收入", icon: "🎉", secondaries: [
          { name: currentLang === "en" ? "Investment Earnings" : "投资收益", icon: "📈" },
          { name: currentLang === "en" ? "Giveaways" : "赠品/抽奖", icon: "🎉" },
          { name: currentLang === "en" ? "Red Packet Receipts" : "红包收入", icon: "🧧" }
        ]},

        { primary: currentLang === "en" ? "Refunds" : "退款", icon: "💰", secondaries: [
          { name: currentLang === "en" ? "Tax Credits" : "税务退还", icon: "💰" },
          { name: currentLang === "en" ? "Reimbursement" : "报销", icon: "↩️" },
          { name: currentLang === "en" ? "Insurance Payout" : "保险理赔", icon: "💰" }
        ]},

        { primary: currentLang === "en" ? "Pocket Money" : "零用钱", icon: "🪙", secondaries: [
          { name: currentLang === "en" ? "Incoming Transfer" : "转账收入", icon: "💰" }
        ]}
      ],
      collections: [
        { name: currentLang === "en" ? "Food & Drinks" : "餐饮", icon: "🍽️" },
        { name: currentLang === "en" ? "Life Expenditure" : "生活支出", icon: "🧩" },
        { name: currentLang === "en" ? "Housing" : "住房", icon: "🏡" },
        { name: currentLang === "en" ? "Pay" : "工资", icon: "💵" },
        { name: currentLang === "en" ? "Scholarships & Awards" : "奖学金/奖金", icon: "🏅" },
        { name: currentLang === "en" ? "Tax-Free Investments" : "免税投资", icon: "📈" },
        { name: currentLang === "en" ? "Taxable Investments" : "应税投资", icon: "📈" },
        { name: currentLang === "en" ? "Gifts" : "礼物", icon: "🎁" },
        { name: currentLang === "en" ? "Medical Expenses" : "医疗支出", icon: "🏥" },
        { name: currentLang === "en" ? "Transportation" : "交通", icon: "🚗" },
        { name: currentLang === "en" ? "Travel Expenses" : "旅行支出", icon: "✈️" },
        { name: currentLang === "en" ? "Entertainment" : "娱乐", icon: "🎭" },
        { name: currentLang === "en" ? "Phone Bills" : "电话费", icon: "📱" },
        { name: currentLang === "en" ? "Electronic Devices" : "电子设备", icon: "💻" },
        { name: currentLang === "en" ? "Subscriptions" : "订阅", icon: "🔄" },
        { name: currentLang === "en" ? "Pension" : "养老金", icon: "💰" },
        { name: currentLang === "en" ? "Tax & Credits" : "税费与抵扣", icon: "🧾" },
        { name: currentLang === "en" ? "Public Fees" : "公共费用", icon: "🏛️" },
        { name: currentLang === "en" ? "Incoming Transfer" : "转账收入", icon: "💰" },
        { name: currentLang === "en" ? "Outgoing Transfer" : "转账支出", icon: "💸" },
        { name: currentLang === "en" ? "Refunds" : "退款", icon: "🔄" },
        { name: currentLang === "en" ? "Work Expenses" : "工作支出", icon: "💼" }
      ],
      subjects: [
        { name: currentLang === "en" ? "Myself" : "自己", icon: "🙂" },
        { name: currentLang === "en" ? "Partner" : "伴侣", icon: "❤️" },
        { name: currentLang === "en" ? "Children" : "子女", icon: "🧒" },
        { name: currentLang === "en" ? "Parents" : "父母", icon: "👨‍👩‍👦" },
        { name: currentLang === "en" ? "Family" : "家庭", icon: "👪" },
        { name: currentLang === "en" ? "Friends" : "朋友", icon: "🧑‍🤝‍🧑" },
        { name: currentLang === "en" ? "Neighbourhood" : "邻里", icon: "🏘️" }
      ],
      tags: [],
      entriesThisYear: {} // this document will only store entries of this month to reduce reading and writing of individual documents
    });

    // Profile doc
    await setDoc(profileRef, { email });

    const householdSnap = await getDoc(householdRef);
    const household = householdSnap.data();
    const firstExpensePrimary = household["expense-categories"][0];
    const firstIncomePrimary = household["income-categories"][0];
    
    const accountEntries = Object.entries(household.accounts);
    const [firstAccountType, firstAccountList] = accountEntries[0];
    const firstAccount = firstAccountList[0];
    const [secondAccountType, secondAccountList] = accountEntries[1];
    const secondAccount = secondAccountList?.[0];

    const defaults = {
      expense: {
        householdId: myHouseholdId,
        accountType: firstAccountType,
        account: firstAccount.name,
        accountIcon: firstAccount.icon,
        primary: firstExpensePrimary.primary,
        primaryIcon: firstExpensePrimary.icon,
        secondary: firstExpensePrimary.secondaries[0].name,
        secondaryIcon: firstExpensePrimary.secondaries[0].icon,
        subject: household.subjects[0].name,
        subjectIcon: household.subjects[0].icon,
        collection: household.collections[0].name,
        collectionIcon: household.collections[0].icon
      },

      income: {
        householdId: myHouseholdId,
        accountType: firstAccountType,
        account: firstAccount.name,
        accountIcon: firstAccount.icon,
        primary: firstIncomePrimary.primary,
        primaryIcon: firstExpensePrimary.icon,
        secondary: firstIncomePrimary.secondaries[0].name,
        secondaryIcon: firstExpensePrimary.secondaries[0].icon,
        subject: household.subjects[0].name,
        subjectIcon: household.subjects[0].icon,
        collection: household.collections[0].name,
        collectionIcon: household.collections[0].icon
      },

      transfer: {
        householdId: myHouseholdId,
        fromType: firstAccountType,
        fromAccount: firstAccount.name,
        fromAccountIcon: firstAccount.icon,
        toType: secondAccountType,
        toAccount: secondAccount.name,
        toAccountIcon: secondAccount.icon
      },

      balance: {
        householdId: myHouseholdId,
        accountType: firstAccountType,
        account: firstAccount.name,
        accountIcon: firstAccount.icon
      }
    };

    // User doc
    await setDoc(userRef, {
      profile: {
        email,
        language: currentLang,
        homeImages: [],
        fontsize: "",
        themeColor: "",
        settings: {},
        lastSynced: getFormattedTime(),
      },
      personalHouseholdId: myHouseholdId,
      households: [myHouseholdId],
      orderedHouseholds: [myHouseholdId],
      defaults: defaults
    })

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

async function logout() {
  await del("github_token");
  window.location.href = "/";
  window.location.reload();
}
window.logout = logout;

function mergeEntriesThisYear(doc) {
  const merged = {};

  for (const key of Object.keys(doc)) {
    if (key.startsWith("entriesThisYear_part")) {
      Object.assign(merged, doc[key]);
    }
  }

  return merged;
}

function removeYearParts(doc) {
  for (const key of Object.keys(doc)) {
    if (key.startsWith("entriesThisYear_part")) {
      delete doc[key];
    }
  }
}

async function syncData(userId) {
  let lastSyncStatus = {};

  console.time("Retrieve data from Firebase");

  // --- Fetch user doc ---
  const userRef = doc(db, "users", userId);
  let userSnap; 
  do { 
    userSnap = await getDoc(userRef); 
  } while (!userSnap.exists()); // make sure userSnap is ready. This is useful after signup.
  const userDoc = userSnap.data();

  // Track whether the user document came from server
  let freshFromServer = userSnap.metadata.fromCache === false;
  if (freshFromServer) {
    lastSyncStatus["个人偏好"] = userDoc.profile.lastSynced
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

      // In this local variable, merge entriesThisYear into one, and remove parts
      householdDocs[hid].entriesThisYear = mergeEntriesThisYear(householdDocs[hid]);
      removeYearParts(householdDocs[hid]);

      // subcollection entries will not synced at this time
      // individual entries will only be accessed ad hoc

      // If a household doc came from server, mark it as fresh
      if (hSnap.metadata.fromCache === false) {
        freshFromServer = true;
        if (freshFromServer) {
          if (!lastSyncStatus[householdDocs[hid].name]) {
            lastSyncStatus[householdDocs[hid].name] = {};
          }
          lastSyncStatus[householdDocs[hid].name] = {[{en:"Household Settings", zh:"账本设置"}[currentLang]]: householdDocs[hid].lastSynced}
        }
      }
    })
  );

  console.timeEnd("Retrieve data from Firebase");

  // assuming userDoc and householdDocs will always face the same online/offline connection
  if (Object.keys(lastSyncStatus).length > 0) {// if it's not empty
    localStorage.setItem("lastSyncStatus", JSON.stringify(lastSyncStatus));
  }

  populateHouseholdDropdown(userDoc, householdDocs); // prepare the dropdown list for households

  return { userDoc, householdDocs };
}

// --- Persistent login state ---
async function onAuthStateChanged(auth, user) {
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
    
  } else {
    window.scrollTo(0, 0);
  }
};

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

function setCurrentTime(button, subWorkspace) {
  const now = new Date();

  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const hh = String(now.getHours()).padStart(2, "0");
  const min = String(now.getMinutes()).padStart(2, "0");
  const ss = String(now.getSeconds()).padStart(2, "0");

  const prefix = getDatePrefix(now);

  if (!subWorkspace.inputTransactionTimeRaw) {
    subWorkspace.inputTransactionTimeRaw = {};
  }
  subWorkspace.inputTransactionTimeRaw.yyyy = Number(yyyy);
  subWorkspace.inputTransactionTimeRaw.mm = Number(mm);
  subWorkspace.inputTransactionTimeRaw.dd = Number(dd);
  subWorkspace.inputTransactionTimeRaw.hh = Number(hh);
  subWorkspace.inputTransactionTimeRaw.min = Number(min);
  subWorkspace.inputTransactionTimeRaw.ss = Number(ss);

  subWorkspace.inputTransactionTime = `${yyyy}-${mm}-${dd} ${hh}:${min}:${ss}`;

  button.textContent = `${prefix}${yyyy}-${mm}-${dd} ${hh}:${min}`;
  button.dataset.value = now.toISOString();
}

function setDefaultHouseholds(button, subWorkspace) {
  // Set default if workspace is empty
  transactionTypes.forEach(type => {
    if (!subWorkspace[type]) {
      subWorkspace[type] = {};
    }
    
    if (!subWorkspace[type].householdId) {
      subWorkspace[type].householdId = userDoc.defaults[type].householdId;
    }
  });

  let inputHouseholdId = subWorkspace[subWorkspace.inputType].householdId;

  button.textContent = householdDocs[inputHouseholdId].name;
  button.dataset.value = inputHouseholdId;
}

function setDefaultCategory(button, subWorkspace) {
  const inputType = subWorkspace.inputType;
  const householdId = subWorkspace[inputType].householdId;

  // Set default if workspace is empty, or loading values and look for icons
  transactionTypes.forEach(type => {
    if (["expense", "income"].includes(type)) {
      // transfer and balance types do not have a category

      if (!subWorkspace[type]) {
        subWorkspace[type] = {};
      }

      if (!subWorkspace[type].primaryCategory) {
        subWorkspace[type].primaryCategory = userDoc.defaults[type].primary;
        subWorkspace[type].primaryCategoryIcon = userDoc.defaults[type].primaryIcon;
        subWorkspace[type].secondaryCategory = userDoc.defaults[type].secondary;
        subWorkspace[type].secondaryCategoryIcon = userDoc.defaults[type].secondaryIcon;
      } else {
        const { primaryIcon, secondaryIcon } = getCategoryIcon(householdId, inputType, subWorkspace[type].primaryCategory, subWorkspace[type].secondaryCategory);
        subWorkspace[type].primaryCategoryIcon = primaryIcon;
        subWorkspace[type].secondaryCategoryIcon = secondaryIcon;
      }
      
      subWorkspace[type].catInnerHTML = `
        <span class="cat-part">
          <span class="icon selected">${subWorkspace[type].primaryCategoryIcon}</span>
          <span class="cat-label">${subWorkspace[type].primaryCategory}</span>
        </span>
        <span class="cat-separator">&gt;</span>
        <span class="cat-part">
          <span class="icon selected">${subWorkspace[type].secondaryCategoryIcon}</span>
          <span class="cat-label">${subWorkspace[type].secondaryCategory}</span>
        </span>
      `;
    }
  });

  
  if (["expense", "income"].includes(subWorkspace.inputType)) {
    // transfer and balance types do not have a category

    const cats = householdDocs[householdId][inputType + "-categories"]; 

    // Build primary list
    const primaryList = cats.map(cat => ({
      icon: cat.icon || "",
      name: cat.primary || ""
    }));

    // Build secondary map
    const secondaryMap = {};
    cats.forEach(cat => {
      secondaryMap[cat.primary] = Object.entries(cat.secondaries || {}).map(
        ([name, data]) => ({
          icon: data.icon || "",
          name
        })
      );
    });

    const currentPrimary = subWorkspace[inputType].primaryCategory;
    const primaryExists = primaryList.some(p => p.name === currentPrimary);

    if (!primaryExists) {
      const def = userDoc.defaults[inputType];
      const sameHouseholdAsDefault = householdId === def.householdId;

      if (sameHouseholdAsDefault) {
        // Restore defaults
        subWorkspace[inputType].primaryCategory = def.primary;
        subWorkspace[inputType].primaryCategoryIcon = def.primaryIcon;

        subWorkspace[inputType].secondaryCategory = def.secondary;
        subWorkspace[inputType].secondaryCategoryIcon = def.secondaryIcon;

      } else {
        // Use first available primary + its first secondary
        const firstPrimary = primaryList[0].name;
        const firstSecondaryObj = secondaryMap[firstPrimary]?.[0] || { name: "", icon: "" };

        subWorkspace[inputType].primaryCategory = firstPrimary;
        subWorkspace[inputType].primaryCategoryIcon = primaryList[0].icon;

        subWorkspace[inputType].secondaryCategory = firstSecondaryObj.name;
        subWorkspace[inputType].secondaryCategoryIcon = firstSecondaryObj.icon;
      }

      // Update HTML
      subWorkspace[inputType].catInnerHTML = `
        <span class="cat-part">
          <span class="icon selected">${subWorkspace[inputType].primaryCategoryIcon}</span>
          <span class="cat-label">${subWorkspace[inputType].primaryCategory}</span>
        </span>
        <span class="cat-separator">&gt;</span>
        <span class="cat-part">
          <span class="icon selected">${subWorkspace[inputType].secondaryCategoryIcon}</span>
          <span class="cat-label">${subWorkspace[inputType].secondaryCategory}</span>
        </span>
      `;

    }

    button.innerHTML = subWorkspace[inputType].catInnerHTML;

    // Prepare category columns
    const primaryCol   = categorySelector.querySelector(".primary-col");
    const secondaryCol = categorySelector.querySelector(".secondary-col");

    createList(primaryCol, primaryList);
    ScrollToSelectItem(primaryCol, subWorkspace[inputType].primaryCategory);

    updateSecondaryColumn(button, subWorkspace, secondaryCol);
    ScrollToSelectItem(secondaryCol, subWorkspace[inputType].secondaryCategory);
  }
}

function findSelectedAccount(householdId, accountType, accountName) {
  const accountsRoot = householdDocs[householdId].accounts;

  // -----------------------------------------------------
  // If accountType is null → search ALL account types
  // -----------------------------------------------------
  if (!accountType) {
    for (const typeKey of accountTypes) {
      const result = findSelectedAccount(householdId, typeKey, accountName);
      if (result) return result;
    }
    return null; // not found anywhere
  }

  // -----------------------------------------------------
  // Normal behavior: search within a specific accountType
  // -----------------------------------------------------
  const accountsByType = accountsRoot[accountType];
  if (!accountsByType) return null;

  // 1. Try to match a top-level account
  const top = accountsByType.find(acc => acc.name === accountName);
  if (top) {
    return {
      type: accountType,
      account: top,
      parent: null
    };
  }

  // 2. Try to match a sub-account
  for (const acc of accountsByType) {
    const subs = acc["sub-accounts"] || [];
    const sub = subs.find(sa => sa.name === accountName);

    if (sub) {
      return {
        type: accountType,
        account: sub,
        parent: acc
      };
    }
  }

  return null;
}

function setDefaultAccount(button, subWorkspace) {
  const t = translations[currentLang];

  // Set default if workspace is empty
  transactionTypes.forEach(type => {
    if (!subWorkspace[type]) {
      subWorkspace[type] = {};
    }

    if (["expense", "income", "balance"].includes(type)) {
      // these types have one account
      if (!subWorkspace[type].accountInfo) {
        subWorkspace[type].accountInfo = findSelectedAccount(subWorkspace[type].householdId, userDoc.defaults[type].accountType, userDoc.defaults[type].account)
        const accountType = subWorkspace[type].accountInfo.type;
        const accountName = subWorkspace[type].accountInfo.account.name;
        const accountIcon = subWorkspace[type].accountInfo.account.icon;
        const accountCurrency = subWorkspace[type].accountInfo.account.currency;
        
        subWorkspace[type].accountInnerHTML = `
          <span class="cat-part">
            <span class="icon selected">${accountIcon}</span>
            <span class="cat-label">${accountName} (${accountCurrency})</span>
          </span>
        `;
      }
    }

    if (type === "transfer") {
      // this type has two accounts

      // FROM ACCOUNT
      if (!subWorkspace.transfer.fromAccountInfo) {
        subWorkspace.transfer.fromAccountInfo = findSelectedAccount(subWorkspace.transfer.householdId, userDoc.defaults.transfer.fromType, userDoc.defaults.transfer.fromAccount);
        const from = subWorkspace.transfer.fromAccountInfo.account;
        const fromIcon = from.icon || "";
        const fromName = from.name;
        const fromCurrency = from.currency;

        subWorkspace.transfer.fromAccountInnerHTML = `
          <span class="cat-part">
            <span class="icon selected">${fromIcon}</span>
            <span class="cat-label">${fromName} (${fromCurrency})</span>
          </span>
        `;
      }

      // TO ACCOUNT
      if (!subWorkspace.transfer.toAccountInfo) {
        subWorkspace.transfer.toAccountInfo = findSelectedAccount(subWorkspace.transfer.householdId, userDoc.defaults.transfer.toType, userDoc.defaults.transfer.toAccount);
        const to = subWorkspace.transfer.toAccountInfo.account;
        const toIcon = to.icon || "";
        const toName = to.name;
        const toCurrency = to.currency;

        subWorkspace.transfer.toAccountInnerHTML = `
          <span class="cat-part">
            <span class="icon selected">${toIcon}</span>
            <span class="cat-label">${toName} (${toCurrency})</span>
          </span>
        `;
      }

      if (subWorkspace.transfer.fromAccountInfo.account.currency === subWorkspace.transfer.toAccountInfo.account.currency) {
        subWorkspace.transfer.sameCurrency = true;
      } else {
        subWorkspace.transfer.sameCurrency = false;
      }
    }
  });

  const inputType = subWorkspace.inputType;
  const householdId = subWorkspace[inputType].householdId;

  // Prepare account column
  const accountTypeCol = accountSelector.querySelector(".primary-col");
  const accountCol = accountSelector.querySelector(".secondary-col");

  if (["expense", "income", "balance"].includes(inputType)) {
    const accountTypeList = accountTypes.map(type => t[type]);

    // If accountInfo is missing, initialize it using defaults
    if (!subWorkspace[inputType].accountInfo) {
      const def = userDoc.defaults[inputType];

      subWorkspace[inputType].accountInfo = findSelectedAccount(householdId, def.accountType, def.account);

      // Extract account info
      const info = subWorkspace[inputType].accountInfo;
      const accountObj = info.account;
      const accountName = accountObj.name;
      const accountIcon = accountObj.icon || "";
      const accountCurrency = accountObj.currency;

      subWorkspace[inputType].accountInnerHTML = `
        <span class="cat-part">
          <span class="icon selected">${accountIcon}</span>
          <span class="cat-label">${accountName} (${accountCurrency})</span>
        </span>
      `;
    }

    button.innerHTML = subWorkspace[inputType].accountInnerHTML;

    createList(accountTypeCol, accountTypeList);
    ScrollToSelectItem(accountTypeCol, t[subWorkspace[inputType].accountInfo.type]); 
    
    updateSecondaryColumn(button, subWorkspace, accountCol);
    ScrollToSelectItem(accountCol, `${subWorkspace[inputType].accountInfo.name} (${subWorkspace[inputType].accountInfo.currency})`); 
  }

  if (inputType === "transfer") {
    const allAccounts = [];

    accountTypes.forEach(typeKey => {
      const accountsOfType = householdDocs[householdId].accounts[typeKey] || [];

      accountsOfType.forEach(acc => {
        const subs = acc["sub-accounts"] || [];

        if (subs.length > 0) {
          // Add each sub-account
          subs.forEach(sub => {
            allAccounts.push({
              icon: sub.icon,
              name: `${sub.name} (${sub.currency})`,
              currency: sub.currency,
              parent: acc.name,
              type: typeKey
            });
          });
        } else {
          // Add the main account
          allAccounts.push({
            icon: acc.icon,
            name: `${acc.name} (${acc.currency})`,
            currency: acc.currency,
            parent: null,
            type: typeKey
          });
        }
      });
    });

    button[0].innerHTML = subWorkspace[inputType].fromAccountInnerHTML;
    button[1].innerHTML = subWorkspace[inputType].toAccountInnerHTML;

    createList(accountTypeCol, allAccounts);
    ScrollToSelectItem(accountTypeCol, `${subWorkspace[inputType].fromAccountInfo.name} (${subWorkspace[inputType].fromAccountInfo.currency})`); 

    createList(accountCol, allAccounts);
    ScrollToSelectItem(accountTypeCol, `${subWorkspace[inputType].toAccountInfo.name} (${subWorkspace[inputType].toAccountInfo.currency})`); 
  }
}

function setDefaultSubject(button, subWorkspace) {
  // Initialize workspace for each type
  transactionTypes.forEach(type => {
    if (["expense", "income"].includes(type)) {
      if (!subWorkspace[type]) {
        subWorkspace[type] = {};
      }

      // Set default subject if missing
      if (!subWorkspace[type].subject) {
        subWorkspace[type].subject = userDoc.defaults[type].subject;
        subWorkspace[type].subjectIcon = userDoc.defaults[type].subjectIcon;

        subWorkspace[type].subjectInnerHTML = `
          <span class="cat-part">
            <span class="icon selected">${subWorkspace[type].subjectIcon}</span>
            <span class="cat-label">${subWorkspace[type].subject}</span>
          </span>
        `;
      }
    }
  });

  const inputType = subWorkspace.inputType;
  const householdId = subWorkspace[inputType].householdId;

  if (["expense", "income"].includes(inputType)) {
    const subjects = householdDocs[householdId].subjects;

    const currentSubject = subWorkspace[inputType].subject;
    const subjectExists = subjects.some(s => s.name === currentSubject);

    if (!subjectExists) {
      const def = userDoc.defaults[inputType];
      const sameHouseholdAsDefault = householdId === def.householdId;

      if (sameHouseholdAsDefault) {
        // Restore defaults
        subWorkspace[inputType].subject = def.subject;
        subWorkspace[inputType].subjectIcon = def.subjectIcon;

      } else {
        // Use first available subject
        const first = subjects[0] || { name: "", icon: "" };

        subWorkspace[inputType].subject = first.name;
        subWorkspace[inputType].subjectIcon = first.icon;
      }

      subWorkspace[inputType].subjectInnerHTML = `
        <span class="cat-part">
          <span class="icon selected">${subWorkspace[inputType].subjectIcon}</span>
          <span class="cat-label">${subWorkspace[inputType].subject}</span>
        </span>
      `;
    }

    // Update button
    button.innerHTML = subWorkspace[inputType].subjectInnerHTML;

    // Prepare subject column
    const subjectCol = subjectSelector.querySelector(".subject-col");

    createList(subjectCol, subjects);
    ScrollToSelectItem(subjectCol, subWorkspace[inputType].subject);
  }
}

function setDefaultCollection(button, subWorkspace) {
  // Initialize workspace for each type
  transactionTypes.forEach(type => {
    if (["expense", "income"].includes(type)) {
      if (!subWorkspace[type]) {
        subWorkspace[type] = {};
      }

      // Set default collection if missing
      if (!subWorkspace[type].collection) {
        subWorkspace[type].collection = userDoc.defaults[type].collection;
        subWorkspace[type].collectionIcon = userDoc.defaults[type].collectionIcon;

        subWorkspace[type].collectionInnerHTML = `
          <span class="cat-part">
            <span class="icon selected">${subWorkspace[type].collectionIcon}</span>
            <span class="cat-label">${subWorkspace[type].collection}</span>
          </span>
        `;
      }
    }
  });

  const inputType = subWorkspace.inputType;
  const householdId = subWorkspace[inputType].householdId;

  if (["expense", "income"].includes(inputType)) {
    const collections = householdDocs[householdId].collections;

    const currentCollection = subWorkspace[inputType].collection;
    const collectionExists = collections.some(c => c.name === currentCollection);

    if (!collectionExists) {
      const def = userDoc.defaults[inputType];
      const sameHouseholdAsDefault = householdId === def.householdId;

      if (sameHouseholdAsDefault) {
        // Restore defaults
        subWorkspace[inputType].collection = def.collection;
        subWorkspace[inputType].collectionIcon = def.collectionIcon;

      } else {
        // Use first available collection
        const first = collections[0] || { name: "", icon: "" };

        subWorkspace[inputType].collection = first.name;
        subWorkspace[inputType].collectionIcon = first.icon;
      }

      subWorkspace[inputType].collectionInnerHTML = `
        <span class="cat-part">
          <span class="icon selected">${subWorkspace[inputType].collectionIcon}</span>
          <span class="cat-label">${subWorkspace[inputType].collection}</span>
        </span>
      `;
    }

    // Update button
    button.innerHTML = subWorkspace[inputType].collectionInnerHTML;

    // Prepare collection column
    const collectionCol = collectionSelector.querySelector(".collection-col");

    createList(collectionCol, collections);
    ScrollToSelectItem(collectionCol, subWorkspace[inputType].collection);
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
  let subWorkspace = null;

  if (latestNavBtn === "nav-transaction") { // when creating an entry
    subWorkspace = workspace.create;
  } else {
    subWorkspace = workspace[latestNavBtn.replace("nav-", "")];
  }

  const inputType = transactionTypes[index];
  subWorkspace.inputTypeIndex = index;
  subWorkspace.inputType = inputType;

  wrapper.style.transform = `translateX(-${index * 105}%)`; // this includes the 5% gap in class .transaction-wrapper

  // Update active button
  tabButtons.forEach(btn => btn.classList.remove("active"));
  tabButtons[index].classList.add("active");

  vibrate(30); // milliseconds

  // Find the active tab container
  const activeTab = document.querySelectorAll(".transaction-page")[index];
  const activeForm = inputType + "-form";

  // household
  const householdEl = activeTab.querySelector(`#${activeForm} .selector-button[data-type='household']`);
  setDefaultHouseholds(householdEl, subWorkspace);
  
  // category
  if (["expense", "income"].includes(inputType)) {
    let categoryBtn = activeTab.querySelector(`#${activeForm} .selector-button[data-type='category']`);
    setDefaultCategory(categoryBtn, subWorkspace);
  }

  // account and amount
  if (["expense", "income", "balance"].includes(inputType)) {
    let accountBtn = activeTab.querySelector(`#${activeForm} .selector-button[data-type='account']`);
    setDefaultAccount(accountBtn, subWorkspace);

    let amountBtn = activeTab.querySelector(`#${activeForm} .amount-button`);
    let calculationBtn = activeTab.querySelector(`#${activeForm} .calculation`);
    if (subWorkspace.amount == null) {
      subWorkspace.amount = 0;
      subWorkspace.calculation = "";
    }
    amountBtn.textContent = subWorkspace.amount.toFixed(2);
    calculationBtn.textContent = subWorkspace.calculation;
    
  } else { // for transfer
    let fromAccountBtn = activeTab.querySelector(`#${activeForm} .selector-button[data-type='fromAccount']`);
    let toAccountBtn = activeTab.querySelector(`#${activeForm} .selector-button[data-type='toAccount']`);
    setDefaultAccount([fromAccountBtn, toAccountBtn], subWorkspace);

    // update both simple amount and exchange amount
    let amountBtn = activeTab.querySelector(`#${activeForm} .amount-button`);
    let calculationBtn = activeTab.querySelector(`#${activeForm} .calculation`);
    if (subWorkspace.amount == null) {
      subWorkspace.amount = 0;
      subWorkspace.calculation = "";
    }
    amountBtn.textContent = subWorkspace.amount.toFixed(2);
    calculationBtn.textContent = subWorkspace.calculation;

    let fromAmountBtn = document.getElementById('transfer-from-amount');
    let fromCalculationBtn = document.getElementById('transfer-from-calculation');
    fromAmountBtn.textContent = subWorkspace.amount.toFixed(2);
    fromCalculationBtn.textContent = subWorkspace.calculation;

    let toAmountBtn = document.getElementById('transfer-to-amount');
    let toCalculationBtn = document.getElementById('transfer-to-calculation');
    if (subWorkspace.transfer.toAmount == null) {
      subWorkspace.transfer.toAmount = 0;
      subWorkspace.transfer.toCalculation = "";
    }
    toAmountBtn.textContent = subWorkspace.transfer.toAmount.toFixed(2);
    toCalculationBtn.textContent = subWorkspace.transfer.toCalculation;

    const fromLabel = document.getElementById("exchange-rate-from-label");
    const toLabel   = document.getElementById("exchange-rate-to-label");
    fromLabel.textContent = subWorkspace.transfer.fromExchangeRate;
    toLabel.textContent   = subWorkspace.transfer.toExchangeRate;

  }
  // datetime
  const datetimeEl = activeTab.querySelector(`#${activeForm} .selector-button[data-type='datetime']`);
  const [yyyy, mm, dd, hh, min, ss] = parseDateFromString(subWorkspace.inputTransactionTime);
  
  if (!subWorkspace.inputTransactionTimeRaw) {
    subWorkspace.inputTransactionTimeRaw = {};
  }
  subWorkspace.inputTransactionTimeRaw.yyyy = Number(yyyy);
  subWorkspace.inputTransactionTimeRaw.mm = Number(mm);
  subWorkspace.inputTransactionTimeRaw.dd = Number(dd);
  subWorkspace.inputTransactionTimeRaw.hh = Number(hh);
  subWorkspace.inputTransactionTimeRaw.min = Number(min);
  subWorkspace.inputTransactionTimeRaw.ss = Number(ss);
  
  const dateObj = new Date(yyyy, mm - 1, dd, hh, min); // must use numbers
  const prefix = getDatePrefix(dateObj);
  datetimeEl.textContent = `${prefix}${yyyy}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")} ${String(hh).padStart(2, "0")}:${String(min).padStart(2, "0")}`;

  // subject
  if (["expense", "income"].includes(inputType)) {
    const subjectEl = activeTab.querySelector(`#${activeForm} .selector-button[data-type='subject']`);
    subjectEl.innerHTML = subWorkspace[inputType].subjectInnerHTML;

    // collection
    const collectionEl = activeTab.querySelector(`#${activeForm} .selector-button[data-type='collection']`);
    collectionEl.innerHTML = subWorkspace[inputType].collectionInnerHTML;
  }

  if (!Array.isArray(subWorkspace.tags)) {
    subWorkspace.tags = [];
  }

  addTag(subWorkspace.tags, subWorkspace);

  // notes
  if (subWorkspace.inputNotes !== undefined) {
    const notesEl = activeTab.querySelector(`#${activeForm} textarea[id$='notes']`);
    notesEl.value = subWorkspace.inputNotes;
  }
}

/* Parse datetime from string */
function parseDateFromString(string) {
  const text = removeDatePrefix(string);

  const [datePart, timePart] = text.split(" ");
  const [y, m, d] = datePart.split("-").map(Number);
  const [h, min, ss] = timePart.split(":").map(Number);

  return [y, m, d, h, min, ss];
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
  if (e.target.closest("input, textarea, [contenteditable]")) return;

  // do not add preventDefault otherwise the selectors won't show!
  // e.preventDefault();   // stop the browser from scrolling the page
  startX = e.touches[0].clientX;
});

wrapper.addEventListener("touchend", e => {
  if (e.target.closest("input, textarea, [contenteditable]")) return;
  
  let subWorkspace;
  
  if (latestNavBtn === "nav-transaction") { // when creating an entry
    subWorkspace = workspace.create;
  } else {
    subWorkspace = workspace[latestNavBtn.replace("nav-", "")];
  }

  const inputType = subWorkspace.inputType;
  const inputTypeIndex = transactionTypes.indexOf(inputType);

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
  const suggestionsDiv = container.querySelector(".tag-suggestions");

  // Listen for typing
  input.addEventListener("input", async (e) => {
    const text = e.target.value.trim();
    suggestionsDiv.innerHTML = "";

    if (text.length === 0) return;
    
    let subWorkspace = null;

    if (latestNavBtn === "nav-transaction") { // when creating an entry
      subWorkspace = workspace.create;
    } else {
      subWorkspace = workspace[latestNavBtn.replace("nav-", "")];
    }
    const inputType = subWorkspace.inputType;
    const householdId = subWorkspace[inputType].householdId;

    const tags = householdDocs[householdId].tags

    tags.forEach(tag => {
      if (tag && tag.includes(text)) {
        const span = document.createElement("span");
        span.textContent = tag;
        span.addEventListener("click", () => {
          input.value = tag;
        });
        suggestionsDiv.appendChild(span);
      }
    });
  });

  // Add button handler
  button.addEventListener("click", () => {
    const newTag = input.value.trim();
    if (!newTag) return;
    
    let subWorkspace = null;

    if (latestNavBtn === "nav-transaction") { // when creating an entry
      subWorkspace = workspace.create;
    } else {
      subWorkspace = workspace[latestNavBtn.replace("nav-", "")];
    }
    
    if (!Array.isArray(subWorkspace.tags)) {
      subWorkspace.tags = [];
    }
    subWorkspace.tags.push(newTag);
    addTag(newTag, subWorkspace);
    input.value = null;
  });
});

function addTag(tag, subWorkspace) {
  // Find the form container
  const form = document.getElementById(`${subWorkspace.inputType}-form`);
  if (!form) return;

  // Find the .tagged div inside this form
  const container = form.querySelector('.tagged');
  if (!container) return;

  // Helper to create a single tag element
  function createTagElement(tagValue) {
    const tagEl = document.createElement('div');
    tagEl.className = 'tag';

    tagEl.innerHTML = `
      <span>${tagValue}</span>
      <button class="delete-tag">×</button>
    `;

    // Delete behavior
    tagEl.querySelector('.delete-tag').addEventListener('click', () => {
      // Remove from UI
      tagEl.remove();

      // Remove from data model
      const index = subWorkspace.tags.indexOf(tagValue);
      if (index !== -1) {
        subWorkspace.tags.splice(index, 1);
      }
    });

    return tagEl;
  }

  // If tag is an array → clear and render all
  if (Array.isArray(tag)) {
    container.innerHTML = ""; // clear UI

    tag.forEach(t => {
      const tagEl = createTagElement(t);
      console.log(tagEl)
      container.appendChild(tagEl);
    });

    return;
  }

  // Otherwise tag is a single string → append one
  const tagEl = createTagElement(tag);
  container.appendChild(tagEl);
}


document.querySelectorAll('textarea.transaction-notes').forEach(textarea => {
  textarea.addEventListener('input', function () {
    this.style.height = 'auto';              // reset height
    this.style.height = this.scrollHeight + 'px'; // set to content height

    let subWorkspace = null;

    if (latestNavBtn === "nav-transaction") { // when creating an entry
      subWorkspace = workspace.create;
    } else {
      subWorkspace = workspace[latestNavBtn.replace("nav-", "")];
    }

    subWorkspace.inputNotes = this.value; // copy content into inputNotes
  });
});

function determineTransactionIsThisYear(transactionTime) {
  // Determine if a date belongs in this month
  // Extract YYYY
  const entryYear = transactionTime.slice(0, 4);

  // Current YYYY
  const now = new Date();
  const currentYear = String(now.getFullYear());

  const isThisYear = entryYear === currentYear;

  return isThisYear
}

function estimateSize(obj) {
  return new Blob([JSON.stringify(obj)]).size;
}

const MAX_SAFE_SIZE = 900 * 1024; // 900 KB buffer

function splitIntoParts(entriesThisYear) {
  const parts = [];
  let current = {};
  
  for (const [entryId, entryData] of Object.entries(entriesThisYear)) {
    // Try adding to current part
    current[entryId] = entryData;

    if (estimateSize(current) > MAX_SAFE_SIZE) {
      // Remove the last added entry
      delete current[entryId];

      // Save the full part
      parts.push(current);

      // Start a new part with the entry that didn't fit
      current = { [entryId]: entryData };
    }
  }

  // Push the final part
  if (Object.keys(current).length > 0) {
    parts.push(current);
  }

  return parts;
}

// --- Ledger add entry ---
async function saveEntry() {
  if (!currentUser) return;

  let subWorkspace = null;
  let nav = true;
  let entryId = null;
  let entryId_original = null;
  let writeMode = null;

  if (latestNavBtn === "nav-transaction") { // when creating an entry
    nav = 'create';
  } else {
    nav = latestNavBtn.replace("nav-", "");
  }

  subWorkspace = workspace[nav];

  console.log(subWorkspace)
  
  const inputType = subWorkspace.inputType;

  const householdId = subWorkspace[inputType].householdId; // regardless of household name

  // 🔑 Store transaction under selected household
  try {
    // 1. Reference the household document
    const householdRef = doc(db, "households", householdId);

    // 2. Generate a unique entry ID if entry date has changed    

    if (nav === 'create') {
      entryId = subWorkspace.inputTransactionTime.replace(/[- :]/g, "") +
           Math.floor(Math.random() * 1_000_000)
             .toString()
             .padStart(6, "0");
      writeMode = 'create'

    } else if (entryData_original[nav].transactionTime !== subWorkspace.inputTransactionTime) {
      entryId = subWorkspace.inputTransactionTime.replace(/[- :]/g, "") +
           Math.floor(Math.random() * 1_000_000)
             .toString()
             .padStart(6, "0");
      entryId_original = entryData_original[nav].entryId;
      writeMode = 'overwriteWithNewDate'

    } else {
      entryId = entryData_original[nav].entryId;
      writeMode = 'overwriteSimple'
    }

    let entryData;
    
    // 3. Build the entry object
    if (["expense", "income"].includes(inputType)) {
      entryData = {
        entryId,
        type: inputType,
        amount: subWorkspace.amount ?? 0,
        householdId,
        primaryCategory: subWorkspace[inputType].primaryCategory,
        secondaryCategory: subWorkspace[inputType].secondaryCategory,
        account: subWorkspace[inputType].accountInfo.account.name,
        currency: subWorkspace[inputType].accountInfo.account.currency,
        transactionTime: subWorkspace.inputTransactionTime,
        subject: subWorkspace[inputType].subject,
        collection: subWorkspace[inputType].collection,
        tags: subWorkspace.tags ?? [],
        notes: subWorkspace.notes ?? "",

        createdBy: currentUser.uid,
        createdTimestamp: getFormattedTime(),
        lastModifiedBy: currentUser.uid,
        lastModifiedTimestamp: getFormattedTime(),
      };
    } else if (["transfer"].includes(inputType)) {
      entryData = {
        entryId,
        type: inputType,
        amount: subWorkspace.amount ?? 0,
        toAmount: subWorkspace.toAmount ?? 0,
        sameCurrency: subWorkspace[inputType].sameCurrency,
        householdId,
        fromAccount: subWorkspace[inputType].fromAccountInfo.account.name,
        fromCurrency: subWorkspace[inputType].fromAccountInfo.account.currency,
        toAccount: subWorkspace[inputType].fromAccountInfo.account.name,
        toCurrency: subWorkspace[inputType].toAccountInfo.account.currency,
        transactionTime: subWorkspace.inputTransactionTime,
        tags: subWorkspace.tags ?? [],
        notes: subWorkspace.notes ?? "",

        createdBy: currentUser.uid,
        createdTimestamp: getFormattedTime(),
        lastModifiedBy: currentUser.uid,
        lastModifiedTimestamp: getFormattedTime(),
      };
    } else if (["balance"].includes(inputType)) {
      entryData = {
        entryId,
        type: inputType,
        amount: subWorkspace.amount ?? 0,
        householdId,
        account: subWorkspace[inputType].accountInfo.account.name,
        currency: subWorkspace[inputType].accountInfo.account.currency,
        transactionTime: subWorkspace.inputTransactionTime,
        tags: subWorkspace.tags ?? [],
        notes: subWorkspace.notes ?? "",

        createdBy: currentUser.uid,
        createdTimestamp: getFormattedTime(),
        lastModifiedBy: currentUser.uid,
        lastModifiedTimestamp: getFormattedTime(),
      };
    }

    // 4. entries is now a subcollection under the household
    const entryRef = doc(db, "households", householdId, "entries", entryId);
    await setDoc(entryRef, entryData, { merge: true }); // create or update a doc by entryId
    
    const isThisYear = determineTransactionIsThisYear(entryData.transactionTime);
    const isThisYear_Original = determineTransactionIsThisYear(entryData_original.transactionTime);

    if (isThisYear) {
      householdDocs[householdId].entriesThisYear ??= {};
      householdDocs[householdId].entriesThisYear[entryId] = entryData; // add it to entriesThisYear
    }
    
    if (writeMode === 'overwriteWithNewDate') { // the old entry needs to be deleted
      const entryRef_Original = doc(db, "households", householdId, "entries", entryId_original); 
      await deleteDoc(entryRef_Original);

      if (isThisYear_Original) {
        delete householdDocs[householdId].entriesThisYear[entryId_original];
      }
    }

    const parts = splitIntoParts(householdDocs[householdId].entriesThisYear);

    const updatePayload = {
      lastSynced: getFormattedTime()
    };

    // add parts for this year // these will go into entriesThisYear_part1, _part2, etc.
    parts.forEach((part, index) => {
      const key = `entriesThisYear_part${index + 1}`;
      updatePayload[key] = part;
    });

    // remove extra parts that are no longer needed
    for (let i = parts.length + 1; i <= 20; i++) {
      const key = `entriesThisYear_part${i}`;
      updatePayload[key] = deleteField();
    }

    await updateDoc(householdRef, updatePayload);

    console.log("saveEntry: total number of entriesThisYear parts:", parts.length)

    if (nav !== "create") {
      const changes = diffEntries(entryData_original[nav], entryData);

      // Read the current log
      const log = householdDocs[householdId].entryChangeLog || [];

      // Append the new change
      log.push(changes);

      // If too long, trim the oldest entries
      const MAX_LOG = 1000;
      const trimmed = log.length > MAX_LOG
        ? log.slice(log.length - MAX_LOG)   // keep last 1000
        : log;

      // Write back the trimmed log
      await updateDoc(householdRef, {
        entryChangeLog: trimmed
      });
    }

    showStatusMessage({
      en: 'Transaction saved successfully!',
      zh: '已成功保存！'
    }[currentLang], "success")

    // recycle variables
    delete workspace[nav];
    delete entryData_original[nav];

    // 5. Reset UI 
    if (nav === 'create') {
      resetCreate();
      showPage('home', 'nav-home');
    } else { // for other base pages
      history.back();
    }

  } catch (err) {
    console.error("Error saving transaction:", err);
    showStatusMessage("添加交易失败", 'error');
  }
}
window.saveEntry = saveEntry;

function diffEntries(original, updated) {
  // this function is used to find out the modifications made to an existing entry
  let changes = {};

  // Fields we want to ignore when comparing
  const ignore = new Set([
    "createdBy",
    "createdTimestamp",
    "lastModifiedBy",
    "lastModifiedTimestamp"
  ]);

  for (const key in updated) {
    if (ignore.has(key)) continue; // skip metadata fields

    if (updated[key] !== original[key]) {
      changes[key] = {
        before: original[key],
        after: updated[key]
      };
    }
  }

  changes.entryId = updated.entryId;
  changes.transactionTime = updated.transactionTime;
  changes.lastModifiedBy = updated.lastModifiedBy;
  changes.lastModifiedTimestamp = updated.lastModifiedTimestamp;

  return changes;

// Example output
// {
//   entryId: string,
//   transactionTime: datetime string,
//   lastModifiedBy: userId,
//   lastModifiedBy: timestamp,
//
//   amount: { before: 20, after: 30 },
//   notes: { before: "", after: "Lunch" }
// }

}

function convertUTC8ToLocal(dateStr) {
  // dateStr = "YYYY-MM-DD HH:mm:ss"
  const [datePart, timePart] = dateStr.split(" ");
  const [y, m, d] = datePart.split("-").map(Number);
  const [hh, mm, ss] = timePart.split(":").map(Number);

  // Create a Date object as if the input is UTC+8
  const utcDate = new Date(Date.UTC(y, m - 1, d, hh - 8, mm, ss));

  // Now convert to local time by formatting the Date object
  const localY = utcDate.getFullYear();
  const localM = String(utcDate.getMonth() + 1).padStart(2, "0");
  const localD = String(utcDate.getDate()).padStart(2, "0");
  const localH = String(utcDate.getHours()).padStart(2, "0");
  const localMin = String(utcDate.getMinutes()).padStart(2, "0");
  const localS = String(utcDate.getSeconds()).padStart(2, "0");

  return `${localY}-${localM}-${localD} ${localH}:${localMin}:${localS}`;
}

function triggerFilePicker(inputFieldId) {
  const householdId = document.getElementById("household-select").value;

  if (!householdId) {
    document.getElementById("household-select-feedback").textContent =
      currentLang === "en"
        ? "Please choose a household first."
        : "请先选择一个家庭账本。";
    return;
  } else {
    document.getElementById("household-select-feedback").textContent = "";
  }

  document.getElementById(inputFieldId).click();
}
window.triggerFilePicker = triggerFilePicker;

const dfd = window.dfd;

async function importFromSuiCSV(event) { // import CSV data from 随手记
  const file = event.target.files[0];
  if (!file) return;

  document.getElementById("sui-import-feedback").innerHTML = {
    en: "Reading selected file ... ",
    zh: "正在读取所选文件 ..."
  }[currentLang];

  // Read raw text from the file
  const text = await file.text();

  // Remove the first line (metadata)
  const cleanedText = text
    .split(/\r?\n/)
    .slice(1)
    .join("\n");

  // Convert cleaned text back into a Blob so Danfo treats it as a file
  const blob = new Blob([cleanedText], { type: "text/csv" });

  const df = await dfd.readCSV(blob);

  // Convert all null values to empty strings
  df.columns.forEach(col => {
    df[col] = df[col].apply(v => (v === null ? "" : v));
  });

  const householdId = document.getElementById("household-select").value;
  
  // entries is now a subcollection under households
  const entriesRef = collection(db, "households", householdId, "entries"); 

  // Build a map: columnName → index
  const colIndex = {};
  df.columns.forEach((name, idx) => colIndex[name] = idx);

  function val(row, colName) {
    return row[colIndex[colName]];
  }

  const missingRequired = [];          // rows with empty 类别 / 子类别 / 账户
  const otherEntries = [];             // array of entries with incompatible types
  const pendingTransfers = {};         // keyed by 关联Id
  const pendingBalance = [];           // array of balance entries

  let writePromises = [];

  let addDocCount = {
    "expense": 0,
    "income": 0,
    "transfer": 0,
    "balance": 0,
  };

  df.values.forEach((row, i) => {
    const type = val(row, "交易类型");
    const category = val(row, "类别");
    const subcategory = val(row, "子类别");
    const accountName = val(row, "账户");
    const currency = val(row, "账户币种");
    const linkId = val(row, "关联Id") || "";
    const amount = val(row, "金额");
    const date = val(row, "日期");
    const member = val(row, "成员");
    const project = val(row, "项目");
    const notes = val(row, "备注");

    const entryId =
      convertUTC8ToLocal(date).replace(/[- :]/g, "") +
      Math.floor(Math.random() * 1_000_000)
        .toString()
        .padStart(6, "0");

    // --- 1. 收入 / 支出: check required fields ---
    if (type === "收入" || type === "支出") {
      if (category === "" || subcategory === "" || accountName === "") {
        missingRequired.push({ index: i, row });
        return;
      }

      const transactionType = type === "收入" ? "income" : "expense";

      handleCategory(householdId, type, category, subcategory);
      const resolvedAccount = handleAccount(householdId, accountName, currency);

      const entryData = {
        entryId,
        type: transactionType,
        amount,
        householdId,
        primaryCategory: category,
        secondaryCategory: subcategory,
        account: resolvedAccount.name,
        currency,
        transactionTime: convertUTC8ToLocal(date),
        subject: member,
        collection: project,
        tags: [],
        notes,
        createdBy: currentUser.uid,
        createdTimestamp: getFormattedTime(),
        lastModifiedBy: currentUser.uid,
        lastModifiedTimestamp: getFormattedTime(),
      };

      const isThisYear = determineTransactionIsThisYear(entryData.transactionTime); 
      if (isThisYear) { 
        householdDocs[householdId].entriesThisYear ??= {}; 
        householdDocs[householdId].entriesThisYear[entryId] = entryData; 
      }
      
      // Collect the promise — do NOT await here 
      writePromises.push(addDoc(entriesRef, entryData));
      addDocCount[transactionType] += 1;
      return;
    }

    // --- 2. 转出: store temporarily ---
    if (type === "转出") {
      const resolvedAccount = handleAccount(householdId, accountName, currency);
      pendingTransfers[linkId] = {
        out: { row, resolvedAccount }
      };
      return;
    }

    // --- 3. 转入: pair with 转出 ---
    if (type === "转入") {
      if (!pendingTransfers[linkId]) {
        pendingTransfers[linkId] = {};
      }
      const resolvedAccount = handleAccount(householdId, accountName, currency);
      pendingTransfers[linkId].in = { row, resolvedAccount };
      return;
    }

    // --- 4. 余额变更 ---
    if (type === "余额变更") {
      const resolvedAccount = handleAccount(householdId, accountName, currency);
      pendingBalance[linkId] = { row, resolvedAccount };
      return;
    }

    // --- 5. Other types: store for later output ---
    otherEntries.push({ rawRow: row });
  });

  Object.entries(pendingTransfers).forEach(([linkId, pair]) => {
    if (!pair.out || !pair.in) return;

    const outRow = pair.out.row;
    const inRow = pair.in.row;

    const entryData = {
      entryId,
      type: "transfer",
      amount: val(outRow, "金额"),
      toAmount: val(inRow, "金额"),
      sameCurrency: val(outRow, "账户币种") === val(inRow, "账户币种"),
      householdId,
      fromAccount: val(outRow, "账户"),
      fromCurrency: val(outRow, "账户币种"),
      toAccount: val(inRow, "账户"),
      toCurrency: val(inRow, "账户币种"),
      transactionTime: convertUTC8ToLocal(val(inRow, "日期")),
      tags: [],
      notes: val(inRow, "备注"),

      createdBy: currentUser.uid,
      createdTimestamp: getFormattedTime(),
      lastModifiedBy: currentUser.uid,
      lastModifiedTimestamp: getFormattedTime(),
    };

    const isThisYear = determineTransactionIsThisYear(entryData.transactionTime); 
    if (isThisYear) { 
      householdDocs[householdId].entriesThisYear ??= {}; 
      householdDocs[householdId].entriesThisYear[entryId] = entryData; 
    }

    // Collect the promise — do NOT await here 
    writePromises.push(addDoc(entriesRef, entryData));
    addDocCount.transfer += 1;
  });

  Object.entries(pendingBalance).forEach((obj) => {
    const row = obj.row;

    const entryData = {
      entryId,
      type: "balance",
      amount: val(row, "金额"),
      householdId,
      account: val(row, "账户"),
      currency: val(row, "账户币种"),
      transactionTime: convertUTC8ToLocal(val(row, "日期")),
      tags: [],
      notes: val(row, "备注"),
      createdBy: currentUser.uid,
      createdTimestamp: getFormattedTime(),
      lastModifiedBy: currentUser.uid,
      lastModifiedTimestamp: getFormattedTime(),
    };

    const isThisYear = determineTransactionIsThisYear(entryData.transactionTime); 
    if (isThisYear) { 
      householdDocs[householdId].entriesThisYear ??= {}; 
      householdDocs[householdId].entriesThisYear[entryId] = entryData; 
    }
    // Collect the promise — do NOT await here 
    writePromises.push(addDoc(entriesRef, entryData));
    addDocCount.balance += 1;
  });

  async function runInBatches(promises, batchSize = 20) {
    for (let i = 0; i < promises.length; i += batchSize) {
      const batch = promises.slice(i, i + batchSize);
      await Promise.all(batch);
    }
  }

  // write data to firebase in batches to avoid write‑stream exhaustion (massive writing at once)
  await runInBatches(writePromises, 20); 

  
  let changes = {};
  changes.summary = {added: addDocCount};

  // Read the current log
  const log = householdDocs[householdId].entryChangeLog || [];

  // Append the new change
  log.push(changes);

  // If too long, trim the oldest entries
  const MAX_LOG = 1000;
  const trimmed = log.length > MAX_LOG
    ? log.slice(log.length - MAX_LOG)   // keep last 1000
    : log;

  const parts = splitIntoParts(householdDocs[householdId].entriesThisYear);

  const updatePayload = {
    "income-categories": householdDocs[householdId]["income-categories"],
    "expense-categories": householdDocs[householdId]["expense-categories"],
    accounts: householdDocs[householdId].accounts,
    entryChangeLog: trimmed,
    lastSynced: getFormattedTime()
  };

  // add parts for this year // these will go into entriesThisYear_part1, _part2, etc.
  parts.forEach((part, index) => {
    const key = `entriesThisYear_part${index + 1}`;
    updatePayload[key] = part;
  });

  // remove extra parts that are no longer needed
  for (let i = parts.length + 1; i <= 20; i++) {
    const key = `entriesThisYear_part${i}`;
    updatePayload[key] = deleteField();
  }

  const householdRef = doc(db, "households", householdId);

  await updateDoc(householdRef, updatePayload);

  console.log("saveEntry: total number of entriesThisYear parts:", parts.length)

  const div = document.getElementById("sui-import-feedback");

  if (missingRequired.length === 0) {
    div.textContent = {
      en: "No missing required fields detected.",
      zh: "未发现缺少必填字段的记录。"
    }[currentLang];
    return;
  }

  let html = `
    <div style="color:#b00020; font-weight:600; margin-bottom:8px;">
      ${{
        en: "Some entries were NOT imported because required fields are missing:",
        zh: "以下条目因缺少必填字段而未被导入："
      }[currentLang]}
    </div>
    <ul style="padding-left:18px; line-height:1.5;">`;

  missingRequired.forEach(item => {
    const row = item.row;

    html += `
      <li style="margin-bottom:6px;">
        <strong>#${item.index}</strong> — 
        ${{
          en: "Missing:",
          zh: "缺少："
        }[currentLang]}
        ${missingFieldsInRow(row).join(", ")}
        <br>
        <span style="font-size:12px; color:#555;">
          ${JSON.stringify(row)}
        </span>
      </li>
    `;
  });

  html += "</ul>";

  div.innerHTML = html;
}
window.importFromSuiCSV = importFromSuiCSV;

function handleCategory(householdId, type, primary, secondary) {
  const key = type === "收入" ? "income-categories" : "expense-categories";
  const list = householdDocs[householdId][key];

  let primaryObj = list.find(c => c.primary === primary);

  if (!primaryObj) {
    primaryObj = {
      primary,
      icon: "🏷️",
      secondaries: [{ name: secondary, icon: "🏷️" }]
    };
    list.push(primaryObj);
    return;
  }

  if (!primaryObj.secondaries.some(s => s.name === secondary)) {
    primaryObj.secondaries.push({ name: secondary, icon: "🏷️" });
  }
}

function handleAccount(householdId, name, currency) {
  const result = findSelectedAccount(householdId, null, name);

  // Not found → create new top-level account
  if (!result) {
    const newAcc = {
      name,
      icon: "💰",
      currency,
      exclude: false,
      notes: "",
      "sub-accounts": []
    };
    householdDocs[householdId].accounts.cashAccounts[name] = newAcc;
    return newAcc;
  }

  const acc = result.account;

  // If currency mismatch OR has sub-accounts → create imported version
  if ((acc["sub-accounts"] && acc["sub-accounts"].length > 0) ||
      acc.currency !== currency) {

    const importedName = name + ({ en: " imported", zh: " 导入" }[currentLang]);

    const newAcc = {
      name: importedName,
      icon: "💰",
      currency,
      exclude: false,
      notes: "",
      "sub-accounts": []
    };

    householdDocs[householdId].accounts[result.type][importedName] = newAcc;
    return newAcc;
  }

  return acc;
}

function populateHouseholdDropdown(userDoc, householdDocs) {
  const select = document.getElementById("household-select");

  // Clear everything except the placeholder
  select.innerHTML = `<option value="" disabled selected>${{
    en: "Choose a household to import data into",
    zh: "选择要导入数据的家庭账本"
  }[currentLang]}</option>`;

  userDoc.households.forEach(householdId => {
    const option = document.createElement("option");
    option.value = householdId;
    option.textContent = householdDocs[householdId].name;
    select.appendChild(option);
  });

  if (userDoc.households.length <= 1) {
    select.value = userDoc.households[0];
    document.getElementById("household-select-section").style.display = "none";
  } else {
    document.getElementById("household-select-section").style.display = "flex";
  }
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

function showPage(name, navBtn = currentBase, title = latestTitle, options={}) {
  const t = translations[currentLang];

  // hide all pages
  document.getElementById("login-section").style.display = "none";
  document.querySelectorAll('.base-page').forEach(p => {
    if (p.id !== currentBase + "-page") {
      p.style.display = "none";
      p.classList.remove("active");
    }
  });
  document.getElementById("return-btn").style.display = "none";
  document.getElementById("cancel-btn").style.display = "none";
  document.getElementById("save-btn-headerbar").style.display = "none";
  document.getElementById("search-btn-headerbar").style.display = "none";
  document.getElementById("manage-btn-headerbar").style.display = "none";
  document.getElementById("delete-btn-headerbar").style.display = "none";

  let stack = null;
  let target = null;
  let latest = null;

  // reset nav button colors
  basePages.forEach(page => {
    document.getElementById(`nav-${page}`).style.background = "";
    document.getElementById(`nav-${page}`).classList.remove("active");
  });

  vibrate(30); // milliseconds

  let switchedBase = false;

  if (latestNavBtn !==navBtn) { // when switching base nav, look for the latest stack
    switchedBase = true;

    if (latestPage != null) {
      stack = historyStacks[latestNavBtn.replace("nav-", "")];

      // if a page was shown, hide all pages at the old base page
      stack.forEach(entry => {
        const el = document.getElementById(entry[0] + "-page");
        if (el) el.style.display = "none";
      });
    }

    stack = historyStacks[navBtn.replace("nav-", "")];

    // if a page was shown, hide all pages at the old base page
    stack.forEach(entry => {
      const el = document.getElementById(entry[0] + "-page");
      if (el) el.style.display = "block";
    });
  }

  currentBase = navBtn.replace("nav-", "");

  stack = historyStacks[currentBase];
  latest = stack[stack.length - 1]; // there should always be at least one stack for each base page
  [latestPage, latestNavBtn, latestTitle, latestOptions] = latest; // retreive the latest page at that base page

  if (name !== latestPage && name !== currentBase) {
    // if the target page is not latest page, and is not base page, display this page
    latestPage = name;
    latestTitle = title;
    latestOptions = options;

    // push a new history entry for this new page
    history.pushState({ page: latestPage, base: currentBase }, "", location.href);
    historyStacks[currentBase].push([latestPage, navBtn, latestTitle, options]); // add to the history stacks
    stack = historyStacks[currentBase]; // update stack
  }

  target = document.getElementById(latestPage + "-page");
  target.style.display = "block";
  target.zIndex = stack.length;
  console.log(target)

  if (!target) return;

  const current = getComputedStyle(target).transform;
  console.log(current)
  // If it's not already at translateX(0), move it there
  if ((current === "none" || current.includes("matrix") && !current.includes("1, 0, 0, 1, 0, 0"))) {
    target.style.transform = "translateX(0%)";
    if (!(basePages.includes(latestPage) && latestPage === latestNavBtn)) {
      enablePageSwipe(target);
    }
  }
  
  if (name === "home" && navBtn === "nav-home" && stack.length < 3) {
    // at home page (base page and the first page)
    document.getElementById("search-btn-headerbar").style.display = "block";

    updateKanbanRow("presetToday", 0, getDateRange('today')); // to distinguish from any "Today" kanban that user defines
    updateKanbanRow({en: "This Month", zh: "本月"}[currentLang], 1, getDateRange('thisMonth'));
    updateKanbanRow({en: "This Year", zh: "本年"}[currentLang], 2, getDateRange('thisYear'));
  };

  if (stack.length > 1) { // if not at base
    document.getElementById("return-btn").style.display = "block";
  };
  document.getElementById("app-title").textContent = latestTitle;
  document.getElementById(navBtn).style.background = "var(--primary)";
  document.getElementById(navBtn).classList.add("active");

  // Get the nav element
  const nav = document.querySelector(".bottom-nav"); 

  const rect = nav.getBoundingClientRect();

  const navHeight = rect.height;
  const navBottom = getComputedStyle(nav).bottom;
  const targetScroll = document.querySelector(`#${latestPage}-page .scroll`);
  targetScroll.style.paddingBottom = `calc(${navHeight}px + ${navBottom} + 1rem)`;
  
  let dateTimeBtn = null;

  // transaction page special handling
  if (latestPage.includes("transaction")) {     
    let subWorkspace = null;

    if (latestNavBtn === "nav-transaction") { // when creating an entry
      document.getElementById("app-title").textContent = t.navTransaction;

      document.getElementById("cancel-btn").style.display = "block";

      const inProgress = !!workspace.create;
      if (!inProgress) { // reset button texts when creating a new entry
        workspace.create = {};
        
        workspace.create.inputTypeIndex = 0;
        workspace.create.inputType = transactionTypes[0]; // start with expense
        workspace.create.amount = 0;
        workspace.create.calculation = "";
        workspace.create.tags = [];
        workspace.create.notes = "";
        const activeForm = workspace.create.inputType + "-form";
        dateTimeBtn = document.querySelector(`#${activeForm} .selector-button[data-type='datetime']`);
        let householdBtn = document.querySelector(`#${activeForm} .selector-button[data-type='household']`);
        let categoryBtn = document.querySelector(`#${activeForm} .selector-button[data-type='category']`);
        let accountBtn = document.querySelector(`#${activeForm} .selector-button[data-type='account']`);
        let subjectBtn = document.querySelector(`#${activeForm} .selector-button[data-type='subject']`);
        let collectionBtn = document.querySelector(`#${activeForm} .selector-button[data-type='collection']`);
 
        setCurrentTime(dateTimeBtn, workspace.create);
        setDefaultHouseholds(householdBtn, workspace.create);
        setDefaultCategory(categoryBtn, workspace.create);
        setDefaultAccount(accountBtn, workspace.create);
        setDefaultSubject(subjectBtn, workspace.create);
        setDefaultCollection(collectionBtn, workspace.create);

        const amountEl = document.querySelector(`#${activeForm} .amount-button`);
        amountEl.textContent = workspace.create.amount.toFixed(2);
        const calculationEl = document.querySelector(`#${activeForm} .calculation`);
        calculationEl.textContent = workspace.create.calculation;
        const tagInputEl = document.querySelector(`#${activeForm} .tag-input`);
        tagInputEl.textContent = "";
        const tagSuggestionsEl = document.querySelector(`#${activeForm} .tag-suggestions`);
        tagSuggestionsEl.textContent = "";
        const taggedEl = document.querySelector(`#${activeForm} .tagged`);
        taggedEl.innerHTML = "";
        const notesEl = document.querySelector(`#${activeForm} textarea[id$='notes']`);
        notesEl.value = workspace.create.notes;
      }

      subWorkspace = workspace.create;

    } else { // when loading an existing entry
      document.getElementById("app-title").textContent = t.transaction;

      subWorkspace = workspace[latestNavBtn.replace("nav-", "")];

      const activeForm = subWorkspace.inputType + "-form";
      dateTimeBtn = document.querySelector(`#${activeForm} .selector-button[data-type='datetime']`);
      console.log("going to swtich tab")
      switchTab(subWorkspace.inputTypeIndex);
    }

    // prepare date time selector columns in advance
    ScrollToSelectItem(datetimeSelector.querySelector(".year-col"), subWorkspace.inputTransactionTimeRaw.yyyy);
    ScrollToSelectItem(datetimeSelector.querySelector(".month-col"), subWorkspace.inputTransactionTimeRaw.mm);
    updateDayColumn();
    ScrollToSelectItem(datetimeSelector.querySelector(".day-col"), subWorkspace.inputTransactionTimeRaw.dd);
    ScrollToSelectItem(datetimeSelector.querySelector(".hour-col"), subWorkspace.inputTransactionTimeRaw.hh);
    ScrollToSelectItem(datetimeSelector.querySelector(".minute-col"), subWorkspace.inputTransactionTimeRaw.min);
    
    document.getElementById("save-btn-headerbar").style.display = "block";
    document.querySelectorAll('.form-row label').forEach(label => {
      label.style.width = (currentLang === 'zh') ? '20%' : '25%';
    });

  } else if (latestPage === "manage-labels") {

    const orderBtn = document.getElementById("manage-btn-headerbar");
    orderBtn.style.display = "block";
    orderBtn.onclick = () => {
      prepareHouseholdTabs('order-labels', options.type, options.title);
    };

  } else if (latestPage === "order-labels") {
    const deleteBtn = document.getElementById("delete-btn-headerbar");
    deleteBtn.style.display = 'block';

  } else if (latestPage === "filtered-entries") {

    target.addEventListener("click", (e) => {
        const block = e.target.closest(".fe-entry-block");
        if (!block) return;

        const entryId = block.dataset.entryId;    
        const entryType = block.dataset.entryType;
        const entry = options.allEntriesMap[entryId];
        if (!entry) return;

        loadEntryIntoWorkspace(entry);
      });

  } else { // for all other pages

  }

  if (latestPage === "settings") {
    document.getElementById("settings-welcome").textContent = `${t.welcome}${userEmail}`;
  }
}
window.showPage = showPage;

function resetCreate() {
  delete workspace.create;
  closeSelector();
  showPage('transaction', 'nav-transaction');
}
window.resetCreate = resetCreate;

function goBack() {
  closeSelector();
  
  const stack = historyStacks[currentBase];
  if (stack.length > 1) {
    const target = document.getElementById(latestPage + "-page");
    target.style.transform = "translateX(110%)";
    stack.pop(); // remove current page

    const [prevPage, prevNavBtn, prevTitle, prevOptions] = stack[stack.length - 1]; // get the previous entry

    if (stack.length > 1) {
      stack.pop(); // remove the previous page as well because it will be added later if it is not a base nav page
    }

    showPage(prevPage, prevNavBtn, prevTitle, prevOptions);
  }
}

function loadEntryIntoWorkspace(e) {
  let nav = null;

  if (latestNavBtn === "nav-transaction") { // when creating an entry
    nav = 'create';
  } else {
    nav = latestNavBtn.replace("nav-", "");
  }

  workspace[nav] = {};
  const ws = workspace[nav];

  entryData_original[nav] = e;

  ws.amount = Number(e.amount) || 0;
  ws.notes = e.notes || "";
  ws.tags = e.tags || [];
  ws.inputTransactionTime = e.transactionTime;
  ws.householdId = e.householdId;

  if (e.type === "income" || e.type === "expense") {
    ws.inputType = e.type;
    ws.inputTypeIndex = transactionTypes.indexOf(e.type);
    ws[e.type] = {};

    ws[e.type].primaryCategory = e.primaryCategory;
    ws[e.type].secondaryCategory = e.secondaryCategory;

    ws[e.type].accountInfo = {
      account: {
        name: e.account,
        currency: e.currency
      }
    };

    ws[e.type].subject = e.subject || "";
    ws[e.type].collection = e.collection || "";
  }

  else if (e.type === "transfer") {
    ws.inputType = e.type;
    ws.inputTypeIndex = transactionTypes.indexOf(e.type);
    ws.transfer = {};

    ws.transfer.sameCurrency = e.sameCurrency;

    ws.transfer.fromAccountInfo = {
      account: {
        name: e.fromAccount,
        currency: e.fromCurrency
      }
    };

    ws.transfer.toAccountInfo = {
      account: {
        name: e.toAccount,
        currency: e.toCurrency
      }
    };

    ws.fromAmount = Number(e.amount) || 0;
    ws.toAmount = Number(e.toAmount) || 0;
  }

  else if (e.type === "balance") {
    ws.inputType = e.type;
    ws.inputTypeIndex = transactionTypes.indexOf(e.type);
    ws.balance = {};

    ws.balance.accountInfo = {
      account: {
        name: e.account,
        currency: e.currency
      }
    };
  }

  showPage("transaction", latestNavBtn, getEditTitle(e.type))
}

function getEditTitle(type) {
  const titleMap = {
    zh: {
      expense: "编辑支出",
      income: "编辑收入",
      transfer: "编辑转账",
      balance: "编辑余额"
    },
    en: {
      expense: "Edit Expense",
      income: "Edit Income",
      transfer: "Edit Transfer",
      balance: "Edit Balance"
    }
  };
  return titleMap[currentLang]?.[type] || "";
}

function prepareHouseholdTabs(task, type, title, activeHouseholdId = userDoc.orderedHouseholds[0]) {

  if (userDoc.orderedHouseholds.length > 1) {  
    const tabContainer = document.getElementById(task + "-household-tabs");
    tabContainer.innerHTML = ""; // clear old buttons

    for (const householdId of userDoc.orderedHouseholds) {
      const btn = document.createElement("button");
      btn.className = "tab-btn";
      btn.dataset.id = householdId;
      btn.textContent = householdDocs[householdId].name;

      // Mark the first button as active 
      if (householdId === activeHouseholdId) { 
        btn.classList.add("active"); 
      }

      // Add click listener
      btn.addEventListener("click", () => {
        // 1. Update active household
        activeHouseholdId = householdId;

        // 2. Update UI active state
        document.querySelectorAll("#"+task+"-household-tabs .tab-btn")
          .forEach(b => b.classList.remove("active"));
        btn.classList.add("active");

        loadLabels(activeHouseholdId, task, type, title);

        const page = document.getElementById(task + "-page"); 
        page.dataset.activeHouseholdId = activeHouseholdId;
      });

      tabContainer.appendChild(btn);
    }
  }

  const page = document.getElementById(task + "-page"); 
  page.dataset.activeHouseholdId = activeHouseholdId;

  if (task === "manage-labels" || task === "order-labels") {
    loadLabels(activeHouseholdId, task, type, title);
    showPage(task, 'nav-settings', title, { type, title });
  }

}
window.prepareHouseholdTabs = prepareHouseholdTabs;

async function loadLabels(activeHouseholdId, task, type, title) {
  const t = translations[currentLang];

  const deleteBtn = document.getElementById("delete-btn-headerbar");
  deleteBtn.style.color = "var(--muted)";
  deleteBtn.style.pointerEvents = "none";

  const container = document.getElementById(task + "-labels-container");
  container.innerHTML = "";

  const householdData = householdDocs[activeHouseholdId];

  const block = document.createElement("div");
  block.classList.add("household-block");

   // Household name header
  const header = document.createElement("h3");

  header.textContent = householdData.name;
  block.appendChild(header);
 
  let primaryCategories = householdDocs[activeHouseholdId][type];

  if (!primaryCategories || primaryCategories.length === 0) {
    const emptyMsg = document.createElement("button");
    emptyMsg.classList.add("primary-category");
    emptyMsg.textContent = t.noPrimaryCategories;
    emptyMsg.style.background = "none";
    block.appendChild(emptyMsg);
  } else {
    if (task === 'order-labels') {
      const notes = document.createElement("div"); 
      notes.style.color = "var(--muted)"; 
      notes.style.fontStyle = "italic"; 
      notes.innerHTML = t.reorderInstructions;
      block.appendChild(notes);

      const checkedCountText = document.createElement("div"); 
      checkedCountText.style.color = "var(--muted)"; 
      checkedCountText.style.fontStyle = "italic"; 
      block.appendChild(checkedCountText);
      block.checkedCountText = checkedCountText; // Store reference on the block
    } 

    if (["expense-categories", "income-categories"].includes(type)) {

      if (task != 'order-labels') {
        // Allow adding a primary // not for the order-labels-page
        const [addRow, addWrapper] = createAddCategoryRow(t.createPrimaryCategory, `<span class="icon-content">➕</span>`, block, block, activeHouseholdId, task, type, title, false, true);
        block.appendChild(addWrapper);
      }

      for (const category of householdDocs[activeHouseholdId][type]) {
        const [row, primaryWrapper] = createCategoryRow(category.primary, category.icon, block, block, activeHouseholdId, task, type, title, false, true);

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
            const [secRow, secondaryWrapper] = createCategoryRow(secondaryCategory.name, secondaryCategory.icon, primaryWrapper, block, activeHouseholdId, task, type, title, true, true, category.primary);
          }
        }

        if (task != 'order-labels') {
          // Allow adding a secondary // not for the order-labels-page
          const [secAddRow, secAddWrapper] = createAddCategoryRow(t.createSecondaryCategory, `<span class="icon-content">➕</span>`, primaryWrapper, block, activeHouseholdId, task, type, title, true, true, category.primary);
          primaryWrapper.appendChild(secAddWrapper);
        }
      }

      if (task != 'order-labels') {
        // Allow adding a primary // not for the order-labels-page
        const [addRow, addWrapper] = createAddCategoryRow(t.createPrimaryCategory, `<span class="icon-content">➕</span>`, block, block, activeHouseholdId, task, type, title, false, true);
        block.appendChild(addWrapper);
      }

    } else {
      if (task != 'order-labels') {
        // Allow adding a primary // not for the order-labels-page
        const [addRow, addWrapper] = createAddCategoryRow(t.createLabel, `<span class="icon-content">➕</span>`, block, block, activeHouseholdId, task, type, title, false, false);
        block.appendChild(addWrapper);
      }

      for (const label of householdDocs[activeHouseholdId][type]) {
        const [row, primaryWrapper] = createCategoryRow(label.name, label.icon, block, block, activeHouseholdId, task, type, title, false, false);
      };

      if (task != 'order-labels') {
        // Allow adding a primary // not for the order-labels-page
        const [addRow, addWrapper] = createAddCategoryRow(t.createLabel, `<span class="icon-content">➕</span>`, block, block, activeHouseholdId, task, type, title, false, false);
        block.appendChild(addWrapper);
      }
    }
  }
  
  container.appendChild(block);
}

function createAddCategoryRow(name, icon, parentWrapper, block, householdId, task, type, title, isSecondary, hasSecondary, parentName = null) {
  // wrapper for one row
  const categoryWrapper = document.createElement("div");
  categoryWrapper.classList.add(isSecondary ? "secondary-wrapper" : "category-wrapper");

  // inner row container
  const rowContent = document.createElement("div");
  rowContent.classList.add(isSecondary ? "secondary-category-row" : "primary-category-row");

  // main button
  const addBtn = document.createElement("button");
  addBtn.innerHTML = `${icon} ${name.trim()}`;
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
    const inputRow = createCategoryInputRow(householdId, task, type, title, hasSecondary, {
      label: "",
      icon: "",
      isSecondary,
      parentName
    });

    rowContent.after(inputRow);
  });

  return [rowContent, categoryWrapper];
}

function createCategoryInputRow(activeHouseholdId, task, type, title, hasSecondary, options = {}) {
  // options: { primaryDocId, isSecondary, parentId, label, icon, onSave }
  const t = translations[currentLang];

  const inputRow = document.createElement("div");
  inputRow.classList.add("labels-input-row");

  // icon button
  const iconBtn = document.createElement("button");
  iconBtn.innerHTML = options.icon || "Icon";
  iconBtn.classList.add("icon");

  iconBtn.addEventListener("click", (e) => {
    e.stopPropagation();

    // Always remove any existing wrapper before creating a new one
    const existingWrapper = document.querySelector(".icon-picker-wrapper");
    if (existingWrapper) existingWrapper.remove();

    const wrapper = document.createElement("div");
    wrapper.classList.add("icon-picker-wrapper");

    // --- TAB BUTTONS ---
    const tabRow = document.createElement("div"); 
    tabRow.style.display = "flex"; 
    tabRow.style.gap = "0.5rem"; 
    tabRow.style.marginBottom = "0.5rem";

    const emojiTab = document.createElement("button"); 
    emojiTab.textContent = "Emoji"; 
    emojiTab.classList.add("glass-popup-btn", "primary");

    const iconTab = document.createElement("button"); 
    iconTab.textContent = "Icon"; 
    iconTab.classList.add("glass-popup-btn"); 
    
    // --- CANCEL BUTTON --- 
    const cancelBtn = document.createElement("button"); 
    cancelBtn.textContent = t.cancel; 
    cancelBtn.addEventListener("click", () => hideWrapper(wrapper));

    tabRow.appendChild(emojiTab); 
    tabRow.appendChild(iconTab);
    tabRow.appendChild(cancelBtn);

    // --- CONTENT AREA --- 
    const contentArea = document.createElement("div");

    const emojiPicker  = document.createElement("emoji-picker");
    emojiPicker.addEventListener("emoji-click", event => {
      iconBtn.innerHTML = `<span class="icon-content">${event.detail.unicode}</span>`;
      iconBtn.classList.add("selected");
      hideWrapper(wrapper);
    });

    // --- ICON PICKER --- 
    const iconGrid = document.createElement("div"); 
    iconGrid.classList.add("icon-picker-grid");

    fetch("/icons/manifest.json") 
      .then(res => res.json()) 
      .then(files => { 
        files.forEach(file => {
          const item = document.createElement("div"); 
          item.classList.add("icon-picker-item"); 
          
          const img = document.createElement("img"); 
          img.src = `/icons/${file}`; 
          console.log(file)
          item.appendChild(img); 
          
          item.addEventListener("click", () => { 
            iconBtn.innerHTML = `<span class="icon-content"><img src="/icons/${file}" class="icon-img"></span>`;
            iconBtn.classList.add("selected");
            hideWrapper(wrapper); 
          }); 
          
          iconGrid.appendChild(item); 
        }); 
    });

    
    // --- INITIAL CONTENT ---
    contentArea.appendChild(emojiPicker);

    // --- TAB SWITCHING ---
    emojiTab.addEventListener("click", () => { 
      emojiTab.classList.add("primary"); 
      iconTab.classList.remove("primary"); 
      contentArea.innerHTML = ""; 
      contentArea.appendChild(emojiPicker); 
    });

    iconTab.addEventListener("click", () => { 
      iconTab.classList.add("primary"); 
      emojiTab.classList.remove("primary"); 
      contentArea.innerHTML = ""; 
      contentArea.appendChild(iconGrid); 
    });

    // --- BUILD WRAPPER ---
    wrapper.appendChild(tabRow); 
    wrapper.appendChild(contentArea); 
    
    inputRow.insertAdjacentElement("afterend", wrapper);
    requestAnimationFrame(() => wrapper.classList.add("show"));

    // --- OUTSIDE CLICK ---
    const outsideClickHandler = (ev) => {
      if (!wrapper.contains(ev.target) && ev.target !== iconBtn) {
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
    if (hasSecondary) {
      nameInput.placeholder = t.primaryCategoryName;
    } else {
      nameInput.placeholder = t.labelName;
    }
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
    loadLabels(activeHouseholdId, task, type, title);
  })

  tickBtn.addEventListener("click", async () => {
    const icon = iconBtn.innerHTML !== "Icon" ? iconBtn.innerHTML : `<span class="icon-content">🏷️</span>`;
    const name = nameInput.value.trim();
    if (!name) {
      showStatusMessage("The input name must not be empty.", "error")
      return;
    }
    
    const categories = householdDocs[activeHouseholdId][type];
    const householdRef = doc(db, "households", activeHouseholdId);
    
    const allCategories = householdDocs[activeHouseholdId][type];

    if (hasSecondary) {
      // check if this name is available
      const primaryNames = allCategories.map(c => c.primary); 
      const secondaryNames = allCategories.flatMap(c => c.secondaries.map(s => s.name));
      const allNames = [...primaryNames, ...secondaryNames];
      const valid = name === options.label || !allNames.includes(name)
      // valid if the new name is not same as any existing names, except the current name being edited

      if (!valid) {
        showStatusMessage(
          currentLang === "en"
            ? "The input name must not match any existing categories."
            : "输入的名称不能与现有项目重复。",
          "error"
        );
        return;
      }

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
    } else {
      // If editing, allow the same name; if adding, name must be unique
      const valid = name === options.label || !allCategories.some(item => item.name === name);

      if (!valid) {
        showStatusMessage(
          currentLang === "en"
            ? "The input name must not match any existing items."
            : "输入的名称不能与现有条目重复。",
          "error"
        );
        return;
      }
      let updatedList;

      if (options.label) {
        // Editing existing item
        updatedList = allCategories.map(item =>
          item.name === options.label
            ? { ...item, name, icon }  // update only this item
            : item
        );
      } else {
        // Adding a new item
        const newItem = { name, icon };
        updatedList = [...allCategories, newItem];
      }

      // Update flat structure
      await updateDoc(householdRef, {
        [type]: updatedList,
        lastSynced: getFormattedTime()
      });
    }
    
    ({ userDoc, householdDocs } = await syncData(currentUser.uid));

    loadLabels(activeHouseholdId, task, type, title);
    
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

function handleDeleteClick(block, hasSecondary) {
  const primaryChecked = block.querySelectorAll('.order-checkbox[data-type="primary"]:checked').length;
  const secondaryChecked = block.querySelectorAll('.order-checkbox[data-type="secondary"]:checked').length;

  let message = "";

  if (currentLang === "en") {
    if (hasSecondary) {
      if (primaryChecked > 0) {
        message += `You selected ${primaryChecked} primary categories. `;
        message += `Deleting them will permanently remove all associated secondary categories and transactions.<br><br>`;
      }

      if (secondaryChecked > 0) {
        message += `You selected ${secondaryChecked} secondary categories. `;
        message += `Deleting them will permanently remove all associated transactions.`;
      }
    } else {
      if (primaryChecked > 0) {
        message += `You selected ${primaryChecked} labels. `;
        message += `Deleting them will permanently remove all associated transactions.`;
      }
    }

  } else {
    if (hasSecondary) {
      if (primaryChecked > 0) {
        message += `您选择了 ${primaryChecked} 个一级分类。`;
        message += `删除它们将永久删除其下所有二级分类及其关联的交易。<br><br>`;
      }

      if (secondaryChecked > 0) {
        message += `您选择了 ${secondaryChecked} 个二级分类。`;
        message += `删除它们将永久删除所有关联的交易。`;
      }
    } else {
      if (primaryChecked > 0) {
        message += `您选择了 ${primaryChecked} 个标签。`;
        message += `删除它们将永久删除所有关联的交易。`;
      }
    }
  }

  showPopupWindow({
    title: currentLang === "en" ? "Confirm Deletion" : "确认删除",
    message,
    buttons: [
      {
        text: currentLang === "en" ? "Cancel" : "取消",
        primary: true,
        onClick: () => {}
      },
      {
        text: currentLang === "en" ? "Delete" : "删除",
        onClick: () => {
          console.log("Perform deletion here");
          // TODO: delete from Firestore + update UI
        }
      }
    ]
  });
}

function createCategoryRow(name, icon, parentWrapper, block, activeHouseholdId, task, type, title, isSecondary, hasSecondary, parentName = null) {
  // wrapper for one row
  const categoryWrapper = document.createElement("div");
  categoryWrapper.classList.add(isSecondary ? "secondary-wrapper" : "category-wrapper");

  // inner row container
  const rowContent = document.createElement("div");
  rowContent.classList.add(isSecondary ? "secondary-category-row" : "primary-category-row");

  // If ordering mode → insert checkbox BEFORE the button 
  if (task === 'order-labels') {
    const checkboxWrapper = document.createElement("div");
    checkboxWrapper.classList.add("order-checkbox-wrapper");

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.classList.add("order-checkbox");
    checkbox.dataset.type = isSecondary ? "secondary" : "primary";

    checkboxWrapper.appendChild(checkbox);
    rowContent.appendChild(checkboxWrapper);

    checkbox.addEventListener("change", () => { 
      const checked = block.querySelectorAll(".order-checkbox:checked");
      const checkedCount = checked.length;

      const primaryChecked = block.querySelectorAll('.order-checkbox[data-type="primary"]:checked').length;
      const secondaryChecked = block.querySelectorAll('.order-checkbox[data-type="secondary"]:checked').length;

      // Update UI text
      if (hasSecondary) {
        block.checkedCountText.textContent =
          currentLang==='en'
            ? `${checkedCount} selected (${primaryChecked} primary, ${secondaryChecked} secondary)`
            : `已勾选 ${checkedCount} 项（一级 ${primaryChecked} 项，二级 ${secondaryChecked} 项）`;
      } else {
        block.checkedCountText.textContent =
          currentLang==='en'
            ? `${checkedCount} selected `
            : `已勾选 ${checkedCount} 项`;
      }

      const deleteBtn = document.getElementById("delete-btn-headerbar");

      // Disable delete button
      if (checkedCount < 1) {
        deleteBtn.style.color = "var(--muted)";
        deleteBtn.style.pointerEvents = "none";

        // Always remove listener if it exists
        if (deleteBtn._deleteListener) {
          deleteBtn.removeEventListener("click", deleteBtn._deleteListener);
          deleteBtn._deleteListener = null;
        }
        return;
      }

      // Enable delete button
      deleteBtn.style.color = "var(--primary)";
      deleteBtn.style.pointerEvents = "auto";

      // Always remove old listener first
      if (deleteBtn._deleteListener) {
        deleteBtn.removeEventListener("click", deleteBtn._deleteListener);
      }

      // Create a fresh listener
      deleteBtn._deleteListener = () => handleDeleteClick(block, hasSecondary);

      // Add it again
      deleteBtn.addEventListener("click", deleteBtn._deleteListener);
    });
  }

  // main button
  const btn = document.createElement("button");
  btn.innerHTML = `${icon} ${name.trim()}`;
  btn.classList.add(isSecondary ? "secondary-category" : "primary-category");

  // Add identifiers 
  btn.dataset.name = name; 
  btn.dataset.type = isSecondary ? "secondary" : "primary";
  btn.dataset.parentName = parentName; 
  rowContent.appendChild(btn);
  
  // attach to wrapper
  categoryWrapper.appendChild(rowContent);
  parentWrapper.appendChild(categoryWrapper);
  
  if (task === 'order-labels') {
    const handle = document.createElement("div"); 
    handle.classList.add("drag-handle"); 
    handle.textContent = "≡"; 
    rowContent.appendChild(handle);
    
    let pressTimer; 
    let longPress = false; 
    let isDragging = false; 
    let dragInfo = null;
    let ghost = null;

    handle.addEventListener("pointerdown", e => {
      if (e.pointerType === "mouse" && e.button !== 0) return;

      e.stopPropagation();
      e.preventDefault();

      isDragging = true;
      longPress = false;
      clearTimeout(pressTimer);
      
      if (!isSecondary) {
        block.querySelectorAll(".secondary-wrapper").forEach(w => {
          w.style.display = "none";
        });
      }

      const btnRect = btn.getBoundingClientRect();

      dragInfo = {
        startY: e.clientY,
        startTop: btnRect.top,
        height: btnRect.height,
        draggedName: btn.dataset.name,
        draggedType: btn.dataset.type,
        draggedParent: btn.dataset.parentName
      };

      btn.classList.add("dragging");

      handle.setPointerCapture(e.pointerId);

      // Compute row position BEFORE cloning
      const rowRect = rowContent.getBoundingClientRect();

      // Create ghost
      ghost = rowContent.cloneNode(true);
      ghost.classList.add("drag-ghost");

      ghost.style.width = `${rowRect.width}px`;
      ghost.style.position = "fixed";
      ghost.style.left = `${rowRect.left}px`;
      ghost.style.top = `${e.clientY - dragInfo.height / 2}px`;
      ghost.style.pointerEvents = "none";
      ghost.style.opacity = "0.9";
      ghost.style.zIndex = "9999";

      document.body.appendChild(ghost);

      // Fade original row
      rowContent.style.opacity = "0.3";
    });

    handle.addEventListener("pointermove", e => {
      if (!isDragging || !dragInfo) return;

      const dy = e.clientY - dragInfo.startY;

      // Visual movement
      ghost.style.transform = `translateY(${dy}px)`;

      // Determine target row
      const rows = [...block.querySelectorAll(".primary-category, .secondary-category")];
      const currentCenter = dragInfo.startTop + dy + dragInfo.height / 2;

      let targetBtn = null;
      for (const r of rows) {
        const rect = r.getBoundingClientRect();
        if (currentCenter > rect.top && currentCenter < rect.bottom) {
          targetBtn = r;
          break;
        }
      }

      dragInfo.targetBtn = targetBtn;
    });

    handle.addEventListener("pointerup", async e => {
      // Stop dragging
      if (!isDragging) return;
      isDragging = false;

      // Release pointer capture if used
      try { handle.releasePointerCapture(e.pointerId); } catch {}

      // Reset visuals
      if (ghost) {
        ghost.remove();
        ghost = null;
      }

      rowContent.style.opacity = "";

      // No drag info → nothing to reorder
      if (!dragInfo || !dragInfo.targetBtn) {
        dragInfo = null;
        return;
      }

      // Extract drag info
      const {
        draggedName,
        draggedType,
        draggedParent,
        targetBtn
      } = dragInfo;

      const targetName   = targetBtn.dataset.name;
      const targetType   = targetBtn.dataset.type;
      const targetParent = targetBtn.dataset.parentName;

      // Compute before/after
      const rect = targetBtn.getBoundingClientRect();
      const position = e.clientY < rect.top + rect.height / 2 ? "before" : "after";
      
      // Enforce rules
      if (draggedType === "primary" && targetType === "secondary") return;
      if (draggedName === targetName) return;
      if (!targetName) return;

      // Perform reorder
      await reorderCategory({activeHouseholdId, hasSecondary, draggedName, draggedType, draggedParent, targetName, targetType, targetParent, position, type});

      dragInfo = null;

      // Refresh UI
      ({ userDoc, householdDocs } = await syncData(currentUser.uid));
      loadLabels(activeHouseholdId, task, type, title);
    });    

  } else { // not for the order-labels-page
    // edit + delete buttons
    const editBtn = document.createElement("button");
    editBtn.textContent = "✏️";
    editBtn.classList.add("label-edit-btn");

    const deleteBtn = document.createElement("button");
    deleteBtn.textContent = "🗑️";
    deleteBtn.classList.add("label-delete-btn");

    rowContent.appendChild(editBtn);
    rowContent.appendChild(deleteBtn);  

    // === EDIT HANDLER ===
    editBtn.addEventListener("click", () => {
      // remove any existing input row
      const existingRow = block.querySelector(".labels-input-row");
      if (existingRow) existingRow.remove();

      // create a new input row with current values
      const inputRow = createCategoryInputRow(activeHouseholdId, task, type, title, hasSecondary, {
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
      const categories = householdDocs[activeHouseholdId][type];
      const householdRef = doc(db, "households", activeHouseholdId)

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

      loadLabels(activeHouseholdId, task, type, title);
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
      if (draggedType === "primary" && targetType === "secondary") return;
      if (draggedName === targetName) return;
      if (!targetName) return;

      reorderCategory({activeHouseholdId, hasSecondary, draggedName, draggedType, draggedParent, targetName, targetType, targetParent, position, type})

      isDragging = false;
      btn.classList.remove("dragging");

      ({ userDoc, householdDocs } = await syncData(currentUser.uid));

      loadLabels(activeHouseholdId, task, type, title);

    });
  }

  return [rowContent, categoryWrapper];
}

async function reorderCategory({activeHouseholdId, hasSecondary, draggedName, draggedType, draggedParent, targetName, targetType, targetParent, position, type}) {
  const categories = householdDocs[activeHouseholdId][type];
  const householdRef = doc(db, "households", activeHouseholdId);

  if (hasSecondary) {
    // ============================================================
    // PRIMARY MOVE
    // ============================================================
    if (draggedType === "primary") {
      const oldIndex = categories.findIndex(p => p.primary === draggedName);
      if (oldIndex === -1) return false;

      const draggedObj = categories.splice(oldIndex, 1)[0];

      let newIndex = categories.findIndex(p => p.primary === targetName);
      if (newIndex === -1) return false;

      if (position === "after") newIndex++;

      categories.splice(newIndex, 0, draggedObj);

      await updateDoc(householdRef, { [type]: categories });
      return true;
    }

    // ============================================================
    // SECONDARY MOVE
    // ============================================================
    if (draggedType === "secondary") {
      const fromPrimary = categories.find(p => p.primary === draggedParent);
      
      if (!fromPrimary) return false;

      const fromArr = fromPrimary.secondaries;

      const oldIndex = fromArr.findIndex(s => s.name === draggedName);
      if (oldIndex === -1) return false;

      const draggedObj = fromArr.splice(oldIndex, 1)[0];

      // When dropped to a primary, insert at the beginning of the target primary's secondaries 
      if (targetType === "primary") { 
        const toPrimary   = categories.find(p => p.primary === targetName);
        const toArr   = toPrimary.secondaries;

        toArr.splice(0, 0, draggedObj); 
        await updateDoc(householdRef, { [type]: categories }); 
        return true; 

      } else {
        const toPrimary   = categories.find(p => p.primary === targetParent);
        const toArr   = toPrimary.secondaries;

        let newIndex = toArr.findIndex(s => s.name === targetName);
        if (newIndex === -1) return false;

        if (position === "after") newIndex++;

        toArr.splice(newIndex, 0, draggedObj);

        await updateDoc(householdRef, { [type]: categories });
        return true;
      }
    }
  } else {

    // ============================================================
    // NO SECONDARY STRUCTURE → FLAT LIST MOVE
    // ============================================================

    // Find old index
    const oldIndex = categories.findIndex(item => item.name === draggedName);
    if (oldIndex === -1) return false;

    const draggedObj = categories.splice(oldIndex, 1)[0];

    // Find new index
    let newIndex = categories.findIndex(item => item.name === targetName);
    if (newIndex === -1) return false;

    if (position === "after") newIndex++;

    // Insert at new position
    categories.splice(newIndex, 0, draggedObj);

    await updateDoc(householdRef, { [type]: categories });
    return true;
  }

  return false;
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

// block right click
nav.addEventListener("contextmenu", (e) => { e.preventDefault(); });

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
  if (pageEl._swipeEnabled) return;
  pageEl._swipeEnabled = true;

  let startX = 0, currentX = 0, isDragging = false;

  const onStart = e => {
    if (e.target.closest("input, textarea, [contenteditable]")) return;
    e.stopPropagation();
    startX = e.touches[0].clientX;
    isDragging = true;
    pageEl.style.transition = "none";
  };

  const onMove = e => {
    e.stopPropagation();
    if (!isDragging) return;
    currentX = e.touches[0].clientX - startX;
    if (currentX > 0) {
      pageEl.style.transform = `translateX(${currentX}px)`;
    }
  };

  const onEnd = () => {
    if (!isDragging) return;
    isDragging = false;
    const threshold = 100;
    pageEl.style.transition = "transform 0.3s ease";

    if (currentX > threshold) {
      pageEl.style.transform = "translateX(110%)";
      setTimeout(() => history.back(), 300);
    } else {
      pageEl.style.transform = "translateX(0)";
    }
    currentX = 0;
  };

  // Save handlers so we can remove them later
  pageEl._swipeHandlers = { onStart, onMove, onEnd };

  pageEl.addEventListener("touchstart", onStart);
  pageEl.addEventListener("touchmove", onMove);
  pageEl.addEventListener("touchend", onEnd);
}

function disablePageSwipe(pageEl) {
  if (!pageEl._swipeEnabled) return;

  const { onStart, onMove, onEnd } = pageEl._swipeHandlers || {};

  pageEl.removeEventListener("touchstart", onStart);
  pageEl.removeEventListener("touchmove", onMove);
  pageEl.removeEventListener("touchend", onEnd);

  pageEl._swipeEnabled = false;
  pageEl._swipeHandlers = null;
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
  document.getElementById("manage-btn-headerbar").textContent = t.manage;

  // Home text
  document.getElementById("home-month").textContent = t.monthBalance;
  document.getElementById("home-balance").textContent = t.incomeMinusExpense;
  document.getElementById("home-summary").textContent = t.monthlySummary;

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
  document.getElementById("basic-settings-title").textContent = t.personalSettingsTitle;
  document.getElementById("open-basic-settings").textContent = t.openPersonalSettings;
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
  document.getElementById("basic-settings-header").textContent = t.personalSettingsTitle;
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
  document.getElementById("manage-home-image-btn").textContent = t.manageHomeImage;
  document.getElementById("home-image-instruction").textContent = t.homeImageInstruction;
  document.querySelectorAll('.home-image-row button').forEach(btn => {
    btn.textContent = t.delete;
  });
  document.getElementById("add-home-image-btn").textContent = t.add;
  document.getElementById("save-home-image-btn").textContent = t.save;
  document.getElementById("defaults-title").textContent = t.defaults;
  document.getElementById("manage-defaults-btn").textContent = t.manageDefaults;
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

async function queryFirestoreForRange({
  dateFrom,
  dateTo,
  types,
  collections,
  accounts,
  tags,
  notesKeyword,
  householdIds
}) {
  const results = [];

  for (const hid of householdIds) {
    const entriesRef = collection(db, "households", hid, "entries");

    let q = entriesRef;

    // --- Date filters ---
    if (dateFrom) q = query(q, where("transactionTime", ">=", dateFrom + " 00:00:00"));
    if (dateTo)   q = query(q, where("transactionTime", "<=", dateTo   + " 23:59:59"));

    // --- Type filter (only if single) ---
    if (types?.length === 1) {
      q = query(q, where("type", "==", types[0]));
    }

    // --- Collection filter (only if single AND acceptable) ---
    if (collections?.length === 1) {
      q = query(q, where("collection", "==", collections[0]));
    }

    const snap = await getDocs(q);

    snap.forEach(doc => {
      results.push(doc.data());
    });
  }

  return results;
}


async function getFilteredEntries({
  dateFrom = null,
  dateTo = null,
  types = null,
  collections = null,
  accounts = null,
  tags = null,
  notesKeyword = null,
  households = null
} = {}) {

  const householdIds = households || userDoc.households;

  const from = dateFrom ? dateFrom + " 00:00:00" : null;
  const to   = dateTo   ? dateTo   + " 23:59:59" : null;

  const fromIsThisYear = from && determineTransactionIsThisYear(from);
  const toIsThisYear   = to   && determineTransactionIsThisYear(to);

  // ------------------------------------------------------------
  // CASE A: Entire range is inside this year → LOCAL ONLY
  // ------------------------------------------------------------
  if (fromIsThisYear && toIsThisYear) {
    const merged = getLocalThisYearEntries(householdIds);
    return applyFilters(merged);
  }

  // ------------------------------------------------------------
  // CASE B: Entire range is BEFORE this year → FIRESTORE ONLY
  // ------------------------------------------------------------
  if (!fromIsThisYear && !toIsThisYear) {
    return await queryFirestoreForRange({
      dateFrom,
      dateTo,
      types,
      collections,
      accounts,
      tags,
      notesKeyword,
      householdIds
    });
  }

  // ------------------------------------------------------------
  // CASE C: Mixed range → combine Firestore (past) + local (this year)
  // ------------------------------------------------------------
  const localMerged = getLocalThisYearEntries(householdIds);

  const past = await queryFirestoreForRange({
    dateFrom,
    dateTo: `${new Date().getFullYear() - 1}-12-31`,
    types,
    collections,
    accounts,
    tags,
    notesKeyword,
    householdIds
  });

  return applyFilters([...past, ...localMerged]);

  // ------------------------------------------------------------
  // Helpers
  // ------------------------------------------------------------
  function getLocalThisYearEntries(hids) {
    const merged = {};
    for (const hid of hids) {
      const entries = householdDocs[hid].entriesThisYear || {};
      Object.assign(merged, entries);
    }
    return Object.values(merged);
  }

  function applyFilters(list) {
    return list.filter(e => {
      if (from && e.transactionTime < from) return false;
      if (to && e.transactionTime > to) return false;

      if (types && !types.includes(e.type)) return false;

      if (collections && e.collection && !collections.includes(e.collection)) return false;

      if (accounts) {
        const acc = e.account || e.fromAccount || e.toAccount;
        if (!accounts.includes(acc)) return false;
      }

      if (tags && !tags.every(t => e.tags?.includes(t))) return false;

      if (notesKeyword) {
        const notes = e.notes || "";
        if (!notes.toLowerCase().includes(notesKeyword.toLowerCase())) return false;
      }

      return true;
    });
  }
}

function summarizeIncomeExpense(entries) {
  let income = 0;
  let expense = 0;

  for (const e of entries) {
    if (e.type === "income") {
      income += Number(e.amount) || 0;
    }
    if (e.type === "expense") {
      expense += Number(e.amount) || 0;
    }
  }

  return { income, expense };
}

function getDateRange(type) {
  // --- Localized formatter with optional year ---
  function formatDateLocalized(dateStr, showYear = true) {
    if (!dateStr) return "";

    const [y, m, d] = dateStr.split("-").map(Number);
    const date = new Date(y, m - 1, d); // local, no timezone shift

    const year  = date.getFullYear();
    const month = date.getMonth() + 1;
    const day   = date.getDate();

    if (currentLang === "zh") {
      return showYear
        ? `${year}年${String(month).padStart(2, "0")}月${String(day).padStart(2, "0")}日`
        : `${String(month).padStart(2, "0")}月${String(day).padStart(2, "0")}日`;
    }

    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
                    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

    return showYear
      ? `${months[date.getMonth()]} ${String(day).padStart(2, "0")}, ${year}`
      : `${months[date.getMonth()]} ${String(day).padStart(2, "0")}`;
  }

  // --- YYYY-MM-DD formatter for filtering ---
  function formatDate(d) {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  // --- Build localized date range text ---
  function buildDateRangeText(dateFrom, dateTo, showYear) {
    const f = (d, forceYear = false) => formatDateLocalized(d, forceYear || showYear);

    // No dates
    if (!dateFrom && !dateTo)
      return currentLang === "zh" ? "全部时间" : "All time";

    // Only dateTo
    if (!dateFrom && dateTo)
      return currentLang === "zh" ? `${f(dateTo)} 之前` : `Before ${f(dateTo)}`;

    // Only dateFrom
    if (dateFrom && !dateTo)
      return currentLang === "zh" ? `${f(dateFrom)} 之后` : `After ${f(dateFrom)}`;

    // Both dates exist
    const y1 = new Date(dateFrom).getFullYear();
    const y2 = new Date(dateTo).getFullYear();

    // If same year → show year only once
    if (y1 === y2 && !showYear) {
      if (currentLang === "zh") {
        // Chinese: show year only on the first date
        const f1 = formatDateLocalized(dateFrom, true);   // include year
        const f2 = formatDateLocalized(dateTo, false);    // hide year
        return `${f1} - ${f2}`;
      } else {
        // English: show year only on the second date
        const f1 = formatDateLocalized(dateFrom, false);  // hide year
        const f2 = formatDateLocalized(dateTo, true);     // include year
        return `${f1} - ${f2}`;
      }
    }

    // Different years → show both
    return `${f(dateFrom)} - ${f(dateTo)}`;
  }

  // --- Date calculations ---
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  // --- Week (Sunday start) ---
  const startOfWeek = new Date(today.getFullYear(), today.getMonth(), today.getDate() - today.getDay());
  const endOfWeek = new Date(startOfWeek.getFullYear(), startOfWeek.getMonth(), startOfWeek.getDate() + 6);

  // --- Month ---
  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);

  // --- Last Month ---
  const startOfLastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  const endOfLastMonth = new Date(today.getFullYear(), today.getMonth(), 0);

  // --- Quarter ---
  const quarter = Math.floor(today.getMonth() / 3);
  const startOfQuarter = new Date(today.getFullYear(), quarter * 3, 1);
  const endOfQuarter = new Date(today.getFullYear(), quarter * 3 + 3, 0);

  // --- Last Quarter ---
  const startOfLastQuarter = new Date(today.getFullYear(), (quarter - 1) * 3, 1);
  const endOfLastQuarter = new Date(today.getFullYear(), quarter * 3, 0);

  // --- Year ---
  const startOfYear = new Date(today.getFullYear(), 0, 1);
  const endOfYear = new Date(today.getFullYear(), 11, 31);

  // --- Last Year ---
  const startOfLastYear = new Date(today.getFullYear() - 1, 0, 1);
  const endOfLastYear = new Date(today.getFullYear() - 1, 11, 31);

  // --- Helper to finalize output ---
  function pack(from, to, showYear = false) {
    const dateFrom = from ? formatDate(from) : null;
    const dateTo = to ? formatDate(to) : null;
    return {
      dateFrom,
      dateTo,
      dateRangeStr: buildDateRangeText(dateFrom, dateTo, showYear)
    };
  }

  // --- Switch logic ---
  switch (type) {
    case "today":       return pack(today, today);
    case "yesterday":   const y = new Date(today); y.setDate(y.getDate() - 1); return pack(y, y);
    case "last7":       const d7 = new Date(today); d7.setDate(today.getDate() - 6); return pack(d7, today);
    case "last30":      const d30 = new Date(today); d30.setDate(today.getDate() - 29); return pack(d30, today);
    case "thisWeek":    return pack(startOfWeek, endOfWeek);
    case "lastWeek":    const lwS = new Date(startOfWeek); lwS.setDate(lwS.getDate() - 7);
                        const lwE = new Date(endOfWeek);   lwE.setDate(lwE.getDate() - 7);
                        return pack(lwS, lwE);
    case "thisMonth":   return pack(startOfMonth, endOfMonth);
    case "lastMonth":   return pack(startOfLastMonth, endOfLastMonth);
    case "thisQuarter": return pack(startOfQuarter, endOfQuarter);
    case "lastQuarter": return pack(startOfLastQuarter, endOfLastQuarter);

    // Long ranges → show year
    case "thisYear":    return pack(startOfYear, endOfYear, true);
    case "lastYear":    return pack(startOfLastYear, endOfLastYear, true);

    default:            return pack(null, null, true);
  }
}

function updateKanbanRow(title, kanbanIndex, filters) {
  const t = translations[currentLang];

  // apply filters to all entries
  let filteredEntries = getFilteredEntries(filters);

  const { income, expense } = summarizeIncomeExpense(filteredEntries);

  const dateRangeStr = filters.dateRangeStr;

  const displayTitle = (title === "presetToday")
    ? (currentLang === "zh" ? "今天" : "Today")
    : title;

  // create kanban div
  const list = document.getElementById("home-kanban-list");
  if (!list) return;

  // Try to find existing row 
  let row = list.querySelector(`.kanban-row[data-kanban-index="${kanbanIndex}"]`); 
  if (!row) { 
    // Create new row if not found 
    row = document.createElement("div"); 
    row.className = "kanban-row"; 
    row.dataset.kanbanIndex = kanbanIndex; 
    
    // Append row + hr 
    list.appendChild(row); 
    list.appendChild(document.createElement("hr"));
  }

  // Build inner HTML
  row.innerHTML = `
    <div class="kanban-left">
      <div class="kanban-title">${displayTitle}</div>
      <div class="kanban-sub">${dateRangeStr}</div>
    </div>
    <div class="kanban-right">
      <div class="kanban-income">${t.income} ${income.toFixed(2)}</div>
      <div class="kanban-expense">${t.expense} ${expense.toFixed(2)}</div>
    </div>
  `;

  row.onclick = () => {
    // Special case: presetToday loads all entries up to today 
    if (title === "presetToday") { 
      const dateTo = filters.dateTo; 
      filteredEntries = getFilteredEntries({ dateTo }); 
      const dateRangeStr = filters.dateRangeStr;
      showFilteredEntriesToday(filteredEntries, dateTo, dateRangeStr)

    } else {
      showFilteredEntries(filteredEntries, title, dateRangeStr);
    }
  };

}

function showFilteredEntries(entries, title, dateRangeStr) {
  const page = document.getElementById("filtered-entries-page");
  const scroll = page.querySelector(".scroll");

  scroll.innerHTML = ``;

  if (entries.length === 0) {
    scroll.innerHTML += `
      <div class="fe-empty">
        ${currentLang === "zh" ? "没有记录" : "No entries"}
      </div>
    `;
    return;
  }

  // --- SORT newest first ---
  entries.sort((a, b) => (a.transactionTime < b.transactionTime ? 1 : -1));

  // --- GROUP BY DATE ---
  const groups = {};
  for (const e of entries) {
    const day = e.transactionTime.split(" ")[0]; // YYYY-MM-DD
    if (!groups[day]) groups[day] = [];
    groups[day].push(e);
  }

  const groupKeys = Object.keys(groups).sort((a, b) => (a < b ? 1 : -1));

  // --- RENDER ALL GROUPS (no batching) ---
  for (const day of groupKeys) {
    const dayEntries = groups[day];
    scroll.innerHTML += renderEntryGroup(day, dayEntries);

    requestAnimationFrame(() => {
      const textareas = scroll.querySelectorAll(".fe-notes-textarea");
      textareas.forEach(autoResizeTextarea);
    });
  }
  const allEntriesMap = {};
  entries.forEach(e => allEntriesMap[e.entryId] = e);
  
  showPage("filtered-entries", latestNavBtn, title, {allEntriesMap});
}

function showFilteredEntriesToday(entries, date, dateRangeStr) {
  const page = document.getElementById("filtered-entries-page");
  const scroll = page.querySelector(".scroll");

  const displayTitle = (currentLang === "zh" ? "今天 " : "Today ") + date;

  scroll.innerHTML = ``;

  if (entries.length === 0) {
    scroll.innerHTML += `
      <div class="fe-empty">
        ${currentLang === "zh" ? "没有记录" : "No entries"}
      </div>
    `;
    return;
  }

  // Sort newest first
  entries.sort((a, b) => (a.transactionTime < b.transactionTime ? 1 : -1));

  // --- GROUP BY DATE ---
  const groups = {};
  for (const e of entries) {
    const day = e.transactionTime.split(" ")[0]; // YYYY-MM-DD
    if (!groups[day]) groups[day] = [];
    groups[day].push(e);
  }

  const groupKeys = Object.keys(groups).sort((a, b) => (a < b ? 1 : -1));

  const BATCH_SIZE = 1; // 1 date group per batch
  let index = 0;

  function renderBatch() {
    const end = Math.min(index + BATCH_SIZE, groupKeys.length);
    for (let i = index; i < end; i++) {
      const day = groupKeys[i];
      const dayEntries = groups[day];
      scroll.innerHTML += renderEntryGroup(day, dayEntries);
    }
    index = end;

    requestAnimationFrame(() => {
      const textareas = scroll.querySelectorAll(".fe-notes-textarea");
      textareas.forEach(autoResizeTextarea);
    });
  }

  renderBatch();

  scroll.onscroll = () => {
    const nearBottom =
      scroll.scrollTop + scroll.clientHeight >= scroll.scrollHeight - 200;

    if (nearBottom && index < groupKeys.length) {
      renderBatch();
    }
  };

  const allEntriesMap = {};
  entries.forEach(e => allEntriesMap[e.id] = e);

  showPage("filtered-entries", latestNavBtn, displayTitle, {allEntriesMap});
}

function renderEntryGroup(day, entries) {
  const isToday = day === getTodayYYYYMMDD();
  const d = new Date(day + "T00:00:00");

  const weekday = d.toLocaleDateString(currentLang === "zh" ? "zh-CN" : "en-US", {
    weekday: "long"
  });

  const monthYear = d.toLocaleDateString(currentLang === "zh" ? "zh-CN" : "en-US", {
    month: "long",
    year: "numeric"
  });

  const dayNumber = d.getDate();

  const dateHeader = isToday
    ? `
      <div class="fe-date-header">
        <div class="fe-date-big">${currentLang === "zh" ? "今天" : "Today"}</div>
        <div class="fe-date-sub">${weekday}</div>
      </div>
    `
    : `
      <div class="fe-date-header">
        <div class="fe-date-big">${dayNumber}</div>
        <div class="fe-date-sub">${monthYear} · ${weekday}</div>
      </div>
    `;

  let html = `<div class="fe-date-group">${dateHeader}`;

  entries.forEach((e, i) => { 
    html += renderEntryByType(e); 
    
    // Add <hr> between entries, but not after the last one 
    if (i < entries.length - 1) { 
      html += `<hr class="fe-entry-divider">`; 
    } 
  });

  html += `</div>`;
  return html;
}

function renderEntryByType(e) {
  const householdId = e.householdId;
  const multipleHouseholds = userDoc.households.length > 1;
  const householdName = multipleHouseholds
    ? `<div class="fe-entry-household">${householdDocs[householdId].name}</div>`
    : "";

  const time = e.transactionTime.split(" ")[1];
  const account = e.account || e.fromAccount || e.toAccount || "";
  const subject = e.subject || "";
  const collection = e.collection || "";
  const notes = e.notes || "";

  // --- Income / Expense ---
  if (e.type === "income" || e.type === "expense") {
    const { primaryIcon, secondaryIcon } = getCategoryIcon(householdId, e.type, e.primaryCategory, e.secondaryCategory);

    return `
      <div class="fe-entry-block" data-entry-id="${e.entryId}" data-entry-type="${e.type}">
        <div class="fe-entry-icon">${secondaryIcon}</div>

        <div class="fe-entry-main">
          <div class="fe-entry-title">${e.secondaryCategory}</div>
          ${renderNotes(e.notes)}
          <div class="fe-entry-meta">${time} · ${account} · ${subject} · ${collection}</div>
          ${householdName}
        </div>

        <div class="fe-entry-amount-right ${e.type}">${Number(e.amount).toFixed(2)}</div>
      </div>
    `;
  }

  // --- Transfer ---
  if (e.type === "transfer") {
    return `
      <div class="fe-entry-block" data-entry-id="${e.entryId}" data-entry-type="${e.type}">
        <div class="fe-entry-icon"><span class="icon-content">🔁</span></div>

        <div class="fe-entry-main">
          <div class="fe-entry-title">${e.fromAccount} → ${e.toAccount}</div>
          ${renderNotes(e.notes)}
          <div class="fe-entry-meta">${time}</div>
          ${householdName}
        </div>

        <div class="fe-entry-amount-right">
          ${Number(e.amount).toFixed(2)}
        </div>
      </div>
    `;
  }

  // --- Balance ---
  if (e.type === "balance") {
    return `
      <div class="fe-entry-block" data-entry-id="${e.entryId}" data-entry-type="${e.type}">
        <div class="fe-entry-icon"><span class="icon-content">📊</span></div>

        <div class="fe-entry-main">
          <div class="fe-entry-title">${currentLang === "zh" ? "余额变更" : "Balance Set"}</div>
          ${renderNotes(e.notes)}
          <div class="fe-entry-meta">${time}</div>
          ${householdName}
        </div>

        <div class="fe-entry-amount-right">
          ${Number(e.amount).toFixed(2)}
        </div>
      </div>
    `;
  }

  return "";
}

function renderNotes(notes) {
  if (!notes || notes.trim() === "") return "";
  return `
    <div class="fe-entry-notes">
      <textarea class="fe-notes-textarea" readonly>${notes}</textarea>
    </div>
  `;
}

function autoResizeTextarea(el) {
  el.style.height = "auto";          // reset
  el.style.height = el.scrollHeight + "px"; // fit content
}

function getCategoryIcon(householdId, type, primary, secondary) {
  const dict = householdDocs[householdId]?.[`${type}-categories`];
  if (!Array.isArray(dict)) {
    return { primaryIcon: "", secondaryIcon: "" };
  }

  // Find the primary category object in the array
  const primaryObj = dict.find(c => c.primary === primary);
  if (!primaryObj) {
    return { primaryIcon: "", secondaryIcon: "" };
  }

  const primaryIcon = primaryObj.icon || "";

  let secondaryIcon = "";
  if (secondary && Array.isArray(primaryObj.secondaries)) {
    const secondaryObj = primaryObj.secondaries.find(s => s.name === secondary);
    secondaryIcon = secondaryObj?.icon || "";
  }

  return { primaryIcon, secondaryIcon };
}


function getTodayYYYYMMDD() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
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
      orderedHouseholds: arrayUnion(myHouseholdId),
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
    orderedHouseholds: arrayRemove(myHouseholdId),
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
    orderedHouseholds: arrayRemove(hid),
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
          orderedHouseholds: arrayRemove(myHouseholdId),
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

function showPopupWindow({ title, message, buttons = [] }) {
  // Overlay
  const overlay = document.createElement("div");
  overlay.classList.add("glass-popup-overlay");

  // Close when clicking outside the popup
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) {
      overlay.remove();
      popup.classList.remove("show"); 
    }
  });

  // Popup window
  const popup = document.createElement("div");
  popup.classList.add("glass-popup-window");

  const titleEl = document.createElement("h3");
  titleEl.textContent = title;

  const msgEl = document.createElement("p");
  msgEl.innerHTML = message;

  const btnRow = document.createElement("div");
  btnRow.classList.add("glass-popup-buttons");

  // Dynamically create buttons
  buttons.forEach(btn => {
    const b = document.createElement("button");
    b.textContent = btn.text;
    b.classList.add("glass-popup-btn");

    if (btn.primary) b.classList.add("primary");

    b.addEventListener("click", () => {
      overlay.remove();
      popup.classList.remove("show"); 
      btn.onClick && btn.onClick();
    });

    btnRow.appendChild(b);
  });

  popup.appendChild(titleEl);
  popup.appendChild(msgEl);
  popup.appendChild(btnRow);

  overlay.appendChild(popup);
  document.body.appendChild(overlay);

  requestAnimationFrame(() => { 
    popup.classList.add("show"); 
  });
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

const amountSelector = document.getElementById("amount-selector");
const datetimeSelector = document.getElementById("datetime-selector");
const householdSelector = document.getElementById("household-selector");
const categorySelector = document.getElementById("category-selector");
const accountSelector = document.getElementById("account-selector");
const subjectSelector = document.getElementById("subject-selector");
const collectionSelector = document.getElementById("collection-selector");

const selectorList = [
  amountSelector,
  datetimeSelector,
  householdSelector,
  categorySelector,
  accountSelector,
  subjectSelector,
  collectionSelector
];

let lastButton = null;
let prevLastButton = null;

function isUrl(string) {
  if (!string) return false;

  return (
    string.startsWith("http://") ||
    string.startsWith("https://") ||
    string.startsWith("//") ||
    /\.(png|jpg|jpeg|gif|svg|webp)$/i.test(string)
  );
}

function createList(col, values) {
  col.innerHTML = ""; // clear existing items

  values.forEach(v => {
    const div = document.createElement("div");
    div.className = "dt-item";

    // -----------------------------
    // CASE 1: Primitive value
    // -----------------------------
    if (typeof v === "string" || typeof v === "number") {
      div.textContent = v;
      col.appendChild(div);
      return;
    }

    // -----------------------------
    // CASE 2: Object (icon + name/value + optional note)
    // -----------------------------
    if (v && typeof v === "object") {
      const hasNote = "note" in v;

      const valueDiv = document.createElement("div");
      valueDiv.className = "selector-item";

      if ("icon" in v) {
        const iconSpan = document.createElement("span");
        iconSpan.className = "selector-item-icon";
        iconSpan.innerHTML = v.icon;
        valueDiv.appendChild(iconSpan);
      }

      const textBlock = document.createElement("div");
      textBlock.className = "text-block";

      const labelSpan = document.createElement("span");
      labelSpan.className = "selector-item-label";
      labelSpan.textContent = v.name || v.value || "";
      textBlock.appendChild(labelSpan);

      if (hasNote) {
        const notesSpan = document.createElement("span");
        notesSpan.className = "selector-item-notes";
        notesSpan.textContent = v.note;
        textBlock.appendChild(notesSpan);
      }

      valueDiv.appendChild(textBlock);
      div.appendChild(valueDiv);

      col.appendChild(div);
    }
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
    target = items.find(i => {

      const labelEl = i.querySelector(".selector-item-label"); // look for this class

      const text = labelEl ? labelEl.textContent.trim() : i.textContent.trim(); // if not found, take i.textContent
      return parseInt(text, 10) === value; // compare it to the target value
    });
    if (!target) target = items[items.length - 1];

  } else {
    target = items.find(i => {

      const labelEl = i.querySelector(".selector-item-label"); // look for this class

      const text = labelEl ? labelEl.textContent.trim() : i.textContent.trim(); // if not found, take i.textContent

      return text === String(value).trim(); // compare it to the target value
    });
    if (!target) target = items[0];
  }

  if (target) selectItem(target);

  // Initialize state on the element
  col._touchMoved = false;
  col._wheelDelta = 0;
  col._touchStartY = 0;
  col._touchStartTime = 0;
  col._lastStep = 0;

  // Remove old listeners if they exist
  if (col._handlers) {
    col.removeEventListener("click", col._handlers.click);
    col.removeEventListener("wheel", col._handlers.wheel);
    col.removeEventListener("touchstart", col._handlers.touchstart);
    col.removeEventListener("touchmove", col._handlers.touchmove);
    col.removeEventListener("touchend", col._handlers.touchend);
  }

  col._handlers = {
    click: (e) => {
      if (!col._touchMoved) {
        const item = e.target.closest(".dt-item");
        if (item && col.contains(item)) {
          selectItem(item);
          updateSelectorPreview(col);
        }
      }
    },

    wheel: (e) => {
      e.preventDefault();
      col._wheelDelta += e.deltaY;

      const itemHeight = col.querySelector(".dt-item")?.offsetHeight || 40;
      if (col._wheelDelta >= itemHeight) {
        selectItem(col.querySelector(".dt-item.selected")?.nextElementSibling);
        col._wheelDelta = 0;
      } else if (col._wheelDelta <= -itemHeight) {
        selectItem(col.querySelector(".dt-item.selected")?.previousElementSibling);
        col._wheelDelta = 0;
      }
      updateSelectorPreview(col);
    },

    touchstart: (e) => {
      col._touchMoved = false;
      col._touchStartY = e.touches[0].clientY;
      col._touchStartTime = getFormattedTime();
      col._lastStep = 0;
    },

    touchmove: (e) => {
      e.preventDefault();
      col._touchMoved = true;

      const currentY = e.touches[0].clientY;
      const dy = currentY - col._touchStartY;
      const dt = getFormattedTime() - col._touchStartTime;

      const itemHeight = col.querySelector(".dt-item")?.offsetHeight || 40;
      const distanceSteps = dy / itemHeight;
      const velocity = dy / dt;

      const FAST = 0.5;
      const DIST = itemHeight * 2;

      let velocitySteps = 0;
      if (Math.abs(velocity) > FAST && Math.abs(dy) > DIST) {
        velocitySteps = velocity * 3;
      }

      const steps = Math.round(distanceSteps + velocitySteps);

      if (steps !== col._lastStep) {
        const items = [...col.querySelectorAll(".dt-item")];
        const selected = col.querySelector(".dt-item.selected");
        if (!selected) return;

        let index = items.indexOf(selected);
        let newIndex = index - (steps - col._lastStep);
        newIndex = Math.max(0, Math.min(items.length - 1, newIndex));

        selectItem(items[newIndex]);
        col._lastStep = steps;
        updateSelectorPreview(col);
      }
    },

    touchend: () => {
      col._touchStartY = 0;
      col._touchStartTime = 0;
      col._lastStep = 0;
    }
  };

  col.addEventListener("click", col._handlers.click);
  col.addEventListener("wheel", col._handlers.wheel, { passive: false });
  col.addEventListener("touchstart", col._handlers.touchstart, { passive: false });
  col.addEventListener("touchmove", col._handlers.touchmove, { passive: false });
  col.addEventListener("touchend", col._handlers.touchend, { passive: false });
}


function updateSelectorPreview(updatedCol) {
  if (!lastButton) return;

  let subWorkspace = null;

  if (latestNavBtn === "nav-transaction") { // when creating an entry
    subWorkspace = workspace.create;
  } else {
    subWorkspace = workspace[latestNavBtn.replace("nav-", "")];
  }

  const inputType = subWorkspace.inputType;

  const activeForm = inputType + "-form";

  if (lastButton.dataset.type === "datetime") {

    // update day column when year and month are changed
    if (
      updatedCol.classList.contains("year-col") ||
      updatedCol.classList.contains("month-col")
    ) {
      subWorkspace.inputTransactionTimeRaw.dd = getSelectedValue(datetimeSelector, ".day-col");
      updateDayColumn();
      ScrollToSelectItem(datetimeSelector.querySelector(".day-col"), subWorkspace.inputTransactionTimeRaw.dd);
    }

    const yEl = datetimeSelector.querySelector(".year-col .selected");
    const mEl = datetimeSelector.querySelector(".month-col .selected");
    const dEl = datetimeSelector.querySelector(".day-col .selected");
    const hEl = datetimeSelector.querySelector(".hour-col .selected");
    const minEl = datetimeSelector.querySelector(".minute-col .selected");

    if (!yEl || !mEl || !dEl || !hEl || !minEl) return;

    let yyyy = Number(yEl.textContent);
    let mm = Number(mEl.textContent);
    let dd = Number(dEl.textContent);
    let hh = Number(hEl.textContent);
    let min = Number(minEl.textContent);

    const dateObj = new Date(yyyy, mm - 1, dd, hh, min); // must use numbers
    const prefix = getDatePrefix(dateObj);

    subWorkspace.inputTransactionTimeRaw.yyyy = yyyy;
    subWorkspace.inputTransactionTimeRaw.mm = mm;
    subWorkspace.inputTransactionTimeRaw.dd = dd;
    subWorkspace.inputTransactionTimeRaw.hh = hh;
    subWorkspace.inputTransactionTimeRaw.min = min;

    yyyy = yyyy;
    mm = String(mm).padStart(2, "0");
    dd = String(dd).padStart(2, "0");
    hh = String(hh).padStart(2, "0");
    min = String(min).padStart(2, "0");

    subWorkspace.inputTransactionTime = `${yyyy}-${mm}-${dd} ${hh}:${min}:${String(subWorkspace.inputTransactionTimeRaw.ss).padStart(2, "0")}`;

    lastButton.textContent = `${prefix}${yyyy}-${mm}-${dd} ${hh}:${min}`;
    lastButton.dataset.value = dateObj.toISOString();

  } else if (lastButton.dataset.type === "household") {
    const hhEl = householdSelector.querySelector(".household-col .selected");

    if (!hhEl) return;

    const [inputHouseholdId, household] = Object.entries(householdDocs).find(
      ([id, h]) => h.name.toLowerCase() === hhEl.textContent.toLowerCase()
    ) || [];

    subWorkspace[subWorkspace.inputType].householdId = inputHouseholdId;

    lastButton.textContent = household.name;
    lastButton.dataset.value = inputHouseholdId;

    // update other buttons when household change
    let categoryBtn = document.querySelector(`#${activeForm} .selector-button[data-type='category']`);
    if (categoryBtn) {setDefaultCategory(categoryBtn, subWorkspace)};

  } else if (lastButton.dataset.type === "category") {
    const primaryCol = categorySelector.querySelector(".primary-col");
    const secondaryCol = categorySelector.querySelector(".secondary-col");

    // update secondary column if primary is changed
    if (updatedCol.classList.contains("primary-col")) {
      updateSecondaryColumn(lastButton, subWorkspace, secondaryCol);
      ScrollToSelectItem(secondaryCol);
    }
    
    const { icon: sIcon, name: sName } =
      getSelectedValue(categorySelector, ".secondary-col", true);

    subWorkspace[inputType].secondaryCategory = sName;
    subWorkspace[inputType].secondaryCategoryIcon = sIcon;

    subWorkspace[inputType].catInnerHTML = `
      <span class="cat-part">
        <span class="icon selected">${subWorkspace[inputType].primaryCategoryIcon}</span>
        <span class="cat-label">${subWorkspace[inputType].primaryCategory}</span>
      </span>
      <span class="cat-separator">&gt;</span>
      <span class="cat-part">
        <span class="icon selected">${subWorkspace[inputType].secondaryCategoryIcon}</span>
        <span class="cat-label">${subWorkspace[inputType].secondaryCategory}</span>
      </span>
    `;

    lastButton.innerHTML = subWorkspace[inputType].catInnerHTML;
  } else if (['account', 'fromAccount', 'toAccount'].includes(lastButton.dataset.type)) {
    const inputHouseholdId = subWorkspace[subWorkspace.inputType].householdId;
    
    const accountTypeCol = accountSelector.querySelector(".primary-col");
    const accountCol = accountSelector.querySelector(".secondary-col");

    if (["expense", "income", "balance"].includes(inputType)) {
      // update secondary column if primary is changed
      if (updatedCol.classList.contains("primary-col")) {
        updateSecondaryColumn(lastButton, subWorkspace, accountCol);
        ScrollToSelectItem(accountCol);
      }
      
      const { icon: sIcon, name: sName } =
        getSelectedValue(accountSelector, ".secondary-col", true);

      const accountName = sName.replace(/\s*\([^)]*\)$/, "");

      subWorkspace[inputType].accountInfo = findSelectedAccount(inputHouseholdId, subWorkspace[inputType].accountInfo.type, accountName);
      
      // Extract account info
      const info = subWorkspace[inputType].accountInfo;
      const accountObj = info.account;
      const accountIcon = accountObj.icon || "";
      const accountCurrency = accountObj.currency;

      subWorkspace[inputType].accountInnerHTML = `
        <span class="cat-part">
          <span class="icon selected">${accountIcon}</span>
          <span class="cat-label">${accountName} (${accountCurrency})</span>
        </span>
      `;

      lastButton.innerHTML = subWorkspace[inputType].accountInnerHTML;
    } else { // for transfer
      const { icon: pIcon, name: pName } =
        getSelectedValue(accountSelector, ".primary-col", true);
      const { icon: sIcon, name: sName } =
        getSelectedValue(accountSelector, ".secondary-col", true);
      
      const fromAccountName = pName.replace(/\s*\([^)]*\)$/, "");
      const toAccountName = sName.replace(/\s*\([^)]*\)$/, "");

      subWorkspace.transfer.fromAccountInfo = findSelectedAccount(inputHouseholdId, null, fromAccountName);
      subWorkspace.transfer.toAccountInfo = findSelectedAccount(inputHouseholdId, null, toAccountName);
      
      const from = subWorkspace.transfer.fromAccountInfo.account;
      const fromIcon = from.icon || "";
      const fromName = from.name;
      const fromCurrency = from.currency;

      subWorkspace.transfer.fromAccountInnerHTML = `
        <span class="cat-part">
          <span class="icon selected">${fromIcon}</span>
          <span class="cat-label">${fromName} (${fromCurrency})</span>
        </span>
      `;
      
      const to = subWorkspace.transfer.toAccountInfo.account;
      const toIcon = to.icon || "";
      const toName = to.name;
      const toCurrency = to.currency;

      subWorkspace.transfer.toAccountInnerHTML = `
        <span class="cat-part">
          <span class="icon selected">${toIcon}</span>
          <span class="cat-label">${toName} (${toCurrency})</span>
        </span>
      `;

      let fromAccountBtn = document.querySelector(`#${activeForm} .selector-button[data-type='fromAccount']`);
      let toAccountBtn = document.querySelector(`#${activeForm} .selector-button[data-type='toAccount']`);
      
      fromAccountBtn.innerHTML = subWorkspace.transfer.fromAccountInnerHTML;
      toAccountBtn.innerHTML = subWorkspace.transfer.toAccountInnerHTML;

      if (fromCurrency === toCurrency) {
        subWorkspace.transfer.sameCurrency = true;
        
        document.getElementById("simple-transfer-amount-row").style.display = "block";
        document.getElementById("exchange-transfer-amount-row").style.display = "none";
        
        // make sure simple amount is updated
        let amountBtn = document.querySelector(`#${activeForm} .amount-button`);
        let calculationBtn = document.querySelector(`#${activeForm} .calculation`);

        if (subWorkspace.amount == null) {
          subWorkspace.amount = 0;
          subWorkspace.calculation = "";
        }
        amountBtn.textContent = subWorkspace.amount.toFixed(2);
        calculationBtn.textContent = subWorkspace.calculation;
    
      } else {
        subWorkspace.transfer.sameCurrency = false;

        document.getElementById("transfer-from-currency").textContent = fromCurrency;
        document.getElementById("transfer-to-currency").textContent = toCurrency;
        
        document.getElementById("simple-transfer-amount-row").style.display = "none";
        document.getElementById("exchange-transfer-amount-row").style.display = "grid";

        // make sure exchange amount is updated
        let fromAmountBtn = document.getElementById('transfer-from-amount');
        let fromCalculationBtn = document.getElementById('transfer-from-calculation');
        if (subWorkspace.amount == null) {
          subWorkspace.amount = 0;
          subWorkspace.calculation = "";
        }
        fromAmountBtn.textContent = subWorkspace.amount.toFixed(2);
        fromCalculationBtn.textContent = subWorkspace.calculation;
      }
    }
  } else if (lastButton.dataset.type === "subject") {
    const { icon: icon, name: name } =
        getSelectedValue(subjectSelector, ".subject-col", true);

    subWorkspace[subWorkspace.inputType].subject = name;
    subWorkspace[subWorkspace.inputType].subjectIcon = icon;

    lastButton.innerHTML = `${icon} ${name}`;
  } else if (lastButton.dataset.type === "collection") {
    const { icon: icon, name: name } =
        getSelectedValue(collectionSelector, ".collection-col", true);

    subWorkspace[subWorkspace.inputType].collection = name;
    subWorkspace[subWorkspace.inputType].collectionIcon = icon;

    lastButton.innerHTML = `${icon} ${name}`;
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

  // Get names for display
  const householdNames = userDoc.orderedHouseholds
    .map(id => householdDocs[id])     // get the doc for each id
    .filter(doc => doc)               // remove null/undefined
    .map(doc => doc.name);            // extract the name

  createList(col, householdNames);
}

function updateDayColumn() {
  let subWorkspace = null;

  if (latestNavBtn === "nav-transaction") { // when creating an entry
    subWorkspace = workspace.create;
  } else {
    subWorkspace = workspace[latestNavBtn.replace("nav-", "")];
  }

  subWorkspace.inputTransactionTimeRaw.yyyy = getSelectedValue(datetimeSelector, ".year-col");
  subWorkspace.inputTransactionTimeRaw.mm = getSelectedValue(datetimeSelector, ".month-col");

  const days = daysInMonth(subWorkspace.inputTransactionTimeRaw.yyyy, subWorkspace.inputTransactionTimeRaw.mm);
  const dayCol = datetimeSelector.querySelector(".day-col");
  createList(dayCol, Array.from({ length: days }, (_, i) => i + 1));
}

function updateSecondaryColumn(lastButton, subWorkspace, secondaryCol) {
  const t = translations[currentLang];

  const inputType = subWorkspace.inputType;
  const inputHouseholdId = subWorkspace[inputType].householdId;
  let cats = null;
  let primaryCat = null;
  let secondaries =null;
  let secondaryList = [];

  if (lastButton.dataset.type === "category") {
    cats = householdDocs[inputHouseholdId][inputType + '-categories'];

    const { icon: pIcon, name: pName } =
      getSelectedValue(categorySelector, ".primary-col", true);
    
    subWorkspace[inputType].primaryCategory = pName;
    subWorkspace[inputType].primaryCategoryIcon = pIcon;
    
    // Find the primary category object that matches the selected primary name
    primaryCat = cats.find(cat => cat.primary === subWorkspace[inputType].primaryCategory);
    
    // If found, use its secondaries; otherwise fallback to empty list
    secondaries = primaryCat ? primaryCat.secondaries : [];
    
    // Build the list of secondary items as objects
    secondaryList = secondaries.map(sec => ({
      icon: sec.icon || "",
      name:  sec.name || ""
    }));
    
  } else if (lastButton.dataset.type === "account") {
    cats = householdDocs[inputHouseholdId].accounts;

    const inputAccountTypeString = getSelectedValue(accountSelector, ".primary-col", false);
    const reverseMap = Object.fromEntries( Object.entries(t).map(([key, value]) => [value, key]) );
    const inputAccountType = reverseMap[inputAccountTypeString];

    subWorkspace[inputType].accountInfo.type = inputAccountType;

    const accountsByType = cats[inputAccountType];

    if (!accountsByType) return [];

    accountsByType.forEach(acc => {
      const subs = acc["sub-accounts"] || [];

      if (subs.length > 0) {
        // Use sub-accounts
        subs.forEach(sub => {
          secondaryList.push({
            icon: sub.icon,
            name: `${sub.name} (${sub.currency})`
          });
        });
      } else {
        // Use the account itself
        secondaryList.push({
          icon: acc.icon,
          name: `${acc.name} (${acc.currency})`
        });
      }
    });
  }
  
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
    let icon;

    const iconEl  = selectedItem.querySelector(".selector-item-icon");
    if (iconEl) {
      icon = iconEl.innerHTML;
    }

    const labelEl = selectedItem.querySelector(".selector-item-label");
    const name  = labelEl.textContent.trim();

    return { icon, name };
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
  let subWorkspace = null;

  if (latestNavBtn === "nav-transaction") { // when creating an entry
    subWorkspace = workspace.create;
  } else {
    subWorkspace = workspace[latestNavBtn.replace("nav-", "")];
  }

  const inputType = subWorkspace.inputType;

  const activeForm = inputType + "-form";

  let btn = document.querySelector(`#${activeForm} .selector-button[data-type='datetime']`);
  if (btn) setCurrentTime(btn, subWorkspace);

  ScrollToSelectItem(datetimeSelector.querySelector(".year-col"), subWorkspace.inputTransactionTimeRaw.yyyy);
  ScrollToSelectItem(datetimeSelector.querySelector(".month-col"), subWorkspace.inputTransactionTimeRaw.mm);
  ScrollToSelectItem(datetimeSelector.querySelector(".day-col"), subWorkspace.inputTransactionTimeRaw.dd);
  ScrollToSelectItem(datetimeSelector.querySelector(".hour-col"), subWorkspace.inputTransactionTimeRaw.hh);
  ScrollToSelectItem(datetimeSelector.querySelector(".minute-col"), subWorkspace.inputTransactionTimeRaw.min);
}
window.clickToSetNow = clickToSetNow;

let openSelector = null;
let keypadOpen = false;

function showSelector(selName) {
  if (prevLastButton !== lastButton) { // when switching to a different button
    if (openSelector === 'amount') { // if previously was an amount-selector
      prevLastButton.style.borderWidth = "1px"; 
    } else {
      if (prevLastButton) {
        if (prevLastButton.id === "transfer-accounts") {
          prevLastButton.style.background = "var(--bg)";
          document.getElementById("transfer-from-account").style.background = "var(--bg)";
          document.getElementById("transfer-to-account").style.background = "var(--bg)";
        } else {
          prevLastButton.style.background = "var(--bg)";
        }
      }
    }
  }

  if (selName !== 'amount') { // if currently not an amount-selector
    if (lastButton.id === "transfer-accounts") {
      lastButton.style.background = "color-mix(in srgb, var(--primary) 50%, var(--bg)";
      document.getElementById("transfer-from-account").style.background = "color-mix(in srgb, var(--primary) 50%, var(--bg)";
      document.getElementById("transfer-to-account").style.background = "color-mix(in srgb, var(--primary) 50%, var(--bg)";
    } else {
      lastButton.style.background = "color-mix(in srgb, var(--primary) 50%, var(--bg)";
    }
  }

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

    if (selName === 'amount') {
      // Auto height based on content
      sel.style.height = 'auto';
      sel.style.maxHeight = '80vh'; // optional safety cap

      keypadOpen = true;
    } else {
      // Fixed height for all other selectors
      sel.style.height = '30%';
    }
  }

  return sel
}

function closeSelector() {
  if (!openSelector) return;
  
  keypadOpen = false; // keep it false regardless of what selector is open, in case of unexpected interception of keys

  if (openSelector === 'amount') {
    lastButton.style.borderWidth = "1px";
  } else {
    if (lastButton.id === "transfer-accounts") {
      lastButton.style.background = "var(--bg)";
      document.getElementById("transfer-from-account").style.background = "var(--bg)";
      document.getElementById("transfer-to-account").style.background = "var(--bg)";
    
    } else {
      lastButton.style.background = "var(--bg)";
    }
  }
  
  const sel = document.getElementById(openSelector + '-selector');
  if (sel) {
    sel.style.transform = 'translateY(120%)';
  }
  openSelector = null;

  stopBackspaceHold();

  // Clear dummy state so further back presses exit normally
  history.back();
}
window.closeSelector = closeSelector;

window.addEventListener('popstate', (e) => {  
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

const allowedKeys = {
  "0": "0",
  "1": "1",
  "2": "2",
  "3": "3",
  "4": "4",
  "5": "5",
  "6": "6",
  "7": "7",
  "8": "8",
  "9": "9",
  ".": ".",
  "+": "+",
  "-": "-",
  "*": "×",   // map keyboard * to ×
  "/": "÷",   // map keyboard / to ÷
  "(": "(",
  ")": ")",
  "Backspace": "backspace",
  "Enter": "confirm"
};

let backspaceInterval = null;

document.addEventListener("keydown", e => {
  if (!keypadOpen) return; // only respond when keypad is open

  if (!(e.key in allowedKeys)) return;

  e.preventDefault();

  const mapped = allowedKeys[e.key];

  // Handle keyboard backspace hold
  if (mapped === 'backspace') {
    handleAmountKey('backspace'); // repeated automatically by key repeat
    return;
  }

  // Handle keyboard confirm
  if (mapped === 'confirm') {
    closeSelector();
    return;
  }

  handleAmountKey(mapped);
});

function startBackspaceHold() {
  // Delete one immediately for responsiveness
  handleAmountKey('backspace');

  // Start repeating delete
  backspaceInterval = setInterval(() => {
    handleAmountKey('backspace');
  }, 80); // 80ms feels like a real keyboard
}

function stopBackspaceHold() {
  if (backspaceInterval) {
    clearInterval(backspaceInterval);
    backspaceInterval = null;
  }
}

function getAmountColor(amountButton) {
  const id = amountButton.id;

  if (id === 'expense-amount') return 'var(--expense-color)';
  if (id === 'income-amount') return 'var(--income-color)';

  return 'var(--text)';
}

function tryUpdateAmount(expr, amountButton) {
  const t = translations[currentLang];

  const calcLabel = amountButton.closest('.amount-row').querySelector('.calculation');

  let subWorkspace = null;

  if (latestNavBtn === "nav-transaction") { // when creating an entry
    subWorkspace = workspace.create;
  } else {
    subWorkspace = workspace[latestNavBtn.replace("nav-", "")];
  }

  const inputType = subWorkspace.inputType;

  if (!expr) {
    amountButton.textContent = "0.00";
    if (inputType === 'transfer') {
      if (amountButton.id === 'transfer-to-amount') {
        subWorkspace.transfer.toAmount = 0;
        subWorkspace.transfer.toCalculation = "";
      }

      if (['transfer-from-amount', 'transfer-to-amount'].includes(amountButton.id)) {
        // Update labels
        const fromLabel = document.getElementById("exchange-rate-from-label");
        const toLabel   = document.getElementById("exchange-rate-to-label");

        fromLabel.textContent = ``;
        toLabel.textContent   = ``;
        subWorkspace.transfer.fromExchangeRate = 0;
        subWorkspace.transfer.toExchangeRate = 0;
      }

    } else {
      subWorkspace.amount = 0;
      subWorkspace.calculation = "";
    }

    // Empty expression → reset colors
    calcLabel.style.color = 'grey';
    amountButton.style.color = getAmountColor(amountButton);
    return;
  }

  const safeExpr = expr.replace(/×/g, '*').replace(/÷/g, '/');

  try {
    const result = Function(`"use strict"; return (${safeExpr})`)();
    
    if (typeof result === 'number' && isFinite(result)) {
      // VALID expression
      amountButton.textContent = result.toFixed(2);
      if (inputType === 'transfer') {
        if (amountButton.id === 'transfer-to-amount') {
          subWorkspace.transfer.toAmount = result;  // numeric
          subWorkspace.transfer.toCalculation = expr;          // raw expression
        }

        if (['transfer-from-amount', 'transfer-to-amount'].includes(amountButton.id)) {
          const fromBtn = document.getElementById("transfer-from-amount");
          const toBtn   = document.getElementById("transfer-to-amount");

          const fromVal = parseFloat(fromBtn.textContent) || 0;
          const toVal   = parseFloat(toBtn.textContent) || 0;

          // Avoid division by zero
          const ratio = fromVal > 0 ? (toVal / fromVal) : 0;
          const reverseRatio = toVal > 0 ? (fromVal / toVal) : 0;

          // Update labels
          const fromLabel = document.getElementById("exchange-rate-from-label");
          const toLabel   = document.getElementById("exchange-rate-to-label");

          fromLabel.textContent = `⇂ ${t.exchangeRate}: ${ratio.toFixed(4)}`;
          toLabel.textContent   = `↿ ${t.exchangeRate}: ${reverseRatio.toFixed(4)}`;

          subWorkspace.transfer.fromExchangeRate = ratio;
          subWorkspace.transfer.toExchangeRate = reverseRatio;
        }

      } else {
        subWorkspace.amount = result;             // numeric
        subWorkspace.calculation = expr;                           // raw expression
      }

      calcLabel.style.color = 'grey';
      amountButton.style.color = getAmountColor(amountButton);
    } else {
      // Not a number → error
      calcLabel.style.color = 'red';
      amountButton.style.color = 'red';
    }

  } catch (e) {
    console.log(e)
    // INVALID expression → error
    calcLabel.style.color = 'red';
    amountButton.style.color = 'red';
  }
}

function handleAmountKey(key) {
  if (!lastButton) return;

  const calcLabel = lastButton.querySelector('.calculation');
  const amountButton = lastButton.querySelector('.amount-button');

  let expr = calcLabel.textContent.trim();

  // Handle backspace
  if (key === 'backspace') {
    if (expr.length === 0) {
      return; // nothing to delete
    }

    expr = expr.slice(0, -1);
    calcLabel.textContent = expr;
    tryUpdateAmount(expr, amountButton);
    return;
  }

  // Handle confirm
  if (key === 'confirm') {
    // You may want to close selector here
    closeSelector();
    return;
  }

  const isOp = c => "+-×÷".includes(c);
  const isParen = c => "()".includes(c);
  const last = expr.slice(-1);

  // Identify current number segment
  const lastNumber = expr.split(/[-+×÷]/).pop();

  // 1. Prevent two decimals in one number
  if (key === "." && lastNumber.includes(".")) {
    return;
  }

  // 2. Prevent parentheses next to operators
  if (isParen(key) && isOp(last)) return;
  if (isOp(key) && isParen(last)) return;

  // 3. Replace operator if two typed consecutively
  if (isOp(key) && isOp(last)) {
    expr = expr.slice(0, -1) + key;
    calcLabel.textContent = expr;
    tryUpdateAmount(expr, amountButton);
    return;
  }

  // Append normal key
  expr += key;
  calcLabel.textContent = expr;

  // Try evaluating
  tryUpdateAmount(expr, amountButton);
}

/* Open selector */
document.querySelectorAll(".amount-row").forEach(btn => {
  btn.onclick = e => {
    e.stopPropagation();
    prevLastButton = lastButton; // keep track of the previous button pressed
    lastButton = btn;

    // Show the desired selector
    showSelector('amount')

    lastButton.style.borderWidth = "3px";
  };
});

let touchActive = false;

// listener for amount-selector keys
document.querySelectorAll('#amount-selector .keys button').forEach(key => {

  // MOUSE (desktop)
  key.addEventListener('mousedown', e => {
    if (touchActive) return; // ignore synthetic mouse events
    e.preventDefault();
    key.classList.add('pressed');
    if (navigator.vibrate) navigator.vibrate(30);

    const k = key.dataset.key;

    if (k === 'backspace') {
      startBackspaceHold();
    } else {
      handleAmountKey(k);
    }
  });

  key.addEventListener('mouseup', () => {
    if (touchActive) return;
    key.classList.remove('pressed');
    stopBackspaceHold();
  });

  key.addEventListener('mouseleave', () => {
    if (touchActive) return;
    key.classList.remove('pressed');
    stopBackspaceHold();
  });

  // block right click
  key.addEventListener("contextmenu", e => e.preventDefault());

  // TOUCH
  key.addEventListener('touchstart', e => {
    touchActive = true; // mark that this interaction is touch 
    e.preventDefault();
    key.classList.add('pressed');
    if (navigator.vibrate) navigator.vibrate(30);

    const k = key.dataset.key;

    if (k === 'backspace') {
      startBackspaceHold();
    } else {
      handleAmountKey(k);
    }
  });

  key.addEventListener('touchend', () => {
    key.classList.remove('pressed');
    stopBackspaceHold();
    setTimeout(() => touchActive = false, 50); // allow next tap
  });

  key.addEventListener('touchcancel', () => {
    key.classList.remove('pressed');
    stopBackspaceHold();
    touchActive = false;
  });
});

document.querySelectorAll(".selector-button[data-type='datetime']").forEach(btn => {
  btn.onclick = e => {
    e.stopPropagation();
    prevLastButton = lastButton; // keep track of the previous button pressed
    lastButton = btn;

    // Show the desired selector
    showSelector('datetime')
  };
});

document.querySelectorAll(".selector-button[data-type='household']")
  .forEach(btn => {
    btn.onclick = e => {
      e.stopPropagation();
      prevLastButton = lastButton; // keep track of the previous button pressed
      lastButton = btn;

      showSelector('household')

      ScrollToSelectItem(householdSelector.querySelector(".household-col"), btn.textContent);
    };
  });

document.querySelectorAll(".selector-button[data-type='category']")
  .forEach(btn => {
    btn.onclick = e => {
      e.stopPropagation();
      prevLastButton = lastButton; // keep track of the previous button pressed
      lastButton = btn;

      const sel = showSelector('category')

      let subWorkspace = null;

      if (latestNavBtn === "nav-transaction") { // when creating an entry
        subWorkspace = workspace.create;
      } else {
        subWorkspace = workspace[latestNavBtn.replace("nav-", "")];
      }

      const inputType = subWorkspace.inputType;

      const manageLabelsBtn = document.getElementById("selector-manage-category-btn");
      manageLabelsBtn.onclick = f => {
        f.stopPropagation();
        
        sel.style.transform = 'translateY(120%)';
        openSelector = null;
        if (inputType === "expense") {prepareHouseholdTabs('manage-labels', 'expense-categories', translations[currentLang].manageExpenseCategories)};
        if (inputType === "income") {prepareHouseholdTabs('manage-labels', 'income-categories', translations[currentLang].manageIncomeCategories)};  
      };

      ScrollToSelectItem(categorySelector.querySelector(".primary-col"), subWorkspace[inputType].primaryCategory);
      ScrollToSelectItem(categorySelector.querySelector(".secondary-col"), subWorkspace[inputType].secondaryCategory);
    };
  });

document.querySelectorAll( 
  ".selector-button[data-type='account']"
).forEach(btn => {
    btn.onclick = e => {
      e.stopPropagation();
      prevLastButton = lastButton; // keep track of the previous button pressed
      lastButton = btn;

      showSelector('account')

      let subWorkspace = null;

      if (latestNavBtn === "nav-transaction") { // when creating an entry
        subWorkspace = workspace.create;
      } else {
        subWorkspace = workspace[latestNavBtn.replace("nav-", "")];
      }

      const inputType = subWorkspace.inputType;

      const t = translations[currentLang];

      if (["expense", "income", "balance"].includes(inputType)) {
        ScrollToSelectItem(accountSelector.querySelector(".primary-col"), t[subWorkspace[inputType].accountInfo.type]);
        ScrollToSelectItem(accountSelector.querySelector(".secondary-col"), `${subWorkspace[inputType].accountInfo.account.name} (${subWorkspace[inputType].accountInfo.account.currency})`);
      }

      if (inputType === "transfer") {
        ScrollToSelectItem(accountSelector.querySelector(".primary-col"), `${subWorkspace[inputType].fromAccountInfo.account.name} (${subWorkspace[inputType].fromAccountInfo.account.currency})`);
        ScrollToSelectItem(accountSelector.querySelector(".secondary-col"), `${subWorkspace[inputType].toAccountInfo.account.name} (${subWorkspace[inputType].toAccountInfo.account.currency})`);
      }
    };
  });

document.querySelectorAll(".selector-button[data-type='subject']")
  .forEach(btn => {
    btn.onclick = e => {
      e.stopPropagation();
      prevLastButton = lastButton; // keep track of the previous button pressed
      lastButton = btn;

      const sel = showSelector('subject')

      const manageLabelsBtn = document.getElementById("selector-manage-subject-btn");
      manageLabelsBtn.onclick = f => {
        f.stopPropagation();
        
        sel.style.transform = 'translateY(120%)';
        openSelector = null;
        prepareHouseholdTabs('manage-labels', 'subjects', translations[currentLang].manageSubjects);
      };
      
      ScrollToSelectItem(subjectSelector.querySelector(".subject-col"), btn.textContent);
    };
  });

document.querySelectorAll(".selector-button[data-type='collection']")
  .forEach(btn => {
    btn.onclick = e => {
      e.stopPropagation();
      prevLastButton = lastButton; // keep track of the previous button pressed
      lastButton = btn;

      const sel = showSelector('collection')

      const manageLabelsBtn = document.getElementById("selector-manage-collection-btn");
      manageLabelsBtn.onclick = f => {
        f.stopPropagation();
        
        sel.style.transform = 'translateY(120%)';
        openSelector = null;
        prepareHouseholdTabs('manage-labels', 'collections', translations[currentLang].manageCollections);
      };

      ScrollToSelectItem(collectionSelector.querySelector(".collection-col"), btn.textContent);
    };
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

const updateBtn = document.querySelector(".update-code-button");

updateBtn.addEventListener("click", () => {
  const title = {
    en: "Update App or Reset Service Worker",
    zh: "更新应用或重置Service Worker"
  }[currentLang];

  const message = {
    en: `If the app behaves unexpectedly, you can try <strong>updating</strong> the app or <strong>unregistering</strong> the Service Worker.<br><br>
        The Service Worker enables offline access. Once the device is online, the app will automatically re-register the Service Worker and recache the required resources.<br><br>
        The app will restart after <strong>updating</strong> or <strong>unregistering</strong>.`,

    zh: `如果应用出现异常行为，你可以尝试<strong>更新</strong>应用或<strong>注销</strong> Service Worker。<br><br>
        Service Worker 提供离线访问功能。设备联网后，应用会自动重新注册 Service Worker 并重新缓存所需资源。<br><br>
        应用在<strong>更新</strong>或<strong>注销</strong>后会自动重新启动。`
  }[currentLang];

  showPopupWindow({
    title,
    message,
    buttons: [
      {
        text: {
          en: "Update",
          zh: "更新"
        }[currentLang],
        onClick: () => {
          if (navigator.serviceWorker.controller) {
            navigator.serviceWorker.controller.postMessage({ type: "UPDATE_CACHE" });
            alert({
              en: "Update finished. Restarting the app…",
              zh: "更新完成，应用将重新启动…"
            }[currentLang]);
            location.reload();
          }
        }
      },
      {
        text: {
          en: "Unregister SW",
          zh: "注销 Service Worker"
        }[currentLang],
        onClick: () => {
          window.location.href = "/sw-kill.html";
          window.location.href = "/";
          alert({
            en: "Service Worker removed. Restarting the app…",
            zh: "Service Worker 已注销，应用将重新启动…"
          }[currentLang]);
          location.reload();
        }
      },
      {
        text: {
          en: "Cancel",
          zh: "取消"
        }[currentLang],
        primary: true,
        onClick: () => {
          /* popup auto closes */
        }
      }
    ]
  });
});

document.getElementById("delete-entry-data-button").addEventListener("click", async () => {
  const householdId = document.getElementById("household-select").value;
  if (!householdId) return;

  const isOwner = currentUser.uid === householdId;
  const ownerUid = householdDocs[householdId].admin;

  let ownerEmail = "";
  if (!isOwner) {
    const profileRef = doc(db, "profiles", ownerUid);
    const profileSnap = await getDoc(profileRef);
    ownerEmail = profileSnap.exists() ? profileSnap.data().email : "";
  }

  const title = {
    en: "Delete All Transaction Data",
    zh: "删除所有交易数据"
  }[currentLang];

  let message = "";

  if (isOwner) {
    // Household owner
    message = {
      en: `
        You are the owner of this household.<br><br>
        To delete <strong>all transaction data</strong>, you must delete your entire account.<br><br>
        To delete your account:<br>
        1. Return to the main Settings page<br>
        2. Tap <strong>Personal Settings</strong><br>
        3. Scroll to the bottom and tap the <strong>Delete Account</strong> button (grey)<br><br>
        After deleting your account, you may sign up again and rejoin and share households if needed.
      `,
      zh: `
        您是此家庭账本的所有者。<br><br>
        若要删除<strong>所有交易数据</strong>，您必须删除整个账户。<br><br>
        删除账户的步骤：<br>
        1. 返回设置主页面<br>
        2. 点击<strong>个人偏好</strong><br>
        3. 滑动到底部，点击<strong>删除账户</strong>（灰色按钮）<br><br>
        删除账户后，您可以重新注册并根据需要重新加入或共享家庭账本。
      `
    }[currentLang];
  } else {
    // Not the owner
    message = {
      en: `
        You are <strong>not</strong> the owner of this household.<br><br>
        Only the household owner can delete all transaction data.<br><br>
        Please ask the owner (<strong>${ownerEmail}</strong>) to delete their entire account.<br><br>
        To delete their account, the owner must:<br>
        1. Return to the main Settings page<br>
        2. Tap <strong>Personal Settings</strong><br>
        3. Scroll to the bottom and tap the <strong>Delete Account</strong> button (grey)<br><br>
        After deleting their account, they may sign up again and rejoin and share households if needed.
      `,
      zh: `
        您<strong>不是</strong>此家庭账本的所有者。<br><br>
        只有家庭账本的所有者才能删除所有交易数据。<br><br>
        请联系该用户（<strong>${ownerEmail}</strong>）删除其整个账户。<br><br>
        删除账户的步骤（由所有者执行）：<br>
        1. 返回设置主页面<br>
        2. 点击<strong>个人偏好</strong><br>
        3. 滑动到底部，点击<strong>删除账户</strong>（灰色按钮）<br><br>
        删除账户后，该用户可以重新注册并根据需要重新加入或共享家庭账本。
      `
    }[currentLang];
  }

  showPopupWindow({
    title,
    message,
    buttons: [
      {
        text: {
          en: "OK",
          zh: "确定"
        }[currentLang],
        primary: true,
        onClick: () => { /* popup auto closes */ }
      }
    ]
  });
});
