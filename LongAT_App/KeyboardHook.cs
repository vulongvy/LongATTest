using System;
using System.Diagnostics;
using System.Runtime.InteropServices;

namespace LongATTestApp
{
    public class KeyboardHook : IDisposable
    {
        private const int WH_KEYBOARD_LL = 13;
        private const int WM_KEYDOWN = 0x0100;
        private const int WM_KEYUP = 0x0101;
        private const int WM_SYSKEYDOWN = 0x0104;
        private const int WM_SYSKEYUP = 0x0105;

        public delegate IntPtr LowLevelKeyboardProc(int nCode, IntPtr wParam, IntPtr lParam);
        private LowLevelKeyboardProc _proc;
        private IntPtr _hookId = IntPtr.Zero;

        public event Action<string, int, bool>? KeyAction;
        public bool SwallowKeys { get; set; } = true;
        public IntPtr MainWindowHandle { get; set; } = IntPtr.Zero;

        [DllImport("user32.dll", CharSet = CharSet.Auto, SetLastError = true)]
        private static extern IntPtr SetWindowsHookEx(int idHook, LowLevelKeyboardProc lpfn, IntPtr hMod, uint dwThreadId);

        [DllImport("user32.dll", CharSet = CharSet.Auto, SetLastError = true)]
        [return: MarshalAs(UnmanagedType.Bool)]
        private static extern bool UnhookWindowsHookEx(IntPtr hhk);

        [DllImport("user32.dll", CharSet = CharSet.Auto, SetLastError = true)]
        private static extern IntPtr CallNextHookEx(IntPtr hhk, int nCode, IntPtr wParam, IntPtr lParam);

        [DllImport("kernel32.dll", CharSet = CharSet.Auto, SetLastError = true)]
        private static extern IntPtr GetModuleHandle(string lpModuleName);

        [DllImport("user32.dll")]
        private static extern IntPtr GetForegroundWindow();

        public KeyboardHook()
        {
            _proc = HookCallback;
            using var curProcess = Process.GetCurrentProcess();
            using var curModule = curProcess.MainModule!;
            _hookId = SetWindowsHookEx(WH_KEYBOARD_LL, _proc, GetModuleHandle(curModule.ModuleName!), 0);
        }

        private IntPtr HookCallback(int nCode, IntPtr wParam, IntPtr lParam)
        {
            if (nCode >= 0)
            {
                int msg = wParam.ToInt32();
                bool isDown = (msg == WM_KEYDOWN || msg == WM_SYSKEYDOWN);
                bool isUp = (msg == WM_KEYUP || msg == WM_SYSKEYUP);

                if (isDown || isUp)
                {
                    IntPtr fg = GetForegroundWindow();
                    if (MainWindowHandle == IntPtr.Zero || fg == MainWindowHandle)
                    {
                        int vkCode = Marshal.ReadInt32(lParam);
                        string code = MapVkToCode(vkCode);

                        KeyAction?.Invoke(code, vkCode, isDown);

                        if (SwallowKeys)
                        {
                            // Swallow F1-F12, Esc, Win, Alt, Tab, F5, F9, F12 to prevent DevTools / Browser triggers
                            return (IntPtr)1;
                        }
                    }
                }
            }
            return CallNextHookEx(_hookId, nCode, wParam, lParam);
        }

        private static string MapVkToCode(int vk)
        {
            // F1 - F12
            if (vk >= 0x70 && vk <= 0x7B)
                return $"F{vk - 0x70 + 1}";

            // Alphanumeric A-Z
            if (vk >= 0x41 && vk <= 0x5A)
                return $"Key{(char)vk}";

            // Digits 0-9
            if (vk >= 0x30 && vk <= 0x39)
                return $"Digit{(char)vk}";

            // Numpad 0-9
            if (vk >= 0x60 && vk <= 0x69)
                return $"Numpad{vk - 0x60}";

            return vk switch
            {
                0x1B => "Escape",
                0x09 => "Tab",
                0x14 => "CapsLock",
                0x10 => "ShiftLeft",
                0xA0 => "ShiftLeft",
                0xA1 => "ShiftRight",
                0x11 => "ControlLeft",
                0xA2 => "ControlLeft",
                0xA3 => "ControlRight",
                0x12 => "AltLeft",
                0xA4 => "AltLeft",
                0xA5 => "AltRight",
                0x5B => "MetaLeft",
                0x5C => "MetaRight",
                0x5D => "ContextMenu",
                0x20 => "Space",
                0x08 => "Backspace",
                0x0D => "Enter",
                0x2C => "PrintScreen",
                0x91 => "ScrollLock",
                0x13 => "Pause",
                0x2D => "Insert",
                0x2E => "Delete",
                0x24 => "Home",
                0x23 => "End",
                0x21 => "PageUp",
                0x22 => "PageDown",
                0x26 => "ArrowUp",
                0x28 => "ArrowDown",
                0x25 => "ArrowLeft",
                0x27 => "ArrowRight",
                0x90 => "NumLock",
                0x6F => "NumpadDivide",
                0x6A => "NumpadMultiply",
                0x6D => "NumpadSubtract",
                0x6B => "NumpadAdd",
                0x6E => "NumpadDecimal",
                0xC0 => "Backquote",
                0xBD => "Minus",
                0xBB => "Equal",
                0xDB => "BracketLeft",
                0xDD => "BracketRight",
                0xDC => "Backslash",
                0xBA => "Semicolon",
                0xDE => "Quote",
                0xBC => "Comma",
                0xBE => "Period",
                0xBF => "Slash",
                _ => $"Key_{vk}"
            };
        }

        public void Dispose()
        {
            if (_hookId != IntPtr.Zero)
            {
                UnhookWindowsHookEx(_hookId);
                _hookId = IntPtr.Zero;
            }
        }
    }
}
