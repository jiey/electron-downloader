const https = require('https');
const xml2js = require('xml2js');
const { create } = require('xmlbuilder2');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

class RmsAPI {
    webapi_keys;

    constructor(webapi_keys) {
        this.webapi_keys = webapi_keys;
    }

    getAuthString(shop_incode) {
        // 楽天API呼び出し用パラメーター
        const serviceSecret = this.webapi_keys[shop_incode].serviceSecret;//'SP215297_5sVPn5UuV6Akh7E7'
        const licenseKey = this.webapi_keys[shop_incode].licenseKey;//'SL215297_gZkFagCVNKiCtBV3' // ３ヶ月ごとに変更あり

        // Base64に変換
        return 'ESA ' + Buffer.from(`${serviceSecret}:${licenseKey}`).toString('base64');
    }

    // キャビネットの利用状況を取得
    async get_cabinet_usage() {
        const api_key = this.getAuthString('r_somurie');
        const options = {
            hostname: 'api.rms.rakuten.co.jp',
            path: '/es/1.0/cabinet/usage/get',
            method: 'GET',
            headers: {
                'Authorization': api_key
            }
        };

        try{
            const result = await this.#doRequest(options);
            console.log(result);
            
        }catch(e) {
            console.error(e);
        }
    }

    // filePathに存在する画像ファイルをアップロード(jpg, gif, png)
    async upload_file({folderId, fileName, filePath, overWrite}) {
        // ファイル名部分を取得(ついでに小文字に変換)
        const l_filePath = path.basename(filePath).toLowerCase();
        const extension = l_filePath.match(/\.(jpg|png|gif)$/i);
        if (!extension) {
            throw new TypeError('拡張子は、jpg, png, gifに対応しています。' + `(${l_filePath})`);
        }

        let l_fileName;
        // 引数が空欄の場合はファイル名とする
        if (fileName === "") {
            l_fileName = l_filePath;
        }else{
            l_fileName = fileName;
        }

        // 文字サイズチェック
        if (Buffer.byteLength(l_filePath) > 20) {
            throw new TypeError('ファイル名は半角20文字以内の英数字である必要があります');
        }
        if (Buffer.byteLength(l_fileName) > 50) {
            throw new TypeError('登録画像名は半角50文字以内である必要があります');
        }

        // 入力可能文字チェック
        const name = path.parse(l_filePath).name;
        if (!name.match(/^[a-z0-9_-]+$/)) {
            throw new TypeError('ファイル名は半角英数字（小文字）/記号は「-」「_」のみである必要があります');
        }

        const root = create({ 
            version: '1.0',
            encoding: 'UTF-8',
         }).ele('request')
            .ele('fileInsertRequest')
                .ele('file')
                    .ele('fileName').txt(l_fileName).up()
                    .ele('folderId').txt(folderId).up()
                    .ele('filePath').txt(l_filePath).up()
                    .ele('overWrite').txt(overWrite).up() // true: 上書き
                .up()
            .up()
          .up()
        
        const xml = root.end({prettyPrint: false})
        console.dirxml(xml);

        const formData = new FormData();
        formData.append('xml', xml);
        formData.append('file', fs.createReadStream(filePath));

        const options = {
            hostname: 'api.rms.rakuten.co.jp',
            path: '/es/1.0/cabinet/file/insert',
            method: 'POST',
            headers: {
                'Authorization': `ESA ${RmsAPI.auth_string}`,
                ...formData.getHeaders(),
            }
        };

        try{
            const result = await this.#doRequestForm(options, formData);
            console.log(result.result);
            if (result.result.status.systemStatus === 'NG') {
                throw new Error(result.result.status.message);
            }
        }catch(e) {
            console.error(e);
            throw new Error(e.message);
        }

    }

    // フォルダを生成
    async create_folder({upperFolderId, directoryName, folderName = undefined}) {
        if (folderName == undefined) {
            folderName = directoryName;
        }

        const root = create({ 
            version: '1.0',
            encoding: 'UTF-8',
         }).ele('request')
            .ele('folderInsertRequest')
                .ele('folder')
                    .ele('folderName').txt(folderName).up()
                    .ele('directoryName').txt(directoryName).up()
         if (upperFolderId == 0) {
            // ルートに置く場合は、0ではなく空にする必要があるらしい
            root.ele('upperFolderId').up()
         }else{
            root.ele('upperFolderId').txt(upperFolderId).up()
         }
            root.up()
            .up()
          .up()
        

        const xml = root.end({prettyPrint: false})
        console.log(xml);

        const api_key = this.getAuthString('r_somurie');
        const options = {
            hostname: 'api.rms.rakuten.co.jp',
            path: '/es/1.0/cabinet/folder/insert',
            method: 'POST',
            headers: {
                'Authorization': api_key
            }
        };

        try{
            const result = await this.#doRequest(options, xml);
            if (result.result.status.systemStatus === 'NG') {
                throw new Error(result.result.status.message);
            }
            
            // フォルダIDを返却
            return result.result.cabinetFolderInsertResult.FolderId;
        }catch(e) {
            console.error(e);
        }
    }

