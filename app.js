const STORAGE_KEY = "product-compare-simple-rows-v1";
const MIN_ROWS = 2;

const rowsContainer = document.getElementById("rowsContainer");
const resultsContainer = document.getElementById("resultsContainer");
const errorMessage = document.getElementById("errorMessage");
const addRowBtn = document.getElementById("addRowBtn");
const clearScreenBtn = document.getElementById("clearScreenBtn");

let rows = loadRows();
let lastBestRowId = null;

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
    renderResults();
    renderErrorHint();
});

rowsContainer.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
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
    renderResults();
    renderErrorHint();
    persistRows();
}

function renderRows() {
    const header = `
        <div class="row-header" aria-hidden="true">
            <span>ชื่อ</span>
            <span>ปริมาณ</span>
            <span>ราคา</span>
        </div>
    `;

    const body = rows
        .map((row) => {
            const disableDelete = rows.length <= MIN_ROWS;

            return `
                <article class="item-row">
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
                </article>
            `;
        })
        .join("");

    rowsContainer.innerHTML = `${header}${body}`;
}

function getValidRows() {
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
        .filter(Boolean)
        .sort((a, b) => a.unitPrice - b.unitPrice);
}

function renderResults() {
    const validRows = getValidRows();

    if (!validRows.length) {
        lastBestRowId = null;
        resultsContainer.innerHTML = '<p class="result-empty">กรอกข้อมูลอย่างน้อย 1 รายการเพื่อเริ่มคำนวณ</p>';
        return;
    }

    const cheapest = validRows[0];
    const shouldAnimateBest = Boolean(lastBestRowId && cheapest.id !== lastBestRowId);

    resultsContainer.innerHTML = validRows
        .map((item, index) => {
            const rank = index + 1;
            const isBest = rank === 1;
            const diffPerPack = Math.max(0, (item.unitPrice - cheapest.unitPrice) * item.amount);
            const diffPercent = cheapest.unitPrice > 0 ? ((item.unitPrice - cheapest.unitPrice) / cheapest.unitPrice) * 100 : 0;

            return `
                <article class="result-card ${isBest ? "rank-1" : "rank-2"} ${isBest && shouldAnimateBest ? "best-flash" : ""}">
                    <span class="result-badge">${isBest ? "อันดับ 1 ถูกที่สุด" : `อันดับ ${rank}`}</span>
                    <h3 class="result-name">${escapeHtml(item.name)}</h3>
                    <p class="result-meta">ราคา ${formatCurrency(item.price)} | ปริมาณ ${formatNumber(item.amount)}</p>
                    <p class="result-unit">${formatCurrency(item.unitPrice)} / หน่วย</p>
                    ${isBest
                        ? ""
                        : `<p class="result-diff">แพงกว่า ${formatCurrency(diffPerPack)} ต่อแพ็ก (${formatNumber(diffPercent)}%)</p>`
                    }
                </article>
            `;
        })
        .join("");

    lastBestRowId = cheapest.id;
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
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        const parsed = raw ? JSON.parse(raw) : [];

        if (!Array.isArray(parsed)) {
            return [createRow(), createRow()];
        }

        const normalized = parsed
            .filter((item) => item && typeof item === "object")
            .map((item) => ({
                id: String(item.id || crypto.randomUUID()),
                name: String(item.name || ""),
                amount: String(item.amount || ""),
                price: String(item.price || ""),
            }));

        while (normalized.length < MIN_ROWS) {
            normalized.push(createRow());
        }

        return normalized;
    } catch {
        return [createRow(), createRow()];
    }
}

function persistRows() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(rows));
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
