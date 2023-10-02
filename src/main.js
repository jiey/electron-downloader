// アプリケーション作成用のモジュールを読み込み
const { app, Menu, BrowserWindow, ipcMain, dialog, shell } = require('electron');
// const { autoUpdater } = require('update-electron-app');
const {download} = require('electron-dl');
const path = require('path');
const url = require('url');
const fs = require('fs');
const axios = require('axios');
const Encoding = require('encoding-japanese');
const Store = require('electron-store');
const { create } = require('domain');
// 以下を有効にするとgithub経由でアップデート可能になるが、
// Macで起動できず。。。（署名問題）
// require('update-electron-app')({
//     repo: 'jiey/electron-downloader',
//     updateInterval: '1 hour',
//     logger: require('electron-log')
// })

// メインウィンドウ
let mainWindow = null;
let downloaderWindow = null;
let itemEditWindow = null;
let download_interrupt_flag = false; // ダウンロード中止

// 実行環境がmacOSならtrue
const isMac = (process.platform === 'darwin');  // 'darwin' === macOS

const default_dl_path = app.getPath('downloads');

// ショップ情報
const shop_info = {
    r_somurie: {
      shop_code: 'bellevie-harima',
      shop_name: 'ソムリエ＠ギフト',
    },
    r_patie: {
      shop_code: 'patie',
      shop_name: 'パティエ',
    },
    r_kagu: {
      shop_code: 'sommelier',
      shop_name: '家具のソムリエ',
    },
    r_babuuu: {
      shop_code: 'babuuu',
      shop_name: 'babuuu.',
    },
};



const store = new Store();
let webapi_keys = {};
webapi_keys.webapi = store.get('webapi');
// let webapi_r_somurie = store.get('webapi.r_somurie');
console.log(webapi_keys);

// 設定が保存されていない場合は、プリザンターから取得
if (webapi_keys.webapi === undefined || webapi_keys.webapi.r_somurie.serviceSecret === '') {
console.log("プリザンターから再取得する");
    webapi_keys = {
        webapi: {
            r_somurie: {
                serviceSecret: '',
                licenseKey: ''
            },
            r_patie: {
                serviceSecret: '',
                licenseKey: ''
            },
            r_kagu: {
                serviceSecret: '',
                licenseKey: ''
            },
            r_babuuu: {
                serviceSecret: '',
                licenseKey: ''
            },
        }
    };
    getRmsAPIInfo_from_pleasanter();
}else{
    console.log("プリザンターから再取得しない");
    console.log(webapi_keys.webapi);
}

// 設定画面定義
function openSettingsWindow() {
    let settingsWindow = new BrowserWindow({
        width: 800,
        height: 600,
        webPreferences: {
            preload: path.join(__dirname, "preload.js"),
        },
        modal: true,
        parent: mainWindow,
    });

    // ウィンドウのメニューを非表示にします
    settingsWindow.setMenu(null);

    // 設定画面のHTMLを読み込む
    settingsWindow.loadFile('src/settings.html');

    settingsWindow.on('closed', () => {
        settingsWindow = null;
    });
}

