let allSubfolders = [];
let allMediaFiles = [];
let captions = {};

async function loadGithubFolders() {
    window.showFloatingNotification('Memuat daftar folder...');
    const spinner = document.getElementById('floatingSpinner');
    spinner.classList.remove('hidden');
    try {
        const res = await fetch('/api/get_github_files?path=ig');
        if (!res.ok) {
            throw new Error(`HTTP error! status: ${res.status}`);
        }
        const data = await res.json();

        const folders = data.files.filter(item => item.type === 'dir');
        folders.sort(naturalSort);

        const githubFolder = document.getElementById('githubFolder');
        githubFolder.innerHTML = '<option value="ig">-- Pilih Folder --</option>';
        folders.forEach(item => {
            const option = document.createElement('option');
            option.value = item.path;
            option.textContent = item.name;
            githubFolder.appendChild(option);
        });

        if (githubFolder.options.length === 1) {
            window.showFloatingNotification('No subfolders found in ig directory.', true);
        } else {
            window.showFloatingNotification('');
        }
    } catch (error) {
        window.showFloatingNotification(`Error loading GitHub folders: ${error.message}`, true);
        console.error('Error fetching GitHub folders:', error);
    } finally {
        spinner.classList.add('hidden');
    }
}

function naturalSort(a, b) {
    const aKey = a.name || a.path || a;
    const bKey = b.name || b.path || b;
    return aKey.localeCompare(bKey, undefined, { numeric: true, sensitivity: 'base' });
}

async function fetchSubfolders(path) {
    window.showFloatingNotification('Memuat daftar subfolder...');
    const spinner = document.getElementById('floatingSpinner');
    spinner.classList.remove('hidden');
    try {
        const res = await fetch(`/api/get_github_files?path=${path}`);
        if (!res.ok) {
            throw new Error(`HTTP error! status: ${res.status}`);
        }
        const data = await res.json();

        allSubfolders = [];
        data.files.forEach(item => {
            if (item.type === 'dir') {
                allSubfolders.push({
                    name: item.name,
                    path: item.path,
                });
            }
        });

        allSubfolders.sort(naturalSort);
        return allSubfolders;
    } catch (error) {
        console.error(`Error fetching subfolders for path ${path}:`, error);
        window.showFloatingNotification(`Error loading subfolders: ${error.message}`, true);
        return [];
    } finally {
        spinner.classList.add('hidden');
    }
}

async function fetchFilesInSubfolder(path) {
    window.showFloatingNotification('Memuat daftar file...');
    const spinner = document.getElementById('floatingSpinner');
    spinner.classList.remove('hidden');
    try {
        const res = await fetch(`/api/get_github_files?path=${path}`);
        if (!res.ok) {
            throw new Error(`HTTP error! status: ${res.status}`);
        }
        const data = await res.json();

        allMediaFiles = [];
        const mediaFiles = data.files.filter(item => 
            item.type === 'file' && 
            (item.name.endsWith('.jpg') || item.name.endsWith('.png') || item.name.endsWith('.mp4'))
        );
        const totalFiles = mediaFiles.length;

        if (totalFiles === 0) {
            window.showFloatingNotification('Tidak ada file media yang didukung di folder ini.', true);
            spinner.classList.add('hidden');
            return allMediaFiles;
        }

        let loadedCount = 0;
        for (const item of mediaFiles) {
            loadedCount++;
            window.showFloatingNotification(`Memuat file ${loadedCount} dari ${totalFiles}...`, false, 0);
            allMediaFiles.push({
                name: item.name,
                path: item.path,
                download_url: item.download_url,
            });
            await new Promise(resolve => setTimeout(resolve, 500));
        }

        allMediaFiles.sort(naturalSort);

        const metaPaths = allMediaFiles.map(file => {
            const folderPath = file.path.substring(0, file.path.lastIndexOf('/'));
            const metaFileName = `${file.name}.meta.json`;
            return `${folderPath}/${metaFileName}`;
        });

        window.showFloatingNotification(`Memuat metadata untuk ${totalFiles} file...`, false, 0);
        let metaLoadedCount = 0;

        try {
            const metaRes = await fetch(`/api/get_file_content?${metaPaths.map(path => `paths=${encodeURIComponent(path)}`).join('&')}`);
            if (!metaRes.ok) {
                throw new Error(`HTTP error fetching metadata! status: ${metaRes.status}`);
            }
            const metaData = await metaRes.json();

            allMediaFiles.forEach(file => {
                const folderPath = file.path.substring(0, file.path.lastIndexOf('/'));
                const metaPath = `${folderPath}/${file.name}.meta.json`;
                if (metaData && metaData[metaPath] && typeof metaData[metaPath].caption === 'string') {
                    captions[file.path] = metaData[metaPath].caption;
                } else {
                    captions[file.path] = '';
                }
                metaLoadedCount++;
                window.showFloatingNotification(`Memuat metadata ${metaLoadedCount}/${totalFiles}...`, false, 0);
            });

            window.showFloatingNotification(`Berhasil memuat metadata untuk ${metaLoadedCount}/${totalFiles} file.`, false, 3000);
        } catch (error) {
            console.error('Error fetching metadata:', error);
            allMediaFiles.forEach(file => {
                captions[file.path] = '';
                metaLoadedCount++;
                window.showFloatingNotification(`Memuat metadata ${metaLoadedCount}/${totalFiles}...`, false, 0);
            });
            window.showFloatingNotification('Gagal memuat metadata. Menggunakan caption kosong.', true);
        }

        window.showFloatingNotification(`Berhasil memuat ${totalFiles} file.`, false, 3000);
        return allMediaFiles;
    } catch (error) {
        console.error(`Error fetching files for path ${path}:`, error);
        window.showFloatingNotification(`Error loading files: ${error.message}`, true);
        return [];
    } finally {
        setTimeout(() => {
            spinner.classList.add('hidden');
        }, 3000);
    }
}

