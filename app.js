const APP_VERSION = "2.0.0";
const STORAGE_KEY = "product-compare-items-v2";
const THEME_KEY = "product-compare-theme-v1";

const form = document.getElementById("compareForm");
const tbody = document.getElementById("resultBody");
const summary = document.getElementById("summary");
const clearBtn = document.getElementById("clearBtn");
const sampleBtn = document.getElementById("sampleBtn");
const searchInput = document.getElementById("searchInput");
const emptyTemplate = document.getElementById("emptyTemplate");
const themeToggle = document.getElementById("themeToggle");
const themeIconSun = document.getElementById("themeIconSun");
const themeIconMoon = document.getElementById("themeIconMoon");
const themeColorMeta = document.getElementById("themeColorMeta");
const formError = document.getElementById("formError");
const shareMessage = document.getElementById("shareMessage");
const shareLinkBtn = document.getElementById("shareLinkBtn");
const shareImageBtn = document.getElementById("shareImageBtn");
const versionBadge = document.getElementById("versionBadge");
const footerVersion = document.getElementById("footerVersion");
const productInput = document.getElementById("product");
const priceInput = document.getElementById("price");
const amountInput = document.getElementById("amount");

let items = loadItems();
let keyword = "";

if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
        disableServiceWorkerCaching();
    });
}

initTheme();
displayVersion();
hydrateItemsFromUrl();

render();

if (themeToggle) {
    themeToggle.addEventListener("click", () => {
        const currentTheme = document.documentElement.dataset.theme === "dark" ? "dark" : "light";
        const nextTheme = currentTheme === "dark" ? "light" : "dark";
        applyTheme(nextTheme);
    });
}

if (shareLinkBtn) {
    shareLinkBtn.addEventListener("click", onShareLink);
}

if (shareImageBtn) {
    shareImageBtn.addEventListener("click", onShareImage);
}

form.addEventListener("submit", (event) => {
    event.preventDefault();

    hideFormError();

    const payload = new FormData(form);
    const amount = Number(payload.get("amount"));
    const price = Number(payload.get("price"));
    const product = String(payload.get("product") || "").trim();

    const validationError = validateFormInput({ product, price, amount });
    if (validationError) {
        showFormError(validationError.message);
        validationError.input?.focus();
        return;
    }

    const newItem = {
        id: crypto.randomUUID(),
        product,
        price,
        amount,
        unitPrice: computeUnitPrice(price, amount),
    };

    items.unshift(newItem);
    persist();
    form.reset();
    render();
});

clearBtn.addEventListener("click", () => {
    if (!items.length) {
        return;
    }

    const ok = confirm("ต้องการล้างรายการทั้งหมดใช่ไหม?");
    if (!ok) {
        return;
    }

    items = [];
    persist();
    render();
});

sampleBtn.addEventListener("click", () => {
    const sample = [
        makeSample("น้ำดื่ม", 16, 1500),
        makeSample("น้ำดื่ม", 14, 1200),
        makeSample("น้ำดื่ม", 25, 2000),
        makeSample("ข้าวสาร", 145, 5),
        makeSample("ข้าวสาร", 121, 4),
    ];

    items = [...sample, ...items];
    persist();
    render();
});

searchInput.addEventListener("input", (event) => {
    keyword = String(event.target.value || "").trim().toLowerCase();
    render();
});

function makeSample(product, price, amount) {
    return {
        id: crypto.randomUUID(),
        product,
        price,
        amount,
        unitPrice: computeUnitPrice(price, amount),
    };
}

