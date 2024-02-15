window.addEventListener('DOMContentLoaded', async () => {
    const menu_downloader = document.querySelector('#downloader');
    menu_downloader.addEventListener('click', () => {
        window.electronAPI.showDownloaderWindow();
    });

    const menu_item_edit = document.querySelector('#item_edit');
    menu_item_edit.addEventListener('click', () => {
        window.electronAPI.showItemEditWindow();
    });

    const menu_item_image_url = document.querySelector('#item_image_url');
    menu_item_image_url.addEventListener('click', () => {
        window.electronAPI.showItemImageURLWindow();
    });
});