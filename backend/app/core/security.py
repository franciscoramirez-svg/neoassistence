import hashlib
import hmac


def verify_pin(pin_input: str, pin_hash: str | None, pin_legacy: str | None = None) -> bool:
    # Direct match for plain text PINs (like "1234")
    if pin_legacy:
        if pin_input == str(pin_legacy):
            return True
    # Hash comparison
    if pin_hash:
        candidate = hashlib.sha256(pin_input.encode("utf-8")).hexdigest()
        return hmac.compare_digest(candidate, str(pin_hash))
    # If pin_hash is None and there's only one param, check direct
    if pin_legacy is None and pin_hash is None:
        return False
    return False
