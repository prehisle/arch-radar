from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from fastapi.security import OAuth2PasswordBearer
from sqlmodel import Session, select
from datetime import datetime, timedelta
from typing import Optional
from pydantic import BaseModel
import uuid
import random
import string
from captcha.image import ImageCaptcha
import io
from fastapi.responses import StreamingResponse
from jose import JWTError, jwt
from passlib.context import CryptContext

from backend.database import get_session, redis_client
from backend.models import AdminUser
from backend.config import settings

router = APIRouter(prefix="/api/auth", tags=["auth"])

from Crypto.Cipher import AES
from Crypto.Util.Padding import unpad
import base64

# --- Security Config ---
SECRET_KEY = settings.SECRET_KEY or "your-secret-key-please-change-it"
# Use the first 16 bytes of SECRET_KEY as the AES Key
AES_KEY = SECRET_KEY.encode('utf-8')[:16].ljust(16, b'\0')

ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 # 24 hours

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")

# --- Schemas ---
class Token(BaseModel):
    access_token: str
    token_type: str

class LoginRequest(BaseModel):
    username: str
    password: str
    captcha_code: str
    captcha_id: str

# --- Utils ---
def decrypt_password(encrypted_password: str) -> str:
    try:
        # 1. Base64 Decode
        ciphertext = base64.b64decode(encrypted_password)
        # 2. Decrypt
        cipher = AES.new(AES_KEY, AES.MODE_ECB)
        decrypted = cipher.decrypt(ciphertext)
        # 3. Unpad
        return unpad(decrypted, AES.block_size).decode('utf-8')
    except Exception as e:
        print(f"Decryption failed: {e}")
        return ""

def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password):
    return pwd_context.hash(password)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

# --- Dependency ---
async def get_current_admin(token: str = Depends(oauth2_scheme), session: Session = Depends(get_session)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    # Check Blacklist
    if redis_client.get(f"blacklist:{token}"):
        raise credentials_exception

    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
        
    user = session.exec(select(AdminUser).where(AdminUser.username == username)).first()
    if user is None:
        raise credentials_exception
    return user

# --- Routes ---

@router.post("/logout")
async def logout(token: str = Depends(oauth2_scheme)):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        exp = payload.get("exp")
        if exp:
            now = datetime.utcnow()
            expire_time = datetime.fromtimestamp(exp)
            ttl = int((expire_time - now).total_seconds())
            
            if ttl > 0:
                redis_client.setex(f"blacklist:{token}", ttl, "1")
    except JWTError:
        pass # Invalid token, ignore
    
    return {"message": "Successfully logged out"}

@router.get("/captcha")
async def get_captcha():
    """Generate a captcha image and return ID + Image"""
    # 1. Generate Code
    code = ''.join(random.choices(string.ascii_uppercase + string.digits, k=4))
    captcha_id = str(uuid.uuid4())
    
    # 2. Store in Redis (5 mins)
    redis_client.setex(f"captcha:{captcha_id}", 300, code)
    
    # 3. Generate Image
    image = ImageCaptcha(width=160, height=60)
    data = image.generate(code)
    
    return StreamingResponse(io.BytesIO(data.read()), media_type="image/png", headers={"X-Captcha-ID": captcha_id})

@router.post("/login", response_model=Token)
async def login(req: LoginRequest, session: Session = Depends(get_session)):
    # 1. Verify Captcha
    stored_code = redis_client.get(f"captcha:{req.captcha_id}")
    if not stored_code:
        raise HTTPException(status_code=400, detail="验证码已过期")
    
    # Redis returns bytes
    if isinstance(stored_code, bytes):
        stored_code = stored_code.decode("utf-8")
        
    if stored_code.lower() != req.captcha_code.lower():
        raise HTTPException(status_code=400, detail="验证码错误")
    
    # Delete used captcha
    redis_client.delete(f"captcha:{req.captcha_id}")
    
    # 2. Decrypt Password
    decrypted_password = decrypt_password(req.password)
    if not decrypted_password:
        raise HTTPException(status_code=400, detail="密码解密失败")

    # 3. Verify User
    user = session.exec(select(AdminUser).where(AdminUser.username == req.username)).first()
    if not user or not verify_password(decrypted_password, user.hashed_password):
        raise HTTPException(status_code=401, detail="用户名或密码错误")
        
    if not user.is_active:
        raise HTTPException(status_code=403, detail="账号已被禁用")
        
    # 3. Create Token
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.username}, expires_delta=access_token_expires
    )
    
    return {"access_token": access_token, "token_type": "bearer"}

@router.get("/me")
async def read_users_me(current_user: AdminUser = Depends(get_current_admin)):
    return {"username": current_user.username, "active": current_user.is_active}
