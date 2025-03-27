#!/bin/bash
# Memeriksa apakah ada perubahan di folder 'ig' pada commit terakhir
if [ -n "$(git log -1 --name-only --pretty=format: | grep '^ig/')" ]; then
    echo "Perubahan terdeteksi di folder 'ig', build dibatalkan."
    exit 1  # Exit 1 untuk membatalkan build (gagal)
else
    echo "Tidak ada perubahan di folder 'ig', lanjutkan build."
    exit 0  # Exit 0 untuk melanjutkan build (sukses)
fi