function render() {
    const viewItems = items.filter((item) => {
        if (!keyword) {
            return true;
        }

        const text = `${item.product}`.toLowerCase();
        return text.includes(keyword);
    });

    if (!viewItems.length) {
        tbody.innerHTML = emptyTemplate.innerHTML;
        summary.textContent = "เพิ่มข้อมูลอย่างน้อย 2 รายการเพื่อเปรียบเทียบความคุ้มค่า";
        return;
    }

    const rows = [...viewItems].map((item) => ({
        ...item,
        unitPrice: computeUnitPrice(item.price, item.amount),
    }));

    const bestItem = rows.reduce((best, item) => {
        if (!best || item.unitPrice < best.unitPrice) {
            return item;
        }
        return best;
    }, null);

    const minUnitPrice = bestItem ? bestItem.unitPrice : 0;

    rows.sort((a, b) => {
        return a.unitPrice - b.unitPrice;
    });

    tbody.innerHTML = rows
        .map((item) => {
            const diffPerPack = Math.max(0, (item.unitPrice - minUnitPrice) * item.amount);
            const isBest = Boolean(bestItem && item.id === bestItem.id);

            return `
        <tr class="${isBest ? "result-row-best" : ""}">
                    <td>
            <strong>${escapeHtml(item.product)}</strong>
          </td>
                    <td>${formatCurrency(item.price)}</td>
                    <td>${formatQuantity(item.amount)}</td>
                        <td class="price-unit">${formatCurrency(item.unitPrice)}</td>
                    <td>
            ${isBest
                    ? `<span class="status-text status-best">⭐ คุ้มสุด</span>`
                    : `<span class="status-text status-over">แพงกว่า ${formatCurrency(diffPerPack)}</span>`
                }
          </td>
                    <td>
                        <button class="delete-btn" type="button" data-id="${item.id}">ลบ</button>
          </td>
        </tr>
      `;
        })
        .join("");

    tbody.querySelectorAll("button[data-id]").forEach((button) => {
        button.addEventListener("click", () => {
            const { id } = button.dataset;
            items = items.filter((item) => item.id !== id);
            persist();
            render();
        });
    });

    summary.textContent = `รวม ${viewItems.length} รายการ | ต่ำสุด ${formatCurrency(minUnitPrice)}/หน่วย | อัปเดต ${new Date().toLocaleTimeString("th-TH")}`;
}

function persist() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

function loadItems() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        const parsed = raw ? JSON.parse(raw) : [];
        if (!Array.isArray(parsed)) {
            return [];
        }

        // Keep only the fields the table really needs.
        return parsed
            .filter((item) => item && typeof item === "object")
            .map((item) => {
                const price = Number(item.price);
                const amount = Number(item.amount);
                const unitPrice = computeUnitPrice(price, amount);

                return {
                    id: String(item.id || crypto.randomUUID()),
                    product: String(item.product || "").trim(),
                    price,
                    amount,
                    unitPrice,
                };
            })
            .filter((item) => item.product && Number.isFinite(item.price) && item.price > 0 && Number.isFinite(item.amount) && item.amount > 0 && Number.isFinite(item.unitPrice));
    } catch {
        return [];
    }
}

function formatCurrency(value) {
    return new Intl.NumberFormat("th-TH", {
        style: "currency",
        currency: "THB",
        maximumFractionDigits: 2,
    }).format(value);
}

function computeUnitPrice(price, amount) {
    if (!Number.isFinite(price) || !Number.isFinite(amount) || amount <= 0) {
        return 0;
    }

    return price / amount;
}

function validateFormInput({ product, price, amount }) {
    if (!product) {
        return { message: "กรุณากรอกชื่อสินค้า", input: productInput };
    }

    if (!Number.isFinite(price) || price <= 0) {
        return { message: "กรุณากรอกราคาเป็นตัวเลขมากกว่า 0", input: priceInput };
    }

    if (!Number.isFinite(amount) || amount <= 0) {
        return { message: "กรุณากรอกปริมาณเป็นตัวเลขมากกว่า 0", input: amountInput };
    }

    return null;
}

function showFormError(message) {
    if (!formError) {
        return;
    }

    formError.hidden = false;
    formError.textContent = message;
}

function hideFormError() {
    if (!formError) {
        return;
    }

    formError.hidden = true;
    formError.textContent = "";
}

async function onShareLink() {
    if (!items.length) {
        setShareMessage("ยังไม่มีรายการสำหรับแชร์");
        return;
    }

    try {
        const shareUrl = buildShareUrl(items);

        if (navigator.share) {
            await navigator.share({
                title: "ProductCompare",
                text: "เปรียบเทียบราคาสินค้าของฉัน",
                url: shareUrl,
            });
            setShareMessage("แชร์ลิงก์เรียบร้อยแล้ว");
            return;
        }

        await navigator.clipboard.writeText(shareUrl);
        setShareMessage("คัดลอกลิงก์แล้ว");
    } catch {
        setShareMessage("แชร์ลิงก์ไม่สำเร็จ ลองใหม่อีกครั้ง");
    }
}

