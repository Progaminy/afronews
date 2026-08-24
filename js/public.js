import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.112.4/+esm";
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, NEWS_TABLE } from "./config.js";

const db = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
const COMMENTS_TABLE = "afronews_comments";
const LIKES_TABLE = "afronews_likes";
const state = { posts: [], category: "Todas", search: "" };

const el = {
  nav: document.getElementById("mainNav"),
  menu: document.getElementById("menuBtn"),
  search: document.getElementById("searchInput"),
  clear: document.getElementById("clearFilter"),
  kicker: document.getElementById("sectionKicker"),
  title: document.getElementById("sectionTitle"),
  loading: document.getElementById("loadingState"),
  error: document.getElementById("errorState"),
  empty: document.getElementById("emptyState"),
  content: document.getElementById("content"),
  featured: document.getElementById("featured"),
  grid: document.getElementById("newsGrid"),
  retry: document.getElementById("retryBtn"),
  dialog: document.getElementById("articleDialog"),
  article: document.getElementById("articleContent"),
  close: document.getElementById("dialogClose"),
  toast: document.getElementById("toast")
};

document.getElementById("footerYear").textContent = "© " + new Date().getFullYear() + " AfroNews";
document.getElementById("currentDate").textContent = new Intl.DateTimeFormat("pt-PT", {
  weekday: "long", day: "2-digit", month: "long", year: "numeric"
}).format(new Date());

function esc(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

function safeUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function excerpt(text, limit) {
  const clean = String(text ?? "").replace(/\s+/g, " ").trim();
  return clean.length > limit ? clean.slice(0, limit).trim() + "…" : clean;
}

function formatDate(value) {
  try {
    return new Intl.DateTimeFormat("pt-PT", {
      day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit"
    }).format(new Date(value));
  } catch {
    return "";
  }
}

function imageList(post) {
  return Array.isArray(post.image_urls) ? post.image_urls.filter(safeUrl) : [];
}

function countValue(value) {
  const number = Number(value || 0);
  return Number.isFinite(number) && number >= 0 ? number : 0;
}

function storageGet(key) {
  try { return localStorage.getItem(key); } catch { return null; }
}

function storageSet(key, value) {
  try { localStorage.setItem(key, value); } catch {}
}

function makeVisitorId() {
  if (crypto?.randomUUID) return crypto.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (char) => {
    const random = Math.random() * 16 | 0;
    const value = char === "x" ? random : (random & 0x3 | 0x8);
    return value.toString(16);
  });
}

function getVisitorId() {
  const key = "afronewsVisitorId";
  const current = storageGet(key);
  if (current && /^[0-9a-f-]{36}$/i.test(current)) return current;
  const created = makeVisitorId();
  storageSet(key, created);
  return created;
}

const visitorId = getVisitorId();

function likedKey(postId) {
  return "afronewsLiked:" + postId;
}

function wasLiked(postId) {
  return storageGet(likedKey(postId)) === "1";
}

function rememberLiked(postId) {
  storageSet(likedKey(postId), "1");
}

function engagementMini(post) {
  return `<div class="engagement-mini" aria-label="Interações">
    <span>♥ ${countValue(post.like_count)}</span>
    <span>💬 ${countValue(post.comment_count)}</span>
  </div>`;
}

function filteredPosts() {
  const q = state.search.toLocaleLowerCase("pt").trim();
  return state.posts.filter((post) => {
    const categoryMatch = state.category === "Todas" || post.category === state.category;
    const searchMatch = !q || (post.title + " " + post.body + " " + post.category)
      .toLocaleLowerCase("pt").includes(q);
    return categoryMatch && searchMatch;
  });
}

function mainFeature(post) {
  const cover = imageList(post)[0] || "";
  return `<article class="feature">
    <div class="feature-media">${cover ? `<img src="${esc(cover)}" alt="Imagem principal da notícia" loading="eager">` : ""}</div>
    <div class="feature-body">
      <span class="chip">${esc(post.category)}</span>
      <h2>${esc(post.title)}</h2>
      <p>${esc(excerpt(post.body, 260))}</p>
      <button class="read-btn" data-open="${esc(post.id)}" type="button">Ler notícia</button>
      <div class="feature-meta">${esc(formatDate(post.created_at))}</div>
      ${engagementMini(post)}
    </div>
  </article>`;
}

