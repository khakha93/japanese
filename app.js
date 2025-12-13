(() => {
  let rows = [];  // [{chi, jp, ko}]
  let idx = 0;
  let studyMode = 'chi-to-ko'; // 'chi-to-ko' or 'roma-to-jp'
  let showMeaning = true;
  let speakEnabled = false;
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
  const $btnModeChiKo = document.getElementById('mode-chi-ko');
  const $btnModeRomaJp = document.getElementById('mode-roma-jp');
  const $btnToggleSpeech = document.getElementById('toggleSpeech');
  const $display = document.getElementById('display');
  const $meaning = document.getElementById('meaning');
  const $count = document.getElementById('count');
  const $status = document.getElementById('status');
  const $screen = document.getElementById('screen');
  const $btnPrev = document.getElementById('prev');
  const $btnNext = document.getElementById('next');
  const $btnFlip = document.getElementById('flip');
  const $btnShuffle = document.getElementById('shuffle');
  const $btnToggleMeaning = document.getElementById('toggleMeaning');
  const $btnRestart = document.getElementById('restart');
  const $btnBackToSetup = document.getElementById('btnBackToSetup');
  const $file = document.getElementById('file');
  const $drop = document.getElementById('drop');
  const $gdriveLink = document.getElementById('gdrive-link');
  const $loadGdrive = document.getElementById('load-gdrive');
  
  function updateMeta(){
    $count.textContent = rows.length ? `${idx + 1} / ${rows.length}개` : '0개';
  }

  function setStatus(text){ $status.textContent = text; }

  function speakJapanese(text) {
    if (!speakEnabled) return;
    // 진행 중인 다른 발화가 있다면 모두 취소하여 현재 단어에 집중합니다.
    synth.cancel();

    // 1. 엔진을 깨우기 위한 아주 짧은 무음 발화를 생성합니다.
    //    볼륨을 0으로, 재생 속도를 최대로 하여 사용자에게는 인지되지 않게 합니다.
    const silence = new SpeechSynthesisUtterance(' ');
    silence.volume = 0;
    silence.rate = 5; // 가능한 한 빨리 끝나도록 재생 속도를 높입니다.

    // 2. 실제 일본어 단어 발화를 생성합니다.
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'ja-JP';

    // 3. 무음 발화를 먼저 큐에 넣고, 그 다음에 실제 단어 발화를 넣습니다.
    synth.speak(silence);
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
    // CHI 면에서는 보조 의미(한글)를 표시하지 않습니다.
    $meaning.textContent = '';
  }
  
  function renderJP(){
    const row = rows[idx] || {};
    $display.className = 'jp';
    $display.textContent = row.jp || (row.meaning ? '...' : 'CSV를 선택하세요');
    updateMeta();
    // 발음은 앞면이 일본어일 때만 재생
    if (row.jp) {
      speakJapanese(row.jp);
    }
    // 의미 표시 토글이 켜져 있으면 일본어와 함께 한글 뜻을 보여줍니다.
    $meaning.textContent = showMeaning ? (row.meaning || '') : '';
  }

  function renderKO(){
    const row = rows[idx] || {};
    $display.className = 'jp';
    $display.textContent = row.meaning || '...';
    updateMeta();
    // KO(단독) 면에서는 보조 의미 영역을 비웁니다.
    $meaning.textContent = '';
  }

  function flipCard() {
    if (!rows.length) return; // 데이터가 없으면 실행하지 않음

    if (flipState === 2) { // 3번째 면에 있다면, 다음 단어로 넘어갑니다.
      nextRow();
    } else {
      // 다음 면으로 이동
      flipState++;
      if (flipState === 1) { // 1번째 뒤집기 -> 2번째 면 (일본어)
        renderJP();
        setStatus('2번째 면');
      } else { // 2번째 뒤집기 -> 3번째 면(원래 한글 뜻) 또는 건너뛰기
        // 만약 의미 토글이 켜져 있고 chi-to-ko 모드라면
        // 3번째 면(단독 한글)을 보여주지 않고 다음 단어로 넘어갑니다.
        if (showMeaning && studyMode === 'chi-to-ko') {
          nextRow();
        } else {
          if (studyMode === 'chi-to-ko') renderKO();
          else renderCHI();
          setStatus('3번째 면');
        }
      }
    }
  }

  function nextRow(){
    if (!rows.length) return;
    idx = (idx + 1) % rows.length;
    flipState = 0; // 첫 면으로 초기화
    if (studyMode === 'chi-to-ko') renderCHI();
    else if (studyMode === 'roma-to-jp') renderKO();
    // 기본값 또는 오류 상황에서는 'chi-to-ko' 모드와 동일하게 처리
    else renderCHI();
    setStatus('다음 단어');
  }

  function prevRow(){
    if (!rows.length) return;
    idx = (idx - 1 + rows.length) % rows.length;
    flipState = 0; // 첫 면으로 초기화
    if (studyMode === 'chi-to-ko') renderCHI();
    else if (studyMode === 'roma-to-jp') renderKO();
    // 기본값 또는 오류 상황에서는 'chi-to-ko' 모드와 동일하게 처리
    else renderCHI();
    setStatus('이전');
    const row = rows[idx] || {};
    $meaning.textContent = showMeaning ? (row.meaning || '') : '';
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
    if (studyMode === 'chi-to-ko') renderCHI();
    else if (studyMode === 'roma-to-jp') renderKO();
    // 기본값 또는 오류 상황에서는 'chi-to-ko' 모드와 동일하게 처리
    else renderCHI();
    setStatus('처음으로 이동');
  }

  function backToSetup() {
    $mainScreen.classList.add('hidden');
    $setupScreen.classList.remove('hidden');
    
    // 상태 초기화
    rows = [];
    idx = 0;
    studyMode = 'chi-to-ko';
    showMeaning = true;
    flipState = 0;
    $btnModeChiKo.classList.add('selected');
    $btnModeRomaJp.classList.remove('selected');
    setStatus('모드 선택됨: 일본어 → 발음. CSV 파일을 로드하세요.');
  }

  /**
   * CSV 텍스트 데이터를 파싱하고 학습 화면을 설정합니다.
   * @param {string} csvText - CSV 파일의 전체 텍스트.
   * @param {string} sourceName - 데이터 출처 (예: 파일명 또는 'Google Drive').
   */
  function processAndStart(csvText, sourceName) {
    try {
      rows = parseCSV(csvText);
      if (!rows.length) throw new Error('CSV에 유효한 행이 없습니다.');
      idx = 0;
      $setupScreen.classList.add('hidden');
      $mainScreen.classList.remove('hidden');
      flipState = 0;
      if (studyMode === 'chi-to-ko') renderCHI();
      else if (studyMode === 'roma-to-jp') renderKO();
      else renderCHI(); // 기본값
      setStatus(`로드 완료: ${sourceName}`);
    } catch(err) {
      $display.className = 'romaji';
      $display.textContent = 'CSV 파싱 실패';
      $meaning.textContent = String(err.message || err);
      setStatus('오류');
    }
  }

  // CSV 파일 읽기 (파일 선택/드래그)
  function loadCSVFile(file){
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => processAndStart(reader.result, file.name);
    reader.onerror = () => {
      setStatus('파일 읽기 실패');
    };
    reader.readAsText(file, 'utf-8');
  }

  /**
   * Google Drive 공유 링크를 직접 다운로드 URL로 변환합니다.
   * @param {string} url - Google Drive 공유 링크
   * @returns {string|null} 변환된 다운로드 URL 또는 null
   */
  function convertGoogleDriveLink(url) {
    // 1. Google Drive 파일 링크 (e.g., .csv 파일)
    const driveRegex = /https:\/\/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/;
    let match = url.match(driveRegex);
    if (match && match[1]) {
      return `https://drive.google.com/uc?export=download&id=${match[1]}`;
    }

    // 2. Google Sheets 문서 링크
    const sheetRegex = /https:\/\/docs\.google\.com\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/;
    match = url.match(sheetRegex);
    if (match && match[1]) {
      const fileId = match[1];
      const gidRegex = /[#&]gid=(\d+)/;
      const gidMatch = url.match(gidRegex);
      const gid = gidMatch ? `&gid=${gidMatch[1]}` : ''; // 특정 시트 ID가 있으면 추가
      return `https://docs.google.com/spreadsheets/d/${fileId}/export?format=csv${gid}`;
    }

    return null;
  }

  // Google Drive 링크로 CSV 로드
  async function loadCSVFromGdrive() {
    const link = $gdriveLink.value.trim();
    if (!link) { setStatus('Google Drive 링크를 입력하세요.'); return; }
    const downloadUrl = convertGoogleDriveLink(link);
    if (!downloadUrl) { setStatus('유효하지 않은 Google Drive 링크 형식입니다.'); return; }
    setStatus('Google Drive에서 파일 불러오는 중...');
    try {
      const response = await fetch(downloadUrl);
      if (!response.ok) throw new Error(`네트워크 응답 실패: ${response.statusText}`);
      const text = await response.text();
      processAndStart(text, 'Google Drive');
    } catch (error) {
      setStatus(`링크 로딩 실패: ${error.message}. 공유 설정을 확인하세요.`);
    }
  }

  // 이벤트
  $btnModeChiKo.addEventListener('click', () => {
    studyMode = 'chi-to-ko';
    $btnModeChiKo.classList.add('selected');
    $btnModeRomaJp.classList.remove('selected');
    setStatus('모드 선택됨: 일본어 → 발음');
  });
  $btnModeRomaJp.addEventListener('click', () => {
    studyMode = 'roma-to-jp';
    $btnModeRomaJp.classList.add('selected');
    $btnModeChiKo.classList.remove('selected');
    setStatus('모드 선택됨: 한국어 → 일본어');
  });
  $btnNext.addEventListener('click', nextRow);
  $btnPrev.addEventListener('click', prevRow);
  $btnFlip.addEventListener('click', flipCard);
  $btnShuffle.addEventListener('click', shuffleRows);
  $btnRestart.addEventListener('click', restart);
  $screen.addEventListener('click', flipCard);
  $loadGdrive.addEventListener('click', loadCSVFromGdrive);
  $btnBackToSetup.addEventListener('click', backToSetup);
  $btnToggleMeaning.addEventListener('click', () => {
    // 토글 상태를 변경하고, 현재 보고 있는 면을 재렌더링합니다.
    showMeaning = !showMeaning;
    // 현재 면에 맞춰 즉시 반영합니다. KO 면(3번째)을 보고 있다가
    // 의미 토글을 켜면 JP 면으로 이동하여 일본어+한글을 보여줍니다.
    if (flipState === 0) {
      renderCHI();
    } else if (flipState === 1) {
      renderJP();
    } else if (flipState === 2) {
      if (showMeaning && studyMode === 'chi-to-ko') {
        // KO를 대신해 JP(+뜻)로 돌아가게끔 상태를 조정합니다.
        flipState = 1;
        renderJP();
      } else {
        // 토글이 꺼지거나 다른 모드면 기존 KO를 유지
        renderKO();
      }
    }
  });

  // 음성 on/off 토글
  if ($btnToggleSpeech) {
    $btnToggleSpeech.addEventListener('click', () => {
      speakEnabled = !speakEnabled;
      $btnToggleSpeech.textContent = speakEnabled ? '🔊' : '🔇';
      setStatus(speakEnabled ? '음성 켜짐' : '음성 꺼짐');
    });
    // 초기 버튼 표시
    $btnToggleSpeech.textContent = speakEnabled ? '🔊' : '🔇';
  }

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

  // Google Drive 링크 입력창에서 Enter 키로 로드
  $gdriveLink.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); loadCSVFromGdrive(); }
  });

  // 초기 상태
  $btnModeChiKo.classList.add('selected');
  setStatus('모드 선택됨: 일본어 → 발음. CSV 파일을 로드하세요.');
})();