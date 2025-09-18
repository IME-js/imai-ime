const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  // メインプロセスに辞書の読み込みを要求する関数
  loadDictionary: () => ipcRenderer.invoke('load-dictionary'),
  // ★ メインプロセスに形態素解析を要求する関数を追加
  tokenize: (text) => ipcRenderer.invoke('tokenize', text),
  // メインプロセスからのログメッセージを受け取るためのリスナー
  onLog: (callback) => ipcRenderer.on('log', (event, ...args) => callback(...args)),
});

