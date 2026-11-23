const fs = require("fs");
const path = require("path");
const zlib = require("zlib");
const { execFileSync } = require("child_process");

const ROOT_DIR = path.resolve(__dirname, "..");
const DIST_DIR = path.join(ROOT_DIR, "apps", "app", "dist");
const BUILD_DIR = path.join(ROOT_DIR, "build");
const ASSETS_ZIP = path.join(BUILD_DIR, "app-assets.zip");
const CS_FILE = path.join(BUILD_DIR, "DesktopHost.cs");
const EXE_OUT = path.join(BUILD_DIR, "FormulaFlash-Windows.exe");

function crc32(buffer) {
  let crc = 0xffffffff;
  for (let i = 0; i < buffer.length; i++) {
    crc ^= buffer[i];
    for (let bit = 0; bit < 8; bit++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function collectFiles(dir, prefix = "", out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    const relPath = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      collectFiles(fullPath, relPath, out);
    } else if (entry.isFile()) {
      out.push({ name: relPath, data: fs.readFileSync(fullPath) });
    }
  }
  return out;
}

function buildZipBuffer(files) {
  const localParts = [];
  const centralParts = [];
  let offset = 0;
  for (const file of files) {
    const nameBytes = Buffer.from(file.name, "utf8");
    const raw = file.data;
    const compressed = zlib.deflateRawSync(raw, { level: 6 });
    const checksum = crc32(raw);

    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(0, 6);
    localHeader.writeUInt16LE(8, 8);
    localHeader.writeUInt16LE(0, 10);
    localHeader.writeUInt16LE(0, 12);
    localHeader.writeUInt32LE(checksum, 14);
    localHeader.writeUInt32LE(compressed.length, 18);
    localHeader.writeUInt32LE(raw.length, 22);
    localHeader.writeUInt16LE(nameBytes.length, 26);
    localHeader.writeUInt16LE(0, 28);

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(20, 4);
    centralHeader.writeUInt16LE(20, 6);
    centralHeader.writeUInt16LE(0, 8);
    centralHeader.writeUInt16LE(8, 10);
    centralHeader.writeUInt16LE(0, 12);
    centralHeader.writeUInt16LE(0, 14);
    centralHeader.writeUInt32LE(checksum, 16);
    centralHeader.writeUInt32LE(compressed.length, 20);
    centralHeader.writeUInt32LE(raw.length, 24);
    centralHeader.writeUInt16LE(nameBytes.length, 28);
    centralHeader.writeUInt16LE(0, 30);
    centralHeader.writeUInt16LE(0, 32);
    centralHeader.writeUInt16LE(0, 34);
    centralHeader.writeUInt16LE(0, 36);
    centralHeader.writeUInt32LE(0, 38);
    centralHeader.writeUInt32LE(offset, 42);

    localParts.push(localHeader, nameBytes, compressed);
    centralParts.push(centralHeader, nameBytes);
    offset += localHeader.length + nameBytes.length + compressed.length;
  }

  const centralSize = centralParts.reduce((sum, part) => sum + part.length, 0);
  const endRecord = Buffer.alloc(22);
  endRecord.writeUInt32LE(0x06054b50, 0);
  endRecord.writeUInt16LE(0, 4);
  endRecord.writeUInt16LE(0, 6);
  endRecord.writeUInt16LE(files.length, 8);
  endRecord.writeUInt16LE(files.length, 10);
  endRecord.writeUInt32LE(centralSize, 12);
  endRecord.writeUInt32LE(offset, 16);
  endRecord.writeUInt16LE(0, 20);

  return Buffer.concat([...localParts, ...centralParts, endRecord]);
}

function findCscPath() {
  const winRoot = process.env.WINDIR || process.env.SystemRoot || path.join(path.parse(process.cwd()).root, "Windows");
  const candidates = [
    path.join(winRoot, "Microsoft.NET", "Framework64", "v4.0.30319", "csc.exe"),
    path.join(winRoot, "Microsoft.NET", "Framework", "v4.0.30319", "csc.exe"),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }
  throw new Error("Could not find .NET Framework csc.exe compiler.");
}

function getDesktopHostCSharpSource() {
  return `using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.IO.Compression;
using System.Net;
using System.Net.Http;
using System.Net.Sockets;
using System.Reflection;
using System.Text;
using System.Threading;
using System.Threading.Tasks;

namespace FormulaFlashHost
{
    internal static class Program
    {
        private static readonly Dictionary<string, byte[]> Assets = new Dictionary<string, byte[]>(StringComparer.OrdinalIgnoreCase);

        [STAThread]
        private static int Main(string[] args)
        {
            bool headless = false;
            bool selfTest = false;
            int requestedPort = 0;

            for (int i = 0; i < args.Length; i++)
            {
                string arg = args[i] ?? string.Empty;
                if (arg == "--self-test")
                {
                    selfTest = true;
                }
                else if (arg == "--headless-server")
                {
                    headless = true;
                    if (i + 1 < args.Length)
                    {
                        int parsedPort;
                        if (int.TryParse(args[i + 1], out parsedPort))
                        {
                            requestedPort = parsedPort;
                            i++;
                        }
                    }
                }
            }

            LoadEmbeddedAssets();
            TcpListener listener = new TcpListener(IPAddress.Loopback, requestedPort);
            listener.Start();
            int activePort = ((IPEndPoint)listener.LocalEndpoint).Port;

            CancellationTokenSource cts = new CancellationTokenSource();
            Task.Run(() => RunServerLoop(listener, cts.Token));

            string baseUrl = "http://127.0.0.1:" + activePort + "/";
            if (selfTest)
            {
                using (var http = new HttpClient())
                {
                    http.Timeout = TimeSpan.FromSeconds(5);
                    string html = http.GetStringAsync(baseUrl).GetAwaiter().GetResult();
                    if (string.IsNullOrEmpty(html) || !html.Contains("<div id=\\"root\\">"))
                    {
                        throw new InvalidOperationException("Self-test failed: root HTML missing.");
                    }
                    string health = http.GetStringAsync(baseUrl + "api/health").GetAwaiter().GetResult();
                    if (string.IsNullOrEmpty(health) || !health.Contains("\\"ok\\":true"))
                    {
                        throw new InvalidOperationException("Self-test failed: health endpoint error.");
                    }
                }
                Console.WriteLine("SELF_TEST_OK " + baseUrl);
                Console.Out.Flush();
                cts.Cancel();
                try { listener.Stop(); } catch { }
                return 0;
            }

            if (headless)
            {
                Console.WriteLine("READY " + baseUrl);
                Console.Out.Flush();
                try
                {
                    while (!cts.IsCancellationRequested)
                    {
                        Thread.Sleep(200);
                    }
                }
                catch
                {
                    // Exiting headless server
                }
                listener.Stop();
                return 0;
            }

            LaunchDesktopWindow(baseUrl);
            cts.Cancel();
            try { listener.Stop(); } catch { }
            return 0;
        }

        private static void LoadEmbeddedAssets()
        {
            Assembly asm = Assembly.GetExecutingAssembly();
            using (Stream stream = asm.GetManifestResourceStream("app-assets.zip"))
            {
                if (stream == null)
                {
                    throw new InvalidOperationException("Embedded app-assets.zip resource missing.");
                }
                using (ZipArchive archive = new ZipArchive(stream, ZipArchiveMode.Read))
                {
                    foreach (ZipArchiveEntry entry in archive.Entries)
                    {
                        if (string.IsNullOrEmpty(entry.Name)) continue;
                        string key = entry.FullName.Replace('\\\\', '/').TrimStart('/');
                        using (Stream entryStream = entry.Open())
                        using (MemoryStream ms = new MemoryStream())
                        {
                            entryStream.CopyTo(ms);
                            Assets[key] = ms.ToArray();
                        }
                    }
                }
            }
        }

        private static void LaunchDesktopWindow(string baseUrl)
        {
            string browserExe = FindAppShellBrowser();
            string profileDir = Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                "FormulaFlash",
                "WindowProfile"
            );
            Directory.CreateDirectory(profileDir);

            if (!string.IsNullOrEmpty(browserExe))
            {
                var psi = new ProcessStartInfo
                {
                    FileName = browserExe,
                    Arguments = "--app=" + baseUrl + " --user-data-dir=\\"" + profileDir + "\\" --new-window --window-size=1280,820 --no-first-run --no-default-browser-check",
                    UseShellExecute = false
                };
                using (Process proc = Process.Start(psi))
                {
                    if (proc != null)
                    {
                        proc.WaitForExit();
                        return;
                    }
                }
            }
            Process.Start(new ProcessStartInfo { FileName = baseUrl, UseShellExecute = true });
            Thread.Sleep(60000);
        }

        private static string FindAppShellBrowser()
        {
            string pf86 = Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86);
            string pf = Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles);
            string local = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);
            string[] candidates = new[]
            {
                Path.Combine(pf86, "Microsoft", "Edge", "Application", "msedge.exe"),
                Path.Combine(pf, "Microsoft", "Edge", "Application", "msedge.exe"),
                Path.Combine(pf, "Google", "Chrome", "Application", "chrome.exe"),
                Path.Combine(pf86, "Google", "Chrome", "Application", "chrome.exe"),
                Path.Combine(local, "Google", "Chrome", "Application", "chrome.exe"),
            };
            foreach (string path in candidates)
            {
                if (!string.IsNullOrEmpty(path) && File.Exists(path)) return path;
            }
            return string.Empty;
        }

        private static void RunServerLoop(TcpListener listener, CancellationToken token)
        {
            while (!token.IsCancellationRequested)
            {
                try
                {
                    TcpClient client = listener.AcceptTcpClient();
                    Task.Run(() => HandleClient(client));
                }
                catch
                {
                    if (token.IsCancellationRequested) break;
                }
            }
        }

        private static void HandleClient(TcpClient client)
        {
            using (client)
            using (NetworkStream stream = client.GetStream())
            {
                try
                {
                    var reader = new StreamReader(stream, Encoding.ASCII, false, 4096, true);
                    string requestLine = reader.ReadLine();
                    if (string.IsNullOrEmpty(requestLine)) return;
                    string line;
                    while (!string.IsNullOrEmpty(line = reader.ReadLine())) { }

                    string[] parts = requestLine.Split(' ');
                    string rawTarget = parts.Length >= 2 ? parts[1] : "/";
                    int qIdx = rawTarget.IndexOf('?');
                    string reqPath = Uri.UnescapeDataString(qIdx >= 0 ? rawTarget.Substring(0, qIdx) : rawTarget);

                    if (reqPath == "/api/health")
                    {
                        byte[] json = Encoding.UTF8.GetBytes("{\\"ok\\":true,\\"app\\":\\"FormulaFlash\\"}");
                        WriteHttpResponse(stream, 200, "application/json; charset=utf-8", json);
                        return;
                    }

                    string key = reqPath == "/" ? "index.html" : reqPath.TrimStart('/');
                    byte[] body;
                    if (!Assets.TryGetValue(key, out body))
                    {
                        key = "index.html";
                        if (!Assets.TryGetValue(key, out body))
                        {
                            WriteHttpResponse(stream, 404, "text/plain; charset=utf-8", Encoding.UTF8.GetBytes("Not Found"));
                            return;
                        }
                    }
                    WriteHttpResponse(stream, 200, GetMimeType(key), body);
                }
                catch
                {
                    // Ignore malformed client socket reads
                }
            }
        }

        private static void WriteHttpResponse(NetworkStream stream, int status, string contentType, byte[] body)
        {
            string statusText = status == 200 ? "OK" : "Not Found";
            string headers =
                "HTTP/1.1 " + status + " " + statusText + "\\r\\n" +
                "Content-Type: " + contentType + "\\r\\n" +
                "Content-Length: " + body.Length + "\\r\\n" +
                "Cache-Control: no-store\\r\\n" +
                "Connection: close\\r\\n\\r\\n";
            byte[] headerBytes = Encoding.ASCII.GetBytes(headers);
            stream.Write(headerBytes, 0, headerBytes.Length);
            stream.Write(body, 0, body.Length);
            stream.Flush();
        }

        private static string GetMimeType(string assetPath)
        {
            string lower = assetPath.ToLowerInvariant();
            if (lower.EndsWith(".html")) return "text/html; charset=utf-8";
            if (lower.EndsWith(".js") || lower.EndsWith(".mjs")) return "application/javascript; charset=utf-8";
            if (lower.EndsWith(".css")) return "text/css; charset=utf-8";
            if (lower.EndsWith(".svg")) return "image/svg+xml";
            if (lower.EndsWith(".png")) return "image/png";
            if (lower.EndsWith(".woff2")) return "font/woff2";
            if (lower.EndsWith(".woff")) return "font/woff";
            if (lower.EndsWith(".ttf")) return "font/ttf";
            if (lower.EndsWith(".json")) return "application/json; charset=utf-8";
            if (lower.EndsWith(".ico")) return "image/x-icon";
            return "application/octet-stream";
        }
    }
}
`;
}

function buildDesktopExe() {
  if (!fs.existsSync(DIST_DIR) || !fs.existsSync(path.join(DIST_DIR, "index.html"))) {
    throw new Error("apps/app/dist/index.html is missing. Run 'pnpm --filter app run build' first.");
  }

  fs.mkdirSync(BUILD_DIR, { recursive: true });
  const files = collectFiles(DIST_DIR);
  fs.writeFileSync(ASSETS_ZIP, buildZipBuffer(files));
  fs.writeFileSync(CS_FILE, getDesktopHostCSharpSource(), "utf8");

  const brandIco = path.join(ROOT_DIR, "assets", "icon.ico");
  const cscPath = findCscPath();
  const cscArgs = [
    "/nologo",
    "/optimize+",
    "/target:winexe",
    `/out:${EXE_OUT}`,
    ...(fs.existsSync(brandIco) ? [`/win32icon:${brandIco}`] : []),
    `/resource:${ASSETS_ZIP},app-assets.zip`,
    "/reference:System.dll",
    "/reference:System.Core.dll",
    "/reference:System.IO.Compression.dll",
    "/reference:System.Net.Http.dll",
    CS_FILE,
  ];

  execFileSync(cscPath, cscArgs, { stdio: "inherit" });
  console.log(`Built ${EXE_OUT}`);
}

buildDesktopExe();