    /**
     * フォルダの一覧を取得
     *
     * @param {Integer} offset 1を基準値とした検索結果取得ページ数
     * @param {Integer} limit 検索結果の1ページあたりの取得上限数
     * @return {Object} cabinetFoldersGetResult
     */
    async get_folder_list({offset = 1, limit = 100}) {
        const api_key = this.getAuthString('r_somurie');
        const options = {
            hostname: 'api.rms.rakuten.co.jp',
            path: '/es/1.0/cabinet/folders/get' + `?offset=${offset}&limit=${limit}`,
            method: 'GET',
            headers: {
                'Authorization': api_key
            }
        };

console.log(options);

        try{
            const result = await this.#doRequest(options);
            console.log(result.result);
            return result.result;
        }catch(e) {
            console.error(e);
        }
    }

    /**
     * フォルダ内の画像ファイル一覧を取得
     *
     * @param {Integer} folderId 対象のフォルダID
     * @return {Object} 画像ファイル一覧
     */
    async get_file_list({folderId = "", offset = 1, limit = 100}) {
        const api_key = this.getAuthString('r_somurie');
        const options = {
            hostname: 'api.rms.rakuten.co.jp',
            path: '/es/1.0/cabinet/folder/files/get' + `?folderId=${folderId}&offset=${offset}&limit=${limit}`,
            method: 'GET',
            headers: {
                'Authorization': api_key
            }
        };

        try{
            const result = await this.#doRequest(options);
            console.log(result);
            return result.result;
        }catch(e) {
            console.error(e);
        }
    }

    /**
     * Do a request with options provided.
     *
     * @param {Object} options
     * @param {Object} data
     * @return {Promise} a promise of request
     */
    #doRequest(options, xml) {
        return new Promise((resolve, reject) => {
            const req = https.request(options, (res) => {
                res.setEncoding('utf8');
                let responseBody = '';
        
                res.on('data', (chunk) => {
                    responseBody += chunk;
                });
        
                res.on('end', () => {
                    const parser = new xml2js.Parser({
                        async: false,
                        explicitArray: false
                    });
                    parser.parseString(responseBody, function(error, parsedXml) {
                        if (error) {
                            console.error(error.message);
                        }else{
//                            console.log(parsedXml);
                            resolve(parsedXml);
//                            return parsedXml;
                        }
                    });
                });
            });
        
            req.on('error', (err) => {
                console.error(err);
                reject(err);
            });

            console.log('HTTP Request Headers:', req.getHeaders());

            if (xml != undefined) {
                console.log('HTTP Request Body:', xml.toString());
                req.write(xml);
            }
            req.end();
        });
    }

    /**
     * Do a request with options provided.
     *
     * @param {Object} options
     * @param {Object} data
     * @return {Promise} a promise of request
     */
    #doRequestForm(options, formData) {
        return new Promise((resolve, reject) => {
            const req = https.request(options, (res) => {
                res.setEncoding('utf8');
                let responseBody = '';
        
                res.on('data', (chunk) => {
                    responseBody += chunk;
                });
        
                res.on('end', () => {
                    const parser = new xml2js.Parser({
                        async: false,
                        explicitArray: false
                    });
                    parser.parseString(responseBody, function(error, parsedXml) {
                        if (error) {
                            console.error(error.message);
                        }else{
//                            console.log(parsedXml);
                            resolve(parsedXml);
//                            return parsedXml;
                        }
                    });
                });
            });
        
            req.on('error', (err) => {
                console.error(err);
                reject(err);
            });

            console.log('HTTP Request Headers:', req.getHeaders());

            formData.pipe(req);
        });
    }

}

  
// switch(parsedXml.result.status.interfaceId) {
//     case 'cabinet.folders.get':
//         if (parsedXml.result.status.systemStatus != 'OK') {
//             console.error(parsedXml.result.status.message);
//         }

//         console.log(parsedXml.result.cabinetFoldersGetResult.folders);
//         break;
// }


module.exports = RmsAPI;