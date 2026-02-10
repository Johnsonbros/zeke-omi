/// OpenClaw Node Runtime
/// Main coordinator for all node capabilities

import 'dart:async';
import 'dart:io';
import 'package:flutter/foundation.dart';
import 'package:device_info_plus/device_info_plus.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:uuid/uuid.dart';

import 'protocol/capabilities.dart';
import 'gateway/gateway_session.dart';
import 'managers/camera_manager.dart';
import 'managers/canvas_manager.dart';
import 'managers/location_manager.dart';
import 'managers/screen_manager.dart';
import 'managers/sms_manager.dart';

/// Node runtime - main entry point for OpenClaw node functionality
class NodeRuntime {
  // Managers
  final CameraManager camera = CameraManager();
  final CanvasManager canvas = CanvasManager();
  final LocationManager location = LocationManager();
  final ScreenManager screen = ScreenManager();
  final SmsManager sms = SmsManager();

  // Gateway session
  GatewaySession? _session;
  GatewayEndpoint? _endpoint;

  // Device identity
  String? _deviceId;
  String? _deviceName;

  // State
  final _isConnected = ValueNotifier<bool>(false);
  ValueListenable<bool> get isConnected => _isConnected;

  final _statusText = ValueNotifier<String>('Not connected');
  ValueListenable<String> get statusText => _statusText;

  /// Initialize the node runtime
  Future<void> initialize() async {
    await _loadDeviceIdentity();
    await camera.initialize();
    debugPrint('[NodeRuntime] Initialized with deviceId: $_deviceId');
  }

  /// Load or create device identity
  Future<void> _loadDeviceIdentity() async {
    final prefs = await SharedPreferences.getInstance();
    
    // Load or create device ID
    _deviceId = prefs.getString('openclaw_device_id');
    if (_deviceId == null) {
      _deviceId = const Uuid().v4();
      await prefs.setString('openclaw_device_id', _deviceId!);
    }

    // Get device name
    final deviceInfo = DeviceInfoPlugin();
    if (Platform.isAndroid) {
      final info = await deviceInfo.androidInfo;
      _deviceName = '${info.brand} ${info.model}';
    } else if (Platform.isIOS) {
      final info = await deviceInfo.iosInfo;
      _deviceName = info.name;
    } else {
      _deviceName = 'ZEKE Device';
    }

    // Allow override from prefs
    _deviceName = prefs.getString('openclaw_device_name') ?? _deviceName;
  }

  /// Get available capabilities
  List<OpenClawCapability> get capabilities {
    final caps = <OpenClawCapability>[
      OpenClawCapability.canvas,
      OpenClawCapability.camera,
      OpenClawCapability.location,
    ];

    // SMS only on Android with telephony
    if (sms.isAvailable) {
      caps.add(OpenClawCapability.sms);
    }

    // Screen recording (Android only for now)
    if (screen.isAvailable) {
      caps.add(OpenClawCapability.screen);
    }

    // TODO: Add voiceWake capability

    return caps;
  }

  /// Connect to Gateway
  Future<void> connect(GatewayEndpoint endpoint, {String? authToken}) async {
    _endpoint = endpoint;
    
    _session = GatewaySession(
      endpoint: endpoint,
      deviceId: _deviceId!,
      deviceName: _deviceName!,
      capabilities: capabilities,
      authToken: authToken,
      onCommand: _handleCommand,
    );

    // Forward status updates
    _session!.statusText.addListener(() {
      _statusText.value = _session!.statusText.value;
    });
    _session!.connectionState.addListener(() {
      _isConnected.value = 
          _session!.connectionState.value == GatewayConnectionState.paired;
    });

    await _session!.connect();
  }

  /// Disconnect from Gateway
  Future<void> disconnect() async {
    await _session?.disconnect();
    _session = null;
    _isConnected.value = false;
    _statusText.value = 'Disconnected';
  }

  /// Handle incoming command from Gateway
  Future<Map<String, dynamic>> _handleCommand(
    String command,
    Map<String, dynamic> params,
  ) async {
    debugPrint('[NodeRuntime] Command: $command, params: $params');

    try {
      // Canvas commands
      if (command.startsWith(OpenClawCanvasCommand.namespacePrefix)) {
        return await _handleCanvasCommand(command, params);
      }

      // Canvas A2UI commands
      if (command.startsWith(OpenClawCanvasA2UICommand.namespacePrefix)) {
        return await _handleA2UICommand(command, params);
      }

      // Camera commands
      if (command.startsWith(OpenClawCameraCommand.namespacePrefix)) {
        return await _handleCameraCommand(command, params);
      }

      // Location commands
      if (command.startsWith(OpenClawLocationCommand.namespacePrefix)) {
        return await _handleLocationCommand(command, params);
      }

      // SMS commands
      if (command.startsWith(OpenClawSmsCommand.namespacePrefix)) {
        return await _handleSmsCommand(command, params);
      }

      // Screen commands
      if (command.startsWith(OpenClawScreenCommand.namespacePrefix)) {
        return await _handleScreenCommand(command, params);
      }

      throw Exception('Unknown command: $command');
    } catch (e) {
      debugPrint('[NodeRuntime] Command error: $e');
      return {'ok': false, 'error': e.toString()};
    }
  }

