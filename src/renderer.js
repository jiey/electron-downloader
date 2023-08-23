// HTML要素を作成する関数
function createHTMLElement(tagName, attributes = {}, textContent = '') {
    const element = document.createElement(tagName); // 指定されたタグ名の要素を作成
    for (let [key, value] of Object.entries(attributes)) {
        element.setAttribute(key, value); // 属性を設定
    }
    element.textContent = textContent; // テキストコンテンツを設定
    return element;
}

// const dl_target = document.querySelector('textarea#dl_target');
// // ダウンロードURLを貼り付けたら、ダウンロード対象欄へリアルタイム表示
// dl_target.addEventListener("input", () => {
//     const dl_target_val = document.querySelector('textarea#dl_target').value;
//     // スペース区切りまたは改行区切りに対応する(ただし空文字とhttp以外は対象外)
//     const dl_targets = dl_target_val.split(/\n| /).filter(target => target.trim() !== "" && target.trim().startsWith("http"));

//     // <div class="download_info">
//     //     <div class="url">https://image.rakuten.co.jp/bellevie-harima/cabinet/aaa.jpg</div>
//     //     <div class="progress-bar">
//     //         <div class="progress"></div>
//     //     </div>
//     // </div>
//     const dummy_nodes = document.createDocumentFragment();
//     const div_download_info = createHTMLElement('div', {class: 'download_info'});
//     const div_url = createHTMLElement('div', {class: 'url'}, "");
//     const div_progress_bar = createHTMLElement('div', {class: 'progress-bar'});
//     const div_progress = createHTMLElement('div', {class: 'progress'});
//     div_progress_bar.appendChild(div_progress);
//     div_download_info.appendChild(div_url);
//     div_download_info.appendChild(div_progress_bar);
//     dummy_nodes.appendChild(div_download_info);

//     const waiting_zone = document.querySelector('#waiting_zone');
//     waiting_zone.innerHTML = ''; // いったん削除
//     // ダウンロード待ちリストへ
//     for (let index = 0; index < dl_targets.length; index++) {
//         if (dl_targets[index] !== '') {
//             const clone = dummy_nodes.cloneNode(true);
//             clone.querySelector('.url').textContent = dl_targets[index];
//             waiting_zone.appendChild(clone);
//         }
//     }
// });

// ステータス文言表示
const status_area = document.querySelector('#status');

// プログレスバー更新
const progress_bar = document.querySelector('#progress-bar');
const all_percent = document.querySelector('#all_percent');
function progress_bar_update(count, total) {
    const percentage = Math.ceil((count / total) * 100);
    progress_bar.style.width = `${percentage}%`;
    all_percent.textContent = `${percentage}% (${count} / ${total})`;
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
        const dl_target_val = document.querySelector('textarea#dl_target').value;
        // スペース区切りまたは改行区切りに対応する(ただし空文字とhttp以外は対象外)
        const dl_targets = dl_target_val.split(/\n| /).filter(target => target.trim() !== "" && target.trim().startsWith("http"));
        dl_targets_total = dl_targets.length;

        // 各種初期化
        dl_count = 0;
        success_box.value = ""
        error_box.value = ""
    
        // ダウンロードボタンを中断に変更する
        dl_button.textContent = "ダウンロード中断";
    
        // ダウンロード開始
        window.electronAPI.startDownload(dl_targets);
    }
})

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
