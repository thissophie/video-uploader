import { uploadPart } from './uploadPart';

export interface PartProgress {
  uploadedBytes: number;
}

import pLimit from 'p-limit';
import { abandonUpload, completeUpload, getPartURL, getUploadId, isAPIError } from './apiCalls';
import { addBreadcrumb } from '@sentry/browser';

const FILE_CHUNK_SIZE = 10_000_000;

const calculateProgress = (allParts: { uploadedBytes: number }[]): number =>
  allParts.reduce((prev, curr) => prev + curr.uploadedBytes, 0);

const createUploadSliceTask = (
  debug: boolean,
  uploadToken: string,
  partNumber: number,
  file: File,
  onProgress: (loadedBytes: number) => void,
) => async () => {
  if (debug) {
    console.log(`Requesting URL for ${partNumber}`);
  }

  const partURLResponse = await getPartURL(uploadToken, partNumber);

  if (isAPIError(partURLResponse)) {
    throw new Error(partURLResponse.error);
  }

  const slice = file.slice(partNumber * FILE_CHUNK_SIZE, Math.min((partNumber + 1) * FILE_CHUNK_SIZE, file.size));

  return uploadPart(debug, slice, partNumber, partURLResponse.partURL, onProgress);
};

export const upload = async (
  debug: boolean,
  token: string,
  file: File,
  episode: number | null,
  draft: number | null,
  onProgress: (loadedBytes: number) => void,
): Promise<void> => {
  const partCounts = Math.ceil(file.size / FILE_CHUNK_SIZE);

  addBreadcrumb({
    category: 'upload',
    message: 'Get Upload ID',
    level: 'info',
  });

  const uploadIdResponse = await getUploadId(token, file.name, episode, draft);

  if (isAPIError(uploadIdResponse)) {
    throw new Error(uploadIdResponse.error);
  }

  const uploadToken = uploadIdResponse.token;

  const promises = [];
  const partProgress: PartProgress[] = [];
  const updateTotalProgress = () => {
    const totalProgress = calculateProgress(partProgress);

    onProgress(totalProgress);
  };

  const limit = pLimit(4);

  for (let part = 0; part < partCounts; part++) {
    partProgress[part] = { uploadedBytes: 0 };

    promises.push(
      limit(
        createUploadSliceTask(debug, uploadToken, part, file, (loadedBytes) => {
          partProgress[part].uploadedBytes = loadedBytes;
          updateTotalProgress();
        }),
      ),
    );
  }

  try {
    const completedParts = await Promise.all(promises);
    if (debug) {
      console.log('completedParts', completedParts);
    }

    addBreadcrumb({
      category: 'upload',
      message: `Uploaded parts ${completedParts.length}`,
      level: 'info',
    });

    const completeUploadResponse = await completeUpload(uploadToken, completedParts);

    if (isAPIError(completeUploadResponse)) {
      addBreadcrumb({
        category: 'upload',
        message: `Error completing the upload: ${completeUploadResponse.error}`,
        level: 'fatal',
      });
      throw new Error('Unable to complete upload.');
    }
  } catch (err) {
    if (debug) {
      console.log('Abandoning because', err);
    }
    await abandonUpload(uploadToken);

    throw err;
  }
};
