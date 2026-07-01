// Data structure: 
// profiles/{userId} // accessible to all
//   - email: string

// users/{userId} // accessible only to the current user
//   - profile
//       email: string
//       language: string
//       homeImages: string
//       fontsize: string
//   - households: [repoId]   // membership links

//   - defaults
//       /expense
//          repoId: string
//          categoryId: string
//          collectionId: string
//          accountId: string
//          personId: string
//       /income
//          repoId: string
//          categoryId: string
//          collectionId: string
//          accountId: string
//          personId: string
//       /transfer
//          fromAccountId: string
//          toAccountId: string
//          personId: string

// households/{repoId} // accessible to all users in the current household
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
let offline = false;
let token = null;
let selectedRepos = null;
let settingsMap = null;
let currentUser = null;
let userEmail = null;
let currentLang = 'zh';
let userDoc = null; // this variable will contain all data under this userId in the Users collection
let householdDocs = {}; // this variable will contain all data of each household to which this userId has access

const LOCAL_DB_KEY = "ledger_dbs";
const LOCAL_LOG_KEY = "ledger_logs";
const LAST_SYNC_KEY = "ledger_lastSynced";
let localLedgerDataMap = null;
let localLogMap = null;
let lastSyncedMap = null;

let workspace = { 'transactions': {} } // use this variable to store temporary transaction data before being saved
//workspace = {
//   create or transactions[id]: {
//     amount: amount, 
//     amountCalulation: string,
//     inputTransactionTime: datetime,
//     inputTypeIndex: typeIndex,
//     inputType: type, 
//     inputNotes: notes,
//     tags: array, 
//     expense: {
//        repoId, 
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

let selectedRepo = null;
let currentBase = "home";
let latestPage = null;
let latestTitle = null;
let latestOptions = null;

const monthNamesEN = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

const supportedCurrencies = ["CNY", "USD", "CAD", "HKD", "JPY", "EUR"];

const translations = {
  en: {
    loginTitle: "Login or Signup",
    loginWithGitHub: "Login with GitHub",
    back: "Back",
    search: "🔍Search",
    welcome: "Welcome, ",
    homeTitle: "Home",
    incomeMinusExpense: "Income - Expense",
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
    statementDistance: (month, days) => `${days} days to ${month} statement`,
    dueDistance: (month, days) => `${days} days to ${month} statement due date`,
    overdue: (month, days) => `${month} statement overdue by ${days} days`,
    paid: (month) => `${month} statement has been paid`,
    available: (amount) => `Available ${amount}`,
    paidCheckbox: "Paid for this cycle",
    statementLabel: "Statement Date",
    dueLabel: "Due Date",
    creditLimitLabel: "Credit Limit",
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
    item: "Item",
    unitPrice: "Unit price",
    totalPrice: "Total price",
    notes: "📝Notes",
    save: "✔️Save",
    savedSuccess: "Save success!",
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
    manageHousehold: "Invite or remove users",
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
    upload: "Upload",
    delete: "Delete",
    homeImageInstruction: "You may add the URL links to the online pictures you would like to use here.",
    homeImageSaved: "Homepage images saved",
    homeImageSaveFailed: "Failed to save homepage images",
    defaults: 'Templates',
    manageDefaults: 'Manage transaction templates',
    logout: "Logout",
    deleteAccount: "Delete my account",
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
        <li><strong><a href="https://github.com" target="_blank" rel="noopener noreferrer">GitHub</a></strong> — for hosting the webpage code repository and user data</li>
        <li><strong><a href="https://vercel.com" target="_blank" rel="noopener noreferrer">Vercel</a></strong> — for deploying and hosting the live web app</li>
        <li><strong><a href="https://copilot.microsoft.com" target="_blank" rel="noopener noreferrer">Copilot</a></strong> — for assisting with coding and development</li>
      </ul>
    `,
    privacy: "Privacy Statement",
    privacyContent: `
      <h2>Privacy Statement</h2>
      <p>Your data is securely stored in your GitHub repository. Anyone you grant repository access to will be able to view and modify your data.</p>
      <p>
        The project owner has no access to your data. For any questions regarding the project, please contact the project owner (Xiaoxin Chen) at: 
        <a href="mailto:jerryc1994@hotmail.com" target="_blank" rel="noopener noreferrer">jerryc1994@hotmail.com</a>.
      </p>
    `
  },
  zh: {
    loginTitle: "登录或注册",
    loginWithGitHub: "通过GitHub账户登录",
    back: "返回",
    search: "🔍搜索",
    welcome: "欢迎，",
    homeTitle: "首页",
    incomeMinusExpense: "收入 - 支出",
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
    statementDistance: (month, days) => `距离 ${month} 月账单还有 ${days} 天`,
    dueDistance: (month, days) => `距离 ${month} 月账单还款日还有 ${days} 天`,
    overdue: (month, days) => `${month} 月账单已逾期 ${days} 天`,
    paid: (month) => `${month} 月账单已还清`,
    available: (amount) => `可用 ${amount}`,
    paidCheckbox: "本期已还清",
    statementLabel: "账单日",
    dueLabel: "还款日",
    creditLimitLabel: "信用额度",
    time: "🕒时间",
    now: "现在",
    dismiss: "收起 ▼",
    datePrefixes: ["前天 ", "昨天 ", "今天 ", "明天 ", "后天 "],
    subject: "对象",
    collection: "🗂项目",
    tags: "🏷标签",
    enterTagName: "输入标签名称",
    exchangeRate: "汇率",
    transferFrom: "转出",
    transferTo: "转入",
    item: "条目",
    unitPrice: "单价",
    totalPrice: "总价",
    notes: "📝备注",
    save: "✔️保存",
    savedSuccess: "保存成功!",
    personalSettingsTitle: "个人偏好",
    openPersonalSettings: "打开个人偏好",
    timestampNotes: "以下时间戳表示上次联网时获取的数据的最新编辑时间。请注意，如果您正处于离线状态，这些时间戳既不代表本设备上的最新编辑时间，也不代表服务器端的最新编辑时间。",
    labels: "类别",
    manageExpenseCategories: "管理支出分类",
    manageIncomeCategories: "管理收入分类",
    manageCollections: "管理项目",
    manageSubjects: "管理交易对象",
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
    manageHousehold: "邀请或移除用户",
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
    upload: "上传",
    delete: "删除",
    homeImageInstruction: "您可在此处添加您想要使用的在线图片链接。",
    homeImageSaved: "首页图链接已保存",
    homeImageSaveFailed: "首页图保存出错",
    defaults: '交易模版',
    manageDefaults: '管理交易模版',
    logout: "退出登录",
    deleteAccount: "删除账户",
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
        <li><strong><a href="https://github.com" target="_blank" rel="noopener noreferrer">GitHub</a></strong> —— 用于托管网页代码仓库和用户数据</li>
        <li><strong><a href="https://vercel.com" target="_blank" rel="noopener noreferrer">Vercel</a></strong> —— 用于部署和托管线上网页应用</li>
        <li><strong><a href="https://copilot.microsoft.com" target="_blank" rel="noopener noreferrer">Copilot</a></strong> —— 用于协助编码与开发</li>
      </ul>
    `,
    privacy: "隐私",
    privacyContent: `
      <h2>隐私声明</h2>
      <p>用户数据安全地存储在您的 GitHub 仓库中。任何被您授予仓库访问权限的用户都可以查看和修改这些数据。</p>
      <p>
        项目所有者无权访问您的数据。如有任何项目相关的问题，请联系项目所有者（Xiaoxin Chen）： 
        <a href="mailto:jerryc1994@hotmail.com" target="_blank" rel="noopener noreferrer">jerryc1994@hotmail.com</a>。
      </p>
    `
  }
};

window.translations = translations;
window.currentLang = currentLang;

// if ('serviceWorker' in navigator) {
//   navigator.serviceWorker.register('/service-worker.js')
//     .then(() => console.log('Service Worker registered'));
// }

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

async function loadLocalJsonData(filename, defaultValue = null) {
  const root = await navigator.storage.getDirectory();
  try {
    const handle = await root.getFileHandle(filename);
    const file = await handle.getFile();
    return JSON.parse(await file.text());
  } catch {
    return defaultValue;
  }
}

async function saveLocalJsonData(filename, data) {
  const root = await navigator.storage.getDirectory();
  const handle = await root.getFileHandle(filename, { create: true });
  const writable = await handle.createWritable();
  await writable.write(JSON.stringify(data));
  await writable.close();
}

async function deleteLocalJsonData(filename) {
  const root = await navigator.storage.getDirectory();
  try {
    await root.removeEntry(filename);
  } catch (err) {
    // File does not exist — safe to ignore
  }
}

async function listOPFSFiles(folderName) {
  const root = await navigator.storage.getDirectory();
  const folder = await root.getDirectoryHandle(folderName, { create: true });

  const files = [];
  for await (const name of folder.keys()) files.push(name);
  return files;
}

async function resizeImage(file, { maxWidth, maxHeight, quality = 0.9, type = "image/jpeg" }) {
  const bitmap = await createImageBitmap(file);

  let { width, height } = bitmap;

  const ratio = Math.min(maxWidth / width, maxHeight / height, 1);
  width = Math.round(width * ratio);
  height = Math.round(height * ratio);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d");
  ctx.drawImage(bitmap, 0, 0, width, height);

  return await new Promise(resolve =>
    canvas.toBlob(resolve, type, quality)
  );
}

async function saveFileToOPFS(folderName, blob, filename, skipResize = false) {
  let finalBlob = blob;

  if (!skipResize) {
    if (folderName === "homeImages") {
      finalBlob = await resizeImage(blob, {
        maxWidth: 1600,
        maxHeight: 1600,
        quality: 0.85,
        type: "image/jpeg"
      });
    } else if (folderName === "icons") {
      finalBlob = await resizeImage(blob, {
        maxWidth: 256,
        maxHeight: 256,
        quality: 0.9,
        type: "image/png"
      });
    }
  }

  const root = await navigator.storage.getDirectory();
  const folder = await root.getDirectoryHandle(folderName, { create: true });

  const fileHandle = await folder.getFileHandle(filename, { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(await finalBlob.arrayBuffer());
  await writable.close();

  return `opfs://${folderName}/${filename}`;
}

async function deleteOPFSFile(folderName, filename) {
  const root = await navigator.storage.getDirectory();
  const folder = await root.getDirectoryHandle(folderName, { create: true });

  try {
    await folder.removeEntry(filename);
  } catch (err) {
    console.error(`Failed to delete OPFS file: ${folderName}/${filename}`, err);
  }
}

async function cleanupLocalFolder(folderName, usedPaths) {
  const usedNames = new Set(
    usedPaths
      .filter(p => p.startsWith(`opfs://${folderName}/`))
      .map(p => p.split("/").pop())
  );

  const existing = await listOPFSFiles(folderName);

  for (const name of existing) {
    if (!usedNames.has(name)) {
      await deleteOPFSFile(folderName, name);
    }
  }
}

async function showRepoSelectionAndMergeRepos(ledgerRepos, incompatible) {
  const container = document.querySelector("#repoList-page .scroll");

  const validIds = new Set(ledgerRepos.map(r => r.id));

  // Build UI
  container.innerHTML = `
    <h3>Resolve Repository Selection</h3>

    ${incompatible.length > 0
      ? `
      <p>The following local/offline repos no longer exist on GitHub.  
      You may merge them into a GitHub repo OR skip syncing them:</p>

      ${incompatible
        .map(
          local => `
        <div class="merge-block">
          <strong>${local.name}</strong>
          <select class="merge-target" data-local-id="${local.id}">
            <option value="">-- Skip syncing this local repo --</option>
            ${ledgerRepos
              .map(r => `<option value="${r.id}">${r.full_name}</option>`)
              .join("")}
          </select>
        </div>
      `
        )
        .join("")}
      `
      : `<p>No incompatible repos detected.</p>`
    }

    <h3>Select a repository to store personal settings</h3>
    <select id="personalRepoSelect">
      <option value="">-- Select one --</option>
      ${ledgerRepos
      .map(
        r => `
        <option value="${r.full_name}" data-id="${r.id}">
          ${r.full_name}
        </option>`
      )
      .join("")}
    </select>

    <h3>Select repositories for ledger data</h3>
    <ul>
      ${ledgerRepos
      .map(
        r => `
        <li>
          <label>
            <input type="checkbox" class="ledger-repo"
              value="${r.full_name}"
              data-id="${r.id}"
              data-owner-id="${r.owner.id}">
            ${r.full_name}
          </label>
        </li>`
      )
      .join("")}
    </ul>
    <p id="noAdditionalReposMsg" style="display:none; opacity:0.7; font-style:italic;">
      No additional private repositories are available under your GitHub account (including repos shared with you).
    </p>

    <div class="actions">
      <button id="confirmRepoSelection">Confirm</button>
    </div>
  `;

  showPage('repoList', 'Select repos');

  // Hide ledger repos that were selected as merge targets
  function updateLedgerCheckboxVisibility() {
    const mergeSelections = document.querySelectorAll(".merge-target");
    const selectedMergeIds = new Set(
      Array.from(mergeSelections)
        .map(sel => sel.value)
        .filter(v => v !== "")
    );

    let visibleCount = 0;

    document.querySelectorAll(".ledger-repo").forEach(cb => {
      const li = cb.closest("li");

      if (selectedMergeIds.has(cb.dataset.id)) {
        li.style.display = "none";
        cb.checked = false;
      } else {
        li.style.display = "";
        visibleCount++;
      }
    });

    // Show or hide the "no additional repos" message
    const msg = document.getElementById("noAdditionalReposMsg");
    msg.style.display = visibleCount === 0 ? "block" : "none";
  }

  // Run once initially
  updateLedgerCheckboxVisibility();

  // Run whenever user changes a merge dropdown
  document.querySelectorAll(".merge-target").forEach(sel => {
    sel.addEventListener("change", updateLedgerCheckboxVisibility);
  });

  // Pre-select valid ledger repos
  if (selectedRepos && selectedRepos.ledgerRepos) {
    selectedRepos.ledgerRepos.forEach(sel => {
      if (validIds.has(sel.id)) {
        const cb = document.querySelector(`.ledger-repo[data-id="${sel.id}"]`);
        if (cb) cb.checked = true;
      }
    });
  }

  // Pre-select personal repo if still valid
  if (selectedRepos && selectedRepos.personalSettingsRepo) {
    const pid = selectedRepos.personalSettingsRepo.id;
    const opt = document.querySelector(`#personalRepoSelect option[data-id="${pid}"]`);
    if (opt) opt.selected = true;
  }

  // Handle confirmation
  document.getElementById("confirmRepoSelection").onclick = async () => {
    // Validate personal repo
    const personalSelect = document.getElementById("personalRepoSelect");
    const personalName = personalSelect.value;
    const personalId = Number(personalSelect.selectedOptions[0]?.dataset.id);

    if (!personalName) {
      alert("Please select a personal settings repo.");
      return;
    }

    // Ledger repos (ADDITIONAL repos only)
    const ledgerSelections = Array.from(document.querySelectorAll(".ledger-repo"))
      .filter(cb => cb.checked)
      .map(cb => ({
        id: Number(cb.dataset.id),
        name: cb.value,
        ownerId: Number(cb.dataset.ownerId),
        skipSync: false
      }));

    // Handle merging of incompatible repos
    const mergeSelections = Array.from(document.querySelectorAll(".merge-target"));

    for (const sel of mergeSelections) {
      const localId = sel.dataset.localId;
      const targetId = sel.value;

      if (targetId) {
        // Merge local DB into GitHub repo
        localLedgerDataMap[targetId] = localLedgerDataMap[localId];
        localLogMap[targetId] = localLogMap[localId];
        lastSyncedMap[targetId] = lastSyncedMap[localId];
        settingsMap[targetId] = settingsMap[localId];
        delete localLedgerDataMap[localId];
        delete localLogMap[localId];
        delete lastSyncedMap[localId];
        delete settingsMap[localId];

        // Remove skipSync if merging now
        const repo = selectedRepos.ledgerRepos.find(r => r.id == localId);
        if (repo) repo.skipSync = false;

      } else {
        // User chose "Skip syncing"
        const repo = selectedRepos.ledgerRepos.find(r => r.id == localId);
        if (repo) repo.skipSync = true;
      }
    }

    await saveLocalJsonData("localLedgerDataMap.json", localLedgerDataMap);
    await saveLocalJsonData("localLogMap.json", localLogMap);
    await saveLocalJsonData("lastSyncedMap.json", lastSyncedMap);
    await saveLocalJsonData("ledger-settings.json", settingsMap);

    // Build final ledgerRepos list
    // Start with ALL existing repos (including skipped ones)
    // Build final ledgerRepos list
    const mergedLedgerRepos = selectedRepos.ledgerRepos.map(r => ({ ...r }));

    for (const sel of mergeSelections) {
      const localId = sel.dataset.localId;
      const targetId = Number(sel.value);

      if (targetId) {
        const targetRepo = ledgerRepos.find(r => r.id === targetId);

        // Find the local repo entry
        const idx = mergedLedgerRepos.findIndex(r => r.id == localId);

        if (idx !== -1 && targetRepo) {
          // ✔ Replace the local repo with the GitHub repo identity
          mergedLedgerRepos[idx] = {
            id: targetRepo.id,              // GitHub repo ID
            name: targetRepo.full_name,     // GitHub repo name
            ownerId: targetRepo.owner.id,   // GitHub owner ID
            skipSync: false
          };
        }
      } else {
        // Skip syncing
        const repo = mergedLedgerRepos.find(r => r.id == localId);
        if (repo) repo.skipSync = true;
      }
    }

    // Add additional checkbox-selected repos
    ledgerSelections.forEach(r => {
      if (!mergedLedgerRepos.some(x => x.id === r.id)) {
        mergedLedgerRepos.push({ ...r, skipSync: false });
      }
    });

    // Save new selectedRepos
    const newSelected = {
      personalSettingsRepo: { name: personalName, id: personalId },
      ledgerRepos: mergedLedgerRepos,
      activeLedgerRepo: mergedLedgerRepos[0]
    };

    await saveLocalJsonData("selectedRepos.json", newSelected);

    window.location.href = "/";
  };
}

const SQL = await initSqlJs({
  locateFile: file => `https://sql.js.org/dist/${file}`
});

function highlightDiff(a, b) {
  const aStr = String(a);
  const bStr = String(b);
  let resultA = "";
  let resultB = "";

  const maxLen = Math.max(aStr.length, bStr.length);

  for (let i = 0; i < maxLen; i++) {
    const ca = aStr[i] || "";
    const cb = bStr[i] || "";

    if (ca !== cb) {
      resultA += `<span style="color:#d66">${ca}</span>`;
      resultB += `<span style="color:#d66">${cb}</span>`;
    } else {
      resultA += ca;
      resultB += cb;
    }
  }

  return { a: resultA, b: resultB };
}

async function readOPFSFileAsBlob(opfsPath) {
  // opfsPath example: "opfs://homeImages/photo.jpg"
  const parts = opfsPath.replace("opfs://", "").split("/");
  const folderName = parts[0];
  const filename = parts[1];

  const root = await navigator.storage.getDirectory();
  const folder = await root.getDirectoryHandle(folderName, { create: false });
  const fileHandle = await folder.getFileHandle(filename, { create: false });
  const file = await fileHandle.getFile();

  return file; // File is a Blob subclass
}

async function pushFolderToCloud(folderName, repoName, localPaths, token) {
  // Create an array of upload tasks
  const tasks = localPaths
    .filter(path => path.startsWith(`opfs://${folderName}/`))
    .map(async path => {
      const filename = path.split("/").pop();
      const blob = await readOPFSFileAsBlob(path);
      await githubUploadFile(repoName, `${folderName}/${filename}`, blob, token);
    });

  // Run all uploads in parallel
  await Promise.all(tasks);
}

async function pullFolderFromCloud(folderName, repoName, cloudPaths, token) {
  const normalized = cloudPaths.map(p =>
    p.startsWith(`opfs://${folderName}/`)
      ? `${folderName}/${p.split("/").pop()}`
      : p
  );

  const tasks = normalized.map(async cloudPath => {
    const filename = cloudPath.split("/").pop();
    const blob = await downloadFileFromGitHub(repoName, cloudPath, token);
    if (blob) await saveFileToOPFS(folderName, blob, filename, true); // skipResize = true
  });

  await Promise.all(tasks); // run in parallel
}

async function cleanupCloudFolder(folderName, repoName, usedPaths, token) {
  // Extract only OPFS-based filenames
  const usedNames = new Set(
    usedPaths
      .filter(p => p.startsWith(`opfs://${folderName}/`))
      .map(p => p.split("/").pop())
  );

  // List all files currently in the cloud folder
  const cloudFiles = await githubListDirectory(repoName, folderName, token);

  // Delete unused files IN PARALLEL
  const tasks = cloudFiles.map(file => {
    if (!usedNames.has(file.name)) {
      // Use SHA directly → avoids extra GET call
      return githubDeleteFile(repoName, `${folderName}/${file.name}`, file.sha, token);
    }
  });

  await Promise.all(tasks);
}

function updateSyncProgress(percent, clear = false) { // clear=true forces removal of the progress bar
  const bar = document.getElementById("sync-progress-bar");
  const fill = document.getElementById("sync-progress-fill");

  if (!clear) {
    bar.style.display = "block";
    fill.style.width = percent + "%";
  }

  if (percent >= 100 || clear) {
    setTimeout(() => {
      bar.style.display = "none";
      fill.style.width = "0%";
    }, 500);
  }
}

async function smartSync(selectedRepos, token, options = {}) {

  const push = options.push ?? false;
  const syncPersonalSettings = options.syncPersonalSettings ?? false;
  const syncHomeImages = options.syncHomeImages ?? false;
  const syncLedgerData = options.syncLedgerData ?? false;
  const repoId = options.repoId ?? null;

  // keep track of sync progress
  let completed = 0;
  let total = 0;

  // Count steps
  total += 1; // test offline
  total += 1; // personal settings
  total += selectedRepos.ledgerRepos.length; // each ledger

  // Use personal settings file to determine offline
  if (token) {
    let repoName = null;
    let cloud = null;
    let cloudDeleted = null;

    repoName = selectedRepos.personalSettingsRepo.name;

    try {
      cloud = await githubReadJson(repoName, "ledger-personal-settings.json", token);

      cloudDeleted = cloud?.deletedAtTimestamp || 0;
      offline = false;
    } catch (err) {
      console.error("GitHub sync failed:", err);

      showOfflineBanner("GitHub sync failed: " + err);
      offline = true;
    }

    completed++;
    updateSyncProgress(Math.round((completed / total) * 100));

    // Sync personal settings
    if (!offline) {
      const local = await loadLocalJsonData("ledger-personal-settings.json", null);

      const repoName = selectedRepos.personalSettingsRepo.name;
      // -----------------------------------------
      // cloud null OR cloud deleted → push
      // -----------------------------------------
      if ((push && syncPersonalSettings) || !cloud || cloudDeleted > 0) {
        await githubUploadFile(repoName, "ledger-personal-settings.json", local, token);

        if ((push && syncHomeImages) || !push) {
          // Push OPFS images → GitHub
          const localImages = local?.homeImages || [];
          await pushFolderToCloud("homeImages", repoName, localImages, token);
          await cleanupCloudFolder("homeImages", repoName, localImages, token); // Remove cloud images no longer referenced
        }
      }

      // if both local and cloud exist
      if (!push && cloud) {

        const sameCreated = local.createdAt === cloud.createdAt;

        if (sameCreated) {
          // createdAt same → choose the one with newer updatedAt
          if (local.updatedAt > cloud.updatedAt) {
            console.log(`[${repoName}] createdAt same → local newer → using local`);
            const cloudUpdatedStr = new Date(cloud.updatedAt).toString();
            const localUpdatedStr = new Date(local.updatedAt).toString();
            console.log(cloudUpdatedStr, localUpdatedStr, local.updatedAt > cloud.updatedAt)

            await githubUploadFile(repoName, "ledger-personal-settings.json", local, token);

            const localImages = local.homeImages || [];
            await pushFolderToCloud("homeImages", repoName, localImages, token);
            await cleanupCloudFolder("homeImages", repoName, localImages, token);

          } else {
            console.log(`[${repoName}] cloud newer or identical → using cloud`);
            await saveLocalJsonData("ledger-personal-settings.json", cloud);

            const cloudImages = cloud.homeImages || [];
            await pullFolderFromCloud("homeImages", repoName, cloudImages, token);
            await cleanupLocalFolder("homeImages", cloudImages);
          }

        } else {
          // createdAt different → use the version user chooses

          // Build bilingual popup
          const cloudCreatedStr = new Date(cloud.createdAt).toString();
          const localCreatedStr = new Date(local.createdAt).toString();

          const cloudUpdatedStr = new Date(cloud.updatedAt).toString();
          const localUpdatedStr = new Date(local.updatedAt).toString();

          const createdDiff = highlightDiff(cloudCreatedStr, localCreatedStr);
          const updatedDiff = highlightDiff(cloudUpdatedStr, localUpdatedStr);

          const title =
            currentLang === "en"
              ? "Choose Data Source"
              : "选择数据来源";

          const message =
            (currentLang === "en"
              ? "Cloud and Local personal settings both exist."
              : "云端和本地个人设置同时存在。") +
            "<br><br>" +
            `<b>${currentLang === "en" ? "Cloud repository:" : "云端仓库："}</b><br>${repoName}<br><br>` +
            `<b>${currentLang === "en" ? "Cloud created at:" : "云端创建时间："}</b><br>${createdDiff.a}<br><br>` +
            `<b>${currentLang === "en" ? "Cloud last updated:" : "云端最后更新时间："}</b><br>${updatedDiff.a}<br><br><br>` +
            `<b>${currentLang === "en" ? "Local created at:" : "本地创建时间："}</b><br>${createdDiff.b}<br><br>` +
            `<b>${currentLang === "en" ? "Local last updated:" : "本地最后更新时间："}</b><br>${updatedDiff.b}<br><br>` +
            (currentLang === "en"
              ? "Which version do you want to keep?"
              : "请选择要保留的版本：");

          const useCloud = await new Promise(resolve => {
            showPopupWindow({
              title,
              message,
              buttons: [
                {
                  text: currentLang === "en" ? "Keep Cloud" : "保留云端数据",
                  onClick: () => resolve(true)
                },
                {
                  text: currentLang === "en" ? "Keep Local" : "保留本地数据",
                  onClick: () => resolve(false)
                }
              ]
            });
          });

          if (useCloud) {
            console.log(`[${repoName}] User chose cloud → overwrite local`);

            await saveLocalJsonData("ledger-personal-settings.json", cloud);

            const cloudImages = cloud.homeImages || [];
            await pullFolderFromCloud("homeImages", repoName, cloudImages, token);
            await cleanupLocalFolder("homeImages", cloudImages);

          } else {
            console.log(`[${repoName}] User chose local → overwrite cloud`);

            await githubUploadFile(repoName, "ledger-personal-settings.json", local, token);

            const localImages = local.homeImages || [];
            await pushFolderToCloud("homeImages", repoName, localImages, token);
            await cleanupCloudFolder("homeImages", repoName, localImages, token);
          }
        }
      }

      completed++;
      updateSyncProgress(Math.round((completed / total) * 100));
    }
  } else { // no need for syncing when token is null
    completed = completed + 2;
    updateSyncProgress(Math.round((completed / total) * 100));
  }

  // Sync ledger data
  for (const repo of selectedRepos.ledgerRepos) {
    if (!push || (push && syncLedgerData && repo.id == repoId)) { // if either not in push mode, or in push mode and the instruction is to sync ledger data

      if (repo.skipSync) {
        console.log(`[${repo.name}] skipSync=true → skipping sync`);

        completed++;
        updateSyncProgress(Math.round((completed / total) * 100));
        continue;
      }

      const repoId = repo.id;
      const repoName = repo.name;
      console.log('reponame', repoName)

      const localLedgerData = localLedgerDataMap[repoId] || null;
      const localLog = localLogMap[repoId] || [];
      const lastSynced = lastSyncedMap[repoId] || 0;

      // ------------------------------------------------------------
      // 1. Detect if repo has data
      // ------------------------------------------------------------
      let repoHasData = null;

      if (token && !offline) {
        const remoteSettings = await githubReadJson(repoName, "ledger-settings.json", token);

        // githubReadJson returns:
        // - null  → no file / empty / invalid
        // - object → valid JSON
        if (remoteSettings) {
          repoHasData = true;
        } else {
          repoHasData = null;
        }
      }

      const localHasData = !!localLedgerData;

      // ------------------------------------------------------------
      // 2. No data anywhere → create empty
      // ------------------------------------------------------------
      if ((!token || !repoHasData) && !localHasData) {
        console.log(`[${repoName}] No data anywhere → create empty`);

        await initializeLedgerSettings(repoId);

        lastSyncedMap[repoId] = Date.now();

        completed++;
        updateSyncProgress(Math.round((completed / total) * 100));
        continue;
      }

      if (token && !offline) {
        // ------------------------------------------------------------
        // 3. Only local has data → push everything
        // ------------------------------------------------------------
        if (!repoHasData) {

          if (!(await get("isNewLedger"))) { // show popup message if not confirmed yet. 
            showPopupWindow({
              title: currentLang === "en" ? "Upload Local Data?" : "上传本地数据？",
              message:
                currentLang === "en"
                  ? `The GitHub repository "${repoName}" is empty.\n\nDo you want to upload your local data to GitHub?`
                  : `GitHub 仓库 "${repoName}" 是空的。\n\n是否要将本地数据上传到 GitHub？`,
              buttons: [
                {
                  text: currentLang === "en" ? "Cancel" : "取消",
                  primary: true,
                  onClick: () => { }
                },
                {
                  text: currentLang === "en" ? "Upload" : "上传",
                  onClick: async () => {
                    await set("isNewLedger", true);
                    await smartSync(selectedRepos, token);
                  }
                }
              ]
            });
          }

          if (await get("isNewLedger")) {
            console.log(`[${repoName}] Only local has data → pushing all entries`);

            await githubUploadFile(repoName, "ledger-data.json", localLedgerData, token);

            settingsMap = await loadLocalJsonData("ledger-settings.json", {});
            await githubUploadFile(repoName, "ledger-settings.json", settingsMap[repoId], token);

            showStatusMessage('Local data successfully synced to cloud', "success");

            localLogMap[repoId] = [];
            lastSyncedMap[repoId] = Date.now();
          }

          await del("isNewLedger");

          completed++;
          updateSyncProgress(Math.round((completed / total) * 100));
          continue;
        };

        // ------------------------------------------------------------
        // 4. Only repo has data, or local was created in a previous version → pull everything
        // ------------------------------------------------------------
        if (repoHasData) {
          const remoteSettings = await githubReadJson(repoName, "ledger-settings.json", token);
          settingsMap = await loadLocalJsonData("ledger-settings.json", {});

          if (remoteSettings.createdAt > settingsMap[repoId].createdAt) {
            console.log(`[${repoName}] Only repo has data → pulling all entries`);

            const cloudLedgerData = await githubReadJson(repoName, `ledger-data.json`, token);
            localLedgerDataMap[repoId] = cloudLedgerData;

            settingsMap[repoId] = remoteSettings;
            await saveLocalJsonData("ledger-settings.json", settingsMap);
            showStatusMessage('Successfully retrieved data from cloud', "success");

            localLogMap[repoId] = [];
            lastSyncedMap[repoId] = Date.now();

            completed++;
            updateSyncProgress(Math.round((completed / total) * 100));
            continue;

          } else {
            // ------------------------------------------------------------
            // 5. Both have data → Ask user which version to keep
            // ------------------------------------------------------------
            console.log(`[${repoName}] Both sides have data → merging`);

            const cloudLedgerData = await githubReadJson(repoName, `ledger-data.json`, token);

            const remoteSettings = await githubReadJson(repoName, "ledger-settings.json", token);
            settingsMap = await loadLocalJsonData("ledger-settings.json", {});
            let localSettings = settingsMap[repoId];

            // Compare timestamps
            const sameCreated = localSettings.createdAt === remoteSettings.createdAt;
            const sameUpdated = localSettings.updatedAt === remoteSettings.updatedAt;

            let useCloud;

            // If identical → no popup needed
            if ((remoteSettings.createdAt > localSettings.createdAt) || (sameCreated && (remoteSettings.updatedAt >= localSettings.updatedAt))) {
              console.log(`[${repoName}] Cloud newer or identical → using cloud`);
              localLedgerDataMap[repoId] = cloudLedgerData;
              settingsMap[repoId] = remoteSettings;
              await saveLocalJsonData("ledger-settings.json", settingsMap);
              showStatusMessage('Successfully retrieved data from cloud', "success");

            } else {

              if (push) {
                useCloud = false; // force pushing to cloud
              } else {
                const cloudCreatedStr = new Date(remoteSettings.createdAt).toString();
                const localCreatedStr = new Date(localSettings.createdAt).toString();

                const cloudUpdatedStr = new Date(remoteSettings.updatedAt).toString();
                const localUpdatedStr = new Date(localSettings.updatedAt).toString();

                const createdDiff = highlightDiff(cloudCreatedStr, localCreatedStr);
                const updatedDiff = highlightDiff(cloudUpdatedStr, localUpdatedStr);

                // Build bilingual popup text
                const title =
                  currentLang === "en"
                    ? "Choose Data Source"
                    : "选择数据来源";

                const message =
                  (currentLang === "en"
                    ? "Cloud and Local ledger data both exist."
                    : "云端和本地账本数据同时存在。") +
                  "<br><br>" +
                  `<b>${currentLang === "en" ? "Cloud repository:" : "云端仓库："}</b><br>${repoName}<br><br>` +
                  `<b>${currentLang === "en" ? "Cloud created at:" : "云端创建时间："}</b><br>${createdDiff.a}<br><br>` +
                  `<b>${currentLang === "en" ? "Cloud last updated:" : "云端最后更新时间："}</b><br>${updatedDiff.a}<br><br><br>` +
                  `<b>${currentLang === "en" ? "Local created at:" : "本地创建时间："}</b><br>${createdDiff.b}<br><br>` +
                  `<b>${currentLang === "en" ? "Local last updated:" : "本地最后更新时间："}</b><br>${updatedDiff.b}<br><br>` +

                  (currentLang === "en"
                    ? "Which version do you want to keep?"
                    : "请选择要保留的版本：");

                useCloud = await new Promise(resolve => {
                  showPopupWindow({
                    title,
                    message,
                    buttons: [
                      {
                        text: currentLang === "en" ? "Keep Cloud" : "保留云端数据",
                        onClick: () => resolve(true)
                      },
                      {
                        text: currentLang === "en" ? "Keep Local" : "保留本地数据",
                        onClick: () => resolve(false)
                      }
                    ]
                  });
                });
              }

              if (useCloud) {
                console.log(`[${repoName}] User chose cloud → overwrite local`);
                localLedgerDataMap[repoId] = cloudLedgerData;
                settingsMap[repoId] = remoteSettings;
                await saveLocalJsonData("ledger-settings.json", settingsMap);
                showStatusMessage('Successfully retrieved data from cloud', "success");

              } else {
                console.log(`[${repoName}] User chose local → overwrite cloud`);

                settingsMap[repoId] = localSettings;
                await githubUploadFile(repoName, "ledger-settings.json", settingsMap[repoId], token);
                showStatusMessage('Local data successfully synced to cloud', "success");

                // Upload entire local DB to cloud
                if (token && !repo.skipSync) {
                  await githubUploadFile(repoName, "ledger-data.json", localLedgerData, token);
                }
              }
            }

            // Update lastSynced
            lastSyncedMap[repoId] = Date.now();

            completed++;
            updateSyncProgress(Math.round((completed / total) * 100));
          }
        }
      } else {
        if (!token) { // if the above is skipped due to token=null
          completed++;
          updateSyncProgress(Math.round((completed / total) * 100));
        }
      }

    } else { // if skipp
      completed++;
      updateSyncProgress(Math.round((completed / total) * 100));
    }

    settingsMap = await loadLocalJsonData("ledger-settings.json", {});

    // ------------------------------------------------------------
    // Save everything
    // ------------------------------------------------------------
    await saveLocalJsonData("localLedgerDataMap.json", localLedgerDataMap);
    await saveLocalJsonData("localLogMap.json", localLogMap);
    await saveLocalJsonData("lastSyncedMap.json", lastSyncedMap);
  }
}

async function githubListFiles(repoName, path, token) {
  const res = await fetch(`https://api.github.com/repos/${repoName}/contents/${path}`, {
    headers: { Authorization: `token ${token}` }
  });

  if (!res.ok) return [];
  const data = await res.json();

  return data
    .filter(item => item.type === "file")
    .map(item => item.name);
}

async function githubReadJson(repoName, path, token) {
  const res = await fetch(`https://api.github.com/repos/${repoName}/contents/${path}`, {
    headers: { Authorization: `token ${token}` }
  });

  if (!res.ok) return null; // file missing

  const data = await res.json();

  // GitHub may return undefined or empty content
  const decoded = decodeBase64Utf8(data.content || "");

  // ✔ Empty file → return null (or {} if you prefer)
  if (!decoded.trim()) {
    return null;
  }

  // ✔ Safe JSON parse
  try {
    return JSON.parse(decoded);
  } catch (e) {
    // File exists but contains invalid JSON
    return null;
  }
}

function decodeBase64Utf8(b64) {
  if (!b64 || !b64.trim()) {
    return ""; // empty file → empty string
  }

  let binary;
  try {
    binary = atob(b64);
  } catch (e) {
    return ""; // invalid base64 → treat as empty
  }

  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }

  return new TextDecoder().decode(bytes);
}

async function downloadFileFromGitHub(repoName, path, token) {
  const url = `https://api.github.com/repos/${repoName}/contents/${path}`;

  const res = await fetch(url, {
    headers: { Authorization: `token ${token}` }
  });

  if (!res.ok) return null;

  const data = await res.json();

  // GitHub returns Base64 content
  const byteCharacters = atob(data.content || "");
  const byteNumbers = new Array(byteCharacters.length);

  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }

  const byteArray = new Uint8Array(byteNumbers);

  // Infer MIME type from filename
  const ext = path.split(".").pop().toLowerCase();
  const mime =
    ext === "png" ? "image/png" :
      ext === "webp" ? "image/webp" :
        ext === "jpg" || ext === "jpeg" ? "image/jpeg" :
          "application/octet-stream";

  return new Blob([byteArray], { type: mime });
}

