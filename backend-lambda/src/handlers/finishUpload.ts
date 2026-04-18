import { APIGatewayProxyHandlerV2 } from 'aws-lambda';
import { isDecodedUploadJWT, isFinishBody } from '../types.guard';
import { verify } from 'jsonwebtoken';
import { parseBody } from '../helpers/parseBody';
import { accessDenied, invalidRequest, response } from '../helpers/response';
import { notifyPortalUploadFinished } from '../portal-api';
import { bucket, jwtAudience, jwtPrivateKey } from '../helpers/config';
import { client } from '../s3client';
import { catchErrors } from './catchErrors';

export const finishUpload: APIGatewayProxyHandlerV2 = catchErrors(async (event, context) => {
  const token = (event.headers.authorization || '').substring('Bearer '.length);
  let decodedToken;
  try {
    decodedToken = verify(token, jwtPrivateKey);
  } catch (err) {
    console.log(`Error decoding JWT: ${(err as Error).message} for ${token}`);
    return accessDenied();
  }

  if (!isDecodedUploadJWT(decodedToken)) {
    return accessDenied();
  }

  if (decodedToken.iss !== jwtAudience || decodedToken.aud !== jwtAudience) {
    console.log(`Unexpected iss ${decodedToken.iss} or aud ${decodedToken.aud}`);
    return accessDenied();
  }

  const uploadId = decodedToken.sub;
  const objectName = decodedToken.objectName;

  const body = parseBody(event.body, isFinishBody);

  if (body === undefined || body.parts.length === 0) {
    console.log('Body is not valid', event.body);
    return invalidRequest();
  }

  try {
    await client
      .completeMultipartUpload({
        Bucket: bucket,
        Key: objectName,
        UploadId: uploadId,
        MultipartUpload: { Parts: body.parts },
      })
      .promise();

    const { ContentLength, Metadata, ETag, PartsCount } = await client
      .headObject({
        Bucket: bucket,
        Key: objectName,
      })
      .promise();

    await notifyPortalUploadFinished(
      decodedToken.uuid,
      decodedToken.ep,
      `https://s3.amazonaws.com/${encodeURIComponent(bucket)}/${objectName}`,
      {
        uploadId: uploadId,
        parts: body.parts.length,
        ContentLength,
        Metadata,
        s3: `s3://${encodeURIComponent(bucket)}/${objectName}`,
        ETag,
        PartsCount,
      },
      decodedToken.draft ?? null,
    );

    return response({ ok: true });
  } catch (err) {
    console.log('Unable to complete upload:', err);
    return response({ ok: false, error: 'Unable to complete upload.' }, 500);
  }
});
