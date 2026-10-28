using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Linq;
using System.Net;
using System.Net.NetworkInformation;
using System.Net.Sockets;
using System.Threading;
using System.Threading.Tasks;
using System.Web.Script.Serialization;
using System.Windows.Forms;

internal sealed class LanAddress
{
    public string Name;
    public string Address;
    public int Rank;
    public string Url { get { return "http://" + Address + ":3000"; } }
    public override string ToString() { return Name + "  -  " + Url; }
}

internal sealed class DtsServer
{
    public static readonly string Root = AppDomain.CurrentDomain.BaseDirectory;
    private Process process;
    private readonly object logLock = new object();
    public string LogFile;
    public bool OwnsServer { get { return process != null && !process.HasExited; } }

    public static List<LanAddress> Addresses()
    {
        var result = new List<LanAddress>();
        foreach (var nic in NetworkInterface.GetAllNetworkInterfaces())
        {
            if (nic.OperationalStatus != OperationalStatus.Up ||
                (nic.NetworkInterfaceType != NetworkInterfaceType.Ethernet &&
                 nic.NetworkInterfaceType != NetworkInterfaceType.Wireless80211)) continue;
            var properties = nic.GetIPProperties();
            bool gateway = properties.GatewayAddresses.Any(g => g.Address.AddressFamily == AddressFamily.InterNetwork && !g.Address.Equals(IPAddress.Any));
            if (!gateway) continue;
            foreach (var unicast in properties.UnicastAddresses)
            {
                var address = unicast.Address;
                if (address.AddressFamily != AddressFamily.InterNetwork || IPAddress.IsLoopback(address) || address.ToString().StartsWith("169.254.")) continue;
                result.Add(new LanAddress { Name = nic.Name, Address = address.ToString(),
                    Rank = nic.NetworkInterfaceType == NetworkInterfaceType.Ethernet ? 0 : 1 });
            }
        }
        return result.OrderBy(a => a.Rank).ThenBy(a => a.Name).ThenBy(a => a.Address).ToList();
    }

    public static bool PortInUse()
    {
        return IPGlobalProperties.GetIPGlobalProperties().GetActiveTcpListeners().Any(e => e.Port == 3000);
    }

    private static string Get(string url)
    {
        var request = (HttpWebRequest)WebRequest.Create(url);
        request.Proxy = null;
        request.Timeout = 1500;
        request.ReadWriteTimeout = 1500;
        request.AllowAutoRedirect = false;
        using (var response = (HttpWebResponse)request.GetResponse())
        using (var reader = new StreamReader(response.GetResponseStream()))
            return response.StatusCode == HttpStatusCode.OK ? reader.ReadToEnd() : "";
    }

    public static bool Ready(string url)
    {
        try
        {
            var health = new JavaScriptSerializer().Deserialize<Dictionary<string, object>>(Get(url + "/healthz"));
            return health.ContainsKey("ok") && health["ok"] is bool && (bool)health["ok"] &&
                Get(url + "/").Contains("<title>Document Tracking &amp; Routing System</title>");
        }
        catch { return false; }
    }

