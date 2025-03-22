const form = document.getElementById('scheduleForm');
const status = document.getElementById('status');
const spinner = document.getElementById('spinner');
const accountId = document.getElementById('accountId');
const userAccount = document.getElementById('userAccount');
const githubFolder = document.getElementById('githubFolder');
const githubSubfolder = document.getElementById('githubSubfolder');
const githubFile = document.getElementById('githubFile');
const gallery = document.getElementById('gallery');
const mediaUrl = document.getElementById('mediaUrl');
const scheduleTableBody = document.getElementById('scheduleTableBody');
const themeToggle = document.getElementById('themeToggle');
const themeMenu = document.getElementById('themeMenu');
const toggleDarkMode = document.getElementById('toggleDarkMode');
let selectedToken = null;
let selectedUsername = null;
let selectedAccountNum = null;
let allSubfolders = [];
let allMediaFiles = [];
let captions = {};

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
                    status.innerText = 'No Instagram accounts found for this account.';
                }
            } else {
                status.innerText = 'No Instagram accounts found for this account.';
            }
        } else {
            status.innerText = 'No accounts data found for this account.';
        }

        await loadSchedules();
    } catch (error) {
        status.innerText = `Error fetching accounts: ${error.message}`;
        console.error('Error fetching accounts:', error);
    }
});

accountId.addEventListener('change', () => {
    const selectedOption = accountId.options[accountId.selectedIndex];
    selectedUsername = selectedOption ? selectedOption.dataset.username : null;
    console.log('Selected username:', selectedUsername);
});

function naturalSort(a, b) {
    const aKey = a.name || a.path || a;
    const bKey = b.name || b.path || b;
    return aKey.localeCompare(bKey, undefined, { numeric: true, sensitivity: 'base' });
}

async function loadGithubFolders() {
    status.innerText = 'Memuat daftar folder...';
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
            status.innerText = 'No subfolders found in ig directory.';
        } else {
            status.innerText = '';
        }
    } catch (error) {
        status.innerText = `Error loading GitHub folders: ${error.message}`;
        console.error('Error fetching GitHub folders:', error);
    } finally {
        spinner.classList.add('hidden');
    }
}

async function fetchSubfolders(path) {
    status.innerText = 'Memuat daftar subfolder...';
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
        status.innerText = `Error loading subfolders: ${error.message}`;
        return [];
    } finally {
        spinner.classList.add('hidden');
    }
}

async function fetchFilesInSubfolder(path) {
    status.innerText = 'Memuat daftar file...';
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

        for (const file of allMediaFiles) {
            try {
                const folderPath = file.path.substring(0, file.path.lastIndexOf('/'));
                const metaFileName = `${file.name}.meta.json`;
                const metaPath = `${folderPath}/${metaFileName}`;
                const metaRes = await fetch(`/api/get_file_content?path=${metaPath}`);
                if (metaRes.ok) {
                    const metaData = await metaRes.json();
                    captions[file.path] = metaData.caption || '';
                } else {
                    captions[file.path] = '';
                }
            } catch (error) {
                captions[file.path] = '';
                console.error(`Error fetching caption for ${file.name}:`, error);
            }
        }

        return allMediaFiles;
    } catch (error) {
        console.error(`Error fetching files for path ${path}:`, error);
        status.innerText = `Error loading files: ${error.message}`;
        return [];
    } finally {
        spinner.classList.add('hidden');
    }
}

githubFolder.addEventListener('change', async () => {
    const folderPath = githubFolder.value;
    if (!folderPath) {
        githubSubfolder.innerHTML = '<option value="">-- Pilih Subfolder --</option>';
        githubFile.innerHTML = '<option value="">-- Pilih File --</option>';
        gallery.innerHTML = '';
        mediaUrl.value = '';
        captions = {};
        return;
    }

    try {
        const subfolders = await fetchSubfolders(folderPath);
        console.log('All subfolders found:', subfolders);

        if (subfolders.length === 0) {
            const files = await fetchFilesInSubfolder(folderPath);
            githubSubfolder.innerHTML = '<option value="">-- Tidak Ada Subfolder --</option>';
            githubFile.innerHTML = '<option value="">-- Pilih File --</option>';
            files.forEach(file => {
                const option = document.createElement('option');
                option.value = JSON.stringify(file);
                option.textContent = file.name;
                githubFile.appendChild(option);
            });

            displayGallery(files);

            if (githubFile.options.length === 1) {
                status.innerText = 'No supported media files found in this folder.';
            } else {
                status.innerText = '';
            }
        } else {
            githubSubfolder.innerHTML = '<option value="">-- Pilih Subfolder --</option>';
            subfolders.forEach(subfolder => {
                const option = document.createElement('option');
                option.value = subfolder.path;
                option.textContent = subfolder.name;
                githubSubfolder.appendChild(option);
            });

            githubFile.innerHTML = '<option value="">-- Pilih File --</option>';
            gallery.innerHTML = '';
            mediaUrl.value = '';
            captions = {};

            if (githubSubfolder.options.length === 1) {
                status.innerText = 'No subfolders found in this folder.';
            } else {
                status.innerText = '';
            }
        }
    } catch (error) {
        status.innerText = `Error loading subfolders: ${error.message}`;
        console.error('Error fetching subfolders:', error);
    }
});

