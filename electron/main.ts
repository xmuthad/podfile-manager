import { app, BrowserWindow, ipcMain, dialog, session, type IpcMainInvokeEvent } from 'electron';
import { exec, spawn, type ChildProcess } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { fileURLToPath } from 'url';
import type { ContainerStatus, PodData, ContainerInfo } from './types.js';
import { IPC_CHANNELS as CH } from './types.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const execAsync = promisify(exec);
const fsAsync = fs.promises;

const EXEC_COMMAND_TIMEOUT_MS = 60_000;
// kubectl -o json 输出完整 spec/status/annotations，pod 较多的 namespace 可能超过 exec 默认 1MB，
// 导致 "stdout maxBuffer length exceeded" 而加载失败，这里放宽到 50MB。
const KUBE_JSON_MAX_BUFFER = 50 * 1024 * 1024;

/**
 * 修复打包后 Electron 应用找不到 kubectl / docker 的问题。
 * 打包后的 Electron 不继承用户 shell 的 PATH，需要手动从登录 shell 获取。
 */
async function fixPath(): Promise<void> {
  if (process.platform === 'win32') return; // Windows 不受此问题影响

  try {
    const shell = process.env.SHELL || '/bin/zsh';
    const { stdout } = await execAsync(`${shell} -ilc 'echo $PATH'`, { timeout: 10_000 });
    const shellPath = stdout.trim();
    if (shellPath) {
      process.env.PATH = shellPath;
    }
  } catch {
    // 获取失败时追加常见安装路径，保证基本可用
    const extra = ['/usr/local/bin', '/opt/homebrew/bin', '/usr/local/sbin', path.join(os.homedir(), '.local', 'bin')];
    process.env.PATH = [...extra, process.env.PATH ?? ''].filter(Boolean).join(':');
  }
}

await fixPath();

function assertNonEmptyString(value: unknown, name: string): asserts value is string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`参数 "${name}" 不能为空`);
  }
}

function escapeShellArg(arg: string): string {
  return "'" + String(arg).replace(/'/g, "'\\''") + "'";
}

function buildContainerArgs(container?: string | null): string[] {
  return container ? ['-c', container] : [];
}

/**
 * 限速流方案已废弃：流式背压会让 exec 长连接持续低速传输，
 * 集群链路上的中间层（LB/apiserver）会 reset 这类连接导致文件截断。
 * 现改用 KUBECTL_DOWNLOAD_FILE_WITH_LIMIT 中的分块全速拉取 + 块间休眠方案。
 */

function buildKubectlCpArgs(
  namespace: string,
  src: string,
  dst: string,
  container?: string | null
): string[] {
  const args = ['cp', '-n', namespace, src, dst];
  if (container) {
    args.push('-c', container);
  }
  return args;
}

function getDockerError(errMsg: string, filePath: string, imageName: string): { message: string; error: string } {
  if (errMsg.includes('No such file or directory') || errMsg.includes('cannot find')) {
    return {
      message: `文件 "${filePath}" 在镜像中不存在`,
      error: `文件 "${filePath}" 在镜像中不存在`
    };
  } else if (errMsg.includes('cannot execute') || errMsg.includes('not found') || errMsg.includes('executable')) {
    return {
      message: `镜像 ${imageName} 无法执行命令，可能是精简镜像没有 shell`,
      error: `镜像 ${imageName} 无法执行命令，可能是精简镜像没有 shell`
    };
  } else {
    return {
      message: 'Docker 提取失败: ' + errMsg,
      error: 'Docker 提取失败: ' + errMsg
    };
  }
}

function createTempPath(prefix: string): string {
  const tmpDir = os.tmpdir();
  const random = Math.random().toString(36).substring(2, 10);
  return path.join(tmpDir, `${prefix}_${Date.now()}_${random}`);
}

let mainWindow: BrowserWindow | null = null;

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  // 开发模式加载 Vite dev 服务器，生产模式加载本地构建文件
  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }
}

app.whenReady().then(() => {
  // 仅在生产模式启用 CSP（dev 模式需要允许 Vite HMR / ws / eval）
  if (!process.env.VITE_DEV_SERVER_URL) {
    session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
      callback({
        responseHeaders: {
          ...details.responseHeaders,
          'Content-Security-Policy': [
            "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'"
          ]
        }
      });
    });
  }
  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

ipcMain.handle(CH.KUBECTL_GET_NAMESPACES, async () => {
  try {
    const { stdout } = await execAsync('kubectl get namespaces -o json', { timeout: 30000, maxBuffer: KUBE_JSON_MAX_BUFFER });
    return JSON.parse(stdout);
  } catch (error) {
    throw new Error((error as Error).message, { cause: error });
  }
});

ipcMain.handle(CH.DOCKER_READ_FILE, async (_event, imageName: string, filePath: string) => {
  assertNonEmptyString(imageName, 'imageName');
  assertNonEmptyString(filePath, 'filePath');
  try {
    const cleanPath = filePath.endsWith('/') ? filePath.slice(0, -1) : filePath;
    const escapedImage = escapeShellArg(imageName);
    const escapedPath = escapeShellArg(cleanPath);
    const command = `docker run --rm --entrypoint cat ${escapedImage} ${escapedPath}`;
    const { stdout, stderr } = await execAsync(command, { timeout: 60000, maxBuffer: 10 * 1024 * 1024 });

    const combinedOutput = stdout + (stderr || '');
    if (combinedOutput.includes('No such file or directory')) {
      throw new Error(`文件 "${filePath}" 在镜像中不存在`);
    }
    if (combinedOutput.includes('cannot execute') || combinedOutput.includes('executable file not found')) {
      throw new Error(`镜像 ${imageName} 无法执行 cat 命令，可能是精简镜像没有 shell`);
    }

    return stdout;
  } catch (error) {
    const errMsg = (error as Error).message || '';
    if (errMsg.includes('No such file or directory') || errMsg.includes('cannot find')) {
      throw new Error(`文件 "${filePath}" 不存在`, { cause: error });
    }
    if (errMsg.includes('cannot execute') || errMsg.includes('not found') || errMsg.includes('executable')) {
      throw new Error(`镜像 ${imageName} 无法执行命令，可能是精简镜像没有 shell`, { cause: error });
    }
    throw new Error('读取文件失败: ' + errMsg, { cause: error });
  }
});

