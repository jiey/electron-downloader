const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('previewAPI', {
    loadContent: (callback) => ipcRenderer.on('load-content', (event, content) => callback(content))
});