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

        // Panggil /api/scheduler untuk memeriksa status terbaru
        const schedulerRes = await fetch('/api/scheduler');
        if (schedulerRes.ok) {
            const schedulerData = await schedulerRes.json();
            if (schedulerData.details && schedulerData.details.message === 'Published successfully, moving to remove step') {
                const { username, scheduleId, scheduleTime } = schedulerData.details;
                showFloatingNotification(`Berhasil mempublish untuk ${username} (ID: ${scheduleId}) pada ${scheduleTime}`);
            } else if (schedulerData.details && schedulerData.details.message === 'Container created, waiting for next cron to publish') {
                const { username, scheduleId, scheduleTime } = schedulerData.details;
                showFloatingNotification(`Container dibuat untuk ${username} (ID: ${scheduleId}) pada ${scheduleTime}, menunggu publish berikutnya`);
            } else if (schedulerData.details && schedulerData.details.message === 'No schedules match the current time for processing') {
                const { username, scheduleId, scheduleTime } = schedulerData.details.nextSchedule;
                showFloatingNotification(`Tidak ada jadwal untuk diproses. Jadwal berikutnya untuk ${username} (ID: ${scheduleId}) pada ${scheduleTime}`);
            }
        }

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
