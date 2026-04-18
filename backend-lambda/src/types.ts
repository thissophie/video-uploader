/** @see {isBeginBody} ts-auto-guard:type-guard */
export interface BeginBody {
  // `null` when the presenter portal is uploading an "other" file
  // (sponsor ad, promo clip, ...) that isn't linked to a scheduled talk.
  episode: number | null;
  fileName: string;
  // Primary key of a pre-created VirtualEventPrerecordedFile draft row.
  // Forwarded to the portal as `draft_pk` so the row is filled in place
  // instead of a duplicate being created. Optional for backwards compat.
  draft?: number | null;
}

/** @see {isUploadURLBody} ts-auto-guard:type-guard */
export interface UploadURLBody {
  partNumber: number;
}

/** @see {isFinishBody} ts-auto-guard:type-guard */
export interface FinishBody {
  parts: {
    ETag: string;
    PartNumber: number;
  }[];
}

/** @see {isVeypearPresentation} ts-auto-guard:type-guard */
export interface VeypearPresentation {
  pk: number;
  name: string;
  slug: string;
  prerecord: boolean;
}

/** @see {isVeypearResponse} ts-auto-guard:type-guard */
export interface VeypearResponse {
  uuid: string;
  name: string;
  presentations: VeypearPresentation[];
}

/** @see {isDecodedBeginJWT} ts-auto-guard:type-guard */
export interface DecodedBeginJWT {
  iss: string;
  aud: string;
  sub: string;
  name: string;
}

/** @see {isDecodedUploadJWT} ts-auto-guard:type-guard */
export interface DecodedUploadJWT {
  iss: string;
  aud: string;
  sub: string;
  objectName: string;
  uuid: string;
  ep: number | null;
  draft?: number | null;
}