document.getElementById('githubFolder').addEventListener('change', async () => {
    const folderPath = document.getElementById('githubFolder').value;
    allMediaFiles = [];
    captions = {};
    document.getElementById('gallery').innerHTML = '';
    document.getElementById('mediaUrl').value = '';

    const subfolderContainer = document.getElementById('subfolderContainer');
    const subfolderLabel = document.querySelector('label[for="githubSubfolder"]');
    const scheduleAllContainer = document.querySelector('.schedule-all-container');
    scheduleAllContainer.style.display = 'none';

    if (!folderPath || folderPath === 'ig') {
        subfolderContainer.classList.add('hidden');
        subfolderLabel.style.display = 'none';
        document.getElementById('githubSubfolder').innerHTML = '<option value="">-- Pilih Subfolder --</option>';
        return;
    }

    try {
        if (folderPath === 'ig/image') {
            subfolderContainer.classList.add('hidden');
            subfolderLabel.style.display = 'none';
            const files = await fetchFilesInSubfolder(folderPath);
            allMediaFiles = files;
            window.displayGallery(files);
        } else {
            subfolderContainer.classList.remove('hidden');
            subfolderLabel.style.display = 'block';
            subfolderLabel.textContent = 'Subfolder';
            const subfolders = await fetchSubfolders(folderPath);

            if (subfolders.length === 0) {
                const files = await fetchFilesInSubfolder(folderPath);
                allMediaFiles = files;
                document.getElementById('githubSubfolder').innerHTML = '<option value="">-- Tidak Ada Subfolder --</option>';
                window.displayGallery(files);
            } else {
                document.getElementById('githubSubfolder').innerHTML = '<option value="">-- Pilih Subfolder --</option>';
                subfolders.forEach(subfolder => {
                    const option = document.createElement('option');
                    option.value = subfolder.path;
                    option.textContent = subfolder.name;
                    document.getElementById('githubSubfolder').appendChild(option);
                });
            }
        }
    } catch (error) {
        window.showFloatingNotification(`Error loading subfolders: ${error.message}`, true);
        console.error('Error fetching subfolders:', error);
        subfolderContainer.classList.add('hidden');
        subfolderLabel.style.display = 'none';
    }
});