ipcMain.handle(CH.KUBECTL_GET_PODS, async (_event, namespace: string) => {
  assertNonEmptyString(namespace, 'namespace');
  try {
    const { stdout } = await execAsync(`kubectl get pods -n ${escapeShellArg(namespace)} -o json`, { timeout: 30000, maxBuffer: KUBE_JSON_MAX_BUFFER });
    return JSON.parse(stdout);
  } catch (error) {
    throw new Error((error as Error).message, { cause: error });
  }
});

ipcMain.handle(CH.KUBECTL_GET_ALL_PODS, async (_event, searchTerm: string) => {
  assertNonEmptyString(searchTerm, 'searchTerm');
  try {
    // 全命名空间查询，在主进程按名称过滤后只回传匹配项，避免大 JSON 走 IPC
    const { stdout } = await execAsync('kubectl get pods -A -o json', { timeout: 30000, maxBuffer: KUBE_JSON_MAX_BUFFER });
    const data = JSON.parse(stdout) as { items?: Array<{ metadata?: { name?: string } }> };
    const lower = searchTerm.toLowerCase();
    const items = (data.items ?? []).filter(
      (pod) => typeof pod.metadata?.name === 'string' && pod.metadata.name.toLowerCase().includes(lower)
    );
    return { items };
  } catch (error) {
    throw new Error((error as Error).message, { cause: error });
  }
});

ipcMain.handle(CH.KUBECTL_LIST_FILES, async (_event, namespace: string, pod: string, container: string | null, dirPath: string) => {
  assertNonEmptyString(namespace, 'namespace');
  assertNonEmptyString(pod, 'pod');
  assertNonEmptyString(dirPath, 'dirPath');
  try {
    const containerArgs = buildContainerArgs(container);
    // 用 printf '%y' 输出完整时间戳，避免 ls 输出按多空白分隔时文件名解析错位。
    // 输出格式：<perms>|<links>|<owner>|<group>|<size>|<month>|<day>|<time-or-year>|<name>
    const escapedPath = escapeShellArg(dirPath);
    const statCommand = `cd ${escapedPath} && ls -laA | awk 'NR>2 {printf "%s|%s|%s|%s|%s|%s|%s|%s|", $1, $2, $3, $4, $5, $6, $7, $8; for(i=9;i<=NF;i++) printf "%s ", $i; printf "\\n"}'`;
    const args = ['exec', '-n', namespace, pod, ...containerArgs, '--', 'sh', '-c', statCommand];
    const { stdout } = await execAsync(`kubectl ${args.map(a => escapeShellArg(a)).join(' ')}`, { timeout: 30000 });
    return stdout;
  } catch (error) {
    throw new Error((error as Error).message, { cause: error });
  }
});

ipcMain.handle(CH.KUBECTL_GET_CONTAINERS, async (_event, namespace: string, pod: string) => {
  assertNonEmptyString(namespace, 'namespace');
  assertNonEmptyString(pod, 'pod');
  try {
    const { stdout } = await execAsync(`kubectl get pod ${escapeShellArg(pod)} -n ${escapeShellArg(namespace)} -o json`, { timeout: 30000, maxBuffer: KUBE_JSON_MAX_BUFFER });
    const podData = JSON.parse(stdout) as PodData;
    const containers: ContainerInfo[] = podData.spec.containers.map((container: { name: string; image: string }) => ({
      name: container.name.trim(),
      image: container.image.trim(),
      ready: false,
      restartCount: 0,
      state: { waiting: { reason: 'ContainerStarting', message: 'Starting' } }
    }));

    if (podData.status && podData.status.containerStatuses) {
      podData.status.containerStatuses.forEach((status: ContainerStatus) => {
        const container = containers.find((c) => c.name === status.name);
        if (container) {
          container.ready = status.ready;
          container.restartCount = status.restartCount;
          if (status.state.running) {
            container.state = { running: { startedAt: status.state.running.startedAt } };
          } else if (status.state.terminated) {
            container.state = { terminated: { exitCode: status.state.terminated.exitCode, reason: status.state.terminated.reason } };
          } else if (status.state.waiting) {
            container.state = { waiting: { reason: status.state.waiting.reason, message: status.state.waiting.message } };
          }
        }
      });
    }

    return { items: containers };
  } catch (error) {
    throw new Error((error as Error).message, { cause: error });
  }
});

