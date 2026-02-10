/// OpenClaw Node Protocol - Capabilities and Commands
/// Ported from OpenClaw Android (Kotlin) reference implementation

/// Node capabilities advertised to Gateway
enum OpenClawCapability {
  canvas('canvas'),
  camera('camera'),
  screen('screen'),
  sms('sms'),
  voiceWake('voiceWake'),
  location('location');

  final String rawValue;
  const OpenClawCapability(this.rawValue);
}

/// Canvas commands
enum OpenClawCanvasCommand {
  present('canvas.present'),
  hide('canvas.hide'),
  navigate('canvas.navigate'),
  eval('canvas.eval'),
  snapshot('canvas.snapshot');

  final String rawValue;
  const OpenClawCanvasCommand(this.rawValue);

  static const namespacePrefix = 'canvas.';
}

/// Canvas A2UI commands
enum OpenClawCanvasA2UICommand {
  push('canvas.a2ui.push'),
  pushJSONL('canvas.a2ui.pushJSONL'),
  reset('canvas.a2ui.reset');

  final String rawValue;
  const OpenClawCanvasA2UICommand(this.rawValue);

  static const namespacePrefix = 'canvas.a2ui.';
}

/// Camera commands
enum OpenClawCameraCommand {
  snap('camera.snap'),
  clip('camera.clip');

  final String rawValue;
  const OpenClawCameraCommand(this.rawValue);

  static const namespacePrefix = 'camera.';
}

/// Screen commands
enum OpenClawScreenCommand {
  record('screen.record');

  final String rawValue;
  const OpenClawScreenCommand(this.rawValue);

  static const namespacePrefix = 'screen.';
}

/// SMS commands
enum OpenClawSmsCommand {
  send('sms.send');

  final String rawValue;
  const OpenClawSmsCommand(this.rawValue);

  static const namespacePrefix = 'sms.';
}

/// Location commands
enum OpenClawLocationCommand {
  get('location.get');

  final String rawValue;
  const OpenClawLocationCommand(this.rawValue);

  static const namespacePrefix = 'location.';
}
