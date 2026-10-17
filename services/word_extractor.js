import { parentPort, workerData } from 'node:worker_threads';
import mammoth from 'mammoth';

const result = await mammoth.convertToHtml({ path: workerData.filePath });
parentPort.postMessage({ html: (result.value || '').slice(0, workerData.limit) });
