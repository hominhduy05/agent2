"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./page.module.css";

type WebcamStatus = "pending" | "checking" | "online" | "offline";

interface WebcamDevice {
  deviceId: string;
  label: string;
  status: WebcamStatus;
  message: string;
  width?: number;
  height?: number;
}

function stopStream(stream: MediaStream | null) {
  stream?.getTracks().forEach((track) => track.stop());
}

export default function WebcamCheckPage() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const previewStreamRef = useRef<MediaStream | null>(null);
  const [devices, setDevices] = useState<WebcamDevice[]>([]);
  const [permission, setPermission] = useState<"unknown" | "granted" | "denied">("unknown");
  const [activeDeviceId, setActiveDeviceId] = useState<string>("");
  const [isChecking, setIsChecking] = useState(false);
  const [summary, setSummary] = useState("Dang cho quyen truy cap camera");
  const [error, setError] = useState("");

  useEffect(() => {
    void listDevices(false);
    return () => stopStream(previewStreamRef.current);
  }, []);

  async function listDevices(withPermission: boolean) {
    setError("");

    if (!navigator.mediaDevices?.enumerateDevices) {
      setError("Trinh duyet khong ho tro mediaDevices.enumerateDevices.");
      setSummary("Khong the kiem tra webcam tren trinh duyet nay");
      return;
    }

    let permissionStream: MediaStream | null = null;
    try {
      if (withPermission) {
        permissionStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        setPermission("granted");
      }

      const mediaDevices = await navigator.mediaDevices.enumerateDevices();
      const cameras = mediaDevices.filter((device) => device.kind === "videoinput");
      setDevices(
        cameras.map((device, index) => ({
          deviceId: device.deviceId,
          label: device.label || `Webcam ${index + 1}`,
          status: "pending",
          message: withPermission ? "San sang kiem tra" : "Can cap quyen de doc ten va test camera",
        })),
      );
      setSummary(cameras.length ? `Tim thay ${cameras.length} webcam` : "Khong tim thay webcam nao");
    } catch (err) {
      setPermission("denied");
      setError(err instanceof Error ? err.message : "Khong the truy cap webcam.");
      setSummary("Trinh duyet chua duoc cap quyen camera");
    } finally {
      stopStream(permissionStream);
    }
  }

  async function testDevice(device: WebcamDevice): Promise<WebcamDevice> {
    let stream: MediaStream | null = null;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { deviceId: { exact: device.deviceId } },
        audio: false,
      });
      const track = stream.getVideoTracks()[0];
      const settings = track?.getSettings?.() || {};
      return {
        ...device,
        status: "online",
        message: "Online",
        width: settings.width,
        height: settings.height,
      };
    } catch (err) {
      return {
        ...device,
        status: "offline",
        message: err instanceof Error ? err.message : "Khong mo duoc camera",
      };
    } finally {
      stopStream(stream);
    }
  }

  async function runFullCheck() {
    setIsChecking(true);
    setSummary("Dang kiem tra webcam trinh duyet");
    setError("");
    stopStream(previewStreamRef.current);
    previewStreamRef.current = null;

    await listDevices(true);
    const mediaDevices = await navigator.mediaDevices.enumerateDevices();
    const cameras = mediaDevices.filter((device) => device.kind === "videoinput");
    const initialDevices: WebcamDevice[] = cameras.map((device, index) => ({
      deviceId: device.deviceId,
      label: device.label || `Webcam ${index + 1}`,
      status: "checking",
      message: "Dang kiem tra",
    }));
    setDevices(initialDevices);

    const checked: WebcamDevice[] = [];
    for (const device of initialDevices) {
      const result = await testDevice(device);
      checked.push(result);
      setDevices([...checked, ...initialDevices.slice(checked.length)]);
    }

    const online = checked.filter((device) => device.status === "online").length;
    setSummary(`${online}/${checked.length} webcam dang hoat dong`);
    setIsChecking(false);

    const firstOnline = checked.find((device) => device.status === "online");
    if (firstOnline) {
      await previewDevice(firstOnline.deviceId);
    }
  }

  async function previewDevice(deviceId: string) {
    stopStream(previewStreamRef.current);
    previewStreamRef.current = null;
    setActiveDeviceId(deviceId);
    setError("");

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { deviceId: { exact: deviceId } },
        audio: false,
      });
      previewStreamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Khong mo duoc preview webcam.");
    }
  }

  const onlineCount = devices.filter((device) => device.status === "online").length;

  return (
    <main className={styles.page}>
      <section className={styles.shell}>
        <div className={styles.header}>
          <div>
            <p className={styles.kicker}>SFDS diagnostics</p>
            <h1>Browser webcam check</h1>
            <p className={styles.copy}>
              Kiem tra webcam duoc trinh duyet nhin thay. Trinh duyet se hoi quyen camera truoc khi test.
            </p>
          </div>
          <button className={styles.primaryButton} onClick={runFullCheck} disabled={isChecking}>
            {isChecking ? "Dang kiem tra" : "Kiem tra webcam"}
          </button>
        </div>

        <div className={styles.statusBar}>
          <div>
            <span className={styles.statusLabel}>Tong quan</span>
            <strong>{summary}</strong>
          </div>
          <div>
            <span className={styles.statusLabel}>Quyen camera</span>
            <strong>{permission}</strong>
          </div>
          <div>
            <span className={styles.statusLabel}>Online</span>
            <strong>{onlineCount}/{devices.length}</strong>
          </div>
        </div>

        {error && <p className={styles.error}>{error}</p>}

        <div className={styles.grid}>
          <section className={styles.panel}>
            <div className={styles.panelHeader}>
              <h2>Danh sach webcam</h2>
              <button className={styles.secondaryButton} onClick={() => listDevices(false)} disabled={isChecking}>
                Lam moi
              </button>
            </div>
            <div className={styles.deviceList}>
              {devices.length === 0 ? (
                <div className={styles.empty}>
                  Chua co webcam nao. Bam "Kiem tra webcam" va cho phep quyen camera.
                </div>
              ) : (
                devices.map((device, index) => (
                  <button
                    key={`${device.deviceId}-${index}`}
                    className={`${styles.deviceRow} ${activeDeviceId === device.deviceId ? styles.active : ""}`}
                    onClick={() => previewDevice(device.deviceId)}
                    disabled={device.status !== "online"}
                  >
                    <span className={`${styles.dot} ${styles[device.status]}`} />
                    <span>
                      <strong>{device.label}</strong>
                      <small>
                        Slot trinh duyet {index + 1}
                        {device.width && device.height ? ` | ${device.width}x${device.height}` : ""}
                      </small>
                    </span>
                    <em>{device.message}</em>
                  </button>
                ))
              )}
            </div>
          </section>

          <section className={styles.previewPanel}>
            <div className={styles.previewHeader}>
              <h2>Preview</h2>
              <span>{activeDeviceId ? "Dang mo webcam" : "Chua chon webcam"}</span>
            </div>
            <div className={styles.previewFrame}>
              <video ref={videoRef} muted playsInline className={styles.video} />
              {!activeDeviceId && <div className={styles.previewEmpty}>Preview se hien o day sau khi camera online.</div>}
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}
