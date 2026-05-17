import Mux from '@mux/mux-node';
import { APIGatewayProxyHandlerV2 } from 'aws-lambda';
import { SSM } from 'aws-sdk';
import { notFound, response } from '../helpers/response';
import { catchErrors } from './catchErrors';

const maybeGetMuxTokenSecret = async (muxTokenId: string) => {
  const ssm = new SSM();

  try {
    const muxTokenSecretParameter = await ssm
      .getParameter({ Name: `/multiview/mux/${muxTokenId}`, WithDecryption: true })
      .promise();

    const muxTokenSecret = muxTokenSecretParameter.Parameter?.Value;

    return muxTokenSecret;
  } catch (err) {
    console.log(`Error fetching secret ${muxTokenId}: ${(err as Error).message}`, err);

    return undefined;
  }
};

export const getStream: APIGatewayProxyHandlerV2 = catchErrors(async (event, context) => {
  const muxTokenId = event.pathParameters?.muxTokenId;
  if (muxTokenId === undefined || muxTokenId.length === 0) {
    return notFound();
  }

  const muxTokenSecret = await maybeGetMuxTokenSecret(muxTokenId);

  if (!muxTokenSecret) {
    console.log('No secret found for ' + muxTokenId);
    return notFound();
  }

  const mux = new Mux({ tokenId: muxTokenId, tokenSecret: muxTokenSecret });

  const streams = (await mux.video.liveStreams.list({ limit: 10, page: 0 })).data;

  const stream = streams.find(({ status }) => status === 'active');

  if (!stream) {
    console.log(
      'No active stream found',
      streams.map((st) => ({ status: st.status, id: st.id })),
    );
    return response({
      ok: true,
      online: false,
      stream: undefined,
    });
  }

  const playbackId = stream.playback_ids?.[0]?.id;

  if (!playbackId) {
    console.log(`No playback ID found for ${muxTokenId}`, stream.playback_ids);
    return response({
      ok: true,
      online: false,
      stream: undefined,
    });
  }

  const streamURL = `https://stream.mux.com/${encodeURIComponent(playbackId)}.m3u8`;
  console.log('streamURL', streamURL);

  return response({
    ok: true,
    online: true,
    stream: streamURL,
  });
});
