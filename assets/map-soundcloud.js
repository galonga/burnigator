// Optional SoundCloud background-music player (controls + widget API).
(function () {
  window.BurnigatorSoundCloud = {
    init: initSoundCloudPlayer,
  };
  function initSoundCloudPlayer(settings) {
    const iframe = document.getElementById('soundcloud-widget'),
      controls = document.querySelector('.soundcloud-controls'),
      toggleButton = document.getElementById('music-toggle'),
      next = document.getElementById('music-next'),
      forward30 = document.getElementById('music-forward-30'),
      volume = document.getElementById('music-volume'),
      status = document.getElementById('music-status');
    if (!iframe || !controls || !toggleButton || !next || !forward30 || !volume || !status) return;
    controls.hidden = settings.soundcloudEnabled === false;
    iframe.hidden = settings.soundcloudEnabled === false;
    if (settings.soundcloudEnabled === false) return;
    let playlistUrl = '';
    try {
      const candidate = new URL(settings.soundcloudPlaylist || '');
      if (
        candidate.protocol === 'https:' &&
        ['soundcloud.com', 'www.soundcloud.com'].includes(candidate.hostname.toLowerCase()) &&
        /^\/[^/]+\/sets\/[^/]+\/?$/.test(candidate.pathname)
      )
        playlistUrl = candidate.origin + candidate.pathname.replace(/\/$/, '');
    } catch (_) {}
    if (!playlistUrl) {
      controls.hidden = true;
      iframe.hidden = true;
      return;
    }
    iframe.dataset.src =
      'https://w.soundcloud.com/player/?url=' +
      encodeURIComponent(playlistUrl) +
      '&color=%23305EAA&auto_play=false&hide_related=true&show_comments=false&show_user=false&show_reposts=false&show_teaser=false&visual=false';
    let widget = null,
      isPlaying = false,
      hasUserPlayed = false,
      loading = false,
      statusMode = 'musicPrompt',
      currentTrackName = '';
    const setStatus = (key) => {
      statusMode = key;
      status.textContent = window.AppI18n.t(key);
      status.removeAttribute('href');
      status.removeAttribute('target');
      status.removeAttribute('rel');
      status.classList.remove('is-track');
    };
    const updateToggle = (playing) => {
      isPlaying = playing;
      const key = playing ? 'musicPause' : 'musicPlay',
        icon = toggleButton.querySelector('i');
      icon.className = 'fa-solid ' + (playing ? 'fa-pause' : 'fa-play');
      toggleButton.setAttribute('aria-label', window.AppI18n.t(key));
      toggleButton.title = window.AppI18n.t(key);
    };
    const showCurrentTrack = (sound) => {
      if (!sound) return '';
      statusMode = 'track';
      const rawTitle = String(sound.title || '');
      const hash = rawTitle.indexOf('#');
      currentTrackName = (hash >= 0 ? rawTitle.slice(hash).trim() : rawTitle) || rawTitle;
      status.textContent = currentTrackName || window.AppI18n.t('musicPrompt');
      status.removeAttribute('href');
      status.classList.remove('is-track');
      try {
        const trackUrl = new URL(sound.permalink_url || '');
        if (trackUrl.protocol === 'https:' && /(^|\.)soundcloud\.com$/i.test(trackUrl.hostname)) {
          status.href = trackUrl.href;
          status.target = '_blank';
          status.rel = 'noopener noreferrer';
          status.classList.add('is-track');
        }
      } catch (_) {}
      return currentTrackName;
    };
    const pickRandomTrack = (keepPlaying, fromNextButton = false) => {
      widget.getSounds((sounds) => {
        if (!Array.isArray(sounds) || !sounds.length) return;
        widget.getCurrentSoundIndex((currentIndex) => {
          let index = Math.floor(Math.random() * sounds.length);
          const current = Number(currentIndex);
          if (
            sounds.length > 1 &&
            Number.isInteger(current) &&
            current >= 0 &&
            current < sounds.length &&
            index === current
          ) {
            const other = Math.floor(Math.random() * (sounds.length - 1));
            index = other >= current ? other + 1 : other;
          }
          widget.skip(index);
          setTimeout(() => {
            if (keepPlaying) widget.play();
            else widget.pause();
            if (hasUserPlayed)
              widget.getCurrentSound((sound) => {
                const title = showCurrentTrack(sound);
                if (fromNextButton) window.trackAppEvent?.('Visitor', 'music_next', title);
              });
          }, 450);
        });
      });
    };
    const initialize = () => {
      if (widget || loading) return;
      if (!window.SC?.Widget) {
        setStatus('musicUnavailable');
        return;
      }
      loading = true;
      setStatus('musicLoading');
      iframe.src = iframe.dataset.src;
      widget = window.SC.Widget(iframe);
      widget.bind(window.SC.Widget.Events.READY, () => {
        loading = false;
        next.disabled = false;
        forward30.disabled = false;
        volume.disabled = false;
        widget.setVolume(Number(volume.value));
        pickRandomTrack(true);
      });
      widget.bind(window.SC.Widget.Events.PLAY, () => {
        updateToggle(true);
        if (hasUserPlayed)
          widget.getCurrentSound((sound) => {
            const title = showCurrentTrack(sound);
            window.trackAppEvent?.('Visitor', 'music_track_played', title);
          });
      });
      widget.bind(window.SC.Widget.Events.PAUSE, () => updateToggle(false));
      widget.bind(window.SC.Widget.Events.FINISH, () => {
        updateToggle(false);
        setStatus('musicPrompt');
      });
      widget.bind(window.SC.Widget.Events.ERROR, () => setStatus('musicUnavailable'));
    };
    updateToggle(false);
    next.disabled = true;
    forward30.disabled = true;
    volume.disabled = true;
    setStatus('musicPrompt');
    toggleButton.addEventListener('click', () => {
      window.trackAppEvent?.('Visitor', isPlaying ? 'music_pause' : 'music_play', currentTrackName);
      if (!widget) {
        hasUserPlayed = true;
        initialize();
        return;
      }
      if (isPlaying) widget.pause();
      else {
        hasUserPlayed = true;
        widget.play();
      }
    });
    next.addEventListener('click', () => {
      if (!widget) return;
      widget.isPaused((paused) => pickRandomTrack(!paused, true));
    });
    forward30.addEventListener('click', () => {
      if (!widget) return;
      window.trackAppEvent?.('Visitor', 'music_skip_forward', '30_seconds');
      widget.getPosition((position) =>
        widget.getDuration((duration) => {
          const current = Number(position) || 0,
            total = Number(duration) || 0,
            target = current + 30000;
          widget.seekTo(total > 0 ? Math.min(target, Math.max(0, total - 500)) : target);
        })
      );
    });
    volume.addEventListener('input', () => widget?.setVolume(Number(volume.value)));
    window.addEventListener('image-map-language-change', () => {
      if (statusMode !== 'track') setStatus(statusMode);
      updateToggle(isPlaying);
    });
  }
})();
