const items = [];
const byId = id => document.getElementById(id);
let db;
let firestore;
let currentInvoiceId = null;

byId("invDate").innerText = new Date().toLocaleDateString("en-GB");
byId("addItem").addEventListener("click", addRow);
byId("clearSignature").addEventListener("click", clearSignature);
byId("savedInvoices").addEventListener("change", loadSelectedInvoice);
byId("saveInvoice").addEventListener("click", saveNewInvoice);
byId("updateInvoice").addEventListener("click", updateSelectedInvoice);
byId("deleteInvoice").addEventListener("click", deleteSelectedInvoice);

function setStatus(message) {
    byId("storageStatus").textContent = message;
}

function addRow() {
    const name = byId("pName").value.trim();
    const serial = byId("pSerial").value.trim() || "-";
    const qty = Number(byId("pQty").value);
    const rate = Number(byId("pRate").value);

    if (!name || !Number.isInteger(qty) || qty <= 0 || !Number.isFinite(rate) || rate < 0) {
        alert("Please enter a Product, a positive whole-number Qty and a valid Rate");
        return;
    }

    items.push({ name, serial, qty, rate });
    ["pName", "pSerial", "pQty", "pRate"].forEach(id => { byId(id).value = ""; });
    renderItems();
}

function renderItems() {
    const tbody = byId("tableBody");
    tbody.replaceChildren();
    let subtotal = 0;
    let totalQty = 0;

    items.forEach((item, index) => {
        const total = item.qty * item.rate;
        subtotal += total;
        totalQty += item.qty;
        const row = document.createElement("tr");
        [
            { value: String(index + 1), className: "center-text" },
            { value: item.name },
            { value: item.serial, className: "center-text" },
            { value: String(item.qty), className: "center-text" },
            { value: item.rate.toFixed(2), className: "right-text" },
            { value: total.toFixed(2), className: "right-text" }
        ].forEach(cell => {
            const td = document.createElement("td");
            td.textContent = cell.value;
            if (cell.className) td.className = cell.className;
            row.appendChild(td);
        });
        tbody.appendChild(row);
    });

    const tax = subtotal * 0.09;
    const grand = Math.round(subtotal + tax * 2);
    byId("totalQty").innerText = String(totalQty);
    byId("subtotal").innerText = subtotal.toFixed(2);
    byId("amountVal").innerText = subtotal.toFixed(2);
    byId("sgstVal").innerText = tax.toFixed(2);
    byId("cgstVal").innerText = tax.toFixed(2);
    byId("grandVal").innerText = grand.toFixed(2);
    byId("words").innerText = `${numberToWords(grand) || "ZERO"} RUPEES ONLY`;
}

function numberToWords(num) {
    const ones = ["", "ONE ", "TWO ", "THREE ", "FOUR ", "FIVE ", "SIX ", "SEVEN ", "EIGHT ", "NINE ", "TEN ", "ELEVEN ", "TWELVE ", "THIRTEEN ", "FOURTEEN ", "FIFTEEN ", "SIXTEEN ", "SEVENTEEN ", "EIGHTEEN ", "NINETEEN "];
    const tens = ["", "", "TWENTY", "THIRTY", "FORTY", "FIFTY", "SIXTY", "SEVENTY", "EIGHTY", "NINETY"];
    const groups = String(num).padStart(9, "0").slice(-9).match(/^(\d{2})(\d{2})(\d{2})(\d)(\d{2})$/);
    if (!groups) return "";
    const twoDigits = value => ones[Number(value)] || `${tens[Number(value[0])]} ${ones[Number(value[1])]}`;
    let words = "";
    if (groups[1] !== "00") words += `${twoDigits(groups[1])}CRORE `;
    if (groups[2] !== "00") words += `${twoDigits(groups[2])}LAKH `;
    if (groups[3] !== "00") words += `${twoDigits(groups[3])}THOUSAND `;
    if (groups[4] !== "0") words += `${ones[Number(groups[4])]}HUNDRED `;
    if (groups[5] !== "00") words += twoDigits(groups[5]);
    return words.trim();
}

