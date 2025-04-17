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
    const zipCaptionInput = document.getElementById('zipCaptionInput');
    const generateZip = document.getElementById('generateZip');
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
  // Handler untuk tombol generate ZIP
  generateZip.addEventListener('click', async () => {
    const caption = zipCaptionInput.value.trim();
    if (!caption) {
      showFloatingNotification('Masukkan caption terlebih dahulu.', true);
      return;
    }

    try {
      showFloatingNotification('Membuat file ZIP...', false, 0);
      spinner.classList.remove('hidden');

      const response = await fetch('/api/refresh-token/generate-zip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: caption }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'captions.zip';
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);

      showFloatingNotification('File ZIP berhasil diunduh!', false, 3000);
    } catch (error) {
      showFloatingNotification(`Gagal membuat ZIP: ${error.message}`, true);
      console.error('Error generating ZIP:', error);
    } finally {
      spinner.classList.add('hidden');
    }
  });
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

        const mediaFiles = files.filter(file => 
            file.name && 
            (file.name.endsWith('.jpg') || file.name.endsWith('.png') || file.name.endsWith('.mp4'))
        );

        console.log('Media files after filter:', mediaFiles);

        const scheduleAllContainer = document.querySelector('.schedule-all-container');

        if (mediaFiles.length === 0) {
            gallery.innerHTML = '<p>Tidak ada media untuk ditampilkan.</p>';
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

        mediaFiles.forEach(file => {
            if (scheduledTimes[file.path]) {
                withSchedule.push(file);
            } else {
                withoutSchedule.push(file);
            }
        });

        const sortedMediaFiles = [...withSchedule, ...withoutSchedule];

        console.log('Sorted media files:', sortedMediaFiles.map(file => file.name));

        function formatDateTime(date, hours, minutes) {
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            const formatted = `${year}-${month}-${day}T${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
            return formatted;
        }

        sortedMediaFiles.forEach((file, index) => {
            const container = document.createElement('div');
            container.className = 'gallery-item';

            let mediaElement;
            if (file.name.endsWith('.mp4')) {
                mediaElement = document.createElement('video');
                mediaElement.src = file.download_url;
                mediaElement.controls = false;
                mediaElement.volume = 0.5;
                mediaElement.loop = true;
                mediaElement.dataset.fileData = JSON.stringify(file);
                mediaElement.addEventListener('click', () => {
                    gallery.querySelectorAll('img, video').forEach(i => i.classList.remove('selected'));
                    mediaElement.classList.add('selected');
                    mediaUrl.value = file.download_url;
                });

                // Tambahkan tombol play/pause di tengah area yang dilingkari merah
                const playPauseBtn = document.createElement('button');
                playPauseBtn.textContent = '▶'; // Simbol play
                playPauseBtn.style.position = 'absolute';
                playPauseBtn.style.top = '30%'; // Disesuaikan ke 30% dari atas agar berada di tengah area wajah
                playPauseBtn.style.left = '50%';
                playPauseBtn.style.transform = 'translate(-50%, -50%)'; // Memastikan tombol benar-benar di tengah secara horizontal
                playPauseBtn.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
                playPauseBtn.style.color = '#fff';
                playPauseBtn.style.border = 'none';
                playPauseBtn.style.borderRadius = '50%';
                playPauseBtn.style.width = '24px';
                playPauseBtn.style.height = '24px';
                playPauseBtn.style.display = 'flex';
                playPauseBtn.style.alignItems = 'center';
                playPauseBtn.style.justifyContent = 'center';
                playPauseBtn.style.cursor = 'pointer';
                playPauseBtn.style.zIndex = '2';

                playPauseBtn.addEventListener('click', () => {
                    if (mediaElement.paused) {
                        mediaElement.play();
                        playPauseBtn.textContent = '⏸'; // Simbol pause
                    } else {
                        mediaElement.pause();
                        playPauseBtn.textContent = '▶'; // Simbol play
                    }
                });

                container.appendChild(playPauseBtn);
            } else {
                mediaElement = document.createElement('img');
                mediaElement.src = file.download_url;
                mediaElement.alt = file.name;
                mediaElement.dataset.fileData = JSON.stringify(file);
                mediaElement.addEventListener('click', () => {
                    gallery.querySelectorAll('img, video').forEach(i => i.classList.remove('selected'));
                    mediaElement.classList.add('selected');
                    mediaUrl.value = file.download_url;
                });
            }

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
                            mediaType: file.name.endsWith('.mp4') ? 'video' : 'image',
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

            container.appendChild(mediaElement);
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
                showFloatingNotification('Jadwal untuk semua media telah direset.');
            }
        });

        startDateTime.addEventListener('change', () => {
            if (!startDateTime.value) return;
            const start = new Date(startDateTime.value);
            const hours = start.getHours();
            const minutes = start.getMinutes();
            const dayIncrement = skipDay.checked ? 2 : 1;
            mediaFiles.forEach((file, index) => {
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
            mediaFiles.forEach((file, index) => {
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

            mediaFiles.forEach((file, index) => {
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

            showFloatingNotification(`Waktu jadwal untuk semua media disimpan sementara. Klik "Simpan Jadwal" untuk mengirimkan.`);
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
            deleteSchedule(scheduleId);
        }
    };

    function renderSchedules(schedulesToRender, startIndex) {
    scheduleTableBody.innerHTML = '';

    const oldCaptionCells = document.querySelectorAll('.editable-caption');
    oldCaptionCells.forEach(cell => {
        cell.removeEventListener('blur', handleCaptionBlur);
    });

    const oldTimeInputs = document.querySelectorAll('.editable-time .time-input');
    oldTimeInputs.forEach(input => {
        input.removeEventListener('change', handleTimeChange);
    });

    const oldDeleteButtons = document.querySelectorAll('.delete-btn');
    oldDeleteButtons.forEach(button => {
        button.removeEventListener('click', handleDeleteClick);
    });

    schedulesToRender.forEach((schedule, idx) => {
        const globalIndex = startIndex + idx;
        const wibTime = convertToWIB(schedule.time);
        const formattedWibTime = formatToDatetimeLocal(wibTime);
        const row = document.createElement('tr');

        const isVideo = schedule.mediaUrl.endsWith('.mp4');
        const mediaPreview = isVideo
            ? `<div class="media-container"><video src="${schedule.mediaUrl}" class="schedule-media-preview video-preview" muted></video><span class="video-label">MP4</span></div>`
            : `<img src="${schedule.mediaUrl}" alt="Media" class="schedule-media-preview">`;

        row.innerHTML = `
            <td>${globalIndex + 1}</td>
            <td><input type="checkbox" class="schedule-checkbox" data-schedule-id="${schedule.scheduleId}"></td>
            <td>${schedule.username || 'Unknown'}</td>
            <td>${mediaPreview}</td>
            <td class="editable-caption" contenteditable="true" data-schedule-id="${schedule.scheduleId}">${schedule.caption}</td>
            <td class="editable-time" data-schedule-id="${schedule.scheduleId}">
                <input type="datetime-local" class="time-input" value="${formattedWibTime}">
            </td>
            <td class="${schedule.completed ? 'processing' : ''}">${schedule.completed ? '<span class="processing-dots">Process</span>' : 'Menunggu'}</td>
            <td>
                <button class="delete-btn" data-schedule-id="${schedule.scheduleId}">Hapus</button>
            </td>
        `;
        scheduleTableBody.appendChild(row);
    });

    document.querySelectorAll('.editable-caption').forEach(cell => {
        cell.addEventListener('blur', handleCaptionBlur);
    });

    document.querySelectorAll('.editable-time .time-input').forEach(input => {
        input.addEventListener('change', handleTimeChange);
    });

    document.querySelectorAll('.delete-btn').forEach(button => {
        button.addEventListener('click', debounce(handleDeleteClick, 300));
    });

    animateProcessingDots();
}

    function animateProcessingDots() {
        const processingElements = document.querySelectorAll('.processing-dots');
        processingElements.forEach(el => {
            let dotCount = 0;
            setInterval(() => {
                dotCount = (dotCount + 1) % 4;
                el.textContent = 'Process' + '.'.repeat(dotCount);
            }, 500);
        });
    }

    function renderPagination(schedules) {
        const totalPages = Math.ceil(schedules.length / ITEMS_PER_PAGE);
        const loadMoreContainer = document.querySelector('.load-more-container');
        loadMoreContainer.innerHTML = '';

        if (totalPages <= 1) return;

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

        for (let i = 1; i <= totalPages; i++) {
            const pageBtn = document.createElement('button');
            pageBtn.textContent = i;
            pageBtn.className = 'load-more-btn';
            if (i === currentPage) {
                pageBtn.style.backgroundColor = '#357abd';
            }
            pageBtn.addEventListener('click', () => {
                currentPage = i;
                loadSchedulesPage(schedules);
            });
            loadMoreContainer.appendChild(pageBtn);
        }

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
        renderPagination(schedules);
    }

    const handleSelectAllChange = () => {
        const checkboxes = document.querySelectorAll('.schedule-checkbox');
        checkboxes.forEach(checkbox => {
            checkbox.checked = selectAll.checked;
        });
    };

    const handleDeleteSelectedClick = async () => {
        const confirmed = await showConfirmModal('Apakah Anda yakin ingin menghapus jadwal yang dipilih?');
        if (confirmed) {
            deleteSelectedSchedules();
        }
    };

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

            selectAll.removeEventListener('change', handleSelectAllChange);
            deleteSelected.removeEventListener('click', handleDeleteSelectedClick);

            if (filteredSchedules.length > 0) {
                selectAll.addEventListener('change', handleSelectAllChange);
                deleteSelected.addEventListener('click', handleDeleteSelectedClick);
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
            showFloatingNotification('Tidak ada media yang dijadwalkan.', true);
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
                    mediaType: file.name.endsWith('.mp4') ? 'video' : 'image',
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
            showFloatingNotification(`${scheduledFiles.length} media berhasil dijadwalkan!`, false, 3000);
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
