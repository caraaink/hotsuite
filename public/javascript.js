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
let selectedPhotos = new Set();

// Sembunyikan deleteContainer saat halaman dimuat
const deleteContainer = document.getElementById('deleteContainer');
deleteContainer.classList.add('hidden');
console.log('deleteContainer hidden on page load');

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

// Function to show floating notification with auto-hide
function showFloatingNotification(message, isError = false) {
    status.textContent = message;
    floatingNotification.classList.remove('hidden');
    if (isError) {
        floatingNotification.classList.add('error');
    } else {
        floatingNotification.classList.remove('error');
    }
    // Auto-hide after 5 seconds
    setTimeout(() => {
        floatingNotification.classList.add('hidden');
    }, 5000);
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

// Load Instagram usernames when an account is selected
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

        const accountsRes = await fetch(`/api/get_accounts?account_key=Akun ${accountNum}`);
        if (!accountsRes.ok) {
            throw new Error(`HTTP error fetching accounts! status: ${accountsRes.status}`);
        }
        const accountsData = await accountsRes.json();
        console.log('Accounts fetched:', accountsData);

        accountId.innerHTML = '<option value="">-- Pilih Username --</option>';
        if (accountsData.accounts && accountsData.accounts[`Akun ${accountNum}`]) {
            const igAccounts = accountsData.accounts[`Akun ${accountNum}`].accounts;
            console.log('IG accounts:', igAccounts);
            if (igAccounts && igAccounts.length > 0) {
                igAccounts.forEach(acc => {
                    if (acc.type === 'ig' && acc.username) {
                        const option = document.createElement('option');
                        option.value = acc.id;
                        option.textContent = acc.username;
                        option.dataset.username = acc.username;
                        accountId.appendChild(option);
                    }
                });
                if (accountId.options.length === 1) {
                    showFloatingNotification('No Instagram accounts found for this account.', true);
                }
            } else {
                showFloatingNotification('No Instagram accounts found for this account.', true);
            }
        } else {
            showFloatingNotification('No accounts data found for this account.', true);
        }

        await loadSchedules();
    } catch (error) {
        showFloatingNotification(`Error fetching accounts: ${error.message}`, true);
        console.error('Error fetching accounts:', error);
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
        data.files.forEach(item => {
            if (item.type === 'file' && (item.name.endsWith('.jpg') || item.name.endsWith('.png') || item.name.endsWith('.mp4'))) {
                allMediaFiles.push({
                    name: item.name,
                    path: item.path,
                    download_url: item.download_url,
                });
            }
        });

        allMediaFiles.sort(naturalSort);

        // Siapkan daftar path untuk file metadata
        const metaPaths = allMediaFiles.map(file => {
            const folderPath = file.path.substring(0, file.path.lastIndexOf('/'));
            const metaFileName = `${file.name}.meta.json`;
            return `${folderPath}/${metaFileName}`;
        });

        // Ambil semua metadata dalam satu permintaan
        try {
            const metaRes = await fetch(`/api/get_file_content?${metaPaths.map(path => `paths=${encodeURIComponent(path)}`).join('&')}`);
            if (!metaRes.ok) {
                throw new Error(`HTTP error fetching metadata! status: ${metaRes.status}`);
            }
            const metaData = await metaRes.json();

            // Proses hasil metadata
            allMediaFiles.forEach(file => {
                const folderPath = file.path.substring(0, file.path.lastIndexOf('/'));
                const metaPath = `${folderPath}/${file.name}.meta.json`;
                captions[file.path] = metaData[metaPath]?.caption || '';
            });
        } catch (error) {
            console.error('Error fetching metadata:', error);
            allMediaFiles.forEach(file => {
                captions[file.path] = '';
            });
        }

        return allMediaFiles;
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
    // Reset state sebelum memuat folder baru
    allMediaFiles = [];
    captions = {};
    scheduledTimes = {};
    gallery.innerHTML = '';
    mediaUrl.value = '';
    // Sembunyikan deleteContainer saat folder diubah
    deleteContainer.classList.add('hidden');
    console.log('deleteContainer hidden on githubFolder change');

    if (!folderPath) {
        subfolderContainer.classList.remove('hidden');
        githubSubfolder.innerHTML = '<option value="">-- Pilih Subfolder --</option>';
        return;
    }

    try {
        // Cek apakah folder yang dipilih adalah 'image'
        if (folderPath === 'ig/image') {
            // Sembunyikan dropdown subfolder
            subfolderContainer.classList.add('hidden');
            // Langsung muat file di folder ig/image
            const files = await fetchFilesInSubfolder(folderPath);
            allMediaFiles = files; // Pastikan allMediaFiles diperbarui
            displayGallery(files);

            if (files.length === 0) {
                showFloatingNotification('No supported media files found in this folder.', true);
            } else {
                showFloatingNotification('');
            }
        } else {
            // Untuk folder lain, tampilkan dropdown subfolder seperti biasa
            subfolderContainer.classList.remove('hidden');
            const subfolders = await fetchSubfolders(folderPath);
            console.log('All subfolders found:', subfolders);

            if (subfolders.length === 0) {
                const files = await fetchFilesInSubfolder(folderPath);
                allMediaFiles = files; // Pastikan allMediaFiles diperbarui
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
    }
});

githubSubfolder.addEventListener('change', async () => {
    const subfolderPath = githubSubfolder.value;
    // Reset state sebelum memuat subfolder baru
    allMediaFiles = [];
    captions = {};
    scheduledTimes = {};
    gallery.innerHTML = '';
    mediaUrl.value = '';
    // Sembunyikan deleteContainer saat subfolder diubah
    deleteContainer.classList.add('hidden');
    console.log('deleteContainer hidden on githubSubfolder change');

    if (!subfolderPath) {
        return;
    }

    try {
        const files = await fetchFilesInSubfolder(subfolderPath);
        console.log('All media files found:', files);
        allMediaFiles = files; // Pastikan allMediaFiles diperbarui

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

// Load folder tujuan untuk upload
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
            if (item.path !== 'ig/image') { // Hindari duplikat ig/image
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

// Panggil fungsi untuk memuat folder tujuan saat halaman dimuat
loadUploadFolders();

// Upload multiple files to GitHub
uploadToGithub.addEventListener('click', async () => {
    if (!uploadFile.files || uploadFile.files.length === 0) {
        showFloatingNotification('Pilih file terlebih dahulu.', true);
        return;
    }

    let uploadFolderValue = uploadFolder.value.trim(); // Ambil nilai dari input teks dan hapus spasi
    // Jika input kosong, gunakan default path 'ig/image'
    if (!uploadFolderValue) {
        uploadFolderValue = 'ig/image';
    } else {
        // Pastikan path folder dimulai dengan 'ig/' jika tidak kosong
        if (!uploadFolderValue.startsWith('ig/')) {
            uploadFolderValue = `ig/${uploadFolderValue}`;
        }

        // Validasi format path (opsional, tambahkan sesuai kebutuhan)
        const invalidChars = /[<>:"|?*]/;
        if (invalidChars.test(uploadFolderValue)) {
            showFloatingNotification('Path folder tujuan mengandung karakter yang tidak diizinkan.', true);
            return;
        }
    }

    const files = Array.from(uploadFile.files);

    // Validasi format file
    const validFiles = files.filter(file => 
        file.type.match('image/jpeg') || 
        file.type.match('image/png') || 
        file.type.match('video/mp4')
    );

    if (validFiles.length !== files.length) {
        showFloatingNotification('Semua file harus berupa JPG, PNG, JPEG, atau MP4.', true);
        return;
    }

    // Tambahkan indikator progres
    let uploadedCount = 0;
    const totalFiles = validFiles.length;
    showFloatingNotification(`Mengunggah file 1 dari ${totalFiles}...`);
    spinner.classList.remove('hidden');

    try {
        // Upload files one by one to avoid race conditions
        for (const file of validFiles) {
            const reader = new FileReader();
            const result = await new Promise((resolve, reject) => {
                reader.readAsDataURL(file);
                reader.onload = async () => {
                    try {
                        const base64Content = reader.result.split(',')[1];
                        let newFileName;

                        // Cek apakah input Folder Tujuan diisi
                        if (uploadFolderValue && uploadFolderValue !== 'ig/image') {
                            // Gunakan nama file asli jika Folder Tujuan diisi
                            newFileName = file.name;
                        } else {
                            // Gunakan nama random jika Folder Tujuan kosong atau default ig/image
                            const randomNum = Math.floor(10000 + Math.random() * 90000);
                            const extension = file.name.split('.').pop();
                            newFileName = `${randomNum}.${extension}`;
                        }

                        const filePath = `${uploadFolderValue}/${newFileName}`;

                        // Selalu tambahkan [vercel-skip] untuk file di folder ig dan subfoldernya
                        const commitMessage = uploadFolderValue.startsWith('ig/') 
                            ? `Upload ${newFileName} to ${uploadFolderValue} [vercel-skip]` 
                            : `Upload ${newFileName} to ${uploadFolderValue}`;

                        // Upload file utama
                        const fileResponse = await fetch('/api/upload_to_github', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                fileName: filePath,
                                content: base64Content,
                                message: commitMessage, // Tambahkan commit message
                            }),
                        });

                        if (!fileResponse.ok) {
                            throw new Error(`HTTP error uploading file ${newFileName}! status: ${fileResponse.status}`);
                        }

                        const fileResult = await fileResponse.json();
                        const newFile = {
                            name: newFileName,
                            path: filePath,
                            download_url: fileResult.download_url,
                        };

                        // Buat dan upload meta JSON
                        const metaFileName = `${uploadFolderValue}/${newFileName}.meta.json`;
                        const metaContent = JSON.stringify({ caption: '' }, null, 2);
                        const metaBase64Content = btoa(unescape(encodeURIComponent(metaContent)));

                        // Selalu tambahkan [vercel-skip] untuk meta file di folder ig dan subfoldernya
                        const metaCommitMessage = uploadFolderValue.startsWith('ig/') 
                            ? `Upload meta for ${newFileName} to ${uploadFolderValue} [vercel-skip]` 
                            : `Upload meta for ${newFileName} to ${uploadFolderValue}`;

                        const metaResponse = await fetch('/api/upload_to_github', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                fileName: metaFileName,
                                content: metaBase64Content,
                                message: metaCommitMessage, // Tambahkan commit message
                            }),
                        });

                        if (!metaResponse.ok) {
                            throw new Error(`HTTP error uploading meta for ${newFileName}! status: ${metaResponse.status}`);
                        }

                        const metaResult = await metaResponse.json();
                        allMediaFiles.push(newFile);
                        captions[newFile.path] = '';

                        // Update indikator progres
                        uploadedCount++;
                        if (uploadedCount < totalFiles) {
                            showFloatingNotification(`Mengunggah file ${uploadedCount + 1} dari ${totalFiles}...`);
                        }

                        resolve(newFile);
                    } catch (error) {
                        reject(error);
                    }
                };
                reader.onerror = () => reject(new Error(`Error reading file ${file.name}`));
            });
        }

        showFloatingNotification(`${validFiles.length} file berhasil diunggah ke GitHub!`);
        displayGallery(allMediaFiles);
    } catch (error) {
        showFloatingNotification(`Error uploading to GitHub: ${error.message}`, true);
        console.error('Error uploading to GitHub:', error);
    } finally {
        spinner.classList.add('hidden');
    }
});

