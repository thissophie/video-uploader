// main.js

import '@fortawesome/fontawesome-free/css/all.css';
import 'bootstrap';
import 'bootstrap/dist/css/bootstrap.css'; // Import precompiled Bootstrap css
import './css/frontend.css';

import { addBreadcrumb, browserTracingIntegration, captureException, init } from '@sentry/browser';

import { createShowAlert } from './createShowAlert';
import { createProgressBar } from './ProgressBar';
import { setHidden, SetHidden } from './setHidden';
import { createUploadFile } from './createUploadFile';
import { getPortalDetails, isAPIError } from './uploader/apiCalls';

console.log('process.env.SENTRY_DSN', process.env.SENTRY_DSN);

if (process.env.SENTRY_DSN) {
  init({
    dsn: process.env.SENTRY_DSN,
    integrations: [browserTracingIntegration()],
    tracesSampleRate: 0,
    release: `video-uploader@${process.env.RELEASE}`,
    environment: location.host,
  });
}

const setup = async () => {
  const presenterInput = <HTMLInputElement>document.getElementById('presenter-name');
  const presentationTitle = <HTMLInputElement>document.getElementById('presentation-title');

  const fileInput = <HTMLInputElement>document.getElementById('file-input');
  const formEl = <HTMLFormElement>document.getElementById('upload-form');

  const progressBar = createProgressBar(document.getElementById('upload-progress'));
  const showAlert = createShowAlert(formEl);

  const setSpinnerHidden = setHidden(document.getElementById('upload-spinner'));

  const setPresenterNameHidden = setHidden(presenterInput.parentElement);
  const setPresentationTitleHidden = setHidden(presentationTitle.parentElement);

  const setFileHidden = setHidden(fileInput.parentElement);
  const setSubmitHidden = setHidden(<HTMLInputElement>document.getElementById('submit-button'));
  const setFormBeingProcessed: SetHidden = (hidden: boolean) => {
    [setPresenterNameHidden, setPresentationTitleHidden, setFileHidden, setSubmitHidden].forEach((setElHidden) =>
      setElHidden(hidden),
    );
  };

  setFormBeingProcessed(true);
  setSpinnerHidden(false);

  try {
    const params = new URLSearchParams(window.location.search);
    const debug = params.has('debug');
    const presenter = params.get('presenter');

    // `episode` is optional. The presenter portal's "Other Uploads" form
    // lets presenters upload sponsor ads / promo clips that aren't
    // attached to a specific scheduled talk. When it isn't provided (or
    // is malformed) we skip the presentation lookup entirely.
    const rawEpisode = params.get('episode');
    const parsedEpisode = rawEpisode === null ? NaN : parseInt(rawEpisode, 10);
    const episode: number | null = Number.isFinite(parsedEpisode) ? parsedEpisode : null;

    // `draft` is the pk of a pre-created VirtualEventPrerecordedFile row
    // that this upload should fill in. Forwarded to the portal as
    // `draft_pk` at finish-upload time. Optional — legacy talk-prerecord
    // flow doesn't use drafts.
    const rawDraft = params.get('draft');
    const parsedDraft = rawDraft === null ? NaN : parseInt(rawDraft, 10);
    const draft: number | null = Number.isFinite(parsedDraft) ? parsedDraft : null;

    addBreadcrumb({
      category: 'setup',
      message: `Looking for ${presenter} episode ${episode ?? 'none'} draft ${draft ?? 'none'}. Debug is ${debug ? 'on' : 'off'}`,
      level: 'info',
    });

    const portalDetails = await getPortalDetails(presenter);

    if (isAPIError(portalDetails)) {
      if (portalDetails.error === 'Not found') {
        showAlert('Presenter not found', 'danger');
        setSpinnerHidden(true);
        return;
      }
      throw new Error(`Could not obtain presenter (${presenter}) details: ${portalDetails.error}`);
    }

    presenterInput.value = portalDetails.name;

    if (episode === null) {
      // "Other" upload — no scheduled talk to look up. The presenter
      // already picked the file's kind/title in the portal, so show a
      // generic label here.
      presentationTitle.value = 'Other upload';
    } else {
      const presentation = portalDetails.presentations.find(({ pk }) => pk === episode);

      if (!presentation) {
        throw new Error(`Could not find episode: ${episode}`);
      }

      presentationTitle.value = presentation.name;
    }

    const uploadFile = createUploadFile(
      progressBar,
      setFormBeingProcessed,
      showAlert,
      setSpinnerHidden,
      debug,
      portalDetails.token,
    );

    fileInput.addEventListener('change', () => {
      if (fileInput.files.length > 0) {
        fileInput.parentElement.querySelector('label').textContent = fileInput.files[0].name;

        addBreadcrumb({
          category: 'file',
          message: 'User picked a file',
          level: 'info',
        });
      }
    });

    const submitForm = async (): Promise<void> => {
      if (formEl.checkValidity() === false) {
        formEl.classList.add('was-validated');
        return;
      }

      setFormBeingProcessed(true);

      const file = fileInput.files[0];

      addBreadcrumb({
        category: 'file',
        message: 'Upload file...',
        level: 'info',
      });

      await uploadFile(file, episode, draft);
    };

    formEl.addEventListener(
      'submit',
      (event) => {
        event.preventDefault();
        event.stopPropagation();

        void submitForm();
      },
      false,
    );

    setFormBeingProcessed(false);
    setSpinnerHidden(true);
  } catch (error) {
    captureException(error);
    showAlert((error as Error).message, 'danger');
    setSpinnerHidden(true);
  }
};

document.addEventListener('DOMContentLoaded', () => {
  setup().catch((err) => captureException(err));
});
