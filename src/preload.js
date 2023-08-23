const { contextBridge, ipcRenderer } = require('electron')

// Node.jsのすべてのAPIがプリロード処理で利用可能です。
// Chromeの拡張機能と同じサンドボックスを持っています。
window.addEventListener("DOMContentLoaded", () => {
    // DOM要素のテキストを変更します
    const replaceText = (selector, text) => {
      const element = document.getElementById(selector);
      if (element) {
        element.textContent = text;
      }
    };
  
    for (const dependency of ["chrome", "node", "electron"]) {
      // HTMLページ内の文言を差し替えます
      replaceText(`${dependency}-version`, process.versions[dependency]);
    }
  });

  // 表示側に開放するAPIを定義
contextBridge.exposeInMainWorld('electronAPI', {
    // レンダラー → メイン
    startDownload: (dl_lists) => ipcRenderer.send('start-download', dl_lists),
    interruptDownload: () => ipcRenderer.send('interrupt-download'),

    // メイン → レンダラー
    on: (channel, callback) => ipcRenderer.on(channel, (event, ...argv)=>callback(event, ...argv))

})

