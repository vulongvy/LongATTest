using System;
using System.IO;
using System.Windows;
using System.Windows.Interop;
using Microsoft.Web.WebView2.Core;

namespace LongATTestApp
{
    public partial class MainWindow : Window
    {
        private HardwareEngine _engine = null!;
        private LocalServer _server = null!;
        private KeyboardHook _hook = null!;

        public MainWindow()
        {
            InitializeComponent();
            Loaded += MainWindow_Loaded;
            Closed += MainWindow_Closed;
        }

        private async void MainWindow_Loaded(object sender, RoutedEventArgs e)
        {
            var baseDir = AppDomain.CurrentDomain.BaseDirectory;
            // If running in bin/Release or bin/Debug, look for web/ up the folder tree if not local
            if (!Directory.Exists(Path.Combine(baseDir, "web")))
            {
                var parent = Directory.GetParent(baseDir)?.Parent?.Parent?.Parent?.FullName;
                if (parent != null && Directory.Exists(Path.Combine(parent, "web")))
                {
                    baseDir = parent;
                }
            }

            _engine = new HardwareEngine();
            _server = new LocalServer(_engine, baseDir);
            _server.Start();

            // Set up Keyboard Hook
            _hook = new KeyboardHook();
            var handle = new WindowInteropHelper(this).Handle;
            _hook.MainWindowHandle = handle;

            _hook.KeyAction += (code, vk, isDown) =>
            {
                Dispatcher.InvokeAsync(() =>
                {
                    try
                    {
                        if (webView?.CoreWebView2 != null)
                        {
                            webView.CoreWebView2.ExecuteScriptAsync($"window.onNativeKey && window.onNativeKey('{code}', {vk}, {isDown.ToString().ToLower()});");
                        }
                    }
                    catch {}
                });
            };

            try
            {
                var userFolder = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "LongATTest", "WebView2Data");
                var env = await CoreWebView2Environment.CreateAsync(null, userFolder);
                await webView.EnsureCoreWebView2Async(env);

                // STRICTLY DISABLE DEVTOOLS AND BROWSER SHORTCUTS
                var settings = webView.CoreWebView2.Settings;
                settings.AreDevToolsEnabled = false;
                settings.AreBrowserAcceleratorKeysEnabled = false;
                settings.AreDefaultContextMenusEnabled = false;
                settings.IsStatusBarEnabled = false;
                settings.IsZoomControlEnabled = false;

                webView.Source = new Uri($"http://127.0.0.1:{_server.Port}/index.html");
            }
            catch (Exception ex)
            {
                MessageBox.Show("Lỗi khởi tạo giao diện: " + ex.Message, "Long AT Test", MessageBoxButton.OK, MessageBoxImage.Error);
            }
        }

        private void MainWindow_Closed(object? sender, EventArgs e)
        {
            try { _hook?.Dispose(); } catch {}
            try { _server?.Dispose(); } catch {}
            try { _engine?.Dispose(); } catch {}
        }
    }
}