async function githubUploadFile(repoName, path, data, token, message = null) {
  const url = `https://api.github.com/repos/${repoName}/contents/${path}`;

  let base64;

  if (data instanceof Blob) {
    base64 = await blobToBase64(data);
  } else if (typeof data === "string") {
    base64 = encodeBase64Utf8(data);
  } else {
    // JSON object
    const json = JSON.stringify(data, null, 2);
    base64 = encodeBase64Utf8(json);
  }

  // Check if file exists → get SHA
  let sha = undefined;
  const getRes = await fetch(url, {
    headers: { Authorization: `token ${token}` }
  });

  if (getRes.ok) {
    const existing = await getRes.json();
    sha = existing.sha;
  }

  // Upload
  const body = {
    message: message || `update ${path}`,
    content: base64,
    ...(sha ? { sha } : {})
  };

  const putRes = await fetch(url, {
    method: "PUT",
    headers: { Authorization: `token ${token}` },
    body: JSON.stringify(body)
  });

  if (!putRes.ok) {
    console.error("GitHub upload failed:", await putRes.text());
  }
}

async function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = reader.result.split(",")[1]; // remove data:... prefix
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function encodeBase64Utf8(str) {
  const bytes = new TextEncoder().encode(str);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

async function githubAppendChangeLog(repoName, change, token) {
  const ts = change.timestamp; // use timestamp as filename
  const path = `changelog/${ts}.json`;

  const content = encodeBase64Utf8(JSON.stringify(change, null, 2));

  await fetch(`https://api.github.com/repos/${repoName}/contents/${path}`, {
    method: "PUT",
    headers: {
      Authorization: `token ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      message: `append change log ${ts}`,
      content
    })
  });
}

function hideOfflineBanner() {
  const banner = document.getElementById("offline-banner");
  banner.style.display = "none";
  banner.textContent = "";
  document.documentElement.style.setProperty("--banner-height", "0px");
}

function showOfflineBanner(text) {
  const banner = document.getElementById("offline-banner");
  banner.style.display = "block";   // must be visible to measure
  banner.textContent = text;
  const height = banner.offsetHeight;
  document.documentElement.style.setProperty("--banner-height", height + "px");
}

async function initializePersonalSettings() {
  const defaults = {
    createdAt: Date.now(),
    updatedAt: Date.now(),
    language: currentLang,
    homeImages: [],
    fontsizeDesktop: "",
    fontsizeMobile: "",
    themeColor: "",
  };

  await saveLocalJsonData("ledger-personal-settings.json", defaults);
}

async function initializeLedgerSettings(repoId) {
  // Initialize ledger-level settings
  const accounts = {
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
  };

  const expenseCategories = [
    {
      primary: currentLang === "en" ? "Shopping" : "购物", icon: "🛍️", secondaries: [
        { name: currentLang === "en" ? "Offline Expenditure" : "线下消费", icon: "🛒" },
        { name: currentLang === "en" ? "Online Shopping" : "网购", icon: "🛒" }
      ]
    },
    {
      primary: currentLang === "en" ? "Travel" : "出行", icon: "🚗", secondaries: [
        { name: currentLang === "en" ? "Public Transit" : "公共交通", icon: "🚇" },
        { name: currentLang === "en" ? "Ride Services" : "网约车", icon: "🚕" },
        { name: currentLang === "en" ? "Fuel Costs" : "燃油费", icon: "⛽" },
        { name: currentLang === "en" ? "Parking Costs" : "停车费", icon: "🅿️" },
        { name: currentLang === "en" ? "Auto Insurance" : "车险", icon: "🚗" },
        { name: currentLang === "en" ? "Vechicle Purchase" : "购车", icon: "🚗" },
        { name: currentLang === "en" ? "Vechicle Repair" : "车辆维修", icon: "🔧" },
        { name: currentLang === "en" ? "Flight & Train Tickets" : "机票/火车票", icon: "✈️" },
        { name: currentLang === "en" ? "Lodging" : "住宿", icon: "🏨" }
      ]
    },
    {
      primary: currentLang === "en" ? "Entertainment" : "娱乐", icon: "🎭", secondaries: [
        { name: currentLang === "en" ? "Music & Films" : "音乐/电影", icon: "🎬" },
        { name: currentLang === "en" ? "Sightseeing" : "观光", icon: "🗺️" }
      ]
    },
    {
      primary: currentLang === "en" ? "Subscriptions" : "订阅", icon: "🔄", secondaries: [
        { name: currentLang === "en" ? "Phone Bills" : "电话费", icon: "📱" },
        { name: currentLang === "en" ? "Streaming" : "流媒体订阅", icon: "📺" }
      ]
    },
    {
      primary: currentLang === "en" ? "Home" : "家庭", icon: "🏡", secondaries: [
        { name: currentLang === "en" ? "Housing" : "住房", icon: "🏠" },
        { name: currentLang === "en" ? "Utilities" : "水电煤气", icon: "💡" },
        { name: currentLang === "en" ? "Home Insurance" : "家财险", icon: "🏠" },
        { name: currentLang === "en" ? "Decoration" : "装修/装饰", icon: "🖼️" }
      ]
    },
    {
      primary: currentLang === "en" ? "Health" : "健康", icon: "🏥", secondaries: [
        { name: currentLang === "en" ? "Hospitals & Clinics" : "医院/诊所", icon: "🏥" },
        { name: currentLang === "en" ? "Medication" : "药品", icon: "💊" },
        { name: currentLang === "en" ? "Health Insurance Premiums" : "医疗保险费", icon: "🛡️" }
      ]
    },
    {
      primary: currentLang === "en" ? "Public Fees" : "公共费用", icon: "🏛️", secondaries: [
        { name: currentLang === "en" ? "Tuition & Exams" : "学费/考试费", icon: "🎓" },
        { name: currentLang === "en" ? "Tax Payment" : "税款", icon: "🧾" },
        { name: currentLang === "en" ? "Pension Contribution" : "养老金缴纳", icon: "🪙" },
        { name: currentLang === "en" ? "Professional Expenses" : "职业相关费用", icon: "🏛️" }
      ]
    },
    {
      primary: currentLang === "en" ? "Personal Spending" : "个人消费", icon: "💇", secondaries: [
        { name: currentLang === "en" ? "Haircut" : "理发", icon: "💇" },
        { name: currentLang === "en" ? "Laundry" : "洗衣", icon: "🧺" }
      ]
    },
    {
      primary: currentLang === "en" ? "Gifts & Investments" : "礼金与投资", icon: "💸", secondaries: [
        { name: currentLang === "en" ? "Outgoing Transfer" : "转账支出", icon: "💸" },
        { name: currentLang === "en" ? "Gifts" : "礼物", icon: "🎁" },
        { name: currentLang === "en" ? "Donations" : "捐赠", icon: "🎁" },
        { name: currentLang === "en" ? "Insurance Payments" : "保险缴费", icon: "💵" },
        { name: currentLang === "en" ? "Investment Loss" : "投资亏损", icon: "📉" }
      ]
    }
  ];

  const incomeCategories = [
    {
      primary: currentLang === "en" ? "Professional Income" : "职业收入", icon: "💼", secondaries: [
        { name: currentLang === "en" ? "Pay" : "工资", icon: "💵" },
        { name: currentLang === "en" ? "Scholarships & Awards" : "奖学金/奖金", icon: "🏅" }
      ]
    },
    {
      primary: currentLang === "en" ? "Floating Income" : "浮动收入", icon: "🎉", secondaries: [
        { name: currentLang === "en" ? "Investment Earnings" : "投资收益", icon: "📈" },
        { name: currentLang === "en" ? "Giveaways" : "赠品/抽奖", icon: "🎉" },
        { name: currentLang === "en" ? "Red Packet Receipts" : "红包收入", icon: "🧧" }
      ]
    },
    {
      primary: currentLang === "en" ? "Refunds" : "退款", icon: "💰", secondaries: [
        { name: currentLang === "en" ? "Tax Credits" : "税务退还", icon: "💰" },
        { name: currentLang === "en" ? "Reimbursement" : "报销", icon: "↩️" },
        { name: currentLang === "en" ? "Insurance Payout" : "保险理赔", icon: "💰" }
      ]
    },
    {
      primary: currentLang === "en" ? "Pocket Money" : "零用钱", icon: "🪙", secondaries: [
        { name: currentLang === "en" ? "Incoming Transfer" : "转账收入", icon: "💰" }
      ]
    }
  ];

  const collections = [
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
  ];

  const subjects = [
    { name: currentLang === "en" ? "Myself" : "自己", icon: "🙂" },
    { name: currentLang === "en" ? "Partner" : "伴侣", icon: "❤️" },
    { name: currentLang === "en" ? "Children" : "子女", icon: "🧒" },
    { name: currentLang === "en" ? "Parents" : "父母", icon: "👨‍👩‍👦" },
    { name: currentLang === "en" ? "Family" : "家庭", icon: "👪" },
    { name: currentLang === "en" ? "Friends" : "朋友", icon: "🧑‍🤝‍🧑" },
    { name: currentLang === "en" ? "Neighbourhood" : "邻里", icon: "🏘️" }
  ];

  const firstAccountType = Object.keys(accounts)[0];
  const firstAccount = accounts[firstAccountType][0];

  const firstExpensePrimary = expenseCategories[0];
  const firstIncomePrimary = incomeCategories[0];

  // For transfer defaults, pick the second account type if available
  const secondAccountType = Object.keys(accounts)[1] || firstAccountType;
  const secondAccount = accounts[secondAccountType][0] || firstAccount;

  const defaults = {
    expense: {
      accountType: firstAccountType,
      account: firstAccount.name,
      accountIcon: firstAccount.icon,
      primary: firstExpensePrimary.primary,
      primaryIcon: firstExpensePrimary.icon,
      secondary: firstExpensePrimary.secondaries[0].name,
      secondaryIcon: firstExpensePrimary.secondaries[0].icon,
      subject: subjects[0].name,
      subjectIcon: subjects[0].icon,
      collection: collections[0].name,
      collectionIcon: collections[0].icon
    },

    income: {
      accountType: firstAccountType,
      account: firstAccount.name,
      accountIcon: firstAccount.icon,
      primary: firstIncomePrimary.primary,
      primaryIcon: firstIncomePrimary.icon,
      secondary: firstIncomePrimary.secondaries[0].name,
      secondaryIcon: firstIncomePrimary.secondaries[0].icon,
      subject: subjects[0].name,
      subjectIcon: subjects[0].icon,
      collection: collections[0].name,
      collectionIcon: collections[0].icon
    },

    transfer: {
      fromType: firstAccountType,
      fromAccount: firstAccount.name,
      fromAccountIcon: firstAccount.icon,
      toType: secondAccountType,
      toAccount: secondAccount.name,
      toAccountIcon: secondAccount.icon
    },

    balance: {
      accountType: firstAccountType,
      account: firstAccount.name,
      accountIcon: firstAccount.icon
    }
  };

  const ledgerSettings = {
    createdAt: Date.now(),
    updatedAt: Date.now(),
    accounts,
    "expense-categories": expenseCategories,
    "income-categories": incomeCategories,
    collections,
    subjects,
    defaults,
    "tags": {},
  };

  // Save ledger settings locally
  settingsMap = await loadLocalJsonData("ledger-settings.json", {});
  settingsMap[repoId] = ledgerSettings;
  await saveLocalJsonData("ledger-settings.json", settingsMap);

  // Save DB + settings
  localLedgerDataMap[repoId] = {};   // empty entries array
  localLogMap[repoId] = [];

  await saveLocalJsonData("localLedgerDataMap.json", localLedgerDataMap);
  await saveLocalJsonData("localLogMap.json", localLogMap);
}

async function init() {
  window.scrollTo(0, 0);

  let t = translations[currentLang];

  // Load token
  token = await loadLocalJsonData("github_token.json", null);

  const loginBtn = document.getElementById("login-btn");
  if (token) {
    // Logged in → show Logout
    loginBtn.textContent = t.logout;
    loginBtn.onclick = logout;
  } else {
    // Not logged in → show Login
    loginBtn.textContent = t.loginWithGitHub;
    loginBtn.onclick = () => {
      window.location.href = "/api/auth/login";
    };
  }

  localLedgerDataMap = await loadLocalJsonData("localLedgerDataMap.json", {});
  localLogMap = await loadLocalJsonData("localLogMap.json", {});
  lastSyncedMap = await loadLocalJsonData("lastSyncedMap.json", {});
  settingsMap = await loadLocalJsonData("ledger-settings.json", {});

  // Load local repo selections
  selectedRepos = await loadLocalJsonData("selectedRepos.json", null);

  if (!selectedRepos) { // if not logged in, and if local data not exist, create new
    let ledgerRepos;

    ledgerRepos = [
      {
        id: "local",
        name: currentLang === "zh" ? "本地账本" : "Local Ledger",
        ownerId: "local"
      }
    ];

    selectedRepos = {
      ledgerRepos,
      activeLedgerRepo: ledgerRepos[0]
    };

    await saveLocalJsonData("selectedRepos.json", selectedRepos);

    await initializePersonalSettings();
    await initializeLedgerSettings(ledgerRepos[0].id);
  }

  window.currentUserLogin = selectedRepos.activeLedgerRepo.name; // for local ledger

  const pendingDeleteMode = await get("pendingDelete"); // this is a flag for account deletion
  if (pendingDeleteMode === "account" || pendingDeleteMode === "data") {
    const params = new URLSearchParams(window.location.search);

    if (params.get("deleteMode") === "1") {
      await performAccountDeletion(pendingDeleteMode); // pendingDelete variable is cleared when deleting localStorage
      return;

    } else {
      await del("pendingDelete"); // clear this variable to cancel delete account
    }
  }

  // UI updates
  document.getElementById("home-nav").style.display = "flex";

  // Apply profile settings
  const personal = await loadLocalJsonData("ledger-personal-settings.json", null);
  if (personal.language) {
    currentLang = personal.language;
    setLanguage(currentLang, false); // do not sync to cloud
  }

  if (isMobileBrowser()) {
    if (personal.fontsizeMobile) {
      document.documentElement.style.setProperty("--font-size", personal.fontsizeMobile);
    }
  } else {
    if (personal.fontsizeDesktop) {
      document.documentElement.style.setProperty("--font-size", personal.fontsizeDesktop);
    }
  }

  if (personal.themeColor) {
    applyThemeColor(personal.themeColor)
  }

  if (personal.colorScheme) {
    setColorScheme(personal.colorScheme, false); // do not sync to cloud
    document.getElementById("color-scheme-select").value = personal.colorScheme;
  }

  // ✅ Load main app
  showPage("home", "Xiaoxin's Ledger App");

  let user;

  // retrieve github data after page is shown
  if (token) {
    const res = await fetch("https://api.github.com/user", {
      headers: { Authorization: `token ${token}` }
    });

    if (!res.ok) {
      offline = true;
      showOfflineBanner("GitHub error: " + res.status);
      return;
    }

    user = await res.json();

    if (!user.login) {
      offline = true;
      showOfflineBanner("GitHub returned invalid user object");
      return;
    }

    offline = false;
    hideOfflineBanner();
  }

  if (token && !offline) {
    window.currentUserLogin = user.login;
    window.currentUserId = user.id;

    // Get all private repos
    const repos = await fetch("https://api.github.com/user/repos?visibility=private", {
      headers: { Authorization: `token ${token}` }
    }).then(r => r.json());

    // Filter ledger repos (any repo user can push to)
    const ledgerRepos = repos.filter(r => r.permissions.push);

    function validateLocalSelectedRepos(ledgerRepos) {
      const incompatible = [];

      if (!selectedRepos ||
        !Array.isArray(selectedRepos.ledgerRepos) ||
        selectedRepos.ledgerRepos.length === 0) {
        return { valid: false, incompatible: [] };
      }

      const validIds = new Set(ledgerRepos.map(r => r.id));

      for (const repo of selectedRepos.ledgerRepos) {
        // If user chose to skip syncing this repo → ignore it
        if (repo.skipSync) continue;

        // Otherwise validate normally
        if (!validIds.has(repo.id)) {
          incompatible.push(repo);
        }
      }

      return {
        valid: incompatible.length === 0,
        incompatible
      };
    }

    // if the local repos have repo Ids that don't exist in Github, ask user to select repos and merge
    const { valid, incompatible } = validateLocalSelectedRepos(ledgerRepos);

    if (!valid) {
      console.log("Selected repos invalid — showing merge UI");

      // incompatible = list of repos like:
      // [{ id: "local 1", name: "Local Ledger 1", ownerId: "local" }, ...]

      showRepoSelectionAndMergeRepos(ledgerRepos, incompatible);
      return;
    }
  }

  // Load ALL ledger DBs
  await smartSync(selectedRepos, token); // this second smart sync actually merges with the cloud data

  // Initialize household selector
  initLedgerSelector();
  toggleLedgerFormRows();

  const creditCards = getAllCreditCardAccounts();
  showDueNotification(creditCards);
}

init();

function getAllCreditCardAccounts() {
  const result = [];

  for (const repoId in settingsMap) {
    const repoSettings = settingsMap[repoId];
    if (!repoSettings?.accounts) continue;

    const ccList = repoSettings.accounts.creditCards;
    if (Array.isArray(ccList)) {
      for (const acc of ccList) {
        result.push(acc);
      }
    }
  }

  return result;
}

async function showDueNotification(accounts) {
  const allowed = await requestNotificationPermission();
  if (!allowed) return;

  const { dueSoon, overdue } = getDueSummary(accounts);

  if (dueSoon.length === 0 && overdue.length === 0) return;

  let body = "";

  if (overdue.length > 0) {
    body += `Overdue: ${overdue.length} account(s)\n`;
  }

  if (dueSoon.length > 0) {
    body += `Due within 7 days: ${dueSoon.length} account(s)\n`;
  }

  new Notification("Credit Card Summary", {
    body,
    icon: "/icons/creditcard.png"
  });
}

function getDueSummary(accounts) {
  const today = new Date();
  const dueSoon = [];
  const overdue = [];

  for (const acc of accounts) {
    if (acc.type !== "creditCards") continue;
    if (!acc.statementDate || !acc.dueDate) continue;

    const { dueDate } = getCycleDates(acc.statementDate, acc.dueDate);
    const paid = isCyclePaid(acc, dueDate);

    if (paid) continue;

    const days = Math.ceil((dueDate - today) / 86400000);

    if (days < 0) {
      overdue.push({ acc, daysPast: -days });
    } else if (days <= 7) {
      dueSoon.push({ acc, daysLeft: days });
    }
  }

  return { dueSoon, overdue };
}

async function requestNotificationPermission() {
  if (!("Notification" in window)) return false;

  if (Notification.permission === "granted") return true;

  if (Notification.permission !== "denied") {
    const result = await Notification.requestPermission();
    return result === "granted";
  }

  return false;
}

// if (navigator.serviceWorker.controller) {
//   navigator.serviceWorker.controller.postMessage({ type: "UPDATE_CACHE" });
// }

async function logout() {
  await deleteLocalJsonData("github_token.json");
  await deleteLocalJsonData("selectedRepos.json");

  let ledgerRepos = [];

  // Convert ALL keys to local IDs
  const oldIds = Object.keys(localLedgerDataMap);

  if (oldIds.length > 0) {
    if (oldIds.length === 1) {
      // Single local repo
      const newId = "local";

      renameKey(localLedgerDataMap, oldIds[0], newId);
      renameKey(localLogMap, oldIds[0], newId);
      renameKey(lastSyncedMap, oldIds[0], newId);
      renameKey(settingsMap, oldIds[0], newId);

      ledgerRepos = [
        { id: newId, name: "Local Ledger", ownerId: newId }
      ];

    } else {
      // Multiple local repos → number them
      oldIds.forEach((oldId, index) => {
        const newId = `local ${index + 1}`;

        renameKey(localLedgerDataMap, oldId, newId);
        renameKey(localLogMap, oldId, newId);
        renameKey(lastSyncedMap, oldId, newId);
        renameKey(settingsMap, oldId, newId);
      });

      ledgerRepos = oldIds.map((_, index) => ({
        id: `local ${index + 1}`,
        name: `Local Ledger ${index + 1}`,
        ownerId: `local ${index + 1}`
      }));
    }
  }

  await saveLocalJsonData("localLedgerDataMap.json", localLedgerDataMap);
  await saveLocalJsonData("localLogMap.json", localLogMap);
  await saveLocalJsonData("lastSyncedMap.json", lastSyncedMap);
  await saveLocalJsonData("ledger-settings.json", settingsMap);

  await saveLocalJsonData("selectedRepos.json", {
    ledgerRepos,
    activeLedgerRepo: ledgerRepos[0]
  });

  window.location.href = "/";
}

function renameKey(obj, oldKey, newKey) {
  if (oldKey === newKey) return;
  obj[newKey] = obj[oldKey];
  delete obj[oldKey];
}

function toggleLedgerFormRows() {
  // Hide the form row if only one ledger
  const repoCount = selectedRepos.ledgerRepos.length;
  if (repoCount === 1) {
    document.querySelectorAll('[id$="-household-form-row"]').forEach(row => {
      row.style.display = "none";
    });
  } else {
    document.querySelectorAll('[id$="-household-form-row"]').forEach(row => {
      row.style.display = "flex";
    });
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

  // ⭐ Show skip-sync message if ANY ledger is local-only
  // ⭐ Show skip-sync message if ANY ledger is local-only
  const skippedLedgers = selectedRepos?.ledgerRepos?.filter(r => r.skipSync) || [];

  if (skippedLedgers.length > 0) {
    const msg = document.createElement("div");
    msg.style.marginBottom = "0.8em";

    // Localized header (improved wording)
    const header = document.createElement("div");
    header.style.fontStyle = "italic";
    header.style.color = "var(--muted)";
    header.textContent =
      currentLang === "en"
        ? "The following ledgers are stored locally only because you have chosen to skip their syncing:"
        : "以下账本因您选择跳过同步而仅存储在本地：";
    msg.appendChild(header);

    // List skipped ledgers
    const list = document.createElement("ul");
    list.style.margin = "0.4em 0 0.8em 1.2em";
    list.style.padding = "0";
    list.style.color = "var(--muted)";

    skippedLedgers.forEach(r => {
      const li = document.createElement("li");
      li.textContent = r.name;
      list.appendChild(li);
    });

    msg.appendChild(list);

    // ⭐ Data-loss warning
    const warn = document.createElement("div");
    warn.style.fontStyle = "italic";
    warn.style.color = "var(--warning, #d9534f)";
    warn.style.marginBottom = "0.8em";
    warn.textContent =
      currentLang === "en"
        ? "Warning: Local-only data will be lost if the browser clears site data (cache, cookies, storage)."
        : "警告：如果浏览器清除网站数据（缓存、Cookie、本地存储），这些仅存储在本地的账本将会丢失。";
    msg.appendChild(warn);

    // Localized instruction
    const note = document.createElement("div");
    note.id = "last-synced-notes",
    note.textContent =
      currentLang === "en"
        ? "To sync these ledgers, log out and re‑login, then select a GitHub repo to merge the local data into."
        : "如需同步这些账本，请先退出登录并重新登录，然后选择一个 GitHub 仓库以合并本地数据。";
    msg.appendChild(note);

    container.appendChild(msg);
  }

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

document.getElementById("display-local-storage").addEventListener("click", async () => {
  const t = translations[currentLang];
  const container = document.getElementById("local-storage-text");

  // Toggle: hide if already visible
  if (container.innerHTML.trim() !== "") {
    container.innerHTML = "";
    return;
  }

  const notes = document.createElement("div");
  notes.style.color = "var(--muted)";
  notes.style.fontStyle = "italic";
  container.appendChild(notes);

  // Check browser support
  if (navigator.storage && navigator.storage.estimate) {
    const { usage, quota } = await navigator.storage.estimate();

    const blank = document.createElement("div");
    blank.style.height = "0.8em";
    container.appendChild(blank);

    const block = document.createElement("div");
    block.className = "local-storage-entry";

    const usedMB = (usage / 1024 / 1024).toFixed(2);
    const quotaMB = (quota / 1024 / 1024).toFixed(2);

    block.innerHTML = `
      <div style="margin-left: 1.2em;">
        Used: ${usedMB} MB<br>
        Quota: ${quotaMB} MB
      </div>
    `;

    container.appendChild(block);

  } else {
    notes.textContent = "Local storage usage is not available.";
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

function setDefaultLedger(button, subWorkspace) {
  // Set default if workspace is empty
  transactionTypes.forEach(type => {
    if (!subWorkspace[type]) {
      subWorkspace[type] = {};
    }

    if (!subWorkspace[type].repoId) {
      subWorkspace[type].repoId = selectedRepos.ledgerRepos[0]?.id;
    }
  });

  let inputRepoId = subWorkspace[subWorkspace.inputType].repoId;

  button.textContent = selectedRepos.ledgerRepos[0]?.name;
  button.dataset.value = inputRepoId;
}

function setDefaultCategory(button, subWorkspace) {
  const inputType = subWorkspace.inputType;
  const repoId = subWorkspace[inputType].repoId;

  const settings = settingsMap[repoId];   // ledger settings for this repo

  // Set default if workspace is empty, or loading values and look for icons
  transactionTypes.forEach(type => {
    if (["expense", "income"].includes(type)) {
      // transfer and balance types do not have a category

      if (!subWorkspace[type]) {
        subWorkspace[type] = {};
      }

      if (!subWorkspace[type].primaryCategory) {
        const def = settings.defaults[type];    // defaults for expense/income/transfer/balance

        subWorkspace[type].primaryCategory = def.primary;
        subWorkspace[type].secondaryCategory = def.secondary;
      }
    }
  });

  if (["expense", "income"].includes(subWorkspace.inputType)) {
    // transfer and balance types do not have a category

    const cats = settings[inputType + "-categories"];

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
      const def = settings.defaults[inputType];

      // Restore defaults
      subWorkspace[inputType].primaryCategory = def.primary;
      subWorkspace[inputType].secondaryCategory = def.secondary;
    }

    const { primaryIcon, secondaryIcon } = getCategoryIcon(repoId, inputType, subWorkspace[inputType].primaryCategory, subWorkspace[inputType].secondaryCategory);
    subWorkspace[inputType].primaryCategoryIcon = primaryIcon;
    subWorkspace[inputType].secondaryCategoryIcon = secondaryIcon;

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

    button.innerHTML = subWorkspace[inputType].catInnerHTML;

    // Prepare category columns
    const primaryCol = categorySelector.querySelector(".primary-col");
    const secondaryCol = categorySelector.querySelector(".secondary-col");

    createList(primaryCol, primaryList);
    ScrollToSelectItem(primaryCol, subWorkspace[inputType].primaryCategory);

    updateSecondaryColumn(button, subWorkspace, secondaryCol);
    ScrollToSelectItem(secondaryCol, subWorkspace[inputType].secondaryCategory);
  }
}

function findSelectedAccount(repoId, accountType, accountName) {
  const settings = settingsMap[repoId];   // ledger settings for this repo
  const accountsRoot = settings.accounts;

  // -----------------------------------------------------
  // If accountType is null → search ALL account types
  // -----------------------------------------------------
  if (!accountType) {
    for (const typeKey of accountTypes) {
      const result = findSelectedAccount(repoId, typeKey, accountName);
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

  const inputType = subWorkspace.inputType;
  const repoId = subWorkspace[inputType].repoId;

  const settings = settingsMap[repoId];   // ledger settings for this repo

  // Set default if workspace is empty
  transactionTypes.forEach(type => {
    if (!subWorkspace[type]) {
      subWorkspace[type] = {};
    }

    const def = settings.defaults[type];    // defaults for expense/income/transfer/balance

    if (["expense", "income", "balance"].includes(type)) {
      // these types have one account
      if (!subWorkspace[type].accountInfo) {
        subWorkspace[type].accountInfo = findSelectedAccount(subWorkspace[type].repoId, def.accountType, def.account)
      }
    }

    if (type === "transfer") {
      // this type has two accounts

      // FROM ACCOUNT
      if (!subWorkspace.transfer.fromAccountInfo) {
        subWorkspace.transfer.fromAccountInfo = findSelectedAccount(subWorkspace.transfer.repoId, def.fromType, def.fromAccount);
      }

      // TO ACCOUNT
      if (!subWorkspace.transfer.toAccountInfo) {
        subWorkspace.transfer.toAccountInfo = findSelectedAccount(subWorkspace.transfer.repoId, def.toType, def.toAccount);
      }

      if (subWorkspace.transfer.fromAccountInfo.account.currency === subWorkspace.transfer.toAccountInfo.account.currency) {
        subWorkspace.transfer.sameCurrency = true;
      } else {
        subWorkspace.transfer.sameCurrency = false;
      }
    }
  });

  // Prepare account column
  const accountTypeCol = accountSelector.querySelector(".primary-col");
  const accountCol = accountSelector.querySelector(".secondary-col");

  const def = settings.defaults[inputType];    // defaults for expense/income/transfer/balance

  if (["expense", "income", "balance"].includes(inputType)) {
    const accountTypeList = accountTypes.map(type => t[type]);

    // If accountInfo is missing, initialize it using defaults
    if (!subWorkspace[inputType].accountInfo) {
      subWorkspace[inputType].accountInfo = findSelectedAccount(repoId, def.accountType, def.account);
    } else {
      subWorkspace[inputType].accountInfo = findSelectedAccount(repoId, subWorkspace[inputType].accountInfo.type, subWorkspace[inputType].accountInfo.account.name);
    }

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

    button.innerHTML = subWorkspace[inputType].accountInnerHTML;

    createList(accountTypeCol, accountTypeList);
    ScrollToSelectItem(accountTypeCol, t[subWorkspace[inputType].accountInfo.type]);

    updateSecondaryColumn(button, subWorkspace, accountCol);
    ScrollToSelectItem(accountCol, `${subWorkspace[inputType].accountInfo.name} (${subWorkspace[inputType].accountInfo.currency})`);
  }

  if (inputType === "transfer") {
    const allAccounts = [];

    accountTypes.forEach(typeKey => {
      const accountsOfType = settings.accounts[typeKey] || [];

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

    subWorkspace[inputType].fromAccountInfo = findSelectedAccount(repoId, subWorkspace[inputType].fromAccountInfo.type, subWorkspace[inputType].fromAccountInfo.account.name);
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

    subWorkspace[inputType].toAccountInfo = findSelectedAccount(repoId, subWorkspace[inputType].toAccountInfo.type, subWorkspace[inputType].toAccountInfo.account.name);
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

    button[0].innerHTML = subWorkspace[inputType].fromAccountInnerHTML;
    button[1].innerHTML = subWorkspace[inputType].toAccountInnerHTML;

    createList(accountTypeCol, allAccounts);
    ScrollToSelectItem(accountTypeCol, `${subWorkspace[inputType].fromAccountInfo.name} (${subWorkspace[inputType].fromAccountInfo.currency})`);

    createList(accountCol, allAccounts);
    ScrollToSelectItem(accountTypeCol, `${subWorkspace[inputType].toAccountInfo.name} (${subWorkspace[inputType].toAccountInfo.currency})`);
  }
}

function setDefaultSubject(button, subWorkspace) {
  const inputType = subWorkspace.inputType;
  const repoId = subWorkspace[inputType].repoId;

  const settings = settingsMap[repoId];   // ledger settings for this repo

  // Initialize workspace for each type
  transactionTypes.forEach(type => {
    if (["expense", "income"].includes(type)) {
      const def = settings.defaults[type];    // defaults for expense/income/transfer/balance

      // Set default subject if missing
      if (!subWorkspace[inputType].subject) {
        subWorkspace[inputType].subject = def.subject;
      }
    }
  });

  const def = settings.defaults[inputType];

  if (["expense", "income"].includes(inputType)) {
    const subjects = settings.subjects;
    const currentSubject = subWorkspace[inputType].subject;
    const subjectExists = subjects.some(s => s.name === currentSubject);

    if (!subjectExists) {
      // Restore defaults
      subWorkspace[inputType].subject = def.subject;
    }

    const subject = subjects.find(acc => acc.name === subWorkspace[inputType].subject);
    subWorkspace[inputType].subjectIcon = subject.icon

    subWorkspace[inputType].subjectInnerHTML = `
      <span class="cat-part">
        <span class="icon selected">${subWorkspace[inputType].subjectIcon}</span>
        <span class="cat-label">${subWorkspace[inputType].subject}</span>
      </span>
    `;

    // Update button
    button.innerHTML = subWorkspace[inputType].subjectInnerHTML;

    // Prepare subject column
    const subjectCol = subjectSelector.querySelector(".subject-col");

    createList(subjectCol, subjects);
    ScrollToSelectItem(subjectCol, subWorkspace[inputType].subject);
  }
}

function setDefaultCollection(button, subWorkspace) {
  const inputType = subWorkspace.inputType;
  const repoId = subWorkspace[inputType].repoId;

  const settings = settingsMap[repoId];   // ledger settings for this repo

  // Initialize workspace for each type
  transactionTypes.forEach(type => {
    if (["expense", "income"].includes(type)) {
      const def = settings.defaults[type];    // defaults for expense/income/transfer/balance

      // Set default collection if missing
      if (!subWorkspace[inputType].collection) {
        subWorkspace[inputType].collection = def.collection;
      }
    }
  });

  const def = settings.defaults[inputType];

  if (["expense", "income"].includes(inputType)) {
    const collections = settings.collections;
    const currentCollection = subWorkspace[inputType].collection;
    const collectionExists = collections.some(c => c.name === currentCollection);

    if (!collectionExists) {
      // Restore defaults
      subWorkspace[inputType].collection = def.collection;
    }

    const collection = collections.find(acc => acc.name === subWorkspace[inputType].collection);
    subWorkspace[inputType].collectionIcon = collection.icon

    subWorkspace[inputType].collectionInnerHTML = `
      <span class="cat-part">
        <span class="icon selected">${subWorkspace[inputType].collectionIcon}</span>
        <span class="cat-label">${subWorkspace[inputType].collection}</span>
      </span>
    `;

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

  if (latestPage.includes("create")) { // when creating an entry
    subWorkspace = workspace.create;
  } else {
    subWorkspace = workspace.transactions[latestOptions.transactionId];
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
  setDefaultLedger(householdEl, subWorkspace);

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
    const toLabel = document.getElementById("exchange-rate-to-label");
    fromLabel.textContent = subWorkspace.transfer.fromExchangeRate;
    toLabel.textContent = subWorkspace.transfer.toExchangeRate;

    let fromCurrency = subWorkspace.transfer.fromAccountInfo.account.currency;
    let toCurrency = subWorkspace.transfer.toAccountInfo.account.currency;

    if (fromCurrency === toCurrency) {
      subWorkspace.transfer.sameCurrency = true;

      document.getElementById("simple-transfer-amount-row").style.display = "block";
      document.getElementById("exchange-transfer-amount-row").style.display = "none";
    } else {
      subWorkspace.transfer.sameCurrency = false;

      document.getElementById("transfer-from-currency").textContent = fromCurrency;
      document.getElementById("transfer-to-currency").textContent = toCurrency;

      document.getElementById("simple-transfer-amount-row").style.display = "none";
      document.getElementById("exchange-transfer-amount-row").style.display = "grid";
    }
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
    setDefaultSubject(subjectEl, subWorkspace);

    // collection
    const collectionEl = activeTab.querySelector(`#${activeForm} .selector-button[data-type='collection']`);
    setDefaultCollection(collectionEl, subWorkspace);
  }

  // tag input
  const tagInputEl = activeTab.querySelector(`#${activeForm} .tag-input`);
  if (subWorkspace.tagInput !== undefined) {
    tagInputEl.value = subWorkspace.tagInput;
  } else {
    tagInputEl.value = ""; // reset
  }

  if (!Array.isArray(subWorkspace.tags)) {
    subWorkspace.tags = [];
  }

  addTag(subWorkspace.tags, subWorkspace);

  const group = activeTab.querySelector(`#${activeForm} .item-group`);
  // Remove existing rows
  group.querySelectorAll(".item-row").forEach(r => r.remove());
  // Cache the add button ONCE
  const addBtn = group.querySelector("button[id$='add-item-btn']");

  // item rows
  if (Array.isArray(subWorkspace.items) && subWorkspace.items.length > 0) {
    // Insert restored rows
    subWorkspace.items.forEach(item => {
      const row = createItemRow(
        item.name || "",
        item.unitPrice ?? item.unit_price ?? "",
        item.price ?? item.total ?? ""
      );

      group.insertBefore(row, addBtn);
    });
  } else {
    const row = createItemRow("", "", "");
    group.insertBefore(row, addBtn);
  }

  // notes
  if (subWorkspace.notes !== undefined) {
    const notesEl = activeTab.querySelector(`#${activeForm} textarea[id$='notes']`);
    notesEl.value = subWorkspace.notes;
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

  if (latestPage.includes("create")) { // when creating an entry
    subWorkspace = workspace.create;
  } else {
    subWorkspace = workspace.transactions[latestOptions.transactionId];
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

// Loop through each tag input container
document.querySelectorAll(".tag-input-container").forEach(container => {
  const input = container.querySelector("input");
  const button = container.querySelector("button");
  const suggestionsDiv = container.querySelector(".tag-suggestions");

  // Listen for typing
  input.addEventListener("input", async (e) => {
    autoSave();

    const text = e.target.value.trim();
    suggestionsDiv.innerHTML = "";

    if (text.length === 0) return;

    let subWorkspace = null;

    if (latestPage.includes("create")) { // when creating an entry
      subWorkspace = workspace.create;
    } else {
      subWorkspace = workspace.transactions[latestOptions.transactionId];
    }

    const inputType = subWorkspace.inputType;
    const repoId = subWorkspace[inputType].repoId;
    const settings = settingsMap[repoId];

    const tags = settings.tags;

    Object.keys(tags).forEach(tag => {
      if (tag && tag.includes(text)) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "tag-suggestion-btn";
        btn.textContent = tag;

        btn.addEventListener("click", () => {
          if (!Array.isArray(subWorkspace.tags)) {
            subWorkspace.tags = [];
          }
          if (!subWorkspace.tags.includes(tag)) {
            subWorkspace.tags.push(tag);
            addTag(tag, subWorkspace);
          }

          input.value = null;
          suggestionsDiv.innerHTML = "";
        });

        suggestionsDiv.appendChild(btn);
      }
    });
  });

  // Add button handler
  button.addEventListener("click", () => {
    const newTag = input.value.trim();
    if (!newTag) return;

    let subWorkspace = null;

    if (latestPage.includes("create")) { // when creating an entry
      subWorkspace = workspace.create;
    } else {
      subWorkspace = workspace.transactions[latestOptions.transactionId];
    }

    if (!Array.isArray(subWorkspace.tags)) {
      subWorkspace.tags = [];
    }
    if (subWorkspace.tags.includes(newTag)) {
      return; // do nothing
    }

    subWorkspace.tags.push(newTag);
    addTag(newTag, subWorkspace);
    input.value = null;
    suggestionsDiv.innerHTML = "";
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
      container.appendChild(tagEl);
    });

    return;
  }

  // Otherwise tag is a single string → append one
  const tagEl = createTagElement(tag);
  container.appendChild(tagEl);
}

let saveTimer = null;

function autoSave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveItemsNotesToWorkspace();
  }, 150);
}

function createItemRow(nameValue = "", unitValue = "", priceValue = "") {
  const t = translations[currentLang];

  const row = document.createElement("div");
  row.className = "item-row";

  const nameInput = document.createElement("input");
  nameInput.type = "text";
  nameInput.className = "item-name";
  nameInput.placeholder = t.item;
  nameInput.value = nameValue;

  const unitInput = document.createElement("input");
  unitInput.type = "text";
  unitInput.className = "item-unit-price";
  unitInput.placeholder = t.unitPrice;
  unitInput.value = unitValue;

  const priceInput = document.createElement("input");
  priceInput.type = "text";
  priceInput.className = "item-price";
  priceInput.placeholder = t.totalPrice;
  priceInput.value = priceValue;

  row.appendChild(nameInput);
  row.appendChild(unitInput);
  row.appendChild(priceInput);

  function attachAutoSave(input) {
    input.addEventListener("input", autoSave);
  }

  attachAutoSave(nameInput);
  attachAutoSave(unitInput);
  attachAutoSave(priceInput);

  const deleteBtn = document.createElement("button");
  deleteBtn.type = "button";
  deleteBtn.className = "delete-btn";
  deleteBtn.textContent = t.delete;

  row.appendChild(deleteBtn);

  let isTouching = false;

  row.addEventListener("contextmenu", e => {
    if (isTouching) {
      // Mobile long-press → allow normal behavior
      return;
    }

    // Desktop right-click → show deletee.preventDefault();
    e.preventDefault();
    e.stopPropagation();  // stop the event from bubbling up to parent elements
    row.classList.add("show-delete"); // reveal delete button
  });

  row.addEventListener("click", e => {
    e.stopPropagation();  // stop the event from bubbling up to parent elements
    // only hide if clicking outside the delete button
    if (!e.target.classList.contains("delete-btn")) {
      row.classList.remove("show-delete");
    }
  });

  // Swipe detection
  let startX = 0;
  row.addEventListener("touchstart", e => {
    e.stopPropagation();  // stop the event from bubbling up to parent elements
    startX = e.touches[0].clientX;
    isTouching = true;
  });
  row.addEventListener("touchend", e => {
    e.stopPropagation();  // stop the event from bubbling up to parent elements
    const endX = e.changedTouches[0].clientX;
    const diff = startX - endX;
    if (diff > 50) {
      row.classList.add("show-delete");   // swipe left
    } else if (diff < -50) {
      row.classList.remove("show-delete"); // swipe right
    }
    setTimeout(() => isTouching = false, 50); // small delay so contextmenu (if fired) still sees isTouching = true
  });

  deleteBtn.addEventListener("click", () => {
    row.remove();
    saveItemsNotesToWorkspace();
  });

  return row;
}

function saveItemsNotesToWorkspace() {
  let subWorkspace = latestPage.includes("create")
    ? workspace.create
    : workspace.transactions[latestOptions.transactionId];

  let index = subWorkspace.inputTypeIndex;
  const inputType = transactionTypes[index];

  // Find the active tab container
  const activeTab = document.querySelectorAll(".transaction-page")[index];
  const activeForm = inputType + "-form";

  // Save tag inputs
  const tagInputEl = activeTab.querySelector(`#${activeForm} .tag-input`);
  subWorkspace.tagInput = tagInputEl?.value || "";

  // Save item rows
  const group = activeTab.querySelector(`#${activeForm} .item-group`);
  const rows = group.querySelectorAll(".item-row");

  subWorkspace.items = Array.from(rows).map(row => ({
    name: row.querySelector(".item-name")?.value || "",
    unitPrice: row.querySelector(".item-unit-price")?.value || "",
    price: row.querySelector(".item-price")?.value || ""
  }));

  // Save notes (general textarea)
  const notesEl = activeTab.querySelector(`#${activeForm} .transaction-notes`);
  subWorkspace.notes = notesEl?.value || "";
}

// Attach to all add-item buttons
document.querySelectorAll("button[id$='add-item-btn']").forEach(addBtn => {
  addBtn.addEventListener("click", () => {
    const group = addBtn.closest(".item-group");
    const newRow = createItemRow();
    group.insertBefore(newRow, addBtn);
    saveItemsNotesToWorkspace();
  });
});

// Upgrade any existing rows in HTML
document.querySelectorAll(".item-row").forEach(row => {
  const name = row.querySelector(".item-name")?.value || "";
  const unit = row.querySelector(".item-unit-price")?.value || "";
  const price = row.querySelector(".item-price")?.value || "";

  const upgraded = createItemRow(name, unit, price);
  row.replaceWith(upgraded);
});

document.addEventListener("focusin", e => {
  const row = e.target.closest(".item-row");
  if (!row) return;

  const name = row.querySelector(".item-name");
  const unit = row.querySelector(".item-unit-price");
  const price = row.querySelector(".item-price");

  if (e.target === unit) {
    name.style.flex = "3";
    unit.style.flex = "2";
    price.style.flex = "1";
  }

  if (e.target === price) {
    name.style.flex = "3";
    unit.style.flex = "1";
    price.style.flex = "2";
  }
});

document.addEventListener("focusout", e => {
  const row = e.target.closest(".item-row");
  if (!row) return;

  const name = row.querySelector(".item-name");
  const unit = row.querySelector(".item-unit-price");
  const price = row.querySelector(".item-price");

  // Reset to default flex values
  name.style.flex = "4";
  unit.style.flex = "1";
  price.style.flex = "1";
});

document.querySelectorAll("textarea.transaction-notes").forEach(textarea => {
  textarea.addEventListener("input", function () {
    this.style.height = "auto";
    this.style.height = this.scrollHeight + "px";

    autoSave();
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
  const t = translations[currentLang];

  let ws = null;
  if (latestPage.includes("create")) {
    ws = workspace.create;
  } else if (latestPage.includes("transaction")) {
    ws = workspace.transactions[latestOptions.transactionId];
  }

  const inputType = ws.inputType;
  const repoId = ws[inputType].repoId;

  if (inputType === "transfer") {
    const fromAcc = ws.transfer.fromAccountInfo.account.name;
    const toAcc = ws.transfer.toAccountInfo.account.name;

    // Prevent same-account transfers
    if (fromAcc === toAcc) {
      showStatusMessage(
        currentLang === "en"
          ? "The from and to accounts cannot be the same."
          : "转出账户和转入账户不能相同。",
        "error",
        4000
      );
      return; // stop save
    }
  }

  let entryId = null;
  let writeMode = null;
  let loadedEntry_original = null;
  // -----------------------------
  // Generate entryId inline
  // -----------------------------
  if (latestPage.includes("create")) {
    entryId =
      ws.inputTransactionTime.replace(/[- :]/g, "") +
      Math.floor(Math.random() * 1_000_000)
        .toString()
        .padStart(6, "0");
    writeMode = "create";
  } else {
    entryId = ws.entryId;
    writeMode = "overwrite";
  }

  // remove empty item rows
  const cleanedItems = (ws.items ?? []).filter(item => {
    if (!item) return false;

    const name = item.name?.trim();
    const unitPrice = item.unitPrice?.toString().trim();
    const price = item.price?.toString().trim();

    // keep only rows with at least one non‑empty field
    return name || unitPrice || price;
  });

  // -----------------------------
  // Build entryData inline
  // -----------------------------
  const base = {
    entryId,
    type: inputType,
    amount: ws.amount ?? 0,
    repoId,
    transactionTime: ws.inputTransactionTime,
    items: cleanedItems,
    tags: ws.tags ?? [],
    notes: ws.notes ?? "",
    createdTimestamp: getFormattedTime(),
    lastModifiedTimestamp: getFormattedTime()
  };

  let entryData;

  if (inputType === "expense" || inputType === "income") {
    entryData = {
      ...base,
      primaryCategory: ws[inputType].primaryCategory,
      secondaryCategory: ws[inputType].secondaryCategory,
      account: ws[inputType].accountInfo.account.name,
      currency: ws[inputType].accountInfo.account.currency,
      subject: ws[inputType].subject,
      collection: ws[inputType].collection
    };
  } else if (inputType === "transfer") {
    entryData = {
      ...base,
      toAmount: ws[inputType].toAmount ?? 0,
      sameCurrency: ws[inputType].sameCurrency,
      fromAccount: ws[inputType].fromAccountInfo.account.name,
      fromCurrency: ws[inputType].fromAccountInfo.account.currency,
      toAccount: ws[inputType].toAccountInfo.account.name,
      toCurrency: ws[inputType].toAccountInfo.account.currency
    };
  } else if (inputType === "balance") {
    entryData = {
      ...base,
      account: ws[inputType].accountInfo.account.name,
      currency: ws[inputType].accountInfo.account.currency
    };
  }

  try {
    // -----------------------------
    // Write entry to local SQLite DB (inline)
    // -----------------------------

    let localLedgerData = localLedgerDataMap[repoId] || {};
    if (localLedgerData[entryData.entryId]) {
      loadedEntry_original = localLedgerData[entryData.entryId]; // store a copy of the original entry
    }

    localLedgerData[entryData.entryId] = entryData; // overwrite with the new entry

    // Save back to map
    localLedgerDataMap[repoId] = localLedgerData;

    // -----------------------------
    // Append to local change log (inline)
    // -----------------------------
    localLogMap[repoId] ??= [];

    localLogMap[repoId].push({
      mode: writeMode,
      newEntry: entryData,
      entryId: entryData.entryId,
      timestamp: Date.now()
    });

    // Trim log if too long
    const MAX_LOG = 1000;
    if (localLogMap[repoId].length > MAX_LOG) {
      localLogMap[repoId] = localLogMap[repoId].slice(-MAX_LOG);
    }

    // -----------------------------
    // Persist local data + logs
    // -----------------------------
    await saveLocalJsonData("localLedgerDataMap.json", localLedgerDataMap);
    await saveLocalJsonData("localLogMap.json", localLogMap);

    // add or remove tags from tag map
    const oldTags = loadedEntry_original?.tags || [];
    const newTags = entryData.tags || [];

    const added = newTags.filter(t => !oldTags.includes(t));
    const removed = oldTags.filter(t => !newTags.includes(t));

    // Handle added tags
    for (const tag of added) {
      if (!settingsMap[repoId].tags[tag]) {
        settingsMap[repoId].tags[tag] = [];
      }

      if (!settingsMap[repoId].tags[tag].includes(entryId)) {
        settingsMap[repoId].tags[tag].push(entryId);
      }
    }

    // Handle removed tags
    for (const tag of removed) {
      if (!settingsMap[repoId].tags[tag]) continue;

      settingsMap[repoId].tags[tag] =
        settingsMap[repoId].tags[tag].filter(id => id !== entryId);

      if (settingsMap[repoId].tags[tag].length === 0) {
        delete settingsMap[repoId].tags[tag];
      }
    }

    settingsMap[repoId].updatedAt = Date.now();

    // Persist
    await saveLocalJsonData("ledger-settings.json", settingsMap);
    // -----------------------------
    // Cleanup workspace
    // -----------------------------
    if (latestPage.includes("create")) {
      delete workspace.create;
    } else if (latestPage.includes("transaction")) {
      delete workspace.transactions[latestOptions.transactionId];
    }

    smartSync(selectedRepos, token, { push: true, syncLedgerData: true, repoId: repoId });

    history.back();

  } catch (err) {
    console.error("Error saving transaction:", err);
    showStatusMessage(t.saveFailed, "error");
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
  const repoId = document.getElementById("household-select").value;

  if (!repoId) {
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

  const repoId = document.getElementById("household-select").value;

  // entries is now a subcollection under households
  const entriesRef = collection(db, "households", repoId, "entries");

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

      handleCategory(repoId, type, category, subcategory);
      const resolvedAccount = handleAccount(repoId, accountName, currency);

      const entryData = {
        entryId,
        type: transactionType,
        amount,
        repoId,
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
        householdDocs[repoId].entriesThisYear ??= {};
        householdDocs[repoId].entriesThisYear[entryId] = entryData;
      }

      // Collect the promise — do NOT await here 
      writePromises.push(addDoc(entriesRef, entryData));
      addDocCount[transactionType] += 1;
      return;
    }

    // --- 2. 转出: store temporarily ---
    if (type === "转出") {
      const resolvedAccount = handleAccount(repoId, accountName, currency);
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
      const resolvedAccount = handleAccount(repoId, accountName, currency);
      pendingTransfers[linkId].in = { row, resolvedAccount };
      return;
    }

    // --- 4. 余额变更 ---
    if (type === "余额变更") {
      const resolvedAccount = handleAccount(repoId, accountName, currency);
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
      repoId,
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
      householdDocs[repoId].entriesThisYear ??= {};
      householdDocs[repoId].entriesThisYear[entryId] = entryData;
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
      repoId,
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
      householdDocs[repoId].entriesThisYear ??= {};
      householdDocs[repoId].entriesThisYear[entryId] = entryData;
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
  changes.summary = { added: addDocCount };

  // Read the current log
  const log = householdDocs[repoId].entryChangeLog || [];

  // Append the new change
  log.push(changes);

  // If too long, trim the oldest entries
  const MAX_LOG = 1000;
  const trimmed = log.length > MAX_LOG
    ? log.slice(log.length - MAX_LOG)   // keep last 1000
    : log;

  const parts = splitIntoParts(householdDocs[repoId].entriesThisYear);

  const updatePayload = {
    "income-categories": householdDocs[repoId]["income-categories"],
    "expense-categories": householdDocs[repoId]["expense-categories"],
    accounts: householdDocs[repoId].accounts,
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

  const householdRef = doc(db, "households", repoId);

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

function handleCategory(repoId, type, primary, secondary) {
  const key = type === "收入" ? "income-categories" : "expense-categories";
  const list = householdDocs[repoId][key];

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

function handleAccount(repoId, name, currency) {
  const result = findSelectedAccount(repoId, null, name);

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
    householdDocs[repoId].accounts.cashAccounts[name] = newAcc;
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

    householdDocs[repoId].accounts[result.type][importedName] = newAcc;
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

  userDoc.households.forEach(repoId => {
    const option = document.createElement("option");
    option.value = repoId;
    option.textContent = householdDocs[repoId].name;
    select.appendChild(option);
  });

  if (userDoc.households.length <= 1) {
    select.value = userDoc.households[0];
    document.getElementById("household-select-section").style.display = "none";
  } else {
    document.getElementById("household-select-section").style.display = "flex";
  }
}

// history stacks
let historyStack = [["home", "homeTitle", "Xiaoxin's Ledger App"]];

async function showPage(name, title = latestTitle, options = {}) {
  const t = translations[currentLang];

  // hide all pages
  document.getElementById("return-btn").style.display = "none";
  document.getElementById("return-btn").textContent = "< " + t.back;
  document.getElementById("save-btn-headerbar").style.display = "none";
  document.getElementById("search-btn-headerbar").style.display = "none";
  document.getElementById("manage-btn-headerbar").style.display = "none";
  document.getElementById("delete-btn-headerbar").style.display = "none";
  document.getElementById("add-btn-headerbar").style.display = "none";
  document.getElementById("transaction-nav").style.display = "none";

  let target = null;
  let latest = null;

  vibrate(30); // milliseconds

  latest = historyStack[historyStack.length - 1]; // there should always be at least one historyStack
  [latestPage, latestTitle, latestOptions] = latest; // retreive the latest page

  if (name !== latestPage) {
    // if the target page is not latest page, display this page
    latestPage = name;
    latestTitle = title;
    latestOptions = options;

    // push a new history entry for this new page
    history.pushState({ page: latestPage }, "", location.href);
    historyStack.push([latestPage, latestTitle, options]); // add to the historyStack
  }

  if (latestPage.includes("create")) { // when creating an entry
    target = document.getElementById("transaction-page");
  } else {
    target = document.getElementById(latestPage + "-page");
  }
  if (!target) return;

  target.style.display = "block";
  target.zIndex = historyStack.length;

  const current = getComputedStyle(target).transform;
  // If it's not already at translateX(0), move it there
  if ((current === "none" || current.includes("matrix") && !current.includes("1, 0, 0, 1, 0, 0"))) {
    target.style.transform = "translateX(0%)";
    if (!(name === "home")) {
      enablePageSwipe(target);
    }
  }

  if (historyStack.length > 1) { // if not at base
    document.getElementById("return-btn").style.display = "block";
    document.getElementById("home-nav").style.display = "none";

  } else { // at home page
    document.getElementById("search-btn-headerbar").style.display = "block";
    document.getElementById("home-nav").style.display = "flex";

    updateKanbanRow("presetToday", 0, getDateRange('today')); // to distinguish from any "Today" kanban that user defines
    updateKanbanRow({ en: "This Month", zh: "本月" }[currentLang], 1, getDateRange('thisMonth'));
    updateKanbanRow({ en: "This Year", zh: "本年" }[currentLang], 2, getDateRange('thisYear'));

    displayHomeImage();
  };

  document.getElementById("app-title").textContent = translations[currentLang][latestTitle] ?? latestTitle;

  let dateTimeBtn = null;

  // Page special handling
  if (latestPage.includes("transaction") || latestPage.includes("create")) {

    let subWorkspace = null;
    let activeForm;

    if (latestPage.includes("create")) { // when creating an entry
      document.getElementById("return-btn").textContent = "< " + t.cancel;

      const inProgress = !!workspace.create;
      if (!inProgress) { // reset button texts when creating a new entry
        workspace.create = {};

        workspace.create.inputTypeIndex = 0;
        workspace.create.inputType = transactionTypes[0]; // start with expense
        workspace.create.amount = 0;
        workspace.create.calculation = "";
        workspace.create.tags = [];
        workspace.create.notes = "";
        activeForm = workspace.create.inputType + "-form";
        dateTimeBtn = document.querySelector(`#${activeForm} .selector-button[data-type='datetime']`);
        let householdBtn = document.querySelector(`#${activeForm} .selector-button[data-type='household']`);
        let categoryBtn = document.querySelector(`#${activeForm} .selector-button[data-type='category']`);
        let accountBtn = document.querySelector(`#${activeForm} .selector-button[data-type='account']`);
        let subjectBtn = document.querySelector(`#${activeForm} .selector-button[data-type='subject']`);
        let collectionBtn = document.querySelector(`#${activeForm} .selector-button[data-type='collection']`);

        setCurrentTime(dateTimeBtn, workspace.create);
        setDefaultLedger(householdBtn, workspace.create);
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
      } else {
        activeForm = workspace.create.inputType + "-form";
      }

      // Automatically bring up amount-selector
      const amountRowEl = document.querySelector(`#${activeForm} .amount-row`);
      prevLastButton = lastButton; // keep track of the previous button pressed
      lastButton = amountRowEl;
      setTimeout(() => {
        showSelector('amount');
        lastButton.style.borderWidth = "3px";
      }, 10);

      const secondBtn = document.getElementById("second-btn-nav");
      secondBtn.textContent = currentLang === "en" ? "Reset" : "重置";
      secondBtn.style.background = "rgb(from var(--light-grey) r g b / 1)";
      secondBtn.style.color = "var(--text)";

      subWorkspace = workspace.create;
    } else { // when loading an existing entry
      subWorkspace = workspace.transactions[options.transactionId];

      const secondBtn = document.getElementById("second-btn-nav");
      secondBtn.textContent = currentLang === "en" ? "Delete" : "删除";
      secondBtn.style.background = "color-mix(in srgb, var(--red) 5%, var(--bg) 95%)";
      secondBtn.style.color = "var(--red)";
    }

    switchTab(subWorkspace.inputTypeIndex);

    // prepare date time selector columns in advance
    ScrollToSelectItem(datetimeSelector.querySelector(".year-col"), subWorkspace.inputTransactionTimeRaw.yyyy);
    ScrollToSelectItem(datetimeSelector.querySelector(".month-col"), subWorkspace.inputTransactionTimeRaw.mm);
    updateDayColumn();
    ScrollToSelectItem(datetimeSelector.querySelector(".day-col"), subWorkspace.inputTransactionTimeRaw.dd);
    ScrollToSelectItem(datetimeSelector.querySelector(".hour-col"), subWorkspace.inputTransactionTimeRaw.hh);
    ScrollToSelectItem(datetimeSelector.querySelector(".minute-col"), subWorkspace.inputTransactionTimeRaw.min);

    const saveBtn = document.getElementById("save-btn-headerbar");
    saveBtn.style.display = "block";
    saveBtn.onclick = () => saveEntry();

    document.getElementById("transaction-nav").style.display = "flex";
    document.querySelectorAll('.form-row label').forEach(label => {
      label.style.width = (currentLang === 'zh') ? '20%' : '25%';
    });

  } else if (latestPage === "accounts") {
    loadAccounts(options.activeRepoId);

    const addBtn = document.getElementById("add-btn-headerbar");
    addBtn.style.display = "block";

    addBtn.onclick = () => {
      showPage("account-add", currentLang === "en" ? "Add Account" : "新增账户", {
        activeRepoId: options.activeRepoId,
        mode: "main"
      });
    };

  } else if (latestPage === "account-detail") {
    const { activeRepoId, accountType, account } = options;

    renderAccountTabs(account, "account-detail-tabs", {
      mode: "detail",
      onTabClick: (key) => {
        renderAccountDetailContent(activeRepoId, accountType, account, key);
      }
    });
    
    renderAccountDetailContent(activeRepoId, accountType, account);

    const manageBtn = document.getElementById("manage-btn-headerbar");
    manageBtn.style.display = "block";

    manageBtn.onclick = () => {
      showPage("account-edit", "Edit " + account.name, { activeRepoId, accountType, account });
    };

    const addBtn = document.getElementById("add-btn-headerbar");
    addBtn.style.display = "block";

    addBtn.onclick = () => {
      showPage("account-add",
        currentLang === "en"
          ? `Add Sub‑Account`
          : `新增子账户`,
        {
          activeRepoId,
          mode: "sub",
          accountType,
          account
        }
      );
    };

  } else if (latestPage === "account-edit") {
    const { activeRepoId, accountType, account } = options;

    // Render the edit UI
    renderAccountEditPage(activeRepoId, accountType, account);

    // Show Save button
    const saveBtn = document.getElementById("save-btn-headerbar");
    saveBtn.style.display = "block";
    saveBtn.onclick = async () => {
      await saveAccountEdits(activeRepoId, accountType, account);
    };

  } else if (latestPage === "account-add") {

    const { activeRepoId, mode, accountType, account } = options;
    renderAccountAddPage({ activeRepoId, mode, accountType, account });

    // Show Save button
    const saveBtn = document.getElementById("save-btn-headerbar");
    saveBtn.style.display = "block";
    saveBtn.onclick = async () => {
      await saveAccountAdd({ activeRepoId, mode, accountType, account });
    };

  } else if (latestPage === "manage-labels") {
    loadLabels(options.activeRepoId, options.task, options.type, options.title);

    const orderBtn = document.getElementById("manage-btn-headerbar");
    orderBtn.style.display = "block";
    orderBtn.onclick = () => {
      prepareRepoTabs('order-labels', options.type, options.title);
    };

  } else if (latestPage === "order-labels") {
    loadLabels(options.activeRepoId, options.task, options.type, options.title);

    const deleteBtn = document.getElementById("delete-btn-headerbar");
    deleteBtn.style.display = 'block';

  } else if (latestPage === "filtered-entries") {

    if (options.kanbanIndex == 0) {
      // Special case: presetToday loads all entries up to today
      const filters = getDateRange('upToToday');
      document.getElementById("app-title").textContent = translations[currentLang].today + " " + filters.dateTo;

      let filteredEntries = await getFilteredEntries(filters);

      showFilteredEntriesToday(filteredEntries);
    } else {
      let filteredEntries = await getFilteredEntries(options.filters);
      showFilteredEntries(filteredEntries);
    }

    target.addEventListener("click", (e) => {
      const block = e.target.closest(".fe-entry-block");
      if (!block) return;

      const entryId = block.dataset.entryId;
      const repoId = block.dataset.repoId;
      const entry = localLedgerDataMap[repoId][entryId];
      if (!entry) return;

      // If clicking Modify
      if (e.target.classList.contains("modify-btn")) {
        loadEntryIntoWorkspace(entry);
        return;
      }

      // If clicking Delete
      if (e.target.classList.contains("delete-btn")) {
        deleteEntry(repoId, entryId);
        block.remove();
        return;
      }

      // Normal click → load entry
      loadEntryIntoWorkspace(entry);
    });

  } else if (latestPage === "grocery-search") {
    document.getElementById("manage-btn-headerbar").style.display = "block";

  } else { // for all other pages

  }

  if (latestPage === "settings") {
    document.getElementById("settings-welcome").textContent = `${t.welcome}${window.currentUserLogin}`;
  }
}
window.showPage = showPage;

function goBack() {
  closeSelector();

  if (historyStack.length > 1) {
    if (latestPage.includes("create")) { // when creating an entry
      const target = document.getElementById("transaction-page");
      target.style.transform = "translateX(110%)";
    } else {
      const target = document.getElementById(latestPage + "-page");
      target.style.transform = "translateX(110%)";
    }
    historyStack.pop(); // remove current page

    const [prevPage, prevTitle, prevOptions] = historyStack[historyStack.length - 1]; // get the previous entry

    if (historyStack.length > 1) {
      historyStack.pop(); // remove the previous page as well because it will be added later if it is not a base nav page
    }

    showPage(prevPage, prevTitle, prevOptions);
  }
}

async function deleteEntry(repoId, entryId) {
  // Load entries array for this repo
  const localLedgerData = localLedgerDataMap[repoId];
  if (!localLedgerData) return;

  // If the entry exists, remove it
  if (localLedgerData[entryId]) {
    delete localLedgerData[entryId];
  }

  // Remove from settings tags
  removeEntryFromTagMap(settingsMap, repoId, removedEntry);

  settingsMap[repoId].updatedAt = Date.now();

  // Persist both
  await saveLocalJsonData("localLedgerDataMap.json", localLedgerDataMap);
  await saveLocalJsonData("ledger-settings.json", settingsMap);
}

function loadEntryIntoWorkspace(e) {
  let ws = {};

  ws.entryId = e.entryId;
  ws.amount = Number(e.amount) || 0;
  ws.notes = e.notes || "";
  ws.items = [...(e.items || [])];
  ws.tags = [...(e.tags || [])];
  ws.inputTransactionTime = e.transactionTime;
  ws.repoId = e.repoId;

  if (e.type === "income" || e.type === "expense") {
    ws.inputType = e.type;
    ws.inputTypeIndex = transactionTypes.indexOf(e.type);
    ws[e.type] = {};

    ws[e.type].primaryCategory = e.primaryCategory;
    ws[e.type].secondaryCategory = e.secondaryCategory;
    ws[e.type].catInnerHTML = e.catInnerHTML;

    ws[e.type].accountInfo = { account: { name: e.account, currency: e.currency } };

    ws[e.type].subject = e.subject || "";
    ws[e.type].collection = e.collection || "";
  }

  else if (e.type === "transfer") {
    ws.inputType = e.type;
    ws.inputTypeIndex = transactionTypes.indexOf(e.type);
    ws.transfer = {};

    ws.transfer.sameCurrency = e.sameCurrency;

    ws.transfer.fromAccountInfo = { account: { name: e.fromAccount, currency: e.fromCurrency } };
    ws.transfer.toAccountInfo = { account: { name: e.toAccount, currency: e.toCurrency } };

    ws.transfer.toAmount = Number(e.toAmount) || 0;
  }

  else if (e.type === "balance") {
    ws.inputType = e.type;
    ws.inputTypeIndex = transactionTypes.indexOf(e.type);
    ws.balance = {};

    ws.balance.accountInfo = { account: { name: e.account, currency: e.currency } };
  }

  // Save workspace buffer
  workspace.transactions[e.entryId] = ws;

  showPage("transaction", "编辑", { 'transactionId': e.entryId })
}

function prepareRepoTabs(task, type, title, activeRepoId = selectedRepos.activeLedgerRepo.id) {

  const repoList = selectedRepos.ledgerRepos;

  if (repoList.length > 1) {
    const tabContainer = document.getElementById(task + "-repo-tabs");
    tabContainer.innerHTML = ""; // clear old buttons

    for (const repo of repoList) {
      const btn = document.createElement("button");
      btn.className = "tab-btn";
      btn.dataset.id = repo.id;
      btn.textContent = repo.name; // repo name

      // Mark active
      if (repo.id === activeRepoId) {
        btn.classList.add("active");
      }

      // Click handler
      btn.addEventListener("click", () => {
        activeRepoId = repo.id;

        // Update UI
        document.querySelectorAll("#" + task + "-repo-tabs .tab-btn")
          .forEach(b => b.classList.remove("active"));
        btn.classList.add("active");

        // Load labels/settings for this repo
        loadLabels(activeRepoId, task, type, title);

        // Store active repo on page
        const page = document.getElementById(task + "-page");
        page.dataset.activeRepoId = activeRepoId;
      });

      tabContainer.appendChild(btn);
    }
  }

  // Set active repo on page
  const page = document.getElementById(task + "-page");
  page.dataset.activeRepoId = activeRepoId;

  // Auto-load labels for these tasks
  if (task === "accounts" || task === "manage-labels" || task === "order-labels") {
    showPage(task, title, { activeRepoId, task, type, title });
  }
}
window.prepareRepoTabs = prepareRepoTabs;

function loadAccounts(repoId) {
  const target = document.getElementById("accounts-container");
  target.innerHTML = "";

  const repoSettings = settingsMap[repoId];
  if (!repoSettings || !repoSettings.accounts) return;

  const accounts = repoSettings.accounts;

  accountTypes.forEach((type, typeIndex) => {
    const list = accounts[type];
    if (!list || list.length === 0) return;

    const headerText = translations[currentLang][type];

    const header = document.createElement("div");
    header.className = "account-type-header";
    header.textContent = headerText;
    target.appendChild(header);

    list.forEach((acc, index) => {
      const row = createAccountRow(repoId, type, acc);
      target.appendChild(row);

      if (acc.notes?.trim()) {
        const notes = document.createElement("div");
        notes.className = "account-notes";
        notes.textContent = acc.notes;
        target.appendChild(notes);
      }

      if (index < list.length - 1) {
        target.appendChild(document.createElement("hr"));
      }
    });

    const isLastType = typeIndex === accountTypes.length - 1;

    if (!isLastType) {
      const wide = document.createElement("hr");
      wide.className = "hr-wide";
      target.appendChild(wide);
    }
  });
}

function createAccountRow(repoId, type, acc) {
  const t = translations[currentLang];

  const row = document.createElement("div");
  row.className = "account-row";

  row.addEventListener("click", () => {
    showPage("account-detail", acc.name, { activeRepoId: repoId, accountType: type, account: acc });
  });

  // Sub-accounts
  const subs = acc["sub-accounts"] ?? [];
  const hasSubs = subs.length > 0;

  // Multi-currency detection
  const currencies = new Set([acc.currency, ...subs.map(s => s.currency)]);
  const multiCurrency = currencies.size > 1;

  // Placeholder sum (you will compute later)
  const sumPlaceholder = "--";

  // CREDIT CARD WARNING TEXT
  let dueWarning = "";

  if (type === "creditCards") {
    const today = new Date();

    const statementDay = acc.statementDate;
    const dueDay = acc.dueDate;

    if (statementDay && dueDay) {
      const { cycleStart, cycleEnd, dueDate } = getCycleDates(statementDay, dueDay);
      const paid = isCyclePaid(acc, cycleStart);

      if (!paid) {
        const diffDays = Math.ceil((dueDate - today) / 86400000);

        let redness = 0;

        if (diffDays < 0) {
          // Overdue
          const daysOver = Math.abs(diffDays);

          const text = currentLang === "zh"
            ? `已逾期 ${daysOver} 天`
            : `Overdue ${daysOver} days`;

          dueWarning = `
            <span class="due-warning" style="background-color: var(--red); color: white;">
              ${text}
            </span>
          `;

        } else if (diffDays <= 15) {
          // Due soon with redness
          redness = Math.max(0, Math.min((15 - diffDays) / 15, 1));
          const bg = `color-mix(in srgb, var(--red) ${redness * 100}%, var(--bg))`;

          const text = currentLang === "zh"
            ? `${diffDays} 天后到期`
            : `Due in ${diffDays} days`;

          // Decide text color based on redness
          const textColor = redness > 0.6 ? "white" : "var(--text)";

          dueWarning = `
            <span class="due-warning" style="background-color: ${bg}; color: ${textColor};">
              ${text}
            </span>
          `;
        }
      }
    }
  }

  row.innerHTML = `
    <div class="account-left">
      <span class="account-icon">${acc.icon ?? ""}</span>

      <div class="account-text">
        <div class="account-title">
          <span class="account-name">${acc.name}</span>
          ${hasSubs ? `<span class="subaccount-badge">${subs.length}</span>` : ""}
          ${dueWarning}
        </div>

        ${type === "creditCards" && acc.statementDate && acc.dueDate ? `
          <div class="account-notes">
            ${t.statementLabel} ${acc.statementDate ?? "-"} •
            ${t.dueLabel} ${acc.dueDate ?? "-"}
            ${acc.notes ? `• ${acc.notes}` : ""}
          </div>
        ` : acc.notes ? `
          <div class="account-notes">${acc.notes}</div>
        ` : ""}
      </div>
    </div>

    <div class="account-right ${multiCurrency ? "multi" : ""}">
      <div class="account-sum">${sumPlaceholder}</div>
      ${multiCurrency ? `<div class="account-multi-currency">Multiple currencies</div>` : ""}
    </div>
  `;

  return row;
}

function renderAccountTabs(account, elementId, options = {}) {
  const { mode = "detail", onTabClick = null } = options;
  const tabRow = document.getElementById(elementId);
  tabRow.innerHTML = "";

  const subs = account["sub-accounts"] ?? [];

  if (mode === "detail") {
    // existing behavior
    if (subs.length > 0) {
      tabRow.appendChild(
        createAccountTabButton("all", "All", true, onTabClick, false)
      );
      subs.forEach(sub => {
        tabRow.appendChild(
          createAccountTabButton(sub.name, sub.name, false, onTabClick)
        );
      });
    }
  }

  if (mode === "edit") {
    // IMPORTANT: keys must match data-tab on panels
    tabRow.appendChild(
      createAccountTabButton("main", "主账户", true, onTabClick)
    );

    subs.forEach((sub, index) => {
      tabRow.appendChild(
        createAccountTabButton(`sub-${index}`, sub.name, false, onTabClick, true)
      );
    });
  }
}

function createAccountTabButton(key, label, active, onClick, draggable = false) {
  const btn = document.createElement("button");
  btn.className = "account-tab-btn";
  if (active) btn.classList.add("active");
  btn.textContent = label;
  btn.dataset.tab = key;

  // click behavior
  btn.addEventListener("click", () => {
    btn.parentElement.querySelectorAll(".account-tab-btn")
      .forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    if (onClick) onClick(key);
  });

  // drag behavior (edit mode only)
  if (draggable) {
    btn.draggable = true;

    btn.addEventListener("dragstart", (e) => {
      e.dataTransfer.setData("text/plain", key);
      btn.classList.add("dragging");
    });

    btn.addEventListener("dragend", () => {
      btn.classList.remove("dragging");
    });
  } else {
    btn.draggable = false;
  }

  return btn;
}

function getCycleDates(statementDay, dueDay) {
  const today = new Date();
  const y = today.getFullYear();
  const m = today.getMonth();

  const thisStatement = new Date(y, m, statementDay);

  // If today is before this month's statement day,
  // we are still in the previous cycle.
  const baseMonth = today >= thisStatement ? m : m - 1;

  const cycleStart = new Date(y, baseMonth, statementDay);
  const cycleEnd = new Date(y, baseMonth + 1, statementDay);

  // Due date must fall between cycleStart and cycleEnd
  let dueDate;
  if (dueDay >= statementDay) {
    // later in the same cycle month
    dueDate = new Date(y, baseMonth, dueDay);
  } else {
    // early in the next month of the same cycle
    dueDate = new Date(y, baseMonth + 1, dueDay);
  }

  return { cycleStart, cycleEnd, dueDate };
}

function getPaidKey(cycleStart) {
  return `${cycleStart.toISOString().slice(0, 10)}`;
}

function isCyclePaid(account, cycleStart) {
  const key = getPaidKey(cycleStart);
  return account.paidStatus?.[key] === true;
}

function setCyclePaid(account, cycleStart, paid) {
  const key = getPaidKey(cycleStart);
  if (!account.paidStatus) account.paidStatus = {};
  account.paidStatus[key] = paid;

  // --- Limit to 12 entries ---
  const keys = Object.keys(account.paidStatus);

  if (keys.length > 12) {
    // Sort keys by date (oldest first)
    keys.sort((a, b) => new Date(a) - new Date(b));

    // Remove oldest entries until only 12 remain
    const excess = keys.length - 12;
    for (let i = 0; i < excess; i++) {
      delete account.paidStatus[keys[i]];
    }
  }
}

function renderAccountDetailContent(repoId, accountType, account, tabKey = "all") {
  const t = translations[currentLang];

  const content = document.getElementById("account-detail-content");
  content.innerHTML = "";

  const wrapper = document.createElement("div");
  wrapper.className = "account-detail-summary";

  
  // Placeholder values — you will compute real ones later
  const totalSum = "--";
  const inflow = "--";
  const outflow = "--";

  // --- COMMON SUMMARY (all accounts) ---
  wrapper.innerHTML = `
    <div class="summary-row">
      <div class="summary-item">
        <div class="summary-label">总额</div>
        <div class="summary-value">${totalSum}</div>
      </div>
      <div class="summary-item">
        <div class="summary-label">流入</div>
        <div class="summary-value summary-inflow">${inflow}</div>
      </div>
      <div class="summary-item">
        <div class="summary-label">流出</div>
        <div class="summary-value summary-outflow">${outflow}</div>
      </div>
    </div>
  `;

  // --- CREDIT CARD SPECIAL SECTION ---
  if (accountType === "creditCards") {
    const today = new Date();

    const statementDay = account.statementDate;
    const dueDay = account.dueDate;

    // Only calculate if both dates exist
    const canCalculate = statementDay && dueDay;

    let cycleStart, cycleEnd, dueDate;
    let currentMonth, nextMonth;
    let paid = false;

    // --- DEFAULT VALUES (used when dates missing) ---
    let statementProgress = 0;
    let statementText = "-";

    let dueProgress = 0;
    let dueText = "-";
    let isOverdue = false;
    let redness = 0;

    if (canCalculate) {
      // --- REAL CALCULATIONS ---
      ({ cycleStart, cycleEnd, dueDate } = getCycleDates(statementDay, dueDay));

      const currentMonthIndex = cycleStart.getMonth();
      const nextMonthIndex = cycleEnd.getMonth();

      if (currentLang === "en") {
        currentMonth = monthNamesEN[currentMonthIndex];
        nextMonth = monthNamesEN[nextMonthIndex];
      } else {
        currentMonth = currentMonthIndex + 1;
        nextMonth = nextMonthIndex + 1;
      }

      paid = isCyclePaid(account, cycleStart);

      // --- STATEMENT PROGRESS ---
      const total = (cycleEnd - cycleStart) / 86400000;
      const passed = (today - cycleStart) / 86400000;
      statementProgress = Math.max(0, Math.min(passed / total, 1));

      const daysToCycleEnd = Math.ceil((cycleEnd - today) / 86400000);
      statementText = t.statementDistance(nextMonth, daysToCycleEnd);

      // --- DUE PROGRESS ---
      if (!paid) {
        if (today < dueDate) {
          const total = (dueDate - cycleStart) / 86400000;
          const passed = (today - cycleStart) / 86400000;
          dueProgress = Math.max(0, Math.min(passed / total, 1));

          const daysToDue = Math.ceil((dueDate - today) / 86400000);
          dueText = t.dueDistance(currentMonth, daysToDue);

          redness = Math.max(0, Math.min((15 - daysToDue) / 15, 1));
        } else {
          isOverdue = today > dueDate;

          const daysPastDue = Math.ceil((today - dueDate) / 86400000);
          dueProgress = 1;
          dueText = t.overdue(currentMonth, daysPastDue);
          redness = 1;
        }
      } else {
        dueProgress = 0;
        dueText = t.paid(currentMonth);
        redness = 0;
      }
    }

    // --- CREDIT LIMIT (always shown) ---
    const creditLimit = account.creditLimit ?? null;
    const formattedCreditLimit = creditLimit != null
      ? getFormattedAmount(creditLimit)
      : "-";

    const used = 0; // compute later
    const available = creditLimit != null ? creditLimit - used : "-";
    const usagePercent = paid ? 0 : (creditLimit ? used / creditLimit : 0);

    // --- RENDER SECTION (always rendered) ---
    const ccSection = document.createElement("div");
    ccSection.className = "cc-rows";

    ccSection.innerHTML = `
      <!-- Row 1: Statement Date -->
      <div class="cc-row">
        <div class="cc-left">
          <span class="cc-label">${t.statementLabel}</span>
          <span class="cc-value">${statementDay ?? "-"}</span>
        </div>

        <div class="cc-right">
          <div class="cc-right-text">${statementText}</div>
          <div class="cc-progress-bar">
            <div class="cc-progress-fill"
              style="width: ${statementProgress * 100}%; --redness: 0"></div>
          </div>
        </div>
      </div>

      <!-- Row 2: Due Date -->
      <div class="cc-row">
        <div class="cc-left">
          <span class="cc-label">${t.dueLabel}</span>
          <span class="cc-value">${dueDay ?? "-"}</span>
        </div>

        <div class="cc-right">
          <div class="cc-right-text ${dueText.includes("逾期") || dueText.includes("overdue") ? "cc-text-overdue" : ""}">
            ${dueText}
          </div>
          <div class="cc-progress-bar">
            <div class="cc-progress-fill ${isOverdue ? "overdue" : ""}"
              style="width: ${dueProgress * 100}%; --redness: ${redness}"></div>
          </div>
        </div>
      </div>

      <!-- Row 3: Credit Limit -->
      <div class="cc-row">
        <div class="cc-left">
          <span class="cc-label">${t.creditLimitLabel}</span>
          <span class="cc-value">${formattedCreditLimit ?? "-"}</span>
        </div>

        <div class="cc-right">
          <div class="cc-right-text">
            ${t.available(getFormattedAmount(available))}
          </div>
          <div class="cc-progress-bar">
            <div class="cc-progress-fill"
              style="width: ${usagePercent * 100}%; --redness: 0"></div>
          </div>
        </div>
      </div>

      ${canCalculate ? `
        <label class="cc-paid">
          <input type="checkbox" id="cc-paid-checkbox" ${paid ? "checked" : ""}>
          ${t.paidCheckbox}
        </label>
      ` : ""}
    `;

    wrapper.appendChild(ccSection);
    content.appendChild(wrapper);
  
    // Checkbox handler (only if dates exist)
    if (canCalculate) {
      const checkbox = document.getElementById("cc-paid-checkbox");
      checkbox.onchange = async () => {
        setCyclePaid(account, cycleStart, checkbox.checked);

        settingsMap[repoId].updatedAt = Date.now();
        await saveLocalJsonData("ledger-settings.json", settingsMap);
        await smartSync(selectedRepos, token, { push: true, syncLedgerData: true, repoId: repoId });

        renderAccountDetailContent(repoId, accountType, account);
      };
    }
  }

}

function getDragAfterElement(container, x) {
  const els = [...container.querySelectorAll(".account-tab-btn:not(.dragging)")];

  return els.reduce((closest, child) => {
    const box = child.getBoundingClientRect();
    const offset = x - (box.left + box.width / 2);
    if (offset < 0 && offset > closest.offset) {
      return { offset, element: child };
    } else {
      return closest;
    }
  }, { offset: Number.NEGATIVE_INFINITY }).element;
}

function renderAccountEditPage(repoId, accountType, account) {
  account._pendingSubOrder = null; // this temporary variable will store drag order
  
  const container = document.getElementById("account-edit-content");
  container.innerHTML = "";

  const wrapper = document.createElement("div");
  wrapper.className = "account-edit-wrapper";

  // ───────────────────────────────────────────────
  // TAB BUTTONS
  // ───────────────────────────────────────────────
  const tabRow = document.createElement("div");
  tabRow.className = "account-detail-tabs";
  tabRow.id = "account-edit-tabs";
  wrapper.appendChild(tabRow);
  container.appendChild(wrapper);

  renderAccountTabs(account, "account-edit-tabs", {
    mode: "edit",
    onTabClick: (key) => activateTab(key)
  });

  tabRow.addEventListener("dragover", (e) => {
    e.preventDefault();
    const dragging = tabRow.querySelector(".dragging");
    if (!dragging) return;

    const after = getDragAfterElement(tabRow, e.clientX);

    // Prevent dragging before MAIN
    const first = tabRow.querySelector('[data-tab="main"]');

    if (after === first) {
      tabRow.insertBefore(dragging, first.nextSibling);
    } else if (after == null) {
      tabRow.appendChild(dragging);
    } else {
      tabRow.insertBefore(dragging, after);
    }
  });

  tabRow.addEventListener("dragend", () => {
    const newOrder = [...tabRow.querySelectorAll(".account-tab-btn")]
      .map(btn => btn.dataset.tab)
      .filter(key => key !== "main"); // ignore main

    // ["sub-2", "sub-0", "sub-1"] → [2, 0, 1]
    const orderIndexes = newOrder.map(key => Number(key.replace("sub-", "")));

    account._pendingSubOrder = orderIndexes;
  });

  // ───────────────────────────────────────────────
  // MAIN ACCOUNT PANEL
  // ───────────────────────────────────────────────
  const mainPanel = document.createElement("div");
  mainPanel.className = "edit-panel";
  mainPanel.dataset.tab = "main";

  // ROW 1 — NAME
  const row1 = document.createElement("div");
  row1.classList.add("account-inline-row");

  const nameLabel = document.createElement("label");
  nameLabel.textContent = "账户名";
  row1.appendChild(nameLabel);

  const nameInput = document.createElement("input");
  nameInput.type = "text";
  nameInput.name = "name";
  nameInput.value = account.name || "";
  row1.appendChild(nameInput);

  mainPanel.appendChild(row1);

  // ROW 2 — ICON + CURRENCY
  const row2 = document.createElement("div");
  row2.classList.add("account-inline-row");

  const iconLabel = document.createElement("label");
  iconLabel.textContent = "图标";
  row2.appendChild(iconLabel);

  const iconBtn = document.createElement("button");
  iconBtn.classList.add("icon");
  iconBtn.innerHTML = account.icon || "Icon";
  row2.appendChild(iconBtn);

  const hiddenIcon = document.createElement("input");
  hiddenIcon.type = "hidden";
  hiddenIcon.name = "icon";
  hiddenIcon.value = account.icon || "";
  row2.appendChild(hiddenIcon);

  iconBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    const picker = showIconPicker(iconBtn, hiddenIcon);
    row2.insertAdjacentElement("afterend", picker);
  });

  const currencyLabel = document.createElement("label");
  currencyLabel.textContent = "币种";
  row2.appendChild(currencyLabel);

  const currencySelect = document.createElement("select");
  currencySelect.name = "currency";

  supportedCurrencies.forEach(cur => {
    const opt = document.createElement("option");
    opt.value = cur;
    opt.textContent = cur;
    if (cur === account.currency) opt.selected = true;
    currencySelect.appendChild(opt);
  });

  row2.appendChild(currencySelect);
  mainPanel.appendChild(row2);

  // ROW 3 — CREDIT CARD FIELDS
  if (accountType === "creditCards") {
    const row3 = document.createElement("div");
    row3.classList.add("account-inline-row");

    const label1 = document.createElement("label");
    label1.textContent = "账单日";
    row3.appendChild(label1);

    const statement = document.createElement("select");
    statement.name = "statementDate";

    for (let d = 1; d <= 31; d++) {
      const opt = document.createElement("option");
      opt.value = d;
      opt.textContent = d;
      if (Number(account.statementDate) === d) opt.selected = true;
      statement.appendChild(opt);
    }

    row3.appendChild(statement);

    const label2 = document.createElement("label");
    label2.textContent = "还款日";
    row3.appendChild(label2);

    const due = document.createElement("select");
    due.name = "dueDate";

    for (let d = 1; d <= 31; d++) {
      const opt = document.createElement("option");
      opt.value = d;
      opt.textContent = d;
      if (Number(account.dueDate) === d) opt.selected = true;
      due.appendChild(opt);
    }

    row3.appendChild(due);
    mainPanel.appendChild(row3);

    // ROW 4 — CREDIT LIMIT
    const row4 = document.createElement("div");
    row4.classList.add("account-inline-row");

    const label3 = document.createElement("label");
    label3.textContent = "信用额度";
    row4.appendChild(label3);

    const limit = document.createElement("input");
    limit.type = "text";
    limit.name = "creditLimit";
    limit.inputMode = "decimal";

    if (account.creditLimit != null) {
      limit.value = getFormattedAmount(account.creditLimit);
    } else {
      limit.value = "";
    }

    let rawValue = account.creditLimit ?? null;

    limit.addEventListener("input", () => {
      const cleaned = limit.value.replace(/[^\d.]/g, "");
      const parts = cleaned.split(".");
      if (parts.length > 2) {
        limit.value = parts[0] + "." + parts.slice(1).join("");
        return;
      }
      rawValue = cleaned === "" ? null : Number(cleaned);
    });

    limit.addEventListener("blur", () => {
      if (rawValue != null && !isNaN(rawValue)) {
        limit.value = getFormattedAmount(rawValue);
      } else {
        limit.value = "";
      }
    });

    row4.appendChild(limit);
    mainPanel.appendChild(row4);
  }

  // STORED VALUE CARD FIELDS
  if (accountType === "storedValueCards") {
    const row3 = document.createElement("div");
    row3.classList.add("account-inline-row");

    const label1 = document.createElement("label");
    label1.textContent = "卡号";
    row3.appendChild(label1);

    const cardNum = document.createElement("input");
    cardNum.type = "text";
    cardNum.name = "cardNumber";
    cardNum.value = account.cardNumber ?? "";
    row3.appendChild(cardNum);

    const label2 = document.createElement("label");
    label2.textContent = "密码";
    row3.appendChild(label2);

    const pin = document.createElement("input");
    pin.type = "text";
    pin.name = "pin";
    pin.value = account.pin ?? "";
    row3.appendChild(pin);

    mainPanel.appendChild(row3);
  }

  // EXCLUDE
  const rowExclude = document.createElement("div");
  rowExclude.classList.add("account-inline-row");

  const excludeLabel = document.createElement("label");
  excludeLabel.classList.add("checkbox-inline");

  const excludeInput = document.createElement("input");
  excludeInput.type = "checkbox";
  excludeInput.name = "exclude";
  excludeInput.checked = !!account.exclude;

  excludeLabel.appendChild(excludeInput);
  excludeLabel.append(" 不计入资产");

  rowExclude.appendChild(excludeLabel);
  mainPanel.appendChild(rowExclude);

  // NOTES
  mainPanel.appendChild(createTextareaRow("备注", "notes", account.notes));

  wrapper.appendChild(mainPanel);

  // ───────────────────────────────────────────────
  // SUB‑ACCOUNT PANELS
  // ───────────────────────────────────────────────
  const subs = account["sub-accounts"] ?? [];
  if (subs.length > 0) {
    subs.forEach((sub, index) => {
      const panel = document.createElement("div");
      panel.className = "edit-panel";
      panel.dataset.tab = `sub-${index}`;

      // NAME
      const srow1 = document.createElement("div");
      srow1.classList.add("account-inline-row");

      const slbl = document.createElement("label");
      slbl.textContent = "账户名";
      srow1.appendChild(slbl);

      const sNameInput = document.createElement("input");
      sNameInput.type = "text";
      sNameInput.name = `sub-${index}-name`;
      sNameInput.value = sub.name || "";
      srow1.appendChild(sNameInput);

      panel.appendChild(srow1);

      // ICON + CURRENCY
      const srow2 = document.createElement("div");
      srow2.classList.add("account-inline-row");

      const siconLabel = document.createElement("label");
      siconLabel.textContent = "图标";
      srow2.appendChild(siconLabel);

      const sIconBtn = document.createElement("button");
      sIconBtn.classList.add("icon");
      sIconBtn.innerHTML = sub.icon || "Icon";
      srow2.appendChild(sIconBtn);

      const sHiddenIcon = document.createElement("input");
      sHiddenIcon.type = "hidden";
      sHiddenIcon.name = `sub-${index}-icon`;
      sHiddenIcon.value = sub.icon || "";
      srow2.appendChild(sHiddenIcon);

      sIconBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        const picker = showIconPicker(sIconBtn, sHiddenIcon);
        srow2.insertAdjacentElement("afterend", picker);
      });

      const sCurrencyLabel = document.createElement("label");
      sCurrencyLabel.textContent = "币种";
      srow2.appendChild(sCurrencyLabel);

      const sCurrency = document.createElement("select");
      sCurrency.name = `sub-${index}-currency`;

      supportedCurrencies.forEach(cur => {
        const opt = document.createElement("option");
        opt.value = cur;
        opt.textContent = cur;
        if (cur === sub.currency) opt.selected = true;
        sCurrency.appendChild(opt);
      });

      srow2.appendChild(sCurrency);
      panel.appendChild(srow2);

      // EXCLUDE
      const srowExclude = document.createElement("div");
      srowExclude.classList.add("account-inline-row");

      const sExcludeLabel = document.createElement("label");
      sExcludeLabel.classList.add("checkbox-inline");

      const sExcludeInput = document.createElement("input");
      sExcludeInput.type = "checkbox";
      sExcludeInput.name = `sub-${index}-exclude`;
      sExcludeInput.checked = !!sub.exclude;

      sExcludeLabel.appendChild(sExcludeInput);
      sExcludeLabel.append(" 不计入资产");

      srowExclude.appendChild(sExcludeLabel);
      panel.appendChild(srowExclude);

      // NOTES
      panel.appendChild(createTextareaRow("备注", `sub-${index}-notes`, sub.notes));

      wrapper.appendChild(panel);
    });
  }

  // ───────────────────────────────────────────────
  // AUTOCOMPLETE SUPPRESSION
  // ───────────────────────────────────────────────
  wrapper.querySelectorAll("input, select, textarea").forEach(el => {
    el.autocomplete = "off";
    el.autocorrect = "off";
    el.autocapitalize = "off";
    el.spellcheck = false;
    el.setAttribute("autocomplete", "new-password");
  });

  // ───────────────────────────────────────────────
  // TAB SWITCHING
  // ───────────────────────────────────────────────
  function activateTab(key) {
    wrapper.querySelectorAll(".edit-panel").forEach(p => {
      p.style.display = (p.dataset.tab === key) ? "block" : "none";
    });

    wrapper.querySelectorAll(".account-tab-btn").forEach(btn => {
      btn.classList.toggle("active", btn.dataset.tab === key);
    });
  }

  activateTab("main");

  wrapper.querySelectorAll(".account-tab-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      activateTab(btn.dataset.tab);
    });
  });
}

function createSectionHeader(text) {
  const h = document.createElement("div");
  h.className = "edit-section-header";
  h.textContent = text;
  return h;
}

function createTextareaRow(label, key, value) {
  const row = document.createElement("div");
  row.className = "form-row";
  row.innerHTML = `
    <label>${label}</label>
    <textarea data-key="${key}">${value ?? ""}</textarea>
  `;
  return row;
}

async function saveAccountEdits(repoId, accountType, account) {
  const container = document.getElementById("account-edit-content");

  // MAIN FIELDS
  account.name = container.querySelector('input[name="name"]').value.trim();
  account.icon = container.querySelector('input[name="icon"]').value.trim();
  account.currency = container.querySelector('select[name="currency"]').value.trim();
  account.exclude = container.querySelector('input[name="exclude"]').checked;
  account.notes = container.querySelector('textarea[data-key="notes"]').value.trim();

  // CREDIT CARD FIELDS
  if (accountType === "creditCards") {
    const sd = container.querySelector('select[name="statementDate"]').value.trim();
    const dd = container.querySelector('select[name="dueDate"]').value.trim();
    const cl = container.querySelector('input[name="creditLimit"]').value.trim();
    const cleaned = cl.replace(/,/g, "");

    account.statementDate = sd ? parseInt(sd) : null;
    account.dueDate = dd ? parseInt(dd) : null;
    account.creditLimit = cleaned ? parseFloat(cleaned) : null;

    // Normalize invalid values
    if (account.statementDate < 1 || account.statementDate > 31) account.statementDate = null;
    if (account.dueDate < 1 || account.dueDate > 31) account.dueDate = null;
    if (isNaN(account.creditLimit)) account.creditLimit = null;
  }

  // STORED VALUE CARD FIELDS
  if (accountType === "storedValueCards") {
    account.cardNumber = container.querySelector('input[name="cardNumber"]').value.trim();
    account.pin = container.querySelector('input[name="pin"]').value.trim();
  }

  // SUB-ACCOUNTS
  const subs = account["sub-accounts"] ?? [];
  subs.forEach((sub, index) => {
    sub.name = container.querySelector(`input[name="sub-${index}-name"]`).value.trim();
    sub.icon = container.querySelector(`input[name="sub-${index}-icon"]`).value.trim();
    sub.currency = container.querySelector(`select[name="sub-${index}-currency"]`).value.trim();
    sub.exclude = container.querySelector(`input[name="sub-${index}-exclude"]`).checked;
    sub.notes = container.querySelector(`textarea[data-key="sub-${index}-notes"]`).value.trim();
  });

  if (account._pendingSubOrder) {
    const newSubs = [];
    account._pendingSubOrder.forEach(i => {
      newSubs.push(account["sub-accounts"][i]);
    });
    account["sub-accounts"] = newSubs;
    delete account._pendingSubOrder;
  }

  // UPDATE TIMESTAMP
  settingsMap[repoId].updatedAt = Date.now();

  // SAVE + SYNC
  await saveLocalJsonData("ledger-settings.json", settingsMap);
  await smartSync(selectedRepos, token, {
    push: true,
    syncLedgerData: true,
    repoId
  });

  goBack();
}

function renderAccountAddPage({ activeRepoId, mode, accountType, account }) {
  const container = document.getElementById("account-add-content");

  const isSub = mode === "sub";

  container.innerHTML = `
    <div class="account-add">

      ${isSub ? `
        <div class="field-label">${currentLang === "en" ? "Parent Account" : "父账户"}</div>
        <div class="field-value">${account.name}</div>
      ` : ""}

      ${!isSub ? `
        <label class="field-label">${currentLang === "en" ? "Account Type" : "账户类型"}</label>
        <select id="add-account-type" class="field-input">
          <option value="">Select…</option>
          <option value="bank">Bank</option>
          <option value="cash">Cash</option>
          <option value="creditCards">Credit Card</option>
          <option value="storedValueCards">Stored Value Card</option>
          <option value="investment">Investment</option>
        </select>
      ` : ""}

      <div id="add-account-fields"></div>
    </div>
  `;

  const typeSelect = document.getElementById("add-account-type");

  // For main accounts: wait for user to pick type
  // For sub-accounts: immediately render fields
  if (isSub) {
    renderAccountAddFields(accountType, true);
  } else {
    typeSelect.onchange = () => {
      renderAccountAddFields(typeSelect.value, false);
    };
  }
}

function renderAccountAddFields(type, isSub) {
  const container = document.getElementById("add-account-fields");

  if (!type) {
    container.innerHTML = "";
    return;
  }

  let html = `
    <label class="field-label">${currentLang === "en" ? "Name" : "名称"}</label>
    <input id="acc-name" class="field-input">

    <label class="field-label">${currentLang === "en" ? "Icon" : "图标"}</label>
    <input id="acc-icon" class="field-input">

    <label class="field-label">${currentLang === "en" ? "Currency" : "货币"}</label>
    <input id="acc-currency" class="field-input">

    <label class="field-label">${currentLang === "en" ? "Notes" : "备注"}</label>
    <textarea id="acc-notes" class="field-input"></textarea>
  `;

  if (type === "creditCards" && !isSub) {
    html += `
      <label class="field-label">${currentLang === "en" ? "Statement Date" : "账单日"}</label>
      <input id="acc-statement" type="number" class="field-input">

      <label class="field-label">${currentLang === "en" ? "Due Date" : "还款日"}</label>
      <input id="acc-due" type="number" class="field-input">

      ${!isSub ? `
      <label class="field-label">${currentLang === "en" ? "Credit Limit" : "信用额度"}</label>
      <input id="acc-limit" type="number" class="field-input">
      ` : ""}
    `;
  }

  if (type === "storedValueCards") {
    html += `
      <label class="field-label">${currentLang === "en" ? "Card Number" : "卡号"}</label>
      <input id="acc-cardnum" class="field-input">

      <label class="field-label">${currentLang === "en" ? "PIN" : "密码"}</label>
      <input id="acc-pin" class="field-input">
    `;
  }

  html += `
    <label class="field-label">${currentLang === "en" ? "Exclude from totals" : "不计入资产"}</label>
    <input id="acc-exclude" type="checkbox" class="field-checkbox">
  `;

  container.innerHTML = html;
}

async function saveAccountAdd({ activeRepoId, mode, accountType, account }) {

  // -----------------------------
  // 1. Read common fields
  // -----------------------------
  const name = document.getElementById("acc-name")?.value.trim();
  const icon = document.getElementById("acc-icon")?.value.trim();
  const currency = document.getElementById("acc-currency")?.value.trim();
  const notes = document.getElementById("acc-notes")?.value.trim();
  const exclude = document.getElementById("acc-exclude")?.checked || false;

  if (!name) {
    alert(currentLang === "en" ? "Name is required" : "名称不能为空");
    return;
  }

  // Base object for both main + sub
  const base = { name, icon, currency, notes, exclude };

  // -----------------------------
  // 2. Determine account type
  // -----------------------------
  const type = mode === "main"
    ? document.getElementById("add-account-type").value
    : accountType;

  if (!type) {
    alert(currentLang === "en" ? "Select an account type" : "请选择账户类型");
    return;
  }

  // -----------------------------
  // 3. Type-specific fields
  // -----------------------------
  if (type === "creditCards") {
    base.statementDate = parseInt(document.getElementById("acc-statement")?.value) || null;
    base.dueDate = parseInt(document.getElementById("acc-due")?.value) || null;

    if (mode === "main") {
      base.creditLimit = parseFloat(document.getElementById("acc-limit")?.value) || null;
    }
  }

  if (type === "storedValueCards") {
    base.cardNumber = document.getElementById("acc-cardnum")?.value.trim() || "";
    base.pin = document.getElementById("acc-pin")?.value.trim() || "";
  }

  // -----------------------------
  // 4. Save MAIN account
  // -----------------------------
  if (mode === "main") {
    base.exclude = false;
    base["sub-accounts"] = [];

    settingsMap[activeRepoId].accounts[type].push(base);
  }

  // -----------------------------
  // 5. Save SUB account
  // -----------------------------
  if (mode === "sub") {
    account["sub-accounts"].push(base);
  }

  // -----------------------------
  // 6. Persist + Sync
  // -----------------------------
  settingsMap[activeRepoId].updatedAt = Date.now();
  await saveLocalJsonData("ledger-settings.json", settingsMap);
  await smartSync(selectedRepos, token, { push: true, syncLedgerData: true, repoId: activeRepoId });

  goBack;
}

async function loadLabels(activeRepoId, task, type, title) {
  const t = translations[currentLang];

  const deleteBtn = document.getElementById("delete-btn-headerbar");
  deleteBtn.style.color = "var(--muted)";
  deleteBtn.style.pointerEvents = "none";

  const container = document.getElementById(task + "-labels-container");
  container.innerHTML = "";

  // Repo data
  const repoSettings = settingsMap[activeRepoId];
  const repoInfo = selectedRepos.ledgerRepos.find(r => r.id === activeRepoId);

  const block = document.createElement("div");
  block.classList.add("repo-block");

  let primaryCategories = repoSettings[type];

  if (!primaryCategories || primaryCategories.length === 0) {
    const emptyMsg = document.createElement("button");
    emptyMsg.classList.add("primary-category");
    emptyMsg.textContent = t.noPrimaryCategories;
    emptyMsg.style.background = "none";
    block.appendChild(emptyMsg);

  } else {
    if (task === "order-labels") {
      const notes = document.createElement("div");
      notes.style.color = "var(--muted)";
      notes.style.fontStyle = "italic";
      notes.innerHTML = t.reorderInstructions;
      block.appendChild(notes);

      const checkedCountText = document.createElement("div");
      checkedCountText.style.color = "var(--muted)";
      checkedCountText.style.fontStyle = "italic";
      block.appendChild(checkedCountText);
      block.checkedCountText = checkedCountText;
    }

    if (["expense-categories", "income-categories"].includes(type)) {

      if (task !== "order-labels") {
        const [addRow, addWrapper] = createAddCategoryRow(
          t.createPrimaryCategory,
          `<span class="icon-content">➕</span>`,
          block,
          block,
          activeRepoId,
          task,
          type,
          title,
          false,
          true
        );
        block.appendChild(addWrapper);
      }

      for (const category of repoSettings[type]) {
        const [row, primaryWrapper] = createCategoryRow(
          category.primary,
          category.icon,
          block,
          block,
          activeRepoId,
          task,
          type,
          title,
          false,
          true
        );

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
            createCategoryRow(
              secondaryCategory.name,
              secondaryCategory.icon,
              primaryWrapper,
              block,
              activeRepoId,
              task,
              type,
              title,
              true,
              true,
              category.primary
            );
          }
        }

        if (task !== "order-labels") {
          const [secAddRow, secAddWrapper] = createAddCategoryRow(
            t.createSecondaryCategory,
            `<span class="icon-content">➕</span>`,
            primaryWrapper,
            block,
            activeRepoId,
            task,
            type,
            title,
            true,
            true,
            category.primary
          );
          primaryWrapper.appendChild(secAddWrapper);
        }
      }

      if (task !== "order-labels") {
        const [addRow, addWrapper] = createAddCategoryRow(
          t.createPrimaryCategory,
          `<span class="icon-content">➕</span>`,
          block,
          block,
          activeRepoId,
          task,
          type,
          title,
          false,
          true
        );
        block.appendChild(addWrapper);
      }

    } else {
      // Labels (not categories)
      if (task !== "order-labels") {
        const [addRow, addWrapper] = createAddCategoryRow(
          t.createLabel,
          `<span class="icon-content">➕</span>`,
          block,
          block,
          activeRepoId,
          task,
          type,
          title,
          false,
          false
        );
        block.appendChild(addWrapper);
      }

      for (const label of repoSettings[type]) {
        createCategoryRow(
          label.name,
          label.icon,
          block,
          block,
          activeRepoId,
          task,
          type,
          title,
          false,
          false
        );
      }

      if (task !== "order-labels") {
        const [addRow, addWrapper] = createAddCategoryRow(
          t.createLabel,
          `<span class="icon-content">➕</span>`,
          block,
          block,
          activeRepoId,
          task,
          type,
          title,
          false,
          false
        );
        block.appendChild(addWrapper);
      }
    }
  }

  container.appendChild(block);
}

function createAddCategoryRow(name, icon, parentWrapper, block, repoId, task, type, title, isSecondary, hasSecondary, parentName = null) {
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
    const inputRow = createCategoryInputRow(repoId, task, type, title, hasSecondary, {
      label: "",
      icon: "",
      isSecondary,
      parentName
    });

    rowContent.after(inputRow);
  });

  return [rowContent, categoryWrapper];
}

