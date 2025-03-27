document.addEventListener('DOMContentLoaded', () => {
    const githubFolder = document.getElementById('githubFolder');
    const githubSubfolder = document.getElementById('githubSubfolder');
    const subfolderContainer = document.getElementById('subfolderContainer');
    const uploadFile = document.getElementById('uploadFile');
    const uploadToGithub = document.getElementById('uploadToGithub');
    const gallery = document.getElementById('gallery');
    const mediaUrl = document.getElementById('mediaUrl');
    const uploadFolderSelect = document.getElementById('uploadFolderSelect');
    const uploadSubfolderSelect = document.getElementById('uploadSubfolderSelect');
    const uploadFolderInput = document.getElementById('uploadFolderInput');
    let allSubfolders = [];
    let allMediaFiles = [];
    let captions = {};

    function naturalSort(a, b) {
        const aKey = a.name || a.path || a;
        const bKey = b.name || b.path || b;
        return aKey.localeCompare(bKey, undefined, { numeric: true, sensitivity: 'base' });
    }

    async function loadGithubFolders() {
        core.showFloatingNotification('Memuat daftar folder...');
        document.getElementById('floatingSpinner').classList.remove('hidden');
        try {
            const res = await fetch('/api/get_github_files?path=ig');
            if (!res.ok) {
                throw new Error(`HTTP error! status: ${res.status}`);
            }
            const data = await res.json();
            console.log('GitHub folders fetched:', data);

            const folders = data.files.filter(item => item.type === 'dir');
            folders.sort(naturalSort);

            githubFolder.innerHTML = '<option value="ig">-- Pilih Folder --</option>';
            folders.forEach(item => {
                console.log('Adding folder to dropdown:', item.name);
                const option = document.createElement('option');
                option.value = item.path;
                option.textContent = item.name;
                githubFolder.appendChild(option);
            });

            if (githubFolder.options.length === 1) {
                core.showFloatingNotification('No subfolders found in ig directory.', true);
            } else {
                core.showFloatingNotification('');
            }
        } catch (error) {
            core.showFloatingNotification(`Error loading GitHub folders: ${error.message}`, true);
            console.error('Error fetching GitHub folders:', error);
        } finally {
            document.getElementById('floatingSpinner').classList.add('hidden');
        }
    }

    async function fetchSubfolders(path) {
        core.showFloatingNotification('Memuat daftar subfolder...');
        document.getElementById('floatingSpinner').classList.remove('hidden');
        try {
            const res = await fetch(`/api/get_github_files?path=${path}`);
            if (!res.ok) {
                throw new Error(`HTTP error! status: ${res.status}`);
            }
            const data = await res.json();
            console.log(`Subfolders fetched for path ${path}:`, data);

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
            core.showFloatingNotification(`Error loading subfolders: ${error.message}`, true);
            return [];
        } finally {
            document.getElementById('floatingSpinner').classList.add('hidden');
        }
    }

    async function fetchFilesInSubfolder(path) {
        core.showFloatingNotification('Memuat daftar file...');
        document.getElementById('floatingSpinner').classList.remove('hidden');
        try {
            const res = await fetch(`/api/get_github_files?path=${path}`);
            if (!res.ok) {
                throw new Error(`HTTP error! status: ${res.status}`);
            }
            const data = await res.json();
            console.log(`Files fetched for path ${path}:`, data);

            allMediaFiles = [];
            const mediaFiles = data.files.filter(item => 
                item.type === 'file' && 
                (item.name.endsWith('.jpg') || item.name.endsWith('.png') || item.name.endsWith('.mp4'))
            );
            const totalFiles = mediaFiles.length;

            if (totalFiles === 0) {
                core.showFloatingNotification('Tidak ada file media yang didukung di folder ini.', true);
                document.getElementById('floatingSpinner').classList.add('hidden');
                return allMediaFiles;
            }

            let loadedCount = 0;
            for (const item of mediaFiles) {
                loadedCount++;
                core.showFloatingNotification(`Memuat file ${loadedCount} dari ${totalFiles}...`, false, 0);
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

            core.showFloatingNotification(`Memuat metadata untuk ${totalFiles} file...`, false, 0);
            let metaLoadedCount = 0;

            try {
                const metaRes = await fetch(`/api/get_file_content?${metaPaths.map(path => `paths=${encodeURIComponent(path)}`).join('&')}`);
                if (!metaRes.ok) {
                    throw new Error(`HTTP error fetching metadata! status: ${metaRes.status}`);
                }
                const metaData = await metaRes.json();
                console.log('Metadata fetched from API:', metaData);

                allMediaFiles.forEach(file => {
                    const folderPath = file.path.substring(0, file.path.lastIndexOf('/'));
                    const metaPath = `${folderPath}/${file.name}.meta.json`;
                    if (metaData && metaData[metaPath] && typeof metaData[metaPath].caption === 'string') {
                        captions[file.path] = metaData[metaPath].caption;
                    } else {
                        captions[file.path] = '';
                        console.log(`No valid metadata found for ${metaPath}, using empty caption.`);
                    }
                    metaLoadedCount++;
                    core.showFloatingNotification(`Memuat metadata ${metaLoadedCount}/${totalFiles}...`, false, 0);
                });

                core.showFloatingNotification(`Berhasil memuat metadata untuk ${metaLoadedCount}/${totalFiles} file.`, false, 3000);
            } catch (error) {
                console.error('Error fetching metadata:', error);
                allMediaFiles.forEach(file => {
                    captions[file.path] = '';
                    metaLoadedCount++;
                    core.showFloatingNotification(`Memuat metadata ${metaLoadedCount}/${totalFiles}...`, false, 0);
                });
                core.showFloatingNotification('Gagal memuat metadata. Menggunakan caption kosong.', true);
            }

            core.showFloatingNotification(`Berhasil memuat ${totalFiles} file.`, false, 3000);
            return allMediaFiles;
        } catch (error) {
            console.error(`Error fetching files for path ${path}:`, error);
            core.showFloatingNotification(`Error loading files: ${error.message}`, true);
            return [];
        } finally {
            setTimeout(() => {
                document.getElementById('floatingSpinner').classList.add('hidden');
            }, 3000);
        }
    }

    githubFolder.addEventListener('change', async () => {
        const folderPath = githubFolder.value;
        allMediaFiles = [];
        captions = {};
        schedules.scheduledTimes = {};
        gallery.innerHTML = '';
        mediaUrl.value = '';

        const scheduleAllContainer = document.querySelector('.schedule-all-container');
        scheduleAllContainer.style.display = 'none';

        if (!folderPath || folderPath === 'ig') {
            subfolderContainer.classList.add('hidden');
            document.querySelector('label[for="githubSubfolder"]').style.display = 'none';
            githubSubfolder.innerHTML = '<option value="">-- Pilih Subfolder --</option>';
            return;
        }

        try {
            if (folderPath === 'ig/image') {
                subfolderContainer.classList.add('hidden');
                document.querySelector('label[for="githubSubfolder"]').style.display = 'none';
                const files = await fetchFilesInSubfolder(folderPath);
                allMediaFiles = files;
                schedules.displayGallery(files);

                if (files.length === 0) {
                    core.showFloatingNotification('No supported media files found in this folder.', true);
                } else {
                    core.showFloatingNotification('');
                }
            } else {
                subfolderContainer.classList.remove('hidden');
                document.querySelector('label[for="githubSubfolder"]').style.display = 'block';
                document.querySelector('label[for="githubSubfolder"]').textContent = 'Subfolder';
                const subfolders = await fetchSubfolders(folderPath);
                console.log('All subfolders found:', subfolders);

                if (subfolders.length === 0) {
                    const files = await fetchFilesInSubfolder(folderPath);
                    allMediaFiles = files;
                    githubSubfolder.innerHTML = '<option value="">-- Tidak Ada Subfolder --</option>';
                    schedules.displayGallery(files);

                    if (files.length === 0) {
                        core.showFloatingNotification('No supported media files found in this folder.', true);
                    } else {
                        core.showFloatingNotification('');
                    }
                } else {
                    githubSubfolder.innerHTML = '<option value="">-- Pilih Subfolder --</option>';
                    subfolders.forEach(subfolder => {
                        const option = document.createElement('option');
                        option.value = subfolder.path;
                        option.textContent = subfolder.name;
                        githubSubfolder.appendChild(option);
                    });

                    if (githubSubfolder.options.length === 1) {
                        core.showFloatingNotification('No subfolders found in this folder.', true);
                    } else {
                        core.showFloatingNotification('');
                    }
                }
            }
        } catch (error) {
            core.showFloatingNotification(`Error loading subfolders: ${error.message}`, true);
            console.error('Error fetching subfolders:', error);
            subfolderContainer.classList.add('hidden');
            document.querySelector('label[for="githubSubfolder"]').style.display = 'none';
        }
    });

    githubSubfolder.addEventListener('change', async () => {
        const subfolderPath = githubSubfolder.value;
        allMediaFiles = [];
        captions = {};
        schedules.scheduledTimes = {};
        gallery.innerHTML = '';
        mediaUrl.value = '';

        const scheduleAllContainer = document.querySelector('.schedule-all-container');
        scheduleAllContainer.style.display = 'none';

        if (!subfolderPath) {
            return;
        }

        try {
            const files = await fetchFilesInSubfolder(subfolderPath);
            console.log('All media files found:', files);
            allMediaFiles = files;

            schedules.displayGallery(files);

            if (files.length === 0) {
                core.showFloatingNotification('No supported media files found in this subfolder.', true);
            } else {
                core.showFloatingNotification('');
            }
        } catch (error) {
            core.showFloatingNotification(`Error loading files: ${error.message}`, true);
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
            core.showFloatingNotification(`Error loading upload folders: ${error.message}`, true);
        }
    }

    uploadFolderSelect.addEventListener('change', async () => {
        const folderPath = uploadFolderSelect.value;

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
                core.showFloatingNotification(`Error loading subfolders: ${error.message}`, true);
                console.error('Error fetching subfolders:', error);
            }
        }
    });

    uploadSubfolderSelect.addEventListener('change', () => {
        if (uploadSubfolderSelect.value) {
            uploadFolderInput.style.display = 'none';
            uploadFolderInput.value = '';
        } else {
            uploadFolderInput.style.display = 'block';
            uploadFolderInput.placeholder = 'Masukkan subfolder (opsional)';
        }
    });

    uploadToGithub.addEventListener('click', async () => {
        if (!uploadFile.files || uploadFile.files.length === 0) {
            core.showFloatingNotification('Pilih file terlebih dahulu.', true);
            return;
        }

        let uploadFolderValue;
        if (uploadFolderSelect.value === 'custom') {
            uploadFolderValue = uploadFolderInput.value.trim();
            if (!uploadFolderValue) {
                core.showFloatingNotification('Masukkan path folder tujuan.', true);
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
                core.showFloatingNotification('Path folder tujuan mengandung karakter yang tidak diizinkan.', true);
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

        const metaFiles = files.filter(file => {
            const fileName = file.name.toLowerCase();
            return fileName.endsWith('.json');
        });

        if (mediaFiles.length === 0) {
            core.showFloatingNotification('Pilih setidaknya satu file media (JPG, JPEG, PNG, atau MP4).', true);
            return;
        }

        const metaFileMap = {};
        metaFiles.forEach(metaFile => {
            const baseName = metaFile.name.replace(/\.meta\.json$/i, '');
            metaFileMap[baseName] = metaFile;
        });

        let uploadedCount = 0;
        const totalFiles = mediaFiles.length;
        core.showFloatingNotification(`Mengunggah file 1 dari ${totalFiles}...`);
        document.getElementById('floatingSpinner').classList.remove('hidden');

        try {
            for (const file of mediaFiles) {
                const reader = new FileReader();
                const result = await new Promise((resolve, reject) => {
                    reader.readAsDataURL(file);
                    reader.onload = async () => {
                        try {
                            const base64Content = reader.result.split(',')[1];
                            let newFileName;

                            if (uploadFolderValue && uploadFolderValue !== 'ig/image') {
                                newFileName = file.name;
                            } else {
                                const randomNum = Math.floor(10000 + Math.random() * 90000);
                                const extension = file.name.split('.').pop();
                                newFileName = `${randomNum}.${extension}`;
                            }

                            const filePath = `${uploadFolderValue}/${newFileName}`;
                            const commitMessage = uploadFolderValue.startsWith('ig/') 
                                ? `Upload ${newFileName} to ${uploadFolderValue} [vercel-skip]` 
                                : `Upload ${newFileName} to ${uploadFolderValue}`;

                            console.log(`Uploading file: ${filePath}`);

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

                            const originalFileName = file.name;
                            let metaContent = { caption: '' };
                            let metaBase64Content;

                            if (metaFileMap[originalFileName]) {
                                const metaFile = metaFileMap[originalFileName];
                                const metaReader = new FileReader();
                                const metaResult = await new Promise((metaResolve, metaReject) => {
                                    metaReader.readAsText(metaFile);
                                    metaReader.onload = () => {
                                        try {
                                            const content = JSON.parse(metaReader.result);
                                            if (content.caption) {
                                                metaContent = { caption: content.caption };
                                            }
                                            metaResolve();
                                        } catch (error) {
                                            metaReject(new Error(`Error parsing meta JSON for ${metaFile.name}: ${error.message}`));
                                        }
                                    };
                                    metaReader.onerror = () => metaReject(new Error(`Error reading meta file ${metaFile.name}`));
                                });

                                console.log(`Using provided meta JSON for ${originalFileName}:`, metaContent);
                            } else {
                                console.log(`No meta JSON provided for ${originalFileName}, creating default.`);
                            }

                            const metaFileName = `${uploadFolderValue}/${newFileName}.meta.json`;
                            const metaContentString = JSON.stringify(metaContent, null, 2);
                            metaBase64Content = btoa(unescape(encodeURIComponent(metaContentString)));
                            const metaCommitMessage = uploadFolderValue.startsWith('ig/') 
                                ? `Upload meta for ${newFileName} to ${uploadFolderValue} [vercel-skip]` 
                                : `Upload meta for ${newFileName} to ${uploadFolderValue}`;

                            console.log(`Uploading meta file: ${metaFileName}`);

                            const metaResponse = await fetch('/api/upload_to_github', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                    fileName: metaFileName,
                                    content: metaBase64Content,
                                    message: metaCommitMessage,
                                }),
                            });

                            const metaResponseData = await metaResponse.json();
                            if (!metaResponse.ok) {
                                console.error(`Meta upload failed: ${metaResponseData.error}`);
                                core.showFloatingNotification(`Gagal mengunggah meta untuk ${newFileName}: ${metaResponseData.error}`, true);
                            } else {
                                console.log(`Meta file uploaded successfully: ${metaFileName}`);
                            }

                            allMediaFiles.push(newFile);
                            captions[newFile.path] = metaContent.caption || '';
                            uploadedCount++;
                            if (uploadedCount < totalFiles) {
                                core.showFloatingNotification(`Mengunggah file ${uploadedCount + 1} dari ${totalFiles}...`);
                            }

                            resolve(newFile);
                        } catch (error) {
                            console.error(`Error in upload process for ${file.name}:`, error);
                            reject(error);
                        }
                    };
                    reader.onerror = () => reject(new Error(`Error reading file ${file.name}`));
                });
            }

            core.showFloatingNotification(`${mediaFiles.length} file media berhasil diunggah ke GitHub!`);
            schedules.displayGallery(allMediaFiles);

            await loadUploadFolders();
            await loadGithubFolders();
        } catch (error) {
            core.showFloatingNotification(`Error uploading to GitHub: ${error.message}`, true);
            console.error('Error uploading to GitHub:', error);
        } finally {
            document.getElementById('floatingSpinner').classList.add('hidden');
        }
    });

    async function deletePhoto(filePath) {
        core.showFloatingNotification(`Menghapus ${filePath}...`);
        document.getElementById('floatingSpinner').classList.remove('hidden');

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
            core.showFloatingNotification(`${deleteResult.message}`);

            allMediaFiles = allMediaFiles.filter(f => f.path !== filePath);
            delete captions[filePath];
            delete schedules.scheduledTimes[filePath];
            schedules.displayGallery(allMediaFiles);
        } catch (error) {
            core.showFloatingNotification(`Gagal menghapus file dari GitHub: ${error.message}`, true);
            console.error('Error deleting file from GitHub:', error);
        } finally {
            document.getElementById('floatingSpinner').classList.add('hidden');
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

            console.log(`Meta file ${metaPath} saved to GitHub`);
            return true;
        } catch (error) {
            console.error(`Error saving meta file for ${file.name}:`, error);
            core.showFloatingNotification(`Error saving meta file for ${file.name}: ${error.message}`, true);
            return false;
        }
    }

    loadGithubFolders();
    loadUploadFolders();

    // Ekspor fungsi dan variabel untuk digunakan di file lain
    window.github = {
        allMediaFiles,
        captions,
        deletePhoto,
        saveCaptionToGithub,
        loadGithubFolders
    };
});