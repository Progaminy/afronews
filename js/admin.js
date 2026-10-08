import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.112.4/+esm";
import {
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY,
  NEWS_TABLE,
  ADMIN_TABLE,
  MEDIA_BUCKET,
  SETTINGS_TABLE
} from "./config.js";

const db = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
const categories = ["África", "Europa", "América", "Rússia", "Ásia", "Oceania"];
let currentUser = null;
let selectedFiles = [];
let posts = [];
let selectedProfileFile = null;
let siteSettings = null;

const el = {
  authView: document.getElementById("authView"),
  adminView: document.getElementById("adminView"),
  loginForm: document.getElementById("loginForm"),
  loginEmail: document.getElementById("loginEmail"),
  loginPassword: document.getElementById("loginPassword"),
  loginButton: document.getElementById("loginButton"),
  forgotPassword: document.getElementById("forgotPasswordButton"),
  recoveryForm: document.getElementById("passwordRecoveryForm"),
  newPassword: document.getElementById("newPassword"),
  confirmPassword: document.getElementById("confirmPassword"),
  savePassword: document.getElementById("savePasswordButton"),
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
  youtubeLink: document.getElementById("youtubeLink"),
  facebookLink: document.getElementById("facebookLink"),
  tiktokLink: document.getElementById("tiktokLink"),
  publish: document.getElementById("publishButton"),
  clear: document.getElementById("clearButton"),
  count: document.getElementById("postCount"),
  list: document.getElementById("postList"),
  toast: document.getElementById("toast"),
  settingsForm: document.getElementById("settingsForm"),
  primaryColor: document.getElementById("primaryColor"),
  colorPreview: document.getElementById("colorPreview"),
  profileImage: document.getElementById("profileImage"),
  profileImageStatus: document.getElementById("profileImageStatus"),
  profilePreview: document.getElementById("profilePreview"),
  whatsappNumber: document.getElementById("whatsappNumber"),
  siteFacebook: document.getElementById("siteFacebook"),
  siteYoutube: document.getElementById("siteYoutube"),
  siteTiktok: document.getElementById("siteTiktok"),
  saveSettings: document.getElementById("saveSettingsButton")
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

function readOptionalUrl(input, label) {
  const value = input.value.trim();
  if (!value) return "";
  if (!safeUrl(value)) throw new Error(`${label}: coloque um link válido começando por http:// ou https://.`);
  return value;
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
  el.loginForm.hidden = false;
  el.recoveryForm.hidden = true;
}

function showPasswordReset() {
  currentUser = null;
  el.adminView.hidden = true;
  el.authView.hidden = false;
  el.loginForm.hidden = true;
  el.recoveryForm.hidden = false;
  el.newPassword.focus();
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
  await Promise.all([loadPosts(), loadSiteSettings()]);
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

el.forgotPassword.addEventListener("click", async () => {
  const email = el.loginEmail.value.trim();
  if (!email) {
    notify("Digite primeiro o e-mail da conta administrativa.", true);
    el.loginEmail.focus();
    return;
  }

  el.forgotPassword.disabled = true;
  el.forgotPassword.textContent = "A enviar...";

  const { error } = await db.auth.resetPasswordForEmail(email, {
    redirectTo: window.location.origin + window.location.pathname
  });

  if (error) {
    console.error(error);
    notify(error.message || "Não foi possível enviar a recuperação.", true);
  } else {
    notify("Foi enviado um link para redefinir a palavra-passe. Veja o seu e-mail.");
  }

  el.forgotPassword.disabled = false;
  el.forgotPassword.textContent = "Esqueci a palavra-passe";
});

el.recoveryForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const password = el.newPassword.value;
  const confirmPassword = el.confirmPassword.value;

  if (password.length < 8) {
    notify("A nova palavra-passe deve ter pelo menos 8 caracteres.", true);
    return;
  }
  if (password !== confirmPassword) {
    notify("As duas palavras-passe não são iguais.", true);
    return;
  }

  el.savePassword.disabled = true;
  el.savePassword.textContent = "A guardar...";
  const { data, error } = await db.auth.updateUser({ password });

  if (error) {
    console.error(error);
    notify(error.message || "Não foi possível alterar a palavra-passe.", true);
  } else {
    notify("Palavra-passe alterada. A abrir o painel...");
    el.newPassword.value = "";
    el.confirmPassword.value = "";
    const { data: sessionData } = await db.auth.getSession();
    await authorize(sessionData?.session ?? (data?.user ? { user: data.user } : null));
  }

  el.savePassword.disabled = false;
  el.savePassword.textContent = "Guardar nova palavra-passe";
});

