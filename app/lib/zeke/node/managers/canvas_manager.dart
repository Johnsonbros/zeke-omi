/// OpenClaw Node - Canvas Manager
/// Handles canvas.* commands for WebView control

import 'dart:async';
import 'dart:convert';
import 'dart:typed_data';
import 'dart:ui' as ui;
import 'package:flutter/foundation.dart';
import 'package:flutter/rendering.dart';
import 'package:webview_flutter/webview_flutter.dart';

/// Canvas state
class CanvasState {
  final bool isVisible;
  final String? currentUrl;
  final double x;
  final double y;
  final double? width;
  final double? height;

  CanvasState({
    this.isVisible = false,
    this.currentUrl,
    this.x = 0,
    this.y = 0,
    this.width,
    this.height,
  });

  CanvasState copyWith({
    bool? isVisible,
    String? currentUrl,
    double? x,
    double? y,
    double? width,
    double? height,
  }) {
    return CanvasState(
      isVisible: isVisible ?? this.isVisible,
      currentUrl: currentUrl ?? this.currentUrl,
      x: x ?? this.x,
      y: y ?? this.y,
      width: width ?? this.width,
      height: height ?? this.height,
    );
  }
}

/// Canvas manager for OpenClaw node commands
class CanvasManager {
  WebViewController? _webViewController;
  final _state = ValueNotifier<CanvasState>(CanvasState());
  ValueListenable<CanvasState> get state => _state;

  // Callbacks for UI layer
  void Function(CanvasState state)? onStateChanged;
  Future<Uint8List?> Function()? onSnapshotRequested;

  /// Set the WebView controller (called from UI)
  void setController(WebViewController controller) {
    _webViewController = controller;
    debugPrint('[CanvasManager] WebViewController set');
  }

  /// Present canvas with URL
  Future<Map<String, dynamic>> present({
    required String url,
    double? x,
    double? y,
    double? width,
    double? height,
  }) async {
    _state.value = _state.value.copyWith(
      isVisible: true,
      currentUrl: url,
      x: x ?? 0,
      y: y ?? 0,
      width: width,
      height: height,
    );

    if (_webViewController != null) {
      await _webViewController!.loadRequest(Uri.parse(url));
    }

    onStateChanged?.call(_state.value);

    return {'ok': true, 'url': url};
  }

  /// Hide canvas
  Future<Map<String, dynamic>> hide() async {
    _state.value = _state.value.copyWith(isVisible: false);
    onStateChanged?.call(_state.value);
    return {'ok': true};
  }

  /// Navigate to URL
  Future<Map<String, dynamic>> navigate(String url) async {
    _state.value = _state.value.copyWith(currentUrl: url);

    if (_webViewController != null) {
      await _webViewController!.loadRequest(Uri.parse(url));
    }

    return {'ok': true, 'url': url};
  }

  /// Evaluate JavaScript
  Future<Map<String, dynamic>> eval(String javaScript) async {
    if (_webViewController == null) {
      throw Exception('WebView not initialized');
    }

    try {
      final result = await _webViewController!.runJavaScriptReturningResult(javaScript);
      return {
        'ok': true,
        'result': result.toString(),
      };
    } catch (e) {
      return {
        'ok': false,
        'error': e.toString(),
      };
    }
  }

  /// Take a snapshot of the canvas
  /// 
  /// [format] - 'jpeg' or 'png'
  /// [maxWidth] - maximum width
  /// [quality] - JPEG quality 0.0-1.0
  Future<Map<String, dynamic>> snapshot({
    String format = 'jpeg',
    int? maxWidth,
    double quality = 0.85,
  }) async {
    // Request snapshot from UI layer
    if (onSnapshotRequested == null) {
      throw Exception('Snapshot handler not configured');
    }

    final bytes = await onSnapshotRequested!();
    if (bytes == null) {
      throw Exception('Failed to capture snapshot');
    }

    final base64Data = base64Encode(bytes);

    return {
      'format': format,
      'base64': base64Data,
    };
  }

  /// Handle A2UI push command
  Future<Map<String, dynamic>> a2uiPush({
    String? text,
    String? jsonl,
  }) async {
    if (_webViewController == null) {
      throw Exception('WebView not initialized');
    }

    // Dispatch A2UI event to WebView
    final payload = jsonEncode({
      if (text != null) 'text': text,
      if (jsonl != null) 'jsonl': jsonl,
    });

    final js = '''
      window.dispatchEvent(new CustomEvent('openclaw:a2ui-push', { 
        detail: $payload 
      }));
    ''';

    await _webViewController!.runJavaScript(js);

    return {'ok': true};
  }

  /// Handle A2UI reset command
  Future<Map<String, dynamic>> a2uiReset() async {
    if (_webViewController == null) {
      throw Exception('WebView not initialized');
    }

    await _webViewController!.runJavaScript('''
      window.dispatchEvent(new CustomEvent('openclaw:a2ui-reset'));
    ''');

    return {'ok': true};
  }

  /// Get current canvas state
  Map<String, dynamic> getState() {
    return {
      'isVisible': _state.value.isVisible,
      'currentUrl': _state.value.currentUrl,
      'x': _state.value.x,
      'y': _state.value.y,
      'width': _state.value.width,
      'height': _state.value.height,
    };
  }
}
