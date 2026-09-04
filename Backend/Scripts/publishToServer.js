import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '../../');
// Using localhost:5000 ensures maximum disk-to-disk transfer speed, bypassing browser memory limits completely!
const API_URL = process.env.API_URL || 'http://localhost:5000/api/upload';

async function runPublisher() {
  console.log('🚀 Starting Direct-to-Server Production Publisher...');
  console.log('This will bypass the web browser and stream all local files directly to your live server!');

  // 1. Scan root directory
  const allEntries = fs.readdirSync(ROOT_DIR);
  const filesToImport = allEntries.filter(entry => {
    if (entry === 'Backend' || entry === 'Frontend' || entry === 'node_modules' || entry.startsWith('.') || entry === 'package.json' || entry === 'package-lock.json' || entry === 'README.md') {
      return false;
    }
    const fullPath = path.join(ROOT_DIR, entry);
    return fs.statSync(fullPath).isFile();
  });

  console.log(`📦 Found ${filesToImport.length} local files. Commencing high-speed transfer...`);

  let successCount = 0;
  let errorCount = 0;

  for (let i = 0; i < filesToImport.length; i++) {
    const filename = filesToImport[i];
    const filePath = path.join(ROOT_DIR, filename);
    const stats = fs.statSync(filePath);
    const sizeMb = (stats.size / (1024 * 1024)).toFixed(2);

    console.log(`\n[${i + 1}/${filesToImport.length}] 📤 Uploading ${filename} (${sizeMb} MB)...`);
    
    try {
      const formData = new FormData();
      const fileBlob = new Blob([fs.readFileSync(filePath)]);
      formData.append('file', fileBlob, filename);
      formData.append('duplicateAction', 'replace'); // automatically replace duplicates

      const startTime = Date.now();
      
      const response = await fetch(API_URL, {
        method: 'POST',
        body: formData
      });

      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

      if (response.ok) {
        console.log(`✅ SUCCESS: ${filename} published in ${elapsed}s!`);
        successCount++;
      } else {
        const errorText = await response.text();
        console.error(`❌ FAILED: ${filename} - Server Responded: ${response.status} ${errorText}`);
        errorCount++;
      }
    } catch (err) {
      console.error(`❌ NETWORK ERROR uploading ${filename}:`, err.message);
      errorCount++;
    }
  }

  console.log('\n🎉 BULK PUBLISH COMPLETE!');
  console.log(`✅ Successfully Published to Live Server: ${successCount}`);
  console.log(`❌ Failed: ${errorCount}`);
  process.exit(0);
}

runPublisher();
