'use client';

import { useEffect, useReducer, useState } from 'react';
import styles from './camera.module.css';
import { useScada } from '@/hooks/use-scada';
import { getScadaManager } from '@/lib/scada-manager';
import { CameraChannel } from '@/lib/scada-camera';
import { Modal } from '@/components/ui/Modal';
import Button from '@/components/ui/Button';

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
  // const manager = getScadaManager(() => {});
  // const [manager] = useState(() => getScadaManager(() => {}));
  const [manager] = useState(() => getScadaManager());

  const [devices, setDevices] = useState<MediaDevice[]>([]);
  const [showDeviceModal, setShowDeviceModal] = useState(false);
  const [pendingCam, setPendingCam] = useState<CameraChannel | null>(null);
  // const [showIpModal, setShowIpModal] = useState(false);
  const [sourceTab, setSourceTab] = useState<'webcam' | 'ip'>('webcam');

  const [rtspUrl, setRtspUrl] = useState('');

  const [theme] = useState<'dark' | 'light'>('dark');
  const [showForm, setShowForm] = useState(false);

  const [form, setForm] = useState({
    name: '',
    type: 'ip' as CameraType,
    ipUrl: '',
  });

  const [, force] = useReducer((x) => x + 1, 0);

  useEffect(() => {
    return manager.subscribe(() => {
      force();
    });
  }, []);

  useEffect(() => {
    async function loadDevices() {
      try {
        const tempStream = await navigator.mediaDevices.getUserMedia({
          video: true,
        });
        tempStream.getTracks().forEach((track) => track.stop());

        const devs = await navigator.mediaDevices.enumerateDevices();

        setDevices(
          devs
            .filter((d) => d.kind === 'videoinput')
            .map((d) => ({
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
    // manager.setOnUpdate(() => {});
    setShowForm(false);
    setForm({ name: '', type: 'ip', ipUrl: '' });

    // manager.setOnUpdate(() => {});
  };

  const toggleCamera = (cam: CameraChannel) => {
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

  const handleStartWebcam = async (deviceId: string, label: string) => {
    if (!pendingCam) return;

    await manager.startWebcam(pendingCam.id, deviceId, label);

    manager.startWebSocketDetect(pendingCam.id);

    setShowDeviceModal(false);
    setPendingCam(null);
  };

  const handleStartIPCamera = async (url: string) => {
    if (!pendingCam || !url.trim()) return;

    await manager.startIPCamera(pendingCam.id, url, pendingCam.label);

    manager.startWebSocketDetect(pendingCam.id);

    setShowDeviceModal(false);
    setPendingCam(null);
    setRtspUrl('');
  };

  const testCamera = async (cam: CameraChannel) => {
    cam.error = 'Testing...';
    // manager.setOnUpdate(() => {});

    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/camera/health`,
        { method: 'POST' }
      );

      const data = await res.json();
      cam.error = data.ok ? 'OK' : 'FAIL';

      // manager.setOnUpdate(() => {});
    } catch {
      cam.error = 'NETWORK ERROR';
      // manager.setOnUpdate(() => {});
    }
  };

  return (
    <div className={styles.page} data-theme={theme}>
      {/* HEADER */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--text)]">
            Camera Management
          </h1>

          <p className="text-sm text-[var(--text-muted)]">
            SCADA Control Plane
          </p>
        </div>

        <button
          onClick={() => setShowForm(true)}
          className="
      px-4 py-2 rounded-xl
      bg-[var(--accent)]
      text-white
      hover:opacity-90
      transition
    "
        >
          + Add Camera
        </button>
      </div>

      {/* STATS */}
      <div className={styles.stats}>
        <div
          className="
  rounded-2xl
  bg-[var(--surface)]
  border border-[var(--border)]
  p-5
  shadow-sm
"
        >
          <div className="text-xs text-[var(--text-muted)] uppercase">
            Total
          </div>

          <div className="mt-2 text-2xl font-bold text-[var(--text)]">
            {cameras.length}
          </div>
        </div>

        <div
          className="
  rounded-2xl
  bg-[var(--surface)]
  border border-[var(--border)]
  p-5
  shadow-sm
"
        >
          <div className="text-xs text-[var(--text-muted)] uppercase">
            Active
          </div>

          <div className="mt-2 text-2xl font-bold text-[var(--text)]">
            {cameras.filter((c) => c.isActive).length}
          </div>
        </div>

        <div
          className="
  rounded-2xl
  bg-[var(--surface)]
  border border-[var(--border)]
  p-5
  shadow-sm
"
        >
          <div className="text-xs text-[var(--text-muted)] uppercase">
            Detecting
          </div>

          <div className="mt-2 text-2xl font-bold text-[var(--text)]">
            {cameras.filter((c) => c.isDetecting).length}
          </div>
        </div>

        <div
          className="
  rounded-2xl
  bg-[var(--surface)]
  border border-[var(--border)]
  p-5
  shadow-sm
"
        >
          <div className="text-xs text-[var(--text-muted)] uppercase">
            Errors
          </div>

          <div className="mt-2 text-2xl font-bold text-[var(--text)]">
            {cameras.filter((c) => c.error).length}
          </div>
        </div>
      </div>

      {/* LIST */}
      <div className={styles.list}>
        {cameras.map((cam) => (
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
                <span
                  className={`${styles.status} ${cam.isActive ? styles.online : styles.offline}`}
                >
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
      <Modal
        isOpen={showForm}
        onClose={() => setShowForm(false)}
        className="max-w-md p-6 border border-gray-200 dark:border-gray-800 shadow-2xl overflow-hidden"
      >
        <div className="space-y-6">
          <div>
            <h3
              className="text-lg font-bold text-gray-900 dark:text-white"
              style={{ fontFamily: 'Sora, sans-serif' }}
            >
              Add Camera
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Create a new camera channel
            </p>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">
              Camera name
            </label>
            <input
              className="w-full px-3 py-2.5 text-sm rounded-lg bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 text-gray-900 dark:text-white focus:outline-none focus:border-brand-500 transition-colors"
              placeholder="Camera name"
              value={form.name}
              onChange={(e) =>
                setForm({
                  ...form,
                  name: e.target.value,
                })
              }
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">
              Loại Camera
            </label>
            <div className="grid grid-cols-2 gap-4">
              <button
                type="button"
                className={`flex flex-col items-center justify-center p-4 rounded-xl border transition-all gap-2 group ${
                  form.type === 'webcam'
                    ? 'border-brand-500 bg-brand-500/10 text-brand-500'
                    : 'border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-950/40 hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400'
                }`}
                onClick={() =>
                  setForm({
                    ...form,
                    type: 'webcam',
                  })
                }
              >
                <Camera
                  size={20}
                  className={
                    form.type === 'webcam'
                      ? 'text-brand-500'
                      : 'text-gray-400 group-hover:text-gray-500'
                  }
                />
                <span className="text-xs font-bold">Webcam</span>
              </button>

              <button
                type="button"
                className={`flex flex-col items-center justify-center p-4 rounded-xl border transition-all gap-2 group ${
                  form.type === 'ip'
                    ? 'border-brand-500 bg-brand-500/10 text-brand-500'
                    : 'border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-950/40 hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400'
                }`}
                onClick={() =>
                  setForm({
                    ...form,
                    type: 'ip',
                  })
                }
              >
                <Activity
                  size={20}
                  className={
                    form.type === 'ip'
                      ? 'text-brand-500'
                      : 'text-gray-400 group-hover:text-gray-500'
                  }
                />
                <span className="text-xs font-bold">IP Camera</span>
              </button>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-gray-100 dark:border-gray-800">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowForm(false)}
            >
              Cancel
            </Button>
            <Button variant="primary" size="sm" onClick={addCamera}>
              Add Camera
            </Button>
          </div>
        </div>
      </Modal>

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
                  sourceTab === 'webcam' ? styles.activeTab : styles.tab
                }
                onClick={() => setSourceTab('webcam')}
              >
                <Camera size={15} />
                <span>Local Webcam</span>
              </button>

              <button
                className={sourceTab === 'ip' ? styles.activeTab : styles.tab}
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
                    (c) => c.deviceId === dev.deviceId && c.isActive
                  );

                  return (
                    <div
                      key={dev.deviceId}
                      className={`${styles.deviceCard} ${
                        used ? styles.disabled : ''
                      }`}
                    >
                      <div className={styles.deviceIcon}>
                        {used ? <Lock size={18} /> : <Camera size={18} />}
                      </div>

                      <div className={styles.deviceInfo}>
                        <div className={styles.deviceName}>
                          {dev.label || 'USB Camera'}
                        </div>

                        <small>
                          {used ? 'Already connected' : 'Available'}
                        </small>
                      </div>

                      <button
                        disabled={used}
                        className={styles.connectBtn}
                        onClick={() =>
                          handleStartWebcam(dev.deviceId, dev.label)
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
                <div className={styles.sectionLabel}>Network Stream</div>

                <input
                  value={rtspUrl}
                  onChange={(e) => setRtspUrl(e.target.value)}
                  className={styles.ipInput}
                  placeholder="rtsp://admin:123456@192.168.1.10:554/stream1"
                />

                <button
                  className={styles.connectBtnLarge}
                  disabled={!rtspUrl.trim()}
                  onClick={() => handleStartIPCamera(rtspUrl)}
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
