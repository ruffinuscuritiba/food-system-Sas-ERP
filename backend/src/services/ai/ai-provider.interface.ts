export interface AIImageRequest {
  prompt: string;
  imageBase64: string;
  mimeType: string;
}

export interface AIProvider {
  readonly name: string;
  analyzeImage(req: AIImageRequest): Promise<string>;
}