function createCategoryInputRow(activeRepoId, task, type, title, hasSecondary, options = {}) {
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

    const wrapper = showIconPicker(iconBtn);

    inputRow.insertAdjacentElement("afterend", wrapper);
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
    loadLabels(activeRepoId, task, type, title);
  })

  tickBtn.addEventListener("click", async () => {
    const icon = iconBtn.innerHTML !== "Icon" ? iconBtn.innerHTML : `<span class="icon-content">🏷️</span>`;
    const name = nameInput.value.trim();

    if (!name) {
      showStatusMessage(
        currentLang === "en"
          ? "The input name must not be empty."
          : "输入的名称不能为空。",
        "error"
      );
      return;
    }

    const categories = settingsMap[activeRepoId][type];

    // ============================================================
    // WITH SECONDARIES (expense/income)
    // ============================================================
    if (hasSecondary) {
      const primaryNames = categories.map(c => c.primary);
      const secondaryNames = categories.flatMap(c => c.secondaries.map(s => s.name));
      const allNames = [...primaryNames, ...secondaryNames];

      const valid = name === options.label || !allNames.includes(name);
      if (!valid) {
        showStatusMessage(
          currentLang === "en"
            ? "The input name must not match any existing categories."
            : "输入的名称不能与现有项目重复。",
          "error"
        );
        return;
      }

      // ------------------------------------------------------------
      // EDIT PRIMARY
      // ------------------------------------------------------------
      if (options.label && !options.isSecondary) {
        const updated = categories.map(cat =>
          cat.primary === options.label
            ? { ...cat, primary: name, icon }
            : cat
        );

        settingsMap[activeRepoId][type] = updated;
      }

      // ------------------------------------------------------------
      // EDIT SECONDARY
      // ------------------------------------------------------------
      else if (options.label && options.isSecondary) {
        const updated = categories.map(cat => {
          if (cat.primary !== options.parentName) return cat;

          return {
            ...cat,
            secondaries: cat.secondaries.map(sec =>
              sec.name === options.label
                ? { ...sec, name, icon }
                : sec
            )
          };
        });

        settingsMap[activeRepoId][type] = updated;
      }

      // ------------------------------------------------------------
      // ADD PRIMARY
      // ------------------------------------------------------------
      else if (!options.isSecondary) {
        const newPrimary = { primary: name, icon, secondaries: [] };
        settingsMap[activeRepoId][type] = [...categories, newPrimary];
      }

      // ------------------------------------------------------------
      // ADD SECONDARY
      // ------------------------------------------------------------
      else {
        const updated = categories.map(cat =>
          cat.primary === options.parentName
            ? { ...cat, secondaries: [...cat.secondaries, { name, icon }] }
            : cat
        );

        settingsMap[activeRepoId][type] = updated;
      }
    }

    // ============================================================
    // FLAT STRUCTURE (collections, subjects)
    // ============================================================
    else {
      const valid = name === options.label || !categories.some(item => item.name === name);
      if (!valid) {
        showStatusMessage(
          currentLang === "en"
            ? "The input name must not match any existing items."
            : "输入的名称不能与现有条目重复。",
          "error"
        );
        return;
      }

      let updated;

      // EDIT
      if (options.label) {
        updated = categories.map(item =>
          item.name === options.label
            ? { ...item, name, icon }
            : item
        );
      }

      // ADD
      else {
        updated = [...categories, { name, icon }];
      }

      settingsMap[activeRepoId][type] = updated;
    }

    settingsMap[activeRepoId].updatedAt = Date.now();
    await saveLocalJsonData("ledger-settings.json", settingsMap);
    await smartSync(selectedRepos, token, { push: true, syncLedgerData: true, repoId: activeRepoId });
    loadLabels(activeRepoId, task, type, title);
  });

  inputRow.appendChild(iconBtn);
  inputRow.appendChild(nameInput);
  inputRow.appendChild(tickBtn);
  inputRow.appendChild(cancelBtn);

  return inputRow;
}

