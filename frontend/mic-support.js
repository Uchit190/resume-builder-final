// Browser microphone and speech recognition support are strict on mobile.
// Android Chrome requires HTTPS, except for localhost on the same device.
const ResumeForgeMicSupport = (() => {
  function isLocalhost() {
    return ['localhost', '127.0.0.1', '::1'].includes(window.location.hostname);
  }

  function isSecureForMic() {
    return window.isSecureContext || isLocalhost();
  }

  function getSpeechRecognition() {
    return window.SpeechRecognition || window.webkitSpeechRecognition || null;
  }

  function getStatus() {
    const Recognition = getSpeechRecognition();

    if (!isSecureForMic()) {
      return {
        canUseVoice: false,
        reason: 'insecure-origin',
        message: 'Microphone needs HTTPS on phone. Use localhost on laptop or deploy the site with HTTPS.',
      };
    }

    if (!Recognition) {
      return {
        canUseVoice: false,
        reason: 'speech-recognition-missing',
        message: 'Speech recognition is not available in this browser. Use Chrome or Edge, or continue in text mode.',
      };
    }

    return {
      canUseVoice: true,
      reason: '',
      message: 'Voice input is ready.',
    };
  }

  async function requestMicrophone() {
    const status = getStatus();
    if (!status.canUseVoice) {
      return status;
    }

    if (!navigator.mediaDevices || typeof navigator.mediaDevices.getUserMedia !== 'function') {
      return {
        canUseVoice: false,
        reason: 'media-devices-missing',
        message: 'This browser cannot request microphone access. Continue in text mode.',
      };
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((track) => track.stop());
      return status;
    } catch (error) {
      return {
        canUseVoice: false,
        reason: error && error.name ? error.name : 'permission-denied',
        message: 'Microphone permission was blocked. Allow microphone access in browser site settings, then reload.',
      };
    }
  }

  return {
    getSpeechRecognition,
    getStatus,
    requestMicrophone,
  };
})();
