// ==UserScript==
// @name         BOOTH Orders - Download All
// @namespace    https://booth.pm/
// @version      1.1.1
// @description  Adds a "Download All" button to BOOTH orders page that downloads all files as a ZIP
// @author       DjShinter
// @copyright    2025, DjShinter (https://shinter.dev)
// @license     CC-BY-NC-SA-4.0; https://creativecommons.org/licenses/by-nc-sa/4.0/legalcode
// @license     GPL-3.0-or-later; https://www.gnu.org/licenses/gpl-3.0.txt
// @homepageURL  https://shinter.dev
// @supportURL   https://github.com/DjShinter/BoothDL/issues
// @updateURL    https://openuserjs.org/meta/djshinter/booth-download-all.meta.js
// @match        https://accounts.booth.pm/orders/*
// @run-at       document-idle
// @grant        GM_xmlhttpRequest
// @grant        GM_setValue
// @grant        GM_getValue
// @connect      booth.pm
// @connect      *.booth.pm
// @connect      booth.pximg.net
// @connect      *
// @require      https://cdn.jsdelivr.net/npm/fflate@0.8.2/umd/index.js
// ==/UserScript==

(function () {
  'use strict';

  const BUTTON_ID = 'booth-download-all-button';
  const STATUS_ID = 'booth-download-all-status';
  const SETTINGS_BTN_ID = 'booth-download-all-settings-btn';
  const SETTINGS_MODAL_ID = 'booth-download-all-settings-modal';

  // Default settings
  const DEFAULT_SETTINGS = {
    rateLimitEnabled: false,
    maxParallel: 5,
    delayMs: 3000
  };

  function log(...args) {
    console.log('[BOOTH DL All]', ...args);
  }

  // Settings management
  function getSettings() {
    const stored = GM_getValue('boothDL_settings', null);
    return stored ? JSON.parse(stored) : { ...DEFAULT_SETTINGS };
  }

  function saveSettings(settings) {
    GM_setValue('boothDL_settings', JSON.stringify(settings));
    log('Settings saved:', settings);
  }

  function findDownloadAnchors() {
    const anchors = Array.from(
      document.querySelectorAll('a[href^="https://booth.pm/downloadables/"]')
    );
    const seen = new Set();
    return anchors.filter(a => {
      const href = a.href;
      if (!href || seen.has(href)) return false;
      seen.add(href);
      return true;
    });
  }

  function getProductName() {
    const productLink = document.querySelector('a.nav[href*="/items/"]');
    if (productLink) {
      let name = productLink.textContent.trim();
      // Only remove truly invalid filesystem characters (Windows/Mac/Linux)
      name = name.replace(/[<>:"/\\|?*\x00-\x1f]/g, '_');
      // Truncate if too long (Windows has 255 char limit)
      if (name.length > 200) {
        name = name.substring(0, 200);
      }
      return name.trim() || 'BOOTH_Download';
    }
    return 'BOOTH_Download';
  }

  function extractFilenameFromHeaders(headers, fallbackUrl) {
    try {
      const lines = headers.split('\n');
      for (let line of lines) {
        if (line.toLowerCase().includes('content-disposition')) {
          // Try quoted filename
          let match = line.match(/filename\*?=\s*"([^"]+)"/i);
          if (match) {
            let filename = match[1];
            // Try to decode if URL-encoded
            try {
              filename = decodeURIComponent(filename);
            } catch (e) {
              // Already decoded or invalid encoding, keep as-is
            }
            filename = filename.split('?')[0];
            return filename;
          }
          // Try UTF-8 encoded filename (RFC 5987)
          match = line.match(/filename\*=UTF-8''([^;\s]+)/i);
          if (match) {
            let filename = match[1];
            try {
              filename = decodeURIComponent(filename);
            } catch (e) {}
            filename = filename.split('?')[0];
            return filename;
          }
          // Try unquoted filename
          match = line.match(/filename\*?=\s*([^;\s]+)/i);
          if (match) {
            let filename = match[1].replace(/['"]/g, '');
            try {
              filename = decodeURIComponent(filename);
            } catch (e) {}
            filename = filename.split('?')[0];
            return filename;
          }
        }
      }
    } catch (e) {
      console.error('Error extracting filename:', e);
    }
    let filename = (fallbackUrl || '').split('/').pop() || 'file.bin';
    // Try to decode URL-encoded fallback filename
    try {
      filename = decodeURIComponent(filename);
    } catch (e) {}
    filename = filename.split('?')[0];
    return filename;
  }

  async function downloadFile(url) {
    log('Downloading:', url);

    return new Promise((resolve, reject) => {
      GM_xmlhttpRequest({
        method: 'GET',
        url: url,
        responseType: 'arraybuffer',
        anonymous: false,  // Include cookies for authentication
        // Let GM_xmlhttpRequest follow redirects automatically
        onload: function(response) {
          if (response.status >= 200 && response.status < 300) {
            const filename = extractFilenameFromHeaders(response.responseHeaders || '', response.finalUrl || url);
            log('Downloaded:', filename, '(' + (response.response.byteLength / 1024 / 1024).toFixed(2) + ' MB)');

            resolve({
              filename: filename,
              data: response.response
            });
          } else {
            reject(new Error('Failed to download: ' + response.status));
          }
        },
        onerror: function(error) {
          reject(error);
        }
        // No timeout - let large files download as long as they need
      });
    });
  }

  // Download files with rate limiting
  async function downloadFilesWithRateLimit(anchors, statusDiv) {
    const settings = getSettings();
    const files = [];

    if (!settings.rateLimitEnabled) {
      // No rate limiting - download all in parallel
      log('Rate limiting disabled, downloading all files in parallel');
      let completed = 0;
      const downloadPromises = anchors.map(async (anchor) => {
        try {
          const file = await downloadFile(anchor.href);
          completed++;
          statusDiv.textContent = 'Downloaded ' + completed + '/' + anchors.length + ' files';
          return file;
        } catch (error) {
          console.error('Failed to download ' + anchor.href + ':', error);
          completed++;
          return null;
        }
      });
      return (await Promise.all(downloadPromises)).filter(f => f !== null);
    }

    // Rate limiting enabled - download in batches
    log('Rate limiting enabled: ' + settings.maxParallel + ' parallel, ' + settings.delayMs + 'ms delay');
    const batchSize = settings.maxParallel;
    let completed = 0;

    for (let i = 0; i < anchors.length; i += batchSize) {
      const batch = anchors.slice(i, i + batchSize);
      log('Downloading batch ' + (Math.floor(i / batchSize) + 1) + ' (' + batch.length + ' files)');

      const batchPromises = batch.map(async (anchor) => {
        try {
          const file = await downloadFile(anchor.href);
          completed++;
          statusDiv.textContent = 'Downloaded ' + completed + '/' + anchors.length + ' files (Rate Limited)';
          return file;
        } catch (error) {
          console.error('Failed to download ' + anchor.href + ':', error);
          completed++;
          return null;
        }
      });

      const batchResults = await Promise.all(batchPromises);
      files.push(...batchResults.filter(f => f !== null));

      // Add delay between batches (except for the last batch)
      if (i + batchSize < anchors.length) {
        log('Waiting ' + settings.delayMs + 'ms before next batch...');
        await new Promise(resolve => setTimeout(resolve, settings.delayMs));
      }
    }

    return files;
  }

  // Create settings modal
  function createSettingsModal() {
    if (document.getElementById(SETTINGS_MODAL_ID)) return;

    const settings = getSettings();

    const modal = document.createElement('div');
    modal.id = SETTINGS_MODAL_ID;
    modal.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.6);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10000;
    `;

    const panel = document.createElement('div');
    panel.style.cssText = `
      background: white;
      padding: 24px;
      border-radius: 8px;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
      max-width: 400px;
      width: 90%;
    `;

    panel.innerHTML = `
      <style>
        .toggle-switch {
          position: relative;
          display: inline-block;
          width: 48px;
          height: 24px;
        }
        .toggle-switch input {
          opacity: 0;
          width: 0;
          height: 0;
        }
        .toggle-slider {
          position: absolute;
          cursor: pointer;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background-color: #ccc;
          transition: 0.3s;
          border-radius: 24px;
        }
        .toggle-slider:before {
          position: absolute;
          content: "";
          height: 18px;
          width: 18px;
          left: 3px;
          bottom: 3px;
          background-color: white;
          transition: 0.3s;
          border-radius: 50%;
        }
        .toggle-switch input:checked + .toggle-slider {
          background-color: #fc5185;
        }
        .toggle-switch input:checked + .toggle-slider:before {
          transform: translateX(24px);
        }
      </style>

      <h3 style="margin: 0 0 16px 0; font-size: 18px; color: #333;">Download Settings</h3>

      <div style="margin-bottom: 16px;">
        <label style="display: flex; align-items: center; cursor: pointer; justify-content: space-between;">
          <div>
            <div style="font-size: 14px; color: #333; margin-bottom: 4px;">Enable Rate Limiting</div>
            <p style="margin: 0; font-size: 12px; color: #666;">
              Helps avoid getting blocked when downloading many files
            </p>
          </div>
          <label class="toggle-switch">
            <input type="checkbox" id="rateLimitEnabled" ${settings.rateLimitEnabled ? 'checked' : ''}>
            <span class="toggle-slider"></span>
          </label>
        </label>
      </div>

      <div style="margin-bottom: 16px;">
        <label style="display: block; font-size: 14px; color: #333; margin-bottom: 4px;">
          Max Parallel Downloads
        </label>
        <input type="number" id="maxParallel" value="${settings.maxParallel}" min="1" max="20"
               style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px;">
        <p style="margin: 4px 0 0 0; font-size: 12px; color: #666;">
          Number of files to download simultaneously (1-20)
        </p>
      </div>

      <div style="margin-bottom: 20px;">
        <label style="display: block; font-size: 14px; color: #333; margin-bottom: 4px;">
          Delay Between Batches (ms)
        </label>
        <input type="number" id="delayMs" value="${settings.delayMs}" min="0" max="99999" step="100"
               style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px;">
        <p style="margin: 4px 0 0 0; font-size: 12px; color: #666;">
          Wait time between batches in milliseconds (0-99999)
        </p>
      </div>

      <div style="display: flex; gap: 8px; justify-content: flex-end;">
        <button id="cancelSettings" style="padding: 8px 16px; border: 1px solid #ddd; background: white;
                border-radius: 4px; cursor: pointer; font-size: 14px; color: #333;">
          Cancel
        </button>
        <button id="saveSettings" style="padding: 8px 16px; border: none; background: #fc5185;
                color: white; border-radius: 4px; cursor: pointer; font-size: 14px; font-weight: 500;">
          Save
        </button>
      </div>
    `;

    modal.appendChild(panel);
    document.body.appendChild(modal);

    // Event listeners
    document.getElementById('cancelSettings').addEventListener('click', () => {
      modal.remove();
    });

    document.getElementById('saveSettings').addEventListener('click', () => {
      const newSettings = {
        rateLimitEnabled: document.getElementById('rateLimitEnabled').checked,
        maxParallel: parseInt(document.getElementById('maxParallel').value) || 5,
        delayMs: parseInt(document.getElementById('delayMs').value) || 3000
      };

      // Validate
      newSettings.maxParallel = Math.max(1, Math.min(20, newSettings.maxParallel));
      newSettings.delayMs = Math.max(0, Math.min(99999, newSettings.delayMs));

      saveSettings(newSettings);
      modal.remove();
    });

    // Close on background click
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.remove();
      }
    });
  }

  function createButton() {
    if (document.getElementById(BUTTON_ID)) return;

    // Look for the spacing div before the list
    const spacingDiv = document.querySelector('.u-mt-300');
    if (!spacingDiv) {
      log('Spacing div not found yet.');
      return;
    }

    const lists = document.querySelectorAll('.list.list--collapse');
    if (!lists.length) {
      log('List container not found yet.');
      return;
    }

    // Create a Booth-styled list item matching the exact structure
    const listItem = document.createElement('div');
    listItem.className = 'legacy-list-item';

    const center = document.createElement('div');
    center.className = 'legacy-list-item__center u-tpg-caption1';
    center.style.cssText = 'flex: 1;';

    // Left side - status only
    const leftDiv = document.createElement('div');
    leftDiv.className = 'min-w-0 u-text-wrap';
    leftDiv.style.cssText = 'color: #505c6b; flex: 1;';

    const statusDiv = document.createElement('div');
    statusDiv.id = STATUS_ID;
    statusDiv.style.fontSize = '12px';
    statusDiv.style.color = '#505c6b';
    statusDiv.style.display = 'none';
    statusDiv.style.whiteSpace = 'pre-line';
    leftDiv.appendChild(statusDiv);

    // Right side - button wrapper matching Booth structure
    const rightWrap = document.createElement('div');
    rightWrap.className = 'flex items-center';
    rightWrap.style.cssText = 'margin-top: 8px; flex: none;';

    const spacer = document.createElement('div');

    const actionDiv = document.createElement('div');
    actionDiv.className = 'u-ml-500 u-mr-sp-500';
    actionDiv.style.cssText = 'display: flex; gap: 8px;';

    // Create settings button
    const settingsBtn = document.createElement('a');
    settingsBtn.id = SETTINGS_BTN_ID;
    settingsBtn.href = 'javascript:void(0)';
    settingsBtn.className = 'nav-reverse';
    settingsBtn.title = 'Download Settings';
    settingsBtn.style.cssText = 'font-size: 18px; display: flex; align-items: center;';

    const settingsIcon = document.createElement('span');
    settingsIcon.textContent = '⚙';
    settingsIcon.style.cssText = 'display: inline-block;';
    settingsBtn.appendChild(settingsIcon);

    // Create the anchor button matching Booth's exact style
    const btn = document.createElement('a');
    btn.id = BUTTON_ID;
    btn.href = 'javascript:void(0)';
    btn.className = 'nav-reverse';

    const icon = document.createElement('i');
    icon.className = 'icon-download s-1x';

    const label = document.createElement('span');
    label.className = 'cmd-label';
    label.textContent = 'Download All';

    btn.appendChild(icon);
    btn.appendChild(label);

    actionDiv.appendChild(btn);
    actionDiv.appendChild(settingsBtn);

    rightWrap.appendChild(spacer);
    rightWrap.appendChild(actionDiv);

    center.appendChild(leftDiv);
    center.appendChild(rightWrap);
    listItem.appendChild(center);

    // Settings button event listener
    settingsBtn.addEventListener('click', (e) => {
      e.preventDefault();
      createSettingsModal();
    });

    btn.addEventListener('click', async (e) => {
      e.preventDefault();
      try {
        btn.style.pointerEvents = 'none';
        btn.style.opacity = '0.6';
        statusDiv.style.display = 'block';

        const anchors = findDownloadAnchors();
        if (anchors.length === 0) {
          statusDiv.textContent = 'No downloadable items found.';
          btn.style.pointerEvents = 'auto';
          btn.style.opacity = '1';
          return;
        }

        const productName = getProductName();
        statusDiv.textContent = 'Found ' + anchors.length + ' files. Downloading...';

        // Download all files with rate limiting (if enabled)
        const files = await downloadFilesWithRateLimit(anchors, statusDiv);

        if (files.length === 0) {
          statusDiv.textContent = 'Failed to download any files.';
          btn.style.pointerEvents = 'auto';
          btn.style.opacity = '1';
          return;
        }

        statusDiv.textContent = 'Creating ZIP with ' + files.length + ' files...';
        log('Using fflate to create ZIP...');

        // Use fflate (modern, fast ZIP library)
        const zipData = {};
        files.forEach(file => {
          // fflate expects Uint8Array
          zipData[file.filename] = new Uint8Array(file.data);
        });

        statusDiv.textContent = 'Compressing ZIP (no compression for speed)...';

        // Create ZIP with fflate (synchronous, but fast)
        const zipped = fflate.zipSync(zipData, {
          level: 0  // No compression (files are already .zip files)
        });

        log('ZIP created! Size:', zipped.byteLength);

        // Download the ZIP
        const zipFilename = productName + '.zip';
        const zipBlob = new Blob([zipped], { type: 'application/zip' });
        const zipUrl = URL.createObjectURL(zipBlob);
        const link = document.createElement('a');
        link.href = zipUrl;
        link.download = zipFilename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setTimeout(() => URL.revokeObjectURL(zipUrl), 1000);

        statusDiv.textContent = '✓ Downloaded ' + zipFilename + ' (' + files.length + ' files)';
      } catch (error) {
        console.error('[BOOTH Download All] Error', error);
        statusDiv.textContent = 'Error: ' + error.message + '\nCheck console for details.';
      } finally {
        btn.style.pointerEvents = 'auto';
        btn.style.opacity = '1';
      }
    });

    try {
      // Insert after the spacing div
      spacingDiv.parentNode.insertBefore(listItem, spacingDiv.nextSibling);
      log('Inserted Download All button after spacing div.');
    } catch (e) {
      console.error('[BOOTH DL All] Failed to insert:', e);
    }
  }

  function init() {
    log('Init on', location.href);
    createButton();

    const observer = new MutationObserver(() => {
      createButton();
    });

    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
    });

  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
