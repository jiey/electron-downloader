// プレビューウィンドウを表示
function openPreview(name) {
    const inputHTML = document.querySelector(`[name=${name}]`).value;
    window.electronAPI.openPreview(inputHTML);
}

window.addEventListener('DOMContentLoaded', async () => {
    // ショップ情報を取得
    const shop_info = await window.electronAPI.getShopInfo();
    console.log(shop_info);

    // グローバル変数
    let g_shop_targets;
    let g_param_target;
    let g_search_word;
    let g_sort_key;
    let g_sort_order;
    let g_page;
    let g_num_found = 0; // 検索で見つかった全体の個数

    // グローバル変数(ポップアップ)
    let g_item_code;

    // 第1引数の文字バイト数と第2引数の文字(255byteの場合、255)を繋げて返す関数
    // 例：◯◯ / 255byte
    function showByteSize(str, max_size) {
        if (str === undefined) {
            return "";
        }
        const byte_size = getByteSize(str);
        const remain = max_size - byte_size;
        return `${byte_size} / ${max_size}byte(あと${remain}byte)`;
    }

    // テキストのバイトサイズを返す関数
    function getByteSize(str) {
        let byteSize = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charAt(i);
            if (char === ' ') { // 半角スペースの場合
                byteSize += 1;
            } else if (encodeURI(char).length > 2) {
                byteSize += 2;  // 日本語などのマルチバイト文字
            } else {
                byteSize += 1;  // 英数字や記号など
            }
        }
        return byteSize;
    }

    // SKU管理番号のソート
    function customSort(a, b) {
        let pattern = /([a-zA-Z-]+)(\d+)([a-zA-Z-]*)$/;
        let matchA = a.match(pattern);
        let matchB = b.match(pattern);
    
        if (!matchA || !matchB) {
            // 正規表現にマッチしない場合は通常の比較を行う
            return a.localeCompare(b);
        }
    
        let prefixA = matchA[1];
        let numberA = parseInt(matchA[2], 10);
        let suffixA = matchA[3];
    
        let prefixB = matchB[1];
        let numberB = parseInt(matchB[2], 10);
        let suffixB = matchB[3];
    
        // 接頭辞が異なる場合は、接頭辞で比較
        if (prefixA !== prefixB) {
            return prefixA.localeCompare(prefixB);
        }
    
        // 接頭辞が同じ場合、数値で比較
        if (numberA !== numberB) {
            return numberA - numberB;
        }
    
        // 数値も同じ場合は、残りの部分を辞書順で比較
        return suffixA.localeCompare(suffixB);
    }
    

    // 商品一覧を描画
    async function search_rakuten_items_inner(param_target, search_word, sort_key, sort_order, page, shop_targets) {
        let debug_trace = "";
        try {
            offset = (page - 1) * 30; // pageは1オリジン
            debug_trace = "API:searchRakutenItems()";
            const items = await window.electronAPI.searchRakutenItems(param_target, search_word, sort_key, sort_order, offset, shop_targets);
            // 改行区切りにしてテキストエリアに戻す
            console.log(items);

            // fragmentは目に見えないDOMのこと。そうすることでDOM構築描画回数を減らす
            const fragment = document.createDocumentFragment();
                
            // ショップ数分ループ(1つしかないが)
            for(let shop_code_inner in items) {

                const item_wrap = items[shop_code_inner];
                g_num_found = item_wrap.numFound;

                if (g_num_found == 0) {
                    window.electronAPI.showAlert(`指定の商品は見つかりませんでした`);
                    return;
                }

                const table = window.renderAPI.createHTMLElement("table");

                // ヘッダー項目を作成
                const tr_header = window.renderAPI.createHTMLElement("tr", {id: 'item_edit_table_header'});
                const th_header_edit = window.renderAPI.createHTMLElement("th", {}, '編集');
                const th_header_item_code = window.renderAPI.createHTMLElement("th", {}, '管理番号');
                const th_header_item_image = window.renderAPI.createHTMLElement("th", {}, '商品画像');
                const th_header_title = window.renderAPI.createHTMLElement("th", {}, '商品情報');
                const th_header_review = window.renderAPI.createHTMLElement("th", {}, 'レビュー');

                tr_header.appendChild(th_header_edit);
                tr_header.appendChild(th_header_item_code);
                tr_header.appendChild(th_header_item_image);
                tr_header.appendChild(th_header_title);
                tr_header.appendChild(th_header_review);
                table.appendChild(tr_header);

                // 先に在庫数を取得（性能改善）
                const item_sku_list = new Array();
                for(let i = 0; i<item_wrap.results.length; i++) {
                    const item = item_wrap.results[i].item;
                    const manageNumber = item.manageNumber;
                    const sku_codes = Object.keys(item.variants);

                    const param = sku_codes.map(key => {
                        return {
                            manageNumber: manageNumber,
                            variantId: key
                        };
                    });
                    item_sku_list.push(...param);
                }
                // 固定品番、SKU管理番号一覧、ショップコード（内部）で在庫を一括取得
                debug_trace = "API:getRakutenInventories()";
                const inventory = await window.electronAPI.getRakutenInventories(item_sku_list, shop_code_inner);
                console.log(inventory);

                // 各項目の表示
                for(let i = 0; i<item_wrap.results.length; i++) {
                    const item = item_wrap.results[i].item;
                    let item_code = item.manageNumber;
                    // console.log(item);
                    const review = item_wrap.results[i].review;

                    // 各項目を設定
                    let tr_class = 'wrap_1line';
                    // 倉庫の場合は背景をグレー表示
                    if (item.hideItem === true) {
                        tr_class = 'wrap_1line_gray';
                    }
                    const tr_wrap_1line = window.renderAPI.createHTMLElement("tr", {class: tr_class});

                    // 編集
                    const td_edit = window.renderAPI.createHTMLElement("td", {class: 'no_wrap rms_edit'});
                    const a_edit = window.renderAPI.createHTMLElement("a", {href: `item_code=${item_code}&shop_code=${shop_code_inner}`}, "編集");
                    td_edit.appendChild(a_edit);
                    // 商品管理番号
                    const td_item_code = window.renderAPI.createHTMLElement("td", {}, item_code);
                    const div_item_code_cmd = window.renderAPI.createHTMLElement("div", {class: 'virtical_cmd'}, );
                    // 商品管理番号コピー
                    const button_copy = window.renderAPI.createHTMLElement('a', {href: '#', class: 'button small', target: '_blank', title: '商品管理番号をクリップボードにコピー'}, 'コピー');
                    button_copy.addEventListener('click', (e) => {
                        e.preventDefault();
                        window.electronAPI.copyToClipboard(item_code);
                    });
                    div_item_code_cmd.appendChild(button_copy);

                    // RMSリンク
                    const rms_url = window.renderAPI.makeRakutenRMSURL(item_code, shop_info[shop_code_inner].shop_id);
                    const button_link_rms_page = window.renderAPI.createHTMLElement('a', {href: rms_url, class: 'button small', target: '_blank', title: 'RMSの編集画面をブラウザで表示'}, 'RMS編集');
                    div_item_code_cmd.appendChild(button_link_rms_page);

                    // 通販する蔵リンク
                    const suruzo_url = window.renderAPI.makeSuruzoItemSearchURL(item_code, shop_info[shop_code_inner].shop_code);
                    const button_link_suruzo_page = window.renderAPI.createHTMLElement('a', {href: suruzo_url, class: 'button small', target: '_blank', title: '通販する蔵の商品マスターをブラウザで表示'}, 'する蔵');
                    div_item_code_cmd.appendChild(button_link_suruzo_page);

                    td_item_code.appendChild(div_item_code_cmd);

                    // 商品画像1
                    let img1_url = "";
                    if (item.images !== undefined) {
                        img1_url = window.renderAPI.convertRakutenImageURL(item.images[0], shop_info[shop_code_inner].shop_code);
                    }
                    const td_item_image1 = window.renderAPI.createHTMLElement("td");
                    const img = window.renderAPI.createHTMLElement("img", {src: img1_url, class: 'item_image'});
                    td_item_image1.appendChild(img);

                    // キャッチコピー
                    const div_catchcopy = window.renderAPI.createHTMLElement("div", {class: 'gray small'}, item.tagline);

                    // 商品名
                    const item_url = window.renderAPI.makeRakutenItemURL(item_code, shop_info[shop_code_inner].shop_code, item.hideItem);
                    const td_item_title = window.renderAPI.createHTMLElement("td");
                    const div_item_wrap = window.renderAPI.createHTMLElement("div");
                    const a_item_title = window.renderAPI.createHTMLElement("a", {href: item_url, target: '_blank'}, item.title);
                    
                    div_item_wrap.appendChild(div_catchcopy);
                    div_item_wrap.appendChild(a_item_title);

                    // ポイント
                    if (item.pointCampaign !== undefined) {
                        const div_point_wrap = window.renderAPI.createHTMLElement("div", {class: 'point_wrap'});
                        let div_point_header = window.renderAPI.createHTMLElement("div", {class: 'header'}, 'ポイント');
                        div_point_wrap.appendChild(div_point_header);
                        div_point_header = window.renderAPI.createHTMLElement("div", {class: 'header'}, '開始');
                        div_point_wrap.appendChild(div_point_header);
                        div_point_header = window.renderAPI.createHTMLElement("div", {class: 'header'}, '終了');
                        div_point_wrap.appendChild(div_point_header);                        

                        const div_point_rate = window.renderAPI.createHTMLElement("div", {}, `${item.pointCampaign.benefits.pointRate}倍`);
                        const period_start = window.renderAPI.formatDateTime(item.pointCampaign.applicablePeriod.start, 'YYYY/MM/DD(ddd) HH:mm');
                        const period_end = window.renderAPI.formatDateTime(item.pointCampaign.applicablePeriod.end, 'YYYY/MM/DD(ddd) HH:mm');
                        const div_point_period_start = window.renderAPI.createHTMLElement("div", {}, period_start);
                        const div_point_period_end = window.renderAPI.createHTMLElement("div", {}, period_end);

                        div_point_wrap.appendChild(div_point_rate);
                        div_point_wrap.appendChild(div_point_period_start);
                        div_point_wrap.appendChild(div_point_period_end);
                        div_item_wrap.appendChild(div_point_wrap);
                    }

                    td_item_title.appendChild(div_item_wrap);

                    // SKU単位の情報
                    let is_variation = false;
                    let axis_count = 0; // 軸数
                    if (Object.keys(item.variants).length > 1) {
                        // バリエーション商品
                        is_variation = true;
                        axis_count = item.variantSelectors.length
                    }

                    const div_sku_top_wrap = window.renderAPI.createHTMLElement("div", {class: 'sku_wrap'});
                    if (is_variation === false) {
                        let div_sku_header = window.renderAPI.createHTMLElement("div", {class: 'header'}, 'SKU管理番号');
                        div_sku_top_wrap.appendChild(div_sku_header);
                        div_sku_header = window.renderAPI.createHTMLElement("div", {class: 'header'}, '販売価格');
                        div_sku_top_wrap.appendChild(div_sku_header);
                        div_sku_header = window.renderAPI.createHTMLElement("div", {class: 'header'}, '在庫数');
                        div_sku_top_wrap.appendChild(div_sku_header);
                        div_sku_top_wrap.style.gridTemplateColumns = `repeat(3, 1fr)`;
                    }else{
                        let div_sku_header = window.renderAPI.createHTMLElement("div", {class: 'header'}, 'SKU管理番号');
                        div_sku_top_wrap.appendChild(div_sku_header);
                        for(let axis_num = 1; axis_num <= axis_count; axis_num++) {
                            div_sku_header = window.renderAPI.createHTMLElement("div", {class: 'header'}, `SKU情報${axis_num}`);
                            div_sku_top_wrap.appendChild(div_sku_header);
                        }

                        div_sku_header = window.renderAPI.createHTMLElement("div", {class: 'header'}, 'SKU画像');
                        div_sku_top_wrap.appendChild(div_sku_header);
                        div_sku_header = window.renderAPI.createHTMLElement("div", {class: 'header'}, '販売価格');
                        div_sku_top_wrap.appendChild(div_sku_header);
                        div_sku_header = window.renderAPI.createHTMLElement("div", {class: 'header'}, '在庫数');
                        div_sku_top_wrap.appendChild(div_sku_header);

                        div_sku_top_wrap.style.gridTemplateColumns = `repeat(${4 + axis_count}, 1fr)`;
                    }

                    // for(let [sku_code, sku_info] of Object.entries(item.variants)) {
                    // for(let [sku_code, sku_info] of Object.entries(item.variants).sort((a, b) => { return a[0].localeCompare(b[0])})) {
                        let sortedVariants = Object.entries(item.variants).sort((a, b) => customSort(a[0], b[0]));
                        for (let [sku_code, sku_info] of sortedVariants) {
                        // console.log(sku_code);
                        // console.log(sku_info);
                        // 在庫数を取得

                        // SKU管理番号
                        const div_sku_code_wrap = window.renderAPI.createHTMLElement("div");
                        const div_sku_code = window.renderAPI.createHTMLElement("div", {}, sku_code);
                        const div_sku_merchantDefinedSkuId = window.renderAPI.createHTMLElement("div", {class: 'gray'}, sku_info.merchantDefinedSkuId);
                        div_sku_code_wrap.appendChild(div_sku_code);
                        div_sku_code_wrap.appendChild(div_sku_merchantDefinedSkuId);
                        div_sku_top_wrap.appendChild(div_sku_code_wrap);

                        if (is_variation === false) {
                            // 単品商品のSKU

                            // SKU画像(単品商品の場合は、SKU画像は存在しないはず)

                            // 価格
                            const div_sku_price = window.renderAPI.createHTMLElement("div", {class: 'no_wrap'}, `${sku_info.standardPrice}円`);

                            div_sku_top_wrap.appendChild(div_sku_price);

                        }else{
                            // バリエーション商品のSKU

                            for(let var_count=0; var_count<axis_count; var_count++) {
                                const var_key = item.variantSelectors[var_count].key;
                                const var_name = item.variantSelectors[var_count].displayName;
                                const var_val = sku_info.selectorValues[var_key];
                                // SKU名称
                                const div_sku_name = window.renderAPI.createHTMLElement("div", {class: 'no_wrap'}, `${var_name}:${var_val}`);
                                div_sku_top_wrap.appendChild(div_sku_name);
                            }
                            // for(let [variation_key, variation_name] of Object.entries(sku_info.selectorValues)) {
                            //     // SKU名称
                            //     const td_sku_name = window.renderAPI.createHTMLElement("td", {class: 'no_wrap'}, `${variation_key}:${variation_name}`);
                            //     div_sku_top_wrap.appendChild(td_sku_name);
                            // }

                            // SKU画像
                            const div_sku_image = window.renderAPI.createHTMLElement("div");
                            if (sku_info.images !== undefined) {
                                const sku_image = window.renderAPI.convertRakutenImageURL(sku_info.images[0], shop_info[shop_code_inner].shop_code);
                                const img_sku = window.renderAPI.createHTMLElement("img", {src: sku_image, class: 'sku_image'});
                                div_sku_image.appendChild(img_sku);
                            }
                            // 価格
                            const div_sku_price = window.renderAPI.createHTMLElement("div", {class: 'no_wrap'}, `${sku_info.standardPrice}円`);

                            div_sku_top_wrap.appendChild(div_sku_image);
                            div_sku_top_wrap.appendChild(div_sku_price);
                        }
                        // 在庫数
                        let invent = inventory[item_code][sku_code];
                        if (invent == 0) {
                            invent += '★';
                        }
                        const div_sku_inventory = window.renderAPI.createHTMLElement("div", {}, invent);
                        div_sku_top_wrap.appendChild(div_sku_inventory);
                    }
                    td_item_title.appendChild(div_sku_top_wrap);

                    // レビュー
                    let review_text = "";
                    if (review.count > 0) {
                        review_text = `${review.averageRating} (${review.count}件)`;
                    }
                    const td_review = window.renderAPI.createHTMLElement("td", {class: 'no_wrap'}, review_text);

                    // trの子どもに設定
                    tr_wrap_1line.appendChild(td_edit);
                    tr_wrap_1line.appendChild(td_item_code);
                    tr_wrap_1line.appendChild(td_item_image1);
                    tr_wrap_1line.appendChild(td_item_title);
                    tr_wrap_1line.appendChild(td_review);

                    table.appendChild(tr_wrap_1line);
                }

        
                fragment.appendChild(table);
            }

            // いったん、前回のデータを削除
            const root = document.querySelector('#item_edit_wrap');
            while( root.firstChild ){
                root.removeChild( root.firstChild );
            }
            
            root.appendChild(fragment);

            // ページネーション表示

            // トータルページ数を算出
            const max_page = parseInt((g_num_found / 30) + 1);

            // fragmentは目に見えないDOMのこと。そうすることでDOM構築描画回数を減らす
            const pg_fragment = document.createDocumentFragment();

            // 前へを表示
            const page_prev = (page - 1) >= 1 ? page - 1 : 1;
            const li_prev = window.renderAPI.createHTMLElement("li");
            const a_prev = window.renderAPI.createHTMLElement("a", {class: "prev", href: `page=${page_prev}`}, "前へ");
            li_prev.appendChild(a_prev);
            pg_fragment.appendChild(li_prev);

            let is_show_min = true; // 一番小さいページ数を表示するか？
            let is_show_max = true; // 一番大きいページ数を表示するか？
            let init_p = 0;
            let than_p = 0;
            let compute = max_page < 5 ? max_page : 4;
            if (max_page < 5) {
                init_p = 1;
                than_p = max_page;
                is_show_min = false;
                is_show_max = false;
            }else{
                if(page > max_page - 4) {
                    // ラスト4ページ
                    init_p = max_page - 4;
                    than_p = max_page;
                    is_show_max = false;
                }else if (page >= 4) {
                    // 中間ページ
                    init_p = page - 2;
                    than_p = page + 2;
                }else{
                    // 1～4ページ時
                    init_p = 1;
                    than_p = 5;
                    is_show_min = false;
                }
            }

            // 一番小さいページ
            if (is_show_min) {
                const li_min = window.renderAPI.createHTMLElement("li");
                const a_min = window.renderAPI.createHTMLElement("a", {href: `page=1`}, 1);
                li_min.appendChild(a_min);
                pg_fragment.appendChild(li_min);
            }

            for(let p=init_p; p<=than_p; p++) {
                let li_pg = window.renderAPI.createHTMLElement("li");
                let pg;
                if (p == page) {
                    pg = window.renderAPI.createHTMLElement("span", {"aria-current": "page"}, p);
                }else{
                    pg = window.renderAPI.createHTMLElement("a", {href: `page=${p}`}, p);
                }
                li_pg.appendChild(pg);
                pg_fragment.appendChild(li_pg);
            }

            // 一番大きいページ
            if (is_show_max) {
                const li_max = window.renderAPI.createHTMLElement("li");
                const a_max = window.renderAPI.createHTMLElement("a", {href: `page=${max_page}`}, max_page);
                li_max.appendChild(a_max);
                pg_fragment.appendChild(li_max);
            }

            // 次へを表示
            const page_next = (page + 1) < max_page ? page + 1 : max_page;
            const li_next = window.renderAPI.createHTMLElement("li");
            const a_next = window.renderAPI.createHTMLElement("a", {class: "next", href: `page=${page_next}`}, "次へ");
            li_next.appendChild(a_next);

            pg_fragment.appendChild(li_next);

            // いったん、前回のデータを削除
            const pg_root = document.querySelectorAll('.pagination');
            pg_root.forEach(pgr => {
                while( pgr.firstChild ){
                    pgr.removeChild( pgr.firstChild );
                }
                pgr.appendChild(pg_fragment.cloneNode(true));
            });

            // グローバル変数に格納
            g_shop_targets = shop_targets;
            g_param_target = param_target;
            g_search_word = search_word;
            g_sort_key = sort_key;
            g_sort_order = sort_order;
            g_page = 0;


        }catch(err) {
console.log(err);
            if (/404/.test(err.message)) {
                window.electronAPI.showAlert(`${debug_trace}実行エラー：指定の商品が見つかりませんでした`);
            }else{
                window.electronAPI.showAlert(`${debug_trace}実行エラー：エラーが発生しました：${err}`);
            }
        }
    }

    // ページネーションリンク押下時
    // const pagination_a = document.querySelectorAll('.pagination a');
    // pagination_a.forEach(link => {
    //     link.addEventListener('click', (event) => {
    //         event.preventDefault(); // 通常のリンククリック動作を停止

    //         // ページを取得
    //         const href_value = link.getAttribute('href');
    //         const match = href_value.match(/page=(\d+)/);
    //         if (match && match[1]) {
    //             const page_number = parseInt(match[1], 10);
    //             search_rakuten_items_inner(g_param_target, g_search_word, g_sort_key, g_sort_order, page_number, g_shop_targets);
    //         }
    //     });
    // });

    // 親要素またはそれ以上の要素に対してイベントリスナーを設定
    const paginations = document.querySelectorAll('.pagination');
    paginations.forEach(pagination => {
        pagination.addEventListener('click', (event) => {
            // クリックされた要素が<a>タグである場合のみ処理を実行
            if (event.target.tagName === 'A') {
                event.preventDefault();
    
                // ページを取得
                const href_value = event.target.getAttribute('href');
                const match = href_value.match(/page=(\d+)/);
                if (match && match[1]) {
                    const page_number = parseInt(match[1], 10);
                    // 情報を取得して描画する
                    search_rakuten_items_inner(g_param_target, g_search_word, g_sort_key, g_sort_order, page_number, g_shop_targets);
                    // 一番上にスクロールを持ってくる
                    window.scrollTo(0, 0);
                }
            }
        });
    });

    const item_edit_wrap = document.querySelector('#item_edit_wrap');
    item_edit_wrap.addEventListener('click', (event) => {
        // クリックされた要素が<a>タグである場合のみ処理を実行
        if (event.target.text === '編集') {
            event.preventDefault();

            // ページを取得
            const href_value = event.target.getAttribute('href');
            const match = href_value.match(/item_code=([a-zA-Z0-9-_]+)&shop_code=([a-zA-Z0-9-_]+)/);
            if (match && match[1] && match[2]) {
                const item_code = match[1];
                const shop_code = match[2];
                // 情報を取得して描画する(ポップアップ表示)
                show_rms_edit_popup(item_code, shop_code);
            }
        }
    });

    const modal_content = document.querySelector('.modal-content');
    modal_content.addEventListener('click', async (event) => {
        if (event.target.tagName === 'BUTTON') {
            if (event.target.textContent === '変更をRMSに反映') {
                const shop_code = event.target.getAttribute('shop_code');
                console.log(shop_code);
                // SKU管理番号を取得(スペース区切り)
                const sku_codes = event.target.getAttribute('sku_codes').split(' ');
                console.log(sku_codes);

                const edit_forms = document.querySelectorAll(`[name*=${shop_code}]`);

                let post_data = {};
                post_data.productDescription = {};
                post_data.variants = {};
                post_data.images = [];
                for (let sku_code of sku_codes) {
                    post_data.variants[sku_code] = {};
                }

                edit_forms.forEach(editor => {
                    let name = editor.getAttribute('name');
                    // 先頭の「ショップコード_」部分を削除
                    name = name.replace(`${shop_code}_`, '');
                    // 商品画像達（image1など）はimageに丸める
                    if (/image\d{1,2}/.test(name)) {
                        name = 'image';
                    }

                    // SKUごとに異なる場合は更新しない（T.B.D)
                    if (editor.value === 'SKUごとに異なる') {
                        return;
                    }

                    switch(name) {
                        case 'title': // 商品名
                            post_data.title = editor.value;
                            break;
                        case 'souko_flag': // 倉庫フラグ
                            if (editor.checked) {
                                if (editor.value === '1') {
                                    // 倉庫
                                    post_data.hideItem = true;
                                }else{
                                    // 販売中
                                    post_data.hideItem = false;
                                }
                            }
                            break;
                        case 'productdesc_pc': // 商品説明文(PC)
                            post_data.productDescription.pc = editor.value;
                            break;
                        case 'productdesc_sp': // 商品説明文(スマホ)
                            post_data.productDescription.sp = editor.value;
                            break;
                        case 'salesdesc_pc': // PC用販売説明文
                            post_data.salesDescription = editor.value;
                            break;
                        case 'standardPrice': // 販売価格
                            for (let sku_code of sku_codes) {
                                post_data.variants[sku_code].standardPrice = editor.value;
                            }
                            break;
                        case 'asurakuDeliveryId': // あす楽管理番号
                            for (let sku_code of sku_codes) {
                                post_data.variants[sku_code].asurakuDeliveryId = editor.value;
                            }
                            break;
                        case 'normalDeliveryDateId': // 在庫あり時納期管理番号
                            for (let sku_code of sku_codes) {
                                post_data.variants[sku_code].normalDeliveryDateId = editor.value;
                            }
                            break;
                        case 'backOrderDeliveryDateId': // 在庫切れ時納期管理番号
                            for (let sku_code of sku_codes) {
                                post_data.variants[sku_code].backOrderDeliveryDateId = editor.value;
                            }
                            break;
                        case 'image':
                            if (editor.value) {
                                const hash = window.renderAPI.convertRakutenImageHash(editor.value);
                                if (hash !== undefined) {
                                    post_data.images.push(hash);
                                }
                            }

                            break;
                    }

                });
                // APIを呼び出して更新
                try{
                    console.log(post_data);
                    const ret = await window.electronAPI.updateRakutenItem(g_item_code, post_data, shop_code);
                    console.log(ret);
                    if (ret === 'OK') {
                        window.electronAPI.showMessage('正常に情報を更新できました！');
                    }else{
                        window.electronAPI.showAlert(`エラーが発生したため、更新できませんでした(${ret.code}) :${ret.message}`);
                    }
                }catch(err) {
                    window.electronAPI.showAlert(`${debug_trace}実行エラー：エラーが発生しました：${err}`);
                }
            }
        }
    });

    // 楽天の商品情報を取得して詳細編集画面を描画(ポップアップ)
    async function show_rms_edit_popup(item_code, shop_code) {
        const shop_codes = ['r_somurie', 'r_patie', 'r_kagu', 'r_babuuu'];
        const res = await window.electronAPI.getRakutenItem(item_code, shop_codes);
console.log(res);

        // カテゴリ情報取得
        const cat_res = await window.electronAPI.getRakutenCategoryMappings(item_code, shop_codes);
console.log(cat_res);

        g_item_code = item_code;

        const modal = document.querySelector('.js-modal');
        // モーダルを開く
        modal.classList.add('is-active');

        const modal_content = document.querySelector('.modal-content');

        // fragmentは目に見えないDOMのこと。そうすることでDOM構築描画回数を減らす
        const fragment = document.createDocumentFragment();

        // ショップ数を保持
        const shop_count = Object.keys(res).length;
        const div_parent = window.renderAPI.createHTMLElement('div', {class: 'grid-table'});
        div_parent.style.gridTemplateColumns = `auto repeat(${shop_count}, 1fr)`;

        let div_field_name;
        let div_field;

        // ショップ名称
        div_field_name = window.renderAPI.createHTMLElement('div', {class: 'grid-cell'}, '');
        div_parent.appendChild(div_field_name);

        div_field = window.renderAPI.createHTMLElement('div', {class: 'grid-cell'}, '');
        div_field.style.gridColumn = `2 / span ${shop_count}`;
        div_parent.appendChild(div_field);
        // for(let shop_code_inner in res) {
        //     div_field = window.renderAPI.createHTMLElement('div', {class: 'grid-cell'}, '');
        //     div_parent.appendChild(div_field);
        // }

        // 保存ボタン（ショップ別）
        div_field_name = window.renderAPI.createHTMLElement('div', {class: 'grid-cell'}, '保存（ショップ別）');
        div_parent.appendChild(div_field_name);
        for(let shop_code_inner in res) {
            const rms_data = res[shop_code_inner];
            // SKU管理番号を取得
            let sku_codes = new Array();
            for(let [sku_code, sku_info] of Object.entries(rms_data.variants)) {
                sku_codes.push(sku_code);
            }

            div_field = window.renderAPI.createHTMLElement('div', {class: 'grid-cell'});

            // ショップ名称
            div_shop_name = window.renderAPI.createHTMLElement('span', {class: ''}, shop_info[shop_code_inner].shop_name);
            div_field.appendChild(div_shop_name);

            const button_save = window.renderAPI.createHTMLElement('button', {class: 'button small', shop_code: `${shop_code_inner}`, sku_codes: `${sku_codes.join(' ')}`, title: '下記のデータをRMSに送信して更新します'}, '変更をRMSに反映');
            div_field.appendChild(button_save);
            div_parent.appendChild(div_field);
        }

        // 商品画像1
        div_field_name = window.renderAPI.createHTMLElement('div', {class: 'grid-cell'}, '商品画像1');
        div_parent.appendChild(div_field_name);
        for(let shop_code_inner in res) {
            const rms_data = res[shop_code_inner];

            div_field = window.renderAPI.createHTMLElement('div', {class: 'grid-cell'});
            const div_wrap = window.renderAPI.createHTMLElement('div', {class: 'flex_wrap_inner'});

            let img1_url = "";
            if (rms_data.images !== undefined) {
                img1_url = window.renderAPI.convertRakutenImageURL(rms_data.images[0], shop_info[shop_code_inner].shop_code);
            }
            const img = window.renderAPI.createHTMLElement("img", {src: img1_url, class: 'item_image'});
            div_wrap.appendChild(img);
            div_field.appendChild(div_wrap);

            // 商品名
            const div_wrap2 = window.renderAPI.createHTMLElement('div', {class: 'w-100p'});
            const input_field = window.renderAPI.createHTMLElement('textarea', {class: 'small', name: `${shop_code_inner}_title`}, `${rms_data.title}`);
            const div_length_check = window.renderAPI.createHTMLElement('div', {class: 'small'}, showByteSize(rms_data.title, 255));
            // 文字数チェッカー
            input_field.addEventListener('input', (e) => {
                div_length_check.textContent = showByteSize(e.target.value, 255);
            });

            div_wrap2.appendChild(input_field);
            div_wrap2.appendChild(div_length_check);

            div_wrap.appendChild(div_wrap2);
            div_field.appendChild(div_wrap);
            div_parent.appendChild(div_field);
        }

        // 商品管理番号
        div_field_name = window.renderAPI.createHTMLElement('div', {class: 'grid-cell'}, '商品管理番号');
        div_parent.appendChild(div_field_name);
        for(let shop_code_inner in res) {
            const rms_data = res[shop_code_inner];
            div_field = window.renderAPI.createHTMLElement('div', {class: 'grid-cell'});
            const div_wrap = window.renderAPI.createHTMLElement('div', {class: 'flex_wrap_inner'});
            const div_item_code = window.renderAPI.createHTMLElement('div', {}, rms_data.manageNumber);
            div_wrap.appendChild(div_item_code); 

            // 商品管理番号コピー
            const button_copy = window.renderAPI.createHTMLElement('a', {href: '#', class: 'button small', target: '_blank', title: '商品管理番号をクリップボードにコピー'}, 'コピー');
            button_copy.addEventListener('click', (e) => {
                e.preventDefault();
                window.electronAPI.copyToClipboard(rms_data.manageNumber);
            });
            div_wrap.appendChild(button_copy);

            // 商品ページリンク
            const item_url = window.renderAPI.makeRakutenItemURL(rms_data.manageNumber, shop_info[shop_code_inner].shop_code, rms_data.hideItem);
            const button_link_product_page = window.renderAPI.createHTMLElement('a', {href: item_url, class: 'button small', target: '_blank', title: '商品ページをブラウザで表示'}, '商品ページ');
            div_wrap.appendChild(button_link_product_page);

            // RMSリンク
            const rms_url = window.renderAPI.makeRakutenRMSURL(rms_data.manageNumber, shop_info[shop_code_inner].shop_id);
            const button_link_rms_page = window.renderAPI.createHTMLElement('a', {href: rms_url, class: 'button small', target: '_blank', title: 'RMSの編集画面をブラウザで表示'}, 'RMS編集');
            div_wrap.appendChild(button_link_rms_page);

            // 通販する蔵リンク
            const suruzo_url = window.renderAPI.makeSuruzoItemSearchURL(rms_data.manageNumber, shop_info[shop_code_inner].shop_code);
            const button_link_suruzo_page = window.renderAPI.createHTMLElement('a', {href: suruzo_url, class: 'button small', target: '_blank', title: '通販する蔵の商品マスターをブラウザで表示'}, 'する蔵');
            div_wrap.appendChild(button_link_suruzo_page);

            div_field.appendChild(div_wrap); 
            div_parent.appendChild(div_field);
        }
 
        // 商品番号
        div_field_name = window.renderAPI.createHTMLElement('div', {class: 'grid-cell'}, '商品番号');
        div_parent.appendChild(div_field_name);
        for(let shop_code_inner in res) {
            const rms_data = res[shop_code_inner];
            div_field = window.renderAPI.createHTMLElement('div', {class: 'grid-cell'}, rms_data.itemNumber);
            div_parent.appendChild(div_field);
        }

        // 倉庫？
        div_field_name = window.renderAPI.createHTMLElement('div', {class: 'grid-cell'}, '倉庫');
        div_parent.appendChild(div_field_name);
        const template_radio = document.getElementById("template_radio"); // radioテンプレート取得
        for(let shop_code_inner in res) {
            const rms_data = res[shop_code_inner];

            const radio_souko_flag = template_radio.content.cloneNode(true);
            let radio_real_normal = radio_souko_flag.querySelector('.radio_real[value="0"]');
            let radio_real_souko = radio_souko_flag.querySelector('.radio_real[value="1"]');
            radio_real_normal.setAttribute('name', `${shop_code_inner}_souko_flag`);
            radio_real_souko.setAttribute('name', `${shop_code_inner}_souko_flag`);
            if (rms_data.hideItem) {
                // 倉庫
                radio_real_souko.checked = true;
            }else{
                // 販売中
                radio_real_normal.checked = true;
            }
            div_field = window.renderAPI.createHTMLElement('div', {class: 'grid-cell'});
            div_field.appendChild(radio_souko_flag);
            
            div_parent.appendChild(div_field);
        }

        // ショップ内カテゴリ
        div_field_name = window.renderAPI.createHTMLElement('div', {class: 'grid-cell'}, 'ショップ内カテゴリ');
        div_parent.appendChild(div_field_name);
        for(let shop_code_inner in res) {
            const rms_data = res[shop_code_inner];
            const cat_data = cat_res[shop_code_inner];

            div_field = window.renderAPI.createHTMLElement('div', {class: 'grid-cell'});
            const div_wrap = window.renderAPI.createHTMLElement('div', {class: 'item_category_wrap'});
            for(const category of cat_data.categories) {
                let cat_path = "";
                // パンくずリスト
                if (category.breadcrumbs.breadcrumbList) {
                    for(const breadcrumb of category.breadcrumbs.breadcrumbList) {
                        cat_path += `${breadcrumb.title} > `;
                    }
                }
                cat_path += category.title;

                const input_field = window.renderAPI.createHTMLElement('input', {type: 'text', class: 'small', name: `${shop_code_inner}_catetory`, value: `${cat_path}`, readonly: 'readonly'});

                div_wrap.appendChild(input_field);
            }
            div_field.appendChild(div_wrap);
            div_parent.appendChild(div_field);
        }

        // // 商品名
        // div_field_name = window.renderAPI.createHTMLElement('div', {class: 'grid-cell'}, '商品名');
        // div_parent.appendChild(div_field_name);
        // for(let shop_code_inner in res) {
        //     const rms_data = res[shop_code_inner];
        //     div_field = window.renderAPI.createHTMLElement('div', {class: 'grid-cell'});
        //     const input_field = window.renderAPI.createHTMLElement('textarea', {class: 'small', name: `${shop_code_inner}_title`}, `${rms_data.title}`);
        //     const div_length_check = window.renderAPI.createHTMLElement('div', {class: 'small'}, showByteSize(rms_data.title, 255));
        //     // 文字数チェッカー
        //     input_field.addEventListener('input', (e) => {
        //         div_length_check.textContent = showByteSize(e.target.value, 255);
        //     });

        //     div_field.appendChild(input_field);
        //     div_field.appendChild(div_length_check);
        //     div_parent.appendChild(div_field);
        // }

        // 商品画像
        div_field_name = window.renderAPI.createHTMLElement('div', {class: 'grid-cell'}, '商品画像');
        div_parent.appendChild(div_field_name);
        for(let shop_code_inner in res) {
            const rms_data = res[shop_code_inner];
            div_field = window.renderAPI.createHTMLElement('div', {class: 'grid-cell'});

            // 商品画像は最大で20枚
            for(let number = 0; number < 20; number++) {
                let url = "";
                if (rms_data.images !== undefined && rms_data.images[number] !== undefined) {
                    // 商品画像URLが存在する場合
                    url = window.renderAPI.convertRakutenImageURL(rms_data.images[number], shop_info[shop_code_inner].shop_code);
                }else{

                }
                const div_wrap = window.renderAPI.createHTMLElement('div', {class: 'item_image_wrap'});
                const img_preview = window.renderAPI.createHTMLElement('img', {src: url, class: 'preview', onerror: 'this.hidden = true'});
                const input_field = window.renderAPI.createHTMLElement('input', {type: 'text', name: `${shop_code_inner}_image${number}`, value: `${url}`});
                input_field.addEventListener('input', (event) => {
                    // imgタグのsrc属性を更新
                    const url = input_field.value;
                    // 入力要素の次の要素を取得
                    let previousSibling  = event.target.previousElementSibling;
                    
                    // 次の要素がimgであるかを確認
                    if (previousSibling && previousSibling.tagName === 'IMG') {
                        // srcを更新して、非表示を解除
                        previousSibling.src = url;
                        previousSibling.hidden = false;
                    }
                })

                const span_field = window.renderAPI.createHTMLElement('span', {}, `${number + 1}`);
                div_wrap.appendChild(span_field);
                div_wrap.appendChild(img_preview);
                div_wrap.appendChild(input_field);
                div_field.appendChild(div_wrap);
            }

            div_parent.appendChild(div_field);
        }

        // 商品説明文(PC)
        div_field_name = window.renderAPI.createHTMLElement('div', {class: 'grid-cell'}, '商品説明文(PC)');
        div_parent.appendChild(div_field_name);
        for(let shop_code_inner in res) {
            const rms_data = res[shop_code_inner];
            div_field = window.renderAPI.createHTMLElement('div', {class: 'grid-cell'});
            let productdesc_pc = '';
            if (rms_data.productDescription && rms_data.productDescription.pc !== undefined) {
                productdesc_pc = rms_data.productDescription.pc;
            }
            const input_field = window.renderAPI.createHTMLElement('textarea', {class: 'small', name: `${shop_code_inner}_productdesc_pc`}, productdesc_pc);
            const div_length_check = window.renderAPI.createHTMLElement('div', {class: 'small'}, showByteSize(productdesc_pc, 10240));
            // 文字数チェッカー
            input_field.addEventListener('input', (e) => {
                div_length_check.textContent = showByteSize(e.target.value, 10240);
            });

            div_field.appendChild(input_field);
            div_field.appendChild(div_length_check);
            div_parent.appendChild(div_field);
        }

        // 商品説明文(スマホ)
        div_field_name = window.renderAPI.createHTMLElement('div', {class: 'grid-cell'}, '商品説明文(スマホ)');
        div_parent.appendChild(div_field_name);
        for(let shop_code_inner in res) {
            const rms_data = res[shop_code_inner];
            div_field = window.renderAPI.createHTMLElement('div', {class: 'grid-cell'});
            let productdesc_sp = '';
            if (rms_data.productDescription && rms_data.productDescription.sp !== undefined) {
                productdesc_sp = rms_data.productDescription.sp;
            }
            const input_field = window.renderAPI.createHTMLElement('textarea', {class: 'small', name: `${shop_code_inner}_productdesc_sp`}, productdesc_sp);
            const div_length_check = window.renderAPI.createHTMLElement('div', {class: 'small'}, showByteSize(productdesc_sp, 10240));
            // 文字数チェッカー
            input_field.addEventListener('input', (e) => {
                div_length_check.textContent = showByteSize(e.target.value, 10240);
            });

            // プレビューボタン
            const a_preview = window.renderAPI.createHTMLElement('a', {class: 'button small', onclick: `openPreview('${shop_code_inner}_productdesc_sp'); return false;`}, 'プレビュー');

            const div_subtools = window.renderAPI.createHTMLElement('div', {class: 'flex_wrap_inner mt-8'});
            div_subtools.appendChild(div_length_check);
            div_subtools.appendChild(a_preview);

            div_field.appendChild(input_field);
            div_field.appendChild(div_subtools);
            div_parent.appendChild(div_field);
        }        

        // PC用販売説明文
        div_field_name = window.renderAPI.createHTMLElement('div', {class: 'grid-cell'}, 'PC用販売説明文');
        div_parent.appendChild(div_field_name);
        for(let shop_code_inner in res) {
            const rms_data = res[shop_code_inner];
            div_field = window.renderAPI.createHTMLElement('div', {class: 'grid-cell'});
            let salesdesc_pc = '';
            if (rms_data.productDescription) {
                salesdesc_pc = rms_data.salesDescription;
            }
            const input_field = window.renderAPI.createHTMLElement('textarea', {class: 'small', name: `${shop_code_inner}_salesdesc_pc`}, salesdesc_pc);
            const div_length_check = window.renderAPI.createHTMLElement('div', {class: 'small'}, showByteSize(salesdesc_pc, 10240));
            // 文字数チェッカー
            input_field.addEventListener('input', (e) => {
                div_length_check.textContent = showByteSize(e.target.value, 10240);
            });

            // プレビューボタン
            const a_preview = window.renderAPI.createHTMLElement('a', {class: 'button small', onclick: `openPreview('${shop_code_inner}_salesdesc_pc'); return false;`}, 'プレビュー');

            const div_subtools = window.renderAPI.createHTMLElement('div', {class: 'flex_wrap_inner'});
            div_subtools.appendChild(div_length_check);
            div_subtools.appendChild(a_preview);

            div_field.appendChild(input_field);
            div_field.appendChild(div_subtools);
            div_parent.appendChild(div_field);
        }      

        // 販売価格
        div_field_name = window.renderAPI.createHTMLElement('div', {class: 'grid-cell'}, '販売価格');
        div_parent.appendChild(div_field_name);
        for(let shop_code_inner in res) {
            const rms_data = res[shop_code_inner];
            div_field = window.renderAPI.createHTMLElement('div', {class: 'grid-cell'});

            // SKU内で値が全て同じかチェック
            let is_same_value = true;
            let target_value = undefined;
            for(let [sku_code, sku_info] of Object.entries(rms_data.variants)) {
                if (target_value === undefined) {
                    target_value = sku_info.standardPrice;
                }else{
                    if (target_value !== sku_info.standardPrice) {
                        // 値が異なるのでフラグをOFFに
                        is_same_value = false;
                    }
                }
            }

            if (is_same_value) {
                // SKU内の値が全て同じ場合
            }else{
                // SKU内の値が異なる場合
                target_value = "SKUごとに異なる";
            }
            const input_field = window.renderAPI.createHTMLElement('input', {type: 'text', class: 'small', name: `${shop_code_inner}_standardPrice`, value: target_value});
            div_field.appendChild(input_field);
            div_parent.appendChild(div_field);
        }

        // あす楽管理番号(2024/7/16 API廃止)
        // div_field_name = window.renderAPI.createHTMLElement('div', {class: 'grid-cell'}, 'あす楽配送管理番号');
        // div_parent.appendChild(div_field_name);
        // for(let shop_code_inner in res) {
        //     const rms_data = res[shop_code_inner];
        //     div_field = window.renderAPI.createHTMLElement('div', {class: 'grid-cell'});

        //     // SKU内で値が全て同じかチェック
        //     let is_same_value = true;
        //     let target_value = undefined;
        //     for(let [sku_code, sku_info] of Object.entries(rms_data.variants)) {
        //         if (target_value === undefined) {
        //             target_value = sku_info.asurakuDeliveryId;
        //         }else{
        //             if (target_value !== sku_info.asurakuDeliveryId) {
        //                 // 値が異なるのでフラグをOFFに
        //                 is_same_value = false;
        //             }
        //         }
        //     }
        //     // SKU内の値が全て同じ場合
        //     if (is_same_value) {
        //         // SKU内の値が全て同じ場合
        //     }else{
        //         // SKU内の値が異なる場合
        //         target_value = "SKUごとに異なる";
        //     }
        //     if (target_value === undefined) target_value = '';
        //     const input_field = window.renderAPI.createHTMLElement('input', {type: 'text', class: 'small', name: `${shop_code_inner}_asurakuDeliveryId`, value: target_value});
        //     div_field.appendChild(input_field);
        //     div_parent.appendChild(div_field);
        // }

        // 在庫あり時納期管理番号
        div_field_name = window.renderAPI.createHTMLElement('div', {class: 'grid-cell'}, '在庫あり時納期管理番号');
        div_parent.appendChild(div_field_name);
        for(let shop_code_inner in res) {
            const rms_data = res[shop_code_inner];
            div_field = window.renderAPI.createHTMLElement('div', {class: 'grid-cell'});

            // SKU内で値が全て同じかチェック
            let is_same_value = true;
            let target_value = undefined;
            for(let [sku_code, sku_info] of Object.entries(rms_data.variants)) {
                if (target_value === undefined) {
                    target_value = sku_info.normalDeliveryDateId;
                }else{
                    if (target_value !== sku_info.normalDeliveryDateId) {
                        // 値が異なるのでフラグをOFFに
                        is_same_value = false;
                    }
                }
            }
            // SKU内の値が全て同じ場合
            if (is_same_value) {
                // SKU内の値が全て同じ場合
            }else{
                // SKU内の値が異なる場合
                target_value = "SKUごとに異なる";
            }
            if (target_value === undefined) target_value = '';
            const input_field = window.renderAPI.createHTMLElement('input', {type: 'text', class: 'small', name: `${shop_code_inner}_normalDeliveryDateId`, value: target_value});
            div_field.appendChild(input_field);
            div_parent.appendChild(div_field);
        }

        // 在庫切れ時納期管理番号
        div_field_name = window.renderAPI.createHTMLElement('div', {class: 'grid-cell'}, '在庫切れ時納期管理番号');
        div_parent.appendChild(div_field_name);
        for(let shop_code_inner in res) {
            const rms_data = res[shop_code_inner];
            div_field = window.renderAPI.createHTMLElement('div', {class: 'grid-cell'});

            // SKU内で値が全て同じかチェック
            let is_same_value = true;
            let target_value = undefined;
            for(let [sku_code, sku_info] of Object.entries(rms_data.variants)) {
                if (target_value === undefined) {
                    target_value = sku_info.backOrderDeliveryDateId;
                }else{
                    if (target_value !== sku_info.backOrderDeliveryDateId) {
                        // 値が異なるのでフラグをOFFに
                        is_same_value = false;
                    }
                }
            }
            // SKU内の値が全て同じ場合
            if (is_same_value) {
                // SKU内の値が全て同じ場合
            }else{
                // SKU内の値が異なる場合
                target_value = "SKUごとに異なる";
            }
            if (target_value === undefined) target_value = '';
            const input_field = window.renderAPI.createHTMLElement('input', {type: 'text', class: 'small', name: `${shop_code_inner}_backOrderDeliveryDateId`, value: target_value});
            div_field.appendChild(input_field);
            div_parent.appendChild(div_field);
        }



        // いったん、前回のデータを削除
        while( modal_content.firstChild ){
            modal_content.removeChild( modal_content.firstChild );
        }

        modal_content.appendChild(div_parent);
    }

    const search_word_obj = document.querySelector('input[name="search_word"]');
    const r_item_search = document.querySelector('button#r_item_search');

    // キーワード入力でエンターキー押下時
    search_word_obj.addEventListener('keydown', function(event) {
        // エンターキーが押されたかどうかを確認
        if (event.key === 'Enter' || event.keyCode === 13) {
            // ボタンのクリックイベントを発火
            r_item_search.click();
        }
    });

    // 楽天商品検索ボタン
    r_item_search.addEventListener('click', async () => {
        // 対象モールを取得
        let shop_targets = new Array();
        const item_targets = document.querySelectorAll('[name="item_target"]');
        for (const item_target of item_targets) {
            if (item_target.checked) {
                const shop_target = item_target.value;
                shop_targets.push(shop_target);
            }
        }
        // shopは1つしか選択できない
        if (shop_targets.length == 0) {
            return;
        }

        // 検索対象を取得
        let param_target = "";
        const param_targets = document.querySelectorAll('[name="param_target"]');
        for (const pt of param_targets) {
            if (pt.checked) {
                param_target = pt.value;
            }
        }

        // キーワードを取得
        let search_word = search_word_obj.value;

        // ソート対象を取得
        let sort_key = "";
        const sort_keys = document.querySelectorAll('[name="sort_key"]');
        for (const pt of sort_keys) {
            if (pt.checked) {
                sort_key = pt.value;
            }
        }

        // ソート順
        let sort_order = "";
        const sort_orders = document.querySelectorAll('[name="sort_order"]');
        for (const pt of sort_orders) {
            if (pt.checked) {
                sort_order = pt.value;
            }
        }

        // 商品情報取得
        search_rakuten_items_inner(param_target, search_word, sort_key, sort_order, 1, shop_targets);

    });

});