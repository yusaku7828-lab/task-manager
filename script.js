import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js";
import { getFirestore, collection, doc, setDoc, onSnapshot, updateDoc, deleteDoc, writeBatch, getDoc, getDocs } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyBa7hj2O79rLa80iD6AI06BFoltQhLX0Xk",
    authDomain: "my-task-app2026.firebaseapp.com",
    projectId: "my-task-app2026",
    storageBucket: "my-task-app2026.firebasestorage.app",
    messagingSenderId: "891160871150",
    appId: "1:891160871150:web:a077f75c8b2d62fbdbf3ff"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

let currentUser = null;
let categories = [];
let templates = [];
let masterTasks = []; 
let appUsers = [];
let currentView = 'important';
let openedAccordions = {};
let showReflected = false;
let logoSettings = { imageUrl: '', linkUrl: '' };
let definedLabels = [];
let manuals = [];

let unsubs = { 
    categoriesList: null, // サイドバー用（全件監視だが、頻度は低い）
    activePage: null,     // ★追加：現在開いているページ単体の監視用
    settingsCommon: null, 
    settingsMaster: null, 
    manualsList: null     // マニュアル一覧用
};
let historyStack = [];
let historyIndex = -1;
let isUndoRedoing = false;
const MAX_HISTORY = 50;

let settingsScrollPos = 0;
let isRendering = false;
let savedEditorRange = null; // エディタカーソル位置保存用

// ■SVGアイコン定義
const ICONS = {
    pin: `<svg class="svg-icon" viewBox="0 0 24 24"><path d="M16 9V4h1c.55 0 1-.45 1-1s-.45-1-1-1H7c-.55 0-1 .45-1 1s.45 1 1 1h1v5c0 1.66-1.34 3-3 3v2h5.97v7l1 1 1-1v-7H19v-2c-1.66 0-3-1.34-3-3z"/></svg>`,
    settings: `<svg class="svg-icon" viewBox="0 0 24 24"><path d="M19.43 12.98c.04-.32.07-.64.07-.98s-.03-.66-.07-.98l2.11-1.65c.19-.15.24-.42.12-.64l-2-3.46c-.12-.22-.39-.3-.61-.22l-2.49 1c-.52-.4-1.08-.73-1.69-.98l-.38-2.65C14.46 2.18 14.25 2 14 2h-4c-.25 0-.46.18-.49.41l-.38 2.65c-.61.25-1.17.59-1.69.98l-2.49-1c-.23-.09-.49 0-.61.22l-2 3.46c-.13.22-.07.49.12.64l2.11 1.65c-.04.32-.07.65-.07.98s.03.66.07.98l-2.11 1.65c-.19.15-.24.42-.12.64l2 3.46c.12.22.39.3.61.22l2.49-1c.52.4 1.08.73 1.69.98l.38 2.65c.03.23.24.41.49.41h4c.25 0 .46-.18.49-.41l.38-2.65c.61-.25 1.17-.59 1.69-.98l2.49 1c.23.09.49 0 .61-.22l2-3.46c.12-.22.07-.49-.12-.64l-2.11-1.65zM12 15.5c-1.93 0-3.5-1.57-3.5-3.5s1.57-3.5 3.5-3.5 3.5 1.57 3.5 3.5-1.57 3.5-3.5 3.5z"/></svg>`,
    link: `<svg class="svg-icon" viewBox="0 0 24 24"><path d="M3.9 12c0-1.71 1.39-3.1 3.1-3.1h4V7H7c-2.76 0-5 2.24-5 5s2.24 5 5 5h4v-1.9H7c-1.71 0-3.1-1.39-3.1-3.1zM8 13h8v-2H8v2zm9-6h-4v1.9h4c1.71 0 3.1 1.39 3.1 3.1s-1.39 3.1-3.1 3.1h-4V17h4c2.76 0 5-2.24 5-5s-2.24-5-5-5z"/></svg>`,
   /* ■修正：メモアイコンをノート型に変更 */
    memo: `<svg class="svg-icon" viewBox="0 0 24 24"><path d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/></svg>`,
    manual: `<svg class="svg-icon" viewBox="0 0 24 24"><path d="M4 6H2v14c0 1.1.9 2 2 2h14v-2H4V6zm16-4H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-1 9H9V9h10v2zm-4 4H9v-2h6v2zm4-8H9V5h10v2z"/></svg>`,
    wrench: `<svg class="svg-icon" viewBox="0 0 24 24"><path d="M22.7 19l-9.1-9.1c.9-2.3.4-5-1.5-6.9-2-2-5-2.4-7.4-1.3L9 6 6 9 1.6 4.7C.4 7.1.9 10.1 2.9 12.1c1.9 1.9 4.6 2.4 6.9 1.5l9.1 9.1c.4.4 1 .4 1.4 0l2.3-2.3c.5-.4.5-1.1.1-1.4z"/></svg>`,
    search: `<svg class="svg-icon" viewBox="0 0 24 24"><path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/></svg>`,
    clock: `<svg class="svg-icon" viewBox="0 0 24 24"><path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z"/></svg>`,
    bell: `<svg class="svg-icon" viewBox="0 0 24 24"><path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6v-5c0-3.07-1.63-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.64 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2zm-2 1H8v-6c0-2.48 1.51-4.5 4-4.5s4 2.02 4 4.5v6z"/></svg>`,
};

// ■LocalStorage
const RECENT_KEY = 'taskApp_recentPages';
const RECENT_MAX = 5;
const RECENT_OPEN_KEY = 'taskApp_recentOpen';
const PINNED_KEY = 'taskApp_pinnedPages'; 

function formatDate(isoString) {
    if (!isoString) return '';
    const date = new Date(isoString);
    return `${String(date.getMonth()+1).padStart(2,'0')}/${String(date.getDate()).padStart(2,'0')} ${String(date.getHours()).padStart(2,'0')}:${String(date.getMinutes()).padStart(2,'0')}`;
}
function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[m]);
}

function saveHistory(catId, itemsBefore, itemsAfter) {
    if (isUndoRedoing) return;
    if (historyIndex < historyStack.length - 1) historyStack = historyStack.slice(0, historyIndex + 1);
    historyStack.push({ type: 'itemsDelete', categoryId: catId, beforeState: JSON.parse(JSON.stringify(itemsBefore)), afterState: JSON.parse(JSON.stringify(itemsAfter)), timestamp: Date.now() });
    historyIndex = historyStack.length - 1;
    if (historyStack.length > MAX_HISTORY) { historyStack.shift(); historyIndex = historyStack.length - 1; }
}
function saveCategoryDeletionHistory(category) {
    if (isUndoRedoing) return;
    if (historyIndex < historyStack.length - 1) historyStack = historyStack.slice(0, historyIndex + 1);
    historyStack.push({ type: 'categoryDelete', category: JSON.parse(JSON.stringify(category)), timestamp: Date.now() });
    historyIndex = historyStack.length - 1;
    if (historyStack.length > MAX_HISTORY) { historyStack.shift(); historyIndex = historyStack.length - 1; }
}

window.undo = async () => {
    if (historyIndex < 0 || historyStack.length === 0) return;
    isUndoRedoing = true;
    const h = historyStack[historyIndex];
    try {
        if (h.type === 'itemsDelete') await updateDoc(doc(db, "categories", h.categoryId), { items: h.beforeState });
        else if (h.type === 'categoryDelete') await setDoc(doc(db, "categories", h.category.id), { name: h.category.name, items: h.category.items, order: h.category.order });
        historyIndex--;
    } catch (e) { console.error(e); } finally { isUndoRedoing = false; }
};

window.redo = async () => {
    if (historyIndex >= historyStack.length - 1) return;
    isUndoRedoing = true;
    historyIndex++;
    const h = historyStack[historyIndex];
    try {
        if (h.type === 'itemsDelete') await updateDoc(doc(db, "categories", h.categoryId), { items: h.afterState });
        else if (h.type === 'categoryDelete') await deleteDoc(doc(db, "categories", h.category.id));
    } catch (e) { console.error(e); historyIndex--; } finally { isUndoRedoing = false; }
};

document.addEventListener('DOMContentLoaded', () => {
    const lb = document.getElementById('loginButton');
    if (lb) lb.addEventListener('click', async () => { try { await signInWithPopup(auth, new GoogleAuthProvider()); } catch (e) { alert('ログイン失敗'); } });
    
    document.addEventListener('click', (e) => {
        if (e.target.classList.contains('modal-backdrop') || e.target.classList.contains('modal-overlay')) {
            window.closeModal();
        }
    });
    
    document.addEventListener('keydown', (e) => {
        const k = (navigator.platform.toUpperCase().indexOf('MAC')>=0 ? e.metaKey : e.ctrlKey);
        if (k && e.key === 'z') { e.preventDefault(); e.shiftKey ? window.redo() : window.undo(); }
        if (k && e.key === 'k') { 
            e.preventDefault(); 
            if(document.getElementById('searchModal')) window.closeModal();
            else window.showSearchModal(); 
        }
        if (e.key === 'Escape') window.closeModal();
    });

    const scrollContainer = document.querySelector('.content-body');
    if (scrollContainer) {
        scrollContainer.addEventListener('scroll', (e) => {
            if (currentView === 'settings' && !isRendering) {
                settingsScrollPos = e.target.scrollTop;
            }
        });
    }
});

onAuthStateChanged(auth, async (user) => {
    const ls = document.getElementById('loginScreen'); const ac = document.getElementById('appContainer');
    if (user) {
        currentUser = user; ls.style.display = 'none'; ac.style.display = 'flex';
        await setDoc(doc(db, "users", user.uid), { displayName: user.displayName, photoURL: user.photoURL }, { merge: true });
        
        // ★追加：ユーザー設定（通知設定）を取得、なければデフォルト作成
        const uRef = doc(db, "users", user.uid);
        const uSnap = await getDoc(uRef);
        let uData = uSnap.exists() ? uSnap.data() : {};
        
// onAuthStateChanged 内のこの部分に追加
if (!uData.notificationType) {
    await setDoc(uRef, { ...uData, notificationType: 'related', notifySelf: false }, { merge: true });
    window.myNotificationType = 'related';
    window.myNotifySelf = false;
} else {
    window.myNotificationType = uData.notificationType;
    window.myNotifySelf = uData.notifySelf || false; // ★ここを追加
}
        
        initApp();
    } else {
        currentUser = null; ls.style.display = 'flex'; ac.style.display = 'none';
    }
});

async function initApp() {
    // 既存のリスナーを解除
    if (unsubs.categoriesList) unsubs.categoriesList();
    if (unsubs.activePage) unsubs.activePage();
    if (unsubs.settingsCommon) unsubs.settingsCommon();
    if (unsubs.settingsMaster) unsubs.settingsMaster();

    // 必須ドキュメントの存在確認と作成
    const impRef = doc(db, "categories", "important");
    if (!(await getDoc(impRef)).exists()) await setDoc(impRef, { name: "重要タスク", items: [], order: 9998 });
    const insRef = doc(db, "categories", "inspection");
    if (!(await getDoc(insRef)).exists()) await setDoc(insRef, { name: "検収", items: [], order: 9999 });

    // ユーザー情報の取得
    const uSnap = await getDocs(collection(db, "users"));
    appUsers = uSnap.docs.map(d => ({ name: d.data().displayName, photo: d.data().photoURL })).filter(u => u.name);

    // ★修正：サイドバーのロゴ横ボタンを「モノトーンSVGアイコン」に変更
    const logoContainer = document.querySelector('.logo-container');
    if (logoContainer && !logoContainer.querySelector('.btn-team-trigger')) {
        logoContainer.insertAdjacentHTML('beforeend', 
            `<button class="btn-team-trigger" onclick="window.openTeamBoard()" title="稼働状況">
                <svg viewBox="0 0 24 24"><path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/></svg>
            </button>`
        );
    }

// サイドバー用のカテゴリ一覧監視（兼・通知トリガー）
unsubs.categoriesList = onSnapshot(collection(db, "categories"), (snap) => {
    // ★修正：自分の操作(hasPendingWrites)でも、設定でONなら通知処理へ通す
    const allowSelf = window.myNotifySelf || false;
    
    if (categories.length > 0 && (allowSelf || !snap.metadata.hasPendingWrites)) {
         window.checkNotifications(categories, snap.docs, snap.metadata.hasPendingWrites);
    }

    categories = snap.docs
        .map(d => {
            const data = d.data();
            if (data.deleted) return null;
            return { id: d.id, ...data };
        })
        .filter(c => c !== null)
        .sort((a, b) => a.order - b.order);
    
    renderSidebar();
        
    if (currentView !== 'settings' && currentView !== 'manualList' && !currentView.startsWith('manual_')) {
         if (!unsubs.activePage) window.switchView(currentView);
    }
});

// 共通設定の監視（マスタ同期機能 ＋ ID自動修復機能付き）
unsubs.settingsCommon = onSnapshot(doc(db, "settings", "common"), async (d) => {
    if (d.exists()) { 
        const data = d.data(); 
        let loadedTemplates = data.templates || []; 
        logoSettings = data.logoSettings || { imageUrl: '', linkUrl: '' }; 
        definedLabels = data.definedLabels || [];
        window.teamBoardConfig = data.teamBoardConfig || { hiddenUsers: [], order: [] };
        
        // ★修正：マスタタスク同期 ＆ ID欠損の自動修復処理
        try {
            const masterSnap = await getDoc(doc(db, "settings", "master"));
            const masterParams = masterSnap.exists() ? (masterSnap.data().params || []) : [];
            let hasChanges = false;

            loadedTemplates = loadedTemplates.map(tpl => {
                const newItems = (tpl.items || []).map(item => {
                    // 【重要】IDがないアイテムがあれば自動付与して修復
                    if (!item.id) {
                        hasChanges = true;
                        item = { ...item, id: Date.now() + Math.random() };
                    }

                    if (item.type !== 'task') return item;

                    // マスタ同期処理
                    const master = masterParams.find(m => m.name === item.name);
                    if (master) {
                        if (item.memo !== master.memo || 
                            item.referenceUrl !== master.referenceUrl || 
                            item.manual !== master.manual) {
                            
                            hasChanges = true;
                            return { 
                                ...item, 
                                memo: master.memo || '', 
                                referenceUrl: master.referenceUrl || '', 
                                manual: master.manual || '' 
                            };
                        }
                    }
                    return item;
                });
                return { ...tpl, items: newItems };
            });

            // 変更（同期またはID修復）があった場合のみDBを更新
            if (hasChanges) {
                console.log("データの同期またはID修復を行いました");
                await updateDoc(doc(db, "settings", "common"), { templates: loadedTemplates });
                return; // 更新後の再描画を待つ
            }
        } catch (e) {
            console.error("同期エラー:", e);
        }

        // 変数に適用して描画
        templates = loadedTemplates;
        
        updateLogoDisplay(); 
        if(currentView==='settings' && !isRendering) window.renderSettingsContentTrigger();
        
        if(document.getElementById('teamSlidePanel')?.classList.contains('active')) {
            window.renderTeamBoardContent();
        }
    }
});

    // マスタ設定の監視
    unsubs.settingsMaster = onSnapshot(doc(db, "settings", "master"), (d) => { 
        masterTasks = d.exists() ? (d.data().params || []) : [];
        if(currentView==='settings') renderContent(); 
    });

    // マニュアル読み込み
    await window.loadManuals();

    const sidebar = document.querySelector('.sidebar');
    if (sidebar && !sidebar.querySelector('.version-info')) {
        const verDiv = document.createElement('div');
        verDiv.className = 'version-info';
        verDiv.textContent = 'Ver.1.3.1 (Lite)';
        sidebar.appendChild(verDiv);
    }
}

// ■最近使った項目
function getRecentPages() {
    try { return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]'); } catch(e) { return []; }
}
function saveRecentPage(catId) {
    if(catId === 'important' || catId === 'inspection' || catId === 'settings') return;
    let recents = getRecentPages();
    recents = recents.filter(id => id !== catId);
    recents.unshift(catId);
    if(recents.length > RECENT_MAX) recents.pop();
    localStorage.setItem(RECENT_KEY, JSON.stringify(recents));
}
window.toggleRecentSection = () => {
    const isClosed = localStorage.getItem(RECENT_OPEN_KEY) === 'true';
    localStorage.setItem(RECENT_OPEN_KEY, (!isClosed).toString());
    renderSidebar();
};

// ■ピン留め機能
function getPinnedPages() {
    try { return JSON.parse(localStorage.getItem(PINNED_KEY) || '[]'); } catch(e) { return []; }
}
window.togglePin = (catId) => {
    let pinned = getPinnedPages();
    if(pinned.includes(catId)) pinned = pinned.filter(id => id !== catId);
    else pinned.push(catId);
    localStorage.setItem(PINNED_KEY, JSON.stringify(pinned));
    renderSidebar();
};

let categorySortable = null;
/* ■修正：renderSidebar関数（manualActiveエラーの修正） */
function renderSidebar() {
    const listEl = document.getElementById('categoryList'); const setEl = document.getElementById('settingsArea');
    if (!listEl) return;

    const fixedCats = categories.filter(c => c.id === 'important' || c.id === 'inspection').sort((a,b) => a.order - b.order);
    const pinnedIds = getPinnedPages();
    
    const pinnedCats = [];
    const normalCats = [];
    categories.forEach(c => {
        if(c.id === 'important' || c.id === 'inspection') return;
        if(pinnedIds.includes(c.id)) pinnedCats.push(c);
        else normalCats.push(c);
    });

    let pinnedHtml = '';
    if (pinnedCats.length > 0) {
        pinnedHtml = `
            <div class="sidebar-section">
                <div class="sidebar-section-header">
                    <div class="sidebar-section-title">${ICONS.pin}<span>ピン留め</span></div>
                </div>
                <div class="sidebar-section-body">${generateCatHtml(pinnedCats)}</div>
            </div>`;
    }

    const recents = getRecentPages();
    const isClosed = localStorage.getItem(RECENT_OPEN_KEY) === 'true';
    let recentHtml = '';
    if (recents.length > 0) {
        const recentItemsHtml = recents.map(rid => {
            const c = categories.find(cat => cat.id === rid);
            if (!c) return ''; 
            return `<div class="sidebar-mini-item ${currentView === rid ? 'active' : ''}" onclick="window.switchView('${rid}')">${ICONS.clock} ${escapeHtml(c.name)}</div>`;
        }).join('');
        if (recentItemsHtml) {
            recentHtml = `
                <div class="sidebar-section ${isClosed ? 'closed' : ''}">
                    <div class="sidebar-section-header" onclick="window.toggleRecentSection()">
                        <div><span class="sidebar-toggle-icon">▼</span>最近使った項目</div>
                    </div>
                    <div class="sidebar-section-body">${recentItemsHtml}</div>
                </div>`;
        }
    }

    listEl.innerHTML = generateCatHtml(fixedCats) + recentHtml + pinnedHtml + `<div id="normalCategoryList">${generateCatHtml(normalCats)}</div>`;
    
// (renderSidebar関数内)
if (setEl) {
    setEl.innerHTML = `
        <div class="bookmark-tab settings-tab ${currentView==='settings'?'active':''}" onclick="window.switchView('settings')">
            <div class="settings-tab-inner"><span>${ICONS.settings} マスター管理</span></div>
        </div>
        <div class="bookmark-tab settings-tab ${currentView==='manualList'?'active':''}" onclick="window.switchView('manualList')">
            <div class="settings-tab-inner"><span>${ICONS.manual} マニュアル</span></div>
        </div>
        <div class="bookmark-tab settings-tab" onclick="window.openNotificationSettings()">
            <div class="settings-tab-inner"><span>${ICONS.bell} 通知設定</span></div>
        </div>
    `;
}
    
    const normalListEl = document.getElementById('normalCategoryList');
    if (normalListEl && !normalListEl.sortableInitialized) {
        new Sortable(normalListEl, { animation:150, handle:'.bookmark-tab', delay:100, delayOnTouchOnly:true, filter:'input', onEnd: async(evt)=>{
            if(evt.oldIndex===evt.newIndex)return;
            const allTabs = Array.from(listEl.querySelectorAll('.bookmark-tab'));
            const newOrderIds = allTabs.map(el => el.getAttribute('data-id')).filter(id => id);
            const b=writeBatch(db); 
            newOrderIds.forEach((cid, index) => {
                b.update(doc(db,"categories",cid), {order: index});
            });
            await b.commit();
        }});
        normalListEl.sortableInitialized = true;
    }
}

function generateCatHtml(catList) {
    const pinnedIds = getPinnedPages();
    return catList.map(cat => {
        // items が無い場合のエラー回避（念のため）
        const tasks = (cat.items || []).filter(i => i.type !== 'section');
        
        const isInspection = cat.id === 'inspection' || cat.name === '検収';
        const completed = isInspection ? tasks.filter(i => i.status1 === '反映済み').length : tasks.filter(i => i.status === 'completed').length;
        const total = tasks.length;
        const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
        
        const activeAssignees = []; const seenNames = new Set();
        const targetTasks = isInspection ? tasks.filter(i => i.status1 === '調整中') : tasks.filter(i => i.status === 'in-progress');
        targetTasks.forEach(t => {
            const name = isInspection ? t.submitterName : t.assigneeName;
            if (name && !seenNames.has(name)) {
                seenNames.add(name);
                const user = appUsers.find(u => u.name === name);
                activeAssignees.push({ name: name, photo: user ? user.photo : (t.assigneePhoto || null) });
            }
        });

        const avatarHtml = activeAssignees.length > 0 ? `<div class="avatar-group">${activeAssignees.slice(0,5).map(a=>`<img src="${a.photo||'https://www.gstatic.com/images/branding/product/1x/avatar_circle_blue_512dp.png'}" class="user-avatar" alt="${a.name}" referrerpolicy="no-referrer">`).join('')}${activeAssignees.length>5?`<span class="avatar-more">+${activeAssignees.length-5}</span>`:''}</div>` : '';
        
        // 【修正】すべてのカテゴリで「編集ボタン（✎）」を表示するようにする
        const editHtml = `<button class="sidebar-action-btn edit" onclick="event.stopPropagation(); window.startRenamingSidebarCategory('${cat.id}')">✎</button>`;
        
        // 【重要】削除ボタンは「重要タスク」と「検収」には表示しない（消すとシステムが壊れるため）
        const delHtml = (!isInspection && cat.id !== 'important') ? `<button class="sidebar-action-btn delete" onclick="event.stopPropagation(); window.deleteSidebarCategory('${cat.id}')">✕</button>` : '';
        
        const isPinned = pinnedIds.includes(cat.id);
        const pinHtml = (!isInspection && cat.id !== 'important') ? `<button class="sidebar-action-btn pin ${isPinned?'pinned':''}" onclick="event.stopPropagation(); window.togglePin('${cat.id}')">${ICONS.pin}</button>` : '';
        
        let progHtml = '';
        if (!cat.items) {
             progHtml = `<div class="sidebar-progress-text" style="text-align:left; color:#ccc;">-</div>`;
        } else if (isInspection) {
             progHtml = `<div class="sidebar-progress-container" style="visibility:hidden;"></div><div class="sidebar-progress-text">${tasks.filter(i=>showReflected||i.status1!=='反映済み').length}件</div>`;
        } else {
             progHtml = `<div class="sidebar-progress-container"><div class="sidebar-progress-bar" style="width:${percentage}%"></div></div><div class="sidebar-progress-text">${percentage}% (${completed}/${total})</div>`;
        }

        return `<div class="bookmark-tab ${currentView===cat.id?'active':''} ${isInspection?'is-inspection':''} ${cat.id==='important'?'is-important':''}" onclick="window.switchView('${cat.id}')" data-id="${cat.id}">
            <div class="bookmark-tab-header">
                <span class="bookmark-tab-drag-handle">☰</span>
                <div class="bookmark-tab-name-container" id="cat-name-container-${cat.id}"><span class="bookmark-tab-name-text">${escapeHtml(cat.name)}</span></div>
                <div class="sidebar-actions-group">${avatarHtml}<div class="sidebar-actions-wrapper">${pinHtml}${editHtml}${delHtml}</div></div>
            </div>
            ${progHtml}
        </div>`;
    }).join('');
}

