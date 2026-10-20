export function generateVanillaSnippet(animeId: string | number = 154587, initialEpisode: number = 1): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Ani.pm Player - Watch Progress & Episodes</title>
  <!-- Load ani.pm Player SDK -->
  <script src="https://ani.pm/embed/sdk/v1.js"></script>
  <style>
    :root {
      --bg: #09090b;
      --card: #18181b;
      --border: #27272a;
      --text: #f4f4f5;
      --muted: #a1a1aa;
      --accent: #6366f1;
      --accent-hover: #4f46e5;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: var(--bg);
      color: var(--text);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      padding: 24px 16px;
      display: flex;
      justify-content: center;
    }
    .container {
      max-width: 1080px;
      width: 100%;
      display: flex;
      flex-direction: column;
      gap: 20px;
    }
    /* Player frame wrapper */
    #player-container {
      width: 100%;
      aspect-ratio: 16 / 9;
      background: #000;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 10px 30px rgba(0,0,0,0.5);
    }
    /* Cards */
    .card {
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 16px 20px;
    }
    .header-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 12px;
    }
    .title { font-size: 1.1rem; font-weight: 600; }
    .ep-label { color: var(--accent); font-weight: 500; font-size: 0.95rem; }
    /* Progress bar */
    .progress-track {
      width: 100%;
      height: 6px;
      background: var(--border);
      border-radius: 3px;
      overflow: hidden;
      margin-bottom: 8px;
    }
    .progress-fill {
      height: 100%;
      width: 0%;
      background: var(--accent);
      transition: width 0.25s ease-out;
    }
    .time-row {
      display: flex;
      justify-content: space-between;
      font-size: 0.8rem;
      color: var(--muted);
      font-variant-numeric: tabular-nums;
    }
    /* Episode controls & buttons */
    .controls-row {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      margin-top: 16px;
      align-items: center;
    }
    button {
      background: #27272a;
      color: var(--text);
      border: 1px solid #3f3f46;
      border-radius: 8px;
      padding: 8px 16px;
      font-size: 0.85rem;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.15s ease;
    }
    button:hover:not(:disabled) {
      background: #3f3f46;
      border-color: #52525b;
    }
    button:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }
    button.primary {
      background: var(--accent);
      border-color: var(--accent);
    }
    button.primary:hover:not(:disabled) {
      background: var(--accent-hover);
    }
    /* Episodes list rendered below player */
    .episodes-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
      gap: 12px;
      margin-top: 14px;
    }
    .ep-card {
      background: #121215;
      border: 1px solid var(--border);
      border-radius: 10px;
      padding: 12px;
      cursor: pointer;
      display: flex;
      flex-direction: column;
      gap: 6px;
      transition: all 0.2s ease;
      text-align: left;
    }
    .ep-card:hover {
      border-color: var(--accent);
      background: #1c1c21;
    }
    .ep-card.active {
      border-color: var(--accent);
      background: rgba(99, 102, 241, 0.12);
      outline: 1px solid var(--accent);
    }
    .ep-card-title {
      font-size: 0.85rem;
      font-weight: 600;
      color: #fff;
    }
    .ep-card-meta {
      font-size: 0.75rem;
      color: var(--muted);
      display: flex;
      justify-content: space-between;
    }
    .ep-card-progress {
      width: 100%;
      height: 3px;
      background: #27272a;
      border-radius: 2px;
      overflow: hidden;
      margin-top: 4px;
    }
    .ep-card-progress-bar {
      height: 100%;
      background: var(--accent);
    }
    .resume-alert {
      display: none;
      background: rgba(99, 102, 241, 0.15);
      border: 1px solid rgba(99, 102, 241, 0.4);
      padding: 10px 14px;
      border-radius: 8px;
      font-size: 0.85rem;
      margin-bottom: 12px;
      align-items: center;
      justify-content: space-between;
    }
  </style>
