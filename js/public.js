import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.112.4/+esm";
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, NEWS_TABLE } from "./config.js";

const db = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
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
    <div class="feature-media">${cover ? `<img src="${esc(cover)}" alt="">` : ""}</div>
    <div class="feature-body">
      <span class="chip">${esc(post.category)}</span>
      <h2>${esc(post.title)}</h2>
      <p>${esc(excerpt(post.body, 260))}</p>
      <button class="read-btn" data-open="${esc(post.id)}" type="button">Ler notícia</button>
      <div class="feature-meta">${esc(formatDate(post.created_at))}</div>
    </div>
  </article>`;
}

function leadSmall(post) {
  const cover = imageList(post)[0] || "";
  return `<article class="lead-small">
    <div class="lead-small-media">${cover ? `<img src="${esc(cover)}" alt="">` : ""}</div>
    <div>
      <span class="chip">${esc(post.category)}</span>
      <h3>${esc(post.title)}</h3>
      <div class="meta">${esc(formatDate(post.created_at))}</div>
      <button class="card-open" data-open="${esc(post.id)}" type="button">Ler</button>
    </div>
  </article>`;
}

function card(post) {
  const cover = imageList(post)[0] || "";
  return `<article class="news-card">
    <div class="card-media">${cover ? `<img src="${esc(cover)}" alt="">` : ""}</div>
    <div class="card-body">
      <span class="chip">${esc(post.category)}</span>
      <h3>${esc(post.title)}</h3>
      <p>${esc(excerpt(post.body, 145))}</p>
      <div class="meta">${esc(formatDate(post.created_at))}</div>
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

  el.featured.innerHTML =
    mainFeature(lead) +
    `<aside class="lead-stack">${side.length ? side.map(leadSmall).join("") : '<div class="lead-small"><div><span class="chip">AfroNews</span><h3>Mais notícias serão publicadas aqui.</h3></div></div>'}</aside>`;

  el.grid.innerHTML = remainder.length
    ? remainder.map(card).join("")
    : posts.slice(1).map(card).join("");
}

function embedUrl(raw) {
  try {
    const url = new URL(raw);
    const host = url.hostname.replace(/^www\./, "");
    const parts = url.pathname.split("/").filter(Boolean);

    if (host === "youtu.be" && parts[0]) {
      return "https://www.youtube.com/embed/" + encodeURIComponent(parts[0]);
    }
    if (host === "youtube.com" || host === "m.youtube.com") {
      const id = url.searchParams.get("v");
      if (id) return "https://www.youtube.com/embed/" + encodeURIComponent(id);
      if (["shorts", "embed", "live"].includes(parts[0]) && parts[1]) {
        return "https://www.youtube.com/embed/" + encodeURIComponent(parts[1]);
      }
    }
    if (host === "vimeo.com" || host === "player.vimeo.com") {
      const id = parts.find((part) => /^\d+$/.test(part));
      if (id) return "https://player.vimeo.com/video/" + id;
    }
  } catch {}
  return null;
}

function openArticle(id) {
  const post = state.posts.find((item) => item.id === id);
  if (!post) return;

  const images = imageList(post);
  const cover = images[0] || "";
  const gallery = images.length > 1
    ? `<div class="gallery">${images.slice(1).map((url) => `<img src="${esc(url)}" alt="Imagem da notícia">`).join("")}</div>`
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
      ${cover ? `<img src="${esc(cover)}" alt="">` : ""}
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
    </div>`;
  el.dialog.showModal();
}

async function loadNews() {
  el.loading.hidden = false;
  el.error.hidden = true;
  el.empty.hidden = true;
  el.content.hidden = true;

  const { data, error } = await db
    .from(NEWS_TABLE)
    .select("id,title,body,category,image_urls,video_urls,created_at")
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
    document.querySelectorAll("[data-category]").forEach((button) => {
      button.classList.toggle("active", button.dataset.category === state.category);
    });
    el.nav.classList.remove("open");
    render();
    return;
  }

  const openButton = event.target.closest("[data-open]");
  if (openButton) openArticle(openButton.dataset.open);
});

el.search.addEventListener("input", () => {
  state.search = el.search.value;
  state.category = "Todas";
  document.querySelectorAll("[data-category]").forEach((button) => {
    button.classList.toggle("active", button.dataset.category === "Todas");
  });
  render();
});

el.clear.addEventListener("click", () => {
  state.category = "Todas";
  state.search = "";
  el.search.value = "";
  document.querySelectorAll("[data-category]").forEach((button) => {
    button.classList.toggle("active", button.dataset.category === "Todas");
  });
  render();
});

el.retry.addEventListener("click", loadNews);
el.close.addEventListener("click", () => el.dialog.close());

loadNews();