    private static string FindNode()
    {
        foreach (string directory in (Environment.GetEnvironmentVariable("PATH") ?? "").Split(Path.PathSeparator))
        {
            try { string file = Path.Combine(directory.Trim('"'), "node.exe"); if (File.Exists(file)) return file; }
            catch (ArgumentException) { }
        }
        string installed = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles), "nodejs", "node.exe");
        if (File.Exists(installed)) return installed;
        throw new InvalidOperationException("Install Node.js 22.13 or newer, then open DTS again.");
    }

    public void Start(string dataDirectory)
    {
        if (!File.Exists(Path.Combine(Root, "server.js"))) throw new InvalidOperationException("Keep DTS.exe inside your DTS application folder.");
        string node = FindNode();
        var versionInfo = new ProcessStartInfo(node, "--version") { UseShellExecute = false, CreateNoWindow = true, RedirectStandardOutput = true };
        using (var versionProcess = Process.Start(versionInfo))
        {
            string text = versionProcess.StandardOutput.ReadToEnd().Trim().TrimStart('v');
            versionProcess.WaitForExit();
            Version version;
            if (!Version.TryParse(text, out version) || version < new Version(22, 13))
                throw new InvalidOperationException("DTS requires Node.js 22.13 or newer. Installed: " + text);
        }
        Directory.CreateDirectory(dataDirectory);
        LogFile = Path.Combine(dataDirectory, "desktop-launcher.log");
        var info = new ProcessStartInfo(node, "\"" + Path.Combine(Root, "scripts", "desktop-server.js") + "\"");
        info.WorkingDirectory = Root;
        info.UseShellExecute = false;
        info.CreateNoWindow = true;
        info.WindowStyle = ProcessWindowStyle.Hidden;
        info.RedirectStandardInput = true;
        info.RedirectStandardOutput = true;
        info.RedirectStandardError = true;
        info.EnvironmentVariables["HOST"] = "0.0.0.0";
        info.EnvironmentVariables["PORT"] = "3000";
        info.EnvironmentVariables["DATA_DIR"] = Path.GetFullPath(dataDirectory);
        info.EnvironmentVariables["SEED_DEMO"] = "0";
        info.EnvironmentVariables["SR_TEST"] = "0";
        info.EnvironmentVariables.Remove("SR_NOW");
        info.EnvironmentVariables["COOKIE_SECURE"] = "0";
        info.EnvironmentVariables["TRUST_PROXY"] = "0";
        process = new Process { StartInfo = info };
        process.OutputDataReceived += delegate(object sender, DataReceivedEventArgs e) { Log(e.Data); };
        process.ErrorDataReceived += delegate(object sender, DataReceivedEventArgs e) { Log(e.Data); };
        try { process.Start(); }
        catch { process.Dispose(); process = null; throw; }
        process.BeginOutputReadLine();
        process.BeginErrorReadLine();
    }

    private void Log(string line)
    {
        if (line == null) return;
        lock (logLock) { try { File.AppendAllText(LogFile, DateTime.Now.ToString("s") + " " + line + Environment.NewLine); } catch (IOException) { } }
    }

    public async Task<bool> WaitReady(string url)
    {
        for (int i = 0; i < 60; i++)
        {
            if (!OwnsServer) return false;
            if (Ready(url)) return true;
            await Task.Delay(500);
        }
        return false;
    }

    public void Stop()
    {
        if (process == null) return;
        try
        {
            if (!process.HasExited)
            {
                process.StandardInput.WriteLine("stop");
                process.StandardInput.Flush();
                if (!process.WaitForExit(8000)) process.Kill();
            }
            process.WaitForExit();
        }
        catch (InvalidOperationException) { }
        catch (IOException) { }
        finally { process.Dispose(); process = null; }
    }
}

internal sealed class DtsWindow : Form
{
    private readonly DtsServer server = new DtsServer();
    private readonly Label status = new Label();
    private readonly ListBox addresses = new ListBox();
    private readonly Button start = new Button();
    private readonly Button stop = new Button();
    private readonly Button open = new Button();
    private readonly NotifyIcon tray = new NotifyIcon();
    private bool exiting;
    private bool busy;