function createMenu() {
    const template = Menu.buildFromTemplate([
        ...(isMac ? [{
            label: app.name,
            submenu: [
              {role:'about',      label:`${app.name}について` },
              {type:'separator'},
              {role:'services',   label:'サービス'},
              {type:'separator'},
              {role:'hide',       label:`${app.name}を隠す`},
              {role:'hideothers', label:'ほかを隠す'},
              {role:'unhide',     label:'すべて表示'},
              {type:'separator'},
              {role:'quit',       label:`${app.name}を終了`}
            ]
          }] : []),
        {
          label: 'ファイル',
          submenu: [
            isMac ? {role:'close', label:'ウィンドウを閉じる'} : {role:'quit', label:'終了'}
          ]
        },
        {
          label: '編集',
          submenu: [
            {role:'undo',  label:'元に戻す'},
            {role:'redo',  label:'やり直す'},
            {type:'separator'},
            {role:'cut',   label:'切り取り'},
            {role:'copy',  label:'コピー'},
            {role:'paste', label:'貼り付け'},
            ...(isMac ? [
                {role:'pasteAndMatchStyle', label:'ペーストしてスタイルを合わせる'},
                {role:'delete',    label:'削除'},
                {role:'selectAll', label:'すべてを選択'},
                {type:'separator' },
                {
                  label: 'スピーチ',
                  submenu: [
                    {role:'startSpeaking', label:'読み上げを開始'},
                    {role:'stopSpeaking',  label:'読み上げを停止'}
                  ]
                }
              ] : [
                {role:'delete',    label:'削除'},
                {type:'separator'},
                {role:'selectAll', label:'すべてを選択'}
              ])
           ]
        },
        {
          label: '表示',
          submenu: [
            {role:'reload',         label:'再読み込み'},
            {role:'forceReload',    label:'強制的に再読み込み'},
            {role:'toggleDevTools', label:'開発者ツールを表示'},
            {type:'separator'},
            {role:'resetZoom',      label:'実際のサイズ'},
            {role:'zoomIn',         label:'拡大'},
            {role:'zoomOut',        label:'縮小'},
            {type:'separator'},
            {role:'togglefullscreen', label:'フルスクリーン'}
          ]
        },
        {
          label: 'ウィンドウ',
          submenu: [
            {role:'minimize', label:'最小化'},
            {role:'zoom',     label:'ズーム'},
            ...(isMac ? [
                 {type:'separator'} ,
                 {role:'front',  label:'ウィンドウを手前に表示'},
                 {type:'separator'},
                 {role:'window', label:'ウィンドウ'}
               ] : [
                 {role:'close',  label:'閉じる'}
               ])
          ]
        },
        {
          label:'ヘルプ',
          submenu: [
            {label:`${app.name} ヘルプ`},    // ToDo
            ...(isMac ? [ ] : [
              {type:'separator'} ,
              {role:'about',  label:`${app.name}について` }
            ])
          ]
        }
      ]);
    // const customMenuTemplate = [
    //     {
    //         label: 'メニュー',
    //         submenu: [
    //             {
    //                 label: '設定',
    //                 click: openSettingsWindow,
    //             },
    //             { type: 'separator' },
    //             { role: 'toggleDevTools' },
    //             {
    //                 label: '終了',
    //                 accelerator: process.platform === 'darwin' ? 'Cmd+Q' : 'Alt+F4',
    //                 role: 'quit'
    //             },
    //         ],
    //     },
    //     {
    //         label: '編集',
    //         submemu: [
    //             { role: 'undo' },
    //             { role: 'redo' },
    //             { type: 'separator' },
    //             { role: 'cut' },
    //             { role: 'copy' },
    //             { role: 'paste' },
    //         ]
    //     },
    // ];
    
    // // macOSでは、最初のメニューアイテムは通常アプリケーションの名前であるため、それを加えます。
    // if (process.platform === 'darwin') {
    //     customMenuTemplate.unshift({
    //         label: app.getName(),
    //         submenu: [
    //         { role: 'about' },
    //         { type: 'separator' },
    //         { role: 'services' },
    //         { type: 'separator' },
    //         { role: 'hide' },
    //         { role: 'hideothers' },
    //         { role: 'unhide' },
    //         { type: 'separator' },
    //         { role: 'quit' }
    //         ]
    //     });
    // }
    
    // console.log(customMenuTemplate);
    // const customMenu = Menu.buildFromTemplate(customMenuTemplate);
    Menu.setApplicationMenu(template);    
}

const createWindow = () => {
    // メインウィンドウを作成します
    mainWindow = new BrowserWindow({
        width: 1400,
        height: 1000,
        webPreferences: {
            // プリロードスクリプトは、レンダラープロセスが読み込まれる前に実行され、
            // レンダラーのグローバル（window や document など）と Node.js 環境の両方にアクセスできます。
            preload: path.join(__dirname, "preload.js"),
        },
    });


    // メインウィンドウに表示するURLを指定します
    // （今回はmain.jsと同じディレクトリのindex.html）
    mainWindow.loadFile("src/index.html");

    createMenu();

    // デベロッパーツールの起動
    // mainWindow.webContents.openDevTools();

    // 自動アップデートの有効化
    // autoUpdater.checkForUpdates();

    // メインウィンドウが閉じられたときの処理
    mainWindow.on("closed", () => {
        mainWindow = null;
    });
};

