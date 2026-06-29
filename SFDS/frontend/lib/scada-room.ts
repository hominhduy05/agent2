export function getRoomByCamera(cameraId: number) {
  return Math.floor(cameraId / 5) + 1;
}

export function getRoomName(cameraId: number) {
  return `BUỒNG ${getRoomByCamera(cameraId)}`;
}
