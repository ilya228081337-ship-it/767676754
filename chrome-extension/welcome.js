document.getElementById('startBtn').addEventListener('click', () => {
  chrome.sidePanel.setOptions({ path: 'sidepanel.html' });
});