function clearSignature() {
    byId("sig-canvas").style.visibility = "hidden";
}

function invoiceDataFromForm() {
    const invoiceNumber = byId("invNo").innerText.trim();
    const invoiceDate = byId("invDate").innerText.trim();
    if (!invoiceNumber || !invoiceDate) {
        throw new Error("Invoice number and date are required.");
    }
    return {
        invoiceNumber,
        invoiceDate,
        customerDetails: byId("customerDetails").innerText,
        items: items.map(item => ({ ...item })),
        updatedAt: firestore.serverTimestamp()
    };
}

function invoiceFromDocument(data) {
    if (!data || !Array.isArray(data.items)) {
        throw new Error("The selected Firestore document is not a valid invoice.");
    }
    const savedItems = data.items.map(item => {
        if (!item || typeof item.name !== "string" || typeof item.serial !== "string" ||
            !Number.isInteger(item.qty) || item.qty <= 0 ||
            typeof item.rate !== "number" || !Number.isFinite(item.rate) || item.rate < 0) {
            throw new Error("The selected Firestore document contains invalid invoice items.");
        }
        return { name: item.name, serial: item.serial, qty: item.qty, rate: item.rate };
    });
    return {
        invoiceNumber: String(data.invoiceNumber || ""),
        invoiceDate: String(data.invoiceDate || ""),
        customerDetails: String(data.customerDetails || ""),
        items: savedItems
    };
}

function applyInvoice(invoice) {
    byId("invNo").textContent = invoice.invoiceNumber;
    byId("invDate").textContent = invoice.invoiceDate;
    byId("customerDetails").textContent = invoice.customerDetails;
    byId("customerDetails").style.whiteSpace = "pre-line";
    items.splice(0, items.length, ...invoice.items);
    renderItems();
}

function updatePersistenceControls() {
    byId("saveInvoice").disabled = !db;
    byId("savedInvoices").disabled = !db;
    const hasSelection = Boolean(db && currentInvoiceId);
    byId("updateInvoice").disabled = !hasSelection;
    byId("deleteInvoice").disabled = !hasSelection;
}

async function refreshInvoiceList(selectedId = "") {
    const snapshot = await firestore.getDocs(firestore.collection(db, "invoices"));
    const updatedAtMillis = value => value && typeof value.toMillis === "function" ? value.toMillis() : 0;
    const invoices = snapshot.docs.map(invoiceDoc => ({
        id: invoiceDoc.id,
        ...invoiceDoc.data()
    })).sort((a, b) => updatedAtMillis(b.updatedAt) - updatedAtMillis(a.updatedAt));

    const select = byId("savedInvoices");
    select.replaceChildren();
    const prompt = document.createElement("option");
    prompt.value = "";
    prompt.textContent = invoices.length ? "Select an invoice to load" : "No saved invoices";
    select.appendChild(prompt);
    invoices.forEach(invoice => {
        const option = document.createElement("option");
        option.value = invoice.id;
        option.textContent = `${invoice.invoiceNumber || "Untitled"} — ${invoice.invoiceDate || "No date"}`;
        select.appendChild(option);
    });
    select.value = selectedId;
}

async function loadSelectedInvoice() {
    const id = byId("savedInvoices").value;
    if (!id) {
        currentInvoiceId = null;
        updatePersistenceControls();
        return;
    }

    currentInvoiceId = null;
    updatePersistenceControls();
    setStatus("Loading invoice…");
    try {
        const snapshot = await firestore.getDoc(firestore.doc(db, "invoices", id));
        if (!snapshot.exists()) throw new Error("This invoice no longer exists in Firestore.");
        const invoice = invoiceFromDocument(snapshot.data());
        applyInvoice(invoice);
        currentInvoiceId = id;
        updatePersistenceControls();
        setStatus(`Loaded invoice ${invoice.invoiceNumber}.`);
    } catch (error) {
        setStatus(`Could not load invoice: ${error.message}`);
    }
}

