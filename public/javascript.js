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
    let allMediaFiles = [];
    let captions = {};
    let scheduledTimes = {};
    let allSchedules = [];
    let currentPage = 1;
    const ITEMS_PER_PAGE = 10;
    let isLoadingSchedules = false;

    // Fungsi untuk mengonversi waktu dari UTC ke WIB
    function convertToWIB(utcTime) {
        const date = new Date(utcTime);
        const wibOffset = 7 * 60 * 60 * 1000;
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

    // Fungsi untuk memperbarui visibilitas elemen berdasarkan jumlah jadwal
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
            loadMoreContainer.innerHTML = ''; // Kosongkan container pagination
        } else {
            deleteContainer.style.display = 'flex';
            noScheduleMessage.classList.add('hidden');
            totalSchedules.textContent = `Total: ${schedules.length} jadwal`;
            renderSchedules(schedules.slice(0, ITEMS_PER_PAGE), 0); // Tampilkan halaman pertama
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

        if (!subfolderPath) {
            return;
        }

        try {
            const files = await fetchFilesInSubfolder(subfolderPath);
            console.log('All media files found:', files);
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
        } catch (error) {
            console.error('Error loading upload folders:', error);
            showFloatingNotification(`Error loading upload folders: ${error.message}`, true);
        }
    }

    uploadFolderSelect.addEventListener('change', async () => {
        const folderPath = uploadFolderSelect.value;

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
        if (uploadSubfolderSelect.value) {
            uploadFolderInput.style.display = 'none';
            uploadFolderInput.value = '';
        } else {
            uploadFolderInput.style.display = 'block';
            uploadFolderInput.placeholder = 'Masukkan subfolder (opsional)';
        }
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
            if (uploadSubfolderSelect.value) {
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
            await loadGithubFolders();
        } catch (error) {
            showFloatingNotification(`Error uploading to GitHub: ${error.message}`, true);
            console.error('Error uploading to GitHub:', error);
        } finally {
            spinner.classList.add('hidden');
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
                throw new Error(`HTTP error uploading meta to GitHub! status: ${response.status}`);
            }

            console.log(`Meta file ${metaPath} saved to GitHub`);
            return true;
        } catch (error) {
            console.error(`Error saving meta file for ${file.name}:`, error);
            showFloatingNotification(`Error saving meta file for ${file.name}: ${error.message}`, true);
            return false;
        }
    }

    async function displayGallery(files) {
        gallery.innerHTML = '';

        console.log('Files received by displayGallery:', files);

        const imageFiles = files.filter(file => file.name && (file.name.endsWith('.jpg') || file.name.endsWith('.png')));

        console.log('Image files after filter:', imageFiles);

        const scheduleAllContainer = document.querySelector('.schedule-all-container');

        if (imageFiles.length === 0) {
            gallery.innerHTML = '<p>Tidak ada gambar untuk ditampilkan.</p>';
            scheduleAllContainer.style.display = 'none';
            return;
        }

        scheduleAllContainer.style.display = 'flex';

        let schedules = [];
        try {
            const schedulesResponse = await fetch('/api/get_schedules');
            if (!schedulesResponse.ok) {
                throw new Error(`Failed to fetch schedules: ${schedulesResponse.status}`);
            }
            schedules = await schedulesResponse.json();
            console.log('Schedules for gallery:', schedules);
        } catch (error) {
            console.error('Error fetching schedules:', error);
            showFloatingNotification('Gagal mengambil data jadwal. Galeri tetap ditampilkan tanpa jadwal.', true);
            schedules = { schedules: [] };
        }

        const withSchedule = [];
        const withoutSchedule = [];

        imageFiles.forEach(file => {
            if (scheduledTimes[file.path]) {
                withSchedule.push(file);
            } else {
                withoutSchedule.push(file);
            }
        });

        const sortedImageFiles = [...withSchedule, ...withoutSchedule];

        console.log('Sorted image files:', sortedImageFiles.map(file => file.name));

        function formatDateTime(date, hours, minutes) {
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            const formatted = `${year}-${month}-${day}T${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
            return formatted;
        }

        sortedImageFiles.forEach((file, index) => {
            const container = document.createElement('div');
            container.className = 'gallery-item';

            const img = document.createElement('img');
            img.src = file.download_url;
            img.alt = file.name;
            img.dataset.fileData = JSON.stringify(file);
            img.addEventListener('click', () => {
                gallery.querySelectorAll('img').forEach(i => i.classList.remove('selected'));
                img.classList.add('selected');
                mediaUrl.value = file.download_url;
            });

            const deleteDirectBtn = document.createElement('button');
            deleteDirectBtn.className = 'delete-direct-btn';
            deleteDirectBtn.textContent = '×';
            deleteDirectBtn.addEventListener('click', async () => {
                const confirmed = await showConfirmModal(`Apakah Anda yakin ingin menghapus ${file.name}?`);
                if (confirmed) {
                    await deletePhoto(file.path);
                }
            });
            container.appendChild(deleteDirectBtn);

            const name = document.createElement('p');
            name.textContent = file.name;

            const captionText = document.createElement('p');
            captionText.className = 'caption-text';
            captionText.textContent = captions[file.path] || 'Tidak ada caption';

            let isDragging = false;
            let startY = 0;
            let startScrollTop = 0;

            captionText.addEventListener('mousedown', (e) => {
                if (captionText.scrollHeight > captionText.clientHeight) {
                    isDragging = true;
                    startY = e.clientY;
                    startScrollTop = captionText.scrollTop;
                    captionText.style.cursor = 'grabbing';
                }
            });

            document.addEventListener('mousemove', (e) => {
                if (isDragging) {
                    const deltaY = e.clientY - startY;
                    captionText.scrollTop = startScrollTop - deltaY;
                }
            });

            document.addEventListener('mouseup', () => {
                if (isDragging) {
                    isDragging = false;
                    captionText.style.cursor = 'default';
                }
            });

            captionText.addEventListener('selectstart', (e) => {
                if (isDragging) {
                    e.preventDefault();
                }
            });

            const scheduleTime = document.createElement('p');
            scheduleTime.className = 'schedule-time';
            if (scheduledTimes[file.path]) {
                const date = new Date(scheduledTimes[file.path]);
                const formattedTime = date.toLocaleString('id-ID', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: false
                }).replace(',', '').replace(/(\d{2}):(\d{2})/, '$1.$2');
                scheduleTime.textContent = formattedTime;
                scheduleTime.classList.add('scheduled');
            } else {
                scheduleTime.textContent = 'Belum dijadwalkan';
                scheduleTime.classList.add('unscheduled');
            }

            const existingSchedule = schedules.schedules.find(schedule => schedule.mediaUrl === file.download_url);
            const scheduleId = existingSchedule ? existingSchedule.scheduleId : null;

            const buttonGroup = document.createElement('div');
            buttonGroup.className = 'button-group';

            const editBtn = document.createElement('button');
            editBtn.className = 'btn edit';
            editBtn.textContent = 'Edit';
            editBtn.addEventListener('click', () => {
                const editor = document.createElement('div');
                editor.className = 'caption-editor';
                const textarea = document.createElement('textarea');
                textarea.value = captions[file.path] || '';
                const buttonContainer = document.createElement('div');
                buttonContainer.className = 'editor-buttons';
                const saveBtn = document.createElement('button');
                saveBtn.textContent = 'Simpan';
                const saveSpinner = document.createElement('span');
                saveSpinner.className = 'editor-spinner hidden';
                saveBtn.appendChild(saveSpinner);
                saveBtn.addEventListener('click', async () => {
                    saveSpinner.classList.remove('hidden');
                    saveBtn.disabled = true;
                    captions[file.path] = textarea.value;

                    const folderPath = file.path.substring(0, file.path.lastIndexOf('/'));
                    const metaCommitMessage = folderPath.startsWith('ig/') 
                        ? `Update meta file for ${file.path} [vercel-skip]` 
                        : `Update meta file for ${file.path}`;

                    const success = await saveCaptionToGithub(file, captions[file.path], metaCommitMessage);
                    if (success) {
                        captionText.textContent = captions[file.path] || 'Tidak ada caption';
                        editor.remove();
                        showFloatingNotification(`Caption untuk ${file.name} berhasil disimpan.`);
                    }
                    saveSpinner.classList.add('hidden');
                    saveBtn.disabled = false;
                });

                const cancelBtn = document.createElement('button');
                cancelBtn.textContent = 'Batal';
                cancelBtn.addEventListener('click', () => {
                    editor.remove();
                });

                buttonContainer.appendChild(saveBtn);
                buttonContainer.appendChild(cancelBtn);
                editor.appendChild(textarea);
                editor.appendChild(buttonContainer);
                container.appendChild(editor);
            });

            const scheduleBtn = document.createElement('button');
            scheduleBtn.className = 'btn schedule';
            scheduleBtn.textContent = 'Jadwalkan';
            scheduleBtn.addEventListener('click', () => {
                const editor = document.createElement('div');
                editor.className = 'schedule-editor';
                const datetimeInput = document.createElement('input');
                datetimeInput.type = 'datetime-local';
                datetimeInput.value = scheduledTimes[file.path] || '';

                const buttonContainer = document.createElement('div');
                buttonContainer.className = 'editor-buttons';

                const saveBtn = document.createElement('button');
                saveBtn.className = 'btn-save';
                saveBtn.textContent = 'Simpan';
                saveBtn.addEventListener('click', () => {
                    if (!datetimeInput.value) {
                        showFloatingNotification('Pilih waktu terlebih dahulu.', true);
                        return;
                    }

                    scheduledTimes[file.path] = datetimeInput.value;
                    const date = new Date(scheduledTimes[file.path]);
                    const formattedTime = date.toLocaleString('id-ID', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                        hour12: false
                    }).replace(',', '').replace(/(\d{2}):(\d{2})/, '$1.$2');
                    scheduleTime.textContent = formattedTime;
                    scheduleTime.classList.add('scheduled');
                    scheduleTime.classList.remove('unscheduled');

                    editor.remove();
                    showFloatingNotification(`Waktu jadwal untuk ${file.name} disimpan sementara. Klik "Simpan Jadwal" untuk mengirimkan.`);
                });

                const cancelBtn = document.createElement('button');
                cancelBtn.className = 'btn-cancel';
                cancelBtn.textContent = 'Batal';
                cancelBtn.addEventListener('click', () => {
                    delete scheduledTimes[file.path];
                    scheduleTime.textContent = 'Belum dijadwalkan';
                    scheduleTime.classList.add('unscheduled');
                    scheduleTime.classList.remove('scheduled');
                    editor.remove();
                    displayGallery(files);
                });

                buttonContainer.appendChild(saveBtn);
                buttonContainer.appendChild(cancelBtn);

                editor.appendChild(datetimeInput);
                editor.appendChild(buttonContainer);
                container.appendChild(editor);
            });

            const deleteScheduleBtn = document.createElement('button');
            deleteScheduleBtn.className = 'btn delete';
            deleteScheduleBtn.textContent = 'Hapus Jadwal';
            deleteScheduleBtn.disabled = !scheduleId;
            deleteScheduleBtn.addEventListener('click', async () => {
                if (!scheduleId) {
                    showFloatingNotification('File ini belum memiliki jadwal.', true);
                    return;
                }

                const confirmed = await showConfirmModal(`Apakah Anda yakin ingin menghapus jadwal untuk ${file.name}?`);
                if (confirmed) {
                    await deleteSchedule(scheduleId);
                    deleteScheduleBtn.disabled = true;
                    scheduleTime.textContent = 'Belum dijadwalkan';
                    scheduleTime.classList.add('unscheduled');
                    scheduleTime.classList.remove('scheduled');
                    showFloatingNotification(`Jadwal untuk ${file.name} berhasil dihapus.`);
                }
            });

            const publishBtn = document.createElement('button');
            publishBtn.className = 'btn publish';
            publishBtn.textContent = 'Publish';
            publishBtn.addEventListener('click', async () => {
                if (!selectedToken || !accountId.value) {
                    showFloatingNotification('Pilih akun dan username terlebih dahulu.', true);
                    return;
                }

                showFloatingNotification('Mempublikasikan...', false, 0);
                spinner.classList.remove('hidden');
                let isUploadedFile = file.path.startsWith('ig/image/');

                try {
                    const response = await fetch('/api/publish', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            accountId: accountId.value,
                            mediaUrl: file.download_url,
                            caption: captions[file.path] || '',
                            userToken: selectedToken,
                        }),
                    });

                    if (!response.ok) {
                        throw new Error(`HTTP error publishing post! status: ${response.status}`);
                    }

                    const result = await response.json();
                    showFloatingNotification(result.message || 'Berhasil dipublikasikan ke Instagram!', false, 3000);

                    if (isUploadedFile) {
                        await deletePhoto(file.path);
                    }
                } catch (error) {
                    showFloatingNotification(`Error publishing: ${error.message}`, true);
                    console.error('Error publishing post:', error);
                } finally {
                    spinner.classList.add('hidden');
                }
            });

            buttonGroup.appendChild(editBtn);
            buttonGroup.appendChild(scheduleBtn);

            container.appendChild(img);
            container.appendChild(name);
            container.appendChild(captionText);
            container.appendChild(scheduleTime);
            container.appendChild(buttonGroup);
            container.appendChild(deleteScheduleBtn);
            container.appendChild(publishBtn);
            gallery.appendChild(container);
        });

        startDateTime.addEventListener('input', () => {
            if (!startDateTime.value) {
                Object.keys(scheduledTimes).forEach(filePath => {
                    delete scheduledTimes[filePath];
                });
                Array.from(gallery.children).forEach(container => {
                    const scheduleTimeElement = container.querySelector('.schedule-time');
                    if (scheduleTimeElement) {
                        scheduleTimeElement.textContent = 'Belum dijadwalkan';
                        scheduleTimeElement.classList.add('unscheduled');
                        scheduleTimeElement.classList.remove('scheduled');
                    }
                });
                showFloatingNotification('Jadwal untuk semua foto telah direset.');
            }
        });

        startDateTime.addEventListener('change', () => {
            if (!startDateTime.value) return;
            const start = new Date(startDateTime.value);
            const hours = start.getHours();
            const minutes = start.getMinutes();
            const dayIncrement = skipDay.checked ? 2 : 1;
            imageFiles.forEach((file, index) => {
                const newDate = new Date(start);
                newDate.setDate(start.getDate() + (index * dayIncrement));
                scheduledTimes[file.path] = formatDateTime(newDate, hours, minutes);
                const scheduleTimeElement = gallery.children[index]?.querySelector('.schedule-time');
                if (scheduleTimeElement) {
                    const date = new Date(scheduledTimes[file.path]);
                    const formattedTime = date.toLocaleString('id-ID', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                        hour12: false
                    }).replace(',', '').replace(/(\d{2}):(\d{2})/, '$1.$2');
                    scheduleTimeElement.textContent = formattedTime;
                    scheduleTimeElement.classList.add('scheduled');
                    scheduleTimeElement.classList.remove('unscheduled');
                }
            });
        });

        skipDay.addEventListener('change', () => {
            if (!startDateTime.value) return;
            const start = new Date(startDateTime.value);
            const hours = start.getHours();
            const minutes = start.getMinutes();
            const dayIncrement = skipDay.checked ? 2 : 1;
            imageFiles.forEach((file, index) => {
                const newDate = new Date(start);
                newDate.setDate(start.getDate() + (index * dayIncrement));
                scheduledTimes[file.path] = formatDateTime(newDate, hours, minutes);
                const scheduleTimeElement = gallery.children[index]?.querySelector('.schedule-time');
                if (scheduleTimeElement) {
                    const date = new Date(scheduledTimes[file.path]);
                    const formattedTime = date.toLocaleString('id-ID', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                        hour12: false
                    }).replace(',', '').replace(/(\d{2}):(\d{2})/, '$1.$2');
                    scheduleTimeElement.textContent = formattedTime;
                    scheduleTimeElement.classList.add('scheduled');
                    scheduleTimeElement.classList.remove('unscheduled');
                }
            });
        });

        scheduleAll.addEventListener('click', () => {
            if (!startDateTime.value) {
                showFloatingNotification('Pilih tanggal dan jam awal terlebih dahulu.', true);
                return;
            }

            const start = new Date(startDateTime.value);
            const hours = start.getHours();
            const minutes = start.getMinutes();
            const dayIncrement = skipDay.checked ? 2 : 1;

            console.log('Start time selected:', startDateTime.value);
            console.log('Hours:', hours, 'Minutes:', minutes);

            imageFiles.forEach((file, index) => {
                const newDate = new Date(start);
                newDate.setDate(start.getDate() + (index * dayIncrement));
                scheduledTimes[file.path] = formatDateTime(newDate, hours, minutes);
                const scheduleTimeElement = gallery.children[index]?.querySelector('.schedule-time');
                if (scheduleTimeElement) {
                    const date = new Date(scheduledTimes[file.path]);
                    const formattedTime = date.toLocaleString('id-ID', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                        hour12: false
                    }).replace(',', '').replace(/(\d{2}):(\d{2})/, '$1.$2');
                    scheduleTimeElement.textContent = formattedTime;
                    scheduleTimeElement.classList.add('scheduled');
                    scheduleTimeElement.classList.remove('unscheduled');
                }
                console.log(`File ${file.name} scheduled at: ${scheduledTimes[file.path]}`);
            });

            showFloatingNotification(`Waktu jadwal untuk semua foto disimpan sementara. Klik "Simpan Jadwal" untuk mengirimkan.`);
            window.history.pushState({}, document.title, window.location.pathname);
        });
    }

    loadGithubFolders();

    async function deleteSchedule(scheduleId) {
        try {
            showFloatingNotification('Menghapus jadwal...');
            spinner.classList.remove('hidden');
            const res = await fetch('/api/delete_schedule', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ scheduleId }),
            });
            if (!res.ok) {
                throw new Error(`HTTP error! status: ${res.status}`);
            }
            const result = await res.json();
            showFloatingNotification(result.message || 'Jadwal berhasil dihapus!');
            await loadSchedules();
        } catch (error) {
            showFloatingNotification(`Error deleting schedule: ${error.message}`, true);
            console.error('Error deleting schedule:', error);
        } finally {
            spinner.classList.add('hidden');
        }
    }

    async function updateSchedule(scheduleId, updatedData) {
        try {
            const res = await fetch('/api/update_schedule', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ scheduleId, ...updatedData }),
            });
            if (!res.ok) {
                throw new Error(`HTTP error updating schedule! status: ${res.status}`);
            }
            const result = await res.json();
            showFloatingNotification(result.message || 'Jadwal berhasil diperbarui!');
            await loadSchedules();
        } catch (error) {
            showFloatingNotification(`Error updating schedule: ${error.message}`, true);
            console.error('Error updating schedule:', error);
        }
    }

    async function deleteSelectedSchedules() {
        const checkboxes = document.querySelectorAll('.schedule-checkbox:checked');
        if (checkboxes.length === 0) {
            showFloatingNotification('Pilih setidaknya satu jadwal untuk dihapus.', true);
            return;
        }

        const scheduleIds = Array.from(checkboxes).map(checkbox => checkbox.dataset.scheduleId);

        try {
            showFloatingNotification('Menghapus jadwal terpilih...');
            spinner.classList.remove('hidden');
            for (const scheduleId of scheduleIds) {
                await deleteSchedule(scheduleId);
            }
            showFloatingNotification(`${scheduleIds.length} jadwal berhasil dihapus!`);
        } catch (error) {
            showFloatingNotification(`Error deleting schedules: ${error.message}`, true);
            console.error('Error deleting schedules:', error);
        } finally {
            spinner.classList.add('hidden');
        }
    }

    function renderSchedules(schedulesToRender, startIndex) {
        // Clear the table body
        scheduleTableBody.innerHTML = '';

        // Remove existing event listeners by cloning the table body
        const oldTableBody = scheduleTableBody;
        const newTableBody = oldTableBody.cloneNode(false);
        oldTableBody.parentNode.replaceChild(newTableBody, oldTableBody);
        scheduleTableBody.innerHTML = ''; // Ensure it's empty

        // Render new rows
        schedulesToRender.forEach((schedule, idx) => {
            const globalIndex = startIndex + idx;
            const wibTime = convertToWIB(schedule.time);
            const formattedWibTime = formatToDatetimeLocal(wibTime);
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${globalIndex + 1}</td>
                <td><input type="checkbox" class="schedule-checkbox" data-schedule-id="${schedule.scheduleId}"></td>
                <td>${schedule.username || 'Unknown'}</td>
                <td><img src="${schedule.mediaUrl}" alt="Media" class="schedule-media-preview"></td>
                <td class="editable-caption" contenteditable="true" data-schedule-id="${schedule.scheduleId}">${schedule.caption}</td>
                <td class="editable-time" data-schedule-id="${schedule.scheduleId}">
                    <input type="datetime-local" class="time-input" value="${formattedWibTime}">
                </td>
                <td>${schedule.completed ? 'Selesai' : 'Menunggu'}</td>
                <td>
                    <button class="delete-btn" data-schedule-id="${schedule.scheduleId}">Hapus</button>
                </td>
            `;
            scheduleTableBody.appendChild(row);
        });

        // Attach event listeners to new elements
        const captionCells = document.querySelectorAll('.editable-caption');
        captionCells.forEach(cell => {
            cell.removeEventListener('blur', handleCaptionBlur); // Ensure no duplicates
            cell.addEventListener('blur', handleCaptionBlur);
        });

        const timeInputs = document.querySelectorAll('.editable-time .time-input');
        timeInputs.forEach(input => {
            input.removeEventListener('change', handleTimeChange); // Ensure no duplicates
            input.addEventListener('change', handleTimeChange);
        });

        const deleteButtons = document.querySelectorAll('.delete-btn');
        deleteButtons.forEach(button => {
            button.removeEventListener('click', handleDeleteClick); // Ensure no duplicates
            button.addEventListener('click', debounce(handleDeleteClick, 300));
        });
    }

    // Event handler functions defined outside renderSchedules to prevent redefinition
    const handleCaptionBlur = async (e) => {
        const scheduleId = e.target.dataset.scheduleId;
        const newCaption = e.target.textContent.trim();
        await updateSchedule(scheduleId, { caption: newCaption });
    };

    const handleTimeChange = async (e) => {
        const scheduleId = e.target.parentElement.dataset.scheduleId;
        const newTime = e.target.value;
        await updateSchedule(scheduleId, { time: newTime });
    };

    const handleDeleteClick = async (e) => {
        const scheduleId = e.target.getAttribute('data-schedule-id');
        const confirmed = await showConfirmModal('Apakah Anda yakin ingin menghapus jadwal ini?');
        if (confirmed) {
            await deleteSchedule(scheduleId);
        }
    };

    function renderPagination(schedules) {
        const totalPages = Math.ceil(schedules.length / ITEMS_PER_PAGE);
        const loadMoreContainer = document.querySelector('.load-more-container');
        loadMoreContainer.innerHTML = ''; // Kosongkan container sebelum render

        if (totalPages <= 1) return; // Tidak perlu pagination jika hanya 1 halaman

        // Tombol Prev
        const prevBtn = document.createElement('button');
        prevBtn.textContent = 'Prev';
        prevBtn.className = 'load-more-btn';
        prevBtn.disabled = currentPage === 1;
        prevBtn.addEventListener('click', () => {
            if (currentPage > 1) {
                currentPage--;
                loadSchedulesPage(schedules);
            }
        });
        loadMoreContainer.appendChild(prevBtn);

        // Nomor halaman
        for (let i = 1; i <= totalPages; i++) {
            const pageBtn = document.createElement('button');
            pageBtn.textContent = i;
            pageBtn.className = 'load-more-btn';
            if (i === currentPage) {
                pageBtn.style.backgroundColor = '#357abd'; // Warna aktif
            }
            pageBtn.addEventListener('click', () => {
                currentPage = i;
                loadSchedulesPage(schedules);
            });
            loadMoreContainer.appendChild(pageBtn);
        }

        // Tombol Next
        const nextBtn = document.createElement('button');
        nextBtn.textContent = 'Next';
        nextBtn.className = 'load-more-btn';
        nextBtn.disabled = currentPage === totalPages;
        nextBtn.addEventListener('click', () => {
            if (currentPage < totalPages) {
                currentPage++;
                loadSchedulesPage(schedules);
            }
        });
        loadMoreContainer.appendChild(nextBtn);
    }

    function loadSchedulesPage(schedules) {
        const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
        const endIndex = startIndex + ITEMS_PER_PAGE;
        const pageSchedules = schedules.slice(startIndex, endIndex);
        renderSchedules(pageSchedules, startIndex);
        renderPagination(schedules); // Perbarui pagination setelah memuat halaman
    }

    async function loadSchedules() {
        if (isLoadingSchedules) {
            console.log('loadSchedules already in progress, skipping...');
            return;
        }

        isLoadingSchedules = true;
        try {
            scheduleTableBody.innerHTML = '<tr><td colspan="8">Memuat jadwal...</td></tr>';
            const res = await fetch('/api/get_schedules');
            if (!res.ok) {
                throw new Error(`HTTP error fetching schedules! status: ${res.status}`);
            }
            const data = await res.json();
            console.log('Schedules fetched:', data);

            allSchedules = data.schedules || [];

            allSchedules.sort((a, b) => new Date(a.time) - new Date(b.time));

            let filteredSchedules = allSchedules;
            if (selectedAccountNum) {
                filteredSchedules = filteredSchedules.filter(schedule => schedule.accountNum === selectedAccountNum);
            }
            if (selectedAccountId) {
                filteredSchedules = filteredSchedules.filter(schedule => schedule.accountId === selectedAccountId);
            }

            currentPage = 1;
            updateScheduleVisibility(filteredSchedules);

            // Remove existing event listeners for selectAll and deleteSelected
            const newSelectAll = selectAll.cloneNode(true);
            selectAll.parentNode.replaceChild(newSelectAll, selectAll);
            const newDeleteSelected = deleteSelected.cloneNode(true);
            deleteSelected.parentNode.replaceChild(newDeleteSelected, deleteSelected);

            if (filteredSchedules.length > 0) {
                newSelectAll.addEventListener('change', () => {
                    const checkboxes = document.querySelectorAll('.schedule-checkbox');
                    checkboxes.forEach(checkbox => {
                        checkbox.checked = newSelectAll.checked;
                    });
                });

                newDeleteSelected.addEventListener('click', async () => {
                    const confirmed = await showConfirmModal('Apakah Anda yakin ingin menghapus jadwal yang dipilih?');
                    if (confirmed) {
                        await deleteSelectedSchedules();
                    }
                });
            }
        } catch (error) {
            showFloatingNotification(`Error loading schedules: ${error.message}`, true);
            console.error('Error fetching schedules:', error);
            scheduleTableBody.innerHTML = '<tr><td colspan="8">Gagal memuat jadwal.</td></tr>';
            totalSchedules.textContent = 'Total: 0 jadwal';
            updateScheduleVisibility([]);
        } finally {
            isLoadingSchedules = false;
        }
    }

    saveSchedules.addEventListener('click', async () => {
        if (!selectedToken || !accountId.value) {
            showFloatingNotification('Pilih akun dan username terlebih dahulu.', true);
            return;
        }

        const scheduledFiles = allMediaFiles.filter(file => {
            const scheduledTime = scheduledTimes[file.path];
            return scheduledTime && typeof scheduledTime === 'string' && scheduledTime.trim() !== '';
        });
        if (scheduledFiles.length === 0) {
            showFloatingNotification('Tidak ada foto yang dijadwalkan.', true);
            return;
        }

        showFloatingNotification('Menyimpan jadwal... 0/' + scheduledFiles.length, false, 0);
        spinner.classList.remove('hidden');

        try {
            let completedCount = 0;
            for (const file of scheduledFiles) {
                const formData = {
                    accountId: accountId.value,
                    username: selectedUsername,
                    mediaUrl: file.download_url,
                    caption: captions[file.path] || '',
                    time: scheduledTimes[file.path],
                    userToken: selectedToken,
                    accountNum: userAccount.value,
                    completed: false,
                };

                console.log('Scheduling file:', file.path, 'with data:', formData);

                const response = await fetch('/api/schedule', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(formData),
                });

                const responseText = await response.text();
                let result;
                try {
                    result = JSON.parse(responseText);
                } catch (parseError) {
                    throw new Error(`Failed to parse server response as JSON: ${responseText}`);
                }

                if (!response.ok) {
                    throw new Error(`HTTP error scheduling post! status: ${response.status}, details: ${result.error || responseText}`);
                }

                completedCount++;
                showFloatingNotification(`Menyimpan jadwal... ${completedCount}/${scheduledFiles.length}`, false, 0);
                console.log('Schedule response:', result);
            }
            showFloatingNotification(`${scheduledFiles.length} foto berhasil dijadwalkan!`, false, 3000);
            scheduledTimes = {};
            await loadSchedules();
        } catch (error) {
            showFloatingNotification(`Error scheduling: ${error.message}`, true);
            console.error('Error scheduling posts:', error);
        } finally {
            spinner.classList.add('hidden');
        }
    });

    loadSchedules();
});