// Fungsi untuk memperbarui jumlah foto yang dipilih
function updateSelectedCount() {
    const totalSelectedElement = document.getElementById('totalSelected');
    totalSelectedElement.textContent = `Terpilih: ${selectedPhotos.size} foto`;
}

// Fungsi untuk menghapus foto dan meta JSON terkait
async function deletePhoto(filePath) {
    showFloatingNotification(`Menghapus ${filePath}...`);
    spinner.classList.remove('hidden');

    try {
        // Selalu tambahkan [vercel-skip] untuk file di folder ig dan subfoldernya
        const folderPath = filePath.substring(0, filePath.lastIndexOf('/'));
        const commitMessage = folderPath.startsWith('ig/') 
            ? `Delete file ${filePath} [vercel-skip]` 
            : `Delete file ${filePath}`;

        const deleteResponse = await fetch('/api/delete_from_github', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                path: filePath,
                message: commitMessage, // Tambahkan commit message
            }),
        });

        if (!deleteResponse.ok) {
            throw new Error(`HTTP error deleting file from GitHub! status: ${deleteResponse.status}`);
        }

        const deleteResult = await deleteResponse.json();
        showFloatingNotification(`${deleteResult.message}`);

        // Hapus file dari allMediaFiles dan perbarui galeri
        allMediaFiles = allMediaFiles.filter(f => f.path !== filePath);
        delete captions[filePath];
        delete scheduledTimes[filePath];
        selectedPhotos.delete(filePath);
        displayGallery(allMediaFiles);
    } catch (error) {
        showFloatingNotification(`Gagal menghapus file dari GitHub: ${error.message}`, true);
        console.error('Error deleting file from GitHub:', error);
    } finally {
        spinner.classList.add('hidden');
    }
}