document.getElementById('githubSubfolder').addEventListener('change', async () => {
    const subfolderPath = document.getElementById('githubSubfolder').value;
    allMediaFiles = [];
    captions = {};
    document.getElementById('gallery').innerHTML = '';
    document.getElementById('mediaUrl').value = '';

    const scheduleAllContainer = document.querySelector('.schedule-all-container');
    scheduleAllContainer.style.display = 'none';

    if (!subfolderPath) return;

    try {
        const files = await fetchFilesInSubfolder(subfolderPath);
        allMediaFiles = files;
        window.displayGallery(files);
    } catch (error) {
        window.showFloatingNotification(`Error loading files: ${error.message}`, true);
        console.error('Error fetching files:', error);
    }
});

async function loadUploadFolders() {
    try {
        const res = await fetch('/api/get_github_files?path=ig');
        if (!res.ok) {
            throw new Error(`HTTP error! status: ${res.status}`);
        }
        const data = await res.json();
        const folders = data.files.filter(item => item.type === 'dir');
        folders.sort(naturalSort);

        const uploadFolderSelect = document.getElementById('uploadFolderSelect');
        uploadFolderSelect.innerHTML = '<option value="">-- Pilih Folder --</option>';
        
        const defaultOption = document.createElement('option');
        defaultOption.value = 'ig/image';
        defaultOption.textContent = 'ig/image';
        uploadFolderSelect.appendChild(defaultOption);

        folders.forEach(item => {
            if (item.path !== 'ig/image') {
                const option = document.createElement('option');
                option.value = item.path;
                option.textContent = item.name;
                uploadFolderSelect.appendChild(option);
            }
        });

        const customOption = document.createElement('option');
        customOption.value = 'custom';
        customOption.textContent = 'Tambah Folder Baru';
        uploadFolderSelect.appendChild(customOption);
    } catch (error) {
        console.error('Error loading upload folders:', error);
        window.showFloatingNotification(`Error loading upload folders: ${error.message}`, true);
    }
}

document.getElementById('uploadFolderSelect').addEventListener('change', async () => {
    const folderPath = document.getElementById('uploadFolderSelect').value;

    const uploadSubfolderSelect = document.getElementById('uploadSubfolderSelect');
    const uploadFolderInput = document.getElementById('uploadFolderInput');
    uploadSubfolderSelect.style.display = 'none';
    uploadSubfolderSelect.innerHTML = '<option value="">-- Pilih Subfolder --</option>';
    uploadFolderInput.style.display = 'none';
    uploadFolderInput.value = '';

    if (folderPath === 'custom') {
        uploadFolderInput.style.display = 'block';
        uploadFolderInput.focus();
    } else if (folderPath) {
        try {
            const subfolders = await fetchSubfolders(folderPath);
            if (subfolders.length > 0) {
                uploadSubfolderSelect.style.display = 'block';
                subfolders.forEach(subfolder => {
                    const option = document.createElement('option');
                    option.value = subfolder.path;
                    option.textContent = subfolder.name;
                    uploadSubfolderSelect.appendChild(option);
                });
            } else {
                uploadFolderInput.style.display = 'block';
                uploadFolderInput.placeholder = 'Masukkan subfolder (opsional)';
            }
        } catch (error) {
            window.showFloatingNotification(`Error loading subfolders: ${error.message}`, true);
            console.error('Error fetching subfolders:', error);
        }
    }
});

document.getElementById('uploadSubfolderSelect').addEventListener('change', () => {
    const uploadSubfolderSelect = document.getElementById('uploadSubfolderSelect');
    const uploadFolderInput = document.getElementById('uploadFolderInput');
    if (uploadSubfolderSelect.value) {
        uploadFolderInput.style.display = 'none';
        uploadFolderInput.value = '';
    } else {
        uploadFolderInput.style.display = 'block';
        uploadFolderInput.placeholder = 'Masukkan subfolder (opsional)';
    }
});

