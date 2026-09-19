"""Strip EXIF metadata from uploaded hazard photos before storing or sending
to the VLM — we use the lat/lon the client submits, not any EXIF GPS data,
and don't want to leak device/location metadata in stored files."""
from __future__ import annotations

import io

from PIL import Image


def strip_exif(image_bytes: bytes) -> bytes:
    img = Image.open(io.BytesIO(image_bytes))
    img = img.convert("RGB") if img.mode not in ("RGB", "L") else img
    buf = io.BytesIO()
    # Pillow only embeds EXIF on save if you explicitly pass exif=..., so a
    # plain re-save (with no exif kwarg) already drops all metadata.
    img.save(buf, format="JPEG", quality=88)
    return buf.getvalue()
