const items = [
    { name: "TH-L32B60D Panel", serial: "I3UBN57064", qty: 1, rate: 5500 },
    { name: "TH-L32B60D Backlit", serial: "I3UBN57225", qty: 1, rate: 2500 },
    { name: "TH-L32B60D Panel", serial: "I3UBN57127", qty: 1, rate: 5500 },
    { name: "TH-L32B60D Backlit", serial: "I3UBN57078", qty: 1, rate: 2500 },
    { name: "TH-L32B60D Panel", serial: "I3UBN57065", qty: 1, rate: 5500 },
    { name: "TH-L32B60D Panel", serial: "I3UBN57034", qty: 1, rate: 5500 },
    { name: "TH-L32B60D Dead", serial: "I3UBN57122", qty: 1, rate: 4500 },
    { name: "TH-L32B60D Dead", serial: "I3UBN57040", qty: 1, rate: 4500 },
    { name: "TH-L32B60D Dead", serial: "I3UBN57289", qty: 1, rate: 4500 },
    { name: "T-CON (LBDS)", serial: "", qty: 4, rate: 500 },
    { name: "Service Charge", serial: "", qty: 9, rate: 1000 }
];

const byId = id => document.getElementById(id);
let db;
let firestore;
let currentEstimateId = null;

byId("addItem").addEventListener("click", addRow);
byId("tableBody").addEventListener("click", event => {
    const removeButton = event.target.closest("[data-remove-index]");
    if (removeButton) removeRow(Number(removeButton.dataset.removeIndex));
});
byId("savedEstimates").addEventListener("change", loadSelectedEstimate);
byId("saveEstimate").addEventListener("click", saveNewEstimate);
byId("updateEstimate").addEventListener("click", updateSelectedEstimate);
byId("deleteEstimate").addEventListener("click", deleteSelectedEstimate);

function setStatus(message) {
    byId("storageStatus").textContent = message;
}

const formatAmount = value => value.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
});

function addRow() {
    const name = byId("pName").value.trim();
    const serial = byId("pSerial").value.trim();
    const qty = Number(byId("pQty").value);
    const rate = Number(byId("pRate").value);
    if (!name || !Number.isInteger(qty) || qty <= 0 || !Number.isFinite(rate) || rate < 0) {
        alert("Please enter a Product, a positive whole-number Qty and a valid Rate");
        return;
    }
    items.push({ name, serial, qty, rate });
    ["pName", "pSerial", "pQty", "pRate"].forEach(id => { byId(id).value = ""; });
    render();
}

function removeRow(index) {
    if (!Number.isInteger(index) || index < 0 || index >= items.length) return;
    items.splice(index, 1);
    render();
}

