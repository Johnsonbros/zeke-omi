/// OpenClaw Node - Screen Recording Manager
/// Handles screen.record command

import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:path_provider/path_provider.dart';

/// Screen recording result
class ScreenRecordResult {
  final String format;
  final String base64;
  final int durationMs;
  final int width;
  final int height;

  ScreenRecordResult({
    required this.format,
    required this.base64,
    required this.durationMs,
    required this.width,
    required this.height,
  });

  Map<String, dynamic> toJson() => {
    'format': format,
    'base64': base64,
    'durationMs': durationMs,
    'width': width,
    'height': height,
  };
}

/// Screen recording manager for OpenClaw node commands
class ScreenManager {
  static const _channel = MethodChannel('com.johnsonbros.zeke/screen');
  bool _isRecording = false;
  
  /// Check if screen recording is available
  bool get isAvailable => Platform.isAndroid; // iOS requires different approach

  /// Check if currently recording
  bool get isRecording => _isRecording;

  /// Check if we have screen recording permission
  Future<bool> checkPermission() async {
    if (!isAvailable) return false;
    
    try {
      final result = await _channel.invokeMethod<bool>('checkPermission');
      return result ?? false;
    } catch (e) {
      debugPrint('[ScreenManager] Permission check error: $e');
      return false;
    }
  }

  /// Request screen recording permission
  /// Returns true if permission was granted
  Future<bool> requestPermission() async {
    if (!isAvailable) return false;

    try {
      final result = await _channel.invokeMethod<bool>('requestPermission');
      return result ?? false;
    } catch (e) {
      debugPrint('[ScreenManager] Permission request error: $e');
      return false;
    }
  }

  /// Record screen
  /// 
  /// [durationMs] - duration in milliseconds (max 60000)
  /// [fps] - frames per second (default 30, max 60)
  /// [includeAudio] - whether to record audio
  Future<ScreenRecordResult> record({
    int durationMs = 10000,
    int fps = 30,
    bool includeAudio = false,
  }) async {
    if (!isAvailable) {
      throw Exception('Screen recording not available on this platform');
    }

    if (_isRecording) {
      throw Exception('Already recording');
    }

    // Clamp values
    durationMs = durationMs.clamp(1000, 60000);
    fps = fps.clamp(1, 60);

    _isRecording = true;

    try {
      // Get temp directory for output
      final tempDir = await getTemporaryDirectory();
      final outputPath = '${tempDir.path}/screen_record_${DateTime.now().millisecondsSinceEpoch}.mp4';

      // Start recording via platform channel
      final result = await _channel.invokeMethod<Map<dynamic, dynamic>>('startRecording', {
        'outputPath': outputPath,
        'durationMs': durationMs,
        'fps': fps,
        'includeAudio': includeAudio,
      });

      if (result == null || result['success'] != true) {
        throw Exception(result?['error'] ?? 'Recording failed');
      }

      // Wait for recording to complete
      await Future.delayed(Duration(milliseconds: durationMs + 500));

      // Stop recording
      final stopResult = await _channel.invokeMethod<Map<dynamic, dynamic>>('stopRecording');
      
      if (stopResult == null || stopResult['success'] != true) {
        throw Exception(stopResult?['error'] ?? 'Failed to stop recording');
      }

      // Read the file
      final file = File(outputPath);
      if (!await file.exists()) {
        throw Exception('Recording file not found');
      }

      final bytes = await file.readAsBytes();
      final base64Data = base64Encode(bytes);

      // Clean up
      await file.delete();

      return ScreenRecordResult(
        format: 'mp4',
        base64: base64Data,
        durationMs: durationMs,
        width: stopResult['width'] as int? ?? 0,
        height: stopResult['height'] as int? ?? 0,
      );
    } finally {
      _isRecording = false;
    }
  }

  /// Stop current recording (if any)
  Future<void> stop() async {
    if (!_isRecording) return;

    try {
      await _channel.invokeMethod('stopRecording');
    } catch (e) {
      debugPrint('[ScreenManager] Stop error: $e');
    } finally {
      _isRecording = false;
    }
  }
}
