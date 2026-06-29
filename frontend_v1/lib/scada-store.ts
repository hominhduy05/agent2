// import { CameraChannel } from '@/lib/scada-camera';

// type ScadaStoreState = {
//   cameras: CameraChannel[];
//   demoMode: boolean;
//   scaleStatus: any;
// };

// let state: ScadaStoreState = {
//   cameras: [],
//   demoMode: false,
//   scaleStatus: null,
// };

// const listeners = new Set<() => void>();

// export const scadaStore = {
//   getState: () => state,

//   setState(partial: Partial<ScadaStoreState>) {
//     state = { ...state, ...partial };
//     listeners.forEach((l) => l());
//   },

//   subscribe(listener: () => void) {
//     listeners.add(listener);

//     return () => {
//       listeners.delete(listener); // void return
//     };
//   },
// };

import { CameraChannel } from '@/lib/scada-camera';

export function getRoomByCamera(cameraId: number) {
  return Math.floor((cameraId - 1) / 5) + 1;
}

export function getRoomName(cameraId: number) {
  return `BUỒNG ${getRoomByCamera(cameraId)}`;
}

export type Room = {
  id: number;

  name: string;

  cameras: number[];
};

type ScadaStoreState = {
  cameras: CameraChannel[];

  rooms: Room[];

  demoMode: boolean;

  scaleStatus: any;
};

let state: ScadaStoreState = {
  cameras: [],

  rooms: [
    {
      id: 1,

      name: 'BUỒNG 1',

      cameras: [1, 2, 3, 4, 5],
    },

    {
      id: 2,

      name: 'BUỒNG 2',

      cameras: [6, 7, 8, 9, 10],
    },
  ],

  demoMode: false,

  scaleStatus: null,
};

const listeners = new Set<() => void>();

export const scadaStore = {
  getState() {
    return state;
  },

  setState(data: Partial<ScadaStoreState>) {
    state = {
      ...state,
      ...data,
    };

    listeners.forEach((fn) => fn());
  },

  subscribe(fn: () => void) {
    listeners.add(fn);

    return () => {
      listeners.delete(fn);
    };
  },
};