githubSubfolder.addEventListener('change', async () => {
    const subfolderPath = githubSubfolder.value;
    if (!subfolderPath) {
        githubFile.innerHTML = '<option value="">-- Pilih File --</option>';
        gallery.innerHTML = '';
        mediaUrl.value = '';
        captions = {};
        return;
    }

    try {
        const files = await fetchFilesInSubfolder(subfolderPath);
        console.log('All media files found:', files);

        githubFile.innerHTML = '<option value="">-- Pilih File --</option>';
        files.forEach(file => {
            const option = document.createElement('option');
            option.value = JSON.stringify(file);
            option.textContent = file.name;
            githubFile.appendChild(option);
        });

        displayGallery(files);

        if (githubFile.options.length === 1) {
            status.innerText = 'No supported media files found in this subfolder.';
        } else {
            status.innerText = '';
        }
    } catch (error) {
        status.innerText = `Error loading files: ${error.message}`;
        console.error('Error fetching files:', error);
    }
});

function displayGallery(files) {
    gallery.innerHTML = '';
    const imageFiles = files.filter(file => file.name.endsWith('.jpg') || file.name.endsWith('.png'));

    if (imageFiles.length === 0) {
        gallery.innerHTML = '<p>Tidak ada gambar untuk ditampilkan.</p>';
        return;
    }

    imageFiles.forEach(file => {
        const container = document.createElement('div');
        container.className = 'gallery-item';

        const img = document.createElement('img');
        img.src = file.download_url;
        img.alt = file.name;
        img.dataset.fileData = JSON.stringify(file);
        img.addEventListener('click', () => {
            gallery.querySelectorAll('img').forEach(i => i.classList.remove('selected'));
            img.classList.add('selected');
            githubFile.value = JSON.stringify(file);
            const changeEvent = new Event('change');
            githubFile.dispatchEvent(changeEvent);
        });

        const name = document.createElement('p');
        name.textContent = file.name;

        const captionText = document.createElement('p');
        captionText.className = 'caption-text';
        captionText.textContent = captions[file.path] || 'Tidak ada caption';

        const editBtn = document.createElement('button');
        editBtn.className = 'btn edit';
        editBtn.textContent = 'Edit';
        editBtn.addEventListener('click', () => {
            const editor = document.createElement('div');
            editor.className = 'caption-editor';
            const textarea = document.createElement('textarea');
            textarea.value = captions[file.path] || '';
            const saveBtn = document.createElement('button');
            saveBtn.textContent = 'Simpan';
            saveBtn.addEventListener('click', () => {
                captions[file.path] = textarea.value;
                captionText.textContent = captions[file.path] || 'Tidak ada caption';
                editor.remove();
                status.innerText = `Caption untuk ${file.name} berhasil disimpan.`;
            });
            const cancelBtn = document.createElement('button');
            cancelBtn.textContent = 'Batal';
            cancelBtn.addEventListener('click', () => editor.remove());
            editor.appendChild(textarea);
            editor.appendChild(saveBtn);
            editor.appendChild(cancelBtn);
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
            const saveBtn = document.createElement('button');
            saveBtn.textContent = 'Jadwalkan';
            saveBtn.addEventListener('click', async () => {
                if (!datetimeInput.value) {
                    status.innerText = 'Pilih waktu terlebih dahulu.';
                    return;
                }
                if (!selectedToken || !accountId.value) {
                    status.innerText = 'Pilih akun dan username terlebih dahulu.';
                    return;
                }

                const formData = {
                    accountId: accountId.value,
                    username: selectedUsername,
                    mediaUrl: file.download_url,
                    caption: captions[file.path] || '',
                    time: datetimeInput.value,
                    userToken: selectedToken,
                    accountNum: userAccount.value,
                    completed: false,
                };

                try {
                    const response = await fetch('/api/schedule', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(formData),
                    });
                    if (!response.ok) {
                        throw new Error(`HTTP error scheduling post! status: ${response.status}`);
                    }
                    const result = await response.json();
                    status.innerText = result.message || `Jadwal untuk ${file.name} berhasil ditambahkan!`;
                    editor.remove();
                    await loadSchedules();
                } catch (error) {
                    status.innerText = `Error scheduling: ${error.message}`;
                    console.error('Error scheduling post:', error);
                }
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
                status.innerText = 'Pilih akun dan username terlebih dahulu.';
                return;
            }

            status.innerText = 'Mempublikasikan...';
            spinner.classList.remove('hidden');
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
                status.innerText = result.message || 'Berhasil dipublikasikan!';
            } catch (error) {
                status.innerText = `Error publishing: ${error.message}`;
                console.error('Error publishing post:', error);
            } finally {
                spinner.classList.add('hidden');
            }
        });

        container.appendChild(img);
        container.appendChild(name);
        container.appendChild(captionText);
        container.appendChild(editBtn);
        container.appendChild(scheduleBtn);
        container.appendChild(publishBtn);
        gallery.appendChild(container);
    });
}

