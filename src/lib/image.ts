import * as FileSystem from 'expo-file-system/legacy';
import * as ImageManipulator from 'expo-image-manipulator';
import { Image } from 'react-native';

export type CompressOptions = {
  maxWidth?: number;
  quality?: number;
};

export type CompressedImage = {
  uri: string;
  width: number;
  height: number;
  sizeBytes: number;
};

export type CropRect = {
  originX: number;
  originY: number;
  width: number;
  height: number;
};

const DEFAULT_MAX_WIDTH = 1600;
const DEFAULT_QUALITY = 0.85;

export function getImageDimensions(
  uri: string
): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    Image.getSize(
      uri,
      (width, height) => resolve({ width, height }),
      (error) => reject(error)
    );
  });
}

async function getFileSize(uri: string): Promise<number> {
  const fileInfo = await FileSystem.getInfoAsync(uri);

  if (!fileInfo.exists) {
    throw new Error('Bilddatei konnte nicht gelesen werden.');
  }

  return fileInfo.size;
}

function clampCropRect(crop: CropRect, imageWidth: number, imageHeight: number) {
  const width = Math.max(1, Math.min(crop.width, imageWidth));
  const height = Math.max(1, Math.min(crop.height, imageHeight));
  const originX = Math.max(0, Math.min(crop.originX, imageWidth - width));
  const originY = Math.max(0, Math.min(crop.originY, imageHeight - height));

  return { originX, originY, width, height };
}

export async function compressImage(
  uri: string,
  options: CompressOptions = {}
): Promise<CompressedImage> {
  const maxWidth = options.maxWidth ?? DEFAULT_MAX_WIDTH;
  const quality = options.quality ?? DEFAULT_QUALITY;
  const dimensions = await getImageDimensions(uri);
  const actions: ImageManipulator.Action[] =
    dimensions.width > maxWidth ? [{ resize: { width: maxWidth } }] : [];

  const result = await ImageManipulator.manipulateAsync(uri, actions, {
    compress: quality,
    format: ImageManipulator.SaveFormat.JPEG,
  });

  return {
    uri: result.uri,
    width: result.width,
    height: result.height,
    sizeBytes: await getFileSize(result.uri),
  };
}

export async function cropImage(
  uri: string,
  crop: CropRect
): Promise<string> {
  const dimensions = await getImageDimensions(uri);
  const safeCrop = clampCropRect(crop, dimensions.width, dimensions.height);
  const result = await ImageManipulator.manipulateAsync(
    uri,
    [{ crop: safeCrop }],
    {
      compress: DEFAULT_QUALITY,
      format: ImageManipulator.SaveFormat.JPEG,
    }
  );

  return result.uri;
}
