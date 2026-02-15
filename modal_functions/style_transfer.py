"""
Patina -- Style Transfer (Modal GPU Function)
Model: FLUX.1-Kontext on A100

Endpoint:
  POST /
  Body:    { "target_image": str (base64 data URI),
             "style_references": [str],
             "prompt": str,
             "strength": float }
  Returns: { "image": "<base64 PNG>" }
"""

import modal
import fastapi
import io
import base64
import re

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
        "numpy<2",
        "fastapi[standard]",
    )
)

app = modal.App(name="patina-style-transfer", image=image)

VOLUME = modal.Volume.from_name("patina-model-cache", create_if_missing=True)
CACHE_DIR = "/model-cache"


def decode_data_uri(data_uri: str) -> bytes:
    """Decode a data URI or raw base64 string into bytes."""
    if data_uri.startswith("data:"):
        match = re.match(r"^data:[^;]+;base64,(.+)$", data_uri, re.DOTALL)
        if match:
            return base64.b64decode(match.group(1))
    return base64.b64decode(data_uri)


def bytes_to_pil(image_bytes: bytes):
    from PIL import Image as PILImage
    return PILImage.open(io.BytesIO(image_bytes)).convert("RGB")


@app.cls(
    gpu="A100",
    timeout=300,
    scaledown_window=120,
    volumes={CACHE_DIR: VOLUME},
    secrets=[modal.Secret.from_name("huggingface")],
)
@modal.concurrent(max_inputs=4)
class StyleTransfer:
    @modal.enter()
    def load_model(self):
        import torch

        # Try Kontext-specific pipeline first, then generic FLUX img2img
        model_loaded = False

        try:
            from diffusers import FluxKontextPipeline
            print("[style_transfer] Loading FLUX.1-Kontext via FluxKontextPipeline ...")
            self.pipe = FluxKontextPipeline.from_pretrained(
                "black-forest-labs/FLUX.1-Kontext-dev",
                torch_dtype=torch.bfloat16,
                cache_dir=CACHE_DIR,
            )
            self.pipe.to("cuda")
            self.model_name = "FLUX.1-Kontext"
            self.pipeline_type = "kontext"
            model_loaded = True
            print("[style_transfer] FLUX.1-Kontext loaded.")
        except Exception as e:
            print(f"[style_transfer] FluxKontextPipeline failed: {e}")

        if not model_loaded:
            try:
                from diffusers import FluxImg2ImgPipeline
                print("[style_transfer] Trying FLUX.1-schnell img2img ...")
                self.pipe = FluxImg2ImgPipeline.from_pretrained(
                    "black-forest-labs/FLUX.1-schnell",
                    torch_dtype=torch.bfloat16,
                    cache_dir=CACHE_DIR,
                )
                self.pipe.to("cuda")
                self.model_name = "FLUX.1-schnell-img2img"
                self.pipeline_type = "img2img"
                model_loaded = True
                print("[style_transfer] FLUX.1-schnell img2img loaded.")
            except Exception as e:
                print(f"[style_transfer] FLUX img2img failed: {e}")

        if not model_loaded:
            from diffusers import StableDiffusionXLImg2ImgPipeline
            print("[style_transfer] Falling back to SDXL img2img ...")
            self.pipe = StableDiffusionXLImg2ImgPipeline.from_pretrained(
                "stabilityai/stable-diffusion-xl-base-1.0",
                torch_dtype=torch.float16,
                use_safetensors=True,
                variant="fp16",
                cache_dir=CACHE_DIR,
            )
            self.pipe.to("cuda")
            self.model_name = "SDXL-img2img"
            self.pipeline_type = "img2img"
            print("[style_transfer] SDXL img2img loaded.")

        VOLUME.commit()

    @modal.fastapi_endpoint(method="POST", docs=True)
    async def transfer(self, request: fastapi.Request):
        import torch
        from PIL import Image as PILImage

        body = await request.json()
        target_uri = body.get("target_image")
        if not target_uri:
            return {"error": "target_image is required"}

        style_refs = body.get("style_references", [])
        prompt = body.get("prompt", "Apply artistic style transfer")
        strength = max(0.1, min(1.0, float(body.get("strength", 0.75))))

        # Decode target image
        target_pil = bytes_to_pil(decode_data_uri(target_uri))
        target_pil.thumbnail((1024, 1024), PILImage.LANCZOS)

        print(f"[style_transfer] Model: {self.model_name} | Strength: {strength}")
        print(f"[style_transfer] Prompt: {prompt[:200]}")

        with torch.inference_mode():
            if self.pipeline_type == "kontext":
                # FluxKontextPipeline does NOT accept 'strength'.
                # Use guidance_scale to control edit intensity instead.
                gen_kwargs = {
                    "prompt": prompt,
                    "image": target_pil,
                    "num_inference_steps": 28,
                    "guidance_scale": 2.5 + (strength * 5.0),  # map strength 0-1 → guidance 2.5-7.5
                }
            elif "schnell" in self.model_name.lower():
                gen_kwargs = {
                    "prompt": prompt,
                    "image": target_pil,
                    "strength": strength,
                    "num_inference_steps": 4,
                    "guidance_scale": 0.0,
                }
            else:
                gen_kwargs = {
                    "prompt": prompt,
                    "image": target_pil,
                    "strength": strength,
                    "num_inference_steps": 30,
                    "guidance_scale": 7.5,
                }

            result = self.pipe(**gen_kwargs)

        buf = io.BytesIO()
        result.images[0].save(buf, format="PNG")
        b64 = base64.b64encode(buf.getvalue()).decode()

        print(f"[style_transfer] Done. {len(b64)} chars.")
        return {"image": b64}