// Fungsi untuk menghapus foto yang dipilih secara massal
async function deleteSelectedPhotos() {
    if (selectedPhotos.size === 0) {
        showFloatingNotification('Pilih setidaknya satu foto untuk dihapus.', true);
        return;
    }

    if (!confirm(`Apakah Anda yakin ingin menghapus ${selectedPhotos.size} foto yang dipilih?`)) {
        return;
    }

    let deletedCount = 0;
    const totalToDelete = selectedPhotos.size;
    showFloatingNotification(`Menghapus foto 1 dari ${totalToDelete}...`);
    spinner.classList.remove('hidden');

    try {
        for (const filePath of selectedPhotos) {
            // Selalu tambahkan [vercel-skip] untuk file di folder ig dan subfoldernya
            const folderPath = filePath.substring(0, filePath.lastIndexOf('/'));
            const commitMessage = folderPath.startsWith('ig/') 
                ? `Delete file ${filePath} [vercel-skip]` 
                : `Delete file ${filePath}`;

            const deleteResponse = await fetch('/api/delete_from_github', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    path: filePath,
                    message: commitMessage, // Tambahkan commit message
                }),
            });

            if (!deleteResponse.ok) {
                throw new Error(`HTTP error deleting file ${filePath} from GitHub! status: ${deleteResponse.status}`);
            }

            const deleteResult = await deleteResponse.json();
            allMediaFiles = allMediaFiles.filter(f => f.path !== filePath);
            delete captions[filePath];
            delete scheduledTimes[filePath];
            selectedPhotos.delete(filePath);

            deletedCount++;
            if (deletedCount < totalToDelete) {
                showFloatingNotification(`Menghapus foto ${deletedCount + 1} dari ${totalToDelete}...`);
            }
        }

        showFloatingNotification(`${deletedCount} foto berhasil dihapus!`);
        displayGallery(allMediaFiles);
    } catch (error) {
        showFloatingNotification(`Gagal menghapus foto: ${error.message}`, true);
        console.error('Error deleting selected photos:', error);
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
                message: commitMessage, // Tambahkan commit message
            }),
        });

        if (!response.ok) {
            throw new Error(`HTTP error uploading meta to GitHub! status: ${response.status}`);
        }

        const result = await response.json();
        console.log(`Meta file ${metaPath} saved to GitHub:`, result);
        return true;
    } catch (error) {
        console.error(`Error saving meta file for ${file.name}:`, error);
        showFloatingNotification(`Error saving meta file for ${file.name}: ${error.message}`, true);
        return false;
    }
}