window.startRenamingSidebarCategory = (catId) => {
    const c = document.getElementById(`cat-name-container-${catId}`); if(!c)return;
    const cat = categories.find(ci=>ci.id===catId); if(!cat)return;
    const cur = cat.name;
    c.innerHTML = `<input type="text" id="rename-input-${catId}" class="sidebar-rename-input" value="${escapeHtml(cur)}">`;
    const inp = document.getElementById(`rename-input-${catId}`);
    if(inp){
        inp.onclick = (e) => { e.stopPropagation(); if(inp.selectionStart===0 && inp.selectionEnd===inp.value.length) inp.setSelectionRange(inp.value.length, inp.value.length); };
        setTimeout(()=>{ inp.focus(); inp.select(); },0);
        let f=false; const commit=async(canc=false)=>{
            if(f)return; f=true; const n=inp.value.trim();
            if(!canc && n && n!==cur) await updateDoc(doc(db,"categories",catId),{name:n}); else renderSidebar();
        };
        inp.onkeydown=(e)=>{if(e.key==='Enter')commit(false);if(e.key==='Escape')commit(true);}; inp.onblur=()=>commit(false);
    }
};

window.deleteSidebarCategory = async(id) => { if(confirm("削除しますか？")){ const c=categories.find(ci=>ci.id===id); if(c)saveCategoryDeletionHistory(c); await deleteDoc(doc(db,"categories",id)); if(currentView===id)window.switchView('main'); }};

window.switchView = (id) => { 
    if(document.querySelector('.sidebar-rename-input')) return; 
    
    // 直前のページ監視を停止（通信量節約）
    if (unsubs.activePage) {
        unsubs.activePage();
        unsubs.activePage = null;
    }

    currentView = id; 
    settingsScrollPos = 0; 
    saveRecentPage(id); 
    
    // サイドバーの選択状態更新
    renderSidebar();

    // 特別なページ（設定・マニュアル一覧・マニュアル編集）の場合
    if (id === 'settings' || id === 'manualList' || id.startsWith('manual_')) {
        renderContent();
        return;
    }

    // ★通常ページ（タスク一覧）の場合：そのページ単体の監視を開始
    // これにより、開いているページだけの通信が発生する
    unsubs.activePage = onSnapshot(doc(db, "categories", id), (docSnap) => {
        if (docSnap.exists()) {
            const data = docSnap.data();
            // deletedフラグのチェック
            if (data.deleted) {
                document.getElementById('contentWrapper').innerHTML = '<div style="padding:20px;">このページは削除されました</div>';
                return;
            }

            // categories配列内の該当データを最新に更新（描画用）
            const index = categories.findIndex(c => c.id === id);
            if (index !== -1) {
                categories[index] = { id: id, ...data };
            } else {
                // サイドバー同期より先に中身が来た場合の予備
                categories.push({ id: id, ...data });
            }
            
            renderContent();
        } else {
            // ドキュメントが存在しない場合
            document.getElementById('contentWrapper').innerHTML = '<div style="padding:20px;">ページが見つかりません</div>';
        }
    }, (error) => {
        console.error("Error watching page:", error);
        // 権限エラーなどが起きた場合の表示
        document.getElementById('contentWrapper').innerHTML = '<div style="padding:20px; color:red;">読み込みエラーが発生しました</div>';
    });
};

let savedScrollPosition=null; let shouldRestoreScroll=false;
function renderContent() {
    const wrap = document.getElementById('contentWrapper'); const tit = document.getElementById('contentTitle'); const act = document.getElementById('headerActions');
    if(!wrap||!tit)return;
    
    const searchBtnHtml = `<div class="header-right-actions"><button class="search-trigger-btn" onclick="window.showSearchModal()">${ICONS.search} 検索 <span class="kbd-shortcut">⌘K</span></button></div>`;

    if(currentView==='settings'){
        isRendering = true;
        tit.innerHTML = `<div class="content-header-row"><div>マスター管理</div>${searchBtnHtml}</div>`;
        tit.style.display = ''; tit.style.justifyContent = ''; tit.style.alignItems = '';
        if(act) act.innerHTML='';
        wrap.innerHTML = `<div class="settings-content" style="display:flex; flex-direction:column; gap:40px;"><div id="templateSettingsArea"></div></div>`;
        if(typeof window.renderSettingsContentTrigger === 'function') { window.renderSettingsContentTrigger(); }

    } else if(currentView==='inspection'){
        const c=categories.find(i=>i.id==='inspection');
        if(c){
            const ts=(c.items||[]).filter(i=>i.type!=='section'); const vis=ts.filter(i=>showReflected||i.status1!=='反映済み').length;
            
            // ★ここを修正：ボタンのクラスを専用のものに変更し、インラインスタイルを削除
            tit.innerHTML=`<div class="content-header-row"><div><span>${escapeHtml(c.name)}</span><button class="btn-toggle-reflected ${showReflected?'active':''}" onclick="window.toggleReflectedVisibility()">${showReflected?'反映済みを隠す':'反映済みを表示'}</button><div class="main-progress-container" style="margin-left:10px;"><span class="main-progress-text">残り ${vis}件</span></div></div>${searchBtnHtml}</div>`;
            
            if(act) act.innerHTML=`<div style="display:flex;flex-direction:column;gap:8px;width:100%;"><div style="display:flex;align-items:flex-end;gap:10px;"><textarea id="taskNameInput" class="header-task-input" placeholder="タスクを改行で一括追加"></textarea><button class="btn-add btn-compact" onclick="window.addTasksFromHeader('${c.id}')">+ タスク一括追加</button></div><div class="inspection-header-row"><div></div><div class="col-status">状態</div><div class="col-name">検収タスク</div><div class="col-link">リンク</div><div class="col-submitter">提出者</div><div class="col-inspector">担当者</div><div class="col-detail">詳細</div></div></div>`;
            wrap.innerHTML=renderInspectionPage(c); setTimeout(setupMemoTooltips,100);
        }
    } else if (currentView === 'manualList') {
        tit.innerHTML = `<div class="content-header-row"><div>マニュアル一覧</div>${searchBtnHtml}</div>`;
        if(act) act.innerHTML = `<button class="btn-add" onclick="window.createManual()">+ 新規マニュアル作成</button>`;
        wrap.innerHTML = renderManualList();

    } else if (currentView.startsWith('manual_edit_')) {
        const mid = currentView.replace('manual_edit_', '');
        tit.innerHTML = `<div class="content-header-row"><div>マニュアル編集</div></div>`;
        
        // ★キャンセル時の飛び先を 'manualList' に設定
        if(act) act.innerHTML = `<div style="display:flex; gap:10px;"><button class="btn-cancel" onclick="window.switchView('manualList')">キャンセル</button><button class="btn-primary" onclick="window.saveManualChanges('${mid}')">保存して終了</button></div>`;
        
        wrap.innerHTML = renderManualEditor(mid);

    } else if (currentView.startsWith('manual_')) {
        const mid = currentView.replace('manual_', '');
        const m = manuals.find(x => x.id === mid);
        if(m) {
            tit.innerHTML = `<div class="content-header-row"><div>マニュアル</div></div>`;
            if(act) act.innerHTML = `<div style="display:flex; gap:10px;"><button class="btn-cancel" onclick="window.switchView('manualList')">一覧に戻る</button><button class="btn-primary" onclick="window.switchView('manual_edit_${mid}')">編集する</button></div>`;
            wrap.innerHTML = renderManualView(mid);
        }
    } else {
        const c=categories.find(i=>i.id===currentView);
        if(c){
            const ts=(c.items||[]).filter(i=>i.type!=='section'); const comp=ts.filter(i=>i.status==='completed').length; const per=ts.length>0?Math.round((comp/ts.length)*100):0;
            tit.innerHTML=`<div class="content-header-row"><div><span>${escapeHtml(c.name)}</span><div class="main-progress-container" style="margin-left:10px;"><span class="main-progress-text">${per}% (${comp}/${ts.length})</span><div class="main-progress-bar-bg"><div class="main-progress-bar-fill" style="width:${per}%"></div></div></div></div>${searchBtnHtml}</div>`;
            
            // 【修正】+ 見出し追加ボタンのクラスを btn-add（黒）に変更
            if(act) act.innerHTML=`<div style="display:flex;align-items:flex-start;gap:10px;width:100%;"><textarea id="taskNameInput" class="header-task-input" placeholder="タスクを改行で一括追加"></textarea><div style="display:flex;flex-direction:column;gap:4px;"><button class="btn-add btn-compact" onclick="window.addSection('${c.id}')">+ 見出し追加</button><button class="btn-add btn-compact" onclick="window.addTasksFromHeader('${c.id}')">+ タスク一括追加</button></div></div>`;
            wrap.innerHTML=renderCategoryPage(c); setTimeout(setupMemoTooltips,100);
        } else { if(act)act.innerHTML=''; wrap.innerHTML='<div style="padding:20px;">カテゴリを選択してください</div>'; }
    }
    if(shouldRestoreScroll && savedScrollPosition!==null){ requestAnimationFrame(()=>{const b=document.querySelector('.content-body'); if(b)b.scrollTop=savedScrollPosition; shouldRestoreScroll=false; savedScrollPosition=null;}); }
}

// ■検索機能の実装
window.showSearchModal = () => {
    if(document.getElementById('searchModal')) document.getElementById('searchModal').remove();
    const html = `
        <div id="searchModal" class="modal-overlay active" onclick="if(event.target===event.currentTarget)window.closeModal()">
            <div class="search-modal" onclick="event.stopPropagation()">
                <div class="search-input-wrapper">
                    <span class="search-icon-large">${ICONS.search}</span>
                    <input type="text" id="searchInput" class="search-modal-input" placeholder="タスク、ページ、マスタを検索..." autocomplete="off">
                    <button class="search-modal-close" onclick="window.closeModal()">×</button>
                </div>
                <div id="searchResults" class="search-results">
                    <div class="no-results">キーワードを入力してください</div>
                </div>
            </div>
        </div>`;
    document.body.insertAdjacentHTML('beforeend', html);
    const inp = document.getElementById('searchInput');
    inp.focus();
    inp.addEventListener('input', (e) => window.executeSearch(e.target.value));
    inp.addEventListener('keydown', (e) => {
        if(e.key === 'Escape') window.closeModal();
    });
};

// script.js 内の既存 executeSearch を修正

/* ■検索機能の完全版（タスク・ページ・マスタ・マニュアル全対応） */
window.executeSearch = (keyword) => {
    const resEl = document.getElementById('searchResults');
    if (!keyword.trim()) { resEl.innerHTML = '<div class="no-results">キーワードを入力してください</div>'; return; }
    
    const term = keyword.toLowerCase();
    const results = [];

    // 1. カテゴリ（ページ）とタスクの検索
    categories.forEach(cat => {
        // カテゴリ名の検索
        if (cat.name.toLowerCase().includes(term)) {
            results.push({ type: 'page', title: cat.name, sub: 'ページ', id: cat.id });
        }
        // タスクの検索
        (cat.items || []).forEach(item => {
            if (item.type === 'task' && item.name.toLowerCase().includes(term)) {
                results.push({ 
                    type: 'task', 
                    title: item.name, 
                    sub: `ページ: ${cat.name}`, 
                    id: cat.id, 
                    taskId: item.id 
                });
            }
        });
    });

    // 2. マスタタスク（テンプレートタスク）の検索
    masterTasks.forEach((mt, idx) => {
        if (mt.name.toLowerCase().includes(term)) {
            results.push({ type: 'master', title: mt.name, sub: 'タスクテンプレート', id: 'settings', index: idx });
        }
    });

    // 3. ページテンプレートの検索
    templates.forEach(tpl => {
        if (tpl.name.toLowerCase().includes(term)) {
            results.push({ type: 'template', title: tpl.name, sub: 'ページテンプレート', id: 'settings', tplId: tpl.id });
        }
    });

    // 4. マニュアル検索
    manuals.forEach(m => {
        const textContent = (m.content || '').replace(/<[^>]+>/g, ' ');
        if (m.title.toLowerCase().includes(term) || textContent.toLowerCase().includes(term)) {
            results.push({
                type: 'manual',
                title: m.title,
                sub: 'マニュアル',
                id: m.id
            });
        }
    });

    if(results.length === 0) {
        resEl.innerHTML = '<div class="no-results">見つかりませんでした</div>';
        return;
    }

    // 検索結果の描画
    resEl.innerHTML = results.slice(0, 50).map(r => {
        // モノトーンのSVGアイコン定義（インラインで埋め込み）
        let iconSvg = '';
        if(r.type === 'page') {
            // シンプルなドキュメント（ページ）アイコン
            iconSvg = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>';
        } else if(r.type === 'task') {
            // チェックボックス（タスク）アイコン
            iconSvg = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 11 12 14 22 4"></polyline><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path></svg>';
        } else if(r.type === 'master' || r.type === 'template') {
            // 既存の歯車（設定）アイコンをそのまま利用
            iconSvg = ICONS.settings;
        } else if(r.type === 'manual') {
            // 開いた本（マニュアル）アイコン
            iconSvg = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path></svg>';
        }

        // クリック時のアクション設定（変更なし）
        let clickAction = '';
        if (r.type === 'manual') {
            clickAction = `window.closeModal(); window.openSlidePanel('${r.id}')`;
        } else if (r.type === 'master') {
            clickAction = `window.jumpToResult('settings', '', '${r.index}', '')`;
        } else if (r.type === 'template') {
            clickAction = `window.jumpToResult('settings', '', '', '${r.tplId}')`;
        } else {
            clickAction = `window.jumpToResult('${r.id}', '${r.taskId || ''}', '', '')`;
        }

        return `
            <div class="search-result-item" onclick="${clickAction}">
                <div class="result-icon" style="color:#5f6368;">${iconSvg}</div>
                <div class="result-content">
                    <div class="result-title">${escapeHtml(r.title)}</div>
                    <div class="result-meta">${escapeHtml(r.sub)}</div>
                </div>
            </div>`;
    }).join('');
};

window.jumpToResult = (pageId, taskId, masterIndex, tplId) => {
    window.closeModal();
    window.switchView(pageId);
    
    setTimeout(() => {
        if (taskId) {
            const el = document.querySelector(`.task-row[data-id="${taskId}"]`);
            if(el) {
                el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                el.classList.add('highlight-target');
                setTimeout(() => el.classList.remove('highlight-target'), 2000);
            }
        }
    }, 300);
};

window.toggleReflectedVisibility=()=>{showReflected=!showReflected; renderContent();};
function setupMemoTooltips(){
    document.querySelectorAll('.memo-preview[data-full-memo], .inspection-indicator[data-full-content]').forEach(el=>{
        let tp=null;
        el.addEventListener('mouseenter',()=>{
            const c=el.getAttribute('data-full-memo')||el.getAttribute('data-full-content'); if(!c)return;
            tp=document.createElement('div'); tp.className='memo-tooltip-js'; tp.textContent=c;
            tp.style.cssText=`position:fixed;background:#333;color:#fff;padding:8px 12px;border-radius:6px;font-size:12px;max-width:400px;z-index:10000;pointer-events:none;opacity:0;transition:opacity 0.1s;`;
            document.body.appendChild(tp);
            const r=el.getBoundingClientRect(); let l=r.left+(r.width/2)-(tp.offsetWidth/2); let t=r.top-tp.offsetHeight-8;
            if(l<10)l=10; if(l+tp.offsetWidth>window.innerWidth-10)l=window.innerWidth-tp.offsetWidth-10; if(t<10)t=r.bottom+8;
            tp.style.left=l+'px'; tp.style.top=t+'px'; tp.style.opacity='1';
        });
        el.addEventListener('mouseleave',()=>{if(tp){tp.remove();tp=null;}});
    });
}

let sectionExpandedState={};
function renderCategoryPage(cat){
    const items=cat.items||[]; const stats={}; const taskMap={}; let curSec=null;
    items.forEach(i=>{ if(i.type==='section'){ curSec=i.id; stats[curSec]={total:0,completed:0}; taskMap[curSec]=[]; } else if(i.type==='task'&&curSec){ taskMap[curSec].push(i); stats[curSec].total++; if(i.status==='completed')stats[curSec].completed++; }});
    
    let noSecTasks=[]; let cSec=null; items.forEach(i=>{if(i.type==='section')cSec=i.id; else if(i.type==='task'&&!cSec&&i.status!=='completed')noSecTasks.push(i);});
    const allComp=items.filter(i=>i.type==='task'&&i.status==='completed');
    
    let html=`<div class="task-list" id="taskList-${cat.id}">`;
    if(noSecTasks.length>0){ html+=`<div class="section-container is-expanded no-section"><div class="task-inner-container">`; noSecTasks.forEach(t=>{html+=renderTaskRow(cat.id,t);}); html+='</div></div>'; }
    items.forEach(i=>{
        if(i.type==='section'){
            const ex=sectionExpandedState[i.id]===undefined?false:sectionExpandedState[i.id]; const sts=taskMap[i.id]||[];
            html+=`<div class="section-container ${ex?'is-expanded':''}" data-section-id="${i.id}">${renderSectionRow(cat.id,i,stats[i.id])}<div class="task-always-visible">`;
            sts.forEach(t=>{if(t.status!=='completed')html+=renderTaskRow(cat.id,t);});
            html+=`</div><div class="task-inner-container">`;
            sts.forEach(t=>{if(t.status==='completed')html+=renderTaskRow(cat.id,t);});
            html+='</div></div>';
        }
    });
    const outComp=allComp.filter(t=>{ let b=false; let c=null; items.forEach(i=>{if(i.type==='section')c=i.id; if(i===t&&c)b=true;}); return !b; });
    if(outComp.length>0){
        const cid='completed-section-'+cat.id; const ex=sectionExpandedState[cid]===true;
        html+=`<div class="section-container ${ex?'is-expanded':''}" data-section-id="${cid}"><div class="section-header section-completed"><span style="font-size:14px;font-weight:600;color:#5f6368;">✓ 完了</span><span style="font-size:12px;color:#9aa0a6;margin-left:8px;">${outComp.length}件</span><button class="section-toggle-btn" onclick="window.toggleSection(this,'${cid}')">${ex?'▼':'▶'}</button></div><div class="task-inner-container">`;
        outComp.forEach(t=>{html+=renderTaskRow(cat.id,t);});
        html+=`</div></div>`;
    }
    html+=`</div>`;
    setTimeout(()=>{
        const el=document.getElementById(`taskList-${cat.id}`); if(!el)return;
        new Sortable(el,{animation:150,handle:'.section-drag-handle',onEnd:async()=>await window.saveTaskOrder(cat.id)});
        el.querySelectorAll('.task-always-visible, .task-inner-container').forEach(c=>new Sortable(c,{group:'section-tasks',animation:150,draggable:'.task-row',onEnd:async()=>await window.saveTaskOrder(cat.id)}));
    },0);
    return html;
}

/* ■修正版：タスク行（チェックボックスの挙動変更） */
function renderTaskRow(catId, task) {
    const statusClass = task.status === 'in-progress' ? 'status-in-progress' : task.status === 'completed' ? 'status-completed' : task.status === 'planned' ? 'status-planned' : '';
    const statusText = task.status === 'pending' ? '未着手' : task.status === 'planned' ? '予定' : task.status === 'in-progress' ? 'なう' : '完了';
    
    const assigneeUser = appUsers.find(u => u.name === task.assigneeName);
    const photoUrl = assigneeUser ? assigneeUser.photo : task.assigneePhoto;
    const avatarImg = photoUrl ? `<img src="${photoUrl}" class="assignee-avatar" alt="${task.assigneeName}" referrerpolicy="no-referrer">` : '<div class="assignee-avatar-placeholder"></div>';
    
    const assigneeHtml = `<div class="assignee-badge">${avatarImg}${task.assigneeName ? `<span class="assignee-name-text">${escapeHtml(task.assigneeName)}</span>` : ''}</div>`;
    const dateFormatted = task.deadline ? formatDate(task.deadline) : '';
    const dateHtml = `<div class="date-container" onclick="window.showDatePicker('${catId}', '${task.id}', '${task.deadline || ''}')"><span class="date-display ${dateFormatted ? '' : 'placeholder'}">${dateFormatted || 'MM/DD HH:mm'}</span></div>`;
    
    // ★修正ポイント：togglePlannedを直接呼ばず、handleTaskCheckboxClickを呼ぶように変更
    const checkboxHtml = `<input type="checkbox" class="task-checkbox" ${task.status === 'planned' ? 'checked' : ''} onchange="window.handleTaskCheckboxClick('${catId}', ${task.id}, this)">`;

    const labelData = task.label || { text: '', color: '' };
    const labelClass = labelData.color ? `label-bg-${labelData.color}` : 'label-bg-gray';
    const labelHasContent = !!labelData.text;
    const labelHtml = `<div class="task-label-slot ${labelClass} ${labelHasContent ? 'has-label' : ''}" onclick="window.showLabelModal('${catId}', ${task.id})">${escapeHtml(labelData.text || '')}</div>`;

    return `
        <div class="task-row ${statusClass}" data-id="${task.id}" data-type="task">
            <span class="task-drag-handle">☰</span>
            ${labelHtml}
            <button class="status-badge ${task.status}" onclick="window.toggleStatus('${catId}', ${task.id}, '${task.status}')">${statusText}</button>
            <input type="text" class="task-name" value="${escapeHtml(task.name)}" onblur="window.updateItemName('${catId}', ${task.id}, this.value)">
            ${checkboxHtml}
            ${assigneeHtml}${dateHtml}
            <div class="icon-with-edit">
                <button class="icon-btn memo-btn ${task.memo ? 'has-content' : ''}" onclick="window.handleTaskMemoClick('${catId}', ${task.id})">${ICONS.memo}</button>
                <button class="mini-edit-btn" onclick="event.stopPropagation(); window.editMemo('${catId}', ${task.id})">✎</button>
            </div>
            <div class="action-group">
                <div class="icon-with-edit">
                    <button class="icon-btn ${task.referenceUrl ? 'has-content' : ''}" onclick="window.handleIconClick(event, '${catId}', ${task.id}, 'referenceUrl', '${task.referenceUrl || ''}')" oncontextmenu="event.preventDefault(); window.editUrl('${catId}', ${task.id})">${ICONS.link}</button>
                    <button class="mini-edit-btn" onclick="event.stopPropagation(); window.editUrl('${catId}', ${task.id})">✎</button>
                </div>
                <div class="icon-with-edit">
                    <button class="icon-btn ${task.manual ? 'has-content' : ''}" onclick="window.handleTaskManualClick(event, '${catId}', ${task.id}, '${task.manual || ''}')">${ICONS.manual}</button>
                    <button class="mini-edit-btn" onclick="event.stopPropagation(); window.selectTaskManual('${catId}', ${task.id})">✎</button>
                </div>
                <button class="btn-delete" onclick="window.deleteTaskItem('${catId}', ${task.id})">×</button>
            </div>
        </div>`;
}

