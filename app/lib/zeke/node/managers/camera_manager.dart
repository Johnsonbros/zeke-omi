/// OpenClaw Node - Camera Manager
/// Handles camera.snap and camera.clip commands

import 'dart:convert';
import 'dart:io';
import 'dart:typed_data';
import 'package:camera/camera.dart';
import 'package:flutter/foundation.dart';
import 'package:path_provider/path_provider.dart';
import 'package:image/image.dart' as img;

/// Camera facing direction
enum CameraFacing { front, back }

/// Camera capture result
class CameraCaptureResult {
  final String format;
  final String base64;
  final int width;
  final int height;

  CameraCaptureResult({
    required this.format,
    required this.base64,
    required this.width,
    required this.height,
  });

  Map<String, dynamic> toJson() => {
    'format': format,
    'base64': base64,
    'width': width,
    'height': height,
  };
}

/// Camera manager for OpenClaw node commands
class CameraManager {
  CameraController? _controller;
  List<CameraDescription>? _cameras;
  bool _initialized = false;

  /// Initialize camera system
  Future<void> initialize() async {
    if (_initialized) return;
    _cameras = await availableCameras();
    _initialized = true;
    debugPrint('[CameraManager] Found ${_cameras?.length ?? 0} cameras');
  }

  /// Get available cameras
  Future<List<Map<String, dynamic>>> listCameras() async {
    await initialize();
    return _cameras?.map((c) => {
      'id': c.name,
      'facing': c.lensDirection == CameraLensDirection.front ? 'front' : 'back',
      'sensorOrientation': c.sensorOrientation,
    }).toList() ?? [];
  }

  /// Take a photo
  /// 
  /// [facing] - front or back camera
  /// [maxWidth] - maximum width (will scale down if larger)
  /// [quality] - JPEG quality 0.0-1.0
  Future<CameraCaptureResult> snap({
    CameraFacing facing = CameraFacing.back,
    int? maxWidth,
    double quality = 0.85,
  }) async {
    await initialize();

    // Find camera with requested facing
    final camera = _cameras?.firstWhere(
      (c) => facing == CameraFacing.front
          ? c.lensDirection == CameraLensDirection.front
          : c.lensDirection == CameraLensDirection.back,
      orElse: () => _cameras!.first,
    );

    if (camera == null) {
      throw Exception('No camera available');
    }

    // Initialize controller
    _controller = CameraController(
      camera,
      ResolutionPreset.high,
      enableAudio: false,
    );

    try {
      await _controller!.initialize();
      
      // Take picture
      final file = await _controller!.takePicture();
      final bytes = await file.readAsBytes();

      // Process image (resize if needed, convert to JPEG)
      img.Image? image = img.decodeImage(bytes);
      if (image == null) {
        throw Exception('Failed to decode image');
      }

      // Resize if maxWidth specified
      if (maxWidth != null && image.width > maxWidth) {
        image = img.copyResize(image, width: maxWidth);
      }

      // Encode as JPEG
      final jpegBytes = img.encodeJpg(image, quality: (quality * 100).round());
      final base64Data = base64Encode(jpegBytes);

      // Clean up temp file
      await File(file.path).delete();

      return CameraCaptureResult(
        format: 'jpeg',
        base64: base64Data,
        width: image.width,
        height: image.height,
      );
    } finally {
      await _controller?.dispose();
      _controller = null;
    }
  }

  /// Record a video clip
  /// 
  /// [facing] - front or back camera
  /// [durationMs] - duration in milliseconds (max 30000)
  /// [includeAudio] - whether to record audio
  Future<Map<String, dynamic>> clip({
    CameraFacing facing = CameraFacing.back,
    int durationMs = 5000,
    bool includeAudio = true,
  }) async {
    await initialize();

    // Clamp duration
    durationMs = durationMs.clamp(1000, 30000);

    // Find camera
    final camera = _cameras?.firstWhere(
      (c) => facing == CameraFacing.front
          ? c.lensDirection == CameraLensDirection.front
          : c.lensDirection == CameraLensDirection.back,
      orElse: () => _cameras!.first,
    );

    if (camera == null) {
      throw Exception('No camera available');
    }

    // Initialize controller
    _controller = CameraController(
      camera,
      ResolutionPreset.medium,
      enableAudio: includeAudio,
    );

    try {
      await _controller!.initialize();
      
      // Start recording
      await _controller!.startVideoRecording();
      
      // Wait for duration
      await Future.delayed(Duration(milliseconds: durationMs));
      
      // Stop recording
      final file = await _controller!.stopVideoRecording();
      final bytes = await File(file.path).readAsBytes();
      final base64Data = base64Encode(bytes);

      // Clean up temp file
      await File(file.path).delete();

      return {
        'format': 'mp4',
        'base64': base64Data,
        'durationMs': durationMs,
      };
    } finally {
      await _controller?.dispose();
      _controller = null;
    }
  }

  /// Dispose resources
  Future<void> dispose() async {
    await _controller?.dispose();
    _controller = null;
  }
}
