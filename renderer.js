// --- ローマ字とひらがなの対応表 (変更なし) ---
const ROMAJI_HIRAGANA_MAP = { 'a': 'あ', 'i': 'い', 'u': 'う', 'e': 'え', 'o': 'お', 'ka': 'か', 'ki': 'き', 'ku': 'く', 'ke': 'け', 'ko': 'こ', 'sa': 'さ', 'shi': 'し', 'si': 'し', 'su': 'す', 'se': 'せ', 'so': 'そ', 'ta': 'た', 'chi': 'ち', 'ti': 'ち', 'tsu': 'つ', 'tu': 'つ', 'te': 'て', 'to': 'と', 'na': 'な', 'ni': 'に', 'nu': 'ぬ', 'ne': 'ね', 'no': 'の', 'ha': 'は', 'hi': 'ひ', 'fu': 'ふ', 'hu': 'ふ', 'he': 'へ', 'ho': 'ほ', 'ma': 'ま', 'mi': 'み', 'mu': 'む', 'me': 'め', 'mo': 'も', 'ya': 'や', 'yu': 'ゆ', 'yo': 'よ', 'ra': 'ら', 'ri': 'り', 'ru': 'る', 're': 'れ', 'ro': 'ろ', 'wa': 'わ', 'wo': 'を', 'nn': 'ん', 'ga': 'が', 'gi': 'ぎ', 'gu': 'ぐ', 'ge': 'げ', 'go': 'ご', 'za': 'ざ', 'ji': 'じ', 'zi': 'じ', 'zu': 'ず', 'ze': 'ぜ', 'zo': 'ぞ', 'da': 'だ', 'di': 'ぢ', 'du': 'づ', 'de': 'で', 'do': 'ど', 'ba': 'ば', 'bi': 'び', 'bu': 'ぶ', 'be': 'べ', 'bo': 'ぼ', 'pa': 'ぱ', 'pi': 'ぴ', 'pu': 'ぷ', 'pe': 'ぺ', 'po': 'ぽ', 'kya': 'きゃ', 'kyu': 'きゅ', 'kyo': 'きょ', 'sya': 'しゃ', 'syu': 'しゅ', 'syo': 'しょ', 'sha': 'しゃ', 'shu': 'しゅ', 'sho': 'しょ', 'tya': 'ちゃ', 'tyu': 'ちゅ', 'tyo': 'ちょ', 'cha': 'ちゃ', 'chu': 'ちゅ', 'cho': 'ちょ', 'nya': 'にゃ', 'nyu': 'にゅ', 'nyo': 'にょ', 'hya': 'ひゃ', 'hyu': 'ひゅ', 'hyo': 'ひょ', 'mya': 'みゃ', 'myu': 'みゅ', 'myo': 'みょ', 'rya': 'りゃ', 'ryu': 'りゅ', 'ryo': 'りょ', 'gya': 'ぎゃ', 'gyu': 'ぎゅ', 'gyo': 'ぎょ', 'ja': 'じゃ', 'ju': 'じゅ', 'jo': 'じょ', 'bya': 'びゃ', 'byu': 'びゅ', 'byo': 'びょ', 'pya': 'ぴゃ', 'pyu': 'ぴゅ', 'pyo': 'ぴょ', 'la': 'ぁ', 'li': 'ぃ', 'lu': 'ぅ', 'le': 'ぇ', 'lo': 'ぉ', 'xa': 'ぁ', 'xi': 'ぃ', 'xu': 'ぅ', 'xe': 'ぇ', 'xo': 'ぉ', 'xtu': 'っ', 'ltu': 'っ', 'ltsu': 'っ', '-': 'ー', ',': '、', '.': '。', };
const SORTED_ROMAJI_KEYS = Object.keys(ROMAJI_HIRAGANA_MAP).sort((a, b) => b.length - a.length);

class KanjiIME {
    constructor(dictionary) {
        this.dictionary = dictionary;
        this.reset();
    }

    reset() {
        // ★★★ 文字列管理をカーソル基点に変更 ★★★
        this.confirmed_before_cursor = ""; // カーソルより前の確定文字列
        this.confirmed_after_cursor = "";  // カーソルより後の確定文字列
        this.pending_hiragana = "";
        this.pending_romaji = "";
        this.conversion_mode = false;
        this.candidates = [];
        this.candidate_index = 0;
        this.segment_to_convert = "";
        this.is_candidate_list_visible = false;
    }