function renderSectionRow(catId, section, stats) {
    const isExpanded = sectionExpandedState[section.id] === undefined ? false : sectionExpandedState[section.id];
    const toggleIcon = isExpanded ? '▼' : '▶';
    const percentage = stats && stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0;
    const isAllCompleted = stats && stats.total > 0 && stats.completed === stats.total;
    const progressText = stats && stats.total > 0 ? `${percentage}% (${stats.completed}/${stats.total})` : '0% (0/0)';
    return `
        <div class="section-header ${isAllCompleted ? 'section-all-completed' : ''}">
            <span class="section-drag-handle" onclick="event.stopPropagation()">☰</span>
            <input type="text" class="section-name-input" value="${escapeHtml(section.name)}" onblur="window.updateItemName('${catId}', ${section.id}, this.value)" onclick="event.stopPropagation()">
            <button class="section-toggle-btn" onclick="window.toggleSection(this, '${section.id}')">${toggleIcon}</button>
            <span class="section-progress" onclick="event.stopPropagation()">${progressText}</span>
            <div style="display:flex; gap:2px; margin-left:auto; align-items:center;">
                <button class="section-add-btn" onclick="event.stopPropagation(); window.addTaskToSection('${catId}', ${section.id})" title="この見出しにタスク追加">+</button>
                ${catId !== 'inspection' ? `<button class="section-delete" onclick="event.stopPropagation(); window.deleteSectionItem('${catId}', ${section.id})">×</button>` : ''}
            </div>
        </div>`;
}

// ■ラベル設定モーダル
window.showLabelModal = (catId, taskId) => {
    // 既存モーダル削除
    window.closeModal();

    const choiceHtml = definedLabels.map(lbl => `
        <button class="label-choice-btn" onclick="window.saveLabel('${catId}', ${taskId}, '${lbl.text}', '${lbl.color}')">
            <div class="color-swatch c-${lbl.color}" style="width:14px; height:14px; margin:0;"></div>
            <span>${escapeHtml(lbl.text)}</span>
        </button>
    `).join('');

    const html = `
        <div id="labelModal" class="modal-overlay active" onclick="if(event.target===event.currentTarget)window.closeModal()">
            <div class="edit-modal-dialog" style="max-width:400px;">
                <h2 style="font-size:16px; margin-bottom:10px; text-align:center;">ラベルを選択</h2>
                <div class="label-select-grid">
                    ${choiceHtml || '<div style="color:#999; font-size:12px;">マスター管理でラベルを登録してください</div>'}
                    <button class="label-choice-btn clear-btn" onclick="window.saveLabel('${catId}', ${taskId}, null, null)">
                        <span>✕ ラベルを外す</span>
                    </button>
                </div>
                <div class="edit-modal-actions" style="justify-content:center;">
                    <button class="btn-cancel" onclick="window.closeModal()">キャンセル</button>
                </div>
            </div>
        </div>`;
    document.body.insertAdjacentHTML('beforeend', html);
};

window.saveLabel = async (catId, taskId, text, color) => {
    const newLabel = (text && color) ? { text, color } : null;
    const cat = categories.find(c => c.id === catId);
    if(!cat) return;
    const newItems = cat.items.map(i => i.id == taskId ? { ...i, label: newLabel } : i);
    await updateDoc(doc(db, "categories", catId), { items: newItems });
    window.closeModal();
};

function renderInspectionPage(category) {
    const items = category.items || [];
    let html = `<div class="task-list" id="taskList-${category.id}"><div class="section-container is-expanded"><div class="task-inner-container">`;
    items.forEach(item => {
        if (item.type === 'task') {
            if (!showReflected && (item.status1 === '反映済み')) return;
            html += renderInspectionTaskRow(category.id, item);
        }
    });
    html += `</div></div></div>`;
    setTimeout(() => {
        const el = document.getElementById(`taskList-${category.id}`); if (!el) return;
        const container = el.querySelector('.task-inner-container');
        if (container) new Sortable(container, { animation: 150, draggable: '.task-row', onEnd: async () => await window.saveTaskOrder(category.id) });
    }, 0);
    return html;
}

/* ■修正版：検収タスク行（！削除＆メモ・調整の挙動変更） */
function renderInspectionTaskRow(catId, task) {
    const s1 = task.status1 || '依頼済み';
    const s2 = task.status2 || '';
    const opt1 = ['依頼済み', '調整中', '再依頼', '反映済み'].map(v => `<option value="${v}" ${s1 === v ? 'selected' : ''}>${v}</option>`).join('');
    const status1Html = `<select class="inspection-status-select s1" data-state="${s1}" onchange="this.setAttribute('data-state', this.value); window.updateInspectionStatus('${catId}', ${task.id}, 'status1', this.value)">${opt1}</select>`;
    const opt2 = ['', '検収中', '反映OK', '要調整'].map(v => `<option value="${v}" ${s2 === v ? 'selected' : ''}>${v || '未設定'}</option>`).join('');
    const status2Html = `<select class="inspection-status-select s2" data-state="${s2 || '未設定'}" onchange="this.setAttribute('data-state', this.value); window.updateInspectionStatus('${catId}', ${task.id}, 'status2', this.value)">${opt2}</select>`;

    const submitterUser = appUsers.find(u => u.name === task.submitterName);
    const submitterAvatar = (submitterUser && submitterUser.photo) || task.submitterPhoto
        ? `<img src="${(submitterUser && submitterUser.photo) || task.submitterPhoto}" class="assignee-avatar" alt="${task.submitterName}" referrerpolicy="no-referrer">` 
        : '<div class="assignee-avatar-placeholder"></div>';
    const submitterHtml = `<div class="assignee-badge inspection-submitter">${submitterAvatar}<span class="assignee-name-text">${escapeHtml(task.submitterName || '(不明)')}</span></div>`;

    const inspectorUser = appUsers.find(u => u.name === task.inspectorName);
    const inspectorAvatar = (inspectorUser && inspectorUser.photo) 
        ? `<img src="${inspectorUser.photo}" class="assignee-avatar" alt="${task.inspectorName}" referrerpolicy="no-referrer">` 
        : '<div class="assignee-avatar-placeholder"></div>';
    const userOpts = [''].concat(appUsers.map(u => u.name)).map(u => `<option value="${u}" ${task.inspectorName === u ? 'selected' : ''}>${u || '未設定'}</option>`).join('');
    const inspectorHtml = `<div class="assignee-badge inspection-inspector">${inspectorAvatar}<select class="inspection-inspector-select" onchange="window.updateItemField('${catId}', ${task.id}, 'inspectorName', this.value)">${userOpts}</select></div>`;

    const linkAction = `onclick="window.handleInspectionLink('${catId}', ${task.id}, '${task.referenceUrl || ''}')"`;
    // ★インジケーター（！）生成コード削除
    
    const createdDate = new Date(task.id);
    const createdDateStr = `${String(createdDate.getMonth()+1).padStart(2,'0')}/${String(createdDate.getDate()).padStart(2,'0')} ${String(createdDate.getHours()).padStart(2,'0')}:${String(createdDate.getMinutes()).padStart(2,'0')}`;

    return `
        <div class="task-row inspection-row" data-id="${task.id}" data-type="task">
            <span class="task-drag-handle">☰</span>
            <div class="inspection-col-status-group">${status1Html}${status2Html}</div>
            <input type="text" class="task-name inspection-col-name" value="${escapeHtml(task.name)}" onblur="window.updateItemName('${catId}', ${task.id}, this.value)">
            <div class="inspection-col-link">
                <div class="icon-with-edit">
                    <button class="icon-btn ${task.referenceUrl ? 'has-content' : ''}" ${linkAction} title="リンク">${ICONS.link}</button>
                    <button class="mini-edit-btn" onclick="event.stopPropagation(); window.editUrl('${catId}', ${task.id})" title="編集">✎</button>
                </div>
            </div>
            <div class="inspection-col-submitter">${submitterHtml}</div>
            <div class="inspection-col-inspector">${inspectorHtml}</div>
            <div class="inspection-col-detail-group">
                <div class="icon-with-edit">
                    <button class="icon-btn memo-btn ${task.memo ? 'has-content' : ''}" onclick="window.handleTaskMemoClick('${catId}', ${task.id})">${ICONS.memo}</button>
                    <button class="mini-edit-btn" onclick="event.stopPropagation(); window.editMemo('${catId}', ${task.id})" title="編集">✎</button>
                </div>
                <div class="icon-with-edit">
                    <button class="icon-btn memo-btn ${task.adjustment ? 'has-content' : ''}" onclick="window.handleInspectionAdjustmentClick('${catId}', ${task.id})">${ICONS.wrench}</button>
                    <button class="mini-edit-btn" onclick="event.stopPropagation(); window.editAdjustment('${catId}', ${task.id})" title="編集">✎</button>
                </div>
                <span class="inspection-created-date">${createdDateStr}</span>
                <button class="btn-delete" onclick="window.deleteTaskItem('${catId}', ${task.id})">×</button>
            </div>
        </div>`;
}

window.toggleSection = (btn, sectionId) => { sectionExpandedState[sectionId] = !sectionExpandedState[sectionId]; renderContent(); };
window.saveTaskOrder = async (catId) => {
    const el = document.getElementById(`taskList-${catId}`);
    if (!el) return;
    const cat = categories.find(c => c.id === catId);
    if (!cat) return;
    const newItems = [];
    el.querySelectorAll('.section-container').forEach(container => {
        const sectionId = container.getAttribute('data-section-id');
        if (sectionId && sectionId.startsWith('completed-section-')) return;
        if (sectionId && !container.classList.contains('no-section')) {
            const sectionItem = cat.items.find(i => i.id == sectionId);
            if (sectionItem) newItems.push(sectionItem);
        }
        const alwaysVisible = container.querySelector('.task-always-visible');
        if (alwaysVisible) alwaysVisible.querySelectorAll('.task-row').forEach(row => { const t = cat.items.find(i => i.id == row.getAttribute('data-id')); if(t) newItems.push(t); });
        const innerContainer = container.querySelector('.task-inner-container');
        if (innerContainer) innerContainer.querySelectorAll('.task-row').forEach(row => { const t = cat.items.find(i => i.id == row.getAttribute('data-id')); if(t) newItems.push(t); });
    });
    const completedTasksOutside = cat.items.filter(i => {
        if (i.type !== 'task' || i.status !== 'completed') return false;
        let belongs = false; let cur = null;
        cat.items.forEach(item => { if(item.type==='section') cur=item.id; if(item===i && cur) belongs=true; });
        return !belongs;
    });
    newItems.push(...completedTasksOutside);
    await updateDoc(doc(db, "categories", catId), { items: newItems });
};

/* ■修正版：タスク追加（ページ名に「検収」が含まれていれば検収タスク化） */
window.addTasks = async (catId) => {
    const textarea = document.getElementById('taskNameInput'); if (!textarea) return;
    const lines = textarea.value.trim().split('\n').filter(l => l.trim()); if (lines.length === 0) return;
    const cat = categories.find(c => c.id === catId);
    
    // ★修正：IDが inspection か、名前に「検収」が含まれていれば検収モードにする
    const isInspectionPage = cat.id === 'inspection' || cat.name.includes('検収');

    const newTasks = lines.map(line => {
        const master = masterTasks.find(m => m.name === line.trim());
        return {
            id: Date.now() + Math.random(), type: 'task', name: line.trim(), status: 'pending',
            memo: master ? master.memo : '', referenceUrl: master ? master.referenceUrl : '', manual: master ? master.manual : '',
            assigneeName: null, adjustment: '', 
            
            // 検収モードなら初期値をセット
            submitterName: isInspectionPage ? currentUser.displayName : null,
            submitterPhoto: isInspectionPage ? currentUser.photoURL : null,
            inspectorName: null, 
            status1: isInspectionPage ? '依頼済み' : null, 
            status2: isInspectionPage ? '' : null
        };
    });
    await updateDoc(doc(db, "categories", catId), { items: [...newTasks, ...(cat.items || [])] });
    textarea.value = '';
};

window.addTasksFromHeader = window.addTasks;
window.addSection = async (catId) => {
    if (catId === 'inspection') return;
    const newSection = { id: Date.now(), type: 'section', name: '新しい見出し', isExpanded: false };
    sectionExpandedState[newSection.id] = false;
    const cat = categories.find(c => c.id === catId);
    await updateDoc(doc(db, "categories", catId), { items: [newSection, ...(cat.items || [])] });
};

window.toggleStatus = async (cid, tid, st) => {
    const ns = (st === 'pending' || st === 'planned') ? 'in-progress' : (st === 'in-progress' ? 'completed' : 'pending');
    const scroll = document.querySelector('.content-body');
    if (scroll) { savedScrollPosition = scroll.scrollTop; shouldRestoreScroll = true; }

    const c = categories.find(x => x.id === cid);
    if (!c) return;

    let items = c.items.map(i => ({...i}));
    const taskIndex = items.findIndex(i => i.id == tid);
    if (taskIndex === -1) return;

    const task = items[taskIndex];
    const now = new Date().toISOString(); 

    let ud = {};
    if (ns === 'pending') {
        ud = { status: ns, assigneeName: null, assigneePhoto: null, startedAt: null, completedAt: null };
    } else {
        ud = { status: ns, assigneePhoto: currentUser.photoURL };
        if (ns === 'in-progress') {
            ud.startedAt = now;
            ud.completedAt = null;
        } else if (ns === 'completed') {
            ud.completedAt = now;
        }
    }

    if (ns !== 'pending' && (!task.assigneeName || task.assigneeName !== currentUser.displayName)) ud.assigneeName = currentUser.displayName;
    Object.assign(task, ud);

    if (ns === 'completed') {
        let secIdx = -1;
        for (let i = taskIndex; i >= 0; i--) {
            if (items[i].type === 'section') {
                secIdx = i;
                break;
            }
        }
        if (secIdx !== -1) {
            let endIdx = items.length;
            for (let i = secIdx + 1; i < items.length; i++) {
                if (items[i].type === 'section') {
                    endIdx = i;
                    break;
                }
            }
            const block = items.slice(secIdx, endIdx);
            const tasksInBlock = block.filter(x => x.type === 'task');
            const allComp = tasksInBlock.length > 0 && tasksInBlock.every(t => t.status === 'completed');
            if (allComp) {
                const removedBlock = items.splice(secIdx, endIdx - secIdx);
                items.push(...removedBlock);
            }
        }
    }
    await updateDoc(doc(db, "categories", cid), { items: items });
};

/* ■修正版：予定切り替え（担当者指定対応） */
window.togglePlanned = async (catId, taskId, isChecked, assignee = null) => {
    const scrollContainer = document.querySelector('.content-body');
    if (scrollContainer) { savedScrollPosition = scrollContainer.scrollTop; shouldRestoreScroll = true; }
    
    let updateData = {};
    if (isChecked) {
        // チェックON: 指定された人、いなければ自分
        const name = assignee ? assignee.name : currentUser.displayName;
        const photo = assignee ? assignee.photo : currentUser.photoURL;
        updateData = { status: 'planned', assigneeName: name, assigneePhoto: photo };
    } else {
        // チェックOFF: 解除
        updateData = { status: 'pending', assigneeName: null, assigneePhoto: null };
    }

    const cat = categories.find(c => c.id === catId);
    const newItems = cat.items.map(item => item.id == taskId ? { ...item, ...updateData } : item);
    await updateDoc(doc(db, "categories", catId), { items: newItems });
};

window.handleInspectionLink = async (catId, taskId, url) => {
    if (!url) await window.editUrl(catId, taskId); else window.open(url, '_blank');
};

window.showDatePicker = (catId, taskId, currentDate) => {
    const tempInput = document.createElement('input');
    tempInput.type = 'datetime-local';
    tempInput.style.cssText = "position:fixed; top:50%; left:50%; transform:translate(-50%,-50%); z-index:10000; padding:10px; border:2px solid #1a73e8; border-radius:4px;";
    if (currentDate) {
        const d = new Date(currentDate);
        tempInput.value = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}T${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
    }
    document.body.appendChild(tempInput);
    tempInput.focus(); tempInput.showPicker();
    const cleanup = () => document.body.removeChild(tempInput);
    tempInput.addEventListener('change', async () => {
        if (!tempInput.value) return cleanup();
        const date = new Date(tempInput.value);
        let m = date.getMinutes(); m = m<=15?0:m<=45?30:0; if(m===0&&date.getMinutes()>45) date.setHours(date.getHours()+1); date.setMinutes(m); date.setSeconds(0);
        await window.updateTaskDate(catId, taskId, date.toISOString());
        cleanup();
    });
    tempInput.addEventListener('blur', () => setTimeout(cleanup, 200));
};

window.updateTaskDate = async (catId, taskId, dateValue) => {
    const cat = categories.find(c => c.id === catId);
    const newItems = cat.items.map(item => item.id == taskId ? { ...item, deadline: dateValue } : item);
    await updateDoc(doc(db, "categories", catId), { items: newItems });
};

window.updateItemName = async (catId, itemId, newName) => { await window.updateItemField(catId, itemId, 'name', newName); };
window.deleteSectionItem = async (catId, sectionId) => { window.showDeleteSectionDialog(catId, sectionId); };

window.showDeleteSectionDialog = (catId, sectionId) => {
    if (document.getElementById('deleteSectionDialog')) return;
    const html = `
        <div id="deleteSectionDialog" class="modal-overlay active">
            <div class="delete-section-dialog">
                <h2 style="margin-bottom:20px; font-size:16px;">見出しの削除方法を選択</h2>
                <div class="delete-option"><label class="delete-option-label"><input type="radio" name="deleteOption" value="withTasks" checked><span class="delete-option-text"><strong>グループ内のタスクも削除</strong></span></label></div>
                <div class="delete-option"><label class="delete-option-label"><input type="radio" name="deleteOption" value="onlySection"><span class="delete-option-text"><strong>見出しのみ削除（タスクは残す）</strong></span></label></div>
                <div class="delete-section-actions"><button class="btn-cancel" onclick="document.getElementById('deleteSectionDialog').remove()">キャンセル</button><button class="btn-danger" onclick="window.executeDeleteSection('${catId}', ${sectionId})">削除実行</button></div>
            </div>
        </div>`;
    document.body.insertAdjacentHTML('beforeend', html);
};

window.executeDeleteSection = async (catId, sectionId) => {
    const dialog = document.getElementById('deleteSectionDialog');
    const selectedOption = dialog.querySelector('input[name="deleteOption"]:checked').value;
    const cat = categories.find(c => c.id === catId);
    const itemsBefore = cat.items;
    let newItems = [];
    if (selectedOption === 'withTasks') {
        let insideTarget = false;
        cat.items.forEach(item => {
            if (item.type === 'section') insideTarget = (item.id == sectionId);
            const belongs = item.type === 'task' ? (item.section ? item.section == sectionId : insideTarget) : false;
            if (item.id != sectionId && !belongs) newItems.push(item);
        });
    } else {
        cat.items.forEach(item => {
            if (item.id != sectionId) newItems.push(item.type === 'task' && item.section == sectionId ? { ...item, section: null } : item);
        });
    }
    saveHistory(catId, itemsBefore, newItems);
    await updateDoc(doc(db, "categories", catId), { items: newItems });
    dialog.remove();
};

window.deleteTaskItem = async (catId, taskId) => {
    if (!confirm("削除してもよろしいですか？")) return;
    const cat = categories.find(c => c.id === catId);
    const itemsAfter = cat.items.filter(item => item.id != taskId);
    saveHistory(catId, cat.items, itemsAfter);
    await updateDoc(doc(db, "categories", catId), { items: itemsAfter });
};

window.handleIconClick = (event, catId, taskId, field, currentValue) => {
    event.preventDefault();
    event.stopPropagation(); // バブリング防止を念のため追加

    if (!currentValue) {
        // ...既存の編集モーダルを開く処理...
        if (field === 'referenceUrl') window.editUrl(catId, taskId);
        else if (field === 'manual') window.editManual(catId, taskId);
    } else {
        // ★ここを拡張
        if (field === 'manual') {
            // グローバル変数 manuals 内に ID があるか確認
            const isInternalManual = manuals.some(m => m.id === currentValue);
            if (isInternalManual) {
                window.openSlidePanel(currentValue);
                return;
            }
        }
        // 既存動作（外部リンクとして開く）
        window.open(currentValue, '_blank');
    }
};

window.editUrl = (catId, taskId) => window.showEditModal(catId, taskId, 'referenceUrl', 'URL編集');
window.editMemo = (catId, taskId) => window.showEditModal(catId, taskId, 'memo', 'メモ編集');
window.editManual = (catId, taskId) => window.showEditModal(catId, taskId, 'manual', 'マニュアル編集');
window.editAdjustment = (catId, taskId) => window.showEditModal(catId, taskId, 'adjustment', '調整内容編集');

window.updateItemField = async (catId, itemId, field, value) => {
    const cat = categories.find(c => c.id === catId);
    const items = cat.items.map(i => i.id == itemId ? { ...i, [field]: value } : i);
    await updateDoc(doc(db, "categories", catId), { items });
};

window.showEditModal = async (catId, itemId, field, title) => {
    const cat = categories.find(c => c.id === catId);
    const item = cat.items.find(i => i.id == itemId);
    const currentVal = item[field] || "";
    if(document.getElementById('editModal')) document.getElementById('editModal').remove();
    const html = `
        <div id="editModal" class="modal-overlay active" onclick="if(event.target === event.currentTarget) document.getElementById('editModal').remove()">
            <div class="edit-modal-dialog" onclick="event.stopPropagation()">
                <h2 style="margin-bottom:15px; font-size:16px;">${title}</h2>
                <textarea id="editModalTextarea" placeholder="内容を入力してください...">${escapeHtml(currentVal)}</textarea>
                <div class="edit-modal-actions">
                    <button class="btn-cancel" onclick="document.getElementById('editModal').remove()">キャンセル</button>
                    <button class="btn-primary" onclick="window.saveEditModal('${catId}', ${itemId}, '${field}')">保存</button>
                </div>
            </div>
        </div>`;
    document.body.insertAdjacentHTML('beforeend', html);
    const ta = document.getElementById('editModalTextarea'); if(ta){ ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length); }
};

window.saveEditModal = async (catId, itemId, field) => {
    const ta = document.getElementById('editModalTextarea');
    await window.updateItemField(catId, itemId, field, ta ? ta.value : '');
    const m = document.getElementById('editModal'); if(m) m.remove();
};

window.showTemplateNameModal = async () => {
    if(document.getElementById('templateNameModal')) document.getElementById('templateNameModal').remove();
    const html = `
        <div id="templateNameModal" class="modal-overlay active" onclick="if(event.target === event.currentTarget) document.getElementById('templateNameModal').remove()">
            <div class="edit-modal-dialog" onclick="event.stopPropagation()">
                <h2 style="margin-bottom:15px; font-size:16px;">テンプレート名を入力</h2>
                <textarea id="templateNameTextarea" placeholder="テンプレート名..."></textarea>
                <div class="edit-modal-actions">
                    <button class="btn-cancel" onclick="document.getElementById('templateNameModal').remove()">キャンセル</button>
                    <button class="btn-primary" onclick="window.saveTemplateNameModal()">作成</button>
                </div>
            </div>
        </div>`;
    document.body.insertAdjacentHTML('beforeend', html);
    document.getElementById('templateNameTextarea').focus();
};

window.saveTemplateNameModal = async () => {
    const name = document.getElementById('templateNameTextarea').value.trim();
    if (!name) return;
    const newT = { id: Date.now(), name, items: [] };
    await updateDoc(doc(db, "settings", "common"), { templates: [...templates, newT] });
    openedAccordions['tpl-' + newT.id] = true;
    document.getElementById('templateNameModal').remove();
};

