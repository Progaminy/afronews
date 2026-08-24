import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.112.4/+esm";
import {
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY,
  NEWS_TABLE,
  ADMIN_TABLE,
  MEDIA_BUCKET
} from "./config.js";

const db = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
const categories = ["África", "Europa", "América", "Rússia", "Ásia", "Oceania"];
let currentUser = null;
let selectedFiles = [];
let posts = [];

const el = {
  authView: document.getElementById("authView"),
  adminView: document.getElementById("adminView"),
  loginForm: document.getElementById("loginForm"),
  loginEmail: document.getElementById("loginEmail"),
  loginPassword: document.getElementById("loginPassword"),
  loginButton: document.getElementById("loginButton"),
  denied: document.getElementById("accessDenied"),
  logout: document.getElementById("logoutButton"),
  identity: document.getElementById("adminIdentity"),
  form: document.getElementById("postForm"),
  title: document.getElementById("postTitle"),
  category: document.getElementById("postCategory"),
  body: document.getElementById("postBody"),
  files: document.getElementById("deviceImages"),
  fileStatus: document.getElementById("fileStatus"),
  previews: document.getElementById("imagePreviews"),
  imageLinks: document.getElementById("imageLinks"),
  videoLinks: document.getElementById("videoLinks"),
  publish: document.getElementById("publishButton"),
  clear: document.getElementById("clearButton"),
  count: document.getElementById("postCount"),
  list: document.getElementById("postList"),
  toast: document.getElementById("toast")
};

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

function parseLinks(value) {
  return value.split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean)
    .filter(safeUrl);
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

function notify(message, error = false) {
  el.toast.textContent = message;
  el.toast.className = "toast show" + (error ? " error" : "");
  clearTimeout(notify.timer);
  notify.timer = setTimeout(() => { el.toast.className = "toast"; }, 3200);
}

function showLogin() {
  currentUser = null;
  el.adminView.hidden = true;
  el.authView.hidden = false;
}

function showAdmin(user) {
  currentUser = user;
  el.authView.hidden = true;
  el.adminView.hidden = false;
  el.denied.hidden = true;
  el.identity.textContent = user.email ? "Sessão: " + user.email : "Administrador autenticado";
}

async function isAdmin(user) {
  if (!user) return false;
  const { data, error } = await db
    .from(ADMIN_TABLE)
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    console.error(error);
    return false;
  }
  return Boolean(data);
}

async function authorize(session) {
  const user = session?.user;
  if (!user) {
    showLogin();
    return false;
  }

  const allowed = await isAdmin(user);
  if (!allowed) {
    await db.auth.signOut();
    showLogin();
    el.denied.hidden = false;
    return false;
  }

  showAdmin(user);
  await loadPosts();
  return true;
}

async function start() {
  const { data, error } = await db.auth.getSession();
  if (error) console.error(error);
  await authorize(data?.session ?? null);
}

el.loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  el.denied.hidden = true;
  el.loginButton.disabled = true;
  el.loginButton.textContent = "A entrar...";

  const { data, error } = await db.auth.signInWithPassword({
    email: el.loginEmail.value.trim(),
    password: el.loginPassword.value
  });

  if (error) {
    notify("E-mail ou palavra-passe inválidos.", true);
  } else {
    const allowed = await authorize(data.session);
    if (!allowed) el.denied.hidden = false;
  }

  el.loginButton.disabled = false;
  el.loginButton.textContent = "Entrar";
});

el.logout.addEventListener("click", async () => {
  await db.auth.signOut();
  showLogin();
  el.loginPassword.value = "";
});

el.files.addEventListener("change", () => {
  const images = Array.from(el.files.files || []).filter((file) => file.type.startsWith("image/"));
  selectedFiles = images.slice(0, 3);

  if (images.length > 3) {
    notify("O limite é 3 imagens do dispositivo. As restantes foram ignoradas.", true);
  }
  renderPreviews();
});

function renderPreviews() {
  el.previews.innerHTML = "";
  el.fileStatus.textContent = selectedFiles.length
    ? selectedFiles.length + " de 3 imagem(ns) selecionada(s)."
    : "Nenhuma imagem selecionada.";

  selectedFiles.forEach((file) => {
    const wrap = document.createElement("div");
    const image = document.createElement("img");
    const objectUrl = URL.createObjectURL(file);
    wrap.className = "preview";
    image.src = objectUrl;
    image.alt = file.name;
    image.onload = () => URL.revokeObjectURL(objectUrl);
    wrap.appendChild(image);
    el.previews.appendChild(wrap);
  });
}

function resetForm() {
  el.form.reset();
  selectedFiles = [];
  renderPreviews();
}

