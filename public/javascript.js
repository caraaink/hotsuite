document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('scheduleForm');
    const status = document.getElementById('floatingStatus');
    const spinner = document.getElementById('floatingSpinner');
    const floatingNotification = document.getElementById('floatingNotification');
    const accountId = document.getElementById('accountId');
    const userAccount = document.getElementById('userAccount');
    const githubFolder = document.getElementById('githubFolder');
    const githubSubfolder = document.getElementById('githubSubfolder');
    const subfolderContainer = document.getElementById('subfolderContainer');
    const accountIdContainer = document.getElementById('accountIdContainer');
    const uploadFile = document.getElementById('uploadFile');
    const uploadToGithub = document.getElementById('uploadToGithub');
    const gallery = document.getElementById('gallery');
    const mediaUrl = document.getElementById('mediaUrl');
    const scheduleTableBody = document.getElementById('scheduleTableBody');
    const themeToggle = document.getElementById('themeToggle');
    const themeMenu = document.getElementById('themeMenu');
    const toggleDarkMode = document.getElementById('toggleDarkMode');
    const selectAll = document.getElementById('selectAll');
    const deleteSelected = document.getElementById('deleteSelected');
    const scheduleActions = document.getElementById('scheduleActions');
    const startDateTime = document.getElementById('startDateTime');
    const skipDay = document.getElementById('skipDay');
    const scheduleAll = document.getElementById('scheduleAll');
    const saveSchedules = document.getElementById('saveSchedules');
    const loadMoreBtn = document.getElementById('loadMore');
    const totalSchedules = document.getElementById('totalSchedules');
    const uploadFolder = document.getElementById('uploadFolder');
    let selectedToken = null;
    let selectedUsername = null;
    let selectedAccountNum = null;
    let selectedAccountId = null;
    let allSubfolders = [];
    let allMediaFiles = [];
    let captions = {};
    let scheduledTimes = {};
    let allSchedules = [];
    let displayedSchedules = 0;
    const ITEMS_PER_PAGE = 20;
    let isLoadingSchedules = false;

    // Inisialisasi: Sembunyikan elemen saat halaman dimuat
    accountIdContainer.classList.add('hidden');
    subfolderContainer.classList.add('hidden');
    scheduleActions.classList.add('hidden');

    // Fungsi untuk mengonversi waktu dari UTC ke WIB
    function convertToWIB(utcTime) {
        const date = new Date(utcTime);
        const wibOffset = 7 * 60 * 60 * 1000; // 7 jam dalam milidetik
        const wibTime = new Date(date.getTime() + wibOffset);
        return wibTime;
    }

    // Fungsi untuk memformat waktu dalam WIB ke format datetime-local (YYYY-MM-DDThh:mm)
    function formatToDatetimeLocal(wibTime) {
        return wibTime.toISOString().slice(0, 16);
    }

    // Fungsi untuk memformat waktu dalam WIB ke format lokal (dd/mm/yyyy hh:mm)
    function formatToLocaleString(wibTime) {
        return wibTime.toLocaleString('id-ID', {
            timeZone: 'Asia/Jakarta',
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
        }).replace(',', '');
    }

    // Fungsi debounce untuk mencegah klik berulang
    function debounce(func, wait) {
        let timeout;
        return function (...args) {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, args), wait);
        };
    }

    // Fungsi untuk menampilkan modal konfirmasi
    function showConfirmModal(message) {
        return new Promise((resolve) => {
            const modal = document.getElementById('confirmModal');
            const confirmMessage = document.getElementById('confirmMessage');
            const confirmOk = document.getElementById('confirmOk');
            const confirmCancel = document.getElementById('confirmCancel');

            confirmMessage.textContent = message;
            modal.classList.remove('hidden');

            confirmOk.onclick = () => {
                modal.classList.add('hidden');
                resolve(true);
            };

            confirmCancel.onclick = () => {
                modal.classList.add('hidden');
                resolve(false);
            };
        });
    }

    // Function to show floating notification with customizable duration
    function showFloatingNotification(message, isError = false, duration = 3000) {
        status.textContent = message;
        floatingNotification.classList.remove('hidden');
        if (isError) {
            floatingNotification.classList.add('error');
        } else {
            floatingNotification.classList.remove('error');
        }
        spinner.classList.add('hidden');
        if (duration > 0) {
            setTimeout(() => {
                floatingNotification.classList.add('hidden');
            }, duration);
        }
    }

    // Load dark mode preference from localStorage
    if (localStorage.getItem('theme') === 'dark') {
        document.body.classList.add('dark-mode');
    }

    // Toggle theme menu visibility
    themeToggle.addEventListener('click', () => {
        themeMenu.classList.toggle('hidden');
    });

    // Toggle dark mode
    toggleDarkMode.addEventListener('click', () => {
        document.body.classList.toggle('dark-mode');
        const isDarkMode = document.body.classList.contains('dark-mode');
        localStorage.setItem('theme', isDarkMode ? 'dark' : 'light');
        themeMenu.classList.add('hidden');
    });

    // Prevent form from adding parameters to URL on submit
    form.addEventListener('submit', (e) => {
        e.preventDefault();
    });

    // Load Instagram usernames when an account is selected with pagination
    let allIgAccounts = [];
    let nextCursor = null;
    const MAX_IG_LIMIT = 200;
    const PER_PAGE = 20;

    async function fetchIgAccounts(accountKey) {
        try {
            spinner.classList.remove('hidden');
            showFloatingNotification('Memuat akun Instagram...');
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
                showFloatingNotification(`Mencapai batas maksimum ${MAX_IG_LIMIT} akun.`, false, 3000);
            } else {
                showFloatingNotification(`Berhasil memuat ${allIgAccounts.length} akun Instagram.`, false, 3000);
            }
        } catch (error) {
            showFloatingNotification(`Error fetching accounts: ${error.message}`, true);
            console.error('Error fetching accounts:', error);
            accountId.innerHTML = '<option value="">-- Gagal Memuat --</option>';
            accountIdContainer.classList.add('hidden');
        } finally {
            spinner.classList.add('hidden');
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

        if (!accountNum) {
            accountId.innerHTML = '<option value="">-- Pilih Username --</option>';
            selectedToken = null;
            selectedUsername = null;
            selectedAccountNum = null;
            selectedAccountId = null;
            allIgAccounts = [];
            nextCursor = null;
            accountIdContainer.classList.add('hidden');
            await loadSchedules();
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

            await fetchIgAccounts(`Akun ${accountNum}`);
            await loadSchedules();
        } catch (error) {
            showFloatingNotification(`Error fetching accounts: ${error.message}`, true);
            console.error('Error fetching accounts:', error);
            accountId.innerHTML = '<option value="">-- Gagal Memuat --</option>';
            accountIdContainer.classList.add('hidden');
        }
    });

    accountId.addEventListener('change', async () => {
        const selectedOption = accountId.options[accountId.selectedIndex];
        selectedUsername = selectedOption ? selectedOption.dataset.username : null;
        selectedAccountId = selectedOption ? selectedOption.value : null;
        console.log('Selected username:', selectedUsername, 'Selected accountId:', selectedAccountId);
        await loadSchedules();
    });

    function naturalSort(a, b) {
        const aKey = a.name || a.path || a;
        const bKey = b.name || b.path || b;
        return aKey.localeCompare(bKey, undefined, { numeric: true, sensitivity: 'base' });
    }

    async function loadGithubFolders() {
        showFloatingNotification('Memuat daftar folder...');
        spinner.classList.remove('hidden');
        try {
            const res = await fetch('/api/get_github_files?path=ig');
            if (!res.ok) {
                throw new Error(`HTTP error! status: ${res.status}`);
            }
            const data = await res.json();
            console.log('GitHub folders fetched:', data);

            const folders = data.files.filter(item => item.type === 'dir');
            folders.sort(naturalSort);

            githubFolder.innerHTML = '<option value="ig">-- Pilih Folder --</option>';
            folders.forEach(item => {
                console.log('Adding folder to dropdown:', item.name);
                const option = document.createElement('option');
                option.value = item.path;
                option.textContent = item.name;
                githubFolder.appendChild(option);
            });

            if (githubFolder.options.length === 1) {
                showFloatingNotification('No subfolders found in ig directory.', true);
            } else {
                showFloatingNotification('');
            }
        } catch (error) {
            showFloatingNotification(`Error loading GitHub folders: ${error.message}`, true);
            console.error('Error fetching GitHub folders:', error);
            subfolderContainer.classList.add('hidden');
        } finally {
            spinner.classList.add('hidden');
        }
    }

    async function fetchSubfolders(path) {
        showFloatingNotification('Memuat daftar subfolder...');
        spinner.classList.remove('hidden');
        try {
            const res = await fetch(`/api/get_github_files?path=${path}`);
            if (!res.ok) {
                throw new Error(`HTTP error! status: ${res.status}`);
            }
            const data = await res.json();
            console.log(`Subfolders fetched for path ${path}:`, data);

            allSubfolders = [];
            data.files.forEach(item => {
                if (item.type === 'dir') {
                    allSubfolders.push({
                        name: item.name,
                        path: item.path,
                    });
                }
            });

            allSubfolders.sort(naturalSort);
            return allSubfolders;
        } catch (error) {
            console.error(`Error fetching subfolders for path ${path}:`, error);
            showFloatingNotification(`Error loading subfolders: ${error.message}`, true);
            subfolderContainer.classList.add('hidden');
            return [];
        } finally {
            spinner.classList.add('hidden');
        }
    }

    async function fetchFilesInSubfolder(path) {
        showFloatingNotification('Memuat file media...');
        spinner.classList.remove('hidden');
        try {
            const res = await fetch(`/api/get_github_files?path=${path}`);
            if (!res.ok) {
                throw new Error(`HTTP error! status: ${res.status}`);
            }
            const data = await res.json();
            console.log(`Files fetched for path ${path}:`, data);

            const files = data.files.filter(item =>
                item.type === 'file' &&
                (item.name.toLowerCase().endsWith('.jpg') ||
                 item.name.toLowerCase().endsWith('.jpeg') ||
                 item.name.toLowerCase().endsWith('.png') ||
                 item.name.toLowerCase().endsWith('.mp4'))
            );

            files.sort(naturalSort);
            return files;
        } catch (error) {
            console.error(`Error fetching files for path ${path}:`, error);
            showFloatingNotification(`Error loading files: ${error.message}`, true);
            return [];
        } finally {
            spinner.classList.add('hidden');
        }
    }

    githubFolder.addEventListener('change', async () => {
        const folderPath = githubFolder.value;
        allMediaFiles = [];
        captions = {};
        scheduledTimes = {};
        gallery.innerHTML = '';
        mediaUrl.value = '';

        if (!folderPath || folderPath === 'ig') {
            subfolderContainer.classList.add('hidden');
            githubSubfolder.innerHTML = '<option value="">-- Pilih Subfolder --</option>';
            return;
        }

        try {
            if (folderPath === 'ig/image') {
                subfolderContainer.classList.add('hidden');
                const files = await fetchFilesInSubfolder(folderPath);
                allMediaFiles = files;
                displayGallery(files);

                if (files.length === 0) {
                    showFloatingNotification('No supported media files found in this folder.', true);
                } else {
                    showFloatingNotification('');
                }
            } else {
                subfolderContainer.classList.remove('hidden');
                const subfolders = await fetchSubfolders(folderPath);
                console.log('All subfolders found:', subfolders);

                if (subfolders.length === 0) {
                    const files = await fetchFilesInSubfolder(folderPath);
                    allMediaFiles = files;
                    githubSubfolder.innerHTML = '<option value="">-- Tidak Ada Subfolder --</option>';
                    displayGallery(files);

                    if (files.length === 0) {
                        showFloatingNotification('No supported media files found in this folder.', true);
                    } else {
                        showFloatingNotification('');
                    }
                } else {
                    githubSubfolder.innerHTML = '<option value="">-- Pilih Subfolder --</option>';
                    subfolders.forEach(subfolder => {
                        const option = document.createElement('option');
                        option.value = subfolder.path;
                        option.textContent = subfolder.name;
                        githubSubfolder.appendChild(option);
                    });

                    if (githubSubfolder.options.length === 1) {
                        showFloatingNotification('No subfolders found in this folder.', true);
                    } else {
                        showFloatingNotification('');
                    }
                }
            }
        } catch (error) {
            showFloatingNotification(`Error loading subfolders: ${error.message}`, true);
            console.error('Error fetching subfolders:', error);
            subfolderContainer.classList.add('hidden');
        }
    });

    githubSubfolder.addEventListener('change', async () => {
        const subfolderPath = githubSubfolder.value;
        allMediaFiles = [];
        captions = {};
        scheduledTimes = {};
        gallery.innerHTML = '';
        mediaUrl.value = '';

        if (!subfolderPath) {
            return;
        }

        try {
            const files = await fetchFilesInSubfolder(subfolderPath);
            allMediaFiles = files;
            displayGallery(files);

            if (files.length === 0) {
                showFloatingNotification('No supported media files found in this subfolder.', true);
            } else {
                showFloatingNotification('');
            }
        } catch (error) {
            showFloatingNotification(`Error loading files: ${error.message}`, true);
            console.error('Error fetching files:', error);
        }
    });

    async function fetchCaption(filename, path) {
        try {
            const metaPath = `${path}/${filename}.json`;
            const res = await fetch(`/api/get_github_file?path=${metaPath}`);
            if (!res.ok) {
                if (res.status === 404) {
                    return '';
                }
                throw new Error(`HTTP error! status: ${res.status}`);
            }
            const data = await res.json();
            return data.content || '';
        } catch (error) {
            console.error(`Error fetching caption for ${filename}:`, error);
            return '';
        }
    }

    async function displayGallery(files) {
        gallery.innerHTML = '';
        captions = {};
        scheduledTimes = {};

        for (const file of files) {
            const filename = file.name.split('.').slice(0, -1).join('.');
            const caption = await fetchCaption(filename, file.path.replace(`/${file.name}`, ''));
            captions[file.name] = caption;

            const galleryItem = document.createElement('div');
            galleryItem.classList.add('gallery-item');

            const mediaElement = file.name.toLowerCase().endsWith('.mp4') ?
                document.createElement('video') :
                document.createElement('img');
            mediaElement.src = file.download_url;
            if (mediaElement.tagName === 'VIDEO') {
                mediaElement.controls = true;
            }
            mediaElement.alt = file.name;
            mediaElement.classList.add('gallery-media');

            const captionInput = document.createElement('textarea');
            captionInput.classList.add('caption-input');
            captionInput.placeholder = 'Masukkan caption...';
            captionInput.value = caption;
            captionInput.dataset.filename = file.name;

            const scheduleInput = document.createElement('input');
            scheduleInput.type = 'datetime-local';
            scheduleInput.classList.add('schedule-input');
            scheduleInput.dataset.filename = file.name;

            captionInput.addEventListener('input', (e) => {
                captions[e.target.dataset.filename] = e.target.value;
            });

            scheduleInput.addEventListener('input', (e) => {
                scheduledTimes[e.target.dataset.filename] = e.target.value;
            });

            galleryItem.appendChild(mediaElement);
            galleryItem.appendChild(captionInput);
            galleryItem.appendChild(scheduleInput);
            gallery.appendChild(galleryItem);
        }
    }

    uploadToGithub.addEventListener('click', async () => {
        const files = uploadFile.files;
        if (files.length === 0) {
            showFloatingNotification('Pilih setidaknya satu file untuk diunggah.', true);
            return;
        }

        const folderPath = uploadFolder.value.trim();
        if (!folderPath) {
            showFloatingNotification('Masukkan path folder tujuan.', true);
            return;
        }

        const formData = new FormData();
        for (const file of files) {
            formData.append('files', file);
        }
        formData.append('folderPath', folderPath);

        try {
            showFloatingNotification('Mengunggah file ke GitHub...');
            spinner.classList.remove('hidden');
            const res = await fetch('/api/upload_to_github', {
                method: 'POST',
                body: formData,
            });

            if (!res.ok) {
                throw new Error(`HTTP error! status: ${res.status}`);
            }

            const data = await res.json();
            console.log('Upload response:', data);

            if (data.success) {
                showFloatingNotification('File berhasil diunggah ke GitHub.');
                uploadFile.value = '';
                uploadFolder.value = '';
                await loadGithubFolders();
            } else {
                throw new Error(data.message || 'Gagal mengunggah file.');
            }
        } catch (error) {
            showFloatingNotification(`Error uploading files: ${error.message}`, true);
            console.error('Error uploading files:', error);
        } finally {
            spinner.classList.add('hidden');
        }
    });

    async function loadSchedules() {
        if (!selectedAccountNum || !selectedAccountId) {
            scheduleTableBody.innerHTML = '';
            allSchedules = [];
            displayedSchedules = 0;
            totalSchedules.textContent = 'Total: 0 jadwal';
            scheduleActions.classList.add('hidden');
            loadMoreBtn.classList.add('hidden');
            return;
        }

        try {
            showFloatingNotification('Memuat jadwal...');
            spinner.classList.remove('hidden');
            const res = await fetch(`/api/get_schedules?accountNum=${selectedAccountNum}&accountId=${selectedAccountId}`);
            if (!res.ok) {
                throw new Error(`HTTP error! status: ${res.status}`);
            }
            const data = await res.json();
            console.log('Schedules fetched:', data);

            allSchedules = data.schedules || [];
            allSchedules.sort((a, b) => new Date(a.scheduled_time) - new Date(b.scheduled_time));

            displayedSchedules = 0;
            scheduleTableBody.innerHTML = '';

            if (allSchedules.length === 0) {
                scheduleTableBody.innerHTML = '<tr><td colspan="6">Tidak ada jadwal ditemukan.</td></tr>';
                totalSchedules.textContent = 'Total: 0 jadwal';
                scheduleActions.classList.add('hidden');
                loadMoreBtn.classList.add('hidden');
                showFloatingNotification('');
                return;
            }

            displaySchedules();
            totalSchedules.textContent = `Total: ${allSchedules.length} jadwal`;
            scheduleActions.classList.remove('hidden');
            loadMoreBtn.classList.toggle('hidden', displayedSchedules >= allSchedules.length);
            showFloatingNotification('');
        } catch (error) {
            showFloatingNotification(`Error loading schedules: ${error.message}`, true);
            console.error('Error fetching schedules:', error);
            scheduleTableBody.innerHTML = '<tr><td colspan="6">Gagal memuat jadwal.</td></tr>';
            totalSchedules.textContent = 'Total: 0 jadwal';
            scheduleActions.classList.add('hidden');
            loadMoreBtn.classList.add('hidden');
        } finally {
            spinner.classList.add('hidden');
        }
    }

    function displaySchedules() {
        const start = displayedSchedules;
        const end = Math.min(start + ITEMS_PER_PAGE, allSchedules.length);

        for (let i = start; i < end; i++) {
            const schedule = allSchedules[i];
            const row = document.createElement('tr');

            const checkboxCell = document.createElement('td');
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.dataset.scheduleId = schedule.id;
            checkboxCell.appendChild(checkbox);
            row.appendChild(checkboxCell);

            const mediaCell = document.createElement('td');
            const mediaElement = schedule.media_url.toLowerCase().endsWith('.mp4') ?
                document.createElement('video') :
                document.createElement('img');
            mediaElement.src = schedule.media_url;
            if (mediaElement.tagName === 'VIDEO') {
                mediaElement.controls = true;
            }
            mediaElement.classList.add('schedule-media');
            mediaCell.appendChild(mediaElement);
            row.appendChild(mediaCell);

            const captionCell = document.createElement('td');
            captionCell.textContent = schedule.caption || '-';
            row.appendChild(captionCell);

            const timeCell = document.createElement('td');
            const wibTime = convertToWIB(schedule.scheduled_time);
            timeCell.textContent = formatToLocaleString(wibTime);
            row.appendChild(timeCell);

            const statusCell = document.createElement('td');
            statusCell.textContent = schedule.status || 'Pending';
            row.appendChild(statusCell);

            const actionCell = document.createElement('td');
            const deleteBtn = document.createElement('button');
            deleteBtn.textContent = 'Hapus';
            deleteBtn.classList.add('delete-btn');
            deleteBtn.addEventListener('click', async () => {
                const confirmed = await showConfirmModal('Apakah Anda yakin ingin menghapus jadwal ini?');
                if (!confirmed) return;

                try {
                    showFloatingNotification('Menghapus jadwal...');
                    spinner.classList.remove('hidden');
                    const res = await fetch('/api/delete_schedules', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            accountNum: selectedAccountNum,
                            accountId: selectedAccountId,
                            scheduleIds: [schedule.id],
                        }),
                    });

                    if (!res.ok) {
                        throw new Error(`HTTP error! status: ${res.status}`);
                    }

                    const data = await res.json();
                    console.log('Delete response:', data);

                    if (data.success) {
                        showFloatingNotification('Jadwal berhasil dihapus.');
                        await loadSchedules();
                    } else {
                        throw new Error(data.message || 'Gagal menghapus jadwal.');
                    }
                } catch (error) {
                    showFloatingNotification(`Error deleting schedule: ${error.message}`, true);
                    console.error('Error deleting schedule:', error);
                } finally {
                    spinner.classList.add('hidden');
                }
            });
            actionCell.appendChild(deleteBtn);
            row.appendChild(actionCell);

            scheduleTableBody.appendChild(row);
        }

        displayedSchedules = end;
    }

    loadMoreBtn.addEventListener('click', () => {
        if (isLoadingSchedules) return;
        isLoadingSchedules = true;

        displaySchedules();
        loadMoreBtn.classList.toggle('hidden', displayedSchedules >= allSchedules.length);
        isLoadingSchedules = false;
    });

    selectAll.addEventListener('change', (e) => {
        const checkboxes = scheduleTableBody.querySelectorAll('input[type="checkbox"]');
        checkboxes.forEach(checkbox => {
            checkbox.checked = e.target.checked;
        });
    });

    deleteSelected.addEventListener('click', async () => {
        const selectedSchedules = Array.from(scheduleTableBody.querySelectorAll('input[type="checkbox"]:checked'))
            .map(checkbox => checkbox.dataset.scheduleId)
            .filter(id => id);

        if (selectedSchedules.length === 0) {
            showFloatingNotification('Pilih setidaknya satu jadwal untuk dihapus.', true);
            return;
        }

        const confirmed = await showConfirmModal(`Apakah Anda yakin ingin menghapus ${selectedSchedules.length} jadwal yang dipilih?`);
        if (!confirmed) return;

        try {
            showFloatingNotification('Menghapus jadwal...');
            spinner.classList.remove('hidden');
            const res = await fetch('/api/delete_schedules', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    accountNum: selectedAccountNum,
                    accountId: selectedAccountId,
                    scheduleIds: selectedSchedules,
                }),
            });

            if (!res.ok) {
                throw new Error(`HTTP error! status: ${res.status}`);
            }

            const data = await res.json();
            console.log('Delete response:', data);

            if (data.success) {
                showFloatingNotification('Jadwal berhasil dihapus.');
                await loadSchedules();
            } else {
                throw new Error(data.message || 'Gagal menghapus jadwal.');
            }
        } catch (error) {
            showFloatingNotification(`Error deleting schedules: ${error.message}`, true);
            console.error('Error deleting schedules:', error);
        } finally {
            spinner.classList.add('hidden');
        }
    });

    scheduleAll.addEventListener('click', () => {
        const startTime = startDateTime.value;
        if (!startTime) {
            showFloatingNotification('Masukkan tanggal dan jam awal untuk menjadwalkan.', true);
            return;
        }

        if (allMediaFiles.length === 0) {
            showFloatingNotification('Tidak ada file media untuk dijadwalkan.', true);
            return;
        }

        const startDate = new Date(startTime);
        const interval = skipDay.checked ? 2 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000; // 2 hari atau 1 hari

        allMediaFiles.forEach((file, index) => {
            const scheduleTime = new Date(startDate.getTime() + index * interval);
            const scheduleInput = gallery.querySelector(`input[data-filename="${file.name}"]`);
            if (scheduleInput) {
                scheduleInput.value = formatToDatetimeLocal(scheduleTime);
                scheduledTimes[file.name] = scheduleInput.value;
            }
        });

        showFloatingNotification('Jadwal telah diatur untuk semua file.');
    });

    saveSchedules.addEventListener('click', async () => {
        if (!selectedAccountNum || !selectedAccountId) {
            showFloatingNotification('Pilih akun dan username IG terlebih dahulu.', true);
            return;
        }

        const schedulesToSave = [];
        let hasError = false;

        for (const file of allMediaFiles) {
            const filename = file.name;
            const scheduledTime = scheduledTimes[filename];
            const caption = captions[filename] || '';

            if (!scheduledTime) {
                showFloatingNotification(`Masukkan waktu jadwal untuk file ${filename}.`, true);
                hasError = true;
                break;
            }

            const wibTime = new Date(scheduledTime);
            const utcTime = new Date(wibTime.getTime() - (7 * 60 * 60 * 1000)); // Konversi ke UTC

            schedulesToSave.push({
                media_url: file.download_url,
                caption: caption,
                scheduled_time: utcTime.toISOString(),
            });
        }

        if (hasError) return;

        if (schedulesToSave.length === 0) {
            showFloatingNotification('Tidak ada jadwal untuk disimpan.', true);
            return;
        }

        try {
            showFloatingNotification('Menyimpan jadwal...');
            spinner.classList.remove('hidden');
            const res = await fetch('/api/save_schedules', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    accountNum: selectedAccountNum,
                    accountId: selectedAccountId,
                    schedules: schedulesToSave,
                }),
            });

            if (!res.ok) {
                throw new Error(`HTTP error! status: ${res.status}`);
            }

            const data = await res.json();
            console.log('Save schedules response:', data);

            if (data.success) {
                showFloatingNotification('Jadwal berhasil disimpan.');
                await loadSchedules();
                gallery.innerHTML = '';
                allMediaFiles = [];
                captions = {};
                scheduledTimes = {};
                githubFolder.value = 'ig';
                githubSubfolder.innerHTML = '<option value="">-- Pilih Subfolder --</option>';
                subfolderContainer.classList.add('hidden');
            } else {
                throw new Error(data.message || 'Gagal menyimpan jadwal.');
            }
        } catch (error) {
            showFloatingNotification(`Error saving schedules: ${error.message}`, true);
            console.error('Error saving schedules:', error);
        } finally {
            spinner.classList.add('hidden');
        }
    });

    loadGithubFolders();
});