function render() {
    const tbody = byId("tableBody");
    tbody.replaceChildren();
    let subtotal = 0;
    let totalQty = 0;
    items.forEach((item, index) => {
        const total = item.qty * item.rate;
        subtotal += total;
        totalQty += item.qty;
        const row = document.createElement("tr");
        const values = [
            { value: String(index + 1), className: "center-text" },
            { value: item.name, className: "center-text" },
            { value: item.serial, className: "center-text" },
            { value: String(item.qty), className: "center-text" },
            { value: formatAmount(item.rate), className: "center-text" }
        ];
        values.forEach(cell => {
            const td = document.createElement("td");
            td.textContent = cell.value;
            td.className = cell.className;
            row.appendChild(td);
        });

        const totalCell = document.createElement("td");
        totalCell.className = "center-text";
        totalCell.append(document.createTextNode(`${formatAmount(total)} `));
        const removeButton = document.createElement("button");
        removeButton.type = "button";
        removeButton.className = "no-print-x";
        removeButton.dataset.removeIndex = String(index);
        removeButton.dataset.html2canvasIgnore = "true";
        removeButton.setAttribute("aria-label", `Remove ${item.name}`);
        removeButton.textContent = "×";
        totalCell.appendChild(removeButton);
        row.appendChild(totalCell);
        tbody.appendChild(row);
    });

    const filler = document.createElement("tr");
    filler.className = "filler";
    for (let i = 0; i < 6; i++) filler.appendChild(document.createElement("td"));
    tbody.appendChild(filler);

    const tax = subtotal * 0.09;
    const grand = Math.round(subtotal + tax * 2);
    byId("totalQty").innerText = String(totalQty);
    byId("subtotal").innerText = formatAmount(subtotal);
    byId("amountVal").innerText = formatAmount(subtotal);
    byId("sgstVal").innerText = formatAmount(tax);
    byId("cgstVal").innerText = formatAmount(tax);
    byId("grandVal").innerText = formatAmount(grand);
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

function estimateDataFromForm() {
    const estimateNumber = byId("invNo").innerText.trim();
    const estimateDate = byId("invDate").innerText.trim();
    if (!estimateNumber || !estimateDate) {
        throw new Error("Estimate number and date are required.");
    }
    return {
        estimateNumber,
        estimateDate,
        customerDetails: byId("customerDetails").innerText,
        items: items.map(item => ({ ...item })),
        updatedAt: firestore.serverTimestamp()
    };
}

function estimateFromDocument(data) {
    if (!data || !Array.isArray(data.items)) {
        throw new Error("The selected Firestore document is not a valid estimate.");
    }
    const savedItems = data.items.map(item => {
        if (!item || typeof item.name !== "string" || typeof item.serial !== "string" ||
            !Number.isInteger(item.qty) || item.qty <= 0 ||
            typeof item.rate !== "number" || !Number.isFinite(item.rate) || item.rate < 0) {
            throw new Error("The selected Firestore document contains invalid estimate items.");
        }
        return { name: item.name, serial: item.serial, qty: item.qty, rate: item.rate };
    });
    return {
        estimateNumber: String(data.estimateNumber || ""),
        estimateDate: String(data.estimateDate || ""),
        customerDetails: String(data.customerDetails || ""),
        items: savedItems
    };
}

function applyEstimate(estimate) {
    byId("invNo").textContent = estimate.estimateNumber;
    byId("invDate").textContent = estimate.estimateDate;
    byId("customerDetails").textContent = estimate.customerDetails;
    byId("customerDetails").style.whiteSpace = "pre-line";
    items.splice(0, items.length, ...estimate.items);
    render();
}

function updatePersistenceControls() {
    byId("saveEstimate").disabled = !db;
    byId("savedEstimates").disabled = !db;
    const hasSelection = Boolean(db && currentEstimateId);
    byId("updateEstimate").disabled = !hasSelection;
    byId("deleteEstimate").disabled = !hasSelection;
}

async function refreshEstimateList(selectedId = "") {
    const snapshot = await firestore.getDocs(firestore.collection(db, "estimates"));
    const updatedAtMillis = value => value && typeof value.toMillis === "function" ? value.toMillis() : 0;
    const estimates = snapshot.docs.map(estimateDoc => ({
        id: estimateDoc.id,
        ...estimateDoc.data()
    })).sort((a, b) => updatedAtMillis(b.updatedAt) - updatedAtMillis(a.updatedAt));

    const select = byId("savedEstimates");
    select.replaceChildren();
    const prompt = document.createElement("option");
    prompt.value = "";
    prompt.textContent = estimates.length ? "Select an estimate to load" : "No saved estimates";
    select.appendChild(prompt);
    estimates.forEach(estimate => {
        const option = document.createElement("option");
        option.value = estimate.id;
        option.textContent = `${estimate.estimateNumber || "Untitled"} — ${estimate.estimateDate || "No date"}`;
        select.appendChild(option);
    });
    select.value = selectedId;
}

async function loadSelectedEstimate() {
    const id = byId("savedEstimates").value;
    if (!id) {
        currentEstimateId = null;
        updatePersistenceControls();
        return;
    }

    currentEstimateId = null;
    updatePersistenceControls();
    setStatus("Loading estimate…");
    try {
        const snapshot = await firestore.getDoc(firestore.doc(db, "estimates", id));
        if (!snapshot.exists()) throw new Error("This estimate no longer exists in Firestore.");
        const estimate = estimateFromDocument(snapshot.data());
        applyEstimate(estimate);
        currentEstimateId = id;
        updatePersistenceControls();
        setStatus(`Loaded estimate ${estimate.estimateNumber}.`);
    } catch (error) {
        setStatus(`Could not load estimate: ${error.message}`);
    }
}

async function saveNewEstimate() {
    try {
        const data = estimateDataFromForm();
        setStatus("Saving estimate…");
        const saved = await firestore.addDoc(firestore.collection(db, "estimates"), {
            ...data,
            createdAt: firestore.serverTimestamp()
        });
        currentEstimateId = saved.id;
        try {
            await refreshEstimateList(saved.id);
        } catch (error) {
            currentEstimateId = null;
            updatePersistenceControls();
            setStatus(`Estimate ${data.estimateNumber} was saved, but the list could not be refreshed: ${error.message}`);
            return;
        }
        updatePersistenceControls();
        setStatus(`Estimate ${data.estimateNumber} saved.`);
    } catch (error) {
        setStatus(`Could not save estimate: ${error.message}`);
    }
}

async function updateSelectedEstimate() {
    if (!currentEstimateId) return;
    try {
        const data = estimateDataFromForm();
        setStatus("Updating estimate…");
        await firestore.updateDoc(firestore.doc(db, "estimates", currentEstimateId), data);
        try {
            await refreshEstimateList(currentEstimateId);
        } catch (error) {
            setStatus(`Estimate ${data.estimateNumber} was updated, but the list could not be refreshed: ${error.message}`);
            return;
        }
        setStatus(`Estimate ${data.estimateNumber} updated.`);
    } catch (error) {
        setStatus(`Could not update estimate: ${error.message}`);
    }
}

async function deleteSelectedEstimate() {
    if (!currentEstimateId) return;
    if (!confirm("Delete this saved estimate? This cannot be undone.")) return;
    try {
        setStatus("Deleting estimate…");
        await firestore.deleteDoc(firestore.doc(db, "estimates", currentEstimateId));
        currentEstimateId = null;
        updatePersistenceControls();
        try {
            await refreshEstimateList();
        } catch (error) {
            setStatus(`Estimate was deleted, but the list could not be refreshed: ${error.message}`);
            return;
        }
        updatePersistenceControls();
        setStatus("Estimate deleted.");
    } catch (error) {
        setStatus(`Could not delete estimate: ${error.message}`);
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
        await refreshEstimateList();
        updatePersistenceControls();
        setStatus("Connected to Firestore.");
    } catch (error) {
        db = null;
        firestore = null;
        updatePersistenceControls();
        setStatus(`Firestore is unavailable: ${error.message} Configure firebase-config.js and check Firestore access.`);
    }
}

window.generatePDF = () => {
    const options = {
        margin: 0.2,
        filename: "Care365_Estimate.pdf",
        image: { type: "jpeg", quality: 1 },
        html2canvas: { scale: 3, useCORS: true },
        jsPDF: { unit: "in", format: "a4", orientation: "portrait" }
    };
    window.html2pdf().set(options).from(byId("invoice")).save();
};

render();
updatePersistenceControls();
initializeFirestore();
