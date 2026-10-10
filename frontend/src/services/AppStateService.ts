class AppStateService {
  private isForeground: boolean = true;
  private listeners: Set<(isForeground: boolean) => void> = new Set();
  private visibilityThreshold: number = 30000; // 30 seconds
  private lastVisibilityChange: number = Date.now();
  private visibilityTimeout: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    this.init();
  }

  private init() {
    // Page Visibility API
    document.addEventListener('visibilitychange', this.handleVisibilityChange);
    
    // Focus/Blur events
    window.addEventListener('focus', this.handleFocus);
    window.addEventListener('blur', this.handleBlur);

    // Before unload
    window.addEventListener('beforeunload', this.handleBeforeUnload);
  }

  private handleVisibilityChange = () => {
    const isNowForeground = !document.hidden;
    this.setForeground(isNowForeground);
  };

  private handleFocus = () => {
    this.setForeground(true);
  };

  private handleBlur = () => {
    // Only consider as background if not just a quick tab switch
    this.visibilityTimeout = setTimeout(() => {
      this.setForeground(false);
    }, this.visibilityThreshold);
  };

  private handleBeforeUnload = () => {
    this.setForeground(false);
  };

  private setForeground(foreground: boolean) {
    if (this.isForeground === foreground) return;

    this.isForeground = foreground;
    this.lastVisibilityChange = Date.now();

    if (this.visibilityTimeout) {
      clearTimeout(this.visibilityTimeout);
      this.visibilityTimeout = null;
    }

    this.notifyListeners();
  }

  private notifyListeners() {
    this.listeners.forEach(listener => listener(this.isForeground));
  }

  subscribe(listener: (isForeground: boolean) => void): () => void {
    this.listeners.add(listener);
    // Immediately call with current state
    listener(this.isForeground);
    return () => {
      this.listeners.delete(listener);
    };
  }

  isAppForeground(): boolean {
    return this.isForeground;
  }

  getTimeSinceVisibilityChange(): number {
    return Date.now() - this.lastVisibilityChange;
  }

  cleanup() {
    document.removeEventListener('visibilitychange', this.handleVisibilityChange);
    window.removeEventListener('focus', this.handleFocus);
    window.removeEventListener('blur', this.handleBlur);
    window.removeEventListener('beforeunload', this.handleBeforeUnload);
    
    if (this.visibilityTimeout) {
      clearTimeout(this.visibilityTimeout);
    }
    
    this.listeners.clear();
  }
}

export const appStateService = new AppStateService();