function showIconPicker(iconBtn) {
  const t = translations[currentLang];

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

  const emojiPicker = document.createElement("emoji-picker");
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

  requestAnimationFrame(() => wrapper.classList.add("show"));

  // --- OUTSIDE CLICK ---
  const outsideClickHandler = (ev) => {
    if (!wrapper.contains(ev.target) && ev.target !== iconBtn) {
      hideWrapper(wrapper);
      document.removeEventListener("click", outsideClickHandler);
    }
  };
  document.addEventListener("click", outsideClickHandler);

  return wrapper
}

function hideWrapper(wrapper) {
  wrapper.classList.remove("show"); // start fade out
  wrapper.addEventListener("transitionend", () => wrapper.remove(), { once: true });
}

function handleDeleteClick(block, activeRepoId, task, type, title, hasSecondary) {
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
        onClick: () => { }
      },
      {
        text: currentLang === "en" ? "Delete" : "删除",
        onClick: async () => {
          const primaryToDelete = [...block.querySelectorAll('.order-checkbox[data-type="primary"]:checked')]
            .map(cb => cb.dataset.name);

          const secondaryToDelete = [...block.querySelectorAll('.order-checkbox[data-type="secondary"]:checked')]
            .map(cb => ({
              parent: cb.dataset.parent,
              name: cb.dataset.name
            }));

          const categories = settingsMap[activeRepoId][type];

          for (const pName of primaryToDelete) {
            let idx;
            if (type === "collections" || type === "subjects") {
              idx = categories.findIndex(p => p.name === pName);
            } else {
              idx = categories.findIndex(p => p.primary === pName);
            }
            if (idx !== -1) categories.splice(idx, 1);
          }

          for (const { parent, name } of secondaryToDelete) {
            const parentObj = categories.find(p => p.primary === parent);
            if (!parentObj) continue;

            const arr = parentObj.secondaries;
            const idx = arr.findIndex(s => s.name === name);
            if (idx !== -1) arr.splice(idx, 1);
          }

          settingsMap[activeRepoId][type] = categories;
          settingsMap[activeRepoId].updatedAt = Date.now();
          await saveLocalJsonData("ledger-settings.json", settingsMap);
          await smartSync(selectedRepos, token, { push: true, syncLedgerData: true, repoId: activeRepoId });

          loadLabels(activeRepoId, task, type, title);
        }
      }
    ]
  });
}

