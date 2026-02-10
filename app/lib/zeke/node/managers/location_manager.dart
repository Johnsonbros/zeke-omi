/// OpenClaw Node - Location Manager
/// Handles location.get command

import 'package:flutter/foundation.dart';
import 'package:geolocator/geolocator.dart';

/// Location accuracy level
enum LocationAccuracy {
  coarse,
  balanced,
  precise,
}

/// Location result
class LocationResult {
  final double latitude;
  final double longitude;
  final double accuracy;
  final double? altitude;
  final double? speed;
  final double? heading;
  final int timestamp;

  LocationResult({
    required this.latitude,
    required this.longitude,
    required this.accuracy,
    this.altitude,
    this.speed,
    this.heading,
    required this.timestamp,
  });

  Map<String, dynamic> toJson() => {
    'latitude': latitude,
    'longitude': longitude,
    'accuracy': accuracy,
    if (altitude != null) 'altitude': altitude,
    if (speed != null) 'speed': speed,
    if (heading != null) 'heading': heading,
    'timestamp': timestamp,
  };
}

/// Location manager for OpenClaw node commands
class LocationManager {
  bool _permissionChecked = false;
  bool _hasPermission = false;

  /// Check and request location permission
  Future<bool> checkPermission() async {
    if (_permissionChecked) return _hasPermission;

    bool serviceEnabled = await Geolocator.isLocationServiceEnabled();
    if (!serviceEnabled) {
      debugPrint('[LocationManager] Location services disabled');
      _permissionChecked = true;
      _hasPermission = false;
      return false;
    }

    LocationPermission permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.denied) {
      permission = await Geolocator.requestPermission();
      if (permission == LocationPermission.denied) {
        debugPrint('[LocationManager] Permission denied');
        _permissionChecked = true;
        _hasPermission = false;
        return false;
      }
    }

    if (permission == LocationPermission.deniedForever) {
      debugPrint('[LocationManager] Permission permanently denied');
      _permissionChecked = true;
      _hasPermission = false;
      return false;
    }

    _permissionChecked = true;
    _hasPermission = true;
    return true;
  }

  /// Get current location
  /// 
  /// [accuracy] - desired accuracy level
  /// [maxAgeMs] - accept cached location if younger than this
  /// [timeoutMs] - timeout for location request
  Future<LocationResult> get({
    LocationAccuracy accuracy = LocationAccuracy.balanced,
    int? maxAgeMs,
    int timeoutMs = 10000,
  }) async {
    final hasPermission = await checkPermission();
    if (!hasPermission) {
      throw Exception('Location permission not granted');
    }

    // Map accuracy level
    final geoAccuracy = switch (accuracy) {
      LocationAccuracy.coarse => geolocator.LocationAccuracy.low,
      LocationAccuracy.balanced => geolocator.LocationAccuracy.medium,
      LocationAccuracy.precise => geolocator.LocationAccuracy.high,
    };

    // Try to get cached location first if maxAgeMs specified
    if (maxAgeMs != null) {
      final lastKnown = await Geolocator.getLastKnownPosition();
      if (lastKnown != null) {
        final age = DateTime.now().millisecondsSinceEpoch - 
            lastKnown.timestamp.millisecondsSinceEpoch;
        if (age <= maxAgeMs) {
          return _positionToResult(lastKnown);
        }
      }
    }

    // Get fresh location
    final position = await Geolocator.getCurrentPosition(
      desiredAccuracy: geoAccuracy,
      timeLimit: Duration(milliseconds: timeoutMs),
    );

    return _positionToResult(position);
  }

  /// Convert Geolocator Position to LocationResult
  LocationResult _positionToResult(Position position) {
    return LocationResult(
      latitude: position.latitude,
      longitude: position.longitude,
      accuracy: position.accuracy,
      altitude: position.altitude,
      speed: position.speed,
      heading: position.heading,
      timestamp: position.timestamp.millisecondsSinceEpoch,
    );
  }

  /// Check if location is available
  Future<bool> isAvailable() async {
    return await checkPermission();
  }
}

// Alias for clarity
typedef geolocator = Geolocator;