el.clear.addEventListener("click", resetForm);

async function uploadDeviceImages() {
  if (!selectedFiles.length) return [];
  if (!currentUser) throw new Error("Sessão administrativa inválida.");

  const urls = [];

  for (const file of selectedFiles) {
    const extension = (file.name.split(".").pop() || "jpg")
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "") || "jpg";
    const path = currentUser.id + "/" + crypto.randomUUID() + "." + extension;

    const { error: uploadError } = await db.storage
      .from(MEDIA_BUCKET)
      .upload(path, file, {
        contentType: file.type || "image/jpeg",
        cacheControl: "3600",
        upsert: false
      });

    if (uploadError) throw uploadError;

    const { data } = db.storage.from(MEDIA_BUCKET).getPublicUrl(path);
    if (data?.publicUrl) urls.push(data.publicUrl);
  }

  return urls;
}

el.form.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (!currentUser) {
    notify("Sessão expirada. Entre novamente.", true);
    showLogin();
    return;
  }

  const title = el.title.value.trim();
  const body = el.body.value.trim();
  const category = el.category.value;

  if (!title || !body) {
    notify("Título e texto são obrigatórios.", true);
    (!title ? el.title : el.body).focus();
    return;
  }

  if (!categories.includes(category)) {
    notify("Selecione uma categoria.", true);
    el.category.focus();
    return;
  }

  el.publish.disabled = true;
  el.publish.textContent = "A publicar...";

  try {
    const uploadedUrls = await uploadDeviceImages();
    const linkedImages = parseLinks(el.imageLinks.value);
    const videoUrls = parseLinks(el.videoLinks.value);

    const { error } = await db.from(NEWS_TABLE).insert({
      title,
      body,
      category,
      image_urls: [...uploadedUrls, ...linkedImages],
      video_urls: videoUrls,
      status: "published",
      created_by: currentUser.id
    });

    if (error) throw error;

    resetForm();
    await loadPosts();
    notify("Notícia publicada no AfroNews.");
  } catch (error) {
    console.error(error);
    notify(error?.message || "Não foi possível publicar a notícia.", true);
  } finally {
    el.publish.disabled = false;
    el.publish.textContent = "Publicar notícia";
  }
});

async function loadPosts() {
  const { data, error } = await db
    .from(NEWS_TABLE)
    .select("id,title,category,image_urls,created_at,status")
    .order("created_at", { ascending: false });

  if (error) {
    console.error(error);
    notify("Não foi possível carregar as publicações.", true);
    return;
  }

  posts = data || [];
  renderPosts();
}

function renderPosts() {
  el.count.textContent = posts.length;

  if (!posts.length) {
    el.list.innerHTML = '<div class="empty-state"><p>Nenhuma notícia publicada.</p></div>';
    return;
  }

  el.list.innerHTML = posts.map((post) => `
    <div class="post-item">
      <span class="chip">${esc(post.category)}</span>
      <h3>${esc(post.title)}</h3>
      <p>${esc(formatDate(post.created_at))}</p>
      <div class="post-actions">
        <button class="danger-btn" data-delete="${esc(post.id)}" type="button">Apagar</button>
      </div>
    </div>
  `).join("");
}

function storagePathFromPublicUrl(url) {
  try {
    const parsed = new URL(url);
    const marker = "/storage/v1/object/public/" + MEDIA_BUCKET + "/";
    const index = parsed.pathname.indexOf(marker);
    if (index < 0) return null;
    return decodeURIComponent(parsed.pathname.slice(index + marker.length));
  } catch {
    return null;
  }
}

async function deletePost(id) {
  const post = posts.find((item) => item.id === id);
  if (!post) return;
  if (!confirm('Apagar “' + post.title + '”?')) return;

  const storedPaths = (Array.isArray(post.image_urls) ? post.image_urls : [])
    .map(storagePathFromPublicUrl)
    .filter(Boolean);

  if (storedPaths.length) {
    const { error: storageError } = await db.storage.from(MEDIA_BUCKET).remove(storedPaths);
    if (storageError) console.warn("Falha ao remover algum ficheiro:", storageError);
  }

  const { error } = await db.from(NEWS_TABLE).delete().eq("id", id);
  if (error) {
    console.error(error);
    notify("Não foi possível apagar a notícia.", true);
    return;
  }

  await loadPosts();
  notify("Notícia apagada.");
}

el.list.addEventListener("click", (event) => {
  const button = event.target.closest("[data-delete]");
  if (button) deletePost(button.dataset.delete);
});

db.auth.onAuthStateChange((event, session) => {
  if (event === "SIGNED_OUT") showLogin();
  if (event === "SIGNED_IN" && session?.user && !currentUser) authorize(session);
});

start();
