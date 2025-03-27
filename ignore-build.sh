#!/bin/bash
# Memeriksa apakah ada perubahan di folder 'ig' dibandingkan dengan commit sebelumnya
if [ -n "$(git log -1 --name-only --pretty=format: | grep '^ig/')" ]; then
    echo "Perubahan terdeteksi di folder 'ig', build dibatarkan."
    exit 0  # Exit 0 untuk melewati build
else
    echo "Tidak ada perubahan di folder 'ig', lanjutkan build."
    exit 1  # Exit 1 untuk melanjutkan build
fi