    _updatePendingHiragana(char) { this.pending_romaji += char; while (this.pending_romaji.length > 0) { if (this.pending_romaji.length >= 2 && this.pending_romaji[0] === this.pending_romaji[1] && "bcdfghjklmpqrstvwxyz".includes(this.pending_romaji[0])) { this.pending_hiragana += "っ"; this.pending_romaji = this.pending_romaji.substring(1); continue; } let matched = false; for (const romaji of SORTED_ROMAJI_KEYS) { if (this.pending_romaji.startsWith(romaji)) { this.pending_hiragana += ROMAJI_HIRAGANA_MAP[romaji]; this.pending_romaji = this.pending_romaji.substring(romaji.length); matched = true; break; } } if (!matched && this.pending_romaji.startsWith('n') && this.pending_romaji.length > 1 && !"aiueoyn'".includes(this.pending_romaji[1])) { this.pending_hiragana += "ん"; this.pending_romaji = this.pending_romaji.substring(1); matched = true; } if (!matched) break; } }
    
    processChar(char) {
        if (this.conversion_mode) this.confirmConversion();
        this._updatePendingHiragana(char);
    }

    async startConversion() {
        if (this.conversion_mode) { this.cycleCandidates(); return; }
        if (!this.pending_hiragana) {
            // カーソル位置にスペースを挿入
            this.confirmed_before_cursor += " ";
            return;
        }
        const tokens = await window.api.tokenize(this.pending_hiragana);
        let longest_match = "";
        for (let i = tokens.length - 1; i >= 0; i--) {
            const segment_candidate = tokens.slice(i).map(t => t.surface_form).join('');
            if (this.dictionary[segment_candidate]) longest_match = segment_candidate;
        }
        if (longest_match) {
            this.segment_to_convert = longest_match;
            this.candidates = [...this.dictionary[this.segment_to_convert]];
            if (!this.candidates.includes(this.segment_to_convert)) this.candidates.push(this.segment_to_convert);
            this.candidate_index = 0;
            this.conversion_mode = true;
            this.pending_hiragana = this.pending_hiragana.slice(0, -this.segment_to_convert.length);
        } else {
            this.confirmAllPending();
        }
    }

    cycleCandidates() { if (this.conversion_mode) { this.candidate_index = (this.candidate_index + 1) % this.candidates.length; this.is_candidate_list_visible = true; } }
    selectNextCandidate() { if (this.conversion_mode) { this.candidate_index = (this.candidate_index + 1) % this.candidates.length; } }
    selectPreviousCandidate() { if (this.conversion_mode) { this.candidate_index = (this.candidate_index - 1 + this.candidates.length) % this.candidates.length; } }

    confirmConversion() {
        if (this.conversion_mode) {
            this.confirmed_before_cursor += this.pending_hiragana + this.candidates[this.candidate_index];
            this.resetPending();
        } else {
            this.confirmAllPending();
        }
    }

    confirmAllPending() {
        this.confirmed_before_cursor += this.pending_hiragana;
        this.resetPending();
    }

    resetPending() { this.pending_hiragana = ""; this.pending_romaji = ""; this.conversion_mode = false; this.candidates = []; this.candidate_index = 0; this.segment_to_convert = ""; this.is_candidate_list_visible = false; }

    backspace() {
        if (this.conversion_mode) {
            this.pending_hiragana += this.segment_to_convert;
            this.conversion_mode = false; this.candidates = []; this.is_candidate_list_visible = false;
        } else if (this.pending_romaji) {
            this.pending_romaji = this.pending_romaji.slice(0, -1);
        } else if (this.pending_hiragana) {
            this.pending_hiragana = this.pending_hiragana.slice(0, -1);
        } else if (this.confirmed_before_cursor) {
            // ★★★ Backspaceの<br>バグを修正 ★★★
            if (this.confirmed_before_cursor.endsWith('<br>')) {
                this.confirmed_before_cursor = this.confirmed_before_cursor.slice(0, -4);
            } else {
                this.confirmed_before_cursor = this.confirmed_before_cursor.slice(0, -1);
            }
        }
    }

    insertNewline() { this.confirmed_before_cursor += '<br>'; }

    // ★★★ カーソル移動メソッドを追加 ★★★
    moveCursorLeft() {
        this.confirmAllPending();
        if (this.confirmed_before_cursor.length === 0) return;
        
        if (this.confirmed_before_cursor.endsWith('<br>')) {
            this.confirmed_after_cursor = '<br>' + this.confirmed_after_cursor;
            this.confirmed_before_cursor = this.confirmed_before_cursor.slice(0, -4);
        } else {
            const char = this.confirmed_before_cursor.slice(-1);
            this.confirmed_after_cursor = char + this.confirmed_after_cursor;
            this.confirmed_before_cursor = this.confirmed_before_cursor.slice(0, -1);
        }
    }

