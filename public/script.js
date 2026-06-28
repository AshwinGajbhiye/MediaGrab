/**
 * ReelGrab — Frontend Logic
 * Handles URL input, API calls, and download UI.
 */

(() => {
  'use strict';

  // ─── DOM Elements ───
  const urlInput = document.getElementById('url-input');
  const clearBtn = document.getElementById('clear-btn');
  const fetchBtn = document.getElementById('fetch-btn');
  const errorContainer = document.getElementById('error-container');
  const errorText = document.getElementById('error-text');
  const resultSection = document.getElementById('result-section');
  const resultThumbnail = document.getElementById('result-thumbnail');
  const resultDescription = document.getElementById('result-description');
  const downloadButtons = document.getElementById('download-buttons');

  // ─── State ───
  let isLoading = false;

  // ─── Helpers ───
  function getUrlType(url) {
    if (/(?:https?:\/\/)?(?:www\.)?instagram\.com\/(?:reel|reels|p|tv)\/[\w-]+/i.test(url)) return 'instagram';
    if (/(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:watch\?v=|shorts\/)|youtu\.be\/)[\w-]+/i.test(url)) return 'youtube';
    return null;
  }

  function showError(message) {
    errorText.textContent = message;
    errorContainer.hidden = false;
    resultSection.hidden = true;
  }

  function hideError() {
    errorContainer.hidden = true;
  }

  function setLoading(loading) {
    isLoading = loading;
    fetchBtn.disabled = loading;

    const btnText = fetchBtn.querySelector('.btn-text');
    const btnLoader = fetchBtn.querySelector('.btn-loader');
    const btnArrow = fetchBtn.querySelector('.btn-arrow');

    if (loading) {
      btnText.hidden = true;
      btnArrow.style.display = 'none';
      btnLoader.hidden = false;
    } else {
      btnText.hidden = false;
      btnArrow.style.display = '';
      btnLoader.hidden = true;
    }
  }

  function createDownloadIcon() {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('width', '18');
    svg.setAttribute('height', '18');

    const path1 = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path1.setAttribute('d', 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4');
    path1.setAttribute('stroke', 'currentColor');
    path1.setAttribute('stroke-width', '2');
    path1.setAttribute('stroke-linecap', 'round');
    path1.setAttribute('stroke-linejoin', 'round');

    const polyline = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
    polyline.setAttribute('points', '7 10 12 15 17 10');
    polyline.setAttribute('stroke', 'currentColor');
    polyline.setAttribute('stroke-width', '2');
    polyline.setAttribute('stroke-linecap', 'round');
    polyline.setAttribute('stroke-linejoin', 'round');

    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('x1', '12');
    line.setAttribute('y1', '15');
    line.setAttribute('x2', '12');
    line.setAttribute('y2', '3');
    line.setAttribute('stroke', 'currentColor');
    line.setAttribute('stroke-width', '2');
    line.setAttribute('stroke-linecap', 'round');

    svg.append(path1, polyline, line);
    return svg;
  }

  function showResult(data) {
    resultSection.hidden = false;

    // Thumbnail
    if (data.metadata?.thumbnail) {
      resultThumbnail.src = data.metadata.thumbnail;
      resultThumbnail.style.display = '';
    } else {
      resultThumbnail.style.display = 'none';
    }

    // Description
    const desc = data.metadata?.description || data.metadata?.title || 'Instagram Reel';
    resultDescription.textContent = desc;

    // Download buttons
    downloadButtons.innerHTML = '';

    data.videos.forEach((video, index) => {
      const btn = document.createElement('a');
      const downloadUrl = `/api/download?url=${encodeURIComponent(video.url)}&original=${encodeURIComponent(urlInput.value.trim())}`;
      btn.href = downloadUrl;
      btn.className = `download-btn${index > 0 ? ' secondary' : ''}`;
      btn.target = '_blank';
      btn.rel = 'noopener noreferrer';
      btn.id = `download-btn-${index}`;

      btn.appendChild(createDownloadIcon());

      const text = document.createElement('span');
      text.textContent = video.quality;
      btn.appendChild(text);

      downloadButtons.appendChild(btn);
    });

    // Smooth scroll to result
    resultSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  // ─── Core: Fetch Media ───
  async function fetchMedia() {
    const url = urlInput.value.trim();

    if (!url) {
      showError('Please paste a URL first.');
      urlInput.focus();
      return;
    }

    const type = getUrlType(url);
    if (!type) {
      showError("That doesn\'t look like a valid Instagram or YouTube URL.");
      urlInput.focus();
      return;
    }

    hideError();
    resultSection.hidden = true;
    setLoading(true);

    try {
      const endpoint = type === 'youtube' ? '/api/fetch-youtube' : '/api/fetch-reel';
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });

      const data = await response.json();

      if (!response.ok) {
        showError(data.error || 'Something went wrong. Please try again.');
        return;
      }

      if (!data.success || !data.videos?.length) {
        showError('Could not find any downloadable video in this reel. It might be private or restricted.');
        return;
      }

      showResult(data);
    } catch (err) {
      console.error('Fetch error:', err);
      showError('Network error — please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }

  // ─── Event Listeners ───

  // Clear button visibility
  urlInput.addEventListener('input', () => {
    clearBtn.hidden = !urlInput.value;
  });

  // Clear input
  clearBtn.addEventListener('click', () => {
    urlInput.value = '';
    clearBtn.hidden = true;
    hideError();
    resultSection.hidden = true;
    urlInput.focus();
  });

  // Fetch on button click
  fetchBtn.addEventListener('click', () => {
    if (!isLoading) fetchMedia();
  });

  // Fetch on Enter key
  urlInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !isLoading) {
      e.preventDefault();
      fetchMedia();
    }
  });

  // Handle paste — auto-trigger if pasted content is a valid URL
  urlInput.addEventListener('paste', (e) => {
    // Short delay to let the paste complete
    setTimeout(() => {
      const pastedText = urlInput.value.trim();
      if (getUrlType(pastedText)) {
        fetchMedia();
      }
    }, 100);
  });
})();
