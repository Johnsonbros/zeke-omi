/// OpenClaw Node - SMS Manager
/// Handles sms.send command (Android only)

import 'dart:io';
import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:permission_handler/permission_handler.dart';

/// SMS send result
class SmsSendResult {
  final bool success;
  final String? messageId;
  final String? error;

  SmsSendResult({
    required this.success,
    this.messageId,
    this.error,
  });

  Map<String, dynamic> toJson() => {
    'success': success,
    if (messageId != null) 'messageId': messageId,
    if (error != null) 'error': error,
  };
}

/// SMS manager for OpenClaw node commands
class SmsManager {
  static const _channel = MethodChannel('com.johnsonbros.zeke/sms');
  bool _permissionChecked = false;
  bool _hasPermission = false;

  /// Check if SMS is available on this device
  bool get isAvailable => Platform.isAndroid;

  /// Check and request SMS permission
  Future<bool> checkPermission() async {
    if (!isAvailable) return false;
    if (_permissionChecked) return _hasPermission;

    final status = await Permission.sms.status;
    if (status.isGranted) {
      _permissionChecked = true;
      _hasPermission = true;
      return true;
    }

    final result = await Permission.sms.request();
    _permissionChecked = true;
    _hasPermission = result.isGranted;
    return _hasPermission;
  }

  /// Send SMS message
  /// 
  /// [to] - phone number (E.164 format recommended)
  /// [message] - message text
  Future<SmsSendResult> send({
    required String to,
    required String message,
  }) async {
    if (!isAvailable) {
      return SmsSendResult(
        success: false,
        error: 'SMS not available on this platform',
      );
    }

    final hasPermission = await checkPermission();
    if (!hasPermission) {
      return SmsSendResult(
        success: false,
        error: 'SMS permission not granted',
      );
    }

    try {
      // Call native Android SMS API via platform channel
      final result = await _channel.invokeMethod<Map<dynamic, dynamic>>('sendSms', {
        'to': to,
        'message': message,
      });

      if (result?['success'] == true) {
        return SmsSendResult(
          success: true,
          messageId: result?['messageId']?.toString(),
        );
      } else {
        return SmsSendResult(
          success: false,
          error: result?['error']?.toString() ?? 'Unknown error',
        );
      }
    } on PlatformException catch (e) {
      debugPrint('[SmsManager] Platform error: ${e.message}');
      return SmsSendResult(
        success: false,
        error: e.message ?? 'Platform error',
      );
    } catch (e) {
      debugPrint('[SmsManager] Error: $e');
      return SmsSendResult(
        success: false,
        error: e.toString(),
      );
    }
  }
}
