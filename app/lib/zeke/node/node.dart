/// OpenClaw Node - Main export file
/// 
/// Usage:
/// ```dart
/// import 'package:omi/zeke/node/node.dart';
/// 
/// // Initialize
/// await nodeRuntime.initialize();
/// 
/// // Connect to Gateway
/// await nodeRuntime.connect(
///   GatewayEndpoint(host: 'zeke.tail5b81a2.ts.net', port: 18789),
///   authToken: 'your-token',
/// );
/// 
/// // Check connection status
/// nodeRuntime.isConnected.addListener(() {
///   print('Connected: ${nodeRuntime.isConnected.value}');
/// });
/// ```

export 'protocol/capabilities.dart';
export 'gateway/gateway_session.dart';
export 'managers/camera_manager.dart';
export 'managers/canvas_manager.dart';
export 'managers/location_manager.dart';
export 'managers/sms_manager.dart';
export 'node_runtime.dart';