window.showTemplateFieldModal = async (tid, idx, field) => {
    const t = templates.find(temp => temp.id === tid); const item = t.items[idx]; const cur = item[field] || "";
    if(document.getElementById('templateFieldModal')) document.getElementById('templateFieldModal').remove();
    const title = {'memo':'メモ','referenceUrl':'参考リンク','manual':'マニュアル','name':'名前'}[field] || field;
    const html = `
        <div id="templateFieldModal" class="modal-overlay active" onclick="if(event.target === event.currentTarget) document.getElementById('templateFieldModal').remove()">
            <div class="edit-modal-dialog" onclick="event.stopPropagation()">
                <h2 style="margin-bottom:15px; font-size:16px;">${title}を編集</h2>
                <textarea id="templateFieldTextarea" placeholder="内容...">${escapeHtml(cur)}</textarea>
                <div class="edit-modal-actions">
                    <button class="btn-cancel" onclick="document.getElementById('templateFieldModal').remove()">キャンセル</button>
                    <button class="btn-primary" onclick="window.saveTemplateFieldModal(${tid}, ${idx}, '${field}')">保存</button>
                </div>
            </div>
        </div>`;
    document.body.insertAdjacentHTML('beforeend', html);
    const ta = document.getElementById('templateFieldTextarea'); if(ta){ ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length); }
};

window.saveTemplateFieldModal = async (tid, idx, field) => {
    const val = document.getElementById('templateFieldTextarea').value;
    await window.updateTemplateItem(tid, idx, field, val);
    document.getElementById('templateFieldModal').remove();
};

function renderSettingsPage() { return `<div class="settings-content"><div id="templateSettingsArea"></div></div>`; }
window.renderSettingsContentTrigger = () => {
    const area = document.getElementById('templateSettingsArea');
    if(!area) return;
    
    const scrollContainer = document.querySelector('.content-body');
    if(scrollContainer) settingsScrollPos = scrollContainer.scrollTop;

    area.innerHTML = `
        <div id="masterTaskSection"></div>
        <hr style="margin:40px 0; border:0; border-top:1px solid #ddd;">
        <div id="pageTemplateSection"></div>
        <hr style="margin:40px 0; border:0; border-top:1px solid #ddd;">
        <div id="labelSettingsSection"></div>
        <hr style="margin:40px 0; border:0; border-top:1px solid #ddd;">
        <div id="analysisSection"></div>
    `;
    
    renderMasterTaskSettings(document.getElementById('masterTaskSection'));
    renderPageTemplateSettings(document.getElementById('pageTemplateSection'));
    renderLabelSettings(document.getElementById('labelSettingsSection'));
    renderAnalysisSettings(document.getElementById('analysisSection'));
    
    if(scrollContainer && settingsScrollPos > 0) {
        scrollContainer.scrollTop = settingsScrollPos;
        requestAnimationFrame(() => {
            if(scrollContainer.scrollTop !== settingsScrollPos) {
                scrollContainer.scrollTop = settingsScrollPos;
            }
        });
    }
    setTimeout(() => { isRendering = false; }, 100);
    
    new Sortable(document.getElementById('masterTaskList'), { handle: '.sort-handle', animation: 150, onEnd: window.reorderMasterTasks });
    new Sortable(document.getElementById('templateList'), { handle: '.sort-handle', animation: 150, onEnd: window.reorderTemplates });
};

/* ■修正版：タスクテンプレート管理（スクロール維持・アイコン改善版） */
window.isMasterListOpen = true; 
let masterCategoryState = {}; 

function renderMasterTaskSettings(container) {
    const toggleIcon = window.isMasterListOpen ? '▼' : '▶';
    const displayStyle = window.isMasterListOpen ? 'block' : 'none';

    // 1. 未登録タスク（Ghost）の洗い出し
    const registeredNames = new Set(masterTasks.map(t => t.name));
    const ghostTasks = [];
    templates.forEach(tpl => {
        (tpl.items || []).forEach(item => {
            if (item.type === 'task' && !registeredNames.has(item.name)) {
                if (!ghostTasks.some(g => g.name === item.name)) {
                    ghostTasks.push({ name: item.name, category: '未分類', isGhost: true, usedIn: tpl.name });
                }
            }
        });
    });

    // 2. カテゴリグルーピング
    const grouped = new Map();
    const noCatKey = '未分類';
    
    masterTasks.forEach((t, i) => {
        const cat = t.category || noCatKey;
        if (!grouped.has(cat)) grouped.set(cat, []);
        grouped.get(cat).push({ ...t, originalIndex: i });
    });

    if (ghostTasks.length > 0) {
        if (!grouped.has(noCatKey)) grouped.set(noCatKey, []);
        grouped.get(noCatKey).unshift(...ghostTasks);
    }

    const categoriesList = Array.from(grouped.keys());

    // 3. HTML生成
    let contentHtml = '';
    
    if (categoriesList.length === 0) {
        contentHtml = '<p style="color:#999; text-align:center; padding:20px;">登録なし</p>';
    } else {
        contentHtml = categoriesList.map(cat => {
            const items = grouped.get(cat);
            const isOpen = masterCategoryState[cat] !== false; 
            const safeCat = escapeHtml(cat);

            const itemsHtml = items.map(t => {
                if (t.isGhost) {
                    return `
                        <div class="template-item-row ghost-task">
                            <span class="ghost-badge">⚠️ 未登録</span>
                            <div style="flex:1; font-weight:600; color:#555;">${escapeHtml(t.name)}</div>
                            <span style="font-size:10px; color:#999; margin-right:10px;">(${escapeHtml(t.usedIn)}で使用)</span>
                            <button class="btn-primary btn-compact" onclick="window.registerGhostTask('${escapeHtml(t.name)}')">登録</button>
                        </div>`;
                }
                return `
                    <div class="template-item-row" data-original-index="${t.originalIndex}">
                        <span class="sort-handle" style="color:#ccc; cursor:grab;">☰</span>
                        
                        <button class="icon-btn" onclick="window.openMasterCategorySelectModal(${t.originalIndex})" title="カテゴリ移動" style="margin-right:4px;">
                            <svg class="svg-icon" viewBox="0 0 24 24"><path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/></svg>
                        </button>

                        <input type="text" value="${escapeHtml(t.name)}" placeholder="タスク名" onchange="window.updateMasterTask(${t.originalIndex},'name',this.value)" style="flex:1; font-weight:600;">
                        
                        <div class="icon-with-edit">
                            <button class="icon-btn memo-btn ${t.memo?'has-content':''}" onclick="window.handleMasterMemoClick(${t.originalIndex})" title="メモ">${ICONS.memo}</button>
                            <button class="mini-edit-btn" onclick="window.editMasterTaskField(${t.originalIndex},'memo')">✎</button>
                        </div>
                        <div class="icon-with-edit">
                            <button class="icon-btn ${t.referenceUrl?'has-content':''}" onclick="window.handleMasterUrlClick(${t.originalIndex})" title="URL">${ICONS.link}</button>
                            <button class="mini-edit-btn" onclick="window.editMasterTaskField(${t.originalIndex},'referenceUrl')">✎</button>
                        </div>
                        <div class="icon-with-edit">
                            <button class="icon-btn ${t.manual?'has-content':''}" onclick="window.handleMasterTaskManualClick(${t.originalIndex})">${ICONS.manual}</button>
                            <button class="mini-edit-btn" onclick="window.selectMasterTaskManual(${t.originalIndex})">✎</button>
                        </div>
                        
                        <button class="btn-delete" onclick="window.deleteMasterTask(${t.originalIndex})">×</button>
                    </div>`;
            }).join('');

            const catNameInput = (cat !== noCatKey)
                ? `<input type="text" class="master-cat-name-input" value="${safeCat}" onclick="event.stopPropagation()" onblur="window.updateMasterCategoryName('${safeCat}', this.value)" onkeydown="if(event.key==='Enter')this.blur()">`
                : `<span style="font-weight:700; padding:2px 4px; margin-left:4px;">${safeCat}</span>`;

            const catDomId = 'cat-group-' + String(cat).replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_\u3000-\u303f\u3040-\u309f\u30a0-\u30ff\uff00-\uff9f\u4e00-\u9faf]/g, '');

            return `
                <div class="master-category-group" data-category="${safeCat}">
                    <div class="master-category-header ${isOpen?'active':''}" id="header-${catDomId}" onclick="window.toggleMasterCategory('${safeCat}', '${catDomId}')">
                        <div style="display:flex; align-items:center; flex:1;">
                            <span class="master-cat-drag" onclick="event.stopPropagation()">☰</span>
                            <span class="master-cat-arrow">▼</span>
                            ${catNameInput}
                        </div>
                        <span style="font-weight:normal; color:#666; font-size:11px;">${items.length}件</span>
                    </div>
                    <div class="master-category-body ${isOpen?'open':''}" id="body-${catDomId}">
                        <div class="template-items-list" style="margin:0; border:none; gap:5px; padding:5px;">
                            ${itemsHtml}
                        </div>
                    </div>
                </div>`;
        }).join('');
    }

    container.innerHTML = `
        <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:15px;">
            <h3 style="color:#333; font-size:18px; font-weight:600; margin:0;">タスクテンプレート管理</h3>
            <button class="btn-section" onclick="window.toggleMasterTaskList()" style="min-width:100px;">${toggleIcon} 表示/非表示</button>
        </div>
        
        <div id="masterTaskContainer" style="display:${displayStyle};">
            <p style="font-size:12px; color:#666; margin-bottom:15px;">登録したタスクは、ページテンプレート作成時や「タスク一括追加」で自動補完されます。</p>
            <button class="btn-primary btn-compact" onclick="window.showAddMasterTaskModal()" style="margin-bottom:15px;">+ 新規タスクテンプレート作成</button>
            
            <div id="masterTaskListRoot">
                ${contentHtml}
            </div>
        </div>
    `;

    // Sortable適用
    const rootEl = document.getElementById('masterTaskListRoot');
    if (rootEl) {
        new Sortable(rootEl, {
            animation: 150, handle: '.master-cat-drag', onEnd: window.reorderMasterCategories
        });
    }
    categoriesList.forEach(cat => {
        const catDomId = 'cat-group-' + String(cat).replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_\u3000-\u303f\u3040-\u309f\u30a0-\u30ff\uff00-\uff9f\u4e00-\u9faf]/g, '');
        const bodyEl = document.getElementById(`body-${catDomId}`);
        if(bodyEl) {
            new Sortable(bodyEl.querySelector('.template-items-list'), {
                group: 'masterTasks', animation: 150, handle: '.sort-handle', draggable: '.template-item-row:not(.ghost-task)',
                onEnd: window.onMasterTaskSortEnd
            });
        }
    });

    // ★スクロール復元処理 (再描画後に位置を戻す)
    if (window.preserveSettingsScroll && window.savedSettingsScrollTop > 0) {
        const scrollContainer = document.getElementById('categoryTabs'); // サイドバーのスクロール領域
        if (scrollContainer) {
            scrollContainer.scrollTop = window.savedSettingsScrollTop;
        }
        window.preserveSettingsScroll = false;
    }
}

// 折りたたみ
window.toggleMasterCategory = (catName, domId) => {
    masterCategoryState[catName] = masterCategoryState[catName] === false ? true : false;
    const header = document.getElementById(`header-${domId}`);
    const body = document.getElementById(`body-${domId}`);
    if (header && body) {
        header.classList.toggle('active');
        body.classList.toggle('open');
    }
};

// カテゴリ名変更
window.updateMasterCategoryName = async (oldName, newName) => {
    const trimmed = newName.trim();
    if (!trimmed || trimmed === oldName) return;

    // ★スクロール位置を保存
    window.preserveSettingsScroll = true;
    window.savedSettingsScrollTop = document.getElementById('categoryTabs')?.scrollTop || 0;

    isRendering = true;
    const newTasks = masterTasks.map(t => t.category === oldName ? { ...t, category: trimmed } : t);
    await setDoc(doc(db,"settings","master"), { params: newTasks }, { merge: true });
};

// カテゴリ並び替え
window.reorderMasterCategories = async (evt) => {
    if (evt.oldIndex === evt.newIndex) return;
    const root = document.getElementById('masterTaskListRoot');
    const newMasterTasks = [];
    root.querySelectorAll('.master-category-group').forEach(group => {
        const catName = group.getAttribute('data-category');
        group.querySelectorAll('.template-item-row').forEach(row => {
            if (row.classList.contains('ghost-task')) return;
            const originalIdx = parseInt(row.getAttribute('data-original-index'));
            const task = { ...masterTasks[originalIdx] };
            task.category = (catName === '未分類') ? '' : catName;
            newMasterTasks.push(task);
        });
    });

    // ★スクロール位置を保存
    window.preserveSettingsScroll = true;
    window.savedSettingsScrollTop = document.getElementById('categoryTabs')?.scrollTop || 0;

    isRendering = true;
    masterTasks = newMasterTasks; 
    await setDoc(doc(db,"settings","master"), { params: newMasterTasks }, { merge: true });
};

// 未登録タスクの登録
window.registerGhostTask = async (name) => {
    // ★スクロール位置を保存
    window.preserveSettingsScroll = true;
    window.savedSettingsScrollTop = document.getElementById('categoryTabs')?.scrollTop || 0;

    isRendering = true;
    const newTask = { name: name, category: '', memo: '', referenceUrl: '', manual: '' };
    const newTasks = [...masterTasks, newTask];
    await setDoc(doc(db,"settings","master"), { params: newTasks }, { merge: true });
};

// カテゴリ選択モーダル（アイコン修正版）
window.openMasterCategorySelectModal = (idx) => {
    if(document.getElementById('catEditModal')) document.getElementById('catEditModal').remove();
    
    const existingCats = [...new Set(masterTasks.map(t => t.category || ''))].filter(c => c).sort();
    
    // ★アイコンをSVGに変更
    const chipsHtml = existingCats.map(c => `
        <div class="category-chip" onclick="window.selectCategoryFromChip('${escapeHtml(c)}')">
            <svg class="svg-icon" viewBox="0 0 24 24" style="width:16px;height:16px;fill:#5f6368;"><path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/></svg>
            ${escapeHtml(c)}
        </div>
    `).join('');

    const t = masterTasks[idx];

    const html = `
        <div id="catEditModal" class="modal-overlay active" onclick="if(event.target===event.currentTarget)document.getElementById('catEditModal').remove()">
            <div class="edit-modal-dialog">
                <h2>カテゴリ移動</h2>
                <div style="margin-bottom:15px;">
                    <p style="font-size:12px; color:#666; margin-bottom:8px;">一覧から選択するか、新しいカテゴリ名を入力してください</p>
                    
                    <div class="category-chip-list">
                        ${chipsHtml || '<span style="color:#999; font-size:11px;">既存カテゴリなし</span>'}
                        <div class="category-chip" onclick="window.selectCategoryFromChip('')" style="border-style:dashed; color:#666;">
                            未分類にする
                        </div>
                    </div>

                    <label style="font-size:12px; font-weight:bold;">カテゴリ名入力</label>
                    <input type="text" id="editCatInput" value="${escapeHtml(t.category || '')}" class="input-simple" style="width:100%;">
                </div>
                <div class="edit-modal-actions">
                    <button class="btn-cancel" onclick="document.getElementById('catEditModal').remove()">キャンセル</button>
                    <button class="btn-primary" onclick="window.saveMasterTaskCategory(${idx})">保存</button>
                </div>
            </div>
        </div>`;
    document.body.insertAdjacentHTML('beforeend', html);
    document.getElementById('editCatInput').focus();
};

window.saveMasterTaskCategory = async (idx) => {
    const val = document.getElementById('editCatInput').value.trim();
    
    // ★スクロール位置を保存
    window.preserveSettingsScroll = true;
    window.savedSettingsScrollTop = document.getElementById('categoryTabs')?.scrollTop || 0;

    isRendering = true;
    await window.updateMasterTask(idx, 'category', val);
    document.getElementById('catEditModal').remove();
};

/* 新規作成モーダルも同様にUI強化 */
window.showAddMasterTaskModal = () => {
    if(document.getElementById('bulkMasterTaskModal')) document.getElementById('bulkMasterTaskModal').remove();
    
    const existingCats = [...new Set(masterTasks.map(t => t.category || ''))].filter(c => c).sort();
    const chipsHtml = existingCats.map(c => `
        <div class="category-chip" onclick="document.getElementById('bulkMasterCat').value='${escapeHtml(c)}'">
            ${escapeHtml(c)}
        </div>
    `).join('');

    const html = `
        <div id="bulkMasterTaskModal" class="modal-overlay active" onclick="if(event.target===event.currentTarget)document.getElementById('bulkMasterTaskModal').remove()">
            <div class="edit-modal-dialog">
                <h2>タスクテンプレート追加</h2>
                
                <div style="margin-bottom:15px;">
                    <label style="font-size:12px; font-weight:bold; display:block; margin-bottom:5px;">カテゴリ (任意)</label>
                    <div class="category-chip-list" style="margin-bottom:5px;">
                        ${chipsHtml}
                    </div>
                    <input type="text" id="bulkMasterCat" placeholder="カテゴリ名を入力または選択" class="input-simple" style="width:100%;">
                </div>

                <p style="font-size:12px;color:#666;margin-bottom:8px;">タスク名 (1行につき1つ)</p>
                <textarea id="bulkMasterTaskText" placeholder="例：&#13;&#10;タスクA&#13;&#10;タスクB" style="height:150px; border:1px solid #ddd; padding:8px; width:100%; border-radius:4px;"></textarea>
                
                <div class="edit-modal-actions">
                    <button class="btn-cancel" onclick="document.getElementById('bulkMasterTaskModal').remove()">キャンセル</button>
                    <button class="btn-primary" onclick="window.saveBulkMasterTasks()">追加</button>
                </div>
            </div>
        </div>`;
    document.body.insertAdjacentHTML('beforeend', html);
    document.getElementById('bulkMasterTaskText').focus();
};

window.saveBulkMasterTasks = async () => {
    const text = document.getElementById('bulkMasterTaskText').value;
    const cat = document.getElementById('bulkMasterCat').value.trim();
    
    const lines = text.split('\n').map(l => l.trim()).filter(l => l);
    if(lines.length === 0) return;

    isRendering = true;
    const newTasks = lines.map(name => ({ 
        name: name, 
        category: cat, 
        memo: '', 
        referenceUrl: '', 
        manual: '' 
    }));
    
    await setDoc(doc(db,"settings","master"), { params: [...masterTasks, ...newTasks] }, { merge: true });
    document.getElementById('bulkMasterTaskModal').remove();
};

// 折りたたみ切り替え関数
window.toggleMasterTaskList = () => {
    window.isMasterListOpen = !window.isMasterListOpen;
    // 再描画せずDOM操作だけで高速に切り替え
    const container = document.getElementById('masterTaskContainer');
    const btn = document.querySelector('#masterTaskSection .btn-section');
    if(container) container.style.display = window.isMasterListOpen ? 'block' : 'none';
    if(btn) btn.innerHTML = `${window.isMasterListOpen ? '▼' : '▶'} 表示/非表示`;
};

window.reorderMasterTasks = async (evt) => {
    if (evt.oldIndex === evt.newIndex) return;
    isRendering = true;
    const newTasks = [...masterTasks];
    const [moved] = newTasks.splice(evt.oldIndex, 1);
    newTasks.splice(evt.newIndex, 0, moved);
    await setDoc(doc(db,"settings","master"), { params: newTasks }, { merge: true });
};

window.reorderTemplates = async (evt) => {
    if (evt.oldIndex === evt.newIndex) return;
    isRendering = true;
    const newTemplates = [...templates];
    const [moved] = newTemplates.splice(evt.oldIndex, 1);
    newTemplates.splice(evt.newIndex, 0, moved);
    await updateDoc(doc(db, "settings", "common"), { templates: newTemplates });
};

window.showAddMasterTaskModal = () => {
    if(document.getElementById('bulkMasterTaskModal')) document.getElementById('bulkMasterTaskModal').remove();
    const html = `
        <div id="bulkMasterTaskModal" class="modal-overlay active" onclick="if(event.target===event.currentTarget)document.getElementById('bulkMasterTaskModal').remove()">
            <div class="edit-modal-dialog">
                <h2>タスクテンプレート一括追加</h2>
                <p style="font-size:12px;color:#666;margin-bottom:8px;">1行につき1つのタスク名を入力してください</p>
                <textarea id="bulkMasterTaskText" placeholder="例：&#13;&#10;タスクA&#13;&#10;タスクB&#13;&#10;タスクC" style="height:200px;"></textarea>
                <div class="edit-modal-actions">
                    <button class="btn-cancel" onclick="document.getElementById('bulkMasterTaskModal').remove()">キャンセル</button>
                    <button class="btn-primary" onclick="window.saveBulkMasterTasks()">追加</button>
                </div>
            </div>
        </div>`;
    document.body.insertAdjacentHTML('beforeend', html);
    document.getElementById('bulkMasterTaskText').focus();
};

window.saveBulkMasterTasks = async () => {
    const text = document.getElementById('bulkMasterTaskText').value;
    const lines = text.split('\n').map(l => l.trim()).filter(l => l);
    if(lines.length === 0) return;

    isRendering = true;
    const newTasks = lines.map(name => ({ name: name, memo: '', referenceUrl: '', manual: '' }));
    await setDoc(doc(db,"settings","master"), { params: [...masterTasks, ...newTasks] }, { merge: true });
    document.getElementById('bulkMasterTaskModal').remove();
};

window.checkUsage = (taskName) => {
    const usedIn = templates.filter(tpl => 
        tpl.items && tpl.items.some(item => item.type === 'task' && item.name === taskName)
    );

    let msg = '';
    if (usedIn.length === 0) {
        msg = '<p>このタスクを使用しているページテンプレートはありません。</p>';
    } else {
        msg = '<ul style="list-style-type: disc; padding-left: 20px;">' + usedIn.map(t => `<li>${escapeHtml(t.name)}</li>`).join('') + '</ul>';
    }

    if(document.getElementById('usageModal')) document.getElementById('usageModal').remove();
    const html = `
        <div id="usageModal" class="modal-overlay active" onclick="if(event.target===event.currentTarget)document.getElementById('usageModal').remove()">
            <div class="edit-modal-dialog">
                <h2>「${escapeHtml(taskName)}」の使用状況</h2>
                <div style="margin-top:10px;">${msg}</div>
                <div class="edit-modal-actions">
                    <button class="btn-primary" onclick="document.getElementById('usageModal').remove()">閉じる</button>
                </div>
            </div>
        </div>`;
    document.body.insertAdjacentHTML('beforeend', html);
};

window.updateMasterTask = async (idx, field, val) => {
    isRendering = true;
    const newTasks = [...masterTasks]; newTasks[idx][field] = val;
    await setDoc(doc(db,"settings","master"), { params: newTasks }, { merge: true });
};
window.deleteMasterTask = async (idx) => {
    if(!confirm("削除しますか？")) return;
    isRendering = true;
    const newTasks = masterTasks.filter((_, i) => i !== idx);
    await setDoc(doc(db,"settings","master"), { params: newTasks }, { merge: true });
};
window.editMasterTaskField = async (idx, field) => {
    const t = masterTasks[idx];
    if(document.getElementById('editModal')) document.getElementById('editModal').remove();
    const map = { memo:'メモ', referenceUrl:'参考リンク', manual:'マニュアル' };
    const html = `
        <div id="editModal" class="modal-overlay active" onclick="if(event.target===event.currentTarget)document.getElementById('editModal').remove()">
            <div class="edit-modal-dialog">
                <h2>${map[field]}を編集</h2>
                <textarea id="mtEditTa">${escapeHtml(t[field]||'')}</textarea>
                <div class="edit-modal-actions">
                    <button class="btn-cancel" onclick="document.getElementById('editModal').remove()">キャンセル</button>
                    <button class="btn-primary" onclick="window.saveMasterTaskField(${idx},'${field}')">保存</button>
                </div>
            </div>
        </div>`;
    document.body.insertAdjacentHTML('beforeend', html);
};
window.saveMasterTaskField = async (idx, field) => {
    const val = document.getElementById('mtEditTa').value;
    isRendering = true;
    await window.updateMasterTask(idx, field, val);
    document.getElementById('editModal').remove();
};

