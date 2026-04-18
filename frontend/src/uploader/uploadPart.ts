import { addBreadcrumb } from '@sentry/browser';
import axios, { AxiosProgressEvent } from 'axios';
import { Part } from './apiCalls';

export const uploadPart = async (
  debug: boolean,
  blob: Blob,
  partNumber: number,
  uploadUrl: string,
  onProgress: (loadedBytes: number) => void,
): Promise<Part> => {
  if (debug) {
    console.log(`Part #${partNumber} starting, ${blob.size} bytes.`);
  }

  addBreadcrumb({
    category: 'uploadPart',
    message: `Uploading part ${partNumber}`,
    level: 'info',
  });

  const output = await axios.put(uploadUrl, blob, {
    onUploadProgress: (progressEvent: AxiosProgressEvent) => onProgress(progressEvent.loaded),
  });

  const etag = (output.headers as { etag: string }).etag;

  if (!etag) {
    addBreadcrumb({
      category: 'uploadPart',
      message: `Uploading part ${partNumber} returned headers ${JSON.stringify(output.headers)}`,
      level: 'info',
    });

    throw new Error(`No etag returned with part ${partNumber}.`);
  }

  if (debug) {
    console.log(`Part #${partNumber} done. Got headers:`, output.headers);
  }

  return { ETag: etag, PartNumber: partNumber + 1 };
};