//  初期化が完了した時の処理
app.whenReady().then(() => {
  createWindow();

  // アプリケーションがアクティブになった時の処理(Macだと、Dockがクリックされた時）
  app.on("activate", () => {
    // メインウィンドウが消えている場合は再度メインウィンドウを作成する
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// 全てのウィンドウが閉じたときの処理
app.on("window-all-closed", () => {
  // macOSのとき以外はアプリケーションを終了させます
  if (process.platform !== "darwin") {
    app.quit();
  }
});

// フォルダ選択
function handleFileOpen () {
    const folderPaths = dialog.showOpenDialogSync({
        properties: ['openDirectory']
    })

    if (folderPaths) {
        return folderPaths[0]
    }else{
        return null;
    }
}

// プリザンターからRMS Web API用のキーを取得する
async function getRmsAPIInfo_from_pleasanter() {
    // プリザンターAPI
    const priz_api_url = "http://192.168.0.214/api/items/1231780/get";
    const priz_api_key = "c9f6479905706327959e1a187b6adc6e0b824cb040914cade602902608aa1bdf281703c943f9dd89fe3b0af30724b8b3fe668b63a14f9f3a98d5a8a7b2a17d7a";

    const postData = {
        ApiVersion: '1.1',
        ApiKey: priz_api_key,
        view: {
            ColumnFilterHash: {
                ClassA: JSON.stringify(['r_']), // https://qiita.com/Implem/items/622b463a4ec9003b192d
                // DescriptionA: 'licenseKey',
                ClassB: 'API'
            },
            ColumnFilterSearchTypes: {
                ClassA: 'ForwardMatch' // 前方一致
            },
        },
        Offset: 0
    };

    try {
        const res = await axios.post(priz_api_url, postData);
console.log(res.request);
        if (res.data.StatusCode === 200) {
            // 通信成功
            const datas = res.data.Response.Data;
            for(let i=0; i<datas.length; i++) {
                let shop_code = datas[i].ClassHash.ClassA;
                let key = datas[i].DescriptionHash.DescriptionA;
                let value = datas[i].DescriptionHash.DescriptionB;

                // 連想配列に保持
                switch(shop_code) {
                    case 'r_bellevie-harima':
                        if (key === 'serviceSecret') {
                            webapi_keys.webapi.r_somurie.serviceSecret = value;
                        }else if (key === 'licenseKey') {
                            webapi_keys.webapi.r_somurie.licenseKey = value;
                        }
                        break;
                    case 'r_patie':
                        if (key === 'serviceSecret') {
                            webapi_keys.webapi.r_patie.serviceSecret = value;
                        }else if (key === 'licenseKey') {
                            webapi_keys.webapi.r_patie.licenseKey = value;
                        }
                        break;
                    case 'r_sommelier':
                        if (key === 'serviceSecret') {
                            webapi_keys.webapi.r_kagu.serviceSecret = value;
                        }else if (key === 'licenseKey') {
                            webapi_keys.webapi.r_kagu.licenseKey = value;
                        }
                        break;
                    case 'r_babuuu':
                        if (key === 'serviceSecret') {
                            webapi_keys.webapi.r_babuuu.serviceSecret = value;
                        }else if (key === 'licenseKey') {
                            webapi_keys.webapi.r_babuuu.licenseKey = value;
                        }
                        break;
                }
            }
        }
        console.log(res.data.StatusCode);
        console.log(res.data.Response);
        console.log(res.data.Response.Data[0]);
        console.log(res.data.Response.Data[1]);
    }catch(err) {
        console.error(err);
    }
    // 設定を保存
console.log(webapi_keys.webapi);
    store.set(webapi_keys);
}

// API ---------------
// index_renderer.js
// downloader画面
ipcMain.on('show-downloader-window', () => {
    downloaderWindow = new BrowserWindow({
        width: 1400,
        height: 1000,
        webPreferences: {
            // プリロードスクリプトは、レンダラープロセスが読み込まれる前に実行され、
            // レンダラーのグローバル（window や document など）と Node.js 環境の両方にアクセスできます。
            preload: path.join(__dirname, "preload.js"),
        },
    });

    downloaderWindow.loadFile("src/downloader.html");
});

// 商品編集画面
ipcMain.on('show-item-edit-window', () => {
    itemEditWindow = new BrowserWindow({
        width: 1600,
        height: 1000,
        webPreferences: {
            // プリロードスクリプトは、レンダラープロセスが読み込まれる前に実行され、
            // レンダラーのグローバル（window や document など）と Node.js 環境の両方にアクセスできます。
            preload: path.join(__dirname, "preload.js"),
        },
    });

    itemEditWindow.loadFile("src/item_edit.html");

    itemEditWindow.webContents.setWindowOpenHandler(({ url }) => {
        if (url.startsWith('http')) {
            shell.openExternal(url)
        }
        return { action: 'deny' }
    })
});

// 共通
// param_target: 検索対象（'title', 'manageNumber'）
// search_word: 検索キーワード
// shop_targets：検索対象ショップ
ipcMain.handle('search-rakuten-items', async (event, param_target, search_word, sortKey, sortOrder, offset, shop_targets) => {
    let result = new Object();

    // ショップの数だけ回す
    for(let shop_count = 0; shop_count < shop_targets.length; shop_count++) {
        const shop_incode = shop_targets[shop_count];
        // 楽天API呼び出し用パラメーター
        const serviceSecret = webapi_keys.webapi[shop_incode].serviceSecret;//'SP215297_5sVPn5UuV6Akh7E7'
        const licenseKey = webapi_keys.webapi[shop_incode].licenseKey;//'SL215297_gZkFagCVNKiCtBV3' // ３ヶ月ごとに変更あり

console.log(shop_targets[shop_count]);
console.log("serviceSecret:", serviceSecret);

        const auth_string = Buffer.from(`${serviceSecret}:${licenseKey}`).toString('base64');

        const req_url = `https://api.rms.rakuten.co.jp/es/2.0/items/search?${param_target}=${search_word}&sortKey=${sortKey}&sortOrder=${sortOrder}&isReviewIncluded=true&hits=30&offset=${offset}`;

        // 401の場合を含めて2回トライしてみる
        for(let try_count=0; try_count<2; try_count++) {
            try{
                const res = await axios.get(req_url, {
                    responseType: 'json',
                    headers: {
                        'Authorization': `ESA ${auth_string}`
                    }
                });
console.log(res.data);
                // 商品画像取得
                result[shop_incode] = res.data;
        
                // ここまで来たら正常取得完了
                break;
            }catch(err) {
                if(/401/.test(err.message)) {
                    // 認証エラー
                    // プリザンターから最新のライセンスキーを取得してみる
                    await getRmsAPIInfo_from_pleasanter();
                    // 2回目のチャレンジ
                    continue;
                }else if (/404/.test(err.message)) {
                    // 他のは取れてるかもなので、引き続き実行
                    continue;
                }
                throw err;
            }
        
        }

    }

    return result;

});

ipcMain.handle('get-rakuten-item', async (event, r_item_code, shop_targets) => {
    let result = new Object();

    // ショップの数だけ回す
    for(let shop_count = 0; shop_count < shop_targets.length; shop_count++) {
        const shop_incode = shop_targets[shop_count];
        // 楽天API呼び出し用パラメーター
        const serviceSecret = webapi_keys.webapi[shop_incode].serviceSecret;//'SP215297_5sVPn5UuV6Akh7E7'
        const licenseKey = webapi_keys.webapi[shop_incode].licenseKey;//'SL215297_gZkFagCVNKiCtBV3' // ３ヶ月ごとに変更あり

console.log(shop_targets[shop_count]);
console.log("serviceSecret:", serviceSecret);

        const auth_string = Buffer.from(`${serviceSecret}:${licenseKey}`).toString('base64');

        const req_url = `https://api.rms.rakuten.co.jp/es/2.0/items/manage-numbers/${r_item_code}`;

        // 401の場合を含めて2回トライしてみる
        for(let try_count=0; try_count<2; try_count++) {
            try{
                const res = await axios.get(req_url, {
                    responseType: 'json',
                    headers: {
                        'Authorization': `ESA ${auth_string}`
                    }
                });
// console.log(res.data);
                // 商品画像取得
                result[shop_incode] = res.data;
        
                // ここまで来たら正常取得完了
                break;
            }catch(err) {
                if(/401/.test(err.message)) {
                    // 認証エラー
                    // プリザンターから最新のライセンスキーを取得してみる
                    await getRmsAPIInfo_from_pleasanter();
                    // 2回目のチャレンジ
                    continue;
                }else if (/404/.test(err.message)) {
                    // 他のは取れてるかもなので、引き続き実行
                    continue;
                }
                throw err;
            }
        
        }

    }

    return result;

});

// 在庫数取得(単品SKU)
ipcMain.handle('get-rakuten-inventory', async (event, r_item_code, r_sku_code, shop_target) => {
    let result;

    // 楽天API呼び出し用パラメーター
    const serviceSecret = webapi_keys.webapi[shop_target].serviceSecret;//'SP215297_5sVPn5UuV6Akh7E7'
    const licenseKey = webapi_keys.webapi[shop_target].licenseKey;//'SL215297_gZkFagCVNKiCtBV3' // ３ヶ月ごとに変更あり

    const auth_string = Buffer.from(`${serviceSecret}:${licenseKey}`).toString('base64');

    const req_url = `https://api.rms.rakuten.co.jp/es/2.1/inventories/manage-numbers/${r_item_code}/variants/${r_sku_code}`;

console.log(auth_string);
console.log(req_url);
    // 401の場合を含めて2回トライしてみる
    for(let try_count=0; try_count<2; try_count++) {
        try{
            const res = await axios.get(req_url, {
                responseType: 'json',
                headers: {
                    'Authorization': `ESA ${auth_string}`
                }
            });
 console.log(res.data);
            // 商品画像取得
            result = res.data;
    
            // ここまで来たら正常取得完了
            break;
        }catch(err) {
            if(/401/.test(err.message)) {
                // 認証エラー
                // プリザンターから最新のライセンスキーを取得してみる
                await getRmsAPIInfo_from_pleasanter();
                // 2回目のチャレンジ
                continue;
            }else if (/404/.test(err.message)) {
                // 他のは取れてるかもなので、引き続き実行
                continue;
            }
            throw err;
        }
    
    }

    return result;

});

// 在庫数取得(複数SKU)
ipcMain.handle('get-rakuten-inventories', async (event, r_item_sku_codes, shop_target) => {
    let result = {};


    let postData = {};
    postData.inventories = r_item_sku_codes;

    // 楽天API呼び出し用パラメーター
    const serviceSecret = webapi_keys.webapi[shop_target].serviceSecret;//'SP215297_5sVPn5UuV6Akh7E7'
    const licenseKey = webapi_keys.webapi[shop_target].licenseKey;//'SL215297_gZkFagCVNKiCtBV3' // ３ヶ月ごとに変更あり

    const auth_string = Buffer.from(`${serviceSecret}:${licenseKey}`).toString('base64');

    const req_url = `https://api.rms.rakuten.co.jp/es/2.1/inventories/bulk-get`;

console.log(auth_string);
console.log(req_url);
    // 401の場合を含めて2回トライしてみる
    for(let try_count=0; try_count<2; try_count++) {
        try{
            const res = await axios.post(req_url, postData, {
                responseType: 'json',
                headers: {
                    'Authorization': `ESA ${auth_string}`
                },
            });
 console.log(res.data);
            // 商品画像取得
            // result = res.data;
    
            // 2次元連想配列として在庫数を返却
            res.data.inventories.forEach(item => {
                if (!result[item.manageNumber]) {
                    result[item.manageNumber] = {};
                  }
                  result[item.manageNumber][item.variantId] = item.quantity;
            });

            // ここまで来たら正常取得完了
            break;
        }catch(err) {
            if(/401/.test(err.message)) {
                // 認証エラー
                // プリザンターから最新のライセンスキーを取得してみる
                await getRmsAPIInfo_from_pleasanter();
                // 2回目のチャレンジ
                continue;
            }else if (/404/.test(err.message)) {
                // 他のは取れてるかもなので、引き続き実行
                continue;
            }else if (/429/.test(err.message)) {
                // 同時接続数を超過
                await sleep(500); // 1秒待機
                continue;
            }
            throw err;
        }
    
    }

    return result;

});

// 楽天商品情報部分更新（UPDATE）
ipcMain.handle('update-rakuten-item', async (event, r_item_code, post_data, shop_target) => {
    let result = "NG";

    // 楽天API呼び出し用パラメーター
    const serviceSecret = webapi_keys.webapi[shop_target].serviceSecret;//'SP215297_5sVPn5UuV6Akh7E7'
    const licenseKey = webapi_keys.webapi[shop_target].licenseKey;//'SL215297_gZkFagCVNKiCtBV3' // ３ヶ月ごとに変更あり

    const auth_string = Buffer.from(`${serviceSecret}:${licenseKey}`).toString('base64');

    const req_url = `https://api.rms.rakuten.co.jp/es/2.0/items/manage-numbers/${r_item_code}`;
    // const req_url = `https://api.rms.rakuten.co.jp/es/2.0/items/manage-numbers/aaaa`;

    // 401の場合を含めて2回トライしてみる
    for(let try_count=0; try_count<2; try_count++) {
        try{
            const res = await axios.patch(req_url, post_data, {
                responseType: 'json',
                headers: {
                    'Authorization': `ESA ${auth_string}`
                },
            });
//  console.log("patch res:" + res);
            // 正常実行時は戻り値空
            // 商品画像取得
            result = "OK";
    

            // ここまで来たら正常取得完了
            break;
        }catch(err) {
            if(/401/.test(err.message)) {
                // 認証エラー
                // プリザンターから最新のライセンスキーを取得してみる
                await getRmsAPIInfo_from_pleasanter();
                // 2回目のチャレンジ
                continue;
            }else if (/404/.test(err.message)) {
                // 他のは取れてるかもなので、引き続き実行
                continue;
            }else if (/429/.test(err.message)) {
                // 同時接続数を超過
                await sleep(500); // 1秒待機
                continue;
            }else{
                // エラー発生時、1つ目のエラーを返す
                result = err.response.data.errors[0];
            }
            // throw err;
        }
    
    }
console.log(result)
    return result;

});

// item_edit_renderer.js
// ページ内検索
ipcMain.on('search-in-page', (event, query, options) => {
    itemEditWindow.webContents.findInPage(query, options);
});

ipcMain.on('stop-search-in-page', (event, action) => {
    itemEditWindow.webContents.stopFindInPage(action);
});

// downloader_renderer.js
// 楽天商品画像を取得
ipcMain.handle('get-image', async (event, r_item_code, shop_targets) => {
    let result = new Array();

    // ショップの数だけ回す
    for(let shop_count = 0; shop_count < shop_targets.length; shop_count++) {
        const shop_incode = shop_targets[shop_count];
        // 楽天API呼び出し用パラメーター
        const serviceSecret = webapi_keys.webapi[shop_incode].serviceSecret;//'SP215297_5sVPn5UuV6Akh7E7'
        const licenseKey = webapi_keys.webapi[shop_incode].licenseKey;//'SL215297_gZkFagCVNKiCtBV3' // ３ヶ月ごとに変更あり

console.log(shop_targets[shop_count]);
console.log("serviceSecret:", serviceSecret);

        const auth_string = Buffer.from(`${serviceSecret}:${licenseKey}`).toString('base64');

        const req_url = `https://api.rms.rakuten.co.jp/es/2.0/items/manage-numbers/${r_item_code}`;

        // 401の場合を含めて2回トライしてみる
        for(let try_count=0; try_count<2; try_count++) {
            try{
                const res = await axios.get(req_url, {
                    responseType: 'json',
                    headers: {
                        'Authorization': `ESA ${auth_string}`
                    }
                });
        
                console.log(res);
                // 商品画像取得
                const item_images = res.data.images;
        
                for(let i=0; i<item_images.length; i++) {
                    let img_url = "";
                    if (item_images[i].type === 'CABINET') {
                        img_url = `https://image.rakuten.co.jp/${shop_info[shop_incode].shop_code}/cabinet${item_images[i].location}`;
                    }else if (item_images[i].type === 'GOLD') {
                        img_url = `https://www.rakuten.ne.jp/gold/${shop_info[shop_incode].shop_code}${item_images[i].location}`;
                    }
                    result.push(img_url);
                }
        
                console.log(res.data.variants);
                // ここまで来たら正常取得完了
                break;
            }catch(err) {
                if(/401/.test(err.message)) {
                    // 認証エラー
                    // プリザンターから最新のライセンスキーを取得してみる
                    await getRmsAPIInfo_from_pleasanter();
                    // 2回目のチャレンジ
                    continue;
                }else if (/404/.test(err.message)) {
                    // 他のは取れてるかもなので、引き続き実行
                    continue;
                }else{
                    // エラー発生時、1つ目のエラーを返す
                    result = err.response.data.errors[0];
                }
                // throw err;
            }
        
        }

    }

    return result;

});

// 正常系ダイアログを表示
ipcMain.handle('show-message', (event, type, title, message, detail) => {
    const focusedWindow = BrowserWindow.getFocusedWindow();

    dialog.showMessageBoxSync(focusedWindow, {
        type: type,
        title: title,
        message: message,
        detail: detail
    });
});

// エラーダイアログを表示(alertの代わり)
ipcMain.handle('show-error-message', (event, content) => {
    dialog.showErrorBox('メッセージを確認してください', content);
});

// ショップ情報を取得
ipcMain.handle('get-shop-info', () => {
    return shop_info;
});

// 設定値を取得
ipcMain.handle('get-config', (event, r_item_code) => {
    let results = {};
    let dl_path = store.get('dl_path');
    // 設定がない場合はダウンロードフォルダを設定
    if (dl_path === undefined) {
        dl_path = default_dl_path;
    }else{
        // フォルダが存在しない場合はデフォルトpathに変更
        if (!fs.existsSync(dl_path)) {
            dl_path = default_dl_path;
        }
    }
    results.dl_path = dl_path;

    results.webapi = store.get('webapi');

    return results;
});

// 設定値を保存（ダウンロード先パス）
ipcMain.on('set-config-dl_path', (event, dl_path) => {
    // フォルダが存在しない場合はデフォルトpathに変更
    if (!fs.existsSync(dl_path)) {
        dl_path = default_dl_path;
    }
    store.set('dl_path', dl_path);
});

// フォルダ選択
ipcMain.handle('choose-folder-path', handleFileOpen);


// ダウンロード中断（フラグを立てる）
ipcMain.on('interrupt-download', (event) => {
    download_interrupt_flag = true;
});

// ダウンロード開始
ipcMain.on('start-download', async (event, dl_list, dl_folder_path, is_create_folder) => {
    // フォルダが存在しない場合はエラー
    if (!fs.existsSync(dl_folder_path)) {
        event.sender.send('download-complete', true); // 中断完了
        return;
    }

    const win = BrowserWindow.getFocusedWindow();
    // 中断フラグを落としてからスタート
    download_interrupt_flag = false;

    for (let index = 0; index < dl_list.length; index++) {
        if (download_interrupt_flag) {
            event.sender.send('download-complete', true); // 中断完了
            return;
        }

        const urlString = dl_list[index];

        // URLをパース
        const parsedUrl = url.parse(urlString);

        // パスからファイル名を取得
        const filename = path.basename(parsedUrl.pathname);

        const url_tmp = urlString.replace('https://', '');
        let dirs = url_tmp.split('/');
        console.log(dirs);
        const base_dir = dl_folder_path;
    
        let fullpath_filename = "";
        if (is_create_folder) {
            // フォルダ階層を抜き出して作成
            fullpath_filename = path.join(base_dir, ...dirs);
    console.log(fullpath_filename);
        }else{
            fullpath_filename = path.join(base_dir, filename);
        }
        const target_dir = path.dirname(fullpath_filename);
        // フォルダが存在しない場合は作成
        if (!fs.existsSync(target_dir)) {
            // フォルダ生成
            fs.mkdirSync(target_dir, { recursive: true});
        }

        // すでにそのファイル名でファイルが存在する場合は、
        // ダウンロードしない
        if (fs.existsSync(fullpath_filename)) {
            console.log('exist file path:', fullpath_filename);
            event.sender.send('download-success', urlString, 0);
            continue;
        }

        try {
            event.sender.send('download-start', urlString); // ダウンロード開始
            const dl = await download(win, urlString, {
                directory: target_dir
            });
            // ダウンロード成功(1件)
            console.log('Downloaded:', dl.getSavePath(), dl.getTotalBytes());
            event.sender.send('download-success', urlString, dl.getTotalBytes());
        }catch(err) {
            // const options = {
            //     type: 'info',  // none/info/error/quetion/warning
            //     title: 'タイトル',
            //     message: e.message,
            //     detail: '説明文'
            //   };
            //   dialog.showMessageBoxSync(options);
            console.error('Download error:', urlString, err);
            event.sender.send('download-error', urlString, err);
        }finally {

        }

    }

    // レスポンス返却
    event.sender.send('download-complete', false); // 正常完了
})

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}