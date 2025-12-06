import { create } from 'zustand';
import dayjs from 'dayjs';

interface DateStore {
  selectedDate: string;
  setSelectedDate: (date: string | Date) => void;
}

export const useDateStore = create<DateStore>((set) => ({
  selectedDate: dayjs().format('YYYY-MM-DD'),
  setSelectedDate: (date) => {
    const parsed = dayjs(date);
    const formatted = parsed.isValid() ? parsed.format('YYYY-MM-DD') : dayjs().format('YYYY-MM-DD');
    set({ selectedDate: formatted });
  }
}));