el.logout.addEventListener("click", async () => {
  await db.auth.signOut();
  showLogin();
  el.loginPassword.value = "";
});

el.files.addEventListener("change", () => {
  const images = Array.from(el.files.files || []).filter((file) => file.type.startsWith("image/"));
  selectedFiles = images.slice(0, 3);
  if (images.length > 3) notify("O limite é 3 imagens do dispositivo. As restantes foram ignoradas.", true);
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
      .toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
    const path = currentUser.id + "/" + crypto.randomUUID() + "." + extension;

    const { error: uploadError } = await db.storage.from(MEDIA_BUCKET).upload(path, file, {
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
    const socialLinks = {
      youtube: readOptionalUrl(el.youtubeLink, "YouTube"),
      facebook: readOptionalUrl(el.facebookLink, "Facebook"),
      tiktok: readOptionalUrl(el.tiktokLink, "TikTok")
    };

    const { error } = await db.from(NEWS_TABLE).insert({
      title,
      body,
      category,
      image_urls: [...uploadedUrls, ...linkedImages],
      video_urls: videoUrls,
      social_links: socialLinks,
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


function normalizeWhatsapp(value) {
  return String(value || "").replace(/[^0-9]/g, "");
}

function validColor(value) {
  return /^#[0-9a-f]{6}$/i.test(value);
}

function renderSettingsPreview() {
  const color = validColor(el.primaryColor.value) ? el.primaryColor.value : "#f2c300";
  el.colorPreview.style.background = color;
  el.colorPreview.style.borderColor = color;
}

function renderProfilePreview(url) {
  el.profilePreview.innerHTML = url && safeUrl(url)
    ? `<img src="${esc(url)}" alt="Foto atual da página">`
    : '<p class="help">Nenhuma foto configurada.</p>';
}

async function loadSiteSettings() {
  if (!el.settingsForm) return;
  const { data, error } = await db
    .from(SETTINGS_TABLE)
    .select("id,primary_color,profile_image_url,whatsapp_number,facebook_url,youtube_url,tiktok_url")
    .eq("id", true)
    .maybeSingle();

  if (error) {
    console.error(error);
    notify("Não foi possível carregar as configurações do portal.", true);
    return;
  }

  siteSettings = data || {
    id: true,
    primary_color: "#f2c300",
    profile_image_url: "",
    whatsapp_number: "",
    facebook_url: "",
    youtube_url: "",
    tiktok_url: ""
  };

  el.primaryColor.value = validColor(siteSettings.primary_color) ? siteSettings.primary_color : "#f2c300";
  el.whatsappNumber.value = siteSettings.whatsapp_number || "";
  el.siteFacebook.value = siteSettings.facebook_url || "";
  el.siteYoutube.value = siteSettings.youtube_url || "";
  el.siteTiktok.value = siteSettings.tiktok_url || "";
  el.profileImageStatus.textContent = siteSettings.profile_image_url
    ? "Foto atual carregada. Escolha outra apenas se quiser substituí-la."
    : "Nenhuma foto configurada.";
  renderProfilePreview(siteSettings.profile_image_url);
  renderSettingsPreview();
}

el.primaryColor?.addEventListener("input", renderSettingsPreview);

el.profileImage?.addEventListener("change", () => {
  selectedProfileFile = el.profileImage.files?.[0] || null;
  if (!selectedProfileFile) {
    el.profileImageStatus.textContent = siteSettings?.profile_image_url
      ? "Foto atual carregada."
      : "Nenhuma foto configurada.";
    return;
  }

  el.profileImageStatus.textContent = selectedProfileFile.name;
  const objectUrl = URL.createObjectURL(selectedProfileFile);
  el.profilePreview.innerHTML = `<img src="${objectUrl}" alt="Pré-visualização da nova foto">`;
  el.profilePreview.querySelector("img").onload = () => URL.revokeObjectURL(objectUrl);
});

async function uploadProfileImage() {
  if (!selectedProfileFile) return siteSettings?.profile_image_url || "";
  if (!currentUser) throw new Error("Sessão administrativa inválida.");

  const extension = (selectedProfileFile.name.split(".").pop() || "jpg")
    .toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
  const path = "site-settings/profile-" + crypto.randomUUID() + "." + extension;

  const { error } = await db.storage.from(MEDIA_BUCKET).upload(path, selectedProfileFile, {
    contentType: selectedProfileFile.type || "image/jpeg",
    cacheControl: "3600",
    upsert: false
  });
  if (error) throw error;

  const { data } = db.storage.from(MEDIA_BUCKET).getPublicUrl(path);
  return data?.publicUrl || "";
}

el.settingsForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!currentUser) {
    notify("Sessão expirada. Entre novamente.", true);
    showLogin();
    return;
  }

  const primaryColor = el.primaryColor.value.trim().toLowerCase();
  if (!validColor(primaryColor)) {
    notify("Escolha uma cor principal válida.", true);
    return;
  }

  const links = [
    ["Facebook", el.siteFacebook],
    ["YouTube", el.siteYoutube],
    ["TikTok", el.siteTiktok]
  ];

  try {
    for (const [label, input] of links) {
      if (input.value.trim() && !safeUrl(input.value.trim())) {
        notify(`${label}: coloque um link válido começando por http:// ou https://.`, true);
        input.focus();
        return;
      }
    }

    el.saveSettings.disabled = true;
    el.saveSettings.textContent = "A guardar...";
    const profileImageUrl = await uploadProfileImage();

    const payload = {
      primary_color: primaryColor,
      profile_image_url: profileImageUrl,
      whatsapp_number: el.whatsappNumber.value.trim(),
      facebook_url: el.siteFacebook.value.trim(),
      youtube_url: el.siteYoutube.value.trim(),
      tiktok_url: el.siteTiktok.value.trim(),
      updated_at: new Date().toISOString(),
      updated_by: currentUser.id
    };

    const { data, error } = await db
      .from(SETTINGS_TABLE)
      .update(payload)
      .eq("id", true)
      .select("id,primary_color,profile_image_url,whatsapp_number,facebook_url,youtube_url,tiktok_url")
      .single();

    if (error) throw error;
    siteSettings = data;
    selectedProfileFile = null;
    el.profileImage.value = "";
    el.profileImageStatus.textContent = data.profile_image_url
      ? "Configuração guardada. A foto está ativa no portal."
      : "Nenhuma foto configurada.";
    renderProfilePreview(data.profile_image_url);
    renderSettingsPreview();
    notify("Configurações do portal guardadas.");
  } catch (error) {
    console.error(error);
    notify(error?.message || "Não foi possível guardar as configurações.", true);
  } finally {
    el.saveSettings.disabled = false;
    el.saveSettings.textContent = "Guardar configurações";
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
  if (!post || !confirm('Apagar “' + post.title + '”?')) return;

  const storedPaths = (Array.isArray(post.image_urls) ? post.image_urls : [])
    .map(storagePathFromPublicUrl).filter(Boolean);

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
  if (event === "PASSWORD_RECOVERY") {
    showPasswordReset();
    return;
  }
  if (event === "SIGNED_OUT") showLogin();
  if (event === "SIGNED_IN" && session?.user && !currentUser) authorize(session);
});

start();
