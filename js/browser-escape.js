/**
 * YRU Security Patrol - In-App Browser Escape
 * ------------------------------------------------------------
 * เบราว์เซอร์ภายในแอป (LINE, Facebook, Messenger, Instagram, TikTok ฯลฯ)
 * มักบล็อกการเปิดกล้องโดยตรง (getUserMedia) และไม่สนใจ capture="environment"
 * ทำให้แตะปุ่มถ่ายรูปแล้วเด้งไปหน้าอัลบั้มรูป (Google Photos) แทน
 *
 * สคริปต์นี้จะ:
 *  1. LINE (Android/iOS): เปิดหน้าเว็บใหม่ในเบราว์เซอร์หลักของเครื่องอัตโนมัติ
 *     ผ่านพารามิเตอร์ทางการของ LINE "openExternalBrowser=1"
 *  2. แอปอื่นบน Android: มีฟังก์ชันเปิดใน Chrome ผ่าน intent://
 *  3. เปิดเผย window.YRUBrowser สำหรับให้ app.js ใช้ตรวจสอบ/แสดงปุ่มเปิดในเบราว์เซอร์
 */
(function () {
  var ua = navigator.userAgent || '';
  var isAndroid = /Android/i.test(ua);
  var isIOS = /iPhone|iPad|iPod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  var isLine = /\bLine\//i.test(ua);
  var isFacebook = /FBAN|FBAV|FB_IAB|FBIOS|FB4A/i.test(ua);
  var isMessenger = /Messenger|MESSENGER/i.test(ua);
  var isInstagram = /Instagram/i.test(ua);
  var isTikTok = /musical_ly|TikTok|BytedanceWebview/i.test(ua);
  var isAndroidWebView = isAndroid && /; wv\)/i.test(ua);
  var isInApp = isLine || isFacebook || isMessenger || isInstagram || isTikTok || isAndroidWebView;

  function buildExternalUrl() {
    var url = new URL(window.location.href);
    url.searchParams.set('openExternalBrowser', '1');
    return url.toString();
  }

  function openInExternalBrowser() {
    var current = window.location.href;
    if (isLine) {
      window.location.href = buildExternalUrl();
      return;
    }
    if (isAndroid) {
      // เปิดใน Google Chrome โดยตรง (ถ้าไม่มี Chrome จะเปิดเบราว์เซอร์เริ่มต้น)
      var noScheme = current.replace(/^https?:\/\//i, '');
      var scheme = current.indexOf('https') === 0 ? 'https' : 'http';
      window.location.href = 'intent://' + noScheme + '#Intent;scheme=' + scheme +
        ';package=com.android.chrome;S.browser_fallback_url=' + encodeURIComponent(current) + ';end';
      return;
    }
    // iOS: ไม่สามารถบังคับเปิด Safari ได้จากเว็บ — คัดลอกลิงก์ให้ผู้ใช้
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(current);
      }
    } catch (e) {}
    alert('กรุณาแตะเมนู (⋯ หรือ ไอคอนแชร์) แล้วเลือก "เปิดใน Safari" เพื่อใช้งานกล้องถ่ายรูปได้โดยตรง\n(คัดลอกลิงก์ไว้ให้แล้ว)');
  }

  window.YRUBrowser = {
    isAndroid: isAndroid,
    isIOS: isIOS,
    isLine: isLine,
    isInApp: isInApp,
    openInExternalBrowser: openInExternalBrowser
  };

  // LINE: ย้ายไปเปิดในเบราว์เซอร์หลักของเครื่องอัตโนมัติ (ทำครั้งเดียวต่อหน้า ป้องกันวนลูป)
  if (isLine) {
    try {
      var params = new URLSearchParams(window.location.search);
      if (params.get('openExternalBrowser') !== '1') {
        window.location.replace(buildExternalUrl());
      }
    } catch (e) {}
  }
})();
