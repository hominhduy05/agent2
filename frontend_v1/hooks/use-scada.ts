// 'use client';

// import { useEffect, useState } from 'react';

// import { getScadaManager } from '@/lib/scada-manager';
// import { CameraChannel } from '@/lib/scada-camera';

// export function useScada() {
//   const [cameras, setCameras] = useState<CameraChannel[]>([]);

//   useEffect(() => {
//     const manager = getScadaManager((camera) => {
//       setCameras((prev) => {
//         const next = [...prev];

//         next[camera.id] = {
//           ...camera,
//         };

//         return next;
//       });
//     });

//     setCameras([...manager.cameras]);

//     return () => {
//       manager.setOnUpdate();
//     };
//   }, []);

//   return {
//     cameras,
//   };
// }

'use client';

import { useEffect, useRef, useState } from 'react';
import { getScadaManager } from '@/lib/scada-manager';
import { CameraChannel } from '@/lib/scada-camera';

export function useScada() {
  const [cameras, setCameras] = useState<CameraChannel[]>([]);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const manager = getScadaManager();

    /**
     * Sync function (throttled via requestAnimationFrame)
     * tránh rerender liên tục khi AI streaming FPS cao
     */
    const sync = () => {

      console.log('manager update');


      if (rafRef.current !== null) return;

      rafRef.current = requestAnimationFrame(() => {

        console.log('setCameras', manager.cameras);
        
        // IMPORTANT: clone array để React detect change
        setCameras([...manager.cameras]);
        rafRef.current = null;
      });
    };

    /**
     * attach listener từ manager
     * manager sẽ gọi callback mỗi khi camera update
     */
    manager.setOnUpdate(sync);

    /**
     * initial hydrate
     */
    setCameras([...manager.cameras]);

    return () => {
      // cleanup listener
      manager.setOnUpdate(undefined);

      // cleanup RAF
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, []);

  return {
    cameras,
  };
}
