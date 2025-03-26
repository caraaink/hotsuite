document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('scheduleForm');
    const status = document.getElementById('floatingStatus');
    const spinner = document.getElementById('floatingSpinner');
    const floatingNotification = document.getElementById('floatingNotification');
    const themeToggle = document.getElementById('themeToggle');
    const themeMenu = document.getElementById('themeMenu');
    const toggleDarkMode = document.getElementById('toggleDarkMode');

    window.convertToWIB = function(utcTime) {
        const date = new Date(utcTime);
        const wibOffset = 7 * 60 * 60 * 1000;
        const wibTime = new Date(date.getTime() + wibOffset);
        return wibTime;
    };

    window.formatToDatetimeLocal = function(wibTime) {
        return wibTime.toISOString().slice(0, 16);
    };

    window.formatToLocaleString = function(wibTime) {
        return wibTime.toLocaleString('id-ID', {
            timeZone: 'Asia/Jakarta',
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
        }).replace(',', '');
    };

    window.debounce = function(func, wait) {
        let timeout;
        return function (...args) {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, args), wait);
        };
    };

    window.showConfirmModal = function(message) {
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
    };

    window.showFloatingNotification = function(message, isError = false, duration = 3000) {
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
    };

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
});