    public DtsWindow(bool automaticStart = true)
    {
        Text = "DTS - Network Launcher";
        ClientSize = new Size(620, 370);
        MinimumSize = new Size(636, 409);
        FormBorderStyle = FormBorderStyle.FixedSingle;
        MaximizeBox = false;
        StartPosition = FormStartPosition.CenterScreen;
        Font = new Font("Segoe UI", 10);
        BackColor = Color.FromArgb(245, 248, 249);
        Icon = Icon.ExtractAssociatedIcon(Application.ExecutablePath);
        var title = new Label { Text = "Document Tracking & Routing System", UseMnemonic = false, Font = new Font("Segoe UI", 17, FontStyle.Bold), ForeColor = Color.FromArgb(13, 65, 73), AutoSize = true, Location = new Point(24, 22) };
        status.SetBounds(26, 69, 568, 46);
        status.Text = "Ready to start DTS on port 3000.";
        var hint = new Label { Text = "Other devices on the same network can open:", AutoSize = true, Location = new Point(26, 123) };
        addresses.SetBounds(26, 153, 568, 70);
        addresses.Font = new Font("Segoe UI", 10);
        open.Text = "Open DTS"; open.SetBounds(26, 239, 130, 38);
        open.Click += delegate { OpenBrowser(); };
        var copy = new Button { Text = "Copy address" }; copy.SetBounds(166, 239, 130, 38);
        copy.Click += delegate { var selected = addresses.SelectedItem as LanAddress; if (selected != null) Clipboard.SetText(selected.Url); };
        start.Text = "Start server"; start.SetBounds(306, 239, 130, 38);
        start.Click += async delegate { await StartDts(false); };
        stop.Text = "Stop server"; stop.SetBounds(446, 239, 148, 38);
        stop.Enabled = false; open.Enabled = false;
        stop.Click += async delegate { await StopDts(); };
        var footer = new Label { Text = "Closing this window keeps DTS running in the system tray.\nUse Exit DTS in the tray menu to stop it. Keep this PC awake for access.", Location = new Point(26, 299), Size = new Size(568, 48), ForeColor = Color.FromArgb(70, 83, 88) };
        Controls.AddRange(new Control[] { title, status, hint, addresses, open, copy, start, stop, footer });
        var menu = new ContextMenuStrip();
        menu.Items.Add("Show launcher", null, delegate { Show(); WindowState = FormWindowState.Normal; Activate(); });
        menu.Items.Add("Open DTS", null, delegate { OpenBrowser(); });
        menu.Items.Add("Exit DTS", null, async delegate { if (busy) return; exiting = true; await StopDts(); Close(); });
        tray.Icon = Icon; tray.Text = "DTS - port 3000"; tray.ContextMenuStrip = menu; tray.Visible = automaticStart;
        tray.DoubleClick += delegate { Show(); WindowState = FormWindowState.Normal; Activate(); };
        FormClosing += delegate(object sender, FormClosingEventArgs e) { if (!exiting && e.CloseReason == CloseReason.UserClosing) { e.Cancel = true; Hide(); } };
        FormClosed += delegate { server.Stop(); tray.Dispose(); };
        if (automaticStart) Shown += async delegate { await StartDts(true); };
        RefreshAddresses();
    }

    private void RefreshAddresses()
    {
        var old = addresses.SelectedItem as LanAddress;
        addresses.Items.Clear();
        foreach (var address in DtsServer.Addresses()) addresses.Items.Add(address);
        if (addresses.Items.Count > 0)
        {
            addresses.SelectedIndex = 0;
            if (old != null) for (int i = 0; i < addresses.Items.Count; i++) if (((LanAddress)addresses.Items[i]).Address == old.Address) addresses.SelectedIndex = i;
        }
    }

    private async Task StartDts(bool launchBrowser)
    {
        if (busy) return;
        busy = true; start.Enabled = false; stop.Enabled = false; open.Enabled = false;
        try
        {
            RefreshAddresses();
            var address = addresses.SelectedItem as LanAddress;
            if (address == null) throw new InvalidOperationException("Connect Ethernet or Wi-Fi, then click Start server.");
            status.Text = "Starting DTS on port 3000...";
            bool ready;
            if (server.OwnsServer) ready = await Task.Run(() => DtsServer.Ready(address.Url));
            else
            {
                if (DtsServer.PortInUse()) throw new InvalidOperationException("Port 3000 is in use. Close the old DTS server window (or other application using it), then click Start server.");
                server.Start(Path.Combine(DtsServer.Root, "data"));
                ready = await Task.Run(async () => await server.WaitReady(address.Url));
            }
            if (!ready) { server.Stop(); throw new InvalidOperationException("DTS could not start. See data\\desktop-launcher.log for details."); }
            status.Text = "DTS is running on port 3000. Share a network address below.";
            stop.Enabled = server.OwnsServer;
            open.Enabled = true;
            if (launchBrowser) OpenBrowser();
        }
        catch (Exception e) { status.Text = e.Message; }
        finally { busy = false; start.Enabled = true; }
    }

