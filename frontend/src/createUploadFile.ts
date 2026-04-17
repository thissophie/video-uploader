import { ProgressBar } from './ProgressBar';
import { SetHidden } from './setHidden';
import { ShowAlert } from './createShowAlert';
import { upload } from './uploader/upload';
import * as Sentry from '@sentry/browser';

export const createUploadFile = (
  progressBar: ProgressBar,
  setFormBeingProcessed: SetHidden,
  showAlert: ShowAlert,
  setSpinnerHidden: SetHidden,
  debug: boolean,
  token: string,
) => async (file: File, episode: number | null, draft: number | null): Promise<void> => {
  try {
    setSpinnerHidden(false);
    progressBar.setHidden(false);

    await upload(debug, token, file, episode, draft, (loadedBytes) => {
      if (debug) {
        console.log('Updating progress...', loadedBytes, file.size, (loadedBytes / file.size) * 100);
      }
      progressBar.setProgress((loadedBytes / file.size) * 100);
    });
    setSpinnerHidden(true);
    progressBar.setHidden(true);

    showAlert('Upload finished succesfully', 'success');
  } catch (error) {
    if (debug) {
      console.error('Error', error);
    }
    Sentry.captureException(error, {
      tags: {
        episode: episode === null ? 'null' : `${episode}`,
        draft: draft === null ? 'null' : `${draft}`,
        fileName: file.name,
      },
    });
    showAlert((error as Error).message, 'danger');
    setFormBeingProcessed(false);
    setSpinnerHidden(true);
    progressBar.setHidden(true);
  }
};
