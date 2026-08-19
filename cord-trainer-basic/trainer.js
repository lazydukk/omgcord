// Simple Scrabble coordinate trainer with timed sessions
(() => {
  const COLS = 15;
  const ROWS = 15;
  const LETTERS = Array.from({length:COLS}, (_,i) => String.fromCharCode(65 + i)); // A..O
  const STORAGE_KEY = 'coordinate-trainer:results';

  // DOM
  const boardEl = document.getElementById('board');
  const targetEl = document.getElementById('target');
  const coordInput = document.getElementById('coordInput');
  const submitBtn = document.getElementById('submitBtn');
  const nextBtn = document.getElementById('nextBtn');
  const resetBtn = document.getElementById('resetBtn');
  const exportBtn = document.getElementById('exportBtn');
  const importFile = document.getElementById('importFile');
  const timeLimitSelect = document.getElementById('timeLimit');
  const startSessionBtn = document.getElementById('startSessionBtn');
  const stopSessionBtn = document.getElementById('stopSessionBtn');
  const timeLeftEl = document.getElementById('timeLeft');

  const totalEl = document.getElementById('total');
  const correctEl = document.getElementById('correct');
  const accuracyEl = document.getElementById('accuracy');
  const avgTimeEl = document.getElementById('avgTime');

  // State
  let target = null;
  let targetStart = 0;
  let results = loadResults();

  // session state
  let sessionActive = false;
  let sessionId = null;
  let sessionStartTime = 0;
  let sessionLengthSec = Number(timeLimitSelect.value) || 30;
  let sessionTimer = null;
  let sessionAttemptIndex = 0;

  // Build board UI
  function buildBoard(){
    boardEl.innerHTML = '';

    // top-left empty
    const corner = document.createElement('div');
    corner.className = 'col-label';
    boardEl.appendChild(corner);

    // column headers
    for(let c=0;c<COLS;c++){
      const lab = document.createElement('div');
      lab.className = 'col-label';
      lab.textContent = LETTERS[c];
      boardEl.appendChild(lab);
    }

    // rows
    for(let r=1;r<=ROWS;r++){
      const rowLab = document.createElement('div');
      rowLab.className = 'row-label';
      rowLab.textContent = r;
      boardEl.appendChild(rowLab);

      for(let c=0;c<COLS;c++){
        const cell = document.createElement('div');
        cell.className = 'cell';
        cell.dataset.col = LETTERS[c];
        cell.dataset.row = String(r);
        cell.dataset.coord = `${LETTERS[c]}${r}`;
        cell.title = cell.dataset.coord;
        cell.addEventListener('click', onCellClick);
        boardEl.appendChild(cell);
      }
    }
  }

  function pickRandomTarget(){
    const c = Math.floor(Math.random()*COLS);
    const r = Math.floor(Math.random()*ROWS) + 1;
    return `${LETTERS[c]}${r}`;
  }

  function showTarget(coord){
    clearCellHighlights();
    target = coord;
    targetEl.textContent = coord;
    targetStart = performance.now();
  }

  function clearCellHighlights(){
    document.querySelectorAll('.cell.target, .cell.correct, .cell.wrong').forEach(el=>{
      el.classList.remove('target','correct','wrong');
    });
  }

  function findCell(coord){
    return document.querySelector(`.cell[data-coord="${coord.toUpperCase()}"]`);
  }

  function onCellClick(e){
    const coord = e.currentTarget.dataset.coord;
    handleAnswer(coord);
  }

  function handleAnswer(coord){
    if(!target) return;
    const timeMs = Math.round(performance.now() - targetStart);
    const isCorrect = coord.toUpperCase() === target.toUpperCase();

    // highlight
    clearCellHighlights();
    const cell = findCell(coord);
    if(cell){
      cell.classList.add(isCorrect ? 'correct' : 'wrong');
    }
    const targetCell = findCell(target);
    if(targetCell && !isCorrect){
      targetCell.classList.add('target');
    }

    // record
    const attemptIndex = ++sessionAttemptIndex;
    const record = {
      timestamp: new Date().toISOString(),
      sessionId: sessionId || 'none',
      sessionLengthSec: sessionLengthSec || null,
      attemptIndex,
      target,
      response: coord.toUpperCase(),
      correct: Boolean(isCorrect),
      timeMs
    };
    results.push(record);
    saveResults(results);
    refreshStats();

    // during an active timed session, immediately give next target
    if(sessionActive){
      // small delay to show feedback
      setTimeout(()=>{
        const t = pickRandomTarget();
        showTarget(t);
      }, 220);
    }else{
      // auto next after short delay if correct when not in timed session
      if(isCorrect){
        setTimeout(() => nextRound(), 350);
      }
    }
  }

  function nextRound(){
    const t = pickRandomTarget();
    showTarget(t);
    coordInput.value = '';
    coordInput.focus();
  }

  function onSubmit(){
    const v = coordInput.value.trim().toUpperCase();
    if(!v) return;
    // allow formats like A1 or 8H -> normalize
    let coord = null;
    const m1 = v.match(/^([A-O])\s*(1[0-5]|[1-9])$/i);
    if(m1) coord = m1[1].toUpperCase() + String(parseInt(m1[2],10));
    else{
      const m2 = v.match(/^(\d{1,2})\s*([A-O])$/i);
      if(m2) coord = m2[2].toUpperCase() + String(parseInt(m2[1],10));
    }
    if(!coord){ alert('Invalid coordinate. Use format A1..O15'); return; }
    handleAnswer(coord);
    coordInput.value = '';
  }

  // Storage
  function saveResults(arr){
    try{
      localStorage.setItem(STORAGE_KEY, JSON.stringify(arr));
    }catch(e){
      console.warn('Could not save results', e);
    }
  }
  function loadResults(){
    try{
      const raw = localStorage.getItem(STORAGE_KEY);
      if(raw) return JSON.parse(raw);
    }catch(e){}
    return [];
  }

  function refreshStats(){
    const total = results.length;
    const correct = results.filter(r=>r.correct).length;
    const avg = total ? Math.round(results.reduce((s,r)=>s+r.timeMs,0)/total) : 0;
    const acc = total ? Math.round(correct/total*100) : 0;
    totalEl.textContent = total;
    correctEl.textContent = correct;
    accuracyEl.textContent = acc + '%';
    avgTimeEl.textContent = avg + ' ms';
  }

  // Export / Import CSV
  function exportCSV(){
    if(results.length===0){
      alert('No results to export');
      return;
    }
    // headers include session metadata and attempt index
    const headers = ['timestamp','sessionId','sessionLengthSec','attemptIndex','target','response','correct','timeMs'];
    const lines = [headers.join(',')].concat(results.map(r =>
      [r.timestamp, r.sessionId, r.sessionLengthSec || '', r.attemptIndex || '', r.target, r.response, r.correct ? '1' : '0', r.timeMs].join(',')
    ));
    const csv = lines.join('\n');
    const blob = new Blob([csv], {type:'text/csv'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `scrabble-trainer-results-${new Date().toISOString().slice(0,10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function importCSVFile(file){
    const reader = new FileReader();
    reader.onload = () => {
      try{
        const text = reader.result;
        const rows = text.split(/\r?\n/).map(l=>l.trim()).filter(l=>l.length);
        if(rows.length<=1) { alert('CSV empty or missing rows'); return; }
        const headers = rows[0].split(',').map(h=>h.trim());
        // expected headers may vary; try to map
        const newRows = [];
        for(let i=1;i<rows.length;i++){
          const cols = rows[i].split(',').map(c=>c.trim());
          if(cols.length < 4) continue;
          // support both old and new formats
          // try to detect by headers
          let rec = null;
          if(headers.includes('sessionId')){
            rec = {
              timestamp: cols[headers.indexOf('timestamp')] || new Date().toISOString(),
              sessionId: cols[headers.indexOf('sessionId')] || 'none',
              sessionLengthSec: Number(cols[headers.indexOf('sessionLengthSec')]) || null,
              attemptIndex: Number(cols[headers.indexOf('attemptIndex')]) || null,
              target: cols[headers.indexOf('target')] || '',
              response: cols[headers.indexOf('response')] || '',
              correct: (cols[headers.indexOf('correct')] === '1') || (cols[headers.indexOf('correct')] && cols[headers.indexOf('correct')].toLowerCase()==='true'),
              timeMs: Number(cols[headers.indexOf('timeMs')]) || 0
            };
          }else{
            // fallback to older simple format timestamp,target,response,correct,timeMs
            rec = {
              timestamp: cols[0] || new Date().toISOString(),
              target: cols[1] || '',
              response: cols[2] || '',
              correct: (cols[3] === '1') || (cols[3] && cols[3].toLowerCase()==='true'),
              timeMs: Number(cols[4]) || 0,
              sessionId: 'imported',
              sessionLengthSec: null,
              attemptIndex: null
            };
          }
          newRows.push(rec);
        }
        if(newRows.length===0){ alert('No valid rows found'); return; }
        // merge
        results = results.concat(newRows);
        saveResults(results);
        refreshStats();
        alert(`Imported ${newRows.length} rows`);
      }catch(err){
        console.error(err);
        alert('Failed to import CSV');
      }
    };
    reader.readAsText(file);
  }

  // Reset
  function resetStats(){
    if(!confirm('Clear all saved results?')) return;
    results = [];
    saveResults(results);
    refreshStats();
    clearCellHighlights();
  }

  // Session management
  function startSession(){
    if(sessionActive) return;
    sessionLengthSec = Number(timeLimitSelect.value) || 30;
    sessionId = `s_${Date.now()}`;
    sessionStartTime = Date.now();
    sessionAttemptIndex = 0;
    sessionActive = true;
    startSessionBtn.disabled = true;
    stopSessionBtn.disabled = false;
    timeLimitSelect.disabled = true;
    coordInput.focus();

    // start timer update
    updateTimeLeft();
    sessionTimer = setInterval(()=>{
      updateTimeLeft();
      const elapsed = Math.floor((Date.now() - sessionStartTime)/1000);
      if(elapsed >= sessionLengthSec){
        stopSession();
      }
    }, 200);

    // immediate first target
    const t = pickRandomTarget();
    showTarget(t);
  }

  function updateTimeLeft(){
    const elapsed = Math.floor((Date.now() - sessionStartTime)/1000);
    const left = Math.max(0, sessionLengthSec - elapsed);
    timeLeftEl.textContent = `${left}s`;
  }

  function stopSession(){
    if(!sessionActive) return;
    sessionActive = false;
    clearInterval(sessionTimer);
    sessionTimer = null;
    startSessionBtn.disabled = false;
    stopSessionBtn.disabled = true;
    timeLimitSelect.disabled = false;
    timeLeftEl.textContent = '—';
    // clear target so user knows session ended
    target = null;
    targetEl.textContent = '—';
    alert('Session finished. Results saved.');
  }

  // Wire up
  buildBoard();
  refreshStats();
  nextRound();

  submitBtn.addEventListener('click', onSubmit);
  coordInput.addEventListener('keydown', (e)=>{
    if(e.key === 'Enter') onSubmit();
  });
  nextBtn.addEventListener('click', nextRound);
  resetBtn.addEventListener('click', resetStats);
  exportBtn.addEventListener('click', exportCSV);
  importFile.addEventListener('change', (e)=>{
    const f = e.target.files && e.target.files[0];
    if(f) importCSVFile(f);
    importFile.value = '';
  });

  startSessionBtn.addEventListener('click', startSession);
  stopSessionBtn.addEventListener('click', stopSession);

  // keyboard shortcuts: press space => next, esc => clear
  window.addEventListener('keydown', e=>{
    if(e.code === 'Space'){ e.preventDefault(); nextRound(); }
    if(e.key === 'Escape'){ coordInput.value = ''; coordInput.blur(); }
  });

})();
