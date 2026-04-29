const STORAGE_KEY = "product-compare-simple-rows-v1";
const MIN_ROWS = 2;

const rowsContainer = document.getElementById("rowsContainer");
const errorMessage = document.getElementById("errorMessage");
const addRowBtn = document.getElementById("addRowBtn");
const clearScreenBtn = document.getElementById("clearScreenBtn");

let rows = loadRows();
let lastBestRowId = null;

// Always start fresh on a new page load; remove previously persisted rows.
try {
    localStorage.removeItem(STORAGE_KEY);
} catch {
    // Ignore storage errors and continue with in-memory rows.
}

renderAll();

addRowBtn.addEventListener("click", () => {
    rows.push(createRow());
    renderAll();

    const last = rows[rows.length - 1];
    const input = document.querySelector(`[data-id="${last.id}"][data-field="name"]`);
    if (input) {
        input.focus();
    }
});

clearScreenBtn.addEventListener("click", () => {
    rows = [createRow(), createRow()];
    lastBestRowId = null;
    renderAll();

    const input = document.querySelector('[data-field="name"]');
    if (input) {
        input.focus();
    }
});

rowsContainer.addEventListener("input", (event) => {
    const input = event.target;
    if (!(input instanceof HTMLInputElement)) {
        return;
    }

    const id = String(input.dataset.id || "");
    const field = String(input.dataset.field || "");
    if (!id || !field) {
        return;
    }

    rows = rows.map((row) => {
        if (row.id !== id) {
            return row;
        }

        return {
            ...row,
            [field]: input.value,
        };
    });

    persistRows();
    updateHighlights();
    renderErrorHint();
});

rowsContainer.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof Element)) {
        return;
    }

    const deleteBtn = target.closest("button[data-delete-id]");
    if (!(deleteBtn instanceof HTMLButtonElement)) {
        return;
    }

    if (rows.length <= MIN_ROWS) {
        return;
    }

    const rowId = String(deleteBtn.dataset.deleteId || "");
    if (!rowId) {
        return;
    }

    rows = rows.filter((row) => row.id !== rowId);
    renderAll();
});

function createRow() {
    return {
        id: crypto.randomUUID(),
        name: "",
        amount: "",
        price: "",
    };
}

function renderAll() {
    renderRows();
    updateHighlights();
    renderErrorHint();
    persistRows();
}

function renderRows() {
    const header = `
        <div class="row-header" aria-hidden="true">
            <span>ชื่อ</span>
            <span>ปริมาณ</span>
            <span>ราคา</span>
            <span></span>
        </div>
    `;

    const body = rows
        .map((row) => {
            const disableDelete = rows.length <= MIN_ROWS;

            return `
                <article class="item-row" data-card-id="${row.id}">
                    <div class="row-fields">
                        <div class="field">
                            <input
                                id="name-${row.id}"
                                type="text"
                                inputmode="text"
                                aria-label="ชื่อสินค้า"
                                placeholder="เช่น นม"
                                data-id="${row.id}"
                                data-field="name"
                                value="${escapeHtml(row.name)}"
                            />
                        </div>
                        <div class="field">
                            <input
                                id="amount-${row.id}"
                                type="number"
                                inputmode="decimal"
                                aria-label="ปริมาณ"
                                min="0.01"
                                step="0.01"
                                placeholder="1200"
                                data-id="${row.id}"
                                data-field="amount"
                                value="${escapeHtml(row.amount)}"
                            />
                        </div>
                        <div class="field">
                            <input
                                id="price-${row.id}"
                                type="number"
                                inputmode="decimal"
                                aria-label="ราคา"
                                min="0.01"
                                step="0.01"
                                placeholder="45"
                                data-id="${row.id}"
                                data-field="price"
                                value="${escapeHtml(row.price)}"
                            />
                        </div>
                    </div>
                    <button
                        class="row-delete-btn"
                        type="button"
                        aria-label="ลบรายการนี้"
                        title="ลบรายการนี้"
                        data-delete-id="${row.id}"
                        ${disableDelete ? "disabled" : ""}
                    >
                        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                            <path fill-rule="evenodd" d="M9 3a1 1 0 0 0-.894.553L7.382 5H4a1 1 0 1 0 0 2h.293l.88 12.332A2 2 0 0 0 7.168 21h9.664a2 2 0 0 0 1.995-1.668L19.707 7H20a1 1 0 1 0 0-2h-3.382l-.724-1.447A1 1 0 0 0 15 3H9zm2 6a1 1 0 1 0-2 0v8a1 1 0 1 0 2 0V9zm4 0a1 1 0 1 0-2 0v8a1 1 0 1 0 2 0V9z" clip-rule="evenodd" />
                        </svg>
                    </button>
                    <div class="row-unit-price" data-unit-id="${row.id}"></div>
                </article>
            `;
        })
        .join("");

    rowsContainer.innerHTML = `${header}${body}`;
}

