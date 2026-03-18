import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import multer from 'multer';
import fs from 'fs';
import { exec } from 'child_process';
import axios from 'axios';
import JSZip from 'jszip';
import cors from 'cors';

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

const upload = multer({ dest: 'uploads/' });

const APKTOOL_URL = 'https://bitbucket.org/iBotPeaches/apktool/downloads/apktool_3.0.1.jar';
const APKTOOL_PATH = path.join(process.cwd(), 'apktool_3.0.1.jar');

async function downloadApktool() {
  if (fs.existsSync(APKTOOL_PATH)) return;
  console.log('Downloading apktool...');
  const response = await axios({
    url: APKTOOL_URL,
    method: 'GET',
    responseType: 'stream',
  });
  const writer = fs.createWriteStream(APKTOOL_PATH);
  response.data.pipe(writer);
  return new Promise<void>((resolve, reject) => {
    writer.on('finish', () => resolve());
    writer.on('error', reject);
  });
}

async function addFolderToZip(zip: JSZip, folderPath: string, zipPath: string) {
  const files = fs.readdirSync(folderPath);
  for (const file of files) {
    const fullPath = path.join(folderPath, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      const newZipFolder = zip.folder(path.join(zipPath, file));
      if (newZipFolder) {
        await addFolderToZip(newZipFolder, fullPath, path.join(zipPath, file));
      }
    } else {
      zip.file(path.join(zipPath, file), fs.readFileSync(fullPath));
    }
  }
}

app.post('/api/decode', upload.single('apk'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No APK file provided' });
    }

    await downloadApktool();

    const apkPath = req.file.path;
    const outputDir = path.join('uploads', `decoded_${req.file.filename}`);

    // Execute apktool
    exec(`java -jar ${APKTOOL_PATH} d ${apkPath} -o ${outputDir} -f`, async (error, stdout, stderr) => {
      if (error) {
        console.error('Apktool error:', error);
        console.error('Stderr:', stderr);
        
        // Clean up
        if (fs.existsSync(apkPath)) fs.unlinkSync(apkPath);
        
        if (stderr.includes('java: not found') || error.message.includes('java: not found')) {
          return res.status(500).json({ error: 'Java is not installed on the server. Cannot run apktool.jar.' });
        }
        return res.status(500).json({ error: 'Failed to decode APK', details: stderr });
      }

      try {
        // Zip the decoded folder
        const zip = new JSZip();
        await addFolderToZip(zip, outputDir, '');
        const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });

        // Clean up
        if (fs.existsSync(apkPath)) fs.unlinkSync(apkPath);
        fs.rmSync(outputDir, { recursive: true, force: true });

        res.setHeader('Content-Type', 'application/zip');
        res.setHeader('Content-Disposition', `attachment; filename="decoded.zip"`);
        res.send(zipBuffer);
      } catch (zipError) {
        console.error('Zip error:', zipError);
        res.status(500).json({ error: 'Failed to zip decoded files' });
      }
    });
  } catch (err: any) {
    console.error('Server error:', err);
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
