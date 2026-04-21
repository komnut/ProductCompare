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
const themeColorMeta = document.getElementById("themeColorMeta");

let items = loadItems();
let keyword = "";

if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
        disableServiceWorkerCaching();
    });
}

initTheme();

render();

if (themeToggle) {
    themeToggle.addEventListener("click", () => {
        const currentTheme = document.documentElement.dataset.theme === "dark" ? "dark" : "light";
        const nextTheme = currentTheme === "dark" ? "light" : "dark";
        applyTheme(nextTheme);
    });
}

form.addEventListener("submit", (event) => {
    event.preventDefault();

    const payload = new FormData(form);
    const amount = Number(payload.get("amount"));
    const price = Number(payload.get("price"));

    const newItem = {
        id: crypto.randomUUID(),
        product: String(payload.get("product")).trim(),
        price,
        amount,
        unitPrice: Number((price / amount).toFixed(4)),
    };

    if (!newItem.product || !Number.isFinite(newItem.price) || newItem.price <= 0 || !Number.isFinite(newItem.amount) || newItem.amount <= 0) {
        alert("กรอกข้อมูล ชื่อสินค้า ราคา และปริมาณ ให้ถูกต้อง");
        return;
    }

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
        unitPrice: Number((price / amount).toFixed(4)),
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

    const bestItem = viewItems.reduce((best, item) => {
        if (!best || item.unitPrice < best.unitPrice) {
            return item;
        }
        return best;
    }, null);

    const minUnitPrice = bestItem ? bestItem.unitPrice : 0;

    const rows = [...viewItems].sort((a, b) => {
        return a.unitPrice - b.unitPrice;
    });

    tbody.innerHTML = rows
        .map((item) => {
            const diffPerPack = Math.max(0, (item.unitPrice - minUnitPrice) * item.amount);
            const isBest = Boolean(bestItem && item.id === bestItem.id);

            return `
        <tr>
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
                        <button class="btn btn-outline-danger btn-sm delete-btn" type="button" data-id="${item.id}">ลบ</button>
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
                const unitPrice = Number.isFinite(Number(item.unitPrice))
                    ? Number(item.unitPrice)
                    : Number((price / amount).toFixed(4));

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
    document.documentElement.setAttribute("data-bs-theme", theme);

    if (shouldPersist) {
        localStorage.setItem(THEME_KEY, theme);
    }

    const isDark = theme === "dark";

    if (themeToggle) {
        themeToggle.textContent = isDark ? "โหมดสว่าง" : "โหมดมืด";
        themeToggle.setAttribute("aria-pressed", String(isDark));
    }

    if (themeColorMeta) {
        themeColorMeta.setAttribute("content", isDark ? "#2f2521" : "#FFDCDC");
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
