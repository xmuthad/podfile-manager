const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const { exec, spawn } = require('child_process');
const { promisify } = require('util');
const path = require('path');
const fs = require('fs');
const os = require('os');

const execAsync = promisify(exec);
const fsAsync = fs.promises;

function escapeShellArg(arg) {
  return "'" + String(arg).replace(/'/g, "'\\''") + "'";
}

function buildContainerArgs(container) {
  return container ? ['-c', container] : [];
}

function buildKubectlCpArgs(namespace, src, dst, container) {
  const args = ['cp', '-n', namespace, src, dst];
  if (container) {
    args.push('-c', container);
  }
  return args;
}

function getDockerError(errMsg, filePath, imageName) {
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

function createTempPath(prefix) {
  const tmpDir = os.tmpdir();
  const random = Math.random().toString(36).substring(2, 10);
  return path.join(tmpDir, `${prefix}_${Date.now()}_${random}`);
}

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      preload: path.join(__dirname, 'preload.cjs')
    }
  });

  mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
}

app.whenReady().then(createWindow);

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

ipcMain.handle('kubectl:get-namespaces', async () => {
  try {
    const { stdout } = await execAsync('kubectl get namespaces -o json', { timeout: 30000 });
    return JSON.parse(stdout);
  } catch (error) {
    throw new Error(error.message);
  }
});

ipcMain.handle('docker:read-file', async (event, imageName, filePath) => {
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

    return stdout || stderr;
  } catch (error) {
    const errMsg = error.message || '';
    if (errMsg.includes('No such file or directory') || errMsg.includes('cannot find')) {
      throw new Error(`文件 "${filePath}" 不存在`);
    }
    if (errMsg.includes('cannot execute') || errMsg.includes('not found') || errMsg.includes('executable')) {
      throw new Error(`镜像 ${imageName} 无法执行命令，可能是精简镜像没有 shell`);
    }
    throw new Error('读取文件失败: ' + errMsg);
  }
});

ipcMain.handle('kubectl:get-pods', async (_, namespace) => {
  try {
    const { stdout } = await execAsync(`kubectl get pods -n ${escapeShellArg(namespace)} -o json`, { timeout: 30000 });
    return JSON.parse(stdout);
  } catch (error) {
    throw new Error(error.message);
  }
});

ipcMain.handle('kubectl:list-files', async (_, namespace, pod, container, dirPath) => {
  try {
    const containerArgs = buildContainerArgs(container);
    const args = ['exec', '-n', namespace, pod, ...containerArgs, '--', 'ls', '-la', dirPath];
    const { stdout } = await execAsync(`kubectl ${args.map(a => escapeShellArg(a)).join(' ')}`, { timeout: 30000 });
    return stdout;
  } catch (error) {
    throw new Error(error.message);
  }
});