document.getElementById('uploadToGithub').addEventListener('click', async () => {
    const uploadFile = document.getElementById('uploadFile');
    if (!uploadFile.files || uploadFile.files.length === 0) {
        window.showFloatingNotification('Pilih file terlebih dahulu.', true);
        return;
    }

    let uploadFolderValue;
    const uploadFolderSelect = document.getElementById('uploadFolderSelect');
    const uploadSubfolderSelect = document.getElementById('uploadSubfolderSelect');
    const uploadFolderInput = document.getElementById('uploadFolderInput');

    if (uploadFolderSelect.value === 'custom') {
        uploadFolderValue = uploadFolderInput.value.trim();
        if (!uploadFolderValue) {
            window.showFloatingNotification('Masukkan path folder tujuan.', true);
            return;
        }
    } else if (uploadFolderSelect.value) {
        uploadFolderValue = uploadFolderSelect.value;
        if (uploadSubfolderSelect.value) {
            uploadFolderValue = uploadSubfolderSelect.value;
        } else if (uploadFolderInput.value.trim()) {
            uploadFolderValue = `${uploadFolderValue}/${uploadFolderInput.value.trim()}`;
        }
    }

    if (!uploadFolderValue) {
        uploadFolderValue = 'ig/image';
    } else {
        if (!uploadFolderValue.startsWith('ig/')) {
            uploadFolderValue = `ig/${uploadFolderValue}`;
        }

        const invalidChars = /[<>:"|?*]/;
        if (invalidChars.test(uploadFolderValue)) {
            window.showFloatingNotification('Path folder tujuan mengandung karakter yang tidak diizinkan.', true);
            return;
        }
    }

    const files = Array.from(uploadFile.files);
    const mediaFiles = files.filter(file => {
        const fileName = file.name.toLowerCase();
        return fileName.endsWith('.jpg') || 
               fileName.endsWith('.jpeg') || 
               fileName.endsWith('.png') || 
               fileName.endsWith('.mp4');
    });

    const metaFiles = files.filter(file => file.name.toLowerCase().endsWith('.json'));

    if (mediaFiles.length === 0) {
        window.showFloatingNotification('Pilih setidaknya satu file media (JPG, JPEG, PNG, atau MP4).', true);
        return;
    }

    const metaFileMap = {};
    metaFiles.forEach(metaFile => {
        const baseName = metaFile.name.replace(/\.meta\.json$/i, '');
        metaFileMap[baseName] = metaFile;
    });

    let uploadedCount = 0;
    const totalFiles = mediaFiles.length;
    window.showFloatingNotification(`Mengunggah file 1 dari ${totalFiles}...`);
    const spinner = document.getElementById('floatingSpinner');
    spinner.classList.remove('hidden');

    try {
        for (const file of mediaFiles) {
            const reader = new FileReader();
            const result = await new Promise((resolve, reject) => {
                reader.readAsDataURL(file);
                reader.onload = async () => {
                    try {
                        const base64Content = reader.result.split(',')[1];
                        let newFileName = uploadFolderValue === 'ig/image' 
                            ? `${Math.floor(10000 + Math.random() * 90000)}.${file.name.split('.').pop()}`
                            : file.name;

                        const filePath = `${uploadFolderValue}/${newFileName}`;
                        const commitMessage = uploadFolderValue.startsWith('ig/') 
                            ? `Upload ${newFileName} to ${uploadFolderValue} [vercel-skip]` 
                            : `Upload ${newFileName} to ${uploadFolderValue}`;

                        const fileResponse = await fetch('/api/upload_to_github', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                fileName: filePath,
                                content: base64Content,
                                message: commitMessage,
                            }),
                        });

                        if (!fileResponse.ok) {
                            const errorData = await fileResponse.json();
                            throw new Error(`HTTP error uploading file ${newFileName}! status: ${fileResponse.status}, details: ${errorData.error}`);
                        }

                        const fileResult = await fileResponse.json();
                        const newFile = {
                            name: newFileName,
                            path: filePath,
                            download_url: fileResult.download_url,
                        };

                        let metaContent = { caption: '' };
                        if (metaFileMap[file.name]) {
                            const metaFile = metaFileMap[file.name];
                            const metaReader = new FileReader();
                            await new Promise((metaResolve, metaReject) => {
                                metaReader.readAsText(metaFile);
                                metaReader.onload = () => {
                                    try {
                                        const content = JSON.parse(metaReader.result);
                                        if (content.caption) metaContent = { caption: content.caption };
                                        metaResolve();
                                    } catch (error) {
                                        metaReject(error);
                                    }
                                };
                                metaReader.onerror = () => metaReject(new Error(`Error reading meta file ${metaFile.name}`));
                            });
                        }

                        const metaFileName = `${uploadFolderValue}/${newFileName}.meta.json`;
                        const metaContentString = JSON.stringify(metaContent, null, 2);
                        const metaBase64Content = btoa(unescape(encodeURIComponent(metaContentString)));
                        const metaCommitMessage = uploadFolderValue.startsWith('ig/') 
                            ? `Upload meta for ${newFileName} to ${uploadFolderValue} [vercel-skip]` 
                            : `Upload meta for ${newFileName} to ${uploadFolderValue}`;

                        const metaResponse = await fetch('/api/upload_to_github', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                fileName: metaFileName,
                                content: metaBase64Content,
                                message: metaCommitMessage,
                            }),
                        });

                        if (!metaResponse.ok) {
                            const metaResponseData = await metaResponse.json();
                            console.error(`Meta upload failed: ${metaResponseData.error}`);
                        }

                        allMediaFiles.push(newFile);
                        captions[newFile.path] = metaContent.caption || '';
                        uploadedCount++;
                        if (uploadedCount < totalFiles) {
                            window.showFloatingNotification(`Mengunggah file ${uploadedCount + 1} dari ${totalFiles}...`);
                        }

                        resolve(newFile);
                    } catch (error) {
                        reject(error);
                    }
                };
                reader.onerror = () => reject(new Error(`Error reading file ${file.name}`));
            });
        }

        window.showFloatingNotification(`${mediaFiles.length} file media berhasil diunggah ke GitHub!`);
        window.displayGallery(allMediaFiles);

        await loadUploadFolders();
        await loadGithubFolders();
    } catch (error) {
        window.showFloatingNotification(`Error uploading to GitHub: ${error.message}`, true);
        console.error('Error uploading to GitHub:', error);
    } finally {
        spinner.classList.add('hidden');
    }
});

