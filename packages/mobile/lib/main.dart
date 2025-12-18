import 'dart:io';
import 'package:flutter/material.dart';
import 'package:webview_flutter/webview_flutter.dart';
import 'package:webview_windows/webview_windows.dart' as windows;

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(
    const MaterialApp(
      debugShowCheckedModeBanner: false,
      title: 'Cred30',
      home: Cred30App(),
    ),
  );
}

class Cred30App extends StatelessWidget {
  const Cred30App({super.key});

  @override
  Widget build(BuildContext context) {
    if (Platform.isWindows) {
      return const WindowsWebView();
    } else {
      return const MobileWebView();
    }
  }
}

// --- Implementação Windows ---
class WindowsWebView extends StatefulWidget {
  const WindowsWebView({super.key});

  @override
  State<WindowsWebView> createState() => _WindowsWebViewState();
}

class _WindowsWebViewState extends State<WindowsWebView> {
  final _controller = windows.WebviewController();
  bool _isInitialized = false;

  @override
  void initState() {
    super.initState();
    initWebView();
  }

  Future<void> initWebView() async {
    try {
      await _controller.initialize();
      await _controller.setBackgroundColor(Colors.transparent);
      await _controller.setPopupWindowPolicy(
        windows.WebviewPopupWindowPolicy.deny,
      );
      await _controller.loadUrl('https://cred30-prod-app-2025.web.app');

      if (mounted) {
        setState(() => _isInitialized = true);
      }
    } catch (e) {
      debugPrint("Erro ao inicializar WebView Windows: $e");
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF09090B),
      appBar: PreferredSize(
        preferredSize: const Size.fromHeight(0),
        child: AppBar(backgroundColor: const Color(0xFF09090B), elevation: 0),
      ),
      body: _isInitialized
          ? windows.Webview(
              _controller,
              permissionRequested: _onPermissionRequested,
            )
          : const Center(child: CircularProgressIndicator(color: Colors.green)),
    );
  }

  Future<windows.WebviewPermissionDecision> _onPermissionRequested(
    String url,
    windows.WebviewPermissionKind kind,
    bool isUserInitiated,
  ) async {
    final decision = await showDialog<windows.WebviewPermissionDecision>(
      context: context,
      builder: (BuildContext context) => AlertDialog(
        title: const Text('Permissão solicitada'),
        content: Text('O site quer permissão para: $kind'),
        actions: <Widget>[
          TextButton(
            onPressed: () =>
                Navigator.pop(context, windows.WebviewPermissionDecision.deny),
            child: const Text('Negar'),
          ),
          TextButton(
            onPressed: () =>
                Navigator.pop(context, windows.WebviewPermissionDecision.allow),
            child: const Text('Permitir'),
          ),
        ],
      ),
    );

    return decision ?? windows.WebviewPermissionDecision.deny;
  }
}

// --- Implementação Android/Mobile ---
class MobileWebView extends StatefulWidget {
  const MobileWebView({super.key});

  @override
  State<MobileWebView> createState() => _MobileWebViewState();
}

class _MobileWebViewState extends State<MobileWebView> {
  late final WebViewController _controller;

  @override
  void initState() {
    super.initState();
    _controller = WebViewController()
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..setBackgroundColor(const Color(0xFF09090B))
      ..setNavigationDelegate(
        NavigationDelegate(
          onNavigationRequest: (NavigationRequest request) {
            return NavigationDecision.navigate;
          },
        ),
      )
      ..loadRequest(Uri.parse('https://cred30-prod-app-2025.web.app'));
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF09090B),
      body: SafeArea(child: WebViewWidget(controller: _controller)),
    );
  }
}