function displayGallery(files) {
    gallery.innerHTML = '';
    const imageFiles = files.filter(file => file.name.endsWith('.jpg') || file.name.endsWith('.png'));

    if (imageFiles.length === 0) {
        gallery.innerHTML = '<p>Tidak ada gambar untuk ditampilkan.</p>';
        // Sembunyikan tombol hapus massal jika galeri kosong
        deleteContainer.classList.add('hidden');
        console.log('deleteContainer hidden in displayGallery (gallery empty)');
        return;
    }

    // Tampilkan tombol hapus massal jika ada foto di galeri
    deleteContainer.classList.remove('hidden');
    console.log('deleteContainer shown in displayGallery (gallery has images)');

    function formatDateTime(date, hours, minutes) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const formatted = `${year}-${month}-${day}T${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
        return formatted;
    }

    imageFiles.forEach((file, index) => {
        const container = document.createElement('div');
        container.className = 'gallery-item';

        // Tambahkan checkbox untuk seleksi
        const checkboxContainer = document.createElement('div');
        checkboxContainer.className = 'checkbox-container';
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.className = 'photo-checkbox';
        checkbox.dataset.filePath = file.path;
        checkbox.addEventListener('change', () => {
            if (checkbox.checked) {
                selectedPhotos.add(file.path);
            } else {
                selectedPhotos.delete(file.path);
            }
            updateSelectedCount();
        });
        checkboxContainer.appendChild(checkbox);
        container.appendChild(checkboxContainer);

        const img = document.createElement('img');
        img.src = file.download_url;
        img.alt = file.name;
        img.dataset.fileData = JSON.stringify(file);
        img.addEventListener('click', () => {
            gallery.querySelectorAll('img').forEach(i => i.classList.remove('selected'));
            img.classList.add('selected');
            mediaUrl.value = file.download_url;
        });

        // Tambahkan tombol hapus langsung (tanda X)
        const deleteDirectBtn = document.createElement('button');
        deleteDirectBtn.className = 'delete-direct-btn';
        deleteDirectBtn.textContent = '×';
        deleteDirectBtn.addEventListener('click', async () => {
            if (confirm(`Apakah Anda yakin ingin menghapus ${file.name}?`)) {
                await deletePhoto(file.path);
            }
        });
        container.appendChild(deleteDirectBtn);

        const name = document.createElement('p');
        name.textContent = file.name;

        const captionText = document.createElement('p');
        captionText.className = 'caption-text';
        captionText.textContent = captions[file.path] || 'Tidak ada caption';

        const scheduleTime = document.createElement('p');
        scheduleTime.className = 'schedule-time';
        scheduleTime.textContent = scheduledTimes[file.path] ? formatToLocaleString(convertToWIB(scheduledTimes[file.path])) : 'Belum dijadwalkan';

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

                // Selalu tambahkan [vercel-skip] untuk meta file di folder ig dan subfoldernya
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
            cancelBtn.addEventListener('click', () => editor.remove());
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
            const saveBtn = document.createElement('button');
            saveBtn.textContent = 'Jadwalkan';
            saveBtn.addEventListener('click', () => {
                if (!datetimeInput.value) {
                    showFloatingNotification('Pilih waktu terlebih dahulu.', true);
                    return;
                }

                scheduledTimes[file.path] = datetimeInput.value;
                scheduleTime.textContent = formatToLocaleString(convertToWIB(scheduledTimes[file.path]));
                editor.remove();
                showFloatingNotification(`Waktu jadwal untuk ${file.name} disimpan sementara. Klik "Simpan Jadwal" untuk mengirimkan.`);
            });
            const cancelBtn = document.createElement('button');
            cancelBtn.textContent = 'Batal';
            cancelBtn.addEventListener('click', () => editor.remove());
            editor.appendChild(datetimeInput);
            editor.appendChild(saveBtn);
            editor.appendChild(cancelBtn);
            container.appendChild(editor);
        });

        const publishBtn = document.createElement('button');
        publishBtn.className = 'btn publish';
        publishBtn.textContent = 'Publish';
        publishBtn.addEventListener('click', async () => {
            if (!selectedToken || !accountId.value) {
                showFloatingNotification('Pilih akun dan username terlebih dahulu.', true);
                return;
            }

            showFloatingNotification('Mempublikasikan...');
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
                showFloatingNotification(result.message || 'Berhasil dipublikasikan!');

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
        container.appendChild(publishBtn);
        gallery.appendChild(container);

        if (startDateTime.value && !scheduledTimes[file.path]) {
            const start = new Date(startDateTime.value);
            const hours = start.getHours();
            const minutes = start.getMinutes();
            const dayIncrement = skipDay.checked ? 2 : 1;
            const newDate = new Date(start);
            newDate.setDate(start.getDate() + (index * dayIncrement));
            scheduledTimes[file.path] = formatDateTime(newDate, hours, minutes);
            scheduleTime.textContent = formatToLocaleString(convertToWIB(scheduledTimes[file.path]));
        }
    });

    // Reset selected photos dan update count
    selectedPhotos.clear();
    updateSelectedCount();

    // Tambahkan event listener untuk tombol hapus massal
    const deleteSelectedPhotosBtn = document.getElementById('deleteSelectedPhotos');
    deleteSelectedPhotosBtn.removeEventListener('click', deleteSelectedPhotos); // Hapus listener lama jika ada
    deleteSelectedPhotosBtn.addEventListener('click', deleteSelectedPhotos);

    // Reset jadwal jika tanggal/jam awal dihapus
    startDateTime.addEventListener('input', () => {
        if (!startDateTime.value) {
            // Reset semua jadwal di galeri
            Object.keys(scheduledTimes).forEach(filePath => {
                delete scheduledTimes[filePath];
            });
            // Perbarui tampilan jadwal di galeri
            Array.from(gallery.children).forEach(container => {
                const scheduleTimeElement = container.querySelector('.schedule-time');
                if (scheduleTimeElement) {
                    scheduleTimeElement.textContent = 'Belum dijadwalkan';
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
            const scheduleTimeElement = gallery.children[index].querySelector('.schedule-time');
            scheduleTimeElement.textContent = formatToLocaleString(convertToWIB(scheduledTimes[file.path]));
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
            const scheduleTimeElement = gallery.children[index].querySelector('.schedule-time');
            scheduleTimeElement.textContent = formatToLocaleString(convertToWIB(scheduledTimes[file.path]));
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
        imageFiles.forEach((file, index) => {
            const newDate = new Date(start);
            newDate.setDate(start.getDate() + (index * dayIncrement));
            scheduledTimes[file.path] = formatDateTime(newDate, hours, minutes);
            const scheduleTimeElement = gallery.children[index].querySelector('.schedule-time');
            scheduleTimeElement.textContent = formatToLocaleString(convertToWIB(scheduledTimes[file.path]));
        });

        showFloatingNotification(`Waktu jadwal untuk semua foto disimpan sementara. Klik "Simpan Jadwal" untuk mengirimkan.`);
        window.history.pushState({}, document.title, window.location.pathname);
    });

    saveSchedules.addEventListener('click', async () => {
        if (!selectedToken || !accountId.value) {
            showFloatingNotification('Pilih akun dan username terlebih dahulu.', true);
            return;
        }

        const scheduledFiles = imageFiles.filter(file => scheduledTimes[file.path]);
        if (scheduledFiles.length === 0) {
            showFloatingNotification('Tidak ada foto yang dijadwalkan.', true);
            return;
        }

        showFloatingNotification('Menyimpan jadwal...');
        spinner.classList.remove('hidden');

        try {
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
                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(`HTTP error scheduling post! status: ${response.status}, details: ${JSON.stringify(errorData)}`);
                }
            }
            showFloatingNotification(`${scheduledFiles.length} foto berhasil dijadwalkan!`);
            scheduledTimes = {};
            await loadSchedules();
        } catch (error) {
            showFloatingNotification(`Error scheduling: ${error.message}`, true);
            console.error('Error scheduling posts:', error);
        } finally {
            spinner.classList.add('hidden');
        }
    });
}

loadGithubFolders();

async function deleteSchedule(index) {
    try {
        const res = await fetch('/api/delete_schedule', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ index }),
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
    }
}

async function updateSchedule(index, updatedData) {
    try {
        const res = await fetch('/api/update_schedule', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ index, ...updatedData }),
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

    const indices = Array.from(checkboxes).map(checkbox => parseInt(checkbox.dataset.index, 10));
    indices.sort((a, b) => b - a);

    try {
        for (const index of indices) {
            await deleteSchedule(index);
        }
        showFloatingNotification(`${indices.length} jadwal berhasil dihapus!`);
    } catch (error) {
        showFloatingNotification(`Error deleting schedules: ${error.message}`, true);
        console.error('Error deleting schedules:', error);
    }
}

function renderSchedules(schedulesToRender, startIndex) {
    schedulesToRender.forEach((schedule, idx) => {
        const globalIndex = startIndex + idx;
        const wibTime = convertToWIB(schedule.time);
        const formattedWibTime = formatToDatetimeLocal(wibTime);
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${globalIndex + 1}</td>
            <td><input type="checkbox" class="schedule-checkbox" data-index="${globalIndex}"></td>
            <td>${schedule.username || 'Unknown'}</td>
            <td><img src="${schedule.mediaUrl}" alt="Media" class="schedule-media-preview"></td>
            <td class="editable-caption" contenteditable="true" data-index="${globalIndex}">${schedule.caption}</td>
            <td class="editable-time" data-index="${globalIndex}">
                <input type="datetime-local" class="time-input" value="${formattedWibTime}">
            </td>
            <td>${schedule.completed ? 'Selesai' : 'Menunggu'}</td>
            <td>
                <button class="delete-btn" data-index="${globalIndex}">Hapus</button>
            </td>
        `;
        scheduleTableBody.appendChild(row);
    });

    // Tambah event listener untuk inline editing
    document.querySelectorAll('.editable-caption').forEach(cell => {
        cell.addEventListener('blur', async (e) => {
            const index = parseInt(e.target.dataset.index, 10);
            const newCaption = e.target.textContent.trim();
            await updateSchedule(index, { caption: newCaption });
        });
    });

    document.querySelectorAll('.editable-time .time-input').forEach(input => {
        input.addEventListener('change', async (e) => {
            const index = parseInt(e.target.parentElement.dataset.index, 10);
            const newTime = e.target.value;
            await updateSchedule(index, { time: newTime });
        });
    });

    document.querySelectorAll('.delete-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            const index = parseInt(e.target.getAttribute('data-index'), 10);
            if (confirm('Apakah Anda yakin ingin menghapus jadwal ini?')) {
                deleteSchedule(index);
            }
        });
    });
}