ipcMain.handle(CH.KUBECTL_DOWNLOAD_FILE_WITH_LIMIT, async (event: IpcMainInvokeEvent, namespace: string, pod: string, container: string | null, remotePath: string, limitSpeed: number) => {
  const remoteFileName = path.basename(remotePath);

  if (!mainWindow) throw new Error('窗口未就绪');
  const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
    defaultPath: remoteFileName,
    properties: ['showOverwriteConfirmation']
  });

  if (canceled || !filePath) {
    return null;
  }

  try {
    const bytesPerSecond = limitSpeed * 1024;
    const containerArgs = buildContainerArgs(container);
    const escapedPath = escapeShellArg(remotePath);

    const sendProgress = (transferred: number): void => {
      event.sender.send(CH.TRANSFER_PROGRESS, {
        status: 'downloading',
        transferred,
        total: 0,
        percent: 0,
        speed: `限速 ${limitSpeed}KB/s`
      });
    };
    sendProgress(0);

    // 分块限速：exec 长连接持续低速传输会被集群链路中间层 reset（连接中断、文件截断），
    // 因此按 offset 分块全速拉取，块间休眠把平均速率压到限速值。
    const MAX_CHUNK_BYTES = 16 * 1024 * 1024;
    let chunkBytes = 512 * 1024; // 首块保守起步，之后按观测吞吐自适应放大
    let offset = 0;

    // 单块拉取：缓冲整块，校验远端退出标记后才落盘，失败可从同一 offset 幂等重试
    const fetchChunk = (skipKB: number, countKB: number, onBytes: (received: number) => void): Promise<{ ok: boolean; data: Buffer[]; stderr: string }> =>
      new Promise((resolve) => {
        const command = `dd if=${escapedPath} bs=1024 skip=${skipKB} count=${countKB} 2>/dev/null; echo EXIT:$? >&2`;
        const child = spawn('kubectl', ['exec', '-n', namespace, pod, ...containerArgs, '--', 'sh', '-c', command]);
        const data: Buffer[] = [];
        let received = 0;
        let stderr = '';
        child.stdout!.on('data', (d: Buffer) => {
          data.push(d);
          received += d.length;
          onBytes(received);
        });
        child.stderr!.on('data', (d: Buffer) => {
          stderr += d.toString();
        });
        child.on('error', (err: Error) => resolve({ ok: false, data: [], stderr: '无法启动 kubectl: ' + err.message }));
        child.on('close', () => {
          const match = stderr.match(/EXIT:(\d+)/);
          if (match && match[1] === '0') {
            resolve({ ok: true, data, stderr });
          } else {
            resolve({ ok: false, data: [], stderr: stderr || '未知错误' });
          }
        });
      });

    const writeStream = fs.createWriteStream(filePath);
    let lastReport = 0;

    try {
      while (true) {
        const t0 = Date.now();
        const skipKB = offset / 1024;
        const countKB = Math.ceil(chunkBytes / 1024);

        let result = await fetchChunk(skipKB, countKB, (received) => {
          const now = Date.now();
          if (now - lastReport >= 200) {
            lastReport = now;
            sendProgress(offset + received);
          }
        });
        // 失败块幂等重试（同一 offset，最多 3 次）
        for (let attempt = 0; !result.ok && attempt < 3; attempt++) {
          result = await fetchChunk(skipKB, countKB, () => { /* 重试期间不上报 */ });
        }
        if (!result.ok) {
          throw new Error('限速下载失败: ' + result.stderr);
        }

        const chunk = Buffer.concat(result.data);
        await new Promise<void>((resolve, reject) => {
          writeStream.write(chunk, (err) => (err ? reject(err) : resolve()));
        });
        offset += chunk.length;
        sendProgress(offset);

        const elapsed = (Date.now() - t0) / 1000;
        const isEof = chunk.length < countKB * 1024;
        if (isEof) break;

        // 节拍：让块期间平均速率收敛到限速值（块耗时已超限速预算则不休眠）
        const targetPeriodSec = chunkBytes / bytesPerSecond;
        const waitMs = Math.max(0, Math.ceil((targetPeriodSec - elapsed) * 1000));
        if (waitMs > 0) {
          await new Promise<void>((resolve) => setTimeout(resolve, waitMs));
        }

        // 自适应下一块：目标 2s 的限速预算，同时按观测吞吐限制单块耗时至 ~3s，
        // 保证每条 exec 连接短命，不触发链路中间层的低速连接 reset
        const observedBps = chunkBytes / Math.max(elapsed, 0.001);
        const nextByRate = bytesPerSecond * 2;
        const nextByTime = Math.max(512 * 1024, observedBps * 3);
        chunkBytes = Math.max(256 * 1024, Math.min(MAX_CHUNK_BYTES, nextByRate, nextByTime));
      }
    } finally {
      writeStream.end();
    }

    // 完整性校验：远端文件大小与本地落盘字节数一致
    const sizeArgs = ['exec', '-n', namespace, pod, ...containerArgs, '--', 'sh', '-c', `wc -c < ${escapedPath}`];
    const { stdout: sizeOut } = await execAsync(`kubectl ${sizeArgs.map(a => escapeShellArg(a)).join(' ')}`, { timeout: 30000, maxBuffer: KUBE_JSON_MAX_BUFFER });
    const remoteSize = parseInt(sizeOut.trim(), 10);
    if (!Number.isNaN(remoteSize) && remoteSize !== offset) {
      throw new Error(`限速下载失败: 文件不完整（本地 ${offset} 字节 / 远端 ${remoteSize} 字节）`);
    }

    event.sender.send(CH.TRANSFER_PROGRESS, {
      status: 'completed',
      transferred: offset,
      total: offset,
      percent: 100,
      speed: `${limitSpeed}KB/s (limited)`
    });

    return { success: true, path: filePath, method: 'dd-limit', speed: limitSpeed };
  } catch (error) {
    throw new Error((error as Error).message, { cause: error });
  }
});

ipcMain.handle(CH.KUBECTL_DOWNLOAD_FILE, async (event: IpcMainInvokeEvent, namespace: string, pod: string, container: string | null, remotePath: string) => {
  try {
    if (!mainWindow) throw new Error('窗口未就绪');
  const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
      defaultPath: path.basename(remotePath),
      properties: ['showOverwriteConfirmation']
    });

    if (canceled || !filePath) {
      return null;
    }

    return new Promise<string>((resolve, reject) => {
      let transferred = 0;
      const startTime = Date.now();
      let stderrOutput = '';

      const cpArgs = buildKubectlCpArgs(namespace, `${pod}:${remotePath}`, filePath, container);
      const childProcess = spawn('kubectl', cpArgs);

      childProcess.on('close', async (code: number | null) => {
        if (code === 0) {
          let finalSize = transferred;
          try {
            const stats = await fsAsync.stat(filePath);
            finalSize = stats.size;
          } catch (err) {
            void err;
          }
          event.sender.send(CH.TRANSFER_PROGRESS, {
            status: 'completed',
            transferred: finalSize,
            total: finalSize,
            percent: 100
          });
          resolve(filePath);
        } else {
          event.sender.send(CH.TRANSFER_PROGRESS, {
            status: 'error',
            transferred: 0,
            total: 0,
            message: '下载失败: ' + (stderrOutput || '退出码 ' + code)
          });
          reject(new Error('下载失败: ' + (stderrOutput || '退出码 ' + code)));
        }
      });

      childProcess.on('error', (error: Error) => {
        event.sender.send(CH.TRANSFER_PROGRESS, {
          status: 'error',
          transferred: 0,
          total: 0,
          message: 'Kubectl 错误: ' + error.message
        });
        reject(error);
      });

      childProcess.stderr!.on('data', (data: Buffer) => {
        stderrOutput += data.toString();
      });

      let lastUpdate = startTime;

      childProcess.stdout!.on('data', (data: Buffer) => {
        const now = Date.now();
        transferred += data.length;

        if (now - lastUpdate > 100) {
          const elapsed = (now - startTime) / 1000;
          const speed = elapsed > 0 ? (transferred / elapsed / 1024).toFixed(2) : 0;

          event.sender.send(CH.TRANSFER_PROGRESS, {
            status: 'downloading',
            transferred,
            total: 0,
            percent: 0,
            speed: `${speed} KB/s`
          });
          lastUpdate = now;
        }
      });
    });
  } catch (error) {
    throw new Error((error as Error).message, { cause: error });
  }
});

