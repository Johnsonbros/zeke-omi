/// OpenClaw Node - Canvas WebView Widget
/// WebView that can be controlled by Gateway commands

import 'dart:async';
import 'dart:convert';
import 'dart:typed_data';
import 'dart:ui' as ui;
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:webview_flutter/webview_flutter.dart';
import '../node_runtime.dart';

/// Canvas WebView controlled by OpenClaw Gateway
class CanvasWebViewWidget extends StatefulWidget {
  /// Initial URL to load
  final String? initialUrl;

  /// Default URL when no content is loaded
  final String defaultUrl;

  /// Callback when WebView is ready
  final void Function(WebViewController controller)? onWebViewCreated;

  const CanvasWebViewWidget({
    super.key,
    this.initialUrl,
    this.defaultUrl = 'about:blank',
    this.onWebViewCreated,
  });

  @override
  State<CanvasWebViewWidget> createState() => _CanvasWebViewWidgetState();
}

class _CanvasWebViewWidgetState extends State<CanvasWebViewWidget> {
  late WebViewController _controller;
  final GlobalKey _repaintKey = GlobalKey();
  bool _isLoading = true;
  String? _currentUrl;
  String? _pageTitle;

  @override
  void initState() {
    super.initState();
    _initController();
  }

  void _initController() {
    _controller = WebViewController()
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..setNavigationDelegate(NavigationDelegate(
        onPageStarted: (url) {
          setState(() {
            _isLoading = true;
            _currentUrl = url;
          });
        },
        onPageFinished: (url) async {
          setState(() {
            _isLoading = false;
            _currentUrl = url;
          });
          // Get page title
          final title = await _controller.getTitle();
          setState(() => _pageTitle = title);
        },
        onWebResourceError: (error) {
          debugPrint('[CanvasWebView] Error: ${error.description}');
        },
      ))
      ..addJavaScriptChannel(
        'OpenClawBridge',
        onMessageReceived: _handleJsMessage,
      );

    // Load initial URL
    final url = widget.initialUrl ?? widget.defaultUrl;
    _controller.loadRequest(Uri.parse(url));

    // Register with node runtime
    nodeRuntime.canvas.setController(_controller);
    nodeRuntime.canvas.onSnapshotRequested = _takeSnapshot;
    nodeRuntime.canvas.onStateChanged = (state) {
      if (state.isVisible && state.currentUrl != null) {
        _controller.loadRequest(Uri.parse(state.currentUrl!));
      }
    };

    widget.onWebViewCreated?.call(_controller);
  }

  /// Handle messages from JavaScript
  void _handleJsMessage(JavaScriptMessage message) {
    try {
      final data = jsonDecode(message.message) as Map<String, dynamic>;
      final type = data['type'] as String?;

      switch (type) {
        case 'a2ui_action':
          // Forward A2UI action to Gateway
          _handleA2UIAction(data);
          break;
        default:
          debugPrint('[CanvasWebView] Unknown JS message type: $type');
      }
    } catch (e) {
      debugPrint('[CanvasWebView] Error parsing JS message: $e');
    }
  }

  /// Handle A2UI action from WebView
  void _handleA2UIAction(Map<String, dynamic> data) {
    final actionName = data['action'] as String?;
    final componentId = data['componentId'] as String?;
    final context = data['context'];

    debugPrint('[CanvasWebView] A2UI action: $actionName from $componentId');

    // TODO: Forward to Gateway via nodeRuntime
  }

  /// Take a snapshot of the WebView
  Future<Uint8List?> _takeSnapshot() async {
    try {
      // Use RepaintBoundary to capture the widget
      final boundary = _repaintKey.currentContext?.findRenderObject() 
          as RenderRepaintBoundary?;
      
      if (boundary == null) {
        debugPrint('[CanvasWebView] Cannot find render boundary');
        return null;
      }

      // Capture image
      final image = await boundary.toImage(pixelRatio: 2.0);
      final byteData = await image.toByteData(format: ui.ImageByteFormat.png);
      
      return byteData?.buffer.asUint8List();
    } catch (e) {
      debugPrint('[CanvasWebView] Snapshot error: $e');
      return null;
    }
  }

  @override
  Widget build(BuildContext context) {
    return ValueListenableBuilder(
      valueListenable: nodeRuntime.canvas.state,
      builder: (context, state, child) {
        // Hide if not visible
        if (!state.isVisible) {
          return const SizedBox.shrink();
        }

        return Positioned(
          left: state.x,
          top: state.y,
          width: state.width,
          height: state.height,
          child: RepaintBoundary(
            key: _repaintKey,
            child: Container(
              decoration: BoxDecoration(
                border: Border.all(color: Colors.grey.shade300),
                borderRadius: BorderRadius.circular(8),
              ),
              clipBehavior: Clip.antiAlias,
              child: Stack(
                children: [
                  // WebView
                  WebViewWidget(controller: _controller),
                  
                  // Loading indicator
                  if (_isLoading)
                    const Center(
                      child: CircularProgressIndicator(),
                    ),
                  
                  // URL bar overlay (optional, for debugging)
                  if (kDebugMode)
                    Positioned(
                      top: 0,
                      left: 0,
                      right: 0,
                      child: Container(
                        color: Colors.black54,
                        padding: const EdgeInsets.symmetric(
                          horizontal: 8,
                          vertical: 4,
                        ),
                        child: Text(
                          _pageTitle ?? _currentUrl ?? '',
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 10,
                          ),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                    ),
                ],
              ),
            ),
          ),
        );
      },
    );
  }

  @override
  void dispose() {
    nodeRuntime.canvas.onSnapshotRequested = null;
    nodeRuntime.canvas.onStateChanged = null;
    super.dispose();
  }
}

/// Overlay that shows the canvas WebView on top of other content
class CanvasOverlay extends StatelessWidget {
  final Widget child;

  const CanvasOverlay({
    super.key,
    required this.child,
  });

  @override
  Widget build(BuildContext context) {
    return Stack(
      children: [
        // Main app content
        child,
        
        // Canvas WebView overlay
        const CanvasWebViewWidget(),
      ],
    );
  }
}
