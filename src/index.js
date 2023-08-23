// アプリケーション作成用のモジュールを読み込み
const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const { autoUpdater } = require('electron-updater');
const {download} = require('electron-dl');
const path = require('path');
const fs = require('fs');
require('update-electron-app')()

// メインウィンドウ
let mainWindow;
let download_interrupt_flag = false; // ダウンロード中止

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

  // デベロッパーツールの起動
  mainWindow.webContents.openDevTools();

  // メインウィンドウが閉じられたときの処理
  mainWindow.on("closed", () => {
    mainWindow = null;
  });
};

//  初期化が完了した時の処理
app.whenReady().then(() => {
  createWindow();
  autoUpdater.checkForUpdatesAndNotify();

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


// API ---------------
// ダウンロード中断（フラグを立てる）
ipcMain.on('interrupt-download', (event) => {
    download_interrupt_flag = true;
});

// ダウンロード開始
ipcMain.on('start-download', async (event, dl_list) => {
    const win = BrowserWindow.getFocusedWindow();
    // 中断フラグを落としてからスタート
    download_interrupt_flag = false;

    for (let index = 0; index < dl_list.length; index++) {
        if (download_interrupt_flag) {
            event.sender.send('download-complete', true); // 中断完了
            return;
        }

        const url = dl_list[index];

        // フォルダ階層を抜き出して作成
        const url_tmp = url.replace('https://', '');
        let dirs = url_tmp.split('/');
console.log(dirs);
        const base_dir = app.getPath('downloads'); // app.getPath('documents')にする？
        const fullpath_filename = path.join(base_dir, ...dirs);
console.log(fullpath_filename);
        const target_dir = path.dirname(fullpath_filename);
        if (!fs.existsSync(target_dir)) {
            // フォルダ生成
            fs.mkdirSync(target_dir, { recursive: true});
        }
        // ファイル名
        const filename = path.basename(fullpath_filename);

        try {
            event.sender.send('download-start', url); // ダウンロード開始
            const dl = await download(win, url, {
                directory: target_dir
            });
            // ダウンロード成功(1件)
            console.log('Downloaded:', dl.getSavePath(), dl.getTotalBytes());
            event.sender.send('download-success', url, dl.getTotalBytes());
        }catch(err) {
            // const options = {
            //     type: 'info',  // none/info/error/quetion/warning
            //     title: 'タイトル',
            //     message: e.message,
            //     detail: '説明文'
            //   };
            //   dialog.showMessageBoxSync(options);
            console.error('Download error:', url, err);
            event.sender.send('download-error', url, err);
        }finally {

        }

    }

    // レスポンス返却
    event.sender.send('download-complete', false); // 正常完了
})

autoUpdater.on('update-available', () => {
    mainWindow.webContents.send('update_available');
});

autoUpdater.on('update-downloaded', () => {
    mainWindow.webContents.send('update_downloaded');
});

ipcMain.on('restart_app', () => {
    autoUpdater.quitAndInstall();
});