/* ■修正版：ページテンプレート管理（+ボタンのクラス調整） */
function renderPageTemplateSettings(container) {
    const dataListHtml = `<datalist id="masterTaskOptions">${masterTasks.map(t => `<option value="${escapeHtml(t.name)}">`).join('')}</datalist>`;

    container.innerHTML = `
        <h3 style="margin-bottom:15px;color:#333;font-size:18px;font-weight:600;">ページテンプレート管理</h3>
        ${dataListHtml}
        <button class="btn-primary btn-compact" onclick="window.createNewTemplate()" style="margin-bottom:20px;">+ 新規テンプレート作成</button>
        <div id="templateList">${templates.length===0?'<p style="color:#999;">テンプレートがありません</p>':''}</div>
    `;
    
    const l = document.getElementById('templateList'); if (!templates.length || !l) return;
    
    l.innerHTML = templates.map(t => {
        const ih = (t.items || []).map((item, i) => {
            if (item.type === 'section') return `<div class="template-item-row section-header" style="background:#f1f3f4;">
                <input type="text" value="${escapeHtml(item.name)}" onchange="window.updateTemplateItem(${t.id},${i},'name',this.value)" style="background:transparent; font-weight:bold; color:#333;">
                
                <button class="btn-delete btn-template-add" onclick="window.openTemplateSectionBulkModal(${t.id},${i})" title="この見出しにタスク追加">+</button>
                
                <button class="btn-delete" onclick="window.removeTemplateItem(${t.id},${i})">×</button>
            </div>`;
            
            return `<div class="template-item-row">
                <input type="text" list="masterTaskOptions" value="${escapeHtml(item.name)}" onchange="window.updateTemplateItem(${t.id},${i},'name',this.value)" style="flex:1;" placeholder="タスク名を入力...">
                
                <div class="icon-with-edit">
                    <button class="icon-btn memo-btn ${item.memo?'has-content':''}" onclick="window.handleTemplateMemoClick(${t.id},${i})" title="メモ">${ICONS.memo}</button>
                    <button class="mini-edit-btn" onclick="event.stopPropagation();window.editTemplateField(${t.id},${i},'memo')">✎</button>
                </div>
                <div class="icon-with-edit">
                    <button class="icon-btn ${item.referenceUrl?'has-content':''}" onclick="window.handleTemplateUrlClick(${t.id},${i})" title="リンク">${ICONS.link}</button>
                    <button class="mini-edit-btn" onclick="event.stopPropagation();window.editTemplateField(${t.id},${i},'referenceUrl')">✎</button>
                </div>
                <div class="icon-with-edit">
                    <button class="icon-btn ${item.manual?'has-content':''}" onclick="window.handleTemplateManualClick(${t.id},${i})" title="マニュアル">${ICONS.manual}</button>
                    <button class="mini-edit-btn" onclick="event.stopPropagation();window.selectTemplateManual(${t.id},${i})">✎</button>
                </div>
                <button class="btn-delete" onclick="window.removeTemplateItem(${t.id},${i})">×</button>
            </div>`;        
        }).join('');
        
        return `<div class="accordion ${openedAccordions['tpl-'+t.id]?'active':''}" id="tpl-${t.id}">
            <div class="accordion-header" onclick="window.toggleAccordion('tpl-${t.id}')">
                <div class="accordion-header-left">
                    <span class="sort-handle" onclick="event.stopPropagation()">☰</span>
                    <span class="accordion-arrow">▼</span>
                    <div class="accordion-title-group">
                        <span class="template-name">${escapeHtml(t.name)} <span class="task-count">(${t.items ? t.items.length : 0} タスク)</span></span>
                    </div>
                </div>
                <div style="display:flex; gap:5px;">
                    <button class="btn-section btn-small" onclick="event.stopPropagation();window.duplicateTemplate(${t.id})">複製</button>
                    <button class="btn-danger btn-small" onclick="event.stopPropagation();window.deleteTemplate(${t.id})">削除</button>
                </div>
            </div>
            <div class="accordion-content" style="display:${openedAccordions['tpl-'+t.id]?'block':'none'};">
                <div class="form-group"><label>ページ名</label><input type="text" class="page-name-input" value="${escapeHtml(t.name)}" onblur="window.updateTemplateName(${t.id},this.value)"></div>
                <div class="template-items-editor">
                    <div id="tpl-items-${t.id}" class="template-items-list">${ih}</div>
                    <div style="background:#f9f9f9;padding:10px;margin-top:10px;border-radius:4px;">
                        <textarea id="tpl-bulk-${t.id}" placeholder="改行区切りで一括追加" style="width:100%;height:50px;font-size:12px;margin-bottom:5px;"></textarea>
                        <div style="display:flex;gap:8px;">
                            <button class="btn-add btn-compact" onclick="window.addTemplateItem(${t.id},'section')">+ 見出し追加</button>
                            <button class="btn-add btn-compact" onclick="window.bulkAddTemplateTasksFromInput(${t.id})">+ タスク一括追加</button>
                        </div>
                    </div>
                </div>
            </div>
        </div>`;
    }).join('');
    
    templates.forEach(t => {
        const el = document.getElementById(`tpl-items-${t.id}`);
        if (el) new Sortable(el, { animation: 150, handle: '.template-item-row', onEnd: (evt) => window.reorderTemplateItems(t.id, evt.oldIndex, evt.newIndex) });
    });
}

/* ■修正後のページテンプレート操作関数群（スクロール位置保護・即時反映版） */

window.toggleAccordion = (id) => { openedAccordions[id] = !openedAccordions[id]; window.renderSettingsContentTrigger(); };
window.createNewTemplate = async () => window.showTemplateNameModal();
window.deleteTemplate = async (id) => { if (!confirm("削除しますか？")) return; const nt = templates.filter(t => t.id !== id); await updateDoc(doc(db, "settings", "common"), { templates: nt }); };
window.updateTemplateName = async (id, name) => { const nt = templates.map(t => t.id === id ? { ...t, name } : t); await updateDoc(doc(db, "settings", "common"), { templates: nt }); };

// ヘルパー：現在のスクロール位置を確実に保存する
/* ■修正後のページテンプレート操作関数群（スクロール位置保護・即時反映版） */

// ヘルパー：現在のスクロール位置を確実に保存する
function captureScroll() {
    const sc = document.querySelector('.content-body');
    if (sc) settingsScrollPos = sc.scrollTop;
}

// 【修正】isRenderingによるブロックを廃止し、スクロール位置保存(captureScroll)を追加
window.addTemplateItem = async (tid, type) => { 
    captureScroll(); // ボタンを押した瞬間の位置を保存
    const t = templates.find(tmp => tmp.id === tid); 
    
    // ★修正ポイント：ここで id: Date.now() を追加しました！
    // これが無いと、後で追加先として指定できませんでした。
    const ni = { 
        id: Date.now(), 
        type, 
        name: type === 'section' ? '新しい見出し' : '新しいタスク' 
    }; 
    
    const nt = templates.map(tmp => tmp.id === tid ? { ...tmp, items: [...(tmp.items || []), ni] } : tmp); 
    
    await updateDoc(doc(db, "settings", "common"), { templates: nt }); 
};

// 【修正】タスク一括追加（isRendering = true を完全に削除）
window.bulkAddTemplateTasksFromInput = async (tid) => { 
    const ta = document.getElementById(`tpl-bulk-${tid}`); 
    if (!ta) return; 
    
    // 空行を除去してリスト化
    const l = ta.value.trim().split('\n').filter(x => x.trim()); 
    if (l.length === 0) return; 
    
    captureScroll(); // 現在のスクロール位置を保存
    
    // マスタタスクから情報を引きつつ、新しいタスクオブジェクトを作成
    const ni = l.map(line => { 
        const m = masterTasks.find(mas => mas.name === line.trim()); 
        return { 
            type: 'task', 
            name: line.trim(), 
            memo: m?.memo || '', 
            referenceUrl: m?.referenceUrl || '', 
            manual: m?.manual || '' 
        }; 
    }); 
    
    // 既存のテンプレートデータに結合
    const nt = templates.map(tmp => tmp.id === tid ? { ...tmp, items: [...(tmp.items || []), ...ni] } : tmp); 
    
    // ★ここが重要： isRendering = true; を書かないことで、保存直後に画面が更新されます
    await updateDoc(doc(db, "settings", "common"), { templates: nt }); 
    
    ta.value = ''; // 入力欄をクリア
};

window.editTemplateField = async (tid, idx, f) => window.showTemplateFieldModal(tid, idx, f);

// 【修正】編集反映
window.updateTemplateItem = async (tid, idx, f, v) => { 
    captureScroll(); // 位置保存
    const t = templates.find(tmp => tmp.id === tid); 
    const ni = [...t.items]; 
    ni[idx] = { ...ni[idx], [f]: v }; 
    const nt = templates.map(tmp => tmp.id === tid ? { ...tmp, items: ni } : tmp); 
    await updateDoc(doc(db, "settings", "common"), { templates: nt }); 
};

// 【修正】削除反映
window.removeTemplateItem = async (tid, idx) => { 
    captureScroll(); // 位置保存
    const t = templates.find(tmp => tmp.id === tid); 
    const ni = t.items.filter((_, i) => i !== idx); 
    const nt = templates.map(tmp => tmp.id === tid ? { ...tmp, items: ni } : tmp); 
    await updateDoc(doc(db, "settings", "common"), { templates: nt }); 
};

// 【修正】並び替え反映
window.reorderTemplateItems = async (tid, oi, ni) => { 
    if (oi === ni) return; 
    captureScroll(); // ドラッグ＆ドロップ完了時の位置を維持
    const t = templates.find(tmp => tmp.id === tid); 
    const nits = [...t.items]; 
    const [m] = nits.splice(oi, 1); 
    nits.splice(ni, 0, m); 
    const nt = templates.map(tmp => tmp.id === tid ? { ...tmp, items: nits } : tmp); 
    await updateDoc(doc(db, "settings", "common"), { templates: nt }); 
};

window.showAddCategoryModal = async () => {
    if(document.getElementById('categorySelectModal')) document.getElementById('categorySelectModal').remove();
    const to = templates.map(t => `<button class="template-select-item" onclick="window.addCategoryFromTemplate(${t.id})">${escapeHtml(t.name)}</button>`).join('');
    const html = `
        <div id="categorySelectModal" class="modal-overlay active" onclick="if(event.target === event.currentTarget) document.getElementById('categorySelectModal').remove()">
            <div class="edit-modal-dialog" onclick="event.stopPropagation()">
                <h2 style="margin-bottom:15px; font-size:16px;">追加するタスクページを選択</h2>
                <div class="template-select-list">${to||'<p style="padding:20px;color:#999;text-align:center;">テンプレートなし</p>'}</div>
                <div class="edit-modal-actions"><button class="btn-cancel" onclick="document.getElementById('categorySelectModal').remove()">キャンセル</button></div>
            </div>
        </div>`;
    document.body.insertAdjacentHTML('beforeend', html);
};

window.addCategoryFromTemplate = async (tid) => {
    const t = templates.find(tmp => tmp.id === tid); if (!t) return;
    const id = "cat_" + Date.now();
    const ini = (t.items || []).map(i => ({ ...i, id: Date.now() + Math.random(), status: i.type === 'task' ? 'pending' : null, status1: null, status2: null, submitterName: null, inspectorName: null, adjustment: '' }));
    let minO = categories.length > 0 ? Math.min(...categories.map(c => c.order || 0)) : 0;
    await setDoc(doc(db, "categories", id), { name: t.name, items: ini, order: minO - 1 });
    document.getElementById('categorySelectModal').remove(); window.switchView(id);
};

window.logout = () => signOut(auth).then(() => location.reload());
function updateLogoDisplay() { const l = document.querySelector('.logo-placeholder'); if (l && logoSettings.imageUrl) l.style.backgroundImage = `url(${logoSettings.imageUrl})`; else if (l) l.style.backgroundImage = ''; }
window.openLogoLink = () => { if (logoSettings.linkUrl) window.open(logoSettings.linkUrl, '_blank'); };
window.showLogoSettingsModal = () => {
    const m = document.getElementById('addCategoryModal');
    m.innerHTML = `
        <div class="modal-backdrop" onclick="window.closeModal()"></div>
        <div class="modal-content modal-center">
            <h3>アイコン設定</h3>
            <label>画像URL:</label><input type="text" id="logoImageUrl" value="${logoSettings.imageUrl||''}" style="width:100%;margin-bottom:10px;padding:6px;border:1px solid #ddd;border-radius:4px;">
            <label>リンク先URL:</label><input type="text" id="logoLinkUrl" value="${logoSettings.linkUrl||''}" style="width:100%;margin-bottom:10px;padding:6px;border:1px solid #ddd;border-radius:4px;">
            <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:16px;"><button onclick="window.closeModal()" style="padding:6px 12px;background:#f1f3f4;border:none;border-radius:4px;cursor:pointer;">キャンセル</button><button onclick="window.saveLogoSettings()" style="padding:6px 12px;background:#3a3a3a;color:#fff;border:none;border-radius:4px;cursor:pointer;">保存</button></div>
        </div>`;
    m.style.display = 'block';
};
window.saveLogoSettings = async () => {
    const i = document.getElementById('logoImageUrl').value.trim(); const l = document.getElementById('logoLinkUrl').value.trim();
    logoSettings = { imageUrl: i, linkUrl: l };
    const r = doc(db, "settings", "common"); const s = await getDoc(r);
    await setDoc(r, { ...(s.exists() ? s.data() : {}), logoSettings }, { merge: true });
    updateLogoDisplay(); window.closeModal();
};

window.closeModal = () => {
    const m = document.getElementById('addCategoryModal');
    if(m) {
        m.style.display = 'none';
        m.innerHTML = '';
    }
    const overlays = document.querySelectorAll('.modal-overlay');
    overlays.forEach(el => {
        if (el.id !== 'addCategoryModal') {
            el.remove();
        }
    });
};

/* ■ラベル管理機能 */
function renderLabelSettings(container) {
    const labelsHtml = definedLabels.map((lbl, idx) => `
        <div class="label-setting-item">
            <div class="label-preview-dot color-swatch c-${lbl.color}" style="margin:0;"></div>
            <span style="font-weight:600; color:#333;">${escapeHtml(lbl.text)}</span>
            <button class="label-delete-btn" onclick="window.deleteDefinedLabel(${idx})">×</button>
        </div>
    `).join('');

    container.innerHTML = `
        <h3 style="margin-bottom:15px; color:#333; font-size:18px; font-weight:600;">ラベル管理</h3>
        <p style="font-size:12px; color:#666; margin-bottom:15px;">タスクに付与するラベルのプリセットを管理します。</p>
        
        <div class="label-settings-list">${labelsHtml || '<span style="color:#999;font-size:12px;">ラベルが登録されていません</span>'}</div>
        
        <div class="label-add-form">
            <div style="display:flex; align-items:center; gap:8px;">
                <div class="color-swatch c-red" id="newLabelColorPreview" style="cursor:default;"></div>
                <select id="newLabelColor" class="label-color-select" onchange="document.getElementById('newLabelColorPreview').className='color-swatch c-'+this.value">
                    <option value="red">Red</option>
                    <option value="blue">Blue</option>
                    <option value="green">Green</option>
                    <option value="yellow">Yellow</option>
                    <option value="orange">Orange</option>
                    <option value="purple">Purple</option>
                </select>
            </div>
            <input type="text" id="newLabelText" placeholder="ラベル名 (3文字以内)" maxlength="3" style="padding:6px; border:1px solid #dadce0; border-radius:4px; font-size:12px; width:120px;">
            <button class="btn-primary" onclick="window.addDefinedLabel()">追加</button>
        </div>
    `;
}

window.addDefinedLabel = async () => {
    const text = document.getElementById('newLabelText').value.trim();
    const color = document.getElementById('newLabelColor').value;
    if (!text) return alert('ラベル名を入力してください');
    
    const newLabels = [...definedLabels, { text, color }];
    await updateDoc(doc(db, "settings", "common"), { definedLabels: newLabels });
    
    const input = document.getElementById('newLabelText');
    if(input) input.value = '';
};

window.deleteDefinedLabel = async (idx) => {
    if(!confirm('このラベル設定を削除しますか？（使用中のタスクのラベルは消えません）')) return;
    const newLabels = definedLabels.filter((_, i) => i !== idx);
    await updateDoc(doc(db, "settings", "common"), { definedLabels: newLabels });
};

/* ■データ分析・CSVエクスポート機能 */
function renderAnalysisSettings(container) {
    container.innerHTML = `
        <h3 style="margin-bottom:15px; color:#333; font-size:18px; font-weight:600;">データ分析</h3>
        <p style="font-size:12px; color:#666; margin-bottom:15px;">全ページのタスクデータをCSV形式でダウンロードします。<br>着手・完了日時が記録されており、Excelやスプレッドシートで分析に使用できます。</p>
        
        <div style="background:#f8f9fa; padding:20px; border-radius:8px; border:1px solid #eee; display:flex; align-items:center; gap:15px;">
            <div style="flex:1;">
                <div style="font-weight:600; font-size:14px; margin-bottom:4px;">タスクログのエクスポート</div>
                <div style="font-size:11px; color:#5f6368;">出力項目: ページ名 / タスク名 / ステータス / 着手日時 / 完了日時</div>
            </div>
            <button class="btn-primary" onclick="window.downloadCSV()" style="padding:10px 20px;">
                ${ICONS.search} CSVダウンロード
            </button>
        </div>
    `;
}

