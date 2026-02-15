"""
Patina -- Text-to-Image Generation (Modal GPU Function)
Model: FLUX.1-schnell on A100

Endpoint:
  POST /
  Body:    { "prompt": str, "width": int, "height": int }
  Returns: { "image": "<base64 PNG>" }
"""

import modal
import fastapi
import io
import base64

image = (
    modal.Image.debian_slim(python_version="3.11")
    .pip_install(
        "torch==2.5.1",
        "diffusers>=0.32.0",
        "transformers>=4.44.0",
        "accelerate>=0.33.0",
        "safetensors",
        "sentencepiece",
        "protobuf",
        "Pillow",
        "fastapi[standard]",
    )
)

app = modal.App(name="patina-image-gen", image=image)

MODEL_ID = "black-forest-labs/FLUX.1-schnell"
VOLUME = modal.Volume.from_name("patina-model-cache", create_if_missing=True)
CACHE_DIR = "/model-cache"


@app.cls(
    gpu="A100",
    timeout=300,
    scaledown_window=120,
    volumes={CACHE_DIR: VOLUME},
    secrets=[modal.Secret.from_name("huggingface")],
)
@modal.concurrent(max_inputs=4)
class ImageGenerator:
    @modal.enter()
    def load_model(self):
        import torch
        from diffusers import FluxPipeline

        print(f"[image_gen] Loading {MODEL_ID} ...")
        self.pipe = FluxPipeline.from_pretrained(
            MODEL_ID,
            torch_dtype=torch.bfloat16,
            cache_dir=CACHE_DIR,
        )
        self.pipe.to("cuda")
        print(f"[image_gen] {MODEL_ID} loaded.")
        VOLUME.commit()

    @modal.fastapi_endpoint(method="POST", docs=True)
    async def generate(self, request: fastapi.Request):
        import torch

        body = await request.json()
        prompt = body.get("prompt")
        if not prompt:
            return {"error": "prompt is required"}

        width = min(int(body.get("width", 1024)), 2048)
        height = min(int(body.get("height", 1024)), 2048)
        width = (width // 8) * 8
        height = (height // 8) * 8

        print(f"[image_gen] {width}x{height} | {prompt[:200]}")

        with torch.inference_mode():
            result = self.pipe(
                prompt=prompt,
                width=width,
                height=height,
                num_inference_steps=4,
                guidance_scale=0.0,
            )

        buf = io.BytesIO()
        result.images[0].save(buf, format="PNG")
        b64 = base64.b64encode(buf.getvalue()).decode()

        print(f"[image_gen] Done. {len(b64)} chars.")
        return {"image": b64}