ipcMain.handle(CH.KUBECTL_UPLOAD_FILE, async (event: IpcMainInvokeEvent, namespace: string, pod: string, container: string | null, remotePath: string) => {
  try {
    if (!mainWindow) throw new Error('窗口未就绪');
  const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
      properties: ['openFile']
    });

    if (canceled || filePaths.length === 0) {
      return null;
    }

    const localPath = filePaths[0];

    let totalSize = 0;
    try {
      const stats = await fsAsync.stat(localPath);
      totalSize = stats.size;
    } catch (err) {
      throw new Error('无法读取本地文件信息: ' + (err as Error).message, { cause: err });
    }

    event.sender.send(CH.TRANSFER_PROGRESS, {
      status: 'uploading',
      transferred: 0,
      total: totalSize,
      percent: 0,
      speed: '准备上传...'
    });

    return new Promise<string>((resolve, reject) => {
      const cpArgs = buildKubectlCpArgs(namespace, localPath, `${pod}:${remotePath}`, container);
      const childProcess = spawn('kubectl', cpArgs);
      let stderrOutput = '';
      const startTime = Date.now();

      const tick = setInterval(() => {
        const elapsed = (Date.now() - startTime) / 1000;
        if (elapsed > 0) {
          // kubectl cp 不暴露中间进度，使用 0 字节/递增占位（UI 显示"上传中"）
          event.sender.send(CH.TRANSFER_PROGRESS, {
            status: 'uploading',
            transferred: 0,
            total: totalSize,
            percent: 0,
            speed: '上传中...'
          });
        }
      }, 500);

      childProcess.stderr!.on('data', (data: Buffer) => {
        stderrOutput += data.toString();
      });

      childProcess.on('close', (code: number | null) => {
        clearInterval(tick);
        if (code === 0) {
          event.sender.send(CH.TRANSFER_PROGRESS, { status: 'completed', transferred: totalSize, total: totalSize, percent: 100 });
          resolve(localPath);
        } else {
          event.sender.send(CH.TRANSFER_PROGRESS, { status: 'error', message: '上传失败: ' + (stderrOutput || `退出码 ${code}`) });
          reject(new Error('上传失败: ' + (stderrOutput || `退出码 ${code}`)));
        }
      });

      childProcess.on('error', (error: Error) => {
        clearInterval(tick);
        event.sender.send(CH.TRANSFER_PROGRESS, { status: 'error', message: error.message });
        reject(error);
      });
    });
  } catch (error) {
    throw new Error((error as Error).message, { cause: error });
  }
});

ipcMain.handle(CH.KUBECTL_READ_FILE, async (_event, namespace: string, pod: string, container: string | null, remotePath: string) => {
  try {
    const containerArgs = buildContainerArgs(container);
    const args = ['exec', '-n', namespace, pod, ...containerArgs, '--', 'cat', remotePath];
    const { stdout } = await execAsync(`kubectl ${args.map(a => escapeShellArg(a)).join(' ')}`, { timeout: 30000, maxBuffer: 10 * 1024 * 1024 });
    return stdout;
  } catch (error) {
    throw new Error((error as Error).message, { cause: error });
  }
});

ipcMain.handle(CH.DOCKER_LIST_IMAGES, async () => {
  try {
    const { stdout } = await execAsync(`docker images --format '{{.Repository}}:{{.Tag}}|{{.ID}}|{{.Size}}'`, { timeout: 30000 });
    const images = stdout.trim().split('\n').filter((line: string) => line.trim())
      .map((line: string) => {
        const [repoTag, id, size] = line.split('|');
        const [repository, tag] = repoTag.includes(':') ? repoTag.split(':') : [repoTag, 'latest'];
        return {
          repository: repository || '<none>',
          tag: tag || 'latest',
          id: id || '',
          size: size || '0'
        };
      });
    return images;
  } catch (error) {
    throw new Error('获取 Docker 镜像列表失败: ' + (error as Error).message, { cause: error });
  }
});

ipcMain.handle(CH.DOCKER_LIST_FILES, async (_event, imageName: string, dirPath: string) => {
  assertNonEmptyString(imageName, 'imageName');
  assertNonEmptyString(dirPath, 'dirPath');
  try {
    const cleanPath = dirPath.endsWith('/') ? dirPath.slice(0, -1) : dirPath;
    const escapedImage = escapeShellArg(imageName);
    const escapedPath = escapeShellArg(cleanPath);
    // 同样的管道分隔格式，<perms>|<links>|<owner>|<group>|<size>|<month>|<day>|<time-or-year>|<name>
    const command = `docker run --rm --entrypoint sh ${escapedImage} -c ${escapeShellArg(`cd ${escapedPath} && ls -laA 2>/dev/null | awk 'NR>2 {printf "%s|%s|%s|%s|%s|%s|%s|%s|", $1, $2, $3, $4, $5, $6, $7, $8; for(i=9;i<=NF;i++) printf "%s ", $i; printf "\\n"}'`)}`;
    const { stdout, stderr } = await execAsync(command, { timeout: 30000 });

    const combinedOutput = stdout + (stderr || '');
    if (combinedOutput.includes('No such file or directory')) {
      throw new Error(`路径 "${dirPath}" 在镜像中不存在或无法访问`);
    }
    if (combinedOutput.includes('cannot execute') || combinedOutput.includes('executable file not found')) {
      throw new Error(`镜像 ${imageName} 无法执行 ls 命令，可能是精简镜像没有 shell`);
    }

    return stdout;
  } catch (error) {
    const errMsg = (error as Error).message || '';
    if (errMsg.includes('No such file or directory') || errMsg.includes('cannot find')) {
      throw new Error(`路径 "${dirPath}" 不存在`, { cause: error });
    }
    if (errMsg.includes('cannot execute') || errMsg.includes('not found') || errMsg.includes('executable')) {
      throw new Error(`镜像 ${imageName} 无法执行命令，可能是精简镜像没有 shell`, { cause: error });
    }
    throw new Error('列出文件失败: ' + errMsg, { cause: error });
  }
});