function leadSmall(post) {
  const cover = imageList(post)[0] || "";
  return `<article class="lead-small">
    <div class="lead-small-media">${cover ? `<img src="${esc(cover)}" alt="Imagem da notícia" loading="lazy">` : ""}</div>
    <div>
      <span class="chip">${esc(post.category)}</span>
      <h3>${esc(post.title)}</h3>
      <div class="meta">${esc(formatDate(post.created_at))}</div>
      ${engagementMini(post)}
      <button class="card-open" data-open="${esc(post.id)}" type="button">Ler</button>
    </div>
  </article>`;
}

function card(post) {
  const cover = imageList(post)[0] || "";
  return `<article class="news-card">
    <div class="card-media">${cover ? `<img src="${esc(cover)}" alt="Imagem da notícia" loading="lazy">` : ""}</div>
    <div class="card-body">
      <span class="chip">${esc(post.category)}</span>
      <h3>${esc(post.title)}</h3>
      <p>${esc(excerpt(post.body, 145))}</p>
      <div class="meta">${esc(formatDate(post.created_at))}</div>
      ${engagementMini(post)}
    </div>
    <button class="card-open" data-open="${esc(post.id)}" type="button">Continuar a ler</button>
  </article>`;
}

function render() {
  const posts = filteredPosts();
  const hasFilter = state.category !== "Todas";
  const hasSearch = Boolean(state.search.trim());

  el.kicker.textContent = hasFilter ? "Categoria" : hasSearch ? "Pesquisa" : "Agora";
  el.title.textContent = hasFilter ? state.category : hasSearch ? `Resultados para “${state.search.trim()}”` : "Últimas notícias";
  el.clear.hidden = !hasFilter && !hasSearch;
  el.featured.innerHTML = "";
  el.grid.innerHTML = "";
  el.empty.hidden = posts.length > 0;
  el.content.hidden = posts.length === 0;

  if (!posts.length) return;

  const lead = posts[0];
  const side = posts.slice(1, 3);
  const remainder = posts.slice(3);
  el.featured.innerHTML = mainFeature(lead) +
    `<aside class="lead-stack">${side.length ? side.map(leadSmall).join("") : '<div class="lead-small"><div><span class="chip">AfroNews</span><h3>Mais notícias serão publicadas aqui.</h3></div></div>'}</aside>`;
  el.grid.innerHTML = remainder.length ? remainder.map(card).join("") : posts.slice(1).map(card).join("");
}

function embedUrl(raw) {
  try {
    const url = new URL(raw);
    const host = url.hostname.replace(/^www\./, "");
    const parts = url.pathname.split("/").filter(Boolean);

    if (host === "youtu.be" && parts[0]) return "https://www.youtube.com/embed/" + encodeURIComponent(parts[0]);
    if (host === "youtube.com" || host === "m.youtube.com") {
      const id = url.searchParams.get("v");
      if (id) return "https://www.youtube.com/embed/" + encodeURIComponent(id);
      if (["shorts", "embed", "live"].includes(parts[0]) && parts[1]) return "https://www.youtube.com/embed/" + encodeURIComponent(parts[1]);
    }
    if (host === "vimeo.com" || host === "player.vimeo.com") {
      const id = parts.find((part) => /^\d+$/.test(part));
      if (id) return "https://player.vimeo.com/video/" + id;
    }
  } catch {}
  return null;
}

function relatedLinksHtml(post) {
  const links = post?.social_links && typeof post.social_links === "object" ? post.social_links : {};
  const items = [
    ["youtube", "YouTube"],
    ["facebook", "Facebook"],
    ["tiktok", "TikTok"]
  ].filter(([key]) => safeUrl(links[key]));

  if (!items.length) return "";
  return `<div class="related-links" aria-label="Links adicionais da publicação">
    ${items.map(([key, label]) => `<a href="${esc(links[key])}" target="_blank" rel="noopener noreferrer">Abrir no ${label} ↗</a>`).join("")}
  </div>`;
}

