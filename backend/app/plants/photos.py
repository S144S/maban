import warnings
from io import BytesIO

from PIL import Image, ImageOps, UnidentifiedImageError

from app.plants.errors import PlantError

MAX_UPLOAD_BYTES = 5 * 1024 * 1024
MAX_PIXELS = 20_000_000
FORMATS = {"JPEG": "image/jpeg", "PNG": "image/png", "WEBP": "image/webp"}


def normalize_photo(data: bytes, content_type: str) -> bytes:
    if not data:
        raise PlantError("اول یه عکس انتخاب کنین.", 422)
    if len(data) > MAX_UPLOAD_BYTES:
        raise PlantError("حجم عکس باید حداکثر ۵ مگابایت باشه.", 413)
    if content_type not in FORMATS.values():
        raise PlantError("عکس رو با فرمت JPEG، PNG یا WebP انتخاب کنین.", 415)
    try:
        with warnings.catch_warnings():
            warnings.simplefilter("error", Image.DecompressionBombWarning)
            with Image.open(BytesIO(data)) as source:
                if FORMATS.get(source.format) != content_type:
                    raise PlantError("فرمت فایل با عکس انتخاب‌شده هماهنگ نیست.", 415)
                if source.width * source.height > MAX_PIXELS:
                    raise PlantError("ابعاد عکس خیلی بزرگه؛ عکسی تا ۲۰ مگاپیکسل انتخاب کنین.", 422)
                if getattr(source, "is_animated", False):
                    raise PlantError("یه عکس ثابت انتخاب کنین؛ تصویر متحرک پشتیبانی نمی‌شه.", 422)
                source.load()
                oriented = ImageOps.exif_transpose(source)
                oriented.thumbnail((1600, 1600), Image.Resampling.LANCZOS)
                rgba = oriented.convert("RGBA")
                clean = Image.new("RGB", rgba.size, "white")
                clean.paste(rgba, mask=rgba.getchannel("A"))
                output = BytesIO()
                # Rebuild pixels in a fresh image: never retain EXIF/GPS, profiles or input bytes.
                clean.save(output, format="JPEG", quality=85)
                return output.getvalue()
    except (UnidentifiedImageError, OSError, ValueError, Image.DecompressionBombError,
            Image.DecompressionBombWarning) as error:
        raise PlantError("فایل عکس معتبر نیست؛ یه عکس دیگه انتخاب کنین.", 422) from error