ipcMain.handle(CH.DOCKER_DOWNLOAD_FILE, async (event: IpcMainInvokeEvent, imageName: string, filePath: string) => {
  const baseName = path.basename(filePath);

  const { canceled, filePath: savePath } = await dialog.showSaveDialog(mainWindow!, {
    defaultPath: baseName,
    title: '保存 Docker 镜像文件',
    properties: ['showOverwriteConfirmation']
  });

  if (canceled || !savePath) {
    return null;
  }

  try {
    event.sender.send(CH.TRANSFER_PROGRESS, {
      status: 'downloading',
      transferred: 0,
      total: 0,
      percent: 0,
      speed: '准备从 Docker 镜像提取文件...'
    });

    const cleanPath = filePath.endsWith('/') ? filePath.slice(0, -1) : filePath;
    const escapedImage = escapeShellArg(imageName);
    const escapedPath = escapeShellArg(cleanPath);
    const command = `docker run --rm --entrypoint cat ${escapedImage} ${escapedPath}`;

    const MAX_BYTES = 500 * 1024 * 1024;

    return new Promise<{ success: boolean; path: string }>((resolve, reject) => {
      const childProcess: ChildProcess = spawn('sh', ['-c', command]);
      const writeStream = fs.createWriteStream(savePath);
      let transferred = 0;
      let stderrOutput = '';
      let processFinished = false;
      let aborted = false;
      const startTime = Date.now();

      const cleanup = (): void => {
        if (!writeStream.destroyed) {
          writeStream.destroy();
        }
        if (!childProcess.killed) {
          childProcess.kill();
        }
      };

      // backpressure 处理
      let resolveDrain: (() => void) | null = null;
      const waitForDrain = () => new Promise<void>((resolve) => { resolveDrain = resolve; });
      writeStream.on('drain', () => {
        if (resolveDrain) {
          const r = resolveDrain;
          resolveDrain = null;
          r();
        }
      });

      const sendError = (msg: string, err: Error): void => {
        event.sender.send(CH.TRANSFER_PROGRESS, {
          status: 'error',
          transferred: 0,
          total: 0,
          message: msg
        });
        reject(err);
      };

      childProcess.stdout!.on('data', async (data: Buffer) => {
        if (aborted || processFinished) return;

        // 在流式写入过程中实时检查 500MB 上限
        if (transferred + data.length > MAX_BYTES) {
          aborted = true;
          processFinished = true;
          cleanup();
          try { await fsAsync.unlink(savePath); } catch (e) { void e; }
          sendError('文件超过 500MB 限制，已中止', new Error('文件超过 500MB 限制'));
          return;
        }

        transferred += data.length;
        const elapsed = (Date.now() - startTime) / 1000;
        const speed = elapsed > 0 ? (transferred / elapsed / 1024).toFixed(2) : '0.00';
        event.sender.send(CH.TRANSFER_PROGRESS, {
          status: 'downloading',
          transferred,
          total: 0,
          percent: 0,
          speed: `${speed} KB/s`
        });

        const ok = writeStream.write(data);
        if (!ok) {
          await waitForDrain();
        }
      });

      childProcess.stderr!.on('data', (data: Buffer) => {
        if (stderrOutput.length < 4096) {
          stderrOutput += data.toString();
        }
      });

      childProcess.on('close', async (code: number | null) => {
        if (processFinished) return;
        processFinished = true;

        cleanup();

        if (aborted) {
          // 已在 stdout 处理过，不再重复 reject
          return;
        }

        if (code === 0) {
          let finalSize = transferred;
          try {
            const stats = await fsAsync.stat(savePath);
            finalSize = stats.size;
          } catch (err) {
            void err;
          }

          event.sender.send(CH.TRANSFER_PROGRESS, {
            status: 'completed',
            transferred: finalSize,
            total: finalSize,
            percent: 100,
            speed: '提取完成'
          });
          resolve({ success: true, path: savePath });
        } else {
          const errMsg = stderrOutput || `exit code ${code}`;
          const errorInfo = getDockerError(errMsg, filePath, imageName);
          event.sender.send(CH.TRANSFER_PROGRESS, {
            status: 'error',
            transferred: 0,
            total: 0,
            message: errorInfo.message
          });
          reject(new Error(errorInfo.error));
        }
      });

      childProcess.on('error', (error: Error) => {
        if (processFinished) return;
        processFinished = true;

        cleanup();
        event.sender.send(CH.TRANSFER_PROGRESS, {
          status: 'error',
          transferred: 0,
          total: 0,
          message: 'Docker 错误: ' + error.message
        });
        reject(error);
      });
    });
  } catch (error) {
    throw new Error((error as Error).message, { cause: error });
  }
});

