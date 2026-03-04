const version = chrome.runtime.getManifest().version;
document.getElementById('version')!.textContent = `v${version}`;