window.downloadCSV = () => {
    let csvContent = "ページ名,タスク名,ステータス,着手日時,完了日時\n";
    categories.forEach(cat => {
        const tasks = (cat.items || []).filter(i => i.type === 'task');
        tasks.forEach(t => {
            const pageName = `"${(cat.name || '').replace(/"/g, '""')}"`;
            const taskName = `"${(t.name || '').replace(/"/g, '""')}"`;
            let statusText = '';
            if (t.status === 'completed' || (cat.id === 'inspection' && t.status1 === '反映済み')) statusText = '完了';
            else if (t.status === 'in-progress') statusText = '着手';
            else if (t.status === 'planned') statusText = '予定';
            else statusText = '未着手';

            const formatTime = (isoStr) => {
                if (!isoStr) return '';
                const d = new Date(isoStr);
                return `${d.getFullYear()}/${String(d.getMonth()+1).padStart(2,'0')}/${String(d.getDate()).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}:${String(d.getSeconds()).padStart(2,'0')}`;
            };
            const startedAt = formatTime(t.startedAt);
            const completedAt = formatTime(t.completedAt);
            csvContent += `${pageName},${taskName},${statusText},${startedAt},${completedAt}\n`;
        });
    });
    const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const now = new Date();
    const dateStr = `${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}`;
    link.setAttribute("href", url);
    link.setAttribute("download", `tasks_${dateStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};

/* ■修正版：マニュアル一覧（手動並び替え・編集ボタン縮小・onSnapshot廃止対応） */
function renderManualList() {
    if (manuals.length === 0) {
        return `<div style="padding:40px; text-align:center; color:#999;">マニュアルがまだありません。<br>右上のボタンから作成してください。</div>`;
    }
    
    // リスト形式で描画
    const rows = manuals.map(m => {
        return `
        <div class="manual-row" data-id="${m.id}">
            <span class="sort-handle" style="margin-right:10px; cursor:grab; color:#ccc;">☰</span>

            <div class="manual-row-actions" style="margin-right:10px;">
                <button class="btn-primary" onclick="window.switchView('manual_edit_${m.id}')" style="height:28px; padding:0 12px; font-size:11px; min-width:auto;">編集</button>

                <button class="icon-btn" onclick="window.openSlidePanel('${m.id}')" title="閲覧" style="width:32px; height:32px; color:#5f6368;">${ICONS.manual}</button>
            </div>

            <div class="manual-row-title">${escapeHtml(m.title)}</div>
            
            <div class="manual-row-date">最終更新: ${formatDate(m.updatedAt)}</div>
            
            <div class="manual-row-actions">
                <div class="icon-with-edit">
                    <button class="icon-btn memo-btn ${m.memo?'has-content':''}" onclick="window.handleManualMemoClick('${m.id}')" title="メモ" style="width:32px; height:32px;">${ICONS.memo}</button>
                    <button class="mini-edit-btn" onclick="event.stopPropagation(); window.editManualMemo('${m.id}')" title="メモを編集">✎</button>
                </div>

                <button class="btn-delete" onclick="event.stopPropagation(); window.deleteManual('${m.id}')" title="削除" style="width:32px; height:32px;">×</button>
            </div>
        </div>`;
    }).join('');

    // Sortableの適用処理を予約
    setTimeout(() => {
        const el = document.getElementById('manualListContainer');
        if (el) {
            new Sortable(el, {
                animation: 150,
                handle: '.sort-handle',
                onEnd: window.reorderManuals // 並び替え終了時に保存関数を呼ぶ
            });
        }
    }, 100);

    return `<div id="manualListContainer" class="manual-list-container">${rows}</div>`;
}

/* ■修正版：初期値を「完全な空」に戻す（余計な隙間を削除） */
window.createManual = async () => {
    const id = Date.now().toString();
    
    const minOrder = manuals.length > 0 ? Math.min(...manuals.map(m => m.order || 0)) : 0;
    const newOrder = minOrder - 1;

    const initialData = { 
        title: "無題のマニュアル", 
        content: "", // ★修正: 空の段落を削除
        updatedAt: Date.now(),
        order: newOrder
    };
    
    await setDoc(doc(db, "manuals", id), initialData);
    manuals.unshift({ id, ...initialData });
    window.switchView('manual_edit_' + id);
};

// 【修正】マニュアル内のリンクを別タブで開く
function renderManualView(id) {
    const m = manuals.find(x => x.id === id);
    if (!m) return `<div style="padding:20px;">マニュアルが見つかりません</div>`;
    
    // リンクに target="_blank" を付与
    const safeContent = (m.content || '').replace(/<a /g, '<a target="_blank" rel="noopener noreferrer" ');

    return `
        <div class="manual-view-container">
            <div style="font-size:32px; font-weight:700; padding-bottom:15px; border-bottom:1px solid #eee; margin-bottom:20px;">${escapeHtml(m.title)}</div>
            <div class="editor-body" style="padding:0;">${safeContent || '<p style="color:#999;">本文がありません</p>'}</div>
        </div>`;
}

/* ■修正版：隙間削除対応＆ボタンのフォーカス維持対策を追加 */
function renderManualEditor(id) {
    const m = manuals.find(x => x.id === id);
    if (!m) return `<div style="padding:20px;">エラー: データなし</div>`;

    let gridCells = '';
    for(let r=1; r<=10; r++) {
        for(let c=1; c<=10; c++) {
            gridCells += `<div class="picker-cell" data-r="${r}" data-c="${c}" onmouseover="window.highlightTableGrid(${r},${c})" onclick="window.insertGridTable(${r},${c})"></div>`;
        }
    }

    // ★修正: フォールバックも「空」にする（勝手にPタグを入れない）
    const initialContent = (m.content && m.content.trim() !== "") ? m.content : "";

    return `
        <div class="manual-editor-container">
            <input type="text" id="manualTitleInput" class="editor-title-input" value="${escapeHtml(m.title)}" placeholder="タイトルを入力">
            
            <div class="editor-toolbar">
                <button class="editor-btn" onmousedown="event.preventDefault()" onclick="window.execCmd('formatBlock', 'H2')" style="font-weight:bold; color:#e65100;">見出し(大)</button>
                <button class="editor-btn" onmousedown="event.preventDefault()" onclick="window.execCmd('formatBlock', 'H3')" style="font-weight:bold; color:#546e7a;">見出し(中)</button>
                <button class="editor-btn" onmousedown="event.preventDefault()" onclick="window.execCmd('formatBlock', 'H4')" style="font-weight:bold; color:#0072ff;">見出し(小)</button>
                <button class="editor-btn" onmousedown="event.preventDefault()" onclick="window.execCmd('formatBlock', 'P')">標準</button>
                <div style="width:1px; height:20px; background:#ccc; margin:0 5px;"></div>
                
                <button class="editor-btn" onmousedown="event.preventDefault()" onclick="window.execCmd('bold')" style="font-weight:bold;">B</button>
                <button class="editor-btn" onmousedown="event.preventDefault()" onclick="window.execCmd('foreColor', '#d93025')" style="color:#d93025;">赤文字</button>
                <button class="editor-btn" onmousedown="event.preventDefault()" onclick="window.execCmd('foreColor', '#1a73e8')" style="color:#1a73e8;">青文字</button>
                <button class="editor-btn" onmousedown="event.preventDefault()" onclick="window.execCmd('foreColor', '#333')" style="color:#333;">黒文字</button>
                <button class="editor-btn" onmousedown="event.preventDefault()" onclick="window.insertLink()" title="リンク挿入">${ICONS.link}</button>
                <div style="width:1px; height:20px; background:#ccc; margin:0 5px;"></div>
                
                <button class="editor-btn" onmousedown="event.preventDefault()" onclick="window.execCmd('insertUnorderedList')">・リスト</button>
                
                <div class="table-dropdown">
                    <button class="editor-btn" onmousedown="event.preventDefault()" onclick="window.toggleTablePicker()" title="表を挿入">
                        <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M4 4h16v16H4V4zm2 2v4h4V6H6zm6 0v4h6V6h-6zM6 12v6h4v-6H6zm6 0v6h6v-6h-6z"/></svg>
                    </button>
                    <div id="tablePicker" class="table-picker-popup">
                        <div id="tablePickerLabel" class="table-picker-label">1 x 1</div>
                        <div class="table-picker-grid">${gridCells}</div>
                    </div>
                </div>
                
                <button class="editor-btn" onmousedown="event.preventDefault()" onclick="window.toggleHeaderCell()" title="見出しセル(TH)に切替" style="font-weight:bold; font-family:serif;">TH</button>
                <button class="editor-btn" onmousedown="event.preventDefault()" onclick="window.addTableRow()" title="下に行を追加" style="margin-left:5px;">＋行</button>
                <button class="editor-btn" onmousedown="event.preventDefault()" onclick="window.addTableCol()" title="右に列を追加">＋列</button>
            </div>
            
            <div id="manualEditorBody" class="editor-body" contenteditable="true" onkeydown="window.handleEditorKeydown(event)">
                ${initialContent}
            </div>
        </div>`;
}

/* ■修正版：キーイベント制御（判定強化版） */
window.handleEditorKeydown = (e) => {
    // 1. Undo / Redo (Ctrl+Z / Cmd+Z)
    if ((e.metaKey || e.ctrlKey) && e.key === 'z') {
        e.stopPropagation(); 
        e.preventDefault(); 
        if (e.shiftKey) {
            document.execCommand('redo');
        } else {
            document.execCommand('undo');
        }
        return; 
    }

    // 2. Enterキー押下時の見出し脱出処理
    if (e.key === 'Enter') {
        const selection = window.getSelection();
        if (selection.rangeCount > 0) {
            let node = selection.anchorNode;
            
            // ★修正: 親要素をさかのぼってブロック要素（H2, P, DIV等）を探す
            // これにより、太字(B)や色(SPAN)の中にいても、正しく親のH2を検知できる
            while (node && node.id !== 'manualEditorBody' && !['H2','H3','H4','P','DIV','LI'].includes(node.nodeName)) {
                node = node.parentNode;
            }

            // もし見出しの中にいたら
            if (node && ['H2', 'H3', 'H4'].includes(node.nodeName)) {
                e.preventDefault(); // 見出しの複製（デフォルト動作）を阻止
                
                // ★修正: insertParagraphよりも確実な insertHTML で空のPタグを挿入する
                document.execCommand('insertHTML', false, '<p><br></p>');
            }
        }
    }
};

window.saveManualChanges = async (id) => {
    const title = document.getElementById('manualTitleInput').value.trim();
    const content = document.getElementById('manualEditorBody').innerHTML;
    if(!title) return alert("タイトルを入力してください");
    
    const now = Date.now();
    
    // DB保存
    await updateDoc(doc(db, "manuals", id), { title, content, updatedAt: now });
    
    // ★ローカルデータの手動更新
    const target = manuals.find(m => m.id === id);
    if(target) {
        target.title = title;
        target.content = content;
        target.updatedAt = now;
    }

    window.switchView('manualList');
};

window.toggleTablePicker = () => {
    const p = document.getElementById('tablePicker');
    const editor = document.getElementById('manualEditorBody');
    if (!p.classList.contains('active')) {
        const sel = window.getSelection();
        if (sel.rangeCount > 0 && editor.contains(sel.anchorNode)) {
            savedEditorRange = sel.getRangeAt(0);
        } else {
            savedEditorRange = null;
        }
    }
    p.classList.toggle('active');
};

window.highlightTableGrid = (rows, cols) => {
    document.getElementById('tablePickerLabel').textContent = `${cols} x ${rows}`;
    const cells = document.querySelectorAll('.picker-cell');
    cells.forEach(cell => {
        const r = parseInt(cell.getAttribute('data-r'));
        const c = parseInt(cell.getAttribute('data-c'));
        if (r <= rows && c <= cols) cell.classList.add('highlight');
        else cell.classList.remove('highlight');
    });
};

window.insertGridTable = (rows, cols) => {
    let html = `<table><tbody>`;
    for(let r=0; r<rows; r++) {
        html += `<tr>`;
        for(let c=0; c<cols; c++) {
            html += `<td><br></td>`;
        }
        html += `</tr>`;
    }
    html += `</tbody></table><p><br></p>`;
    
    const editor = document.getElementById('manualEditorBody');
    editor.focus();
    if (savedEditorRange) {
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(savedEditorRange);
    }
    const success = document.execCommand('insertHTML', false, html);
    if (!success) { editor.insertAdjacentHTML('beforeend', html); }
    document.getElementById('tablePicker').classList.remove('active');
};

window.toggleHeaderCell = () => {
    const sel = window.getSelection();
    if (!sel.rangeCount) return;
    let cell = sel.anchorNode;
    while (cell && cell.nodeName !== 'TD' && cell.nodeName !== 'TH' && cell.id !== 'manualEditorBody') {
        cell = cell.parentNode;
    }
    if (!cell || (cell.nodeName !== 'TD' && cell.nodeName !== 'TH')) {
        alert("変更したい表のセルの中にカーソルを置いてください");
        return;
    }
    const row = cell.parentNode;
    const newTag = cell.nodeName === 'TD' ? 'TH' : 'TD';
    const newCell = document.createElement(newTag);
    newCell.innerHTML = cell.innerHTML;
    for (let i = 0; i < cell.attributes.length; i++) {
        newCell.setAttribute(cell.attributes[i].name, cell.attributes[i].value);
    }
    row.replaceChild(newCell, cell);
};

window.addTableRow = () => {
    const sel = window.getSelection();
    if (!sel.rangeCount) return;
    let node = sel.anchorNode;
    while (node && node.nodeName !== 'TABLE' && node.id !== 'manualEditorBody') { node = node.parentNode; }
    if (node && node.nodeName === 'TABLE') {
        const tbody = node.querySelector('tbody') || node;
        const firstRow = tbody.querySelector('tr');
        if(!firstRow) return;
        const colCount = firstRow.children.length;
        const newRow = document.createElement('tr');
        for(let i=0; i<colCount; i++) {
            const td = document.createElement('td'); td.innerHTML = '<br>'; newRow.appendChild(td);
        }
        tbody.appendChild(newRow);
    } else { alert("編集したい表の中にカーソルを置いてください"); }
};

window.addTableCol = () => {
    const sel = window.getSelection();
    if (!sel.rangeCount) return;
    let node = sel.anchorNode;
    while (node && node.nodeName !== 'TABLE' && node.id !== 'manualEditorBody') { node = node.parentNode; }
    if (node && node.nodeName === 'TABLE') {
        const rows = node.querySelectorAll('tr');
        rows.forEach(tr => {
            const td = document.createElement('td'); td.innerHTML = '<br>'; tr.appendChild(td);
        });
    } else { alert("編集したい表の中にカーソルを置いてください"); }
};

document.addEventListener('click', (e) => {
    const picker = document.getElementById('tablePicker');
    const btn = e.target.closest('button');
    if (picker && picker.classList.contains('active')) {
        if (!btn || !btn.onclick || !btn.onclick.toString().includes('toggleTablePicker')) {
             if (!e.target.closest('.table-dropdown')) { picker.classList.remove('active'); }
        }
    }
});

/* ■新規機能: マニュアルスライドパネル制御 */

// パネルのDOM生成（存在しなければ作成）
function ensureSlidePanel() {
    if (document.getElementById('manualSlidePanel')) return;
    
    const html = `
        <div id="manualSlideBackdrop" onclick="window.closeSlidePanel()"></div>
        <div id="manualSlidePanel">
            <div class="slide-panel-header">
                <h3 id="slidePanelTitle" style="font-size:16px; margin:0;">マニュアル</h3>
                <button class="btn-cancel" onclick="window.closeSlidePanel()">閉じる</button>
            </div>
            <div id="slidePanelBody" class="slide-panel-body manual-view-container" style="width:100%; min-width:auto;"></div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', html);
}

/* ■修正版：スライドパネル表示（編集ボタンのサイズを修正） */
window.openSlidePanel = (manualId) => {
    ensureSlidePanel(); 
    
    const manual = manuals.find(m => m.id === manualId);
    if (!manual) {
        alert('マニュアルが見つかりません');
        return;
    }

    const titleEl = document.getElementById('slidePanelTitle');
    const bodyEl = document.getElementById('slidePanelBody');
    const panel = document.getElementById('manualSlidePanel');
    const backdrop = document.getElementById('manualSlideBackdrop');
    const headerEl = document.querySelector('.slide-panel-header');

    // リンクを別タブで開く安全対策
    const safeContent = (manual.content || '').replace(/<a /g, '<a target="_blank" rel="noopener noreferrer" ');

    // タイトル設定
    titleEl.textContent = manual.title;
    
    // 【修正】btn-compact を削除し、閉じるボタンとサイズを統一
    let editBtnHtml = '';
    if (currentView === 'manualList') {
        editBtnHtml = `<button class="btn-primary" onclick="window.closeSlidePanel(); window.switchView('manual_edit_${manualId}')" style="margin-right:10px;">編集</button>`;
    }

    headerEl.innerHTML = `
        <h3 id="slidePanelTitle" style="font-size:16px; margin:0; flex:1; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escapeHtml(manual.title)}</h3>
        <div style="display:flex; align-items:center;">
            ${editBtnHtml}
            <button class="btn-cancel" onclick="window.closeSlidePanel()">閉じる</button>
        </div>
    `;

    bodyEl.innerHTML = safeContent || '<p>本文がありません</p>';

    requestAnimationFrame(() => {
        panel.classList.add('active');
        backdrop.classList.add('active');
    });
};

// パネルを閉じる
window.closeSlidePanel = () => {
    const panel = document.getElementById('manualSlidePanel');
    const backdrop = document.getElementById('manualSlideBackdrop');
    if (panel) panel.classList.remove('active');
    if (backdrop) backdrop.classList.remove('active');
};

/* ■マニュアル選択機能（共通） */
window.showManualSelectModal = (callback) => {
    // 既存モーダルがあれば閉じる
    window.closeModal();

    // マニュアルリストの生成
    const listHtml = manuals.length > 0 ? manuals.map(m => `
        <div class="template-select-item" onclick="window.executeManualSelect('${m.id}')">
            <span style="font-weight:600;">${escapeHtml(m.title)}</span>
            <span style="font-size:10px; color:#999;">最終更新: ${formatDate(m.updatedAt)}</span>
        </div>
    `).join('') : '<div style="padding:20px; text-align:center; color:#999;">マニュアルがありません</div>';

    // モーダル表示（コールバック一時保存用IDを発行）
    const callbackId = 'manual_cb_' + Date.now();
    window[callbackId] = callback;

    const html = `
        <div id="manualSelectModal" class="modal-overlay active" onclick="if(event.target===event.currentTarget)window.closeManualSelectModal()">
            <div class="edit-modal-dialog" style="max-height:80vh;">
                <h2 style="margin-bottom:15px; font-size:16px;">マニュアルを選択</h2>
                <div class="template-select-list" style="max-height:60vh; overflow-y:auto;">
                    ${listHtml}
                </div>
                <div class="edit-modal-actions">
                    <button class="btn-danger" onclick="window.executeManualSelect('')" style="margin-right:auto;">設定解除</button>
                    <button class="btn-cancel" onclick="window.closeManualSelectModal()">キャンセル</button>
                </div>
            </div>
            <input type="hidden" id="manualCallbackId" value="${callbackId}">
        </div>`;
    document.body.insertAdjacentHTML('beforeend', html);
};

window.executeManualSelect = (manualId) => {
    const cbId = document.getElementById('manualCallbackId').value;
    if (window[cbId]) {
        window[cbId](manualId);
        delete window[cbId];
    }
    window.closeManualSelectModal();
};

window.closeManualSelectModal = () => {
    const el = document.getElementById('manualSelectModal');
    if (el) el.remove();
};

/* ■テンプレートのマニュアル操作 */
window.handleTemplateManualClick = (tid, idx) => {
    const t = templates.find(tmp => tmp.id === tid);
    const item = t.items[idx];
    if (item.manual) {
        // マニュアルIDがあればスライド表示（なければURLとして開く）
        if (manuals.some(m => m.id === item.manual)) {
            window.openSlidePanel(item.manual);
        } else {
            window.open(item.manual, '_blank');
        }
    } else {
        // 未設定なら選択モーダルを開く
        window.selectTemplateManual(tid, idx);
    }
};

window.selectTemplateManual = (tid, idx) => {
    window.showManualSelectModal(async (selectedId) => {
        // テンプレート更新（isRendering制御なしで即時反映）
        const t = templates.find(tmp => tmp.id === tid);
        const ni = [...t.items];
        ni[idx] = { ...ni[idx], manual: selectedId };
        const nt = templates.map(tmp => tmp.id === tid ? { ...tmp, items: ni } : tmp);
        
        // スクロール位置維持（既存ヘルパー利用）
        if (typeof captureScroll === 'function') captureScroll();
        await updateDoc(doc(db, "settings", "common"), { templates: nt });
    });
};

/* ■タスクのマニュアル操作 */
window.handleTaskManualClick = (event, catId, taskId, currentVal) => {
    event.preventDefault(); // 親要素へのバブリング防止
    event.stopPropagation();

    if (currentVal) {
        // 設定済みならスライド表示 or URL
        if (manuals.some(m => m.id === currentVal)) {
            window.openSlidePanel(currentVal);
        } else {
            window.open(currentVal, '_blank');
        }
    } else {
        // 未設定なら選択へ
        window.selectTaskManual(catId, taskId);
    }
};

window.selectTaskManual = (catId, taskId) => {
    window.showManualSelectModal(async (selectedId) => {
        // タスク更新
        await window.updateItemField(catId, taskId, 'manual', selectedId);
    });
};

/* ■マスタタスクのマニュアル操作 */
window.handleMasterTaskManualClick = (idx) => {
    const t = masterTasks[idx];
    if (t.manual) {
        // 設定済みならスライド表示 or URL
        if (manuals.some(m => m.id === t.manual)) {
            window.openSlidePanel(t.manual);
        } else {
            window.open(t.manual, '_blank');
        }
    } else {
        // 未設定なら選択へ
        window.selectMasterTaskManual(idx);
    }
};

/* ■マスター管理のURLボタン制御（ここを独立させました） */
window.handleMasterUrlClick = (idx) => {
    const t = masterTasks[idx];
    if (t.referenceUrl) {
        // URLがある場合は別タブで開く
        window.open(t.referenceUrl, '_blank');
    } else {
        // 空の場合は編集モーダルを開く
        window.editMasterTaskField(idx, 'referenceUrl');
    }
};

window.selectMasterTaskManual = (idx) => {
    window.showManualSelectModal(async (selectedId) => {
        // スクロール位置維持（画面が跳ぶのを防ぐ）
        if (typeof captureScroll === 'function') captureScroll();

        // マスタデータを更新して保存
        const newTasks = [...masterTasks];
        newTasks[idx].manual = selectedId;
        
        await setDoc(doc(db,"settings","master"), { params: newTasks }, { merge: true });
    });
};

/* ■見出しへのタスク追加（一括入力・位置指定対応版） */
window.addTaskToSection = (catId, sectionId) => {
    // 既存のモーダルがあれば削除
    if(document.getElementById('sectionBulkModal')) document.getElementById('sectionBulkModal').remove();
    
    const html = `
        <div id="sectionBulkModal" class="modal-overlay active" onclick="if(event.target===event.currentTarget)document.getElementById('sectionBulkModal').remove()">
            <div class="edit-modal-dialog">
                <h2 style="margin-bottom:10px; font-size:16px;">見出しにタスクを一括追加</h2>
                <p style="font-size:12px;color:#666;margin-bottom:8px;">改行区切りで入力してください</p>
                <textarea id="sectionBulkText" placeholder="タスクA&#13;&#10;タスクB&#13;&#10;タスクC" style="height:150px; width:100%; padding:10px; border:1px solid #ddd; border-radius:4px;"></textarea>
                <div class="edit-modal-actions">
                    <button class="btn-cancel" onclick="document.getElementById('sectionBulkModal').remove()">キャンセル</button>
                    <button class="btn-primary" onclick="window.saveSectionBulkTasks('${catId}', ${sectionId})">追加</button>
                </div>
            </div>
        </div>`;
    document.body.insertAdjacentHTML('beforeend', html);
    const ta = document.getElementById('sectionBulkText');
    ta.focus();
};

window.saveSectionBulkTasks = async (catId, sectionId) => {
    const text = document.getElementById('sectionBulkText').value;
    // 空行を除去してリスト化
    const lines = text.trim().split('\n').map(l => l.trim()).filter(l => l);
    
    if (lines.length === 0) return;

    const cat = categories.find(c => c.id === catId);
    if (!cat) return;

    // 現在のアイテムリストをコピー
    const items = [...(cat.items || [])];

    // ■重要：追加する「見出し」の位置（インデックス）を探す
    const sectionIndex = items.findIndex(i => i.id == sectionId);
    
    if (sectionIndex === -1) {
        alert("見出しが見つかりませんでした");
        return;
    }

    // 新しいタスクを作成
    const newTasks = lines.map(line => {
        // マスタタスクから補完情報を検索
        const master = masterTasks.find(m => m.name === line);
        
        const task = {
            id: Date.now() + Math.random(),
            type: 'task',
            name: line,
            status: 'pending',
            section: sectionId, // 見出しIDを指定
            memo: master ? master.memo : '',
            referenceUrl: master ? master.referenceUrl : '',
            manual: master ? master.manual : '',
            assigneeName: null,
            startedAt: null,
            completedAt: null
        };

        // 検収ページの場合の追加プロパティ
        if (catId === 'inspection') {
            task.submitterName = currentUser.displayName;
            task.submitterPhoto = currentUser.photoURL;
            task.status1 = '依頼済み';
            task.status2 = '';
        }
        return task;
    });

    // ■修正ポイント：見出しの「直後」に新しいタスクを挿入する
    // splice(挿入開始位置, 削除数, 追加アイテム...)
    items.splice(sectionIndex + 1, 0, ...newTasks);

    await updateDoc(doc(db, "categories", catId), { items: items });
    document.getElementById('sectionBulkModal').remove();
};

/* ■テンプレート項目のアイコン制御（クリック時の挙動） */
window.handleTemplateMemoClick = (tid, idx) => {
    const t = templates.find(tmp => tmp.id === tid);
    const item = t.items[idx];
    if (item.memo) {
        // メモがある場合は内容を表示（簡易アラート、または必要ならモーダル化も可）
        alert(item.memo);
    } else {
        // 空の場合は編集画面を開く
        window.editTemplateField(tid, idx, 'memo');
    }
};

window.handleTemplateUrlClick = (tid, idx) => {
    const t = templates.find(tmp => tmp.id === tid);
    const item = t.items[idx];
    if (item.referenceUrl) {
        window.open(item.referenceUrl, '_blank');
    } else {
        window.editTemplateField(tid, idx, 'referenceUrl');
    }
};

/* ■■■ 追加機能：メモプレビューポップアップと編集制御 ■■■ */

/* ■修正版：共通プレビュー（タイトル指定対応） */
window.showMemoPreview = (text, title = 'メモ内容') => {
    if(document.getElementById('memoPreviewModal')) document.getElementById('memoPreviewModal').remove();
    const safeText = escapeHtml(text).replace(/\n/g, '<br>');
    const html = `
        <div id="memoPreviewModal" class="modal-overlay active" onclick="if(event.target===event.currentTarget)document.getElementById('memoPreviewModal').remove()">
            <div class="edit-modal-dialog" style="max-width:400px; text-align:left;">
                <h2 style="font-size:16px; margin-bottom:15px; color:#333;">${title}</h2>
                <div style="background:#f8f9fa; padding:15px; border-radius:8px; border:1px solid #eee; font-size:13px; line-height:1.6; color:#333; max-height:300px; overflow-y:auto;">
                    ${safeText}
                </div>
                <div class="edit-modal-actions" style="justify-content:center; margin-top:20px;">
                    <button class="btn-primary" onclick="document.getElementById('memoPreviewModal').remove()">閉じる</button>
                </div>
            </div>
        </div>`;
    document.body.insertAdjacentHTML('beforeend', html);
};

// マスター管理：メモクリック時の挙動
window.handleMasterMemoClick = (idx) => {
    const t = masterTasks[idx];
    if (t.memo) window.showMemoPreview(t.memo);
    else window.editMasterTaskField(idx, 'memo');
};

// テンプレート管理：メモクリック時の挙動
window.handleTemplateMemoClick = (tid, idx) => {
    const t = templates.find(tmp => tmp.id === tid);
    const item = t.items[idx];
    if (item.memo) window.showMemoPreview(item.memo);
    else window.editTemplateField(tid, idx, 'memo');
};

// テンプレート管理：リンククリック時の挙動
window.handleTemplateUrlClick = (tid, idx) => {
    const t = templates.find(tmp => tmp.id === tid);
    const item = t.items[idx];
    if (item.referenceUrl) window.open(item.referenceUrl, '_blank');
    else window.editTemplateField(tid, idx, 'referenceUrl');
};

// マスター管理：編集モーダル（10行サイズに拡張）
window.editMasterTaskField = async (idx, field) => {
    const t = masterTasks[idx];
    if(document.getElementById('editModal')) document.getElementById('editModal').remove();
    const map = { memo:'メモ', referenceUrl:'参考リンク', manual:'マニュアル' };
    const html = `
        <div id="editModal" class="modal-overlay active" onclick="if(event.target===event.currentTarget)document.getElementById('editModal').remove()">
            <div class="edit-modal-dialog">
                <h2>${map[field]}を編集</h2>
                <textarea id="editModalTextarea" placeholder="内容を入力してください...">${escapeHtml(t[field]||'')}</textarea>
                <div class="edit-modal-actions">
                    <button class="btn-cancel" onclick="document.getElementById('editModal').remove()">キャンセル</button>
                    <button class="btn-primary" onclick="window.saveMasterTaskField(${idx},'${field}')">保存</button>
                </div>
            </div>
        </div>`;
    document.body.insertAdjacentHTML('beforeend', html);
    const ta = document.getElementById('editModalTextarea');
    if(ta){ ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length); }
};

