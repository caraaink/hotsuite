#!/bin/bash
# Periksa apakah ada perubahan di folder 'ig'
if git diff --name-only HEAD^ HEAD | grep -q "^ig/"; then
  echo "Perubahan terdeteksi di folder 'ig', build dibatalkan."
  exit 0 # 0 berarti build dilewati
else
  echo "Tidak ada perubahan di folder 'ig', lanjutkan build."
  exit 1 # 1 berarti build dilanjutkan
fi
