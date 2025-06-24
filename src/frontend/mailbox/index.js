const mailList = document.getElementById("mailList");
const preview = document.getElementById("preview");
const emailDisplay = document.getElementById("emailDisplay");
const countdownEl = document.getElementById("countdown");
let countdown = 10;
let emailText = "";

function getCookie(name) {
    const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
    return match ? decodeURIComponent(match[2]) : null;
}

function parseJwt(token) {
    try {
        const base64Url = token.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(atob(base64).split('').map(c =>
            '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)
        ).join(''));
        return JSON.parse(jsonPayload);
    } catch {
        return null;
    }
}

function displayEmail() {
    const jwt = getCookie("email_session");
    const payload = parseJwt(jwt);
    if (payload?.email) {
        emailText = payload.email;
        emailDisplay.textContent = payload.email;
    } else {
        window.location.href = "/";
    }
}

function copyEmail() {
    if (!emailText) return;
    navigator.clipboard.writeText(emailText).then(() => {
        displayAlertSuccess("Email copied to clipboard");
    });
}

function deleteEmail() {
    document.cookie = "email_session=; path=/; expires=Thu, 01 Jan 1970 00:00:00 UTC;";
    window.location.href = "/";
}

async function fetchEmails() {
    try {
        const res = await fetch("/api/fetch-emails", { credentials: "include" });
        if (!res.ok) throw new Error("Auth failed or server error");

        const data = await res.json();
        mailList.innerHTML = "";

        if (!Array.isArray(data.emails) || data.emails.length === 0) {
            mailList.innerHTML = "<li class='text-gray-400 italic'>No emails found.</li>";
            return;
        }

        data.emails.forEach(email => {
            const li = document.createElement("li");
            li.className = "cursor-pointer p-3 rounded hover:bg-gray-700 border border-gray-600";
            li.innerHTML = `
            <p class="font-semibold">${email.subject}</p>
            <p class="text-sm text-gray-400">${email.sender}</p>
            <p class="text-xs text-gray-500">${new Date(email.date).toLocaleString()}</p>
          `;
            li.addEventListener("click", () => loadEmail(`/${email.s3Key}`));
            mailList.appendChild(li);
        });
    } catch (err) {
        console.error("Failed to fetch emails:", err);
        mailList.innerHTML = "<li class='text-red-400'>Error loading inbox.</li>";
    }
}

async function loadEmail(url) {
    preview.innerHTML = "<p class='text-gray-500 italic'>Loading...</p>";
    try {
        const res = await fetch(url);
        if (!res.ok) throw displayAlertError("Failed to load email content");
        const html = await res.text();
        preview.innerHTML = html;
    } catch (err) {
        preview.innerHTML = "<p class='text-red-500'>Error loading email content.</p>";
    }
}

function manualRefresh() {
    const icon = document.getElementById("refreshIcon");
    icon.classList.add("animate-spin");

    countdown = 10;
    fetchEmails();

    setTimeout(() => {
        icon.classList.remove("animate-spin");
    }, 1000);
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

function displayAlertError(message) {
    new Noty({
        text: message,
        type: 'error',
        layout: 'bottomRight',
        timeout: 5000,
        theme: 'metroui',
        progressBar: true
    }).show();
}

function displayAlertSuccess(message) {
    new Noty({
        text: message,
        type: 'success',
        layout: 'bottomRight',
        timeout: 5000,
        theme: 'metroui',
        progressBar: true
    }).show();
}

displayEmail();
fetchEmails();
startCountdownLoop();
