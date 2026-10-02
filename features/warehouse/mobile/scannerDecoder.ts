import { BrowserMultiFormatReader } from '@zxing/browser';
import {
  BarcodeFormat,
  DecodeHintType,
} from '@zxing/library';

export interface WarehouseMobileDecoderSession {
  stop(): void;
}

const WAREHOUSE_MOBILE_BARCODE_FORMATS = [
  BarcodeFormat.EAN_13,
  BarcodeFormat.EAN_8,
  BarcodeFormat.UPC_A,
  BarcodeFormat.UPC_E,
  BarcodeFormat.CODE_128,
  BarcodeFormat.CODE_39,
  BarcodeFormat.ITF,
  BarcodeFormat.QR_CODE,
  BarcodeFormat.DATA_MATRIX,
] as const;

export async function startWarehouseMobileDecoder(input: {
  videoElement: HTMLVideoElement;
  onDecoded: (value: string) => void;
}): Promise<WarehouseMobileDecoderSession> {
  const hints = new Map();
  hints.set(
    DecodeHintType.POSSIBLE_FORMATS,
    [...WAREHOUSE_MOBILE_BARCODE_FORMATS]
  );

  const reader = new BrowserMultiFormatReader(hints, {
    delayBetweenScanAttempts: 180,
    delayBetweenScanSuccess: 700,
    tryPlayVideoTimeout: 5000,
  });

  const controls = await reader.decodeFromConstraints(
    {
      audio: false,
      video: {
        facingMode: { ideal: 'environment' },
        width: { ideal: 1280 },
        height: { ideal: 720 },
      },
    },
    input.videoElement,
    (result) => {
      if (!result) return;
      const value = result.getText();
      if (value) input.onDecoded(value);
    }
  );

  return {
    stop() {
      controls.stop();
    },
  };
}
