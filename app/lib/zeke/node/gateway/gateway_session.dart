/// OpenClaw Gateway WebSocket Session
/// Handles connection, authentication, and message routing

import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'package:flutter/foundation.dart';
import '../protocol/capabilities.dart';

/// Connection state
enum GatewayConnectionState {
  disconnected,
  connecting,
  connected,
  paired,
  error,
}

/// Gateway endpoint configuration
class GatewayEndpoint {
  final String host;
  final int port;
  final bool useTls;
  final String? tlsFingerprint;

  GatewayEndpoint({
    required this.host,
    this.port = 18789,
    this.useTls = false,
    this.tlsFingerprint,
  });

  String get wsUrl => '${useTls ? 'wss' : 'ws'}://$host:$port';

  @override
  String toString() => wsUrl;
}

/// Callback for handling node commands from Gateway
typedef NodeCommandHandler = Future<Map<String, dynamic>> Function(
  String command,
  Map<String, dynamic> params,
);

/// Gateway WebSocket session manager
class GatewaySession {
  final GatewayEndpoint endpoint;
  final String deviceId;
  final String deviceName;
  final String? authToken;
  final List<OpenClawCapability> capabilities;
  final NodeCommandHandler onCommand;

  WebSocket? _socket;
  Timer? _heartbeatTimer;
  int _requestId = 0;
  final Map<int, Completer<Map<String, dynamic>>> _pendingRequests = {};

  final _connectionState = ValueNotifier<GatewayConnectionState>(
    GatewayConnectionState.disconnected,
  );
  ValueListenable<GatewayConnectionState> get connectionState => _connectionState;

  final _statusText = ValueNotifier<String>('Disconnected');
  ValueListenable<String> get statusText => _statusText;

  GatewaySession({
    required this.endpoint,
    required this.deviceId,
    required this.deviceName,
    required this.capabilities,
    required this.onCommand,
    this.authToken,
  });

  /// Connect to Gateway WebSocket
  Future<void> connect() async {
    if (_connectionState.value == GatewayConnectionState.connecting ||
        _connectionState.value == GatewayConnectionState.connected) {
      return;
    }

    _connectionState.value = GatewayConnectionState.connecting;
    _statusText.value = 'Connecting to ${endpoint.host}...';

    try {
      _socket = await WebSocket.connect(endpoint.wsUrl);
      _connectionState.value = GatewayConnectionState.connected;
      _statusText.value = 'Connected, authenticating...';

      // Send hello/auth message
      _sendHello();

      // Listen for messages
      _socket!.listen(
        _handleMessage,
        onError: _handleError,
        onDone: _handleDisconnect,
      );

      // Start heartbeat
      _startHeartbeat();
    } catch (e) {
      _connectionState.value = GatewayConnectionState.error;
      _statusText.value = 'Connection failed: $e';
      debugPrint('[GatewaySession] Connection error: $e');
    }
  }

  /// Disconnect from Gateway
  Future<void> disconnect() async {
    _heartbeatTimer?.cancel();
    _heartbeatTimer = null;
    await _socket?.close();
    _socket = null;
    _connectionState.value = GatewayConnectionState.disconnected;
    _statusText.value = 'Disconnected';
  }

  /// Send hello/authentication message
  void _sendHello() {
    final hello = {
      'type': 'hello',
      'role': 'node',
      'deviceId': deviceId,
      'deviceName': deviceName,
      'capabilities': capabilities.map((c) => c.rawValue).toList(),
      'platform': Platform.isAndroid ? 'android' : 'ios',
      'version': '1.0.0', // TODO: Get from package info
      if (authToken != null) 'token': authToken,
    };
    _send(hello);
  }

  /// Send JSON message
  void _send(Map<String, dynamic> message) {
    if (_socket == null) return;
    final json = jsonEncode(message);
    debugPrint('[GatewaySession] >>> $json');
    _socket!.add(json);
  }

  /// Handle incoming WebSocket message
  void _handleMessage(dynamic data) {
    try {
      final message = jsonDecode(data as String) as Map<String, dynamic>;
      debugPrint('[GatewaySession] <<< $message');

      final type = message['type'] as String?;
      switch (type) {
        case 'welcome':
          _handleWelcome(message);
          break;
        case 'paired':
          _handlePaired(message);
          break;
        case 'invoke':
          _handleInvoke(message);
          break;
        case 'response':
          _handleResponse(message);
          break;
        case 'error':
          _handleServerError(message);
          break;
        case 'pong':
          // Heartbeat response, ignore
          break;
        default:
          debugPrint('[GatewaySession] Unknown message type: $type');
      }
    } catch (e) {
      debugPrint('[GatewaySession] Error parsing message: $e');
    }
  }

