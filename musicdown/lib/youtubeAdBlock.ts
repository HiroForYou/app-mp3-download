// Best-effort ad reduction for the in-app YouTube WebView: hides ad banners
// cosmetically, auto-clicks the "skip ad" button as soon as it appears, and
// force-seeks unskippable video ads to their end. This is inherently fragile
// — YouTube changes its markup often — and can't guarantee zero ads.
export const YOUTUBE_AD_BLOCK_SCRIPT = `
(function () {
  var skipSelectors = [
    '.ytp-ad-skip-button',
    '.ytp-ad-skip-button-modern',
    '.ytp-skip-ad-button',
    '.videoAdUiSkipButton',
    'button.ytp-ad-skip-button-container',
  ];
  var hideSelectors = [
    'ytm-companion-ad-renderer',
    'ytm-promoted-sparkles-web-renderer',
    'ytm-banner-promo-renderer',
    'ytm-display-ad-renderer',
    'ytm-in-feed-ad-layout-renderer',
    'ytm-ad-badge-renderer',
    'ytm-search-ad-renderer',
    '#masthead-ad',
    'ytd-display-ad-renderer',
    'ytd-promoted-sparkles-web-renderer',
    'ytd-in-feed-ad-layout-renderer',
    'ytd-ad-slot-renderer',
    'ytd-banner-promo-renderer-background',
  ];

  function clickSkipButtons() {
    skipSelectors.forEach(function (sel) {
      document.querySelectorAll(sel).forEach(function (btn) {
        try { btn.click(); } catch (e) {}
      });
    });
  }

  function hideBanners() {
    hideSelectors.forEach(function (sel) {
      document.querySelectorAll(sel).forEach(function (el) {
        el.style.display = 'none';
      });
    });
  }

  // For ads that can't be skipped yet (or ever): the player carries an
  // "ad-showing"/"ad-interrupting" class while an ad plays. Force the ad's
  // <video> element to its end so playback moves on immediately instead of
  // waiting out the ad.
  function fastForwardActiveAd() {
    var player = document.querySelector('.html5-video-player');
    var isAd = player && (
      player.classList.contains('ad-showing') ||
      player.classList.contains('ad-interrupting')
    );
    if (!isAd) return;
    var video = document.querySelector('.html5-video-player video');
    if (video && isFinite(video.duration) && video.duration > 0) {
      try {
        video.muted = true;
        video.currentTime = video.duration;
      } catch (e) {}
    }
  }

  function tick() {
    clickSkipButtons();
    hideBanners();
    fastForwardActiveAd();
  }

  setInterval(tick, 300);
  var observer = new MutationObserver(tick);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  tick();
})();
true;
`;