window.saveMasterTaskField = async (idx, field) => {
    const val = document.getElementById('editModalTextarea').value;
    await window.updateMasterTask(idx, field, val);
    document.getElementById('editModal').remove();
};

window.updateMasterTask = async (idx, field, val) => {
    // スクロール位置維持（もし関数があれば実行）
    if (typeof captureScroll === 'function') captureScroll();
    const newTasks = [...masterTasks]; 
    newTasks[idx][field] = val;
    await setDoc(doc(db,"settings","master"), { params: newTasks }, { merge: true });
};

/* ■■■ ページテンプレート管理のUI統一（タスクテンプレート管理に合わせる） ■■■ */

// 編集モーダルを開く関数（ページテンプレート用）
// ※タスクテンプレート管理と同じ editModal と editModalTextarea を使用するように変更
window.editTemplateField = async (tid, idx, field) => {
    const t = templates.find(tmp => tmp.id === tid);
    const item = t.items[idx];
    
    // 既存モーダル削除
    if(document.getElementById('editModal')) document.getElementById('editModal').remove();
    
    const map = { memo:'メモ', referenceUrl:'参考リンク', manual:'マニュアル', name:'名前' };
    const title = map[field] || field;

    // タスクテンプレート管理と同じ構造・IDを使用（これでスタイルが統一されます）
    const html = `
        <div id="editModal" class="modal-overlay active" onclick="if(event.target===event.currentTarget)document.getElementById('editModal').remove()">
            <div class="edit-modal-dialog">
                <h2>${title}を編集</h2>
                <textarea id="editModalTextarea" placeholder="内容を入力してください...">${escapeHtml(item[field]||'')}</textarea>
                <div class="edit-modal-actions">
                    <button class="btn-cancel" onclick="document.getElementById('editModal').remove()">キャンセル</button>
                    <button class="btn-primary" onclick="window.saveTemplateField(${tid}, ${idx}, '${field}')">保存</button>
                </div>
            </div>
        </div>`;
    document.body.insertAdjacentHTML('beforeend', html);
    
    // カーソルを末尾へ
    const ta = document.getElementById('editModalTextarea');
    if(ta){ ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length); }
};

// 保存処理（ページテンプレート用）
window.saveTemplateField = async (tid, idx, field) => {
    // 共通テキストエリアから値を取得
    const val = document.getElementById('editModalTextarea').value;
    
    // 更新実行
    await window.updateTemplateItem(tid, idx, field, val);
    
    document.getElementById('editModal').remove();
};

/* ■追加機能：マニュアルのメモ編集 */
window.editManualMemo = (id) => {
    const m = manuals.find(x => x.id === id);
    if (!m) return;
    
    // 既存モーダル削除
    if(document.getElementById('editModal')) document.getElementById('editModal').remove();
    
    const html = `
        <div id="editModal" class="modal-overlay active" onclick="if(event.target===event.currentTarget)document.getElementById('editModal').remove()">
            <div class="edit-modal-dialog">
                <h2>マニュアルのメモを編集</h2>
                <textarea id="editModalTextarea" placeholder="メモを入力してください...">${escapeHtml(m.memo || '')}</textarea>
                <div class="edit-modal-actions">
                    <button class="btn-cancel" onclick="document.getElementById('editModal').remove()">キャンセル</button>
                    <button class="btn-primary" onclick="window.saveManualMemo('${id}')">保存</button>
                </div>
            </div>
        </div>`;
    document.body.insertAdjacentHTML('beforeend', html);
    const ta = document.getElementById('editModalTextarea');
    if(ta){ ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length); }
};

window.saveManualMemo = async (id) => {
    const val = document.getElementById('editModalTextarea').value;
    await updateDoc(doc(db, "manuals", id), { memo: val, updatedAt: Date.now() });
    document.getElementById('editModal').remove();
};

/* ■追加機能：マニュアル一覧のメモボタン制御（マスター管理と同じ挙動） */
window.handleManualMemoClick = (id) => {
    const m = manuals.find(x => x.id === id);
    if (!m) return;

    if (m.memo) {
        // メモがある場合はプレビューを表示（既存の共通関数を使用）
        window.showMemoPreview(m.memo);
    } else {
        // 空の場合は編集画面を開く
        window.editManualMemo(id);
    }
};
/* ■追加機能：タスクのメモ・調整クリック時の挙動（プレビュー or 編集） */

// タスク・検収共通：メモクリック
window.handleTaskMemoClick = (catId, taskId) => {
    const cat = categories.find(c => c.id === catId);
    if (!cat) return;
    const item = cat.items.find(i => i.id == taskId);
    if (!item) return;

    if (item.memo) {
        window.showMemoPreview(item.memo, 'メモ内容');
    } else {
        window.editMemo(catId, taskId);
    }
};

// 検収専用：調整クリック
window.handleInspectionAdjustmentClick = (catId, taskId) => {
    const cat = categories.find(c => c.id === catId);
    if (!cat) return;
    const item = cat.items.find(i => i.id == taskId);
    if (!item) return;

    if (item.adjustment) {
        window.showMemoPreview(item.adjustment, '調整内容');
    } else {
        window.editAdjustment(catId, taskId);
    }
};

/* ■追加：マニュアルデータを一度だけ読み込む関数（onSnapshot不使用） */
window.loadManuals = async () => {
    const snap = await getDocs(collection(db, "manuals"));
    manuals = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(m => !m.deleted)
        .sort((a, b) => (a.order || 0) - (b.order || 0)); // order順でソート
};

/* ■追加機能：マニュアルの並び順保存（手動更新対応） */
window.reorderManuals = async (evt) => {
    if (evt.oldIndex === evt.newIndex) return;

    const container = document.getElementById('manualListContainer');
    const rows = Array.from(container.querySelectorAll('.manual-row'));
    const newOrderIds = rows.map(r => r.getAttribute('data-id'));

    const batch = writeBatch(db);
    
    newOrderIds.forEach((id, index) => {
        // DB更新予約
        const ref = doc(db, "manuals", id);
        batch.update(ref, { order: index });
        
        // ★ローカルデータの手動更新
        const m = manuals.find(item => item.id === id);
        if(m) m.order = index;
    });
    
    // ローカル配列をorder順に並べ直しておく
    manuals.sort((a, b) => (a.order || 0) - (b.order || 0));

    await batch.commit();
};

/* ■追加：マニュアル削除機能（手動更新対応） */
window.deleteManual = async (id) => {
    if (!confirm("本当に削除しますか？")) return;
    
    // DB削除
    await deleteDoc(doc(db, "manuals", id));
    
    // ★ローカルデータの手動更新
    manuals = manuals.filter(m => m.id !== id);
    
    // 現在そのマニュアルを開いている、または一覧画面なら一覧を再描画
    if (currentView.includes(id) || currentView === 'manualList') {
        window.switchView('manualList');
    }
};

/* ■追加：マニュアルエディタの基本機能（ボタン動作） */
window.execCmd = (command, value = null) => {
    document.execCommand(command, false, value);
    const editor = document.getElementById('manualEditorBody');
    if(editor) editor.focus();
};

window.insertLink = () => {
    const url = prompt("リンク先のURLを入力してください:", "https://");
    if (url) window.execCmd('createLink', url);
};

/* ■追加機能：メンバー稼働状況（スライドボード） */

/* ■修正版：メンバー稼働状況（スライドボード・デザイン＆ロジック改善） */

/* ■修正版：メンバー稼働状況（完全版） */

// パネルのDOM生成
function ensureTeamBoardPanel() {
    if (document.getElementById('teamSlidePanel')) return;
    const html = `
        <div id="teamSlideBackdrop" onclick="window.closeTeamBoard()"></div>
        <div id="teamSlidePanel">
            <div class="team-panel-header">
                <h3>メンバー稼働状況</h3>
                <div style="display:flex; gap:10px;">
                    <button class="btn-section" onclick="window.openTeamMemberSettings()">表示設定</button>
                    <button class="btn-cancel" onclick="window.closeTeamBoard()">閉じる</button>
                </div>
            </div>
            <div id="teamBoardBody" class="team-board-body"></div>
        </div>
        <div id="teamTaskTooltip" class="team-board-tooltip"></div>
    `;
    document.body.insertAdjacentHTML('beforeend', html);
}

window.openTeamBoard = () => {
    ensureTeamBoardPanel();
    renderTeamBoardContent();
    requestAnimationFrame(() => {
        document.getElementById('teamSlidePanel').classList.add('active');
        document.getElementById('teamSlideBackdrop').classList.add('active');
    });
};

window.closeTeamBoard = () => {
    const p = document.getElementById('teamSlidePanel');
    const b = document.getElementById('teamSlideBackdrop');
    if(p) p.classList.remove('active');
    if(b) b.classList.remove('active');
    window.hideTeamTaskTooltip();
};