function interactionHtml(post) {
  const liked = wasLiked(post.id);
  const savedName = storageGet("afronewsCommentName") || "";
  const likes = countValue(post.like_count);
  const comments = countValue(post.comment_count);

  return `<section class="article-engagement" data-engagement-post="${esc(post.id)}">
    <div class="engagement-summary">
      <button class="like-btn${liked ? " liked" : ""}" data-like="${esc(post.id)}" type="button" ${liked ? "disabled" : ""}>
        <span aria-hidden="true">♥</span>
        <span>${liked ? "Gostou" : "Gostei"}</span>
        <b data-like-count>${likes}</b>
      </button>
      <span class="comment-total">💬 <b data-comment-count>${comments}</b> comentário(s)</span>
    </div>

    <div class="comments-block">
      <h2>Comentários</h2>
      <form class="comment-form" data-comment-form="${esc(post.id)}">
        <input name="author" type="text" minlength="2" maxlength="60" value="${esc(savedName)}" placeholder="Seu nome" autocomplete="name" required>
        <textarea name="body" minlength="1" maxlength="1000" placeholder="Escreva seu comentário..." required></textarea>
        <button type="submit">Publicar comentário</button>
      </form>
      <div class="comments-list" data-comments-list="${esc(post.id)}" aria-live="polite">
        <p class="comments-empty">A carregar comentários...</p>
      </div>
    </div>
  </section>`;
}

function renderComments(postId, comments) {
  const list = document.querySelector(`[data-comments-list="${postId}"]`);
  if (!list) return;

  if (!comments.length) {
    list.innerHTML = '<p class="comments-empty">Seja o primeiro a comentar esta notícia.</p>';
    return;
  }

  list.innerHTML = comments.map((comment) => `
    <article class="comment-item">
      <div class="comment-head">
        <strong class="comment-author">${esc(comment.author_name)}</strong>
        <span class="comment-date">${esc(formatDate(comment.created_at))}</span>
      </div>
      <p class="comment-body">${esc(comment.body)}</p>
    </article>
  `).join("");
}

async function loadComments(postId) {
  const list = document.querySelector(`[data-comments-list="${postId}"]`);
  if (!list) return;

  const { data, error } = await db
    .from(COMMENTS_TABLE)
    .select("id,author_name,body,created_at")
    .eq("post_id", postId)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    console.error(error);
    list.innerHTML = '<p class="comments-empty">Não foi possível carregar os comentários.</p>';
    return;
  }

  renderComments(postId, data || []);
}

function updateArticleCounts(post) {
  const wrap = document.querySelector(`[data-engagement-post="${post.id}"]`);
  if (!wrap) return;
  const likeCount = wrap.querySelector("[data-like-count]");
  const commentCount = wrap.querySelector("[data-comment-count]");
  if (likeCount) likeCount.textContent = countValue(post.like_count);
  if (commentCount) commentCount.textContent = countValue(post.comment_count);
}

async function handleLike(button) {
  const postId = button.dataset.like;
  const post = state.posts.find((item) => item.id === postId);
  if (!post || wasLiked(postId)) return;

  button.disabled = true;
  button.textContent = "A registar...";

  const { error } = await db.from(LIKES_TABLE).insert({ post_id: postId, visitor_id: visitorId });

  if (error && error.code !== "23505") {
    console.error(error);
    button.disabled = false;
    button.innerHTML = `<span aria-hidden="true">♥</span><span>Gostei</span><b data-like-count>${countValue(post.like_count)}</b>`;
    notify("Não foi possível registar o like.", true);
    return;
  }

  rememberLiked(postId);
  if (!error) post.like_count = countValue(post.like_count) + 1;
  button.classList.add("liked");
  button.disabled = true;
  button.innerHTML = `<span aria-hidden="true">♥</span><span>Gostou</span><b data-like-count>${countValue(post.like_count)}</b>`;
  updateArticleCounts(post);
  render();
}

async function handleCommentSubmit(form) {
  const postId = form.dataset.commentForm;
  const post = state.posts.find((item) => item.id === postId);
  if (!post) return;

  const authorInput = form.querySelector('[name="author"]');
  const bodyInput = form.querySelector('[name="body"]');
  const submit = form.querySelector('button[type="submit"]');
  const author = authorInput.value.trim();
  const body = bodyInput.value.trim();

  if (author.length < 2 || author.length > 60) {
    notify("Digite um nome entre 2 e 60 caracteres.", true);
    authorInput.focus();
    return;
  }
  if (!body || body.length > 1000) {
    notify("O comentário deve ter entre 1 e 1000 caracteres.", true);
    bodyInput.focus();
    return;
  }

  submit.disabled = true;
  submit.textContent = "A publicar...";

  const { error } = await db.from(COMMENTS_TABLE).insert({
    post_id: postId,
    author_name: author,
    body
  });

  submit.disabled = false;
  submit.textContent = "Publicar comentário";

  if (error) {
    console.error(error);
    notify("Não foi possível publicar o comentário.", true);
    return;
  }

  storageSet("afronewsCommentName", author);
  bodyInput.value = "";
  post.comment_count = countValue(post.comment_count) + 1;
  updateArticleCounts(post);
  render();
  await loadComments(postId);
  notify("Comentário publicado.");
}

