const express = require('express');
const multer = require('multer');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const app = express();
const upload = multer({ dest: 'uploads/' });

// Encryption function
const encryptFile = (filePath, destination) => {
  const algorithm = 'aes-256-cbc';
  const key = crypto.randomBytes(32);
  const iv = crypto.randomBytes(16);

  const cipher = crypto.createCipheriv(algorithm, key, iv);
  const input = fs.createReadStream(filePath);
  const output = fs.createWriteStream(destination);

  input.on('data', (chunk) => {
    console.log('Encrypting chunk:', chunk);
  });

  input.on('error', (err) => {
    console.error('Error reading input file:', err);
  });

  output.on('error', (err) => {
    console.error('Error writing output file:', err);
  });

  input.pipe(cipher).pipe(output).on('finish', () => {
    console.log('Encryption complete');
  });

  return { key, iv };
};

// Decryption function with callback
const decryptFile = (filePath, destination, key, iv, callback) => {
  const algorithm = 'aes-256-cbc';
  const decipher = crypto.createDecipheriv(algorithm, Buffer.from(key, 'hex'), Buffer.from(iv, 'hex'));

  const input = fs.createReadStream(filePath);
  const output = fs.createWriteStream(destination);

  input.on('data', (chunk) => {
    console.log('Decrypting chunk:', chunk);
  });

  input.on('error', (err) => {
    console.error('Error reading input file:', err);
  });

  output.on('error', (err) => {
    console.error('Error writing output file:', err);
  });

  input.pipe(decipher).pipe(output).on('finish', () => {
    console.log('Decryption complete');
    callback();
  });
};

// Endpoint to handle file upload and encryption
app.post('/upload', upload.single('file'), (req, res) => {
  const file = req.file;
  console.log(file);
  if (!file) {
    return res.status(400).json({ message: 'No file uploaded' });
  }

  const filePath = path.join(__dirname, file.path);
  const encryptedPath = path.join(__dirname, 'uploads', `${file.filename}.enc`);

  console.log('Original file path:', filePath);
  console.log('Encrypted file path:', encryptedPath);

  const { key, iv } = encryptFile(filePath, encryptedPath);

  // Delete the original file
  fs.unlinkSync(filePath);

  res.json({
    message: 'File uploaded and encrypted successfully!',
    fileId: file.filename,
    key: key.toString('hex'),
    iv: iv.toString('hex'),
  });
});

// Endpoint to decrypt and download the file
app.get('/decrypt/:fileId', (req, res) => {
  const { fileId } = req.params;
  const { key, iv } = req.query;
  const encryptedPath = path.join(__dirname, 'uploads', `${fileId}.enc`);
  const decryptedPath = path.join(__dirname, 'uploads', `${fileId}.dec`);

  console.log('Encrypted file path:', encryptedPath);
  console.log('Decrypted file path:', decryptedPath);

  decryptFile(encryptedPath, decryptedPath, key, iv, () => {
    res.download(decryptedPath, (err) => {
      if (err) {
        console.error('Error downloading the file:', err);
        return res.status(500).send('Error downloading the file');
      }
      // Clean up the decrypted file after sending it
      fs.unlinkSync(decryptedPath);
    });
  });
});

// Serve a basic form for file upload and decryption
app.get('/', (req, res) => {
  res.send(`
    <h1>Upload a File</h1>
    <form action="/upload" method="post" enctype="multipart/form-data">
      <input type="file" name="file" />
      <button type="submit">Upload</button>
    </form>
    <h1>Decrypt a File</h1>
    <form action="/decrypt/test" method="get">
      <input type="text" name="key" placeholder="Encryption Key" required/>
      <input type="text" name="iv" placeholder="Initialization Vector" required/>
      <button type="submit">Decrypt</button>
    </form>
  `);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
