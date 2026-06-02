import httpx
from functools import lru_cache
from typing import Any, Callable, Iterator, AsyncIterator, Sequence
from langchain_core.tools import BaseTool
from langchain_core.language_models import BaseChatModel
from langchain_core.messages import AIMessage, AIMessageChunk, BaseMessage
from langchain_core.outputs import ChatGeneration, ChatGenerationChunk, ChatResult
from langchain_core.callbacks import (
    AsyncCallbackManagerForLLMRun,
    CallbackManagerForLLMRun,
)
from app.core.config import settings


class LMStudioChatModel(BaseChatModel):
    """LangChain-compatible wrapper for LM Studio's OpenAI-compatible API."""

    model: str = settings.chat_agent_model
    temperature: float = settings.temperature
    max_tokens: int = settings.max_tokens
    base_url: str = settings.lm_studio_url.replace("/v1/chat/completions", "")

    def _llm_type(self) -> str:
        return "lmstudio"

    def bind_tools(
        self,
        tools: Sequence[dict[str, Any] | type | Callable | BaseTool],
        *,
        tool_choice: str | None = None,
        **kwargs: Any,
    ):
        return self

    def _payload(
        self,
        messages: list[BaseMessage],
        stop: list[str] | None,
        stream: bool,
    ) -> dict[str, Any]:
        payload: dict[str, Any] = {
            "model": self.model,
            "messages": [self._to_openai_format(m) for m in messages],
            "max_tokens": self.max_tokens,
            "temperature": self.temperature,
            "stream": stream,
        }
        if stop:
            payload["stop"] = stop
        return payload

    def _generate(
        self,
        messages: list[BaseMessage],
        stop: list[str] | None = None,
        run_manager: CallbackManagerForLLMRun | None = None,
        **kwargs: Any,
    ) -> ChatResult:
        with httpx.Client(
            base_url=self.base_url,
            timeout=httpx.Timeout(120.0),
        ) as client:
            response = client.post(
                "/v1/chat/completions",
                json=self._payload(messages, stop, stream=False),
            )
            response.raise_for_status()
            data = response.json()

        content = data["choices"][0]["message"]["content"]
        return ChatResult(
            generations=[ChatGeneration(message=AIMessage(content=content))]
        )

    async def _agenerate(
        self,
        messages: list[BaseMessage],
        stop: list[str] | None = None,
        run_manager: AsyncCallbackManagerForLLMRun | None = None,
        **kwargs: Any,
    ) -> ChatResult:
        async with httpx.AsyncClient(
            base_url=self.base_url,
            timeout=httpx.Timeout(120.0),
        ) as client:
            response = await client.post(
                "/v1/chat/completions",
                json=self._payload(messages, stop, stream=False),
            )
            response.raise_for_status()
            data = response.json()

        content = data["choices"][0]["message"]["content"]
        return ChatResult(
            generations=[ChatGeneration(message=AIMessage(content=content))]
        )

    def _stream(
        self,
        messages: list[BaseMessage],
        stop: list[str] | None = None,
        run_manager: CallbackManagerForLLMRun | None = None,
        **kwargs: Any,
    ) -> Iterator[ChatGenerationChunk]:
        with httpx.Client(
            base_url=self.base_url,
            timeout=httpx.Timeout(120.0),
        ) as client:
            with client.stream(
                "POST",
                "/v1/chat/completions",
                json=self._payload(messages, stop, stream=True),
            ) as response:
                response.raise_for_status()
                for line in response.iter_lines():
                    token = self._token_from_sse_line(line)
                    if token:
                        if run_manager:
                            run_manager.on_llm_new_token(token)
                        yield ChatGenerationChunk(
                            message=AIMessageChunk(content=token)
                        )

    async def _astream(
        self,
        messages: list[BaseMessage],
        stop: list[str] | None = None,
        run_manager: AsyncCallbackManagerForLLMRun | None = None,
        **kwargs: Any,
    ) -> AsyncIterator[ChatGenerationChunk]:
        async with httpx.AsyncClient(
            base_url=self.base_url,
            timeout=httpx.Timeout(120.0),
        ) as client:
            async with client.stream(
                "POST",
                "/v1/chat/completions",
                json=self._payload(messages, stop, stream=True),
            ) as response:
                response.raise_for_status()
                async for line in response.aiter_lines():
                    token = self._token_from_sse_line(line)
                    if token:
                        if run_manager:
                            await run_manager.on_llm_new_token(token)
                        yield ChatGenerationChunk(
                            message=AIMessageChunk(content=token)
                        )

    @staticmethod
    def _token_from_sse_line(line: str) -> str:
        if not line.startswith("data: "):
            return ""

        data_str = line[6:].strip()
        if data_str == "[DONE]":
            return ""

        import json

        chunk = json.loads(data_str)
        return chunk["choices"][0].get("delta", {}).get("content", "")

    @staticmethod
    def _to_openai_format(msg: BaseMessage) -> dict[str, Any]:
        role_map = {
            "human": "user",
            "ai": "assistant",
            "system": "system",
            "tool": "tool",
        }
        return {
            "role": role_map.get(msg.type, msg.type),
            "content": msg.content,
        }


@lru_cache(maxsize=16)
def llm_factory(
    model: str | None = None,
    temperature: float | None = None,
) -> LMStudioChatModel:
    return LMStudioChatModel(
        model=model or settings.chat_agent_model,
        temperature=temperature or settings.temperature,
        max_tokens=settings.max_tokens,
    )


def get_llm(model: str | None = None) -> LMStudioChatModel:
    return llm_factory(model)

