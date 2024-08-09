document.addEventListener('DOMContentLoaded', function () {
    const html5QrCodeConfig = { fps: 10, qrbox: { width: 250, height: 250 } };
    let html5QrCode = null;

    const mainScreen = document.getElementById('mainScreen');
    const returnPartsButton = document.getElementById('returnPartsButton');
    const auditPartsButton = document.getElementById('auditPartsButton');
    const returnPartsScreen = document.getElementById('returnPartsScreen');
    const auditPartsScreen = document.getElementById('auditPartsScreen');

    const emailReportButton = document.getElementById('emailReportButton');
    const inventoryEmailButton = document.getElementById('inventoryEmailButton');
    const inventorySmsButton = document.getElementById('inventorySmsButton');
    const inventoryList = document.getElementById('inventoryList');
    const notification = document.getElementById('notification');
    const inventorySection = document.getElementById('inventorySection');

    const auditForm = document.getElementById('auditForm');
    const addItemButton = document.getElementById('addItemButton');
    const auditList = document.getElementById('auditList');
    const sortLocationButton = document.getElementById('sortLocationButton');
    const sortDateButton = document.getElementById('sortDateButton');
    const emailAuditButton = document.getElementById('emailAuditButton');

    const scannedItems = new Set();
    let audioContext;
    const vendorSections = {};
    const vendorContacts = {
        'PGW': { email: 'RGrier@pgwautoglass.com', sms: '8645057843' },
        'Pilkington': { email: ['marco.yeargin@nsg.com', 'Caleb.ford@nsg.com'], sms: ['8643039699', '8642010487'] },
        'Mygrant': { email: 'poliver@mygrantglass.com', sms: '7045176639' }
    };

    returnPartsButton.addEventListener('click', () => switchScreen('returnParts'));
    auditPartsButton.addEventListener('click', () => switchScreen('auditParts'));
    emailReportButton.addEventListener('click', sendEmailReport);
    inventoryEmailButton.addEventListener('click', sendInventoryEmailReport);
    inventorySmsButton.addEventListener('click', sendInventorySmsReport);
    addItemButton.addEventListener('click', addItem);
    sortLocationButton.addEventListener('click', () => sortList('location'));
    sortDateButton.addEventListener('click', () => sortList('date'));
    emailAuditButton.addEventListener('click', sendAuditEmailReport);

    function switchScreen(screen) {
        mainScreen.classList.add('hidden');
        returnPartsScreen.classList.add('hidden');
        auditPartsScreen.classList.add('hidden');

        if (html5QrCode) {
            html5QrCode.stop().then(() => {
                html5QrCode.clear();
                html5QrCode = new Html5Qrcode(screen === 'returnParts' ? 'qr-reader' : 'qr-reader-audit');
                html5QrCode.start({ facingMode: "environment" }, html5QrCodeConfig, onScanSuccess, onScanError);
            }).catch(err => {
                console.error('Error stopping scanner:', err);
            });
        } else {
            html5QrCode = new Html5Qrcode(screen === 'returnParts' ? 'qr-reader' : 'qr-reader-audit');
            html5QrCode.start({ facingMode: "environment" }, html5QrCodeConfig, onScanSuccess, onScanError);
        }

        if (screen === 'returnParts') {
            returnPartsScreen.classList.remove('hidden');
        } else if (screen === 'auditParts') {
            auditPartsScreen.classList.remove('hidden');
        }
    }

    function onScanSuccess(decodedText) {
        console.log('Scanned item:', decodedText);
        if (!scannedItems.has(decodedText)) {
            scannedItems.add(decodedText);
            if (document.getElementById('auditPartsScreen').classList.contains('hidden')) {
                addItemToReturnList(decodedText);
            } else {
                handleAuditScan(decodedText);
            }
            playBeep();
            showNotification();
        } else {
            console.log('Item already scanned:', decodedText);
        }
        maintainLayoutConsistency(); // Ensure layout stays consistent after a scan
    }

    function onScanError(error) {
        console.warn(`QR error: ${error}`);
    }

    function handleAuditScan(decodedText) {
        const fields = decodedText.split(';').reduce((acc, field) => {
            const [key, value] = field.split('=');
            acc[key.toLowerCase()] = value;
            return acc;
        }, {});

        document.getElementById('customer').value = fields.customer || '';
        document.getElementById('part').value = fields.part || '';
        document.getElementById('supplier').value = fields.supplier || '';
        document.getElementById('order').value = fields.order || '';
        document.getElementById('labeled').value = fields.labeled || '';
        document.getElementById('location').value = '';
    }

    function addItem() {
        const customer = document.getElementById('customer').value;
        const part = document.getElementById('part').value;
        const supplier = document.getElementById('supplier').value;
        const order = document.getElementById('order').value;
        const labeled = document.getElementById('labeled').value;
        const location = document.getElementById('location').value;

        if (!customer || !part || !supplier || !order || !labeled || !location) {
            alert('All fields are required.');
            return;
        }

        const item = {
            customer,
            part,
            supplier,
            order,
            labeled,
            location,
            added: new Date().toISOString()
        };

        const li = document.createElement('li');
        li.innerHTML = `
            <div><strong>Customer:</strong> ${item.customer}</div>
            <div><strong>Part:</strong> ${item.part}</div>
            <div><strong>Supplier:</strong> ${item.supplier}</div>
            <div><strong>Order:</strong> ${item.order}</div>
            <div><strong>Labeled:</strong> ${item.labeled}</div>
            <div><strong>Location:</strong> ${item.location}</div>
            <div class="edit-remove-buttons">
                <button class="edit-button">Edit</button>
                <button class="remove-button">Remove</button>
            </div>
        `;
        li.dataset.item = JSON.stringify(item);

        const editButton = li.querySelector('.edit-button');
        editButton.addEventListener('click', () => editItem(li));

        const removeButton = li.querySelector('.remove-button');
        removeButton.addEventListener('click', () => li.remove());

        auditList.appendChild(li);
        auditForm.reset();
    }

    function addItemToReturnList(item) {
        const li = document.createElement('li');
        const itemContent = document.createElement('span');
        itemContent.className = 'item-content';
        itemContent.textContent = item;

        const removeButton = document.createElement('button');
        removeButton.textContent = 'Remove';
        removeButton.className = 'remove-button';
        removeButton.onclick = () => {
            li.remove();
            scannedItems.delete(item);
            updateVendorSectionVisibility();
        };

        li.appendChild(itemContent);
        li.appendChild(removeButton);

        const firstLine = item.split('\n')[0].trim();
        const isReturn = firstLine.includes('Return');
        let vendor = isReturn ? firstLine.split(' ')[0] : null;

        if (isReturn) {
            if (!vendorSections[vendor]) {
                createVendorSection(vendor);
            }
            vendorSections[vendor].list.appendChild(li);
            vendorSections[vendor].section.style.display = 'block';
        } else {
            inventoryList.appendChild(li);
            inventorySection.style.display = 'block';
        }
    }

    function editItem(li) {
        const item = JSON.parse(li.dataset.item);
        document.getElementById('customer').value = item.customer;
        document.getElementById('part').value = item.part;
        document.getElementById('supplier').value = item.supplier;
        document.getElementById('order').value = item.order;
        document.getElementById('labeled').value = item.labeled;
        document.getElementById('location').value = item.location;
        li.remove();
    }

    function sortList(criteria) {
        const items = Array.from(auditList.children).map(li => JSON.parse(li.dataset.item));
        items.sort((a, b) => {
            if (criteria === 'location') return a.location.localeCompare(b.location);
            if (criteria === 'date') return new Date(a.labeled) - new Date(b.labeled);
        });
        auditList.innerHTML = '';
        items.forEach(item => {
            const li = document.createElement('li');
            li.innerHTML = `
                <div><strong>Customer:</strong> ${item.customer}</div>
                <div><strong>Part:</strong> ${item.part}</div>
                <div><strong>Supplier:</strong> ${item.supplier}</div>
                <div><strong>Order:</strong> ${item.order}</div>
                <div><strong>Labeled:</strong> ${item.labeled}</div>
                <div><strong>Location:</strong> ${item.location}</div>
                <div class="edit-remove-buttons">
                    <button class="edit-button">Edit</button>
                    <button class="remove-button">Remove</button>
                </div>
            `;
            li.dataset.item = JSON.stringify(item);

            const editButton = li.querySelector('.edit-button');
            editButton.addEventListener('click', () => editItem(li));

            const removeButton = li.querySelector('.remove-button');
            removeButton.addEventListener('click', () => li.remove());

            auditList.appendChild(li);
        });
    }

    function sendEmailReport() {
        let report = 'Inventory Items:\n\n';
        report += Array.from(inventoryList.children)
            .map(li => li.querySelector('.item-content').textContent)
            .join('\n\n');
    
        for (const vendor in vendorSections) {
            if (vendorSections[vendor].list.children.length > 0) {
                report += `\n\n${vendor} Returns:\n\n`;
                report += Array.from(vendorSections[vendor].list.children)
                    .map(li => li.querySelector('.item-content').textContent)
                    .join('\n\n');
            }
        }

        const subject = encodeURIComponent('Scan Report');
        const body = encodeURIComponent(`${report}\n\n20/20 Auto Glass`);
        window.location.href = `mailto:?subject=${subject}&body=${body}`;
    }

    function sendInventoryEmailReport() {
        const items = Array.from(inventoryList.children)
            .map(li => li.querySelector('.item-content').textContent);

        const report = `Inventory Items:\n\n${items.join('\n\n')}\n\n20/20 Auto Glass`;

        const subject = encodeURIComponent('Inventory Report');
        const body = encodeURIComponent(report);
        window.location.href = `mailto:?subject=${subject}&body=${body}`;
    }

    function sendInventorySmsReport() {
        const items = Array.from(inventoryList.children)
            .map(li => li.querySelector('.item-content').textContent);

        const report = `Inventory Items:\n\n${items.join('\n\n')}\n\n20/20 Auto Glass`;

        window.location.href = `sms:?body=${encodeURIComponent(report)}`;
    }

    function sendAuditEmailReport() {
        const items = Array.from(auditList.children)
            .map(li => JSON.parse(li.dataset.item))
            .map(item => `
                Customer: ${item.customer}
                Part: ${item.part}
                Supplier: ${item.supplier}
                Order: ${item.order}
                Labeled: ${item.labeled}
                Location: ${item.location}
            `).join('\n\n');

        const report = `Audit Parts:\n\n${items}\n\n20/20 Auto Glass`;
        const subject = encodeURIComponent('Audit Parts Report');
        const body = encodeURIComponent(report);
        window.location.href = `mailto:?subject=${subject}&body=${body}`;
    }

    function emailVendorReturns(vendor) {
        const items = Array.from(vendorSections[vendor].list.children)
            .map(li => li.querySelector('.item-content').textContent);

        const report = `${vendor} Returns:\n\n${items.join('\n\n')}\n\n20/20 Auto Glass`;
        const subject = encodeURIComponent(`${vendor} Returns Report`);
        const body = encodeURIComponent(report);
        const emails = Array.isArray(vendorContacts[vendor].email) ? vendorContacts[vendor].email : [vendorContacts[vendor].email];
        emails.forEach(email => {
            window.open(`mailto:${email}?subject=${subject}&body=${body}`);
        });
    }

    function smsVendorReturns(vendor) {
        const items = Array.from(vendorSections[vendor].list.children)
            .map(li => li.querySelector('.item-content').textContent);

        const report = `${vendor} Returns:\n\n${items.join('\n\n')}\n\n20/20 Auto Glass`;
        const smsNumbers = Array.isArray(vendorContacts[vendor].sms) ? vendorContacts[vendor].sms : [vendorContacts[vendor].sms];
        smsNumbers.forEach(number => {
            window.open(`sms:${number}?body=${encodeURIComponent(report)}`);
        });
    }

    function updateVendorSectionVisibility() {
        inventorySection.style.display =
            inventoryList.children.length > 0 ? 'block' : 'none';

        for (const vendor in vendorSections) {
            vendorSections[vendor].section.style.display =
                vendorSections[vendor].list.children.length > 0 ? 'block' : 'none';
        }
    }

    function initAudio() {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }

    function playBeep() {
        if (!audioContext) initAudio();

        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);

        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
        gainNode.gain.setValueAtTime(0.5, audioContext.currentTime);

        oscillator.start();
        oscillator.stop(audioContext.currentTime + 0.1);
    }

    function showNotification() {
        notification.style.display = 'block';
        setTimeout(() => {
            notification.style.display = 'none';
        }, 2000);
    }

    function maintainLayoutConsistency() {
        // Force camera and button alignment
        const qrReader = document.getElementById('qr-reader');
        const qrReaderAudit = document.getElementById('qr-reader-audit');

        if (qrReader) {
            qrReader.style.width = '100%';
            qrReader.style.height = '500px';
        }

        if (qrReaderAudit) {
            qrReaderAudit.style.width = '100%';
            qrReaderAudit.style.height = '500px';
        }

        const emailReportButton = document.getElementById('emailReportButton');
        if (emailReportButton) {
            emailReportButton.style.width = '100%';
            emailReportButton.style.textAlign = 'center';
        }
    }
});
