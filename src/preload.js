const { contextBridge, ipcRenderer, dialog } = require('electron');

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
    // index_renderer.js
    // showAlert()alertの代わり
    showAlert: (message) => ipcRenderer.invoke('show-error-message', message),
    showMessage: (message) => ipcRenderer.invoke('show-message', 'info', 'メッセージを確認', message),
    getShopInfo: () => ipcRenderer.invoke('get-shop-info'),
    // レンダラー → メイン
    showDownloaderWindow: () => ipcRenderer.send('show-downloader-window'),
    showItemEditWindow: () => ipcRenderer.send('show-item-edit-window'),

    // レンダラー → メイン
    startDownload: (dl_lists, dl_folder_path, is_create_folder) => ipcRenderer.send('start-download', dl_lists, dl_folder_path, is_create_folder),
    interruptDownload: () => ipcRenderer.send('interrupt-download'),
    setConfig_dl_path: (dl_path) => ipcRenderer.send('set-config-dl_path', dl_path),
    getConfigMain: async () => {
        const res = await ipcRenderer.invoke('get-config');
        console.log(res);
        return res;
    },
    chooseFolderPath: () => ipcRenderer.invoke('choose-folder-path'),
    searchRakutenItems: async (param_target, search_word, sortKey, sortOrder, offset, shop_targets) => {
        if (offset >= 10000) {
            throw new TypeError('offsetは10000までしか設定できません（楽天RMS APIの仕様）');
        }
        const res = await ipcRenderer.invoke('search-rakuten-items', param_target, search_word, sortKey, sortOrder, offset, shop_targets)
        return res;
    },
    getRakutenItem: async (r_item_code, shop_targets) => {
        const res = await ipcRenderer.invoke('get-rakuten-item', r_item_code, shop_targets)
        return res;
    },
    getRakutenInventory: async (r_item_code, r_sku_code, shop_target) => {
        const res = await ipcRenderer.invoke('get-rakuten-inventory', r_item_code, r_sku_code, shop_target)
        return res;
    },
    getRakutenInventories: async (r_item_sku_codes, shop_target) => {
        const res = await ipcRenderer.invoke('get-rakuten-inventories', r_item_sku_codes, shop_target)
        return res;
    },
    updateRakutenItem: async (r_item_code, post_data, shop_target) => {
        const res = await ipcRenderer.invoke('update-rakuten-item', r_item_code, post_data, shop_target)
        return res;
    },
    getImage: async (r_item_code, shop_targets) => {
        const res = await ipcRenderer.invoke('get-image', r_item_code, shop_targets)
        return res;
    },
    searchInPage: (search_word, mode) => {
        if (mode === 'prev') {
            ipcRenderer.send('search-in-page', search_word, { findNext: true, forward: false });
        }else{
            ipcRenderer.send('search-in-page', search_word, { findNext: true, forward: true });
        }
    },
    searchInPageEnd: () => {
        ipcRenderer.send('stop-search-in-page', 'clearSelection');
    },

    // メイン → レンダラー
    on: (channel, callback) => ipcRenderer.on(channel, (event, ...argv)=>callback(event, ...argv))

})

contextBridge.exposeInMainWorld('renderAPI', {
    // HTML要素を作成する関数
    createHTMLElement: (tagName, attributes = {}, textContent = '') => {
        const element = document.createElement(tagName); // 指定されたタグ名の要素を作成
        for (let [key, value] of Object.entries(attributes)) {
            element.setAttribute(key, value); // 属性を設定
        }
        element.textContent = textContent; // テキストコンテンツを設定
        return element;
    },
    // キャビネットかGOLDのURLを返す関数
    convertRakutenImageURL: (hash, shop_code) => {
        let image_url = "";
        if (hash.type === 'CABINET') {
            image_url = `https://image.rakuten.co.jp/${shop_code}/cabinet${hash.location}`;
        }else if (hash.type === 'GOLD') {
            image_url = `https://www.rakuten.ne.jp/gold/${shop_code}${hash.location}`;
        }
        return image_url;
    },
    // 楽天の商品ページURLを返す関数
    makeRakutenItemURL: (item_code, shop_code, is_souko) => {
        let subdomain = "";
        if (is_souko == true) {
            subdomain = 'soko.rms';
        }else{
            subdomain = 'item';
        }
        const item_url = `https://${subdomain}.rakuten.co.jp/${shop_code}/${item_code}/`;
        return item_url;
    }
})
