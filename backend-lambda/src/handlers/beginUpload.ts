import { APIGatewayProxyHandlerV2 } from 'aws-lambda';
import { isBeginBody, isDecodedBeginJWT } from '../types.guard';
import { sign, verify } from 'jsonwebtoken';
import { extname } from 'path';
import { parseBody } from '../helpers/parseBody';
import { sanitizeFileNames } from '../helpers/sanitizeFileNames';
import { accessDenied, invalidRequest, response } from '../helpers/response';
import { getPresenterInfo } from '../portal-api';
import { bucket, jwtAudience, jwtPrivateKey } from '../helpers/config';
import { client } from '../s3client';
import { catchErrors } from './catchErrors';

export const beginUpload: APIGatewayProxyHandlerV2 = catchErrors(async (event) => {
  const token = (event.headers.authorization || '').substring('Bearer '.length);
  let decodedToken;
  try {
    decodedToken = verify(token, jwtPrivateKey);
  } catch (err) {
    console.log(`Error decoding JWT: ${(err as Error).message} for ${token}`);
    return accessDenied();
  }

  if (!isDecodedBeginJWT(decodedToken)) {
    return accessDenied();
  }

  if (decodedToken.iss !== jwtAudience || decodedToken.aud !== jwtAudience) {
    console.log(`Unexpected iss ${decodedToken.iss} or aud ${decodedToken.aud}`);
    return accessDenied();
  }

  const body = parseBody(event.body, isBeginBody);
  if (body === undefined || body.fileName.trim().length === 0) {
    return invalidRequest();
  }

  const presenterInfo = await getPresenterInfo(decodedToken.sub);
  if (presenterInfo.ok === false) {
    return accessDenied();
  }

  // `episode` is nullable: the presenter portal allows "other" uploads
  // (sponsor ads, promo clips, etc.) that aren't tied to a scheduled talk.
  // When it is provided, it must match one of the presenter's talks.
  let presentationSlug: string;
  let episodeMetadata: string;
  if (body.episode === null || body.episode === undefined) {
    presentationSlug = 'other';
    episodeMetadata = '';
  } else {
    const presentation = presenterInfo.value.presentations.find(
      (presentation) => presentation.pk === body.episode,
    );
    if (presentation === undefined) {
      return invalidRequest();
    }
    presentationSlug = presentation.slug;
    episodeMetadata = `${presentation.pk}`;
  }

  const version = Date.now();
  const presenterName = sanitizeFileNames(presenterInfo.value.name);

  const objectName = `${presenterName}/${presentationSlug}-${version}${extname(body.fileName)}`;

  const { UploadId } = await client
    .createMultipartUpload({
      Bucket: bucket,
      Key: objectName,
      Metadata: {
        presenterUuid: presenterInfo.value.uuid,
        presenterName: presenterInfo.value.name.normalize('NFD').replace(/[\u0300-\u036f]/g, ''),
        episode: episodeMetadata,
      },
    })
    .promise();

  return response({
    ok: true,
    token: sign(
      {
        iss: jwtAudience,
        aud: jwtAudience,
        sub: UploadId,
        objectName: objectName,
        uuid: presenterInfo.value.uuid,
        ep: body.episode ?? null,
        draft: body.draft ?? null,
      },
      jwtPrivateKey,
      {
        expiresIn: '24h',
      },
    ),
  });
});