async function deletePhoto(filePath) {
    window.showFloatingNotification(`Menghapus ${filePath}...`);
    const spinner = document.getElementById('floatingSpinner');
    spinner.classList.remove('hidden');

    try {
        const folderPath = filePath.substring(0, filePath.lastIndexOf('/'));
        const commitMessage = folderPath.startsWith('ig/') 
            ? `Delete file ${filePath} [vercel-skip]` 
            : `Delete file ${filePath}`;

        const deleteResponse = await fetch('/api/delete_from_github', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                path: filePath,
                message: commitMessage,
            }),
        });

        if (!deleteResponse.ok) {
            throw new Error(`HTTP error deleting file from GitHub! status: ${deleteResponse.status}`);
        }

        const deleteResult = await deleteResponse.json();
        window.showFloatingNotification(`${deleteResult.message}`);

        allMediaFiles = allMediaFiles.filter(f => f.path !== filePath);
        delete captions[filePath];
        window.displayGallery(allMediaFiles);
    } catch (error) {
        window.showFloatingNotification(`Gagal menghapus file dari GitHub: ${error.message}`, true);
        console.error('Error deleting file from GitHub:', error);
    } finally {
        spinner.classList.add('hidden');
    }
}

async function saveCaptionToGithub(file, caption, commitMessage) {
    try {
        const folderPath = file.path.substring(0, file.path.lastIndexOf('/'));
        const metaFileName = `${file.name}.meta.json`;
        const metaPath = `${folderPath}/${metaFileName}`;
        const metaContent = JSON.stringify({ caption }, null, 2);
        const base64Content = btoa(unescape(encodeURIComponent(metaContent)));

        const response = await fetch('/api/upload_to_github', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                fileName: metaPath,
                content: base64Content,
                message: commitMessage,
            }),
        });

        if (!response.ok) {
            throw new Error(`HTTP error uploading meta to GitHub! status: ${response.status}`);
        }

        return true;
    } catch (error) {
        window.showFloatingNotification(`Error saving meta file for ${file.name}: ${error.message}`, true);
        console.error(`Error saving meta file for ${file.name}:`, error);
        return false;
    }
}

loadGithubFolders();
loadUploadFolders();

window.allMediaFiles = allMediaFiles;
window.captions = captions;
window.deletePhoto = deletePhoto;
window.saveCaptionToGithub = saveCaptionToGithub;
window.fetchFilesInSubfolder = fetchFilesInSubfolder;