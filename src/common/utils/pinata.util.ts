import { Injectable, Logger } from '@nestjs/common';
import { ENVIRONMENT } from '../configs/environment';
import axios from 'axios';
import FormData from 'form-data';

@Injectable()
export class PinataService {
  private readonly logger = new Logger(PinataService.name);
  private readonly pinataApiUrl = 'https://api.pinata.cloud';

  async uploadFile(file: Express.Multer.File, folder: string): Promise<string> {
    try {
      const formData = new FormData();
      formData.append('file', file.buffer, {
        filename: file.originalname,
        contentType: file.mimetype,
      });

      const metadata = JSON.stringify({
        name: file.originalname,
        keyvalues: {
          uploadedAt: new Date().toISOString(),
          folder,
        },
      });
      formData.append('pinataMetadata', metadata);

      const options = JSON.stringify({
        cidVersion: 0,
      });
      formData.append('pinataOptions', options);

      const response = await axios.post(
        `${this.pinataApiUrl}/pinning/pinFileToIPFS`,
        formData,
        {
          headers: {
            ...formData.getHeaders(),
            pinata_api_key: ENVIRONMENT.PINATA.PINATA_API_KEY,
            pinata_secret_api_key: ENVIRONMENT.PINATA.PINATA_API_SECRET,
          },
          maxContentLength: Infinity,
          maxBodyLength: Infinity,
        },
      );

      this.logger.log(`File uploaded to IPFS: ${response.data.IpfsHash}`);
      return response.data.IpfsHash;
    } catch (error) {
      this.logger.error(
        'Failed to upload file to Pinata IPFS',
        error.response?.data || error.message,
      );
      throw new Error(
        `Failed to upload file to Pinata IPFS: ${error.response?.data?.error || error.message}`,
      );
    }
  }

  async uploadJSON(jsonData: object, name: string): Promise<string> {
    try {
      const response = await axios.post(
        `${this.pinataApiUrl}/pinning/pinJSONToIPFS`,
        {
          pinataContent: jsonData,
          pinataMetadata: {
            name: name,
            keyvalues: {
              uploadedAt: new Date().toISOString(),
            },
          },
        },
        {
          headers: {
            'Content-Type': 'application/json',
            pinata_api_key: ENVIRONMENT.PINATA.PINATA_API_KEY,
            pinata_secret_api_key: ENVIRONMENT.PINATA.PINATA_API_SECRET,
          },
        },
      );

      this.logger.log(`JSON uploaded to IPFS: ${response.data.IpfsHash}`);
      return response.data.IpfsHash;
    } catch (error) {
      this.logger.error(
        'Failed to upload JSON to Pinata IPFS',
        error.response?.data || error.message,
      );
      throw new Error(
        `Failed to upload JSON to Pinata IPFS: ${error.response?.data?.error || error.message}`,
      );
    }
  }

  async unpinFile(ipfsHash: string): Promise<void> {
    try {
      await axios.delete(`${this.pinataApiUrl}/pinning/unpin/${ipfsHash}`, {
        headers: {
          pinata_api_key: ENVIRONMENT.PINATA.PINATA_API_KEY,
          pinata_secret_api_key: ENVIRONMENT.PINATA.PINATA_API_SECRET,
        },
      });

      this.logger.log(`File unpinned from IPFS: ${ipfsHash}`);
    } catch (error) {
      this.logger.error(
        'Failed to unpin file from Pinata IPFS',
        error.response?.data || error.message,
      );
      throw new Error(
        `Failed to unpin file from Pinata IPFS: ${error.response?.data?.error || error.message}`,
      );
    }
  }

  getIPFSUrl(ipfsHash: string): string {
    return `https://gateway.pinata.cloud/ipfs/${ipfsHash}`;
  }
}