async function saveNewInvoice() {
    try {
        const data = invoiceDataFromForm();
        setStatus("Saving invoice…");
        const saved = await firestore.addDoc(firestore.collection(db, "invoices"), {
            ...data,
            createdAt: firestore.serverTimestamp()
        });
        currentInvoiceId = saved.id;
        try {
            await refreshInvoiceList(saved.id);
        } catch (error) {
            currentInvoiceId = null;
            updatePersistenceControls();
            setStatus(`Invoice ${data.invoiceNumber} was saved, but the list could not be refreshed: ${error.message}`);
            return;
        }
        updatePersistenceControls();
        setStatus(`Invoice ${data.invoiceNumber} saved.`);
    } catch (error) {
        setStatus(`Could not save invoice: ${error.message}`);
    }
}

async function updateSelectedInvoice() {
    if (!currentInvoiceId) return;
    try {
        const data = invoiceDataFromForm();
        setStatus("Updating invoice…");
        await firestore.updateDoc(firestore.doc(db, "invoices", currentInvoiceId), data);
        try {
            await refreshInvoiceList(currentInvoiceId);
        } catch (error) {
            setStatus(`Invoice ${data.invoiceNumber} was updated, but the list could not be refreshed: ${error.message}`);
            return;
        }
        setStatus(`Invoice ${data.invoiceNumber} updated.`);
    } catch (error) {
        setStatus(`Could not update invoice: ${error.message}`);
    }
}

async function deleteSelectedInvoice() {
    if (!currentInvoiceId) return;
    if (!confirm("Delete this saved invoice? This cannot be undone.")) return;
    try {
        setStatus("Deleting invoice…");
        await firestore.deleteDoc(firestore.doc(db, "invoices", currentInvoiceId));
        currentInvoiceId = null;
        updatePersistenceControls();
        try {
            await refreshInvoiceList();
        } catch (error) {
            setStatus(`Invoice was deleted, but the list could not be refreshed: ${error.message}`);
            return;
        }
        updatePersistenceControls();
        setStatus("Invoice deleted.");
    } catch (error) {
        setStatus(`Could not delete invoice: ${error.message}`);
    }
}

async function initializeFirestore() {
    try {
        const { firebaseConfig } = await import("./firebase-config.js");
        if (!firebaseConfig || !firebaseConfig.apiKey || !firebaseConfig.projectId || !firebaseConfig.appId ||
            Object.values(firebaseConfig).some(value => typeof value === "string" && value.includes("YOUR_"))) {
            throw new Error("Replace the placeholder values in firebase-config.js.");
        }
        const [appSdk, firestoreSdk] = await Promise.all([
            import("https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js"),
            import("https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js")
        ]);
        const app = appSdk.initializeApp(firebaseConfig);
        db = firestoreSdk.getFirestore(app);
        firestore = firestoreSdk;
        await refreshInvoiceList();
        updatePersistenceControls();
        setStatus("Connected to Firestore.");
    } catch (error) {
        db = null;
        firestore = null;
        updatePersistenceControls();
        setStatus(`Firestore is unavailable: ${error.message} Configure firebase-config.js and check Firestore access.`);
    }
}

window.printInvoice = () => window.print();
window.generatePDF = () => {
    const options = {
        margin: 0.2,
        filename: "Care365_Invoice.pdf",
        image: { type: "jpeg", quality: 1 },
        html2canvas: { scale: 3, useCORS: true },
        jsPDF: { unit: "in", format: "a4", orientation: "portrait" }
    };
    window.html2pdf().set(options).from(byId("invoice")).save();
};

renderItems();
updatePersistenceControls();
initializeFirestore();
