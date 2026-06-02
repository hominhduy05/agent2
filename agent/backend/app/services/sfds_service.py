import base64
from typing import Any

import httpx
from app.core.config import settings


class SFDSService:
    def __init__(self):
        self.base_url = settings.sfds_base_url
        self.timeout = settings.sfds_timeout

    async def aget_health(self) -> dict[str, Any]:
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            r = await client.get(f"{self.base_url}/health/")
            r.raise_for_status()
            return r.json()

    async def aget_cameras(self) -> dict[str, Any]:
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            r = await client.get(f"{self.base_url}/api/scada/cameras/")
            r.raise_for_status()
            return r.json()

    async def aget_stats(self) -> dict[str, Any]:
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            r = await client.get(f"{self.base_url}/api/dataset/stats/")
            r.raise_for_status()
            return r.json()

    async def adetect(self, image: bytes | str, conf: float = 0.25) -> dict[str, Any]:
        image_bytes = self._coerce_image_bytes(image)
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            r = await client.post(
                f"{self.base_url}/detect/",
                data={"conf": str(conf)},
                files={"file": ("frame.jpg", image_bytes, "image/jpeg")},
            )
            r.raise_for_status()
            return r.json()

    def get_health(self) -> dict[str, Any]:
        with httpx.Client(timeout=self.timeout) as client:
            r = client.get(f"{self.base_url}/health/")
            r.raise_for_status()
            return r.json()

    def get_cameras(self) -> dict[str, Any]:
        with httpx.Client(timeout=self.timeout) as client:
            r = client.get(f"{self.base_url}/api/scada/cameras/")
            r.raise_for_status()
            return r.json()

    def get_stats(self) -> dict[str, Any]:
        with httpx.Client(timeout=self.timeout) as client:
            r = client.get(f"{self.base_url}/api/dataset/stats/")
            r.raise_for_status()
            return r.json()

    def detect(self, image: bytes | str, conf: float = 0.25) -> dict[str, Any]:
        image_bytes = self._coerce_image_bytes(image)
        with httpx.Client(timeout=self.timeout) as client:
            r = client.post(
                f"{self.base_url}/detect/",
                data={"conf": str(conf)},
                files={"file": ("frame.jpg", image_bytes, "image/jpeg")},
            )
            r.raise_for_status()
            return r.json()

    @staticmethod
    def _coerce_image_bytes(image: bytes | str) -> bytes:
        if isinstance(image, bytes):
            return image
        if image.startswith("data:image"):
            image = image.split(",", 1)[1]
        return base64.b64decode(image)


sfds_service = SFDSService()