githubFile.addEventListener('change', async () => {
    const fileData = githubFile.value ? JSON.parse(githubFile.value) : null;
    if (!fileData) {
        mediaUrl.value = '';
        gallery.querySelectorAll('img').forEach(img => img.classList.remove('selected'));
        return;
    }

    gallery.querySelectorAll('img').forEach(img => {
        const imgData = JSON.parse(img.dataset.fileData);
        if (imgData.path === fileData.path) {
            img.classList.add('selected');
        } else {
            img.classList.remove('selected');
        }
    });

    mediaUrl.value = fileData.download_url;
});

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
        status.innerText = result.message || 'Jadwal berhasil dihapus!';
        await loadSchedules();
    } catch (error) {
        status.innerText = `Error deleting schedule: ${error.message}`;
        console.error('Error deleting schedule:', error);
    }
}

async function editSchedule(index) {
    try {
        const res = await fetch('/api/get_schedules');
        if (!res.ok) {
            throw new Error(`HTTP error fetching schedules! status: ${res.status}`);
        }
        const data = await res.json();
        const schedules = data.schedules || [];
        const schedule = schedules[index];

        if (!schedule) {
            status.innerText = 'Jadwal tidak ditemukan.';
            return;
        }

        userAccount.value = schedule.accountNum || '';
        await new Promise(resolve => {
            const changeEvent = new Event('change');
            userAccount.dispatchEvent(changeEvent);
            setTimeout(resolve, 500);
        });

        accountId.value = schedule.accountId;
        selectedUsername = schedule.username;
        mediaUrl.value = schedule.mediaUrl;
        selectedToken = schedule.userToken;

        form.dataset.editIndex = index;
        status.innerText = 'Mengedit jadwal...';
    } catch (error) {
        status.innerText = `Error loading schedule for edit: ${error.message}`;
        console.error('Error loading schedule for edit:', error);
    }
}

async function loadSchedules() {
    try {
        scheduleTableBody.innerHTML = '<tr><td colspan="6">Memuat jadwal...</td></tr>';
        const res = await fetch('/api/get_schedules');
        if (!res.ok) {
            throw new Error(`HTTP error fetching schedules! status: ${res.status}`);
        }
        const data = await res.json();
        console.log('Schedules fetched:', data);

        scheduleTableBody.innerHTML = '';
        const schedules = data.schedules || [];

        const filteredSchedules = selectedAccountNum
            ? schedules.filter(schedule => schedule.accountNum === selectedAccountNum)
            : schedules;

        if (filteredSchedules.length > 0) {
            filteredSchedules.forEach((schedule, index) => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${schedule.username || schedule.accountId}</td>
                    <td><a href="${schedule.mediaUrl}" target="_blank">Lihat Media</a></td>
                    <td>${schedule.caption}</td>
                    <td>${new Date(schedule.time).toLocaleString()}</td>
                    <td>${schedule.completed ? 'Selesai' : 'Menunggu'}</td>
                    <td>
                        <button class="edit-btn" data-index="${index}" ${schedule.completed ? 'disabled' : ''}>Edit</button>
                        <button class="delete-btn" data-index="${index}">Hapus</button>
                    </td>
                `;
                scheduleTableBody.appendChild(row);
            });

            document.querySelectorAll('.edit-btn').forEach(button => {
                button.addEventListener('click', (e) => {
                    const index = parseInt(e.target.getAttribute('data-index'), 10);
                    editSchedule(index);
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
        } else {
            scheduleTableBody.innerHTML = '<tr><td colspan="6">Belum ada jadwal untuk akun ini.</td></tr>';
        }
    } catch (error) {
        status.innerText = `Error loading schedules: ${error.message}`;
        console.error('Error fetching schedules:', error);
        scheduleTableBody.innerHTML = '<tr><td colspan="6">Gagal memuat jadwal.</td></tr>';
    }
}

loadSchedules();