async function loadSchedules() {
    try {
        scheduleTableBody.innerHTML = '<tr><td colspan="8">Memuat jadwal...</td></tr>';
        const res = await fetch('/api/get_schedules');
        if (!res.ok) {
            throw new Error(`HTTP error fetching schedules! status: ${res.status}`);
        }
        const data = await res.json();
        console.log('Schedules fetched:', data);

        scheduleTableBody.innerHTML = '';
        allSchedules = data.schedules || [];

        let filteredSchedules = allSchedules;
        if (selectedAccountNum) {
            filteredSchedules = filteredSchedules.filter(schedule => schedule.accountNum === selectedAccountNum);
        }
        if (selectedAccountId) {
            filteredSchedules = filteredSchedules.filter(schedule => schedule.accountId === selectedAccountId);
        }

        displayedSchedules = 0;

        if (filteredSchedules.length > 0) {
            // Tampilkan 20 jadwal pertama
            const initialSchedules = filteredSchedules.slice(0, ITEMS_PER_PAGE);
            renderSchedules(initialSchedules, 0);
            displayedSchedules = initialSchedules.length;

            // Tampilkan total jadwal
            totalSchedules.textContent = `Total: ${filteredSchedules.length} jadwal`;

            // Tampilkan tombol Load More jika masih ada jadwal yang belum ditampilkan
            if (displayedSchedules < filteredSchedules.length) {
                loadMoreBtn.classList.remove('hidden');
            } else {
                loadMoreBtn.classList.add('hidden');
            }

            // Event listener untuk tombol Load More
            loadMoreBtn.removeEventListener('click', loadMoreSchedules); // Hapus listener lama jika ada
            loadMoreBtn.addEventListener('click', loadMoreSchedules);

            selectAll.addEventListener('change', () => {
                const checkboxes = document.querySelectorAll('.schedule-checkbox');
                checkboxes.forEach(checkbox => {
                    checkbox.checked = selectAll.checked;
                });
            });

            deleteSelected.addEventListener('click', () => {
                if (confirm('Apakah Anda yakin ingin menghapus jadwal yang dipilih?')) {
                    deleteSelectedSchedules();
                }
            });
        } else {
            scheduleTableBody.innerHTML = '<tr><td colspan="8">Belum ada jadwal untuk akun ini.</td></tr>';
            totalSchedules.textContent = 'Total: 0 jadwal';
            loadMoreBtn.classList.add('hidden');
        }
    } catch (error) {
        showFloatingNotification(`Error loading schedules: ${error.message}`, true);
        console.error('Error fetching schedules:', error);
        scheduleTableBody.innerHTML = '<tr><td colspan="8">Gagal memuat jadwal.</td></tr>';
        totalSchedules.textContent = 'Total: 0 jadwal';
        loadMoreBtn.classList.add('hidden');
    }
}

function loadMoreSchedules() {
    const filteredSchedules = allSchedules.filter(schedule => {
        if (selectedAccountNum && schedule.accountNum !== selectedAccountNum) return false;
        if (selectedAccountId && schedule.accountId !== selectedAccountId) return false;
        return true;
    });

    const nextSchedules = filteredSchedules.slice(displayedSchedules, displayedSchedules + ITEMS_PER_PAGE);
    renderSchedules(nextSchedules, displayedSchedules);
    displayedSchedules += nextSchedules.length;

    if (displayedSchedules >= filteredSchedules.length) {
        loadMoreBtn.classList.add('hidden');
    }
}

loadSchedules();
