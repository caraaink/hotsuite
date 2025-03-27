document.addEventListener('DOMContentLoaded', () => {
    const accountId = document.getElementById('accountId');
    const userAccount = document.getElementById('userAccount');
    let selectedToken = null;
    let selectedUsername = null;
    let selectedAccountNum = null;
    let selectedAccountId = null;
    let allIgAccounts = [];
    let nextCursor = null;
    const MAX_IG_LIMIT = 200;
    const PER_PAGE = 20;

    async function fetchIgAccounts(accountKey) {
        try {
            document.getElementById('floatingSpinner').classList.remove('hidden');
            core.showFloatingNotification('Memuat akun Instagram...');
            const url = nextCursor
                ? `/api/get_accounts?account_key=${accountKey}&limit=${PER_PAGE}&after=${nextCursor}`
                : `/api/get_accounts?account_key=${accountKey}&limit=${PER_PAGE}`;
            
            const accountsRes = await fetch(url);
            if (!accountsRes.ok) {
                throw new Error(`HTTP error fetching accounts! status: ${accountsRes.status}`);
            }
            const accountsData = await accountsRes.json();
            console.log('Accounts fetched:', accountsData);

            if (!accountsData.accounts || !accountsData.accounts[accountKey] || !Array.isArray(accountsData.accounts[accountKey].accounts)) {
                throw new Error('Invalid accounts data structure');
            }

            const igAccounts = accountsData.accounts[accountKey].accounts;
            const validIgAccounts = igAccounts.filter(acc => acc && acc.type === 'ig' && acc.id && acc.username);
            allIgAccounts = allIgAccounts.concat(validIgAccounts);
            nextCursor = accountsData.next;

            updateAccountIdDropdown();

            if (allIgAccounts.length < MAX_IG_LIMIT && nextCursor) {
                await fetchIgAccounts(accountKey);
            } else if (allIgAccounts.length >= MAX_IG_LIMIT) {
                core.showFloatingNotification(`Mencapai batas maksimum ${MAX_IG_LIMIT} akun.`, false, 3000);
            } else {
                core.showFloatingNotification(`Berhasil memuat ${allIgAccounts.length} akun Instagram.`, false, 3000);
            }
        } catch (error) {
            core.showFloatingNotification(`Error fetching accounts: ${error.message}`, true);
            console.error('Error fetching accounts:', error);
            accountId.innerHTML = '<option value="">-- Gagal Memuat --</option>';
        } finally {
            document.getElementById('floatingSpinner').classList.add('hidden');
        }
    }

    function updateAccountIdDropdown() {
        accountId.innerHTML = '<option value="">-- Pilih Username --</option>';
        if (allIgAccounts.length === 0) {
            accountId.innerHTML = '<option value="">-- Tidak Ada Akun Tersedia --</option>';
            return;
        }

        allIgAccounts.forEach(acc => {
            if (acc && acc.type === 'ig' && acc.id && acc.username) {
                const option = document.createElement('option');
                option.value = acc.id;
                option.textContent = acc.username;
                option.dataset.username = acc.username;
                accountId.appendChild(option);
            }
        });
    }

    userAccount.addEventListener('change', async () => {
        const accountNum = userAccount.value;
        selectedAccountNum = accountNum;
        console.log('Selected account number:', accountNum);

        const accountIdContainer = document.getElementById('accountIdContainer');
        const accountIdLabel = document.querySelector('label[for="accountId"]');

        if (!accountNum) {
            accountId.innerHTML = '<option value="">-- Pilih Username --</option>';
            selectedToken = null;
            selectedUsername = null;
            selectedAccountNum = null;
            selectedAccountId = null;
            allIgAccounts = [];
            nextCursor = null;
            accountIdContainer.classList.add('hidden');
            accountIdLabel.style.display = 'none';
            await schedules.loadSchedules();
            return;
        }

        try {
            const tokenRes = await fetch(`/api/refresh-token?accountNum=${accountNum}`);
            if (!tokenRes.ok) {
                throw new Error(`HTTP error fetching token! status: ${tokenRes.status}`);
            }
            const tokenData = await tokenRes.json();
            console.log('Token fetched:', tokenData);
            selectedToken = tokenData.token;
            if (!selectedToken) {
                throw new Error('No token found for this account');
            }

            allIgAccounts = [];
            nextCursor = null;
            accountId.innerHTML = '<option value="">-- Memuat Username --</option>';
            accountIdContainer.classList.remove('hidden');
            accountIdLabel.style.display = 'block';
            accountIdLabel.textContent = 'Username IG';

            await fetchIgAccounts(`Akun ${accountNum}`);
            await schedules.loadSchedules();
        } catch (error) {
            core.showFloatingNotification(`Error fetching accounts: ${error.message}`, true);
            console.error('Error fetching accounts:', error);
            accountId.innerHTML = '<option value="">-- Gagal Memuat --</option>';
            accountIdContainer.classList.add('hidden');
            accountIdLabel.style.display = 'none';
        }
    });

    accountId.addEventListener('change', async () => {
        const selectedOption = accountId.options[accountId.selectedIndex];
        selectedUsername = selectedOption ? selectedOption.dataset.username : null;
        selectedAccountId = selectedOption ? selectedOption.value : null;
        console.log('Selected username:', selectedUsername, 'Selected accountId:', selectedAccountId);
        await schedules.loadSchedules();
    });

    // Ekspor variabel untuk digunakan di file lain
    window.accounts = {
        selectedToken,
        selectedUsername,
        selectedAccountNum,
        selectedAccountId
    };
});