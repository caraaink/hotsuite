#!/bin/bash
# Cek apakah ada perubahan di folder 'ig' dibandingkan commit sebelumnya
if git diff HEAD^ HEAD --name-only | grep -q '^ig/'; then
    echo "Perubahan terdeteksi di folder 'ig', build dibatalkan."
    exit 1
else
    echo "Tidak ada perubahan di folder 'ig', lanjutkan build."
    exit 0
fi