  /// Handle welcome message (connection accepted)
  void _handleWelcome(Map<String, dynamic> message) {
    _statusText.value = 'Connected, awaiting pairing...';
    debugPrint('[GatewaySession] Welcome received: $message');
  }

  /// Handle paired message (pairing approved)
  void _handlePaired(Map<String, dynamic> message) {
    _connectionState.value = GatewayConnectionState.paired;
    _statusText.value = 'Paired with Gateway';
    debugPrint('[GatewaySession] Paired: $message');
  }

  /// Handle invoke message (command from Gateway)
  Future<void> _handleInvoke(Map<String, dynamic> message) async {
    final requestId = message['requestId'];
    final command = message['command'] as String?;
    final params = (message['params'] as Map<String, dynamic>?) ?? {};

    if (command == null) {
      _sendInvokeError(requestId, 'MISSING_COMMAND', 'No command specified');
      return;
    }

    try {
      final result = await onCommand(command, params);
      _sendInvokeResult(requestId, result);
    } catch (e) {
      _sendInvokeError(requestId, 'COMMAND_FAILED', e.toString());
    }
  }

  /// Send invoke result back to Gateway
  void _sendInvokeResult(dynamic requestId, Map<String, dynamic> result) {
    _send({
      'type': 'invoke_result',
      'requestId': requestId,
      'ok': true,
      'result': result,
    });
  }

  /// Send invoke error back to Gateway
  void _sendInvokeError(dynamic requestId, String code, String message) {
    _send({
      'type': 'invoke_result',
      'requestId': requestId,
      'ok': false,
      'error': {'code': code, 'message': message},
    });
  }

  /// Handle response to our requests
  void _handleResponse(Map<String, dynamic> message) {
    final requestId = message['requestId'] as int?;
    if (requestId != null && _pendingRequests.containsKey(requestId)) {
      final completer = _pendingRequests.remove(requestId)!;
      if (message['ok'] == true) {
        completer.complete(message['result'] as Map<String, dynamic>? ?? {});
      } else {
        completer.completeError(message['error'] ?? 'Unknown error');
      }
    }
  }

  /// Handle server error
  void _handleServerError(Map<String, dynamic> message) {
    final error = message['error'];
    debugPrint('[GatewaySession] Server error: $error');
    _statusText.value = 'Error: $error';
  }

  /// Handle WebSocket error
  void _handleError(dynamic error) {
    debugPrint('[GatewaySession] WebSocket error: $error');
    _connectionState.value = GatewayConnectionState.error;
    _statusText.value = 'Connection error: $error';
  }

  /// Handle WebSocket disconnect
  void _handleDisconnect() {
    debugPrint('[GatewaySession] WebSocket disconnected');
    _connectionState.value = GatewayConnectionState.disconnected;
    _statusText.value = 'Disconnected';
    _heartbeatTimer?.cancel();
    _socket = null;
  }

  /// Start heartbeat timer
  void _startHeartbeat() {
    _heartbeatTimer?.cancel();
    _heartbeatTimer = Timer.periodic(const Duration(seconds: 30), (_) {
      if (_socket != null) {
        _send({'type': 'ping'});
      }
    });
  }

  /// Send a request to Gateway and wait for response
  Future<Map<String, dynamic>> request(
    String method,
    Map<String, dynamic> params,
  ) async {
    final requestId = ++_requestId;
    final completer = Completer<Map<String, dynamic>>();
    _pendingRequests[requestId] = completer;

    _send({
      'type': 'request',
      'requestId': requestId,
      'method': method,
      'params': params,
    });

    return completer.future.timeout(
      const Duration(seconds: 30),
      onTimeout: () {
        _pendingRequests.remove(requestId);
        throw TimeoutException('Request timed out');
      },
    );
  }

  /// Send a node event to Gateway
  void sendNodeEvent(String event, {Map<String, dynamic>? payload}) {
    _send({
      'type': 'node_event',
      'event': event,
      if (payload != null) 'payload': payload,
    });
  }

  /// Send chat message through Gateway
  Future<void> sendChat(String message, {String sessionKey = 'main'}) async {
    await request('chat.send', {
      'sessionKey': sessionKey,
      'message': message,
    });
  }
}