function createCategoryRow(name, icon, parentWrapper, block, activeRepoId, task, type, title, isSecondary, hasSecondary, parentName = null) {
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
    checkbox.dataset.name = name;
    checkbox.dataset.type = isSecondary ? "secondary" : "primary";
    if (isSecondary) {
      checkbox.dataset.parent = parentName;
    }

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
          currentLang === 'en'
            ? `${checkedCount} selected (${primaryChecked} primary, ${secondaryChecked} secondary)`
            : `已勾选 ${checkedCount} 项（一级 ${primaryChecked} 项，二级 ${secondaryChecked} 项）`;
      } else {
        block.checkedCountText.textContent =
          currentLang === 'en'
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
      deleteBtn._deleteListener = () => handleDeleteClick(block, activeRepoId, task, type, title, hasSecondary);

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
      try { handle.releasePointerCapture(e.pointerId); } catch { }

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

      const targetName = targetBtn.dataset.name;
      const targetType = targetBtn.dataset.type;
      const targetParent = targetBtn.dataset.parentName;

      // Compute before/after
      const rect = targetBtn.getBoundingClientRect();
      const position = e.clientY < rect.top + rect.height / 2 ? "before" : "after";

      // Enforce rules
      if (draggedType === "primary" && targetType === "secondary") return;
      if (draggedName === targetName) return;
      if (!targetName) return;

      // Perform reorder
      await reorderCategory({ activeRepoId, hasSecondary, draggedName, draggedType, draggedParent, targetName, targetType, targetParent, position, type });

      dragInfo = null;

      // Refresh UI
      loadLabels(activeRepoId, task, type, title);
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
      const inputRow = createCategoryInputRow(activeRepoId, task, type, title, hasSecondary, {
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

      const categories = settingsMap[activeRepoId][type];

      let updatedCategories;

      if (isSecondary) { // Remove secondary from its parent
        updatedCategories = categories.map(cat => {
          if (cat.primary === parentName) {
            return {
              ...cat,
              secondaries: cat.secondaries.filter(sec => sec.name !== name)
            };
          }
          return cat;
        });

      } else { // Remove entire primary category
        updatedCategories = categories.filter(cat => cat.primary !== name);
      }

      settingsMap[activeRepoId][type] = updatedCategories;
      settingsMap[activeRepoId].updatedAt = Date.now();
      await saveLocalJsonData("ledger-settings.json", settingsMap);
      await smartSync(selectedRepos, token, { push: true, syncLedgerData: true, repoId: activeRepoId });

      loadLabels(activeRepoId, task, type, title);
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

      const draggedName = e.dataTransfer.getData("drag-name");
      const draggedType = e.dataTransfer.getData("drag-type");   // "primary" | "secondary"
      const draggedParent = e.dataTransfer.getData("drag-parent"); // primary name for secondary

      const targetName = btn.dataset.name;
      const targetType = btn.dataset.type;                      // "primary" | "secondary"
      const targetParent = btn.dataset.parentName;                // primary name for secondary

      const rect = btn.getBoundingClientRect();
      const dropY = e.clientY;
      const midpoint = rect.top + rect.height / 2;
      const position = dropY < midpoint ? "before" : "after";

      // Enforce rules
      if (draggedType === "primary" && targetType === "secondary") return;
      if (draggedName === targetName) return;
      if (!targetName) return;

      reorderCategory({ activeRepoId, hasSecondary, draggedName, draggedType, draggedParent, targetName, targetType, targetParent, position, type })

      isDragging = false;
      btn.classList.remove("dragging");

      loadLabels(activeRepoId, task, type, title);
    });
  }

  return [rowContent, categoryWrapper];
}