</head>
<body>

  <div class="container">
    <!-- Resume Watch Notification -->
    <div id="resume-banner" class="resume-alert">
      <span id="resume-text">Found previous watch progress for this episode.</span>
      <button id="resume-btn" class="primary" style="padding: 4px 12px; font-size: 0.75rem;">Resume</button>
    </div>

    <!-- Mount Target for ani.pm Player -->
    <div id="player-container"></div>

    <!-- Watch Progress & Control Deck -->
    <div class="card">
      <div class="header-row">
        <div>
          <span class="title" id="player-title">AniPM Player</span>
          <span style="color: var(--muted); margin: 0 6px;">·</span>
          <span class="ep-label" id="player-ep">Episode ${initialEpisode}</span>
        </div>
        <div id="status-badge" style="font-size: 0.8rem; color: var(--muted);">Ready</div>
      </div>

      <!-- Real-time Watch Progress Bar -->
      <div class="progress-track">
        <div id="progress-bar" class="progress-fill"></div>
      </div>
      <div class="time-row">
        <span id="curr-time">00:00</span>
        <span id="progress-percent">0%</span>
        <span id="total-time">00:00</span>
      </div>

      <!-- Playback Controls -->
      <div class="controls-row">
        <button id="prev-ep-btn" disabled>⏮ Previous</button>
        <button id="play-pause-btn">⏯ Play / Pause</button>
        <button id="next-ep-btn">⏭ Next</button>
        <button id="sub-dub-toggle">Audio: SUB</button>
        <button id="theater-toggle">Theater Mode</button>
      </div>
    </div>

    <!-- Episodes Fetched via player.getEpisodes() -->
    <div class="card">
      <div class="header-row">
        <div>
          <span class="title">Episodes</span>
          <span style="color: var(--muted); font-size: 0.85rem; margin-left: 8px;" id="ep-count-badge">Loading episodes...</span>
        </div>
        <button id="refresh-episodes-btn" style="padding: 4px 10px; font-size: 0.75rem;">Refresh via getEpisodes()</button>
      </div>

      <!-- Rendered list of episodes below the player -->
      <div class="episodes-grid" id="episodes-container">
        <!-- Populated via player.getEpisodes() -->
      </div>
    </div>
  </div>

  <script>
    // =======================================================
    // 1. CONFIGURATION & PROGRESS LOCALSTORAGE STORAGE LOGIC
    // =======================================================
    const ANIME_ID = ${typeof animeId === 'number' ? animeId : `'${animeId}'`};
    let currentEpisode = ${initialEpisode};
    let currentLang = 'sub';
    let playerInstance = null;

    function getStorageKey(anime, ep) {
      return 'anipm_progress_' + anime + '_ep' + ep;
    }

    function formatTime(secs) {
      if (!secs || isNaN(secs)) return '00:00';
      const m = Math.floor(secs / 60);
      const s = Math.floor(secs % 60);
      return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
    }

    // Save watch progress to localStorage
    function saveProgress(ep, currentTime, duration) {
      if (!duration || duration <= 0) return;
      const percent = Math.min(100, Math.round((currentTime / duration) * 100));
      const record = {
        animeId: ANIME_ID,
        episode: ep,
        currentTime: Math.round(currentTime),
        duration: Math.round(duration),
        percentage: percent,
        completed: percent >= 90,
        savedAt: Date.now()
      };
      localStorage.setItem(getStorageKey(ANIME_ID, ep), JSON.stringify(record));
    }

    // Retrieve saved progress from localStorage
    function getSavedProgress(ep) {
      try {
        const item = localStorage.getItem(getStorageKey(ANIME_ID, ep));
        return item ? JSON.parse(item) : null;
      } catch (e) {
        return null;
      }
    }

    // =======================================================
    // 2. INITIALIZE ANI.PM PLAYER WITH SDK
    // =======================================================
    function initPlayer() {
      const saved = getSavedProgress(currentEpisode);
      const startSecs = (saved && !saved.completed && saved.currentTime > 5) ? saved.currentTime : 0;

      // Construct Player
      playerInstance = new window.AniPM.Player('#player-container', {
        anime: ANIME_ID,
        episode: currentEpisode,
        lang: currentLang,
        start: startSecs,
        autoplay: true,
        autoNext: true,
        color: '#6366f1',
        on: {
          ready: async function(state, player) {
            console.log('[AniPM] Player Ready:', state);
            document.getElementById('status-badge').textContent = 'Ready';
            updateUI(state);

            // Fetch and render episodes list using player.getEpisodes()
            await fetchAndRenderEpisodes();
          },
          timeupdate: function(data, player) {
            // Real-time watch progress tracking
            handleTimeUpdate(data.currentTime, data.duration);
          },
          episodechange: function(state, player) {
            // Triggered on episode switch
            console.log('[AniPM] Episode Changed to:', state.episode);
            handleEpisodeChange(state.episode);
          },
          episodes: function(data, player) {
            // Emitted when SDK updates episodes
            if (data && data.episodes) {
              renderEpisodesList(data.episodes);
            }
          },
          ended: function(state, player) {
            console.log('[AniPM] Episode completed');
            saveProgress(state.episode, state.duration, state.duration);
          }
        }
      });

      // Show resume alert if prior session exists
      if (saved && !saved.completed && saved.currentTime > 10) {
        const banner = document.getElementById('resume-banner');
        const text = document.getElementById('resume-text');
        text.textContent = 'Found previous watch progress at ' + formatTime(saved.currentTime) + ' (' + saved.percentage + '%).';
        banner.style.display = 'flex';
        document.getElementById('resume-btn').onclick = function() {
          playerInstance.seek(saved.currentTime);
          banner.style.display = 'none';
        };
      }
    }

    // =======================================================
    // 3. FETCH & RENDER EPISODES VIA player.getEpisodes()
    // =======================================================
    async function fetchAndRenderEpisodes() {
      try {
        if (!playerInstance) return;
        // Call SDK getEpisodes() method
        const episodes = await playerInstance.getEpisodes();
        renderEpisodesList(episodes);
      } catch (err) {
        console.error('[AniPM] Error fetching episodes:', err);
      }
    }

    function renderEpisodesList(episodes) {
      const container = document.getElementById('episodes-container');
      const badge = document.getElementById('ep-count-badge');
      if (!container) return;

      container.innerHTML = '';
      if (!episodes || episodes.length === 0) {
        badge.textContent = 'No episodes returned';
        return;
      }
      badge.textContent = '(' + episodes.length + ' available)';

      episodes.forEach(ep => {
        const isCurrent = ep.number === currentEpisode;
        const progress = getSavedProgress(ep.number);
        const percent = progress ? progress.percentage : 0;

        const card = document.createElement('div');
        card.className = 'ep-card' + (isCurrent ? ' active' : '');
        card.onclick = () => {
          // Trigger player.loadEpisode on click
          navigateToEpisode(ep.number);
        };

        const titleDiv = document.createElement('div');
        titleDiv.className = 'ep-card-title';
        titleDiv.textContent = 'EP ' + ep.number + ' · ' + (ep.title || ('Episode ' + ep.number));
        card.appendChild(titleDiv);

        const metaDiv = document.createElement('div');
        metaDiv.className = 'ep-card-meta';
        const runtime = ep.runtimeSeconds ? formatTime(ep.runtimeSeconds) : '24:00';
        metaDiv.innerHTML = '<span>' + runtime + '</span><span>' + (progress && progress.completed ? '✓ Watched' : (percent > 0 ? percent + '%' : 'Unwatched')) + '</span>';
        card.appendChild(metaDiv);

        if (percent > 0) {
          const progTrack = document.createElement('div');
          progTrack.className = 'ep-card-progress';
          const progFill = document.createElement('div');
          progFill.className = 'ep-card-progress-bar';
          progFill.style.width = percent + '%';
          progTrack.appendChild(progFill);
          card.appendChild(progTrack);
        }

        container.appendChild(card);
      });
    }

    // =======================================================
    // 4. NAVIGATION VIA player.loadEpisode()
    // =======================================================
    function navigateToEpisode(epNum) {
      if (!playerInstance) return;
      // Retrieve saved progress for destination episode
      const saved = getSavedProgress(epNum);
      const startAt = (saved && !saved.completed && saved.currentTime > 5) ? saved.currentTime : 0;

      // Trigger player.loadEpisode
      playerInstance.loadEpisode(epNum, {
        lang: currentLang,
        start: startAt
      });
    }

    function handleEpisodeChange(newEp) {
      currentEpisode = newEp;
      document.getElementById('player-ep').textContent = 'Episode ' + newEp;
      document.getElementById('prev-ep-btn').disabled = newEp <= 1;

      // Re-render or update active classes
      fetchAndRenderEpisodes();
    }

    function handleTimeUpdate(currentTime, duration) {
      const progressBar = document.getElementById('progress-bar');
      const currTimeEl = document.getElementById('curr-time');
      const totalTimeEl = document.getElementById('total-time');
      const percentEl = document.getElementById('progress-percent');

      currTimeEl.textContent = formatTime(currentTime);
      totalTimeEl.textContent = formatTime(duration);

      const percent = duration > 0 ? (currentTime / duration) * 100 : 0;
      progressBar.style.width = Math.min(100, Math.max(0, percent)) + '%';
      percentEl.textContent = Math.round(percent) + '%';

      saveProgress(currentEpisode, currentTime, duration);
    }

    function setupControls() {
      document.getElementById('play-pause-btn').addEventListener('click', () => {
        playerInstance.togglePlay();
      });

      document.getElementById('next-ep-btn').addEventListener('click', () => {
        playerInstance.next();
      });

      document.getElementById('prev-ep-btn').addEventListener('click', () => {
        playerInstance.previous();
      });

      const langBtn = document.getElementById('sub-dub-toggle');
      langBtn.addEventListener('click', () => {
        currentLang = currentLang === 'sub' ? 'dub' : 'sub';
        langBtn.textContent = 'Audio: ' + currentLang.toUpperCase();
        playerInstance.setLanguage(currentLang);
      });

      document.getElementById('theater-toggle').addEventListener('click', () => {
        playerInstance.toggleTheater();
      });

      document.getElementById('refresh-episodes-btn').addEventListener('click', () => {
        fetchAndRenderEpisodes();
      });
    }

    function updateUI(state) {
      document.getElementById('prev-ep-btn').disabled = !state.hasPrevious;
      document.getElementById('next-ep-btn').disabled = !state.hasNext;
      document.getElementById('player-title').textContent = state.title || 'AniPM Player';
    }

    window.addEventListener('DOMContentLoaded', () => {
      setupControls();
      if (window.AniPM) {
        initPlayer();
      } else {
        setTimeout(initPlayer, 400);
      }
    });
  </script>
</body>
</html>`;
}
