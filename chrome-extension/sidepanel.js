const uploadArea = document.getElementById('uploadArea');
const fileInput = document.getElementById('fileInput');
const browseBtn = document.getElementById('browseBtn');
const previewSection = document.getElementById('previewSection');
const previewImg = document.getElementById('previewImg');
const fileName = document.getElementById('fileName');
const processBtn = document.getElementById('processBtn');
const progressSection = document.getElementById('progressSection');
const progressFill = document.getElementById('progressFill');
const progressPercent = document.getElementById('progressPercent');
const progressStatus = document.getElementById('progressStatus');
const resultSection = document.getElementById('resultSection');
const resultText = document.getElementById('resultText');
const copyBtn = document.getElementById('copyBtn');
const downloadBtn = document.getElementById('downloadBtn');
const errorSection = document.getElementById('errorSection');
const errorText = document.getElementById('errorText');
const resetBtn = document.getElementById('resetBtn');
const charCount = document.getElementById('charCount');
const wordCount = document.getElementById('wordCount');
const lineCount = document.getElementById('lineCount');

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
let currentFile = null;

browseBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  fileInput.click();
});

uploadArea.addEventListener('click', () => {
  fileInput.click();
});

uploadArea.addEventListener('dragover', (e) => {
  e.preventDefault();
  uploadArea.classList.add('dragover');
});

uploadArea.addEventListener('dragleave', () => {
  uploadArea.classList.remove('dragover');
});

uploadArea.addEventListener('drop', (e) => {
  e.preventDefault();
  uploadArea.classList.remove('dragover');
  const file = e.dataTransfer.files[0];
  if (file) handleFile(file);
});

fileInput.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (file) handleFile(file);
});

function handleFile(file) {
  if (!ALLOWED_TYPES.includes(file.type)) {
    showError('Unsupported file format. Please use JPG, JPEG, PNG, or WebP.');
    return;
  }

  if (file.size > 20 * 1024 * 1024) {
    showError('File is too large. Maximum size is 20MB.');
    return;
  }

  currentFile = file;
  hideError();
  hideResult();
  hideProgress();

  const reader = new FileReader();
  reader.onload = (e) => {
    previewImg.src = e.target.result;
    fileName.textContent = file.name;
    previewSection.classList.add('visible');
    resetBtn.classList.add('visible');
  };
  reader.readAsDataURL(file);
}

processBtn.addEventListener('click', async () => {
  if (!currentFile) return;

  processBtn.disabled = true;
  processBtn.innerHTML = '<div class="spinner"></div> Processing...';
  showProgress();
  hideResult();
  hideError();

  let worker = null;
  try {
    worker = await Tesseract.createWorker('eng', 1, {
      workerPath: chrome.runtime.getURL('worker.min.js'),
      corePath: 'https://cdn.jsdelivr.net/npm/tesseract.js-core@4/tesseract-core.wasm.js',
      workerBlobURL: false,
      logger: (m) => {
        if (m.status === 'recognizing text') {
          const pct = Math.round(m.progress * 100);
          progressFill.style.width = pct + '%';
          progressPercent.textContent = pct + '%';
          progressStatus.textContent = 'Recognizing text...';
        } else if (m.status === 'loading language traineddata') {
          progressStatus.textContent = 'Loading language data...';
          progressFill.style.width = '30%';
          progressPercent.textContent = '30%';
        } else if (m.status === 'initializing api') {
          progressStatus.textContent = 'Initializing OCR engine...';
          progressFill.style.width = '10%';
          progressPercent.textContent = '10%';
        } else if (m.status === 'loading tesseract core') {
          progressStatus.textContent = 'Loading OCR core...';
          progressFill.style.width = '5%';
          progressPercent.textContent = '5%';
        } else if (m.status === 'initializing tesseract') {
          progressStatus.textContent = 'Initializing engine...';
          progressFill.style.width = '15%';
          progressPercent.textContent = '15%';
        }
      },
    });

    const { data } = await worker.recognize(currentFile);
    const text = data.text.trim();

    if (!text) {
      showError('No text was detected in this image. Try an image with clearer text.');
      hideProgress();
      resetProcessBtn();
      await worker.terminate();
      return;
    }

    resultText.value = text;
    updateStats(text);
    hideProgress();
    showResult();
  } catch (err) {
    showError('OCR processing failed: ' + (err.message || 'Unknown error'));
    hideProgress();
  }

  if (worker) {
    try { await worker.terminate(); } catch {}
  }

  resetProcessBtn();
});

function resetProcessBtn() {
  processBtn.disabled = false;
  processBtn.innerHTML = `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <polyline points="4 7 4 4 20 4 20 7"/>
      <line x1="9" y1="20" x2="15" y2="20"/>
      <line x1="12" y1="4" x2="12" y2="20"/>
    </svg>
    Extract Text`;
}

copyBtn.addEventListener('click', async () => {
  const text = resultText.value;
  if (!text) return;

  try {
    await navigator.clipboard.writeText(text);
    copyBtn.classList.add('copied');
    copyBtn.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="20 6 9 17 4 12"/>
      </svg>
      Copied!`;

    setTimeout(() => {
      copyBtn.classList.remove('copied');
      copyBtn.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
        </svg>
        Copy`;
    }, 2000);
  } catch {
    resultText.select();
    document.execCommand('copy');
  }
});

downloadBtn.addEventListener('click', () => {
  const text = resultText.value;
  if (!text) return;

  const blob = new Blob([text], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;

  const baseName = currentFile ? currentFile.name.replace(/\.[^.]+$/, '') : 'extracted';
  a.download = baseName + '_text.txt';

  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
});

resetBtn.addEventListener('click', () => {
  currentFile = null;
  fileInput.value = '';
  previewSection.classList.remove('visible');
  hideProgress();
  hideResult();
  hideError();
  resetBtn.classList.remove('visible');
});

function showProgress() {
  progressSection.classList.add('visible');
  progressFill.style.width = '0%';
  progressPercent.textContent = '0%';
  progressStatus.textContent = 'Initializing OCR engine...';
}

function hideProgress() {
  progressSection.classList.remove('visible');
}

function showResult() {
  resultSection.classList.add('visible');
}

function hideResult() {
  resultSection.classList.remove('visible');
}

function showError(msg) {
  errorText.textContent = msg;
  errorSection.classList.add('visible');
}

function hideError() {
  errorSection.classList.remove('visible');
}

function updateStats(text) {
  charCount.textContent = text.length;
  wordCount.textContent = text.split(/\s+/).filter(w => w.length > 0).length;
  lineCount.textContent = text.split('\n').length;
}
