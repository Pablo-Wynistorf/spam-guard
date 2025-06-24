/* global Noty */

const mailList       = document.getElementById("mailList");
const preview        = document.getElementById("preview");
const emailDisplay   = document.getElementById("emailDisplay");
const countdownEl    = document.getElementById("countdown");

let countdown  = 10;
let emailText  = "";

/* ───────────────────────────────── COOKIES & JWT ───────────────────────────── */

function getCookie(name) {
  const match = document.cookie.match(new RegExp(`(?:^| )${name}=([^;]+)`));
  return match ? decodeURIComponent(match[1]) : null;
}

function parseJwt(token) {
  try {
    const [, base64Url] = token.split(".");
    const base64        = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const jsonPayload   = decodeURIComponent(atob(base64).split("").map(c =>
      "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2)
    ).join(""));
    return JSON.parse(jsonPayload);
  } catch { return null; }
}

function displayEmail() {
  const jwt     = getCookie("email_session");
  const payload = parseJwt(jwt);
  if (payload?.email) {
    emailText            = payload.email;
    emailDisplay.textContent = payload.email;
  } else {
    window.location.href = "/";
  }
}

/* ─────────────────────────────────── UTIL ─────────────────────────────────── */

function copyEmail() {
  if (!emailText) return;
  navigator.clipboard.writeText(emailText).then(() =>
    alertSuccess("Email copied to clipboard")
  );
}

function deleteEmail() {
  document.cookie = "email_session=; path=/; expires=Thu, 01 Jan 1970 00:00:00 UTC;";
  window.location.href = "/";
}

/* ─────────────────────────────────── FETCHERS ─────────────────────────────── */

async function fetchEmails() {
  try {
    const res = await fetch("/api/fetch-emails", { credentials: "include" });
    if (!res.ok) throw new Error("Auth failed or server error");

    const { emails } = await res.json();
    mailList.innerHTML = ""; // clear

    if (!Array.isArray(emails) || emails.length === 0) {
      mailList.innerHTML =
        "<li class='text-gray-400 italic py-3 text-center'>No emails found.</li>";
      return;
    }

    emails.forEach((email, idx) => {
      const li = document.createElement("li");
      li.className = [
        "group",
        "cursor-pointer",
        "rounded-xl",
        "border",
        "border-gray-700",
        "p-4",
        "flex",
        "items-start",
        "gap-3",
        "transition-colors",
        "even:bg-gray-800",
        "odd:bg-gray-900",
        "hover:border-yellow-500",
        "hover:bg-gray-700",
        "active:bg-gray-600"
      ].join(" ");

      const formattedDate = new Date(email.date).toLocaleString(undefined, {
        dateStyle: "short",
        timeStyle: "short"
      });

      li.innerHTML = `
        <!-- Icon -->
        <div class="flex-shrink-0 pt-0.5">
          <svg xmlns="http://www.w3.org/2000/svg"
               class="w-5 h-5 text-yellow-400 group-hover:text-yellow-300"
               viewBox="0 0 24 24" fill="none"
               stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M22 12h-2" /><path d="M14 12H2" />
            <path d="M22 12v6a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6
                     a2 2 0 0 1 2-2h6l2 2h8a2 2 0 0 1 2 2z"/>
          </svg>
        </div>

        <!-- Texts -->
        <div class="flex flex-col overflow-hidden">
          <p class="font-semibold text-gray-100 truncate max-w-[14rem] sm:max-w-[18rem]">
            ${email.subject || "(no subject)"}
          </p>
          <p class="text-sm text-gray-400 truncate max-w-[14rem] sm:max-w-[18rem]">
            ${email.sender}
          </p>
        </div>

        <!-- Date -->
        <span class="ml-auto text-xs text-gray-500 whitespace-nowrap">
          ${formattedDate}
        </span>
      `;

      li.addEventListener("click", () => loadEmail(`/${email.s3Key}`));
      mailList.appendChild(li);
    });
  } catch (err) {
    console.error("Failed to fetch emails:", err);
    mailList.innerHTML = "<li class='text-red-400 py-3 text-center'>Error loading inbox.</li>";
  }
}

async function loadEmail(url) {
  preview.innerHTML = "<p class='text-gray-500 italic'>Loading…</p>";
  try {
    const res = await fetch(url);
    if (!res.ok) throw Error("Failed to load email content");
    const html = await res.text();
    preview.innerHTML = html;
  } catch {
    preview.innerHTML = "<p class='text-red-500'>Error loading email content.</p>";
  }
}

/* ─────────────────────────── REFRESH & COUNTDOWN ─────────────────────────── */

function manualRefresh() {
  const icon = document.getElementById("refreshIcon");
  icon.classList.add("animate-spin");
  countdown = 10;
  fetchEmails();
  setTimeout(() => icon.classList.remove("animate-spin"), 900);
}

function startCountdownLoop() {
  setInterval(() => {
    countdown--;
    if (countdown <= 0) {
      fetchEmails();
      countdown = 10;
    }
    countdownEl.textContent = `Refreshing in ${countdown}s`;
  }, 1000);
}

/* ───────────────────────────────── NOTY HELPERS ──────────────────────────── */

function alertError(message) {
  new Noty({ text: message, type: "error",
             layout: "bottomRight", timeout: 5000,
             theme: "metroui", progressBar: true }).show();
}
function alertSuccess(message) {
  new Noty({ text: message, type: "success",
             layout: "bottomRight", timeout: 5000,
             theme: "metroui", progressBar: true }).show();
}

/* ─────────────────────────────── INIT ────────────────────────────────────── */

displayEmail();
fetchEmails();
startCountdownLoop();
