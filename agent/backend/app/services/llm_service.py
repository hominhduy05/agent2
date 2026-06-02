import base64
import json
import httpx
from typing import Any, AsyncGenerator

from app.core.config import SYSTEM_PROMPTS, settings


class LLMService:
    def __init__(self):
        self.url = settings.lm_studio_url
        self.model = settings.chat_agent_model
        self.max_tokens = settings.max_tokens
        self.temperature = settings.temperature
        self._client: httpx.AsyncClient | None = None

    async def _get_client(self) -> httpx.AsyncClient:
        if self._client is None or self._client.is_closed:
            self._client = httpx.AsyncClient(
                base_url=self.url.replace("/v1/chat/completions", ""),
                timeout=httpx.Timeout(120.0),
            )
        return self._client

    def _build_vision_messages(
        self, image_b64: str, prompt: str, role: str
    ) -> list[dict[str, Any]]:
        system_content = SYSTEM_PROMPTS[role]
        return [
            {"role": "system", "content": system_content},
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": prompt},
                    {
                        "type": "image_url",
                        "image_url": {"url": f"data:image/jpeg;base64,{image_b64}"},
                    },
                ],
            },
        ]

    def _build_text_messages(
        self, message: str, role: str, history: list[dict[str, str]] | None = None
    ) -> list[dict[str, Any]]:
        system_content = SYSTEM_PROMPTS[role]
        messages = [{"role": "system", "content": system_content}]
        if history:
            messages.extend(history[-settings.chat_history_messages:])
        messages.append({"role": "user", "content": message})
        return messages

    async def _post(
        self,
        messages: list[dict[str, Any]],
        model: str | None = None,
        max_tokens: int | None = None,
    ) -> str:
        client = await self._get_client()
        payload = {
            "model": model or self.model,
            "messages": messages,
            "max_tokens": max_tokens or self.max_tokens,
            "temperature": self.temperature,
            "stream": False,
        }
        response = await client.post("/v1/chat/completions", json=payload)
        response.raise_for_status()
        data = response.json()
        return data["choices"][0]["message"]["content"]

    async def _stream_post(
        self,
        messages: list[dict[str, Any]],
        model: str | None = None,
        max_tokens: int | None = None,
    ) -> AsyncGenerator[str, None]:
        client = await self._get_client()
        payload = {
            "model": model or self.model,
            "messages": messages,
            "max_tokens": max_tokens or self.max_tokens,
            "temperature": self.temperature,
            "stream": True,
        }

        async with client.stream("POST", "/v1/chat/completions", json=payload) as response:
            response.raise_for_status()
            async for line in response.aiter_lines():
                if not line.startswith("data: "):
                    continue

                data_str = line[6:].strip()
                if not data_str or data_str == "[DONE]":
                    continue

                chunk = json.loads(data_str)
                token = chunk["choices"][0].get("delta", {}).get("content", "")
                if token:
                    yield token

    async def analyze_image(
        self,
        image_b64: str,
        prompt: str = "Analyze this image in detail for the SCADA/IoT system.",
        analysis_type: str = "general",
    ) -> str:
        role_map = {
            "dashboard": "dashboard_reader",
            "error": "error_diagnoser",
            "camera": "vision_analyzer",
            "general": "vision_analyzer",
        }
        role = role_map.get(analysis_type, "vision_analyzer")
        messages = self._build_vision_messages(image_b64, prompt, role)
        return await self._post(messages)

    async def chat(
        self,
        message: str,
        history: list[dict[str, str]] | None = None,
        model: str | None = None,
    ) -> str:
        messages = self._build_text_messages(message, "operation_assistant", history)
        return await self._post(messages, model, settings.chat_max_tokens)

    async def stream_chat(
        self,
        message: str,
        history: list[dict[str, str]] | None = None,
        model: str | None = None,
    ) -> AsyncGenerator[str, None]:
        messages = self._build_text_messages(message, "operation_assistant", history)
        async for token in self._stream_post(messages, model, settings.chat_max_tokens):
            yield token

    async def close(self):
        if self._client and not self._client.is_closed:
            await self._client.aclose()


llm_service = LLMService()
