    // Daftar pecahan uang yang tersedia
    const denominations = [
        { value: 100000, label: "Rp 100.000" },
        { value: 50000, label: "Rp 50.000" },
        { value: 20000, label: "Rp 20.000" },
        { value: 10000, label: "Rp 10.000" },
        { value: 5000, label: "Rp 5.000" },
        { value: 2000, label: "Rp 2.000" },
        { value: 1000, label: "Rp 1.000" }
    ];

    // Data utama
    let walletSheets = {}; // { 100000: 5, 50000: 10, ... }
    let transactions = []; // { id, type, description, amount, timestamp, oldWalletSnapshot? }
    
    const STORAGE_KEY = "walletManagerRed";

    // Load data dari localStorage
    function loadFromStorage() {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
            try {
                const data = JSON.parse(stored);
                walletSheets = data.walletSheets || {};
                transactions = data.transactions || [];
                // Validasi walletSheets untuk semua pecahan
                denominations.forEach(denom => {
                    if (typeof walletSheets[denom.value] !== 'number') {
                        walletSheets[denom.value] = 0;
                    }
                });
            } catch(e) {
                initDefaultWallet();
            }
        } else {
            initDefaultWallet();
        }
    }

    // Inisialisasi default (contoh ada beberapa lembar)
    function initDefaultWallet() {
        walletSheets = {
            100000: 5,
            50000: 10,
            20000: 5,
            10000: 10,
            5000: 20,
            2000: 15,
            1000: 25
        };
        transactions = [];
        // Contoh transaksi awal biar tidak kosong
        transactions.push({
            id: Date.now() + 1,
            type: "income",
            description: "Setoran awal dompet",
            amount: calculateTotalFromSheets(walletSheets),
            timestamp: new Date().toLocaleString("id-ID"),
            isInitial: true
        });
    }

    // Hitung total dari lembaran
    function calculateTotalFromSheets(sheets) {
        let total = 0;
        for (let denom of denominations) {
            const count = sheets[denom.value] || 0;
            total += denom.value * count;
        }
        return total;
    }

    // Hitung total uang saat ini
    function getCurrentTotal() {
        return calculateTotalFromSheets(walletSheets);
    }

    // Update tampilan total
    function updateTotalDisplay() {
        const total = getCurrentTotal();
        const formatted = new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(total);
        document.getElementById("totalWalletAmount").innerHTML = formatted;
    }

    // Render input lembaran uang
    function renderDenominationInputs() {
        const container = document.getElementById("denominationInputs");
        let html = "";
        for (let denom of denominations) {
            const currentCount = walletSheets[denom.value] || 0;
            const subtotal = denom.value * currentCount;
            const subtotalFormatted = new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(subtotal);
            html += `
                <div class="denom-item">
                    <div>
                        <div class="denom-label">${denom.label}</div>
                        <div class="denom-subtotal">${subtotalFormatted}</div>
                    </div>
                    <input type="number" class="denom-input" data-value="${denom.value}" value="${currentCount}" min="0" step="1">
                </div>
            `;
        }
        container.innerHTML = html;
        
        // Attach event listeners untuk input (opsional, bisa langsung update preview)
        document.querySelectorAll('.denom-input').forEach(input => {
            input.addEventListener('change', function() {
                const denomValue = parseInt(this.dataset.value);
                let newCount = parseInt(this.value);
                if (isNaN(newCount) || newCount < 0) newCount = 0;
                // Preview update subtotal visual bisa dilakukan, tapi kita tunggu tombol update
                const subtotalSpan = this.closest('.denom-item')?.querySelector('.denom-subtotal');
                if (subtotalSpan) {
                    const newSubtotal = denomValue * newCount;
                    subtotalSpan.innerText = new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(newSubtotal);
                }
            });
        });
    }

    // Simpan perubahan lembaran dari input
    function updateWalletFromInputs() {
        const newSheets = { ...walletSheets };
        let hasChanges = false;
        
        document.querySelectorAll('.denom-input').forEach(input => {
            const denomValue = parseInt(input.dataset.value);
            let newCount = parseInt(input.value);
            if (isNaN(newCount)) newCount = 0;
            if (newCount < 0) newCount = 0;
            if (newSheets[denomValue] !== newCount) {
                newSheets[denomValue] = newCount;
                hasChanges = true;
            }
        });
        
        if (hasChanges) {
            const oldTotal = getCurrentTotal();
            walletSheets = newSheets;
            const newTotal = getCurrentTotal();
            
            // Catat sebagai penyesuaian manual jika ada perubahan (opsional)
            if (oldTotal !== newTotal) {
                const difference = newTotal - oldTotal;
                // Tambahkan catatan sistem jika user mengedit langsung
                const systemNote = {
                    id: Date.now(),
                    type: difference >= 0 ? "income" : "expense",
                    description: "✏️ Penyesuaian lembaran dompet (manual)",
                    amount: Math.abs(difference),
                    timestamp: new Date().toLocaleString("id-ID"),
                    isAdjustment: true
                };
                transactions.unshift(systemNote);
                // Batasi riwayat terlalu panjang, tapi ok
            }
            
            saveToStorage();
            renderAll();
        } else {
            alert("Tidak ada perubahan pada lembaran uang.");
        }
    }

    // Reset dompet (kosongkan semua lembar)
    function resetWallet() {
        if (confirm("⚠️ Reset dompet akan mengosongkan SEMUA lembaran uang dan menghapus riwayat transaksi? Lanjutkan?")) {
            denominations.forEach(denom => {
                walletSheets[denom.value] = 0;
            });
            transactions = [];
            saveToStorage();
            renderAll();
            alert("Dompet telah direset. Semua lembaran menjadi 0 dan riwayat dihapus.");
        }
    }

    // Menambahkan transaksi (pemasukan/pengeluaran) yang mengubah lembaran secara cerdas
    function addTransaction(type, description, amountRaw) {
        let amount = parseFloat(amountRaw);
        if (isNaN(amount) || amount <= 0) {
            alert("Nominal harus lebih dari 0!");
            return false;
        }
        
        const currentTotal = getCurrentTotal();
        
        if (type === "expense" && amount > currentTotal) {
            alert(`Pengeluaran tidak dapat dilakukan karena uang di dompet hanya ${new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(currentTotal)}`);
            return false;
        }
        
        // Simpan snapshot sebelum perubahan
        const oldSheets = { ...walletSheets };
        
        if (type === "income") {
            // Pemasukan: tambah uang ke dompet dengan pecahan terbaik
            addMoneyToWallet(amount);
        } else {
            // Pengeluaran: kurangi uang dari dompet
            subtractMoneyFromWallet(amount);
        }
        
        // Catat transaksi
        const transaction = {
            id: Date.now(),
            type: type,
            description: description.trim() || (type === "income" ? "Pemasukan" : "Pengeluaran"),
            amount: amount,
            timestamp: new Date().toLocaleString("id-ID"),
            oldTotal: currentTotal,
            newTotal: getCurrentTotal()
        };
        transactions.unshift(transaction);
        
        // Batasi riwayat maksimal 100
        if (transactions.length > 100) transactions = transactions.slice(0, 100);
        
        saveToStorage();
        renderAll();
        return true;
    }
    
    // Fungsi untuk menambah uang ke dompet dengan pecahan optimal
    function addMoneyToWallet(amount) {
        let remaining = amount;
        // Kita tambahkan dari pecahan terbesar ke terkecil untuk memaksimalkan lembaran besar
        // Salin dulu sheets
        let newSheets = { ...walletSheets };
        
        // Untuk penambahan, kita coba tambah dari pecahan terbesar
        for (let i = 0; i < denominations.length; i++) {
            const denomValue = denominations[i].value;
            const maxSheetsCanAdd = Math.floor(remaining / denomValue);
            if (maxSheetsCanAdd > 0) {
                newSheets[denomValue] = (newSheets[denomValue] || 0) + maxSheetsCanAdd;
                remaining -= maxSheetsCanAdd * denomValue;
            }
        }
        
        // Jika masih ada sisa (kurang dari 1000), kita tambahkan ke pecahan 1000
        if (remaining > 0) {
            // Sisa kecil akan ditambahkan sebagai pecahan 1000 (karena minimal 1000)
            // Tapi uang sisa bisa 500, 200, 100? Dalam pecahan minimal 1000, jika sisa <1000 kita bulatkan? 
            // Untuk realistis, kita beri opsi: sisa tidak bisa dipecah, tapi kita tambahkan sebagai "catatan" tidak mungkin. 
            // Biar mudah: Jika sisa >0 dan sisa <1000, kita tambahkan ke pecahan 1000 sebagai 1 lembar? tidak tepat.
            // Solusi: untuk keperluan demo, kita tambahkan ke pecahan 1000 dengan pembulatan ke atas? lebih baik tidak.
            // Tapi agar user tidak bingung, kita catat bahwa sisa akan ditambahkan ke pecahan 1000 sebagai 1 lembar jika sisa >=500
            // Tapi untuk akurasi, saya akan menambahkan ke pecahan 1000 dengan 1 lembar jika sisa > 500? tidak ideal.
            // Alternatif: tambahkan sebagai pecahan 1000 dengan 1 lembar dan sisa dianggap uang receh? Saya akan gunakan sistem: 
            // Jika sisa > 0, naikkan 1 lembar 1000, agar total tidak berkurang.
            if (remaining >= 500) {
                newSheets[1000] = (newSheets[1000] || 0) + 1;
            } else if (remaining > 0) {
                // untuk sisa kecil, kita abaikan? tidak fair. Lebih baik user tahu.
                alert(`Perhatian: sisa Rp ${remaining} tidak dapat dikonversi ke lembaran karena minimal pecahan Rp 1.000. Uang akan dibulatkan dengan menambah 1 lembar Rp 1.000.`);
                newSheets[1000] = (newSheets[1000] || 0) + 1;
            }
        }
        
        walletSheets = newSheets;
    }
    
    // Fungsi untuk mengurangi uang dari dompet (pengeluaran optimal)
    function subtractMoneyFromWallet(amount) {
        let remaining = amount;
        let newSheets = { ...walletSheets };
        
        // Kita coba kurangi dari pecahan terbesar ke terkecil
        for (let i = 0; i < denominations.length; i++) {
            const denomValue = denominations[i].value;
            const availableSheets = newSheets[denomValue] || 0;
            const sheetsNeeded = Math.min(availableSheets, Math.floor(remaining / denomValue));
            if (sheetsNeeded > 0) {
                newSheets[denomValue] = availableSheets - sheetsNeeded;
                remaining -= sheetsNeeded * denomValue;
            }
        }
        
        // Jika masih ada sisa, coba dari pecahan kecil
        if (remaining > 0) {
            // Coba dari pecahan 1000 ke atas lagi untuk sisa yang lebih kecil
            for (let i = denominations.length - 1; i >= 0; i--) {
                const denomValue = denominations[i].value;
                const availableSheets = newSheets[denomValue] || 0;
                if (availableSheets > 0 && remaining >= denomValue) {
                    const sheetsNeeded = Math.min(availableSheets, Math.ceil(remaining / denomValue));
                    newSheets[denomValue] = availableSheets - sheetsNeeded;
                    remaining -= sheetsNeeded * denomValue;
                    if (remaining <= 0) break;
                }
            }
        }
        
        if (remaining > 0) {
            alert(`Peringatan: Tidak cukup lembaran untuk pengeluaran tepat. Sisa kekurangan Rp ${remaining}. Dompet telah disesuaikan maksimal.`);
        }
        
        walletSheets = newSheets;
    }
    
    // Render riwayat transaksi
    function renderTransactions() {
        const container = document.getElementById("transactionList");
        if (!transactions.length) {
            container.innerHTML = `<div style="text-align:center; color:#ffcfb5;">✨ Belum ada transaksi ✨</div>`;
            return;
        }
        
        let html = "";
        for (let t of transactions.slice(0, 50)) {
            const amountFormatted = new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(t.amount);
            const isIncome = t.type === "income";
            const sign = isIncome ? "+ " : "- ";
            const amountClass = isIncome ? "income-text" : "expense-text";
            const borderClass = isIncome ? "transaction-income" : "transaction-expense";
            const descText = t.description || (isIncome ? "Pemasukan" : "Pengeluaran");
            html += `
                <div class="transaction-item ${borderClass}">
                    <div class="trans-desc">${escapeHtml(descText)}</div>
                    <div class="trans-amount ${amountClass}">${sign}${amountFormatted}</div>
                    <div class="trans-time">${escapeHtml(t.timestamp)}</div>
                </div>
            `;
        }
        container.innerHTML = html;
    }
    
    // Hapus semua riwayat (tapi tidak mengubah lembaran)
    function clearHistory() {
        if (confirm("Hapus semua riwayat transaksi? Lembaran uang tidak akan berubah.")) {
            transactions = [];
            saveToStorage();
            renderTransactions();
        }
    }
    
    // Render semua komponen
    function renderAll() {
        renderDenominationInputs();
        updateTotalDisplay();
        renderTransactions();
    }
    
    function saveToStorage() {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({
            walletSheets: walletSheets,
            transactions: transactions
        }));
    }
    
    function escapeHtml(str) {
        if (!str) return "";
        return str.replace(/[&<>]/g, function(m) {
            if (m === '&') return '&amp;';
            if (m === '<') return '&lt;';
            if (m === '>') return '&gt;';
            return m;
        });
    }
    
    // Event Listeners
    document.addEventListener("DOMContentLoaded", () => {
        loadFromStorage();
        renderAll();
        
        document.getElementById("updateDenominationBtn").addEventListener("click", () => {
            updateWalletFromInputs();
        });
        
        document.getElementById("addTransactionBtn").addEventListener("click", () => {
            const type = document.getElementById("transactionType").value;
            const desc = document.getElementById("transDesc").value;
            const amount = document.getElementById("transAmount").value;
            if (addTransaction(type, desc, amount)) {
                document.getElementById("transDesc").value = "";
                document.getElementById("transAmount").value = "";
            }
        });
        
        document.getElementById("resetWalletBtn").addEventListener("click", () => {
            resetWallet();
        });
        
        document.getElementById("clearHistoryBtn").addEventListener("click", () => {
            clearHistory();
        });
    });