/* ■修正版：チームボード描画（並び順：なう → 予定 → 検収待ち） */
window.renderTeamBoardContent = () => {
    const container = document.getElementById('teamBoardBody');
    if(!container) return;

    // 1. ユーザーリスト準備
    const config = window.teamBoardConfig || { hiddenUsers: [], order: [] };
    let displayUsers = appUsers.filter(u => !config.hiddenUsers.includes(u.name));
    
    if (config.order && config.order.length > 0) {
        displayUsers.sort((a, b) => {
            const idxA = config.order.indexOf(a.name);
            const idxB = config.order.indexOf(b.name);
            const valA = idxA === -1 ? 9999 : idxA;
            const valB = idxB === -1 ? 9999 : idxB;
            return valA - valB;
        });
    }

    // 2. タスク集計
    const userTasks = {};
    displayUsers.forEach(u => {
        userTasks[u.name] = { user: u, now: [], plan: [], inspection: [], total: 0 };
    });

    categories.forEach(cat => {
        const items = cat.items || [];
        items.forEach(item => {
            if (item.type !== 'task') return;
            if (item.status === 'completed' || item.status1 === '反映済み') return;

            const taskData = { ...item, pageName: cat.name, catId: cat.id };

            // ▼検収ページのロジック
            if (cat.id === 'inspection') {
                const s1 = item.status1;
                const s2 = item.status2;

                // 担当者（Inspector）
                if (item.inspectorName && userTasks[item.inspectorName]) {
                    if (s2 === '検収中') {
                        userTasks[item.inspectorName].now.push(taskData);
                        userTasks[item.inspectorName].total++;
                    } else if (s1 === '依頼済み' || s1 === '再依頼') {
                        let isMyBall = true;
                        if (s2 === '反映OK') isMyBall = false;
                        if (s2 === '要調整' && s1 !== '再依頼') isMyBall = false;

                        if (isMyBall) {
                            userTasks[item.inspectorName].inspection.push(taskData);
                            userTasks[item.inspectorName].total++;
                        }
                    }
                }

                // 提出者（Submitter）
                if (item.submitterName && userTasks[item.submitterName]) {
                    if (s1 === '調整中') {
                        userTasks[item.submitterName].now.push(taskData);
                        userTasks[item.submitterName].total++;
                    } else if (s2 === '要調整' || s2 === '反映OK') {
                        if (!(s1 === '再依頼' && s2 === '要調整')) {
                            userTasks[item.submitterName].plan.push(taskData);
                            userTasks[item.submitterName].total++;
                        }
                    }
                }
            } 
            // ▼通常ページのロジック
            else {
                if (item.assigneeName && userTasks[item.assigneeName]) {
                    userTasks[item.assigneeName].total++;
                    if (item.status === 'in-progress') userTasks[item.assigneeName].now.push(taskData);
                    else userTasks[item.assigneeName].plan.push(taskData);
                }
            }
        });
    });

    // 3. HTML生成
    const columnsHtml = displayUsers.map(u => {
        const group = userTasks[u.name];
        const nowCount = group.now.length;
        const planCount = group.plan.length;
        const insCount = group.inspection.length;
        const totalCount = group.total;

        // ★修正: ヘッダーの内訳順序を「なう → 予定 → 検収」に変更
        const details = [];
        if (nowCount > 0) details.push(`なう(${nowCount})`);
        if (planCount > 0) details.push(`予定(${planCount})`);
        if (insCount > 0) details.push(`検収(${insCount})`);

        let statusHtml = `<div class="team-header-info">`;
        statusHtml += `<span class="team-header-total">合計: ${totalCount}</span>`;
        if (details.length > 0) {
            statusHtml += `<span class="team-header-detail">　${details.join('　')}</span>`;
        }
        statusHtml += `</div>`;

        const renderCard = (t, type) => {
            let classMod = '';
            if (type === 'now') classMod = 'is-now';
            if (type === 'ins') classMod = 'is-inspection';
            
            const safeData = JSON.stringify({
                name: t.name, page: t.pageName, id: t.id, catId: t.catId, 
                type: type === 'now' ? 'なう' : type === 'ins' ? '検収' : '予定'
            }).replace(/"/g, '&quot;');

            return `<div class="team-task-card ${classMod}" 
                onmouseenter="window.showTeamTaskTooltip(event, ${safeData})" 
                onmouseleave="window.hideTeamTaskTooltip()"
                onclick="window.jumpToTaskFromBoard('${t.catId}', '${t.id}')">
                <div class="card-vis">${escapeHtml(t.name)}</div>
            </div>`;
        };

        // コンテンツ部分の生成
        let contentHtml = '';
        if (totalCount === 0) {
            contentHtml = `<div style="padding:10px; color:#ccc; font-size:10px;">タスクなし</div>`;
        } else {
            // ★修正: 表示順序を「なう → 予定 → 検収待ち」に変更
            
            // 1. なう
            if (group.now.length > 0) {
                contentHtml += `
                    <div class="team-section-label now">なう</div>
                    <div class="team-stack-area">
                        ${group.now.map(t => renderCard(t, 'now')).join('')}
                    </div>`;
            }

            // 2. 予定（ここに移動）
            if (group.plan.length > 0) {
                contentHtml += `
                    <div class="team-section-label">予定</div>
                    <div class="team-stack-area">
                        ${group.plan.map(t => renderCard(t, 'plan')).join('')}
                    </div>`;
            }
            
            // 3. 検収待ち（ここに移動）
            if (group.inspection.length > 0) {
                contentHtml += `
                    <div class="team-section-label inspection">検収待ち</div>
                    <div class="team-stack-area">
                        ${group.inspection.map(t => renderCard(t, 'ins')).join('')}
                    </div>`;
            }
        }

        return `
            <div class="team-col">
                <div class="team-col-header">
                    <div style="display:flex; align-items:center; gap:8px; margin-bottom:6px;">
                        ${u.photo ? `<img src="${u.photo}" class="team-avatar">` : '<div class="team-avatar-placeholder"></div>'}
                        <span class="team-username">${escapeHtml(u.name)}</span>
                    </div>
                    ${statusHtml}
                </div>
                <div class="team-col-content">
                    ${contentHtml}
                </div>
            </div>`;
    }).join('');

    container.innerHTML = `<div class="team-board-grid">${columnsHtml}</div>`;
};

/* ■修正版：ツールチップ制御（ファイルアイコン削除） */
window.showTeamTaskTooltip = (e, data) => {
    const tt = document.getElementById('teamTaskTooltip');
    if (!tt) return;
    
    // 内容セット
    let typeBadge = '';
    if (data.type === 'なう') typeBadge = '<span class="tt-badge now">なう</span>';
    else if (data.type === '検収') typeBadge = '<span class="tt-badge ins">検収</span>';
    else typeBadge = '<span class="tt-badge plan">予定</span>';

    // ★修正: ページ名の前の「📂」アイコンを削除しました
    tt.innerHTML = `
        <div class="tt-header">${typeBadge} <span class="tt-page">${escapeHtml(data.page)}</span></div>
        <div class="tt-body">${escapeHtml(data.name)}</div>
        <div class="tt-footer">クリックで移動</div>
    `;

    // 位置計算
    const rect = e.target.getBoundingClientRect();
    tt.style.display = 'block';
    
    // 基本位置：カードの右側、少し上
    let top = rect.top - 10;
    let left = rect.right + 10;

    // 画面右端からはみ出る場合は左側に出す
    if (left + 220 > window.innerWidth) {
        left = rect.left - 230;
    }
    // 画面下からはみ出る場合は上にずらす
    if (top + tt.offsetHeight > window.innerHeight) {
        top = window.innerHeight - tt.offsetHeight - 10;
    }

    tt.style.top = top + 'px';
    tt.style.left = left + 'px';
    tt.classList.add('active');
};

window.hideTeamTaskTooltip = () => {
    const tt = document.getElementById('teamTaskTooltip');
    if (tt) {
        tt.classList.remove('active');
        tt.style.display = 'none';
    }
};

window.jumpToTaskFromBoard = (catId, taskId) => {
    window.closeTeamBoard();
    window.switchView(catId);
    setTimeout(() => {
        const el = document.querySelector(`.task-row[data-id="${taskId}"]`);
        if(el) {
            el.scrollIntoView({block:'center'});
            el.classList.add('highlight-target');
        }
    }, 300);
};

/* ■修正版：メンバー表示設定（z-index修正） */
window.openTeamMemberSettings = () => {
    if(document.getElementById('memberSettingsModal')) document.getElementById('memberSettingsModal').remove();
    
    const config = window.teamBoardConfig || { hiddenUsers: [], order: [] };
    
    let users = [...appUsers];
    if (config.order && config.order.length > 0) {
        users.sort((a, b) => {
            const idxA = config.order.indexOf(a.name);
            const idxB = config.order.indexOf(b.name);
            const valA = idxA === -1 ? 9999 : idxA;
            const valB = idxB === -1 ? 9999 : idxB;
            return valA - valB;
        });
    }

    const listHtml = users.map(u => {
        const isHidden = config.hiddenUsers.includes(u.name);
        return `
            <div class="member-setting-row" data-name="${escapeHtml(u.name)}">
                <span class="sort-handle">☰</span>
                <label style="flex:1; display:flex; align-items:center; cursor:pointer;">
                    <input type="checkbox" class="member-visible-check" ${!isHidden ? 'checked' : ''}>
                    <span style="margin-left:8px; font-weight:600;">${escapeHtml(u.name)}</span>
                </label>
            </div>
        `;
    }).join('');

    // ★修正：z-indexを8000に設定して、スライドパネル(7000)より手前に表示
    const html = `
        <div id="memberSettingsModal" class="modal-overlay active" style="z-index:8000;">
            <div class="edit-modal-dialog" style="max-width:400px;">
                <h2 style="margin-bottom:10px;">メンバー表示設定</h2>
                <p style="font-size:12px; color:#666; margin-bottom:15px;">ドラッグで並び替え、チェックを外すと非表示になります。</p>
                <div id="memberSettingsList" style="max-height:300px; overflow-y:auto; border:1px solid #eee; border-radius:4px; padding:5px;">
                    ${listHtml}
                </div>
                <div class="edit-modal-actions">
                    <button class="btn-cancel" onclick="document.getElementById('memberSettingsModal').remove()">キャンセル</button>
                    <button class="btn-primary" onclick="window.saveTeamMemberSettings()">保存</button>
                </div>
            </div>
        </div>`;
    document.body.insertAdjacentHTML('beforeend', html);

    new Sortable(document.getElementById('memberSettingsList'), {
        animation: 150,
        handle: '.sort-handle'
    });
};

window.saveTeamMemberSettings = async () => {
    const list = document.getElementById('memberSettingsList');
    const rows = Array.from(list.querySelectorAll('.member-setting-row'));
    
    const order = rows.map(r => r.getAttribute('data-name'));
    const hiddenUsers = rows.filter(r => !r.querySelector('.member-visible-check').checked).map(r => r.getAttribute('data-name'));

    const newConfig = { order, hiddenUsers };
    
    // settings/common に保存（initAppで監視しているので自動反映される）
    await setDoc(doc(db, "settings", "common"), { teamBoardConfig: newConfig }, { merge: true });
    
    document.getElementById('memberSettingsModal').remove();
};

/* ■追加機能：マスタタスクを既存テンプレートに追加する機能 */

let addToTemplateState = { masterIndex: null, templateId: null };

window.openAddToTemplateModal = (masterIndex) => {
    if(templates.length === 0) {
        alert("追加先のテンプレートがありません。先にページテンプレートを作成してください。");
        return;
    }
    addToTemplateState = { masterIndex, templateId: null };
    
    if(document.getElementById('addToTemplateModal')) document.getElementById('addToTemplateModal').remove();
    
    // ステップ1: テンプレート選択リストの生成
    const tplListHtml = templates.map(t => `
        <div class="template-select-item" onclick="window.selectTemplateForAdd(${t.id})">
            <span style="font-weight:600;">${escapeHtml(t.name)}</span>
            <span style="font-size:11px; color:#999;">${t.items ? t.items.length : 0} 項目</span>
        </div>
    `).join('');

    const html = `
        <div id="addToTemplateModal" class="modal-overlay active" onclick="if(event.target===event.currentTarget)document.getElementById('addToTemplateModal').remove()">
            <div class="edit-modal-dialog" style="max-height:80vh;">
                <h2 id="addToTplTitle" style="margin-bottom:15px; font-size:16px;">追加先のテンプレートを選択</h2>
                <div id="addToTplList" class="template-select-list" style="max-height:60vh; overflow-y:auto;">
                    ${tplListHtml}
                </div>
                <div class="edit-modal-actions">
                    <button class="btn-cancel" onclick="document.getElementById('addToTemplateModal').remove()">キャンセル</button>
                </div>
            </div>
        </div>`;
    document.body.insertAdjacentHTML('beforeend', html);
};

// ステップ2: 見出しの選択
window.selectTemplateForAdd = (tplId) => {
    addToTemplateState.templateId = tplId;
    const tpl = templates.find(t => t.id === tplId);
    if (!tpl) return;

    const titleEl = document.getElementById('addToTplTitle');
    const listEl = document.getElementById('addToTplList');
    
    titleEl.textContent = `「${tpl.name}」のどの見出しに入れますか？`;
    
    // 見出しのみを抽出
    const sections = (tpl.items || []).filter(i => i.type === 'section');
    
    // 見出し選択リスト生成（「見出しなし（先頭）」も追加）
    let sectionHtml = `
        <div class="template-select-item section-choice" onclick="window.executeAddToTemplate(null)">
            <span style="font-weight:600; color:#1a73e8;">(見出しなし / リストの先頭)</span>
        </div>`;
        
    if (sections.length > 0) {
        sectionHtml += sections.map(s => `
            <div class="template-select-item section-choice" onclick="window.executeAddToTemplate(${s.id})">
                <span style="font-weight:600;">[見出し] ${escapeHtml(s.name)}</span>
            </div>
        `).join('');
    } else {
        sectionHtml += `<div style="padding:15px; color:#666; text-align:center;">見出しがありません。先頭に追加されます。</div>`;
    }

    listEl.innerHTML = sectionHtml;
};

/* ■修正版：テンプレートへのタスク追加処理（見出し直下挿入＆スクロール防止） */
window.executeAddToTemplate = async (sectionId) => {
    const { masterIndex, templateId } = addToTemplateState;
    const tpl = templates.find(t => t.id === templateId);
    const masterTask = masterTasks[masterIndex];
    
    if (!tpl || !masterTask) return;

    // 現在のスクロール位置を保存（画面が飛ばないようにする最重要処理）
    if (typeof captureScroll === 'function') captureScroll();

    // 新しいタスクオブジェクトを作成
    const newTask = {
        type: 'task',
        name: masterTask.name,
        memo: masterTask.memo || '',
        referenceUrl: masterTask.referenceUrl || '',
        manual: masterTask.manual || ''
    };

    // 挿入位置の計算
    const items = [...(tpl.items || [])];
    let insertIndex = 0;

    if (sectionId) {
        // 指定された見出しを探す
        const secIdx = items.findIndex(i => i.id == sectionId);
        if (secIdx !== -1) {
            // ★修正：見出しの「直下（すぐ下）」に追加するため +1
            insertIndex = secIdx + 1;
        } else {
            // 見つからなければ末尾（念のため）
            insertIndex = items.length;
        }
    } else {
        // 見出しなし（先頭）の場合
        insertIndex = 0;
    }

    // 挿入実行
    items.splice(insertIndex, 0, newTask);

    // 保存
    const newTemplates = templates.map(t => t.id === templateId ? { ...t, items: items } : t);
    await updateDoc(doc(db, "settings", "common"), { templates: newTemplates });

    // モーダルを閉じる
    document.getElementById('addToTemplateModal').remove();
    
    // UI反映のためにアコーディオンを開く状態にする
    openedAccordions['tpl-' + templateId] = true;
    
    // 再描画（スクロール位置は captureScroll で維持され、勝手な移動はしない）
    if(typeof window.renderSettingsContentTrigger === 'function') {
        window.renderSettingsContentTrigger();
    }
};

/* ■追加機能：ページテンプレートの複製 */
window.duplicateTemplate = async (templateId) => {
    // 1. コピー元のテンプレートを取得
    const original = templates.find(t => t.id === templateId);
    if (!original) return;

    // 2. スクロール位置を保存
    if (typeof captureScroll === 'function') captureScroll();

    // 3. データのディープコピー作成（IDと名前を変更）
    const newId = Date.now();
    const newItem = {
        ...JSON.parse(JSON.stringify(original)), // 深いコピーでitemsの中身も別物にする
        id: newId,
        name: original.name + " のコピー"
    };

    // 4. テンプレートリストに追加して保存
    const newTemplates = [...templates, newItem];
    await updateDoc(doc(db, "settings", "common"), { templates: newTemplates });

    // 5. 複製したテンプレートを自動で開く
    openedAccordions['tpl-' + newId] = true;
    
    // 描画更新後にスクロール調整
    if(typeof window.renderSettingsContentTrigger === 'function') {
        window.renderSettingsContentTrigger();
        setTimeout(() => {
            const el = document.getElementById('tpl-' + newId);
            if(el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 200);
    }
};

/* ■追加機能：テンプレートの見出しへタスク一括追加 */
window.openTemplateSectionBulkModal = (tid, idx) => {
    if(document.getElementById('tplSectionBulkModal')) document.getElementById('tplSectionBulkModal').remove();
    
    const html = `
        <div id="tplSectionBulkModal" class="modal-overlay active" onclick="if(event.target===event.currentTarget)document.getElementById('tplSectionBulkModal').remove()">
            <div class="edit-modal-dialog">
                <h2 style="margin-bottom:10px; font-size:16px;">見出しにタスクを一括追加</h2>
                <p style="font-size:12px;color:#666;margin-bottom:8px;">改行区切りで入力してください</p>
                <textarea id="tplSectionBulkText" placeholder="タスクA&#13;&#10;タスクB&#13;&#10;タスクC" style="height:150px; width:100%; padding:10px; border:1px solid #ddd; border-radius:4px;"></textarea>
                <div class="edit-modal-actions">
                    <button class="btn-cancel" onclick="document.getElementById('tplSectionBulkModal').remove()">キャンセル</button>
                    <button class="btn-primary" onclick="window.saveTemplateSectionBulkTasks(${tid}, ${idx})">追加</button>
                </div>
            </div>
        </div>`;
    document.body.insertAdjacentHTML('beforeend', html);
    document.getElementById('tplSectionBulkText').focus();
};

window.saveTemplateSectionBulkTasks = async (tid, idx) => {
    const text = document.getElementById('tplSectionBulkText').value;
    const lines = text.trim().split('\n').map(l => l.trim()).filter(l => l);
    
    if (lines.length === 0) return;

    if (typeof captureScroll === 'function') captureScroll();

    const t = templates.find(tmp => tmp.id === tid);
    if (!t) return;

    // 新しいタスクを作成
    const newItems = lines.map(line => {
        const m = masterTasks.find(mas => mas.name === line);
        return {
            type: 'task',
            name: line,
            memo: m?.memo || '',
            referenceUrl: m?.referenceUrl || '',
            manual: m?.manual || ''
        };
    });

    // 該当インデックス（見出し）の直後に挿入
    const updatedItems = [...t.items];
    updatedItems.splice(idx + 1, 0, ...newItems);

    const nt = templates.map(tmp => tmp.id === tid ? { ...tmp, items: updatedItems } : tmp);
    await updateDoc(doc(db, "settings", "common"), { templates: nt });

    document.getElementById('tplSectionBulkModal').remove();
};

/* ■修正版：クイックアクセスサイドバー機能（手動アイコン対応） */

let quickLinks = [];

// common設定の監視（既存のコードがあれば統合、なければこのまま）
onSnapshot(doc(db, "settings", "common"), (d) => {
    if (d.exists()) {
        const data = d.data();
        quickLinks = data.quickLinks || [];
        renderQuickSidebarContent();
    }
});

window.toggleQuickSidebar = () => {
    const sb = document.getElementById('quickSidebar');
    const bd = document.getElementById('quickSidebarBackdrop');
    if (sb.classList.contains('active')) {
        sb.classList.remove('active');
        bd.classList.remove('active');
    } else {
        sb.classList.add('active');
        bd.classList.add('active');
    }
};

function renderQuickSidebarContent() {
    const listEl = document.getElementById('quickLinkList');
    if (!listEl) return;

    if (quickLinks.length === 0) {
        listEl.innerHTML = `<div style="text-align:center; color:#666; font-size:12px; margin-top:50px;">リンクがありません<br>右上の歯車から追加してください</div>`;
        return;
    }

    listEl.innerHTML = quickLinks.map(link => {
        // ★修正: 手動設定アイコンがあればそれを使用、なければGoogleAPI
        const faviconUrl = link.iconUrl 
            ? link.iconUrl 
            : `https://www.google.com/s2/favicons?domain=${encodeURIComponent(link.url)}&sz=32`;
        
        return `
        <div class="quick-link-item" onclick="window.open('${link.url}', '_blank'); window.toggleQuickSidebar();">
            <img src="${faviconUrl}" class="quick-link-icon" onerror="this.style.display='none'">
            <span>${escapeHtml(link.name)}</span>
        </div>`;
    }).join('');
}

/* ■修正版：クイックリンク設定（横並び・シンプルデザイン） */
window.openQuickLinkSettings = () => {
    window.toggleQuickSidebar(); // 一旦閉じる

    if(document.getElementById('quickLinkSettingsModal')) document.getElementById('quickLinkSettingsModal').remove();
    
    // リスト描画（横一列レイアウト）
    const rows = quickLinks.map((link, idx) => `
        <div class="quick-link-row-modern">
            <span class="sort-handle" style="cursor:grab; color:#ccc; padding:0 5px;">☰</span>
            
            <input type="text" value="${escapeHtml(link.name)}" placeholder="サイト名" class="input-simple" style="width:140px; font-weight:600;" onchange="window.updateQuickLink(${idx}, 'name', this.value)">
            
            <input type="text" value="${escapeHtml(link.url)}" placeholder="URL (https://...)" class="input-simple" style="flex:1;" onchange="window.updateQuickLink(${idx}, 'url', this.value)">
            
            <input type="text" value="${escapeHtml(link.iconUrl || '')}" placeholder="アイコンURL (任意)" class="input-simple" style="width:120px;" onchange="window.updateQuickLink(${idx}, 'iconUrl', this.value)">
            
            <button class="btn-delete" onclick="window.deleteQuickLink(${idx})" style="margin-left:5px;">×</button>
        </div>
    `).join('');

    const html = `
        <div id="quickLinkSettingsModal" class="modal-overlay active" onclick="if(event.target===event.currentTarget)document.getElementById('quickLinkSettingsModal').remove()">
            <div class="edit-modal-dialog">
                <h2 style="margin-bottom:15px; font-size:16px;">クイックリンク設定</h2>
                
                <div class="quick-link-add-area">
                    <span style="font-size:14px; font-weight:bold; color:#5f6368; width:20px;">+</span>
                    <input type="text" id="newLinkName" placeholder="サイト名" class="input-simple" style="width:140px;">
                    <input type="text" id="newLinkUrl" placeholder="URL" class="input-simple" style="flex:1;">
                    <input type="text" id="newLinkIconUrl" placeholder="アイコンURL(任意)" class="input-simple" style="width:120px;">
                    <button class="btn-primary btn-compact" onclick="window.addQuickLink()" style="height:28px;">追加</button>
                </div>

                <div id="quickLinkSortableList" style="max-height:400px; overflow-y:auto; border:1px solid #eee; margin-bottom:15px; border-radius:4px;">
                    ${rows || '<p style="padding:20px; text-align:center; color:#999; font-size:12px;">リンクがありません</p>'}
                </div>

                <div class="edit-modal-actions">
                    <button class="btn-primary" onclick="document.getElementById('quickLinkSettingsModal').remove()">閉じる</button>
                </div>
            </div>
        </div>`;
    document.body.insertAdjacentHTML('beforeend', html);
    
    const el = document.getElementById('quickLinkSortableList');
    if(el) new Sortable(el, { handle: '.sort-handle', animation: 150, onEnd: window.reorderQuickLinks });
};

window.addQuickLink = async () => {
    const name = document.getElementById('newLinkName').value.trim();
    const url = document.getElementById('newLinkUrl').value.trim();
    const iconUrl = document.getElementById('newLinkIconUrl').value.trim();
    
    if (!name || !url) return alert('名称とURLを入力してください');

    const newLinks = [...quickLinks, { name, url, iconUrl }];
    await updateDoc(doc(db, "settings", "common"), { quickLinks: newLinks });
    
    // モーダル再描画
    window.openQuickLinkSettings();
};

window.updateQuickLink = async (idx, field, val) => {
    const newLinks = [...quickLinks];
    newLinks[idx][field] = val;
    await updateDoc(doc(db, "settings", "common"), { quickLinks: newLinks });
};

window.deleteQuickLink = async (idx) => {
    if(!confirm('削除しますか？')) return;
    const newLinks = quickLinks.filter((_, i) => i !== idx);
    await updateDoc(doc(db, "settings", "common"), { quickLinks: newLinks });
    window.openQuickLinkSettings();
};

window.reorderQuickLinks = async (evt) => {
    if (evt.oldIndex === evt.newIndex) return;
    const newLinks = [...quickLinks];
    const [moved] = newLinks.splice(evt.oldIndex, 1);
    newLinks.splice(evt.newIndex, 0, moved);
    await updateDoc(doc(db, "settings", "common"), { quickLinks: newLinks });
};

/* ■修正版：通知システム（自分通知対応・設定強化） */

// トーストを表示する関数
window.showToast = (msg, type = 'info') => {
    const box = document.getElementById('toastContainer');
    if (!box) return;

    const el = document.createElement('div');
    el.className = `toast-message ${type}`;
    el.innerHTML = `<div>${msg}</div>`;

    box.appendChild(el);

    // 4秒後に消す
    setTimeout(() => {
        el.style.animation = 'toast-fade-out 0.3s forwards';
        setTimeout(() => el.remove(), 300);
    }, 4000);
};

/* ■重要：検収ステータスの更新処理 */
window.updateInspectionStatus = async (catId, taskId, field, value) => {
    const cat = categories.find(c => c.id === catId);
    if (!cat) return;

    const items = cat.items.map(i => {
        if (i.id == taskId) {
            // ステータス更新
            const updates = { [field]: value };
            
            // 自動連携ロジック
            if (field === 'status1') {
                if (value === '反映済み') updates.status = 'completed'; 
                else updates.status = 'pending';
            }
            if (field === 'status2') {
                if (value === '検収中' && !i.inspectorName) {
                    updates.inspectorName = currentUser.displayName;
                }
            }
            return { ...i, ...updates };
        }
        return i;
    });

    await updateDoc(doc(db, "categories", catId), { items });
};

/* ■追加機能：チェックボックスでのメンバー選択 */
window.handleTaskCheckboxClick = (catId, taskId, checkbox) => {
    if (checkbox.checked) {
        checkbox.checked = false;
        window.showAssigneeSelectionModal(catId, taskId);
    } else {
        window.togglePlanned(catId, taskId, false);
    }
};

/* ■修正版：担当者選択モーダル（メンバー設定連動・設定ボタン付き） */
window.showAssigneeSelectionModal = (catId, taskId) => {
    window.closeModal();

    // 1. 共通設定（チームボードの設定）を取得
    const config = window.teamBoardConfig || { hiddenUsers: [], order: [] };
    
    // 2. ユーザーリストをフィルタリング (非表示ユーザーを除外)
    let users = appUsers.filter(u => !config.hiddenUsers.includes(u.name));

    // 3. 並び替え (設定された順序 > 未設定なら名前順)
    if (config.order && config.order.length > 0) {
        users.sort((a, b) => {
            const idxA = config.order.indexOf(a.name);
            const idxB = config.order.indexOf(b.name);
            const valA = idxA === -1 ? 9999 : idxA;
            const valB = idxB === -1 ? 9999 : idxB;
            return valA - valB;
        });
    } else {
        // 設定がない場合は自分を先頭、あとはアルファベット順
        users.sort((a, b) => (a.name === currentUser.displayName ? -1 : b.name === currentUser.displayName ? 1 : 0));
    }

    const listHtml = users.map(u => `
        <div class="template-select-item" onclick="window.selectAssigneeForTask('${catId}', ${taskId}, '${escapeHtml(u.name)}', '${u.photo || ''}')">
            <div style="display:flex; align-items:center; gap:8px;">
                ${u.photo ? `<img src="${u.photo}" style="width:24px;height:24px;border-radius:50%;object-fit:cover;">` : '<div style="width:24px;height:24px;border-radius:50%;background:#ccc;"></div>'}
                <span style="font-weight:600;">${escapeHtml(u.name)} ${u.name === currentUser.displayName ? '<span style="font-size:10px;color:#1a73e8;">(自分)</span>' : ''}</span>
            </div>
        </div>
    `).join('');

    // 右上に設定ボタン(歯車)を追加
    const html = `
        <div id="assigneeModal" class="modal-overlay active" onclick="if(event.target===event.currentTarget)window.closeModal()">
            <div class="edit-modal-dialog" style="max-width:350px;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px;">
                    <h2 style="font-size:14px; font-weight:bold; margin:0;">担当者を選択 (予定)</h2>
                    <button class="icon-btn" onclick="window.openTeamMemberSettings()" title="メンバー表示設定" style="width:28px; height:28px;">${ICONS.settings}</button>
                </div>
                <div class="template-select-list" style="max-height:300px; overflow-y:auto; padding:5px;">
                    ${listHtml || '<div style="padding:10px; text-align:center; color:#999; font-size:12px;">表示可能なメンバーがいません<br>右上の歯車から設定を確認してください</div>'}
                </div>
                <div class="edit-modal-actions"><button class="btn-cancel" onclick="window.closeModal()">キャンセル</button></div>
            </div>
        </div>`;
    document.body.insertAdjacentHTML('beforeend', html);
};

window.selectAssigneeForTask = (catId, taskId, name, photo) => {
    window.togglePlanned(catId, taskId, true, { name, photo });
    window.closeModal();
};

/* ■最新版：通知システム（検収完全対応・重複排除版） */
window.checkNotifications = (oldCats, newDocs, hasPendingWrites) => {
    if (window.myNotificationType === 'none') return;
    if (hasPendingWrites && !window.myNotifySelf) return;

    newDocs.forEach(d => {
        const newData = d.data();
        const oldCat = oldCats.find(c => c.id === d.id);
        if (!oldCat || !oldCat.items || !newData.items) return;

        const newItems = newData.items.filter(i => i.type === 'task');
        const oldItems = oldCat.items.filter(i => i.type === 'task');

        newItems.forEach(nT => {
            const oT = oldItems.find(o => o.id === nT.id);

            // 1. 新規タスク
            if (!oT) {
                if (shouldNotify('all')) window.showToast(`追加: ${escapeHtml(nT.name)}`);
                return;
            }

            // 2. ステータス変更（通常）
            if (nT.status !== oT.status) {
                const isMyTask = nT.assigneeName === currentUser.displayName;
                const isHiddenCompletion = nT.status1 === '反映済み';
                if (!isHiddenCompletion && (shouldNotify('all') || (shouldNotify('related') && isMyTask))) {
                    let stText = '';
                    if (nT.status === 'in-progress') stText = '着手';
                    else if (nT.status === 'completed') stText = '完了';
                    else if (nT.status === 'planned') stText = '予定';
                    if (stText) window.showToast(`${stText}: ${escapeHtml(nT.name)}`);
                }
            }

            // 3. アサイン変更（通常）
            if (nT.assigneeName !== oT.assigneeName) {
                const isPlannedChange = (nT.status === 'planned' && nT.status !== oT.status);
                if (!isPlannedChange) {
                    if (nT.assigneeName === currentUser.displayName) window.showToast(`担当になりました: ${escapeHtml(nT.name)}`, 'alert');
                    else if (shouldNotify('all')) window.showToast(`担当変更: ${escapeHtml(nT.name)}`);
                }
            }

            // 4. 検収担当変更（検収者）
            if (nT.inspectorName !== oT.inspectorName) {
                if (nT.inspectorName === currentUser.displayName) window.showToast(`検収担当になりました: ${escapeHtml(nT.name)}`, 'alert');
                else if (shouldNotify('all') && nT.inspectorName) window.showToast(`検収担当変更: ${escapeHtml(nT.name)}`);
            }

            // 5. 提出担当変更（提出者）
            if (nT.submitterName !== oT.submitterName) {
                if (nT.submitterName === currentUser.displayName) window.showToast(`提出担当になりました: ${escapeHtml(nT.name)}`, 'alert');
                else if (shouldNotify('all') && nT.submitterName) window.showToast(`提出担当変更: ${escapeHtml(nT.name)}`);
            }
            
            // 6. 検収ステータス変更（全パターン網羅）
            if ((nT.status1 && (nT.status1 !== oT.status1)) || (nT.status2 && (nT.status2 !== oT.status2))) {
                const imSubmitter = nT.submitterName === currentUser.displayName;
                const imInspector = nT.inspectorName === currentUser.displayName;

                if (shouldNotify('all') || (shouldNotify('related') && (imSubmitter || imInspector))) {
                    let msg = '';
                    // 進行状況の変化
                    if (nT.status1 === '依頼済み' && oT.status1 !== '依頼済み') msg = `検収依頼: ${nT.name}`;
                    if (nT.status1 === '調整中' && oT.status1 !== '調整中') msg = `作業着手(調整中): ${nT.name}`;
                    if (nT.status1 === '再依頼' && oT.status1 !== '再依頼') msg = `再検収依頼: ${nT.name}`;
                    if (nT.status1 === '反映済み' && oT.status1 !== '反映済み') msg = `完了(反映済み): ${nT.name}`;

                    // 検収結果の変化
                    if (nT.status2 === '検収中' && oT.status2 !== '検収中') msg = `検収開始: ${nT.name}`;
                    if (nT.status2 === '要調整' && oT.status2 !== '要調整') msg = `修正依頼(NG): ${nT.name}`;
                    if (nT.status2 === '反映OK' && oT.status2 !== '反映OK') msg = `検収OK: ${nT.name}`;
                    
                    if (msg) window.showToast(msg, msg.includes('修正依頼') ? 'alert' : (msg.includes('検収OK') ? 'success' : 'info'));
                }
            }
        });
    });
};

function shouldNotify(targetLevel) {
    const current = window.myNotificationType || 'related';
    if (targetLevel === 'all') return current === 'all';
    if (targetLevel === 'related') return current === 'related' || current === 'all';
    return false;
}

window.openNotificationSettings = () => {
    window.closeModal();
    const current = window.myNotificationType || 'related';
    const selfCheck = window.myNotifySelf ? 'checked' : '';
    const html = `
        <div id="notifSettingModal" class="modal-overlay active" onclick="if(event.target===event.currentTarget)document.getElementById('notifSettingModal').remove()">
            <div class="edit-modal-dialog" style="max-width:320px;">
                <h2 style="font-size:14px; margin-bottom:12px; font-weight:bold;">通知設定</h2>
                <div style="display:flex; flex-direction:column; gap:8px;">
                    <label style="padding:8px; border:1px solid #ddd; border-radius:4px; display:flex; align-items:center; cursor:pointer;">
                        <input type="radio" name="notifType" value="all" ${current==='all'?'checked':''}>
                        <div style="margin-left:10px; font-size:12px;">すべての通知 (チーム全員)</div>
                    </label>
                    <label style="padding:8px; border:1px solid #ddd; border-radius:4px; display:flex; align-items:center; cursor:pointer;">
                        <input type="radio" name="notifType" value="related" ${current==='related'?'checked':''}>
                        <div style="margin-left:10px; font-size:12px;">自分に関連のみ (推奨)</div>
                    </label>
                    <label style="padding:8px; border:1px solid #ddd; border-radius:4px; display:flex; align-items:center; cursor:pointer;">
                        <input type="radio" name="notifType" value="none" ${current==='none'?'checked':''}>
                        <div style="margin-left:10px; font-size:12px;">通知なし</div>
                    </label>
                </div>
                <hr style="margin: 15px 0 10px 0; border:0; border-top:1px solid #eee;">
                <label style="display:flex; align-items:center; cursor:pointer; font-size:12px;">
                    <input type="checkbox" id="notifySelfCheck" ${selfCheck} style="margin-right:8px;">
                    自分の操作も通知する
                </label>
                <div class="edit-modal-actions" style="margin-top:15px;">
                    <button class="btn-primary" onclick="window.saveNotificationSetting()">保存</button>
                </div>
            </div>
        </div>`;
    document.body.insertAdjacentHTML('beforeend', html);
};

window.saveNotificationSetting = async () => {
    const radios = document.getElementsByName('notifType');
    let type = 'related';
    for(const r of radios) { if(r.checked) type = r.value; }
    const notifySelf = document.getElementById('notifySelfCheck').checked;
    window.myNotificationType = type;
    window.myNotifySelf = notifySelf;
    await updateDoc(doc(db, "users", currentUser.uid), { notificationType: type, notifySelf: notifySelf });
    window.showToast('設定を保存しました');
    document.getElementById('notifSettingModal').remove();
};