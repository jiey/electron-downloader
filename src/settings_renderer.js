window.addEventListener('DOMContentLoaded', async () => {
    try {
        config = await window.electronAPI.getConfigMain();
    }catch(e) {
        alert(e.message);
    }
    const serviceSecret = document.querySelector("#serviceSecret");
    serviceSecret.textContent = config.webapi.r_somurie.serviceSecret;
    const licenseKey = document.querySelector("#licenseKey");
    licenseKey.value = config.webapi.r_somurie.licenseKey;
});
