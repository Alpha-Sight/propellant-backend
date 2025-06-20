export interface PinataUploadFile {
  fileName: string;
  buffer: Buffer;
  mimetype: string;
}

export interface PinataUploadResponse {
  IpfsHash: string;
  PinSize: number;
  Timestamp: string;
}

export interface PinataMetadata {
  name?: string;
  keyvalues?: Record<string, string>;
}

export interface PinataOptions {
  cidVersion?: number;
}
