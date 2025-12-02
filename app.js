(() => {
  let rows = [];  // [{jp, roma, meaning}]
  let idx = 0;
  let studyMode = null; // 'jp-to-roma' or 'roma-to-jp'
  let showMeaning = false;
  let isFlipped = false; // 카드가 뒤집혔는지 (로마자 표시)

  // Speech Synthesis API 초기화
  const synth = window.speechSynthesis;
  let utterance = new SpeechSynthesisUtterance();
  utterance.lang = 'ja-JP'; // 일본어 설정

  // UI Elements
  const $setupScreen = document.getElementById('setup-screen');
  const $mainScreen = document.getElementById('main-screen');
  const $btnModeJpRoma = document.getElementById('mode-jp-roma');
  const $btnModeRomaJp = document.getElementById('mode-roma-jp');
  const $display = document.getElementById('display');
  const $meaning = document.getElementById('meaning');
  const $count = document.getElementById('count');
  const $status = document.getElementById('status');
  const $screen = document.getElementById('screen');
  const $btnPrev = document.getElementById('prev');
  const $btnNext = document.getElementById('next');
  const $btnShuffle = document.getElementById('shuffle');
  const $btnToggleMeaning = document.getElementById('toggleMeaning');
  const $btnRestart = document.getElementById('restart');
  const $btnBackToSetup = document.getElementById('btnBackToSetup');
  const $file = document.getElementById('file');
  const $drop = document.getElementById('drop');
  
  function updateMeta(){
    $count.textContent = rows.length ? `${idx + 1} / ${rows.length}개` : '0개';
  }

  function setStatus(text){ $status.textContent = text; }

  function speakJapanese(text) {
    if (synth.speaking) {
      synth.cancel(); // 현재 재생 중인 음성이 있다면 중단
    }
    utterance.text = text;
    synth.speak(utterance);
  }

  function parseCSV(text){
    // 첫 줄(헤더)을 건너뛰고, 빈 줄을 제외합니다.
    const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).slice(1).filter(l => l.trim() !== '');
    const out = [];
    for(const line of lines){
      const cells = [];
      let cur = '', inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') {
          if (inQuotes && line[i+1] === '"'){ cur += '"'; i++; }
          else inQuotes = !inQuotes;
        } else if (ch === ',' && !inQuotes){
          cells.push(cur); cur = '';
        } else {
          cur += ch;
        }
      }
      cells.push(cur);
      // id, jp, roma, meaning 순서
      const [id, jp='', roma='', meaning=''] = cells.map(c => c.trim());
      if (jp) { out.push({jp, roma, meaning}); }
    }
    return out;
  }

  function renderJP(){
    const row = rows[idx] || {};
    $display.className = 'jp';
    $display.textContent = row.jp || 'CSV를 선택하세요';
    $meaning.textContent = showMeaning ? (row.meaning || '') : '';
    updateMeta();
    // 발음은 앞면이 일본어일 때만 재생
    if (row.jp) { // 일본어 텍스트가 있을 때만 발음
      speakJapanese(row.jp);
    }
  }
  function renderRoma(){
    const row = rows[idx] || {};
    $display.className = 'romaji';
    $display.textContent = row.roma || (row.jp ? '...' : 'CSV를 선택하세요');
    $meaning.textContent = showMeaning ? (row.meaning || '') : '';
    updateMeta();
  }

  function renderFront() {
    isFlipped = false;
    if (studyMode === 'jp-to-roma') {
      renderJP();
    } else {
      renderRoma();
    }
  }

  function renderBack() {
    isFlipped = true;
    if (studyMode === 'jp-to-roma') {
      renderRoma();
    } else {
      renderJP();
    }
  }

  function flipCard() {
    if (!rows.length) return;
    isFlipped ? renderFront() : renderBack();
  }

  function nextRow(){
    if (!rows.length) return;
    // 카드가 뒤집혀 있으면, 다음 단어의 앞면을 보여줍니다.
    if (isFlipped) {
      idx = (idx + 1) % rows.length;
      renderFront();
      setStatus('다음 단어');
    } else {
      // 카드가 앞면이면, 뒷면을 보여줍니다.
      renderBack();
      setStatus('뒷면 보기');
    }
  }
  function prevRow(){
    if (!rows.length) return;
    idx = (idx - 1 + rows.length) % rows.length;
    renderFront();
    setStatus('이전');
  }
  function shuffleRows(){
    if (!rows.length) return;
    for (let i = rows.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [rows[i], rows[j]] = [rows[j], rows[i]];
    }
    idx = 0;
    renderFront();
    setStatus('셔플 완료');
  }
  function restart(){
    idx = 0;
    renderFront();
    setStatus('처음으로 이동');
  }

  function backToSetup() {
    $mainScreen.classList.add('hidden');
    $setupScreen.classList.remove('hidden');
    
    // 상태 초기화
    rows = [];
    idx = 0;
    studyMode = null;
    showMeaning = false;
    isFlipped = false;
    $btnModeJpRoma.classList.remove('selected');
    $btnModeRomaJp.classList.remove('selected');
    setStatus('학습 모드를 선택하고 CSV 파일을 로드하세요.');
  }

  // CSV 파일 읽기 (파일 선택/드래그)
  function loadCSVFile(file){
    if (!file) return;
    if (!studyMode) {
      setStatus('오류: 학습 모드를 먼저 선택하세요.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      try {
        rows = parseCSV(reader.result);
        if (!rows.length) throw new Error('CSV에 유효한 행이 없습니다.');
        idx = 0;
        $setupScreen.classList.add('hidden');
        $mainScreen.classList.remove('hidden');
        renderFront();
        setStatus(`로드 완료: ${file.name}`);
      } catch(err) {
        $display.className = 'romaji';
        $display.textContent = 'CSV 파싱 실패';
        $meaning.textContent = String(err.message || err);
        setStatus('오류');
      }
    };
    reader.onerror = () => {
      setStatus('파일 읽기 실패');
    };
    reader.readAsText(file, 'utf-8');
  }

  // 이벤트
  $btnModeJpRoma.addEventListener('click', () => {
    studyMode = 'jp-to-roma';
    $btnModeJpRoma.classList.add('selected');
    $btnModeRomaJp.classList.remove('selected');
    setStatus('모드 선택됨: 일본어 → 발음');
  });
  $btnModeRomaJp.addEventListener('click', () => {
    studyMode = 'roma-to-jp';
    $btnModeRomaJp.classList.add('selected');
    $btnModeJpRoma.classList.remove('selected');
    setStatus('모드 선택됨: 발음 → 일본어');
  });
  $btnNext.addEventListener('click', nextRow);
  $btnPrev.addEventListener('click', prevRow);
  $btnShuffle.addEventListener('click', shuffleRows);
  $btnRestart.addEventListener('click', restart);
  $screen.addEventListener('click', flipCard);
  $btnBackToSetup.addEventListener('click', backToSetup);
  $btnToggleMeaning.addEventListener('click', () => {
    showMeaning = !showMeaning;
    const row = rows[idx] || {};
    $meaning.textContent = showMeaning ? (row.meaning || '') : '';
  });

  window.addEventListener('keydown', (e) => {
    if (e.shiftKey && e.key === 'ArrowRight') { e.preventDefault(); nextRow(); }
    else if (e.shiftKey && e.key === 'ArrowLeft') { e.preventDefault(); prevRow(); }
    else if (e.key.toLowerCase() === 'f') { e.preventDefault(); flipCard(); }
    else if (e.key.toLowerCase() === 'm') { e.preventDefault(); $btnToggleMeaning.click(); }
    else if (e.key.toLowerCase() === 'r') { e.preventDefault(); restart(); }
    else if (e.altKey && (e.key.toLowerCase() === 's')) { e.preventDefault(); shuffleRows(); }
  });

  // 파일 선택
  $file.addEventListener('change', (e) => loadCSVFile(e.target.files[0]));

  // 드래그 앤 드롭
  ['dragenter','dragover'].forEach(ev => $drop.addEventListener(ev, (e)=>{ e.preventDefault(); $drop.classList.add('drag'); }));
  ['dragleave','drop'].forEach(ev => $drop.addEventListener(ev, (e)=>{ e.preventDefault(); $drop.classList.remove('drag'); }));
  $drop.addEventListener('drop', (e) => {
    const file = e.dataTransfer.files && e.dataTransfer.files[0];
    if (file) loadCSVFile(file);
  });

  // 초기 상태
  setStatus('학습 모드를 선택하고 CSV 파일을 로드하세요.');
})();