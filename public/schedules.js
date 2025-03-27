document.addEventListener('DOMContentLoaded', () => {
    const accountId = document.getElementById('accountId');
    const gallery = document.getElementById('gallery');
    const mediaUrl = document.getElementById('mediaUrl');
    const scheduleTableBody = document.getElementById('scheduleTableBody');
    const selectAll = document.getElementById('selectAll');
    const deleteSelected = document.getElementById('deleteSelected');
    const startDateTime = document.getElementById('startDateTime');
    const skipDay = document.getElementById('skipDay');
    const scheduleAll = document.getElementById('scheduleAll');
    const saveSchedules = document.getElementById('saveSchedules');
    const loadMoreBtn = document.getElementById('loadMore');
    const totalSchedules = document.getElementById('totalSchedules');
    let scheduledTimes = {};
    let allSchedules = [];
    let displayedSchedules = 0;
    const ITEMS_PER_PAGE = 20;
    let isLoadingSchedules = false;

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
            core.showFloatingNotification('Gagal mengambil data jadwal. Galeri tetap ditampilkan tanpa jadwal.', true);
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
                const confirmed = await core.showConfirmModal(`Apakah Anda yakin ingin menghapus ${file.name}?`);
                if (confirmed) {
                    await github.deletePhoto(file.path);
                }
            });
            container.appendChild(deleteDirectBtn);

            const name = document.createElement('p');
            name.textContent = file.name;

            const captionText = document.createElement('p');
            captionText.className = 'caption-text';
            captionText.textContent = github.captions[file.path] || 'Tidak ada caption';

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
                textarea.value = github.captions[file.path] || '';
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
                    github.captions[file.path] = textarea.value;

                    const folderPath = file.path.substring(0, file.path.lastIndexOf('/'));
                    const metaCommitMessage = folderPath.startsWith('ig/') 
                        ? `Update meta file for ${file.path} [vercel-skip]` 
                        : `Update meta file for ${file.path}`;

                    const success = await github.saveCaptionToGithub(file, github.captions[file.path], metaCommitMessage);
                    if (success) {
                        captionText.textContent = github.captions[file.path] || 'Tidak ada caption';
                        editor.remove();
                        core.showFloatingNotification(`Caption untuk ${file.name} berhasil disimpan.`);
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
                        core.showFloatingNotification('Pilih waktu terlebih dahulu.', true);
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
                    core.showFloatingNotification(`Waktu jadwal untuk ${file.name} disimpan sementara. Klik "Simpan Jadwal" untuk mengirimkan.`);
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
                    core.showFloatingNotification('File ini belum memiliki jadwal.', true);
                    return;
                }

                const confirmed = await core.showConfirmModal(`Apakah Anda yakin ingin menghapus jadwal untuk ${file.name}?`);
                if (confirmed) {
                    await deleteSchedule(scheduleId);
                    deleteScheduleBtn.disabled = true;
                    scheduleTime.textContent = 'Belum dijadwalkan';
                    scheduleTime.classList.add('unscheduled');
                    scheduleTime.classList.remove('scheduled');
                    core.showFloatingNotification(`Jadwal untuk ${file.name} berhasil dihapus.`);
                }
            });

            const publishBtn = document.createElement('button');
            publishBtn.className = 'btn publish';
            publishBtn.textContent = 'Publish';
            publishBtn.addEventListener('click', async () => {
                if (!accounts.selectedToken || !accountId.value) {
                    core.showFloatingNotification('Pilih akun dan username terlebih dahulu.', true);
                    return;
                }

                core.showFloatingNotification('Mempublikasikan...', false, 0);
                document.getElementById('floatingSpinner').classList.remove('hidden');
                let isUploadedFile = file.path.startsWith('ig/image/');

                try {
                    const response = await fetch('/api/publish', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            accountId: accountId.value,
                            mediaUrl: file.download_url,
                            caption: github.captions[file.path] || '',
                            userToken: accounts.selectedToken,
                        }),
                    });

                    if (!response.ok) {
                        throw new Error(`HTTP error publishing post! status: ${response.status}`);
                    }

                    const result = await response.json();
                    core.showFloatingNotification(result.message || 'Berhasil dipublikasikan ke Instagram!', false, 3000);

                    if (isUploadedFile) {
                        await github.deletePhoto(file.path);
                    }
                } catch (error) {
                    core.showFloatingNotification(`Error publishing: ${error.message}`, true);
                    console.error('Error publishing post:', error);
                } finally {
                    document.getElementById('floatingSpinner').classList.add('hidden');
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
                core.showFloatingNotification('Jadwal untuk semua foto telah direset.');
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
                core.showFloatingNotification('Pilih tanggal dan jam awal terlebih dahulu.', true);
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

            core.showFloatingNotification(`Waktu jadwal untuk semua foto disimpan sementara. Klik "Simpan Jadwal" untuk mengirimkan.`);
            window.history.pushState({}, document.title, window.location.pathname);
        });
    }

    async function deleteSchedule(scheduleId) {
        try {
            core.showFloatingNotification('Menghapus jadwal...');
            document.getElementById('floatingSpinner').classList.remove('hidden');
            const res = await fetch('/api/delete_schedule', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ scheduleId }),
            });
            if (!res.ok) {
                throw new Error(`HTTP error! status: ${res.status}`);
            }
            const result = await res.json();
            core.showFloatingNotification(result.message || 'Jadwal berhasil dihapus!');
            await loadSchedules();
        } catch (error) {
            core.showFloatingNotification(`Error deleting schedule: ${error.message}`, true);
            console.error('Error deleting schedule:', error);
        } finally {
            document.getElementById('floatingSpinner').classList.add('hidden');
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
            core.showFloatingNotification(result.message || 'Jadwal berhasil diperbarui!');
            await loadSchedules();
        } catch (error) {
            core.showFloatingNotification(`Error updating schedule: ${error.message}`, true);
            console.error('Error updating schedule:', error);
        }
    }

    async function deleteSelectedSchedules() {
        const checkboxes = document.querySelectorAll('.schedule-checkbox:checked');
        if (checkboxes.length === 0) {
            core.showFloatingNotification('Pilih setidaknya satu jadwal untuk dihapus.', true);
            return;
        }

        const scheduleIds = Array.from(checkboxes).map(checkbox => checkbox.dataset.scheduleId);

        try {
            core.showFloatingNotification('Menghapus jadwal terpilih...');
            document.getElementById('floatingSpinner').classList.remove('hidden');
            for (const scheduleId of scheduleIds) {
                await deleteSchedule(scheduleId);
            }
            core.showFloatingNotification(`${scheduleIds.length} jadwal berhasil dihapus!`);
        } catch (error) {
            core.showFloatingNotification(`Error deleting schedules: ${error.message}`, true);
            console.error('Error deleting schedules:', error);
        } finally {
            document.getElementById('floatingSpinner').classList.add('hidden');
        }
    }

    function renderSchedules(schedulesToRender, startIndex) {
        scheduleTableBody.innerHTML = '';
        schedulesToRender.forEach((schedule, idx) => {
            const globalIndex = startIndex + idx;
            const wibTime = core.convertToWIB(schedule.time);
            const formattedWibTime = core.formatToDatetimeLocal(wibTime);
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
            button.addEventListener('click', core.debounce(async (e) => {
                const scheduleId = e.target.getAttribute('data-schedule-id');
                const confirmed = await core.showConfirmModal('Apakah Anda yakin ingin menghapus jadwal ini?');
                if (confirmed) {
                    deleteSchedule(scheduleId);
                }
            }, 300));
        });
    }

    function updateScheduleVisibility(schedules) {
        const deleteContainer = document.getElementById('deleteContainer');
        const noScheduleMessage = document.getElementById('noScheduleMessage');
        const scheduleTableBody = document.getElementById('scheduleTableBody');

        if (!schedules || schedules.length === 0) {
            deleteContainer.style.display = 'none';
            noScheduleMessage.classList.remove('hidden');
            scheduleTableBody.innerHTML = '';
            totalSchedules.textContent = 'Total: 0 jadwal';
            loadMoreBtn.classList.add('hidden');
        } else {
            deleteContainer.style.display = 'flex';
            noScheduleMessage.classList.add('hidden');
            totalSchedules.textContent = `Total: ${schedules.length} jadwal`;
            renderSchedules(schedules.slice(0, ITEMS_PER_PAGE), 0);
            displayedSchedules = ITEMS_PER_PAGE;

            if (schedules.length > ITEMS_PER_PAGE) {
                loadMoreBtn.classList.remove('hidden');
            } else {
                loadMoreBtn.classList.add('hidden');
            }
        }
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
            if (accounts.selectedAccountNum) {
                filteredSchedules = filteredSchedules.filter(schedule => schedule.accountNum === accounts.selectedAccountNum);
            }
            if (accounts.selectedAccountId) {
                filteredSchedules = filteredSchedules.filter(schedule => schedule.accountId === accounts.selectedAccountId);
            }

            displayedSchedules = 0;
            updateScheduleVisibility(filteredSchedules);

            if (filteredSchedules.length > 0) {
                loadMoreBtn.removeEventListener('click', loadMoreSchedules);
                loadMoreBtn.addEventListener('click', loadMoreSchedules);

                selectAll.addEventListener('change', () => {
                    const checkboxes = document.querySelectorAll('.schedule-checkbox');
                    checkboxes.forEach(checkbox => {
                        checkbox.checked = selectAll.checked;
                    });
                });

                deleteSelected.addEventListener('click', async () => {
                    const confirmed = await core.showConfirmModal('Apakah Anda yakin ingin menghapus jadwal yang dipilih?');
                    if (confirmed) {
                        deleteSelectedSchedules();
                    }
                });
            }
        } catch (error) {
            core.showFloatingNotification(`Error loading schedules: ${error.message}`, true);
            console.error('Error fetching schedules:', error);
            scheduleTableBody.innerHTML = '<tr><td colspan="8">Gagal memuat jadwal.</td></tr>';
            totalSchedules.textContent = 'Total: 0 jadwal';
            loadMoreBtn.classList.add('hidden');
            updateScheduleVisibility([]);
        } finally {
            isLoadingSchedules = false;
        }
    }

    function loadMoreSchedules() {
        const filteredSchedules = allSchedules.filter(schedule => {
            if (accounts.selectedAccountNum && schedule.accountNum !== accounts.selectedAccountNum) return false;
            if (accounts.selectedAccountId && schedule.accountId !== accounts.selectedAccountId) return false;
            return true;
        });

        const nextSchedules = filteredSchedules.slice(displayedSchedules, displayedSchedules + ITEMS_PER_PAGE);
        renderSchedules(nextSchedules, displayedSchedules);
        displayedSchedules += nextSchedules.length;

        if (displayedSchedules >= filteredSchedules.length) {
            loadMoreBtn.classList.add('hidden');
        }
    }

    saveSchedules.addEventListener('click', async () => {
        if (!accounts.selectedToken || !accountId.value) {
            core.showFloatingNotification('Pilih akun dan username terlebih dahulu.', true);
            return;
        }

        const scheduledFiles = github.allMediaFiles.filter(file => {
            const scheduledTime = scheduledTimes[file.path];
            return scheduledTime && typeof scheduledTime === 'string' && scheduledTime.trim() !== '';
        });
        if (scheduledFiles.length === 0) {
            core.showFloatingNotification('Tidak ada foto yang dijadwalkan.', true);
            return;
        }

        core.showFloatingNotification('Menyimpan jadwal... 0/' + scheduledFiles.length, false, 0);
        document.getElementById('floatingSpinner').classList.remove('hidden');

        try {
            let completedCount = 0;
            for (const file of scheduledFiles) {
                const formData = {
                    accountId: accountId.value,
                    username: accounts.selectedUsername,
                    mediaUrl: file.download_url,
                    caption: github.captions[file.path] || '',
                    time: scheduledTimes[file.path],
                    userToken: accounts.selectedToken,
                    accountNum: document.getElementById('userAccount').value,
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
                core.showFloatingNotification(`Menyimpan jadwal... ${completedCount}/${scheduledFiles.length}`, false, 0);
                console.log('Schedule response:', result);
            }
            core.showFloatingNotification(`${scheduledFiles.length} foto berhasil dijadwalkan!`, false, 3000);
            scheduledTimes = {};
            await loadSchedules();
        } catch (error) {
            core.showFloatingNotification(`Error scheduling: ${error.message}`, true);
            console.error('Error scheduling posts:', error);
        } finally {
            document.getElementById('floatingSpinner').classList.add('hidden');
        }
    });

    loadSchedules();

    // Ekspor fungsi dan variabel untuk digunakan di file lain
    window.schedules = {
        scheduledTimes,
        displayGallery,
        loadSchedules
    };
});