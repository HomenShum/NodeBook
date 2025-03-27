import axios from "axios";

const FileResource = {
  /**
   * Get a presigned url from the server
   */
  getPresignedData: async (mime: string) =>
    axios.get<{
      url: string;
      fields: {
        [key: string]: string;
        bucket: string;
        "X-Amz-Algorithm": string;
        "X-Amz-Credential": string;
        "X-Amz-Date": string;
        key: string;
        Policy: string;
        "X-Amz-Signature": string;
      };
    }>(`/api/files?mime=${mime}`),
};

export default FileResource;