async function onShareImage() {
    if (!items.length) {
        setShareMessage("ยังไม่มีรายการสำหรับแชร์");
        return;
    }

    try {
        await waitForCanvasFonts();
        const rows = getSortedRowsForShare();
        const imageBlob = await generateComparisonImage(rows);

        if (navigator.share && navigator.canShare) {
            const file = new File([imageBlob], "product-compare.png", { type: "image/png" });
            if (navigator.canShare({ files: [file] })) {
                await navigator.share({
                    title: "ProductCompare",
                    text: "ผลเปรียบเทียบราคาสินค้า",
                    files: [file],
                });
                setShareMessage("แชร์รูปเรียบร้อยแล้ว");
                return;
            }
        }

        downloadBlob(imageBlob, `product-compare-${Date.now()}.png`);
        setShareMessage("ดาวน์โหลดรูปเรียบร้อยแล้ว");
    } catch {
        setShareMessage("สร้างรูปสำหรับแชร์ไม่สำเร็จ");
    }
}

async function waitForCanvasFonts() {
    if (!document.fonts || !document.fonts.ready) {
        return;
    }

    try {
        await document.fonts.ready;
    } catch {
        // Continue with fallback font if font loading fails.
    }
}

function getSortedRowsForShare() {
    return [...items]
        .map((item) => ({
            ...item,
            unitPrice: computeUnitPrice(item.price, item.amount),
        }))
        .sort((a, b) => a.unitPrice - b.unitPrice)
        .slice(0, 12);
}

function generateComparisonImage(rows) {
    const width = 1080;
    const rowHeight = 64;
    const topPadding = 36;
    const tableHeaderHeight = 54;
    const footerHeight = 64;
    const bottomPadding = 18;
    const height = topPadding + tableHeaderHeight + rows.length * rowHeight + bottomPadding + footerHeight;
    const best = rows[0] || null;

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext("2d");
    if (!ctx) {
        throw new Error("Canvas not available");
    }

    ctx.fillStyle = "#fff4ec";
    ctx.fillRect(0, 0, width, height);
    ctx.textBaseline = "top";

    ctx.fillStyle = "#fddcc4";
    ctx.fillRect(40, topPadding, width - 80, tableHeaderHeight);

    const tableTop = topPadding + 14;
    ctx.fillStyle = "#6a5047";
    ctx.font = "700 22px 'Noto Sans Thai', sans-serif";
    ctx.fillText("สินค้า", 64, tableTop);
    ctx.fillText("ราคา", 500, tableTop);
    ctx.fillText("จำนวน", 645, tableTop);
    ctx.fillText("บาท/หน่วย", 785, tableTop);

    const rowsTop = topPadding + tableHeaderHeight;

    rows.forEach((item, index) => {
        const rowTop = rowsTop + index * rowHeight;
        const y = rowTop + 18;
        const isBest = Boolean(best && item.id === best.id);

        if (isBest) {
            ctx.fillStyle = "#ffe9d8";
            ctx.fillRect(50, rowTop + 4, width - 100, rowHeight - 8);
        }

        ctx.fillStyle = "#3c2c26";
        ctx.font = "600 24px 'Noto Sans Thai', sans-serif";
        ctx.fillText(clampText(ctx, item.product, 28), 64, y);

        ctx.font = "500 22px 'Noto Sans Thai', sans-serif";
        ctx.fillText(formatCurrency(item.price), 500, y);
        ctx.fillText(formatQuantity(item.amount), 645, y);
        ctx.fillText(formatCurrency(item.unitPrice), 785, y);

        if (isBest) {
            ctx.fillStyle = "#9a5d3f";
            ctx.font = "700 20px 'Noto Sans Thai', sans-serif";
            ctx.fillText("คุ้มสุด", 955, y + 2);
        }
    });

    ctx.fillStyle = "#6a5047";
    ctx.font = "500 19px 'Noto Sans Thai', sans-serif";
    ctx.fillText(`อัปเดต ${new Date().toLocaleString("th-TH")}`, 64, height - 38);

    return new Promise((resolve, reject) => {
        canvas.toBlob((blob) => {
            if (!blob) {
                reject(new Error("Unable to create blob"));
                return;
            }

            resolve(blob);
        }, "image/png");
    });
}

