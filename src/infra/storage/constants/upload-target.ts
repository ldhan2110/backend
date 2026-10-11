export enum UploadTarget {
  AVATAR = 'avatar',
  DOCUMENT = 'documents',
}

/** All valid target values, for runtime validation. */
export const UPLOAD_TARGETS: string[] = Object.values(UploadTarget);
