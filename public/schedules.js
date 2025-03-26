let scheduledTimes = {};
let allSchedules = [];
const ITEMS_PER_PAGE = 20;
let currentPage = 1;

async function displayGallery(files) {
    const gallery = document.getElementById('gallery');
    gallery.innerHTML = '';

    const imageFiles = files.filter(file => file.name && (file.name.endsWith('.jpg') || file.name.endsWith('.png')));
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
        if (!schedulesResponse.ok) throw new Error(`Failed to fetch schedules: ${schedulesResponse.status}`);
        schedules = await schedulesResponse.json();
    } catch (error) {
        console.error('Error fetching schedules:', error);
        window.showFloatingNotification('Gagal mengambil data jadwal.', true);
        schedules = { schedules: [] };
    }

    const withSchedule = [];
    const withoutSchedule = [];
    imageFiles.forEach(file => {
        scheduledTimes[file.path] ? withSchedule.push(file) : withoutSchedule.push(file);
    });
    const sortedImageFiles = [...withSchedule, ...withoutSchedule];

    function formatDateTime(date, hours, minutes) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}T${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
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
            document.getElementById('mediaUrl').value = file.download_url;
        });

        const deleteDirectBtn = document.createElement('button');
        deleteDirectBtn.className = 'delete-direct-btn';
        deleteDirectBtn.textContent = '×';
        deleteDirectBtn.addEventListener('click', async () => {
            const confirmed = await window.showConfirmModal(`Apakah Anda yakin ingin menghapus ${file.name}?`);
            if (confirmed) await window.deletePhoto(file.path);
        });
        container.appendChild(deleteDirectBtn);

        const name = document.createElement('p');
        name.textContent = file.name;

        const captionText = document.createElement('p');
        captionText.className = 'caption-text';
        captionText.textContent = window.captions[file.path] || 'Tidak ada caption';

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
            if (isDragging) e.preventDefault();
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
            textarea.value = window.captions[file.path] || '';
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
                window.captions[file.path] = textarea.value;

                const folderPath = file.path.substring(0, file.path.lastIndexOf('/'));
                const metaCommitMessage = folderPath.startsWith('ig/') 
                    ? `Update meta file for ${file.path} [vercel-skip]` 
                    : `Update meta file for ${file.path}`;

                const success = await window.saveCaptionToGithub(file, window.captions[file.path], metaCommitMessage);
                if (success) {
                    captionText.textContent = window.captions[file.path] || 'Tidak ada caption';
                    editor.remove();
                    window.showFloatingNotification(`Caption untuk ${file.name} berhasil disimpan.`);
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

            const buttonContainer = document.createElement('div');
            buttonContainer.className = 'editor-buttons';

            const saveBtn = document.createElement('button');
            saveBtn.className = 'btn-save';
            saveBtn.textContent = 'Simpan';
            saveBtn.addEventListener('click', () => {
                if (!datetimeInput.value) {
                    window.showFloatingNotification('Pilih waktu terlebih dahulu.', true);
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
                window.showFloatingNotification(`Waktu jadwal untuk ${file.name} disimpan sementara. Klik "Simpan Jadwal" untuk mengirimkan.`);
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
                window.showFloatingNotification('File ini belum memiliki jadwal.', true);
                return;
            }
            const confirmed = await window.showConfirmModal(`Apakah Anda yakin ingin menghapus jadwal untuk ${file.name}?`);
            if (confirmed) {
                await deleteSchedule(scheduleId);
                deleteScheduleBtn.disabled = true;
                scheduleTime.textContent = 'Belum dijadwalkan';
                scheduleTime.classList.add('unscheduled');
                scheduleTime.classList.remove('scheduled');
                window.showFloatingNotification(`Jadwal untuk ${file.name} berhasil dihapus.`);
            }
        });

        const publishBtn = document.createElement('button');
        publishBtn.className = 'btn publish';
        publishBtn.textContent = 'Publish';
        publishBtn.addEventListener('click', async () => {
            if (!window.selectedToken || !window.selectedAccountId) {
                window.showFloatingNotification('Pilih akun dan username terlebih dahulu.', true);
                return;
            }

            window.showFloatingNotification('Mempublikasikan...', false, 0);
            const spinner = document.getElementById('floatingSpinner');
            spinner.classList.remove('hidden');
            let isUploadedFile = file.path.startsWith('ig/image/');

            try {
                const response = await fetch('/api/publish', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        accountId: window.selectedAccountId,
                        mediaUrl: file.download_url,
                        caption: window.captions[file.path] || '',
                        userToken: window.selectedToken,
                    }),
                });

                if (!response.ok) {
                    throw new Error(`HTTP error publishing post! status: ${response.status}`);
                }

                const result = await response.json();
                window.showFloatingNotification(result.message || 'Berhasil dipublikasikan ke Instagram!', false, 3000);

                if (isUploadedFile) await window.deletePhoto(file.path);
            } catch (error) {
                window.showFloatingNotification(`Error publishing: ${error.message}`, true);
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

    const startDateTime = document.getElementById('startDateTime');
    const skipDay = document.getElementById('skipDay');
    const scheduleAll = document.getElementById('scheduleAll');

    startDateTime.addEventListener('input', () => {
        if (!startDateTime.value) {
            Object.keys(scheduledTimes).forEach(filePath => delete scheduledTimes[filePath]);
            Array.from(gallery.children).forEach(container => {
                const scheduleTimeElement = container.querySelector('.schedule-time');
                if (scheduleTimeElement) {
                    scheduleTimeElement.textContent = 'Belum dijadwalkan';
                    scheduleTimeElement.classList.add('unscheduled');
                    scheduleTimeElement.classList.remove('scheduled');
                }
            });
            window.showFloatingNotification('Jadwal untuk semua foto telah direset.');
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
            window.showFloatingNotification('Pilih tanggal dan jam awal terlebih dahulu.', true);
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

        window.showFloatingNotification(`Waktu jadwal untuk semua foto disimpan sementara. Klik "Simpan Jadwal" untuk mengirimkan.`);
        window.history.pushState({}, document.title, window.location.pathname);
    });
}

function renderSchedules(schedulesToRender, startIndex) {
    const scheduleTableBody = document.getElementById('scheduleTableBody');
    scheduleTableBody.innerHTML = '';
    schedulesToRender.forEach((schedule, idx) => {
        const globalIndex = startIndex + idx;
        const wibTime = window.convertToWIB(schedule.time);
        const formattedWibTime = window.formatToDatetimeLocal(wibTime);
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

    document.querySelectorAll('.editable-caption').forEach(cell => {
        cell.addEventListener('blur', async (e) => {
            const scheduleId = e.target.dataset.scheduleId;
            const newCaption = e.target.textContent.trim();
            await updateSchedule(scheduleId, { caption: newCaption });
        });
    });

    document.querySelectorAll('.editable-time .time-input').forEach(input => {
        input.addEventListener('change', async (e) => {
            const scheduleId = e.target.parentElement.dataset.scheduleId;
            const newTime = e.target.value;
            await updateSchedule(scheduleId, { time: newTime });
        });
    });

    document.querySelectorAll('.delete-btn').forEach(button => {
        button.addEventListener('click', window.debounce(async (e) => {
            const scheduleId = e.target.getAttribute('data-schedule-id');
            const confirmed = await window.showConfirmModal('Apakah Anda yakin ingin menghapus jadwal ini?');
            if (confirmed) deleteSchedule(scheduleId);
        }, 300));
    });
}

function updatePagination(filteredSchedules) {
    const totalPages = Math.ceil(filteredSchedules.length / ITEMS_PER_PAGE);
    const paginationContainer = document.getElementById('pagination');
    paginationContainer.innerHTML = '';

    const prevBtn = document.createElement('button');
    prevBtn.textContent = 'Prev';
    prevBtn.disabled = currentPage === 1;
    prevBtn.addEventListener('click', () => {
        if (currentPage > 1) {
            currentPage--;
            renderPage(filteredSchedules);
        }
    });
    paginationContainer.appendChild(prevBtn);

    for (let i = 1; i <= totalPages; i++) {
        const pageBtn = document.createElement('button');
        pageBtn.textContent = i;
        pageBtn.className = currentPage === i ? 'active' : '';
        pageBtn.addEventListener('click', () => {
            currentPage = i;
            renderPage(filteredSchedules);
        });
        paginationContainer.appendChild(pageBtn);
    }

    const nextBtn = document.createElement('button');
    nextBtn.textContent = 'Next';
    nextBtn.disabled = currentPage === totalPages || totalPages === 0;
    nextBtn.addEventListener('click', () => {
        if (currentPage < totalPages) {
            currentPage++;
            renderPage(filteredSchedules);
        }
    });
    paginationContainer.appendChild(nextBtn);
}

function renderPage(filteredSchedules) {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    const schedulesToRender = filteredSchedules.slice(startIndex, endIndex);
    renderSchedules(schedulesToRender, startIndex);
    updatePagination(filteredSchedules);
}

async function loadSchedules() {
    const scheduleTableBody = document.getElementById('scheduleTableBody');
    const spinner = document.getElementById('floatingSpinner');
    try {
        scheduleTableBody.innerHTML = '<tr><td colspan="8">Memuat jadwal...</td></tr>';
        const res = await fetch('/api/get_schedules');
        if (!res.ok) throw new Error(`HTTP error fetching schedules! status: ${res.status}`);
        const data = await res.json();

        allSchedules = data.schedules || [];
        allSchedules.sort((a, b) => new Date(a.time) - new Date(b.time));

        let filteredSchedules = allSchedules;
        if (window.selectedAccountNum) {
            filteredSchedules = filteredSchedules.filter(schedule => schedule.accountNum === window.selectedAccountNum);
        }
        if (window.selectedAccountId) {
            filteredSchedules = filteredSchedules.filter(schedule => schedule.accountId === window.selectedAccountId);
        }

        const deleteContainer = document.getElementById('deleteContainer');
        const noScheduleMessage = document.getElementById('noScheduleMessage');
        const totalSchedules = document.getElementById('totalSchedules');

        if (filteredSchedules.length === 0) {
            deleteContainer.style.display = 'none';
            noScheduleMessage.classList.remove('hidden');
            scheduleTableBody.innerHTML = '';
            totalSchedules.textContent = 'Total: 0 jadwal';
            document.getElementById('pagination').innerHTML = '';
        } else {
            deleteContainer.style.display = 'flex';
            noScheduleMessage.classList.add('hidden');
            totalSchedules.textContent = `Total: ${filteredSchedules.length} jadwal`;
            currentPage = 1;
            renderPage(filteredSchedules);

            document.getElementById('selectAll').addEventListener('change', () => {
                document.querySelectorAll('.schedule-checkbox').forEach(checkbox => {
                    checkbox.checked = document.getElementById('selectAll').checked;
                });
            });

            document.getElementById('deleteSelected').addEventListener('click', async () => {
                const confirmed = await window.showConfirmModal('Apakah Anda yakin ingin menghapus jadwal yang dipilih?');
                if (confirmed) deleteSelectedSchedules();
            });
        }
    } catch (error) {
        window.showFloatingNotification(`Error loading schedules: ${error.message}`, true);
        console.error('Error fetching schedules:', error);
        scheduleTableBody.innerHTML = '<tr><td colspan="8">Gagal memuat jadwal.</td></tr>';
        document.getElementById('totalSchedules').textContent = 'Total: 0 jadwal';
        document.getElementById('pagination').innerHTML = '';
    }
}

async function deleteSchedule(scheduleId) {
    const spinner = document.getElementById('floatingSpinner');
    try {
        window.showFloatingNotification('Menghapus jadwal...');
        spinner.classList.remove('hidden');
        const res = await fetch('/api/delete_schedule', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ scheduleId }),
        });
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
        const result = await res.json();
        window.showFloatingNotification(result.message || 'Jadwal berhasil dihapus!');
        await loadSchedules();
    } catch (error) {
        window.showFloatingNotification(`Error deleting schedule: ${error.message}`, true);
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
        if (!res.ok) throw new Error(`HTTP error updating schedule! status: ${res.status}`);
        const result = await res.json();
        window.showFloatingNotification(result.message || 'Jadwal berhasil diperbarui!');
        await loadSchedules();
    } catch (error) {
        window.showFloatingNotification(`Error updating schedule: ${error.message}`, true);
        console.error('Error updating schedule:', error);
    }
}