async function reorderCategory({
  activeRepoId,
  hasSecondary,
  draggedName,
  draggedType,
  draggedParent,
  targetName,
  targetType,
  targetParent,
  position,
  type
}) {
  // Categories now come from settingsMap
  const categories = settingsMap[activeRepoId][type];

  if (!categories) return false;

  // ============================================================
  // PRIMARY + SECONDARY STRUCTURE
  // ============================================================
  if (hasSecondary) {

    // ------------------------------------------------------------
    // PRIMARY MOVE
    // ------------------------------------------------------------
    if (draggedType === "primary") {
      const oldIndex = categories.findIndex(p => p.primary === draggedName);
      if (oldIndex === -1) return false;

      const draggedObj = categories.splice(oldIndex, 1)[0];

      let newIndex = categories.findIndex(p => p.primary === targetName);
      if (newIndex === -1) return false;

      if (position === "after") newIndex++;

      categories.splice(newIndex, 0, draggedObj);

      settingsMap[activeRepoId][type] = categories;
      settingsMap[activeRepoId].updatedAt = Date.now();
      await saveLocalJsonData("ledger-settings.json", settingsMap);
      await smartSync(selectedRepos, token, { push: true, syncLedgerData: true, repoId: activeRepoId });
      return true;
    }

    // ------------------------------------------------------------
    // SECONDARY MOVE
    // ------------------------------------------------------------
    if (draggedType === "secondary") {
      const fromPrimary = categories.find(p => p.primary === draggedParent);
      if (!fromPrimary) return false;

      const fromArr = fromPrimary.secondaries;
      const oldIndex = fromArr.findIndex(s => s.name === draggedName);
      if (oldIndex === -1) return false;

      const draggedObj = fromArr.splice(oldIndex, 1)[0];

      // Dropped onto a primary → insert at beginning
      if (targetType === "primary") {
        const toPrimary = categories.find(p => p.primary === targetName);
        if (!toPrimary) return false;

        toPrimary.secondaries.splice(0, 0, draggedObj);

        settingsMap[activeRepoId][type] = categories;
        settingsMap[activeRepoId].updatedAt = Date.now();
        await saveLocalJsonData("ledger-settings.json", settingsMap);
        await smartSync(selectedRepos, token, { push: true, syncLedgerData: true, repoId: activeRepoId });
        return true;
      }

      // Dropped onto another secondary
      const toPrimary = categories.find(p => p.primary === targetParent);
      if (!toPrimary) return false;

      const toArr = toPrimary.secondaries;

      let newIndex = toArr.findIndex(s => s.name === targetName);
      if (newIndex === -1) return false;

      if (position === "after") newIndex++;

      toArr.splice(newIndex, 0, draggedObj);

      settingsMap[activeRepoId][type] = categories;
      settingsMap[activeRepoId].updatedAt = Date.now();
      await saveLocalJsonData("ledger-settings.json", settingsMap);
      await smartSync(selectedRepos, token, { push: true, syncLedgerData: true, repoId: activeRepoId });
      return true;
    }
  }

  // ============================================================
  // FLAT LIST (no secondary structure)
  // ============================================================
  const oldIndex = categories.findIndex(item => item.name === draggedName);
  if (oldIndex === -1) return false;

  const draggedObj = categories.splice(oldIndex, 1)[0];

  let newIndex = categories.findIndex(item => item.name === targetName);
  if (newIndex === -1) return false;

  if (position === "after") newIndex++;

  categories.splice(newIndex, 0, draggedObj);

  settingsMap[activeRepoId][type] = categories;
  settingsMap[activeRepoId].updatedAt = Date.now();
  await saveLocalJsonData("ledger-settings.json", settingsMap);
  await smartSync(selectedRepos, token, { push: true, syncLedgerData: true, repoId: activeRepoId });
  return true;
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

  let startX = 0, startY = 0;
  let dx = 0, dy = 0;
  let isDragging = false;
  let direction = null; // "horizontal" | "vertical"

  const EDGE_ZONE = 20;
  const LOCK_THRESHOLD = 12;   // px before locking direction
  const MAX_VERTICAL = 100;    // max vertical movement allowed for back swipe

  const onStart = e => {
    const t = e.touches[0];
    const x = t.clientX;
    const y = t.clientY;

    if (x < EDGE_ZONE) {
      isDragging = false;
      return;
    }

    if (e.target.closest("input, textarea, [contenteditable]")) return;

    e.stopPropagation();
    startX = x;
    startY = y;
    dx = dy = 0;
    direction = null;
    isDragging = true;
    pageEl.style.transition = "none";
  };

  const onMove = e => {
    if (!isDragging) return;

    const t = e.touches[0];
    dx = t.clientX - startX;
    dy = Math.abs(t.clientY - startY);

    // Not enough movement yet → don't decide
    if (!direction && dx < LOCK_THRESHOLD && dy < LOCK_THRESHOLD) {
      return;
    }

    // Decide direction once
    if (!direction) {
      direction = Math.abs(dx) > Math.abs(dy) ? "horizontal" : "vertical";
    }

    // Vertical → cancel swipe, allow scroll
    if (direction === "vertical") {
      isDragging = false;
      return;
    }

    // Horizontal swipe
    if (dx > 0) {
      pageEl.style.transform = `translateX(${dx}px)`;
    }
  };

  const onEnd = () => {
    if (!isDragging) return;
    isDragging = false;

    const threshold = window.innerWidth * 2 / 5;
    pageEl.style.transition = "transform 0.3s ease";

    if (dx > threshold && dy < MAX_VERTICAL) {
      pageEl.style.transform = "translateX(110%)";
      setTimeout(() => history.back(), 300);
    } else {
      pageEl.style.transform = "translateX(0)";
    }
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
async function setLanguage(lang, sync = true) {
  currentLang = lang;
  const t = translations[lang];

  // Login text
  document.getElementById("return-btn").textContent = "< " + t.back;
  document.getElementById("save-btn-headerbar").textContent = t.save;
  document.getElementById("manage-btn-headerbar").textContent = t.manage;

  // Home text
  document.getElementById("home-balance").textContent = t.incomeMinusExpense;

  // Transaction page
  document.getElementById("save-btn-nav").textContent = t.save;
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
  document.getElementById("basic-settings-title").textContent = t.personalSettingsTitle;
  document.getElementById("open-basic-settings").textContent = t.openPersonalSettings;
  document.getElementById("labels-title").textContent = t.labels;
  document.getElementById("manage-expense-categories-btn").textContent = t.manageExpenseCategories;
  document.getElementById("manage-income-categories-btn").textContent = t.manageIncomeCategories;
  document.getElementById("manage-collections-btn").textContent = t.manageCollections;
  document.getElementById("manage-subjects-btn").textContent = t.manageSubjects;
  document.getElementById("households-title").textContent = t.myHouseholdsTitle;
  document.getElementById("manage-household-btn").textContent = t.manageHousehold;
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


  if (token) {
    document.getElementById("login-btn").textContent = t.logout;
  } else {
    document.getElementById("login-btn").textContent = t.loginWithGitHub;
  }

  document.getElementById("delete-account-btn").textContent = t.deleteAccount;

  // Nav
  document.getElementById("nav-home").textContent = t.homeTitle;
  document.getElementById("nav-accounts").textContent = t.navAccounts;
  document.getElementById("nav-transaction").textContent = t.navTransaction;
  document.getElementById("nav-utilities").textContent = t.navUtilities;
  document.getElementById("nav-settings").textContent = t.settings;

  if (sync) {
    const personalSettings = await loadLocalJsonData("ledger-personal-settings.json", null);
    personalSettings.language = currentLang;
    personalSettings.updatedAt = Date.now();
    await saveLocalJsonData("ledger-personal-settings.json", personalSettings);
    await smartSync(selectedRepos, token, { push: true, syncPersonalSettings: true });
  }
}
window.setLanguage = setLanguage;

function isMobileBrowser() {
  return /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}

function increaseFontsize() {
  adjustFontsize(0.05, true); // increase fontsize
}
window.increaseFontsize = increaseFontsize;

function decreaseFontsize() {
  adjustFontsize(-0.05, true); // decrease fontsize
}
window.decreaseFontsize = decreaseFontsize;

async function adjustFontsize(delta, sync = true) {
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

  if (sync) {
    const personalSettings = await loadLocalJsonData("ledger-personal-settings.json", null);
    if (isMobileBrowser()) {
      personalSettings.fontsizeMobile = newSize;
    } else {
      personalSettings.fontsizeDesktop = newSize;
    }
    personalSettings.updatedAt = Date.now();
    await saveLocalJsonData("ledger-personal-settings.json", personalSettings);
    await smartSync(selectedRepos, token, { push: true, syncPersonalSettings: true });
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

  let debounceTimer = null;

  picker.oninput = function () {
    const chosenColor = picker.value;
    applyThemeColor(chosenColor);

    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(async () => {
      const personalSettings = await loadLocalJsonData("ledger-personal-settings.json", null);
      personalSettings.themeColor = chosenColor;
      personalSettings.updatedAt = Date.now();
      await saveLocalJsonData("ledger-personal-settings.json", personalSettings);
      await smartSync(selectedRepos, token, { push: true, syncPersonalSettings: true });
    }, 500); // adjust delay as needed
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

async function resetThemeColor() {
  // Define your default color (same as in CSS :root)
  const defaultColor = "#e88b1a";
  applyThemeColor(defaultColor);

  const personalSettings = await loadLocalJsonData("ledger-personal-settings.json", null);
  personalSettings.themeColor = chosenColor;
  personalSettings.updatedAt = Date.now();
  await saveLocalJsonData("ledger-personal-settings.json", personalSettings);
  await smartSync(selectedRepos, token, { push: true, syncPersonalSettings: true });
}
window.resetThemeColor = resetThemeColor;

function applyThemeColor(color) {
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
}

async function toggleHomeImageEditor() {
  const editor = document.getElementById("home-image-panel");

  if (editor.style.display === "none" || editor.style.display === "") {
    editor.style.display = "block";
    await renderHomeImageList();

  } else {
    editor.style.display = "none";
  }
}
window.toggleHomeImageEditor = toggleHomeImageEditor;

async function renderHomeImageList(options = {}) {
  const t = translations[currentLang];

  const personalSettings = await loadLocalJsonData("ledger-personal-settings.json", null);
  let homeImages;
  if ("homeImages" in options) {
    homeImages = options.homeImages;
  } else {
    homeImages = personalSettings.homeImages;
  };

  if (options.add === true) {
    homeImages.push("");
  }

  const list = document.getElementById("home-image-list");
  list.innerHTML = "";

  homeImages.forEach((homeImage, index) => {
    const row = document.createElement("div");
    row.className = "home-image-row";

    const input = document.createElement("input");
    input.type = "url";
    input.value = homeImage;
    input.dataset.originalPath = homeImage.trim();   // ⭐ store original path

    const upload = document.createElement("button");
    upload.type = "button";
    upload.textContent = t.upload || "Upload";

    upload.addEventListener("click", async () => {
      const file = await pickLocalImageFile();
      if (!file) return;

      homeImages[index] = file;      // optional, for in‑memory state
      input.value = file.name;       // show filename
      input._file = file;            // attach File object (not dataset)
    });

    const del = document.createElement("button");
    del.type = "button";
    del.textContent = t.delete;
    del.addEventListener("click", async () => {
      homeImages.splice(index, 1);
      renderHomeImageList({ homeImages });
    });

    row.appendChild(input);
    row.appendChild(upload);
    row.appendChild(del);
    list.appendChild(row);
  });
}

async function pickLocalImageFile() {
  return new Promise(resolve => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";

    input.onchange = () => resolve(input.files[0] || null);
    input.click();
  });
}

function addHomeImageRow() {
  renderHomeImageList({ add: true });
}
window.addHomeImageRow = addHomeImageRow;

async function saveFolderImages(folderName, inputs) {
  const newPaths = [];

  for (const input of inputs) {
    const fileObj = input._file || null;
    const rawValue = input.value.trim();

    // Skip empty rows
    if (!fileObj && !rawValue) continue;

    // Case 1 — user uploaded a new file
    if (fileObj instanceof File) {
      const filename = fileObj.name;
      const localPath = await saveFileToOPFS(folderName, fileObj, filename);
      newPaths.push(localPath); // always OPFS path
      continue;
    }

    // Case 2 — existing OPFS path
    if (rawValue.startsWith(`opfs://${folderName}/`)) {
      newPaths.push(rawValue);
      continue;
    }

    // Case 3 — existing GitHub path (convert → OPFS path)
    if (rawValue.startsWith(`${folderName}/`)) {
      const filename = rawValue.split("/").pop();
      newPaths.push(`opfs://${folderName}/${filename}`);
      continue;
    }

    // Case 4 — external URL (keep as-is)
    if (/^https?:\/\//.test(rawValue)) {
      newPaths.push(rawValue);
      continue;
    }

    // Unknown format → ignore
  }

  // Cleanup OPFS folder (remove files not referenced)
  await cleanupLocalFolder(folderName, newPaths);

  return newPaths;
}

async function saveHomeImages() {
  const inputs = document.querySelectorAll("#home-image-list input[type='url']");
  const newPaths = await saveFolderImages("homeImages", inputs);

  const personalSettings = await loadLocalJsonData("ledger-personal-settings.json", null);

  personalSettings.homeImages = newPaths;
  personalSettings.updatedAt = Date.now();
  await saveLocalJsonData("ledger-personal-settings.json", personalSettings);
  await smartSync(selectedRepos, token, { push: true, syncPersonalSettings: true, syncHomeImages: true });

  displayHomeImage();
}
window.saveHomeImages = saveHomeImages;

async function saveIcons() {
  const inputs = document.querySelectorAll("#icon-list input[type='url']");
  const newPaths = await saveFolderImages("icons", inputs);

  personalSettings.icons = newPaths;
  await saveLocalJsonData("ledger-personal-settings.json", personalSettings);
}

async function readOPFSAsBlobURL(opfsPath) {
  const root = await navigator.storage.getDirectory();
  const parts = opfsPath.replace("opfs://", "").split("/");
  let dir = root;

  for (let i = 0; i < parts.length - 1; i++) {
    dir = await dir.getDirectoryHandle(parts[i]);
  }

  const fileHandle = await dir.getFileHandle(parts.at(-1));
  const file = await fileHandle.getFile();
  return URL.createObjectURL(file);
}

async function displayHomeImage() {
  const personal = await loadLocalJsonData("ledger-personal-settings.json", null);
  const images = personal?.homeImages || [];

  const img = document.getElementById("home-image");
  const overlay = document.querySelector(".home-overlay");

  if (!Array.isArray(images) || images.length === 0) {
    img.style.display = "none";
    overlay.style.background = "rgba(0, 0, 0, 0.5)";
    return;
  }

  const randomIndex = Math.floor(Math.random() * images.length);
  const randomPath = images[randomIndex].trim();

  if (!randomPath) {
    img.style.display = "none";
    overlay.style.background = "rgba(0, 0, 0, 0.5)";
    return;
  }

  // Determine final URL (external or OPFS)
  let finalUrl = randomPath;

  if (randomPath.startsWith("opfs://")) {
    finalUrl = await readOPFSAsBlobURL(randomPath);
  }

  // Preload before showing
  const preloader = new Image();

  preloader.onload = () => {
    img.src = finalUrl;
    img.style.display = "block";
    overlay.style.background = "transparent";
  };

  preloader.onerror = () => {
    img.style.display = "none";
    overlay.style.background = "rgba(0, 0, 0, 0.5)";
  };

  preloader.src = finalUrl;
}

async function getFilteredEntries({
  dateFrom = null,
  dateTo = null,
  types = null,
  collections = null,
  accounts = null,
  tags = null,
  notesKeyword = null,
} = {}) {
  const repoIds = Object.keys(localLedgerDataMap);
  let allEntries = [];

  let from = dateFrom ? dateFrom + " 00:00:00" : null;
  let to = dateTo ? dateTo + " 23:59:59" : null;
  if (from) from = new Date(from).getTime();
  if (to) to = new Date(to).getTime();

  // ------------------------------------------------------------
  // Load entries from each repo's local JSON data
  // ------------------------------------------------------------
  for (const rid of repoIds) {
    const entries = localLedgerDataMap[rid];
    if (!entries) continue;

    for (const entry of Object.values(entries)) {
      try {
        allEntries.push(entry);
      } catch (e) {
        console.warn("Invalid entry in localLedgerDataMap", e);
      }
    }
  }

  // ------------------------------------------------------------
  // Apply filters
  // ------------------------------------------------------------
  return allEntries.filter(e => {
    const t = new Date(e.transactionTime).getTime();

    if (from && t < from) return false;

    if (to && t > to) return false;

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

function summarizeIncomeExpense(entries) {
  let income = 0;
  let expense = 0;

  if (Array.isArray(entries)) {
    for (const e of entries) {
      if (e.type === "income") {
        income += Number(e.amount) || 0;
      }
      if (e.type === "expense") {
        expense += Number(e.amount) || 0;
      }
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

    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();

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
    case "today": return pack(today, today);
    case "upToToday": return pack(null, today);
    case "yesterday": const y = new Date(today); y.setDate(y.getDate() - 1); return pack(y, y);
    case "last7": const d7 = new Date(today); d7.setDate(today.getDate() - 6); return pack(d7, today);
    case "last30": const d30 = new Date(today); d30.setDate(today.getDate() - 29); return pack(d30, today);
    case "thisWeek": return pack(startOfWeek, endOfWeek);
    case "lastWeek": const lwS = new Date(startOfWeek); lwS.setDate(lwS.getDate() - 7);
      const lwE = new Date(endOfWeek); lwE.setDate(lwE.getDate() - 7);
      return pack(lwS, lwE);
    case "thisMonth": return pack(startOfMonth, endOfMonth);
    case "lastMonth": return pack(startOfLastMonth, endOfLastMonth);
    case "thisQuarter": return pack(startOfQuarter, endOfQuarter);
    case "lastQuarter": return pack(startOfLastQuarter, endOfLastQuarter);

    // Long ranges → show year
    case "thisYear": return pack(startOfYear, endOfYear, true);
    case "lastYear": return pack(startOfLastYear, endOfLastYear, true);

    default: return pack(null, null, true);
  }
}

function getFormattedAmount(number) {
  // display a string for a locale formatted number, with two decimals
  return number.toLocaleString(currentLang, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })
}

async function updateKanbanRow(title, kanbanIndex, filters) {
  const t = translations[currentLang];

  // apply filters to all entries
  let filteredEntries = await getFilteredEntries(filters);

  const { income, expense } = summarizeIncomeExpense(filteredEntries);

  if (kanbanIndex == 1) {
    const monthNames = {
      zh: ["1月", "2月", "3月", "4月", "5月", "6月", "7月", "8月", "9月", "10月", "11月", "12月"],
      en: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]
    };

    const monthIndex = new Date().getMonth();

    const monthText =
      currentLang === "zh"
        ? `${monthNames.zh[monthIndex]} · 结余`
        : `${monthNames.en[monthIndex]} · Balance`;

    document.getElementById("home-month").textContent = monthText;
    document.getElementById("home-balance").textContent = getFormattedAmount(income - expense);

    const summaryEl = document.getElementById("home-summary");

    if (currentLang === "zh") {
      summaryEl.textContent = `本月收入 ${getFormattedAmount(income)} | 本月支出 ${getFormattedAmount(expense)}`;
    } else {
      summaryEl.textContent = `Income ${getFormattedAmount(income)} | Expense ${getFormattedAmount(expense)}`;
    }
  }

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

  row.onclick = async () => {
    await showPage("filtered-entries", title, { kanbanIndex: kanbanIndex, filters: filters, dateRangeStr });
  };
}

function showFilteredEntries(entries) {
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

  // Sort newest first
  entries.sort((a, b) => (a.transactionTime < b.transactionTime ? 1 : -1));

  // Group by date
  const groups = {};
  for (const e of entries) {
    const day = e.transactionTime.split(" ")[0];
    if (!groups[day]) groups[day] = [];
    groups[day].push(e);
  }

  const groupKeys = Object.keys(groups).sort((a, b) => (a < b ? 1 : -1));

  for (const day of groupKeys) {
    const dayEntries = groups[day];
    scroll.innerHTML += renderEntryGroup(day, dayEntries);
  }
}

function showFilteredEntriesToday(entries) {
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

  // Sort newest first
  entries.sort((a, b) => (a.transactionTime < b.transactionTime ? 1 : -1));

  // Group by date
  const groups = {};
  for (const e of entries) {
    const day = e.transactionTime.split(" ")[0];
    if (!groups[day]) groups[day] = [];
    groups[day].push(e);
  }

  const groupKeys = Object.keys(groups).sort((a, b) => (a < b ? 1 : -1));

  const BATCH_SIZE = 5;
  let index = 0;

  function renderBatch() {
    const end = Math.min(index + BATCH_SIZE, groupKeys.length);
    for (let i = index; i < end; i++) {
      const day = groupKeys[i];
      const dayEntries = groups[day];
      scroll.innerHTML += renderEntryGroup(day, dayEntries);
    }
    index = end;

    document.querySelectorAll(".fe-entry-block").forEach(block => {
      let startX = 0;

      block.addEventListener("touchstart", e => {
        startX = e.touches[0].clientX;
      });

      block.addEventListener("touchend", e => {
        const endX = e.changedTouches[0].clientX;
        const diff = startX - endX;

        if (diff > 40) {
          block.classList.add("show-actions");   // swipe left
        } else if (diff < -40) {
          block.classList.remove("show-actions"); // swipe right
        }
      });
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
      html += `<hr>`;
    }
  });

  html += `<hr class="hr-wide">`;

  html += `</div>`;
  return html;
}

function renderEntryByType(e) {
  let t = translations[currentLang];

  const repoId = e.repoId;

  const time = e.transactionTime.split(" ")[1];
  const account = e.account || e.fromAccount || e.toAccount || "";
  const subject = e.subject || "";
  const collection = e.collection || "";
  const items = e.items || [];
  const notes = e.notes || "";

  const tagStr = (e.tags && e.tags.length > 0)
    ? e.tags.map(t => `#${t}`).join(" ")
    : "";

  // --- Income / Expense ---
  if (e.type === "income" || e.type === "expense") {
    const { primaryIcon, secondaryIcon } = getCategoryIcon(
      repoId,
      e.type,
      e.primaryCategory,
      e.secondaryCategory
    );

    return `
      <div class="fe-entry-block" data-entry-id="${e.entryId}" data-repo-id="${e.repoId}" data-entry-type="${e.type}">
        
        <div class="fe-entry-content">
          <div class="fe-entry-icon">${secondaryIcon}</div>

          <div class="fe-entry-main">
            <div class="fe-entry-title-row">
              <div class="fe-entry-title">${e.secondaryCategory}</div>
              <div class="fe-entry-amount-right ${e.type}">
                ${Number(e.amount).toFixed(2)}
              </div>
            </div>
            ${renderNotesItemsTags(notes, items)}
            <div class="fe-entry-meta">${tagStr ? tagStr : ""}</div>
            <div class="fe-entry-meta">${time} · ${account} · ${subject} · ${collection}</div>
          </div>
        </div>

        <div class="fe-entry-actions">
          <button class="modify-btn">${t.modify}</button>
          <button class="delete-btn">${t.delete}</button>
        </div>

      </div>
    `;
  }

  // --- Transfer ---
  if (e.type === "transfer") {
    return `
      <div class="fe-entry-block" data-entry-id="${e.entryId}" data-repo-id="${e.repoId}" data-entry-type="${e.type}">
        
        <div class="fe-entry-content">
          <div class="fe-entry-icon"><span class="icon-content">🔁</span></div>

          <div class="fe-entry-main">
            <div class="fe-entry-title-row">
              <div class="fe-entry-title">${e.fromAccount} → ${e.toAccount}</div>
              <div class="fe-entry-amount-right">
                ${Number(e.amount).toFixed(2)}
              </div>
            </div>
            ${renderNotesItemsTags(notes, items)}
            <div class="fe-entry-meta">${time}</div>
          </div>
        </div>

        <div class="fe-entry-actions">
          <button class="modify-btn">${t.modify}</button>
          <button class="delete-btn">${t.delete}</button>
        </div>

      </div>
    `;
  }

  // --- Balance ---
  if (e.type === "balance") {
    return `
      <div class="fe-entry-block" data-entry-id="${e.entryId}" data-repo-id="${e.repoId}" data-entry-type="${e.type}">
        
        <div class="fe-entry-content">
          <div class="fe-entry-icon"><span class="icon-content">📊</span></div>

          <div class="fe-entry-main">
            <div class="fe-entry-title-row">
              <div class="fe-entry-title">${currentLang === "zh" ? "余额变更" : "Balance Set"}</div>
              <div class="fe-entry-amount-right">
                ${Number(e.amount).toFixed(2)}
              </div>
            </div>
            ${renderNotesItemsTags(notes, items)}
            <div class="fe-entry-meta">${time}</div>
          </div>
        </div>

        <div class="fe-entry-actions">
          <button class="modify-btn">${t.modify}</button>
          <button class="delete-btn">${t.delete}</button>
        </div>

      </div>
    `;
  }

  return "";
}

function renderNotesItemsTags(notes, items) {
  const hasNotes = notes && notes.trim() !== "";
  const hasItems = Array.isArray(items) && items.length > 0;

  if (!hasNotes && !hasItems) return "";

  const lines = [];

  // Notes
  if (hasNotes) {
    lines.push(notes.trim());
  }

  // Items: "name unitPrice price"
  if (hasItems) {
    items.forEach(it => {
      const name = it.name || "";
      const unitPrice = it.unitPrice || "";
      const price = it.price || "";
      lines.push(`${name} ${unitPrice} ${price}`.trim());
    });
  }

  const combinedText = lines.join("\n").trim();

  return `<div class="fe-notes-text">${combinedText}</div>`;
}

function getCategoryIcon(repoId, type, primary, secondary) {
  const settings = settingsMap[repoId];   // ledger settings for this repo

  if (!settings) {
    return { primaryIcon: "", secondaryIcon: "" };
  }

  const dict = settings[`${type}-categories`];
  if (!Array.isArray(dict)) {
    return { primaryIcon: "", secondaryIcon: "" };
  }

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
async function setColorScheme(scheme, sync = true) {
  const t = translations[currentLang];

  if (scheme === "alt") {
    document.documentElement.classList.add("alt-scheme");
  } else {
    document.documentElement.classList.remove("alt-scheme");
  }

  if (sync) {
    const personalSettings = await loadLocalJsonData("ledger-personal-settings.json", null);
    personalSettings.colorScheme = scheme;
    personalSettings.updatedAt = Date.now();
    await saveLocalJsonData("ledger-personal-settings.json", personalSettings);
    await smartSync(selectedRepos, token, { push: true, syncPersonalSettings: true });
  }
}
window.setColorScheme = setColorScheme;

document.getElementById("manage-household-btn").onclick = () => {
  const notes = document.getElementById("manage-household-notes");
  const isVisible = notes.style.display === "block";

  if (isVisible) {
    notes.style.display = "none"; // toggle off
  } else {
    notes.style.display = "block"; // toggle on
  }
};

async function deleteAccount(mode) { // mode = "account" (delete all) or mode = "data" (delete just data)
  const message = currentLang === "en"
    ? mode === "account"
      ? "This action cannot be undone.\n\nThe system will delete all local data, all ledger data inside GitHub repositories you own, and your personal settings stored in GitHub. (Note: You cannot delete data in repositories created by others and shared with you.)"
      : "This action cannot be undone.\n\nThe system will delete all ledger data inside GitHub repositories you own and all local ledger data. Your personal settings will NOT be deleted."
    : mode === "account"
      ? "此操作不可撤销。\n\n系统将删除本地所有数据、您自己 GitHub 仓库中的所有账本数据和 GitHub 上的个人设置\n\n（注意：您无法删除别人创建并共享给您的仓库数据。）"
      : "此操作不可撤销。\n\n系统将删除本地账本数据和您自己 GitHub 仓库中的所有账本数据。您的个人设置不会被删除。";

  showPopupWindow({
    title: currentLang === "en" ? "Confirm Deletion" : "确认删除",
    message,
    buttons: [
      {
        text: currentLang === "en" ? "Cancel" : "取消",
        primary: true,
        onClick: () => { }
      },
      {
        text: currentLang === "en" ? "Delete" : "删除",
        onClick: async () => {
          await set("pendingDelete", mode);
          const redirectUrl = `${window.location.origin}/?deleteMode=1`;
          if (token) {
            window.location.href = `/api/auth/login?redirect=${encodeURIComponent(redirectUrl)}`;
          } else {
            window.location.href = redirectUrl;
          }
        }
      }
    ]
  });
}
window.deleteAccount = deleteAccount;

async function performAccountDeletion(mode) {
  const ownedRepos = selectedRepos.ledgerRepos.filter(
    r => r.ownerId === window.currentUserId
  );

  // Only ask repo selection when deleting DATA, not account
  if (mode === "data") {
    if (ownedRepos.length > 1) {
      // Show multi-select popup and STOP execution here
      return showRepoMultiSelectPopup(ownedRepos, mode);
    }

    // If only one repo, auto-select it
    if (ownedRepos.length === 1) {
      await set("reposToDelete", [ownedRepos[0].id]);
    }
  }

  // If deleting ENTIRE ACCOUNT → delete ALL repos user owns
  if (mode === "account") {
    const allOwnedRepoIds = ownedRepos.map(r => r.id);
    await set("reposToDelete", allOwnedRepoIds);
  }

  showStatusMessage(
    currentLang === "en"
      ? "Deleting your data…"
      : "正在删除您的数据…",
    "info",
    4000 // ms
  );

  if (token) {
    // 1. Delete GitHub repos owned by this user
    await deleteLedgerFilesInRepo(mode, token);
  }

  // 2. Delete local data
  await deleteLocalData(mode);

  const successMessage =
    mode === "account"
      ? currentLang === "en"
        ? "Your account and all associated data have been deleted."
        : "您的账户和所有相关数据已删除。"
      : currentLang === "en"
        ? "Your ledger data has been deleted. "
        : "您的账本数据已删除。";

  showStatusMessage(successMessage, "success", 4000);

  if (mode === "account") {
    await deleteLocalJsonData("github_token.json");
    await deleteLocalJsonData("selectedRepos.json");
  }
  window.location.href = "/";
}

async function deleteLocalData(mode) { // This function will not delete github_token and selectedRepos
  // 1. Read values to keep
  const token = await loadLocalJsonData("github_token.json", null);
  const repos = await loadLocalJsonData("selectedRepos.json", null);
  const personalSettings = await loadLocalJsonData("ledger-personal-settings.json", null);
  const reposToDelete = await get("reposToDelete") || [];

  // 2. Clear all localStorage and file system
  localStorage.clear();
  const root = await navigator.storage.getDirectory();
  for await (const name of root.keys()) {
    await root.removeEntry(name, { recursive: true });
  }

  // 3. Restore the values you want to keep
  if (token) await saveLocalJsonData("github_token.json", token);

  if (repos) {
    // Remove deleted repos from ledgerRepos
    const updatedLedgerRepos = repos.ledgerRepos.filter(
      r => !reposToDelete.includes(r.id)
    );

    // Update activeLedgerRepo if it was deleted
    let updatedActive = repos.activeLedgerRepo;
    if (updatedActive && reposToDelete.includes(updatedActive.id)) {
      updatedActive = updatedLedgerRepos.length > 0 ? updatedLedgerRepos[0] : null;
    }

    // Update personalSettingsRepo if needed (rare but possible)
    let updatedPersonalSettingsRepo = repos.personalSettingsRepo;
    if (updatedPersonalSettingsRepo && reposToDelete.includes(updatedPersonalSettingsRepo.id)) {
      updatedPersonalSettingsRepo = null;
    }

    // Save updated repos structure
    await saveLocalJsonData("selectedRepos.json", {
      ledgerRepos: updatedLedgerRepos,
      activeLedgerRepo: updatedActive,
      personalSettingsRepo: updatedPersonalSettingsRepo
    });
  }

  if (mode === "data") {
    if (personalSettings) await saveLocalJsonData("ledger-personal-settings.json", personalSettings);
  }

  // ⭐ If deleting entire account → also delete homeImages folder
  if (mode === "account") {
    try {
      await root.removeEntry("homeImages", { recursive: true });
    } catch (err) {
      // folder may not exist — safe to ignore
    }
  }

  // 4. Delete IndexedDB (idb-keyval)
  if (window.indexedDB) {
    await new Promise(resolve => {
      const req = indexedDB.deleteDatabase("keyval-store");
      req.onerror = () => resolve();
      req.onsuccess = () => resolve();
      req.onblocked = () => resolve();
    });
  }
}

function showRepoMultiSelectPopup(repos, mode) {
  const html = repos
    .map(
      r => `
        <label style="display:flex;align-items:center;gap:8px;margin:6px 0;">
          <input type="checkbox" value="${r.id}" />
          <span>${r.name}</span>
        </label>
      `
    )
    .join("");

  showPopupWindow({
    title: currentLang === "en" ? "Select Repositories" : "选择仓库",
    message:
      (currentLang === "en"
        ? "Select the repositories you want to delete data from:"
        : "请选择要删除数据的仓库：") +
      "<br><br>" +
      html,
    buttons: [
      {
        text: currentLang === "en" ? "Cancel" : "取消",
        primary: true,
        onClick: () => { }
      },
      {
        text: currentLang === "en" ? "Continue" : "继续",
        onClick: async () => {
          const checkboxes = document.querySelectorAll(
            ".popup-window input[type=checkbox]"
          );
          const selected = [...checkboxes]
            .filter(cb => cb.checked)
            .map(cb => Number(cb.value));

          if (selected.length === 0) {
            showStatusMessage(
              currentLang === "en"
                ? "Please select at least one repository."
                : "请至少选择一个仓库。",
              "error",
              3000
            );
            return;
          }

          await set("reposToDelete", selected);

          // Continue deletion after selection
          performAccountDeletion(mode);
        }
      }
    ]
  });
}

async function deleteLedgerFilesInRepo(mode, token) {
  // Load selected repos (array of repo IDs)
  const reposToDelete = await get("reposToDelete") || [];

  for (const repo of selectedRepos.ledgerRepos) {
    // Skip repos not selected
    if (!reposToDelete.includes(repo.id)) continue;

    console.log("Cleaning ledger files in repo:", repo.name);

    async function deleteFolder(folder) {
      const list = await githubListDirectory(repo.name, folder, token);

      if (!Array.isArray(list)) {
        console.log(`Folder ${folder} does not exist in ${repo.name}`);
        return;
      }

      for (const file of list) {
        if (file.type === "file") {
          console.log("Deleting:", file.path);
          await githubDeleteFile(repo.name, file.path, file.sha, token);
        }
      }
    }

    await deleteFolder("entries");
    await deleteFolder("changelog");
    await githubDeleteIfExists(repo.name, "ledger-settings.json", token);
  }

  // ⭐ Only full account deletion wipes ledger-personal-settings.json
  if (mode === "account") {
    await githubUploadFile(
      selectedRepos.personalSettingsRepo.name,
      "ledger-personal-settings.json",
      { deleted: true, deletedAtTimestamp: Date.now() },
      token
    );
  }

  // ⭐ Clean up selection after use
  await del("reposToDelete");
}

async function githubListDirectory(repoName, path, token) {
  const res = await fetch(`https://api.github.com/repos/${repoName}/contents/${path}`, {
    headers: { Authorization: `Bearer ${token}` }
  });

  if (res.status === 404) return []; // directory doesn't exist
  return await res.json();
}

async function githubDeleteIfExists(repoName, path, token) {
  const res = await fetch(`https://api.github.com/repos/${repoName}/contents/${path}`, {
    headers: { Authorization: `Bearer ${token}` }
  });

  if (res.status === 404) return;

  const file = await res.json();
  await githubDeleteFile(repoName, path, file.sha, token);
}

async function githubDeleteFile(repoName, path, sha, token) {
  await fetch(`https://api.github.com/repos/${repoName}/contents/${path}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      message: `Delete ${path}`,
      sha
    })
  });
}

async function fetchUserRepos(token) {
  const res = await fetch("https://api.github.com/user/repos?per_page=100", {
    headers: { Authorization: `Bearer ${token}` }
  });

  if (!res.ok) return [];
  return await res.json();
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

  if (latestPage.includes("create")) { // when creating an entry
    subWorkspace = workspace.create;
  } else {
    subWorkspace = workspace.transactions[latestOptions.transactionId];
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

    const [inputRepoId, household] = Object.entries(householdDocs).find(
      ([id, h]) => h.name.toLowerCase() === hhEl.textContent.toLowerCase()
    ) || [];

    subWorkspace[subWorkspace.inputType].repoId = inputRepoId;

    lastButton.textContent = household.name;
    lastButton.dataset.value = inputRepoId;

    // update other buttons when household change
    let categoryBtn = document.querySelector(`#${activeForm} .selector-button[data-type='category']`);
    if (categoryBtn) { setDefaultCategory(categoryBtn, subWorkspace) };

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
    const inputRepoId = subWorkspace[subWorkspace.inputType].repoId;

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

      subWorkspace[inputType].accountInfo = findSelectedAccount(inputRepoId, subWorkspace[inputType].accountInfo.type, accountName);

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

      subWorkspace.transfer.fromAccountInfo = findSelectedAccount(inputRepoId, null, fromAccountName);
      subWorkspace.transfer.toAccountInfo = findSelectedAccount(inputRepoId, null, toAccountName);

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

    subWorkspace[inputType].subject = name;
    subWorkspace[inputType].subjectIcon = icon;

    lastButton.innerHTML = `${icon} ${name}`;
  } else if (lastButton.dataset.type === "collection") {
    const { icon: icon, name: name } =
      getSelectedValue(collectionSelector, ".collection-col", true);

    subWorkspace[inputType].collection = name;
    subWorkspace[inputType].collectionIcon = icon;

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

function initLedgerSelector() {
  const col = document.querySelector("#household-selector .household-col");

  // Get names for display
  const repoNames = selectedRepos.ledgerRepos
    .map(r => r.full_name)   // "user/repo"
    .filter(Boolean);

  createList(col, repoNames);
}

function updateDayColumn() {
  let subWorkspace = null;

  if (latestPage.includes("create")) { // when creating an entry
    subWorkspace = workspace.create;
  } else {
    subWorkspace = workspace.transactions[latestOptions.transactionId];
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
  const inputRepoId = subWorkspace[inputType].repoId;
  let cats = null;
  let primaryCat = null;
  let secondaries = null;
  let secondaryList = [];

  const settings = settingsMap[inputRepoId];   // ledger settings for this repo

  if (lastButton.dataset.type === "category") {
    cats = settings[inputType + '-categories'];

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
      name: sec.name || ""
    }));

  } else if (lastButton.dataset.type === "account") {
    cats = settings.accounts;

    const inputAccountTypeString = getSelectedValue(accountSelector, ".primary-col", false);
    const reverseMap = Object.fromEntries(Object.entries(t).map(([key, value]) => [value, key]));
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

    const iconEl = selectedItem.querySelector(".selector-item-icon");
    if (iconEl) {
      icon = iconEl.innerHTML;
    }

    const labelEl = selectedItem.querySelector(".selector-item-label");
    const name = labelEl.textContent.trim();

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

  if (latestPage.includes("create")) { // when creating an entry
    subWorkspace = workspace.create;
  } else {
    subWorkspace = workspace.transactions[latestOptions.transactionId];
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

}
window.closeSelector = closeSelector;

let returnButtonPressed = false;

function onReturnButton() {
  returnButtonPressed = true;
  history.back();
}
window.onReturnButton = onReturnButton;

window.addEventListener('popstate', (e) => {
  if (openSelector) {
    closeSelector();

    if (returnButtonPressed) {
      returnButtonPressed = false; // reset
      goBack(); // This logic is to handle goBack when selector is open. Only goBack when clicking on return button. At system back gesture, close selector only, do not goBack. A second gesture when selector is closed can goBack.  
    }

    return
  }

  if (historyStack.length > 1) {
    goBack();
  }
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

let isHoldingBackspace = false;
let backspaceInterval = null;
let backspaceClearTimeout = null;

document.addEventListener("keydown", e => {
  if (!keypadOpen) return; // only respond when keypad is open

  if (!(e.key in allowedKeys)) return;

  e.preventDefault();

  const mapped = allowedKeys[e.key];

  // Handle keyboard backspace hold
  if (mapped === 'backspace') {
    if (!isHoldingBackspace) {
      startBackspaceHold();
    }
    return;
  }

  // Handle keyboard confirm
  if (mapped === 'confirm') {
    closeSelector();
    return;
  }

  handleAmountKey(mapped);
});

document.addEventListener("keyup", e => {
  if (!keypadOpen) return; // only respond when keypad is open

  if (allowedKeys[e.key] === "backspace") {
    stopBackspaceHold();
  }
});

function startBackspaceHold() {
  isHoldingBackspace = true;

  // 1. Delete once immediately
  handleAmountKey("backspace");

  // 2. After 300ms, start slow repeating
  backspaceInterval = setInterval(() => {
    handleAmountKey("backspace");
  }, 120); // slower, more natural

  // 3. After 800ms of holding → clear all
  backspaceClearTimeout = setTimeout(() => {
    clearAllAmount();
  }, 800);
}

function stopBackspaceHold() {
  isHoldingBackspace = false;

  if (backspaceInterval) {
    clearInterval(backspaceInterval);
    backspaceInterval = null;
  }

  if (backspaceClearTimeout) {
    clearTimeout(backspaceClearTimeout);
    backspaceClearTimeout = null;
  }
}

function clearAllAmount() {
  if (!lastButton) return;

  const calcLabel = lastButton.querySelector(".calculation");
  const amountButton = lastButton.querySelector(".amount-button");

  calcLabel.textContent = "";
  tryUpdateAmount("", amountButton);
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

  if (latestPage.includes("create")) { // when creating an entry
    subWorkspace = workspace.create;
  } else {
    subWorkspace = workspace.transactions[latestOptions.transactionId];
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
        const toLabel = document.getElementById("exchange-rate-to-label");

        fromLabel.textContent = ``;
        toLabel.textContent = ``;
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

  } else {
    if (inputType === 'transfer') {
      if (amountButton.id === 'transfer-to-amount') {
        subWorkspace.transfer.toCalculation = expr; // raw expression
      } else {
        subWorkspace.calculation = expr; // raw expression
      }
    } else {
      subWorkspace.calculation = expr; // raw expression
    }
  }

  function parenBalance(expr) {
    let count = 0;
    for (const c of expr) {
      if (c === "(") count++;
      if (c === ")") count--;
    }
    return count; // positive = missing ')', negative = invalid
  }

  let safeExpr = expr.replace(/×/g, '*').replace(/÷/g, '/');
  let autoFixed = false;

  const balance = parenBalance(safeExpr);

  if (balance > 0) {
    // Missing closing parens → auto-fix
    safeExpr += ")".repeat(balance);
    autoFixed = true;
  }

  try {
    const result = Function(`"use strict"; return (${safeExpr})`)();

    if (typeof result === 'number' && isFinite(result)) {
      // VALID expression
      amountButton.textContent = result.toFixed(2);
      if (inputType === 'transfer') {
        if (amountButton.id === 'transfer-to-amount') {
          subWorkspace.transfer.toAmount = result;  // numeric
        } else {
          subWorkspace.amount = result;             // numeric
        }

        if (['transfer-from-amount', 'transfer-to-amount'].includes(amountButton.id)) {
          const fromBtn = document.getElementById("transfer-from-amount");
          const toBtn = document.getElementById("transfer-to-amount");

          const fromVal = parseFloat(fromBtn.textContent) || 0;
          const toVal = parseFloat(toBtn.textContent) || 0;

          // Avoid division by zero
          const ratio = fromVal > 0 ? (toVal / fromVal) : 0;
          const reverseRatio = toVal > 0 ? (fromVal / toVal) : 0;

          // Update labels
          const fromLabel = document.getElementById("exchange-rate-from-label");
          const toLabel = document.getElementById("exchange-rate-to-label");

          fromLabel.textContent = `⇂ ${t.exchangeRate}: ${ratio.toFixed(4)}`;
          toLabel.textContent = `↿ ${t.exchangeRate}: ${reverseRatio.toFixed(4)}`;

          subWorkspace.transfer.fromExchangeRate = ratio;
          subWorkspace.transfer.toExchangeRate = reverseRatio;
        }

      } else {
        subWorkspace.amount = result;             // numeric
      }

      if (balance > 0) { // parenthesis not balanced
        calcLabel.style.color = 'red';
      } else { // normal cases
        calcLabel.style.color = 'grey';
      }
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

  if (last) {
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

      if (latestPage.includes("create")) { // when creating an entry
        subWorkspace = workspace.create;
      } else {
        subWorkspace = workspace.transactions[latestOptions.transactionId];
      }

      const inputType = subWorkspace.inputType;

      const manageLabelsBtn = document.getElementById("selector-manage-category-btn");
      manageLabelsBtn.onclick = f => {
        f.stopPropagation();

        sel.style.transform = 'translateY(120%)';
        openSelector = null;
        if (inputType === "expense") { prepareRepoTabs('manage-labels', 'expense-categories', translations[currentLang].manageExpenseCategories) };
        if (inputType === "income") { prepareRepoTabs('manage-labels', 'income-categories', translations[currentLang].manageIncomeCategories) };
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

    if (latestPage.includes("create")) { // when creating an entry
      subWorkspace = workspace.create;
    } else {
      subWorkspace = workspace.transactions[latestOptions.transactionId];
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
        prepareRepoTabs('manage-labels', 'subjects', translations[currentLang].manageSubjects);
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
        prepareRepoTabs('manage-labels', 'collections', translations[currentLang].manageCollections);
      };

      ScrollToSelectItem(collectionSelector.querySelector(".collection-col"), btn.textContent);
    };
  });

/* Close when clicking outside */
document.addEventListener("click", e => {
  if (!openSelector) return; // nothing open → do nothing

  // Ignore clicks on tab buttons for closing selector
  if (e.target.closest(".tab-btn")) {
    // If amount selector is open, update lastButton to the new form's amount-row
    if (openSelector === "amount") {
      const btn = e.target.closest(".tab-btn");
      const index = parseInt(btn.dataset.index, 10);

      const inputType = transactionTypes[index];  // e.g. "expense", "income", "transfer"
      const activeForm = inputType + "-form";

      const amountRowEl = document.querySelector(`#${activeForm} .amount-row`);
      if (amountRowEl) {
        lastButton = amountRowEl;
      }
    }
    return; // IMPORTANT: do not close amount selector when switching tabs
  }

  const sel = document.getElementById(openSelector + "-selector");
  if (sel && !sel.contains(e.target)) {
    // Click was outside the currently open selector
    closeSelector();
  }
});

const updateBtns = document.querySelectorAll(".update-code-button");

updateBtns.forEach(btn => {
  btn.addEventListener("click", () => {
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
            }

            const url = new URL(location.href);
            url.searchParams.set("v", Date.now());
            location.href = url.toString();
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
            return
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
});

async function OpenGrocerySearch() {
  showPage('grocery-search', 'Grocery Search');

  let target = document.getElementById("grocery-search-page");
  disablePageSwipe(target);

  const repo = selectedRepos.activeLedgerRepo;
  const repoName = repo.name;

  const csvFilePath = 'GrocerySearchHistory.csv';
  const jsonFilePath = 'GrocerySearchHistory.json';

  const Websites = { // initialize this list for the first time. After that, users can tweak the links themselves.
    "Flipp": { searchURL1: "https://flipp.com/search/", searchURL2: "", items: [] },
    "Sobeys": { searchURL1: "https://www.sobeys.com/?query=", searchURL2: "&tab=products&sort=Price%3A+Low+to+High&itemsPerPage=100", items: [] },
    "Food Basics": { searchURL1: "https://www.foodbasics.ca/search?sortOrder=price-asc&filter=", searchURL2: "", items: [] },
    "Walmart": { searchURL1: "https://www.walmart.ca/en/search?q=", searchURL2: "&sort=price_low&facet=fulfillment_method_in_store%3AIn-store", items: [] },
    "Costco": { searchURL1: "https://www.costco.ca/CatalogSearch?dept=All&keyword=", searchURL2: "&sortBy=item_location_pricing_salePrice%2Basc", items: [] },
    "Shoppers Drug Mart": { searchURL1: "https://shop.shoppersdrugmart.ca/search?text=", searchURL2: "", items: [] },
    "T&T": { searchURL1: "https://www.tntsupermarket.com/eng/search.html?query=", searchURL2: "&sort%5Bfilter%5D=Price%3A+Low+to+High%2Cprice-ASC", items: [] },
    "Dollarama": { searchURL1: "https://www.google.com/search?q=", searchURL2: " site%3Ainstacart.ca%2Fstore%2Fdollarama", items: [] },
    "Real Canadian Superstore": { searchURL1: "https://www.realcanadiansuperstore.ca/search?search-bar=", searchURL2: "&sort=price-asc", items: [] },
    "No Frills": { searchURL1: "https://www.nofrills.ca/search?search-bar=", searchURL2: "&sort=price-asc", items: [] },
    "Zehrs": { searchURL1: "https://www.zehrs.ca/search?search-bar=", searchURL2: "&sort=price-asc", items: [] },
    "Valu-mart": { searchURL1: "https://www.valumart.ca/search?search-bar=", searchURL2: "&sort=price-asc", items: [] },
    "Giant Tiger": { searchURL1: "https://www.gianttiger.com/search?q=", searchURL2: "&sort_by=price_asc", items: [] },
    "Wholesale Club": { searchURL1: "https://www.wholesaleclub.ca/search?search-bar=", searchURL2: "&sort=price-asc", items: [] },
    "Amazon.ca": { searchURL1: "https://www.amazon.ca/s?k=", searchURL2: "&s=price-asc-rank", items: [] },
    "Mark's": { searchURL1: "https://www.marks.com/en/search-results.html?q=", searchURL2: ";m_ct_sort=national-sort-price", items: [] },
    "Canadian Tire": { searchURL1: "https://www.canadiantire.ca/en/search-results.html?q=", searchURL2: ";m_ct_sort=national-sort-price", items: [] },
    "Home Hardware": { searchURL1: "https://www.homehardware.ca/en/search?query=", searchURL2: "&sortBy=price%2Basc", items: [] },
    "Stock Track": { searchURL1: "https://stocktrack.ca/?s=", searchURL2: "&search=", items: [] },
    "Google": { searchURL1: "https://www.google.com/search?q=", searchURL2: "", items: [] }
  }

  const groceryData = await initializeGrocerySearch();

  let currentItem = null;

  renderStoreAndItems();

  document.getElementById("manage-btn-headerbar").addEventListener("click", () => {
    document.getElementById("manage-grocery-search-page").style.display = "block";
    showPage('manage-grocery-search', 'Manage Grocery Stores');
    renderManageGrocerySearchPage();
  });

  async function initializeGrocerySearch() {
    const localJSON = await loadLocalJsonData("grocery.json", null);
    const cloudJSON =
      token && !repo.skipSync
        ? await githubReadJson(repoName, "GrocerySearch.json", token)
        : null;

    const hasLocal = !!localJSON;
    const hasCloud = !!cloudJSON;

    // Case 1: neither exists → create new
    if (!hasLocal && !hasCloud) {
      const now = new Date().toISOString();
      const obj = {
        createdAt: now,
        lastUpdatedAt: now,
        stores: Websites
      };
      await saveLocalJsonData("grocery.json", obj);
      if (token && !repo.skipSync) await githubUploadFile(repoName, "GrocerySearch.json", obj, token);
      return obj;
    }

    // Case 2: cloud exists, local does not → copy cloud → local
    if (hasCloud && !hasLocal) {
      await saveLocalJsonData("grocery.json", cloudJSON);
      return cloudJSON;
    }

    // Case 3: local exists, cloud does not → copy local → cloud
    if (!hasCloud && hasLocal) {
      if (token && !repo.skipSync) await githubUploadFile(repoName, "GrocerySearch.json", localJSON, token);
      return localJSON;
    }

    // Case 4: both exist → ask user which to keep

    const localObj = localJSON;
    const cloudObj = cloudJSON;

    // Compare timestamps
    const sameCreated = localObj.createdAt === cloudObj.createdAt;
    const sameUpdated = localObj.lastUpdatedAt === cloudObj.lastUpdatedAt;

    // If both timestamps match → same version → skip popup
    if (sameCreated && sameUpdated) {
      return cloudObj; // identical, choose local or cloud doesn't matter
    }

    const localCreated = new Date(localObj.createdAt);
    const cloudCreated = new Date(cloudObj.createdAt);

    const localUpdated = new Date(localObj.lastUpdatedAt);
    const cloudUpdated = new Date(cloudObj.lastUpdatedAt);

    const cloudCreatedStr = new Date(cloudObj.createdAt).toString();
    const localCreatedStr = new Date(localObj.createdAt).toString();

    const cloudUpdatedStr = new Date(cloudObj.lastUpdatedAt).toString();
    const localUpdatedStr = new Date(localObj.lastUpdatedAt).toString();

    const createdDiff = highlightDiff(cloudCreatedStr, localCreatedStr);
    const updatedDiff = highlightDiff(cloudUpdatedStr, localUpdatedStr);

    // Build bilingual popup text
    const title =
      currentLang === "en"
        ? "Choose Data Source"
        : "选择数据来源";

    const message =
      (currentLang === "en"
        ? "Cloud and Local data both exist."
        : "云端和本地数据同时存在。") +
      "<br><br>" +
      `<b>${currentLang === "en" ? "Cloud repository:" : "云端仓库："}</b><br>${repoName}<br><br>` +
      `<b>${currentLang === "en" ? "Cloud created at:" : "云端创建时间："}</b><br>${createdDiff.a}<br><br>` +
      `<b>${currentLang === "en" ? "Cloud last updated:" : "云端最后更新时间："}</b><br>${updatedDiff.a}<br><br><br>` +
      `<b>${currentLang === "en" ? "Local created at:" : "本地创建时间："}</b><br>${createdDiff.b}<br><br>` +
      `<b>${currentLang === "en" ? "Local last updated:" : "本地最后更新时间："}</b><br>${updatedDiff.b}<br><br>` +

      (currentLang === "en"
        ? "Which version do you want to keep?"
        : "请选择要保留的版本：");

    const useCloud = await new Promise(resolve => {
      showPopupWindow({
        title,
        message,
        buttons: [
          {
            text: currentLang === "en" ? "Keep Cloud" : "保留云端数据",
            onClick: () => resolve(true)
          },
          {
            text: currentLang === "en" ? "Keep Local" : "保留本地数据",
            onClick: () => resolve(false)
          }
        ]
      });
    });

    if (useCloud) {
      await saveLocalJsonData("grocery.json", cloudObj);
      return cloudObj;
    } else {
      if (token && !repo.skipSync) await githubUploadFile(repoName, "GrocerySearch.json", localObj, token);
      return localObj;
    }
  }

  async function syncGroceryData() {
    groceryData.lastUpdatedAt = new Date().toISOString();

    await saveLocalJsonData("grocery.json", groceryData);

    if (token && !repo.skipSync) {
      try {
        await githubUploadFile(repoName, "GrocerySearch.json", groceryData, token);

        hideOfflineBanner();
        showStatusMessage(
          currentLang === "en" ? "Cloud sync successful." : "云端同步成功。",
          "success"
        );

      } catch (err) {
        console.error("GitHub write failed:", err);

        showOfflineBanner("GitHub write failed: " + err);
        showStatusMessage(
          currentLang === "en" ? "Cloud sync failed." : "云端同步失败。",
          "error"
        );
      }
    }
  }

  function renderStoreAndItems() {
    try {
      const container = document.getElementById("storeItemList");

      // 🧭 Record scroll positions of all item-scroll containers
      const scrollMap = {};
      container.querySelectorAll('.store-row').forEach(row => {
        const storeName = row.querySelector('.store-button')?.textContent;
        const scrollDiv = row.querySelector('.item-scroll');
        if (storeName && scrollDiv) {
          scrollMap[storeName] = scrollDiv.scrollLeft;
        }
      });

      container.innerHTML = ''; // 🔄 Clear the container before re-rendering

      for (const [storeName, storeObj] of Object.entries(groceryData.stores)) {
        const storeRow = document.createElement("div");
        storeRow.className = "store-row";
        storeRow.dataset.storeName = storeName;

        const storeCol = document.createElement("div");
        storeCol.className = "store-col";

        const storeBtn = document.createElement("button");
        storeBtn.textContent = storeName;
        storeBtn.className = "store-button";

        storeBtn.onclick = async () => {
          const itemName = document.getElementById("itemBox").value.trim();
          const notes = document.getElementById("notesBox").value.trim();
          if (!itemName) return;

          const found = findItemInStores(groceryData, itemName);

          let itemObj;

          if (found) {
            // ✔ Item exists → update notes and move to end of SAME store
            const { storeName: existingStore, itemObj: existingItem } = found;
            // Remove from its current position
            groceryData.stores[existingStore].items =
              groceryData.stores[existingStore].items.filter(i => i !== existingItem);

            itemObj = existingItem;
            itemObj.itemNotes = notes; // Update notes

            // Push to end of the SAME store
            groceryData.stores[existingStore].items.push(itemObj);

          } else {
            // ✔ Item does NOT exist → create in clicked store
            itemObj = { item: itemName, itemNotes: notes };
            groceryData.stores[storeName].items.push(itemObj);
          }

          await syncGroceryData();
          renderStoreAndItems();

          window.open(
            storeObj.searchURL1 + encodeURIComponent(itemObj.item) + storeObj.searchURL2,
            "_blank"
          );
        };

        storeCol.appendChild(storeBtn);

        // 📜 Create scrollable container for item buttons
        const itemScroll = document.createElement("div");
        itemScroll.className = "item-scroll";

        storeObj.items.forEach(itemObj => {
          const btn = document.createElement("button");
          btn.textContent = itemObj.item;
          btn.className = "item-button";
          btn.draggable = true;

          // 🚚 Enable drag functionality
          btn.addEventListener('dragstart', e => {
            e.dataTransfer.setData('text/plain', JSON.stringify(itemObj));
            e.dataTransfer.effectAllowed = 'move';
          });

          // 🖱️ Item button click: populate fields and open store link
          btn.onclick = async () => {
            const container = document.getElementById('storeItemList');
            const scrollY = container.scrollTop; // 🧭 Preserve scroll position

            // 1. Load into fields
            document.getElementById("itemBox").value = itemObj.item;
            document.getElementById("notesBox").value = itemObj.itemNotes;
            currentItem = { storeName, itemObj };

            // 2. Remove item from current store
            const arr = groceryData.stores[storeName].items;
            const idx = arr.indexOf(itemObj);
            if (idx !== -1) {
              arr.splice(idx, 1);
            }

            // 3. Push item to end
            arr.push(itemObj);

            // 4. Sync + re-render
            await syncGroceryData();
            renderStoreAndItems();
            container.scrollTop = scrollY;

            // 5. Execute search
            window.open(
              storeObj.searchURL1 + encodeURIComponent(itemObj.item) + storeObj.searchURL2,
              "_blank"
            );
          };

          // 🗑️ Right-click to show delete option
          btn.addEventListener("contextmenu", e => {
            e.preventDefault();
            showGroceryItemDeleteButton(btn, storeName, itemObj);
          });

          // 📱 Long-press on touch devices to show delete
          let pressTimer;

          btn.addEventListener("touchstart", e => {
            pressTimer = setTimeout(() => showGroceryItemDeleteButton(btn, storeName, itemObj), 600);
          });

          btn.addEventListener("touchend", () => clearTimeout(pressTimer));

          itemScroll.appendChild(btn);
        });

        // 🧭 Restore scroll position if previously recorded
        if (scrollMap[storeName] !== undefined) {
          requestAnimationFrame(() => {
            itemScroll.scrollLeft = scrollMap[storeName];
          });
        }

        storeRow.appendChild(storeCol);
        storeRow.appendChild(itemScroll);
        container.appendChild(storeRow);

        // 🧲 Enable drag-and-drop to assign items to this store
        storeRow.addEventListener('dragover', e => e.preventDefault());
        storeRow.addEventListener('drop', async e => {
          e.preventDefault();
          const data = JSON.parse(e.dataTransfer.getData("text/plain"));
          const draggedName = data.item;   // FIXED

          // Find the real item object + its store
          const found = findItemInStores(groceryData, draggedName);
          if (!found) return;

          const { storeName: fromStore, itemObj } = found;
          const toStore = storeRow.dataset.storeName;
          if (toStore === fromStore) return;

          // Remove from old store
          groceryData.stores[fromStore].items =
            groceryData.stores[fromStore].items.filter(i =>
              !(i.item === itemObj.item && i.itemNotes === itemObj.itemNotes)
            );

          // Add to new store
          groceryData.stores[toStore].items.push(itemObj);

          await syncGroceryData();
          renderStoreAndItems();
        });
      }
    } catch (err) {
      console.error('render store and item error:', err);
      showStatusMessage('Error rendering store and item', 'error');
    }
  }

  function findItemInStores(groceryData, itemName) {
    const normalized = itemName.trim().toLowerCase();

    for (const [storeName, storeObj] of Object.entries(groceryData.stores)) {
      const match = (storeObj.items || []).find(i =>
        i.item.trim().toLowerCase() === normalized
      );

      if (match) {
        return { storeName, itemObj: match };
      }
    }

    return null;
  }

  function showGroceryItemDeleteButton(targetBtn, storeName, itemObj) {
    const deleteBtn = document.createElement('button');
    deleteBtn.textContent = '🗑️';
    deleteBtn.className = 'item-delete-button';   // <-- add second class

    deleteBtn.onclick = async () => {
      groceryData.stores[storeName].items =
        groceryData.stores[storeName].items.filter(i => i !== itemObj);

      await syncGroceryData();
      renderStoreAndItems();
    };

    const existing = targetBtn.nextSibling;
    if (existing?.textContent === '🗑️') return;

    targetBtn.insertAdjacentElement('afterend', deleteBtn);

    setTimeout(() => deleteBtn.remove(), 2500);
  }

  document.getElementById('itemBox').addEventListener('input', () => {
    const query = document.getElementById('itemBox').value.trim();
    const resultsContainer = document.getElementById('searchResults');
    resultsContainer.innerHTML = '';

    if (!query) return;

    // Collect matches across all stores
    const matches = [];

    for (const [storeName, storeObj] of Object.entries(groceryData.stores)) {
      storeObj.items.forEach(itemObj => {
        if (itemObj.item.toLowerCase().includes(query.toLowerCase())) {
          matches.push({ storeName, itemObj });
        }
      });
    }

    if (matches.length === 0) {
      resultsContainer.textContent = 'No matches found.';
      document.getElementById('notesBox').value = "";
      return;
    }

    const exact = matches.find(m =>
      m.itemObj.item.toLowerCase() === query.toLowerCase()
    );

    if (exact) {
      document.getElementById('notesBox').value = exact.itemObj.itemNotes || "";
    } else {
      document.getElementById('notesBox').value = "";
    }

    // Sort alphabetically
    matches.sort((a, b) => a.itemObj.item.localeCompare(b.itemObj.item));

    // Render match buttons
    matches.forEach(({ storeName, itemObj }) => {
      const btn = document.createElement('button');
      btn.className = 'item-button';
      btn.textContent = `${itemObj.item}`;

      // Drag support
      btn.draggable = true;
      btn.addEventListener('dragstart', e => {
        document.getElementById('itemBox').blur();
        e.dataTransfer.setData('text/plain', JSON.stringify({ storeName, itemObj }));
        e.dataTransfer.effectAllowed = 'move';
      });

      // Click to load into input
      btn.onclick = async () => {
        resultsContainer.innerHTML = '';
        document.getElementById('itemBox').value = itemObj.item;
        document.getElementById('notesBox').value = itemObj.itemNotes;

        currentItem = { storeName, itemObj };

        // Move item to end of its store list
        const items = groceryData.stores[storeName].items;
        groceryData.stores[storeName].items = items.filter(i => i !== itemObj).concat(itemObj);

        await syncGroceryData();
        renderStoreAndItems();

        // Open search URL
        const store = groceryData.stores[storeName];
        window.open(store.searchURL1 + encodeURIComponent(itemObj.item) + store.searchURL2, '_blank');
      };

      resultsContainer.appendChild(btn);
    });
  });

  function renderManageGrocerySearchPage() {
    const container = document.getElementById("manage-store-list");
    container.innerHTML = "";

    const controls = document.getElementById("manage-controls");
    controls.innerHTML = `
      <button id="add-store-btn">Add Store</button>
      <button id="save-store-btn">Save</button>
      <button id="reset-preset-btn">Reset Preset</button>
      <button id="delete-store-btn">Delete Selected</button>
    `;

    const stores = groceryData.stores; // your unified JSON model

    for (const storeName in stores) {
      const store = stores[storeName];

      const row = document.createElement("div");
      row.className = "manage-store-row";

      row.innerHTML = `
        <input type="checkbox" class="store-checkbox" data-store="${storeName}">
        <input type="text" class="store-name-input" value="${storeName}">
        <input type="text" class="store-url1-input" value="${store.searchURL1}">
        <input type="text" class="store-url2-input" value="${store.searchURL2}">
        <div class="drag-handle" draggable="true">&#9776;</div>
      `;

      container.appendChild(row);
    }

    attachManageHandlers();
    attachFlexExpandHandlers();
    enableStoreReordering();
  }

  function attachFlexExpandHandlers() {
    const inputs = document.querySelectorAll(
      "#manage-store-list .store-name-input, \
     #manage-store-list .store-url1-input, \
     #manage-store-list .store-url2-input"
    );

    inputs.forEach(input => {
      input.addEventListener("focus", () => {
        // shrink all
        inputs.forEach(i => (i.style.flex = 1));

        // expand clicked
        input.style.flex = 4;
      });

      // Optional: restore equal flex on blur
      input.addEventListener("blur", () => {
        inputs.forEach(i => (i.style.flex = 2));
      });
    });
  }

  function addStoreRow() {
    const container = document.getElementById("manage-store-list");

    const row = document.createElement("div");
    row.className = "manage-store-row";

    row.innerHTML = `
      <input type="checkbox" class="store-checkbox">
      <input type="text" class="store-name-input" placeholder="Store name">
      <input type="text" class="store-url1-input" placeholder="Search URL 1">
      <input type="text" class="store-url2-input" placeholder="Search URL 2">
      <div class="drag-handle" draggable="true">&#9776;</div>
    `;

    container.appendChild(row);
  }

  async function saveStores() {
    const t = translations[currentLang];
    const rows = document.querySelectorAll(".manage-store-row");

    const newStores = {};

    for (const row of rows) {
      const nameInput = row.querySelector(".store-name-input");
      const url1Input = row.querySelector(".store-url1-input");
      const url2Input = row.querySelector(".store-url2-input");

      const name = nameInput.value.trim();
      const url1 = url1Input.value.trim();
      const url2 = url2Input.value.trim();

      const oldName = row.querySelector(".store-checkbox")?.dataset.store;

      // 1) Completely empty new row → ignore
      const isNewRow = !oldName; // or !groceryData.stores[oldName]
      const isCompletelyEmpty = !name && !url1 && !url2;

      if (isNewRow && isCompletelyEmpty) {
        // skip this row entirely
        continue;
      }

      // 2) For all other rows, name is required
      if (!name) {
        showStatusMessage(
          currentLang === "en" ? "Store name cannot be empty." : "商店名称不能为空。",
          "error"
        );
        return;
      }

      // 3) Preserve items by old name if exists, otherwise by new name
      const sourceName = oldName || name;

      newStores[name] = {
        searchURL1: url1,
        searchURL2: url2,
        items: groceryData.stores[sourceName]?.items || []
      };
    }

    groceryData.stores = newStores;

    await syncGroceryData();
    renderStoreAndItems();

    goBack();
  }

  function deleteSelectedStores() {
    const rows = document.querySelectorAll(".manage-store-row");

    // Collect selected stores
    const selectedStores = [...rows]
      .map(row => {
        const checkbox = row.querySelector(".store-checkbox");
        return checkbox.checked ? checkbox.dataset.store : null;
      })
      .filter(Boolean);

    if (selectedStores.length === 0) return;

    // Check if any selected store has items
    for (const name of selectedStores) {
      if (groceryData.stores[name]?.items?.length > 0) {
        alert(
          currentLang === "en"
            ? `Cannot delete "${name}" because it still contains watchlist items.`
            : `无法删除 "${name}"，因为它仍包含心愿物品。`
        );
        return;
      }
    }

    // Build confirmation message
    let message = "";

    if (currentLang === "en") {
      message += `You selected ${selectedStores.length} store${selectedStores.length > 1 ? "s" : ""}.<br><br>`;
      message += `Selected stores:<br><b>${selectedStores.join(", ")}</b><br><br>`;
      message += `Confirm deletion?`;
    } else {
      message += `您选择了 ${selectedStores.length} 个商店。<br><br>`;
      message += `已选商店：<br><b>${selectedStores.join("，")}</b><br><br>`;
      message += `确认删除？`;
    }

    // Show confirmation popup
    showPopupWindow({
      title: currentLang === "en" ? "Confirm Deletion" : "确认删除",
      message,
      buttons: [
        {
          text: currentLang === "en" ? "Cancel" : "取消",
          primary: true,
          onClick: () => { }
        },
        {
          text: currentLang === "en" ? "Delete" : "删除",
          onClick: () => {
            // Perform deletion
            for (const name of selectedStores) {
              delete groceryData.stores[name];
            }

            syncGroceryData();
            renderStoreAndItems();
            renderManageGrocerySearchPage();
          }
        }
      ]
    });
  }

  function resetPresetStores() {
    for (const name in Websites) {
      const preset = Websites[name];

      if (groceryData.stores[name]) {
        // Reset URLs
        groceryData.stores[name].searchURL1 = preset.searchURL1;
        groceryData.stores[name].searchURL2 = preset.searchURL2;
      } else {
        // Append new store
        groceryData.stores[name] = {
          searchURL1: preset.searchURL1,
          searchURL2: preset.searchURL2,
          items: []
        };
      }
    }

    syncGroceryData();
    renderStoreAndItems();
    renderManageGrocerySearchPage();
  }

  function enableStoreReordering() {
    const list = document.getElementById("manage-store-list");
    let draggingRow = null;

    list.addEventListener("dragstart", e => {
      if (!e.target.classList.contains("drag-handle")) return;

      draggingRow = e.target.closest(".manage-store-row");
      draggingRow.classList.add("dragging");

      // Create ghost clone
      const ghost = draggingRow.cloneNode(true);
      ghost.style.width = `${draggingRow.offsetWidth}px`;
      ghost.style.opacity = "0.7";
      ghost.style.position = "absolute";
      ghost.style.top = "-9999px"; // off-screen

      document.body.appendChild(ghost);

      // ⭐ Keep horizontal position fixed
      const rect = draggingRow.getBoundingClientRect();
      const offsetX = e.clientX - rect.left; // cursor offset inside the row
      const offsetY = e.clientY - rect.top;

      // Anchor ghost so it stays aligned horizontally
      e.dataTransfer.setDragImage(ghost, offsetX, offsetY);

      setTimeout(() => ghost.remove(), 0);
    });

    list.addEventListener("dragend", () => {
      if (draggingRow) draggingRow.classList.remove("dragging");
      draggingRow = null;
    });

    list.addEventListener("dragover", e => {
      e.preventDefault();

      const after = getDragAfterElement(list, e.clientY);

      if (after == null) {
        list.appendChild(draggingRow);
      } else {
        list.insertBefore(draggingRow, after);
      }
    });
  }

  function getDragAfterElement(container, y) {
    const rows = [...container.querySelectorAll(".manage-store-row:not(.dragging)")];

    return rows.reduce((closest, child) => {
      const box = child.getBoundingClientRect();
      const offset = y - box.top - box.height / 2;

      if (offset < 0 && offset > closest.offset) {
        return { offset, element: child };
      } else {
        return closest;
      }
    }, { offset: Number.NEGATIVE_INFINITY }).element;
  }

  function attachManageHandlers() {
    document.getElementById("add-store-btn").onclick = addStoreRow;
    document.getElementById("save-store-btn").onclick = saveStores;
    document.getElementById("delete-store-btn").onclick = deleteSelectedStores;
    document.getElementById("reset-preset-btn").onclick = resetPresetStores;
  }
}
window.OpenGrocerySearch = OpenGrocerySearch;

document.getElementById("open-receipt-scan")
  .addEventListener("click", () => {
    openReceiptScan({ returnOnly: false });
  });

let receiptScanMode = { returnOnly: false };
window._currentReceiptFile = null;

function openReceiptScan(options = { returnOnly: false }) {
  receiptScanMode = options;
  console.log('receiptScanMode', receiptScanMode)
  showPage("scan-receipt", "Scan Receipt");
  let target = document.getElementById("scan-receipt-page");
}

document.getElementById("receipt-take-photo")
  .addEventListener("click", () => openReceiptFileInput(true));

document.getElementById("receipt-upload-photo")
  .addEventListener("click", () => openReceiptFileInput(false));

function openReceiptFileInput(useCamera) {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "image/*";

  if (useCamera) {
    input.capture = "environment";
  }

  input.onchange = () => {
    const file = input.files[0];
    if (!file) return;

    window._currentReceiptFile = file;

    document.getElementById("receipt-image").src = URL.createObjectURL(file);
    document.getElementById("receipt-processed-image").src = "";

    document.getElementById("receipt-previews").style.display = "block";

    document.getElementById("run-ocr-btn").disabled = true;
    document.getElementById("receipt-confirm-btn").style.display = "none";

    schedulePreprocessUpdate();
  };

  input.click();
}

async function preprocessImage(file, settings) {
  return new Promise((resolve) => {
    const img = new Image();
    img.src = URL.createObjectURL(file);

    img.onload = () => {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");

      canvas.width = img.width;
      canvas.height = img.height;

      // Draw original
      ctx.drawImage(img, 0, 0);

      // ALWAYS keep a clean copy of the original pixels
      const original = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const imageData = ctx.createImageData(canvas.width, canvas.height);

      const src = original.data;
      const dst = imageData.data;

      // Normalize slider values
      const brightness = 1 + (settings.brightness / 100);   // 1 = neutral
      const contrast = 1 + (settings.contrast / 100);   // 1 = neutral
      const highlights = 1 + (settings.highlights / 100);   // 1 = neutral
      const shadows = 1 + (settings.shadows / 100);   // 1 = neutral

      // Precompute contrast factor
      const c = contrast;
      const intercept = 128 * (1 - c);

      // Loop pixels
      for (let i = 0; i < src.length; i += 4) {
        // Grayscale from ORIGINAL pixels
        let gray = 0.299 * src[i] + 0.587 * src[i + 1] + 0.114 * src[i + 2];

        // Brightness
        gray *= brightness;

        // Contrast
        gray = gray * c + intercept;

        // Shadows (lift or deepen)
        if (shadows !== 1 && gray < 128) {
          gray = gray + (128 - gray) * (1 - shadows);
        }

        // Highlights (recover or boost)
        if (highlights !== 1 && gray > 128) {
          gray = gray + (gray - 128) * (highlights - 1);
        }

        gray = Math.max(0, Math.min(255, gray));

        dst[i] = dst[i + 1] = dst[i + 2] = gray;
        dst[i + 3] = 255;
      }

      ctx.putImageData(imageData, 0, 0);

      // OPTIONAL: threshold only if user wants it
      if (settings.threshold === true) {
        const threshold = otsuThreshold(dst);
        for (let i = 0; i < dst.length; i += 4) {
          const v = dst[i] < threshold ? 0 : 255;
          dst[i] = dst[i + 1] = dst[i + 2] = v;
        }
        ctx.putImageData(imageData, 0, 0);
      }

      canvas.toBlob((blob) => resolve(blob), "image/png");
    };
  });
}

function otsuThreshold(data) {
  const hist = new Array(256).fill(0);

  // Build histogram
  for (let i = 0; i < data.length; i += 4) {
    hist[data[i]]++;
  }

  const total = data.length / 4;
  let sum = 0;
  for (let i = 0; i < 256; i++) sum += i * hist[i];

  let sumB = 0;
  let wB = 0;
  let wF = 0;

  let maxVar = 0;
  let threshold = 128;

  for (let t = 0; t < 256; t++) {
    wB += hist[t];
    if (wB === 0) continue;

    wF = total - wB;
    if (wF === 0) break;

    sumB += t * hist[t];

    const mB = sumB / wB;
    const mF = (sum - sumB) / wF;

    const between = wB * wF * (mB - mF) * (mB - mF);

    if (between > maxVar) {
      maxVar = between;
      threshold = t;
    }
  }

  return threshold;
}

["brightness", "contrast", "highlights", "shadows"].forEach(id => {
  document.getElementById(id).addEventListener("input", () => {
    document.getElementById("run-ocr-btn").disabled = true;
    document.getElementById("receipt-confirm-btn").style.display = "none";
    document.getElementById("receipt-processed-image").src = "";
    schedulePreprocessUpdate();
  });
});

let preprocessTimer = null;

function schedulePreprocessUpdate() {
  clearTimeout(preprocessTimer);
  preprocessTimer = setTimeout(updateProcessedPreview, 400); // 400ms delay
}

async function updateProcessedPreview() {
  const file = window._currentReceiptFile;
  if (!file) return;

  const settings = {
    brightness: +document.getElementById("brightness").value,
    contrast: +document.getElementById("contrast").value,
    highlights: +document.getElementById("highlights").value,
    shadows: +document.getElementById("shadows").value
  };

  const processedBlob = await preprocessImage(file, settings);
  const processedUrl = URL.createObjectURL(processedBlob);

  if (window._processedUrl) {
    URL.revokeObjectURL(window._processedUrl);
  }

  document.getElementById("receipt-processed-image").src = processedUrl;
  document.getElementById("run-ocr-btn").disabled = false;

  // Save for OCR
  window._processedBlob = processedBlob;
}

document.getElementById("run-ocr-btn").onclick = async () => {
  const blob = window._processedBlob;
  if (!blob) return;

  await runReceiptOCR(blob);
};

async function runReceiptOCR(processedBlob) {
  document.getElementById("receipt-confirm-btn").style.display = "none";

  const resultsBox = document.getElementById("receipt-ocr-results");
  resultsBox.innerHTML = "Recognizing…";

  const { data: { text: rawText } } = await Tesseract.recognize(processedBlob, "eng", {
    tessedit_char_whitelist: "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz.$:/-%() ",
    preserve_interword_spaces: "1",
    user_defined_dpi: "300",
    tessedit_pageseg_mode: "6",
    tessedit_char_blacklist: "|{}[]<>",
  });

  // STEP 1 — Correct the OCR text
  const correctedText = correctOCRText(rawText);

  // STEP 2 — Parse the corrected text
  const parsed = parseCorrectedText(correctedText);

  // STEP 3 — Display everything
  resultsBox.innerHTML = `
    <div><strong>Merchant:</strong> ${parsed.merchant || "-"}</div>
    <div><strong>Date:</strong> ${parsed.date || "-"}</div>

    <div style="margin-top:1rem;"><strong>Parsed Items:</strong></div>
    <pre style="white-space:pre-wrap;">${JSON.stringify(parsed.items, null, 2)}</pre>

    <div style="margin-top:1rem;"><strong>Discounts:</strong></div>
    <pre style="white-space:pre-wrap;">${JSON.stringify(parsed.discounts, null, 2)}</pre>

    <div style="margin-top:1rem;"><strong>Taxes:</strong></div>
    <pre style="white-space:pre-wrap;">${JSON.stringify(parsed.taxes, null, 2)}</pre>

    <div style="margin-top:1rem;"><strong>Fees:</strong></div>
    <pre style="white-space:pre-wrap;">${JSON.stringify(parsed.fees, null, 2)}</pre>

    <div><strong>Total:</strong> ${parsed.total || "-"}</div>

    <div style="margin-top:1rem;"><strong>Corrected Text:</strong></div>
    <pre style="white-space:pre-wrap; font-size:0.9em;">
  ${correctedText}
    </pre>

    <div style="margin-top:1rem;"><strong>Raw OCR Text:</strong></div>
    <pre style="white-space:pre-wrap; font-size:0.9em;">
  ${rawText}
    </pre>
  `;

  window._receiptParsed = parsed;

  document.getElementById("receipt-confirm-btn").style.display = "block";
}

function correctOCRText(raw) {
  return raw
    // Fix kg variants: ke, ks, k9, 1b, Ib, |b → kg
    .replace(/\b(k[e9s]|1b|Ib|\|b)\b/gi, "kg")

    // Fix decimals: "1. 38" → "1.38"
    .replace(/(\d)\.\s+(\d)/g, "$1.$2")

    // Fix decimals: "1 .38" → "1.38"
    .replace(/(\d)\s*\.\s*(\d{2})/g, "$1.$2")

    // Fix "$1. 52" → "$1.52"
    .replace(/\$\s*(\d)\.\s*(\d{2})/g, "\$$1.$2")

    // Fix "/ kg" → "/kg"
    .replace(/\s*\/\s*(kg|lb)/gi, "/$1")

    // Fix "@  $1.52" → "@ $1.52"
    .replace(/\@\s*\$/g, "@ $")

    // Remove garbage characters
    .replace(/[^\w\s\.\@\$\-\/]/g, " ")

    // Collapse spaces
    .replace(/[ \t]+/g, " ")

    .trim();
}

function parseCorrectedText(text) {
  console.log('Corrected OCR text to parse: ', text)
  const lines = text.split("\n").map(l => l.trim()).filter(Boolean);

  let date = null;
  const items = [];
  const discounts = [];
  const taxes = [];
  const fees = [];
  let total = null;
  let merchant = null;
  let pendingName = null;

  for (const line of lines) {
    let trimmedLine = line.trim();
    let m;

    // Skip obvious non-item / summary lines
    if (/MASTERCARD|VISA|DEBIT|CREDIT|ACCOUNT|COPY/i.test(trimmedLine)) continue;

    // Date detection
    m = trimmedLine.match(/\b(\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2}|\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}|[A-Za-z]{3,9}\s+\d{1,2},?\s+\d{2,4})\b/);
    if (m) {
      date = m[1];
      continue;
    }

    // 1) Weight item: allow "kg Net", "kg Gross", "kg Tare", etc.
    m = trimmedLine.match(/^(.*?)(?:\s+)?([\d.]+)\s*(kg|lb).*@\s*\$?([\d.]+)\/(kg|lb).*?\$?([\d.]+)(?:\s*[A-Za-z ]+)?$/i);
    if (m) {
      let namePart = m[1].trim();
      // If name is pure number, try using pendingName instead

      if (/^\d+$/.test(namePart) && pendingName) {
        namePart = pendingName.trim();
      }

      items.push({
        name: namePart || pendingName || "",
        quantity: `${m[2]} ${m[3]}`,
        unit_price: `$${parseFloat(m[4]).toFixed(2)}/${m[5]}`,
        item_total: parseFloat(m[6])
      });

      pendingName = null;
      continue;
    }

    // 2.1) Count item: Divisor format: "2 @2/$1.87 W 1.87"
    m = trimmedLine.match(/^(.*?)(\d+)\s*@\s*.*?(\d+(?:\.\d+)?\/\$?\d+\.\d{2}).*?\$?(\d+\.\d{2})?(?:\s*[A-Za-z ]+)?$/i);
    if (m) {
      let namePart = m[1].trim();

      if (/^\d+(\.\d+)?$/.test(namePart)) {
        namePart = pendingName || "";
      }

      let unitExpr = m[3];   // "2/$1.87"
      let unit_price_each = null;
      let priceForDivisor = null;

      if (unitExpr.includes("/")) {
        const cleaned = unitExpr.replace("$", "");  // "2/1.87"
        const [divisorStr, priceStr] = cleaned.split("/");

        const divisor = parseFloat(divisorStr);
        priceForDivisor = parseFloat(priceStr);

        if (!isNaN(divisor) && !isNaN(priceForDivisor) && divisor > 0) {
          unit_price_each = priceForDivisor / divisor;
        }
      }

      items.push({
        name: namePart,
        quantity: parseInt(m[2], 10),
        unit_price: unit_price_each,  // 0.935
        unit_price_string: unitExpr, // "2/$1.87"
        item_total: parseFloat(m[4]) || priceForDivisor  // final price
      });

      pendingName = null;
      continue;
    }


    // 2.2) Count item: "6 @ 0.45 2.70"
    m = trimmedLine.match(/^(.*?)(\d+)\s*@\s*\$?(\d+(?:\.\d+)?).*?\$?(\d+\.\d{2})(?:\s*[A-Za-z ]+)?$/i);
    if (m) {
      let namePart = m[1].trim();

      if (/^\d+(\.\d+)?$/.test(namePart)) {
        namePart = pendingName || "";
      }

      items.push({
        name: namePart || pendingName || "",
        quantity: parseInt(m[2], 10),
        unit_price: m[3],
        item_total: parseFloat(m[4])
      });

      pendingName = null;
      continue;
    }

    // 3) Discount / loyalty
    if (/(LOYALTY|SAVINGS|DISCOUNT|COUPON|P[O0]INTS|PT[S5]|redem(p|ption)?|redeem)/i.test(trimmedLine)) {
      discounts.push(trimmedLine);
      continue;
    }

    // 4) Tax
    if (/(HST|GST|PST|TAX)/i.test(trimmedLine)) {
      taxes.push(trimmedLine);
      continue;
    }

    // 5) Fees
    if (/(fee)/i.test(trimmedLine)) {
      fees.push(trimmedLine);
      continue;
    }

    // 6) Total (but don't treat as item)
    m = trimmedLine.match(/(TOTAL|AMOUNT DUE|GRAND TOTAL).*?\$?([\d.]+)(?:\s*[A-Za-z ]+)?$/i);
    if (m) {
      total = parseFloat(m[2]);
      continue;
    }

    // 7) other items that end with a number
    m = trimmedLine.match(/^(?:\d+\s+)?(.+?)\s*\$?(\d+\.\d{2}).*$/i);
    if (m) {
      let name = m[1].trim();

      // If name is pure number, try using pendingName instead
      if (/^\d+$/.test(name) && pendingName) {
        name = pendingName.trim();
        pendingName = null;
      }

      // Skip if name is exactly "master"
      if (name.toLowerCase() === "master") continue;

      items.push({
        name,
        item_total: parseFloat(m[2])
      });

      continue;
    }

    // if a line doesn't meet above rules but meets below rules, take it as a pending name
    if (
      /^[A-Za-z].{2,}/.test(trimmedLine) &&   // starts with a letter
      !/\d/.test(trimmedLine) &&              // contains NO digits
      !/^=/.test(trimmedLine) &&              // does NOT begin with "="
      !/=$/.test(trimmedLine)                 // does NOT end with "="
    ) {
      if (!merchant) {
        merchant = trimmedLine.trim();
      } else {
        pendingName = trimmedLine.trim();
      }
      continue;
    }
  }

  return { merchant, date, items, discounts, taxes, fees, total };
}

function cleanName(str) {
  return str
    .replace(/[^A-Za-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

document.getElementById("receipt-confirm-btn")
  .addEventListener("click", () => {
    const data = window._receiptParsed;

    if (!receiptScanMode.returnOnly) {
      // Standalone mode → go to create page
      let entryData = applyReceiptToWorkspace("create", null, data);
      goBack();
      goBack();

      loadEntryIntoWorkspace(entryData);

    } else {
      // Inline mode → return to existing transaction
      closeReceiptScan();
      let entryData = applyReceiptToWorkspace("transaction", latestOptions.transactionId, data);
      goBack();

      const ws = workspace.transactions[latestOptions.transactionId];
      switchTab(ws.inputTypeIndex);
    }
  });

function closeReceiptScan() {
  goBack();
}

function applyReceiptToWorkspace(mode, transactionId, data) {
  let ws;
  let entryId;
  let entryData;

  if (mode === "create") {

    // instead, make an entry
    const now = new Date();

    entryId =
      String(now.getFullYear()) +
      String(now.getMonth() + 1).padStart(2, "0") +
      String(now.getDate()).padStart(2, "0") +
      String(now.getHours()).padStart(2, "0") +
      String(now.getMinutes()).padStart(2, "0") +
      String(now.getSeconds()).padStart(2, "0") +
      Math.floor(Math.random() * 1_000_000)
        .toString()
        .padStart(6, "0");

    if (!workspace.transactions[entryId]) { // initialize
      workspace.transactions[entryId] = {};

      workspace.transactions[entryId].entryId = entryId;
      workspace.transactions[entryId].inputTypeIndex = 0;
      workspace.transactions[entryId].inputType = transactionTypes[0]; // start with expense
      workspace.transactions[entryId].amount = 0;
      workspace.transactions[entryId].calculation = "";
      workspace.transactions[entryId].tags = [];
      workspace.transactions[entryId].notes = "";
      const activeForm = workspace.transactions[entryId].inputType + "-form";
      let dateTimeBtn = document.querySelector(`#${activeForm} .selector-button[data-type='datetime']`);
      let householdBtn = document.querySelector(`#${activeForm} .selector-button[data-type='household']`);
      let categoryBtn = document.querySelector(`#${activeForm} .selector-button[data-type='category']`);
      let accountBtn = document.querySelector(`#${activeForm} .selector-button[data-type='account']`);
      let subjectBtn = document.querySelector(`#${activeForm} .selector-button[data-type='subject']`);
      let collectionBtn = document.querySelector(`#${activeForm} .selector-button[data-type='collection']`);

      setCurrentTime(dateTimeBtn, workspace.transactions[entryId]);
      setDefaultLedger(householdBtn, workspace.transactions[entryId]);
      setDefaultCategory(categoryBtn, workspace.transactions[entryId]);
      setDefaultAccount(accountBtn, workspace.transactions[entryId]);
      setDefaultSubject(subjectBtn, workspace.transactions[entryId]);
      setDefaultCollection(collectionBtn, workspace.transactions[entryId]);
    }
    ws = workspace.transactions[entryId];
  } else {
    ws = workspace.transactions[transactionId];
  }

  // -----------------------------
  // Insert OCR fields into workspace
  // -----------------------------

  // Date → inputTransactionTime
  if (data.date) {
    ws.inputTransactionTime = normalizeDate(data.date);

    const [yyyy, mm, dd, hh, min, ss] = parseDateFromString(ws.inputTransactionTime);

    if (!ws.inputTransactionTimeRaw) { ws.inputTransactionTimeRaw = {}; }

    ws.inputTransactionTimeRaw.yyyy = Number(yyyy);
    ws.inputTransactionTimeRaw.mm = Number(mm);
    ws.inputTransactionTimeRaw.dd = Number(dd);
    ws.inputTransactionTimeRaw.hh = Number(hh);
    ws.inputTransactionTimeRaw.min = Number(min);
    ws.inputTransactionTimeRaw.ss = Number(ss);
  }

  // Total → amount
  if (data.total) {
    ws.amount = parseFloat(data.total);
  }

  // Items → append to notes or custom field
  if (data.items && data.items.length > 0) {
    ws.items = data.items.map(i => ({
      name: i.name || "",
      unitPrice: i.unit_price || i.item_total || "",
      price: i.item_total || ""
    }));
  }

  if (data.merchant) {
    ws.notes = (ws.notes || "") + "\n" + data.merchant;
  }

  if (mode === "create") {
    const inputType = ws.inputType;

    const base = {
      entryId,
      type: inputType,
      amount: ws.amount ?? 0,
      repoId: ws[inputType].repoId,
      transactionTime: ws.inputTransactionTime,   // you can set this earlier
      tags: ws.tags ?? [],
      notes: ws.notes ?? "",
      createdTimestamp: getFormattedTime(),
      lastModifiedTimestamp: getFormattedTime()
    };

    if (inputType === "expense" || inputType === "income") {
      entryData = {
        ...base,
        primaryCategory: ws[inputType].primaryCategory,
        secondaryCategory: ws[inputType].secondaryCategory,
        account: ws[inputType].accountInfo.account.name,
        currency: ws[inputType].accountInfo.account.currency,
        subject: ws[inputType].subject,
        collection: ws[inputType].collection
      };
    } else if (inputType === "transfer") {
      entryData = {
        ...base,
        toAmount: ws[inputType].toAmount ?? 0,
        sameCurrency: ws[inputType].sameCurrency,
        fromAccount: ws[inputType].fromAccountInfo.account.name,
        fromCurrency: ws[inputType].fromAccountInfo.account.currency,
        toAccount: ws[inputType].toAccountInfo.account.name,
        toCurrency: ws[inputType].toAccountInfo.account.currency
      };
    } else if (inputType === "balance") {
      entryData = {
        ...base,
        account: ws[inputType].accountInfo.account.name,
        currency: ws[inputType].accountInfo.account.currency
      };
    }
  } else {
    entryData = null;
  }

  return entryData
}

function normalizeDate(raw) {
  // Convert 2024/05/31 or 05-31-2024 → YYYY-MM-DD HH:mm
  const d = new Date(raw);
  return d.toISOString().slice(0, 16).replace("T", " ");
}

function OpenInterestRateCal() {
  showPage("interest-rate-cal", "利率计算");
  buildInterestRateCalHome();

  // ---------- UI BUILDERS ----------

  function getCalScroll() {
    return document.getElementById("interest-rate-cal-scroll");
  }

  function buildInterestRateCalHome() {
    const scroll = getCalScroll();
    scroll.innerHTML = `
      <div id="mode-selector"></div>
      <div id="mode-content"></div>
    `;

    const selector = document.getElementById("mode-selector");
    selector.innerHTML = "";

    const grid = document.createElement("div");
    grid.className = "ir-mode-grid";
    selector.appendChild(grid);

    grid.appendChild(createModeButton("1）基于账本数据", loadMode1));
    grid.appendChild(createModeButton("2）基于每日余额", loadMode2));
    grid.appendChild(createModeButton("3）基于每日变动", loadMode3));
  }

  function createModeButton(text, onClick) {
    const btn = document.createElement("button");
    btn.className = "big-button";
    btn.type = "button";
    btn.textContent = text;
    btn.addEventListener("click", onClick);
    return btn;
  }

  function makeInstructions(text) {
    const div = document.createElement("div");
    div.className = "ir-instructions";
    div.innerHTML = text;
    return div;
  }

  function makeLabel(text) {
    const div = document.createElement("div");
    div.className = "label";
    div.textContent = text;
    return div;
  }

  function makeInput(type, placeholder = "") {
    const input = document.createElement("input");
    input.type = type;
    input.placeholder = placeholder;
    input.className = "text-input";

    input.autocomplete = "off";
    input.autocorrect = "off";
    input.autocapitalize = "off";
    input.spellcheck = false;

    return input;
  }

  function enableAutoAdvance(input, containerSelector, makeNewRow) {
    input.addEventListener("keydown", e => {
      if (e.key !== "Enter") return;

      const container = document.querySelector(containerSelector);
      const inputs = Array.from(container.querySelectorAll("input"));
      const index = inputs.indexOf(input);

      // Case 0: If this is a date input and it's empty → fill today immediately
      if (input.classList.contains("row-date") && !input.value) {
        input.value = new Date().toISOString().slice(0, 10);
      }

      // Case 1: Not last input → move to next input inside this container only
      if (index < inputs.length - 1) {
        inputs[index + 1].focus();
        return;
      }

      // Case 2: Last input → create new row
      e.preventDefault();

      const newRow = makeNewRow();
      container.appendChild(newRow);

      // Auto-fill date of new row
      const dateInput = newRow.querySelector(".row-date");
      const rows = Array.from(container.children);
      const rowIndex = rows.indexOf(newRow);

      if (rowIndex > 0) {
        const prevDate = rows[rowIndex - 1].querySelector(".row-date").value;
        dateInput.value = prevDate || new Date().toISOString().slice(0, 10);
      } else {
        dateInput.value = new Date().toISOString().slice(0, 10);
      }

      // Focus the date input of the new row
      dateInput.focus();
    });
  }

  // ---------- MODE 1 (PLACEHOLDER) ----------

  function loadMode1() {
    const content = document.getElementById("mode-content");
    content.innerHTML = "";

    const card = document.createElement("div");
    card.className = "ir-card";
    content.appendChild(card);

    const title = document.createElement("div");
    title.className = "section-title";
    title.textContent = "1) 基于账本数据";
    card.appendChild(title);

    card.appendChild(makeInstructions(`
      此模式将根据账本自动计算指定月份的日均余额和利率。<br>
      功能尚未完成。
    `));

    const msg = document.createElement("div");
    msg.style.color = "#666";
    msg.textContent = "此模式尚未实现。";
    card.appendChild(msg);
  }

  // ---------- MODE 2 (DAILY BALANCE) ----------

  function loadMode2() {
    const content = document.getElementById("mode-content");
    content.innerHTML = "";

    const card = document.createElement("div");
    card.className = "ir-card";
    content.appendChild(card);

    const title = document.createElement("div");
    title.className = "section-title";
    title.textContent = "2) 基于每日余额";
    card.appendChild(title);

    card.appendChild(makeInstructions(`
      请输入从开始日到结束日之间的每日余额。<br>
      只需填写“余额发生变化的日期”。<br>
      第一行的日期视为开始日期，最后一行视为结束日期。<br>
      空白行将自动跳过。
    `));

    const rowsContainer = document.createElement("div");
    rowsContainer.id = "mode2-balance-rows";
    rowsContainer.className = "ir-section";
    card.appendChild(rowsContainer);

    rowsContainer.appendChild(makeBalanceLine());

    const addBtn = document.createElement("button");
    addBtn.className = "big-button ir-add-btn";
    addBtn.textContent = "＋ 添加一行";
    addBtn.onclick = () => rowsContainer.appendChild(makeBalanceLine());
    card.appendChild(addBtn);

    const interestLabel = makeLabel("收到的利息");
    card.appendChild(interestLabel);

    const interestInput = makeInput("number", "例如：35.27");
    interestInput.step = "0.01";
    card.appendChild(interestInput);

    const calcBtn = document.createElement("button");
    calcBtn.className = "big-button primary-btn";
    calcBtn.textContent = "计算利率";
    calcBtn.onclick = () => {
      const rows = collectBalanceRows(rowsContainer);
      if (!rows) return;
      const result = calculateFromDailyBalances(rows, interestInput.value);
      if (result) showInterestResult(result);
    };
    card.appendChild(calcBtn);
  }

  function makeBalanceLine() {
    const line = document.createElement("div");
    line.className = "ir-field-line";

    const dateInput = makeInput("date");
    dateInput.classList.add("row-date");
    enableAutoAdvance(dateInput, "#mode2-balance-rows", makeBalanceLine);

    const balInput = makeInput("number", "余额");
    balInput.step = "0.01";
    balInput.classList.add("row-balance");
    enableAutoAdvance(balInput, "#mode2-balance-rows", makeBalanceLine);

    const delBtn = document.createElement("button");
    delBtn.textContent = "–";
    delBtn.className = "delete-row-btn";
    delBtn.style.color = "white";
    delBtn.style.background = "red";
    delBtn.style.border = "none";
    delBtn.style.borderRadius = "4px";
    delBtn.style.padding = "0 8px";
    delBtn.style.marginLeft = "6px";
    delBtn.style.cursor = "pointer";

    delBtn.addEventListener("click", () => {
      line.remove();
    });

    line.appendChild(dateInput);
    line.appendChild(balInput);
    line.appendChild(delBtn);

    return line;
  }

  function collectBalanceRows(container) {
    const rows = [];
    const lines = Array.from(container.children);

    for (const line of lines) {
      const dateInput = line.querySelector(".row-date");
      const balInput = line.querySelector(".row-balance");

      const date = dateInput.value.trim();
      const bal = balInput.value.trim();

      // Case 1: both empty → skip
      if (date === "" && bal === "") continue;

      // Case 2: one empty → error
      if (date === "" || bal === "") {
        showStatusMessage("请完整填写日期和余额，或留空整行。");
        return null;
      }

      // Case 3: valid row
      rows.push({
        date,
        balance: Number(bal)
      });
    }

    rows.sort((a, b) => new Date(a.date) - new Date(b.date));
    return rows;
  }

  // ---------- MODE 3 (DAILY CHANGE) ----------

  function makeMode3MethodSelector() {
    const div = document.createElement("div");
    div.className = "ir-selector-block";

    div.innerHTML = `
      <div class="label">请选择计算方式（二选一）</div>

      <label class="ir-radio">
        <input type="radio" name="m3method" value="start" checked>
        <span>输入第一天的期初余额</span>
      </label>

      <label class="ir-radio">
        <input type="radio" name="m3method" value="end">
        <span>输入最后一天的期末余额</span>
      </label>
    `;

    return div;
  }

  function loadMode3() {
    const content = document.getElementById("mode-content");
    content.innerHTML = "";

    const card = document.createElement("div");
    card.className = "ir-card";
    content.appendChild(card);

    const title = document.createElement("div");
    title.className = "section-title";
    title.textContent = "3) 基于每日变动模式";
    card.appendChild(title);

    card.appendChild(makeInstructions(`
      请输入第一天初始余额，并填写每天的变动金额（+/-）。<br>
      只需填写“有变动的日期”。<br>
      第一行的日期视为开始日期，最后一行视为结束日期。<br>
      空白行将自动跳过。
    `));

    card.appendChild(makeMode3MethodSelector());

    // Start balance input
    const startBalanceLabel = makeLabel("期初余额（仅在选择“期初”时填写）");
    card.appendChild(startBalanceLabel);

    const startBalanceInput = makeInput("number", "例如：10000");
    startBalanceInput.step = "0.01";
    card.appendChild(startBalanceInput);

    // End balance input
    const endBalanceLabel = makeLabel("期末余额（仅在选择“期末”时填写）");
    card.appendChild(endBalanceLabel);

    const endBalanceInput = makeInput("number", "例如：15000");
    endBalanceInput.step = "0.01";
    card.appendChild(endBalanceInput);

    // Change rows
    card.appendChild(makeLabel("每日变动（仅输入有变动的日期，但必须包括第一天和最后一天）"));

    const rowsContainer = document.createElement("div");
    rowsContainer.id = "mode3-change-rows";
    rowsContainer.className = "ir-section";
    card.appendChild(rowsContainer);

    rowsContainer.appendChild(makeChangeLine());

    const addBtn = document.createElement("button");
    addBtn.className = "big-button ir-add-btn";
    addBtn.textContent = "＋ 添加一行";
    addBtn.onclick = () => rowsContainer.appendChild(makeChangeLine());
    card.appendChild(addBtn);

    // Interest
    card.appendChild(makeLabel("收到的利息"));
    const interestInput = makeInput("number", "例如：35.27");
    interestInput.step = "0.01";
    card.appendChild(interestInput);

    // Calculate button
    const calcBtn = document.createElement("button");
    calcBtn.className = "big-button primary-btn";
    calcBtn.textContent = "计算利率";
    calcBtn.onclick = () => {
      const method = document.querySelector('input[name="m3method"]:checked').value;

      const changeRows = collectChangeRows(rowsContainer);
      if (!changeRows) return;

      let balanceRows;

      if (method === "start") {
        if (startBalanceInput.value === "") {
          showStatusMessage("请选择期初方式并填写期初余额。");
          return;
        }
        if (endBalanceInput.value !== "") {
          showStatusMessage("请不要同时填写期初和期末余额。");
          return;
        }

        balanceRows = convertChangesForward(startBalanceInput.value, changeRows);

      } else {
        if (endBalanceInput.value === "") {
          showStatusMessage("请选择期末方式并填写期末余额。");
          return;
        }
        if (startBalanceInput.value !== "") {
          showStatusMessage("请不要同时填写期初和期末余额。");
          return;
        }

        balanceRows = convertChangesBackward(endBalanceInput.value, changeRows);
      }

      if (!balanceRows) return;

      const result = calculateFromDailyBalances(balanceRows, interestInput.value);
      if (result) {
        result.openingBalance = balanceRows[0].balance;
        result.closingBalance = balanceRows[balanceRows.length - 1].balance;
        showInterestResult(result);
      }

    };
    card.appendChild(calcBtn);
  }

  function makeChangeLine() {
    const line = document.createElement("div");
    line.className = "ir-field-line";

    const dateInput = makeInput("date");
    dateInput.classList.add("row-date");

    const changeInput = makeInput("number", "变动金额（+/-）");
    changeInput.step = "0.01";
    changeInput.classList.add("row-change");

    // Delete button
    const delBtn = document.createElement("button");
    delBtn.textContent = "–";
    delBtn.className = "delete-row-btn";
    delBtn.style.color = "white";
    delBtn.style.background = "red";
    delBtn.style.border = "none";
    delBtn.style.borderRadius = "4px";
    delBtn.style.padding = "0 8px";
    delBtn.style.marginLeft = "6px";
    delBtn.style.cursor = "pointer";
    delBtn.addEventListener("click", () => line.remove());

    enableAutoAdvance(dateInput, "#mode3-change-rows", makeChangeLine);
    enableAutoAdvance(changeInput, "#mode3-change-rows", makeChangeLine);

    line.appendChild(dateInput);
    line.appendChild(changeInput);
    line.appendChild(delBtn);

    return line;
  }

  function collectChangeRows(container) {
    const rows = [];
    const lines = Array.from(container.children);

    for (const line of lines) {
      const dateInput = line.querySelector(".row-date");
      const changeInput = line.querySelector(".row-change");

      const date = dateInput.value.trim();
      const change = changeInput.value.trim();

      // Case 1: both empty → skip
      if (date === "" && change === "") continue;

      // Case 2: one empty → error
      if (date === "" || change === "") {
        showStatusMessage("请完整填写日期和变动金额，或留空整行。");
        return null;
      }

      // Case 3: valid row
      rows.push({
        date,
        change: Number(change)
      });
    }

    rows.sort((a, b) => new Date(a.date) - new Date(b.date));
    return rows;
  }

  function convertChangesForward(startBalance, changeRows) {
    let current = Number(startBalance);
    const result = [];

    for (const row of changeRows) {
      current += row.change;
      result.push({ date: row.date, balance: current });
    }

    return result;
  }

  function convertChangesBackward(endBalance, changeRows) {
    let current = Number(endBalance);
    const result = [];

    // Walk backwards
    for (let i = changeRows.length - 1; i >= 0; i--) {
      result.push({ date: changeRows[i].date, balance: current });
      current -= changeRows[i].change;
    }

    // Reverse to chronological order
    result.reverse();
    return result;
  }

  // ---------- SHARED CALCULATION ----------

  function calculateFromDailyBalances(balanceRows, interestStr) {
    if (!balanceRows || balanceRows.length === 0) {
      showStatusMessage("请至少输入一行余额数据。");
      return null;
    }

    // sort rows by date
    balanceRows.sort((a, b) => new Date(a.date) - new Date(b.date));

    const startDate = new Date(balanceRows[0].date);
    const endDate = new Date(balanceRows[balanceRows.length - 1].date);

    const interest = Number(interestStr);
    if (!Number.isFinite(interest)) {
      showStatusMessage("请填写有效的利息金额。");
      return null;
    }

    // 总天数：首尾都算进去（左闭右闭）
    const totalDays = diffDays(startDate, addDays(endDate, 1));

    let weightedSum = 0;

    for (let i = 0; i < balanceRows.length; i++) {
      const currentDate = new Date(balanceRows[i].date);
      const currentBalance = balanceRows[i].balance;

      let nextDate;
      if (i + 1 < balanceRows.length) {
        // 到下一条记录的前一天为止 → nextDate 本身不算
        nextDate = new Date(balanceRows[i + 1].date);
      } else {
        // 最后一段：到 endDate 当天为止 → 用 endDate+1 做右开端点
        nextDate = addDays(endDate, 1);
      }

      const days = diffDays(currentDate, nextDate); // 左闭右开
      // console.log(currentDate, nextDate, days);
      weightedSum += currentBalance * days;
    }

    const avgDailyBalance = weightedSum / totalDays;
    const dailyRate = interest / (totalDays * avgDailyBalance);

    const year = startDate.getFullYear();
    const annualFactor = isLeapYear(year) ? 366 : 365;
    const annualRate = dailyRate * annualFactor;

    return {
      totalDays,
      avgDailyBalance,
      dailyRate,
      annualRate
    };
  }

  function addDays(d, n) {
    const r = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    r.setDate(r.getDate() + n);
    return r;
  }

  function diffDays(d1, d2) {
    const msPerDay = 24 * 60 * 60 * 1000;
    const t1 = Date.UTC(d1.getFullYear(), d1.getMonth(), d1.getDate());
    const t2 = Date.UTC(d2.getFullYear(), d2.getMonth(), d2.getDate());
    return Math.floor((t2 - t1) / msPerDay); // 不含 d2 当天
  }

  function isLeapYear(y) {
    return (y % 4 === 0 && y % 100 !== 0) || (y % 400 === 0);
  }

  // ---------- RESULT DISPLAY ----------
  function showInterestResult(result) {
    const content = document.getElementById("mode-content");

    const old = content.querySelector(".ir-result");
    if (old) old.remove();

    const box = document.createElement("div");
    box.className = "ir-result";

    box.innerHTML = `
    <b>期初余额：</b> ${result.openingBalance.toFixed(2)}<br>
    <b>期末余额：</b> ${result.closingBalance.toFixed(2)}<br><br>

    总天数：${result.totalDays}<br>
    平均每日余额：${result.avgDailyBalance.toFixed(2)}<br>
    日利率：${(result.dailyRate * 100).toFixed(6)}%<br>
    年化利率：${(result.annualRate * 100).toFixed(4)}%
  `;

    content.appendChild(box);
    showStatusMessage("计算完成。");
  }
}
window.OpenInterestRateCal = OpenInterestRateCal;