function getValidEntries() {
    return rows
        .map((row) => {
            const name = String(row.name || "").trim();
            const amount = Number(row.amount);
            const price = Number(row.price);

            if (!name || !Number.isFinite(amount) || !Number.isFinite(price) || amount <= 0 || price <= 0) {
                return null;
            }

            return {
                id: row.id,
                name,
                amount,
                price,
                unitPrice: price / amount,
            };
        })
        .filter(Boolean);
}

function updateHighlights() {
    const entries = getValidEntries();

    // Find cheapest
    let cheapest = null;
    for (const entry of entries) {
        if (!cheapest || entry.unitPrice < cheapest.unitPrice) {
            cheapest = entry;
        }
    }

    const shouldAnimate = entries.length >= 2 && cheapest && lastBestRowId && cheapest.id !== lastBestRowId;

    // Update each row
    for (const row of rows) {
        const card = document.querySelector(`[data-card-id="${row.id}"]`);
        const unitEl = document.querySelector(`[data-unit-id="${row.id}"]`);
        if (!card || !unitEl) continue;

        const entry = entries.find((e) => e.id === row.id);
        const isCheapest = cheapest && entries.length >= 2 && entry && entry.id === cheapest.id;

        // Toggle highlight class
        card.classList.toggle("is-cheapest", Boolean(isCheapest));
        card.classList.remove("best-flash");
        if (isCheapest && shouldAnimate) {
            void card.offsetWidth;
            card.classList.add("best-flash");
        }

        // Show unit price
        if (entry) {
            const diff = cheapest && entry.id !== cheapest.id
                ? `<span class="row-diff">+${formatCurrency((entry.unitPrice - cheapest.unitPrice) * entry.amount)}</span>`
                : "";
            unitEl.innerHTML = `<span class="row-unit-label">ต่อหน่วย</span> <span class="row-unit-value">${formatCurrency(entry.unitPrice)}</span>${diff}`;
            unitEl.classList.add("visible");
        } else {
            unitEl.innerHTML = "";
            unitEl.classList.remove("visible");
        }
    }

    if (cheapest) {
        lastBestRowId = cheapest.id;
    }
}

function renderErrorHint() {
    const invalidRows = rows.filter((row) => {
        const hasAnyValue = String(row.name || "").trim() || String(row.amount || "").trim() || String(row.price || "").trim();
        if (!hasAnyValue) {
            return false;
        }

        const amount = Number(row.amount);
        const price = Number(row.price);
        return !String(row.name || "").trim() || !Number.isFinite(amount) || !Number.isFinite(price) || amount <= 0 || price <= 0;
    });

    if (!invalidRows.length) {
        errorMessage.hidden = true;
        errorMessage.textContent = "";
        return;
    }

    errorMessage.hidden = false;
    errorMessage.textContent = "บางรายการยังไม่ครบ: ชื่อ, ปริมาณ (>0), ราคา (>0)";
}

function loadRows() {
    return [createRow(), createRow()];
}

function persistRows() {
    // Intentionally no-op: do not persist product rows across page loads.
}

function formatCurrency(value) {
    return new Intl.NumberFormat("th-TH", {
        style: "currency",
        currency: "THB",
        maximumFractionDigits: 2,
    }).format(value);
}

function formatNumber(value) {
    return new Intl.NumberFormat("th-TH", {
        maximumFractionDigits: 2,
    }).format(value);
}

function escapeHtml(value) {
    const map = {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;",
    };

    return String(value).replace(/[&<>"']/g, (char) => map[char]);
}

// ── Theme switcher ──
const THEMES = ["warm", "ocean", "forest", "berry", "midnight"];

function initTheme() {
    document.documentElement.setAttribute("data-theme", THEMES[0]);
}

initTheme();

const themeBtn = document.getElementById("themeBtn");
if (themeBtn) {
    themeBtn.addEventListener("click", () => {
        const current = document.documentElement.getAttribute("data-theme") || THEMES[0];
        const nextIndex = (THEMES.indexOf(current) + 1) % THEMES.length;
        const next = THEMES[nextIndex];

        document.documentElement.setAttribute("data-theme", next);

        themeBtn.classList.remove("spin");
        void themeBtn.offsetWidth;
        themeBtn.classList.add("spin");
    });
}