ipcMain.handle('kubectl:get-containers', async (_, namespace, pod) => {
  try {
    const { stdout } = await execAsync(`kubectl get pod ${escapeShellArg(pod)} -n ${escapeShellArg(namespace)} -o json`, { timeout: 30000 });
    const podData = JSON.parse(stdout);
    const containers = podData.spec.containers.map(container => ({
      name: container.name.trim(),
      image: container.image.trim(),
      ready: false,
      restartCount: 0,
      state: { waiting: { reason: 'ContainerStarting', message: 'Starting' } }
    }));

    if (podData.status && podData.status.containerStatuses) {
      podData.status.containerStatuses.forEach(status => {
        const container = containers.find(c => c.name === status.name);
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
    throw new Error(error.message);
  }
});

ipcMain.handle('kubectl:download-file-with-limit', async (event, namespace, pod, container, remotePath, limitSpeed) => {
  const remoteFileName = path.basename(remotePath);

  const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
    defaultPath: remoteFileName,
    properties: ['showOverwriteConfirmation']
  });

  if (canceled || !filePath) {
    return null;
  }

  try {
    event.sender.send('transfer-progress', {
      status: 'downloading',
      transferred: 0,
      total: 0,
      percent: 0,
      speed: `限速 ${limitSpeed}KB/s`
    });

    const containerArgs = buildContainerArgs(container);
    const escapedPath = escapeShellArg(remotePath);
    const catCommand = `cat ${escapedPath}`;
    const childProcess = spawn('kubectl', [
      'exec', '-n', namespace, pod, ...containerArgs, '--',
      'sh', '-c', catCommand
    ]);

    const writeStream = fs.createWriteStream(filePath);
    let transferred = 0;
    const bytesPerSecond = limitSpeed * 1024;
    let stderrOutput = '';
    let processFinished = false;
    let lastChunkTime = Date.now();

    const writeQueue = [];
    let writing = false;

    async function processQueue() {
      if (writing || writeQueue.length === 0) return;
      writing = true;

      while (writeQueue.length > 0) {
        const data = writeQueue.shift();
        const now = Date.now();
        const elapsed = (now - lastChunkTime) / 1000;
        const expectedBytes = bytesPerSecond * elapsed;
        const delay = expectedBytes > 0 ? Math.max(0, (data.length / expectedBytes) * 1000) : 0;

        if (delay > 0) {
          await new Promise(resolve => setTimeout(resolve, Math.min(delay, 100)));
        }

        transferred += data.length;
        lastChunkTime = Date.now();

        const speed = bytesPerSecond / 1024;
        event.sender.send('transfer-progress', {
          status: 'downloading',
          transferred,
          total: 0,
          percent: 0,
          speed: `${speed.toFixed(2)}KB/s`
        });

        if (!writeStream.destroyed) {
          writeStream.write(data);
        }
      }

      writing = false;
    }

    childProcess.stdout.on('data', (data) => {
      writeQueue.push(data);
      processQueue();
    });

    childProcess.stderr.on('data', (data) => {
      stderrOutput += data.toString();
    });

    childProcess.on('close', async (code) => {
      if (processFinished) return;
      processFinished = true;

      writeStream.end();

      if (code === 0) {
        let finalSize = transferred;
        try {
          const stats = await fsAsync.stat(filePath);
          finalSize = stats.size;
        } catch (err) {}
        event.sender.send('transfer-progress', {
          status: 'completed',
          transferred: finalSize,
          total: finalSize,
          percent: 100,
          speed: `${limitSpeed}KB/s (limited)`
        });
      } else {
        event.sender.send('transfer-progress', {
          status: 'error',
          transferred: 0,
          total: 0,
          message: '限速下载失败: ' + (stderrOutput || '退出码 ' + code)
        });
      }
    });

    childProcess.on('error', (error) => {
      if (processFinished) return;
      processFinished = true;

      writeStream.end();
      event.sender.send('transfer-progress', {
        status: 'error',
        transferred: 0,
        total: 0,
        message: '限速下载失败: ' + error.message
      });
    });

  } catch (error) {
    throw new Error(error.message);
  }
});

ipcMain.handle('kubectl:download-file', async (event, namespace, pod, container, remotePath) => {
  try {
    const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
      defaultPath: path.basename(remotePath),
      properties: ['showOverwriteConfirmation']
    });

    if (canceled || !filePath) {
      return null;
    }

    return new Promise((resolve, reject) => {
      let transferred = 0;
      const startTime = Date.now();
      let stderrOutput = '';

      const cpArgs = buildKubectlCpArgs(namespace, `${pod}:${remotePath}`, filePath, container);
      const childProcess = spawn('kubectl', cpArgs);

      childProcess.on('close', async (code) => {
        if (code === 0) {
          let finalSize = transferred;
          try {
            const stats = await fsAsync.stat(filePath);
            finalSize = stats.size;
          } catch (err) {}
          event.sender.send('transfer-progress', {
            status: 'completed',
            transferred: finalSize,
            total: finalSize,
            percent: 100
          });
          resolve(filePath);
        } else {
          event.sender.send('transfer-progress', {
            status: 'error',
            transferred: 0,
            total: 0,
            message: '下载失败: ' + (stderrOutput || '退出码 ' + code)
          });
          reject(new Error('下载失败: ' + (stderrOutput || '退出码 ' + code)));
        }
      });

      childProcess.on('error', (error) => {
        event.sender.send('transfer-progress', {
          status: 'error',
          transferred: 0,
          total: 0,
          message: 'Kubectl 错误: ' + error.message
        });
        reject(error);
      });

      childProcess.stderr.on('data', (data) => {
        stderrOutput += data.toString();
      });

      let lastUpdate = startTime;

      childProcess.stdout.on('data', (data) => {
        const now = Date.now();
        transferred += data.length;

        if (now - lastUpdate > 100) {
          const elapsed = (now - startTime) / 1000;
          const speed = elapsed > 0 ? (transferred / elapsed / 1024).toFixed(2) : 0;

          event.sender.send('transfer-progress', {
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
    throw new Error(error.message);
  }
});

ipcMain.handle('kubectl:upload-file', async (event, namespace, pod, container, remotePath) => {
  try {
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
    } catch (err) {}

    return new Promise((resolve, reject) => {
      let transferred = 0;
      const cpArgs = buildKubectlCpArgs(namespace, localPath, `${pod}:${remotePath}`, container);
      const childProcess = spawn('kubectl', cpArgs);

      childProcess.on('close', (code) => {
        if (code === 0) {
          event.sender.send('transfer-progress', { status: 'completed', transferred: totalSize, total: totalSize });
          resolve(localPath);
        } else {
          event.sender.send('transfer-progress', { status: 'error', message: '上传失败' });
          reject(new Error('上传失败'));
        }
      });

      childProcess.on('error', (error) => {
        event.sender.send('transfer-progress', { status: 'error', message: error.message });
        reject(error);
      });

      const startTime = Date.now();
      let lastUpdate = startTime;

      childProcess.stderr.on('data', (data) => {
        const now = Date.now();
        const output = data.toString();
        const sizeMatch = output.match(/(\d+)/);
        if (sizeMatch) {
          transferred = parseInt(sizeMatch[1]);
        }
        const elapsed = (now - startTime) / 1000;
        if (elapsed > 0) {
          const speed = (transferred / elapsed).toFixed(2);
          const percent = totalSize > 0 ? Math.round((transferred / totalSize) * 100) : 0;

          if (now - lastUpdate > 100) {
            event.sender.send('transfer-progress', {
              status: 'uploading',
              transferred,
              total: totalSize,
              percent,
              speed: `${speed} B/s`
            });
            lastUpdate = now;
          }
        }
      });
    });
  } catch (error) {
    throw new Error(error.message);
  }
});

ipcMain.handle('kubectl:read-file', async (_, namespace, pod, container, remotePath) => {
  try {
    const containerArgs = buildContainerArgs(container);
    const args = ['exec', '-n', namespace, pod, ...containerArgs, '--', 'cat', remotePath];
    const { stdout } = await execAsync(`kubectl ${args.map(a => escapeShellArg(a)).join(' ')}`, { timeout: 30000, maxBuffer: 10 * 1024 * 1024 });
    return stdout;
  } catch (error) {
    throw new Error(error.message);
  }
});

ipcMain.handle('docker:list-images', async () => {
  try {
    const { stdout } = await execAsync(`docker images --format '{{.Repository}}:{{.Tag}}|{{.ID}}|{{.Size}}'`, { timeout: 30000 });
    const images = stdout.trim().split('\n').filter(line => line.trim())
      .map(line => {
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
    throw new Error('获取 Docker 镜像列表失败: ' + error.message);
  }
});

ipcMain.handle('docker:list-files', async (_, imageName, dirPath) => {
  try {
    const cleanPath = dirPath.endsWith('/') ? dirPath.slice(0, -1) : dirPath;
    const escapedImage = escapeShellArg(imageName);
    const escapedPath = escapeShellArg(cleanPath);
    const command = `docker run --rm --entrypoint ls ${escapedImage} -la ${escapedPath}`;
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
    const errMsg = error.message || '';
    if (errMsg.includes('No such file or directory') || errMsg.includes('cannot find')) {
      throw new Error(`路径 "${dirPath}" 不存在`);
    }
    if (errMsg.includes('cannot execute') || errMsg.includes('not found') || errMsg.includes('executable')) {
      throw new Error(`镜像 ${imageName} 无法执行命令，可能是精简镜像没有 shell`);
    }
    throw new Error('列出文件失败: ' + errMsg);
  }
});

ipcMain.handle('docker:download-file', async (event, imageName, filePath) => {
  const baseName = path.basename(filePath);

  const { canceled, filePath: savePath } = await dialog.showSaveDialog(mainWindow, {
    defaultPath: baseName,
    title: '保存 Docker 镜像文件',
    properties: ['showOverwriteConfirmation']
  });

  if (canceled || !savePath) {
    return null;
  }

  try {
    event.sender.send('transfer-progress', {
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

    return new Promise((resolve, reject) => {
      const childProcess = spawn('sh', ['-c', command]);
      const writeStream = fs.createWriteStream(savePath);
      let transferred = 0;
      let stderrOutput = '';
      let processFinished = false;
      const startTime = Date.now();

      const cleanup = () => {
        if (!writeStream.destroyed) {
          writeStream.destroy();
        }
        if (!childProcess.killed) {
          childProcess.kill();
        }
      };

      childProcess.stdout.on('data', (data) => {
        transferred += data.length;
        const elapsed = (Date.now() - startTime) / 1000;
        const speed = elapsed > 0 ? (transferred / elapsed / 1024).toFixed(2) : '0.00';
        event.sender.send('transfer-progress', {
          status: 'downloading',
          transferred,
          total: 0,
          percent: 0,
          speed: `${speed} KB/s`
        });
        writeStream.write(data);
      });

      childProcess.stderr.on('data', (data) => {
        if (stderrOutput.length < 4096) {
          stderrOutput += data.toString();
        }
      });

      childProcess.on('close', async (code) => {
        if (processFinished) return;
        processFinished = true;

        cleanup();

        if (code === 0) {
          let finalSize = transferred;
          try {
            const stats = await fsAsync.stat(savePath);
            finalSize = stats.size;
          } catch (err) {}

          if (finalSize > 500 * 1024 * 1024) {
            event.sender.send('transfer-progress', {
              status: 'error',
              transferred: 0,
              total: 0,
              message: '文件超过 500MB 限制'
            });
            reject(new Error('文件超过 500MB 限制'));
            return;
          }

          event.sender.send('transfer-progress', {
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
          event.sender.send('transfer-progress', {
            status: 'error',
            transferred: 0,
            total: 0,
            message: errorInfo.message
          });
          reject(new Error(errorInfo.error));
        }
      });

      childProcess.on('error', (error) => {
        if (processFinished) return;
        processFinished = true;

        cleanup();
        event.sender.send('transfer-progress', {
          status: 'error',
          transferred: 0,
          total: 0,
          message: 'Docker 错误: ' + error.message
        });
        reject(error);
      });
    });
  } catch (error) {
    throw new Error(error.message);
  }
});

ipcMain.handle('kubectl:write-file', async (event, namespace, pod, container, remotePath, content) => {
  const tmpPath = createTempPath('podfile_edit');

  try {
    await fsAsync.writeFile(tmpPath, content, 'utf8');

    const args = ['cp', '-n', namespace, tmpPath, `${pod}:${remotePath}`];
    if (container) {
      args.push('-c', container);
    }
    const childProcess = spawn('kubectl', args);

    return new Promise((resolve, reject) => {
      childProcess.on('close', async (code) => {
        try {
          await fsAsync.unlink(tmpPath);
        } catch (e) {}

        if (code === 0) {
          resolve({ success: true, path: remotePath });
        } else {
          reject(new Error('写入文件失败'));
        }
      });

      childProcess.on('error', async (error) => {
        try {
          await fsAsync.unlink(tmpPath);
        } catch (e) {}
        reject(error);
      });
    });
  } catch (error) {
    try {
      await fsAsync.unlink(tmpPath);
    } catch (e) {}
    throw new Error(error.message);
  }
});

ipcMain.handle('kubectl:get-directory-tree', async (_, namespace, pod, container, dirPath) => {
  try {
    const containerArgs = buildContainerArgs(container);
    const escapedPath = escapeShellArg(dirPath);
    const command = `find ${escapedPath} -type f 2>/dev/null | head -1000`;
    const args = ['exec', '-n', namespace, pod, ...containerArgs, '--', 'sh', '-c', command];
    const { stdout } = await execAsync(`kubectl ${args.map(a => escapeShellArg(a)).join(' ')}`, { timeout: 30000 });
    return stdout.trim().split('\n').filter(line => line.trim());
  } catch (error) {
    throw new Error(error.message);
  }
});

ipcMain.handle('kubectl:search-files', async (_, namespace, pod, container, dirPath, pattern) => {
  try {
    const containerArgs = buildContainerArgs(container);
    const escapedPath = escapeShellArg(dirPath);
    const escapedPattern = escapeShellArg(pattern);
    const command = `find ${escapedPath} -type f -name "*${escapedPattern}*" 2>/dev/null | head -100`;
    const args = ['exec', '-n', namespace, pod, ...containerArgs, '--', 'sh', '-c', command];
    const { stdout } = await execAsync(`kubectl ${args.map(a => escapeShellArg(a)).join(' ')}`, { timeout: 30000 });
    return stdout.trim().split('\n').filter(line => line.trim());
  } catch (error) {
    throw new Error(error.message);
  }
});

ipcMain.handle('kubectl:get-contexts', async () => {
  try {
    const { stdout } = await execAsync('kubectl config get-contexts -o name', { timeout: 15000 });
    const contexts = stdout.trim().split('\n').filter(c => c.trim());

    const contextsWithInfo = await Promise.all(contexts.map(async (name) => {
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
    throw new Error(error.message);
  }
});

ipcMain.handle('kubectl:use-context', async (_, contextName) => {
  try {
    const escapedName = escapeShellArg(contextName);
    await execAsync(`kubectl config use-context ${escapedName}`, { timeout: 15000 });
    return { success: true, context: contextName };
  } catch (error) {
    throw new Error(error.message);
  }
});

ipcMain.handle('kubectl:exec-command', async (event, namespace, pod, container, command) => {
  return new Promise((resolve, reject) => {
    const containerArgs = buildContainerArgs(container);
    const args = ['exec', '-n', namespace, pod, ...containerArgs, '--', 'sh', '-c', command];
    const childProcess = spawn('kubectl', args);
    let output = '';
    let stderrOutput = '';

    childProcess.stdout.on('data', (data) => {
      const chunk = data.toString();
      output += chunk;
      event.sender.send('terminal-output', { output: chunk, type: 'stdout' });
    });

    childProcess.stderr.on('data', (data) => {
      const chunk = data.toString();
      stderrOutput += chunk;
      event.sender.send('terminal-output', { output: chunk, type: 'stderr' });
    });

    childProcess.on('close', (code) => {
      resolve({ output, stderr: stderrOutput, exitCode: code });
    });

    childProcess.on('error', (error) => {
      reject(error);
    });
  });
});

ipcMain.handle('docker:search-files', async (_, imageName, dirPath, pattern) => {
  try {
    const escapedImage = escapeShellArg(imageName);
    const escapedPath = escapeShellArg(dirPath);
    const escapedPattern = escapeShellArg(pattern);
    const command = `find ${escapedPath} -type f -name "*${escapedPattern}*" 2>/dev/null | head -100`;
    const { stdout } = await execAsync(`docker run --rm --entrypoint sh ${escapedImage} -c ${escapeShellArg(command)}`, { timeout: 30000 });
    return stdout.trim().split('\n').filter(line => line.trim());
  } catch (error) {
    throw new Error(error.message);
  }
});

ipcMain.handle('docker:exec-command', async (event, imageName, command) => {
  return new Promise((resolve, reject) => {
    const childProcess = spawn('docker', ['run', '--rm', '--entrypoint', 'sh', imageName, '-c', command]);
    let output = '';
    let stderrOutput = '';

    childProcess.stdout.on('data', (data) => {
      const chunk = data.toString();
      output += chunk;
      event.sender.send('terminal-output', { output: chunk, type: 'stdout' });
    });

    childProcess.stderr.on('data', (data) => {
      const chunk = data.toString();
      stderrOutput += chunk;
      event.sender.send('terminal-output', { output: chunk, type: 'stderr' });
    });

    childProcess.on('close', (code) => {
      resolve({ output, stderr: stderrOutput, exitCode: code });
    });

    childProcess.on('error', (error) => {
      reject(error);
    });
  });
});

ipcMain.handle('kubectl:batch-download', async (event, namespace, pod, container, filePaths, downloadDir) => {
  if (!filePaths || filePaths.length === 0) {
    throw new Error('未选择文件');
  }

  const tarPath = createTempPath('podfile_batch') + '.tar';

  try {
    const filesToDownload = filePaths.map(f => escapeShellArg(f)).join(' ');
    const tarCommand = `tar cf ${escapeShellArg(tarPath)} -C / ${filesToDownload} 2>/dev/null || echo "partial"`;

    event.sender.send('transfer-progress', {
      status: 'downloading',
      transferred: 0,
      total: 0,
      percent: 0,
      speed: '创建打包文件...'
    });

    const containerArgs = buildContainerArgs(container);
    const execArgs = ['exec', '-n', namespace, pod, ...containerArgs, '--', 'sh', '-c', tarCommand];
    await execAsync(`kubectl ${execArgs.map(a => escapeShellArg(a)).join(' ')}`, { timeout: 60000 });

    const localTarPath = path.join(downloadDir, `download_${Date.now()}.tar`);

    return new Promise((resolve, reject) => {
      const cpArgs = buildKubectlCpArgs(namespace, `${pod}:${tarPath}`, localTarPath, container);
      const childProcess = spawn('kubectl', cpArgs);

      childProcess.on('close', (code) => {
        const cleanArgs = ['exec', '-n', namespace, pod, ...containerArgs, '--', 'rm', '-f', tarPath];
        execAsync(`kubectl ${cleanArgs.map(a => escapeShellArg(a)).join(' ')}`).catch(() => {});

        if (code === 0) {
          event.sender.send('transfer-progress', {
            status: 'completed',
            transferred: 1,
            total: 1,
            percent: 100,
            speed: '打包下载完成'
          });
          resolve({ success: true, path: localTarPath, type: 'tar' });
        } else {
          event.sender.send('transfer-progress', {
            status: 'error',
            transferred: 0,
            total: 0,
            message: '批量下载失败'
          });
          reject(new Error('批量下载失败'));
        }
      });

      childProcess.on('error', (error) => {
        reject(error);
      });
    });
  } catch (error) {
    try {
      await fsAsync.unlink(tarPath);
    } catch (e) {}
    throw new Error(error.message);
  }
});

ipcMain.handle('docker:write-file', async (event, imageName, filePath, content) => {
  let containerId = null;
  const tmpPath = createTempPath('dockerfile_edit');

  try {
    const cleanPath = filePath.endsWith('/') ? filePath.slice(0, -1) : filePath;

    await fsAsync.writeFile(tmpPath, content, 'utf8');

    const escapedImage = escapeShellArg(imageName);
    const escapedCleanPath = escapeShellArg(cleanPath);

    const testCmd = `docker run --rm --entrypoint test ${escapedImage} -e -f /bin/sh`;
    try {
      await execAsync(testCmd, { timeout: 15000 });
    } catch (testErr) {
      try {
        await fsAsync.unlink(tmpPath);
      } catch (e) {}
      throw new Error(`镜像 ${imageName} 不支持 /bin/sh，无法编辑文件`);
    }

    const createCmd = `docker create --entrypoint /bin/sh ${escapedImage} -c "echo initialized"`;
    const { stdout: createOutput } = await execAsync(createCmd, { timeout: 30000 });
    containerId = createOutput.trim();

    if (!containerId || containerId.length < 12) {
      throw new Error('创建容器失败');
    }

    let committed = false;
    try {
      await execAsync(`docker cp ${escapeShellArg(tmpPath)} ${containerId}:${escapedCleanPath}`, { timeout: 30000 });
      const commitCmd = `docker commit ${containerId} ${escapedImage}`;
      await execAsync(commitCmd, { timeout: 60000 });
      committed = true;
    } finally {
      if (containerId) {
        const cleanupTimeout = setTimeout(() => {}, 15000);
        try {
          await execAsync(`docker rm -f ${containerId}`, { timeout: 15000 });
        } catch (e) {} finally {
          clearTimeout(cleanupTimeout);
        }
      }
    }

    if (!committed) {
      throw new Error('写入 Docker 镜像文件失败：文件复制或提交失败');
    }

    try {
      await fsAsync.unlink(tmpPath);
    } catch (e) {}

    return { success: true, path: filePath };
  } catch (error) {
    try {
      await fsAsync.unlink(tmpPath);
    } catch (e) {}
    throw new Error('写入 Docker 镜像文件失败: ' + error.message);
  }
});

ipcMain.handle('docker:get-directory-tree', async (_, imageName, dirPath) => {
  try {
    const escapedImage = escapeShellArg(imageName);
    const escapedPath = escapeShellArg(dirPath);
    const command = `find ${escapedPath} -type f 2>/dev/null | head -1000`;
    const { stdout } = await execAsync(`docker run --rm --entrypoint sh ${escapedImage} -c ${escapeShellArg(command)}`, { timeout: 30000 });
    return stdout.trim().split('\n').filter(line => line.trim());
  } catch (error) {
    throw new Error(error.message);
  }
});

ipcMain.handle('docker:batch-download', async (event, imageName, filePaths, downloadDir) => {
  if (!filePaths || filePaths.length === 0) {
    throw new Error('未选择文件');
  }

  let containerId = null;
  const tarPath = createTempPath('dockerfile_batch') + '.tar';
  const cleanupTimeout = setTimeout(() => {}, 0);

  try {
    const filesToDownload = filePaths.map(f => escapeShellArg(f)).join(' ');
    const tarCommand = `tar cf ${escapeShellArg(tarPath)} -C / ${filesToDownload} 2>/dev/null || echo "partial"`;

    event.sender.send('transfer-progress', {
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

    if (!containerId || containerId.length < 12) {
      throw new Error('创建容器失败');
    }

    clearTimeout(cleanupTimeout);
    const containerTimeout = setTimeout(async () => {
      if (containerId) {
        try {
          await execAsync(`docker rm -f ${containerId}`, { timeout: 5000 });
        } catch (e) {}
      }
    }, 120000);

    try {
      await execAsync(`docker start -a ${containerId}`, { timeout: 60000 });
    } finally {
      clearTimeout(containerTimeout);
    }

    const localTarPath = path.join(downloadDir, `docker_download_${Date.now()}.tar`);

    return new Promise((resolve, reject) => {
      const childProcess = spawn('docker', ['cp', `${containerId}:${tarPath}`, localTarPath]);

      childProcess.on('close', async (code) => {
        if (containerId) {
          const rmTimeout = setTimeout(() => {}, 0);
          try {
            await execAsync(`docker rm -f ${containerId}`, { timeout: 15000 });
          } catch (e) {} finally {
            clearTimeout(rmTimeout);
          }
          containerId = null;
        }

        try {
          await fsAsync.unlink(tarPath);
        } catch (e) {}

        if (code === 0) {
          event.sender.send('transfer-progress', {
            status: 'completed',
            transferred: 1,
            total: 1,
            percent: 100,
            speed: '打包下载完成'
          });
          resolve({ success: true, path: localTarPath, type: 'tar' });
        } else {
          event.sender.send('transfer-progress', {
            status: 'error',
            transferred: 0,
            total: 0,
            message: '批量下载失败'
          });
          reject(new Error('批量下载失败'));
        }
      });

      childProcess.on('error', async (error) => {
        if (containerId) {
          try {
            await execAsync(`docker rm -f ${containerId}`, { timeout: 15000 });
          } catch (e) {}
          containerId = null;
        }
        try {
          await fsAsync.unlink(tarPath);
        } catch (e) {}
        reject(error);
      });
    });
  } catch (error) {
    if (containerId) {
      try {
        await execAsync(`docker rm -f ${containerId}`, { timeout: 15000 });
      } catch (e) {}
    }
    try {
      await fsAsync.unlink(tarPath);
    } catch (e) {}
    throw new Error(error.message);
  }
});
