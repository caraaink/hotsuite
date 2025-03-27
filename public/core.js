document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('scheduleForm');
    const status = document.getElementById('floatingStatus');
    const spinner = document.getElementById('floatingSpinner');
    const floatingNotification = document.getElementById('floatingNotification');
    const themeToggle = document.getElementById('themeToggle');
    const themeMenu = document.getElementById('themeMenu');
    const toggleDarkMode = document.getElementById('toggleDarkMode');

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

    // Ekspor fungsi untuk digunakan di file lain
    window.core = {
        convertToWIB,
        formatToDatetimeLocal,
        formatToLocaleString,
        debounce,
        showConfirmModal,
        showFloatingNotification
    };
});