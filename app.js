(() => {
  let rows = [];  // [{jp, roma, meaning}]
  let idx = 0;
  let studyMode = 'jp-to-roma'; // 'jp-to-roma' or 'roma-to-jp'
  let showMeaning = false;
  let flipState = 0; // 0: front, 1: middle, 2: back

  // Speech Synthesis API 초기화
  const synth = window.speechSynthesis;
  let voicesLoaded = false;
  // 음성 목록이 로드되면 플래그를 설정합니다.
  synth.onvoiceschanged = () => {
    voicesLoaded = true;
  };
  // 일부 브라우저에서는 onvoiceschanged가 발생하지 않을 수 있으므로 미리 호출합니다.
  synth.getVoices();

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

    const speakNow = () => {
      const newUtterance = new SpeechSynthesisUtterance(text);
      newUtterance.lang = 'ja-JP'; // 일본어 설정
      synth.speak(newUtterance);
    };

    // 음성 목록이 로드될 때까지 잠시 기다리거나, 이미 로드되었다면 바로 실행합니다.
    if (voicesLoaded) {
      speakNow();
    } else {
      // 첫 재생 시 음성 엔진 준비를 위해 약간의 지연을 줍니다.
      setTimeout(speakNow, 100);
    }
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
      const [id, chi='', jp='', ko=''] = cells.map(c => c.trim());
      if (jp) { out.push({chi, jp, meaning: ko}); }
    }
    return out;
  }

  function renderCHI(){
    const row = rows[idx] || {};
    $display.className = 'chi';
    $display.textContent = row.chi || 'CSV를 선택하세요';
    updateMeta();
  }
  
  function renderJP(){
    const row = rows[idx] || {};
    $display.className = 'jp';
    $display.textContent = row.jp || (row.ko ? '...' : 'CSV를 선택하세요');
    updateMeta();
    // 발음은 앞면이 일본어일 때만 재생
    if (row.jp) {
      speakJapanese(row.jp);
    }
  }

  function renderKO(){
    const row = rows[idx] || {};
    $display.className = 'jp';
    $display.textContent = row.meaning || '...';
    updateMeta();
  }

  function flipCard() {
    if (!rows.length) return; // 데이터가 없으면 실행하지 않음

    if (flipState === 2) { // 3번째 면에 있다면, 다음 단어로 넘어갑니다.
      nextRow();
    } else {
      flipState++; // 1번째 또는 2번째 면으로 상태를 변경합니다.
      if (flipState === 1) { // 1번째 뒤집기 -> 2번째 면
        renderJP();
        setStatus('2번째 면');
      } else { // 2번째 뒤집기 -> 3번째 면
        if (studyMode === 'jp-to-roma') renderKO();
        else renderCHI();
        setStatus('3번째 면');
      }
    }
  }

  function nextRow(){
    if (!rows.length) return;
    idx = (idx + 1) % rows.length;
    flipState = 0; // 첫 면으로 초기화
    if (studyMode === 'jp-to-roma') renderCHI();
    else if (studyMode === 'roma-to-jp') renderKO();
    // 기본값 또는 오류 상황에서는 'jp-to-roma' 모드와 동일하게 처리
    else renderCHI();
    setStatus('다음 단어');
  }

  function prevRow(){
    if (!rows.length) return;
    idx = (idx - 1 + rows.length) % rows.length;
    flipState = 0; // 첫 면으로 초기화
    if (studyMode === 'jp-to-roma') renderCHI();
    else if (studyMode === 'roma-to-jp') renderKO();
    // 기본값 또는 오류 상황에서는 'jp-to-roma' 모드와 동일하게 처리
    else renderCHI();
    setStatus('이전');
    const row = rows[idx] || {};
    $meaning.textContent = showMeaning ? (row.meaning || '') : '';
  }

  function warmUpSpeechEngine() {
    const warmUpUtterance = new SpeechSynthesisUtterance(' ');
    warmUpUtterance.volume = 0; // 소리가 들리지 않도록 볼륨을 0으로 설정
    synth.speak(warmUpUtterance);
  }

  function shuffleRows(){
    if (!rows.length) return;
    for (let i = rows.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [rows[i], rows[j]] = [rows[j], rows[i]];
    }
    restart(); // 셔플 후 처음으로 이동
    setStatus('셔플 완료');
  }
  function restart(){
    idx = 0;
    flipState = 0;
    if (studyMode === 'jp-to-roma') renderCHI();
    else if (studyMode === 'roma-to-jp') renderKO();
    // 기본값 또는 오류 상황에서는 'jp-to-roma' 모드와 동일하게 처리
    else renderCHI();
    setStatus('처음으로 이동');
  }

  function backToSetup() {
    $mainScreen.classList.add('hidden');
    $setupScreen.classList.remove('hidden');
    
    // 상태 초기화
    rows = [];
    idx = 0;
    studyMode = 'jp-to-roma';
    showMeaning = false;
    flipState = 0;
    $btnModeJpRoma.classList.add('selected');
    $btnModeRomaJp.classList.remove('selected');
    setStatus('모드 선택됨: 일본어 → 발음. CSV 파일을 로드하세요.');
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
        flipState = 0;
        if (studyMode === 'jp-to-roma') renderCHI();
        else if (studyMode === 'roma-to-jp') renderKO();
        // 기본값 또는 오류 상황에서는 'jp-to-roma' 모드와 동일하게 처리
        else renderCHI();
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
    setStatus('모드 선택됨: 한국어 → 일본어');
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
    if (e.key === 'ArrowRight') { e.preventDefault(); nextRow(); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); prevRow(); }
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
  $btnModeJpRoma.classList.add('selected');
  setStatus('모드 선택됨: 일본어 → 발음. CSV 파일을 로드하세요.');

  // 첫 발음 잘림 현상을 방지하기 위해 음성 엔진을 미리 활성화합니다.
  warmUpSpeechEngine();
})();