  /// Handle canvas.* commands
  Future<Map<String, dynamic>> _handleCanvasCommand(
    String command,
    Map<String, dynamic> params,
  ) async {
    switch (command) {
      case 'canvas.present':
        return await canvas.present(
          url: params['url'] as String? ?? params['target'] as String,
          x: (params['x'] as num?)?.toDouble(),
          y: (params['y'] as num?)?.toDouble(),
          width: (params['width'] as num?)?.toDouble(),
          height: (params['height'] as num?)?.toDouble(),
        );

      case 'canvas.hide':
        return await canvas.hide();

      case 'canvas.navigate':
        return await canvas.navigate(params['url'] as String);

      case 'canvas.eval':
        return await canvas.eval(params['javaScript'] as String);

      case 'canvas.snapshot':
        return await canvas.snapshot(
          format: params['format'] as String? ?? 'jpeg',
          maxWidth: params['maxWidth'] as int?,
          quality: (params['quality'] as num?)?.toDouble() ?? 0.85,
        );

      default:
        throw Exception('Unknown canvas command: $command');
    }
  }

  /// Handle canvas.a2ui.* commands
  Future<Map<String, dynamic>> _handleA2UICommand(
    String command,
    Map<String, dynamic> params,
  ) async {
    switch (command) {
      case 'canvas.a2ui.push':
      case 'canvas.a2ui.pushJSONL':
        return await canvas.a2uiPush(
          text: params['text'] as String?,
          jsonl: params['jsonl'] as String?,
        );

      case 'canvas.a2ui.reset':
        return await canvas.a2uiReset();

      default:
        throw Exception('Unknown A2UI command: $command');
    }
  }

  /// Handle camera.* commands
  Future<Map<String, dynamic>> _handleCameraCommand(
    String command,
    Map<String, dynamic> params,
  ) async {
    switch (command) {
      case 'camera.snap':
        final facingStr = params['facing'] as String? ?? 'back';
        final facing = facingStr == 'front' 
            ? CameraFacing.front 
            : CameraFacing.back;
        
        final result = await camera.snap(
          facing: facing,
          maxWidth: params['maxWidth'] as int?,
          quality: (params['quality'] as num?)?.toDouble() ?? 0.85,
        );
        return result.toJson();

      case 'camera.clip':
        final facingStr = params['facing'] as String? ?? 'back';
        final facing = facingStr == 'front' 
            ? CameraFacing.front 
            : CameraFacing.back;
        
        return await camera.clip(
          facing: facing,
          durationMs: params['durationMs'] as int? ?? 5000,
          includeAudio: params['includeAudio'] as bool? ?? true,
        );

      default:
        throw Exception('Unknown camera command: $command');
    }
  }

  /// Handle location.* commands
  Future<Map<String, dynamic>> _handleLocationCommand(
    String command,
    Map<String, dynamic> params,
  ) async {
    switch (command) {
      case 'location.get':
        final accuracyStr = params['accuracy'] as String? ?? 'balanced';
        final accuracy = switch (accuracyStr) {
          'coarse' => LocationAccuracy.coarse,
          'precise' => LocationAccuracy.precise,
          _ => LocationAccuracy.balanced,
        };

        final result = await location.get(
          accuracy: accuracy,
          maxAgeMs: params['maxAgeMs'] as int?,
          timeoutMs: params['timeoutMs'] as int? ?? 10000,
        );
        return result.toJson();

      default:
        throw Exception('Unknown location command: $command');
    }
  }

  /// Handle sms.* commands
  Future<Map<String, dynamic>> _handleSmsCommand(
    String command,
    Map<String, dynamic> params,
  ) async {
    switch (command) {
      case 'sms.send':
        final result = await sms.send(
          to: params['to'] as String,
          message: params['message'] as String,
        );
        return result.toJson();

      default:
        throw Exception('Unknown SMS command: $command');
    }
  }

  /// Handle screen.* commands
  Future<Map<String, dynamic>> _handleScreenCommand(
    String command,
    Map<String, dynamic> params,
  ) async {
    switch (command) {
      case 'screen.record':
        final result = await screen.record(
          durationMs: params['durationMs'] as int? ?? 10000,
          fps: params['fps'] as int? ?? 30,
          includeAudio: params['includeAudio'] as bool? ?? false,
        );
        return result.toJson();

      default:
        throw Exception('Unknown screen command: $command');
    }
  }

  /// Send chat message through Gateway
  Future<void> sendChat(String message) async {
    await _session?.sendChat(message);
  }

  /// Get device ID
  String? get deviceId => _deviceId;

  /// Get device name
  String? get deviceName => _deviceName;

  /// Set device name
  Future<void> setDeviceName(String name) async {
    _deviceName = name;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('openclaw_device_name', name);
  }

  /// Dispose resources
  Future<void> dispose() async {
    await disconnect();
    await camera.dispose();
  }
}

/// Global node runtime instance
final nodeRuntime = NodeRuntime();
