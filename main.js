const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs').promises;
const axios = require('axios');
const { performance } = require('perf_hooks');
const kuromoji = require('kuromoji'); // ★ Kuromojiをメインプロセスで読み込む

// --- グローバル変数 ---
let tokenizer = null; // ★ 初期化済みの形態素解析エンジンを保持する変数

// --- Kuromojiの初期化 ---
// ウィンドウ表示前のメインプロセスで行うことで、UIのフリーズを防ぐ
kuromoji.builder({ dicPath: path.join(__dirname, 'node_modules', 'kuromoji', 'dict') }).build((err, t) => {
    if (err) {
        console.error("Kuromojiの初期化に失敗しました:", err);
        tokenizer = null; // エラーが発生したことを示す
    } else {
        console.log("Kuromojiの初期化が完了しました。");
        tokenizer = t;
    }
});

// ★ UIからの形態素解析リクエストを処理するIPCハンドラ
ipcMain.handle('tokenize', (event, text) => {
    if (!tokenizer) {
        console.error("Tokenizerが初期化されていません。");
        return []; // エラー時は空の配列を返す
    }
    return tokenizer.tokenize(text);
});


// --- 辞書の自動ダウンロードと読み込みロジック (変更なし) ---
const MOZC_DICT_URLS = Array.from({ length: 10 }, (_, i) =>
    `https://raw.githubusercontent.com/google/mozc/master/src/data/dictionary_oss/dictionary${String(i).padStart(2, '0')}.txt`
);
const DICT_CACHE_FILE = "kanji_dict_cache_full.json";

function createDictFromMozc(sourceText) {
    const kanjiDict = {};
    for (const line of sourceText.split('\n')) {
        try {
            const parts = line.split('\t');
            if (parts.length >= 5) {
                const [reading, , , , kanji] = parts;
                if (!kanjiDict[reading]) kanjiDict[reading] = [];
                if (!kanjiDict[reading].includes(kanji)) kanjiDict[reading].push(kanji);
            }
        } catch (e) { /* skip */ }
    }
    return kanjiDict;
}

ipcMain.handle('load-dictionary', async (event) => {
    const startTime = performance.now();
    try {
        const cachePath = path.join(app.getPath('userData'), DICT_CACHE_FILE);
        await fs.access(cachePath);
        event.sender.send('log', `'${DICT_CACHE_FILE}' から辞書を読み込みます。`);
        const data = await fs.readFile(cachePath, 'utf-8');
        const endTime = performance.now();
        event.sender.send('log', `辞書の読み込み完了 (${((endTime - startTime) / 1000).toFixed(2)}秒)`);
        return JSON.parse(data);
    } catch (e) {
        // Cache not found, download it
    }

    event.sender.send('log', "ローカルに辞書キャッシュが見つかりません。ダウンロードを開始します...");
    let allDictText = "";
    try {
        const downloadPromises = MOZC_DICT_URLS.map((url, i) => {
            event.sender.send('log', `Mozc辞書をダウンロード中... (${i + 1}/${MOZC_DICT_URLS.length})`);
            return axios.get(url, { timeout: 30000 });
        });

        const responses = await Promise.all(downloadPromises);
        responses.forEach(res => { allDictText += res.data + "\n"; });

        event.sender.send('log', "辞書データを解析して、キャッシュを作成しています...");
        const kanjiDict = createDictFromMozc(allDictText);
        
        const cachePath = path.join(app.getPath('userData'), DICT_CACHE_FILE);
        event.sender.send('log', `ダウンロードした辞書を '${cachePath}' に保存します。`);
        await fs.writeFile(cachePath, JSON.stringify(kanjiDict, null, 2), 'utf-8');
        
        const endTime = performance.now();
        event.sender.send('log', `辞書の準備完了 (${((endTime - startTime) / 1000).toFixed(2)}秒)`);
        return kanjiDict;
    } catch (error) {
        const message = `エラー: 辞書のダウンロードまたは処理に失敗しました。\n詳細: ${error.message}`;
        event.sender.send('log', message);
        return null;
    }
});


// --- ウィンドウ作成 (変更なし) ---
function createWindow() {
    const mainWindow = new BrowserWindow({
        width: 800,
        height: 600,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
        }
    });
    mainWindow.loadFile('index.html');
}

app.whenReady().then(() => {
    createWindow();
    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});