    moveCursorRight() {
        this.confirmAllPending();
        if (this.confirmed_after_cursor.length === 0) return;

        if (this.confirmed_after_cursor.startsWith('<br>')) {
            this.confirmed_before_cursor += '<br>';
            this.confirmed_after_cursor = this.confirmed_after_cursor.substring(4);
        } else {
            const char = this.confirmed_after_cursor.substring(0, 1);
            this.confirmed_before_cursor += char;
            this.confirmed_after_cursor = this.confirmed_after_cursor.substring(1);
        }
    }

    getState() {
        return {
            confirmedBefore: this.confirmed_before_cursor,
            confirmedAfter: this.confirmed_after_cursor,
            pendingHira: this.pending_hiragana,
            pendingRomaji: this.pending_romaji,
            conversionMode: this.conversion_mode,
            candidates: this.candidates,
            candidateIndex: this.candidate_index,
            isCandidateListVisible: this.is_candidate_list_visible
        };
    }
}

window.addEventListener('DOMContentLoaded', async () => {
    const imeBox = document.getElementById('ime-box');
    const candidatesBox = document.getElementById('candidates-box');
    const statusDiv = document.getElementById('status');
    let ime;

    const log = (message) => { statusDiv.textContent = message; };
    window.api.onLog(log);

    const KANJI_DICT = await window.api.loadDictionary();
    if (!KANJI_DICT) { log("辞書の読み込みに失敗しました。アプリケーションを再起動してください。"); return; }
    
    ime = new KanjiIME(KANJI_DICT);
    log("初期化完了。入力を開始できます。");

    const updateDisplay = () => {
        const state = ime.getState();
        // ★★★ カーソル基点の表示ロジックに変更 ★★★
        let html = `<span class="confirmed">${state.confirmedBefore}</span>`;
        if (state.conversionMode) {
            html += `<span class="pending-hiragana">${state.pendingHira}</span>`;
            html += `<span class="conversion">${state.candidates[state.candidateIndex]}</span>`;
        } else {
            html += `<span class="pending-hiragana">${state.pendingHira}</span>`;
            html += `<span class="pending-romaji">${state.pendingRomaji}</span>`;
        }
        html += `<span class="cursor"></span>`;
        html += `<span class="confirmed">${state.confirmedAfter}</span>`;
        imeBox.innerHTML = html;

        if (state.isCandidateListVisible) {
            candidatesBox.innerHTML = '';
            state.candidates.forEach((candidate, index) => {
                const li = document.createElement('li');
                li.textContent = `${index + 1}. ${candidate}`;
                if (index === state.candidateIndex) li.classList.add('selected');
                candidatesBox.appendChild(li);
            });
            candidatesBox.style.display = 'block';
        } else {
            candidatesBox.style.display = 'none';
        }
    };
    updateDisplay(); // 初期表示
    
    imeBox.addEventListener('keydown', async (e) => {
        if (!ime) return;
        const state = ime.getState();

        if (state.isCandidateListVisible && e.key === 'ArrowDown') { e.preventDefault(); ime.selectNextCandidate(); }
        else if (state.isCandidateListVisible && e.key === 'ArrowUp') { e.preventDefault(); ime.selectPreviousCandidate(); }
        else if (e.key === 'ArrowLeft') { e.preventDefault(); ime.moveCursorLeft(); } // ★ 左カーソル
        else if (e.key === 'ArrowRight') { e.preventDefault(); ime.moveCursorRight(); } // ★ 右カーソル
        else if (e.key === ' ') { e.preventDefault(); await ime.startConversion(); }
        else if (e.key === 'Enter') {
            e.preventDefault();
            if (state.conversionMode) { ime.confirmConversion(); }
            else if (!state.pendingHira && !state.pendingRomaji) { ime.insertNewline(); }
            else { ime.confirmAllPending(); }
        } else if (e.key === 'Backspace') { ime.backspace(); }
        else if (e.key.length === 1 && ((e.key >= 'a' && e.key <= 'z') || "-.,".includes(e.key))) { ime.processChar(e.key); }
        else if (e.key.length === 1 && e.key >= 'A' && e.key <= 'Z') { ime.processChar(e.key.toLowerCase()); }
        else { return; }
        updateDisplay();
    });
});