async function deleteSelectedSchedules() {
    const checkboxes = document.querySelectorAll('.schedule-checkbox:checked');
    if (checkboxes.length === 0) {
        window.showFloatingNotification('Pilih setidaknya satu jadwal untuk dihapus.', true);
        return;
    }

    const scheduleIds = Array.from(checkboxes).map(checkbox => checkbox.dataset.scheduleId);
    const spinner = document.getElementById('floatingSpinner');

    try {
        window.showFloatingNotification('Menghapus jadwal terpilih...');
        spinner.classList.remove('hidden');
        for (const scheduleId of scheduleIds) {
            await deleteSchedule(scheduleId);
        }
        window.showFloatingNotification(`${scheduleIds.length} jadwal berhasil dihapus!`);
    } catch (error) {
        window.showFloatingNotification(`Error deleting schedules: ${error.message}`, true);
        console.error('Error deleting schedules:', error);
    } finally {
        spinner.classList.add('hidden');
    }
}

document.getElementById('saveSchedules').addEventListener('click', async () => {
    if (!window.selectedToken || !window.selectedAccountId) {
        window.showFloatingNotification('Pilih akun dan username terlebih dahulu.', true);
        return;
    }

    const scheduledFiles = window.allMediaFiles.filter(file => scheduledTimes[file.path] && scheduledTimes[file.path].trim() !== '');
    if (scheduledFiles.length === 0) {
        window.showFloatingNotification('Tidak ada foto yang dijadwalkan.', true);
        return;
    }

    window.showFloatingNotification('Menyimpan jadwal... 0/' + scheduledFiles.length, false, 0);
    const spinner = document.getElementById('floatingSpinner');
    spinner.classList.remove('hidden');

    try {
        let completedCount = 0;
        for (const file of scheduledFiles) {
            const formData = {
                accountId: window.selectedAccountId,
                username: window.selectedUsername,
                mediaUrl: file.download_url,
                caption: window.captions[file.path] || '',
                time: scheduledTimes[file.path],
                userToken: window.selectedToken,
                accountNum: document.getElementById('userAccount').value,
                completed: false,
            };

            const response = await fetch('/api/schedule', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData),
            });

            const result = await response.json();
            if (!response.ok) throw new Error(`HTTP error scheduling post! status: ${response.status}, details: ${result.error}`);

            completedCount++;
            window.showFloatingNotification(`Menyimpan jadwal... ${completedCount}/${scheduledFiles.length}`, false, 0);
        }
        window.showFloatingNotification(`${scheduledFiles.length} foto berhasil dijadwalkan!`, false, 3000);
        scheduledTimes = {};
        await loadSchedules();
    } catch (error) {
        window.showFloatingNotification(`Error scheduling: ${error.message}`, true);
        console.error('Error scheduling posts:', error);
    } finally {
        spinner.classList.add('hidden');
    }
});

loadSchedules();

window.loadSchedules = loadSchedules;
window.displayGallery = displayGallery;