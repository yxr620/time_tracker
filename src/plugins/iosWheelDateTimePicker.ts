import { registerPlugin } from '@capacitor/core';

export interface IOSWheelDateTimePickerPresentOptions {
  value?: string;
  daysBefore?: number;
  daysAfter?: number;
}

export interface IOSWheelDateTimePickerResult {
  cancelled: boolean;
  value?: string;
}

export interface IOSWheelDateTimePickerPlugin {
  present(options: IOSWheelDateTimePickerPresentOptions): Promise<IOSWheelDateTimePickerResult>;
}

export const IOSWheelDateTimePicker = registerPlugin<IOSWheelDateTimePickerPlugin>('IOSWheelDateTimePicker');
