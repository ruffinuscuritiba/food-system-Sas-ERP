export interface AIImageRequest {
  prompt: string;
  /** Base64-encoded file content. Omit for text-only requests. */
  imageBase64?: string;
  /** Mime type of the file. Omit for text-only requests. */
  mimeType?: string;
  /** Plain text content to analyse (used instead of image for spreadsheets). */
  textContent?: string;
}

export interface AIProvider {
  readonly name: string;
  analyzeImage(req: AIImageRequest): Promise<string>;
}
