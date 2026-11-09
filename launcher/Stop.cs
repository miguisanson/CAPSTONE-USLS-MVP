// Stop.exe - stops the USLS Graduate School app started by Start.exe. Safe to run when nothing is running.
using System;
using System.Diagnostics;
using System.IO;
using System.Threading;

static class StopApp
{
    static int Main()
    {
        string root = AppDomain.CurrentDomain.BaseDirectory.TrimEnd('\\');
        string pidFile = Path.Combine(root, @"instance\app.pid");
        int port = 5000;
        string e = Environment.GetEnvironmentVariable("FLASK_PORT");
        int p; if (e != null && int.TryParse(e, out p)) port = p;
        bool did = false;

        int pid;
        if (File.Exists(pidFile) && int.TryParse(File.ReadAllText(pidFile).Trim(), out pid) && IsOurs(pid, pidFile))
        {
            Tk("/PID " + pid + " /T");
            for (int i = 0; i < 5 && IsAlive(pid); i++) Thread.Sleep(1000);
            if (IsAlive(pid)) Tk("/PID " + pid + " /T /F");
            did = true;
        }
        int owner = PortOwner(port);
        if (owner > 0 && NameOf(owner).StartsWith("python", StringComparison.OrdinalIgnoreCase)) { Tk("/PID " + owner + " /T /F"); did = true; }
        try { File.Delete(pidFile); } catch { }
        Console.WriteLine(did ? "Stopped." : "Nothing was running. Stopped.");
        Thread.Sleep(1500);
        return 0;
    }

    // A stale pid file (e.g. after a reboot) can point at an unrelated process: only trust it if that
    // process is the cmd.exe Start.exe launched, started around when the pid file was written.
    static bool IsOurs(int pid, string pidFile)
    {
        try
        {
            Process pr = Process.GetProcessById(pid);
            double gap = Math.Abs((pr.StartTime - File.GetLastWriteTime(pidFile)).TotalSeconds);
            return !pr.HasExited && pr.ProcessName.Equals("cmd", StringComparison.OrdinalIgnoreCase) && gap < 30;
        }
        catch { return false; }
    }

    static string NameOf(int pid) { try { return Process.GetProcessById(pid).ProcessName; } catch { return ""; } }

    static bool IsAlive(int pid) { try { return !Process.GetProcessById(pid).HasExited; } catch { return false; } }

    static string Exec(string exe, string args)
    {
        var psi = new ProcessStartInfo(exe, args) { UseShellExecute = false, CreateNoWindow = true, RedirectStandardOutput = true, RedirectStandardError = true };
        using (Process pr = Process.Start(psi)) { string o = pr.StandardOutput.ReadToEnd(); pr.StandardError.ReadToEnd(); pr.WaitForExit(); return o; }
    }

    static void Tk(string args) { try { Exec("taskkill", args); } catch { } }

    static int PortOwner(int port)
    {
        try
        {
            foreach (string line in Exec("netstat", "-ano -p TCP").Split('\n'))
            {
                string[] c = line.Split(new[] { ' ', '\t', '\r' }, StringSplitOptions.RemoveEmptyEntries);
                int id;
                if (c.Length >= 5 && c[3] == "LISTENING" && c[1].EndsWith(":" + port) && int.TryParse(c[4], out id) && id > 4) return id;
            }
        }
        catch { }
        return 0;
    }
}
