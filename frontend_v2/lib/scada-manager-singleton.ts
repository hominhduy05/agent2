import { ScadaCameraManager } from "./scada-camera";

let manager: ScadaCameraManager | null = null;

export function getScadaManager() {
  if (!manager) {
    manager = new ScadaCameraManager(5);
  }

  return manager;
}