    private async Task StopDts()
    {
        if (busy) return;
        busy = true; stop.Enabled = false; open.Enabled = false; start.Enabled = false;
        await Task.Run(() => server.Stop());
        status.Text = "DTS server stopped.";
        busy = false; start.Enabled = true;
    }

    private void OpenBrowser()
    {
        RefreshAddresses();
        var address = addresses.SelectedItem as LanAddress;
        if (address != null) Process.Start(new ProcessStartInfo(address.Url) { UseShellExecute = true });
    }
}

internal static class Program
{
    [STAThread]
    private static int Main(string[] args)
    {
        Application.EnableVisualStyles();
        Application.SetCompatibleTextRenderingDefault(false);
        if (args.Contains("--verify")) return Verify();
        bool created;
        using (var mutex = new Mutex(true, "Local\\DTS-Network-Launcher-" + StableId(DtsServer.Root), out created))
        {
            if (!created)
            {
                var address = DtsServer.Addresses().FirstOrDefault();
                if (address != null && DtsServer.Ready(address.Url)) Process.Start(new ProcessStartInfo(address.Url) { UseShellExecute = true });
                else MessageBox.Show("DTS is already starting. Open the launcher from its system tray icon.", "DTS");
                return 0;
            }
            Application.Run(new DtsWindow());
        }
        return 0;
    }

    private static string StableId(string text)
    {
        using (var sha = System.Security.Cryptography.SHA256.Create()) return BitConverter.ToString(sha.ComputeHash(System.Text.Encoding.UTF8.GetBytes(text.ToLowerInvariant()))).Replace("-", "").Substring(0, 20);
    }

    private static int Verify()
    {
        string directory = Path.Combine(DtsServer.Root, "outputs", "launcher-validation");
        Directory.CreateDirectory(directory);
        var report = new Dictionary<string, object>();
        var server = new DtsServer();
        int code = 1;
        try
        {
            if (DtsServer.PortInUse()) throw new InvalidOperationException("Port 3000 must be free for the isolated launcher verification.");
            var addresses = DtsServer.Addresses();
            if (addresses.Count == 0) throw new InvalidOperationException("No LAN address found.");
            server.Start(Path.Combine(directory, "data"));
            if (!server.WaitReady(addresses[0].Url).GetAwaiter().GetResult()) throw new InvalidOperationException("DTS did not start.");
            report["urls"] = addresses.Select(a => a.Url).ToArray();
            report["allLanAddressesRespond"] = addresses.All(a => DtsServer.Ready(a.Url));
            report["boundToAllIPv4Interfaces"] = IPGlobalProperties.GetIPGlobalProperties().GetActiveTcpListeners().Any(e => e.Port == 3000 && e.Address.Equals(IPAddress.Any));
            server.Stop();
            report["cleanShutdown"] = !DtsServer.PortInUse();
            using (var window = new DtsWindow(false))
            using (var bitmap = new Bitmap(window.Width, window.Height))
            {
                window.ShowInTaskbar = false;
                window.StartPosition = FormStartPosition.Manual;
                window.Location = new Point(-30000, -30000);
                window.Show();
                Application.DoEvents();
                window.DrawToBitmap(bitmap, new Rectangle(Point.Empty, bitmap.Size));
                bitmap.Save(Path.Combine(directory, "launcher-preview.png"), System.Drawing.Imaging.ImageFormat.Png);
                window.Hide();
            }
            report["passed"] = (bool)report["allLanAddressesRespond"] && (bool)report["boundToAllIPv4Interfaces"] && (bool)report["cleanShutdown"];
            code = (bool)report["passed"] ? 0 : 1;
        }
        catch (Exception e) { report["passed"] = false; report["error"] = e.Message; }
        finally { server.Stop(); }
        File.WriteAllText(Path.Combine(directory, "verification.json"), new JavaScriptSerializer().Serialize(report));
        return code;
    }
}
