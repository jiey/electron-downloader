window.addEventListener('DOMContentLoaded', async () => {


    async function getConfig() {
        // 設定を取得
        let config;
        try {
            config = await window.electronAPI.getConfigMain();
        }catch(e) {
            alert(e.message);
        }
        return config;
    }

    // 設定を取得
    const config = await getConfig();

    // ダウンロード先フォルダ設定
    const dl_path = document.querySelector('input#dl_path');
    dl_path.value = config.dl_path;
    dl_path.addEventListener('change', () => {
        const choosed_dl_path = dl_path.value;
        // 設定を保存
        window.electronAPI.setConfig_dl_path(choosed_dl_path);
    });

    // フォルダ参照ボタン押下
    const dl_path_btn = document.querySelector('button#dl_path_btn');
    dl_path_btn.addEventListener('click', async () => {
        const choosed_dl_path = await window.electronAPI.chooseFolderPath();
        if (choosed_dl_path !== null) {
            dl_path.value = choosed_dl_path;
            // 設定を保存
            window.electronAPI.setConfig_dl_path(choosed_dl_path);
        }
    });


    const dl_target = document.querySelector('textarea#dl_target');
    // ダウンロードURLを貼り付けたら、ダウンロード対象欄へリアルタイム表示
    dl_target.addEventListener("change", () => {
        const dl_target_val = document.querySelector('textarea#dl_target').value;
        // スペース区切りまたは改行区切りに対応する(ただし空文字とhttp以外は対象外)
        const dl_targets = dl_target_val.split(/\n| /).filter(target => target.trim() !== "" && target.trim().startsWith("http"));

        // 重複URLを削除
        const set = new Set(dl_targets); // Setに入れて
        const new_dl_targets = [...set]; // 配列に戻すだけで重複削除される

        console.log("重複削除");
        console.log(dl_targets.length);
        console.log(new_dl_targets.length);

        // 改行区切りにしてテキストエリアに戻す
        dl_target.value = new_dl_targets.join('\n');

    });

    // ステータス文言表示
    const status_area = document.querySelector('#status');

    // プログレスバー更新
    const progress_bar = document.querySelector('#progress-bar');
    const all_percent = document.querySelector('#all_percent');
    function progress_bar_update(count, total) {
        progress_bar.classList.add('moving');
        const percentage = Math.ceil((count / total) * 100);
        progress_bar.style.width = `${percentage}%`;
        all_percent.textContent = `${percentage}% (${count} / ${total})`;
    }

    function progress_bar_reset() {
        progress_bar.classList.remove('moving');
        progress_bar.style.width = `0%`;
    }

    // ダウンロードボタンクリック
    const dl_button = document.querySelector('#dl_button');
    const success_box = document.querySelector('#success_box');
    const error_box = document.querySelector('#error_box');
    let dl_targets_total = 0;
    let dl_count = 0;
    dl_button.addEventListener("click", () => {
        if (dl_button.textContent === 'ダウンロード中断') {
            // ダウンロード中断フラグを立てる
            window.electronAPI.interruptDownload();
        }else if(dl_button.textContent === 'ダウンロード開始') {
            progress_bar_reset();
            const dl_target_val = document.querySelector('textarea#dl_target').value;
            // スペース区切りまたは改行区切りに対応する(ただし空文字とhttp以外は対象外)
            const dl_targets = dl_target_val.split(/\n| /).filter(target => target.trim() !== "" && target.trim().startsWith("http"));
            dl_targets_total = dl_targets.length;

            // 各種初期化
            dl_count = 0;
            success_box.value = "";
            error_box.value = "";


            // ダウンロード先フォルダ取得
            const dl_folder_path = dl_path.value;
            console.log(dl_folder_path);

            // フォルダ分けするかどうか
            is_create_folder_obj = document.querySelector('#is_create_folder');
            if (is_create_folder_obj.checked) {
                is_create_folder = true;
            }else{
                is_create_folder = false;
            }

            // ダウンロードボタンを中断に変更する
            dl_button.textContent = "ダウンロード中断";
        
            // ダウンロード開始
            window.electronAPI.startDownload(dl_targets, dl_folder_path, is_create_folder);
        }
    })

    // 汎用エラー発生通知
    window.electronAPI.on('something_notify', (event, url)=>{
        console.log("something error" + url);
        alert(`エラー発生：${url}`);
    });

        // 認証エラー発生通知
    window.electronAPI.on('auth_error', (event, url)=>{
        console.log("auth_error" + url);
        status_area.textContent = `認証エラー発生：${url}`;
    });

    // 1件ダウンロード開始
    window.electronAPI.on('download-start', (event, url)=>{
        console.log("download-start" + url);
        status_area.textContent = `ダウンロード中：${url}`;
    });

        // 1件ダウンロード成功
    window.electronAPI.on('download-success', (event, url, total_bytes)=>{
        console.log("download-success" + url + ":" + total_bytes);
        success_box.value += url + "\n";
        // プログレスバー更新
        progress_bar_update(++dl_count, dl_targets_total);
    });

    // 1件ダウンロード失敗
    window.electronAPI.on('download-error', (event, url, err)=>{
        console.log("download-error:" + err + ":" + url);
        error_box.value += url + "\n";
        // プログレスバー更新
        progress_bar_update(++dl_count, dl_targets_total);
    });

    // すべてのダウンロード処理が終了
    window.electronAPI.on('download-complete', (event, download_interrupt_flag)=>{
        if (download_interrupt_flag) {
            console.log("download-complete:中断");
            status_area.textContent = `全体の状況：ダウンロードを中断しました`;
        }else{
            console.log("download-complete:正常");
            status_area.textContent = `全体の状況：ダウンロード待機中`;
        }
        dl_button.textContent = "ダウンロード開始";
    });

    // 楽天画像取得ボタン押下
    const r_image_get = document.querySelector('button#r_image_get');
    const r_item_code_obj = document.querySelector('textarea#r_item_code');
    r_image_get.addEventListener('click', async () => {
        let r_item_codes = r_item_code_obj.value;

        // 改行ごとに商品管理番号が入っている
        // スペース区切りまたは改行区切りに対応する(ただし空文字は対象外)
        const dl_item_codes = r_item_codes.split(/\n| /).filter(target => target.trim() !== "");

        // 重複URLを削除
        const set = new Set(dl_item_codes); // Setに入れて
        const new_dl_item_codes = [...set]; // 配列に戻すだけで重複削除される 

        // ダウンロード対象データを取得
        const item_kinds = Array.from(document.querySelectorAll('[name="item_kind"]:checked')).map(item_kind => item_kind.value);

        // 対象モールを取得
        const shop_targets = new Array();
        const item_targets = document.querySelectorAll('[name="item_target"]:checked');
        for (const item_target of item_targets) {
            const shop_target = item_target.value;
            shop_targets.push(shop_target);
        }

        if (shop_targets.length == 0) {
            return;
        }

        let image_get_status_obj = document.querySelector('#image_get_status');
        // ステータスを更新
        const status = "画像URLをAPIで取得中...";

        let img_urls = "";
        for(let i=0; i<new_dl_item_codes.length; i++) {
            let r_item_code = new_dl_item_codes[i];
            // ステータスを更新
            image_get_status_obj.textContent = `${status}（${new_dl_item_codes.length - i}）`;

            r_item_code = r_item_code.trim(); // 前後の空白があれば削除
            if (r_item_code === '') continue;
    
            // 商品画像取得
            try {
                const item_images = await window.electronAPI.getImage(r_item_code, shop_targets, item_kinds);
                // 改行区切りにしてテキストエリアに戻す
                img_urls += item_images.join('\n');
                img_urls += "\n";
            }catch(err) {
    console.log(err);
                if (/404/.test(err.message)) {
                    alert('その商品は見つかりませんでした：' + r_item_code);
                }else if (/429/.test(err.message)) {
                    // 多重接続エラー
                    alert('接続大杉：' + r_item_code);
                }else{
                    alert('その他エラーが発生しました：' + err.code);
                }
            }
            dl_target.value = img_urls;

        }
        // ステータスを更新
        image_get_status_obj.textContent = "取得完了しました";

    });


});