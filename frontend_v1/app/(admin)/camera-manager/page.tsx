'use client';

import { useEffect, useState } from 'react';
import styles from './camera.module.css';
import { useScada } from '@/hooks/use-scada';
import { getScadaManager } from '@/lib/scada-manager';
import { CameraChannel } from '@/lib/scada-camera';

import {
  Camera,
  Activity,
  Play,
  Square,
  AlertTriangle,
  Settings,
  Zap,
  Lock,
  Video,
  Monitor,
  Wifi,
} from 'lucide-react';

type CameraType = 'webcam' | 'ip';
interface MediaDevice {
  deviceId: string;
  label: string;
}

export default function CameraManagementPage() {
  const { cameras } = useScada();
  const manager = getScadaManager(() => {});

  const [devices, setDevices] = useState<MediaDevice[]>([]);
const [showDeviceModal, setShowDeviceModal] = useState(false);
const [pendingCam, setPendingCam] = useState<CameraChannel | null>(null);
// const [showIpModal, setShowIpModal] = useState(false);
const [sourceTab, setSourceTab] =
  useState<'webcam' | 'ip'>('webcam');

const [rtspUrl, setRtspUrl] = useState('');

  const [theme] = useState<'dark' | 'light'>('dark');
  const [showForm, setShowForm] = useState(false);

  const [form, setForm] = useState({
    name: '',
    type: 'ip' as CameraType,
    ipUrl: '',
  });

  useEffect(() => {
  async function loadDevices() {
    try {
      await navigator.mediaDevices.getUserMedia({ video: true });

      const devs = await navigator.mediaDevices.enumerateDevices();

      setDevices(
        devs
          .filter(d => d.kind === 'videoinput')
          .map(d => ({
            deviceId: d.deviceId,
            label: d.label,
          }))
      );
    } catch (err) {
      console.error(err);
    }
  }

  loadDevices();
}, []);

  const addCamera = () => {
    if (!form.name.trim()) return;

    const id = manager.cameras.length;

    const cam: CameraChannel = {
      id,
      label: form.name,
      mode: form.type,
      stream: null,
      result: null,
      resultHistory: [],
      isActive: false,
      isDetecting: false,
      error: null,
      deviceId: null,
      deviceLabel: form.name,
      rtspUrl: form.ipUrl || '',
      frameCount: 0,
      autoEnabled: false,
      captureTimer: null,
      frameTimer: null,
      ws: undefined,
      videoRef: { current: null } as any,
      canvasRef: { current: null } as any,
    };

    manager.cameras.push(cam);
    manager.setOnUpdate(() => {});
    setShowForm(false);
    setForm({ name: '', type: 'ip', ipUrl: '' });

    manager.setOnUpdate(() => {});
  };

  const toggleCamera = (
  cam: CameraChannel
) => {
  if (cam.isActive) {
    manager.stopCamera(cam.id);
    return;
  }

  setPendingCam(cam);

  if (cam.mode === 'ip') {
    setSourceTab('ip');
    setRtspUrl(cam.rtspUrl || '');
  } else {
    setSourceTab('webcam');
  }

  setShowDeviceModal(true);
};

  const handleStartWebcam = async (
  deviceId: string,
  label: string
) => {
  if (!pendingCam) return;

  await manager.startWebcam(
    pendingCam.id,
    deviceId,
    label
  );

  setShowDeviceModal(false);
  setPendingCam(null);
};

const handleStartIPCamera = async (
  url: string
) => {
  if (!pendingCam || !url.trim()) return;

  await manager.startIPCamera(
    pendingCam.id,
    url,
    pendingCam.label
  );

  setShowDeviceModal(false);
  setPendingCam(null);
  setRtspUrl('');
};

  const testCamera = async (cam: CameraChannel) => {
    cam.error = 'Testing...';
    manager.setOnUpdate(() => {});

    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/camera/health`,
        { method: 'POST' }
      );

      const data = await res.json();
      cam.error = data.ok ? 'OK' : 'FAIL';

      manager.setOnUpdate(() => {});
    } catch {
      cam.error = 'NETWORK ERROR';
      manager.setOnUpdate(() => {});
    }
  };

  return (
    <div className={styles.page} data-theme={theme}>
      {/* HEADER */}
      <div className={styles.header}>
        <div>
          <div className={styles.title}>
            <Camera size={16} style={{ marginRight: 8 }} />
            CAMERA MANAGEMENT
          </div>

          <div className={styles.subtitle}>
            SCADA Control Plane
          </div>
        </div>

        <button
          className={`${styles.btn} ${styles.btnPrimary}`}
          onClick={() => setShowForm(true)}
        >
          + Add Camera
        </button>
      </div>

      {/* STATS */}
      <div className={styles.stats}>
        <div className={styles.card}>
          <div className={styles.cardLabel}>Total</div>
          <div className={styles.cardValue}>{cameras.length}</div>
        </div>

        <div className={styles.card}>
          <div className={styles.cardLabel}>Active</div>
          <div className={styles.cardValue}>
            {cameras.filter(c => c.isActive).length}
          </div>
        </div>

        <div className={styles.card}>
          <div className={styles.cardLabel}>Detecting</div>
          <div className={styles.cardValue}>
            {cameras.filter(c => c.isDetecting).length}
          </div>
        </div>

        <div className={styles.card}>
          <div className={styles.cardLabel}>Errors</div>
          <div className={styles.cardValue}>
            {cameras.filter(c => c.error).length}
          </div>
        </div>
      </div>

      {/* LIST */}
      <div className={styles.list}>
        {cameras.map(cam => (
          <div key={cam.id} className={styles.item}>
  {/* LEFT */}
  <div className={styles.left}>
  <div className={styles.titleRow}>
    <span className={styles.icon}>
      <Camera size={14} />
    </span>

    <span className={styles.titleText}>{cam.label}</span>

    <span className={styles.badge}>#{cam.id}</span>
  </div>

  <div className={styles.metaRow}>
    <span className={styles.meta}>{cam.mode.toUpperCase()}</span>
  </div>

  <div className={styles.statusRow}>
    <span className={`${styles.status} ${cam.isActive ? styles.online : styles.offline}`}>
      <Activity size={12} />
      {cam.isActive ? 'ONLINE' : 'OFFLINE'}
    </span>

    {cam.isDetecting && (
      <span className={`${styles.status} ${styles.ai}`}>
        <Zap size={12} />
        RUNNING
      </span>
    )}
  </div>
</div>

  {/* RIGHT ACTIONS */}
  <div className={styles.actions}>
    <button className={styles.btn} onClick={() => testCamera(cam)}>
      <AlertTriangle size={14} />
      Test
    </button>

    <button
      className={`${styles.btn} ${
        cam.isActive ? styles.btnDanger : styles.btnPrimary
      }`}
      onClick={() => toggleCamera(cam)}
    >
      {cam.isActive ? (
        <>
          <Square size={14} />
          Stop
        </>
      ) : (
        <>
          <Play size={14} />
          Start
        </>
      )}
    </button>
  </div>
</div>
        ))}
      </div>

      {/* MODAL */}
      {showForm && (
  <div className={styles.modalOverlay}>
    <div className={styles.modal}>
      <div className={styles.modalTitle}>
        Add Camera
      </div>

      <div className={styles.modalSub}>
        Create a new camera channel
      </div>

      <input
        className={styles.input}
        placeholder="Camera name"
        value={form.name}
        onChange={(e) =>
          setForm({
            ...form,
            name: e.target.value,
          })
        }
      />

      <div className={styles.typeGrid}>
        <button
          type="button"
          className={
            form.type === 'webcam'
              ? styles.typeActive
              : styles.typeCard
          }
          onClick={() =>
            setForm({
              ...form,
              type: 'webcam',
            })
          }
        >
          <Camera size={18} />
          <span>Webcam</span>
        </button>

        <button
          type="button"
          className={
            form.type === 'ip'
              ? styles.typeActive
              : styles.typeCard
          }
          onClick={() =>
            setForm({
              ...form,
              type: 'ip',
            })
          }
        >
          <Activity size={18} />
          <span>IP Camera</span>
        </button>
      </div>

      <div className={styles.modalActions}>
        <button
          className={`${styles.btn} ${styles.btnPrimary}`}
          onClick={addCamera}
        >
          Add Camera
        </button>

        <button
          className={styles.btn}
          onClick={() => setShowForm(false)}
        >
          Cancel
        </button>
      </div>
    </div>
  </div>
)}

      {showDeviceModal && pendingCam && (
  <div className={styles.modalOverlay}>
    <div className={styles.cameraPicker}>
      
      <div className={styles.cameraPickerHeader}>
        <div>
          <h2>Connect Camera</h2>
          <p>Select source for {pendingCam.label}</p>
        </div>
         <div className={styles.cameraBadge}>
    #{pendingCam.id} • {pendingCam.label}
  </div>
      </div>

      <div className={styles.sourceTabs}>
        <button
          className={
            sourceTab === 'webcam'
      ? styles.activeTab
      : styles.tab
          }
          onClick={() => setSourceTab('webcam')}
        >
          <Camera size={15} />
          <span>Local Webcam</span>
        </button>

        <button
          className={
            sourceTab === 'ip'
              ? styles.activeTab
              : styles.tab
          }
          onClick={() => setSourceTab('ip')}
        >
          <Wifi size={16} />
  <span>RTSP Camera</span>
        </button>
      </div>

      {sourceTab === 'webcam' && (
        <div className={styles.deviceGrid}>
          {devices.map((dev) => {
            const used = cameras.some(
              c =>
                c.deviceId === dev.deviceId &&
                c.isActive
            );

            return (
              <div
                key={dev.deviceId}
                className={`${styles.deviceCard} ${
                  used ? styles.disabled : ''
                }`}
              >
                <div className={styles.deviceIcon}>
                  {used ? (
                    <Lock size={18} />
                  ) : (
                    <Camera size={18} />
                  )}
                </div>

                <div className={styles.deviceInfo}>
                  <div className={styles.deviceName}>
  {dev.label || 'USB Camera'}
</div>

                  <small>
                    {used
                      ? 'Already connected'
                      : 'Available'}
                  </small>
                </div>

                <button
                  disabled={used}
                  className={styles.connectBtn}
                  onClick={() =>
                    handleStartWebcam(
                      dev.deviceId,
                      dev.label
                    )
                  }
                >
                  Connect
                </button>
              </div>
            );
          })}
        </div>
      )}

      {sourceTab === 'ip' && (
        <div className={styles.ipSection}>
         <div className={styles.sectionLabel}>
  Network Stream
</div>

          <input
            value={rtspUrl}
            onChange={(e) =>
              setRtspUrl(e.target.value)
            }
            className={styles.ipInput}
            placeholder="rtsp://admin:123456@192.168.1.10:554/stream1"
          />

          <button
  className={styles.connectBtnLarge}
  disabled={!rtspUrl.trim()}
  onClick={() =>
    handleStartIPCamera(rtspUrl)
  }
>
  <Wifi size={16} />
  Connect Stream
</button>
        </div>
      )}

      <div className={styles.footer}>
        <button
          className={styles.cancelBtn}
          onClick={() => {
  setShowDeviceModal(false);
  setPendingCam(null);
  setRtspUrl('');
  setSourceTab('webcam');
}}
        >
          Cancel
        </button>
      </div>
    </div>
  </div>
)}
    </div>
  );
}