function clampText(ctx, text, maxChars) {
    const value = String(text || "");
    if (value.length <= maxChars) {
        return value;
    }

    const trimmed = `${value.slice(0, Math.max(0, maxChars - 1))}…`;
    while (ctx.measureText(trimmed).width > 410) {
        return `${value.slice(0, Math.max(0, maxChars - 5))}…`;
    }

    return trimmed;
}

function downloadBlob(blob, filename) {
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
}

function buildShareUrl(sourceItems) {
    const payload = sourceItems.map((item) => ({
        product: String(item.product || "").trim(),
        price: Number(item.price),
        amount: Number(item.amount),
    }));

    const encoded = encodeForUrl(JSON.stringify(payload));
    const shareUrl = new URL(window.location.href);
    shareUrl.searchParams.set("data", encoded);
    return shareUrl.toString();
}

function hydrateItemsFromUrl() {
    try {
        const params = new URLSearchParams(window.location.search);
        const raw = params.get("data");
        if (!raw) {
            return;
        }

        const decoded = decodeFromUrl(raw);
        const parsed = JSON.parse(decoded);
        if (!Array.isArray(parsed) || !parsed.length) {
            return;
        }

        const imported = parsed
            .map((item) => {
                const product = String(item.product || "").trim();
                const price = Number(item.price);
                const amount = Number(item.amount);
                const unitPrice = computeUnitPrice(price, amount);

                return {
                    id: crypto.randomUUID(),
                    product,
                    price,
                    amount,
                    unitPrice,
                };
            })
            .filter((item) => item.product && item.price > 0 && item.amount > 0);

        if (!imported.length) {
            return;
        }

        items = imported;
        persist();
        setShareMessage("โหลดรายการจากลิงก์เรียบร้อยแล้ว");

        const cleanUrl = new URL(window.location.href);
        cleanUrl.searchParams.delete("data");
        history.replaceState(null, "", cleanUrl.toString());
    } catch {
        setShareMessage("ลิงก์ที่เปิดมาไม่ถูกต้อง");
    }
}

function encodeForUrl(value) {
    return btoa(unescape(encodeURIComponent(value)));
}

function decodeFromUrl(value) {
    return decodeURIComponent(escape(atob(value)));
}

function setShareMessage(message) {
    if (!shareMessage) {
        return;
    }

    shareMessage.hidden = false;
    shareMessage.textContent = message;
}

function formatQuantity(amount) {
    return new Intl.NumberFormat("th-TH", {
        maximumFractionDigits: 2,
    }).format(amount);
}

function escapeHtml(text) {
    const map = {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;",
    };

    return String(text).replace(/[&<>"']/g, (m) => map[m]);
}

function initTheme() {
    const savedTheme = localStorage.getItem(THEME_KEY);

    if (savedTheme === "light" || savedTheme === "dark") {
        applyTheme(savedTheme);
        return;
    }

    const prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
    applyTheme(prefersDark ? "dark" : "light", false);
}

function applyTheme(theme, shouldPersist = true) {
    document.documentElement.dataset.theme = theme;

    if (shouldPersist) {
        localStorage.setItem(THEME_KEY, theme);
    }

    const isDark = theme === "dark";

    if (themeToggle) {
        themeToggle.setAttribute("aria-pressed", String(isDark));
    }

    if (themeIconSun && themeIconMoon) {
        themeIconSun.style.display = isDark ? "none" : "inline-block";
        themeIconMoon.style.display = isDark ? "inline-block" : "none";
    }

    if (themeColorMeta) {
        themeColorMeta.setAttribute("content", isDark ? "#241d1a" : "#FFDCDC");
    }
}

async function disableServiceWorkerCaching() {
    try {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(registrations.map((registration) => registration.unregister()));
    } catch {
        // Ignore cleanup failure to avoid impacting normal app usage.
    }

    if (!window.caches) {
        return;
    }

    try {
        const keys = await caches.keys();
        await Promise.all(keys.map((key) => caches.delete(key)));
    } catch {
        // Ignore cleanup failure to avoid impacting normal app usage.
    }
}

function displayVersion() {
    const label = `v${APP_VERSION}`;
    if (versionBadge) versionBadge.textContent = label;
    if (footerVersion) footerVersion.textContent = label;
}
