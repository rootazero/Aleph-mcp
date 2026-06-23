/** Pure aspect-ratio → pixel-size mappings (no IO). */

export const IMAGE_SIZES: Record<string, string> = {
  "1:1": "1024x1024",
  "3:4": "768x1024",
  "4:3": "1024x768",
  "9:16": "576x1024",
  "16:9": "1024x576",
};

// Official video API accepts only these three sizes.
export const VIDEO_SIZES: Record<string, string> = {
  "16:9": "1280x720",
  "9:16": "720x1280",
  "1:1": "960x960",
};

export function imageSizeFor(aspectRatio: string): string {
  const size = IMAGE_SIZES[aspectRatio];
  if (size === undefined) {
    const allowed = Object.keys(IMAGE_SIZES).join(", ");
    throw new Error(`unsupported image aspect_ratio '${aspectRatio}'; allowed: ${allowed}`);
  }
  return size;
}

export function videoSizeFor(aspectRatio: string): string {
  const size = VIDEO_SIZES[aspectRatio];
  if (size === undefined) {
    const allowed = Object.keys(VIDEO_SIZES).join(", ");
    throw new Error(`unsupported video aspect_ratio '${aspectRatio}'; allowed: ${allowed}`);
  }
  return size;
}
