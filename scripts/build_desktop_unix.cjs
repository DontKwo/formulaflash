const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const ROOT_DIR = path.resolve(__dirname, "..");
const DIST_DIR = path.join(ROOT_DIR, "apps", "app", "dist");
const BUILD_DIR = path.join(ROOT_DIR, "build");
const HOST_SCRIPT = path.join(ROOT_DIR, "scripts", "unix_host.py");

function resolvePythonBin() {
  const candidates = process.platform === "win32" ? ["python", "py"] : ["python3", "python"];
  for (const bin of candidates) {
    try {
      execFileSync(bin, ["--version"], { stdio: "ignore" });
      return bin;
    } catch {
      // Try next Python binary candidate
    }
  }
  throw new Error("Python 3 interpreter not found.");
}

function parseCliArgs(argv) {
  let platform = process.platform === "darwin" ? "macos" : "linux";
  let selfTest = false;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--self-test") {
      selfTest = true;
    } else if (argv[i] === "--platform" && i + 1 < argv.length) {
      platform = argv[i + 1].toLowerCase();
      i++;
    }
  }
  return { platform, selfTest };
}

function run() {
  if (!fs.existsSync(DIST_DIR) || !fs.existsSync(path.join(DIST_DIR, "index.html"))) {
    throw new Error("apps/app/dist/index.html is missing. Run 'pnpm --filter app run build' first.");
  }
  const { platform, selfTest } = parseCliArgs(process.argv.slice(2));
  const pythonBin = resolvePythonBin();
  fs.mkdirSync(BUILD_DIR, { recursive: true });

  if (selfTest) {
    execFileSync(pythonBin, [HOST_SCRIPT, "--self-test"], { stdio: "inherit" });
  }

  if (process.platform === "win32") {
    console.log("Skipping native Unix PyInstaller packaging on Windows host.");
    return;
  }

  const workDir = path.join(BUILD_DIR, "pyi-work");
  const distOutDir = path.join(BUILD_DIR, "pyi-dist");
  fs.mkdirSync(workDir, { recursive: true });
  fs.mkdirSync(distOutDir, { recursive: true });

  const pyInstallerArgs = [
    "-m",
    "PyInstaller",
    "--noconfirm",
    "--clean",
    "--onefile",
    "--noconsole",
    "--workpath",
    workDir,
    "--name",
    "FormulaFlash",
    "--add-data",
    `${DIST_DIR}:dist`,
    "--distpath",
    distOutDir,
    HOST_SCRIPT,
  ];
  const iconPath = path.join(ROOT_DIR, "assets", "icon.ico");
  if (fs.existsSync(iconPath)) {
    pyInstallerArgs.splice(pyInstallerArgs.indexOf("--name"), 0, `--icon=${iconPath}`);
  }
  execFileSync(pythonBin, pyInstallerArgs, { stdio: "inherit" });

  if (platform === "macos") {
    const appPath = path.join(distOutDir, "FormulaFlash.app");
    const binPath = path.join(distOutDir, "FormulaFlash");
    const targetBin = fs.existsSync(appPath) ? path.join(appPath, "Contents", "MacOS", "FormulaFlash") : binPath;
    if (selfTest) {
      execFileSync(targetBin, ["--self-test"], { stdio: "inherit" });
    }
    const zipTarget = path.join(BUILD_DIR, "FormulaFlash-macOS.zip");
    const itemToZip = fs.existsSync(appPath) ? "FormulaFlash.app" : "FormulaFlash";
    execFileSync("zip", ["-r", zipTarget, itemToZip], { cwd: distOutDir, stdio: "inherit" });
    console.log(`Built ${zipTarget}`);
    return;
  }

  const linuxBin = path.join(distOutDir, "FormulaFlash");
  const renamedBin = path.join(BUILD_DIR, "FormulaFlash-Linux");
  if (fs.existsSync(linuxBin)) {
    fs.copyFileSync(linuxBin, renamedBin);
    fs.chmodSync(renamedBin, 0o755);
  }
  if (selfTest) {
    execFileSync(renamedBin, ["--self-test"], { stdio: "inherit" });
  }
  const tarTarget = path.join(BUILD_DIR, "FormulaFlash-Linux.tar.gz");
  execFileSync("tar", ["-czf", tarTarget, "FormulaFlash-Linux"], { cwd: BUILD_DIR, stdio: "inherit" });
  console.log(`Built ${tarTarget}`);
}

run();
