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
    const githubSubSubfolder = document.getElementById('githubSubSubfolder');
    const subSubfolderContainer = document.getElementById('subSubfolderContainer');
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
    const startDateTime = document.getElementById('startDateTime');
    const skipDay = document.getElementById('skipDay');
    const scheduleAll = document.getElementById('scheduleAll');
    const saveSchedules = document.getElementById('saveSchedules');
    const loadMoreBtn = document.getElementById('loadMore');
    const totalSchedules = document.getElementById('totalSchedules');
    const uploadFolderSelect = document.getElementById('uploadFolderSelect');
    const uploadSubfolderSelect = document.getElementById('uploadSubfolderSelect');
    const uploadFolderInput = document.getElementById('uploadFolderInput');
    let selectedToken = null;
    let selectedUsername = null;
    let selectedAccountNum = null;
    let selectedAccountId = null;
    let allSubfolders = [];
    let allSubSubfolders = [];
    let allMediaFiles = [];
    let captions = {};
    let scheduledTimes = {};
    let allSchedules = [];
    let currentPage = 1;
    const ITEMS_PER_PAGE = 15;
    let isLoadingSchedules = false;

    let currentFolder = '';
    let currentSubfolder = '';
    let currentCustomFolder = '';

    function convertToWIB(utcTime) {
        const date = new Date(utcTime);
        const wibOffset = 7 * 60 * 60 * 1000;
        const wibTime = new Date(date.getTime() + wibOffset);
        return wibTime;
    }

    function formatToDatetimeLocal(wibTime) {
        return wibTime.toISOString().slice(0, 16);
    }

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

    function debounce(func, wait) {
        let timeout;
        return function (...args) {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, args), wait);
        };
    }

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

    if (localStorage.getItem('theme') === 'dark') {
        document.body.classList.add('dark-mode');
    }

    themeToggle.addEventListener('click', () => {
        themeMenu.classList.toggle('hidden');
    });

    toggleDarkMode.addEventListener('click', () => {
        document.body.classList.toggle('dark-mode');
        const isDarkMode = document.body.classList.contains('dark-mode');
        localStorage.setItem('theme', isDarkMode ? 'dark' : 'light');
        themeMenu.classList.add('hidden');
    });

    form.addEventListener('submit', (e) => {
        e.preventDefault();
    });

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
            accountIdLabel.style.display = 'block';
            accountIdLabel.textContent = 'Username IG';

            await fetchIgAccounts(`Akun ${accountNum}`);
            await loadSchedules();
        } catch (error) {
            showFloatingNotification(`Error fetching accounts: ${error.message}`, true);
            console.error('Error fetching accounts:', error);
            accountId.innerHTML = '<option value="">-- Gagal Memuat --</option>';
            accountIdContainer.classList.add('hidden');
            accountIdLabel.style.display = 'none';
        }
    });

    function updateScheduleVisibility(schedules) {
        const deleteContainer = document.getElementById('deleteContainer');
        const noScheduleMessage = document.getElementById('noScheduleMessage');
        const scheduleTableBody = document.getElementById('scheduleTableBody');
        const loadMoreContainer = document.querySelector('.load-more-container');

        if (!schedules || schedules.length === 0) {
            deleteContainer.style.display = 'none';
            noScheduleMessage.classList.remove('hidden');
            scheduleTableBody.innerHTML = '';
            totalSchedules.textContent = 'Total: 0 jadwal';
            loadMoreContainer.innerHTML = '';
        } else {
            deleteContainer.style.display = 'flex';
            noScheduleMessage.classList.add('hidden');
            totalSchedules.textContent = `Total: ${schedules.length} jadwal`;
            renderSchedules(schedules.slice(0, ITEMS_PER_PAGE), 0);
            currentPage = 1;
            renderPagination(schedules);
        }
    }

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
            return [];
        } finally {
            spinner.classList.add('hidden');
        }
    }

    async function fetchSubSubfolders(path) {
        showFloatingNotification('Memuat daftar folder...');
        spinner.classList.remove('hidden');
        try {
            const res = await fetch(`/api/get_github_files?path=${path}`);
            if (!res.ok) {
                throw new Error(`HTTP error! status: ${res.status}`);
            }
            const data = await res.json();
            console.log(`Sub-subfolders fetched for path ${path}:`, data);

            allSubSubfolders = [];
            data.files.forEach(item => {
                if (item.type === 'dir') {
                    allSubSubfolders.push({
                        name: item.name,
                        path: item.path,
                    });
                }
            });

            allSubSubfolders.sort(naturalSort);
            return allSubSubfolders;
        } catch (error) {
            console.error(`Error fetching sub-subfolders for path ${path}:`, error);
            showFloatingNotification(`Error loading sub-subfolders: ${error.message}`, true);
            return [];
        } finally {
            spinner.classList.add('hidden');
        }
    }

    async function fetchFilesInSubfolder(path) {
        showFloatingNotification('Memuat daftar file...');
        spinner.classList.remove('hidden');
        try {
            const res = await fetch(`/api/get_github_files?path=${path}`);
            if (!res.ok) {
                throw new Error(`HTTP error! status: ${res.status}`);
            }
            const data = await res.json();
            console.log(`Files fetched for path ${path}:`, data);

            allMediaFiles = [];
            const mediaFiles = data.files.filter(item => 
                item.type === 'file' && 
                (item.name.endsWith('.jpg') || item.name.endsWith('.png') || item.name.endsWith('.mp4'))
            );
            const totalFiles = mediaFiles.length;

            if (totalFiles === 0) {
                showFloatingNotification('Tidak ada file media yang didukung di folder ini.', true);
                spinner.classList.add('hidden');
                return allMediaFiles;
            }

            let loadedCount = 0;
            for (const item of mediaFiles) {
                loadedCount++;
                showFloatingNotification(`Memuat file ${loadedCount} dari ${totalFiles}...`, false, 0);
                allMediaFiles.push({
                    name: item.name,
                    path: item.path,
                    download_url: item.download_url,
                });
                await new Promise(resolve => setTimeout(resolve, 500));
            }

            allMediaFiles.sort(naturalSort);

            const metaPaths = allMediaFiles.map(file => {
                const folderPath = file.path.substring(0, file.path.lastIndexOf('/'));
                const metaFileName = `${file.name}.meta.json`;
                return `${folderPath}/${metaFileName}`;
            });

            showFloatingNotification(`Memuat metadata untuk ${totalFiles} file...`, false, 0);
            let metaLoadedCount = 0;

            try {
                const metaRes = await fetch(`/api/get_file_content?${metaPaths.map(path => `paths=${encodeURIComponent(path)}`).join('&')}`);
                if (!metaRes.ok) {
                    throw new Error(`HTTP error fetching metadata! status: ${metaRes.status}`);
                }
                const metaData = await metaRes.json();
                console.log('Metadata fetched from API:', metaData);

                allMediaFiles.forEach(file => {
                    const folderPath = file.path.substring(0, file.path.lastIndexOf('/'));
                    const metaPath = `${folderPath}/${file.name}.meta.json`;
                    if (metaData && metaData[metaPath] && typeof metaData[metaPath].caption === 'string') {
                        captions[file.path] = metaData[metaPath].caption;
                    } else {
                        captions[file.path] = '';
                        console.log(`No valid metadata found for ${metaPath}, using empty caption.`);
                    }
                    metaLoadedCount++;
                    showFloatingNotification(`Memuat metadata ${metaLoadedCount}/${totalFiles}...`, false, 0);
                });

                showFloatingNotification(`Berhasil memuat metadata untuk ${metaLoadedCount}/${totalFiles} file.`, false, 3000);
            } catch (error) {
                console.error('Error fetching metadata:', error);
                allMediaFiles.forEach(file => {
                    captions[file.path] = '';
                    metaLoadedCount++;
                    showFloatingNotification(`Memuat metadata ${metaLoadedCount}/${totalFiles}...`, false, 0);
                });
                showFloatingNotification('Gagal memuat metadata. Menggunakan caption kosong.', true);
            }

            showFloatingNotification(`Berhasil memuat ${totalFiles} file.`, false, 3000);
            return allMediaFiles;
        } catch (error) {
            console.error(`Error fetching files for path ${path}:`, error);
            showFloatingNotification(`Error loading files: ${error.message}`, true);
            return [];
        } finally {
            setTimeout(() => {
                spinner.classList.add('hidden');
            }, 3000);
        }
    }

    githubFolder.addEventListener('change', async () => {
        const folderPath = githubFolder.value;
        allMediaFiles = [];
        captions = {};
        scheduledTimes = {};
        gallery.innerHTML = '';
        mediaUrl.value = '';

        const subfolderContainer = document.getElementById('subfolderContainer');
        const subfolderLabel = document.querySelector('label[for="githubSubfolder"]');
        const scheduleAllContainer = document.querySelector('.schedule-all-container');
        scheduleAllContainer.style.display = 'none';

        // Reset sub-subfolder dropdown
        subSubfolderContainer.classList.add('hidden');
        githubSubSubfolder.innerHTML = '<option value="">-- Pilih Folder --</option>';

        if (!folderPath || folderPath === 'ig') {
            subfolderContainer.classList.add('hidden');
            subfolderLabel.style.display = 'none';
            githubSubfolder.innerHTML = '<option value="">-- Pilih Subfolder --</option>';
            return;
        }

        try {
            if (folderPath === 'ig/image') {
                subfolderContainer.classList.add('hidden');
                subfolderLabel.style.display = 'none';
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
                subfolderLabel.style.display = 'block';
                subfolderLabel.textContent = 'Subfolder';
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
            subfolderLabel.style.display = 'none';
        }
    });

    githubSubfolder.addEventListener('change', async () => {
        const subfolderPath = githubSubfolder.value;
        allMediaFiles = [];
        captions = {};
        scheduledTimes = {};
        gallery.innerHTML = '';
        mediaUrl.value = '';

        const scheduleAllContainer = document.querySelector('.schedule-all-container');
        scheduleAllContainer.style.display = 'none';

        // Reset sub-subfolder dropdown
        subSubfolderContainer.classList.add('hidden');
        githubSubSubfolder.innerHTML = '<option value="">-- Pilih Folder --</option>';

        if (!subfolderPath) {
            return;
        }

        try {
            const subSubfolders = await fetchSubSubfolders(subfolderPath);
            console.log('All sub-subfolders found:', subSubfolders);

            if (subSubfolders.length === 0) {
                const files = await fetchFilesInSubfolder(subfolderPath);
                allMediaFiles = files;
                displayGallery(files);

                if (files.length === 0) {
                    showFloatingNotification('No supported media files found in this subfolder.', true);
                } else {
                    showFloatingNotification('');
                }
            } else {
                subSubfolderContainer.classList.remove('hidden');
                githubSubSubfolder.innerHTML = '<option value="">-- Pilih Folder --</option>';
                subSubfolders.forEach(subSubfolder => {
                    const option = document.createElement('option');
                    option.value = subSubfolder.path;
                    option.textContent = subSubfolder.name;
                    githubSubSubfolder.appendChild(option);
                });

                if (githubSubSubfolder.options.length === 1) {
                    showFloatingNotification('No folders found in this subfolder.', true);
                } else {
                    showFloatingNotification('');
                }
            }
        } catch (error) {
            showFloatingNotification(`Error loading sub-subfolders: ${error.message}`, true);
            console.error('Error fetching sub-subfolders:', error);
            subSubfolderContainer.classList.add('hidden');
        }
    });

    githubSubSubfolder.addEventListener('change', async () => {
        const subSubfolderPath = githubSubSubfolder.value;
        allMediaFiles = [];
        captions = {};
        scheduledTimes = {};
        gallery.innerHTML = '';
        mediaUrl.value = '';

        const scheduleAllContainer = document.querySelector('.schedule-all-container');
        scheduleAllContainer.style.display = 'none';

        if (!subSubfolderPath) {
            return;
        }

        try {
            const files = await fetchFilesInSubfolder(subSubfolderPath);
            console.log('All media files found:', files);
            allMediaFiles = files;

            displayGallery(files);

            if (files.length === 0) {
                showFloatingNotification('No supported media files found in this folder.', true);
            } else {
                showFloatingNotification('');
            }
        } catch (error) {
            showFloatingNotification(`Error loading files: ${error.message}`, true);
            console.error('Error fetching files:', error);
        }
    });

    async function loadUploadFolders() {
        try {
            const res = await fetch('/api/get_github_files?path=ig');
            if (!res.ok) {
                throw new Error(`HTTP error! status: ${res.status}`);
            }
            const data = await res.json();
            const folders = data.files.filter(item => item.type === 'dir');
            folders.sort(naturalSort);

            uploadFolderSelect.innerHTML = '<option value="">-- Pilih Folder --</option>';
            
            const defaultOption = document.createElement('option');
            defaultOption.value = 'ig/image';
            defaultOption.textContent = 'ig/image';
            uploadFolderSelect.appendChild(defaultOption);

            folders.forEach(item => {
                if (item.path !== 'ig/image') {
                    const option = document.createElement('option');
                    option.value = item.path;
                    option.textContent = item.name;
                    uploadFolderSelect.appendChild(option);
                }
            });

            const customOption = document.createElement('option');
            customOption.value = 'custom';
            customOption.textContent = 'Tambah Folder Baru';
            uploadFolderSelect.appendChild(customOption);

            uploadFolderSelect.value = '';
            uploadSubfolderSelect.style.display = 'none';
            uploadSubfolderSelect.innerHTML = '<option value="">-- Pilih Subfolder --</option>';
            uploadFolderInput.style.display = 'none';
            uploadFolderInput.value = '';

            if (currentFolder) {
                uploadFolderSelect.value = currentFolder;
                if (currentFolder === 'custom' && currentCustomFolder) {
                    uploadFolderInput.style.display = 'block';
                    uploadFolderInput.value = currentCustomFolder;
                } else if (currentFolder) {
                    const subfolders = await fetchSubfolders(currentFolder);
                    if (subfolders.length > 0) {
                        uploadSubfolderSelect.style.display = 'block';
                        uploadSubfolderSelect.innerHTML = '<option value="">-- Pilih Subfolder --</option>';
                        subfolders.forEach(subfolder => {
                            const option = document.createElement('option');
                            option.value = subfolder.path;
                            option.textContent = subfolder.name;
                            uploadSubfolderSelect.appendChild(option);
                        });
                        const customSubfolderOption = document.createElement('option');
                        customSubfolderOption.value = 'custom';
                        customSubfolderOption.textContent = 'Tambah Folder Baru';
                        uploadSubfolderSelect.appendChild(customSubfolderOption);

                        if (currentSubfolder) {
                            uploadSubfolderSelect.value = currentSubfolder;
                        }
                    } else if (currentCustomFolder) {
                        uploadFolderInput.style.display = 'block';
                        uploadFolderInput.value = currentCustomFolder;
                    }
                }
            }
        } catch (error) {
            console.error('Error loading upload folders:', error);
            showFloatingNotification(`Error loading upload folders: ${error.message}`, true);
        }
    }

    uploadFolderSelect.addEventListener('change', async () => {
        const folderPath = uploadFolderSelect.value;
        currentFolder = folderPath;
        currentSubfolder = '';
        currentCustomFolder = '';

        uploadSubfolderSelect.style.display = 'none';
        uploadSubfolderSelect.innerHTML = '<option value="">-- Pilih Subfolder --</option>';
        uploadFolderInput.style.display = 'none';
        uploadFolderInput.value = '';

        if (folderPath === 'custom') {
            uploadFolderInput.style.display = 'block';
            uploadFolderInput.focus();
        } else if (folderPath) {
            try {
                const subfolders = await fetchSubfolders(folderPath);
                if (subfolders.length > 0) {
                    uploadSubfolderSelect.style.display = 'block';
                    subfolders.forEach(subfolder => {
                        const option = document.createElement('option');
                        option.value = subfolder.path;
                        option.textContent = subfolder.name;
                        uploadSubfolderSelect.appendChild(option);
                    });
                    const customSubfolderOption = document.createElement('option');
                    customSubfolderOption.value = 'custom';
                    customSubfolderOption.textContent = 'Tambah Folder Baru';
                    uploadSubfolderSelect.appendChild(customSubfolderOption);
                } else {
                    uploadFolderInput.style.display = 'block';
                    uploadFolderInput.placeholder = 'Masukkan subfolder (opsional)';
                }
            } catch (error) {
                showFloatingNotification(`Error loading subfolders: ${error.message}`, true);
                console.error('Error fetching subfolders:', error);
            }
        }
    });

    uploadSubfolderSelect.addEventListener('change', () => {
        const subfolderPath = uploadSubfolderSelect.value;
        currentSubfolder = subfolderPath;
        if (subfolderPath === 'custom') {
            uploadFolderInput.style.display = 'block';
            uploadFolderInput.placeholder = 'Masukkan nama subfolder baru';
            uploadFolderInput.value = '';
            currentCustomFolder = '';
        } else if (subfolderPath) {
            uploadFolderInput.style.display = 'none';
            uploadFolderInput.value = '';
            currentCustomFolder = '';
        } else {
            uploadFolderInput.style.display = 'block';
            uploadFolderInput.placeholder = 'Masukkan subfolder (opsional)';
            currentCustomFolder = '';
        }
    });

    uploadFolderInput.addEventListener('input', () => {
        currentCustomFolder = uploadFolderInput.value.trim();
    });

    loadUploadFolders();

    uploadToGithub.addEventListener('click', async () => {
        if (!uploadFile.files || uploadFile.files.length === 0) {
            showFloatingNotification('Pilih file terlebih dahulu.', true);
            return;
        }

        let uploadFolderValue;
        if (uploadFolderSelect.value === 'custom') {
            uploadFolderValue = uploadFolderInput.value.trim();
            if (!uploadFolderValue) {
                showFloatingNotification('Masukkan path folder tujuan.', true);
                return;
            }
        } else if (uploadFolderSelect.value) {
            uploadFolderValue = uploadFolderSelect.value;
            if (uploadSubfolderSelect.value === 'custom') {
                const newSubfolder = uploadFolderInput.value.trim();
                if (!newSubfolder) {
                    showFloatingNotification('Masukkan nama subfolder baru.', true);
                    return;
                }
                uploadFolderValue = `${uploadFolderValue}/${newSubfolder}`;
            } else if (uploadSubfolderSelect.value) {
                uploadFolderValue = uploadSubfolderSelect.value;
            } else if (uploadFolderInput.value.trim()) {
                uploadFolderValue = `${uploadFolderValue}/${uploadFolderInput.value.trim()}`;
            }
        }

        if (!uploadFolderValue) {
            uploadFolderValue = 'ig/image';
        } else {
            if (!uploadFolderValue.startsWith('ig/')) {
                uploadFolderValue = `ig/${uploadFolderValue}`;
            }

            const invalidChars = /[<>:"|?*]/;
            if (invalidChars.test(uploadFolderValue)) {
                showFloatingNotification('Path folder tujuan mengandung karakter yang tidak diizinkan.', true);
                return;
            }
        }

        const files = Array.from(uploadFile.files);

        const mediaFiles = files.filter(file => {
            const fileName = file.name.toLowerCase();
            return fileName.endsWith('.jpg') || 
                   fileName.endsWith('.jpeg') || 
                   fileName.endsWith('.png') || 
                   fileName.endsWith('.mp4');
        });

        const metaFiles = files.filter(file => {
            const fileName = file.name.toLowerCase();
            return fileName.endsWith('.json');
        });

        if (mediaFiles.length === 0) {
            showFloatingNotification('Pilih setidaknya satu file media (JPG, JPEG, PNG, atau MP4).', true);
            return;
        }

        const metaFileMap = {};
        metaFiles.forEach(metaFile => {
            const baseName = metaFile.name.replace(/\.meta\.json$/i, '');
            metaFileMap[baseName] = metaFile;
        });

        let uploadedCount = 0;
        const totalFiles = mediaFiles.length;
        showFloatingNotification(`Mengunggah file 1 dari ${totalFiles}...`);
        spinner.classList.remove('hidden');

        try {
            for (const file of mediaFiles) {
                const reader = new FileReader();
                const result = await new Promise((resolve, reject) => {
                    reader.readAsDataURL(file);
                    reader.onload = async () => {
                        try {
                            const base64Content = reader.result.split(',')[1];
                            let newFileName;

                            if (uploadFolderValue && uploadFolderValue !== 'ig/image') {
                                newFileName = file.name;
                            } else {
                                const randomNum = Math.floor(10000 + Math.random() * 90000);
                                const extension = file.name.split('.').pop();
                                newFileName = `${randomNum}.${extension}`;
                            }

                            const filePath = `${uploadFolderValue}/${newFileName}`;
                            const commitMessage = uploadFolderValue.startsWith('ig/') 
                                ? `Upload ${newFileName} to ${uploadFolderValue} [vercel-skip]` 
                                : `Upload ${newFileName} to ${uploadFolderValue}`;

                            console.log(`Uploading file: ${filePath}`);

                            const fileResponse = await fetch('/api/upload_to_github', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                    fileName: filePath,
                                    content: base64Content,
                                    message: commitMessage,
                                }),
                            });

                            if (!fileResponse.ok) {
                                const errorData = await fileResponse.json();
                                throw new Error(`HTTP error uploading file ${newFileName}! status: ${fileResponse.status}, details: ${errorData.error}`);
                            }

                            const fileResult = await fileResponse.json();
                            const newFile = {
                                name: newFileName,
                                path: filePath,
                                download_url: fileResult.download_url,
                            };

                            const originalFileName = file.name;
                            let metaContent = { caption: '' };
                            let metaBase64Content;

                            if (metaFileMap[originalFileName]) {
                                const metaFile = metaFileMap[originalFileName];
                                const metaReader = new FileReader();
                                const metaResult = await new Promise((metaResolve, metaReject) => {
                                    metaReader.readAsText(metaFile);
                                    metaReader.onload = () => {
                                        try {
                                            const content = JSON.parse(metaReader.result);
                                            if (content.caption) {
                                                metaContent = { caption: content.caption };
                                            }
                                            metaResolve();
                                        } catch (error) {
                                            metaReject(new Error(`Error parsing meta JSON for ${metaFile.name}: ${error.message}`));
                                        }
                                    };
                                    metaReader.onerror = () => metaReject(new Error(`Error reading meta file ${metaFile.name}`));
                                });

                                console.log(`Using provided meta JSON for ${originalFileName}:`, metaContent);
                            } else {
                                console.log(`No meta JSON provided for ${originalFileName}, creating default.`);
                            }

                            const metaFileName = `${uploadFolderValue}/${newFileName}.meta.json`;
                            const metaContentString = JSON.stringify(metaContent, null, 2);
                            metaBase64Content = btoa(unescape(encodeURIComponent(metaContentString)));
                            const metaCommitMessage = uploadFolderValue.startsWith('ig/') 
                                ? `Upload meta for ${newFileName} to ${uploadFolderValue} [vercel-skip]` 
                                : `Upload meta for ${newFileName} to ${uploadFolderValue}`;

                            console.log(`Uploading meta file: ${metaFileName}`);

                            const metaResponse = await fetch('/api/upload_to_github', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                    fileName: metaFileName,
                                    content: metaBase64Content,
                                    message: metaCommitMessage,
                                }),
                            });

                            const metaResponseData = await metaResponse.json();
                            if (!metaResponse.ok) {
                                console.error(`Meta upload failed: ${metaResponseData.error}`);
                                showFloatingNotification(`Gagal mengunggah meta untuk ${newFileName}: ${metaResponseData.error}`, true);
                            } else {
                                console.log(`Meta file uploaded successfully: ${metaFileName}`);
                            }

                            allMediaFiles.push(newFile);
                            captions[newFile.path] = metaContent.caption || '';
                            uploadedCount++;
                            if (uploadedCount < totalFiles) {
                                showFloatingNotification(`Mengunggah file ${uploadedCount + 1} dari ${totalFiles}...`);
                            }

                            resolve(newFile);
                        } catch (error) {
                            console.error(`Error in upload process for ${file.name}:`, error);
                            reject(error);
                        }
                    };
                    reader.onerror = () => reject(new Error(`Error reading file ${file.name}`));
                });
            }

            showFloatingNotification(`${mediaFiles.length} file media berhasil diunggah ke GitHub!`);
            displayGallery(allMediaFiles);

            await loadUploadFolders();
        } catch (error) {
            showFloatingNotification(`Error uploading to GitHub: ${error.message}`, true);
            console.error('Error uploading to GitHub:', error);
        } finally {
            spinner.classList.add('hidden');
            uploadFile.value = '';
        }
    });

    async function deletePhoto(filePath) {
        showFloatingNotification(`Menghapus ${filePath}...`);
        spinner.classList.remove('hidden');

        try {
            const folderPath = filePath.substring(0, filePath.lastIndexOf('/'));
            const commitMessage = folderPath.startsWith('ig/') 
                ? `Delete file ${filePath} [vercel-skip]` 
                : `Delete file ${filePath}`;

            const deleteResponse = await fetch('/api/delete_from_github', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    path: filePath,
                    message: commitMessage,
                }),
            });

            if (!deleteResponse.ok) {
                throw new Error(`HTTP error deleting file from GitHub! status: ${deleteResponse.status}`);
            }

            const deleteResult = await deleteResponse.json();
            showFloatingNotification(`${deleteResult.message}`);

            allMediaFiles = allMediaFiles.filter(f => f.path !== filePath);
            delete captions[filePath];
            delete scheduledTimes[filePath];
            displayGallery(allMediaFiles);
        } catch (error) {
            showFloatingNotification(`Gagal menghapus file dari GitHub: ${error.message}`, true);
            console.error('Error deleting file from GitHub:', error);
        } finally {
            spinner.classList.add('hidden');
        }
    }

    async function saveCaptionToGithub(file, caption, commitMessage) {
        try {
            const folderPath = file.path.substring(0, file.path.lastIndexOf('/'));
            const metaFileName = `${file.name}.meta.json`;
            const metaPath = `${folderPath}/${metaFileName}`;
            const metaContent = JSON.stringify({ caption: caption }, null, 2);
            const base64Content = btoa(unescape(encodeURIComponent(metaContent)));

            const response = await fetch('/api/upload_to_github', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    fileName: metaPath,
                    content: base64Content,
                    message: commitMessage,
                }),
            });

            if (!response.ok) {
                throw new Error(`HTTP error uploading meta file! status: ${response.status}`);
            }

            const result = await response.json();
            showFloatingNotification(`Caption untuk ${file.name} berhasil disimpan!`);
        } catch (error) {
            showFloatingNotification(`Gagal menyimpan caption: ${error.message}`, true);
            console.error('Error saving caption to GitHub:', error);
        }
    }

    function displayGallery(files) {
        gallery.innerHTML = '';
        const scheduleAllContainer = document.querySelector('.schedule-all-container');
        if (files.length === 0) {
            scheduleAllContainer.style.display = 'none';
            return;
        }

        scheduleAllContainer.style.display = 'block';

        files.forEach((file, index) => {
            const galleryItem = document.createElement('div');
            galleryItem.classList.add('gallery-item');

            const mediaElement = file.name.endsWith('.mp4') 
                ? document.createElement('video') 
                : document.createElement('img');
            mediaElement.src = file.download_url;
            if (file.name.endsWith('.mp4')) {
                mediaElement.controls = true;
            }
            mediaElement.alt = file.name;
            mediaElement.classList.add('gallery-media');

            const captionTextarea = document.createElement('textarea');
            captionTextarea.classList.add('caption-input');
            captionTextarea.placeholder = 'Masukkan caption...';
            captionTextarea.value = captions[file.path] || '';
            captionTextarea.addEventListener('input', (e) => {
                captions[file.path] = e.target.value;
            });

            const saveCaptionBtn = document.createElement('button');
            saveCaptionBtn.textContent = 'Simpan Caption';
            saveCaptionBtn.classList.add('save-caption-btn');
            saveCaptionBtn.addEventListener('click', async () => {
                const caption = captions[file.path] || '';
                const folderPath = file.path.substring(0, file.path.lastIndexOf('/'));
                const commitMessage = folderPath.startsWith('ig/') 
                    ? `Update caption for ${file.name} in ${folderPath} [vercel-skip]` 
                    : `Update caption for ${file.name} in ${folderPath}`;
                await saveCaptionToGithub(file, caption, commitMessage);
            });

            const scheduleInput = document.createElement('input');
            scheduleInput.type = 'datetime-local';
            scheduleInput.classList.add('schedule-input');
            if (scheduledTimes[file.path]) {
                const wibTime = convertToWIB(scheduledTimes[file.path]);
                scheduleInput.value = formatToDatetimeLocal(wibTime);
            }
            scheduleInput.addEventListener('change', (e) => {
                const selectedTime = new Date(e.target.value);
                scheduledTimes[file.path] = selectedTime.toISOString();
            });

            const deleteBtn = document.createElement('button');
            deleteBtn.textContent = 'Hapus';
            deleteBtn.classList.add('delete-btn');
            deleteBtn.addEventListener('click', async () => {
                const confirmed = await showConfirmModal(`Apakah Anda yakin ingin menghapus ${file.name}?`);
                if (confirmed) {
                    await deletePhoto(file.path);
                }
            });

            galleryItem.appendChild(mediaElement);
            galleryItem.appendChild(captionTextarea);
            galleryItem.appendChild(saveCaptionBtn);
            galleryItem.appendChild(scheduleInput);
            galleryItem.appendChild(deleteBtn);
            gallery.appendChild(galleryItem);
        });
    }

    async function loadSchedules() {
        if (isLoadingSchedules) return;
        isLoadingSchedules = true;
        showFloatingNotification('Memuat jadwal...');
        spinner.classList.remove('hidden');

        try {
            let url = `/api/get_schedules?limit=${ITEMS_PER_PAGE}&page=${currentPage}`;
            if (selectedAccountNum) {
                url += `&accountNum=${selectedAccountNum}`;
            }
            if (selectedAccountId) {
                url += `&accountId=${selectedAccountId}`;
            }

            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`HTTP error fetching schedules! status: ${response.status}`);
            }
            const data = await response.json();
            console.log('Schedules fetched:', data);

            allSchedules = data.schedules || [];
            updateScheduleVisibility(allSchedules);
        } catch (error) {
            showFloatingNotification(`Error loading schedules: ${error.message}`, true);
            console.error('Error fetching schedules:', error);
            updateScheduleVisibility([]);
        } finally {
            spinner.classList.add('hidden');
            isLoadingSchedules = false;
        }
    }

    function renderSchedules(schedules, startIndex) {
        scheduleTableBody.innerHTML = '';
        schedules.forEach((schedule, index) => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${startIndex + index + 1}</td>
                <td><input type="checkbox" class="schedule-checkbox" data-id="${schedule.id}"></td>
                <td>${schedule.username || 'N/A'}</td>
                <td>
                    ${schedule.media_url ? (
                        schedule.media_url.endsWith('.mp4') 
                            ? `<video src="${schedule.media_url}" width="50" controls></video>` 
                            : `<img src="${schedule.media_url}" width="50" alt="Media">`
                    ) : 'No Media'}
                </td>
                <td>${schedule.caption || 'No Caption'}</td>
                <td>${schedule.scheduled_time ? formatToLocaleString(convertToWIB(schedule.scheduled_time)) : 'Not Scheduled'}</td>
                <td>${schedule.status || 'Pending'}</td>
                <td>
                    <button class="delete-schedule-btn" data-id="${schedule.id}">Hapus</button>
                </td>
            `;
            scheduleTableBody.appendChild(row);
        });

        document.querySelectorAll('.delete-schedule-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                const scheduleId = btn.dataset.id;
                const confirmed = await showConfirmModal('Apakah Anda yakin ingin menghapus jadwal ini?');
                if (confirmed) {
                    await deleteSchedule(scheduleId);
                }
            });
        });
    }

    async function deleteSchedule(scheduleId) {
        showFloatingNotification('Menghapus jadwal...');
        spinner.classList.remove('hidden');

        try {
            const response = await fetch(`/api/delete_schedule?id=${scheduleId}`, {
                method: 'DELETE',
            });

            if (!response.ok) {
                throw new Error(`HTTP error deleting schedule! status: ${response.status}`);
            }

            const result = await response.json();
            showFloatingNotification(`${result.message}`);
            await loadSchedules();
        } catch (error) {
            showFloatingNotification(`Gagal menghapus jadwal: ${error.message}`, true);
            console.error('Error deleting schedule:', error);
        } finally {
            spinner.classList.add('hidden');
        }
    }

    selectAll.addEventListener('change', (e) => {
        const checkboxes = document.querySelectorAll('.schedule-checkbox');
        checkboxes.forEach(checkbox => {
            checkbox.checked = e.target.checked;
        });
    });

    deleteSelected.addEventListener('click', async () => {
        const selectedCheckboxes = document.querySelectorAll('.schedule-checkbox:checked');
        if (selectedCheckboxes.length === 0) {
            showFloatingNotification('Pilih setidaknya satu jadwal untuk dihapus.', true);
            return;
        }

        const confirmed = await showConfirmModal(`Apakah Anda yakin ingin menghapus ${selectedCheckboxes.length} jadwal?`);
        if (!confirmed) return;

        showFloatingNotification('Menghapus jadwal terpilih...');
        spinner.classList.remove('hidden');

        try {
            const deletePromises = Array.from(selectedCheckboxes).map(checkbox => {
                const scheduleId = checkbox.dataset.id;
                return fetch(`/api/delete_schedule?id=${scheduleId}`, {
                    method: 'DELETE',
                }).then(response => {
                    if (!response.ok) {
                        throw new Error(`HTTP error deleting schedule ${scheduleId}! status: ${response.status}`);
                    }
                    return response.json();
                });
            });

            await Promise.all(deletePromises);
            showFloatingNotification(`${selectedCheckboxes.length} jadwal berhasil dihapus!`);
            await loadSchedules();
        } catch (error) {
            showFloatingNotification(`Gagal menghapus jadwal: ${error.message}`, true);
            console.error('Error deleting selected schedules:', error);
        } finally {
            spinner.classList.add('hidden');
        }
    });

    scheduleAll.addEventListener('click', async () => {
        if (!startDateTime.value) {
            showFloatingNotification('Pilih tanggal dan jam awal terlebih dahulu.', true);
            return;
        }

        if (!selectedToken || !selectedUsername || !selectedAccountId) {
            showFloatingNotification('Pilih akun dan username IG terlebih dahulu.', true);
            return;
        }

        const startTime = new Date(startDateTime.value);
        const skipDayChecked = skipDay.checked;
        let currentTime = startTime;

        showFloatingNotification('Menjadwalkan semua file...');
        spinner.classList.remove('hidden');

        try {
            for (const file of allMediaFiles) {
                const caption = captions[file.path] || '';
                const scheduledTime = scheduledTimes[file.path] || currentTime.toISOString();

                const response = await fetch('/api/schedule_post', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        accountNum: selectedAccountNum,
                        accountId: selectedAccountId,
                        username: selectedUsername,
                        token: selectedToken,
                        mediaUrl: file.download_url,
                        caption: caption,
                        scheduledTime: scheduledTime,
                    }),
                });

                if (!response.ok) {
                    throw new Error(`HTTP error scheduling post! status: ${response.status}`);
                }

                const result = await response.json();
                console.log(`Scheduled ${file.name}:`, result);

                if (skipDayChecked) {
                    currentTime.setDate(currentTime.getDate() + 1);
                } else {
                    currentTime.setMinutes(currentTime.getMinutes() + 1);
                }
            }

            showFloatingNotification(`${allMediaFiles.length} file berhasil dijadwalkan!`);
            await loadSchedules();
        } catch (error) {
            showFloatingNotification(`Error scheduling posts: ${error.message}`, true);
            console.error('Error scheduling posts:', error);
        } finally {
            spinner.classList.add('hidden');
        }
    });

    saveSchedules.addEventListener('click', async () => {
        if (!selectedToken || !selectedUsername || !selectedAccountId) {
            showFloatingNotification('Pilih akun dan username IG terlebih dahulu.', true);
            return;
        }

        showFloatingNotification('Menyimpan jadwal...');
        spinner.classList.remove('hidden');

        try {
            const schedulePromises = allMediaFiles.map(file => {
                if (!scheduledTimes[file.path]) return Promise.resolve();
                const caption = captions[file.path] || '';
                return fetch('/api/schedule_post', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        accountNum: selectedAccountNum,
                        accountId: selectedAccountId,
                        username: selectedUsername,
                        token: selectedToken,
                        mediaUrl: file.download_url,
                        caption: caption,
                        scheduledTime: scheduledTimes[file.path],
                    }),
                }).then(response => {
                    if (!response.ok) {
                        throw new Error(`HTTP error scheduling post! status: ${response.status}`);
                    }
                    return response.json();
                });
            });

            await Promise.all(schedulePromises);
            showFloatingNotification('Jadwal berhasil disimpan!');
            await loadSchedules();
        } catch (error) {
            showFloatingNotification(`Error saving schedules: ${error.message}`, true);
            console.error('Error saving schedules:', error);
        } finally {
            spinner.classList.add('hidden');
        }
    });

    loadMoreBtn.addEventListener('click', () => {
        currentPage++;
        const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
        const endIndex = startIndex + ITEMS_PER_PAGE;
        const nextSchedules = allSchedules.slice(startIndex, endIndex);
        renderSchedules(nextSchedules, startIndex);
        if (endIndex >= allSchedules.length) {
            loadMoreBtn.classList.add('hidden');
        }
    });

    function renderPagination(schedules) {
        const loadMoreContainer = document.querySelector('.load-more-container');
        loadMoreContainer.innerHTML = '';
        if (schedules.length > ITEMS_PER_PAGE) {
            loadMoreBtn.classList.remove('hidden');
            loadMoreContainer.appendChild(loadMoreBtn);
        }
    }

    loadGithubFolders();
    loadSchedules();
});