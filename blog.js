/**
 * ゆぺのにっき — blog.js
 * posts.json から記事を読み込む（全員が閲覧できる）
 */

const REPO = 'conny3100-blip/yupe-hp';
const FILE = 'posts.json';

let _postsCache = null;
let _fileSha    = '';

// ===== 記事取得 =====
async function fetchPosts() {
  if (_postsCache) return _postsCache;
  try {
    const res = await fetch('posts.json?t=' + Date.now());
    _postsCache = await res.json();
  } catch(e) {
    _postsCache = [];
  }
  return _postsCache;
}

async function fetchPost(id) {
  const posts = await fetchPosts();
  return posts.find(p => String(p.id) === String(id)) || null;
}

// ===== URLパラメータ =====
function getParam(key) {
  return new URLSearchParams(location.search).get(key);
}

// ===== HTMLエスケープ =====
function escHtml(s) {
  return String(s || '')
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;');
}

// ===== 管理者チェック =====
function isAdmin() {
  return !!localStorage.getItem('yupe_admin');
}

// ===== GitHub API: posts.json を取得（SHA付き）=====
async function ghFetchPosts() {
  const token = localStorage.getItem('yupe_gh_token');
  if (!token) return null;
  const res = await fetch(`https://api.github.com/repos/${REPO}/contents/${FILE}`, {
    headers: {
      'Authorization': 'token ' + token,
      'Accept': 'application/vnd.github+json'
    }
  });
  if (!res.ok) return null;
  const data = await res.json();
  _fileSha = data.sha;
  const binary = atob(data.content.replace(/\n/g, ''));
  const bytes = Uint8Array.from(binary, c => c.charCodeAt(0));
  return JSON.parse(new TextDecoder().decode(bytes));
}

// ===== GitHub API: posts.json を保存 =====
async function ghSavePosts(posts) {
  const token = localStorage.getItem('yupe_gh_token');
  if (!token) throw new Error('トークンがありません');
  const content = btoa(unescape(encodeURIComponent(JSON.stringify(posts, null, 2))));
  const res = await fetch(`https://api.github.com/repos/${REPO}/contents/${FILE}`, {
    method: 'PUT',
    headers: {
      'Authorization': 'token ' + token,
      'Accept': 'application/vnd.github+json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      message: 'ブログ記事を更新',
      content: content,
      sha: _fileSha
    })
  });
  if (!res.ok) {
    const d = await res.json();
    throw new Error(d.message || '保存失敗');
  }
  const data = await res.json();
  _fileSha = data.content.sha;
}

// ===== 管理者ツールバーを記事ページに表示 =====
function renderAdminBar(postId) {
  if (!isAdmin()) return;

  const bar = document.createElement('div');
  bar.id = 'adminBar';
  bar.style.cssText = `
    position: fixed; bottom: 1.5rem; left: 50%; transform: translateX(-50%);
    background: #1e2d3a; color: #fff; border-radius: 4px;
    display: flex; align-items: center; gap: 0.5rem;
    padding: 0.6rem 1rem; z-index: 999; box-shadow: 0 4px 16px rgba(0,0,0,0.25);
    font-size: 0.8rem; font-family: inherit; white-space: nowrap;
  `;

  bar.innerHTML = `
    <span style="color:#c8a84a;margin-right:0.3rem;">✝ 管理</span>
    <a href="admin.html?edit=${postId}" style="
      color:#fff; background:#4a8ab4; text-decoration:none;
      padding:0.35rem 0.9rem; border-radius:2px; font-size:0.78rem;
    ">✏️ 編集</a>
    <button id="adminDeleteBtn" style="
      color:#fff; background:#c0392b; border:none; cursor:pointer;
      padding:0.35rem 0.9rem; border-radius:2px; font-size:0.78rem;
      font-family:inherit;
    ">🗑 削除</button>
    <a href="admin.html" style="color:#8aaabb;font-size:0.75rem;margin-left:0.3rem;text-decoration:none;">管理画面 →</a>
  `;

  document.body.appendChild(bar);

  document.getElementById('adminDeleteBtn').addEventListener('click', async () => {
    const confirmDelete = confirm('この記事を削除しますか？\nこの操作は元に戻せません。');
    if (!confirmDelete) return;

    const btn = document.getElementById('adminDeleteBtn');
    btn.textContent = '削除中…';
    btn.disabled = true;

    try {
      const posts = await ghFetchPosts();
      if (!posts) throw new Error('記事の取得に失敗しました');
      const updated = posts.filter(p => String(p.id) !== String(postId));
      await ghSavePosts(updated);
      alert('削除しました！ホームに戻ります。');
      location.href = 'index.html';
    } catch(e) {
      alert('削除失敗: ' + e.message);
      btn.textContent = '🗑 削除';
      btn.disabled = false;
    }
  });
}

// ===== 管理者ボタンをカードに追加（一覧ページ用）=====
function renderAdminCardButtons(postId, cardEl) {
  if (!isAdmin()) return;

  const wrap = document.createElement('div');
  wrap.style.cssText = `
    display: flex; gap: 0.4rem; padding: 0.5rem 1rem 0.8rem;
  `;
  wrap.innerHTML = `
    <a href="admin.html?edit=${postId}" style="
      font-size:0.72rem; color:#4a8ab4; background:#edf5fd;
      border:1px solid #c5dff0; padding:0.25rem 0.7rem;
      border-radius:2px; text-decoration:none;
    ">✏️ 編集</a>
    <button data-id="${postId}" class="card-delete-btn" style="
      font-size:0.72rem; color:#c0392b; background:#fdf0ee;
      border:1px solid #f0ccc8; padding:0.25rem 0.7rem;
      border-radius:2px; cursor:pointer; font-family:inherit;
    ">🗑 削除</button>
  `;
  cardEl.appendChild(wrap);

  wrap.querySelector('.card-delete-btn').addEventListener('click', async (e) => {
    e.preventDefault();
    const id = e.target.dataset.id;
    if (!confirm('この記事を削除しますか？')) return;
    e.target.textContent = '削除中…';
    e.target.disabled = true;
    try {
      const posts = await ghFetchPosts();
      if (!posts) throw new Error('取得失敗');
      const updated = posts.filter(p => String(p.id) !== String(id));
      await ghSavePosts(updated);
      cardEl.closest('article')?.remove();
    } catch(err) {
      alert('削除失敗: ' + err.message);
      e.target.textContent = '🗑 削除';
      e.target.disabled = false;
    }
  });
}