ipcMain.handle(CH.KUBECTL_WRITE_FILE, async (_event, namespace: string, pod: string, container: string | null, remotePath: string, content: string) => {
  const tmpPath = createTempPath('podfile_edit');

  try {
    await fsAsync.writeFile(tmpPath, content, 'utf8');

    const args = ['cp', '-n', namespace, tmpPath, `${pod}:${remotePath}`];
    if (container) {
      args.push('-c', container);
    }
    const childProcess = spawn('kubectl', args);

    return new Promise<{ success: boolean; path: string }>((resolve, reject) => {
      childProcess.on('close', async (code: number | null) => {
        try {
          await fsAsync.unlink(tmpPath);
        } catch (e) {
          void e;
        }

        if (code === 0) {
          resolve({ success: true, path: remotePath });
        } else {
          reject(new Error('写入文件失败'));
        }
      });

      childProcess.on('error', async (error: Error) => {
        try {
          await fsAsync.unlink(tmpPath);
        } catch (e) {
          void e;
        }
        reject(error);
      });
    });
  } catch (error) {
    try {
      await fsAsync.unlink(tmpPath);
    } catch (e) {
      void e;
    }
    throw new Error((error as Error).message, { cause: error });
  }
});

ipcMain.handle(CH.KUBECTL_GET_DIRECTORY_TREE, async (_event, namespace: string, pod: string, container: string | null, dirPath: string) => {
  try {
    const containerArgs = buildContainerArgs(container);
    const escapedPath = escapeShellArg(dirPath);
    const command = `find ${escapedPath} -type f 2>/dev/null | head -1000`;
    const args = ['exec', '-n', namespace, pod, ...containerArgs, '--', 'sh', '-c', command];
    const { stdout } = await execAsync(`kubectl ${args.map(a => escapeShellArg(a)).join(' ')}`, { timeout: 30000 });
    return stdout.trim().split('\n').filter((line: string) => line.trim());
  } catch (error) {
    throw new Error((error as Error).message, { cause: error });
  }
});

