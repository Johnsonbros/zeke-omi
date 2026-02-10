/// OpenClaw Node - Gateway Settings Widget
/// UI for connecting to Gateway

import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../node.dart';

/// Widget for configuring and connecting to OpenClaw Gateway
class GatewaySettingsWidget extends StatefulWidget {
  const GatewaySettingsWidget({super.key});

  @override
  State<GatewaySettingsWidget> createState() => _GatewaySettingsWidgetState();
}

class _GatewaySettingsWidgetState extends State<GatewaySettingsWidget> {
  final _hostController = TextEditingController();
  final _portController = TextEditingController(text: '18789');
  final _tokenController = TextEditingController();
  bool _useTls = false;
  bool _isConnecting = false;

  @override
  void initState() {
    super.initState();
    _loadSettings();
  }

  Future<void> _loadSettings() async {
    final prefs = await SharedPreferences.getInstance();
    setState(() {
      _hostController.text = prefs.getString('gateway_host') ?? '';
      _portController.text = prefs.getString('gateway_port') ?? '18789';
      _tokenController.text = prefs.getString('gateway_token') ?? '';
      _useTls = prefs.getBool('gateway_use_tls') ?? false;
    });
  }

  Future<void> _saveSettings() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('gateway_host', _hostController.text);
    await prefs.setString('gateway_port', _portController.text);
    await prefs.setString('gateway_token', _tokenController.text);
    await prefs.setBool('gateway_use_tls', _useTls);
  }

  Future<void> _connect() async {
    if (_hostController.text.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please enter Gateway host')),
      );
      return;
    }

    setState(() => _isConnecting = true);

    try {
      await _saveSettings();

      final endpoint = GatewayEndpoint(
        host: _hostController.text,
        port: int.tryParse(_portController.text) ?? 18789,
        useTls: _useTls,
      );

      await nodeRuntime.connect(
        endpoint,
        authToken: _tokenController.text.isNotEmpty 
            ? _tokenController.text 
            : null,
      );

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Connected to Gateway')),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Connection failed: $e')),
        );
      }
    } finally {
      if (mounted) {
        setState(() => _isConnecting = false);
      }
    }
  }

  Future<void> _disconnect() async {
    await nodeRuntime.disconnect();
    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Disconnected')),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.all(16),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            // Header
            Row(
              children: [
                const Icon(Icons.cloud_outlined),
                const SizedBox(width: 8),
                const Text(
                  'OpenClaw Gateway',
                  style: TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.bold,
                  ),
                ),
                const Spacer(),
                // Connection status indicator
                ValueListenableBuilder<bool>(
                  valueListenable: nodeRuntime.isConnected,
                  builder: (context, isConnected, _) {
                    return Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 8,
                        vertical: 4,
                      ),
                      decoration: BoxDecoration(
                        color: isConnected ? Colors.green : Colors.grey,
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: Text(
                        isConnected ? 'Connected' : 'Disconnected',
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 12,
                        ),
                      ),
                    );
                  },
                ),
              ],
            ),
            const SizedBox(height: 16),

            // Status text
            ValueListenableBuilder<String>(
              valueListenable: nodeRuntime.statusText,
              builder: (context, status, _) {
                return Text(
                  status,
                  style: TextStyle(
                    color: Colors.grey[600],
                    fontSize: 12,
                  ),
                );
              },
            ),
            const SizedBox(height: 16),

            // Host input
            TextField(
              controller: _hostController,
              decoration: const InputDecoration(
                labelText: 'Gateway Host',
                hintText: 'zeke.tail5b81a2.ts.net',
                border: OutlineInputBorder(),
              ),
            ),
            const SizedBox(height: 12),

            // Port input
            TextField(
              controller: _portController,
              decoration: const InputDecoration(
                labelText: 'Port',
                hintText: '18789',
                border: OutlineInputBorder(),
              ),
              keyboardType: TextInputType.number,
            ),
            const SizedBox(height: 12),

            // Token input
            TextField(
              controller: _tokenController,
              decoration: const InputDecoration(
                labelText: 'Auth Token (optional)',
                border: OutlineInputBorder(),
              ),
              obscureText: true,
            ),
            const SizedBox(height: 12),

            // TLS switch
            SwitchListTile(
              title: const Text('Use TLS (wss://)'),
              value: _useTls,
              onChanged: (value) => setState(() => _useTls = value),
            ),
            const SizedBox(height: 16),

            // Device info
            Text(
              'Device: ${nodeRuntime.deviceName ?? "Unknown"}',
              style: TextStyle(color: Colors.grey[600], fontSize: 12),
            ),
            Text(
              'ID: ${nodeRuntime.deviceId ?? "Not initialized"}',
              style: TextStyle(color: Colors.grey[600], fontSize: 12),
            ),
            const SizedBox(height: 8),

            // Capabilities
            Wrap(
              spacing: 4,
              children: nodeRuntime.capabilities.map((cap) {
                return Chip(
                  label: Text(cap.rawValue),
                  visualDensity: VisualDensity.compact,
                );
              }).toList(),
            ),
            const SizedBox(height: 16),

            // Buttons
            Row(
              mainAxisAlignment: MainAxisAlignment.end,
              children: [
                ValueListenableBuilder<bool>(
                  valueListenable: nodeRuntime.isConnected,
                  builder: (context, isConnected, _) {
                    if (isConnected) {
                      return ElevatedButton.icon(
                        onPressed: _disconnect,
                        icon: const Icon(Icons.cloud_off),
                        label: const Text('Disconnect'),
                        style: ElevatedButton.styleFrom(
                          backgroundColor: Colors.red,
                          foregroundColor: Colors.white,
                        ),
                      );
                    }
                    return ElevatedButton.icon(
                      onPressed: _isConnecting ? null : _connect,
                      icon: _isConnecting
                          ? const SizedBox(
                              width: 16,
                              height: 16,
                              child: CircularProgressIndicator(strokeWidth: 2),
                            )
                          : const Icon(Icons.cloud_upload),
                      label: Text(_isConnecting ? 'Connecting...' : 'Connect'),
                    );
                  },
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  @override
  void dispose() {
    _hostController.dispose();
    _portController.dispose();
    _tokenController.dispose();
    super.dispose();
  }
}
