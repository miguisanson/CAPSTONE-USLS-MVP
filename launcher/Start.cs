// Start.exe - starts the USLS Graduate School app and opens it in the browser.
// Build with launcher\build.cmd (built-in .NET Framework compiler, nothing to install).
using System;
using System.Diagnostics;
using System.IO;
using System.Net.Sockets;
using System.Threading;

static class StartApp
{
    static string root;
    static int port = 5000;

    static int Main()
    {
        root = AppDomain.CurrentDomain.BaseDirectory.TrimEnd('\\');
        Directory.SetCurrentDirectory(root);
        string e = Environment.GetEnvironmentVariable("FLASK_PORT");
        int p; if (e != null && int.TryParse(e, out p)) port = p;
        string url = "http://localhost:" + port;
        Console.WriteLine("USLS Graduate School platform");
        Console.WriteLine("Folder: " + root);
        try
        {
            if (!File.Exists("app.py")) return Fail("app.py was not found next to Start.exe. Keep Start.exe in the app folder.");
            Directory.CreateDirectory("instance");
            if (PortOpen()) { Console.WriteLine("The app is already running. Opening the browser."); Open(url); return 0; }

            string sysPy = null;
            foreach (string cand in new[] { "python", "py -3" })
                if (Has(cand + " -c \"import sys; sys.exit(sys.version_info < (3, 11))\"")) { sysPy = cand; break; }
            string venvPy = Path.Combine(root, @".venv\Scripts\python.exe");
            bool needVenv = !File.Exists(venvPy);
            if (needVenv && sysPy == null) return Fail("Python 3.11 or newer is not installed (or not on PATH). Install it from python.org, tick \"Add python.exe to PATH\", then run Start.exe again.");
            bool needBuild = NeedBuild();
            bool needSeed = !File.Exists("usls_gs_demo.sqlite3");
            // the app runs without a .env file (it keeps its own secret key in instance\secret_key), so none is created
            if (needBuild && !Has("node --version")) return Fail("The web pages are not built and Node.js is not installed. Use the release zip, or install Node 18 or newer from nodejs.org.");

            if (needVenv)
            {
                Console.WriteLine("First run: installing Python packages (a few minutes, internet needed)...");
                if (!Run(sysPy + " -m venv .venv")) return Fail("Creating the Python environment failed.");
                Run("\"" + venvPy + "\" -m pip install --upgrade pip");
                if (!Run("\"" + venvPy + "\" -m pip install -r requirements.txt")) { try { Directory.Delete(".venv", true); } catch { } return Fail("Installing the Python packages failed. Check the internet connection and try again."); }
            }
            if (needBuild)
            {
                if (!Directory.Exists(@"frontend\node_modules")) { Console.WriteLine("Installing web packages (a few minutes)..."); if (!Run("npm --prefix frontend install")) return Fail("Installing the web packages failed. Check the internet connection and try again."); }
                Console.WriteLine("Building the web pages..."); if (!Run("npm run build:web")) return Fail("Building the web pages failed.");
            }
            if (needSeed) { Console.WriteLine("Creating the demo data..."); if (!Run("\"" + venvPy + "\" app.py --seed")) return Fail("Creating the demo data failed."); }

            Console.WriteLine("Starting the app. The first start is slow, please wait...");
            var psi = new ProcessStartInfo("cmd.exe", "/c \"\"" + venvPy + "\" app.py >> instance\\app.log 2>&1\"");
            psi.UseShellExecute = false; psi.CreateNoWindow = true; psi.WorkingDirectory = root;
            psi.EnvironmentVariables["PYTHONUNBUFFERED"] = "1";
            psi.EnvironmentVariables["PYTHONIOENCODING"] = "utf-8";
            Process proc = Process.Start(psi);
            File.WriteAllText(PidFile(), proc.Id.ToString());

            for (int i = 0; i < 120; i++)
            {
                if (PortOpen()) { Console.WriteLine("Ready. Opening " + url); Open(url); Console.WriteLine("Run Stop.exe when you are finished."); Thread.Sleep(2500); return 0; }
                if (proc.HasExited) return Fail("The app stopped while starting. See instance\\app.log for the reason.");
                Thread.Sleep(1000);
            }
            return Fail("The app did not answer after 2 minutes. See instance\\app.log. Run Stop.exe, then try again.");
        }
        catch (Exception ex) { return Fail("Unexpected problem: " + ex.Message); }
    }

    static string PidFile() { return Path.Combine(root, @"instance\app.pid"); }

    static bool Alive()
    {
        try { int pid = int.Parse(File.ReadAllText(PidFile()).Trim()); return !Process.GetProcessById(pid).HasExited; }
        catch { return false; }
    }

    static bool PortOpen()
    {
        try { using (var c = new TcpClient()) { var r = c.BeginConnect("127.0.0.1", port, null, null); return r.AsyncWaitHandle.WaitOne(500) && c.Connected; } }
        catch { return false; }
    }

    static bool NeedBuild()
    {
        string idx = @"frontend\dist\index.html";
        if (File.Exists(@"frontend\dist\.prebuilt") && File.Exists(idx)) return false; // release zip: timestamps are not reliable
        if (!Directory.Exists(@"frontend\src")) return false; // prebuilt copy: nothing to build
        if (!File.Exists(idx)) return true;
        DateTime built = File.GetLastWriteTimeUtc(idx);
        foreach (string f in Directory.GetFiles(@"frontend\src", "*", SearchOption.AllDirectories))
            if (File.GetLastWriteTimeUtc(f) > built) return true;
        return false;
    }

    static bool Run(string cmd)
    {
        var psi = new ProcessStartInfo("cmd.exe", "/c " + cmd) { UseShellExecute = false, WorkingDirectory = root };
        using (Process p = Process.Start(psi)) { p.WaitForExit(); return p.ExitCode == 0; }
    }

    static bool Has(string cmd)
    {
        try
        {
            var psi = new ProcessStartInfo("cmd.exe", "/c " + cmd + " >nul 2>&1") { UseShellExecute = false, CreateNoWindow = true };
            using (Process p = Process.Start(psi)) { p.WaitForExit(); return p.ExitCode == 0; }
        }
        catch { return false; }
    }

    static void Open(string url) { Process.Start(new ProcessStartInfo(url) { UseShellExecute = true }); }

    static int Fail(string msg)
    {
        Console.WriteLine();
        Console.WriteLine("PROBLEM: " + msg);
        Console.WriteLine("Press any key to close.");
        try { Console.ReadKey(true); } catch { }
        return 1;
    }
}