ipcMain.handle(CH.KUBECTL_SEARCH_FILES, async (_event, namespace: string, pod: string, container: string | null, dirPath: string, pattern: string) => {
  try {
    const containerArgs = buildContainerArgs(container);
    const escapedPath = escapeShellArg(dirPath);
    // 移除 pattern 中可能干扰 find -name 的通配符和引号，再由外层 escapeShellArg 统一转义
    const safePattern = pattern.replace(/[*?"'\\[\]]/g, '');
    const command = `find ${escapedPath} -type f -name "*${safePattern}*" 2>/dev/null | head -100`;
    const args = ['exec', '-n', namespace, pod, ...containerArgs, '--', 'sh', '-c', command];
    const { stdout } = await execAsync(`kubectl ${args.map(a => escapeShellArg(a)).join(' ')}`, { timeout: 30000 });
    return stdout.trim().split('\n').filter((line: string) => line.trim());
  } catch (error) {
    throw new Error((error as Error).message, { cause: error });
  }
});

ipcMain.handle(CH.KUBECTL_GET_CONTEXTS, async () => {
  try {
    const { stdout } = await execAsync('kubectl config get-contexts -o name', { timeout: 15000 });
    const contexts = stdout.trim().split('\n').filter((c: string) => c.trim());

    const contextsWithInfo = await Promise.all(contexts.map(async (name: string) => {
      try {
        const escapedName = escapeShellArg(name);
        const { stdout: current } = await execAsync(`kubectl config view -o jsonpath='{.contexts[?(@.name==${escapedName})].context.cluster}'`, { timeout: 15000 });
        return { name, cluster: current.replace(/'/g, '').trim() };
      } catch {
        return { name, cluster: name };
      }
    }));

    const { stdout: currentContext } = await execAsync('kubectl config current-context', { timeout: 15000 });
    return { contexts: contextsWithInfo, currentContext: currentContext.trim() };
  } catch (error) {
    throw new Error((error as Error).message, { cause: error });
  }
});

ipcMain.handle(CH.KUBECTL_USE_CONTEXT, async (_event, contextName: string) => {
  assertNonEmptyString(contextName, 'contextName');
  try {
    const escapedName = escapeShellArg(contextName);
    await execAsync(`kubectl config use-context ${escapedName}`, { timeout: 15000 });
    return { success: true, context: contextName };
  } catch (error) {
    throw new Error((error as Error).message, { cause: error });
  }
});

ipcMain.handle(CH.KUBECTL_EXEC_COMMAND, async (event: IpcMainInvokeEvent, namespace: string, pod: string, container: string | null, command: string) => {
  assertNonEmptyString(namespace, 'namespace');
  assertNonEmptyString(pod, 'pod');
  assertNonEmptyString(command, 'command');
  return new Promise<{ output: string; stderr: string; exitCode: number | null }>((resolve, reject) => {
    const containerArgs = buildContainerArgs(container);
    const args = ['exec', '-n', namespace, pod, ...containerArgs, '--', 'sh', '-c', command];
    const childProcess = spawn('kubectl', args);
    let output = '';
    let stderrOutput = '';

    const timer = setTimeout(() => {
      childProcess.kill('SIGTERM');
      resolve({ output, stderr: stderrOutput + '\n[命令超时，已终止]', exitCode: null });
    }, EXEC_COMMAND_TIMEOUT_MS);

    childProcess.stdout!.on('data', (data: Buffer) => {
      const chunk = data.toString();
      output += chunk;
      event.sender.send(CH.TERMINAL_OUTPUT, { output: chunk, type: 'stdout' });
    });

    childProcess.stderr!.on('data', (data: Buffer) => {
      const chunk = data.toString();
      stderrOutput += chunk;
      event.sender.send(CH.TERMINAL_OUTPUT, { output: chunk, type: 'stderr' });
    });

    childProcess.on('close', (code: number | null) => {
      clearTimeout(timer);
      resolve({ output, stderr: stderrOutput, exitCode: code });
    });

    childProcess.on('error', (error: Error) => {
      clearTimeout(timer);
      reject(error);
    });
  });
});

ipcMain.handle(CH.DOCKER_SEARCH_FILES, async (_event, imageName: string, dirPath: string, pattern: string) => {
  try {
    const escapedImage = escapeShellArg(imageName);
    const escapedPath = escapeShellArg(dirPath);
    const safePattern = pattern.replace(/[*?"'\\[\]]/g, '');
    const command = `find ${escapedPath} -type f -name "*${safePattern}*" 2>/dev/null | head -100`;
    const { stdout } = await execAsync(`docker run --rm --entrypoint sh ${escapedImage} -c ${escapeShellArg(command)}`, { timeout: 30000 });
    return stdout.trim().split('\n').filter((line: string) => line.trim());
  } catch (error) {
    throw new Error((error as Error).message, { cause: error });
  }
});

ipcMain.handle(CH.DOCKER_EXEC_COMMAND, async (event: IpcMainInvokeEvent, imageName: string, command: string) => {
  assertNonEmptyString(imageName, 'imageName');
  assertNonEmptyString(command, 'command');
  return new Promise<{ output: string; stderr: string; exitCode: number | null }>((resolve, reject) => {
    const childProcess = spawn('docker', ['run', '--rm', '--entrypoint', 'sh', imageName, '-c', command]);
    let output = '';
    let stderrOutput = '';

    const timer = setTimeout(() => {
      childProcess.kill('SIGTERM');
      resolve({ output, stderr: stderrOutput + '\n[命令超时，已终止]', exitCode: null });
    }, EXEC_COMMAND_TIMEOUT_MS);

    childProcess.stdout!.on('data', (data: Buffer) => {
      const chunk = data.toString();
      output += chunk;
      event.sender.send(CH.TERMINAL_OUTPUT, { output: chunk, type: 'stdout' });
    });

    childProcess.stderr!.on('data', (data: Buffer) => {
      const chunk = data.toString();
      stderrOutput += chunk;
      event.sender.send(CH.TERMINAL_OUTPUT, { output: chunk, type: 'stderr' });
    });

    childProcess.on('close', (code: number | null) => {
      clearTimeout(timer);
      resolve({ output, stderr: stderrOutput, exitCode: code });
    });

    childProcess.on('error', (error: Error) => {
      clearTimeout(timer);
      reject(error);
    });
  });
});

ipcMain.handle(CH.KUBECTL_BATCH_DOWNLOAD, async (event: IpcMainInvokeEvent, namespace: string, pod: string, container: string | null, filePaths: string[], _downloadDir: string) => {
  if (!filePaths || filePaths.length === 0) {
    throw new Error('未选择文件');
  }

  if (!mainWindow) throw new Error('窗口未就绪');
  const { canceled, filePaths: chosenDirs } = await dialog.showOpenDialog(mainWindow, {
    title: '选择批量下载保存目录',
    buttonLabel: '保存到此处',
    properties: ['openDirectory', 'createDirectory']
  });
  if (canceled || chosenDirs.length === 0) {
    return null;
  }
  const downloadDir = chosenDirs[0];

  // podTarPath：Pod 内的临时 tar 路径；localTarPath：kubectl cp 下载到本地的目标
  const podTarPath = `/tmp/podfile_batch_${Date.now()}_${Math.random().toString(36).substring(2, 10)}.tar`;
  const localTarPath = path.join(downloadDir, `download_${Date.now()}.tar`);
  const containerArgs = buildContainerArgs(container);

  // 封装：清理 Pod 内 tar（fire-and-forget 但捕获错误）
  const cleanupRemoteTar = (): void => {
    if (!podTarPath) return;
    const cleanArgs = ['exec', '-n', namespace, pod, ...containerArgs, '--', 'rm', '-f', podTarPath];
    execAsync(`kubectl ${cleanArgs.map(a => escapeShellArg(a)).join(' ')}`).catch(() => { /* ignore */ });
  };
  // 封装：清理本地 tar
  const cleanupLocalTar = async (): Promise<void> => {
    try {
      await fsAsync.unlink(localTarPath);
    } catch (e) {
      void e;
    }
  };

  try {
    const filesToDownload = filePaths.map((f: string) => escapeShellArg(f)).join(' ');
    const tarCommand = `tar cf ${escapeShellArg(podTarPath)} -C / ${filesToDownload} 2>/dev/null || echo "partial"`;

    event.sender.send(CH.TRANSFER_PROGRESS, {
      status: 'downloading',
      transferred: 0,
      total: 0,
      percent: 0,
      speed: '创建打包文件...'
    });

    const execArgs = ['exec', '-n', namespace, pod, ...containerArgs, '--', 'sh', '-c', tarCommand];
    await execAsync(`kubectl ${execArgs.map(a => escapeShellArg(a)).join(' ')}`, { timeout: 60000 });

    return new Promise<{ success: boolean; path: string; type: string }>((resolve, reject) => {
      const cpArgs = buildKubectlCpArgs(namespace, `${pod}:${podTarPath}`, localTarPath, container);
      const childProcess = spawn('kubectl', cpArgs);

      childProcess.on('close', (code: number | null) => {
        // 无论如何都先清理 Pod 内临时 tar
        cleanupRemoteTar();

        if (code === 0) {
          event.sender.send(CH.TRANSFER_PROGRESS, {
            status: 'completed',
            transferred: 1,
            total: 1,
            percent: 100,
            speed: '打包下载完成'
          });
          resolve({ success: true, path: localTarPath, type: 'tar' });
        } else {
          // 失败时清理可能部分写入的本地文件
          cleanupLocalTar();
          event.sender.send(CH.TRANSFER_PROGRESS, {
            status: 'error',
            transferred: 0,
            total: 0,
            message: '批量下载失败'
          });
          reject(new Error('批量下载失败'));
        }
      });

      childProcess.on('error', (error: Error) => {
        cleanupRemoteTar();
        cleanupLocalTar();
        reject(error);
      });
    });
  } catch (error) {
    cleanupRemoteTar();
    await cleanupLocalTar();
    throw new Error((error as Error).message, { cause: error });
  }
});

ipcMain.handle(CH.DOCKER_WRITE_FILE, async (_event, imageName: string, filePath: string, content: string) => {
  let containerId: string | null;
  const tmpPath = createTempPath('dockerfile_edit');

  try {
    const cleanPath = filePath.endsWith('/') ? filePath.slice(0, -1) : filePath;

    await fsAsync.writeFile(tmpPath, content, 'utf8');

    const escapedImage = escapeShellArg(imageName);
    const escapedCleanPath = escapeShellArg(cleanPath);

    const shellTestCmd = `docker run --rm --entrypoint test ${escapedImage} -e /bin/sh`;
    try {
      await execAsync(shellTestCmd, { timeout: 15000 });
    } catch {
      try {
        await fsAsync.unlink(tmpPath);
      } catch (e) {
        void e;
      }
      throw new Error(`镜像 ${imageName} 不支持 /bin/sh，无法编辑文件`);
    }

    const createCmd = `docker create --entrypoint /bin/sh ${escapedImage} -c "echo initialized"`;
    const { stdout: createOutput } = await execAsync(createCmd, { timeout: 30000 });
    containerId = createOutput.trim();

    if (!/^[0-9a-f]{64}$/i.test(containerId)) {
      throw new Error('创建容器失败: 无效的容器 ID');
    }

    let committed = false;
    try {
      await execAsync(`docker cp ${escapeShellArg(tmpPath)} ${containerId}:${escapedCleanPath}`, { timeout: 30000 });
      const commitCmd = `docker commit ${containerId} ${escapedImage}`;
      await execAsync(commitCmd, { timeout: 60000 });
      committed = true;
    } finally {
      if (containerId) {
        try {
          await execAsync(`docker rm -f ${containerId}`, { timeout: 15000 });
        } catch (e) {
          void e;
        }
      }
    }

    if (!committed) {
      throw new Error('写入 Docker 镜像文件失败：文件复制或提交失败');
    }

    try {
      await fsAsync.unlink(tmpPath);
    } catch (e) {
      void e;
    }

    return { success: true, path: filePath };
  } catch (error) {
    try {
      await fsAsync.unlink(tmpPath);
    } catch (e) {
      void e;
    }
    throw new Error('写入 Docker 镜像文件失败: ' + (error as Error).message, { cause: error });
  }
});

ipcMain.handle(CH.DOCKER_GET_DIRECTORY_TREE, async (_event, imageName: string, dirPath: string) => {
  try {
    const escapedImage = escapeShellArg(imageName);
    const escapedPath = escapeShellArg(dirPath);
    const command = `find ${escapedPath} -type f 2>/dev/null | head -1000`;
    const { stdout } = await execAsync(`docker run --rm --entrypoint sh ${escapedImage} -c ${escapeShellArg(command)}`, { timeout: 30000 });
    return stdout.trim().split('\n').filter((line: string) => line.trim());
  } catch (error) {
    throw new Error((error as Error).message, { cause: error });
  }
});

ipcMain.handle(CH.DOCKER_BATCH_DOWNLOAD, async (event: IpcMainInvokeEvent, imageName: string, filePaths: string[], _downloadDir: string) => {
  if (!filePaths || filePaths.length === 0) {
    throw new Error('未选择文件');
  }

  if (!mainWindow) throw new Error('窗口未就绪');
  const { canceled, filePaths: chosenDirs } = await dialog.showOpenDialog(mainWindow, {
    title: '选择批量下载保存目录',
    buttonLabel: '保存到此处',
    properties: ['openDirectory', 'createDirectory']
  });
  if (canceled || chosenDirs.length === 0) {
    return null;
  }
  const downloadDir = chosenDirs[0];

  let containerId: string | null = null;
  const containerTarPath = `/tmp/dockerfile_batch_${Date.now()}_${Math.random().toString(36).substring(2, 10)}.tar`;

  try {
    const filesToDownload = filePaths.map((f: string) => escapeShellArg(f)).join(' ');
    const tarCommand = `tar cf ${escapeShellArg(containerTarPath)} -C / ${filesToDownload} 2>/dev/null || echo "partial"`;

    event.sender.send(CH.TRANSFER_PROGRESS, {
      status: 'downloading',
      transferred: 0,
      total: 0,
      percent: 0,
      speed: '创建打包文件...'
    });

    const escapedImage = escapeShellArg(imageName);
    const createCmd = `docker create --entrypoint sh ${escapedImage} -c ${escapeShellArg(tarCommand)}`;
    const { stdout: createOutput } = await execAsync(createCmd, { timeout: 30000 });
    containerId = createOutput.trim();

    if (!/^[0-9a-f]{64}$/i.test(containerId)) {
      throw new Error('创建容器失败: 无效的容器 ID');
    }

    const containerTimeout = setTimeout(async () => {
      if (containerId) {
        try {
          await execAsync(`docker rm -f ${containerId}`, { timeout: 5000 });
        } catch (e) {
          void e;
        }
      }
    }, 120000);

    try {
      await execAsync(`docker start -a ${containerId}`, { timeout: 60000 });
    } finally {
      clearTimeout(containerTimeout);
    }

    const localTarPath = path.join(downloadDir, `docker_download_${Date.now()}.tar`);

    return new Promise<{ success: boolean; path: string; type: string }>((resolve, reject) => {
      const childProcess = spawn('docker', ['cp', `${containerId}:${containerTarPath}`, localTarPath]);

      childProcess.on('close', async (code: number | null) => {
        if (containerId) {
          try {
            await execAsync(`docker rm -f ${containerId}`, { timeout: 15000 });
          } catch (e) {
            void e;
          }
          containerId = null;
        }

        if (code === 0) {
          event.sender.send(CH.TRANSFER_PROGRESS, {
            status: 'completed',
            transferred: 1,
            total: 1,
            percent: 100,
            speed: '打包下载完成'
          });
          resolve({ success: true, path: localTarPath, type: 'tar' });
        } else {
          event.sender.send(CH.TRANSFER_PROGRESS, {
            status: 'error',
            transferred: 0,
            total: 0,
            message: '批量下载失败'
          });
          reject(new Error('批量下载失败'));
        }
      });

      childProcess.on('error', async (error: Error) => {
        if (containerId) {
          try {
            await execAsync(`docker rm -f ${containerId}`, { timeout: 15000 });
          } catch (e) {
            void e;
          }
          containerId = null;
        }
        reject(error);
      });
    });
  } catch (error) {
    if (containerId) {
      try {
        await execAsync(`docker rm -f ${containerId}`, { timeout: 15000 });
      } catch (e) {
        void e;
      }
    }
    throw new Error((error as Error).message, { cause: error });
  }
});
