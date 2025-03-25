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

            uploadFolder.innerHTML = '<option value="ig/image">ig/image</option>';
            folders.forEach(item => {
                if (item.path !== 'ig/image') {
                    const option = document.createElement('option');
                    option.value = item.path;
                    option.textContent = item.name;
                    uploadFolder.appendChild(option);
                }
            });
        } catch (error) {
            console.error('Error loading upload folders:', error);
            showFloatingNotification(`Error loading upload folders: ${error.message}`, true);
        }
    }

    loadUploadFolders();

    uploadToGithub.addEventListener('click', async () => {
        if (!uploadFile.files || uploadFile.files.length === 0) {
            showFloatingNotification('Pilih file terlebih dahulu.', true);
            return;
        }

        let uploadFolderValue = uploadFolder.value.trim();
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
            const metaContent = JSON.stringify({ caption }, null, 2);
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
                throw new Error(`HTTP error saving caption! status: ${response.status}`);
            }

            const result = await response.json();
            console.log(`Caption saved to GitHub: ${metaPath}`);
            return result;
        } catch (error) {
            console.error('Error saving caption to GitHub:', error);
            throw error;
        }
    }

    function displayGallery(files) {
        gallery.innerHTML = '';
        if (files.length === 0) {
            gallery.classList.add('hidden');
            return;
        }

        gallery.classList.remove('hidden');
        files.forEach(file => {
            const item = document.createElement('div');
            item.classList.add('gallery-item');

            const img = document.createElement('img');
            img.src = file.download_url;
            img.alt = file.name;
            img.dataset.path = file.path;
            item.appendChild(img);

            const captionText = document.createElement('p');
            captionText.classList.add('caption-text');
            captionText.textContent = captions[file.path] || 'Tidak ada caption';
            item.appendChild(captionText);

            const scheduleTime = document.createElement('p');
            scheduleTime.classList.add('schedule-time');
            if (scheduledTimes[file.path]) {
                const wibTime = convertToWIB(scheduledTimes[file.path]);
                scheduleTime.textContent = formatToLocaleString(wibTime);
                scheduleTime.classList.add('scheduled');
            } else {
                scheduleTime.textContent = 'Belum dijadwalkan';
                scheduleTime.classList.add('unscheduled');
            }
            item.appendChild(scheduleTime);

            const buttonGroup = document.createElement('div');
            buttonGroup.classList.add('button-group');

            const editBtn = document.createElement('button');
            editBtn.classList.add('btn', 'edit');
            editBtn.textContent = 'Edit';
            editBtn.addEventListener('click', () => {
                const editor = document.createElement('div');
                editor.classList.add('caption-editor');

                const textarea = document.createElement('textarea');
                textarea.value = captions[file.path] || '';
                editor.appendChild(textarea);

                const editorButtons = document.createElement('div');
                editorButtons.classList.add('editor-buttons');

                const saveBtn = document.createElement('button');
                saveBtn.textContent = 'Simpan';
                const cancelBtn = document.createElement('button');
                cancelBtn.textContent = 'Batal';

                let isSaving = false;

                saveBtn.addEventListener('click', async () => {
                    if (isSaving) return;
                    isSaving = true;

                    const newCaption = textarea.value;
                    const commitMessage = `Update caption for ${file.name} [vercel-skip]`;
                    saveBtn.textContent = 'Menyimpan...';
                    saveBtn.disabled = true;
                    const spinner = document.createElement('span');
                    spinner.classList.add('editor-spinner');
                    saveBtn.appendChild(spinner);

                    try {
                        await saveCaptionToGithub(file, newCaption, commitMessage);
                        captions[file.path] = newCaption;
                        captionText.textContent = newCaption || 'Tidak ada caption';
                        showFloatingNotification('Caption berhasil disimpan!');
                        allSchedules = allSchedules.map(schedule => {
                            if (schedule.mediaUrl === file.download_url) {
                                return { ...schedule, caption: newCaption };
                            }
                            return schedule;
                        });
                        displaySchedules(allSchedules.slice(0, displayedSchedules));
                    } catch (error) {
                        showFloatingNotification(`Gagal menyimpan caption: ${error.message}`, true);
                    } finally {
                        editor.remove();
                        isSaving = false;
                    }
                });

                cancelBtn.addEventListener('click', () => {
                    editor.remove();
                });

                editorButtons.appendChild(saveBtn);
                editorButtons.appendChild(cancelBtn);
                editor.appendChild(editorButtons);
                item.appendChild(editor);
                textarea.focus();
            });

            const scheduleBtn = document.createElement('button');
            scheduleBtn.classList.add('btn', 'schedule');
            scheduleBtn.textContent = 'Jadwalkan';
            scheduleBtn.addEventListener('click', () => {
                const editor = document.createElement('div');
                editor.classList.add('schedule-editor');

                const input = document.createElement('input');
                input.type = 'datetime-local';
                if (scheduledTimes[file.path]) {
                    const wibTime = convertToWIB(scheduledTimes[file.path]);
                    input.value = formatToDatetimeLocal(wibTime);
                }
                editor.appendChild(input);

                const editorButtons = document.createElement('div');
                editorButtons.classList.add('editor-buttons');

                const saveBtn = document.createElement('button');
                saveBtn.textContent = 'Simpan';
                const cancelBtn = document.createElement('button');
                cancelBtn.textContent = 'Batal';

                let isSaving = false;

                saveBtn.addEventListener('click', async () => {
                    if (isSaving) return;
                    isSaving = true;

                    const selectedTime = input.value;
                    if (!selectedTime) {
                        showFloatingNotification('Pilih waktu terlebih dahulu.', true);
                        isSaving = false;
                        return;
                    }

                    const newTime = new Date(selectedTime);
                    const utcTime = new Date(newTime.getTime() - (7 * 60 * 60 * 1000));
                    saveBtn.textContent = 'Menyimpan...';
                    saveBtn.disabled = true;
                    const spinner = document.createElement('span');
                    spinner.classList.add('editor-spinner');
                    saveBtn.appendChild(spinner);

                    try {
                        scheduledTimes[file.path] = utcTime.toISOString();
                        const wibTime = convertToWIB(utcTime);
                        scheduleTime.textContent = formatToLocaleString(wibTime);
                        scheduleTime.classList.remove('unscheduled');
                        scheduleTime.classList.add('scheduled');
                        showFloatingNotification('Jadwal berhasil disimpan!');

                        const existingScheduleIndex = allSchedules.findIndex(s => s.mediaUrl === file.download_url);
                        if (existingScheduleIndex !== -1) {
                            allSchedules[existingScheduleIndex].scheduleTime = utcTime.toISOString();
                        } else {
                            allSchedules.push({
                                accountNum: selectedAccountNum,
                                accountId: selectedAccountId,
                                username: selectedUsername,
                                mediaUrl: file.download_url,
                                caption: captions[file.path] || '',
                                scheduleTime: utcTime.toISOString(),
                                status: 'scheduled'
                            });
                        }
                        displaySchedules(allSchedules.slice(0, displayedSchedules));
                    } catch (error) {
                        showFloatingNotification(`Gagal menyimpan jadwal: ${error.message}`, true);
                    } finally {
                        editor.remove();
                        isSaving = false;
                    }
                });

                cancelBtn.addEventListener('click', () => {
                    editor.remove();
                });

                editorButtons.appendChild(saveBtn);
                editorButtons.appendChild(cancelBtn);
                editor.appendChild(editorButtons);
                item.appendChild(editor);
                input.focus();
            });

            const publishBtn = document.createElement('button');
            publishBtn.classList.add('btn', 'publish');
            publishBtn.textContent = 'Publish';
            publishBtn.addEventListener('click', async () => {
                if (!selectedToken || !selectedAccountId || !selectedUsername) {
                    showFloatingNotification('Pilih akun dan username terlebih dahulu.', true);
                    return;
                }

                const confirmed = await showConfirmModal(`Apakah Anda yakin ingin mempublikasikan ${file.name} ke Instagram?`);
                if (!confirmed) return;

                showFloatingNotification(`Mempublikasikan ${file.name}...`);
                spinner.classList.remove('hidden');

                try {
                    const response = await fetch('/api/publish', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            accountNum: selectedAccountNum,
                            accountId: selectedAccountId,
                            username: selectedUsername,
                            token: selectedToken,
                            mediaUrl: file.download_url,
                            caption: captions[file.path] || ''
                        }),
                    });

                    if (!response.ok) {
                        throw new Error(`HTTP error publishing to Instagram! status: ${response.status}`);
                    }

                    const result = await response.json();
                    showFloatingNotification(`Berhasil mempublikasikan ${file.name} ke Instagram!`);

                    const scheduleIndex = allSchedules.findIndex(s => s.mediaUrl === file.download_url);
                    if (scheduleIndex !== -1) {
                        allSchedules[scheduleIndex].status = 'published';
                        displaySchedules(allSchedules.slice(0, displayedSchedules));
                    }
                } catch (error) {
                    showFloatingNotification(`Gagal mempublikasikan ke Instagram: ${error.message}`, true);
                    console.error('Error publishing to Instagram:', error);
                } finally {
                    spinner.classList.add('hidden');
                }
            });

            const deleteBtn = document.createElement('button');
            deleteBtn.classList.add('btn', 'delete');
            deleteBtn.textContent = 'Hapus';
            deleteBtn.disabled = scheduledTimes[file.path] && allSchedules.some(s => s.mediaUrl === file.download_url && s.status === 'scheduled');
            deleteBtn.addEventListener('click', async () => {
                const confirmed = await showConfirmModal(`Apakah Anda yakin ingin menghapus ${file.name} dari GitHub?`);
                if (!confirmed) return;

                await deletePhoto(file.path);

                const metaPath = `${file.path.substring(0, file.path.lastIndexOf('/'))}/${file.name}.meta.json`;
                await deletePhoto(metaPath);

                const scheduleIndex = allSchedules.findIndex(s => s.mediaUrl === file.download_url);
                if (scheduleIndex !== -1) {
                    allSchedules.splice(scheduleIndex, 1);
                    displaySchedules(allSchedules.slice(0, displayedSchedules));
                }
            });

            buttonGroup.appendChild(editBtn);
            buttonGroup.appendChild(scheduleBtn);
            item.appendChild(buttonGroup);
            item.appendChild(publishBtn);
            item.appendChild(deleteBtn);

            const deleteDirectBtn = document.createElement('button');
            deleteDirectBtn.classList.add('delete-direct-btn');
            deleteDirectBtn.textContent = '×';
            deleteDirectBtn.addEventListener('click', async () => {
                const confirmed = await showConfirmModal(`Apakah Anda yakin ingin menghapus ${file.name} dari GitHub?`);
                if (!confirmed) return;

                await deletePhoto(file.path);

                const metaPath = `${file.path.substring(0, file.path.lastIndexOf('/'))}/${file.name}.meta.json`;
                await deletePhoto(metaPath);

                const scheduleIndex = allSchedules.findIndex(s => s.mediaUrl === file.download_url);
                if (scheduleIndex !== -1) {
                    allSchedules.splice(scheduleIndex, 1);
                    displaySchedules(allSchedules.slice(0, displayedSchedules));
                }
            });
            item.appendChild(deleteDirectBtn);

            gallery.appendChild(item);
        });
    }

    async function fetchSchedules() {
        try {
            const params = new URLSearchParams();
            if (selectedAccountNum) params.append('accountNum', selectedAccountNum);
            if (selectedAccountId) params.append('accountId', selectedAccountId);

            const response = await fetch(`/api/get_schedules?${params.toString()}`);
            if (!response.ok) {
                throw new Error(`HTTP error fetching schedules! status: ${response.status}`);
            }
            const data = await response.json();
            console.log('Schedules fetched:', data);

            return data.schedules || [];
        } catch (error) {
            console.error('Error fetching schedules:', error);
            showFloatingNotification(`Error fetching schedules: ${error.message}`, true);
            return [];
        }
    }

    async function loadSchedules() {
        if (isLoadingSchedules) return;
        isLoadingSchedules = true;

        showFloatingNotification('Memuat jadwal...');
        spinner.classList.remove('hidden');

        try {
            allSchedules = await fetchSchedules();
            allSchedules.sort((a, b) => new Date(a.scheduleTime) - new Date(b.scheduleTime));
            displayedSchedules = 0;
            scheduleTableBody.innerHTML = '';
            displaySchedules(allSchedules.slice(0, ITEMS_PER_PAGE));
            displayedSchedules = ITEMS_PER_PAGE;
            updateTotalSchedules();

            if (allSchedules.length > displayedSchedules) {
                loadMoreBtn.classList.remove('hidden');
            } else {
                loadMoreBtn.classList.add('hidden');
            }

            allMediaFiles.forEach(file => {
                const schedule = allSchedules.find(s => s.mediaUrl === file.download_url);
                if (schedule && schedule.scheduleTime) {
                    scheduledTimes[file.path] = schedule.scheduleTime;
                } else {
                    delete scheduledTimes[file.path];
                }
            });

            displayGallery(allMediaFiles);
        } catch (error) {
            console.error('Error loading schedules:', error);
            showFloatingNotification(`Error loading schedules: ${error.message}`, true);
        } finally {
            spinner.classList.add('hidden');
            isLoadingSchedules = false;
        }
    }

    function displaySchedules(schedules) {
        if (schedules.length === 0 && displayedSchedules === 0) {
            scheduleTableBody.innerHTML = '<tr><td colspan="8" style="text-align: center;">Belum ada jadwal.</td></tr>';
            return;
        }

        schedules.forEach((schedule, index) => {
            const row = document.createElement('tr');

            const numberCell = document.createElement('td');
            numberCell.textContent = displayedSchedules - schedules.length + index + 1;
            row.appendChild(numberCell);

            const checkboxCell = document.createElement('td');
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.dataset.mediaUrl = schedule.mediaUrl;
            checkboxCell.appendChild(checkbox);
            row.appendChild(checkboxCell);

            const usernameCell = document.createElement('td');
            usernameCell.textContent = schedule.username || 'N/A';
            row.appendChild(usernameCell);

            const mediaCell = document.createElement('td');
            const img = document.createElement('img');
            img.src = schedule.mediaUrl;
            img.classList.add('schedule-media-preview');
            mediaCell.appendChild(img);
            row.appendChild(mediaCell);

            const captionCell = document.createElement('td');
            const captionSpan = document.createElement('span');
            captionSpan.classList.add('editable-caption');
            captionSpan.textContent = schedule.caption || 'Tidak ada caption';
            captionSpan.contentEditable = true;
            captionSpan.addEventListener('blur', async () => {
                const newCaption = captionSpan.textContent;
                if (newCaption === schedule.caption) return;

                showFloatingNotification('Menyimpan caption...');
                spinner.classList.remove('hidden');

                try {
                    const file = allMediaFiles.find(f => f.download_url === schedule.mediaUrl);
                    if (file) {
                        const commitMessage = `Update caption for ${file.name} [vercel-skip]`;
                        await saveCaptionToGithub(file, newCaption, commitMessage);
                        captions[file.path] = newCaption;
                        schedule.caption = newCaption;
                        showFloatingNotification('Caption berhasil disimpan!');
                        displayGallery(allMediaFiles);
                    } else {
                        schedule.caption = newCaption;
                        showFloatingNotification('Caption disimpan secara lokal.');
                    }
                } catch (error) {
                    showFloatingNotification(`Gagal menyimpan caption: ${error.message}`, true);
                    captionSpan.textContent = schedule.caption || 'Tidak ada caption';
                } finally {
                    spinner.classList.add('hidden');
                }
            });
            captionCell.appendChild(captionSpan);
            row.appendChild(captionCell);

            const timeCell = document.createElement('td');
            const timeSpan = document.createElement('span');
            timeSpan.classList.add('editable-time');
            const wibTime = convertToWIB(schedule.scheduleTime);
            timeSpan.textContent = formatToLocaleString(wibTime);
            timeSpan.addEventListener('click', () => {
                const input = document.createElement('input');
                input.type = 'datetime-local';
                input.value = formatToDatetimeLocal(wibTime);
                timeSpan.innerHTML = '';
                timeSpan.appendChild(input);
                input.focus();

                input.addEventListener('blur', async () => {
                    const newTime = input.value;
                    if (!newTime) {
                        timeSpan.textContent = formatToLocaleString(wibTime);
                        return;
                    }

                    const newDateTime = new Date(newTime);
                    const utcTime = new Date(newDateTime.getTime() - (7 * 60 * 60 * 1000));

                    showFloatingNotification('Menyimpan waktu...');
                    spinner.classList.remove('hidden');

                    try {
                        schedule.scheduleTime = utcTime.toISOString();
                        const file = allMediaFiles.find(f => f.download_url === schedule.mediaUrl);
                        if (file) {
                            scheduledTimes[file.path] = utcTime.toISOString();
                        }
                        const newWibTime = convertToWIB(utcTime);
                        timeSpan.textContent = formatToLocaleString(newWibTime);
                        showFloatingNotification('Waktu berhasil disimpan!');
                        allSchedules.sort((a, b) => new Date(a.scheduleTime) - new Date(b.scheduleTime));
                        displaySchedules(allSchedules.slice(0, displayedSchedules));
                        displayGallery(allMediaFiles);
                    } catch (error) {
                        showFloatingNotification(`Gagal menyimpan waktu: ${error.message}`, true);
                        timeSpan.textContent = formatToLocaleString(wibTime);
                    } finally {
                        spinner.classList.add('hidden');
                    }
                });
            });
            timeCell.appendChild(timeSpan);
            row.appendChild(timeCell);

            const statusCell = document.createElement('td');
            // Perbaikan error: pastikan schedule.status ada, jika tidak gunakan default 'scheduled'
            statusCell.textContent = schedule.status ? schedule.status.toLowerCase() : 'scheduled';
            row.appendChild(statusCell);

            const actionCell = document.createElement('td');
            const deleteBtn = document.createElement('button');
            deleteBtn.classList.add('delete-btn');
            deleteBtn.textContent = 'Hapus';
            deleteBtn.addEventListener('click', async () => {
                const confirmed = await showConfirmModal(`Apakah Anda yakin ingin menghapus jadwal ini?`);
                if (!confirmed) return;

                showFloatingNotification('Menghapus jadwal...');
                spinner.classList.remove('hidden');

                try {
                    const response = await fetch('/api/delete_schedule', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            mediaUrl: schedule.mediaUrl,
                            accountNum: schedule.accountNum,
                            accountId: schedule.accountId
                        }),
                    });

                    if (!response.ok) {
                        throw new Error(`HTTP error deleting schedule! status: ${response.status}`);
                    }

                    allSchedules = allSchedules.filter(s => s.mediaUrl !== schedule.mediaUrl);
                    const file = allMediaFiles.find(f => f.download_url === schedule.mediaUrl);
                    if (file) {
                        delete scheduledTimes[file.path];
                    }
                    displaySchedules(allSchedules.slice(0, displayedSchedules));
                    displayGallery(allMediaFiles);
                    showFloatingNotification('Jadwal berhasil dihapus!');
                    updateTotalSchedules();
                } catch (error) {
                    showFloatingNotification(`Gagal menghapus jadwal: ${error.message}`, true);
                    console.error('Error deleting schedule:', error);
                } finally {
                    spinner.classList.add('hidden');
                }
            });
            actionCell.appendChild(deleteBtn);
            row.appendChild(actionCell);

            scheduleTableBody.appendChild(row);
        });
    }

    loadMoreBtn.addEventListener('click', () => {
        const nextSchedules = allSchedules.slice(displayedSchedules, displayedSchedules + ITEMS_PER_PAGE);
        displaySchedules(nextSchedules);
        displayedSchedules += ITEMS_PER_PAGE;

        if (displayedSchedules >= allSchedules.length) {
            loadMoreBtn.classList.add('hidden');
        }
    });

    selectAll.addEventListener('change', () => {
        const checkboxes = scheduleTableBody.querySelectorAll('input[type="checkbox"]');
        checkboxes.forEach(checkbox => {
            checkbox.checked = selectAll.checked;
        });
    });

    deleteSelected.addEventListener('click', async () => {
        const checkboxes = scheduleTableBody.querySelectorAll('input[type="checkbox"]:checked');
        if (checkboxes.length === 0) {
            showFloatingNotification('Pilih setidaknya satu jadwal untuk dihapus.', true);
            return;
        }

        const confirmed = await showConfirmModal(`Apakah Anda yakin ingin menghapus ${checkboxes.length} jadwal terpilih?`);
        if (!confirmed) return;

        showFloatingNotification('Menghapus jadwal terpilih...');
        spinner.classList.remove('hidden');

        try {
            const mediaUrls = Array.from(checkboxes).map(checkbox => checkbox.dataset.mediaUrl);
            const response = await fetch('/api/delete_schedules', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ mediaUrls }),
            });

            if (!response.ok) {
                throw new Error(`HTTP error deleting schedules! status: ${response.status}`);
            }

            allSchedules = allSchedules.filter(schedule => !mediaUrls.includes(schedule.mediaUrl));
            mediaUrls.forEach(mediaUrl => {
                const file = allMediaFiles.find(f => f.download_url === mediaUrl);
                if (file) {
                    delete scheduledTimes[file.path];
                }
            });

            displayedSchedules = 0;
            scheduleTableBody.innerHTML = '';
            displaySchedules(allSchedules.slice(0, ITEMS_PER_PAGE));
            displayedSchedules = ITEMS_PER_PAGE;

            if (allSchedules.length > displayedSchedules) {
                loadMoreBtn.classList.remove('hidden');
            } else {
                loadMoreBtn.classList.add('hidden');
            }

            displayGallery(allMediaFiles);
            showFloatingNotification(`${mediaUrls.length} jadwal berhasil dihapus!`);
            updateTotalSchedules();
        } catch (error) {
            showFloatingNotification(`Gagal menghapus jadwal: ${error.message}`, true);
            console.error('Error deleting schedules:', error);
        } finally {
            spinner.classList.add('hidden');
        }
    });

    function updateTotalSchedules() {
        totalSchedules.textContent = `Total: ${allSchedules.length} jadwal`;
    }

    scheduleAll.addEventListener('click', async () => {
        if (allMediaFiles.length === 0) {
            showFloatingNotification('Tidak ada file media untuk dijadwalkan.', true);
            return;
        }

        if (!startDateTime.value) {
            showFloatingNotification('Pilih tanggal dan jam awal terlebih dahulu.', true);
            return;
        }

        const startTime = new Date(startDateTime.value);
        const utcStartTime = new Date(startTime.getTime() - (7 * 60 * 60 * 1000));
        let currentTime = utcStartTime;
        const skip = skipDay.checked;

        showFloatingNotification('Menjadwalkan semua file...');
        spinner.classList.remove('hidden');

        try {
            allMediaFiles.forEach((file, index) => {
                scheduledTimes[file.path] = currentTime.toISOString();
                const wibTime = convertToWIB(currentTime);
                const existingScheduleIndex = allSchedules.findIndex(s => s.mediaUrl === file.download_url);
                if (existingScheduleIndex !== -1) {
                    allSchedules[existingScheduleIndex].scheduleTime = currentTime.toISOString();
                } else {
                    allSchedules.push({
                        accountNum: selectedAccountNum,
                        accountId: selectedAccountId,
                        username: selectedUsername,
                        mediaUrl: file.download_url,
                        caption: captions[file.path] || '',
                        scheduleTime: currentTime.toISOString(),
                        status: 'scheduled'
                    });
                }

                if (skip) {
                    currentTime = new Date(currentTime.getTime() + (2 * 24 * 60 * 60 * 1000));
                } else {
                    currentTime = new Date(currentTime.getTime() + (24 * 60 * 60 * 1000));
                }
            });

            allSchedules.sort((a, b) => new Date(a.scheduleTime) - new Date(b.scheduleTime));
            displayedSchedules = 0;
            scheduleTableBody.innerHTML = '';
            displaySchedules(allSchedules.slice(0, ITEMS_PER_PAGE));
            displayedSchedules = ITEMS_PER_PAGE;

            if (allSchedules.length > displayedSchedules) {
                loadMoreBtn.classList.remove('hidden');
            } else {
                loadMoreBtn.classList.add('hidden');
            }

            displayGallery(allMediaFiles);
            showFloatingNotification('Semua file berhasil dijadwalkan!');
            updateTotalSchedules();
        } catch (error) {
            showFloatingNotification(`Gagal menjadwalkan: ${error.message}`, true);
            console.error('Error scheduling:', error);
        } finally {
            spinner.classList.add('hidden');
        }
    });

    saveSchedules.addEventListener('click', async () => {
        if (allSchedules.length === 0) {
            showFloatingNotification('Tidak ada jadwal untuk disimpan.', true);
            return;
        }

        showFloatingNotification('Menyimpan jadwal...');
        spinner.classList.remove('hidden');

        try {
            const response = await fetch('/api/save_schedules', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ schedules: allSchedules }),
            });

            if (!response.ok) {
                throw new Error(`HTTP error saving schedules! status: ${response.status}`);
            }

            showFloatingNotification('Jadwal berhasil disimpan!');
        } catch (error) {
            showFloatingNotification(`Gagal menyimpan jadwal: ${error.message}`, true);
            console.error('Error saving schedules:', error);
        } finally {
            spinner.classList.add('hidden');
        }
    });

    loadGithubFolders();
    loadSchedules();
});
