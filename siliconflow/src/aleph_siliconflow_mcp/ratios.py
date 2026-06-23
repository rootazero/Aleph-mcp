"""Pure aspect-ratio → pixel-size mappings (no IO)."""

IMAGE_SIZES = {
    "1:1": "1024x1024",
    "3:4": "768x1024",
    "4:3": "1024x768",
    "9:16": "576x1024",
    "16:9": "1024x576",
}

# Official video API accepts only these three sizes.
VIDEO_SIZES = {
    "16:9": "1280x720",
    "9:16": "720x1280",
    "1:1": "960x960",
}


def image_size_for(aspect_ratio: str) -> str:
    try:
        return IMAGE_SIZES[aspect_ratio]
    except KeyError:
        allowed = ", ".join(IMAGE_SIZES)
        raise ValueError(
            f"unsupported image aspect_ratio '{aspect_ratio}'; allowed: {allowed}"
        )


def video_size_for(aspect_ratio: str) -> str:
    try:
        return VIDEO_SIZES[aspect_ratio]
    except KeyError:
        allowed = ", ".join(VIDEO_SIZES)
        raise ValueError(
            f"unsupported video aspect_ratio '{aspect_ratio}'; allowed: {allowed}"
        )