function notify(message, error = false) {
  el.toast.textContent = message;
  el.toast.className = "toast show" + (error ? " error" : "");
  clearTimeout(notify.timer);
  notify.timer = setTimeout(() => { el.toast.className = "toast"; }, 3200);
}

function openArticle(id) {
  const post = state.posts.find((item) => item.id === id);
  if (!post) return;

  const images = imageList(post);
  const cover = images[0] || "";
  const gallery = images.length > 1
    ? `<div class="gallery">${images.slice(1).map((url) => `<img src="${esc(url)}" alt="Imagem da notícia" loading="lazy">`).join("")}</div>`
    : "";
  const videos = Array.isArray(post.video_urls) ? post.video_urls.filter(safeUrl) : [];
  const videoHtml = videos.length
    ? `<div class="videos">${videos.map((url) => {
        const embed = embedUrl(url);
        return embed
          ? `<iframe class="video-frame" src="${esc(embed)}" title="Vídeo" loading="lazy" allowfullscreen></iframe>`
          : `<a class="video-link" href="${esc(url)}" target="_blank" rel="noopener noreferrer">Abrir vídeo: ${esc(url)}</a>`;
      }).join("")}</div>`
    : "";

  el.article.innerHTML = `
    <header class="article-hero">
      ${cover ? `<img src="${esc(cover)}" alt="Imagem principal da notícia">` : ""}
      <div class="article-head">
        <span class="chip">${esc(post.category)}</span>
        <h1>${esc(post.title)}</h1>
        <div>${esc(formatDate(post.created_at))}</div>
      </div>
    </header>
    <div class="article-body">
      <div class="article-text">${esc(post.body)}</div>
      ${gallery}
      ${videoHtml}
      ${relatedLinksHtml(post)}
      ${interactionHtml(post)}
    </div>`;
  el.dialog.showModal();
  loadComments(id);
}

async function loadNews() {
  el.loading.hidden = false;
  el.error.hidden = true;
  el.empty.hidden = true;
  el.content.hidden = true;

  const { data, error } = await db
    .from(NEWS_TABLE)
    .select("id,title,body,category,image_urls,video_urls,social_links,like_count,comment_count,created_at")
    .eq("status", "published")
    .order("created_at", { ascending: false });

  el.loading.hidden = true;
  if (error) {
    console.error(error);
    el.error.hidden = false;
    return;
  }

  state.posts = data || [];
  render();
}

el.menu.addEventListener("click", () => el.nav.classList.toggle("open"));

document.addEventListener("click", (event) => {
  const categoryButton = event.target.closest("[data-category]");
  if (categoryButton) {
    state.category = categoryButton.dataset.category;
    state.search = "";
    el.search.value = "";
    document.querySelectorAll("[data-category]").forEach((button) => button.classList.toggle("active", button.dataset.category === state.category));
    el.nav.classList.remove("open");
    render();
    return;
  }

  const likeButton = event.target.closest("[data-like]");
  if (likeButton) {
    handleLike(likeButton);
    return;
  }

  const openButton = event.target.closest("[data-open]");
  if (openButton) openArticle(openButton.dataset.open);
});

document.addEventListener("submit", (event) => {
  const form = event.target.closest("[data-comment-form]");
  if (!form) return;
  event.preventDefault();
  handleCommentSubmit(form);
});

el.search.addEventListener("input", () => {
  state.search = el.search.value;
  state.category = "Todas";
  document.querySelectorAll("[data-category]").forEach((button) => button.classList.toggle("active", button.dataset.category === "Todas"));
  render();
});

el.clear.addEventListener("click", () => {
  state.category = "Todas";
  state.search = "";
  el.search.value = "";
  document.querySelectorAll("[data-category]").forEach((button) => button.classList.toggle("active", button.dataset.category === "Todas"));
  render();
});

el.retry.addEventListener("click", loadNews);
el.close.addEventListener("click", () => el.dialog.close());

loadNews();
