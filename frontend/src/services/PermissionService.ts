class PermissionService {
  private audioPermission: PermissionState = 'prompt';
  private cameraPermission: PermissionState = 'prompt';
  private notificationPermission: NotificationPermission = 'default';
  private listeners: Set<() => void> = new Set();

  constructor() {
    this.init();
  }

  private async init() {
    // Check notification permission
    if ('Notification' in window) {
      this.notificationPermission = Notification.permission;
    }

    // Check audio/camera permissions (if supported)
    if ('permissions' in navigator) {
      try {
        const audioStatus = await navigator.permissions.query({ name: 'microphone' as PermissionName });
        this.audioPermission = audioStatus.state;
        audioStatus.addEventListener('change', () => {
          this.audioPermission = audioStatus.state;
          this.notifyListeners();
        });

        const cameraStatus = await navigator.permissions.query({ name: 'camera' as PermissionName });
        this.cameraPermission = cameraStatus.state;
        cameraStatus.addEventListener('change', () => {
          this.cameraPermission = cameraStatus.state;
          this.notifyListeners();
        });
      } catch (e) {
        console.warn('Permissions API not fully supported:', e);
      }
    }
  }

  private notifyListeners() {
    this.listeners.forEach(listener => listener());
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  getAudioPermission(): PermissionState {
    return this.audioPermission;
  }

  getCameraPermission(): PermissionState {
    return this.cameraPermission;
  }

  getNotificationPermission(): NotificationPermission {
    return this.notificationPermission;
  }

  async requestAudioPermission(): Promise<boolean> {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // Stop the stream immediately, we just wanted the permission
      stream.getTracks().forEach(track => track.stop());
      this.audioPermission = 'granted';
      this.notifyListeners();
      return true;
    } catch (error) {
      console.error('Audio permission denied:', error);
      this.audioPermission = 'denied';
      this.notifyListeners();
      return false;
    }
  }

  async requestCameraPermission(): Promise<boolean> {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      // Stop the stream immediately, we just wanted the permission
      stream.getTracks().forEach(track => track.stop());
      this.cameraPermission = 'granted';
      this.notifyListeners();
      return true;
    } catch (error) {
      console.error('Camera permission denied:', error);
      this.cameraPermission = 'denied';
      this.notifyListeners();
      return false;
    }
  }

  async requestNotificationPermission(): Promise<boolean> {
    if (!('Notification' in window)) {
      console.warn('This browser does not support notifications');
      return false;
    }

    if (this.notificationPermission === 'granted') {
      return true;
    }

    if (this.notificationPermission === 'denied') {
      return false;
    }

    const permission = await Notification.requestPermission();
    this.notificationPermission = permission;
    this.notifyListeners();
    return permission === 'granted';
  }

  async requestAllPermissions(): Promise<{ audio: boolean; camera: boolean; notification: boolean }> {
    const audio = await this.requestAudioPermission();
    const camera = await this.requestCameraPermission();
    const notification = await this.requestNotificationPermission();
    return { audio, camera, notification };
  }
}

export const permissionService = new PermissionService();
