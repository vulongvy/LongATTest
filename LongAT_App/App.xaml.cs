using System;
using System.IO;
using System.Windows;
using System.Windows.Threading;

namespace LongATTestApp;

/// <summary>
/// Interaction logic for App.xaml
/// </summary>
public partial class App : Application
{
    public App()
    {
        DispatcherUnhandledException += App_DispatcherUnhandledException;
        AppDomain.CurrentDomain.UnhandledException += CurrentDomain_UnhandledException;
    }

    private void App_DispatcherUnhandledException(object sender, DispatcherUnhandledExceptionEventArgs e)
    {
        LogException(e.Exception);
        MessageBox.Show($"Đã xảy ra lỗi khởi chạy:\n{e.Exception.Message}\n\nChi tiết xem tại file log trên Desktop.", "Long AT Test Error", MessageBoxButton.OK, MessageBoxImage.Error);
        e.Handled = true;
    }

    private void CurrentDomain_UnhandledException(object sender, UnhandledExceptionEventArgs e)
    {
        if (e.ExceptionObject is Exception ex)
        {
            LogException(ex);
            MessageBox.Show($"Đã xảy ra lỗi nghiêm trọng:\n{ex.Message}", "Long AT Test Fatal", MessageBoxButton.OK, MessageBoxImage.Error);
        }
    }

    private void LogException(Exception ex)
    {
        try
        {
            var desktop = Environment.GetFolderPath(Environment.SpecialFolder.Desktop);
            var logPath = Path.Combine(desktop, "LongATTest_Error.log");
            File.AppendAllText(logPath, $"[{DateTime.Now}] {ex}\n\n");
        }
        catch {}
    }
}

