#!/bin/bash
# Periksa apakah ada perubahan di folder 'ig'
if git diff --name-only HEAD^ HEAD | grep -q "^ig/"; then
  echo "Perubahan terdeteksi di folder 'ig', build dibatalkan."
  exit 1 # Batalkan build dengan error
else
  echo "Tidak ada perubahan di folder 'ig', lanjutkan build."
  exit 0 # Lanjutkan build dengan sukses
fi
