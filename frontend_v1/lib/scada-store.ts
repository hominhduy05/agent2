import { CameraChannel } from '@/lib/scada-camera';

type ScadaStoreState = {
  cameras: CameraChannel[];
  demoMode: boolean;
  scaleStatus: any;
};

let state: ScadaStoreState = {
  cameras: [],
  demoMode: false,
  scaleStatus: null,
};

const listeners = new Set<() => void>();

export const scadaStore = {
  getState: () => state,

  setState(partial: Partial<ScadaStoreState>) {
    state = { ...state, ...partial };
    listeners.forEach((l) => l());
  },

  subscribe(listener: () => void) {
  listeners.add(listener);

  return () => {
    listeners.delete(listener); // void return
  };
}
};



