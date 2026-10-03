/** Response envelope shared by both filters (RFC 9457 subset). */
export interface AppException {
  code: string;
  detail: string;
  status: number;
}
