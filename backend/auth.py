"""Session JWT authentication."""
import logging
from functools import wraps
import jwt
from flask import request, jsonify

from config import config

log = logging.getLogger("influx.auth")


def issue_token(subject: str) -> str:
    """Issue a signed JWT token."""
    payload = {"sub": subject}
    return jwt.encode(payload, config.JWT_SECRET, algorithm="HS256")


def current_session():
    """Decode and return the current session JWT from the cookie, or None."""
    token = request.cookies.get(config.SESSION_COOKIE)
    if not token:
        return None
    try:
        payload = jwt.decode(token, config.JWT_SECRET, algorithms=["HS256"])
        return payload
    except (jwt.DecodeError, jwt.ExpiredSignatureError):
        return None


def login_required(f):
    """Decorator: require a valid session JWT."""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        session = current_session()
        if not session:
            return jsonify({"error": "unauthorized", "message": "Authentication required"}), 401
        request.session_payload = session
        return f(*args, **kwargs)
    return decorated_function
