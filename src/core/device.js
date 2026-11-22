// v3.0.1 device profile: phones / the Android app get a lighter rendering path.
export const IS_ANDROID_APP = typeof navigator !== 'undefined' && /FM27-Android/.test(navigator.userAgent);
export const IS_MOBILE = IS_ANDROID_APP || (typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches && Math.min(screen.width, screen.height) < 820);
