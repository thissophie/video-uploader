import { isVeypearResponse } from './types.guard';
import fetch from 'node-fetch';
import { VeypearResponse } from './types';
import { HTTPFailure } from './helpers/http-failure';
import { failure, Result, success } from './helpers/result';
import { portal } from './helpers/config';

export const getPresenterInfo = async (presenter: string): Promise<Result<HTTPFailure, VeypearResponse>> => {
  const portalRequest = await fetch(`${portal}/portal/${presenter}/`);

  if (portalRequest.status !== 200) {
    return failure({ statusCode: 404, message: 'Not Found' }); // invalidRequest('Invalid response from portal');
  }

  const data = (await portalRequest.json()) as unknown;

  if (!isVeypearResponse(data)) {
    return failure({ statusCode: 400, message: 'Invalid response from veyepar portal' });
  }

  return success(data);
};

export const notifyPortalUploadFinished = async (
  presenter: string,
  episode: number | null,
  prerecordUrl: string,
  prerecordPayload: unknown,
  draft: number | null = null,
): Promise<Result<HTTPFailure, unknown>> => {
  // Always send `episode` (possibly null) so the portal serializer can
  // distinguish a talk-prerecord POST from an "other" upload. Include
  // `draft_pk` only when the portal handed us one on the way in — that's
  // how it matches the upload back to the pre-created draft row instead
  // of creating a duplicate.
  const payload: Record<string, unknown> = {
    presenter,
    episode,
    prerecord_url: prerecordUrl,
    prerecord_payload: JSON.stringify(prerecordPayload),
  };
  if (draft !== null && draft !== undefined) {
    payload.draft_pk = draft;
  }
  const portalRequest = await fetch(`${portal}/upload/`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!(portalRequest.status >= 200 && portalRequest.status < 300)) {
    const body = await portalRequest.text();

    console.log('Unexpected response from veyepar: ' + body);

    return failure({ statusCode: portalRequest.status, message: 'Invalid response from veyepar portal', body });
  }

  const data = (await portalRequest.json()) as unknown;

  return success(data);
};
