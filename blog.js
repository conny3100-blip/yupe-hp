/**
 * ゆぺのにっき — blog.js
 * posts.json から記事を読み込む（全員が閲覧できる）
 */

let _postsCache = null;

// 全記事を取得
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

// IDで1件取得
async function fetchPost(id) {
  const posts = await fetchPosts();
  return posts.find(p => String(p.id) === String(id)) || null;
}

// URLパラメータ取得
function getParam(key) {
  return new URLSearchParams(location.search).get(key);
}

// HTML エスケープ
function escHtml(s) {
  return String(s)
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;');
}
