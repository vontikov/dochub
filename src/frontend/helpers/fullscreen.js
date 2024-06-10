export default {
    isAvailable() {
      return document.fullscreenEnabled || false;
    },
    request(element) {
        element = element || document.documentElement;
        if (element.requestFullscreen) {
            return element.requestFullscreen();
          } else if (element.mozRequestFullScreen) {
            return element.mozRequestFullScreen();
          } else if (element.webkitRequestFullScreen) {
            return element.webkitRequestFullScreen();
          } else if (element.msRequestFullscreen) {
            return element.msRequestFullscreen();
          }        
        return new Promise((success, reject ) => reject());
    },
    cancel() {
        if (document.exitFullscreen) {
            return document.exitFullscreen();
        } else if (document.webkitExitFullscreen) {
            return document.webkitExitFullscreen();
        } else if (document.mozCancelFullScreen) {
            return document.mozCancelFullScreen();
        } else if (document.msExitFullscreen) {
            return document.msExitFullscreen();
        }
    },
    isFullScreen() {
        return (document.fullscreenElement && document.fullscreenElement !== null) ||
        (document.webkitFullscreenElement && document.webkitFullscreenElement !== null) ||
        (document.mozFullScreenElement && document.mozFullScreenElement !== null) ||
        (document.msFullscreenElement && document.msFullscreenElement !== null);
    },
    watcher: null,
    toggle(element, callback, value) {
        if (!value && this.isFullScreen()) {
            this.cancel();
            clearInterval(this.watcher);
            this.watcher = null;
            callback(false);
          } else {
            this.request(element);
            this.watcher = setInterval(() => {
              if (!this.isFullScreen()) {
                clearInterval(this.watcher);
                this.watcher = null;
                callback(false);
              }
            }, 50);
            callback(true);
          }
    }
};
